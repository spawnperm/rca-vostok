export type HubWeatherCondition =
  | 'clear'
  | 'partly-cloudy'
  | 'overcast'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'wind';

export type HubGuideStatus = 'favourable' | 'caution' | 'restricted';

export interface TourismHubWeather {
  id: string;
  city: string;
  region: string;
  hubRole: string;
  lat: number;
  lon: number;
  tempC: number;
  feelsLikeC: number;
  windMs: number;
  windGustMs: number;
  humidityPct: number;
  pressureMmHg: number;
  condition: HubWeatherCondition;
  conditionLabel: string;
  guideStatus: HubGuideStatus;
  guideStatusLabel: string;
  localTimeLabel: string;
}

export interface HubsWeatherResponse {
  hubs: TourismHubWeather[];
  fetchedAtIso: string;
  source: 'open-meteo' | 'climatology-fallback';
}

interface HubDefinition {
  id: string;
  city: string;
  region: string;
  hubRole: string;
  lat: number;
  lon: number;
  utcOffsetHours: number;
  monthlyTempC: number[];
  baseWindMs: number;
  baseHumidityPct: number;
  coastal: boolean;
}

export const FAR_EAST_TOURISM_HUBS: HubDefinition[] = [
  {
    id: 'vladivostok',
    city: 'Владивосток',
    region: 'Приморский край',
    hubRole: 'Опорный центр РЦА · ВВГУ',
    lat: 43.1155,
    lon: 131.8855,
    utcOffsetHours: 10,
    monthlyTempC: [-11, -7, 0, 6, 12, 16, 20, 22, 17, 10, 1, -7],
    baseWindMs: 6.4,
    baseHumidityPct: 68,
    coastal: true,
  },
  {
    id: 'petropavlovsk',
    city: 'Петропавловск-Камчатский',
    region: 'Камчатский край',
    hubRole: 'Вулканические и горные маршруты',
    lat: 53.0245,
    lon: 158.6433,
    utcOffsetHours: 12,
    monthlyTempC: [-7, -6, -3, 1, 5, 10, 13, 14, 11, 6, -1, -5],
    baseWindMs: 7.8,
    baseHumidityPct: 74,
    coastal: true,
  },
  {
    id: 'khabarovsk',
    city: 'Хабаровск',
    region: 'Хабаровский край',
    hubRole: 'Таёжные сплавы и хребты',
    lat: 48.4802,
    lon: 135.0719,
    utcOffsetHours: 10,
    monthlyTempC: [-19, -15, -6, 5, 13, 19, 22, 20, 14, 6, -6, -16],
    baseWindMs: 4.3,
    baseHumidityPct: 64,
    coastal: false,
  },
  {
    id: 'yuzhno-sakhalinsk',
    city: 'Южно-Сахалинск',
    region: 'Сахалинская область',
    hubRole: 'Сахалин и Курильские туры',
    lat: 46.9591,
    lon: 142.738,
    utcOffsetHours: 11,
    monthlyTempC: [-12, -10, -5, 2, 8, 13, 17, 18, 14, 8, 0, -8],
    baseWindMs: 5.9,
    baseHumidityPct: 76,
    coastal: true,
  },
  {
    id: 'yakutsk',
    city: 'Якутск',
    region: 'Республика Саха (Якутия)',
    hubRole: 'Ленские столбы и Север',
    lat: 62.0355,
    lon: 129.6755,
    utcOffsetHours: 9,
    monthlyTempC: [-38, -33, -19, -4, 8, 17, 20, 16, 7, -6, -26, -36],
    baseWindMs: 3.2,
    baseHumidityPct: 70,
    coastal: false,
  },
];

const CONDITION_LABELS: Record<HubWeatherCondition, string> = {
  clear: 'Ясно',
  'partly-cloudy': 'Малооблачно',
  overcast: 'Пасмурно',
  fog: 'Туман / дымка',
  rain: 'Осадки',
  snow: 'Снег',
  wind: 'Ветрено',
};

function mapWmoCode(wmoCode: number, windMs: number, tempC: number): HubWeatherCondition {
  if (wmoCode === 45 || wmoCode === 48) return 'fog';
  if ((wmoCode >= 71 && wmoCode <= 77) || wmoCode === 85 || wmoCode === 86) return 'snow';
  if (
    (wmoCode >= 51 && wmoCode <= 67) ||
    (wmoCode >= 80 && wmoCode <= 82) ||
    wmoCode >= 95
  ) {
    return tempC <= -1 ? 'snow' : 'rain';
  }
  if (windMs >= 10) return 'wind';
  if (wmoCode === 0) return 'clear';
  if (wmoCode === 1 || wmoCode === 2) return 'partly-cloudy';
  return 'overcast';
}

function assessGuideStatus(
  windGustMs: number,
  condition: HubWeatherCondition,
  tempC: number
): { status: HubGuideStatus; label: string } {
  if (windGustMs >= 15 || condition === 'rain' || condition === 'snow' || tempC <= -22) {
    return { status: 'restricted', label: 'Сложные условия' };
  }
  if (windGustMs >= 10 || condition === 'fog' || condition === 'wind' || tempC <= -8) {
    return { status: 'caution', label: 'Контроль экипировки' };
  }
  return { status: 'favourable', label: 'Благоприятно' };
}

