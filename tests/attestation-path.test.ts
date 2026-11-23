import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTESTATION_PATH_STAGES,
  buildAttestationPathViewModel,
  buildPreviewAttestationSummary,
  classifyDeadlineUrgency,
  formatDaysRu,
  type AttestationInquiryInput,
  type AttestationSummaryInput,
  type AttestationSummaryStageInput,
} from '../src/utils/attestationPath.ts';

function createSummaryFromCompletedIds(completedIds: string[]): AttestationSummaryInput {
  const completedSet = new Set(completedIds);
  const stages: AttestationSummaryStageInput[] = ATTESTATION_PATH_STAGES.map((stage) => {
    const totalCount = stage.tasks.length;
    const completedCount = stage.tasks.filter((t) => completedSet.has(t.id)).length;
    const percent = Math.round((completedCount / totalCount) * 100);
    const status: 'completed' | 'in_progress' | 'pending' =
      completedCount === totalCount
        ? 'completed'
        : completedCount > 0
        ? 'in_progress'
        : 'pending';
    return {
      stage,
      completedCount,
      totalCount,
      percent,
      status,
    };
  });

  const totalTasks = ATTESTATION_PATH_STAGES.reduce((acc, s) => acc + s.tasks.length, 0);
  const completedTasks = completedSet.size;
  const percent = Math.round((completedTasks / totalTasks) * 100);
  const completedStages = stages.filter((s) => s.status === 'completed').length;
  const activeStage =
    stages.find((s) => s.status !== 'completed')?.stage ??
    ATTESTATION_PATH_STAGES[ATTESTATION_PATH_STAGES.length - 1];

  return {
    percent,
    completedTasks,
    totalTasks,
    completedStages,
    activeStage,
    stages,
    resolvedCompletedSet: completedSet,
  };
}

