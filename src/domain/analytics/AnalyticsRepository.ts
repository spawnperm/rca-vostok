import type { AnalyticsStoreData, BehaviorEventDTO, VisitorSessionDTO } from './BehaviorModels.ts';
import type { AnalyticsSummaryDTO } from './AnalyticsAggregationService.ts';

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

  /**
   * Computes the dashboard summary.
   *
   * Optional: adapters that cannot aggregate in the database fall back to
   * `loadStore()` plus `AnalyticsAggregationService.summarize()`. The
   * PostgreSQL adapter implements it with SQL so the summary no longer has to
   * transfer up to 5000 events into the process just to count them.
   */
  loadSummary?(): Promise<AnalyticsSummaryDTO>;
}
