import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACCOUNT_BACKUP_SCHEMA_VERSION,
  buildAccountBackupFileName,
  buildAccountBackupPayload,
  selectAccountBackupScope,
  serializeAccountBackupJson,
} from '../src/utils/accountBackupExport.ts';
import { evaluateInstructorAchievements } from '../src/domain/experience/InstructorAchievementsService.ts';
import type { SessionUser } from '../src/utils/identityApi.ts';
import type { UserAttestationSummary } from '../src/components/AttestationProgressWidget.tsx';
import type { ExperienceLogEntry } from '../src/domain/experience/ExperienceEntry.ts';

const SAMPLE_USER: SessionUser = {
  id: 'usr-test-01',
  email: 'guide.dfo@example.ru',
  fullName: 'Кокшаров Алексей Викторович',
  role: 'candidate',
  region: 'Приморский край',
  organisation: 'Турклуб «Русский Восток»',
  isActive: true,
  attestationExpiresAt: '2029-05-20',
  createdAt: '2026-01-10T08:00:00.000Z',
  lastLoginAt: '2026-11-20T09:00:00.000Z',
  permissions: ['profile:edit_own', 'inquiries:view_own'],
};

const makeStage = (
  id: 'application' | 'training' | 'exam' | 'certificate',
  stepNumber: string,
  title: string
) => ({
  id,
  stepNumber,
  title,
  shortTitle: title,
  durationHint: '1–3 дня',
  summary: title,
  outputLabel: title,
  icon: () => null,
  tasks: [],
});

const STAGE_DEFS = [
  makeStage('application', '01', 'Подача заявки'),
  makeStage('training', '02', 'Обучение'),
  makeStage('exam', '03', 'Экзамен'),
  makeStage('certificate', '04', 'Удостоверение'),
] as const;

const SAMPLE_PROGRESS: UserAttestationSummary = {
  percent: 80,
  completedTasks: 9,
  totalTasks: 12,
  completedStages: 3,
  activeStage: STAGE_DEFS[3],
  stages: STAGE_DEFS.map((stage, idx) => ({
    stage,
    completedCount: idx < 3 ? 3 : 1,
    totalCount: 3,
    percent: idx < 3 ? 100 : 33,
    status: idx < 3 ? 'completed' : 'in_progress',
  })),
  resolvedCompletedSet: new Set<string>(),
  autoTaskSet: new Set<string>(),
};

const SAMPLE_HIKES: ExperienceLogEntry[] = [
  {
    id: 'hike-01',
    date: '2026-08-14',
    routeTitle: 'Восхождение на г. Ливадийская (Пидан) — траверс хребта',
    regionId: 'primorye',
    regionName: 'Приморский край',
    complexity: '2 КС',
    participantsCount: 8,
    distanceKm: 24.5,
    notes: 'Учебный выход с группой',
    createdAt: '2026-08-15T10:00:00.000Z',
  },
  {
    id: 'hike-02',
    date: '2026-09-22',
    routeTitle: 'Сплав по р. Кема',
    regionId: 'primorye',
    regionName: 'Приморский край',
    complexity: '3 КС',
    participantsCount: 6,
    distanceKm: 68.0,
    notes: 'Пороги 3 КС, спасработы',
    createdAt: '2026-09-28T12:00:00.000Z',
  },
];

test('buildAccountBackupPayload assembles complete statistics, achievements, and hike history safely', () => {
  const achievementsSummary = evaluateInstructorAchievements({
    entries: SAMPLE_HIKES,
    role: SAMPLE_USER.role,
    attestationPercent: SAMPLE_PROGRESS.percent,
    completedStagesCount: SAMPLE_PROGRESS.completedStages,
    fullName: SAMPLE_USER.fullName,
    region: SAMPLE_USER.region,
    organisation: SAMPLE_USER.organisation,
    hasAttestationExpiry: true,
    inquiries: [{ status: 'approved', track: 'Пешеходный туризм' }],
    selfCheckConfirmedCount: 10,
    diagnosticsPercent: 85,
    diagnosticsComplete: true,
    linkedAccountsCount: 1,
  });

  const payload = buildAccountBackupPayload({
    user: SAMPLE_USER,
    progressSummary: SAMPLE_PROGRESS,
    achievementsSummary,
    experienceEntries: SAMPLE_HIKES,
    inquiries: [
      {
        id: 'inq-101',
        fullName: SAMPLE_USER.fullName,
        email: SAMPLE_USER.email,
        contactChannel: '@guide_dfo',
        track: 'Пешеходный туризм',
        region: 'Приморский край',
        experienceNote: '2 КС, Приморский край',
        consentAccepted: true,
        userId: SAMPLE_USER.id,
        sessionDate: '2027-04-16',
        status: 'approved',
        createdAt: '2026-10-05T08:00:00.000Z',
      },
    ],
    linkedAccounts: [
      {
        provider: 'vk',
        connectionMethod: 'oauth',
        externalId: 'vk-12345',
        displayName: 'Alexey DFO',
        email: SAMPLE_USER.email,
        contactChannel: '@guide_dfo',
        region: 'Приморский край',
        organisation: SAMPLE_USER.organisation,
        preferredTrack: 'Пешеходный туризм',
        experienceSummary: '3 КС водные и горные маршруты',
        profileUrl: 'https://vk.com/id12345',
        linkedAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-01T10:00:00.000Z',
        useForExamAutofill: true,
      },
    ],
    selectedExamDate: '2027-04-16',
    selectedContour: 'contour_b',
    favoriteLiteratureIdsOverride: ['lit-pashkov', 'lit-wfa'],
    now: new Date('2026-11-23T16:40:00Z'),
  });

  assert.equal(payload.meta.schemaVersion, ACCOUNT_BACKUP_SCHEMA_VERSION);
  assert.equal(payload.meta.backupPurpose, 'full-user-data-backup-and-portability');
  assert.equal(payload.profile.userId, 'usr-test-01');
  assert.deepEqual(payload.profile.favoriteLiteratureIds, ['lit-pashkov', 'lit-wfa']);

  // Statistics
  assert.equal(payload.statistics.attestation.overallPercent, 80);
  assert.equal(payload.statistics.experience.metrics.totalTrips, 2);
  assert.equal(payload.statistics.experience.metrics.totalDistanceKm, 92.5);
  assert.equal(payload.statistics.inquiriesSummary.totalCount, 1);

  // Achievements
  assert.ok(payload.achievements.unlockedCount > 0);
  assert.equal(payload.achievements.allAchievements.length, achievementsSummary.totalCount);
  assert.equal(payload.achievements.unlockedBadges.length, achievementsSummary.unlockedCount);

  // Hike history
  assert.equal(payload.hikeHistory.totalEntries, 2);
  assert.equal(payload.hikeHistory.totalDistanceKm, 92.5);
  assert.equal(payload.hikeHistory.entries[0].id, 'hike-02'); // sorted newest first

  // Filenames & JSON round-trip with no secret keys
  const fileName = buildAccountBackupFileName(payload, 'full');
  assert.match(fileName, /^rca-vostok-backup-.+-full-2026-11-23\.json$/);

  const rawJson = serializeAccountBackupJson(payload, 'full', { pretty: true });
  assert.ok(!rawJson.includes('passwordHash'));
  const parsed = JSON.parse(rawJson) as typeof payload;
  assert.equal(parsed.hikeHistory.entries.length, 2);

  // Scoped selection
  const achOnly = selectAccountBackupScope(payload, 'achievements');
  assert.ok('achievements' in achOnly);
  assert.equal('hikeHistory' in achOnly, false);
});
