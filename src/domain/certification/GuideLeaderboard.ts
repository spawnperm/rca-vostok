export type GuideTrack = 'hiking' | 'water' | 'expedition' | 'ski' | 'auto';
export type GuideComplexity = '1 КС' | '2 КС' | '3 КС' | '4 КС';
export type GuideLeaderboardSort = 'routes' | 'experience' | 'composite';

export const GUIDE_TRACK_LABELS: Record<GuideTrack, string> = {
  hiking: 'Пешеходный и горный',
  water: 'Водный и сплавы',
  expedition: 'Экспедиционный / ООПТ',
  ski: 'Горно-таёжный / лыжный',
  auto: 'Автотуризм и джип-туры',
};

export interface CertifiedGuideRecord {
  id: string;
  userId: string | null;
  fullName: string;
  region: string;
  organisation: string;
  track: GuideTrack;
  certifiedRoutesCount: number;
  experienceYears: number;
  maxComplexity: GuideComplexity;
  registryNumber: string;
  isActive: boolean;
  lastAttestationDate: string;
}

export interface GuideLeaderboardFilter {
  region?: string;
  track?: GuideTrack;
  search?: string;
  activeOnly?: boolean;
}

export interface GuideLeaderboardRepository {
  list(filter?: GuideLeaderboardFilter): Promise<CertifiedGuideRecord[]>;
  upsert(record: CertifiedGuideRecord): Promise<void>;
  count(): Promise<number>;
}

export interface RankedGuideEntry extends CertifiedGuideRecord {
  rank: number;
  trackLabel: string;
  compositeScore: number;
  pctOfTopRoutes: number;
  pctOfTopExperience: number;
}

export interface GuideLeaderboardSummary {
  totalActiveGuides: number;
  filteredCount: number;
  totalCertifiedRoutes: number;
  avgExperienceYears: number;
  avgRoutesPerGuide: number;
  maxRoutesCount: number;
  maxExperienceYears: number;
  topLeaderName: string | null;
  topRegion: string | null;
}

