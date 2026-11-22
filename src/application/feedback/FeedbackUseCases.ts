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

function clampRating(raw: string | undefined): number | null {
  if (!raw) return null;
  const num = Number(raw);
  if (!Number.isInteger(num) || num < 1 || num > 5) return null;
  return num;
}

export function parseReviewRatingsFromRecord(record: PlatformFeedbackDTO): {
  sessionRating: number | null;
  expertsRating: number | null;
  recommended: boolean;
} {
  const subjectMatch = record.subject.match(/\((\d)\/5\s+сессия,\s*(\d)\/5\s+эксперты\)/i);
  const sessionMsgMatch = record.message.match(/Оценка качества аттестационной сессии:\s*(\d)\s*из\s*5/i);
  const expertsMsgMatch = record.message.match(/Оценка работы экспертов и комиссии:\s*(\d)\s*из\s*5/i);

  const sessionRating =
    clampRating(sessionMsgMatch?.[1]) ?? clampRating(subjectMatch?.[1]);
  const expertsRating =
    clampRating(expertsMsgMatch?.[1]) ?? clampRating(subjectMatch?.[2]);
  const recommended =
    /Рекомендация:\s*(Рекомендует коллегам|Скорее рекомендует)/i.test(record.message);

  return { sessionRating, expertsRating, recommended };
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
