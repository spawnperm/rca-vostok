export type ExpeditionComplexity = 'н/к' | '1 КС' | '2 КС' | '3 КС' | '4 КС' | '5 КС';

export type DfoJournalRegionId =
  | 'primorye'
  | 'kamchatka'
  | 'khabarovsk'
  | 'sakhalin'
  | 'yakutia'
  | 'amur'
  | 'magadan-chukotka';

export interface JournalDfoRegionOption {
  id: DfoJournalRegionId;
  name: string;
  shortName: string;
  aliases: readonly string[];
}

export interface ExperienceComplexityMeta {
  value: ExpeditionComplexity;
  label: string;
  shortLabel: string;
  rank: number;
  barColor: string;
}

export interface ExperienceLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  routeTitle: string;
  regionId: DfoJournalRegionId;
  regionName: string;
  complexity: ExpeditionComplexity;
  participantsCount: number;
  notes: string;
  createdAt: string;
}

export interface JournalEntryDraftInput {
  date: string;
  routeTitle: string;
  regionId: DfoJournalRegionId;
  complexity: ExpeditionComplexity;
  participantsCount: number | string;
  notes?: string;
}

export interface RegionJournalStats {
  regionId: DfoJournalRegionId;
  regionName: string;
  shortName: string;
  tripsCount: number;
  participantsCount: number;
  maxComplexity: ExpeditionComplexity | null;
  latestDate: string | null;
}

export interface TimelineJournalPoint {
  periodKey: string; // YYYY-MM
  periodLabel: string;
  tripsCount: number;
  participantsCount: number;
}

export interface ComplexityJournalPoint {
  complexity: ExpeditionComplexity;
  label: string;
  tripsCount: number;
  participantsCount: number;
  sharePct: number;
}

export interface ExperienceJournalMetrics {
  totalTrips: number;
  totalParticipants: number;
  activeRegionsCount: number;
  maxComplexity: ExpeditionComplexity | '—';
  avgGroupSize: number;
  byRegionMap: Record<DfoJournalRegionId, RegionJournalStats>;
  byRegionList: RegionJournalStats[];
  timelineSeries: TimelineJournalPoint[];
  complexitySeries: ComplexityJournalPoint[];
}

export const EXPERIENCE_COMPLEXITIES: readonly ExperienceComplexityMeta[] = [
  {
    value: 'н/к',
    label: 'н/к — некатегорийный маршрут / ПВД',
    shortLabel: 'н/к',
    rank: 0,
    barColor: '#64748B',
  },
  {
    value: '1 КС',
    label: '1 КС — базовая категория сложности',
    shortLabel: '1 КС',
    rank: 1,
    barColor: '#14B8A6',
  },
  {
    value: '2 КС',
    label: '2 КС — средняя категория сложности',
    shortLabel: '2 КС',
    rank: 2,
    barColor: '#0F766E',
  },
  {
    value: '3 КС',
    label: '3 КС — повышенная категория сложности',
    shortLabel: '3 КС',
    rank: 3,
    barColor: '#0D9488',
  },
  {
    value: '4 КС',
    label: '4 КС — сложный экспедиционный маршрут',
    shortLabel: '4 КС',
    rank: 4,
    barColor: '#B45309',
  },
  {
    value: '5 КС',
    label: '5 КС — высшая категория сложности',
    shortLabel: '5 КС',
    rank: 5,
    barColor: '#991B1B',
  },
];

export const JOURNAL_DFO_REGIONS: readonly JournalDfoRegionOption[] = [
  {
    id: 'primorye',
    name: 'Приморский край',
    shortName: 'Приморье',
    aliases: ['примор', 'владивосток'],
  },
  {
    id: 'kamchatka',
    name: 'Камчатский край',
    shortName: 'Камчатка',
    aliases: ['камчат'],
  },
  {
    id: 'khabarovsk',
    name: 'Хабаровский край',
    shortName: 'Хабаровск',
    aliases: ['хабаров'],
  },
  {
    id: 'sakhalin',
    name: 'Сахалинская область',
    shortName: 'Сахалин',
    aliases: ['сахалин', 'курил'],
  },
  {
    id: 'yakutia',
    name: 'Республика Саха (Якутия)',
    shortName: 'Якутия',
    aliases: ['якут', 'саха'],
  },
  {
    id: 'amur',
    name: 'Амурская область',
    shortName: 'Приамурье',
    aliases: ['амур'],
  },
  {
    id: 'magadan-chukotka',
    name: 'Магаданская область и Чукотский АО',
    shortName: 'Магадан / Чукотка',
    aliases: ['магадан', 'чукот'],
  },
];

