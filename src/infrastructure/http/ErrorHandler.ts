import type express from 'express';
import { DomainError, NotFoundError, ValidationError } from '../../domain/shared/DomainError.ts';
import type { Logger } from '../logging/Logger.ts';

/**
 * Extracts the client IP address while respecting Express `trust proxy`.
 * Falls back cleanly when a request is inspected outside a full Express app.
 */
export function getClientIp(req: express.Request): string {
  if (typeof req.ip === 'string' && req.ip.trim().length > 0) {
    return req.ip.trim();
  }
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/**
 * Unified HTTP adapter error mapper across routers.
 * Keeps domain/validation error status mapping consistent without duplicating
 * switch logic in every Express router.
 */
export function sendDomainError(
  err: unknown,
  res: express.Response,
  log: Logger,
  logLabel = 'Unhandled HTTP adapter error'
): void {
  if (err instanceof ValidationError) {
    let status = 400;
    if (err.code === 'INVALID_CREDENTIALS' || err.code === 'ACCOUNT_DISABLED') {
      status = 401;
    } else if (err.code === 'OAUTH_NOT_CONFIGURED') {
      status = 503;
    }
    res.status(status).json({ error: err.message, code: err.code });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message, code: err.code });
    return;
  }

  if (err instanceof DomainError) {
    const status = err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 422;
    res.status(status).json({ error: err.message, code: err.code });
    return;
  }

  log.error(logLabel, err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера.', code: 'INTERNAL_ERROR' });
}
