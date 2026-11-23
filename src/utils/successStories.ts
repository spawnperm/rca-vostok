import type { InstructorReviewListItem } from '../components/InstructorReviewsSection.tsx';
import type { SuccessStoryItem } from '../data/researchData.ts';

export type SuccessStoryTrackFilter =
  | 'all'
  | 'hiking'
  | 'water'
  | 'expedition'
  | 'auto';
export type SuccessStoryContourFilter = 'all' | 'A' | 'B';

export interface SuccessStoryCardModel extends SuccessStoryItem {
  source: 'community' | 'curated';
  verified: boolean;
}

export interface SuccessStorySubmissionInput {
  authorName: string;
  email?: string;
  region: string;
  track: 'hiking' | 'water' | 'expedition' | 'auto';
  contour: 'A' | 'B';
  batchLabel: string;
  studyHours?: number;
  prepRating: number;
  examRating: number;
  prepStory: string;
  examStory: string;
  advice: string;
}

const TRACK_LABELS: Record<SuccessStorySubmissionInput['track'], string> = {
  hiking: 'Пешеходный и горный туризм',
  water: 'Водный туризм и сплавы',
  expedition: 'Экспедиционный / ООПТ',
  auto: 'Автомобильный туризм ДФО',
};

const CONTOUR_LABELS: Record<SuccessStorySubmissionInput['contour'], string> = {
  A: 'Контур А (зачёт стажа)',
  B: 'Контур Б (ДПО ВВГУ)',
};

const RATING_TEXT: Record<number, string> = {
  1: 'Требует серьёзной доработки',
  2: 'Ниже ожиданий',
  3: 'Удовлетворительно',
  4: 'Хорошо',
  5: 'Отлично',
};

function clampScore(value: number): number {
  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded)) return 5;
  return Math.max(1, Math.min(5, rounded));
}

function detectTrack(trackText: string): SuccessStoryItem['track'] {
  const lower = trackText.toLowerCase();
  if (/вод|сплав|каяк|sup|море/.test(lower)) return 'water';
  if (/экспед|оопт|заповед|нацпарк|бикин/.test(lower)) return 'expedition';
  if (/авто|джип/.test(lower)) return 'auto';
  return 'hiking';
}

function detectContour(noteText: string): 'A' | 'B' {
  if (/контур\s*б|дпо|250/i.test(noteText)) return 'B';
  return 'A';
}

/**
 * Serializes a certified guide's preparation & exam success story into the
 * validated `/api/feedback` (`center_review`) payload so it persists in DB/JSON
 * and surfaces via `/api/feedback/reviews` without exposing email PII.
 */
export function buildSuccessStorySubmissionPayload(
  input: SuccessStorySubmissionInput
): {
  senderName: string;
  email: string;
  feedbackType: 'center_review';
  platformModule: string;
  subject: string;
  message: string;
} {
  const prepScore = clampScore(input.prepRating);
  const examScore = clampScore(input.examRating);
  const trackTitle = TRACK_LABELS[input.track];
  const contourTitle = CONTOUR_LABELS[input.contour];
  const batch = input.batchLabel.trim() || 'Сессия РЦА 2026';
  const hoursPart =
    typeof input.studyHours === 'number' && input.studyHours > 0
      ? ` · ${Math.round(input.studyHours)} ч`
      : '';

  const sessionNote = `История успеха · ${contourTitle} · ${batch}${hoursPart}`;
  const subject = `Отзыв о центре (${examScore}/5 сессия, ${examScore}/5 эксперты) · ${trackTitle}`;

  const commentBlocks = [
    `Подготовка: ${input.prepStory.trim()}`,
    `Экзамен: ${input.examStory.trim()}`,
    ...(input.advice.trim() ? [`Совет: ${input.advice.trim()}`] : []),
  ].join('\n');

  const message = [
    `Направление / сессия: ${trackTitle}`,
    'Статус автора: Прошедший аттестацию инструктор-проводник',
    `Поток / удостоверение: ${sessionNote}`,
    `Оценка качества аттестационной сессии: ${examScore} из 5 (${RATING_TEXT[examScore]})`,
    `Оценка качества обучения и программы ДПО: ${prepScore} из 5 (${RATING_TEXT[prepScore]})`,
    `Оценка работы экспертов и комиссии: ${examScore} из 5 (${RATING_TEXT[examScore]})`,
    'Рекомендация: Рекомендует коллегам',
    `Регион пользователя: ${input.region.trim() || 'Приморский край'}`,
    `Комментарий: ${commentBlocks}`,
  ].join('\n');

  return {
    senderName: input.authorName.trim(),
    email: (input.email ?? '').trim(),
    feedbackType: 'center_review',
    platformModule: 'Обзор центра · Отзывы и истории успеха',
    subject: subject.slice(0, 160),
    message: message.slice(0, 1200),
  };
}