const COMPLEXITY_RANK: Record<ExpeditionComplexity, number> = {
  'н/к': 0,
  '1 КС': 1,
  '2 КС': 2,
  '3 КС': 3,
  '4 КС': 4,
  '5 КС': 5,
};

const STORAGE_PREFIX = 'rca-experience-journal-v1:';

const MONTH_SHORT_RU: readonly string[] = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек',
];

export function resolveJournalRegionId(regionName?: string | null): DfoJournalRegionId {
  const normalized = (regionName ?? '').trim().toLowerCase();
  if (!normalized) return 'primorye';

  const matched = JOURNAL_DFO_REGIONS.find(
    (r) =>
      r.id === normalized ||
      r.name.toLowerCase() === normalized ||
      r.aliases.some((a) => normalized.includes(a))
  );
  return matched?.id ?? 'primorye';
}

export function getJournalRegionById(regionId: DfoJournalRegionId): JournalDfoRegionOption {
  return JOURNAL_DFO_REGIONS.find((r) => r.id === regionId) ?? JOURNAL_DFO_REGIONS[0];
}

export function formatRussianJournalDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export function formatJournalMonthLabel(ym: string): string {
  const [year, monthStr] = ym.split('-');
  const monthIdx = Number(monthStr) - 1;
  if (!year || Number.isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return ym;
  return `${MONTH_SHORT_RU[monthIdx]} ${year}`;
}

export function getDefaultJournalEntries(preferredRegionName?: string): ExperienceLogEntry[] {
  const homeId = resolveJournalRegionId(preferredRegionName);
  const homeRegion = getJournalRegionById(homeId);

  const base: ExperienceLogEntry[] = [
    {
      id: 'exp-seed-1',
      date: '2026-10-12',
      routeTitle:
        homeId === 'primorye'
          ? 'Ливадийский хребет · г. Пидан и водопады'
          : `Учебно-тренировочный маршрут · ${homeRegion.shortName}`,
      regionId: homeId,
      regionName: homeRegion.name,
      complexity: '2 КС',
      participantsCount: 14,
      notes: 'Уведомление МЧС за 10 дней, проверка групповой аптечки WFA и раций.',
      createdAt: '2026-10-13T08:00:00Z',
    },
    {
      id: 'exp-seed-2',
      date: '2026-09-18',
      routeTitle: 'Сплав по р. Быстрая (Малкинская) с прохождением порогов',
      regionId: 'kamchatka',
      regionName: 'Камчатский край',
      complexity: '3 КС',
      participantsCount: 10,
      notes: 'Рафтинг и катамараны-4, страховка с берега, безаварийное прохождение.',
      createdAt: '2026-09-20T10:00:00Z',
    },
    {
      id: 'exp-seed-3',
      date: '2026-08-24',
      routeTitle: 'Хребет Дуссе-Алинь · автономный горно-таёжный траверс',
      regionId: 'khabarovsk',
      regionName: 'Хабаровский край',
      complexity: '4 КС',
      participantsCount: 9,
      notes: 'Согласование маршрута с администрацией Буреинского заповедника.',
      createdAt: '2026-08-26T09:30:00Z',
    },
    {
      id: 'exp-seed-4',
      date: '2026-07-11',
      routeTitle: 'Морской переход и береговой треккинг к мысу Великан',
      regionId: 'sakhalin',
      regionName: 'Сахалинская область',
      complexity: '1 КС',
      participantsCount: 16,
      notes: 'Контроль приливно-отливной таблицы и брифинг по технике безопасности.',
      createdAt: '2026-07-12T14:00:00Z',
    },
    {
      id: 'exp-seed-5',
      date: '2026-06-06',
      routeTitle: 'Сихотэ-Алинь · г. Облачная (однодневный и ночёвочный трек)',
      regionId: 'primorye',
      regionName: 'Приморский край',
      complexity: '1 КС',
      participantsCount: 12,
      notes: 'Отработка навигации в тумане по ГЛОНАСС и бумажной топокарте.',
      createdAt: '2026-06-07T11:15:00Z',
    },
  ];

  // Ensure unique IDs and stable date-descending order
  return base.sort((a, b) => b.date.localeCompare(a.date));
}

function getStorageKey(userId?: string | null): string {
  return `${STORAGE_PREFIX}${userId ? userId : 'guest'}`;
}

export function readStoredExperienceJournal(
  userId?: string | null,
  preferredRegionName?: string
): ExperienceLogEntry[] {
  if (typeof window === 'undefined') {
    return getDefaultJournalEntries(preferredRegionName);
  }
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) {
      return getDefaultJournalEntries(preferredRegionName);
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return getDefaultJournalEntries(preferredRegionName);
    }
    const valid = parsed.filter(
      (item): item is ExperienceLogEntry =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as ExperienceLogEntry).id === 'string' &&
        typeof (item as ExperienceLogEntry).date === 'string' &&
        typeof (item as ExperienceLogEntry).regionId === 'string' &&
        typeof (item as ExperienceLogEntry).complexity === 'string' &&
        typeof (item as ExperienceLogEntry).participantsCount === 'number'
    );
    return valid.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return getDefaultJournalEntries(preferredRegionName);
  }
}

