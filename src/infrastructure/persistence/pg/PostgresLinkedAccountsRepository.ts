import type pg from 'pg';
import {
  isLinkedProvider,
  type ConnectionMethod,
  type LinkedAccountDTO,
  type LinkedAccountsRepository,
  type LinkedProviderId,
} from '../../../domain/identity/LinkedAccounts.ts';

interface LinkedAccountRow {
  user_id: string;
  provider: string;
  connection_method: string;
  external_id: string;
  display_name: string;
  email: string;
  contact_channel: string;
  region: string;
  organisation: string;
  profile_url: string;
  preferred_track: string;
  experience_summary: string;
  use_for_exam_autofill: boolean;
  linked_at: Date;
  updated_at: Date;
}

function toDTO(row: LinkedAccountRow): LinkedAccountDTO {
  const provider: LinkedProviderId = isLinkedProvider(row.provider) ? row.provider : 'vk';
  const method: ConnectionMethod =
    row.connection_method === 'oauth' ||
    row.connection_method === 'internal_social' ||
    row.connection_method === 'profile_link'
      ? row.connection_method
      : 'profile_link';

  return {
    provider,
    connectionMethod: method,
    externalId: row.external_id,
    displayName: row.display_name,
    email: row.email,
    contactChannel: row.contact_channel,
    region: row.region,
    organisation: row.organisation,
    profileUrl: row.profile_url,
    preferredTrack: row.preferred_track,
    experienceSummary: row.experience_summary,
    useForExamAutofill: row.use_for_exam_autofill,
    linkedAt: row.linked_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** PostgreSQL adapter for linked social/Google accounts. */
export class PostgresLinkedAccountsRepository implements LinkedAccountsRepository {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async findByUserId(userId: string): Promise<LinkedAccountDTO[]> {
    const res = await this.pool.query<LinkedAccountRow>(
      `SELECT * FROM user_linked_accounts
        WHERE user_id = $1
        ORDER BY updated_at DESC`,
      [userId]
    );
    return res.rows.map(toDTO);
  }

  async upsert(userId: string, account: LinkedAccountDTO): Promise<LinkedAccountDTO[]> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (account.useForExamAutofill) {
        await client.query(
          `UPDATE user_linked_accounts
              SET use_for_exam_autofill = false
            WHERE user_id = $1 AND provider <> $2`,
          [userId, account.provider]
        );
      }
      await client.query(
        `INSERT INTO user_linked_accounts (
           user_id, provider, connection_method, external_id,
           display_name, email, contact_channel, region, organisation,
           profile_url, preferred_track, experience_summary,
           use_for_exam_autofill, linked_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (user_id, provider) DO UPDATE SET
           connection_method = EXCLUDED.connection_method,
           external_id = EXCLUDED.external_id,
           display_name = EXCLUDED.display_name,
           email = EXCLUDED.email,
           contact_channel = EXCLUDED.contact_channel,
           region = EXCLUDED.region,
           organisation = EXCLUDED.organisation,
           profile_url = EXCLUDED.profile_url,
           preferred_track = EXCLUDED.preferred_track,
           experience_summary = EXCLUDED.experience_summary,
           use_for_exam_autofill = EXCLUDED.use_for_exam_autofill,
           updated_at = EXCLUDED.updated_at`,
        [
          userId,
          account.provider,
          account.connectionMethod,
          account.externalId,
          account.displayName,
          account.email,
          account.contactChannel,
          account.region,
          account.organisation,
          account.profileUrl,
          account.preferredTrack,
          account.experienceSummary,
          account.useForExamAutofill,
          account.linkedAt,
          account.updatedAt,
        ]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return this.findByUserId(userId);
  }

  async setAutofillSource(
    userId: string,
    provider: LinkedProviderId | null
  ): Promise<LinkedAccountDTO[]> {
    await this.pool.query(
      `UPDATE user_linked_accounts
          SET use_for_exam_autofill = ($2::text IS NOT NULL AND provider = $2)
        WHERE user_id = $1`,
      [userId, provider]
    );
    return this.findByUserId(userId);
  }

  async unlink(userId: string, provider: LinkedProviderId): Promise<LinkedAccountDTO[]> {
    await this.pool.query(
      `DELETE FROM user_linked_accounts WHERE user_id = $1 AND provider = $2`,
      [userId, provider]
    );
    const list = await this.findByUserId(userId);
    if (list.length > 0 && !list.some((item) => item.useForExamAutofill)) {
      return this.setAutofillSource(userId, list[0].provider);
    }
    return list;
  }
}
