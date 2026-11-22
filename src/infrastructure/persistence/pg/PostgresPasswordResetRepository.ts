import type pg from 'pg';
import type {
  PasswordResetRepository,
  PasswordResetTokenRecord,
} from '../../../domain/identity/PasswordReset.ts';

interface Row {
  token_hash: string;
  user_id: string;
  created_at: Date;
  expires_at: Date;
  used_at: Date | null;
}

function toRecord(row: Row): PasswordResetTokenRecord {
  return {
    tokenHash: row.token_hash,
    userId: row.user_id,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    usedAt: row.used_at ? row.used_at.toISOString() : null,
  };
}

/** PostgreSQL adapter for single-use password-reset tokens. */
export class PostgresPasswordResetRepository implements PasswordResetRepository {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async save(record: PasswordResetTokenRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO password_reset_tokens (token_hash, user_id, created_at, expires_at, used_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (token_hash) DO NOTHING`,
      [record.tokenHash, record.userId, record.createdAt, record.expiresAt, record.usedAt]
    );
  }

  async findUsable(
    tokenHash: string,
    now: string
  ): Promise<PasswordResetTokenRecord | null> {
    const res = await this.pool.query<Row>(
      `SELECT * FROM password_reset_tokens
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2`,
      [tokenHash, now]
    );
    return res.rows.length > 0 ? toRecord(res.rows[0]) : null;
  }

  async markUsed(tokenHash: string, at: string): Promise<void> {
    await this.pool.query(
      'UPDATE password_reset_tokens SET used_at = $2 WHERE token_hash = $1',
      [tokenHash, at]
    );
  }

  async deleteForUser(userId: string): Promise<void> {
    await this.pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
  }

  async purgeExpired(cutoffIso: string): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM password_reset_tokens WHERE created_at < $1',
      [cutoffIso]
    );
    return result.rowCount ?? 0;
  }
}

/** In-memory adapter for development and tests. */
export class InMemoryPasswordResetRepository implements PasswordResetRepository {
  private readonly tokens = new Map<string, PasswordResetTokenRecord>();

  async save(record: PasswordResetTokenRecord): Promise<void> {
    this.tokens.set(record.tokenHash, record);
  }

  async findUsable(
    tokenHash: string,
    now: string
  ): Promise<PasswordResetTokenRecord | null> {
    const record = this.tokens.get(tokenHash);
    if (!record || record.usedAt || record.expiresAt <= now) return null;
    return record;
  }

  async markUsed(tokenHash: string, at: string): Promise<void> {
    const record = this.tokens.get(tokenHash);
    if (record) this.tokens.set(tokenHash, { ...record, usedAt: at });
  }

  async deleteForUser(userId: string): Promise<void> {
    for (const [hash, record] of this.tokens) {
      if (record.userId === userId) this.tokens.delete(hash);
    }
  }

  async purgeExpired(cutoffIso: string): Promise<number> {
    let removed = 0;
    for (const [hash, record] of this.tokens) {
      if (record.createdAt < cutoffIso) {
        this.tokens.delete(hash);
        removed += 1;
      }
    }
    return removed;
  }
}
