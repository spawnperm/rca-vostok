import { CERTIFIED_TOURIST_ROUTES, type CertifiedTouristRoute } from '../data/researchData.ts';

export type WeatherConditionKind =
  | 'clear'
  | 'partly-cloudy'
  | 'overcast'
  | 'fog'
  | 'rain'
  | 'wind';

export type GuideWeatherStatus = 'favourable' | 'caution' | 'restricted';

export interface HourlyForecastPoint {
  timeLabel: string;
  tempC: number;
  windMs: number;
  precipProbPct: number;
  condition: WeatherConditionKind;
}

export interface DailyForecastPoint {
  isoDate: string;
  dayLabel: string;
  shortDateLabel: string;
  condition: WeatherConditionKind;
  conditionLabel: string;
  tempMinC: number;
  tempMaxC: number;
  windMaxMs: number;
  precipProbPct: number;
}

export interface RouteWeatherForecast {
  routeId: string;
  routeName: string;
  shortName: string;
  regionName: string;
  track: CertifiedTouristRoute['track'];
  trackLabel: string;
  difficultyCategory: string;
  lengthKm: number;
  durationLabel: string;
  coordinatesLabel: string;
  elevationLabel: string;
  microclimateSummary: string;
  fetchedAtIso: string;
  simulatedLatencyMs: number;
  current: {
    tempC: number;
    feelsLikeC: number;
    condition: WeatherConditionKind;
    conditionLabel: string;
    windSpeedMs: number;
    windGustMs: number;
    windDirection: string;
    humidityPct: number;
    pressureMmHg: number;
    precipitationMm: number;
    visibilityKm: number;
    uvIndex: number;
    surfaceOrWaterLabel: string;
    surfaceOrWaterValue: string;
  };
  guideStatus: GuideWeatherStatus;
  guideStatusLabel: string;
  guideAdvisory: string;
  hourlyOutlook: HourlyForecastPoint[];
  dailyOutlook: DailyForecastPoint[];
}

interface RouteMicroclimateProfile {
  elevationLabel: string;
  tempOffsetC: number;
  windBaseMs: number;
  humidityBias: number;
  pressureBaseMmHg: number;
  coastalFogProne: boolean;
  ridgeExposed: boolean;
  waterOrSurfaceLabel: string;
  microclimateSummary: string;
  windDirs: string[];
}

