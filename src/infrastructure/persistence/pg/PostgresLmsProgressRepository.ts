import type pg from 'pg';
import type { LmsProgressRepository, LmsProgressState } from '../../../domain/lms/LmsProgress.ts';

interface Row {
  state_json: LmsProgressState;
  updated_at: Date;
}

/** PostgreSQL adapter for per-user LMS progress state. */
export class PostgresLmsProgressRepository implements LmsProgressRepository {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async findByOwner(ownerId: string): Promise<LmsProgressState | null> {
    const res = await this.pool.query<Row>(
      'SELECT state_json, updated_at FROM lms_progress WHERE user_id = $1',
      [ownerId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      ...row.state_json,
      updatedAt: row.state_json?.updatedAt ?? row.updated_at.toISOString(),
    };
  }

  async saveByOwner(ownerId: string, state: LmsProgressState): Promise<void> {
    const updatedAt = state.updatedAt ?? new Date().toISOString();
    await this.pool.query(
      `INSERT INTO lms_progress (user_id, state_json, updated_at)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (user_id) DO UPDATE SET
         state_json = EXCLUDED.state_json,
         updated_at = EXCLUDED.updated_at`,
      [ownerId, JSON.stringify({ ...state, updatedAt }), updatedAt]
    );
  }
}
