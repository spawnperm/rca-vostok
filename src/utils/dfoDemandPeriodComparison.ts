import {
  DFO_REGIONAL_DEMAND_FORECAST_2025_2030,
  DFO_REGIONS_DISTRIBUTION,
  type DfoRegionalDemandPoint,
} from '../data/researchData.ts';

export type DemandPeriodYear = '2025' | '2026' | '2027' | '2028' | '2029' | '2030';
export type DemandPeriodScenario = 'base' | 'conservative';

export const DEMAND_PERIOD_YEARS: readonly DemandPeriodYear[] = [
  '2025',
  '2026',
  '2027',
  '2028',
  '2029',
  '2030',
];

export const TWO_PERIOD_PRESETS: readonly {
  id: string;
  label: string;
  periodA: DemandPeriodYear;
  periodB: DemandPeriodYear;
  note: string;
}[] = [
  {
    id: '2025-2027',
    label: '2025 vs 2027',
    periodA: '2025',
    periodB: '2027',
    note: 'Реакция рынка на ПП № 1893 и старт курорта «Приморье»',
  },
  {
    id: '2026-2028',
    label: '2026 vs 2028',
    periodA: '2026',
    periodB: '2028',
    note: 'Ввод объектов Хасанского кластера (+500 тыс. туристов)',
  },
  {
    id: '2025-2030',
    label: '2025 vs 2030',
    periodA: '2025',
    periodB: '2030',
    note: 'Полный 5-летний цикл аттестации ДФО',
  },
  {
    id: '2027-2030',
    label: '2027 vs 2030',
    periodA: '2027',
    periodB: '2030',
    note: 'Этап масштабирования межрегиональных программ',
  },
];

const OTHER_CLUSTER_WEIGHTS: Record<string, number> = {
  sakhalin: 320 / 680,
  yakutia: 180 / 680,
  amur: 110 / 680,
  'magadan-chukotka': 70 / 680,
};

function getRegionDemandAtPoint(regionId: string, point: DfoRegionalDemandPoint): number {
  if (regionId === 'primorye') return point.primorye;
  if (regionId === 'kamchatka') return point.kamchatka;
  if (regionId === 'khabarovsk') return point.khabarovsk;
  if (regionId in OTHER_CLUSTER_WEIGHTS) {
    return Math.round(point.sakhalinAndOther * OTHER_CLUSTER_WEIGHTS[regionId]);
  }
  return point.totalDemand;
}

export interface TwoPeriodRegionRow {
  regionId: string;
  regionName: string;
  shortName: string;
  demandA: number;
  demandB: number;
  deltaAbsolute: number;
  deltaPercent: number;
  annualizedGrowthPct: number;
}

export interface TwoPeriodTrendPoint {
  year: string;
  totalDemand: number;
  primorye: number;
  kamchatka: number;
  khabarovsk: number;
  sakhalinAndOther: number;
  projectedRegistry: number;
  driverNote: string;
  inSelectedWindow: boolean;
  isBoundaryPeriod: boolean;
}

export interface TwoPeriodComparisonResult {
  periodA: DemandPeriodYear;
  periodB: DemandPeriodYear;
  scenario: DemandPeriodScenario;
  yearSpan: number;
  periodANote: string;
  periodBNote: string;
  totalA: number;
  totalB: number;
  totalDeltaAbsolute: number;
  totalDeltaPercent: number;
  annualizedTotalGrowthPct: number;
  registryA: number;
  registryB: number;
  regions: TwoPeriodRegionRow[];
  trendSeries: TwoPeriodTrendPoint[];
}

export function buildTwoPeriodDemandComparison(options: {
  periodA: DemandPeriodYear;
  periodB: DemandPeriodYear;
  scenario?: DemandPeriodScenario;
}): TwoPeriodComparisonResult {
  const scenario = options.scenario ?? 'base';
  const series = DFO_REGIONAL_DEMAND_FORECAST_2025_2030[scenario];

  const ptA = series.find((p) => p.year === options.periodA) ?? series[0];
  const ptB = series.find((p) => p.year === options.periodB) ?? series[series.length - 1];

  const yearA = Number(ptA.year);
  const yearB = Number(ptB.year);
  const yearSpan = Math.abs(yearB - yearA);
  const minYear = Math.min(yearA, yearB);
  const maxYear = Math.max(yearA, yearB);

  const regions: TwoPeriodRegionRow[] = DFO_REGIONS_DISTRIBUTION.map((r) => {
    const demandA = getRegionDemandAtPoint(r.id, ptA);
    const demandB = getRegionDemandAtPoint(r.id, ptB);
    const deltaAbsolute = demandB - demandA;
    const deltaPercent =
      demandA > 0 ? Math.round(((demandB - demandA) / demandA) * 1000) / 10 : 0;

    let annualizedGrowthPct = 0;
    if (yearSpan > 0 && demandA > 0 && demandB > 0) {
      const signedExponent = yearB >= yearA ? 1 / yearSpan : -1 / yearSpan;
      const ratio = yearB >= yearA ? demandB / demandA : demandA / demandB;
      const cagr = (Math.pow(ratio, Math.abs(signedExponent)) - 1) * 100;
      annualizedGrowthPct =
        Math.round((yearB >= yearA ? cagr : -cagr) * 10) / 10;
    }

    return {
      regionId: r.id,
      regionName: r.name,
      shortName: r.shortName,
      demandA,
      demandB,
      deltaAbsolute,
      deltaPercent,
      annualizedGrowthPct,
    };
  });

  const totalA = ptA.totalDemand;
  const totalB = ptB.totalDemand;
  const totalDeltaAbsolute = totalB - totalA;
  const totalDeltaPercent =
    totalA > 0 ? Math.round(((totalB - totalA) / totalA) * 1000) / 10 : 0;

  let annualizedTotalGrowthPct = 0;
  if (yearSpan > 0 && totalA > 0 && totalB > 0) {
    const ratio = yearB >= yearA ? totalB / totalA : totalA / totalB;
    const cagr = (Math.pow(ratio, 1 / yearSpan) - 1) * 100;
    annualizedTotalGrowthPct =
      Math.round((yearB >= yearA ? cagr : -cagr) * 10) / 10;
  }

  const trendSeries: TwoPeriodTrendPoint[] = series.map((pt) => {
    const yr = Number(pt.year);
    return {
      year: pt.year,
      totalDemand: pt.totalDemand,
      primorye: pt.primorye,
      kamchatka: pt.kamchatka,
      khabarovsk: pt.khabarovsk,
      sakhalinAndOther: pt.sakhalinAndOther,
      projectedRegistry: pt.projectedRegistry,
      driverNote: pt.driverNote,
      inSelectedWindow: yr >= minYear && yr <= maxYear,
      isBoundaryPeriod: pt.year === ptA.year || pt.year === ptB.year,
    };
  });

  return {
    periodA: ptA.year as DemandPeriodYear,
    periodB: ptB.year as DemandPeriodYear,
    scenario,
    yearSpan,
    periodANote: ptA.driverNote,
    periodBNote: ptB.driverNote,
    totalA,
    totalB,
    totalDeltaAbsolute,
    totalDeltaPercent,
    annualizedTotalGrowthPct,
    registryA: ptA.projectedRegistry,
    registryB: ptB.projectedRegistry,
    regions,
    trendSeries,
  };
}