const ROUTE_MICROCLIMATE: Record<string, RouteMicroclimateProfile> = {
  'route-russky-tobizina': {
    elevationLabel: 'Высота 5–62 м (морские скалы)',
    tempOffsetC: -0.5,
    windBaseMs: 7.5,
    humidityBias: 8,
    pressureBaseMmHg: 758,
    coastalFogProne: true,
    ridgeExposed: false,
    waterOrSurfaceLabel: 'Вода / береговая кромка',
    microclimateSummary: 'Открытый морской мыс залива Петра Великого: резкие порывы южного и северо-западного ветра, возможен прибрежный туман.',
    windDirs: ['ЮВ', 'Ю', 'СЗ'],
  },
  'route-pidan-falaza': {
    elevationLabel: 'Перепад 280–1 332 м (хребет)',
    tempOffsetC: -5.5,
    windBaseMs: 8.5,
    humidityBias: 4,
    pressureBaseMmHg: 702,
    coastalFogProne: false,
    ridgeExposed: true,
    waterOrSurfaceLabel: 'Тропа / курумник гребня',
    microclimateSummary: 'Выраженная высотная поясность: температура на вершине г. Ливадийской (Пидан) ниже долины на 5–7 °C, высокая ветровая нагрузка на курумнике.',
    windDirs: ['СЗ', 'З', 'ЮЗ'],
  },
  'route-khasan-gamova': {
    elevationLabel: 'Высота 0–220 м (полуостров)',
    tempOffsetC: 1.0,
    windBaseMs: 6.5,
    humidityBias: 10,
    pressureBaseMmHg: 760,
    coastalFogProne: true,
    ridgeExposed: false,
    waterOrSurfaceLabel: 'Море / прибрежная экотропа',
    microclimateSummary: 'Южный приморский кластер: мягкий температурный режим, интенсивные морские бризы и частая адвективная дымка в утренние часы.',
    windDirs: ['ЮВ', 'В', 'Ю'],
  },
  'route-partizanskaya-water': {
    elevationLabel: 'Долина 0–140 м (река и залив)',
    tempOffsetC: 0.5,
    windBaseMs: 5.0,
    humidityBias: 5,
    pressureBaseMmHg: 759,
    coastalFogProne: false,
    ridgeExposed: false,
    waterOrSurfaceLabel: 'Температура воды / поток',
    microclimateSummary: 'Долина р. Партизанской с выходом в открытый залив Восток: спокойный режим в среднем течении и усиление ветра на устьевом участке.',
    windDirs: ['Ю', 'ЮВ', 'С'],
  },
  'route-bikin-taiga': {
    elevationLabel: 'Таёжный бассейн 180–420 м',
    tempOffsetC: -2.5,
    windBaseMs: 3.5,
    humidityBias: 3,
    pressureBaseMmHg: 748,
    coastalFogProne: false,
    ridgeExposed: false,
    waterOrSurfaceLabel: 'Вода р. Бикин / тайга',
    microclimateSummary: 'Континентальный таёжный микроклимат севера Приморья: ощутимые суточные перепады температур и утренние речные туманы.',
    windDirs: ['З', 'СЗ', 'ЮЗ'],
  },
  'route-kema-sikhote': {
    elevationLabel: 'Восточный склон 120–780 м',
    tempOffsetC: -3.0,
    windBaseMs: 6.0,
    humidityBias: 7,
    pressureBaseMmHg: 744,
    coastalFogProne: true,
    ridgeExposed: true,
    waterOrSurfaceLabel: 'Вода р. Кема / перевал',
    microclimateSummary: 'Сочетание горной реки и охотоморского влияния у Сихотэ-Алиня: прохладная вода, быстрый нагон облачности с моря.',
    windDirs: ['СВ', 'В', 'СЗ'],
  },
  'route-anyui-shantar': {
    elevationLabel: 'Горная долина 140–520 м',
    tempOffsetC: -3.5,
    windBaseMs: 4.5,
    humidityBias: 2,
    pressureBaseMmHg: 746,
    coastalFogProne: false,
    ridgeExposed: false,
    waterOrSurfaceLabel: 'Вода р. Анюй / перекаты',
    microclimateSummary: 'Горно-таёжный бассейн р. Анюй: прохладные ночи даже в середине лета, чувствительность уровня воды к верховым дождям.',
    windDirs: ['СЗ', 'ЮЗ', 'З'],
  },
  'route-kamchatka-volcano': {
    elevationLabel: 'Высокогорье 850–1 580 м',
    tempOffsetC: -7.5,
    windBaseMs: 10.5,
    humidityBias: 6,
    pressureBaseMmHg: 678,
    coastalFogProne: true,
    ridgeExposed: true,
    waterOrSurfaceLabel: 'Шлаковые поля / фирн',
    microclimateSummary: 'Высокогорная вулканическая зона: быстрая смена орографической облачности, низкая облачная база и порывистый ветер с Тихого океана.',
    windDirs: ['В', 'ЮВ', 'СВ'],
  },
  'route-sakhalin-velikan': {
    elevationLabel: 'Побережье 0–85 м (Охотское море)',
    tempOffsetC: -4.0,
    windBaseMs: 8.0,
    humidityBias: 11,
    pressureBaseMmHg: 755,
    coastalFogProne: true,
    ridgeExposed: false,
    waterOrSurfaceLabel: 'Охотское море / прилив',
    microclimateSummary: 'Прохладный охотоморский берег: холодная вода, частые туманы, прибрежный накат и необходимость точного расчёта приливов.',
    windDirs: ['В', 'СВ', 'ЮВ'],
  },
};

export const DISTRICT_TO_ROUTE_ID: Record<string, string> = {
  vladivostok: 'route-russky-tobizina',
  shkotovo: 'route-pidan-falaza',
  khasan: 'route-khasan-gamova',
  'nakhodka-partizansk': 'route-partizanskaya-water',
  'pozharsky-bikin': 'route-bikin-taiga',
  terney: 'route-kema-sikhote',
};

const MONTHLY_BASE_TEMP_C = [-11, -7, 0, 7, 13, 17, 21, 22, 17, 10, 1, -7];
const MONTHLY_RAIN_BIAS_PCT = [15, 18, 22, 30, 35, 48, 52, 50, 38, 28, 22, 18];

