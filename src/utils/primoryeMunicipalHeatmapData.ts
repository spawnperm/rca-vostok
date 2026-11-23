import * as d3 from 'd3';

export type PrimoryeHeatmapMetric = 'density' | 'certified' | 'coveragePct' | 'deficit';

export interface PrimoryeMunicipalityFeature {
  id: string;
  name: string;
  shortName: string;
  adminCenter: string;
  zoneLabel: string;
  areaKm2: number;
  certifiedInRegistry: number;
  estimatedDemand: number;
  activeRoutesCount: number;
  keyHubs: string;
  /** Planar SVG-space ring [x, y] forming contiguous municipal tessellation inside Primorsky Krai. */
  ring: readonly [number, number][];
  labelOffset?: { dx: number; dy: number };
}

export interface PrimoryeMunicipalityComputed extends PrimoryeMunicipalityFeature {
  deficit: number;
  coveragePct: number;
  densityPer1000Km2: number;
  concentrationTier: 'high' | 'medium' | 'low';
  concentrationLabel: string;
  pathData: string;
  centroidX: number;
  centroidY: number;
  labelX: number;
  labelY: number;
}

/**
 * Contiguous municipal tessellation of Primorsky Krai (~164.7k km² total).
 * Certified counts across core tourist municipalities reflect PRIMORYE_DISTRICTS (sum = 122).
 */