export const EXPERIENCE_JOURNAL_UPDATED_EVENT = 'rca-experience-journal-updated';

export function writeStoredExperienceJournal(
  userId: string | null | undefined,
  entries: readonly ExperienceLogEntry[]
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(entries));
    window.dispatchEvent(
      new CustomEvent(EXPERIENCE_JOURNAL_UPDATED_EVENT, {
        detail: { userId: userId ?? null },
      })
    );
  } catch {
    // ignore storage quota errors gracefully
  }
}

export function validateJournalEntryInput(
  input: JournalEntryDraftInput,
  now: Date = new Date()
): { ok: true; entry: ExperienceLogEntry } | { ok: false; error: string } {
  const date = input.date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Укажите корректную дату похода.' };
  }
  const parsedTime = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(parsedTime)) {
    return { ok: false, error: 'Неверный формат календарной даты.' };
  }

  const region = JOURNAL_DFO_REGIONS.find((r) => r.id === input.regionId);
  if (!region) {
    return { ok: false, error: 'Выберите субъект ДФО из списка.' };
  }

  const complexityValid = EXPERIENCE_COMPLEXITIES.some((c) => c.value === input.complexity);
  if (!complexityValid) {
    return { ok: false, error: 'Выберите категорию сложности маршрута.' };
  }

  const countNum =
    typeof input.participantsCount === 'number'
      ? input.participantsCount
      : Number.parseInt(String(input.participantsCount).trim(), 10);

  if (!Number.isFinite(countNum) || countNum < 1 || countNum > 500) {
    return {
      ok: false,
      error: 'Количество участников должно быть целым числом от 1 до 500.',
    };
  }

  const cleanTitle =
    input.routeTitle.trim() || `Маршрут ${input.complexity} · ${region.shortName}`;

  const cleanNotes = (input.notes ?? '').trim();

  const id = `exp-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`;

  return {
    ok: true,
    entry: {
      id,
      date,
      routeTitle: cleanTitle,
      regionId: region.id,
      regionName: region.name,
      complexity: input.complexity,
      participantsCount: Math.round(countNum),
      notes: cleanNotes,
      createdAt: now.toISOString(),
    },
  };
}

