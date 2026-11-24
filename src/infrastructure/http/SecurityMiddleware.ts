import type express from 'express';
import { SESSION_COOKIE } from './AuthMiddleware.ts';

export interface SecurityHeadersOptions {
  isProd: boolean;
  isAiStudioPreview: boolean;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const COOKIE_AUTH_PREFIXES = [
  '/api/account',
  '/api/admin',
  '/api/social',
  '/api/chat',
  '/api/media',
  '/api/analytics/reset',
];

function hasSessionCookieHeader(req: express.Request): boolean {
  const cookie = req.headers.cookie;
  if (!cookie) return false;
  return cookie.split(';').some((part) => {
    const idx = part.indexOf('=');
    return idx !== -1 && part.slice(0, idx).trim() === SESSION_COOKIE;
  });
}

function normalizeHost(raw: string | undefined): string {
  return (raw ?? '').split(',')[0].trim().toLowerCase();
}

export function isSameOriginHttpRequest(req: express.Request): boolean {
  const targetHost = normalizeHost(req.get('x-forwarded-host') || req.get('host'));
  if (!targetHost) return false;

  const origin = req.get('origin');
  if (origin) {
    try {
      return new URL(origin).host.toLowerCase() === targetHost;
    } catch {
      return false;
    }
  }

  const referer = req.get('referer');
  if (referer) {
    try {
      return new URL(referer).host.toLowerCase() === targetHost;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Applies HTTP security headers (CSP, referrer policy, frame-ancestors, HSTS).
 * Allows Google Maps JS/tiles domains used by DfoRoutesGoogleMap while preserving
 * strict object-src/base-uri locks and AI Studio iframe embedding rules.
 */
export function createSecurityHeadersMiddleware(
  options: SecurityHeadersOptions
): express.RequestHandler {
  const scriptSrc = !options.isProd
    ? "script-src 'self' 'unsafe-inline' https://maps.googleapis.com"
    : "script-src 'self' https://maps.googleapis.com";

  const frameAncestors = options.isAiStudioPreview
    ? "frame-ancestors 'self' https://aistudio.google.com https://*.google.com https://*.googleusercontent.com"
    : "frame-ancestors 'none'";

  const API_DOCS_CSP =
    "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: https:; " +
    "connect-src 'self' https:; object-src 'none'; base-uri 'none'; form-action 'self'";

  const APP_CSP =
    `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ` +
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://*.tile.opentopomap.org https://maps.gstatic.com https://maps.googleapis.com; " +
    "media-src 'self' blob:; font-src 'self' data: https://fonts.gstatic.com; " +
    "connect-src 'self' https://maps.googleapis.com https://maps.gstatic.com; " +
    `object-src 'none'; base-uri 'none'; form-action 'self'; ${frameAncestors}`;

  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (!options.isAiStudioPreview) {
      res.setHeader('X-Frame-Options', 'DENY');
    }
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader(
      'Content-Security-Policy',
      req.path.startsWith('/api/docs') ? API_DOCS_CSP : APP_CSP
    );

    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (isHttps) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  };
}

/**
 * Enforces CSRF defence-in-depth on cookie-authenticated mutations across the API.
 * Browser fetches send `Origin` automatically and/or `X-Requested-With: fetch`;
 * cross-origin HTML form submissions without matching Origin or custom header are rejected.
 */
export function createCookieCsrfMiddleware(): express.RequestHandler {
  return (req, res, next) => {
    if (!MUTATING_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    const pathProtected = COOKIE_AUTH_PREFIXES.some((prefix) => req.path.startsWith(prefix));
    const hasCookie = hasSessionCookieHeader(req);
    const isAuthLogout = req.path === '/api/auth/logout';

    if (!hasCookie && !pathProtected) {
      next();
      return;
    }

    if (hasCookie || pathProtected || isAuthLogout) {
      const requestedWith = req.get('x-requested-with');
      if (requestedWith && requestedWith.trim().length > 0) {
        next();
        return;
      }

      if (isSameOriginHttpRequest(req)) {
        next();
        return;
      }

      // Allow unauthenticated requests hitting RBAC routes to receive 401 from requireAuth
      // rather than masking unauthenticated probes with 403 unless a cross-site Origin was supplied.
      if (!hasCookie && !req.get('origin') && !req.get('referer')) {
        next();
        return;
      }

      res.status(403).json({
        error: 'Запрос отклонён проверкой безопасности источника.',
        code: 'CSRF_ORIGIN_MISMATCH',
      });
      return;
    }

    next();
  };
}
