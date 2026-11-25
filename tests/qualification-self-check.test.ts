import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  SELF_CHECK_QUESTIONS,
  evaluateSelfCheck,
  sanitizeSelfCheckAnswers,
  type SelfCheckAnswers,
} from '../src/utils/qualificationSelfCheck.ts';

test('evaluateSelfCheck handles empty questionnaire state gracefully', () => {
  const res = evaluateSelfCheck({}, 'hiking');
  assert.equal(res.answeredCount, 0);
  assert.equal(res.totalQuestions, 8);
  assert.equal(res.isComplete, false);
  assert.equal(res.readinessPercent, 0);
  assert.equal(res.verdictTier, 'incomplete');
  assert.equal(res.domainPieData.length, 0);
  assert.equal(res.statusPieData.length, 1);
  assert.equal(res.statusPieData[0].id, 'unanswered');
  assert.equal(res.statusPieData[0].percent, 100);
});

test('evaluateSelfCheck returns ready verdict when all 8 criteria are confirmed', () => {
  const answers: SelfCheckAnswers = {};
  for (const q of SELF_CHECK_QUESTIONS) {
    answers[q.id] = 'confirmed';
  }
  const res = evaluateSelfCheck(answers, 'water');
  assert.equal(res.isComplete, true);
  assert.equal(res.readinessPercent, 100);
  assert.equal(res.earnedPoints, 16);
  assert.equal(res.confirmedCount, 8);
  assert.equal(res.verdictTier, 'ready');
  assert.equal(res.recommendations.length, 0);
  assert.equal(res.statusPieData.length, 1);
  assert.equal(res.statusPieData[0].id, 'confirmed');
  assert.equal(res.domainPieData.length, 4);
  assert.ok(res.domainPieData.every((d) => d.percent === 25));
});

test('evaluateSelfCheck recommends Contour A for partial readiness and orders critical gaps first', () => {
  const answers: SelfCheckAnswers = {
    'sc-identity-education': 'confirmed',
    'sc-medical-clearance': 'confirmed',
    'sc-hiking-experience': 'confirmed',
    'sc-topography-navigation': 'confirmed',
    'sc-wilderness-first-aid': 'in_progress',
    'sc-dfo-comms-predators': 'in_progress',
    'sc-route-passport': 'missing',
    'sc-group-rescue-management': 'confirmed',
  };
  const res = evaluateSelfCheck(answers, 'hiking');
  assert.equal(res.isComplete, true);
  assert.equal(res.earnedPoints, 12);
  assert.equal(res.readinessPercent, 75);
  assert.equal(res.verdictTier, 'contour_a');
  assert.equal(res.recommendations.length, 3);
  assert.equal(res.recommendations[0].questionId, 'sc-route-passport');
  assert.equal(res.recommendations[0].severity, 'critical');
  assert.equal(res.statusPieData.length, 3);
});

test('evaluateSelfCheck recommends DPO VVSU training when majority of requirements are missing', () => {
  const answers: SelfCheckAnswers = {
    'sc-identity-education': 'in_progress',
    'sc-medical-clearance': 'missing',
    'sc-hiking-experience': 'missing',
    'sc-topography-navigation': 'in_progress',
    'sc-wilderness-first-aid': 'missing',
    'sc-dfo-comms-predators': 'missing',
    'sc-route-passport': 'missing',
    'sc-group-rescue-management': 'in_progress',
  };
  const res = evaluateSelfCheck(answers, 'expedition');
  assert.equal(res.isComplete, true);
  assert.equal(res.verdictTier, 'training_needed');
  assert.ok(res.readinessPercent < 50);
  assert.equal(res.missingCount, 5);
});

test('sanitizeSelfCheckAnswers filters out unknown keys and invalid values', () => {
  const clean = sanitizeSelfCheckAnswers({
    'sc-medical-clearance': 'confirmed',
    'sc-route-passport': 'invalid_status',
    unknown_question: 'confirmed',
  });
  assert.deepEqual(clean, { 'sc-medical-clearance': 'confirmed' });
});