export function computeJournalMetrics(
  entries: readonly ExperienceLogEntry[]
): ExperienceJournalMetrics {
  const byRegionMap = {} as Record<DfoJournalRegionId, RegionJournalStats>;
  for (const reg of JOURNAL_DFO_REGIONS) {
    byRegionMap[reg.id] = {
      regionId: reg.id,
      regionName: reg.name,
      shortName: reg.shortName,
      tripsCount: 0,
      participantsCount: 0,
      maxComplexity: null,
      latestDate: null,
    };
  }

  const timelineAccumulator = new Map<string, { tripsCount: number; participantsCount: number }>();
  const complexityAccumulator = new Map<
    ExpeditionComplexity,
    { tripsCount: number; participantsCount: number }
  >();
  for (const c of EXPERIENCE_COMPLEXITIES) {
    complexityAccumulator.set(c.value, { tripsCount: 0, participantsCount: 0 });
  }

  let totalParticipants = 0;
  let globalMaxRank = -1;
  let globalMaxComplexity: ExpeditionComplexity | '—' = '—';

  for (const entry of entries) {
    totalParticipants += entry.participantsCount;

    const rank = COMPLEXITY_RANK[entry.complexity] ?? 0;
    if (rank > globalMaxRank) {
      globalMaxRank = rank;
      globalMaxComplexity = entry.complexity;
    }

    const regStats = byRegionMap[entry.regionId];
    if (regStats) {
      regStats.tripsCount += 1;
      regStats.participantsCount += entry.participantsCount;
      const curRank = regStats.maxComplexity ? COMPLEXITY_RANK[regStats.maxComplexity] : -1;
      if (rank > curRank) {
        regStats.maxComplexity = entry.complexity;
      }
      if (!regStats.latestDate || entry.date > regStats.latestDate) {
        regStats.latestDate = entry.date;
      }
    }

    const ym = entry.date.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(ym)) {
      const prev = timelineAccumulator.get(ym) ?? { tripsCount: 0, participantsCount: 0 };
      prev.tripsCount += 1;
      prev.participantsCount += entry.participantsCount;
      timelineAccumulator.set(ym, prev);
    }

    const compAcc = complexityAccumulator.get(entry.complexity);
    if (compAcc) {
      compAcc.tripsCount += 1;
      compAcc.participantsCount += entry.participantsCount;
    }
  }

  const byRegionList = Object.values(byRegionMap).sort((a, b) => {
    if (b.tripsCount !== a.tripsCount) return b.tripsCount - a.tripsCount;
    return b.participantsCount - a.participantsCount;
  });

  const activeRegionsCount = byRegionList.filter((r) => r.tripsCount > 0).length;
  const totalTrips = entries.length;
  const avgGroupSize =
    totalTrips > 0 ? Math.round((totalParticipants / totalTrips) * 10) / 10 : 0;

  const timelineSeries: TimelineJournalPoint[] = Array.from(timelineAccumulator.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodKey, val]) => ({
      periodKey,
      periodLabel: formatJournalMonthLabel(periodKey),
      tripsCount: val.tripsCount,
      participantsCount: val.participantsCount,
    }));

  const complexitySeries: ComplexityJournalPoint[] = EXPERIENCE_COMPLEXITIES.map((meta) => {
    const val = complexityAccumulator.get(meta.value) ?? { tripsCount: 0, participantsCount: 0 };
    return {
      complexity: meta.value,
      label: meta.shortLabel,
      tripsCount: val.tripsCount,
      participantsCount: val.participantsCount,
      sharePct: totalTrips > 0 ? Math.round((val.tripsCount / totalTrips) * 100) : 0,
    };
  });

  return {
    totalTrips,
    totalParticipants,
    activeRegionsCount,
    maxComplexity: globalMaxComplexity,
    avgGroupSize,
    byRegionMap,
    byRegionList,
    timelineSeries,
    complexitySeries,
  };
}

export type ComplexityTierKey = 'easy' | 'medium' | 'hard';

export interface ComplexityTierSlice {
  key: ComplexityTierKey;
  shortName: 'Лёгкие' | 'Средние' | 'Сложные';
  name: string;
  description: string;
  tripsCount: number;
  participantsCount: number;
  sharePct: number;
  color: string;
}

export interface ComplexityTierDistribution {
  totalTrips: number;
  totalParticipants: number;
  slices: ComplexityTierSlice[];
  nonZeroSlices: ComplexityTierSlice[];
  dominantTier: ComplexityTierSlice | null;
}

export function classifyComplexityTier(complexity: ExpeditionComplexity): ComplexityTierKey {
  if (complexity === 'н/к' || complexity === '1 КС') return 'easy';
  if (complexity === '2 КС' || complexity === '3 КС') return 'medium';
  return 'hard';
}

