import type pg from 'pg';
import type {
  CertificationInquiry,
  InquiryRecordDTO,
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
    createdAt: row.created_at.toISOString(),
  };
}

/** PostgreSQL adapter for the certification inquiry bounded context. */
export class PostgresInquiryRepository implements InquiryRepository {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async loadAll(): Promise<InquiryRecordDTO[]> {
    const result = await this.pool.query<InquiryRow>(
      'SELECT * FROM certification_inquiries ORDER BY created_at ASC'
    );
    return result.rows.map(toDTO);
  }

  async save(inquiry: CertificationInquiry): Promise<InquiryRecordDTO[]> {
    await this.pool.query(
      `INSERT INTO certification_inquiries (
         id, full_name, email, contact_channel, region, track,
         experience_note, consent_accepted, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [
        inquiry.id,
        inquiry.fullName.value,
        inquiry.email.value,
        inquiry.contactChannel.value,
        inquiry.region,
        inquiry.track,
        inquiry.experienceNote.value,
        inquiry.consentAccepted,
        inquiry.createdAt,
      ]
    );
    return this.loadAll();
  }

  async count(): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM certification_inquiries'
    );
    return Number(result.rows[0]?.count ?? 0);
  }
}
