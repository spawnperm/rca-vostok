import type { AnalyticsRepository } from '../../domain/analytics/AnalyticsRepository.ts';
import type { InquiryRepository } from '../../domain/certification/InquiryRepository.ts';

/**
 * Optional dependency checks.
 *
 * The health endpoint used to report `healthy` unconditionally, which made it
 * useless as a readiness signal: a dead database or an unreachable broker still
 * looked fine. Callers now supply probes and the status reflects them.
 */
export interface HealthProbes {
  /** Round-trips a trivial query against the database. */
  checkDatabase?: () => Promise<boolean>;
  /** Reports whether the event bus is connected. */
  checkEventBus?: () => Promise<boolean>;
  /** Reports whether the migrations applied match what this build expects. */
  checkMigrations?: () => Promise<boolean>;
  /** Checks connectivity/bucket health for Garage S3 or local object storage. */
  checkStorage?: () => Promise<boolean>;
  /**
   * Reports whether the Drizzle layer initialised.
   *
   * It selects its engine independently of the repositories (pg.Pool when a
   * database is configured, embedded PGlite otherwise), so a configuration
   * mistake can leave one working while the other is silently in the wrong
   * place.
   */
  checkDrizzle?: () => Promise<boolean>;
}

export interface DependencyStatus {
  ok: boolean;
  /** Milliseconds the probe took, when a probe ran. */
  latencyMs?: number;
}

export interface SystemHealthDTO {
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Always 200 unless the database is down; see the route for the mapping. */
  timestamp: string;
  architecture: {
    methodology: 'DDD + 11 Engineering Contours';
    boundedContexts: string[];
  };
  persistence: {
    adapter: string;
    storageProvider?: string;
  };
  dependencies: Record<string, DependencyStatus>;
  metrics: {
    inquiriesCount: number;
    sessionsCount: number;
    eventsCount: number;
  };
}

async function probe(fn?: () => Promise<boolean>): Promise<DependencyStatus | null> {
  if (!fn) return null;
  const started = Date.now();
  try {
    const ok = await fn();
    return { ok, latencyMs: Date.now() - started };
  } catch {
    return { ok: false, latencyMs: Date.now() - started };
  }
}

export class GetSystemHealthUseCase {
  private readonly inquiryRepo: InquiryRepository;
  private readonly analyticsRepo: AnalyticsRepository;
  private readonly adapterName: string;
  private readonly storageProvider: string;
  private readonly probes: HealthProbes;

  constructor(
    inquiryRepo: InquiryRepository,
    analyticsRepo: AnalyticsRepository,
    adapterName = 'unknown',
    probes: HealthProbes = {},
    storageProvider = 'local-disk'
  ) {
    this.inquiryRepo = inquiryRepo;
    this.analyticsRepo = analyticsRepo;
    this.adapterName = adapterName;
    this.probes = probes;
    this.storageProvider = storageProvider;
  }

  async execute(): Promise<SystemHealthDTO> {
    const [database, eventBus, migrations, objectStorage, drizzle] = await Promise.all([
      probe(this.probes.checkDatabase),
      probe(this.probes.checkEventBus),
      probe(this.probes.checkMigrations),
      probe(this.probes.checkStorage),
      probe(this.probes.checkDrizzle),
    ]);

    const dependencies: Record<string, DependencyStatus> = {};
    if (database) dependencies.database = database;
    if (eventBus) dependencies.eventBus = eventBus;
    if (migrations) dependencies.migrations = migrations;
    if (drizzle) dependencies.drizzle = drizzle;
    if (objectStorage) dependencies.objectStorage = objectStorage;

    // Database is the only hard dependency: without it nothing works. The bus
    // and optional storage probes lower status to degraded when unreachable.
    const databaseOk = dependencies.database?.ok !== false;
    const anyDegraded = Object.values(dependencies).some((d) => !d.ok);

    const status: SystemHealthDTO['status'] = !databaseOk
      ? 'unhealthy'
      : anyDegraded
        ? 'degraded'
        : 'healthy';

    // Counts are best-effort: when the database is down they read as zero
    // rather than throwing, so the endpoint still answers with a diagnosis.
    let inquiriesCount = 0;
    let sessionsCount = 0;
    let eventsCount = 0;
    if (databaseOk) {
      try {
        const store = await this.analyticsRepo.loadStore();
        sessionsCount = Object.keys(store.sessions).length;
        eventsCount = store.events.length;
        inquiriesCount = await this.inquiryRepo.count();
      } catch {
        // Leave the counters at zero; the dependency block already says why.
      }
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      architecture: {
        methodology: 'DDD + 11 Engineering Contours',
        boundedContexts: [
          'certification',
          'analytics',
          'research',
          'feedback',
          'identity',
          'experience',
          'social',
          'chat',
          'media',
        ],
      },
      persistence: { adapter: this.adapterName, storageProvider: this.storageProvider },
      dependencies,
      metrics: { inquiriesCount, sessionsCount, eventsCount },
    };
  }
}
