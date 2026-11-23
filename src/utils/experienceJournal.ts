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
      routeTitle: 'Хребет Дуссе-Алинь · радиальные выходы к оз. Медвежье',
      regionId: 'khabarovsk',
      regionName: 'Хабаровский край',
      complexity: '2 КС',
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

export function writeStoredExperienceJournal(
  userId: string | null | undefined,
  entries: readonly ExperienceLogEntry[]
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(entries));
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