export function computeComplexityTierDistribution(
  entries: readonly ExperienceLogEntry[]
): ComplexityTierDistribution {
  const buckets: Record<ComplexityTierKey, { tripsCount: number; participantsCount: number }> = {
    easy: { tripsCount: 0, participantsCount: 0 },
    medium: { tripsCount: 0, participantsCount: 0 },
    hard: { tripsCount: 0, participantsCount: 0 },
  };

  let totalParticipants = 0;
  for (const entry of entries) {
    const tier = classifyComplexityTier(entry.complexity);
    buckets[tier].tripsCount += 1;
    buckets[tier].participantsCount += entry.participantsCount;
    totalParticipants += entry.participantsCount;
  }

  const totalTrips = entries.length;

  const slices: ComplexityTierSlice[] = [
    {
      key: 'easy',
      shortName: 'Лёгкие',
      name: 'Лёгкие (н/к, 1 КС)',
      description: 'Экотропы, ПВД и базовые маршруты начальной категории',
      tripsCount: buckets.easy.tripsCount,
      participantsCount: buckets.easy.participantsCount,
      sharePct: totalTrips > 0 ? Math.round((buckets.easy.tripsCount / totalTrips) * 100) : 0,
      color: '#14B8A6',
    },
    {
      key: 'medium',
      shortName: 'Средние',
      name: 'Средние (2–3 КС)',
      description: 'Многодневные таёжные, горные и водные маршруты ДФО',
      tripsCount: buckets.medium.tripsCount,
      participantsCount: buckets.medium.participantsCount,
      sharePct: totalTrips > 0 ? Math.round((buckets.medium.tripsCount / totalTrips) * 100) : 0,
      color: '#0F766E',
    },
    {
      key: 'hard',
      shortName: 'Сложные',
      name: 'Сложные (4–5 КС)',
      description: 'Автономные экспедиционные и сложные категорированные маршруты',
      tripsCount: buckets.hard.tripsCount,
      participantsCount: buckets.hard.participantsCount,
      sharePct: totalTrips > 0 ? Math.round((buckets.hard.tripsCount / totalTrips) * 100) : 0,
      color: '#D97706',
    },
  ];

  const nonZeroSlices = slices.filter((s) => s.tripsCount > 0);
  const dominantTier =
    nonZeroSlices.length > 0
      ? [...nonZeroSlices].sort((a, b) => b.tripsCount - a.tripsCount)[0]
      : null;

  return {
    totalTrips,
    totalParticipants,
    slices,
    nonZeroSlices,
    dominantTier,
  };
}

export const COMPLEXITY_BY_RANK: readonly ExpeditionComplexity[] = [
  'н/к',
  '1 КС',
  '2 КС',
  '3 КС',
  '4 КС',
  '5 КС',
];

export function complexityRankToLabel(rank: number): ExpeditionComplexity {
  const clamped = Math.max(0, Math.min(5, Math.round(rank)));
  return COMPLEXITY_BY_RANK[clamped] ?? '1 КС';
}

export type TrendDirection = 'up' | 'stable' | 'down';

export interface RouteComplexityForecastPoint {
  stepLabel: string;
  routeTitle: string;
  regionName: string;
  actualRank: number | null;
  actualLabel: string | null;
  trendRank: number;
  forecastRank: number | null;
  isForecast: boolean;
}

export interface RouteComplexityForecastResult {
  sampleSize: number;
  recommendedComplexity: ExpeditionComplexity;
  recommendedRank: number;
  recommendedDescription: string;
  predictedNumericRank: number;
  slopePerTrip: number;
  trendDirection: TrendDirection;
  trendLabel: string;
  overallMeanRank: number;
  recentMeanRank: number;
  maxObservedComplexity: ExpeditionComplexity | '—';
  lastComplexity: ExpeditionComplexity | '—';
  stepProgressionLabel: string;
  confidencePercent: number;
  confidenceLabel: string;
  rationale: string;
  points: RouteComplexityForecastPoint[];
}

/**
 * Predicts the next route complexity level from chronological journal entries
 * using Ordinary Least Squares (OLS) linear trend combined with a recent 3-trip moving average
 * and FSTR +1 KC safety progression guardrail.
 */
