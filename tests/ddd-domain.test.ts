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
import {
  GetFeedbackStatsUseCase,
  SubmitFeedbackUseCase,
} from '../src/application/feedback/FeedbackUseCases.ts';
import { CertificationInquiry } from '../src/domain/certification/CertificationInquiry.ts';
import { DemandForecastService } from '../src/domain/certification/DemandForecastService.ts';
import { PlatformFeedback } from '../src/domain/feedback/PlatformFeedback.ts';
import {
  InvariantViolationError,
  NotFoundError,
  ValidationError,
} from '../src/domain/shared/DomainError.ts';
import { EmailAddress, SanitizedText } from '../src/domain/shared/ValueObjects.ts';
import { InMemoryDomainEventBus } from '../src/infrastructure/events/InMemoryDomainEventBus.ts';
import { JsonFileAnalyticsRepository } from '../src/infrastructure/persistence/JsonFileAnalyticsRepository.ts';
import { JsonFileFeedbackRepository } from '../src/infrastructure/persistence/JsonFileFeedbackRepository.ts';
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

test('DemandForecastService: forecastDfoRegions2030 models 2025-2030 regional demand from tourist flow', () => {
  const forecast = DemandForecastService.forecastDfoRegions2030({
    profiles: [
      {
        id: 'primorye',
        name: 'Приморский край',
        shortName: 'Приморье',
        baseFlowThousands: 4068.9,
        activeSharePct: 20.5,
        pOrg: 30,
        gSize: 10,
        groupsPerSeason: 15,
        kSeason: 1.3,
        kTurnover: 1.1,
        defaultFlowGrowthPct: 7.5,
        registryCount: 122,
        driverNote: 'Тест',
      },
      {
        id: 'kamchatka',
        name: 'Камчатский край',
        shortName: 'Камчатка',
        baseFlowThousands: 425,
        activeSharePct: 22,
        pOrg: 58,
        gSize: 7,
        groupsPerSeason: 14,
        kSeason: 1.45,
        kTurnover: 1.15,
        defaultFlowGrowthPct: 10,
        registryCount: 343,
        driverNote: 'Тест',
      },
    ],
    selectedRegionId: 'all',
    flowMultiplierPct: 100,
    annualFlowGrowthOverridePct: null,
    pOrgShiftBy2030Pct: 0,
  });

  assert.equal(forecast.yearlySeries.length, 6);
  assert.equal(forecast.yearlySeries[0].year, '2025');
  assert.equal(forecast.yearlySeries[5].year, '2030');
  assert.ok(forecast.totals.demand2030 > forecast.totals.demand2025);
  assert.equal(forecast.totals.registryCount, 465);

  assert.throws(
    () =>
      DemandForecastService.forecastDfoRegions2030({
        profiles: [],
        selectedRegionId: 'all',
        flowMultiplierPct: 0,
        annualFlowGrowthOverridePct: null,
        pOrgShiftBy2030Pct: 0,
      }),
    InvariantViolationError
  );
});

test('Application UseCases + Persistence + DomainEventBus work end-to-end in isolated temp directory', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-vostok-ddd-'));
  try {
    const eventBus = new InMemoryDomainEventBus();
    const publishedEvents: string[] = [];
    eventBus.subscribe('*', (ev) => publishedEvents.push(ev.eventName));

    const inquiryRepo = new JsonFileInquiryRepository(tempDir);
    const submitInquiry = new SubmitInquiryUseCase(inquiryRepo, eventBus);
    const getStats = new GetInquiryStatsUseCase(inquiryRepo);

    const submitted = await submitInquiry.execute({
      fullName: 'Елена Морозова',
      email: 'elena@bikin.ru',
      region: 'Пожарский округ',
      track: 'Пешеходный туризм',
      consentAccepted: true,
    });

    assert.equal(submitted.ok, true);
    assert.equal(submitted.totalSubscriptions, 1);
    assert.equal((await getStats.execute()).totalSubscriptions, 1);
    assert.ok(publishedEvents.includes('certification.inquiry_submitted'));

    const analyticsRepo = new JsonFileAnalyticsRepository(tempDir);
    const collectBehavior = new CollectBehaviorUseCase(analyticsRepo, eventBus);
    const getSummary = new GetAnalyticsSummaryUseCase(analyticsRepo);
    const getSession = new GetSessionDetailsUseCase(analyticsRepo);

    const collected = await collectBehavior.execute({
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
    const summary = await getSummary.execute();
    assert.equal(summary.totals.sessions, 1);
    assert.equal(summary.totals.totalClicks, 1);
    assert.equal(summary.totals.avgScrollDepth, 72);

    const details = await getSession.execute('sess-test-1');
    assert.equal(details.events.length, 3);
    await assert.rejects(() => getSession.execute('missing-session'), NotFoundError);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('PathConfinement rejects directory traversal attempts', () => {
  const base = path.resolve('/tmp/rca-safe-dir');
  assert.throws(() => resolveConfinedPath(base, '../../etc/passwd'));
});

test('PlatformFeedback + FeedbackUseCases validate inputs, allow optional email, and persist records', async () => {
  assert.throws(
    () =>
      PlatformFeedback.create({
        senderName: 'А',
        feedbackType: 'suggestion',
        subject: 'Коротко',
        message: 'Мало',
      }),
    ValidationError
  );

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-vostok-fb-'));
  try {
    const eventBus = new InMemoryDomainEventBus();
    const published: string[] = [];
    eventBus.subscribe('*', (ev) => published.push(ev.eventName));

    const repo = new JsonFileFeedbackRepository(tempDir);
    const submit = new SubmitFeedbackUseCase(repo, eventBus);
    const stats = new GetFeedbackStatsUseCase(repo);

    const res = await submit.execute({
      senderName: 'Турклуб «Сихотэ-Алинь»',
      email: 'Club@Example.RU',
      feedbackType: 'suggestion',
      platformModule: 'Калькулятор и симулятор ДФО',
      subject: 'Экспорт расчёта по округам',
      message: 'Добавить выгрузку таблицы расчётной потребности в CSV по выбранным округам Приморья.',
    });

    assert.equal(res.ok, true);
    assert.ok(res.id.startsWith('fb-'));
    assert.equal(res.totalFeedback, 1);
    assert.equal((await stats.execute()).totalFeedback, 1);
    assert.ok(published.includes('platform.feedback_submitted'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
