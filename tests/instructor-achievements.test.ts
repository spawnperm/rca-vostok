import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateInstructorAchievements,
  type AchievementEvaluationInput,
} from '../src/domain/experience/InstructorAchievementsService.ts';
import type { ExperienceLogEntry } from '../src/domain/experience/ExperienceEntry.ts';

function makeEntry(overrides: Partial<ExperienceLogEntry> = {}): ExperienceLogEntry {
  return {
    id: 'exp-1',
    date: '2026-09-10',
    routeTitle: 'Ливадийский хребет',
    regionId: 'primorye',
    regionName: 'Приморский край',
    complexity: '1 КС',
    participantsCount: 8,
    distanceKm: 20,
    notes: 'Учебный выход',
    createdAt: '2026-09-10T10:00:00Z',
    ...overrides,
  };
}

function makeBaseInput(
  overrides: Partial<AchievementEvaluationInput> = {}
): AchievementEvaluationInput {
  return {
    entries: [],
    role: 'candidate',
    attestationPercent: 17,
    completedStagesCount: 0,
    fullName: 'Петров Алексей',
    region: 'Приморский край',
    organisation: '',
    hasAttestationExpiry: false,
    inquiries: [],
    selfCheckConfirmedCount: 0,
    diagnosticsPercent: null,
    diagnosticsComplete: false,
    linkedAccountsCount: 0,
    ...overrides,
  };
}

test('evaluateInstructorAchievements unlocks "100 км походов" at >= 100 km and tracks partial progress below 100 km', () => {
  const below = evaluateInstructorAchievements(
    makeBaseInput({
      entries: [
        makeEntry({ id: 'e1', distanceKm: 42.5 }),
        makeEntry({ id: 'e2', distanceKm: 32.5 }),
      ],
    })
  );
  const badgeBelow = below.achievements.find((a) => a.id === 'hundred_km_trails');
  assert.ok(badgeBelow);
  assert.equal(badgeBelow.title, '100 км походов');
  assert.equal(badgeBelow.unlocked, false);
  assert.equal(badgeBelow.progressPercent, 75);
  assert.equal(badgeBelow.progressText, '75.0 / 100 км');

  const reached = evaluateInstructorAchievements(
    makeBaseInput({
      entries: [
        makeEntry({ id: 'e1', distanceKm: 42.5 }),
        makeEntry({ id: 'e2', distanceKm: 58.0 }),
      ],
    })
  );
  const badgeReached = reached.achievements.find((a) => a.id === 'hundred_km_trails');
  assert.ok(badgeReached);
  assert.equal(badgeReached.unlocked, true);
  assert.equal(badgeReached.progressPercent, 100);
  assert.match(badgeReached.unlockedReason ?? '', /100\.5 км/);
});

test('evaluateInstructorAchievements unlocks "Первая категория аттестации" via >= 50% stages, approved inquiry, or instructor role', () => {
  const locked = evaluateInstructorAchievements(
    makeBaseInput({
      role: 'candidate',
      attestationPercent: 25,
      completedStagesCount: 1,
      inquiries: [{ status: 'in_review' }],
    })
  );
  const lockedBadge = locked.achievements.find((a) => a.id === 'first_category_attestation');
  assert.ok(lockedBadge);
  assert.equal(lockedBadge.unlocked, false);
  assert.equal(lockedBadge.progressPercent, 50);

  const byStages = evaluateInstructorAchievements(
    makeBaseInput({ attestationPercent: 50, completedStagesCount: 2 })
  );
  assert.equal(
    byStages.achievements.find((a) => a.id === 'first_category_attestation')?.unlocked,
    true
  );

  const byApproval = evaluateInstructorAchievements(
    makeBaseInput({
      attestationPercent: 33,
      inquiries: [{ status: 'approved' }],
    })
  );
  assert.equal(
    byApproval.achievements.find((a) => a.id === 'first_category_attestation')?.unlocked,
    true
  );

  const byRole = evaluateInstructorAchievements(
    makeBaseInput({ role: 'instructor', attestationPercent: 100 })
  );
  assert.equal(
    byRole.achievements.find((a) => a.id === 'first_category_attestation')?.unlocked,
    true
  );
  assert.equal(
    byRole.achievements.find((a) => a.id === 'certified_guide_rca')?.unlocked,
    true
  );
});

test('evaluateInstructorAchievements detects GPX import, multi-region DFO coverage, 3+ KS complexity, and 250 km marathon', () => {
  const res = evaluateInstructorAchievements(
    makeBaseInput({
      entries: [
        makeEntry({
          id: 'e1',
          regionId: 'primorye',
          complexity: '2 КС',
          participantsCount: 10,
          distanceKm: 90,
          notes: 'Импорт GPX-трека · Набор высоты: 840 м',
        }),
        makeEntry({
          id: 'e2',
          regionId: 'kamchatka',
          complexity: '3 КС',
          participantsCount: 8,
          distanceKm: 110,
        }),
        makeEntry({
          id: 'e3',
          regionId: 'sakhalin',
          complexity: '1 КС',
          participantsCount: 14,
          distanceKm: 60,
        }),
        makeEntry({ id: 'e4', regionId: 'primorye', participantsCount: 5, distanceKm: 10 }),
        makeEntry({ id: 'e5', regionId: 'primorye', participantsCount: 5, distanceKm: 10 }),
      ],
    })
  );

  assert.equal(res.achievements.find((a) => a.id === 'gpx_navigator')?.unlocked, true);
  assert.equal(res.achievements.find((a) => a.id === 'three_dfo_regions')?.unlocked, true);
  assert.equal(res.achievements.find((a) => a.id === 'mountain_leader_3ks')?.unlocked, true);
  assert.equal(res.achievements.find((a) => a.id === 'expedition_commander')?.unlocked, true);
  assert.equal(res.achievements.find((a) => a.id === 'marathonec_250_km')?.unlocked, true);

  // Featured badges should sort gold before silver before bronze
  assert.equal(res.featuredBadges[0]?.tier, 'gold');
});

test('evaluateInstructorAchievements validates profile completeness and safety expertise', () => {
  const res = evaluateInstructorAchievements(
    makeBaseInput({
      fullName: 'Соколова Анна',
      region: 'Камчатский край',
      organisation: 'Клуб «Вулкан»',
      hasAttestationExpiry: true,
      selfCheckConfirmedCount: 5,
      diagnosticsPercent: 60,
      diagnosticsComplete: true,
    })
  );

  assert.equal(res.achievements.find((a) => a.id === 'verified_profile')?.unlocked, true);
  assert.equal(res.achievements.find((a) => a.id === 'safety_diagnostician')?.unlocked, true);
  assert.ok(res.nextClosestAchievement !== null);
});
