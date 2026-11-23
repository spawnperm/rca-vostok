import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDefaultResumeDraft,
  buildInstructorResumeModel,
  RESUME_SPECIALIZATIONS,
} from '../src/utils/instructorResumePdf.ts';
import type { UserAttestationSummary } from '../src/components/AttestationProgressWidget.tsx';
import type { InquiryRecord } from '../src/components/social/MyInquiriesSection.tsx';
import type { SessionUser } from '../src/utils/identityApi.ts';
import { SELF_CHECK_QUESTIONS } from '../src/utils/qualificationSelfCheck.ts';

type StageDef = UserAttestationSummary['stages'][number]['stage'];

function makeStageDef(
  id: StageDef['id'],
  stepNumber: string,
  title: string
): StageDef {
  return {
    id,
    stepNumber,
    title,
    shortTitle: title,
    durationHint: '1–3 рабочих дня',
    summary: title,
    outputLabel: title,
    icon: (() => null) as unknown as StageDef['icon'],
    tasks: [],
  };
}

test('buildDefaultResumeDraft provides clean guest defaults when user is null', () => {
  const draft = buildDefaultResumeDraft({
    user: null,
    selectedContour: 'contour_b',
  });

  assert.equal(draft.fullName, 'Соколов Алексей Владимирович');
  assert.equal(draft.region, 'Приморский край');
  assert.equal(draft.contour, 'contour_b');
  assert.equal(draft.attestationPercent, 0);
  assert.ok(draft.achievements.length >= 1);
  assert.ok(draft.competencies.length >= 2);
});

test('buildDefaultResumeDraft aggregates profile, completed attestation stages, approved inquiries, and self-check skills', () => {
  const mockUser: SessionUser = {
    id: 'user-42',
    email: 'orlov@kamchatka.ru',
    fullName: 'Орлов Дмитрий Сергеевич',
    role: 'instructor',
    region: 'Камчатский край',
    organisation: 'Клуб «Вулканы ДФО»',
    permissions: ['inquiries:view_own'],
    isActive: true,
    createdAt: '2026-01-10T00:00:00Z',
    lastLoginAt: null,
  };

  const stageDefs: StageDef[] = [
    makeStageDef('application', '01', 'Подача заявки'),
    makeStageDef('training', '02', 'Обучение'),
    makeStageDef('exam', '03', 'Аттестационный экзамен'),
    makeStageDef('certificate', '04', 'Выдача удостоверения и ЕФРТА'),
  ];

  const mockSummary: UserAttestationSummary = {
    percent: 100,
    completedTasks: 12,
    totalTasks: 12,
    completedStages: stageDefs.length,
    activeStage: stageDefs[stageDefs.length - 1],
    stages: stageDefs.map((stage) => ({
      stage,
      completedCount: 3,
      totalCount: 3,
      percent: 100,
      status: 'completed' as const,
    })),
    resolvedCompletedSet: new Set<string>(),
    autoTaskSet: new Set<string>(),
  };

  const mockInquiries: InquiryRecord[] = [
    {
      id: 'inq-101',
      fullName: 'Орлов Дмитрий Сергеевич',
      email: 'orlov@kamchatka.ru',
      contactChannel: '+79990001122',
      region: 'Камчатский край',
      track: 'Водный туризм',
      experienceNote: 'Сопровождение экспедиций на р. Быстрая.',
      consentAccepted: true,
      userId: 'user-42',
      status: 'approved',
      createdAt: '2026-02-01T10:00:00Z',
    },
  ];

  const firstQuestion = SELF_CHECK_QUESTIONS[0];

  const draft = buildDefaultResumeDraft({
    user: mockUser,
    summary: mockSummary,
    inquiries: mockInquiries,
    selectedContour: 'contour_a',
    passportExtrasOverride: {
      yearsOfExperience: 6,
      completedRoutesCount: 28,
      maxRouteCategory: '3 КС',
      tenureSummary: 'Лидер горных и водных групп на Камчатке.',
      customSkills: ['WFA первой помощи', 'Навигация ГЛОНАСС/GPS'],
    },
    diagnosticsPercentOverride: 88,
    selfCheckOverride: {
      track: 'water',
      answers: {
        [firstQuestion.id]: 'confirmed',
      },
      updatedAt: '2026-03-01T00:00:00Z',
    },
  });

  assert.equal(draft.fullName, 'Орлов Дмитрий Сергеевич');
  assert.equal(draft.region, 'Камчатский край');
  assert.equal(draft.organisation, 'Клуб «Вулканы ДФО»');
  assert.equal(draft.specialization, RESUME_SPECIALIZATIONS[1]);
  assert.equal(draft.yearsOfExperience, 6);
  assert.equal(draft.completedRoutesCount, 28);
  assert.equal(draft.maxCategory, '3 КС');
  assert.equal(draft.attestationPercent, 100);
  assert.equal(draft.completedStagesCount, stageDefs.length);
  assert.equal(draft.diagnosticsPercent, 88);

  assert.ok(draft.achievements.some((a) => a.title.includes('все 4 этапа')));
  assert.ok(draft.achievements.some((a) => a.title.includes('Зачтён этап 01')));
  assert.ok(draft.achievements.some((a) => a.title.includes('Допуск комиссии')));
  assert.ok(draft.achievements.some((a) => a.title.includes('самодиагностика')));
  assert.ok(draft.achievements.some((a) => a.title.includes('28 маршрутах')));

  assert.ok(draft.competencies.includes('WFA первой помощи'));
  assert.ok(draft.competencies.includes('Навигация ГЛОНАСС/GPS'));
  assert.ok(draft.competencies.includes(firstQuestion.title));
});

test('buildInstructorResumeModel formats resumeId, normalizes fields, and deduplicates competencies', () => {
  const fixedNow = new Date('2026-11-23T12:00:00Z');
  const draft = buildDefaultResumeDraft({ user: null });
  const model = buildInstructorResumeModel(
    {
      ...draft,
      fullName: '  Кузнецова Елена Андреевна  ',
      competencies: ['WFA', '  WFA  ', 'Навигация', ''],
      achievements: [
        { id: '1', title: '  Пройдена аттестация  ', meta: '' },
        { id: '2', title: '   ', meta: 'Пустой' },
      ],
    },
    fixedNow
  );

  assert.equal(model.fullName, 'Кузнецова Елена Андреевна');
  assert.equal(model.issuedAtIso, '2026-11-23');
  assert.match(model.resumeId, /^РЦА-РЗ-2026-1123-\d{4}$/);
  assert.deepEqual(model.competencies, ['WFA', 'Навигация']);
  assert.equal(model.achievements.length, 1);
  assert.equal(model.achievements[0].title, 'Пройдена аттестация');
  assert.equal(model.achievements[0].meta, 'Приморский край');
});