function formatLocalTime(utcOffsetHours: number, now: Date): string {
  const localMs = now.getTime() + utcOffsetHours * 3600 * 1000;
  const dt = new Date(localMs);
  const hh = String(dt.getUTCHours()).padStart(2, '0');
  const mm = String(dt.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function unitRoll(seed: number, salt: number): number {
  const x = Math.sin(seed * 0.0017 + salt * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function buildFallbackHubsWeather(now = new Date()): HubsWeatherResponse {
  const monthIdx = now.getUTCMonth();
  const dateKey = now.toISOString().slice(0, 13); // hourly stability

  const hubs: TourismHubWeather[] = FAR_EAST_TOURISM_HUBS.map((hub) => {
    const seed = hashSeed(`${hub.id}:${dateKey}`);
    const baseTemp = hub.monthlyTempC[monthIdx] ?? 0;
    const tempC = Math.round(baseTemp + (unitRoll(seed, 1) - 0.5) * 4);
    const windMs = Math.round(Math.max(1.2, hub.baseWindMs + (unitRoll(seed, 2) - 0.45) * 3.8) * 10) / 10;
    const windGustMs = Math.round(windMs * (1.35 + unitRoll(seed, 3) * 0.3));
    const feelsLikeC = Math.round(tempC - (windMs >= 4 ? (windMs - 2.5) * 0.65 : 0));
    const humidityPct = Math.min(96, Math.max(38, Math.round(hub.baseHumidityPct + (unitRoll(seed, 4) - 0.5) * 18)));
    const pressureMmHg = Math.round(758 + (unitRoll(seed, 5) - 0.5) * 14);

    const roll = unitRoll(seed, 6);
    let condition: HubWeatherCondition = 'partly-cloudy';
    if (windMs >= 10) condition = 'wind';
    else if (hub.coastal && roll > 0.78) condition = 'fog';
    else if (roll > 0.65) condition = tempC <= 0 ? 'snow' : 'rain';
    else if (roll > 0.45) condition = 'overcast';
    else if (roll < 0.25) condition = 'clear';

    const guide = assessGuideStatus(windGustMs, condition, tempC);

    return {
      id: hub.id,
      city: hub.city,
      region: hub.region,
      hubRole: hub.hubRole,
      lat: hub.lat,
      lon: hub.lon,
      tempC,
      feelsLikeC,
      windMs,
      windGustMs,
      humidityPct,
      pressureMmHg,
      condition,
      conditionLabel: CONDITION_LABELS[condition],
      guideStatus: guide.status,
      guideStatusLabel: guide.label,
      localTimeLabel: formatLocalTime(hub.utcOffsetHours, now),
    };
  });

  return {
    hubs,
    fetchedAtIso: now.toISOString(),
    source: 'climatology-fallback',
  };
}

interface OpenMeteoCurrentPayload {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
    surface_pressure?: number;
  };
}

let cachedResponse: { expiresAtMs: number; data: HubsWeatherResponse } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function getFarEastHubsWeather(forceRefresh = false): Promise<HubsWeatherResponse> {
  const nowMs = Date.now();
  if (!forceRefresh && cachedResponse && cachedResponse.expiresAtMs > nowMs) {
    return cachedResponse.data;
  }

  const now = new Date(nowMs);
  const latitudes = FAR_EAST_TOURISM_HUBS.map((h) => h.lat).join(',');
  const longitudes = FAR_EAST_TOURISM_HUBS.map((h) => h.lon).join(',');
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitudes}&longitude=${longitudes}` +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,surface_pressure' +
    '&wind_speed_unit=ms&timezone=auto';

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(2500),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP ${res.status}`);
    }
    const raw = (await res.json()) as OpenMeteoCurrentPayload[] | OpenMeteoCurrentPayload;
    const entries = Array.isArray(raw) ? raw : [raw];
    if (entries.length !== FAR_EAST_TOURISM_HUBS.length) {
      throw new Error('Unexpected Open-Meteo array length');
    }

    const hubs: TourismHubWeather[] = FAR_EAST_TOURISM_HUBS.map((hub, idx) => {
      const cur = entries[idx]?.current;
      if (!cur || typeof cur.temperature_2m !== 'number') {
        throw new Error('Incomplete Open-Meteo payload');
      }
      const tempC = Math.round(cur.temperature_2m);
      const feelsLikeC = Math.round(cur.apparent_temperature ?? cur.temperature_2m);
      const windMs = Math.round((cur.wind_speed_10m ?? hub.baseWindMs) * 10) / 10;
      const windGustMs = Math.round(cur.wind_gusts_10m ?? windMs * 1.4);
      const humidityPct = Math.round(cur.relative_humidity_2m ?? hub.baseHumidityPct);
      const pressureMmHg = Math.round((cur.surface_pressure ?? 1013) * 0.750062);
      const condition = mapWmoCode(cur.weather_code ?? 2, windMs, tempC);
      const guide = assessGuideStatus(windGustMs, condition, tempC);

      return {
        id: hub.id,
        city: hub.city,
        region: hub.region,
        hubRole: hub.hubRole,
        lat: hub.lat,
        lon: hub.lon,
        tempC,
        feelsLikeC,
        windMs,
        windGustMs,
        humidityPct,
        pressureMmHg,
        condition,
        conditionLabel: CONDITION_LABELS[condition],
        guideStatus: guide.status,
        guideStatusLabel: guide.label,
        localTimeLabel: formatLocalTime(hub.utcOffsetHours, now),
      };
    });

    const response: HubsWeatherResponse = {
      hubs,
      fetchedAtIso: now.toISOString(),
      source: 'open-meteo',
    };
    cachedResponse = { expiresAtMs: nowMs + CACHE_TTL_MS, data: response };
    return response;
  } catch {
    const fallback = buildFallbackHubsWeather(now);
    cachedResponse = { expiresAtMs: nowMs + 60 * 1000, data: fallback };
    return fallback;
  }
}
