import {
  AnalyticsAggregationService,
  type AnalyticsSummaryDTO,
} from '../../domain/analytics/AnalyticsAggregationService.ts';
import type { AnalyticsRepository } from '../../domain/analytics/AnalyticsRepository.ts';
import {
  BehaviorEventFactory,
  parseUserAgentSummary,
  type BehaviorEventDTO,
  type VisitorSessionDTO,
} from '../../domain/analytics/BehaviorModels.ts';
import { NotFoundError, ValidationError, type DomainEventBus } from '../../domain/shared/DomainError.ts';
import { SanitizedText } from '../../domain/shared/ValueObjects.ts';

export interface CollectBehaviorCommand {
  sessionId?: unknown;
  visitorId?: unknown;
  viewport?: unknown;
  referrer?: unknown;
  utmSource?: unknown;
  events?: unknown;
  userAgent?: string;
}

export class CollectBehaviorUseCase {
  private readonly analyticsRepo: AnalyticsRepository;
  private readonly eventBus: DomainEventBus;

  constructor(analyticsRepo: AnalyticsRepository, eventBus: DomainEventBus) {
    this.analyticsRepo = analyticsRepo;
    this.eventBus = eventBus;
  }

  async execute(cmd: CollectBehaviorCommand): Promise<{ ok: true; accepted: number }> {
    const sessionId = SanitizedText.sanitizeRaw(cmd.sessionId, 64);
    const visitorId = SanitizedText.sanitizeRaw(cmd.visitorId, 64) || sessionId;
    if (!sessionId) {
      throw new ValidationError('sessionId is required');
    }

    const rawEvents = Array.isArray(cmd.events) ? cmd.events.slice(0, 50) : [];
    if (rawEvents.length === 0) {
      return { ok: true, accepted: 0 };
    }

    const ua = SanitizedText.sanitizeRaw(cmd.userAgent || '', 256);
    const { deviceType, browser } = parseUserAgentSummary(ua);
    const viewport = SanitizedText.sanitizeRaw(cmd.viewport, 32) || '1440x900';
    const referrerRaw = SanitizedText.sanitizeRaw(cmd.referrer, 200);
    let referrerLabel = 'Прямой заход';
    if (referrerRaw) {
      try {
        referrerLabel = new URL(referrerRaw).hostname;
      } catch {
        referrerLabel = referrerRaw.slice(0, 64);
      }
    }
    const utmSource = SanitizedText.sanitizeRaw(cmd.utmSource, 64);
    const nowIso = new Date().toISOString();

    const store = await this.analyticsRepo.loadStore();
    if (!store.sessions[sessionId]) {
      const firstTab =
        SanitizedText.sanitizeRaw((rawEvents[0] as { tab?: unknown })?.tab, 32) || 'overview';
      store.sessions[sessionId] = {
        sessionId,
        visitorId,
        startedAt: nowIso,
        lastSeenAt: nowIso,
        deviceType,
        browser,
        viewport,
        referrer: referrerLabel,
        utmSource,
        landingTab: firstTab,
        tabsVisited: [firstTab],
        maxScrollDepth: 0,
        durationSec: 0,
        eventCount: 0,
        clickCount: 0,
      };
    }

    const normalizedEvents: BehaviorEventDTO[] = [];
    for (let i = 0; i < rawEvents.length; i++) {
      const item = rawEvents[i];
      if (!item || typeof item !== 'object') continue;
      const cleanEvent = BehaviorEventFactory.createNormalized(
        item as Record<string, unknown>,
        sessionId,
        i,
        nowIso
      );
      if (cleanEvent) {
        normalizedEvents.push(cleanEvent);
        store.events.push(cleanEvent);
      }
    }

    if (normalizedEvents.length > 0) {
      AnalyticsAggregationService.applyEventsToSession(
        store.sessions[sessionId],
        normalizedEvents,
        nowIso,
        viewport
      );
      await this.analyticsRepo.saveStore(store);

      this.eventBus.publish({
        eventName: 'analytics.behavior_collected',
        occurredAt: nowIso,
        boundedContext: 'analytics',
        payload: {
          sessionId,
          accepted: normalizedEvents.length,
          deviceType,
        },
      });
    }

    return { ok: true, accepted: normalizedEvents.length };
  }
}

export class GetAnalyticsSummaryUseCase {
  private readonly analyticsRepo: AnalyticsRepository;

  constructor(analyticsRepo: AnalyticsRepository) {
    this.analyticsRepo = analyticsRepo;
  }

  async execute(): Promise<AnalyticsSummaryDTO> {
    // Prefer the adapter's own aggregation when it has one: the PostgreSQL
    // adapter computes the whole summary in SQL instead of shipping thousands
    // of event rows into Node. The in-memory fallback keeps behaviour identical
    // for development and tests.
    if (this.analyticsRepo.loadSummary) {
      return this.analyticsRepo.loadSummary();
    }
    const store = await this.analyticsRepo.loadStore();
    return AnalyticsAggregationService.summarize(store);
  }
}

export class GetSessionDetailsUseCase {
  private readonly analyticsRepo: AnalyticsRepository;

  constructor(analyticsRepo: AnalyticsRepository) {
    this.analyticsRepo = analyticsRepo;
  }

  async execute(
    sessionIdRaw: string
  ): Promise<{ session: VisitorSessionDTO; events: BehaviorEventDTO[] }> {
    const sessionId = SanitizedText.sanitizeRaw(sessionIdRaw, 64);
    const result = await this.analyticsRepo.getSession(sessionId);
    if (!result) {
      throw new NotFoundError('Session not found');
    }
    return result;
  }
}

export class ResetAnalyticsUseCase {
  private readonly analyticsRepo: AnalyticsRepository;

  constructor(analyticsRepo: AnalyticsRepository) {
    this.analyticsRepo = analyticsRepo;
  }

  async execute(): Promise<{ ok: true }> {
    await this.analyticsRepo.reset();
    return { ok: true };
  }
}
