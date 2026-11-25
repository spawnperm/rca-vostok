import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  DIAGNOSTIC_QUESTIONS,
  DIAGNOSTIC_SECTIONS,
  evaluateAttestationDiagnostics,
  sanitizeDiagnosticAnswers,
  type DiagnosticOptionId,
} from '../src/utils/attestationSelfDiagnostics.ts';

function pickWrongOption(correct: DiagnosticOptionId): DiagnosticOptionId {
  return correct === 'a' ? 'b' : 'a';
}

test('DIAGNOSTIC_SECTIONS and DIAGNOSTIC_QUESTIONS define 4 sections with 3 questions each', () => {
  assert.equal(DIAGNOSTIC_SECTIONS.length, 4);
  assert.equal(DIAGNOSTIC_QUESTIONS.length, 12);

  const uniqueIds = new Set(DIAGNOSTIC_QUESTIONS.map((q) => q.id));
  assert.equal(uniqueIds.size, DIAGNOSTIC_QUESTIONS.length);

  for (const section of DIAGNOSTIC_SECTIONS) {
    const qs = DIAGNOSTIC_QUESTIONS.filter((q) => q.sectionId === section.id);
    assert.equal(qs.length, 3, `Section ${section.id} must have exactly 3 questions`);
    for (const q of qs) {
      assert.equal(q.options.length, 4);
      assert.ok(q.options.some((o) => o.id === q.correctOptionId));
      assert.ok(q.explanation.length > 20);
      assert.ok(q.legalOrMethodRef.length > 3);
      assert.ok(q.kbQuery.length >= 2);
    }
  }
});

test('evaluateAttestationDiagnostics handles empty answers as incomplete', () => {
  const result = evaluateAttestationDiagnostics({});
  assert.equal(result.answeredCount, 0);
  assert.equal(result.unansweredCount, 12);
  assert.equal(result.correctCount, 0);
  assert.equal(result.overallPercent, 0);
  assert.equal(result.isComplete, false);
  assert.equal(result.readinessTier, 'incomplete');
  assert.equal(result.incompleteSectionIds.length, 4);
});

test('evaluateAttestationDiagnostics awards exam_ready on 100% score', () => {
  const answers: Record<string, DiagnosticOptionId> = {};
  for (const q of DIAGNOSTIC_QUESTIONS) {
    answers[q.id] = q.correctOptionId;
  }

  const result = evaluateAttestationDiagnostics(answers);
  assert.equal(result.isComplete, true);
  assert.equal(result.answeredCount, 12);
  assert.equal(result.correctCount, 12);
  assert.equal(result.overallPercent, 100);
  assert.equal(result.readinessTier, 'exam_ready');
  assert.equal(result.totalRecommendedHours, 0);
  assert.ok(result.sections.every((s) => s.status === 'strong' && s.missedQuestions.length === 0));
});

test('evaluateAttestationDiagnostics prioritizes weakest section first for targeted_prep', () => {
  const answers: Record<string, DiagnosticOptionId> = {};
  for (const q of DIAGNOSTIC_QUESTIONS) {
    if (q.sectionId === 'first_aid') {
      // 0/3 correct -> gap (0%)
      answers[q.id] = pickWrongOption(q.correctOptionId);
    } else if (q.sectionId === 'routing' && q.id === 'route-oopt-regime') {
      // 2/3 correct -> moderate (67%)
      answers[q.id] = pickWrongOption(q.correctOptionId);
    } else {
      answers[q.id] = q.correctOptionId;
    }
  }

  const result = evaluateAttestationDiagnostics(answers);
  assert.equal(result.isComplete, true);
  assert.equal(result.correctCount, 8);
  assert.equal(result.overallPercent, 67);
  assert.equal(result.readinessTier, 'targeted_prep');
  assert.equal(result.priorityRecommendations[0].id, 'first_aid');
  assert.equal(result.priorityRecommendations[0].status, 'gap');
  assert.equal(result.priorityRecommendations[0].missedQuestions.length, 3);
  assert.equal(result.priorityRecommendations[1].id, 'routing');
  assert.equal(result.priorityRecommendations[1].status, 'moderate');
  assert.equal(result.priorityRecommendations[1].missedQuestions.length, 1);
  assert.ok(result.totalRecommendedHours > 0);
});

test('evaluateAttestationDiagnostics recommends DPO on low overall score (< 50%)', () => {
  const answers: Record<string, DiagnosticOptionId> = {};
  DIAGNOSTIC_QUESTIONS.forEach((q, idx) => {
    // Only 3 correct out of 12 = 25%
    answers[q.id] = idx < 3 ? q.correctOptionId : pickWrongOption(q.correctOptionId);
  });

  const result = evaluateAttestationDiagnostics(answers);
  assert.equal(result.isComplete, true);
  assert.equal(result.overallPercent, 25);
  assert.equal(result.readinessTier, 'dpo_recommended');
  assert.ok(result.recommendedContour.includes('Контур А'));
});

test('sanitizeDiagnosticAnswers drops unknown question keys and invalid option values', () => {
  const sanitized = sanitizeDiagnosticAnswers({
    'reg-efrta-registry': 'a',
    'unknown-question': 'b',
    'route-form-760': 'z',
    'aid-hypothermia': 123,
  });

  assert.deepEqual(sanitized, { 'reg-efrta-registry': 'a' });
});
