import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  EXPERT_RATING_PRESETS,
  QUALIFICATION_LEVELS,
  buildDynamicExpertTips,
  calculateExpertRating,
} from '../src/utils/expertRatingCalculator.ts';
import {
  QUIZ_DURATION_SECONDS,
  formatCountdown,
  getTimerUrgency,
} from '../src/utils/quizTimer.ts';

test('calculateExpertRating returns zeroed level 1 baseline for empty profile', () => {
  const res = calculateExpertRating({
    experienceYears: 0,
    ledGroupsCount: 0,
    completedCourses: [],
    hikes1Ks: 0,
    hikes2Ks: 0,
    hikes3Ks: 0,
    hikes4Ks: 0,
  });

  assert.equal(res.totalScore, 0);
  assert.equal(res.experiencePoints, 0);
  assert.equal(res.coursesPoints, 0);
  assert.equal(res.complexityPoints, 0);
  assert.equal(res.currentLevel.level, 1);
  assert.equal(res.nextLevel?.level, 2);
  assert.equal(res.levelProgressPercent, 0);
  assert.equal(res.pointsToNextLevel, 25);
});

test('calculateExpertRating computes tier progression percentage accurately', () => {
  // Practitioner preset should sit in level 3 (50-74) or level 4
  const practitioner = calculateExpertRating(EXPERT_RATING_PRESETS[1].input);
  assert.ok(practitioner.totalScore >= 50 && practitioner.totalScore <= 89);
  assert.ok(practitioner.levelProgressPercent >= 0 && practitioner.levelProgressPercent < 100);
  assert.ok(practitioner.pointsToNextLevel > 0);
  assert.equal(
    practitioner.totalScore,
    practitioner.experiencePoints + practitioner.coursesPoints + practitioner.complexityPoints
  );

  // Senior preset should reach level 5 (90-100)
  const senior = calculateExpertRating(EXPERT_RATING_PRESETS[2].input);
  assert.equal(senior.currentLevel.level, QUALIFICATION_LEVELS[4].level);
  assert.equal(senior.nextLevel, null);
  assert.equal(senior.levelProgressPercent, 100);
  assert.equal(senior.pointsToNextLevel, 0);
  assert.equal(senior.highestComplexityLabel, '4 КС (экспедиционный)');
});

test('calculateExpertRating clamps out-of-range inputs and deduplicates courses', () => {
  const res = calculateExpertRating({
    experienceYears: 99,
    ledGroupsCount: 500,
    completedCourses: ['dpo_vvsu', 'dpo_vvsu', 'wfa_first_aid', 'fstr_rescue', 'dfo_predator'],
    hikes1Ks: 100,
    hikes2Ks: 100,
    hikes3Ks: 100,
    hikes4Ks: 100,
  });

  assert.equal(res.experiencePoints, 30);
  assert.equal(res.coursesPoints, 35);
  assert.equal(res.complexityPoints, 35);
  assert.equal(res.totalScore, 100);
});

test('buildDynamicExpertTips adapts recommendations to current rating and missing courses', () => {
  const starterInput = EXPERT_RATING_PRESETS[0].input;
  const starterRating = calculateExpertRating(starterInput);
  const starterTips = buildDynamicExpertTips(starterInput, starterRating);

  assert.ok(starterTips.length >= 3);
  assert.equal(starterTips[0].id, 'tier-foundation');
  assert.ok(starterTips.some((t) => t.id === 'gap-dpo-vvsu'));
  assert.ok(starterTips.some((t) => t.id === 'gap-wfa'));

  const seniorInput = EXPERT_RATING_PRESETS[2].input;
  const seniorRating = calculateExpertRating(seniorInput);
  const seniorTips = buildDynamicExpertTips(seniorInput, seniorRating);

  assert.equal(seniorTips[0].id, 'tier-master-commission');
  assert.equal(seniorTips.some((t) => t.id === 'gap-dpo-vvsu'), false);
});

test('quizTimer provides 5-minute duration, MM:SS formatting, and urgency states', () => {
  assert.equal(QUIZ_DURATION_SECONDS, 300);
  assert.equal(formatCountdown(300), '05:00');
  assert.equal(formatCountdown(65), '01:05');
  assert.equal(formatCountdown(9), '00:09');
  assert.equal(formatCountdown(-5), '00:00');

  assert.equal(getTimerUrgency(300, 'idle'), 'normal');
  assert.equal(getTimerUrgency(59, 'running'), 'warning');
  assert.equal(getTimerUrgency(15, 'running'), 'critical');
  assert.equal(getTimerUrgency(0, 'running'), 'finished');
  assert.equal(getTimerUrgency(120, 'finished'), 'finished');
});
