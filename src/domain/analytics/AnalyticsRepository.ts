import type { AnalyticsStoreData, BehaviorEventDTO, VisitorSessionDTO } from './BehaviorModels.ts';

/**
 * Persistence port for the analytics bounded context.
 *
 * Operations are asynchronous because the production adapter is backed by
 * PostgreSQL: every call performs network I/O and must not block the event
 * loop. In-memory adapters simply return already-resolved promises.
 */
export interface AnalyticsRepository {
  loadStore(): Promise<AnalyticsStoreData>;
  saveStore(store: AnalyticsStoreData): Promise<void>;
  reset(): Promise<void>;
  getSession(
    sessionId: string
  ): Promise<{ session: VisitorSessionDTO; events: BehaviorEventDTO[] } | null>;
}
