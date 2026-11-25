import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { SessionUser } from '../src/utils/identityApi.ts';
import type { UserAttestationSummary } from '../src/components/AttestationProgressWidget.tsx';
import {
  buildInstructorDigitalPassport,
  buildInstructorPassportJsonString,
} from '../src/utils/instructorPassportExport.ts';

function makeSummary(completedStageIndexCount: number): UserAttestationSummary {
  const stageDefs = [
    { id: 'application' as const, stepNumber: '01', title: 'Подача заявки' },
    { id: 'training' as const, stepNumber: '02', title: 'Обучение' },
    { id: 'exam' as const, stepNumber: '03', title: 'Экзамен' },
    { id: 'certificate' as const, stepNumber: '04', title: 'Получение свидетельства' },
  ];

  const stages = stageDefs.map((st, idx) => {
    const done = idx < completedStageIndexCount;
    return {
      stage: {
        id: st.id,
        stepNumber: st.stepNumber,
        title: st.title,
        shortTitle: st.title,
        durationHint: '2 дня',
        summary: '',
        outputLabel: '',
        icon: (() => null) as unknown as UserAttestationSummary['activeStage']['icon'],
        tasks: [],
      },
      completedCount: done ? 3 : 0,
      totalCount: 3,
      percent: done ? 100 : 0,
      status: (done ? 'completed' : 'pending') as 'completed' | 'pending',
    };
  });

  const percent = Math.round((completedStageIndexCount / 4) * 100);
  return {
    percent,
    completedTasks: completedStageIndexCount * 3,
    totalTasks: 12,
    completedStages: completedStageIndexCount,
    activeStage: stages[Math.min(completedStageIndexCount, 3)].stage,
    stages,
    resolvedCompletedSet: new Set<string>(),
    autoTaskSet: new Set<string>(),
  };
}

const USER: SessionUser = {
  id: 'usr-passport-99',
  email: 'instructor@vostok.ru',
  fullName: 'Соколов Дмитрий Андреевич',
  role: 'instructor',
  region: 'Приморский край',
  organisation: 'Клуб «Сихотэ-Алинь»',
  isActive: true,
  permissions: [],
  createdAt: '2026-09-10T00:00:00Z',
  lastLoginAt: null,
};

test('buildInstructorDigitalPassport aggregates confirmed skills, passed attestations, and tenure into JSON', () => {
  const passport = buildInstructorDigitalPassport({
    user: USER,
    summary: makeSummary(4),
    inquiries: [
      {
        id: 'inq-99',
        fullName: USER.fullName,
        email: USER.email,
        contactChannel: '@dmitry_sokolov',
        region: 'Приморский край',
        track: 'Водный туризм и сплавы',
        experienceNote: '8 лет руководства сплавами 2–4 КС на реках Приморья',
        consentAccepted: true,
        userId: USER.id,
        status: 'approved',
        createdAt: '2026-10-05T08:00:00Z',
      },
    ],
    extras: {
      yearsOfExperience: 8,
      completedRoutesCount: 24,
      maxRouteCategory: '4 КС',
      tenureSummary: '8 лет руководства сплавами и горно-таёжными турами',
      customSkills: ['Wilderness First Aid (WFA)', 'Garmin inReach'],
    },
    selfCheckOverride: {
      track: 'water',
      answers: {
        'sc-wilderness-first-aid': 'confirmed',
        'sc-route-passport': 'confirmed',
        'sc-topography-navigation': 'in_progress',
      },
      updatedAt: '2026-11-20T10:00:00Z',
    },
    now: new Date('2026-11-22T12:00:00Z'),
  });

  assert.equal(passport.schemaVersion, 'rca-vostok.digital-passport.v1');
  assert.match(passport.passportId, /^РЦА-2026\/ПИ-/);
  assert.equal(passport.profile.fullName, 'Соколов Дмитрий Андреевич');
  assert.equal(passport.profile.trackLabel, 'Водный туризм и сплавы');
  assert.equal(passport.experience.yearsOfExperience, 8);
  assert.equal(passport.experience.completedRoutesCount, 24);
  assert.equal(passport.experience.maxRouteCategory, '4 КС');
  assert.equal(passport.attestations.overallProgressPercent, 100);
  assert.equal(passport.attestations.completedStagesCount, 4);
  assert.ok(
    passport.confirmedSkills.some((s) => s.title === 'Wilderness First Aid (WFA)' && s.status === 'confirmed')
  );
  assert.ok(
    passport.confirmedSkills.some((s) => s.source === 'attestation' && s.status === 'confirmed')
  );

  const json = buildInstructorPassportJsonString(passport);
  const parsed = JSON.parse(json) as typeof passport;
  assert.equal(parsed.experience.yearsOfExperience, 8);
  assert.equal(parsed.attestations.inquiries.length, 1);
});