export const INITIAL_DFO_CERTIFIED_GUIDES: readonly CertifiedGuideRecord[] = [
  {
    id: 'guide-dfo-001',
    userId: null,
    fullName: 'Ковалёв Сергей Андреевич',
    region: 'Приморский край',
    organisation: 'Турклуб «Сихотэ-Алинь Трек»',
    track: 'hiking',
    certifiedRoutesCount: 24,
    experienceYears: 14,
    maxComplexity: '4 КС',
    registryNumber: 'МЭР-ДФО-0014',
    isActive: true,
    lastAttestationDate: '2026-04-18',
  },
  {
    id: 'guide-dfo-002',
    userId: null,
    fullName: 'Нечаев Алексей Викторович',
    region: 'Камчатский край',
    organisation: 'Центр маршрутов «Ключевской»',
    track: 'expedition',
    certifiedRoutesCount: 21,
    experienceYears: 16,
    maxComplexity: '4 КС',
    registryNumber: 'МЭР-ДФО-0008',
    isActive: true,
    lastAttestationDate: '2026-03-29',
  },
  {
    id: 'guide-dfo-003',
    userId: null,
    fullName: 'Тихомирова Елена Павловна',
    region: 'Приморский край',
    organisation: 'РЦА «Русский Восток» · ВВГУ',
    track: 'expedition',
    certifiedRoutesCount: 19,
    experienceYears: 12,
    maxComplexity: '3 КС',
    registryNumber: 'МЭР-ДФО-0019',
    isActive: true,
    lastAttestationDate: '2026-05-12',
  },
  {
    id: 'guide-dfo-004',
    userId: null,
    fullName: 'Верещагин Дмитрий Олегович',
    region: 'Приморский край',
    organisation: 'ФСТ ПК · Водная секция Партизанской',
    track: 'water',
    certifiedRoutesCount: 18,
    experienceYears: 15,
    maxComplexity: '4 КС',
    registryNumber: 'МЭР-ДФО-0023',
    isActive: true,
    lastAttestationDate: '2026-06-04',
  },
  {
    id: 'guide-dfo-005',
    userId: null,
    fullName: 'Сорокина Наталья Владимировна',
    region: 'Хабаровский край',
    organisation: 'АНО «Амур-Тайга Экспедишн»',
    track: 'hiking',
    certifiedRoutesCount: 17,
    experienceYears: 11,
    maxComplexity: '3 КС',
    registryNumber: 'МЭР-ДФО-0031',
    isActive: true,
    lastAttestationDate: '2026-05-25',
  },
  {
    id: 'guide-dfo-006',
    userId: null,
    fullName: 'Мельников Артём Игоревич',
    region: 'Сахалинская область',
    organisation: 'Курильский гид-клуб «Тори»',
    track: 'expedition',
    certifiedRoutesCount: 16,
    experienceYears: 10,
    maxComplexity: '3 КС',
    registryNumber: 'МЭР-ДФО-0042',
    isActive: true,
    lastAttestationDate: '2026-07-09',
  },
  {
    id: 'guide-dfo-007',
    userId: null,
    fullName: 'Белозеров Роман Сергеевич',
    region: 'Камчатский край',
    organisation: 'Школа фрирайда и маршрутов «Вилючинский»',
    track: 'ski',
    certifiedRoutesCount: 15,
    experienceYears: 13,
    maxComplexity: '4 КС',
    registryNumber: 'МЭР-ДФО-0047',
    isActive: true,
    lastAttestationDate: '2026-04-02',
  },
  {
    id: 'guide-dfo-008',
    userId: null,
    fullName: 'Николаев Иннокентий Семёнович',
    region: 'Республика Саха (Якутия)',
    organisation: 'Экспедиционный отряд «Ленские столбы»',
    track: 'expedition',
    certifiedRoutesCount: 14,
    experienceYears: 17,
    maxComplexity: '4 КС',
    registryNumber: 'МЭР-ДФО-0053',
    isActive: true,
    lastAttestationDate: '2026-06-18',
  },
  {
    id: 'guide-dfo-009',
    userId: null,
    fullName: 'Громов Павел Евгеньевич',
    region: 'Приморский край',
    organisation: 'ТК «Южное Приморье · Гамова»',
    track: 'hiking',
    certifiedRoutesCount: 14,
    experienceYears: 9,
    maxComplexity: '2 КС',
    registryNumber: 'МЭР-ДФО-0061',
    isActive: true,
    lastAttestationDate: '2026-07-22',
  },
  {
    id: 'guide-dfo-010',
    userId: null,
    fullName: 'Дьяченко Олег Михайлович',
    region: 'Хабаровский край',
    organisation: 'Анюйский сплав-центр',
    track: 'water',
    certifiedRoutesCount: 13,
    experienceYears: 11,
    maxComplexity: '3 КС',
    registryNumber: 'МЭР-ДФО-0068',
    isActive: true,
    lastAttestationDate: '2026-08-05',
  },
  {
    id: 'guide-dfo-011',
    userId: null,
    fullName: 'Калинина Марина Александровна',
    region: 'Сахалинская область',
    organisation: 'Сахалинская ассоциация экотуризма',
    track: 'hiking',
    certifiedRoutesCount: 12,
    experienceYears: 8,
    maxComplexity: '2 КС',
    registryNumber: 'МЭР-ДФО-0074',
    isActive: true,
    lastAttestationDate: '2026-08-19',
  },
  {
    id: 'guide-dfo-012',
    userId: null,
    fullName: 'Степанов Виктор Юрьевич',
    region: 'Амурская область',
    organisation: 'Турклуб «Зейский рубеж»',
    track: 'water',
    certifiedRoutesCount: 11,
    experienceYears: 10,
    maxComplexity: '3 КС',
    registryNumber: 'МЭР-ДФО-0082',
    isActive: true,
    lastAttestationDate: '2026-06-29',
  },
  {
    id: 'guide-dfo-013',
    userId: null,
    fullName: 'Харченко Игорь Васильевич',
    region: 'Приморский край',
    organisation: 'ООПТ «Бикин» · Экспедиционная служба',
    track: 'auto',
    certifiedRoutesCount: 10,
    experienceYears: 9,
    maxComplexity: '2 КС',
    registryNumber: 'МЭР-ДФО-0091',
    isActive: true,
    lastAttestationDate: '2026-09-03',
  },
  {
    id: 'guide-dfo-014',
    userId: null,
    fullName: 'Пономарёва Анна Дмитриевна',
    region: 'Магаданская область',
    organisation: 'Колымский горный клуб',
    track: 'ski',
    certifiedRoutesCount: 9,
    experienceYears: 7,
    maxComplexity: '3 КС',
    registryNumber: 'МЭР-ДФО-0104',
    isActive: true,
    lastAttestationDate: '2026-09-14',
  },
];

