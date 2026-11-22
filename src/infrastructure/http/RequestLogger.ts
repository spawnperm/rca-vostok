import crypto from 'crypto';
import type express from 'express';
import type { Logger } from '../logging/Logger.ts';

const SAFE_REQUEST_ID = /^[a-zA-Z0-9_-]{1,64}$/;

function resolveRequestId(req: express.Request): string {
  const incoming = req.headers['x-request-id'];
  if (typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming.trim())) {
    return incoming.trim();
  }
  return crypto.randomUUID().slice(0, 8);
}

function clientAddress(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/**
 * Logs finished HTTP requests with request-id correlation and tiered severity:
 * - status >= 500 -> ERROR
 * - /api/* requests (< 500) -> INFO
 * - static / Vite / non-API routes (< 500) -> DEBUG
 */
export function createRequestLoggerMiddleware(logger: Logger): express.RequestHandler {
  const httpLog = logger.child('http');

  return (req, res, next) => {
    const requestId = resolveRequestId(req);
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Math.round((Number(process.hrtime.bigint() - started) / 1e6) * 100) / 100;
      const meta: Record<string, unknown> = {
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs,
        ip: clientAddress(req),
      };
      if (req.authUser) {
        meta.userId = req.authUser.id;
      }

      if (res.statusCode >= 500) {
        httpLog.error('HTTP request failed', meta);
      } else if (req.path.startsWith('/api')) {
        httpLog.info('API request completed', meta);
      } else {
        httpLog.debug('HTTP request completed', meta);
      }
    });

    next();
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}
