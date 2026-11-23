import {
  PlatformFeedback,
  type CreatePlatformFeedbackInput,
  type PlatformFeedbackDTO,
} from '../../domain/feedback/PlatformFeedback.ts';
import type { FeedbackRepository } from '../../domain/feedback/FeedbackRepository.ts';
import type { DomainEventBus } from '../../domain/shared/DomainError.ts';

export interface CenterReviewRatingBucket {
  score: number;
  label: string;
  sessionCount: number;
  expertsCount: number;
}

export interface CenterReviewsStats {
  totalReviews: number;
  sessionAverage: number | null;
  expertsAverage: number | null;
  recommendationCount: number;
  distribution: CenterReviewRatingBucket[];
}

export interface CenterReviewItem {
  id: string;
  authorName: string;
  region: string;
  sessionTrack: string;
  sessionRating: number;
  trainingRating: number;
  expertsRating: number;
  overallRating: number;
  recommended: boolean;
  recommendLabel: string;
  verifiedInstructor: boolean;
  sessionNote: string;
  comment: string;
  createdAt: string;
}

export interface ListCenterReviewsResult {
  reviews: CenterReviewItem[];
  total: number;
  averageOverall: number | null;
  averageProcess: number | null;
  averageTraining: number | null;
  averageExperts: number | null;
  recommendationRate: number | null;
}

function clampRating(raw: string | undefined): number | null {
  if (!raw) return null;
  const num = Number(raw);
  if (!Number.isInteger(num) || num < 1 || num > 5) return null;
  return num;
}

const REVIEW_FIELD_MARKERS = [
  'Направление / сессия:',
  'Статус автора:',
  'Поток / удостоверение:',
  'Оценка качества аттестационной сессии:',
  'Оценка качества обучения и программы ДПО:',
  'Оценка качества обучения:',
  'Оценка работы экспертов и комиссии:',
  'Рекомендация:',
  'Регион пользователя:',
  'Комментарий:',
] as const;

const MARKER_LOOKAHEAD = REVIEW_FIELD_MARKERS.map((m) =>
  m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
).join('|');

function extractLineField(message: string, prefix: string): string {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = message.match(
    new RegExp(`${escaped}\\s*([\\s\\S]*?)(?=(?:\\s*(?:${MARKER_LOOKAHEAD})|$))`, 'i')
  );
  return match?.[1]?.trim() ?? '';
}

function extractComment(message: string): string {
  const match = message.match(/Комментарий:\s*([\s\S]*)$/i);
  if (match) {
    return match[1].trim();
  }
  return message.trim();
}

export function parseReviewRatingsFromRecord(record: PlatformFeedbackDTO): {
  sessionRating: number | null;
  trainingRating: number | null;
  expertsRating: number | null;
  recommended: boolean;
} {
  const subjectMatch = record.subject.match(/\((\d)\/5\s+сессия,\s*(\d)\/5\s+эксперты\)/i);
  const sessionMsgMatch = record.message.match(/Оценка качества аттестационной сессии:\s*(\d)\s*из\s*5/i);
  const trainingMsgMatch = record.message.match(/Оценка качества обучения(?:\s+и\s+программы\s+ДПО)?:\s*(\d)\s*из\s*5/i);
  const expertsMsgMatch = record.message.match(/Оценка работы экспертов и комиссии:\s*(\d)\s*из\s*5/i);

  const sessionRating =
    clampRating(sessionMsgMatch?.[1]) ?? clampRating(subjectMatch?.[1]);
  const expertsRating =
    clampRating(expertsMsgMatch?.[1]) ?? clampRating(subjectMatch?.[2]);
  const trainingRating =
    clampRating(trainingMsgMatch?.[1]) ?? expertsRating ?? sessionRating;
  const recommended =
    /Рекомендация:\s*(Рекомендует коллегам|Скорее рекомендует)/i.test(record.message);

  return { sessionRating, trainingRating, expertsRating, recommended };
}

export class SubmitFeedbackUseCase {
  private readonly feedbackRepo: FeedbackRepository;
  private readonly eventBus: DomainEventBus;

  constructor(feedbackRepo: FeedbackRepository, eventBus: DomainEventBus) {
    this.feedbackRepo = feedbackRepo;
    this.eventBus = eventBus;
  }

  async execute(input: CreatePlatformFeedbackInput): Promise<{
    ok: true;
    id: string;
    createdAt: string;
    totalFeedback: number;
  }> {
    const feedback = PlatformFeedback.create(input);
    const allRecords = await this.feedbackRepo.save(feedback);

    this.eventBus.publish({
      eventName: 'platform.feedback_submitted',
      occurredAt: feedback.createdAt,
      boundedContext: 'feedback',
      payload: {
        feedbackId: feedback.id,
        feedbackType: feedback.feedbackType,
        platformModule: feedback.platformModule,
        totalFeedback: allRecords.length,
      },
    });

    return {
      ok: true,
      id: feedback.id,
      createdAt: feedback.createdAt,
      totalFeedback: allRecords.length,
    };
  }
}

export class GetFeedbackStatsUseCase {
  private readonly feedbackRepo: FeedbackRepository;

  constructor(feedbackRepo: FeedbackRepository) {
    this.feedbackRepo = feedbackRepo;
  }

  async execute(): Promise<{ totalFeedback: number }> {
    return {
      totalFeedback: await this.feedbackRepo.count(),
    };
  }
}

export class GetCenterReviewsStatsUseCase {
  private readonly feedbackRepo: FeedbackRepository;

