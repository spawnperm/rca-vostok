import {
  COMPLEXITY_RANK,
  EXPERIENCE_COMPLEXITIES,
  JOURNAL_DFO_REGIONS,
  classifyComplexityTier,
  complexityRankToLabel,
  formatJournalMonthLabel,
  formatRussianJournalDate,
  type ComplexityTierKey,
  type DfoJournalRegionId,
  type ExpeditionComplexity,
  type ExperienceLogEntry,
} from './ExperienceEntry.ts';

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
  totalDistanceKm: number;
  activeRegionsCount: number;
  maxComplexity: ExpeditionComplexity | '—';
  avgGroupSize: number;
  byRegionMap: Record<DfoJournalRegionId, RegionJournalStats>;
  byRegionList: RegionJournalStats[];
  timelineSeries: TimelineJournalPoint[];
  complexitySeries: ComplexityJournalPoint[];
}

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
  let totalDistanceKmRaw = 0;
  let globalMaxRank = -1;
  let globalMaxComplexity: ExpeditionComplexity | '—' = '—';

  for (const entry of entries) {
    totalParticipants += entry.participantsCount;
    if (typeof entry.distanceKm === 'number' && Number.isFinite(entry.distanceKm)) {
      totalDistanceKmRaw += entry.distanceKm;
    }

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
    totalDistanceKm: Math.round(totalDistanceKmRaw * 10) / 10,
    activeRegionsCount,
    maxComplexity: globalMaxComplexity,
    avgGroupSize,
    byRegionMap,
    byRegionList,
    timelineSeries,
    complexitySeries,
  };
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

/**
 * Domain Service: Predicts the next route complexity level from chronological journal entries
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
