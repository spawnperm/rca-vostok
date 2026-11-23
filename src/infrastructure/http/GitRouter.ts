import express from 'express';
import { PERMISSIONS } from '../../domain/identity/Rbac.ts';
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

function isCabinetAdmin(req: express.Request): boolean {
  return Boolean(req.authUser?.can(PERMISSIONS.MANAGE_USERS));
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

export function createGitRouter(deps: GitRouterDeps): express.Router {
  const router = express.Router();

  const requireGitAccess: express.RequestHandler = (req, res, next) => {
    const status = deps.gitAuth.getAuthStatus({
      isCabinetAdmin: isCabinetAdmin(req),
      authHeader: req.headers.authorization,
    });
    if (!status.authorized) {
      res.status(status.mode === 'setup_required' ? 403 : 401).json({
        error:
          status.mode === 'setup_required'
            ? 'Требуется первичная настройка пароля оператора Git.'
            : 'Требуется авторизация оператора Git или роль администратора.',
        code: status.mode === 'setup_required' ? 'GIT_SETUP_REQUIRED' : 'GIT_UNAUTHORIZED',
        mode: status.mode,
      });
      return;
    }
    next();
  };

  router.get('/api/git/auth-status', (req, res) => {
    res.json(
      deps.gitAuth.getAuthStatus({
        isCabinetAdmin: isCabinetAdmin(req),
        authHeader: req.headers.authorization,
      })
    );
  });

  router.post('/api/git/claim-passcode', deps.unlockRateLimit, async (req, res) => {
    try {
      const body = (req.body || {}) as { passcode?: unknown };
      const passcode = typeof body.passcode === 'string' ? body.passcode : '';
      const result = await deps.gitAuth.claimPasscode(passcode);
      res.status(201).json({ ok: true, mode: 'passcode', ...result });
    } catch (err) {
      handleGitError(err, res);
    }
  });

  router.post('/api/git/unlock', deps.unlockRateLimit, async (req, res) => {
    try {
      const body = (req.body || {}) as { passcode?: unknown };
      const passcode = typeof body.passcode === 'string' ? body.passcode : '';
      const result = await deps.gitAuth.verifyPasscode(passcode);
      res.json({ ok: true, mode: 'passcode', ...result });
    } catch (err) {
      handleGitError(err, res);
    }
  });

  router.post('/api/git/lock', (req, res) => {
    deps.gitAuth.revokeBearerToken(req.headers.authorization);
    res.json({ ok: true });
  });

  router.get('/api/git/status', requireGitAccess, async (_req, res) => {
    try {
      res.json(await deps.gitSync.getStatus());
    } catch (err) {
      handleGitError(err, res);
    }
  });

  router.post('/api/git/commit-push', requireGitAccess, deps.pushRateLimit, async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const result = await deps.gitSync.commitAndPush({
        commitMessage: body.commitMessage,
        authorName:
          typeof body.authorName === 'string' && body.authorName.trim()
            ? body.authorName
            : req.authUser?.fullName,
        authorEmail:
          typeof body.authorEmail === 'string' && body.authorEmail.trim()
            ? body.authorEmail
            : req.authUser?.email.value,
      });
      res.json(result);
    } catch (err) {
      handleGitError(err, res);
    }
  });

  return router;
}
