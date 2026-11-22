import type pg from 'pg';
import {
  CertificationInquiry,
  type InquiryRecordDTO,
  type InquiryStatus,
} from '../../../domain/certification/CertificationInquiry.ts';
import type { InquiryRepository } from '../../../domain/certification/InquiryRepository.ts';

interface InquiryRow {
  id: string;
  full_name: string;
  email: string;
  contact_channel: string;
  region: string;
  track: string;
  experience_note: string;
  consent_accepted: boolean;
  user_id: string | null;
  status: string;
  created_at: Date;
}

function toDTO(row: InquiryRow): InquiryRecordDTO {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    contactChannel: row.contact_channel,
    region: row.region,
    track: row.track,
    experienceNote: row.experience_note,
    consentAccepted: row.consent_accepted,
    userId: row.user_id,
    status: row.status as InquiryStatus,
    createdAt: row.created_at.toISOString(),
  };
}

function toAggregate(row: InquiryRow): CertificationInquiry {
  return CertificationInquiry.rehydrate({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    contactChannel: row.contact_channel,
    region: row.region,
    track: row.track,
    experienceNote: row.experience_note,
    consentAccepted: row.consent_accepted,
    userId: row.user_id,
    status: row.status as InquiryStatus,
    createdAt: row.created_at.toISOString(),
  });
}

/** PostgreSQL adapter for the certification inquiry bounded context. */
export class PostgresInquiryRepository implements InquiryRepository {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async loadAll(): Promise<InquiryRecordDTO[]> {
    const result = await this.pool.query<InquiryRow>(
      'SELECT * FROM certification_inquiries ORDER BY created_at DESC'
    );
    return result.rows.map(toDTO);
  }

  async save(inquiry: CertificationInquiry): Promise<InquiryRecordDTO[]> {
    await this.insert(inquiry);
    // Bounded view for the counter returned to the caller.
    const recent = await this.pool.query<InquiryRow>(
      'SELECT * FROM certification_inquiries ORDER BY created_at DESC LIMIT 1000'
    );
    return recent.rows.map(toDTO);
  }

  async saveOne(inquiry: CertificationInquiry): Promise<void> {
    const dto = inquiry.toDTO();
    await this.pool.query(
      `UPDATE certification_inquiries
          SET status = $2
        WHERE id = $1`,
      [dto.id, dto.status]
    );
  }

  async findById(id: string): Promise<CertificationInquiry | null> {
    const result = await this.pool.query<InquiryRow>(
      'SELECT * FROM certification_inquiries WHERE id = $1',
      [id]
    );
    return result.rows.length > 0 ? toAggregate(result.rows[0]) : null;
  }

  async findByUser(userId: string): Promise<InquiryRecordDTO[]> {
    const result = await this.pool.query<InquiryRow>(
      `SELECT * FROM certification_inquiries
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 200`,
      [userId]
    );
    return result.rows.map(toDTO);
  }

  async count(): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM certification_inquiries'
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async insert(inquiry: CertificationInquiry): Promise<void> {
    const dto = inquiry.toDTO();
    await this.pool.query(
      `INSERT INTO certification_inquiries (
         id, full_name, email, contact_channel, region, track,
         experience_note, consent_accepted, user_id, status, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [
        dto.id,
        dto.fullName,
        dto.email,
        dto.contactChannel,
        dto.region,
        dto.track,
        dto.experienceNote,
        dto.consentAccepted,
        dto.userId,
        dto.status,
        dto.createdAt,
      ]
    );
  }
}