describe('Attestation Path View Model («Путь аттестации»)', () => {
  it('highlights stage 01 as current for a brand new candidate without inquiries', () => {
    const summary = createSummaryFromCompletedIds([]);
    const model = buildAttestationPathViewModel(summary, [], {
      todayIso: '2026-11-23',
      examDateIso: '2027-04-16',
      contour: 'contour_b',
    });

    assert.equal(model.isAllCompleted, false);
    assert.equal(model.currentStageId, 'application');
    assert.equal(model.currentStepIndex, 0);
    assert.equal(model.trackProgressPercent, 0);
    assert.equal(model.latestInquirySummary, null);

    assert.deepEqual(
      model.steps.map((s) => s.stepState),
      ['current', 'upcoming', 'upcoming', 'upcoming']
    );
    assert.equal(model.steps[0].stateLabel, 'Текущий этап');
    assert.equal(model.steps[0].primaryAction.kind, 'open_application');

    // Stage 01 contour_b deadline: 2027-04-16 - 38 days = 2027-03-09 (106 days from 2026-11-23)
    assert.equal(model.steps[0].deadline.deadlineIso, '2027-03-09');
    assert.equal(model.steps[0].deadline.daysRemaining, 106);
    assert.equal(model.steps[0].deadline.urgency, 'on_track');
    assert.equal(model.nextStageTimer.targetDateIso, '2027-03-09');
    assert.equal(model.nextStageTimer.urgency, 'on_track');
    assert.equal(model.nextStageTimer.countdownText, 'Осталось 106 дней');
  });

  it('highlights stage 02 as current in-progress when application is completed and inquiry is in_review', () => {
    const summary = createSummaryFromCompletedIds([
      'app_profile',
      'app_inquiry',
      'app_docs',
      'trn_track',
    ]);
    const inquiries: AttestationInquiryInput[] = [
      {
        id: 'inq-101',
        track: 'Пешеходный туризм',
        status: 'in_review',
        createdAt: '2026-04-02T10:00:00.000Z',
      },
    ];

    const model = buildAttestationPathViewModel(summary, inquiries, {
      todayIso: '2027-04-05',
      examDateIso: '2027-04-16',
      contour: 'contour_b',
    });

    assert.equal(model.currentStageId, 'training');
    assert.equal(model.currentStepIndex, 1);
    assert.equal(model.completedStages, 1);
    assert.ok(model.trackProgressPercent > 30 && model.trackProgressPercent < 67);
    assert.deepEqual(
      model.steps.map((s) => s.stepState),
      ['completed', 'current', 'upcoming', 'upcoming']
    );
    assert.equal(model.steps[0].stateLabel, 'Завершён');
    assert.equal(model.steps[0].deadline.urgency, 'completed');
    assert.equal(model.steps[1].stateLabel, 'Текущий · в работе');
    assert.equal(model.steps[1].primaryAction.kind, 'open_checklist');
    assert.deepEqual(model.latestInquirySummary, {
      track: 'Пешеходный туризм',
      status: 'in_review',
      statusLabel: 'На рассмотрении',
    });

    // Stage 02 deadline = 2027-04-09 -> 4 days left from 2027-04-05 => urgent!
    assert.equal(model.steps[1].deadline.deadlineIso, '2027-04-09');
    assert.equal(model.steps[1].deadline.daysRemaining, 4);
    assert.equal(model.steps[1].deadline.urgency, 'urgent');
    assert.equal(model.nextStageTimer.urgency, 'urgent');
    assert.equal(model.nextStageTimer.countdownText, 'Осталось 4 дня');
  });

  it('flags overdue deadlines when today passes the regulatory cutoff for incomplete stages', () => {
    const summary = createSummaryFromCompletedIds(['app_profile']);
    // examDate = 2027-04-16, contour_b application cutoff = 2027-03-09.
    // On 2027-03-14, Stage 01 is overdue by 5 days.
    const model = buildAttestationPathViewModel(summary, [], {
      todayIso: '2027-03-14',
      examDateIso: '2027-04-16',
      contour: 'contour_b',
    });

    assert.equal(model.steps[0].deadline.urgency, 'overdue');
    assert.equal(model.steps[0].deadline.daysRemaining, -5);
    assert.equal(model.steps[0].deadline.countdownLabel, 'Просрочен на 5 дней');
    assert.equal(model.nextStageTimer.urgency, 'overdue');
    assert.equal(model.nextStageTimer.countdownText, 'Просрочен на 5 дней');
    assert.equal(model.nextStageTimer.overdueStepsCount, 1);

    // Same date under contour_a (21 days before exam = 2027-03-26) has 12 days left => 'soon'
    const contourAModel = buildAttestationPathViewModel(summary, [], {
      todayIso: '2027-03-14',
      examDateIso: '2027-04-16',
      contour: 'contour_a',
    });

    assert.equal(contourAModel.steps[0].deadline.deadlineIso, '2027-03-26');
    assert.equal(contourAModel.steps[0].deadline.daysRemaining, 12);
    assert.equal(contourAModel.steps[0].deadline.urgency, 'soon');
    assert.equal(contourAModel.nextStageTimer.urgency, 'soon');
  });

  it('highlights exam stage even with 0/3 exam tasks done once application and training finish', () => {
    const summary = createSummaryFromCompletedIds([
      'app_profile',
      'app_inquiry',
      'app_docs',
      'trn_track',
      'trn_modules',
      'trn_passport',
    ]);

    const model = buildAttestationPathViewModel(summary, [], {
      todayIso: '2027-04-16',
      examDateIso: '2027-04-16',
      contour: 'contour_b',
    });

    assert.equal(model.currentStageId, 'exam');
    assert.equal(model.currentStepIndex, 2);
    assert.deepEqual(
      model.steps.map((s) => s.stepState),
      ['completed', 'completed', 'current', 'upcoming']
    );
    assert.equal(model.steps[2].stateLabel, 'Текущий этап');
    assert.equal(model.steps[2].primaryAction.kind, 'open_roadmap');
    assert.equal(model.steps[2].deadline.daysRemaining, 0);
    assert.equal(model.steps[2].deadline.urgency, 'urgent');
    assert.equal(model.nextStageTimer.countdownText, 'Дедлайн сегодня');
  });

  it('marks all 4 steps completed and track at 100% when all tasks finish', () => {
    const allIds = ATTESTATION_PATH_STAGES.flatMap((s) => s.tasks.map((t) => t.id));
    const summary = createSummaryFromCompletedIds(allIds);
    const model = buildAttestationPathViewModel(summary, [], {
      todayIso: '2027-05-01',
      examDateIso: '2027-04-16',
      contour: 'contour_b',
    });

    assert.equal(model.isAllCompleted, true);
    assert.equal(model.overallPercent, 100);
    assert.equal(model.trackProgressPercent, 100);
    assert.deepEqual(
      model.steps.map((s) => s.stepState),
      ['completed', 'completed', 'completed', 'completed']
    );
    assert.equal(model.nextStageTimer.urgency, 'completed');
    assert.equal(model.nextStageTimer.overdueStepsCount, 0);
    assert.equal(model.steps[3].primaryAction.kind, 'open_passport');
  });

  it('provides a coherent preview attestation path and formats Russian day plurals accurately', () => {
    const previewSummary = buildPreviewAttestationSummary();
    const model = buildAttestationPathViewModel(previewSummary, []);

    assert.equal(model.steps.length, 4);
    assert.equal(model.currentStageId, 'application');
    assert.equal(model.steps[0].isCurrent, true);
    assert.equal(model.steps[0].completedCount, 1);

    assert.equal(formatDaysRu(1), '1 день');
    assert.equal(formatDaysRu(2), '2 дня');
    assert.equal(formatDaysRu(5), '5 дней');
    assert.equal(formatDaysRu(11), '11 дней');
    assert.equal(formatDaysRu(21), '21 день');

    assert.equal(classifyDeadlineUrgency(-1, false), 'overdue');
    assert.equal(classifyDeadlineUrgency(0, false), 'urgent');
    assert.equal(classifyDeadlineUrgency(7, false), 'urgent');
    assert.equal(classifyDeadlineUrgency(8, false), 'soon');
    assert.equal(classifyDeadlineUrgency(21, false), 'soon');
    assert.equal(classifyDeadlineUrgency(22, false), 'on_track');
    assert.equal(classifyDeadlineUrgency(-10, true), 'completed');
  });
});