export function forecastNextRouteComplexity(
  entries: readonly ExperienceLogEntry[]
): RouteComplexityForecastResult {
  if (entries.length === 0) {
    const baseMeta = EXPERIENCE_COMPLEXITIES[1];
    return {
      sampleSize: 0,
      recommendedComplexity: '1 КС',
      recommendedRank: 1,
      recommendedDescription: baseMeta.label,
      predictedNumericRank: 1,
      slopePerTrip: 0,
      trendDirection: 'stable',
      trendLabel: 'Недостаточно данных (стартовый уровень)',
      overallMeanRank: 0,
      recentMeanRank: 0,
      maxObservedComplexity: '—',
      lastComplexity: '—',
      stepProgressionLabel: 'Стартовый допуск',
      confidencePercent: 25,
      confidenceLabel: 'Низкая (0 записей)',
      rationale:
        'В журнале пока нет проведённых маршрутов. Рекомендуется начать с базовых маршрутов 1 КС и фиксировать каждый выход.',
      points: [],
    };
  }

  const ordered = [...entries].sort((a, b) => {
    const dateDiff = a.date.localeCompare(b.date);
    if (dateDiff !== 0) return dateDiff;
    return a.createdAt.localeCompare(b.createdAt);
  });

  const n = ordered.length;
  const ranks = ordered.map((e) => COMPLEXITY_RANK[e.complexity] ?? 1);
  const maxObservedRank = Math.max(...ranks);
  const lastRank = ranks[n - 1];
  const lastComplexity = complexityRankToLabel(lastRank);
  const maxObservedComplexity = complexityRankToLabel(maxObservedRank);

  const overallMeanRank =
    Math.round((ranks.reduce((acc, r) => acc + r, 0) / n) * 100) / 100;
  const recentWindow = ranks.slice(-Math.min(3, n));
  const recentMeanRank =
    Math.round(
      (recentWindow.reduce((acc, r) => acc + r, 0) / recentWindow.length) * 100
    ) / 100;

  // OLS slope & intercept over step index t = 0..n-1
  let slope = 0;
  let intercept = overallMeanRank;
  if (n >= 2) {
    const meanT = (n - 1) / 2;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i += 1) {
      const dt = i - meanT;
      num += dt * (ranks[i] - overallMeanRank);
      den += dt * dt;
    }
    slope = den > 0 ? num / den : 0;
    intercept = overallMeanRank - slope * meanT;
  }

  const linearNext = intercept + slope * n;
  const blendedRaw = n === 1 ? ranks[0] : 0.75 * linearNext + 0.25 * recentMeanRank;

  // Safety progression cap: do not recommend jumping more than +1 grade above max logged level
  const upperSafetyCap = Math.min(5, maxObservedRank + 1);
  const clampedNumeric = Math.max(0, Math.min(upperSafetyCap, blendedRaw));
  const predictedNumericRank = Math.round(clampedNumeric * 100) / 100;
  const recommendedRank = Math.max(0, Math.min(upperSafetyCap, Math.round(clampedNumeric)));
  const recommendedComplexity = complexityRankToLabel(recommendedRank);
  const recommendedMeta =
    EXPERIENCE_COMPLEXITIES.find((c) => c.value === recommendedComplexity) ??
    EXPERIENCE_COMPLEXITIES[1];

  const roundedSlope = Math.round(slope * 100) / 100;
  let trendDirection: TrendDirection = 'stable';
  let trendLabel = 'Стабильный профиль сложности';
  if (roundedSlope >= 0.12) {
    trendDirection = 'up';
    trendLabel = `Восходящий тренд (+${roundedSlope.toFixed(2)} КС / поход)`;
  } else if (roundedSlope <= -0.12) {
    trendDirection = 'down';
    trendLabel = `Снижение нагрузки (${roundedSlope.toFixed(2)} КС / поход)`;
  }

  let stepProgressionLabel = `Закрепление уровня ${recommendedComplexity}`;
  if (recommendedRank > lastRank) {
    stepProgressionLabel = `Повышение категории (+${recommendedRank - lastRank} КС)`;
  } else if (recommendedRank < lastRank) {
    stepProgressionLabel = `Стабилизация на уровне ${recommendedComplexity}`;
  }

  // Residual fit & sample size based confidence (40%..92%)
  let confidencePercent = 45;
  if (n >= 2) {
    let ssRes = 0;
    for (let i = 0; i < n; i += 1) {
      const fitted = intercept + slope * i;
      ssRes += (ranks[i] - fitted) ** 2;
    }
    const rmse = Math.sqrt(ssRes / n);
    const sizeBonus = Math.min(34, n * 5);
    const stabilityBonus = Math.max(0, Math.round((1.5 - Math.min(1.5, rmse)) * 10));
    confidencePercent = Math.max(42, Math.min(92, 42 + sizeBonus + stabilityBonus));
  }

  const confidenceLabel =
    confidencePercent >= 75
      ? `Высокая (${confidencePercent}%)`
      : confidencePercent >= 55
      ? `Средняя (${confidencePercent}%)`
      : `Начальная (${confidencePercent}%)`;

  let rationale = '';
  if (n === 1) {
    rationale = `По единственной записи (${lastComplexity}) статистический прогноз рекомендует провести ещё 1–2 маршрута уровня ${recommendedComplexity} для формирования тренда и подтверждения опыта.`;
  } else if (trendDirection === 'up' && recommendedRank > lastRank) {
    rationale = `Линейный тренд МНК (+${roundedSlope.toFixed(2)} КС за выход) и недавняя практика (среднее ${recentMeanRank.toFixed(1)} КС) указывают на готовность к переходу на уровень ${recommendedComplexity}.`;
  } else if (trendDirection === 'up') {
    rationale = `Тренд восходящий (+${roundedSlope.toFixed(2)} КС за выход), при этом взвешенная оценка (${predictedNumericRank.toFixed(2)} КС) рекомендует закрепить уровень ${recommendedComplexity} перед следующим повышением.`;
  } else if (trendDirection === 'down') {
    rationale = `Последние походы показывают плавное снижение средней категории до ${recentMeanRank.toFixed(1)} КС. Следующий оптимальный шаг для поддержания формы — маршрут ${recommendedComplexity}.`;
  } else {
    rationale = `Ваш профиль сложности стабилен вокруг ${overallMeanRank.toFixed(1)} КС. Для планового расширения допуска РЦА рекомендуется маршрут уровня ${recommendedComplexity}.`;
  }

  const points: RouteComplexityForecastPoint[] = ordered.map((entry, idx) => {
    const fitted = Math.max(0, Math.min(5, Math.round((intercept + slope * idx) * 100) / 100));
    return {
      stepLabel: `${formatRussianJournalDate(entry.date).slice(0, 5)}`,
      routeTitle: entry.routeTitle,
      regionName: entry.regionName,
      actualRank: ranks[idx],
      actualLabel: entry.complexity,
      trendRank: fitted,
      forecastRank: idx === n - 1 ? ranks[idx] : null,
      isForecast: false,
    };
  });

  points.push({
    stepLabel: 'Прогноз',
    routeTitle: `Прогноз: маршрут ${recommendedComplexity}`,
    regionName: 'Рекомендация модели',
    actualRank: null,
    actualLabel: null,
    trendRank: Math.max(0, Math.min(5, Math.round(linearNext * 100) / 100)),
    forecastRank: recommendedRank,
    isForecast: true,
  });

  return {
    sampleSize: n,
    recommendedComplexity,
    recommendedRank,
    recommendedDescription: recommendedMeta.label,
    predictedNumericRank,
    slopePerTrip: roundedSlope,
    trendDirection,
    trendLabel,
    overallMeanRank,
    recentMeanRank,
    maxObservedComplexity,
    lastComplexity,
    stepProgressionLabel,
    confidencePercent,
    confidenceLabel,
    rationale,
    points,
  };
}

