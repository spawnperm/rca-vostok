import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { ExperienceLogEntry } from '../src/domain/experience/ExperienceEntry.ts';
import type { SessionUser } from '../src/utils/identityApi.ts';
import {
  SELF_CHECK_QUESTIONS,
  evaluateSelfCheck,
  type QualificationAnswerLevel,
} from '../src/utils/qualificationSelfCheck.ts';
import { buildUserProfileCommissionDossierData } from '../src/utils/userProfileCommissionPdf.ts';

function makeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'usr-pdf-1',
    email: 'ivan.guide@vostok.ru',
    fullName: 'Иван Петрович Таёжный',
    region: 'Камчатский край',
    organisation: 'Турклуб «Авача»',
    phone: '+7 (914) 555-01-22',
    telegram: '@ivan_taiga',
    avatarUrl: '/src/assets/images/guide_portrait_kamchatka_1795488166702.jpg',
    role: 'instructor',
    permissions: ['profile:view_own', 'profile:edit_own'],
    isActive: true,
    attestationExpiresAt: '2028-06-15',
    createdAt: '2026-01-10T10:00:00.000Z',
    lastLoginAt: '2026-11-20T08:00:00.000Z',
    ...overrides,
  };
}

function makeEntries(count: number): ExperienceLogEntry[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `exp-${idx + 1}`,
    date: `2026-0${Math.min(9, idx + 1)}-12`,
    routeTitle: `Экспедиционный маршрут № ${idx + 1}`,
    regionId: 'kamchatka',
    regionName: 'Камчатский край',
    complexity: idx % 2 === 0 ? '3 КС' : '4 КС',
    participantsCount: 8 + idx,
    distanceKm: 65 + idx * 10,
    notes: 'Успешное прохождение маршрута без происшествий',
    createdAt: '2026-09-12T10:00:00.000Z',
  }));
}

test('buildUserProfileCommissionDossierData formats dossier number, verification code, contacts, and journal summary', () => {
  const user = makeUser();
  const entries = makeEntries(7);
  const confirmedAnswers = Object.fromEntries(
    SELF_CHECK_QUESTIONS.map((q) => [q.id, 'confirmed' as QualificationAnswerLevel])
  );
  const selfCheck = evaluateSelfCheck(confirmedAnswers, 'expedition');

  const data = buildUserProfileCommissionDossierData({
    user,
    qualification: {
      level: 'advanced',
      label: 'Инструктор-проводник (экспедиционный уровень)',
      shortLabel: 'Экспедиционный',
      complexityRange: '3–5 КС',
      description: 'Допуск к руководству сложными маршрутами ДФО.',
      reasons: ['Зафиксированы маршруты 4 КС', 'Самопроверка пройдена на 100%'],
    },
    attestationPercent: 88.6,
    selfCheck,
    journalEntries: entries,
    now: new Date('2026-11-23T12:00:00.000Z'),
  });

  assert.match(data.dossierNumber, /^АНК-РЦА-2026-\d{5}$/);
  assert.match(data.verificationCode, /^PROF-[A-Z0-9]{6}$/);
  assert.equal(data.issuedAtIso, '2026-11-23');
  assert.equal(data.fullName, user.fullName);
  assert.equal(data.phone, '+7 (914) 555-01-22');
  assert.equal(data.telegram, '@ivan_taiga');
  assert.equal(data.organisation, 'Турклуб «Авача»');
  assert.equal(data.avatarUrl, user.avatarUrl);
  assert.equal(data.attestationPercent, 89);
  assert.equal(data.selfCheckReadinessPercent, 100);
  assert.equal(data.selfCheckTrackLabel, 'Горный / экспедиционный туризм');
  assert.equal(data.tripsCount, 7);
  assert.equal(data.recentTrips.length, 5);
  assert.equal(data.maxComplexity, '4 КС');
});

test('buildUserProfileCommissionDossierData applies fallbacks when optional profile fields are blank', () => {
  const user = makeUser({
    phone: '',
    telegram: '   ',
    organisation: '',
    avatarUrl: '',
    attestationExpiresAt: null,
  });

  const data = buildUserProfileCommissionDossierData({
    user,
    qualification: {
      level: 'novice',
      label: 'Начинающий проводник',
      shortLabel: 'Начинающий',
      complexityRange: '1–2 КС',
      description: 'Базовый уровень подготовки.',
      reasons: ['Первичная регистрация в РЦА'],
    },
    attestationPercent: 120,
    selfCheck: null,
    journalEntries: [],
    now: new Date('2026-11-23T12:00:00.000Z'),
  });

  assert.equal(data.phone, 'Не указан');
  assert.equal(data.telegram, 'Не указан');
  assert.equal(data.organisation, 'Не указана');
  assert.equal(data.attestationExpiresFormatted, 'Первичная подача / не задан');
  assert.equal(data.selfCheckTrackLabel, 'Не выбран');
  assert.equal(data.selfCheckReadinessPercent, 0);
  assert.equal(data.attestationPercent, 100);
  assert.equal(data.tripsCount, 0);
  assert.deepEqual(data.recentTrips, []);
  assert.equal(data.avatarUrl, '');
});
