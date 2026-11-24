import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GetLiveInstructorMarketStatsUseCase,
  LiveMarketEventBuffer,
} from '../src/application/market/LiveInstructorMarketStats.ts';
import type { InquiryRepository } from '../src/domain/certification/InquiryRepository.ts';
import type { InquiryRecordDTO } from '../src/domain/certification/CertificationInquiry.ts';
import {
  INITIAL_DFO_CERTIFIED_GUIDES,
  type GuideLeaderboardRepository,
  type CertifiedGuideRecord,
} from '../src/domain/certification/GuideLeaderboard.ts';
import { InMemoryDomainEventBus } from '../src/infrastructure/events/InMemoryDomainEventBus.ts';

describe('LiveInstructorMarketStats (DFO Analytical Dashboard)', () => {
  it('aggregates DFO registry, dynamic approved inquiries, active guides, and readiness stats', async () => {
    const sampleInquiries: InquiryRecordDTO[] = [
      {
        id: 'inq-1',
        fullName: 'Иван Петров',
        email: 'ivan@example.com',
        contactChannel: '@ivan',
        region: 'Приморский край',
        track: 'Водный туризм и сплавы',
        experienceNote: '3 года',
        consentAccepted: true,
        sessionDate: null,
        statusComment: '',
        userId: null,
        status: 'new',
        createdAt: '2026-11-20T10:00:00Z',
      },
      {
        id: 'inq-2',
        fullName: 'Анна Смирнова',
        email: 'anna@example.com',
        contactChannel: '@anna',
        region: 'Приморский край',
        track: 'Пешеходный туризм',
        experienceNote: '5 лет',
        consentAccepted: true,
        sessionDate: null,
        statusComment: '',
        userId: null,
        status: 'approved',
        createdAt: '2026-11-21T10:00:00Z',
      },
    ];

    const inquiryRepoStub: InquiryRepository = {
      async loadAll() {
        return sampleInquiries;
      },
      async save() {
        return sampleInquiries;
      },
      async saveOne() {},
      async findById() {
        return null;
      },
      async findByUser() {
        return [];
      },
      async count() {
        return sampleInquiries.length;
      },
    };

    const activeGuides = INITIAL_DFO_CERTIFIED_GUIDES.filter((g) => g.isActive);
    const leaderboardStub: GuideLeaderboardRepository = {
      async list() {
        return [...activeGuides] as CertifiedGuideRecord[];
      },
      async upsert() {},
      async count() {
        return activeGuides.length;
      },
    };

    const readinessStub = {
      getStats() {
        return { totalResponses: 14, averageReadinessPct: 76 };
      },
    };

    const eventBus = new InMemoryDomainEventBus();
    const buffer = new LiveMarketEventBuffer(5);
    let callbackFired = 0;
    const detach = buffer.attach(eventBus, () => {
      callbackFired += 1;
    });

    eventBus.publish({
      eventName: 'certification.inquiry_submitted',
      occurredAt: '2026-11-23T12:00:00Z',
      boundedContext: 'certification',
      payload: { region: 'Приморский край', track: 'Водный туризм и сплавы' },
    });

    assert.equal(callbackFired, 1);

    const useCase = new GetLiveInstructorMarketStatsUseCase(
      inquiryRepoStub,
      leaderboardStub,
      readinessStub,
      buffer,
      'test-memory'
    );

    const snapshot = await useCase.execute(new Date('2026-11-23T12:05:00Z'));

    assert.equal(snapshot.storageBackend, 'test-memory');
    assert.equal(snapshot.regions.length, 7);
    assert.equal(snapshot.headline.activeInquiriesCount, 1);
    assert.equal(snapshot.headline.approvedInquiriesCount, 1);
    assert.equal(snapshot.headline.avgReadinessPct, 76);
    assert.equal(snapshot.headline.readinessResponsesCount, 14);
    assert.equal(snapshot.headline.activeLeaderboardGuides, activeGuides.length);

    const primorye = snapshot.regions.find((r) => r.id === 'primorye')!;
    // Base 122 + 1 approved inquiry = 123
    assert.equal(primorye.certifiedInRegistry, 123);
    assert.equal(primorye.activeInquiries, 1);
    assert.ok(snapshot.tracks.length >= 2);
    assert.equal(snapshot.recentEvents.length, 1);
    assert.equal(snapshot.recentEvents[0].title, 'Новая заявка на аттестацию');

    detach();
  });
});