export interface JournalCalendarCell {
  isoDate: string; // YYYY-MM-DD
  dayOfMonth: number;
  inCurrentMonth: boolean;
  entries: ExperienceLogEntry[];
  totalParticipants: number;
  highestComplexity: ExpeditionComplexity | null;
}

export interface JournalCalendarMonthModel {
  year: number;
  month: number; // 1..12
  monthKey: string; // YYYY-MM
  monthTitle: string;
  cells: JournalCalendarCell[];
  monthTripsCount: number;
  monthParticipantsCount: number;
  activeDaysCount: number;
}

export interface CalendarYearMonth {
  year: number;
  month: number; // 1..12
  monthKey: string;
  label: string;
  tripsCount: number;
}

const MONTH_FULL_RU: readonly string[] = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

function formatUtcIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function shiftCalendarMonth(
  year: number,
  month: number,
  deltaMonths: number
): { year: number; month: number } {
  const shifted = new Date(Date.UTC(year, month - 1 + deltaMonths, 1));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
  };
}

export function resolveInitialCalendarMonth(
  entries: readonly ExperienceLogEntry[],
  fallbackNow: Date = new Date()
): { year: number; month: number; selectedIso: string } {
  if (entries.length > 0) {
    const latest = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0];
    const parts = latest.date.split('-');
    if (parts.length === 3) {
      const y = Number.parseInt(parts[0], 10);
      const m = Number.parseInt(parts[1], 10);
      if (!Number.isNaN(y) && !Number.isNaN(m) && m >= 1 && m <= 12) {
        return { year: y, month: m, selectedIso: latest.date };
      }
    }
  }
  const y = fallbackNow.getFullYear();
  const m = fallbackNow.getMonth() + 1;
  const d = String(fallbackNow.getDate()).padStart(2, '0');
  return {
    year: y,
    month: m,
    selectedIso: `${y}-${String(m).padStart(2, '0')}-${d}`,
  };
}

