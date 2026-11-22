import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { GetCenterReviewsStatsUseCase } from '../src/application/feedback/FeedbackUseCases.ts';
import { PlatformFeedback } from '../src/domain/feedback/PlatformFeedback.ts';
import { JsonFileFeedbackRepository } from '../src/infrastructure/persistence/JsonFileFeedbackRepository.ts';

test('GetCenterReviewsStatsUseCase: returns empty zeroed buckets when no reviews exist', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-reviews-empty-'));
  const repo = new JsonFileFeedbackRepository(tmpDir);
  const useCase = new GetCenterReviewsStatsUseCase(repo);

  const stats = await useCase.execute();
  assert.equal(stats.totalReviews, 0);
  assert.equal(stats.sessionAverage, null);
  assert.equal(stats.expertsAverage, null);
  assert.equal(stats.recommendationCount, 0);
  assert.equal(stats.distribution.length, 5);
  assert.ok(stats.distribution.every((b) => b.sessionCount === 0 && b.expertsCount === 0));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('GetCenterReviewsStatsUseCase: aggregates center_review ratings and ignores general feedback', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-reviews-stats-'));
  const repo = new JsonFileFeedbackRepository(tmpDir);

  await repo.save(
    PlatformFeedback.create({
      senderName: 'Обычный пользователь',
      email: 'user@example.ru',
      feedbackType: 'suggestion',
      subject: 'Предложение по разделу маршрутов',
      message: 'Добавьте больше информации про водные маршруты Приморья.',
    })
  );

  await repo.save(
    PlatformFeedback.create({
      senderName: 'Гид 1',
      email: 'g1@example.ru',
      feedbackType: 'center_review',
      subject: 'Отзыв о центре (5/5 сессия, 5/5 эксперты) · Водный туризм',
      message: [
        'Направление / сессия: Водный туризм',
        'Оценка качества аттестационной сессии: 5 из 5 (Отлично)',
        'Оценка работы экспертов и комиссии: 5 из 5 (Отлично)',
        'Рекомендация: Рекомендует коллегам',
        'Комментарий: Чёткая организация полигона.',
      ].join('\n'),
    })
  );

  await repo.save(
    PlatformFeedback.create({
      senderName: 'Гид 2',
      email: 'g2@example.ru',
      feedbackType: 'center_review',
      subject: 'Отзыв о центре (3/5 сессия, 4/5 эксперты) · Пешеходный туризм',
      message: [
        'Направление / сессия: Пешеходный туризм',
        'Оценка качества аттестационной сессии: 3 из 5 (Удовлетворительно)',
        'Оценка работы экспертов и комиссии: 4 из 5 (Хорошо)',
        'Рекомендация: Не рекомендует',
        'Комментарий: Хотелось бы быстрее публикацию графика.',
      ].join('\n'),
    })
  );

  const useCase = new GetCenterReviewsStatsUseCase(repo);
  const stats = await useCase.execute();

  assert.equal(stats.totalReviews, 2);
  assert.equal(stats.sessionAverage, 4);
  assert.equal(stats.expertsAverage, 4.5);
  assert.equal(stats.recommendationCount, 1);
  assert.equal(stats.distribution[2].sessionCount, 1); // 3 ★
  assert.equal(stats.distribution[4].sessionCount, 1); // 5 ★
  assert.equal(stats.distribution[3].expertsCount, 1); // 4 ★
  assert.equal(stats.distribution[4].expertsCount, 1); // 5 ★

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
