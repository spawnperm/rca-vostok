import type { AnalyticsStoreData, BehaviorEventDTO, VisitorSessionDTO } from './BehaviorModels.ts';

export interface AnalyticsRepository {
  loadStore(): AnalyticsStoreData;
  saveStore(store: AnalyticsStoreData): void;
  reset(): void;
  getSession(sessionId: string): { session: VisitorSessionDTO; events: BehaviorEventDTO[] } | null;
}
