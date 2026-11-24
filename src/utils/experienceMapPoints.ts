import type {
  DfoJournalRegionId,
  ExperienceLogEntry,
  GeoEndpoint,
} from '../domain/experience/ExperienceEntry.ts';

export interface ResolvedExpeditionEndpoints {
  entry: ExperienceLogEntry;
  start: { lat: number; lon: number; label: string };
  finish: { lat: number; lon: number; label: string };
  coordinateSource: 'explicit' | 'landmark' | 'region_model';
}

interface LandmarkPreset {
  keywords: readonly string[];
  regionId?: DfoJournalRegionId;
  start: Required<GeoEndpoint>;
  finish: Required<GeoEndpoint>;
}

const DFO_LANDMARK_PRESETS: readonly LandmarkPreset[] = [
  {
    keywords: ['пидан', 'ливадийск', 'лукьяновк'],
    regionId: 'primorye',
    start: { lat: 43.0582, lon: 132.6815, label: 'с. Лукьяновка (старт)' },
    finish: { lat: 43.0789, lon: 132.6934, label: 'Вершина г. Пидан (1332 м)' },
  },
  {
    keywords: ['облачн'],
    regionId: 'primorye',
    start: { lat: 43.635, lon: 134.142, label: 'с. Ясное (подход)' },
    finish: { lat: 43.694, lon: 134.198, label: 'Вершина г. Облачная (1854 м)' },
  },
  {
    keywords: ['чандалаз', 'лозовый'],
    regionId: 'primorye',
    start: { lat: 43.012, lon: 133.012, label: 'подножие хр. Чандалаз' },
    finish: { lat: 43.039, lon: 133.028, label: 'Гребень Чандалаза' },
  },
  {
    keywords: ['кема', 'бикин'],
    regionId: 'primorye',
    start: { lat: 45.642, lon: 136.895, label: 'Верховья р. Кема' },
    finish: { lat: 45.458, lon: 137.18, label: 'с. Великая Кема (выход)' },
  },
  {
    keywords: ['быстрая', 'малкин'],
    regionId: 'kamchatka',
    start: { lat: 53.317, lon: 157.539, label: 'с. Малки (стапель)' },
    finish: { lat: 52.885, lon: 156.925, label: 'Японский мост (антистапель)' },
  },
  {
    keywords: ['авач', 'коряк', 'верблюд'],
    regionId: 'kamchatka',
    start: { lat: 53.255, lon: 158.83, label: 'Базовый лагерь Авача' },
    finish: { lat: 53.301, lon: 158.785, label: 'Перевал / кратер Авачинский' },
  },
  {
    keywords: ['дуссе', 'буреин'],
    regionId: 'khabarovsk',
    start: { lat: 51.96, lon: 134.92, label: 'р. Нилан (кордон)' },
    finish: { lat: 52.14, lon: 135.18, label: 'оз. Медвежье (хр. Дуссе-Алинь)' },
  },
  {
    keywords: ['мяо-чан', 'мяочан', 'амут'],
    regionId: 'khabarovsk',
    start: { lat: 50.79, lon: 136.44, label: 'пос. Горный' },
    finish: { lat: 50.835, lon: 136.38, label: 'оз. Амут / г. Чалба' },
  },
  {
    keywords: ['великан', 'птич'],
    regionId: 'sakhalin',
    start: { lat: 46.54, lon: 143.52, label: 'м. Птичий' },
    finish: { lat: 46.51, lon: 143.57, label: 'м. Великан' },
  },
  {
    keywords: ['чехова', 'сусунай'],
    regionId: 'sakhalin',
    start: { lat: 47.03, lon: 142.81, label: 'Подход к г. Чехова' },
    finish: { lat: 47.06, lon: 142.86, label: 'Пик Чехова (1045 м)' },
  },
  {
    keywords: ['ленск', 'столб', 'синяя'],
    regionId: 'yakutia',
    start: { lat: 61.105, lon: 127.36, label: 'с. Батамай (пристань)' },
    finish: { lat: 61.168, lon: 127.49, label: 'Парк «Ленские столбы»' },
  },
  {
    keywords: ['тукурингр', 'зейск'],
    regionId: 'amur',
    start: { lat: 53.68, lon: 127.18, label: 'п. Снежногорский' },
    finish: { lat: 53.79, lon: 127.35, label: 'Хребет Тукурингра' },
  },
  {
    keywords: ['джек лондон', 'магадан', 'нагаев'],
    regionId: 'magadan-chukotka',
    start: { lat: 62.08, lon: 149.49, label: 'Кордон оз. Джека Лондона' },
    finish: { lat: 62.13, lon: 149.57, label: 'Оз. Танцующих Хариусов' },
  },
];

const REGION_BASE_ANCHORS: Record<
  DfoJournalRegionId,
  { lat: number; lon: number; startLabel: string; finishLabel: string }
