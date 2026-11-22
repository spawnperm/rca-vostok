import type { PlatformFeedback, PlatformFeedbackDTO } from './PlatformFeedback.ts';

/**
 * Persistence port for the platform feedback bounded context.
 *
 * Asynchronous because the production adapter is PostgreSQL-backed.
 */
export interface FeedbackRepository {
  loadAll(): Promise<PlatformFeedbackDTO[]>;
  save(feedback: PlatformFeedback): Promise<PlatformFeedbackDTO[]>;
  count(): Promise<number>;
}
