import type { PlatformFeedback, PlatformFeedbackDTO } from './PlatformFeedback.ts';

export interface FeedbackRepository {
  loadAll(): PlatformFeedbackDTO[];
  save(feedback: PlatformFeedback): PlatformFeedbackDTO[];
  count(): number;
}
