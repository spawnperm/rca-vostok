import crypto from 'node:crypto';
import { ValidationError } from '../shared/DomainError.ts';

/**
 * Password-reset token.
 *
 * The raw token is emailed to the user and never stored; only its SHA-256 hash
 * is persisted, so a database leak cannot be replayed to take over accounts —
 * the same reasoning as session tokens.
 *
 * Tokens are single-use and short-lived: fifteen minutes is long enough for a
 * person to open their mailbox and short enough to limit the blast radius.
 */
export const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

export interface PasswordResetTokenRecord {
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export class PasswordResetToken {
  /** Raw token — returned once, never persisted. */
  readonly token: string;
  readonly tokenHash: string;
  readonly userId: string;
  readonly createdAt: string;
  readonly expiresAt: string;

  private constructor(props: {
    token: string;
    tokenHash: string;
    userId: string;
    createdAt: string;
    expiresAt: string;
  }) {
    this.token = props.token;
    this.tokenHash = props.tokenHash;
    this.userId = props.userId;
    this.createdAt = props.createdAt;
    this.expiresAt = props.expiresAt;
  }

  static issue(userId: string, now = new Date()): PasswordResetToken {
    const token = crypto.randomBytes(32).toString('base64url');
    return new PasswordResetToken({
      token,
      tokenHash: PasswordResetToken.hash(token),
      userId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS).toISOString(),
    });
  }

  static hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  static assertTokenShape(raw: unknown): string {
    if (typeof raw !== 'string' || raw.length < 20 || raw.length > 200) {
      throw new ValidationError('Ссылка восстановления недействительна.', 'INVALID_RESET_TOKEN');
    }
    return raw;
  }

  toRecord(): PasswordResetTokenRecord {
    return {
      tokenHash: this.tokenHash,
      userId: this.userId,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
      usedAt: null,
    };
  }
}

/** Persistence port for reset tokens. */
export interface PasswordResetRepository {
  save(record: PasswordResetTokenRecord): Promise<void>;
  /** Returns the record when it exists and has not been used. */
  findUsable(tokenHash: string, now: string): Promise<PasswordResetTokenRecord | null>;
  markUsed(tokenHash: string, at: string): Promise<void>;
  /** Invalidates prior tokens when a new one is requested. */
  deleteForUser(userId: string): Promise<void>;
  /**
   * Removes tokens created before `cutoffIso` regardless of state.
   *
   * Without this the table only shrinks when a user requests a new link, so
   * expired and used tokens accumulate forever. Implemented by the PostgreSQL
   * and in-memory adapters; the housekeeping job calls it on an interval.
   */
  purgeExpired(cutoffIso: string): Promise<number>;
}

/**
 * Outbound mail port.
 *
 * The domain and application layers describe *what* to send; the transport
 * decides *how*. In this deployment no SMTP relay is configured, so the
 * adapter logs the message instead of sending it — see
 * `LoggingMailer` in infrastructure. Adding a provider later means implementing
 * this interface only.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  /** Returns true when the message was accepted for delivery. */
  send(message: MailMessage): Promise<boolean>;
  /** Whether this transport actually delivers mail to recipients. */
  readonly delivers: boolean;
}