> = {
  primorye: {
    lat: 43.82,
    lon: 133.42,
    startLabel: 'Базовая точка маршрута (Приморье)',
    finishLabel: 'Финишная точка (Приморье)',
  },
  kamchatka: {
    lat: 53.45,
    lon: 158.12,
    startLabel: 'Базовая точка (Камчатка)',
    finishLabel: 'Финишная точка (Камчатка)',
  },
  khabarovsk: {
    lat: 49.45,
    lon: 135.85,
    startLabel: 'Базовая точка (Хабаровский край)',
    finishLabel: 'Финишная точка (Хабаровский край)',
  },
  sakhalin: {
    lat: 47.42,
    lon: 142.95,
    startLabel: 'Базовая точка (Сахалин)',
    finishLabel: 'Финишная точка (Сахалин)',
  },
  yakutia: {
    lat: 61.55,
    lon: 128.65,
    startLabel: 'Базовая точка (Якутия)',
    finishLabel: 'Финишная точка (Якутия)',
  },
  amur: {
    lat: 52.45,
    lon: 127.85,
    startLabel: 'Базовая точка (Приамурье)',
    finishLabel: 'Финишная точка (Приамурье)',
  },
  'magadan-chukotka': {
    lat: 60.45,
    lon: 151.15,
    startLabel: 'Базовая точка (Колыма / Чукотка)',
    finishLabel: 'Финишная точка (Колыма / Чукотка)',
  },
};

function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Resolves guaranteed Start and Finish coordinates for every expedition in the
 * Experience Journal so the interactive Leaflet map always renders both
 * endpoints and the connecting route track.
 */
export function resolveExpeditionEndpoints(
  entry: ExperienceLogEntry
): ResolvedExpeditionEndpoints {
  if (entry.startPoint && entry.finishPoint) {
    return {
      entry,
      start: {
        lat: entry.startPoint.lat,
        lon: entry.startPoint.lon,
        label: entry.startPoint.label || 'Старт маршрута',
      },
      finish: {
        lat: entry.finishPoint.lat,
        lon: entry.finishPoint.lon,
        label: entry.finishPoint.label || 'Финиш маршрута',
      },
      coordinateSource: 'explicit',
    };
  }

  const titleLower = entry.routeTitle.toLowerCase();
  const landmark = DFO_LANDMARK_PRESETS.find(
    (preset) =>
      (!preset.regionId || preset.regionId === entry.regionId) &&
      preset.keywords.some((kw) => titleLower.includes(kw))
  );

  if (landmark) {
    return {
      entry,
      start: entry.startPoint
        ? {
            lat: entry.startPoint.lat,
            lon: entry.startPoint.lon,
            label: entry.startPoint.label || landmark.start.label,
          }
        : { ...landmark.start },
      finish: entry.finishPoint
        ? {
            lat: entry.finishPoint.lat,
            lon: entry.finishPoint.lon,
            label: entry.finishPoint.label || landmark.finish.label,
          }
        : { ...landmark.finish },
      coordinateSource: entry.startPoint || entry.finishPoint ? 'explicit' : 'landmark',
    };
  }

  const anchor = REGION_BASE_ANCHORS[entry.regionId] ?? REGION_BASE_ANCHORS.primorye;
  const seed = stableHash(`${entry.id}:${entry.date}:${entry.routeTitle}`);

  // Spread points smoothly inside the subject so multiple manual hikes don't overlap identically
  const jitterLat = ((seed % 100) / 100 - 0.5) * 0.45;
  const jitterLon = (((seed >>> 8) % 100) / 100 - 0.5) * 0.65;
  const bearingRad = (((seed >>> 16) % 360) * Math.PI) / 180;

  const baseDistKm = entry.distanceKm && entry.distanceKm > 0 ? Math.min(entry.distanceKm, 140) : 22;
  const spanDegLat = Math.max(0.035, (baseDistKm / 111) * 0.55);
  const cosLat = Math.max(0.35, Math.cos((anchor.lat * Math.PI) / 180));
  const spanDegLon = spanDegLat / cosLat;

  const startLat = Math.round((anchor.lat + jitterLat) * 10000) / 10000;
  const startLon = Math.round((anchor.lon + jitterLon) * 10000) / 10000;
  const finishLat =
    Math.round((startLat + Math.sin(bearingRad) * spanDegLat) * 10000) / 10000;
  const finishLon =
    Math.round((startLon + Math.cos(bearingRad) * spanDegLon) * 10000) / 10000;

  return {
    entry,
    start: entry.startPoint
      ? {
          lat: entry.startPoint.lat,
          lon: entry.startPoint.lon,
          label: entry.startPoint.label || anchor.startLabel,
        }
      : { lat: startLat, lon: startLon, label: anchor.startLabel },
    finish: entry.finishPoint
      ? {
          lat: entry.finishPoint.lat,
          lon: entry.finishPoint.lon,
          label: entry.finishPoint.label || anchor.finishLabel,
        }
      : { lat: finishLat, lon: finishLon, label: anchor.finishLabel },
    coordinateSource: 'region_model',
  };
}

export function resolveAllExpeditionEndpoints(
  entries: readonly ExperienceLogEntry[]
): ResolvedExpeditionEndpoints[] {
  return entries.map((entry) => resolveExpeditionEndpoints(entry));
}
