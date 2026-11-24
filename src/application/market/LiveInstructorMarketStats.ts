import { DFO_REGIONS_DISTRIBUTION } from '../../data/researchData.ts';
import {
  GUIDE_TRACK_LABELS,
  type GuideLeaderboardRepository,
  type GuideTrack,
} from '../../domain/certification/GuideLeaderboard.ts';
import type { InquiryRepository } from '../../domain/certification/InquiryRepository.ts';
import type { DomainEvent, DomainEventBus } from '../../domain/shared/DomainError.ts';

export interface LiveMarketRegionRow {
  id: string;
  name: string;
  shortName: string;
  certifiedInRegistry: number;
  estimatedDemand: number;
  deficitCount: number;
  coveragePct: number;
  activeInquiries: number;
  leaderboardGuides: number;
  keyTracks: string;
}

export interface LiveMarketTrackRow {
  trackId: string;
  label: string;
  guidesCount: number;
  inquiriesCount: number;
  totalActivity: number;
  sharePct: number;
}

export interface LiveMarketEventItem {
  id: string;
  eventName: string;
  title: string;
  detail: string;
  occurredAt: string;
}

export interface LiveMarketHeadline {
  totalCertifiedInDfo: number;
  totalEstimatedDemand: number;
  marketDeficitCount: number;
  coveragePercent: number;
  activeInquiriesCount: number;
  totalInquiriesCount: number;
  approvedInquiriesCount: number;
  activeLeaderboardGuides: number;
  totalCertifiedRoutes: number;
  avgExperienceYears: number;
  avgReadinessPct: number;
  readinessResponsesCount: number;
}

export interface LiveInstructorMarketSnapshot {
  updatedAt: string;
  storageBackend: string;
  headline: LiveMarketHeadline;
  regions: LiveMarketRegionRow[];
  tracks: LiveMarketTrackRow[];
  recentEvents: LiveMarketEventItem[];
}

export interface ReadinessStatsReader {
  getStats(): {
    totalResponses: number;
    averageReadinessPct: number;
  };
}

const REGION_ALIASES: Record<string, readonly string[]> = {
  primorye: ['примор', 'владивосток'],
  kamchatka: ['камчат'],
  khabarovsk: ['хабаров'],
  sakhalin: ['сахалин', 'курил'],
  yakutia: ['якут', 'саха'],
  amur: ['амур'],
  'magadan-chukotka': ['магадан', 'чукот'],
};

function matchRegionId(rawRegion: string | null | undefined): string | null {
  const norm = (rawRegion ?? '').toLowerCase();
  if (!norm) return null;
  for (const [id, keywords] of Object.entries(REGION_ALIASES)) {
    if (keywords.some((kw) => norm.includes(kw))) {
      return id;
    }
  }
  return null;
}

function mapInquiryTrackToGuideTrack(rawTrack: string): { id: string; label: string } {
  const norm = rawTrack.toLowerCase();
  if (norm.includes('водн') || norm.includes('сплав')) {
    return { id: 'water', label: GUIDE_TRACK_LABELS.water };
  }
  if (norm.includes('экспедиц') || norm.includes('оопт')) {
    return { id: 'expedition', label: GUIDE_TRACK_LABELS.expedition };
  }
  if (norm.includes('лыж') || norm.includes('зимн')) {
    return { id: 'ski', label: GUIDE_TRACK_LABELS.ski };
  }
  if (norm.includes('авто') || norm.includes('джип')) {
    return { id: 'auto', label: GUIDE_TRACK_LABELS.auto };
  }
  if (norm.includes('переаттестац')) {
    return { id: 'reattestation', label: 'Переаттестация гидов' };
  }
  return { id: 'hiking', label: GUIDE_TRACK_LABELS.hiking };
}

