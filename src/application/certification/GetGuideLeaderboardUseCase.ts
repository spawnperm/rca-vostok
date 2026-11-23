import {
  rankCertifiedGuides,
  type GuideComplexity,
  type GuideLeaderboardRepository,
  type GuideLeaderboardSort,
  type GuideLeaderboardSummary,
  type GuideTrack,
  type RankedGuideEntry,
} from '../../domain/certification/GuideLeaderboard.ts';
import { ValidationError } from '../../domain/shared/DomainError.ts';

const ALLOWED_SORTS = new Set<GuideLeaderboardSort>(['routes', 'experience', 'composite']);
const ALLOWED_TRACKS = new Set<GuideTrack>(['hiking', 'water', 'expedition', 'ski', 'auto']);
const ALLOWED_COMPLEXITIES = new Set<GuideComplexity>(['1 КС', '2 КС', '3 КС', '4 КС']);

export interface GetGuideLeaderboardQuery {
  sortBy?: unknown;
  region?: unknown;
  track?: unknown;
  search?: unknown;
  limit?: unknown;
}

export interface GetGuideLeaderboardResult {
  guides: RankedGuideEntry[];
  summary: GuideLeaderboardSummary;
  availableRegions: string[];
  sortBy: GuideLeaderboardSort;
  sourceAdapter: string;
  generatedAt: string;
}

export interface SyncUserGuideStandingCommand {
  userId: string;
  fullName: string;
  region: string;
  organisation: string;
  certifiedRoutesCount: unknown;
  experienceYears: unknown;
  track?: unknown;
  maxComplexity?: unknown;
}

/**
 * Queries the active certified guides registry from persistence, applies
 * server-side filtering & ranking, and computes KPI aggregates.
 */
export class GetGuideLeaderboardUseCase {
  private readonly guideRepo: GuideLeaderboardRepository;
  private readonly sourceAdapter: string;

  constructor(guideRepo: GuideLeaderboardRepository, sourceAdapter = 'database') {
    this.guideRepo = guideRepo;
    this.sourceAdapter = sourceAdapter;
  }

  async execute(query: GetGuideLeaderboardQuery = {}): Promise<GetGuideLeaderboardResult> {
    const rawSort = typeof query.sortBy === 'string' ? query.sortBy.trim() : 'routes';
    const sortBy: GuideLeaderboardSort = ALLOWED_SORTS.has(rawSort as GuideLeaderboardSort)
      ? (rawSort as GuideLeaderboardSort)
      : 'routes';

    const rawRegion =
      typeof query.region === 'string' && query.region.trim().length > 0
        ? query.region.trim().slice(0, 80)
        : 'all';

    const rawTrack = typeof query.track === 'string' ? query.track.trim() : 'all';
    let track: GuideTrack | undefined;
    if (rawTrack && rawTrack !== 'all') {
      if (!ALLOWED_TRACKS.has(rawTrack as GuideTrack)) {
        throw new ValidationError('Некорректный фильтр специализации проводника.');
      }
      track = rawTrack as GuideTrack;
    }

    const search =
      typeof query.search === 'string' ? query.search.trim().slice(0, 80) : '';

    const rawLimit = Number(query.limit ?? 20);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(50, Math.round(rawLimit))) : 20;

    const allActive = await this.guideRepo.list({ activeOnly: true });
    const filtered = await this.guideRepo.list({
      activeOnly: true,
      region: rawRegion,
      track,
      search,
    });

    const { entries, summary } = rankCertifiedGuides(filtered, allActive, { sortBy, limit });
    const availableRegions = [...new Set(allActive.map((g) => g.region))].sort((a, b) =>
      a.localeCompare(b, 'ru')
    );

    return {
      guides: entries,
      summary,
      availableRegions,
      sortBy,
      sourceAdapter: this.sourceAdapter,
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Allows an authenticated cabinet user to synchronize their verified experience
 * and certified route count from their Digital Instructor Passport into the
 * regional database leaderboard.
 */
export class SyncMyGuideLeaderboardUseCase {
  private readonly guideRepo: GuideLeaderboardRepository;

  constructor(guideRepo: GuideLeaderboardRepository) {
    this.guideRepo = guideRepo;
  }

  async execute(cmd: SyncUserGuideStandingCommand) {
    const routes = Number(cmd.certifiedRoutesCount);
    const years = Number(cmd.experienceYears);

    if (!Number.isFinite(routes) || routes < 0 || routes > 200) {
      throw new ValidationError('Количество аттестованных маршрутов должно быть от 0 до 200.');
    }
    if (!Number.isFinite(years) || years < 0 || years > 60) {
      throw new ValidationError('Стаж проводника должен быть от 0 до 60 лет.');
    }

    const rawTrack = typeof cmd.track === 'string' ? cmd.track.trim() : 'hiking';
    const track: GuideTrack = ALLOWED_TRACKS.has(rawTrack as GuideTrack)
      ? (rawTrack as GuideTrack)
      : 'hiking';

    const rawComp = typeof cmd.maxComplexity === 'string' ? cmd.maxComplexity.trim() : '2 КС';
    const maxComplexity: GuideComplexity = ALLOWED_COMPLEXITIES.has(rawComp as GuideComplexity)
      ? (rawComp as GuideComplexity)
      : '2 КС';

    const cleanName = cmd.fullName.trim().slice(0, 120);
    if (cleanName.length < 2) {
      throw new ValidationError('Необходимо указать корректное ФИО профиля.');
    }

    const cleanRegion = cmd.region.trim().slice(0, 80) || 'Приморский край';
    const cleanOrg = cmd.organisation.trim().slice(0, 120) || 'РЦА «Русский Восток»';
    const suffix = cmd.userId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '0001';

    const record = {
      id: `guide-user-${cmd.userId}`,
      userId: cmd.userId,
      fullName: cleanName,
      region: cleanRegion,
      organisation: cleanOrg,
      track,
      certifiedRoutesCount: Math.round(routes),
      experienceYears: Math.round(years),
      maxComplexity,
      registryNumber: `МЭР-ЛК-${suffix}`,
      isActive: true,
      lastAttestationDate: new Date().toISOString().slice(0, 10),
    };

    await this.guideRepo.upsert(record);
    return record;
  }
}
