import express from 'express';
import { DomainError, ValidationError } from '../../domain/shared/DomainError.ts';
import { PERMISSIONS } from '../../domain/identity/Rbac.ts';
import { appLogger } from '../logging/Logger.ts';
import type {
  AssignRoleUseCase,
  ChangePasswordUseCase,
  GetProfileUseCase,
  ListUsersUseCase,
  LoginUseCase,
  LogoutUseCase,
  RegisterUserUseCase,
  SetUserActiveUseCase,
  UpdateProfileUseCase,
} from '../../application/identity/IdentityUseCases.ts';
import type {
  ForgotPasswordUseCase,
  ResetPasswordUseCase,
} from '../../application/identity/PasswordResetUseCases.ts';
import {
  SESSION_COOKIE,
  isHttpsDeployment,
  readSessionCookie,
  requireAuth,
  requirePermission,
  sessionCookieOptions,
} from '../http/AuthMiddleware.ts';

export interface IdentityRouterDeps {
  registerUser: RegisterUserUseCase;
  login: LoginUseCase;
  logout: LogoutUseCase;
  getProfile: GetProfileUseCase;
  updateProfile: UpdateProfileUseCase;
  changePassword: ChangePasswordUseCase;
  listUsers: ListUsersUseCase;
  assignRole: AssignRoleUseCase;
  setUserActive: SetUserActiveUseCase;
  /** Guards /api/auth/login against credential stuffing. */
  loginRateLimit?: express.RequestHandler;
  /** Guards /api/auth/forgot-password against email flooding. */
  forgotRateLimit?: express.RequestHandler;
  forgotPassword?: ForgotPasswordUseCase;
  resetPassword?: ResetPasswordUseCase;
}

const identityLog = appLogger.child('identity');

