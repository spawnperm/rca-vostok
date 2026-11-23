import {
  DFO_CERTIFIED_DYNAMICS_BY_REGION,
  DFO_REGIONS_DISTRIBUTION,
} from '../data/researchData.ts';
import { DFO_SUBJECT_AREA_KM2 } from './dfoD3MapData.ts';

export interface DfoRegionConcentrationMeta {
  id: string;
  name: string;
  shortName: string;
  color: string;
  areaKm2: number;
  certifiedInRegistry: number;
  estimatedDemand: number;
  currentDensityPer10kKm2: number;
  demandDensityPer10kKm2: number;
  coveragePct: number;
}

export const DFO_CONCENTRATION_REGION_COLORS: Record<string, string> = {
  primorye: '#0F766E',
  kamchatka: '#D97706',
  sakhalin: '#0284C7',
  khabarovsk: '#7C3AED',
  amur: '#059669',
  yakutia: '#DC2626',
  'magadan-chukotka': '#475569',
};

export const DEFAULT_SELECTED_DFO_REGION_IDS: readonly string[] = [
  'primorye',
  'kamchatka',
  'sakhalin',
  'khabarovsk',
];

export const DFO_CONCENTRATION_PRESETS: readonly {
  id: string;
  label: string;
  regionIds: readonly string[];
}[] = [
  {
    id: 'top-density',
    label: 'Лидеры плотности (3)',
    regionIds: ['primorye', 'kamchatka', 'sakhalin'],
  },
  {
    id: 'hubs-4',
    label: 'Ключевые центры (4)',
    regionIds: ['primorye', 'kamchatka', 'sakhalin', 'khabarovsk'],
  },
  {
    id: 'all-7',
    label: 'Все регионы ДФО (7)',
    regionIds: DFO_REGIONS_DISTRIBUTION.map((r) => r.id),
  },
  {
    id: 'north-east',
    label: 'Север и материк (4)',
    regionIds: ['khabarovsk', 'amur', 'yakutia', 'magadan-chukotka'],
  },
];

export function getDfoRegionsConcentrationMeta(): DfoRegionConcentrationMeta[] {
  return DFO_REGIONS_DISTRIBUTION.map((r) => {
    const areaKm2 = DFO_SUBJECT_AREA_KM2[r.id] ?? 100000;
    const currentDensityPer10kKm2 =
      Math.round((r.certifiedInRegistry / Math.max(areaKm2 / 10000, 0.1)) * 100) / 100;
    const demandDensityPer10kKm2 =
      Math.round((r.estimatedDemand / Math.max(areaKm2 / 10000, 0.1)) * 100) / 100;
    const coveragePct =
      r.estimatedDemand > 0
        ? Math.round((r.certifiedInRegistry / r.estimatedDemand) * 1000) / 10
        : 0;

    return {
      id: r.id,
      name: r.name,
      shortName: r.shortName,
      color: DFO_CONCENTRATION_REGION_COLORS[r.id] ?? '#0F766E',
      areaKm2,
      certifiedInRegistry: r.certifiedInRegistry,
      estimatedDemand: r.estimatedDemand,
      currentDensityPer10kKm2,
      demandDensityPer10kKm2,
      coveragePct,
    };
  });
}

export function toggleDfoRegionId(
  selectedIds: readonly string[],
  targetId: string,
  minCount = 1
): string[] {
  const validSet = new Set(DFO_REGIONS_DISTRIBUTION.map((r) => r.id));
  if (!validSet.has(targetId)) return [...selectedIds];

  const exists = selectedIds.includes(targetId);
  if (exists) {
    if (selectedIds.length <= minCount) return [...selectedIds];
    return selectedIds.filter((id) => id !== targetId);
  }
  return [...selectedIds, targetId];
}

export interface MultiRegionConcentrationBarPoint {
  regionId: string;
  shortName: string;
  name: string;
  color: string;
  areaKm2: number;
  certifiedInRegistry: number;
  estimatedDemand: number;
  certifiedDensity: number;
  demandDensity: number;
  coveragePct: number;
}

export function buildMultiRegionCurrentBars(
  selectedIds: readonly string[]
): MultiRegionConcentrationBarPoint[] {
  const metas = getDfoRegionsConcentrationMeta();
  const byId = new Map(metas.map((m) => [m.id, m] as const));

  return selectedIds
    .map((id) => byId.get(id))
    .filter((m): m is DfoRegionConcentrationMeta => Boolean(m))
    .map((m) => ({
      regionId: m.id,
      shortName: m.shortName,
      name: m.name,
      color: m.color,
      areaKm2: m.areaKm2,
      certifiedInRegistry: m.certifiedInRegistry,
      estimatedDemand: m.estimatedDemand,
      certifiedDensity: m.currentDensityPer10kKm2,
      demandDensity: m.demandDensityPer10kKm2,
      coveragePct: m.coveragePct,
    }));
}

export interface MultiRegionYearSeriesPoint {
  year: string;
  phase: 'факт' | 'прогноз';
  [regionKey: string]: string | number;
}

