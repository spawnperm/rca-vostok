import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DFO_ATTESTATION_LOCATIONS,
  buildAttestationGoogleMapsUrl,
  buildAttestationYandexMapsUrl,
  filterAttestationLocations,
  getDfoRegionFilterOptions,
  sortAttestationLocationsForStacking,
} from '../src/utils/attestationLocationsMap.ts';
import {
  EXAM_SIM_QUESTIONS,
  EXAM_TOPICS,
  evaluateExamAnswer,
  filterExamQuestionsByTopic,
  getRemainingWrongQuestions,
  summarizeExamSession,
} from '../src/utils/preparationExamSimulator.ts';

test('DFO_ATTESTATION_LOCATIONS contains valid DFO coordinates, trial formats, and kind coverage', () => {
  assert.ok(DFO_ATTESTATION_LOCATIONS.length >= 6);

  const kinds = new Set(DFO_ATTESTATION_LOCATIONS.map((loc) => loc.kind));
  assert.ok(kinds.has('headquarters'));
  assert.ok(kinds.has('field_polygon'));
  assert.ok(kinds.has('regional_hub'));

  for (const loc of DFO_ATTESTATION_LOCATIONS) {
    assert.ok(Number.isFinite(loc.coordinates.lat) && loc.coordinates.lat > 40);
    assert.ok(Number.isFinite(loc.coordinates.lng) && loc.coordinates.lng > 120);
    assert.ok(loc.trialFormats.length >= 2);
    assert.ok(loc.address.length > 5);
    assert.ok(buildAttestationGoogleMapsUrl(loc).startsWith('https://www.google.com/maps/search/'));
    assert.ok(buildAttestationYandexMapsUrl(loc).startsWith('https://yandex.ru/maps/?pt='));
  }
});

test('filterAttestationLocations filters by kind, DFO region, and Cyrillic search query', () => {
  const polygons = filterAttestationLocations(DFO_ATTESTATION_LOCATIONS, 'field_polygon');
  assert.ok(polygons.length >= 2);
  assert.ok(polygons.every((loc) => loc.kind === 'field_polygon'));

  const kamchatka = filterAttestationLocations(DFO_ATTESTATION_LOCATIONS, 'all', 'Камчат');
  assert.equal(kamchatka.length, 1);
  assert.equal(kamchatka[0].id, 'loc-kamchatka-hub');

  const hq = filterAttestationLocations(DFO_ATTESTATION_LOCATIONS, 'headquarters', 'Гоголя');
  assert.equal(hq.length, 1);
  assert.equal(hq[0].id, 'loc-vladivostok-vvgu');

  const regions = getDfoRegionFilterOptions(DFO_ATTESTATION_LOCATIONS);
  assert.equal(regions[0].id, 'all');
  assert.equal(regions[0].count, DFO_ATTESTATION_LOCATIONS.length);
  assert.ok(regions.length >= 7);

  const primorye = filterAttestationLocations(
    DFO_ATTESTATION_LOCATIONS,
    'all',
    '',
    'Приморский край'
  );
  assert.equal(primorye.length, 3);
  assert.ok(primorye.every((loc) => loc.regionName === 'Приморский край'));

  const primoryePolygons = filterAttestationLocations(
    DFO_ATTESTATION_LOCATIONS,
    'field_polygon',
    '',
    'Приморский край'
  );
  assert.equal(primoryePolygons.length, 2);

  const amur = filterAttestationLocations(
    DFO_ATTESTATION_LOCATIONS,
    'all',
    '',
    'Амурская область'
  );
  assert.equal(amur.length, 1);
  assert.equal(amur[0].id, 'loc-amur-hub');
});

test('sortAttestationLocationsForStacking orders northern latitudes lower in z-index than southern ones', () => {
  const stacked = sortAttestationLocationsForStacking(DFO_ATTESTATION_LOCATIONS);
  assert.equal(stacked.length, DFO_ATTESTATION_LOCATIONS.length);
  for (let i = 1; i < stacked.length; i++) {
    assert.ok(stacked[i - 1].location.coordinates.lat >= stacked[i].location.coordinates.lat);
    assert.ok(stacked[i].baseZIndex > stacked[i - 1].baseZIndex);
  }
});

test('Preparation exam simulator provides instant evaluation and topic filtering', () => {
  assert.ok(EXAM_SIM_QUESTIONS.length >= 8);
  assert.equal(EXAM_TOPICS.length, 5);

  const lawQuestions = filterExamQuestionsByTopic(EXAM_SIM_QUESTIONS, 'law');
  assert.equal(lawQuestions.length, 2);

  const sample = lawQuestions[0];
  const rightResult = evaluateExamAnswer(sample, sample.correctOptionId);
  assert.equal(rightResult.isCorrect, true);
  assert.equal(rightResult.feedbackHeading, 'Правильный ответ');
  assert.ok(rightResult.explanation.length > 20);
  assert.ok(rightResult.legalRef.length > 5);

  const wrongOpt = sample.options.find((o) => o.id !== sample.correctOptionId)!;
  const wrongResult = evaluateExamAnswer(sample, wrongOpt.id);
  assert.equal(wrongResult.isCorrect, false);
  assert.ok(wrongResult.feedbackHeading.includes(rightResult.correctOption.label));
  assert.ok(wrongResult.explanation.length > 20);
});

test('summarizeExamSession computes pass status, per-topic metrics, and wrong-question review set', () => {
  const answers: Record<string, string> = {};
  EXAM_SIM_QUESTIONS.forEach((q, idx) => {
    if (idx < 2) {
      const wrong = q.options.find((o) => o.id !== q.correctOptionId)!;
      answers[q.id] = wrong.id;
    } else {
      answers[q.id] = q.correctOptionId;
    }
  });

  const summary = summarizeExamSession(EXAM_SIM_QUESTIONS, answers);
  assert.equal(summary.total, 8);
  assert.equal(summary.answered, 8);
  assert.equal(summary.correct, 6);
  assert.equal(summary.incorrect, 2);
  assert.equal(summary.scorePct, 75);
  assert.equal(summary.passed, true);
  assert.equal(summary.wrongQuestionIds.length, 2);
  assert.equal(summary.byTopic.length, 4);

  const retryDeck = getRemainingWrongQuestions(EXAM_SIM_QUESTIONS, summary.wrongQuestionIds);
  assert.equal(retryDeck.length, 2);
  assert.deepEqual(
    retryDeck.map((q) => q.id),
    summary.wrongQuestionIds
  );
});
