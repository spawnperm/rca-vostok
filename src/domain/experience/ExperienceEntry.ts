import { ValidationError } from '../shared/DomainError.ts';

export type ExpeditionComplexity = 'н/к' | '1 КС' | '2 КС' | '3 КС' | '4 КС' | '5 КС';

export type DfoJournalRegionId =
  | 'primorye'
  | 'kamchatka'
  | 'khabarovsk'
  | 'sakhalin'
  | 'yakutia'
  | 'amur'
  | 'magadan-chukotka';

export type ComplexityTierKey = 'easy' | 'medium' | 'hard';

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

export interface GeoEndpoint {
  lat: number;
  lon: number;
  label?: string;
}

export interface ExperienceLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  routeTitle: string;
  regionId: DfoJournalRegionId;
  regionName: string;
  complexity: ExpeditionComplexity;
  participantsCount: number;
  distanceKm?: number | null;
  notes: string;
  startPoint?: GeoEndpoint | null;
  finishPoint?: GeoEndpoint | null;
  createdAt: string;
}

export interface JournalEntryDraftInput {
  date: string;
  routeTitle: string;
  regionId: DfoJournalRegionId;
  complexity: ExpeditionComplexity;
  participantsCount: number | string;
  distanceKm?: number | string | null;
  notes?: string;
  startPoint?: GeoEndpoint | null;
  finishPoint?: GeoEndpoint | null;
}

export const COMPLEXITY_BY_RANK: readonly ExpeditionComplexity[] = [
  'н/к',
  '1 КС',
  '2 КС',
  '3 КС',
  '4 КС',
  '5 КС',
];

export const COMPLEXITY_RANK: Record<ExpeditionComplexity, number> = {
  'н/к': 0,
  '1 КС': 1,
  '2 КС': 2,
  '3 КС': 3,
  '4 КС': 4,
  '5 КС': 5,
};

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

export function complexityRankToLabel(rank: number): ExpeditionComplexity {
  const clamped = Math.max(0, Math.min(5, Math.round(rank)));
  return COMPLEXITY_BY_RANK[clamped] ?? '1 КС';
}