export function computeGuideCompositeScore(record: CertifiedGuideRecord): number {
  const complexityBonus =
    record.maxComplexity === '4 КС'
      ? 6
      : record.maxComplexity === '3 КС'
      ? 4
      : record.maxComplexity === '2 КС'
      ? 2
      : 1;
  return Math.round((record.certifiedRoutesCount * 3.2 + record.experienceYears * 2.1 + complexityBonus) * 10) / 10;
}

export function filterGuideRecords(
  records: readonly CertifiedGuideRecord[],
  filter: GuideLeaderboardFilter = {}
): CertifiedGuideRecord[] {
  const activeOnly = filter.activeOnly !== false;
  const region = filter.region?.trim();
  const track = filter.track;
  const needle = filter.search?.trim().toLowerCase() ?? '';

  return records.filter((rec) => {
    if (activeOnly && !rec.isActive) return false;
    if (region && region !== 'all' && rec.region !== region) return false;
    if (track && rec.track !== track) return false;
    if (needle) {
      const hay = `${rec.fullName} ${rec.region} ${rec.organisation} ${rec.registryNumber}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

export function rankCertifiedGuides(
  records: readonly CertifiedGuideRecord[],
  allActiveRecords: readonly CertifiedGuideRecord[],
  options: { sortBy?: GuideLeaderboardSort; limit?: number } = {}
): { entries: RankedGuideEntry[]; summary: GuideLeaderboardSummary } {
  const sortBy = options.sortBy ?? 'routes';
  const limit = Math.max(1, Math.min(options.limit ?? 50, 50));

  const sorted = [...records].sort((a, b) => {
    if (sortBy === 'experience') {
      if (b.experienceYears !== a.experienceYears) {
        return b.experienceYears - a.experienceYears;
      }
      if (b.certifiedRoutesCount !== a.certifiedRoutesCount) {
        return b.certifiedRoutesCount - a.certifiedRoutesCount;
      }
      return a.fullName.localeCompare(b.fullName, 'ru');
    }
    if (sortBy === 'composite') {
      const diff = computeGuideCompositeScore(b) - computeGuideCompositeScore(a);
      if (diff !== 0) return diff;
    }
    // Default: sortBy === 'routes'
    if (b.certifiedRoutesCount !== a.certifiedRoutesCount) {
      return b.certifiedRoutesCount - a.certifiedRoutesCount;
    }
    if (b.experienceYears !== a.experienceYears) {
      return b.experienceYears - a.experienceYears;
    }
    return a.fullName.localeCompare(b.fullName, 'ru');
  });

  const limited = sorted.slice(0, limit);
  const maxRoutes = Math.max(1, ...sorted.map((r) => r.certifiedRoutesCount));
  const maxExp = Math.max(1, ...sorted.map((r) => r.experienceYears));

  const entries: RankedGuideEntry[] = limited.map((rec, idx) => ({
    ...rec,
    rank: idx + 1,
    trackLabel: GUIDE_TRACK_LABELS[rec.track] ?? rec.track,
    compositeScore: computeGuideCompositeScore(rec),
    pctOfTopRoutes: Math.round((rec.certifiedRoutesCount / maxRoutes) * 100),
    pctOfTopExperience: Math.round((rec.experienceYears / maxExp) * 100),
  }));

  const count = sorted.length;
  const totalCertifiedRoutes = sorted.reduce((acc, r) => acc + r.certifiedRoutesCount, 0);
  const avgExperienceYears =
    count > 0
      ? Math.round((sorted.reduce((acc, r) => acc + r.experienceYears, 0) / count) * 10) / 10
      : 0;
  const avgRoutesPerGuide =
    count > 0 ? Math.round((totalCertifiedRoutes / count) * 10) / 10 : 0;

  const regionCounts = new Map<string, number>();
  for (const r of sorted) {
    regionCounts.set(r.region, (regionCounts.get(r.region) ?? 0) + 1);
  }
  let topRegion: string | null = null;
  let topRegionCount = 0;
  for (const [reg, cnt] of regionCounts.entries()) {
    if (cnt > topRegionCount) {
      topRegion = reg;
      topRegionCount = cnt;
    }
  }

  return {
    entries,
    summary: {
      totalActiveGuides: allActiveRecords.filter((r) => r.isActive).length,
      filteredCount: count,
      totalCertifiedRoutes,
      avgExperienceYears,
      avgRoutesPerGuide,
      maxRoutesCount: sorted.length > 0 ? Math.max(...sorted.map((r) => r.certifiedRoutesCount)) : 0,
      maxExperienceYears: sorted.length > 0 ? Math.max(...sorted.map((r) => r.experienceYears)) : 0,
      topLeaderName: entries[0]?.fullName ?? null,
      topRegion,
    },
  };
}
