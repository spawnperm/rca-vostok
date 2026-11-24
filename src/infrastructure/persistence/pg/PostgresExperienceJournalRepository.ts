import type pg from 'pg';
import type { ExperienceLogEntry } from '../../../domain/experience/ExperienceEntry.ts';
import type { ExperienceJournalRepository } from '../../../domain/experience/ExperienceJournalRepository.ts';

interface ExperienceJournalRow {
  entries_json: ExperienceLogEntry[] | string;
}

export class PostgresExperienceJournalRepository implements ExperienceJournalRepository {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async listByOwner(ownerId: string): Promise<ExperienceLogEntry[] | null> {
    const res = await this.pool.query<ExperienceJournalRow>(
      `SELECT entries_json FROM experience_journal_entries WHERE owner_id = $1`,
      [ownerId]
    );
    if (res.rows.length === 0) {
      return null;
    }
    const raw = res.rows[0].entries_json;
    const parsed = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return [...(parsed as ExperienceLogEntry[])].sort((a, b) => b.date.localeCompare(a.date));
  }

  async saveByOwner(ownerId: string, entries: readonly ExperienceLogEntry[]): Promise<void> {
    const normalized = [...entries]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 500);

    await this.pool.query(
      `INSERT INTO experience_journal_entries (owner_id, entries_json, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (owner_id)
       DO UPDATE SET entries_json = EXCLUDED.entries_json, updated_at = now()`,
      [ownerId, JSON.stringify(normalized)]
    );
  }
}
