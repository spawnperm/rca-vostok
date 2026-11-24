import crypto from 'crypto';
import type pg from 'pg';
import {
  aggregateEmploymentSurvey,
  computeReattestationPriority,
  type GuideEmploymentSurveySummary,
  type ReattestationPriority,
} from '../../../utils/guideEmploymentSurvey.ts';
import {
  validateEmploymentSurveyPayload,
  type EmploymentSurveyRepository,
  type StoredEmploymentSurveyRecord,
} from '../JsonFileEmploymentSurveyRepository.ts';

interface EmploymentSurveyRow {
  id: string;
  owner_user_id: string | null;
  respondent_name: string;
  region: string;
  discipline: string;
  complexity_level: string;
  employment_status: string;
  workload_range: string;
  tour_days_per_season: number;
  groups_per_month: number;
  has_active_certificate: boolean;
  reattestation_urgency: string;
  preferred_format: string;
  needed_topics: string[];
  needs_employer_subsidy: boolean;
  priority_level: string;
  comment: string;
  archive_object_key: string;
  submitted_at: Date | string;
}

function rowToRecord(row: EmploymentSurveyRow): StoredEmploymentSurveyRecord {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    respondentName: row.respondent_name,
    region: row.region,
    discipline: row.discipline,
    complexityLevel: row.complexity_level,
    employmentStatus: row.employment_status,
    workloadRange: row.workload_range,
    tourDaysPerSeason: Number(row.tour_days_per_season) || 0,
    groupsPerMonth: Number(row.groups_per_month) || 0,
    hasActiveCertificate: Boolean(row.has_active_certificate),
    reattestationUrgency: row.reattestation_urgency,
    preferredFormat: row.preferred_format,
    neededTopics: Array.isArray(row.needed_topics) ? row.needed_topics : [],
    needsEmployerSubsidy: Boolean(row.needs_employer_subsidy),
    priorityLevel: (row.priority_level as ReattestationPriority) || 'medium',
    comment: row.comment || '',
    archiveObjectKey: row.archive_object_key || '',
    submittedAt:
      row.submitted_at instanceof Date
        ? row.submitted_at.toISOString()
        : String(row.submitted_at),
  };
}

export class PostgresEmploymentSurveyRepository implements EmploymentSurveyRepository {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async listAll(limit = 100): Promise<StoredEmploymentSurveyRecord[]> {
    const safeLimit = Math.max(1, Math.min(limit, 500));
    const res = await this.pool.query<EmploymentSurveyRow>(
      `SELECT id, owner_user_id, respondent_name, region, discipline, complexity_level,
              employment_status, workload_range, tour_days_per_season, groups_per_month,
              has_active_certificate, reattestation_urgency, preferred_format, needed_topics,
              needs_employer_subsidy, priority_level, comment, archive_object_key, submitted_at
         FROM employment_reattestation_surveys
        ORDER BY submitted_at DESC
        LIMIT $1`,
      [safeLimit]
    );
    return res.rows.map(rowToRecord);
  }

  async getSummary(): Promise<GuideEmploymentSurveySummary> {
    const all = await this.listAll(500);
    return aggregateEmploymentSurvey(all);
  }

  async findById(id: string): Promise<StoredEmploymentSurveyRecord | null> {
    const res = await this.pool.query<EmploymentSurveyRow>(
      `SELECT id, owner_user_id, respondent_name, region, discipline, complexity_level,
              employment_status, workload_range, tour_days_per_season, groups_per_month,
              has_active_certificate, reattestation_urgency, preferred_format, needed_topics,
              needs_employer_subsidy, priority_level, comment, archive_object_key, submitted_at
         FROM employment_reattestation_surveys
        WHERE id = $1`,
      [id]
    );
    return res.rows[0] ? rowToRecord(res.rows[0]) : null;
  }

  async submit(
    rawInput: Record<string, unknown>,
    options: { ownerUserId?: string | null; archiveObjectKey?: string } = {}
  ): Promise<{
    record: StoredEmploymentSurveyRecord;
    summary: GuideEmploymentSurveySummary;
    allRecords: StoredEmploymentSurveyRecord[];
  }> {
    const validated = validateEmploymentSurveyPayload(rawInput);
    const id = `EMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const priorityLevel = computeReattestationPriority(validated);
    const submittedAt = new Date().toISOString();

    const record: StoredEmploymentSurveyRecord = {
      id,
      ...validated,
      priorityLevel,
      submittedAt,
      ownerUserId: options.ownerUserId ?? null,
      archiveObjectKey: options.archiveObjectKey ?? '',
    };

    await this.pool.query(
      `INSERT INTO employment_reattestation_surveys (
         id, owner_user_id, respondent_name, region, discipline, complexity_level,
         employment_status, workload_range, tour_days_per_season, groups_per_month,
         has_active_certificate, reattestation_urgency, preferred_format, needed_topics,
         needs_employer_subsidy, priority_level, comment, archive_object_key, submitted_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        record.id,
        record.ownerUserId ?? null,
        record.respondentName,
        record.region,
        record.discipline,
        record.complexityLevel,
        record.employmentStatus,
        record.workloadRange,
        record.tourDaysPerSeason,
        record.groupsPerMonth,
        record.hasActiveCertificate,
        record.reattestationUrgency,
        record.preferredFormat,
        record.neededTopics,
        record.needsEmployerSubsidy,
        record.priorityLevel,
        record.comment,
        record.archiveObjectKey ?? '',
        record.submittedAt,
      ]
    );

    const allRecords = await this.listAll(500);
    return {
      record,
      summary: aggregateEmploymentSurvey(allRecords),
      allRecords,
    };
  }

  async updateArchiveKey(id: string, archiveObjectKey: string): Promise<void> {
    await this.pool.query(
      `UPDATE employment_reattestation_surveys
          SET archive_object_key = $2
        WHERE id = $1`,
      [id, archiveObjectKey]
    );
  }

  async deleteById(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM employment_reattestation_surveys WHERE id = $1`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }
}
