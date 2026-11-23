import {
  CertificationInquiry,
  type CreateInquiryInput,
  type InquiryRecordDTO,
  type InquiryStatus,
} from '../../domain/certification/CertificationInquiry.ts';
import type { InquiryRepository } from '../../domain/certification/InquiryRepository.ts';
import { NotFoundError, ValidationError, type DomainEventBus } from '../../domain/shared/DomainError.ts';
import { PERMISSIONS } from '../../domain/identity/Rbac.ts';
import type { User } from '../../domain/identity/User.ts';

/**
 * Submits a certification request.
 *
 * Ownership: when the caller is authenticated the request is linked to the
 * account, which is what makes "my applications" possible in the cabinet.
 * Anonymous submissions still work (the public form is open) and simply have no
 * owner.
 */
export class SubmitInquiryUseCase {
  private readonly inquiryRepo: InquiryRepository;
  private readonly eventBus: DomainEventBus;

  constructor(inquiryRepo: InquiryRepository, eventBus: DomainEventBus) {
    this.inquiryRepo = inquiryRepo;
    this.eventBus = eventBus;
  }

  async execute(
    input: CreateInquiryInput,
    owner: { id: string } | null = null
  ): Promise<{
    ok: true;
    id: string;
    sessionDate: string | null;
    createdAt: string;
    totalSubscriptions: number;
  }> {
    // The owner is taken from the authenticated session, never from the body:
    // otherwise a caller could claim someone else's requests.
    const inquiry = CertificationInquiry.create({
      ...input,
      userId: owner?.id ?? null,
    });
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
        userId: inquiry.userId,
      },
    });

  return {
      ok: true,
      id: inquiry.id,
      sessionDate: inquiry.sessionDate,
      createdAt: inquiry.createdAt,
      totalSubscriptions: allRecords.length,
    };
  }
}

export interface InquiryStatsDTO {
  totalSubscriptions: number;
  activeCount: number;
  byStatus: {
    new: number;
    in_review: number;
    needs_documents: number;
    approved: number;
    rejected: number;
  };
  byRegion: { region: string; count: number }[];
  byTrack: { track: string; count: number }[];
  lastInquiryAt: string | null;
  updatedAt: string;
}

export class GetInquiryStatsUseCase {
  private readonly inquiryRepo: InquiryRepository;

  constructor(inquiryRepo: InquiryRepository) {
    this.inquiryRepo = inquiryRepo;
  }

  async execute(): Promise<InquiryStatsDTO> {
    const records = await this.inquiryRepo.loadAll();
    const byStatus = {
      new: 0,
      in_review: 0,
      needs_documents: 0,
      approved: 0,
      rejected: 0,
    };
    const regionCounts = new Map<string, number>();
    const trackCounts = new Map<string, number>();
    let lastInquiryAt: string | null = null;

    for (const rec of records) {
      if (rec.status in byStatus) {
        byStatus[rec.status] += 1;
      } else {
        byStatus.new += 1;
      }

      const regionKey = (rec.region || 'Не указан').trim();
      regionCounts.set(regionKey, (regionCounts.get(regionKey) ?? 0) + 1);

      const trackKey = (rec.track || 'Не указано').trim();
      trackCounts.set(trackKey, (trackCounts.get(trackKey) ?? 0) + 1);

      if (!lastInquiryAt || rec.createdAt > lastInquiryAt) {
        lastInquiryAt = rec.createdAt;
      }
    }

    const byRegion = [...regionCounts.entries()]
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const byTrack = [...trackCounts.entries()]
      .map(([track, count]) => ({ track, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      totalSubscriptions: records.length,
      activeCount: byStatus.new + byStatus.in_review + byStatus.needs_documents,
      byStatus,
      byRegion,
      byTrack,
      lastInquiryAt,
      updatedAt: new Date().toISOString(),
    };
  }
}

/** «Мои заявки» — the signed-in user's own requests, newest first. */
export class ListMyInquiriesUseCase {
  private readonly inquiryRepo: InquiryRepository;

  constructor(inquiryRepo: InquiryRepository) {
    this.inquiryRepo = inquiryRepo;
  }

  async execute(actor: User): Promise<InquiryRecordDTO[]> {
    actor.assertCan(PERMISSIONS.VIEW_OWN_INQUIRIES);
    return this.inquiryRepo.findByUser(actor.id);
  }
}

/** All requests, for curators and admins. */
export class ListAllInquiriesUseCase {
  private readonly inquiryRepo: InquiryRepository;

  constructor(inquiryRepo: InquiryRepository) {
    this.inquiryRepo = inquiryRepo;
  }

  async execute(actor: User): Promise<InquiryRecordDTO[]> {
    actor.assertCan(PERMISSIONS.VIEW_ALL_INQUIRIES);
    return this.inquiryRepo.loadAll();
  }
}

/** Moves a request through its lifecycle. Curators and admins only. */
export class UpdateInquiryStatusUseCase {
  private readonly inquiryRepo: InquiryRepository;
  private readonly eventBus: DomainEventBus;

  constructor(inquiryRepo: InquiryRepository, eventBus: DomainEventBus) {
    this.inquiryRepo = inquiryRepo;
    this.eventBus = eventBus;
  }

  async execute(
    actor: User,
    input: { inquiryId: unknown; status: unknown; statusComment?: unknown }
  ): Promise<InquiryRecordDTO> {
    actor.assertCan(PERMISSIONS.VIEW_ALL_INQUIRIES);

    const inquiryId = typeof input.inquiryId === 'string' ? input.inquiryId : '';
    if (!inquiryId) {
      throw new ValidationError('Не указана заявка.');
    }

    const allowed: InquiryStatus[] = [
      'new',
      'in_review',
      'needs_documents',
      'approved',
      'rejected',
    ];
    const status = input.status;
    if (typeof status !== 'string' || !allowed.includes(status as InquiryStatus)) {
      throw new ValidationError('Недопустимый статус заявки.');
    }

    const inquiry = await this.inquiryRepo.findById(inquiryId);
    if (!inquiry) {
      throw new NotFoundError('Заявка не найдена.');
    }

    const statusComment =
      typeof input.statusComment === 'string' ? input.statusComment : undefined;
    const updated = inquiry.withStatus(status as InquiryStatus, statusComment);
    await this.inquiryRepo.saveOne(updated);

    this.eventBus.publish({
      eventName: 'certification.inquiry_status_changed',
      occurredAt: new Date().toISOString(),
      boundedContext: 'certification',
      payload: { inquiryId: updated.id, status: updated.status, by: actor.id },
    });

    return updated.toDTO();
  }
}