export function buildMultiRegionConcentrationTimeSeries(
  selectedIds: readonly string[]
): MultiRegionYearSeriesPoint[] {
  const years = ['2024', '2025', '2026', '2027', '2028', '2029', '2030'] as const;

  return years.map((year) => {
    const phase: 'факт' | 'прогноз' = Number(year) <= 2026 ? 'факт' : 'прогноз';
    const row: MultiRegionYearSeriesPoint = { year, phase };

    for (const regionId of selectedIds) {
      const areaKm2 = DFO_SUBJECT_AREA_KM2[regionId] ?? 100000;
      const series = DFO_CERTIFIED_DYNAMICS_BY_REGION[regionId];
      const pt = series?.find((item) => item.year === year);
      const count = pt?.certifiedCount ?? 0;
      const density = Math.round((count / Math.max(areaKm2 / 10000, 0.1)) * 100) / 100;
      row[regionId] = density;
    }

    return row;
  });
}

export interface MultiRegionRadarDatum {
  axisKey: string;
  metric: string;
  fullLabel: string;
  unit: string;
  dfoMaxRaw: number;
  rawValues: Record<string, number>;
  [regionKey: string]: string | number | Record<string, number>;
}

export function buildMultiRegionRadarProfile(
  selectedIds: readonly string[]
): MultiRegionRadarDatum[] {
  const metas = getDfoRegionsConcentrationMeta();
  const byId = new Map(metas.map((m) => [m.id, m] as const));

  const growthRatioById = new Map<string, number>();
  for (const r of DFO_REGIONS_DISTRIBUTION) {
    const series = DFO_CERTIFIED_DYNAMICS_BY_REGION[r.id] ?? [];
    const p2026 = series.find((p) => p.year === '2026')?.certifiedCount ?? r.certifiedInRegistry;
    const p2030 = series.find((p) => p.year === '2030')?.certifiedCount ?? p2026;
    const ratio = p2026 > 0 ? Math.round((p2030 / p2026) * 100) / 100 : 1;
    growthRatioById.set(r.id, ratio);
  }

  const octoberById = new Map(
    DFO_REGIONS_DISTRIBUTION.map((r) => [r.id, r.october2026Certified] as const)
  );

  const axesConfig: {
    axisKey: string;
    metric: string;
    fullLabel: string;
    unit: string;
    getRaw: (regionId: string) => number;
  }[] = [
    {
      axisKey: 'density',
      metric: 'Плотность реестра',
      fullLabel: 'Концентрация в реестре (на 10 тыс. км²)',
      unit: 'инстр./10 тыс. км²',
      getRaw: (id) => byId.get(id)?.currentDensityPer10kKm2 ?? 0,
    },
    {
      axisKey: 'coverage',
      metric: 'Покрытие спроса',
      fullLabel: 'Обеспеченность расчётного спроса реестром',
      unit: '%',
      getRaw: (id) => byId.get(id)?.coveragePct ?? 0,
    },
    {
      axisKey: 'registryScale',
      metric: 'Масштаб реестра',
      fullLabel: 'Действующие аттестованные инструкторы в реестре',
      unit: 'чел.',
      getRaw: (id) => byId.get(id)?.certifiedInRegistry ?? 0,
    },
    {
      axisKey: 'demandScale',
      metric: 'Расчётный спрос',
      fullLabel: 'Текущая кадровая потребность субъекта ДФО',
      unit: 'чел.',
      getRaw: (id) => byId.get(id)?.estimatedDemand ?? 0,
    },
    {
      axisKey: 'octoberIntake',
      metric: 'Выпуск РЦА (окт. 2026)',
      fullLabel: 'Аттестовано на потоке РЦА в октябре 2026 г.',
      unit: 'чел.',
      getRaw: (id) => octoberById.get(id) ?? 0,
    },
    {
      axisKey: 'growthPace',
      metric: 'Темп роста до 2030 г.',
      fullLabel: 'Прогнозный множитель роста реестра (2026→2030 гг.)',
      unit: '×',
      getRaw: (id) => growthRatioById.get(id) ?? 1,
    },
  ];

  const validSelected = selectedIds.filter((id) => byId.has(id));

  return axesConfig.map((axis) => {
    const allRaw = metas.map((m) => axis.getRaw(m.id));
    const dfoMaxRaw = Math.max(...allRaw, 0.0001);
    const rawValues: Record<string, number> = {};

    const datum: MultiRegionRadarDatum = {
      axisKey: axis.axisKey,
      metric: axis.metric,
      fullLabel: axis.fullLabel,
      unit: axis.unit,
      dfoMaxRaw: Math.round(dfoMaxRaw * 100) / 100,
      rawValues,
    };

    for (const regionId of validSelected) {
      const raw = axis.getRaw(regionId);
      rawValues[regionId] = raw;
      datum[regionId] = Math.round((raw / dfoMaxRaw) * 1000) / 10;
    }

    return datum;
  });
}