  constructor(feedbackRepo: FeedbackRepository) {
    this.feedbackRepo = feedbackRepo;
  }

  async execute(): Promise<CenterReviewsStats> {
    const records = await this.feedbackRepo.loadAll();
    const reviews = records.filter((r) => r.feedbackType === 'center_review');

    const distribution: CenterReviewRatingBucket[] = [1, 2, 3, 4, 5].map((score) => ({
      score,
      label: `${score} ★`,
      sessionCount: 0,
      expertsCount: 0,
    }));

    let sessionSum = 0;
    let sessionTotal = 0;
    let expertsSum = 0;
    let expertsTotal = 0;
    let recommendationCount = 0;

    for (const review of reviews) {
      const { sessionRating, expertsRating, recommended } = parseReviewRatingsFromRecord(review);
      if (sessionRating !== null) {
        distribution[sessionRating - 1].sessionCount += 1;
        sessionSum += sessionRating;
        sessionTotal += 1;
      }
      if (expertsRating !== null) {
        distribution[expertsRating - 1].expertsCount += 1;
        expertsSum += expertsRating;
        expertsTotal += 1;
      }
      if (recommended) {
        recommendationCount += 1;
      }
    }

    return {
      totalReviews: reviews.length,
      sessionAverage:
        sessionTotal > 0 ? Math.round((sessionSum / sessionTotal) * 100) / 100 : null,
      expertsAverage:
        expertsTotal > 0 ? Math.round((expertsSum / expertsTotal) * 100) / 100 : null,
      recommendationCount,
      distribution,
    };
  }
}

export class ListCenterReviewsUseCase {
  private readonly feedbackRepo: FeedbackRepository;

  constructor(feedbackRepo: FeedbackRepository) {
    this.feedbackRepo = feedbackRepo;
  }

  async execute(options?: {
    track?: unknown;
    minRating?: unknown;
    limit?: unknown;
  }): Promise<ListCenterReviewsResult> {
    const records = await this.feedbackRepo.loadAll();
    const reviewRecords = records.filter((r) => r.feedbackType === 'center_review');

    const parsedItems: CenterReviewItem[] = reviewRecords
      .map((record) => {
        const { sessionRating, trainingRating, expertsRating, recommended } =
          parseReviewRatingsFromRecord(record);
        const effectiveSession = sessionRating ?? 5;
        const effectiveExperts = expertsRating ?? effectiveSession;
        const effectiveTraining = trainingRating ?? effectiveExperts;
        const overallRating =
          Math.round(((effectiveSession + effectiveTraining + effectiveExperts) / 3) * 10) / 10;

        const sessionTrack =
          extractLineField(record.message, 'Направление / сессия:') ||
          record.subject.split('·').slice(1).join('·').trim() ||
          'Аттестация РЦА «Русский Восток»';
        const region =
          extractLineField(record.message, 'Регион пользователя:') || 'ДФО';
        const recommendLabel =
          extractLineField(record.message, 'Рекомендация:') ||
          (recommended ? 'Рекомендует коллегам' : 'Есть замечания');
        const statusLine = extractLineField(record.message, 'Статус автора:');
        const sessionNote = extractLineField(record.message, 'Поток / удостоверение:');
        const verifiedInstructor =
          statusLine.length === 0 ||
          /аттестован|инструктор|подтвержд/i.test(statusLine);

        return {
          id: record.id,
          authorName: record.senderName,
          region,
          sessionTrack,
          sessionRating: effectiveSession,
          trainingRating: effectiveTraining,
          expertsRating: effectiveExperts,
          overallRating,
          recommended,
          recommendLabel,
          verifiedInstructor,
          sessionNote,
          comment: extractComment(record.message),
          createdAt: record.createdAt,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = parsedItems.length;
    const sumProcess = parsedItems.reduce((acc, r) => acc + r.sessionRating, 0);
    const sumTraining = parsedItems.reduce((acc, r) => acc + r.trainingRating, 0);
    const sumExperts = parsedItems.reduce((acc, r) => acc + r.expertsRating, 0);
    const sumOverall = parsedItems.reduce((acc, r) => acc + r.overallRating, 0);
    const recommendedCount = parsedItems.filter((r) => r.recommended).length;

    const trackFilter =
      typeof options?.track === 'string' ? options.track.trim().toLowerCase() : '';
    const minRatingRaw = Number(options?.minRating);
    const minRating =
      Number.isFinite(minRatingRaw) && minRatingRaw >= 1 && minRatingRaw <= 5
        ? minRatingRaw
        : 0;
    const limitRaw = Number(options?.limit);
    const limit =
      Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;

    const filtered = parsedItems
      .filter((item) => {
        if (trackFilter && trackFilter !== 'all') {
          if (!item.sessionTrack.toLowerCase().includes(trackFilter)) {
            return false;
          }
        }
        if (minRating > 0 && item.overallRating < minRating) {
          return false;
        }
        return true;
      })
      .slice(0, limit);

    return {
      reviews: filtered,
      total,
      averageOverall:
        total > 0 ? Math.round((sumOverall / total) * 100) / 100 : null,
      averageProcess:
        total > 0 ? Math.round((sumProcess / total) * 100) / 100 : null,
      averageTraining:
        total > 0 ? Math.round((sumTraining / total) * 100) / 100 : null,
      averageExperts:
        total > 0 ? Math.round((sumExperts / total) * 100) / 100 : null,
      recommendationRate:
        total > 0 ? Math.round((recommendedCount / total) * 100) : null,
    };
  }
}
