import { PRIMORYE_DISTRICTS, type DistrictActivity } from '../data/researchData.ts';

export type PrimoryeMapLayerId = 'instructors' | 'routes';

export interface PrimoryeLayerVisibility {
  instructors: boolean;
  routes: boolean;
}

export interface PrimoryeRouteCorridor {
  id: string;
  name: string;
  categoryLabel: string;
  fromId: string;
  toId: string;
  routesCount: number;
}

export interface PrimoryeActivityZone {
  id: string;
  name: string;
  subtitle: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotationDeg: number;
  fill: string;
  stroke: string;
}

export const PRIMORYE_ACTIVITY_ZONES: readonly PrimoryeActivityZone[] = [
  {
    id: 'zone-south-coast',
    name: 'Южно-Приморская зона активности',
    subtitle: 'Хасан · Владивосток · Шкотово · Находка',
    cx: 168,
    cy: 438,
    rx: 88,
    ry: 46,
    rotationDeg: -10,
    fill: '#0F766E',
    stroke: '#0F766E',
  },
  {
    id: 'zone-east-ridge',
    name: 'Восточно-Сихотэ-Алинская зона',
    subtitle: 'Лазо · Кавалерово · Ольга',
    cx: 294,
    cy: 334,
    rx: 46,
    ry: 70,
    rotationDeg: 22,
    fill: '#B45309',
    stroke: '#B45309',
  },
  {
    id: 'zone-north-expedition',
    name: 'Северная экспедиционная зона',
    subtitle: 'Нацпарк «Бикин» · Терней · р. Кема',
    cx: 286,
    cy: 140,
    rx: 106,
    ry: 42,
    rotationDeg: 2,
    fill: '#475569',
    stroke: '#475569',
  },
];

export const PRIMORYE_ROUTE_CORRIDORS: readonly PrimoryeRouteCorridor[] = [
  {
    id: 'corridor-khasan-vladivostok',
    name: 'Южно-приморский курортный коридор (Хасан — о. Русский)',
    categoryLabel: 'ООПТ и прибрежные экотропы',
    fromId: 'khasan',
    toId: 'vladivostok',
    routesCount: 34,
  },
  {
    id: 'corridor-vladivostok-shkotovo',
    name: 'Горно-полигонная ось (Владивосток — Пидан / Фалаза)',
    categoryLabel: 'Пешеходный и горный треккинг',
    fromId: 'vladivostok',
    toId: 'shkotovo',
    routesCount: 27,
  },
  {
    id: 'corridor-shkotovo-nakhodka',
    name: 'Юго-восточная дуга (Шкотово — Находка / Партизанск)',
    categoryLabel: 'Водный туризм и глэмпинги',
    fromId: 'shkotovo',
    toId: 'nakhodka-partizansk',
    routesCount: 25,
  },
  {
    id: 'corridor-nakhodka-lazo',
    name: 'Заповедное побережье (Находка — Лазо / о. Петрова)',
    categoryLabel: 'ООПТ и бухты Японского моря',
    fromId: 'nakhodka-partizansk',
    toId: 'lazo',
    routesCount: 16,
  },
  {
    id: 'corridor-lazo-kavalerovo',
    name: 'Восточно-Сихотэ-Алинская трасса (Лазо — Кавалерово / Ольга)',
    categoryLabel: 'Горные маршруты и сплавы',
    fromId: 'lazo',
    toId: 'kavalerovo-olga',
    routesCount: 14,
  },
  {
    id: 'corridor-kavalerovo-terney',
    name: 'Северная экспедиционная ветка (Ольга — Терней / р. Кема)',
    categoryLabel: 'Автономные и водные маршруты',
    fromId: 'kavalerovo-olga',
    toId: 'terney',
    routesCount: 12,
  },
  {
    id: 'corridor-shkotovo-bikin',
    name: 'Транс-таёжный маршрут (Шкотово — нацпарк «Бикин»)',
    categoryLabel: 'Водно-таёжный и этнотуризм',
    fromId: 'shkotovo',
    toId: 'pozharsky-bikin',
    routesCount: 11,
  },
  {
    id: 'corridor-bikin-terney',
    name: 'Северный перевал (Бикин — Терней)',
    categoryLabel: 'Экспедиционный коридор 3–4 КС',
    fromId: 'pozharsky-bikin',
    toId: 'terney',
    routesCount: 8,
  },
];

export function summarizePrimoryeLayers(districts: readonly DistrictActivity[] = PRIMORYE_DISTRICTS): {
  totalCertifiedInstructors: number;
  totalEstimatedDemand: number;
  totalActiveRoutes: number;
  corridorsCount: number;
} {
  return {
    totalCertifiedInstructors: districts.reduce((sum, d) => sum + d.certifiedInRegistry, 0),
    totalEstimatedDemand: districts.reduce((sum, d) => sum + d.estimatedDemand, 0),
    totalActiveRoutes: districts.reduce((sum, d) => sum + d.activeRoutesCount, 0),
    corridorsCount: PRIMORYE_ROUTE_CORRIDORS.length,
  };
}

export function getRouteMarkerOffset(districtId: string): { dx: number; dy: number } {
  if (districtId === 'khasan') return { dx: 14, dy: -12 };
  if (districtId === 'vladivostok') return { dx: -14, dy: -14 };
  if (districtId === 'shkotovo') return { dx: -14, dy: -14 };
  if (districtId === 'nakhodka-partizansk') return { dx: 14, dy: 14 };
  return { dx: -14, dy: -12 };
}