const CONDITION_LABELS: Record<WeatherConditionKind, string> = {
  clear: 'Ясно и солнечно',
  'partly-cloudy': 'Переменная облачность',
  overcast: 'Плотная облачность',
  fog: 'Морской туман и дымка',
  rain: 'Кратковременный дождь',
  wind: 'Порывистый ветер',
};

const WEEKDAYS_SHORT_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS_GENITIVE_RU = [
  'янв.',
  'февр.',
  'мар.',
  'апр.',
  'мая',
  'июня',
  'июля',
  'авг.',
  'сент.',
  'окт.',
  'нояб.',
  'дек.',
];

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededUnit(seed: number, salt: number): number {
  const x = Math.sin(seed * 0.0017 + salt * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatCoords(coords: [number, number][]): string {
  const first = coords[0];
  if (!first) return '—';
  return `${first[0].toFixed(2)}° N, ${first[1].toFixed(2)}° E`;
}

function pickCondition(
  precipProbPct: number,
  windMs: number,
  coastalFogProne: boolean,
  roll: number
): WeatherConditionKind {
  if (precipProbPct >= 58) return 'rain';
  if (windMs >= 11) return 'wind';
  if (coastalFogProne && roll > 0.62) return 'fog';
  if (precipProbPct >= 38) return 'overcast';
  if (roll > 0.35) return 'partly-cloudy';
  return 'clear';
}

function buildGuideAssessment(
  route: CertifiedTouristRoute,
  tempC: number,
  windGustMs: number,
  precipitationMm: number,
  visibilityKm: number
): { status: GuideWeatherStatus; label: string; advisory: string } {
  const isWater = route.track === 'water';
  const isExpedition = route.track === 'expedition';

  if (windGustMs >= 16 || precipitationMm >= 7 || visibilityKm <= 1.5) {
    return {
      status: 'restricted',
      label: 'Выход с жёсткими ограничениями',
      advisory: isWater
        ? `Порывы до ${windGustMs} м/с и осадки (${precipitationMm} мм) повышают паводковый риск. Проверьте уровень воды перед спуском судов, сократите плечо сплава и держите связь по протоколу МЧС.`
        : `Сильный ветер до ${windGustMs} м/с и видимость ${visibilityKm} км осложняют прохождение открытых участков. Рекомендуется корректировка нитки маршрута в паспорте и контроль замыкающего.`,
    };
  }

  if (windGustMs >= 11 || precipitationMm >= 2 || tempC <= 2 || visibilityKm <= 4) {
    return {
      status: 'caution',
      label: 'Внимание к экипировке и темпу',
      advisory: isExpedition
        ? `Сложные микроклиматические условия (${tempC > 0 ? `+${tempC}` : tempC} °C, порывы ${windGustMs} м/с). Обязательны утеплённый резерв, спутниковый трекер и проверка аптечки WFA перед выходом.`
        : `На маршруте «${route.shortName}» возможны скользкие участки или ветровая прохлада. Проверьте мембранную защиту, протектор обуви группы и соблюдайте норму ${route.groupNorm}.`,
    };
  }

  return {
    status: 'favourable',
    label: 'Благоприятно для выхода',
    advisory: `Погодное окно соответствует стандартам сопровождения по маршруту «${route.shortName}» (${route.difficultyCategory}). Контролируйте питьевой режим, контрольное время выхода и нагрудный бейдж реестра.`,
  };
}

function buildSurfaceOrWaterValue(
  route: CertifiedTouristRoute,
  tempC: number,
  precipitationMm: number
): string {
  if (route.track === 'water') {
    const waterTemp = clamp(Math.round(tempC * 0.52 + 4), 2, 21);
    const levelNote = precipitationMm >= 4 ? 'уровень выше нормы' : 'уровень стабильный';
    return `+${waterTemp} °C · ${levelNote}`;
  }
  if (tempC <= 0) {
    return 'Промерзание грунта / наледь';
  }
  if (precipitationMm >= 2.5) {
    return 'Влажная тропа / скользкий курумник';
  }
  return 'Сухое твёрдое покрытие';
}

function generateForecastPayload(
  route: CertifiedTouristRoute,
  latencyMs: number,
  refreshSeed: number,
  now = new Date()
): RouteWeatherForecast {
  const profile = ROUTE_MICROCLIMATE[route.id] ?? ROUTE_MICROCLIMATE['route-russky-tobizina'];
  const monthIdx = now.getMonth();
  const dayKey = `${now.getFullYear()}-${monthIdx + 1}-${now.getDate()}`;
  const baseSeed = hashString(`${route.id}:${dayKey}`) + refreshSeed * 97;

  const seasonalTemp = MONTHLY_BASE_TEMP_C[monthIdx] ?? 12;
  const jitterTemp = Math.round((seededUnit(baseSeed, 1) - 0.5) * 4);
  const currentTemp = Math.round(seasonalTemp + profile.tempOffsetC + jitterTemp);

  const windSpeedMs = clamp(
    Math.round((profile.windBaseMs + (seededUnit(baseSeed, 2) - 0.45) * 4.5) * 10) / 10,
    1.5,
    17.0
  );
  const windGustMs = Math.round(windSpeedMs * (1.35 + seededUnit(baseSeed, 3) * 0.35));

  const windChillPenalty = windSpeedMs >= 5 ? Math.round((windSpeedMs - 3) * 0.45) : 0;
  const feelsLikeC = currentTemp - windChillPenalty;

  const rainBias = MONTHLY_RAIN_BIAS_PCT[monthIdx] ?? 30;
  const precipProbNow = clamp(
    Math.round(rainBias + (seededUnit(baseSeed, 4) - 0.4) * 45),
    5,
    92
  );
  const condition = pickCondition(
    precipProbNow,
    windSpeedMs,
    profile.coastalFogProne,
    seededUnit(baseSeed, 5)
  );

  const precipitationMm =
    condition === 'rain'
      ? Math.round((1.8 + seededUnit(baseSeed, 6) * 6.8) * 10) / 10
      : condition === 'fog' || condition === 'overcast'
        ? Math.round(seededUnit(baseSeed, 6) * 1.1 * 10) / 10
        : 0;

  const humidityPct = clamp(
    Math.round(58 + profile.humidityBias + (condition === 'rain' || condition === 'fog' ? 18 : 0) + (seededUnit(baseSeed, 7) - 0.5) * 16),
    38,
    98
  );

  const pressureMmHg = Math.round(
    profile.pressureBaseMmHg + (seededUnit(baseSeed, 8) - 0.5) * 12 - (condition === 'rain' ? 5 : 0)
  );

  const visibilityKm =
    condition === 'fog'
      ? Math.round((1.2 + seededUnit(baseSeed, 9) * 2.5) * 10) / 10
      : condition === 'rain'
        ? Math.round((3.5 + seededUnit(baseSeed, 9) * 4.5) * 10) / 10
        : Math.round((12 + seededUnit(baseSeed, 9) * 10) * 10) / 10;

  const uvIndex =
    condition === 'clear' || condition === 'partly-cloudy'
      ? clamp(Math.round(2 + (monthIdx >= 3 && monthIdx <= 8 ? 4 : 1) + (profile.ridgeExposed ? 1 : 0)), 1, 8)
      : clamp(Math.round(1 + (monthIdx >= 4 && monthIdx <= 7 ? 2 : 0)), 1, 4);

  const windDir = profile.windDirs[baseSeed % profile.windDirs.length] ?? 'ЮВ';

  const hourlyOutlook: HourlyForecastPoint[] = [3, 6, 9, 12].map((offsetHours, idx) => {
    const target = new Date(now.getTime() + offsetHours * 3600 * 1000);
    const hour = target.getHours();
    const diurnalShift = hour >= 12 && hour <= 17 ? 2 : hour >= 0 && hour <= 6 ? -3 : 0;
    const hTemp = currentTemp + diurnalShift + Math.round((seededUnit(baseSeed, 20 + idx) - 0.5) * 2);
    const hWind = clamp(
      Math.round((windSpeedMs + (seededUnit(baseSeed, 30 + idx) - 0.45) * 2.6) * 10) / 10,
      1,
      19
    );
    const hProb = clamp(
      Math.round(precipProbNow + (seededUnit(baseSeed, 40 + idx) - 0.5) * 25),
      5,
      95
    );
    return {
      timeLabel: `${String(hour).padStart(2, '0')}:00`,
      tempC: hTemp,
      windMs: hWind,
      precipProbPct: hProb,
      condition: pickCondition(hProb, hWind, profile.coastalFogProne, seededUnit(baseSeed, 50 + idx)),
    };
  });

  const dailyOutlook: DailyForecastPoint[] = [0, 1, 2, 3].map((dayOffset) => {
    const target = new Date(now.getTime() + dayOffset * 86400 * 1000);
    const isoDate = target.toISOString().slice(0, 10);
    const dayShift = dayOffset === 0 ? 0 : Math.round((seededUnit(baseSeed, 60 + dayOffset) - 0.48) * 5);
    const maxC = currentTemp + dayShift + (dayOffset === 0 ? 1 : 2);
    const minC = maxC - (profile.ridgeExposed ? 7 : 5) - Math.round(seededUnit(baseSeed, 70 + dayOffset) * 2);
    const maxWind = clamp(
      Math.round(windSpeedMs + 1.5 + (seededUnit(baseSeed, 80 + dayOffset) - 0.4) * 4),
      2,
      18
    );
    const prob = clamp(
      Math.round(rainBias + (seededUnit(baseSeed, 90 + dayOffset) - 0.45) * 48),
      5,
      90
    );
    const cond =
      dayOffset === 0
        ? condition
        : pickCondition(prob, maxWind, profile.coastalFogProne, seededUnit(baseSeed, 100 + dayOffset));

    const dayLabel =
      dayOffset === 0
        ? 'Сегодня'
        : dayOffset === 1
          ? 'Завтра'
          : WEEKDAYS_SHORT_RU[target.getDay()];

    return {
      isoDate,
      dayLabel,
      shortDateLabel: `${target.getDate()} ${MONTHS_GENITIVE_RU[target.getMonth()]}`,
      condition: cond,
      conditionLabel: CONDITION_LABELS[cond],
      tempMinC: minC,
      tempMaxC: maxC,
      windMaxMs: maxWind,
      precipProbPct: prob,
    };
  });

  const guide = buildGuideAssessment(
    route,
    currentTemp,
    windGustMs,
    precipitationMm,
    visibilityKm
  );

  return {
    routeId: route.id,
    routeName: route.name,
    shortName: route.shortName,
    regionName: route.regionName,
    track: route.track,
    trackLabel: route.trackLabel,
    difficultyCategory: route.difficultyCategory,
    lengthKm: route.lengthKm,
    durationLabel: route.durationLabel,
    coordinatesLabel: formatCoords(route.coordinates),
    elevationLabel: profile.elevationLabel,
    microclimateSummary: profile.microclimateSummary,
    fetchedAtIso: now.toISOString(),
    simulatedLatencyMs: latencyMs,
    current: {
      tempC: currentTemp,
      feelsLikeC,
      condition,
      conditionLabel: CONDITION_LABELS[condition],
      windSpeedMs,
      windGustMs,
      windDirection: windDir,
      humidityPct,
      pressureMmHg,
      precipitationMm,
      visibilityKm,
      uvIndex,
      surfaceOrWaterLabel: profile.waterOrSurfaceLabel,
      surfaceOrWaterValue: buildSurfaceOrWaterValue(route, currentTemp, precipitationMm),
    },
    guideStatus: guide.status,
    guideStatusLabel: guide.label,
    guideAdvisory: guide.advisory,
    hourlyOutlook,
    dailyOutlook,
  };
}

/**
 * Simulates an asynchronous weather API request for a selected tourist route.
 * Supports AbortSignal for clean cancellation on rapid route switching.
 */
export function fetchRouteWeatherForecast(
  routeId: string,
  options?: { signal?: AbortSignal; refreshSeed?: number; delayMs?: number }
): Promise<RouteWeatherForecast> {
  const route = CERTIFIED_TOURIST_ROUTES.find((item) => item.id === routeId);
  if (!route) {
    return Promise.reject(new Error(`Маршрут с идентификатором «${routeId}» не найден.`));
  }

  const signal = options?.signal;
  if (signal?.aborted) {
    return Promise.reject(new Error('Запрос прогноза погоды отменён.'));
  }

  const refreshSeed = options?.refreshSeed ?? 0;
  const simulatedLatencyMs =
    options?.delayMs ?? 360 + (hashString(`${routeId}:${refreshSeed}`) % 180);

  return new Promise<RouteWeatherForecast>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Запрос прогноза погоды отменён.'));
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(generateForecastPayload(route, simulatedLatencyMs, refreshSeed));
    }, simulatedLatencyMs);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
