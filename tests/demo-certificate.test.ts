import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  DIAGNOSTIC_QUESTIONS,
  evaluateAttestationDiagnostics,
  type DiagnosticOptionId,
} from '../src/utils/attestationSelfDiagnostics.ts';
import {
  DEMO_CERTIFICATE_THRESHOLD_PERCENT,
  buildDemoCertificatePayload,
  isEligibleForDemoCertificate,
} from '../src/utils/demoCertificateCanvas.ts';

function pickWrong(correct: DiagnosticOptionId): DiagnosticOptionId {
  return correct === 'a' ? 'b' : 'a';
}

test('isEligibleForDemoCertificate requires complete quiz and score strictly above 80%', () => {
  assert.equal(DEMO_CERTIFICATE_THRESHOLD_PERCENT, 80);

  // 9 / 12 = 75% -> not eligible
  const answers75: Record<string, DiagnosticOptionId> = {};
  DIAGNOSTIC_QUESTIONS.forEach((q, idx) => {
    answers75[q.id] = idx < 9 ? q.correctOptionId : pickWrong(q.correctOptionId);
  });
  const eval75 = evaluateAttestationDiagnostics(answers75);
  assert.equal(eval75.overallPercent, 75);
  assert.equal(isEligibleForDemoCertificate(eval75), false);

  // 10 / 12 = 83% (10 answered out of 12, 2 unanswered) -> not complete -> not eligible
  const incompleteAnswers: Record<string, DiagnosticOptionId> = {};
  DIAGNOSTIC_QUESTIONS.slice(0, 10).forEach((q) => {
    incompleteAnswers[q.id] = q.correctOptionId;
  });
  const evalIncomplete = evaluateAttestationDiagnostics(incompleteAnswers);
  assert.equal(evalIncomplete.isComplete, false);
  assert.equal(evalIncomplete.overallPercent, 83);
  assert.equal(isEligibleForDemoCertificate(evalIncomplete), false);

  // 10 / 12 correct + 2 wrong (100% answered, 83% correct) -> eligible!
  const answers83: Record<string, DiagnosticOptionId> = {};
  DIAGNOSTIC_QUESTIONS.forEach((q, idx) => {
    answers83[q.id] = idx < 10 ? q.correctOptionId : pickWrong(q.correctOptionId);
  });
  const eval83 = evaluateAttestationDiagnostics(answers83);
  assert.equal(eval83.isComplete, true);
  assert.equal(eval83.overallPercent, 83);
  assert.equal(isEligibleForDemoCertificate(eval83), true);
});

test('buildDemoCertificatePayload embeds user fullName and custom override cleanly', () => {
  const perfect: Record<string, DiagnosticOptionId> = {};
  for (const q of DIAGNOSTIC_QUESTIONS) {
    perfect[q.id] = q.correctOptionId;
  }
  const evaluation = evaluateAttestationDiagnostics(perfect);

  const payload = buildDemoCertificatePayload({
    user: {
      id: 'u-demo-1',
      email: 'guide@rca-vostok.ru',
      fullName: 'Смирнова Татьяна Сергеевна',
      role: 'candidate',
      region: 'Приморский край',
      organisation: 'Клуб «Сихотэ-Алинь»',
      permissions: [],
      isActive: true,
      createdAt: '2026-11-01T00:00:00Z',
      lastLoginAt: null,
    },
    evaluation,
    now: new Date('2026-11-23T12:00:00Z'),
  });

  assert.equal(payload.candidateName, 'Смирнова Татьяна Сергеевна');
  assert.equal(payload.region, 'Приморский край');
  assert.equal(payload.overallPercent, 100);
  assert.equal(payload.sectionScores.length, 4);
  assert.ok(payload.certificateId.startsWith('DEMO-РЦА-2026-'));

  const customPayload = buildDemoCertificatePayload({
    user: null,
    customCandidateName: 'Соколов Илья Петрович',
    evaluation,
    now: new Date('2026-11-23T12:00:00Z'),
  });
  assert.equal(customPayload.candidateName, 'Соколов Илья Петрович');
});
