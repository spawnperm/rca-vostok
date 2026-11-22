import type { CertificationInquiry, InquiryRecordDTO } from './CertificationInquiry.ts';

/**
 * Persistence port for the certification inquiry bounded context.
 *
 * Asynchronous because the production adapter is PostgreSQL-backed.
 */
export interface InquiryRepository {
  loadAll(): Promise<InquiryRecordDTO[]>;
  save(inquiry: CertificationInquiry): Promise<InquiryRecordDTO[]>;
  count(): Promise<number>;
}
