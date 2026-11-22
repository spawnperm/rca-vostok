/**
 * Password hashing port.
 *
 * The domain declares what it needs (derive and verify), while the concrete
 * algorithm lives in infrastructure. This keeps scrypt/bcrypt details out of
 * the aggregates and makes auth use cases testable without real crypto.
 */
export interface PasswordHasher {
  /** Derives hash + salt for a new password. */
  hash(plainPassword: string): Promise<{ passwordHash: string; passwordSalt: string }>;
  /** Constant-time verification of a candidate password. */
  verify(
    plainPassword: string,
    material: { passwordHash: string; passwordSalt: string }
  ): Promise<boolean>;
}

/** Generates opaque session tokens and their stored hash. */
export interface SessionTokenService {
  /** Returns the raw token (sent to the client) and the hash (persisted). */
  issue(): { token: string; tokenHash: string };
  /** Hashes a token supplied by the client so it can be looked up. */
  hashToken(token: string): string;
}