function sendError(err: unknown, res: express.Response): void {
  if (err instanceof ValidationError) {
    const status = err.code === 'INVALID_CREDENTIALS' || err.code === 'ACCOUNT_DISABLED' ? 401 : 400;
    res.status(status).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof DomainError) {
    const status = err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 422;
    res.status(status).json({ error: err.message, code: err.code });
    return;
  }
  identityLog.error('Unexpected error in IdentityRouter', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
}

/**
 * Mounts the personal-cabinet API under /api/auth and /api/account.
 *
 * Every route states its RBAC requirement explicitly via requirePermission();
 * the handlers themselves only orchestrate.
 */
export function createIdentityRouter(deps: IdentityRouterDeps): express.Router {
  const router = express.Router();

  // ── Public: registration and sign-in ──────────────────────────────────────
  router.post('/api/auth/register', async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const user = await deps.registerUser.execute({
        email: body.email,
        password: body.password,
        fullName: body.fullName,
        region: body.region,
        organisation: body.organisation,
      });

      // Registrations signed in immediately, so the cabinet is usable at once.
      const auth = await deps.login.execute({
        email: body.email,
        password: body.password,
      });
      res.cookie(SESSION_COOKIE, auth.token, sessionCookieOptions(auth.expiresAt));
      res.status(201).json({ ok: true, user: auth.user, permissions: user.permissions });
    } catch (err) {
      sendError(err, res);
    }
  });

  router.post(
    '/api/auth/login',
    ...(deps.loginRateLimit ? [deps.loginRateLimit] : []),
    async (req, res) => {
      try {
        const body = (req.body || {}) as Record<string, unknown>;
        const auth = await deps.login.execute({
          email: body.email,
          password: body.password,
        });
        res.cookie(SESSION_COOKIE, auth.token, sessionCookieOptions(auth.expiresAt));
        res.json({ ok: true, user: auth.user, expiresAt: auth.expiresAt });
      } catch (err) {
        sendError(err, res);
      }
    }
  );

  router.post('/api/auth/logout', async (req, res) => {
    try {
      await deps.logout.execute(readSessionCookie(req));
      const isHttps = isHttpsDeployment();
      res.clearCookie(SESSION_COOKIE, {
        path: '/',
        httpOnly: true,
        sameSite: isHttps ? 'none' : 'lax',
        secure: isHttps,
      });
      res.json({ ok: true });
    } catch (err) {
      sendError(err, res);
    }
  });

  // ── Password recovery ─────────────────────────────────────────────────────
  /**
   * Requests a reset link.
   *
   * The response is identical whether or not the address belongs to an account,
   * so this endpoint cannot be used to enumerate users. `delivered` is exposed
   * only because the deployment currently has no SMTP transport; it is not an
   * account-existence signal (it is false for unknown addresses too).
   */
  if (deps.forgotPassword) {
    const handler: express.RequestHandler = async (req, res) => {
      try {
        const body = (req.body || {}) as Record<string, unknown>;
        const result = await deps.forgotPassword!.execute({ email: body.email });
        res.json({
          ok: true,
          message:
            'Если адрес зарегистрирован, письмо со ссылкой восстановления отправлено.',
          // Only meaningful for operators while no mail transport is configured.
          delivered: result.delivered,
        });
      } catch (err) {
        sendError(err, res);
      }
    };
    router.post(
      '/api/auth/forgot-password',
      ...(deps.forgotRateLimit ? [deps.forgotRateLimit] : []),
      handler
    );
  }

  /** Completes the reset with a single-use token. */
  if (deps.resetPassword) {
    router.post('/api/auth/reset-password', async (req, res) => {
      try {
        const body = (req.body || {}) as Record<string, unknown>;
        const result = await deps.resetPassword!.execute({
          token: body.token,
          password: body.password,
        });
        // Every session was revoked, so the client must sign in again.
        const isHttps = isHttpsDeployment();
        res.clearCookie(SESSION_COOKIE, {
          path: '/',
          httpOnly: true,
          sameSite: isHttps ? 'none' : 'lax',
          secure: isHttps,
        });
        res.json({ ...result, reauthenticate: true });
      } catch (err) {
        sendError(err, res);
      }
    });
  }

  /** Cheap endpoint the SPA uses to restore its session on page load. */
  router.get('/api/auth/session', (req, res) => {
    if (!req.authUser) {
      res.json({ authenticated: false });
      return;
    }
    res.json({ authenticated: true, user: req.authUser.toDTO() });
  });

  // ── Personal cabinet: own profile ─────────────────────────────────────────
  router.get('/api/account/profile', requireAuth(), requirePermission(PERMISSIONS.VIEW_OWN_PROFILE), async (req, res) => {
    try {
      res.json(await deps.getProfile.execute(req.authUser!));
    } catch (err) {
      sendError(err, res);
    }
  });

  router.patch('/api/account/profile', requireAuth(), requirePermission(PERMISSIONS.EDIT_OWN_PROFILE), async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      res.json(
        await deps.updateProfile.execute(req.authUser!, {
          fullName: body.fullName,
          region: body.region,
          organisation: body.organisation,
        })
      );
    } catch (err) {
      sendError(err, res);
    }
  });

  router.post('/api/account/password', requireAuth(), requirePermission(PERMISSIONS.EDIT_OWN_PROFILE), async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const result = await deps.changePassword.execute(req.authUser!, {
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
      });
      // Changing the password invalidates all sessions, including this one.
      res.clearCookie(SESSION_COOKIE, { path: '/' });
      res.json({ ...result, reauthenticate: true });
    } catch (err) {
      sendError(err, res);
    }
  });

  // ── Admin: user management (RBAC-gated) ───────────────────────────────────
  router.get('/api/admin/users', requireAuth(), requirePermission(PERMISSIONS.MANAGE_USERS), async (req, res) => {
    try {
      res.json({ users: await deps.listUsers.execute(req.authUser!) });
    } catch (err) {
      sendError(err, res);
    }
  });

  router.patch('/api/admin/users/:userId/role', requireAuth(), requirePermission(PERMISSIONS.MANAGE_USERS), async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      res.json(
        await deps.assignRole.execute(req.authUser!, {
          userId: req.params.userId,
          role: body.role,
        })
      );
    } catch (err) {
      sendError(err, res);
    }
  });

  router.patch('/api/admin/users/:userId/status', requireAuth(), requirePermission(PERMISSIONS.MANAGE_USERS), async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      res.json(
        await deps.setUserActive.execute(req.authUser!, {
          userId: req.params.userId,
          isActive: body.isActive,
        })
      );
    } catch (err) {
      sendError(err, res);
    }
  });

  return router;
}
