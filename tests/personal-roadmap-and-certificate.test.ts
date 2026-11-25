import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { SessionUser } from '../src/utils/identityApi.ts';
import type { UserAttestationSummary } from '../src/components/AttestationProgressWidget.tsx';
import {
  OFFICIAL_EXAM_OPTIONS,
  buildPersonalRoadmap,
} from '../src/utils/personalRoadmap.ts';
import { buildCandidateCertificateData } from '../src/utils/candidateCertificatePdf.ts';

function makeSummary(percent: number, completedTaskIds: string[]): UserAttestationSummary {
  const stageIds = [
    { id: 'application' as const, stepNumber: '01', title: 'Подача заявки' },
    { id: 'training' as const, stepNumber: '02', title: 'Обучение' },
    { id: 'exam' as const, stepNumber: '03', title: 'Экзамен' },
    { id: 'certificate' as const, stepNumber: '04', title: 'Получение свидетельства' },
  ];

  const resolved = new Set<string>(completedTaskIds);
  const stages = stageIds.map((st, idx) => ({
    stage: {
      id: st.id,
      stepNumber: st.stepNumber,
      title: st.title,
      shortTitle: st.title,
      durationHint: '1–3 дня',
      summary: '',
      outputLabel: '',
      icon: (() => null) as unknown as UserAttestationSummary['activeStage']['icon'],
      tasks: [],
    },
    completedCount: idx === 0 ? 3 : 0,
    totalCount: 3,
    percent: idx === 0 ? 100 : 0,
    status: (idx === 0 ? 'completed' : 'pending') as 'completed' | 'pending',
  }));

  return {
    percent,
    completedTasks: completedTaskIds.length,
    totalTasks: 12,
    completedStages: percent === 100 ? 4 : 1,
    activeStage: stages[1].stage,
    stages,
    resolvedCompletedSet: resolved,
    autoTaskSet: new Set<string>(),
  };
}

const SAMPLE_USER: SessionUser = {
  id: 'user-test-42',
  email: 'guide@example.ru',
  fullName: 'Петров Алексей Сергеевич',
  role: 'candidate',
  region: 'Приморский край',
  organisation: 'Турклуб «Сихотэ»',
  isActive: true,
  permissions: [],
  createdAt: '2026-10-01T00:00:00Z',
  lastLoginAt: null,
};

test('buildPersonalRoadmap: schedules 6 milestones backward from selected exam date', () => {
  const examDate = OFFICIAL_EXAM_OPTIONS[0].startIso; // 2027-04-16
  const summary = makeSummary(25, ['app_profile', 'app_inquiry', 'app_docs']);
  const plan = buildPersonalRoadmap(examDate, 'contour_b', summary, '2026-11-22');

  assert.equal(plan.milestones.length, 6);
  assert.equal(plan.isCompressedSchedule, false);
  assert.equal(plan.milestones[0].targetDateIso, '2027-03-02'); // -45 days
  assert.equal(plan.milestones[4].targetDateIso, examDate); // exam day
  assert.equal(plan.milestones[5].targetDateIso, '2027-04-21'); // +5 days
  assert.equal(plan.milestones[0].status, 'completed');
  assert.equal(plan.milestones[1].status, 'completed');
  assert.equal(plan.milestones[2].status, 'active');
});

test('buildPersonalRoadmap: flags compressed schedule when exam is closer than recommended lead time', () => {
  const summary = makeSummary(8, ['app_profile']);
  const plan = buildPersonalRoadmap('2026-12-05', 'contour_b', summary, '2026-11-22');

  assert.equal(plan.isCompressedSchedule, true);
  assert.equal(plan.daysUntilExam, 13);
  assert.equal(plan.milestones[1].status, 'overdue');
});

test('buildCandidateCertificateData: mirrors live progress bar metrics and exam date', () => {
  const summary = makeSummary(58, ['app_profile', 'app_inquiry', 'app_docs', 'trn_track']);
  const data = buildCandidateCertificateData(
    SAMPLE_USER,
    summary,
    [
      {
        id: 'inq-1',
        fullName: SAMPLE_USER.fullName,
        email: SAMPLE_USER.email,
        contactChannel: '@guide_primorye',
        region: SAMPLE_USER.region,
        track: 'Пешеходный туризм',
        experienceNote: '3 похода 2 КС в Приморском крае',
        consentAccepted: true,
        userId: SAMPLE_USER.id,
        status: 'in_review',
        createdAt: '2026-11-01T10:00:00Z',
      },
    ],
    '2027-04-16',
    new Date('2026-11-22T12:00:00Z')
  );

  assert.equal(data.overallPercent, 58);
  assert.equal(data.completedTasks, 4);
  assert.equal(data.totalTasks, 12);
  assert.equal(data.candidateName, 'Петров Алексей Сергеевич');
  assert.equal(data.trackLabel, 'Пешеходный туризм');
  assert.match(data.docNumber, /^РЦА-2026\/СК-/);
  assert.equal(data.examDateLabel, '16 апреля 2027');
  assert.equal(data.stages.length, 4);
});
