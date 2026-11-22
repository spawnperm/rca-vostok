import type pg from 'pg';
import type {
  SessionRecord,
  SessionRepository,
} from '../../../domain/identity/IdentityRepositories.ts';

interface SessionRow {
  token_hash: string;
  user_id: string;
  created_at: Date;
  expires_at: Date;
}

function toRecord(row: SessionRow): SessionRecord {
  return {
    tokenHash: row.token_hash,
    userId: row.user_id,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
  };
}

/** PostgreSQL adapter for browser sessions. */
export class PostgresSessionRepository implements SessionRepository {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async create(session: SessionRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO user_sessions (token_hash, user_id, created_at, expires_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (token_hash) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         expires_at = EXCLUDED.expires_at`,
      [session.tokenHash, session.userId, session.createdAt, session.expiresAt]
    );
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const result = await this.pool.query<SessionRow>(
      'SELECT * FROM user_sessions WHERE token_hash = $1',
      [tokenHash]
    );
    return result.rows.length > 0 ? toRecord(result.rows[0]) : null;
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.pool.query('DELETE FROM user_sessions WHERE token_hash = $1', [tokenHash]);
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.pool.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
  }

  async purgeExpired(now: string): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM user_sessions WHERE expires_at <= $1',
      [now]
    );
    return result.rowCount ?? 0;
  }
}
