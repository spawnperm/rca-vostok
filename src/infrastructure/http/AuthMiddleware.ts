import type express from 'express';
import type { User } from '../../domain/identity/User.ts';
import type { Permission } from '../../domain/identity/Rbac.ts';
import { ForbiddenError } from '../../domain/identity/User.ts';
import type { ResolveSessionUseCase } from '../../application/identity/IdentityUseCases.ts';
import { appLogger } from '../logging/Logger.ts';

const authLog = appLogger.child('auth');

export const SESSION_COOKIE = 'rca_session';

/**
 * Reads the session cookie. Cookies are parsed manually to avoid an extra
 * dependency (the project keeps its runtime deps minimal).
 */
export function readSessionCookie(req: express.Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;

  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    if (name === SESSION_COOKIE) {
      const raw = part.slice(idx + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}

export function isHttpsDeployment(): boolean {
  return (
    (process.env.APP_URL ?? '').startsWith('https://') ||
    process.env.K_SERVICE !== undefined
  );
}

export function sessionCookieOptions(expiresAt: string): {
  httpOnly: true;
  sameSite: 'lax' | 'none';
  secure: boolean;
  path: string;
  expires: Date;
} {
  const isHttps = isHttpsDeployment();
  return {
    httpOnly: true, // not readable from JS: mitigates XSS token theft
    sameSite: isHttps ? 'none' : 'lax', // required for AI Studio HTTPS iframe preview
    secure: isHttps,
    path: '/',
    expires: new Date(expiresAt),
  };
}

/** Attaches the authenticated principal to the request when a session exists. */
export function createAuthMiddleware(resolveSession: ResolveSessionUseCase) {
  return async function attachUser(
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ): Promise<void> {
    try {
      const token = readSessionCookie(req);
      const resolved = await resolveSession.execute(token);
      if (resolved) {
        req.authUser = resolved.user;
        req.authToken = token;
      }
    } catch (err) {
      // A broken session must never block anonymous access to the site.
      authLog.error('Session resolve failed', err);
    }
    next();
  };
}

/** Requires any authenticated user. */
export function requireAuth(): express.RequestHandler {
  return (req, res, next) => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Требуется вход в личный кабинет.', code: 'UNAUTHENTICATED' });
      return;
    }
    next();
  };
}

/**
 * Requires a specific permission. This is the single choke point for RBAC on
 * the server: routes never compare roles directly, they ask for a capability.
 */
export function requirePermission(permission: Permission): express.RequestHandler {
  return (req, res, next) => {
    const user = req.authUser;
    if (!user) {
      res.status(401).json({ error: 'Требуется вход в личный кабинет.', code: 'UNAUTHENTICATED' });
      return;
    }
    if (!user.can(permission)) {
      const err = new ForbiddenError(permission);
      res.status(403).json({ error: err.message, code: 'FORBIDDEN', permission });
      return;
    }
    next();
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: User;
      authToken?: string | null;
    }
  }
}
