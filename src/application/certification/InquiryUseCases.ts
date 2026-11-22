import {
  CertificationInquiry,
  type CreateInquiryInput,
} from '../../domain/certification/CertificationInquiry.ts';
import type { InquiryRepository } from '../../domain/certification/InquiryRepository.ts';
import type { DomainEventBus } from '../../domain/shared/DomainError.ts';

export class SubmitInquiryUseCase {
  private readonly inquiryRepo: InquiryRepository;
  private readonly eventBus: DomainEventBus;

  constructor(inquiryRepo: InquiryRepository, eventBus: DomainEventBus) {
    this.inquiryRepo = inquiryRepo;
    this.eventBus = eventBus;
  }

  async execute(input: CreateInquiryInput): Promise<{
    ok: true;
    id: string;
    createdAt: string;
    totalSubscriptions: number;
  }> {
    const inquiry = CertificationInquiry.create(input);
    const allRecords = await this.inquiryRepo.save(inquiry);

    this.eventBus.publish({
      eventName: 'certification.inquiry_submitted',
      occurredAt: inquiry.createdAt,
      boundedContext: 'certification',
      payload: {
        inquiryId: inquiry.id,
        region: inquiry.region,
        track: inquiry.track,
        totalSubscriptions: allRecords.length,
      },
    });

    return {
      ok: true,
      id: inquiry.id,
      createdAt: inquiry.createdAt,
      totalSubscriptions: allRecords.length,
    };
  }
}

export class GetInquiryStatsUseCase {
  private readonly inquiryRepo: InquiryRepository;

  constructor(inquiryRepo: InquiryRepository) {
    this.inquiryRepo = inquiryRepo;
  }

  async execute(): Promise<{ totalSubscriptions: number }> {
    return {
      totalSubscriptions: await this.inquiryRepo.count(),
    };
  }
}
