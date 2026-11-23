import type pg from 'pg';
import type {
  CertifiedGuideRecord,
  GuideLeaderboardFilter,
  GuideLeaderboardRepository,
} from '../../../domain/certification/GuideLeaderboard.ts';

interface CertifiedGuideRow {
  id: string;
  user_id: string | null;
  full_name: string;
  region: string;
  organisation: string;
  track: string;
  certified_routes_count: number;
  experience_years: number;
  max_complexity: string;
  registry_number: string;
  is_active: boolean;
  last_attestation_date: Date | string;
}

function toRecord(row: CertifiedGuideRow): CertifiedGuideRecord {
  const dateStr =
    row.last_attestation_date instanceof Date
      ? row.last_attestation_date.toISOString().slice(0, 10)
      : String(row.last_attestation_date).slice(0, 10);

  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    region: row.region,
    organisation: row.organisation,
    track: row.track as CertifiedGuideRecord['track'],
    certifiedRoutesCount: Number(row.certified_routes_count),
    experienceYears: Number(row.experience_years),
    maxComplexity: row.max_complexity as CertifiedGuideRecord['maxComplexity'],
    registryNumber: row.registry_number,
    isActive: row.is_active,
    lastAttestationDate: dateStr,
  };
}

/**
 * Parameterized PostgreSQL repository for active certified DFO guides.
 */
export class PostgresGuideLeaderboardRepository implements GuideLeaderboardRepository {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async list(filter: GuideLeaderboardFilter = {}): Promise<CertifiedGuideRecord[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.activeOnly !== false) {
      conditions.push('is_active = TRUE');
    }
    if (filter.region && filter.region !== 'all') {
      params.push(filter.region.trim());
      conditions.push(`region = $${params.length}`);
    }
    if (filter.track) {
      params.push(filter.track);
      conditions.push(`track = $${params.length}`);
    }
    if (filter.search && filter.search.trim().length > 0) {
      params.push(`%${filter.search.trim().toLowerCase()}%`);
      const idx = params.length;
      conditions.push(
        `(LOWER(full_name) LIKE $${idx} OR LOWER(organisation) LIKE $${idx} OR LOWER(region) LIKE $${idx} OR LOWER(registry_number) LIKE $${idx})`
      );
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT id, user_id, full_name, region, organisation, track,
             certified_routes_count, experience_years, max_complexity,
             registry_number, is_active, last_attestation_date
        FROM certified_guides_registry
        ${whereClause}
       ORDER BY certified_routes_count DESC, experience_years DESC, full_name ASC
    `;

    const res = await this.pool.query<CertifiedGuideRow>(sql, params);
    return res.rows.map(toRecord);
  }

  async upsert(record: CertifiedGuideRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO certified_guides_registry (
         id, user_id, full_name, region, organisation, track,
         certified_routes_count, experience_years, max_complexity,
         registry_number, is_active, last_attestation_date, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
       ON CONFLICT (id) DO UPDATE SET
         user_id = COALESCE(EXCLUDED.user_id, certified_guides_registry.user_id),
         full_name = EXCLUDED.full_name,
         region = EXCLUDED.region,
         organisation = EXCLUDED.organisation,
         track = EXCLUDED.track,
         certified_routes_count = EXCLUDED.certified_routes_count,
         experience_years = EXCLUDED.experience_years,
         max_complexity = EXCLUDED.max_complexity,
         registry_number = EXCLUDED.registry_number,
         is_active = EXCLUDED.is_active,
         last_attestation_date = EXCLUDED.last_attestation_date,
         updated_at = now()`,
      [
        record.id,
        record.userId,
        record.fullName,
        record.region,
        record.organisation,
        record.track,
        record.certifiedRoutesCount,
        record.experienceYears,
        record.maxComplexity,
        record.registryNumber,
        record.isActive,
        record.lastAttestationDate,
      ]
    );
  }

  async count(): Promise<number> {
    const res = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM certified_guides_registry WHERE is_active = TRUE'
    );
    return Number(res.rows[0]?.count ?? 0);
  }
}
