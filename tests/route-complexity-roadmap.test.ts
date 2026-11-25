import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  ROUTE_COMPLEXITY_PRESETS,
  buildComplexityPreparationRoadmap,
  formatComplexityRoadmapText,
  inferComplexityFromDifficultyLabel,
} from '../src/utils/routeComplexityRoadmap.ts';

describe('routeComplexityRoadmap engine', () => {
  it('increases preparation duration and study hours monotonically across 1 КС -> 4+ КС', () => {
    const start = '2027-02-01';
    const plans = ROUTE_COMPLEXITY_PRESETS.map((preset) =>
      buildComplexityPreparationRoadmap({
        complexityId: preset.id,
        contour: 'contour_b',
        disciplineId: 'hiking',
        paceId: 'standard',
        startDateIso: start,
      })
    );

    for (let i = 1; i < plans.length; i++) {
      assert.ok(
        plans[i].prepDaysBeforeExam > plans[i - 1].prepDaysBeforeExam,
        `Expected ${plans[i].preset.id} prepDays (${plans[i].prepDaysBeforeExam}) > ${plans[i - 1].preset.id} (${plans[i - 1].prepDaysBeforeExam})`
      );
      assert.ok(
        plans[i].studyHoursTotal > plans[i - 1].studyHoursTotal,
        `Expected ${plans[i].preset.id} hours > ${plans[i - 1].preset.id}`
      );
    }
  });

  it('reduces preparation duration under Контур А (experience confirmation) compared to Контур Б (ДПО)', () => {
    for (const preset of ROUTE_COMPLEXITY_PRESETS) {
      const planB = buildComplexityPreparationRoadmap({
        complexityId: preset.id,
        contour: 'contour_b',
        disciplineId: 'hiking',
        paceId: 'standard',
        startDateIso: '2027-02-01',
      });
      const planA = buildComplexityPreparationRoadmap({
        complexityId: preset.id,
        contour: 'contour_a',
        disciplineId: 'hiking',
        paceId: 'standard',
        startDateIso: '2027-02-01',
      });

      assert.ok(
        planA.prepDaysBeforeExam < planB.prepDaysBeforeExam,
        `Expected Контур А faster than Контур Б for ${preset.id}`
      );
      assert.ok(planA.studyHoursTotal < planB.studyHoursTotal);
    }
  });

  it('scales durations according to study pace and discipline', () => {
    const intensive = buildComplexityPreparationRoadmap({
      complexityId: '2_ks',
      contour: 'contour_b',
      disciplineId: 'hiking',
      paceId: 'intensive',
      startDateIso: '2027-03-01',
    });
    const standard = buildComplexityPreparationRoadmap({
      complexityId: '2_ks',
      contour: 'contour_b',
      disciplineId: 'hiking',
      paceId: 'standard',
      startDateIso: '2027-03-01',
    });
    const relaxed = buildComplexityPreparationRoadmap({
      complexityId: '2_ks',
      contour: 'contour_b',
      disciplineId: 'hiking',
      paceId: 'relaxed',
      startDateIso: '2027-03-01',
    });
    const expedition = buildComplexityPreparationRoadmap({
      complexityId: '2_ks',
      contour: 'contour_b',
      disciplineId: 'expedition',
      paceId: 'standard',
      startDateIso: '2027-03-01',
    });

    assert.ok(intensive.prepDaysBeforeExam < standard.prepDaysBeforeExam);
    assert.ok(standard.prepDaysBeforeExam < relaxed.prepDaysBeforeExam);
    assert.ok(expedition.prepDaysBeforeExam > standard.prepDaysBeforeExam);
  });

  it('builds 6 contiguous timeline stages with valid ISO dates and Gantt bar percentages', () => {
    const plan = buildComplexityPreparationRoadmap({
      complexityId: '3_ks',
      contour: 'contour_b',
      disciplineId: 'water',
      paceId: 'standard',
      startDateIso: '2027-02-15',
    });

    assert.equal(plan.stages.length, 6);
    assert.equal(plan.stages[0].offsetStartDay, 0);

    let expectedCursor = 0;
    let totalPercent = 0;
    for (const stage of plan.stages) {
      assert.equal(stage.offsetStartDay, expectedCursor);
      assert.equal(stage.offsetEndDay, expectedCursor + stage.durationDays);
      assert.match(stage.startDateIso, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(stage.endDateIso, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(stage.startDateIso <= stage.endDateIso);
      assert.ok(stage.leftPercent >= 0 && stage.leftPercent < 100);
      assert.ok(stage.widthPercent > 0 && stage.leftPercent + stage.widthPercent <= 100.05);
      expectedCursor = stage.offsetEndDay;
      totalPercent += stage.widthPercent;
    }

    assert.equal(expectedCursor, plan.totalDurationDays);
    assert.ok(Math.abs(totalPercent - 100) <= 0.1);
  });

  it('matches the nearest eligible official 2027 RЦА session on or after estimated readiness', () => {
    // 2027-02-01 + ~42 days (2_ks, contour_b, standard) -> ready ~2027-03-15 -> nearest session 2027-04-16
    const springPlan = buildComplexityPreparationRoadmap({
      complexityId: '2_ks',
      contour: 'contour_b',
      disciplineId: 'hiking',
      paceId: 'standard',
      startDateIso: '2027-02-01',
    });

    assert.ok(springPlan.recommendedSession !== null);
    assert.equal(springPlan.recommendedSession.startIso, '2027-04-16');
    assert.ok(springPlan.recommendedSession.bufferDaysAfterPrep >= 0);

    // Late start after all 2027 sessions yields null recommendedSession + alternative fallback
    const latePlan = buildComplexityPreparationRoadmap({
      complexityId: '4_plus_ks',
      contour: 'contour_b',
      disciplineId: 'expedition',
      paceId: 'relaxed',
      startDateIso: '2027-10-01',
    });

    assert.equal(latePlan.recommendedSession, null);
    assert.ok(latePlan.alternativeSession !== null);
  });

  it('infers route complexity from difficulty strings and formats export text', () => {
    assert.equal(inferComplexityFromDifficultyLabel('1 КС (спецсопровождение)'), '1_ks');
    assert.equal(inferComplexityFromDifficultyLabel('1–2 КС'), '2_ks');
    assert.equal(inferComplexityFromDifficultyLabel('2–3 КС (комбинированный)'), '3_ks');
    assert.equal(inferComplexityFromDifficultyLabel('3–4 КС'), '4_plus_ks');

    const plan = buildComplexityPreparationRoadmap({
      complexityId: '1_ks',
      contour: 'contour_a',
      disciplineId: 'hiking',
      paceId: 'intensive',
      startDateIso: '2027-03-01',
    });
    const text = formatComplexityRoadmapText(plan);
    assert.ok(text.includes('1 КС'));
    assert.ok(text.includes('Контур А'));
    assert.ok(text.includes('Этапы подготовки:'));
  });
});
