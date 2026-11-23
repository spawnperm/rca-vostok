import {
  DFO_REGIONAL_DEMAND_FORECAST_2025_2030,
  DFO_REGIONS_DISTRIBUTION,
  type DfoRegionDistribution,
} from '../data/researchData.ts';

export type DfoDemandComparisonHorizon =
  | 'current'
  | 'forecast_2030_base'
  | 'forecast_2030_conservative';

export interface DfoDemandComparisonRow {
  region: DfoRegionDistribution;
  certifiedInRegistry: number;
  currentDemand: number;
  demand2030Base: number;
  demand2030Conservative: number;
  activeDemandValue: number;
  deficit: number;
  coveragePct: number;
  deltaFromBaseline: number;
  ratioToBaseline: number;
  isBaseline: boolean;
}

const OTHER_CLUSTER_WEIGHTS: Record<string, number> = {
  sakhalin: 320 / 680,
  yakutia: 180 / 680,
  amur: 110 / 680,
  'magadan-chukotka': 70 / 680,
};

export function getDfoRegionDemandFor2030(
  regionId: string,
  scenario: 'base' | 'conservative' = 'base'
): number {
  const series = DFO_REGIONAL_DEMAND_FORECAST_2025_2030[scenario];
  const lastPoint = series[series.length - 1];
  if (!lastPoint) return 0;

  if (regionId === 'primorye') return lastPoint.primorye;
  if (regionId === 'kamchatka') return lastPoint.kamchatka;
  if (regionId === 'khabarovsk') return lastPoint.khabarovsk;
  if (regionId in OTHER_CLUSTER_WEIGHTS) {
    return Math.round(lastPoint.sakhalinAndOther * OTHER_CLUSTER_WEIGHTS[regionId]);
  }
  return lastPoint.totalDemand;
}

export function getDfoHorizonLabel(horizon: DfoDemandComparisonHorizon): string {
  if (horizon === 'forecast_2030_base') return 'Прогноз 2030 (базовый)';
  if (horizon === 'forecast_2030_conservative') return 'Прогноз 2030 (консерв.)';
  return 'Текущий спрос (2025–2026)';
}

export function buildDfoDemandComparisonRows(
  baselineRegionId: string,
  horizon: DfoDemandComparisonHorizon = 'current'
): {
  baseline: DfoDemandComparisonRow;
  rows: DfoDemandComparisonRow[];
  totals: {
    certifiedInRegistry: number;
    currentDemand: number;
    demand2030Base: number;
    demand2030Conservative: number;
    activeDemandValue: number;
    deficit: number;
    coveragePct: number;
  };
} {
  const validBaseline =
    DFO_REGIONS_DISTRIBUTION.find((r) => r.id === baselineRegionId) ?? DFO_REGIONS_DISTRIBUTION[0];

  const baseRaw = DFO_REGIONS_DISTRIBUTION.map((region) => {
    const demand2030Base = getDfoRegionDemandFor2030(region.id, 'base');
    const demand2030Conservative = getDfoRegionDemandFor2030(region.id, 'conservative');
    const activeDemandValue =
      horizon === 'forecast_2030_base'
        ? demand2030Base
        : horizon === 'forecast_2030_conservative'
          ? demand2030Conservative
          : region.estimatedDemand;

    const deficit = Math.max(0, activeDemandValue - region.certifiedInRegistry);
    const coveragePct =
      activeDemandValue > 0
        ? Math.round((region.certifiedInRegistry / activeDemandValue) * 1000) / 10
        : 0;

    return {
      region,
      certifiedInRegistry: region.certifiedInRegistry,
      currentDemand: region.estimatedDemand,
      demand2030Base,
      demand2030Conservative,
      activeDemandValue,
      deficit,
      coveragePct,
    };
  });

  const baselineRaw =
    baseRaw.find((r) => r.region.id === validBaseline.id) ?? baseRaw[0];

  const rows: DfoDemandComparisonRow[] = baseRaw.map((item) => ({
    ...item,
    deltaFromBaseline: item.activeDemandValue - baselineRaw.activeDemandValue,
    ratioToBaseline:
      baselineRaw.activeDemandValue > 0
        ? Math.round((item.activeDemandValue / baselineRaw.activeDemandValue) * 100) / 100
        : 0,
    isBaseline: item.region.id === validBaseline.id,
  }));

  const baselineRow = rows.find((r) => r.isBaseline) ?? rows[0];

  const certifiedInRegistry = rows.reduce((s, r) => s + r.certifiedInRegistry, 0);
  const currentDemand = rows.reduce((s, r) => s + r.currentDemand, 0);
  const demand2030Base = rows.reduce((s, r) => s + r.demand2030Base, 0);
  const demand2030Conservative = rows.reduce((s, r) => s + r.demand2030Conservative, 0);
  const activeDemandValue = rows.reduce((s, r) => s + r.activeDemandValue, 0);
  const deficit = Math.max(0, activeDemandValue - certifiedInRegistry);
  const coveragePct =
    activeDemandValue > 0
      ? Math.round((certifiedInRegistry / activeDemandValue) * 1000) / 10
      : 0;

  return {
    baseline: baselineRow,
    rows,
    totals: {
      certifiedInRegistry,
      currentDemand,
      demand2030Base,
      demand2030Conservative,
      activeDemandValue,
      deficit,
      coveragePct,
    },
  };
}
