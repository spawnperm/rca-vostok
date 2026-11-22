import type { SessionRepository } from '../../domain/identity/IdentityRepositories.ts';
import type { PasswordResetRepository } from '../../domain/identity/PasswordReset.ts';

/**
 * Periodic housekeeping.
 *
 * Several tables grow monotonically unless something prunes them, and until now
 * nothing did:
 *   - user_sessions      — expired sessions stayed forever
 *   - password_reset_tokens — used/expired tokens stayed forever
 *
 * The job runs on an interval in the app process. That is correct for the
 * single-container deployment this system uses; if the app is ever scaled out,
 * this wants to become a leader-elected task or a compose sidecar so the work
 * does not run once per replica.
 *
 * Every run is wrapped so a failure deletes nothing it should not and never
 * crashes the process: housekeeping is important but must not take the site down.
 */

export interface HousekeepingDeps {
  sessions?: SessionRepository;
  resetTokens?: PasswordResetRepository;
  /** Interval between runs. Defaults to one hour. */
  intervalMs?: number;
  /** Auto-start on construction. Tests pass false and call runOnce(). */
  autoStart?: boolean;
}

export interface HousekeepingResult {
  expiredSessions: number;
  ranAt: string;
}

/** Deletes reset tokens older than this many days, used or not. */
const RESET_TOKEN_RETENTION_DAYS = 7;

export class HousekeepingJob {
  private readonly sessions: SessionRepository | undefined;
  private readonly resetTokens: PasswordResetRepository | undefined;
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(deps: HousekeepingDeps) {
    this.sessions = deps.sessions;
    this.resetTokens = deps.resetTokens;
    this.intervalMs = deps.intervalMs ?? 60 * 60 * 1000;

    if (deps.autoStart !== false) {
      this.start();
    }
  }

  start(): void {
    if (this.timer) return;

    // Run shortly after boot rather than waiting a full interval, so a restart
    // also cleans up. The small delay lets migrations finish first.
    const initial = setTimeout(() => void this.runOnce(), 30_000);
    initial.unref();

    this.timer = setInterval(() => void this.runOnce(), this.intervalMs);
    // Do not keep the process alive just for housekeeping.
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Exposed for tests and for a manual trigger. */
  async runOnce(now = new Date()): Promise<HousekeepingResult> {
    if (this.running) {
      // A slow run must not overlap with the next tick.
      return { expiredSessions: 0, ranAt: now.toISOString() };
    }
    this.running = true;

    let expiredSessions = 0;
    try {
      if (this.sessions) {
        expiredSessions = await this.sessions.purgeExpired(now.toISOString());
      }
    } catch (err) {
      console.error('[housekeeping] session purge failed', err);
    }

    try {
      if (this.resetTokens) {
        await this.purgeResetTokens(now);
      }
    } catch (err) {
      console.error('[housekeeping] reset-token purge failed', err);
    } finally {
      this.running = false;
    }

    if (expiredSessions > 0) {
      console.info(
        JSON.stringify({
          level: 'info',
          event: 'housekeeping.completed',
          expiredSessions,
          at: now.toISOString(),
        })
      );
    }

    return { expiredSessions, ranAt: now.toISOString() };
  }

  private async purgeResetTokens(now: Date): Promise<void> {
    if (!this.resetTokens) return;

    // `purgeExpired` is part of the port, so no capability sniffing is needed.
    // Tokens are kept for a short grace period after expiry so a user who
    // clicks a link a few seconds late still gets a clear "expired" message
    // instead of the record having vanished.
    const cutoff = new Date(
      now.getTime() - RESET_TOKEN_RETENTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    await this.resetTokens.purgeExpired(cutoff);
  }
}

export { RESET_TOKEN_RETENTION_DAYS };
