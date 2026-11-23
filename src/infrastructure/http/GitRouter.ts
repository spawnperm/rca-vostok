import express from 'express';
import { appLogger } from '../logging/Logger.ts';
import { GitAuthError, type GitSyncAuthService } from '../git/GitSyncAuth.ts';
import { GitSyncError, type GitSyncService } from '../git/GitSyncService.ts';

const routerLog = appLogger.child('git-router');

export interface GitRouterDeps {
  gitAuth: GitSyncAuthService;
  gitSync: GitSyncService;
  unlockRateLimit: express.RequestHandler;
  pushRateLimit: express.RequestHandler;
}

function handleGitError(err: unknown, res: express.Response): void {
  if (err instanceof GitAuthError) {
    res.status(err.statusCode).json({ error: err.message, code: 'GIT_AUTH_ERROR' });
    return;
  }
  if (err instanceof GitSyncError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  routerLog.error('Unexpected GitRouter error', err);
  res.status(500).json({ error: 'Внутренняя ошибка синхронизации с Git.', code: 'INTERNAL_ERROR' });
}

interface AuthenticatedGitRequest extends express.Request {
  gitPushToken?: string;
}

export function createGitRouter(deps: GitRouterDeps): express.Router {
  const router = express.Router();

  const requireGitKeyAccess: express.RequestHandler = (req, res, next) => {
    const resolved = deps.gitAuth.resolveSession(req.headers.authorization);
    if (!resolved.authorized || !resolved.pushToken) {
      res.status(401).json({
        error: 'Для коммита и отправки изменений требуется подтверждённый ключ доступа к репозиторию.',
        code: 'GIT_KEY_REQUIRED',
        mode: 'key_required',
      });
      return;
    }
    (req as AuthenticatedGitRequest).gitPushToken = resolved.pushToken;
    next();
  };

  router.get('/api/git/auth-status', (req, res) => {
    res.json(
      deps.gitAuth.getAuthStatus({
        authHeader: req.headers.authorization,
      })
    );
  });

  router.post('/api/git/verify-key', deps.unlockRateLimit, async (req, res) => {
    try {
      const body = (req.body || {}) as { accessKey?: unknown };
      const accessKey = typeof body.accessKey === 'string' ? body.accessKey : '';
      const result = await deps.gitAuth.verifyAccessKey(accessKey);
      res.json({ ok: true, mode: 'key', ...result });
    } catch (err) {
      handleGitError(err, res);
    }
  });

  router.post('/api/git/lock', (req, res) => {
    deps.gitAuth.revokeBearerToken(req.headers.authorization);
    res.json({ ok: true });
  });

  router.get('/api/git/status', requireGitKeyAccess, async (_req, res) => {
    try {
      res.json(await deps.gitSync.getStatus());
    } catch (err) {
      handleGitError(err, res);
    }
  });

  router.post('/api/git/commit-push', deps.pushRateLimit, async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const resolved = deps.gitAuth.resolveSession(req.headers.authorization);
      let pushToken = resolved.pushToken;

      // Also support passing an accessKey directly with the commit request.
      if (!pushToken && typeof body.accessKey === 'string' && body.accessKey.trim()) {
        const verified = await deps.gitAuth.verifyAccessKey(body.accessKey);
        pushToken = deps.gitAuth.resolveSession(`Bearer ${verified.token}`).pushToken;
      }

      if (!pushToken) {
        res.status(401).json({
          error: 'Для фиксации коммита и отправки в main введите ключ доступа к репозиторию.',
          code: 'GIT_KEY_REQUIRED',
        });
        return;
      }

      const result = await deps.gitSync.commitAndPush(
        {
          commitMessage: body.commitMessage,
          authorName:
            typeof body.authorName === 'string' && body.authorName.trim()
              ? body.authorName
              : req.authUser?.fullName,
          authorEmail:
            typeof body.authorEmail === 'string' && body.authorEmail.trim()
              ? body.authorEmail
              : req.authUser?.email.value,
        },
        pushToken
      );
      res.json(result);
    } catch (err) {
      handleGitError(err, res);
    }
  });

  return router;
}
