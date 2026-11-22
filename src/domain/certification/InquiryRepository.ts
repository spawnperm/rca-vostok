import type { CertificationInquiry, InquiryRecordDTO } from './CertificationInquiry.ts';

export interface InquiryRepository {
  loadAll(): InquiryRecordDTO[];
  save(inquiry: CertificationInquiry): InquiryRecordDTO[];
  count(): number;
}