export function formatDomainEventToMarketItem(event: DomainEvent): LiveMarketEventItem | null {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const region = typeof payload.region === 'string' && payload.region ? payload.region : 'ДФО';
  const track = typeof payload.track === 'string' && payload.track ? payload.track : '';
  const id = `${event.eventName}-${event.occurredAt}`;

  switch (event.eventName) {
    case 'certification.inquiry_submitted':
      return {
        id,
        eventName: event.eventName,
        title: 'Новая заявка на аттестацию',
        detail: track ? `${region} · ${track}` : region,
        occurredAt: event.occurredAt,
      };
    case 'certification.inquiry_status_changed':
      return {
        id,
        eventName: event.eventName,
        title: 'Обновлён статус заявки в комиссии',
        detail:
          typeof payload.nextStatus === 'string'
            ? `Статус: ${payload.nextStatus}`
            : 'Изменение статуса рассмотрения',
        occurredAt: event.occurredAt,
      };
    case 'experience.expedition_logged':
      return {
        id,
        eventName: event.eventName,
        title: 'Зафиксирован маршрут в журнале стажа',
        detail:
          typeof payload.complexity === 'string'
            ? `${region} · ${payload.complexity}`
            : region,
        occurredAt: event.occurredAt,
      };
    case 'market.readiness_survey_submitted':
      return {
        id,
        eventName: event.eventName,
        title: 'Обновлена оценка готовности соискателя',
        detail:
          typeof payload.readinessPct === 'number'
            ? `${region} · готовность ${payload.readinessPct}%`
            : region,
        occurredAt: event.occurredAt,
      };
    case 'market.leaderboard_synced':
      return {
        id,
        eventName: event.eventName,
        title: 'Обновлён профиль активного проводника',
        detail: region,
        occurredAt: event.occurredAt,
      };
    case 'feedback.submitted':
      return {
        id,
        eventName: event.eventName,
        title: 'Поступил отзыв о работе центра',
        detail:
          typeof payload.platformModule === 'string' ? payload.platformModule : 'Портал РЦА',
        occurredAt: event.occurredAt,
      };
    default:
      return null;
  }
}

export class LiveMarketEventBuffer {
  private readonly items: LiveMarketEventItem[] = [];
  private readonly maxItems: number;

  constructor(maxItems = 10) {
    this.maxItems = maxItems;
  }

  attach(eventBus: DomainEventBus, onMarketEvent: () => void): () => void {
    const subscribedEvents = [
      'certification.inquiry_submitted',
      'certification.inquiry_status_changed',
      'experience.expedition_logged',
      'market.readiness_survey_submitted',
      'market.leaderboard_synced',
      'feedback.submitted',
    ];

    const unsubscribers = subscribedEvents.map((eventName) =>
      eventBus.subscribe(eventName, (event) => {
        const formatted = formatDomainEventToMarketItem(event);
        if (formatted) {
          this.push(formatted);
        }
        onMarketEvent();
      })
    );

    return () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
    };
  }

  push(item: LiveMarketEventItem): void {
    this.items.unshift(item);
    if (this.items.length > this.maxItems) {
      this.items.length = this.maxItems;
    }
  }

  list(): LiveMarketEventItem[] {
    return [...this.items];
  }
}

export class GetLiveInstructorMarketStatsUseCase {
  private readonly inquiries: InquiryRepository;
  private readonly leaderboard: GuideLeaderboardRepository;
  private readonly readinessSurvey: ReadinessStatsReader;
  private readonly eventBuffer: LiveMarketEventBuffer;
  private readonly storageBackend: string;

  constructor(
    inquiries: InquiryRepository,
    leaderboard: GuideLeaderboardRepository,
    readinessSurvey: ReadinessStatsReader,
    eventBuffer: LiveMarketEventBuffer,
    storageBackend: string
  ) {
    this.inquiries = inquiries;
    this.leaderboard = leaderboard;
    this.readinessSurvey = readinessSurvey;
    this.eventBuffer = eventBuffer;
    this.storageBackend = storageBackend;
  }

