import fs from 'fs';
import type { AnalyticsRepository } from '../../domain/analytics/AnalyticsRepository.ts';
import type {
  AnalyticsStoreData,
  BehaviorEventDTO,
  VisitorSessionDTO,
} from '../../domain/analytics/BehaviorModels.ts';
import { atomicWriteJson, ensureDirectory, resolveConfinedPath } from './PathConfinement.ts';

/**
 * File-backed analytics adapter. Used for local development and tests.
 * Production runs the PostgreSQL adapter instead.
 */
export class JsonFileAnalyticsRepository implements AnalyticsRepository {
  private readonly dataDir: string;
  private readonly fileName: string;
  private readonly tempFileName: string;
  private cache: AnalyticsStoreData | null = null;

  constructor(dataDir: string, fileName = 'analytics-store.json') {
    this.dataDir = dataDir;
    this.fileName = fileName;
    this.tempFileName = `${fileName}.tmp`;
  }

  async loadStore(): Promise<AnalyticsStoreData> {
    if (this.cache) {
      return this.cache;
    }
    ensureDirectory(this.dataDir);
    const targetPath = resolveConfinedPath(this.dataDir, this.fileName);
    if (!fs.existsSync(targetPath)) {
      this.cache = { sessions: {}, events: [] };
      return this.cache;
    }
    try {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<AnalyticsStoreData>;
      this.cache = {
        sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {},
        events: Array.isArray(parsed.events) ? parsed.events : [],
      };
      return this.cache;
    } catch {
      this.cache = { sessions: {}, events: [] };
      return this.cache;
    }
  }

  async saveStore(store: AnalyticsStoreData): Promise<void> {
    const sessionEntries = Object.entries(store.sessions)
      .sort((a, b) => (a[1].lastSeenAt < b[1].lastSeenAt ? 1 : -1))
      .slice(0, 500);
    const trimmedSessions: Record<string, VisitorSessionDTO> = Object.fromEntries(sessionEntries);
    const trimmedEvents = store.events.slice(-5000);
    const boundedStore: AnalyticsStoreData = {
      sessions: trimmedSessions,
      events: trimmedEvents,
    };

    this.cache = boundedStore;
    atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, boundedStore);
  }

  async reset(): Promise<void> {
    const empty: AnalyticsStoreData = { sessions: {}, events: [] };
    this.cache = empty;
    atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, empty);
  }

  async getSession(
    sessionId: string
  ): Promise<{ session: VisitorSessionDTO; events: BehaviorEventDTO[] } | null> {
    const store = await this.loadStore();
    const session = store.sessions[sessionId];
    if (!session) return null;
    const events = store.events.filter((e) => e.sessionId === sessionId);
    return { session, events };
  }
}
