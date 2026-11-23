import assert from 'node:assert/strict';
import test from 'node:test';
import { CERTIFIED_SUCCESS_STORIES, GLOSSARY_TERMS } from '../src/data/researchData.ts';
import { tokenizeTextWithGlossary } from '../src/utils/glossaryHighlighter.ts';
import {
  buildSuccessStorySubmissionPayload,
  filterSuccessStories,
  mergeSuccessStories,
  parseSuccessStoriesFromReviews,
} from '../src/utils/successStories.ts';
import type { InstructorReviewListItem } from '../src/components/InstructorReviewsSection.tsx';

test('tokenizeTextWithGlossary highlights inflected Russian terms without overlapping spans', () => {
  const sample =
    'Каждый инструктор-проводник обязан пройти государственную аттестацию, защитить паспорт маршрута по ПП РФ № 760 и попасть в Единый федеральный реестр.';
  const segments = tokenizeTextWithGlossary(sample, GLOSSARY_TERMS);

  const termSegments = segments.filter((s) => s.type === 'term');
  const ids = termSegments.map((s) => s.term.id);

  assert.ok(ids.includes('term-instructor-guide'));
  assert.ok(ids.includes('term-attestation'));
  assert.ok(ids.includes('term-route-passport'));
  assert.ok(ids.includes('term-pp-760'));
  assert.ok(ids.includes('term-federal-registry'));

  // Reconstructing all segment texts must equal the exact input string
  assert.equal(segments.map((s) => s.text).join(''), sample);
});

test('tokenizeTextWithGlossary respects Unicode Cyrillic word boundaries and maxMatchesPerTerm', () => {
  const sample =
    'Аттестация проводится в РЦА. После аттестации сведения вносятся в реестр, а слово «переаттестация» не должно рваться внутри корня.';
  const segmentsLimited = tokenizeTextWithGlossary(sample, GLOSSARY_TERMS, {
    maxMatchesPerTerm: 1,
  });

  const attestationMatches = segmentsLimited.filter(
    (s) => s.type === 'term' && s.term.id === 'term-attestation'
  );
  assert.equal(attestationMatches.length, 1);
  assert.equal(segmentsLimited.map((s) => s.text).join(''), sample);

  // "переаттестация" should remain plain text because left boundary is inside word
  const nonBroken = segmentsLimited.some(
    (s) => s.type === 'text' && s.text.includes('переаттестация')
  );
  assert.equal(nonBroken, true);
});

test('CERTIFIED_SUCCESS_STORIES provides grounded preparation and exam experiences across DFO', () => {
  assert.ok(CERTIFIED_SUCCESS_STORIES.length >= 5);
  const regions = new Set(CERTIFIED_SUCCESS_STORIES.map((s) => s.region));
  assert.ok(regions.size >= 3);
  assert.ok(
    CERTIFIED_SUCCESS_STORIES.every(
      (s) =>
        s.prepStory.length >= 30 &&
        s.examStory.length >= 30 &&
        s.advice.length >= 15
    )
  );
});

test('buildSuccessStorySubmissionPayload & parseSuccessStoriesFromReviews round-trip cleanly', () => {
  const payload = buildSuccessStorySubmissionPayload({
    authorName: 'Павел Григорьев',
    email: 'pavel@example.ru',
    region: 'Приморский край',
    track: 'water',
    contour: 'A',
    batchLabel: 'Ноябрь 2026',
    studyHours: 48,
    prepRating: 5,
    examRating: 5,
    prepStory: 'Систематизировал речные треки за 5 лет и повторил нормативную базу ПП 1003.',
    examStory: 'На Шкотовском полигоне прошёл этап спасработ на течении и защитил паспорт маршрута.',
    advice: 'Готовьте схемы эвакуации заранее в печатном виде.',
  });

  assert.equal(payload.feedbackType, 'center_review');
  assert.ok(payload.message.includes('История успеха'));
  assert.ok(payload.message.includes('Подготовка:'));
  assert.ok(payload.message.includes('Экзамен:'));

  const mockApiReview: InstructorReviewListItem = {
    id: 'fb-test-story-1',
    authorName: payload.senderName,
    region: 'Приморский край',
    sessionTrack: 'Водный туризм и сплавы',
    sessionRating: 5,
    trainingRating: 5,
    expertsRating: 5,
    overallRating: 5,
    recommended: true,
    recommendLabel: 'Рекомендует коллегам',
    verifiedInstructor: true,
    sessionNote: 'История успеха · Контур А (зачёт стажа) · Ноябрь 2026 · 48 ч',
    comment: [
      'Подготовка: Систематизировал речные треки за 5 лет и повторил нормативную базу ПП 1003.',
      'Экзамен: На Шкотовском полигоне прошёл этап спасработ на течении и защитил паспорт маршрута.',
      'Совет: Готовьте схемы эвакуации заранее в печатном виде.',
    ].join('\n'),
    createdAt: '2026-11-23T10:00:00Z',
  };

  const unrelatedReview: InstructorReviewListItem = {
    ...mockApiReview,
    id: 'fb-ordinary-review',
    sessionNote: 'Октябрь 2026',
    comment: 'Отличная комиссия и понятные лекции в ВВГУ.',
  };

  const parsed = parseSuccessStoriesFromReviews([mockApiReview, unrelatedReview]);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].authorName, 'Павел Григорьев');
  assert.equal(parsed[0].track, 'water');
  assert.equal(parsed[0].contour, 'A');
  assert.equal(parsed[0].studyHours, 48);
  assert.equal(parsed[0].batchLabel, 'Ноябрь 2026');
  assert.ok(parsed[0].prepStory.includes('речные треки'));
  assert.ok(parsed[0].examStory.includes('Шкотовском полигоне'));
  assert.ok(parsed[0].advice.includes('схемы эвакуации'));

  const merged = mergeSuccessStories(parsed, CERTIFIED_SUCCESS_STORIES);
  assert.equal(merged.length, CERTIFIED_SUCCESS_STORIES.length + 1);
  assert.equal(merged[0].source, 'community');

  const waterOnly = filterSuccessStories(merged, 'water', 'all');
  assert.ok(waterOnly.every((s) => s.track === 'water'));
  assert.ok(waterOnly.some((s) => s.id === 'fb-test-story-1'));
});
