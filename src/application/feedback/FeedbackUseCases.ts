import {
  PlatformFeedback,
  type CreatePlatformFeedbackInput,
} from '../../domain/feedback/PlatformFeedback.ts';
import type { FeedbackRepository } from '../../domain/feedback/FeedbackRepository.ts';
import type { DomainEventBus } from '../../domain/shared/DomainError.ts';

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
