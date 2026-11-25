import type { NextFunction, Request, Response } from 'express';
import { getOrCreateRequestId } from './observability.ts';

/**
 * Sets baseline browser security headers compatible with AI Studio iframe embedding
 * (deliberately omits X-Frame-Options) and Web Speech microphone access on same origin.
 */
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)');
  next();
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyPrefix?: string;
}

interface BucketRecord {
  count: number;
  resetAtMs: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export class SlidingWindowRateLimiter {
  private buckets = new Map<string, BucketRecord>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly keyPrefix: string;

  constructor(opts: RateLimiterOptions) {
    this.windowMs = Math.max(1000, opts.windowMs);
    this.maxRequests = Math.max(1, opts.maxRequests);
    this.keyPrefix = opts.keyPrefix || 'rl';
  }

  check(key: string, nowMs = Date.now()): RateLimitCheckResult {
    const namespaced = `${this.keyPrefix}:${key}`;
    if (this.buckets.size > 5000) {
      for (const [k, rec] of this.buckets.entries()) {
        if (rec.resetAtMs <= nowMs) this.buckets.delete(k);
      }
    }

    let record = this.buckets.get(namespaced);
    if (!record || record.resetAtMs <= nowMs) {
      record = { count: 0, resetAtMs: nowMs + this.windowMs };
      this.buckets.set(namespaced, record);
    }

    record.count += 1;
    const allowed = record.count <= this.maxRequests;
    const remaining = Math.max(0, this.maxRequests - record.count);
    const resetSeconds = Math.max(1, Math.ceil((record.resetAtMs - nowMs) / 1000));

    return {
      allowed,
      limit: this.maxRequests,
      remaining,
      resetSeconds,
    };
  }
}

export function createRateLimitMiddleware(opts: RateLimiterOptions) {
  const limiter = new SlidingWindowRateLimiter(opts);
  const errorMsg = opts.message || 'Слишком много запросов. Повторите попытку позже.';

  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const result = limiter.check(clientIp);

    res.setHeader('RateLimit-Limit', String(result.limit));
    res.setHeader('RateLimit-Remaining', String(result.remaining));
    res.setHeader('RateLimit-Reset', String(result.resetSeconds));

    if (!result.allowed) {
      const requestId = getOrCreateRequestId(req);
      return res.status(429).json({
        error: errorMsg,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterSeconds: result.resetSeconds,
        requestId,
      });
    }

    next();
  };
}

export interface SafeUserRecord {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  roleId: string;
  avatarUrl: string;
  isActive: boolean;
  createdAt: Date | string;
}

export function sanitizePublicUser<T extends { passwordHash?: unknown }>(
  userRow: T
): Omit<T, 'passwordHash'> {
  const { passwordHash: _omitted, ...safeUser } = userRow;
  return safeUser;
}
