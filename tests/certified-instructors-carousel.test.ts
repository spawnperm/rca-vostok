import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  CURATED_CERTIFIED_INSTRUCTOR_REVIEWS,
  computeReviewsAverageRating,
  filterCertifiedInstructorReviews,
  mergeCertifiedInstructorReviews,
  parseCertifiedReviewsFromApi,
  wrapCarouselIndex,
} from '../src/utils/certifiedInstructorReviewsCarousel.ts';
import type { InstructorReviewListItem } from '../src/components/InstructorReviewsSection.tsx';

test('parseCertifiedReviewsFromApi keeps only verified instructor reviews and extracts quote/advice', () => {
  const apiReviews: InstructorReviewListItem[] = [
    {
      id: 'rev-1',
      authorName: 'Игорь Панов',
      region: 'Приморский край',
      sessionTrack: 'Пешеходный и горный туризм · 2 КС',
      sessionRating: 5,
      trainingRating: 5,
      expertsRating: 5,
      overallRating: 5,
      recommended: true,
      recommendLabel: 'Рекомендует коллегам',
      verifiedInstructor: true,
      sessionNote: 'История успеха · Контур А · Ноябрь 2026',
      comment:
        'Подготовка: Прошёл модуль ПП РФ № 760 дистанционно.\nЭкзамен: Защитил паспорт маршрута на Шкотовском полигоне.\nСовет: Подготовьте треки заранее.',
      createdAt: '2026-11-02T10:00:00Z',
    },
    {
      id: 'rev-2',
      authorName: 'Анонимный соискатель',
      region: 'Хабаровский край',
      sessionTrack: 'Водный туризм',
      sessionRating: 4,
      trainingRating: 4,
      expertsRating: 4,
      overallRating: 4,
      recommended: true,
      recommendLabel: 'Рекомендует',
      verifiedInstructor: false,
      sessionNote: 'Кандидат до экзамена',
      comment: 'Готовлюсь к подаче документов.',
      createdAt: '2026-11-03T10:00:00Z',
    },
  ];

  const parsed = parseCertifiedReviewsFromApi(apiReviews);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].authorName, 'Игорь Панов');
  assert.equal(parsed[0].track, 'hiking');
  assert.equal(parsed[0].contourLabel, 'Контур А · зачёт стажа');
  assert.match(parsed[0].quote, /Шкотовском полигоне/);
  assert.equal(parsed[0].advice, 'Подготовьте треки заранее.');
  assert.equal(parsed[0].source, 'community');
});

test('mergeCertifiedInstructorReviews prioritizes live community reviews and deduplicates by author+region', () => {
  const community = [
    {
      ...CURATED_CERTIFIED_INSTRUCTOR_REVIEWS[0],
      id: 'live-kovalev',
      source: 'community' as const,
      quote: 'Обновлённый отзыв Дмитрия Ковалёва из живой БД.',
    },
  ];

  const merged = mergeCertifiedInstructorReviews(
    community,
    CURATED_CERTIFIED_INSTRUCTOR_REVIEWS
  );
  assert.equal(merged.length, CURATED_CERTIFIED_INSTRUCTOR_REVIEWS.length);
  assert.equal(merged[0].id, 'live-kovalev');
  assert.equal(merged[0].source, 'community');
});

test('filterCertifiedInstructorReviews and wrapCarouselIndex handle tracks and boundary wrap cleanly', () => {
  const waterSlides = filterCertifiedInstructorReviews(
    CURATED_CERTIFIED_INSTRUCTOR_REVIEWS,
    'water'
  );
  assert.equal(waterSlides.length, 2);
  assert.ok(waterSlides.every((item) => item.track === 'water'));

  assert.equal(wrapCarouselIndex(-1, 6), 5);
  assert.equal(wrapCarouselIndex(6, 6), 0);
  assert.equal(wrapCarouselIndex(2, 6), 2);
  assert.equal(wrapCarouselIndex(-1, 0), 0);

  const avg = computeReviewsAverageRating(CURATED_CERTIFIED_INSTRUCTOR_REVIEWS);
  assert.ok(avg !== null && avg >= 4.7 && avg <= 5.0);
  assert.equal(computeReviewsAverageRating([]), null);
});