  async execute(now: Date = new Date()): Promise<LiveInstructorMarketSnapshot> {
    const [allInquiries, activeGuides] = await Promise.all([
      this.inquiries.loadAll(),
      this.leaderboard.list({ activeOnly: true }),
    ]);

    const readinessStats = this.readinessSurvey.getStats();

    // Aggregate inquiry counts by status and region
    let approvedInquiriesCount = 0;
    let activeInquiriesCount = 0;
    const inquiriesByRegionId = new Map<string, number>();
    const approvedByRegionId = new Map<string, number>();
    const trackCounts = new Map<
      string,
      { label: string; guidesCount: number; inquiriesCount: number }
    >();

    for (const trackKey of Object.keys(GUIDE_TRACK_LABELS) as GuideTrack[]) {
      trackCounts.set(trackKey, {
        label: GUIDE_TRACK_LABELS[trackKey],
        guidesCount: 0,
        inquiriesCount: 0,
      });
    }

    for (const inq of allInquiries) {
      const status = inq.status;
      if (status === 'approved') {
        approvedInquiriesCount += 1;
      }
      if (status === 'new' || status === 'in_review' || status === 'needs_documents') {
        activeInquiriesCount += 1;
      }

      const rId = matchRegionId(inq.region);
      if (rId) {
        if (status === 'new' || status === 'in_review' || status === 'needs_documents') {
          inquiriesByRegionId.set(rId, (inquiriesByRegionId.get(rId) ?? 0) + 1);
        }
        if (status === 'approved') {
          approvedByRegionId.set(rId, (approvedByRegionId.get(rId) ?? 0) + 1);
        }
      }

      const mappedTrack = mapInquiryTrackToGuideTrack(inq.track);
      const existing = trackCounts.get(mappedTrack.id) ?? {
        label: mappedTrack.label,
        guidesCount: 0,
        inquiriesCount: 0,
      };
      existing.inquiriesCount += 1;
      trackCounts.set(mappedTrack.id, existing);
    }

    // Aggregate active certified leaderboard guides
    const guidesByRegionId = new Map<string, number>();
    let totalCertifiedRoutes = 0;
    let totalExpYears = 0;

    for (const guide of activeGuides) {
      totalCertifiedRoutes += guide.certifiedRoutesCount;
      totalExpYears += guide.experienceYears;

      const rId = matchRegionId(guide.region);
      if (rId) {
        guidesByRegionId.set(rId, (guidesByRegionId.get(rId) ?? 0) + 1);
      }

      const existing = trackCounts.get(guide.track) ?? {
        label: GUIDE_TRACK_LABELS[guide.track],
        guidesCount: 0,
        inquiriesCount: 0,
      };
      existing.guidesCount += 1;
      trackCounts.set(guide.track, existing);
    }

    // Build per-region rows (base ЕФРТА registry + newly approved applicants in RЦА)
    const regions: LiveMarketRegionRow[] = DFO_REGIONS_DISTRIBUTION.map((baseRegion) => {
      const dynamicApproved = approvedByRegionId.get(baseRegion.id) ?? 0;
      const certifiedInRegistry = baseRegion.certifiedInRegistry + dynamicApproved;
      const estimatedDemand = baseRegion.estimatedDemand;
      const deficitCount = Math.max(0, estimatedDemand - certifiedInRegistry);
      const coveragePct =
        estimatedDemand > 0
          ? Math.round((certifiedInRegistry / estimatedDemand) * 1000) / 10
          : 0;

      return {
        id: baseRegion.id,
        name: baseRegion.name,
        shortName: baseRegion.shortName,
        certifiedInRegistry,
        estimatedDemand,
        deficitCount,
        coveragePct,
        activeInquiries: inquiriesByRegionId.get(baseRegion.id) ?? 0,
        leaderboardGuides: guidesByRegionId.get(baseRegion.id) ?? 0,
        keyTracks: baseRegion.keyTracks,
      };
    });

    const totalCertifiedInDfo = regions.reduce((sum, r) => sum + r.certifiedInRegistry, 0);
    const totalEstimatedDemand = regions.reduce((sum, r) => sum + r.estimatedDemand, 0);
    const marketDeficitCount = Math.max(0, totalEstimatedDemand - totalCertifiedInDfo);
    const coveragePercent =
      totalEstimatedDemand > 0
        ? Math.round((totalCertifiedInDfo / totalEstimatedDemand) * 1000) / 10
        : 0;

    const totalTrackActivity = Array.from(trackCounts.values()).reduce(
      (sum, t) => sum + t.guidesCount + t.inquiriesCount,
      0
    );

    const tracks: LiveMarketTrackRow[] = Array.from(trackCounts.entries())
      .map(([trackId, data]) => {
        const totalActivity = data.guidesCount + data.inquiriesCount;
        const sharePct =
          totalTrackActivity > 0
            ? Math.round((totalActivity / totalTrackActivity) * 100)
            : 0;
        return {
          trackId,
          label: data.label,
          guidesCount: data.guidesCount,
          inquiriesCount: data.inquiriesCount,
          totalActivity,
          sharePct,
        };
      })
      .filter((t) => t.totalActivity > 0)
      .sort((a, b) => b.totalActivity - a.totalActivity);

    const avgExperienceYears =
      activeGuides.length > 0
        ? Math.round((totalExpYears / activeGuides.length) * 10) / 10
        : 0;

    return {
      updatedAt: now.toISOString(),
      storageBackend: this.storageBackend,
      headline: {
        totalCertifiedInDfo,
        totalEstimatedDemand,
        marketDeficitCount,
        coveragePercent,
        activeInquiriesCount,
        totalInquiriesCount: allInquiries.length,
        approvedInquiriesCount,
        activeLeaderboardGuides: activeGuides.length,
        totalCertifiedRoutes,
        avgExperienceYears,
        avgReadinessPct: readinessStats.averageReadinessPct,
        readinessResponsesCount: readinessStats.totalResponses,
      },
      regions,
      tracks,
      recentEvents: this.eventBuffer.list(),
    };
  }
}