function extractCommentPart(comment: string, prefix: string): string {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = comment.match(
    new RegExp(
      `${escaped}\\s*([\\s\\S]*?)(?=(?:\\n\\s*(?:Подготовка:|Экзамен:|Совет:)|$))`,
      'i'
    )
  );
  return match?.[1]?.trim() ?? '';
}

/**
 * Converts persisted `/api/feedback/reviews` items submitted through the
 * "Отзывы и истории успеха" experience form into structured story cards.
 */
export function parseSuccessStoriesFromReviews(
  reviews: readonly InstructorReviewListItem[]
): SuccessStoryCardModel[] {
  const results: SuccessStoryCardModel[] = [];

  for (const review of reviews) {
    const isSuccessStory =
      /история успеха/i.test(review.sessionNote) ||
      (/подготовка:/i.test(review.comment) && /экзамен:/i.test(review.comment));

    if (!isSuccessStory) {
      continue;
    }

    const prepPart = extractCommentPart(review.comment, 'Подготовка:');
    const examPart = extractCommentPart(review.comment, 'Экзамен:');
    const advicePart = extractCommentPart(review.comment, 'Совет:');

    const contour = detectContour(`${review.sessionNote} ${review.sessionTrack}`);
    const hoursMatch = review.sessionNote.match(/(\d{1,4})\s*ч(?![а-яёa-z0-9])/i);
    const studyHours = hoursMatch ? Number(hoursMatch[1]) : contour === 'A' ? 40 : 250;

    const noteSegments = review.sessionNote
      .split('·')
      .map((s) => s.trim())
      .filter((s) => s && !/история успеха/i.test(s) && !/^\d+\s*ч$/i.test(s));

    const batchLabel =
      noteSegments.find((s) => !/контур/i.test(s)) || 'Аттестация 2026';

    results.push({
      id: review.id,
      authorName: review.authorName,
      region: review.region,
      track: detectTrack(review.sessionTrack),
      trackLabel: review.sessionTrack,
      contour,
      contourLabel: CONTOUR_LABELS[contour],
      batchLabel,
      studyHours,
      prepRating: review.trainingRating,
      examRating: review.sessionRating,
      outcomeMetric: 'История выпускника РЦА · Опыт подтверждён',
      prepStory: prepPart || review.comment,
      examStory:
        examPart ||
        'Экзаменационные испытания и защита маршрутных материалов на базе РЦА «Русский Восток» пройдены успешно.',
      advice:
        advicePart ||
        'Заранее проверьте комплект документов и потренируйтесь по вопросам самопроверки перед очной сессией.',
      createdAt: review.createdAt,
      source: 'community',
      verified: review.verifiedInstructor,
    });
  }

  return results;
}

export function mergeSuccessStories(
  communityStories: readonly SuccessStoryCardModel[],
  curatedStories: readonly SuccessStoryItem[]
): SuccessStoryCardModel[] {
  const seenIds = new Set<string>();
  const merged: SuccessStoryCardModel[] = [];

  for (const item of communityStories) {
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    merged.push(item);
  }

  for (const item of curatedStories) {
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    merged.push({
      ...item,
      source: 'curated',
      verified: true,
    });
  }

  return merged;
}

export function filterSuccessStories(
  stories: readonly SuccessStoryCardModel[],
  trackFilter: SuccessStoryTrackFilter,
  contourFilter: SuccessStoryContourFilter
): SuccessStoryCardModel[] {
  return stories.filter((story) => {
    if (trackFilter !== 'all' && story.track !== trackFilter) {
      return false;
    }
    if (contourFilter !== 'all' && story.contour !== contourFilter) {
      return false;
    }
    return true;
  });
}
