import type { User } from './User.ts';

/**
 * Persistence port for the identity bounded context.
 *
 * Asynchronous because the production adapter is PostgreSQL-backed.
 */
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
  listAll(): Promise<User[]>;
  count(): Promise<number>;
}

/** An authenticated browser session, persisted so it survives restarts. */
export interface SessionRecord {
  /** Opaque random token; only its hash is stored. */
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface SessionRepository {
  create(session: SessionRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
  /** Invalidates every session of an account (password change, deactivation). */
  deleteByUserId(userId: string): Promise<void>;
  /** Removes expired rows; returns the number of purged sessions. */
  purgeExpired(now: string): Promise<number>;
}
