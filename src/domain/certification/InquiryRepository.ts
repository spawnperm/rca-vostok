import type { CertificationInquiry, InquiryRecordDTO } from './CertificationInquiry.ts';

/**
 * Persistence port for the certification inquiry bounded context.
 *
 * Asynchronous because the production adapter is PostgreSQL-backed.
 */
export interface InquiryRepository {
  loadAll(): Promise<InquiryRecordDTO[]>;
  /** Saves a new request and returns the bounded list of recent records. */
  save(inquiry: CertificationInquiry): Promise<InquiryRecordDTO[]>;
  /** Updates an existing request in place (status changes). */
  saveOne(inquiry: CertificationInquiry): Promise<void>;
  findById(id: string): Promise<CertificationInquiry | null>;
  /** Requests submitted by one account, newest first (cabinet view). */
  findByUser(userId: string): Promise<InquiryRecordDTO[]>;
  count(): Promise<number>;
}
