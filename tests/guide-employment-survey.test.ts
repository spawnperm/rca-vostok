import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  DEFAULT_SURVEY_FORM_STATE,
  EMPLOYMENT_STATUS_OPTIONS,
  REATTESTATION_URGENCY_OPTIONS,
  aggregateEmploymentSurvey,
  computeReattestationPriority,
  createSurveyEntry,
  getPriorityLabel,
  validateGuideEmploymentInput,
} from '../src/utils/guideEmploymentSurvey.ts';

test('computeReattestationPriority classifies urgent, planned, and low-priority profiles accurately', () => {
  assert.equal(
    computeReattestationPriority({
      hasActiveCertificate: true,
      reattestationUrgency: REATTESTATION_URGENCY_OPTIONS[0],
    }),
    'high'
  );
  assert.equal(
    computeReattestationPriority({
      hasActiveCertificate: false,
      reattestationUrgency: REATTESTATION_URGENCY_OPTIONS[4],
    }),
    'high'
  );
  assert.equal(
    computeReattestationPriority({
      hasActiveCertificate: true,
      reattestationUrgency: REATTESTATION_URGENCY_OPTIONS[1],
    }),
    'medium'
  );
  assert.equal(
    computeReattestationPriority({
      hasActiveCertificate: true,
      reattestationUrgency: REATTESTATION_URGENCY_OPTIONS[4],
    }),
    'low'
  );
  assert.match(getPriorityLabel('high'), /Высокий приоритет/);
});

test('validateGuideEmploymentInput rejects invalid seasonal workload or missing topics when re-attestation is needed', () => {
  const validResult = validateGuideEmploymentInput(DEFAULT_SURVEY_FORM_STATE);
  assert.equal(validResult.ok, true);

  const invalidDays = validateGuideEmploymentInput({
    ...DEFAULT_SURVEY_FORM_STATE,
    tourDaysPerSeason: 400,
  });
  assert.equal(invalidDays.ok, false);

  const missingTopics = validateGuideEmploymentInput({
    ...DEFAULT_SURVEY_FORM_STATE,
    reattestationUrgency: REATTESTATION_URGENCY_OPTIONS[0],
    neededTopics: [],
  });
  assert.equal(missingTopics.ok, false);

  const lowPriorityNoTopics = validateGuideEmploymentInput({
    ...DEFAULT_SURVEY_FORM_STATE,
    hasActiveCertificate: true,
    reattestationUrgency: REATTESTATION_URGENCY_OPTIONS[4],
    neededTopics: [],
  });
  assert.equal(lowPriorityNoTopics.ok, true);
});

test('createSurveyEntry normalizes input and aggregateEmploymentSurvey summarizes local state responses', () => {
  const emptySummary = aggregateEmploymentSurvey([]);
  assert.equal(emptySummary.totalResponses, 0);
  assert.equal(emptySummary.avgTourDaysPerSeason, 0);

  const first = createSurveyEntry(
    {
      ...DEFAULT_SURVEY_FORM_STATE,
      respondentName: '  Иван Петров  ',
      employmentStatus: EMPLOYMENT_STATUS_OPTIONS[0],
      tourDaysPerSeason: 90,
      groupsPerMonth: 6,
      hasActiveCertificate: true,
      reattestationUrgency: REATTESTATION_URGENCY_OPTIONS[0],
      neededTopics: ['npa_760', 'wfa_first_aid', 'npa_760', 'invalid_topic'],
      needsEmployerSubsidy: true,
    },
    1,
    new Date('2026-11-24T09:00:00Z')
  );

  const second = createSurveyEntry(
    {
      ...DEFAULT_SURVEY_FORM_STATE,
      respondentName: '',
      employmentStatus: EMPLOYMENT_STATUS_OPTIONS[1],
      tourDaysPerSeason: 50,
      groupsPerMonth: 2,
      hasActiveCertificate: false,
      reattestationUrgency: REATTESTATION_URGENCY_OPTIONS[3],
      neededTopics: ['contour_a_docs', 'npa_760'],
      needsEmployerSubsidy: false,
    },
    2,
    new Date('2026-11-24T09:05:00Z')
  );

  assert.equal(first.respondentName, 'Иван Петров');
  assert.deepEqual(first.neededTopics, ['npa_760', 'wfa_first_aid']);
  assert.equal(first.priorityLevel, 'high');
  assert.equal(second.priorityLevel, 'high');
  assert.ok(first.id.startsWith('EMP-001-'));

  const summary = aggregateEmploymentSurvey([first, second]);
  assert.equal(summary.totalResponses, 2);
  assert.equal(summary.urgentReattestationCount, 2);
  assert.equal(summary.needsReattestationPct, 100);
  assert.equal(summary.avgTourDaysPerSeason, 70);
  assert.equal(summary.avgGroupsPerMonth, 4);
  assert.equal(summary.certifiedSharePct, 50);
  assert.equal(summary.subsidyRequestedCount, 1);
  assert.equal(summary.topNeededTopics[0].id, 'npa_760');
  assert.equal(summary.topNeededTopics[0].count, 2);
  assert.equal(summary.byEmployment.length, 2);
});