export function classifyComplexityTier(complexity: ExpeditionComplexity): ComplexityTierKey {
  if (complexity === 'н/к' || complexity === '1 КС') return 'easy';
  if (complexity === '2 КС' || complexity === '3 КС') return 'medium';
  return 'hard';
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

/**
 * Domain Entity representing a single logged field expedition in the instructor's
 * professional experience journal. Enforces all value object invariants on creation.
 */
export class ExperienceEntry {
  readonly id: string;
  readonly date: string;
  readonly routeTitle: string;
  readonly regionId: DfoJournalRegionId;
  readonly regionName: string;
  readonly complexity: ExpeditionComplexity;
  readonly participantsCount: number;
  readonly distanceKm: number | null;
  readonly notes: string;
  readonly startPoint: GeoEndpoint | null;
  readonly finishPoint: GeoEndpoint | null;
  readonly createdAt: string;

  private constructor(props: ExperienceLogEntry) {
    this.id = props.id;
    this.date = props.date;
    this.routeTitle = props.routeTitle;
    this.regionId = props.regionId;
    this.regionName = props.regionName;
    this.complexity = props.complexity;
    this.participantsCount = props.participantsCount;
    this.distanceKm = props.distanceKm ?? null;
    this.notes = props.notes;
    this.startPoint = props.startPoint ?? null;
    this.finishPoint = props.finishPoint ?? null;
    this.createdAt = props.createdAt;
  }

  static create(input: JournalEntryDraftInput, now: Date = new Date()): ExperienceEntry {
    const date = typeof input.date === 'string' ? input.date.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ValidationError('Укажите корректную дату похода.');
    }
    const parsedTime = Date.parse(`${date}T00:00:00Z`);
    if (Number.isNaN(parsedTime)) {
      throw new ValidationError('Неверный формат календарной даты.');
    }

    const region = JOURNAL_DFO_REGIONS.find((r) => r.id === input.regionId);
    if (!region) {
      throw new ValidationError('Выберите субъект ДФО из списка.');
    }

    const complexityValid = EXPERIENCE_COMPLEXITIES.some((c) => c.value === input.complexity);
    if (!complexityValid) {
      throw new ValidationError('Выберите категорию сложности маршрута.');
    }

    const countNum =
      typeof input.participantsCount === 'number'
        ? input.participantsCount
        : Number.parseInt(String(input.participantsCount ?? '').trim(), 10);

    if (!Number.isFinite(countNum) || countNum < 1 || countNum > 500) {
      throw new ValidationError(
        'Количество участников должно быть целым числом от 1 до 500.'
      );
    }

    let distanceKm: number | null = null;
    if (input.distanceKm !== undefined && input.distanceKm !== null) {
      const rawDist = String(input.distanceKm).trim().replace(',', '.');
      if (rawDist !== '') {
        const parsedDist = Number.parseFloat(rawDist);
        if (!Number.isFinite(parsedDist) || parsedDist <= 0 || parsedDist > 5000) {
          throw new ValidationError(
            'Протяжённость маршрута должна быть от 0.1 до 5000 км.'
          );
        }
        distanceKm = Math.round(parsedDist * 10) / 10;
      }
    }

    const cleanTitle =
      (typeof input.routeTitle === 'string' ? input.routeTitle.trim() : '').slice(0, 140) ||
      `Маршрут ${input.complexity} · ${region.shortName}`;

    const cleanNotes =
      typeof input.notes === 'string' ? input.notes.trim().slice(0, 280) : '';

    const normalizeEndpoint = (
      raw: GeoEndpoint | null | undefined,
      fieldLabel: string
    ): GeoEndpoint | null => {
      if (!raw || typeof raw !== 'object') return null;
      const lat = Number(raw.lat);
      const lon = Number(raw.lon);
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        lat < -90 ||
        lat > 90 ||
        lon < -180 ||
        lon > 180
      ) {
        throw new ValidationError(`Укажите корректные координаты (${fieldLabel}).`);
      }
      const label =
        typeof raw.label === 'string' && raw.label.trim()
          ? raw.label.trim().slice(0, 80)
          : undefined;
      return {
        lat: Math.round(lat * 10000) / 10000,
        lon: Math.round(lon * 10000) / 10000,
        ...(label ? { label } : {}),
      };
    };

    const startPoint = normalizeEndpoint(input.startPoint, 'точка старта');
    const finishPoint = normalizeEndpoint(input.finishPoint, 'точка финиша');

    const id = `exp-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`;

    return new ExperienceEntry({
      id,
      date,
      routeTitle: cleanTitle,
      regionId: region.id,
      regionName: region.name,
      complexity: input.complexity,
      participantsCount: Math.round(countNum),
      distanceKm,
      notes: cleanNotes,
      startPoint,
      finishPoint,
      createdAt: now.toISOString(),
    });
  }

  static rehydrate(snapshot: ExperienceLogEntry): ExperienceEntry {
    return new ExperienceEntry({ ...snapshot });
  }

  toSnapshot(): ExperienceLogEntry {
    return {
      id: this.id,
      date: this.date,
      routeTitle: this.routeTitle,
      regionId: this.regionId,
      regionName: this.regionName,
      complexity: this.complexity,
      participantsCount: this.participantsCount,
      distanceKm: this.distanceKm,
      notes: this.notes,
      ...(this.startPoint ? { startPoint: this.startPoint } : {}),
      ...(this.finishPoint ? { finishPoint: this.finishPoint } : {}),
      createdAt: this.createdAt,
    };
  }
}

export function validateJournalEntryInput(
  input: JournalEntryDraftInput,
  now: Date = new Date()
): { ok: true; entry: ExperienceLogEntry } | { ok: false; error: string } {
  try {
    const entity = ExperienceEntry.create(input, now);
    return { ok: true, entry: entity.toSnapshot() };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Не удалось проверить запись похода.',
    };
  }
}

