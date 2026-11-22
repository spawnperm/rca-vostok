import type express from 'express';
import { appLogger } from '../logging/Logger.ts';

const rateLimitLog = appLogger.child('rate-limit');

/**
 * In-memory, fixed-window rate limiter.
 *
 * Scope: this protects a single-process deployment (which is what the platform
 * runs — one app container). If the app is ever scaled horizontally the counter
 * must move to Redis or PostgreSQL, otherwise each replica would allow its own
 * budget. The trade-off is deliberate: adding a datastore here would put another
 * round-trip in front of every login attempt.
 *
 * Keying is by IP **and** by submitted identifier, because an attacker who
 * rotates IPs would otherwise get unlimited attempts against one account, and
 * one who hammers many accounts from one IP would exhaust a shared budget.
 */

/** Extracts the client IP, honouring the proxy header set by Traefik. */
function clientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    // The left-most entry is the original client when exactly one proxy is used.
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

export interface RateLimitRule {
  /** Human-readable name used in logs. */
  name: string;
  /** Length of the counting window. */
  windowMs: number;
  /** Maximum attempts allowed within the window. */
  max: number;
}

export interface RateLimitOutcome {
  allowed: boolean;
  /** Seconds to wait before retrying; present when blocked. */
  retryAfterSec: number;
  remaining: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * A counter collection with atomic check-and-increment semantics inside one
 * process. Expired buckets are swept lazily to avoid an unbounded map.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly rules: RateLimitRule[];

  constructor(rules: RateLimitRule[]) {
    this.rules = rules;
  }

  /** Registers an attempt for `key` against the rule matching `name`. */
  hit(name: string, key: string): RateLimitOutcome {
    const rule = this.rules.find((r) => r.name === name);
    if (!rule) {
      // An unknown rule must not fail open silently; refuse and log loudly.
      rateLimitLog.error('Unknown rate-limit rule', { ruleName: name });
      return { allowed: false, retryAfterSec: 60, remaining: 0 };
    }

    const now = Date.now();
    this.sweep(now);

    const composite = `${name}:${key}`;
    const existing = this.buckets.get(composite);

    if (!existing || existing.resetAt <= now) {
      this.buckets.set(composite, { count: 1, resetAt: now + rule.windowMs });
      return { allowed: true, retryAfterSec: 0, remaining: rule.max - 1 };
    }

    if (existing.count >= rule.max) {
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
        remaining: 0,
      };
    }

    existing.count += 1;
    return { allowed: true, retryAfterSec: 0, remaining: rule.max - existing.count };
  }

  /** Clears a key — used after a successful login so a valid user is not throttled. */
  reset(name: string, key: string): void {
    this.buckets.delete(`${name}:${key}`);
  }

  /** Drops expired buckets; called inline because the map stays small. */
  private sweep(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  /** Test helper: number of tracked buckets. */
  size(): number {
    return this.buckets.size;
  }
}

export interface LoginRateLimitOptions {
  limiter: RateLimiter;
  /** Attempts allowed per IP per window. */
  perIpRule: string;
  /** Attempts allowed per submitted email per window. */
  perAccountRule: string;
}

/**
 * Builds the middleware guarding a login endpoint.
 *
 * Two checks run for each attempt: one keyed by IP, one by the submitted email.
 * A successful response is detected by the status code (2xx) and resets both
 * counters, so legitimate users who mistyped a password a few times are not
 * locked out after a successful sign-in.
 */
export function createLoginRateLimit(options: LoginRateLimitOptions): express.RequestHandler {
  return (req, res, next) => {
    const ip = clientIp(req);
    const emailRaw = (req.body ?? {}) as { email?: unknown };
    const email =
      typeof emailRaw.email === 'string' ? emailRaw.email.trim().toLowerCase() : '';

    const ipOutcome = options.limiter.hit(options.perIpRule, ip);
    if (!ipOutcome.allowed) {
      res.setHeader('Retry-After', String(ipOutcome.retryAfterSec));
      res.status(429).json({
        error: 'Слишком много попыток входа. Повторите позже.',
        code: 'RATE_LIMITED',
        retryAfterSec: ipOutcome.retryAfterSec,
      });
      return;
    }

    if (email) {
      const accountOutcome = options.limiter.hit(options.perAccountRule, email);
      if (!accountOutcome.allowed) {
        res.setHeader('Retry-After', String(accountOutcome.retryAfterSec));
        res.status(429).json({
          error: 'Слишком много попыток входа для этой учётной записи. Повторите позже.',
          code: 'RATE_LIMITED',
          retryAfterSec: accountOutcome.retryAfterSec,
        });
        return;
      }
    }

    // Reset both counters once the credentials are accepted.
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        options.limiter.reset(options.perIpRule, ip);
        if (email) options.limiter.reset(options.perAccountRule, email);
      }
    });

    next();
  };
}

/** Default rules matching the platform's threat model. */
export const DEFAULT_LOGIN_RULES: RateLimitRule[] = [
  // Ten attempts per IP per 15 minutes: enough for a person who forgets a
  // password, too slow for scripted guessing.
  { name: 'login-ip', windowMs: 15 * 60 * 1000, max: 10 },
  // Five attempts per account per 15 minutes: protects a single victim even
  // when the attacker rotates IPs.
  { name: 'login-account', windowMs: 15 * 60 * 1000, max: 5 },
  // Password-reset requests: looser than login (a person may legitimately ask
  // twice) but tight enough to stop using the endpoint as a mail relay.
  { name: 'forgot-ip', windowMs: 60 * 60 * 1000, max: 5 },
  { name: 'forgot-account', windowMs: 60 * 60 * 1000, max: 3 },

  // ── Public write endpoints ───────────────────────────────────────────────
  // These accept anonymous requests, so without a limit one client can fill the
  // database and every request costs a write.
  //
  // Submitting an inquiry is a rare, deliberate action by a human.
  { name: 'inquiry-ip', windowMs: 60 * 60 * 1000, max: 5 },
  // Feedback likewise; slightly looser to allow correcting a mistake.
  { name: 'feedback-ip', windowMs: 60 * 60 * 1000, max: 10 },
  // Behaviour tracking is batched by the client (one POST per few seconds of
  // activity), so the ceiling is much higher — but still bounded.
  { name: 'analytics-ip', windowMs: 60 * 1000, max: 60 },
];

/** Blocks with a JSON 429 and a Retry-After header. */
export function createRateLimit(limiter: RateLimiter, ruleName: string): express.RequestHandler {
  return (req, res, next) => {
    const outcome = limiter.hit(ruleName, clientIp(req));
    if (!outcome.allowed) {
      res.setHeader('Retry-After', String(outcome.retryAfterSec));
      res.status(429).json({
        error: 'Слишком много запросов. Повторите позже.',
        code: 'RATE_LIMITED',
        retryAfterSec: outcome.retryAfterSec,
      });
      return;
    }
    next();
  };
}