export const PRIMORYE_MUNICIPALITIES: readonly PrimoryeMunicipalityFeature[] = [
  {
    id: 'muni-pozharsky',
    name: 'Пожарский и Красноармейский округа',
    shortName: 'Пожарский (Бикин)',
    adminCenter: 'пгт Лучегорск / с. Красный Яр',
    zoneLabel: 'Северо-западный таёжный пояс',
    areaKm2: 43200,
    certifiedInRegistry: 7,
    estimatedDemand: 160,
    activeRoutesCount: 11,
    keyHubs: 'Нацпарк «Бикин», р. Бикин, этнокластер Красный Яр',
    ring: [
      [196, 52],
      [284, 34],
      [304, 156],
      [252, 186],
      [172, 174],
      [182, 102],
    ],
    labelOffset: { dx: -4, dy: 0 },
  },
  {
    id: 'muni-terney',
    name: 'Тернейский муниципальный округ',
    shortName: 'Тернейский',
    adminCenter: 'пгт Терней',
    zoneLabel: 'Северное побережье и Сихотэ-Алинь',
    areaKm2: 27700,
    certifiedInRegistry: 4,
    estimatedDemand: 190,
    activeRoutesCount: 12,
    keyHubs: 'Сихотэ-Алинский заповедник, р. Кема, бухта Благодатная',
    ring: [
      [284, 34],
      [346, 58],
      [398, 122],
      [362, 206],
      [304, 198],
      [304, 156],
    ],
    labelOffset: { dx: 4, dy: -4 },
  },
  {
    id: 'muni-khanka-spassk',
    name: 'Спасский, Ханкайский и Кировский округа',
    shortName: 'Приханкайский',
    adminCenter: 'г. Спасск-Дальний',
    zoneLabel: 'Равнинный и Приханкайский кластер',
    areaKm2: 33400,
    certifiedInRegistry: 0,
    estimatedDemand: 85,
    activeRoutesCount: 6,
    keyHubs: 'Озеро Ханка, Ханкайский заповедник, водно-болотные экотропы',
    ring: [
      [172, 174],
      [252, 186],
      [246, 266],
      [186, 294],
      [126, 286],
      [148, 224],
    ],
  },
  {
    id: 'muni-dalnegorsk-chuguevka',
    name: 'Дальнегорский и Чугуевский округа',
    shortName: 'Дальнегорский',
    adminCenter: 'г. Дальнегорск',
    zoneLabel: 'Центральный Сихотэ-Алинь',
    areaKm2: 17600,
    certifiedInRegistry: 0,
    estimatedDemand: 75,
    activeRoutesCount: 7,
    keyHubs: 'Нацпарк «Зов тигра» (сев.), хребет Сихотэ-Алинь, спелеомаршруты',
    ring: [
      [252, 186],
      [304, 156],
      [304, 198],
      [362, 206],
      [338, 272],
      [272, 284],
      [246, 266],
    ],
  },
  {
    id: 'muni-kavalerovo-olga',
    name: 'Кавалеровский и Ольгинский округа',
    shortName: 'Кавалерово · Ольга',
    adminCenter: 'пгт Кавалерово / пгт Ольга',
    zoneLabel: 'Восточное побережье и горные реки',
    areaKm2: 10600,
    certifiedInRegistry: 5,
    estimatedDemand: 150,
    activeRoutesCount: 14,
    keyHubs: 'Бухта Дубовая, мыс Четырёх Скал, реки Аввакумовка и Зеркальная',
    ring: [
      [272, 284],
      [338, 272],
      [318, 344],
      [268, 346],
      [256, 310],
    ],
  },
  {
    id: 'muni-ussuriysk',
    name: 'Уссурийский ГО и Октябрьский округ',
    shortName: 'Уссурийский ГО',
    adminCenter: 'г. Уссурийск',
    zoneLabel: 'Западный транспортный и заповедный узел',
    areaKm2: 12100,
    certifiedInRegistry: 0,
    estimatedDemand: 95,
    activeRoutesCount: 8,
    keyHubs: 'Уссурийский заповедник, Кравцовка (транзит), исторические маршруты',
    ring: [
      [126, 286],
      [186, 294],
      [196, 368],
      [148, 392],
      [112, 376],
      [114, 326],
    ],
  },
  {
    id: 'muni-lazo',
    name: 'Лазовский муниципальный округ',
    shortName: 'Лазовский',
    adminCenter: 'с. Лазо',
    zoneLabel: 'Заповедное юго-восточное побережье',
    areaKm2: 4700,
    certifiedInRegistry: 6,
    estimatedDemand: 180,
    activeRoutesCount: 16,
    keyHubs: 'Лазовский заповедник, о. Петрова, Беневские водопады, бухта Тасовая',
    ring: [
      [256, 310],
      [268, 346],
      [318, 344],
      [284, 412],
      [238, 408],
      [234, 356],
    ],
  },
  {
    id: 'muni-shkotovo',
    name: 'Шкотовский МО и Артёмовский ГО',
    shortName: 'Шкотовский',
    adminCenter: 'пгт Смоляниново',
    zoneLabel: 'Полевой полигон РЦА и горный треккинг',
    areaKm2: 3400,
    certifiedInRegistry: 24,
    estimatedDemand: 290,
    activeRoutesCount: 27,
    keyHubs: 'Гора Ливадийская (Пидан), г. Фалаза, Смольные водопады, полигон ФСТР',
    ring: [
      [186, 294],
      [246, 266],
      [256, 310],
      [234, 356],
      [208, 402],
      [180, 402],
      [196, 368],
    ],
    labelOffset: { dx: 0, dy: -6 },
  },
  {
    id: 'muni-nakhodka-partizansk',
    name: 'Находкинский ГО и Партизанский округ',
    shortName: 'Находка · Партизанск',
    adminCenter: 'г. Находка / г. Партизанск',
    zoneLabel: 'Водный кластер и прибрежные глэмпинги',
    areaKm2: 4600,
    certifiedInRegistry: 16,
    estimatedDemand: 340,
    activeRoutesCount: 29,
    keyHubs: 'Бухта Триозёрье, залив Восток, г. Сестра, р. Партизанская',
    ring: [
      [234, 356],
      [238, 408],
      [284, 412],
      [246, 446],
      [204, 446],
      [208, 402],
    ],
    labelOffset: { dx: 4, dy: 8 },
  },
  {
    id: 'muni-vladivostok',
    name: 'Владивостокский ГО (вкл. о. Русский)',
    shortName: 'Владивосток',
    adminCenter: 'г. Владивосток',
    zoneLabel: 'Опорный центр аттестации ВВГУ / РЦА',
    areaKm2: 560,
    certifiedInRegistry: 42,
    estimatedDemand: 480,
    activeRoutesCount: 38,
    keyHubs: 'Остров Русский (мыс Тобизина, форты), кампус ВВГУ, п-ов Шкота',
    ring: [
      [148, 392],
      [196, 368],
      [180, 402],
      [204, 446],
      [164, 448],
      [144, 422],
    ],
    labelOffset: { dx: -4, dy: 2 },
  },
  {
    id: 'muni-khasan',
    name: 'Хасанский муниципальный округ',
    shortName: 'Хасанский',
    adminCenter: 'пгт Славянка',
    zoneLabel: 'Курортный кластер ДФО и нацпарк «Земля леопарда»',
    areaKm2: 4130,
    certifiedInRegistry: 18,
    estimatedDemand: 460,
    activeRoutesCount: 31,
    keyHubs: 'П-ов Гамова, бухта Алеут (курорт «Приморье»), нацпарк «Земля леопарда»',
    ring: [
      [112, 376],
      [148, 392],
      [144, 422],
      [130, 466],
      [96, 490],
      [80, 478],
      [98, 422],
    ],
    labelOffset: { dx: -8, dy: 6 },
  },
];

export function getPrimoryeMunicipalityMetricValue(
  item: PrimoryeMunicipalityComputed,
  metric: PrimoryeHeatmapMetric
): number {
  if (metric === 'density') return item.densityPer1000Km2;
  if (metric === 'certified') return item.certifiedInRegistry;
  if (metric === 'coveragePct') return item.coveragePct;
  return item.deficit;
}

export function formatPrimoryeMetricValue(
  item: PrimoryeMunicipalityComputed,
  metric: PrimoryeHeatmapMetric
): string {
  if (metric === 'density') {
    return `${item.densityPer1000Km2.toFixed(2).replace('.', ',')} / 1000 км²`;
  }
  if (metric === 'certified') return `${item.certifiedInRegistry} чел.`;
  if (metric === 'coveragePct') return `${item.coveragePct}%`;
  return `${item.deficit} чел.`;
}