export function getDefaultJournalEntries(preferredRegionName?: string): ExperienceLogEntry[] {
  const homeId = resolveJournalRegionId(preferredRegionName);
  const homeRegion = getJournalRegionById(homeId);

  const homeStartEnd: Record<
    DfoJournalRegionId,
    { start: GeoEndpoint; finish: GeoEndpoint }
  > = {
    primorye: {
      start: { lat: 43.0582, lon: 132.6815, label: 'с. Лукьяновка (старт тропы)' },
      finish: { lat: 43.0789, lon: 132.6934, label: 'Вершина г. Пидан (1332 м)' },
    },
    kamchatka: {
      start: { lat: 53.255, lon: 158.83, label: 'Базовый лагерь Авача' },
      finish: { lat: 53.301, lon: 158.785, label: 'Перемычка г. Верблюд' },
    },
    khabarovsk: {
      start: { lat: 48.27, lon: 135.42, label: 'Кордон Большехехцирский' },
      finish: { lat: 48.32, lon: 135.51, label: 'Видовая сопка Хехцир' },
    },
    sakhalin: {
      start: { lat: 47.03, lon: 142.81, label: 'ст. Пик Чехова' },
      finish: { lat: 47.06, lon: 142.86, label: 'г. Чехова (1045 м)' },
    },
    yakutia: {
      start: { lat: 61.105, lon: 127.36, label: 'База р. Лена (Батамай)' },
      finish: { lat: 61.168, lon: 127.49, label: 'Ленские столбы (смотр. тропа)' },
    },
    amur: {
      start: { lat: 53.68, lon: 127.18, label: 'п. Снежногорский' },
      finish: { lat: 53.79, lon: 127.35, label: 'Хребет Тукурингра' },
    },
    'magadan-chukotka': {
      start: { lat: 59.56, lon: 150.8, label: 'б. Нагаева, г. Магадан' },
      finish: { lat: 59.62, lon: 151.05, label: 'Марчеканская сопка' },
    },
  };

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
      distanceKm: 18.5,
      notes: 'Уведомление МЧС за 10 дней, проверка групповой аптечки WFA и раций.',
      startPoint: homeStartEnd[homeId].start,
      finishPoint: homeStartEnd[homeId].finish,
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
      distanceKm: 54.0,
      notes: 'Рафтинг и катамараны-4, страховка с берега, безаварийное прохождение.',
      startPoint: { lat: 53.317, lon: 157.539, label: 'с. Малки (стапель)' },
      finishPoint: { lat: 52.885, lon: 156.925, label: 'Японский мост (антистапель)' },
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
      distanceKm: 82.0,
      notes: 'Согласование маршрута с администрацией Буреинского заповедника.',
      startPoint: { lat: 51.96, lon: 134.92, label: 'р. Нилан / кордон заповедника' },
      finishPoint: { lat: 52.14, lon: 135.18, label: 'оз. Медвежье (перевал)' },
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
      distanceKm: 16.2,
      notes: 'Контроль приливно-отливной таблицы и брифинг по технике безопасности.',
      startPoint: { lat: 46.54, lon: 143.52, label: 'м. Птичий (выход на берег)' },
      finishPoint: { lat: 46.51, lon: 143.57, label: 'м. Великан (бухта)' },
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
      distanceKm: 21.4,
      notes: 'Отработка навигации в тумане по ГЛОНАСС и бумажной топокарте.',
      startPoint: { lat: 43.635, lon: 134.142, label: 'с. Ясное / ключ Партизанский' },
      finishPoint: { lat: 43.694, lon: 134.198, label: 'Вершина г. Облачная (1854 м)' },
      createdAt: '2026-06-07T11:15:00Z',
    },
  ];

  return base.sort((a, b) => b.date.localeCompare(a.date));
}
