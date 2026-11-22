import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  CollectBehaviorUseCase,
  GetAnalyticsSummaryUseCase,
  GetSessionDetailsUseCase,
} from '../src/application/analytics/AnalyticsUseCases.ts';
import {
  GetInquiryStatsUseCase,
  SubmitInquiryUseCase,
} from '../src/application/certification/InquiryUseCases.ts';
import { CertificationInquiry } from '../src/domain/certification/CertificationInquiry.ts';
import { DemandForecastService } from '../src/domain/certification/DemandForecastService.ts';
import {
  InvariantViolationError,
  NotFoundError,
  ValidationError,
} from '../src/domain/shared/DomainError.ts';
import { EmailAddress, SanitizedText } from '../src/domain/shared/ValueObjects.ts';
import { InMemoryDomainEventBus } from '../src/infrastructure/events/InMemoryDomainEventBus.ts';
import { JsonFileAnalyticsRepository } from '../src/infrastructure/persistence/JsonFileAnalyticsRepository.ts';
import { JsonFileInquiryRepository } from '../src/infrastructure/persistence/JsonFileInquiryRepository.ts';
import { resolveConfinedPath } from '../src/infrastructure/persistence/PathConfinement.ts';

test('ValueObjects: EmailAddress validates format and normalizes casing', () => {
  const email = EmailAddress.create('  Guide.Vostok@Example.RU ');
  assert.equal(email.value, 'guide.vostok@example.ru');

  assert.throws(() => EmailAddress.create('invalid-email'), ValidationError);
  assert.throws(() => SanitizedText.create('А', { fieldLabel: 'Имя', minLen: 2, maxLen: 50 }), ValidationError);
});

test('CertificationInquiry: enforces consentAccepted invariant and creates valid DTO', () => {
  assert.throws(
    () =>
      CertificationInquiry.create({
        fullName: 'Алексей Смирнов',
        email: 'alexey@example.ru',
        consentAccepted: false,
      }),
    ValidationError
  );

  const inquiry = CertificationInquiry.create({
    fullName: 'Алексей Смирнов',
    email: 'alexey@example.ru',
    region: 'Приморский край',
    track: 'Водный туризм и сплавы',
    consentAccepted: true,
  });

  const dto = inquiry.toDTO();
  assert.ok(dto.id.startsWith('inq-'));
  assert.equal(dto.consentAccepted, true);
  assert.equal(dto.region, 'Приморский край');
});

test('DemandForecastService: calculates Primorye base scenario (~2390 guides) and rejects invalid invariants', () => {
  const result = DemandForecastService.calculate({
    tAct: 835000,
    pOrg: 30,
    gSize: 10,
    groupsPerSeason: 15,
    kSeason: 1.3,
    kTurnover: 1.1,
    registryCount: 122,
    groupsPerYear: 4,
    cohortSize: 25,
    conversionRate: 75,
  });

  assert.equal(result.organizedTourists, 250500);
  assert.equal(result.humanGroupsPerYear, 25050);
  assert.equal(result.baseDemand, 1670);
  assert.equal(result.totalDemand, 2388);
  assert.equal(result.deficit, 2266);
  assert.equal(result.sensitivityPoints.length, 9);
  assert.equal(result.fiveYearProjection.length, 5);
  assert.equal(result.annualNewCertified, 75);

  assert.throws(
    () =>
      DemandForecastService.calculate({
        tAct: 835000,
        pOrg: 30,
        gSize: 0,
        groupsPerSeason: 15,
        kSeason: 1.3,
        kTurnover: 1.1,
        registryCount: 122,
        groupsPerYear: 4,
        cohortSize: 25,
        conversionRate: 75,
      }),
    InvariantViolationError
  );
});

test('Application UseCases + Persistence + DomainEventBus work end-to-end in isolated temp directory', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-vostok-ddd-'));
  try {
    const eventBus = new InMemoryDomainEventBus();
    const publishedEvents: string[] = [];
    eventBus.subscribe('*', (ev) => publishedEvents.push(ev.eventName));

    const inquiryRepo = new JsonFileInquiryRepository(tempDir);
    const submitInquiry = new SubmitInquiryUseCase(inquiryRepo, eventBus);
    const getStats = new GetInquiryStatsUseCase(inquiryRepo);

    const submitted = submitInquiry.execute({
      fullName: 'Елена Морозова',
      email: 'elena@bikin.ru',
      region: 'Пожарский округ',
      track: 'Пешеходный туризм',
      consentAccepted: true,
    });

    assert.equal(submitted.ok, true);
    assert.equal(submitted.totalSubscriptions, 1);
    assert.equal(getStats.execute().totalSubscriptions, 1);
    assert.ok(publishedEvents.includes('certification.inquiry_submitted'));

    const analyticsRepo = new JsonFileAnalyticsRepository(tempDir);
    const collectBehavior = new CollectBehaviorUseCase(analyticsRepo, eventBus);
    const getSummary = new GetAnalyticsSummaryUseCase(analyticsRepo);
    const getSession = new GetSessionDetailsUseCase(analyticsRepo);

    const collected = collectBehavior.execute({
      sessionId: 'sess-test-1',
      visitorId: 'vis-test-1',
      viewport: '1440x900',
      userAgent: 'Mozilla/5.0 Chrome/125.0',
      events: [
        { type: 'session_start', tab: 'overview', elapsedMs: 0 },
        { type: 'click', tab: 'overview', elapsedMs: 1200, xPct: 45, yPct: 30, label: 'Таймлайн' },
        { type: 'scroll', tab: 'overview', elapsedMs: 2500, scrollDepth: 72 },
        { type: 'unknown_ignored', tab: 'overview', elapsedMs: 3000 },
      ],
    });

    assert.equal(collected.accepted, 3);
    const summary = getSummary.execute();
    assert.equal(summary.totals.sessions, 1);
    assert.equal(summary.totals.totalClicks, 1);
    assert.equal(summary.totals.avgScrollDepth, 72);

    const details = getSession.execute('sess-test-1');
    assert.equal(details.events.length, 3);
    assert.throws(() => getSession.execute('missing-session'), NotFoundError);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('PathConfinement rejects directory traversal attempts', () => {
  const base = path.resolve('/tmp/rca-safe-dir');
  assert.throws(() => resolveConfinedPath(base, '../../etc/passwd'));
});
