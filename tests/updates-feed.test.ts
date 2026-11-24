import assert from 'node:assert/strict';
import test from 'node:test';
import type { ExperienceLogEntry } from '../src/domain/experience/ExperienceEntry.ts';
import type { SelfCheckEvaluation } from '../src/utils/qualificationSelfCheck.ts';
import {
  buildQualificationUpdatesFeed,
  resolveUserQualificationProfile,
  type UpdateFeedRegionalEventInput,
} from '../src/utils/updatesFeed.ts';

function makeMockSelfCheck(overrides: Partial<SelfCheckEvaluation>): SelfCheckEvaluation {
  return {
    track: 'hiking',
    answeredCount: 0,
    totalQuestions: 8,
    isComplete: false,
    earnedPoints: 0,
    maxPoints: 16,
    readinessPercent: 0,
    confirmedCount: 0,
    partialCount: 0,
    missingCount: 0,
    unansweredCount: 8,
    statusPieData: [],
    domainBreakdown: [],
    domainPieData: [],
    verdictTier: 'incomplete',
    verdictBadge: '',
    verdictTitle: '',
    verdictSummary: '',
    recommendedContour: '',
    recommendations: [],
    ...overrides,
  };
}

const SAMPLE_EVENTS: UpdateFeedRegionalEventInput[] = [
  {
    id: 'ev-basic',
    title: 'Весенняя сессия РЦА: пешеходный туризм 1–2 КС',
    regionLabel: 'Приморский край',
    shortDate: '12 апр 2027',
    isoTargetDate: '2027-04-12',
    venue: 'ВВГУ, Владивосток',
    tracks: 'Пешеходный 1–2 КС',
    submissionDeadline: 'До 01 апреля 2027',
    kindLabel: 'Экзаменационная сессия',
  },
  {
    id: 'ev-adv',
    title: 'Спецпоток переаттестации и допуск 3–4 КС',
    regionLabel: 'Камчатский край',
    shortDate: '20 май 2027',
    isoTargetDate: '2027-05-20',
    venue: 'Петропавловск-Камчатский',
    tracks: 'Экспедиции 3–4 КС, переаттестация',
    submissionDeadline: 'До 10 мая 2027',
    kindLabel: 'Экзаменационная сессия',
  },
];

test('resolveUserQualificationProfile classifies novice, intermediate, and advanced users accurately', () => {
  const novice = resolveUserQualificationProfile({
    user: { role: 'candidate', region: 'Приморский край', attestationExpiresAt: null },
    attestationPercent: 15,
    journalEntries: [],
  });
  assert.equal(novice.level, 'novice');

  const intermediateJournal: ExperienceLogEntry[] = [
    {
      id: 'e1',
      date: '2026-09-10',
      routeTitle: 'Восхождение на г. Облачная',
      regionId: 'primorye',
      regionName: 'Приморский край',
      complexity: '2 КС',
      participantsCount: 8,
      notes: '',
      createdAt: '2026-09-10T00:00:00Z',
    },
  ];
  const intermediate = resolveUserQualificationProfile({
    user: { role: 'candidate', region: 'Приморский край', attestationExpiresAt: null },
    attestationPercent: 55,
    journalEntries: intermediateJournal,
  });
  assert.equal(intermediate.level, 'intermediate');

  const certifiedInstructor = resolveUserQualificationProfile({
    user: { role: 'instructor', region: 'Камчатский край', attestationExpiresAt: '2027-02-01' },
    attestationPercent: 100,
    journalEntries: [],
  });
  assert.equal(certifiedInstructor.level, 'advanced');
});

test('buildQualificationUpdatesFeed filters items strictly by qualification level unless includeOtherLevels is true', () => {
  const user = {
    id: 'u-novice',
    role: 'candidate' as const,
    region: 'Приморский край',
    attestationExpiresAt: null,
  };
  const qualification = resolveUserQualificationProfile({
    user,
    attestationPercent: 20,
    journalEntries: [],
  });
  assert.equal(qualification.level, 'novice');

  const selfCheckWithGap = makeMockSelfCheck({
    answeredCount: 3,
    readinessPercent: 30,
    recommendations: [
      {
        questionId: 'q-wfa',
        title: 'Сертификат первой помощи WFA',
        domainLabel: 'Безопасность',
        severity: 'critical',
        actionHint: 'Пройдите базовый интенсив WFA 16 часов.',
        knowledgeQuery: 'аптечка WFA',
      },
    ],
  });

  const filteredFeed = buildQualificationUpdatesFeed({
    user,
    qualification,
    inquiries: [
      {
        id: 'inq-1',
        track: 'Пешеходный туризм',
        region: 'Приморский край',
        status: 'needs_documents',
        statusComment: 'Приложите скан медсправки 086/у.',
        createdAt: '2026-11-20T10:00:00Z',
      },
    ],
    attestationPercent: 20,
    selfCheck: selfCheckWithGap,
    regionalEvents: SAMPLE_EVENTS,
    includeOtherLevels: false,
    todayIso: '2026-11-24',
  });

  // Every returned item must explicitly target 'novice'
  assert.ok(filteredFeed.length > 0);
  for (const item of filteredFeed) {
    assert.ok(
      item.targetLevels.includes('novice'),
      `Item ${item.id} (${item.title}) does not target novice`
    );
  }

  // Must contain system notification, regional event, and dynamic self-check gap advice
  assert.ok(filteredFeed.some((i) => i.kind === 'system' && i.id.startsWith('sys-inq-')));
  assert.ok(filteredFeed.some((i) => i.kind === 'event' && i.id === 'reg-evt-ev-basic'));
  assert.ok(filteredFeed.some((i) => i.kind === 'advice' && i.id === 'adv-gap-q-wfa'));
  // Should NOT include advanced-only session when includeOtherLevels is false
  assert.equal(
    filteredFeed.some((i) => i.id === 'reg-evt-ev-adv'),
    false
  );

  // When includeOtherLevels is true, advanced items become visible too
  const unfilteredFeed = buildQualificationUpdatesFeed({
    user,
    qualification,
    regionalEvents: SAMPLE_EVENTS,
    includeOtherLevels: true,
    todayIso: '2026-11-24',
  });
  assert.ok(unfilteredFeed.some((i) => i.id === 'reg-evt-ev-adv'));
  assert.ok(unfilteredFeed.some((i) => i.id === 'rca-evt-advanced-expedition'));
});
