import {
  computeComplexityTierDistribution,
  computeJournalMetrics,
  forecastNextRouteComplexity,
  type ComplexityTierDistribution,
  type ExperienceJournalMetrics,
  type RouteComplexityForecastResult,
} from '../../domain/experience/ExperienceAnalyticsService.ts';
import {
  ExperienceEntry,
  getDefaultJournalEntries,
  type ExperienceLogEntry,
  type JournalEntryDraftInput,
} from '../../domain/experience/ExperienceEntry.ts';
import type { ExperienceJournalRepository } from '../../domain/experience/ExperienceJournalRepository.ts';
import { NotFoundError, type DomainEventBus } from '../../domain/shared/DomainError.ts';

export interface ExperienceJournalProjection {
  entries: ExperienceLogEntry[];
  metrics: ExperienceJournalMetrics;
  distribution: ComplexityTierDistribution;
  forecast: RouteComplexityForecastResult;
}

export function buildExperienceJournalProjection(
  entries: readonly ExperienceLogEntry[]
): ExperienceJournalProjection {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  return {
    entries: sorted,
    metrics: computeJournalMetrics(sorted),
    distribution: computeComplexityTierDistribution(sorted),
    forecast: forecastNextRouteComplexity(sorted),
  };
}

async function resolveOwnerEntries(
  repo: ExperienceJournalRepository,
  ownerId: string,
  preferredRegionName?: string
): Promise<ExperienceLogEntry[]> {
  const existing = await repo.listByOwner(ownerId);
  if (existing !== null) {
    return existing;
  }
  const seeded = getDefaultJournalEntries(preferredRegionName);
  await repo.saveByOwner(ownerId, seeded);
  return seeded;
}

export class GetExperienceJournalUseCase {
  private readonly repo: ExperienceJournalRepository;

  constructor(repo: ExperienceJournalRepository) {
    this.repo = repo;
  }

  async execute(params: {
    ownerId: string;
    preferredRegionName?: string;
  }): Promise<ExperienceJournalProjection> {
    const entries = await resolveOwnerEntries(
      this.repo,
      params.ownerId,
      params.preferredRegionName
    );
    return buildExperienceJournalProjection(entries);
  }
}

export class LogExpeditionUseCase {
  private readonly repo: ExperienceJournalRepository;
  private readonly eventBus?: DomainEventBus;

  constructor(repo: ExperienceJournalRepository, eventBus?: DomainEventBus) {
    this.repo = repo;
    this.eventBus = eventBus;
  }

  async execute(params: {
    ownerId: string;
    preferredRegionName?: string;
    input: JournalEntryDraftInput;
    now?: Date;
  }): Promise<{ entry: ExperienceLogEntry; projection: ExperienceJournalProjection }> {
    const entity = ExperienceEntry.create(params.input, params.now);
    const snapshot = entity.toSnapshot();

    const current = await resolveOwnerEntries(
      this.repo,
      params.ownerId,
      params.preferredRegionName
    );
    const updated = [snapshot, ...current].sort((a, b) => b.date.localeCompare(a.date));
    await this.repo.saveByOwner(params.ownerId, updated);

    this.eventBus?.publish({
      eventName: 'experience.expedition_logged',
      occurredAt: new Date().toISOString(),
      boundedContext: 'experience',
      payload: {
        ownerId: params.ownerId,
        entryId: snapshot.id,
        regionId: snapshot.regionId,
        complexity: snapshot.complexity,
        participantsCount: snapshot.participantsCount,
      },
    });

    return {
      entry: snapshot,
      projection: buildExperienceJournalProjection(updated),
    };
  }
}

export class RemoveExpeditionUseCase {
  private readonly repo: ExperienceJournalRepository;
  private readonly eventBus?: DomainEventBus;

  constructor(repo: ExperienceJournalRepository, eventBus?: DomainEventBus) {
    this.repo = repo;
    this.eventBus = eventBus;
  }

  async execute(params: {
    ownerId: string;
    entryId: string;
    preferredRegionName?: string;
  }): Promise<ExperienceJournalProjection> {
    const current = await resolveOwnerEntries(
      this.repo,
      params.ownerId,
      params.preferredRegionName
    );
    const exists = current.some((e) => e.id === params.entryId);
    if (!exists) {
      throw new NotFoundError('Запись о походе не найдена в журнале.');
    }

    const updated = current.filter((e) => e.id !== params.entryId);
    await this.repo.saveByOwner(params.ownerId, updated);

    this.eventBus?.publish({
      eventName: 'experience.expedition_removed',
      occurredAt: new Date().toISOString(),
      boundedContext: 'experience',
      payload: {
        ownerId: params.ownerId,
        entryId: params.entryId,
      },
    });

    return buildExperienceJournalProjection(updated);
  }
}

export class ResetExperienceJournalUseCase {
  private readonly repo: ExperienceJournalRepository;
  private readonly eventBus?: DomainEventBus;

  constructor(repo: ExperienceJournalRepository, eventBus?: DomainEventBus) {
    this.repo = repo;
    this.eventBus = eventBus;
  }

  async execute(params: {
    ownerId: string;
    preferredRegionName?: string;
  }): Promise<ExperienceJournalProjection> {
    const defaults = getDefaultJournalEntries(params.preferredRegionName);
    await this.repo.saveByOwner(params.ownerId, defaults);

    this.eventBus?.publish({
      eventName: 'experience.journal_reset',
      occurredAt: new Date().toISOString(),
      boundedContext: 'experience',
      payload: {
        ownerId: params.ownerId,
        entriesCount: defaults.length,
      },
    });

    return buildExperienceJournalProjection(defaults);
  }
}