export function buildPrimoryeMunicipalD3Layout(width = 560, height = 470): {
  municipalities: PrimoryeMunicipalityComputed[];
  maxDensity: number;
  totalCertified: number;
  totalDemand: number;
  totalDeficit: number;
} {
  const geoFeatureCollection = {
    type: 'FeatureCollection' as const,
    features: PRIMORYE_MUNICIPALITIES.map((m) => ({
      type: 'Feature' as const,
      id: m.id,
      properties: { id: m.id },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[...m.ring, m.ring[0]] as [number, number][]],
      },
    })),
  };

  const projection = d3
    .geoIdentity()
    .reflectY(false)
    .fitExtent(
      [
        [24, 24],
        [width - 24, height - 24],
      ],
      geoFeatureCollection as unknown as d3.GeoPermissibleObjects
    );

  const pathGenerator = d3.geoPath(projection);

  const municipalities: PrimoryeMunicipalityComputed[] = PRIMORYE_MUNICIPALITIES.map(
    (m, index) => {
      const feature = geoFeatureCollection.features[index];
      const pathData =
        pathGenerator(feature as unknown as d3.GeoPermissibleObjects) ?? '';
      const centroid = pathGenerator.centroid(
        feature as unknown as d3.GeoPermissibleObjects
      );
      const centroidX = Number.isFinite(centroid[0]) ? centroid[0] : width / 2;
      const centroidY = Number.isFinite(centroid[1]) ? centroid[1] : height / 2;

      const deficit = Math.max(0, m.estimatedDemand - m.certifiedInRegistry);
      const coveragePct =
        m.estimatedDemand > 0
          ? Math.round((m.certifiedInRegistry / m.estimatedDemand) * 1000) / 10
          : 0;
      const densityPer1000Km2 =
        Math.round((m.certifiedInRegistry / Math.max(m.areaKm2 / 1000, 0.1)) * 100) /
        100;

      let concentrationTier: 'high' | 'medium' | 'low' = 'low';
      let concentrationLabel = 'Низкая (резерв роста)';
      if (densityPer1000Km2 >= 4) {
        concentrationTier = 'high';
        concentrationLabel = 'Высокая концентрация';
      } else if (densityPer1000Km2 >= 0.4) {
        concentrationTier = 'medium';
        concentrationLabel = 'Средняя концентрация';
      }

      return {
        ...m,
        deficit,
        coveragePct,
        densityPer1000Km2,
        concentrationTier,
        concentrationLabel,
        pathData,
        centroidX,
        centroidY,
        labelX: centroidX + (m.labelOffset?.dx ?? 0),
        labelY: centroidY + (m.labelOffset?.dy ?? 0),
      };
    }
  );

  const maxDensity = Math.max(...municipalities.map((m) => m.densityPer1000Km2), 1);
  const totalCertified = municipalities.reduce((s, m) => s + m.certifiedInRegistry, 0);
  const totalDemand = municipalities.reduce((s, m) => s + m.estimatedDemand, 0);
  const totalDeficit = municipalities.reduce((s, m) => s + m.deficit, 0);

  return {
    municipalities,
    maxDensity,
    totalCertified,
    totalDemand,
    totalDeficit,
  };
}

export function createPrimoryeHeatmapColorScale(
  items: readonly PrimoryeMunicipalityComputed[],
  metric: PrimoryeHeatmapMetric
): {
  scale: (value: number) => string;
  domainMax: number;
  interpolator: (t: number) => string;
} {
  const maxVal = Math.max(
    ...items.map((item) => getPrimoryeMunicipalityMetricValue(item, metric)),
    1
  );

  if (metric === 'deficit') {
    const interpolator = d3.interpolateRgbBasis([
      '#F8FAFC',
      '#FEF3C7',
      '#F59E0B',
      '#DC2626',
      '#991B1B',
    ]);
    const seq = d3.scaleSequential(interpolator).domain([0, maxVal]).clamp(true);
    return { scale: (v: number) => seq(v), domainMax: maxVal, interpolator };
  }

  if (metric === 'density') {
    // Log-compressed sqrt scale ensures Vladivostok (75/1000km²) doesn't wash out Shkotovo (7.06) & Khasan (4.36)
    const interpolator = d3.interpolateRgbBasis([
      '#F1F5F9',
      '#CCFBF1',
      '#5EEAD4',
      '#0F766E',
      '#115E59',
    ]);
    const powScale = d3.scaleSequentialSqrt(interpolator).domain([0, maxVal]).clamp(true);
    return { scale: (v: number) => powScale(v), domainMax: maxVal, interpolator };
  }

  const interpolator = d3.interpolateRgbBasis([
    '#F1F5F9',
    '#CCFBF1',
    '#2DD4BF',
    '#0F766E',
    '#134E4A',
  ]);
  const seq = d3.scaleSequential(interpolator).domain([0, maxVal]).clamp(true);
  return { scale: (v: number) => seq(v), domainMax: maxVal, interpolator };
}