export function extractActiveCalendarMonths(
  entries: readonly ExperienceLogEntry[]
): CalendarYearMonth[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const ym = e.date.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(ym)) {
      counts.set(ym, (counts.get(ym) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, tripsCount]) => {
      const [yStr, mStr] = monthKey.split('-');
      return {
        year: Number.parseInt(yStr, 10),
        month: Number.parseInt(mStr, 10),
        monthKey,
        label: formatJournalMonthLabel(monthKey),
        tripsCount,
      };
    });
}

export function buildJournalCalendarMonth(
  year: number,
  month: number,
  entries: readonly ExperienceLogEntry[]
): JournalCalendarMonthModel {
  const monthIdx = month - 1;
  const firstDayUtc = new Date(Date.UTC(year, monthIdx, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();

  // Monday-first weekday offset: Mon=0 .. Sun=6
  const startWeekday = (firstDayUtc.getUTCDay() + 6) % 7;
  const totalSlots = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const entriesByDate = new Map<string, ExperienceLogEntry[]>();
  for (const entry of entries) {
    const list = entriesByDate.get(entry.date);
    if (list) {
      list.push(entry);
    } else {
      entriesByDate.set(entry.date, [entry]);
    }
  }

  const cells: JournalCalendarCell[] = [];
  let monthTripsCount = 0;
  let monthParticipantsCount = 0;
  let activeDaysCount = 0;

  for (let i = 0; i < totalSlots; i += 1) {
    const cellDate = new Date(Date.UTC(year, monthIdx, 1 - startWeekday + i));
    const isoDate = formatUtcIsoDate(cellDate);
    const inCurrentMonth =
      cellDate.getUTCFullYear() === year && cellDate.getUTCMonth() === monthIdx;
    const dayEntries = entriesByDate.get(isoDate) ?? [];

    let totalParticipants = 0;
    let highestComplexity: ExpeditionComplexity | null = null;
    let maxRank = -1;

    for (const e of dayEntries) {
      totalParticipants += e.participantsCount;
      const r = COMPLEXITY_RANK[e.complexity] ?? 0;
      if (r > maxRank) {
        maxRank = r;
        highestComplexity = e.complexity;
      }
    }

    if (inCurrentMonth && dayEntries.length > 0) {
      monthTripsCount += dayEntries.length;
      monthParticipantsCount += totalParticipants;
      activeDaysCount += 1;
    }

    cells.push({
      isoDate,
      dayOfMonth: cellDate.getUTCDate(),
      inCurrentMonth,
      entries: dayEntries,
      totalParticipants,
      highestComplexity,
    });
  }

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const monthTitle = `${MONTH_FULL_RU[monthIdx] ?? ''} ${year}`.trim();

  return {
    year,
    month,
    monthKey,
    monthTitle,
    cells,
    monthTripsCount,
    monthParticipantsCount,
    activeDaysCount,
  };
}



