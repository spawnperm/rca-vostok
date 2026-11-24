import crypto from 'crypto';
import type pg from 'pg';
import {
  computeReadinessSurveyStats,
  validateReadinessSurveyInput,
  type ReadinessSurveyRecord,
  type ReadinessSurveyStats,
} from '../JsonFileReadinessSurveyRepository.ts';

interface ReadinessSurveyRow {
  id: string;
  region: string;
  track: string;
  experience_range: string;
  preferred_format: string;
  planned_timeframe: string;
  main_barrier: string;
  ready_docs: string[];
  readiness_pct: number;
  respondent_name: string;
  comment: string;
  created_at: Date | string;
}

function rowToRecord(row: ReadinessSurveyRow): ReadinessSurveyRecord {
  return {
    id: row.id,
    region: row.region,
    track: row.track,
    experienceRange: row.experience_range,
    preferredFormat: row.preferred_format,
    plannedTimeframe: row.planned_timeframe,
    mainBarrier: row.main_barrier,
    readyDocs: Array.isArray(row.ready_docs) ? row.ready_docs : [],
    readinessPct: Number(row.readiness_pct) || 0,
    respondentName: row.respondent_name || '',
    comment: row.comment || '',
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export class PostgresReadinessSurveyRepository {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async loadAll(): Promise<ReadinessSurveyRecord[]> {
    const res = await this.pool.query<ReadinessSurveyRow>(
      `SELECT id, region, track, experience_range, preferred_format, planned_timeframe,
              main_barrier, ready_docs, readiness_pct, respondent_name, comment, created_at
         FROM readiness_surveys
        ORDER BY created_at ASC
        LIMIT 1500`
    );
    return res.rows.map(rowToRecord);
  }

  async submit(rawInput: Record<string, unknown>): Promise<{
    record: ReadinessSurveyRecord;
    stats: ReadinessSurveyStats;
  }> {
    const validated = validateReadinessSurveyInput(rawInput);
    const record: ReadinessSurveyRecord = {
      id: `SRV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      ...validated,
      createdAt: new Date().toISOString(),
    };

    await this.pool.query(
      `INSERT INTO readiness_surveys (
         id, region, track, experience_range, preferred_format, planned_timeframe,
         main_barrier, ready_docs, readiness_pct, respondent_name, comment, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        record.id,
        record.region,
        record.track,
        record.experienceRange,
        record.preferredFormat,
        record.plannedTimeframe,
        record.mainBarrier,
        record.readyDocs,
        record.readinessPct,
        record.respondentName,
        record.comment,
        record.createdAt,
      ]
    );

    const all = await this.loadAll();
    return {
      record,
      stats: computeReadinessSurveyStats(all),
    };
  }

  async getStats(): Promise<ReadinessSurveyStats> {
    const all = await this.loadAll();
    return computeReadinessSurveyStats(all);
  }
}
