import { InvariantViolationError } from '../shared/DomainError.ts';

export interface DemandModelInput {
  tAct: number;
  pOrg: number; // percentage 0..100
  gSize: number;
  groupsPerSeason: number;
  kSeason: number;
  kTurnover: number;
  registryCount: number;
  groupsPerYear: number;
  cohortSize: number;
  conversionRate: number; // percentage 0..100
}

export interface SensitivityPoint {
  p: number;
  n: number;
}

export interface YearlyProjectionPoint {
  year: number;
  certified: number;
  deficitRemaining: number;
}

export interface DemandForecastResult {
  organizedTourists: number;
  humanGroupsPerYear: number;
  baseDemand: number;
  totalDemand: number;
  deficit: number;
  gapMultiple: number;
  sensitivityPoints: SensitivityPoint[];
  annualTrained: number;
  annualNewCertified: number;
  fiveYearProjection: YearlyProjectionPoint[];
}

export const DemandForecastService = {
  calculate(input: DemandModelInput): DemandForecastResult {
    if (input.gSize <= 0 || input.groupsPerSeason <= 0) {
      throw new InvariantViolationError(
        'Норма нагрузки группы и число групп за сезон должны быть больше нуля.'
      );
    }
    if (input.tAct < 0 || input.registryCount < 0) {
      throw new InvariantViolationError(
        'Численность турпотока и реестра не может быть отрицательной.'
      );
    }
    if (input.kSeason < 1 || input.kTurnover < 1) {
      throw new InvariantViolationError(
        'Коэффициенты сезонности и текучести не могут быть меньше 1.0.'
      );
    }

    const organizedTourists = Math.round(input.tAct * (input.pOrg / 100));
    const humanGroupsPerYear = organizedTourists / input.gSize;
    const baseDemand = humanGroupsPerYear / input.groupsPerSeason;
    const totalDemand = Math.round(baseDemand * input.kSeason * input.kTurnover);
    const deficit = Math.max(totalDemand - input.registryCount, 0);
    const gapMultiple = input.registryCount > 0 ? totalDemand / input.registryCount : 0;

    const sensitivityPoints: SensitivityPoint[] = [10, 15, 20, 25, 30, 35, 40, 45, 50].map((p) => {
      const n = Math.round(
        ((input.tAct * (p / 100)) / input.gSize / input.groupsPerSeason) *
          input.kSeason *
          input.kTurnover
      );
      return { p, n };
    });

    const annualTrained = Math.max(0, input.groupsPerYear) * Math.max(0, input.cohortSize);
    const annualNewCertified = Math.round(annualTrained * (input.conversionRate / 100));
    const attritionRate = Math.max(input.kTurnover - 1, 0);

    const fiveYearProjection: YearlyProjectionPoint[] = [];
    let currentLegal = input.registryCount;
    for (let y = 2026; y <= 2030; y++) {
      if (y > 2026) {
        currentLegal = Math.round(currentLegal * (1 - attritionRate) + annualNewCertified);
      }
      fiveYearProjection.push({
        year: y,
        certified: currentLegal,
        deficitRemaining: Math.max(totalDemand - currentLegal, 0),
      });
    }

    return {
      organizedTourists,
      humanGroupsPerYear: Math.round(humanGroupsPerYear),
      baseDemand: Math.round(baseDemand),
      totalDemand,
      deficit,
      gapMultiple,
      sensitivityPoints,
      annualTrained,
      annualNewCertified,
      fiveYearProjection,
    };
  },

  forecastDfoRegions2030(input: DfoRegionalForecastInput): DfoRegionalForecastResult {
    if (input.flowMultiplierPct <= 0) {
      throw new InvariantViolationError(
        'Индекс туристического потока должен быть больше нуля.'
      );
    }
    if (input.annualFlowGrowthOverridePct !== null && input.annualFlowGrowthOverridePct < -50) {
      throw new InvariantViolationError(
        'Годовой темп изменения турпотока не может быть ниже -50%.'
      );
    }

    const years = [2025, 2026, 2027, 2028, 2029, 2030];
    const flowScale = input.flowMultiplierPct / 100;

    const yearlySeries: DfoRegionalYearPoint[] = years.map((year, idx) => {
      const byRegion: Record<string, number> = {};
      const flowByRegionThousands: Record<string, number> = {};
      let totalDemand = 0;
      let totalFlowThousands = 0;
      let totalActiveTourists = 0;

      for (const profile of input.profiles) {
        if (profile.gSize <= 0 || profile.groupsPerSeason <= 0) {
          throw new InvariantViolationError(
            `Недопустимые нормативы нагрузки для региона ${profile.shortName}.`
          );
        }
        const effectiveBaseFlow =
          input.selectedRegionId === profile.id && input.customBaseFlowThousands !== undefined
            ? Math.max(0, input.customBaseFlowThousands)
            : profile.baseFlowThousands;

        const effectiveActiveShare =
          input.selectedRegionId === profile.id && input.customActiveSharePct !== undefined
            ? Math.min(Math.max(input.customActiveSharePct, 1), 100)
            : profile.activeSharePct;

        const growthPct =
          input.annualFlowGrowthOverridePct !== null
            ? input.annualFlowGrowthOverridePct
            : profile.defaultFlowGrowthPct;

        const yearFlowThousands =
          effectiveBaseFlow * flowScale * Math.pow(1 + growthPct / 100, idx);
        const activeTourists = Math.round(yearFlowThousands * 1000 * (effectiveActiveShare / 100));
        const effectivePOrg = Math.min(
          95,
          Math.max(5, profile.pOrg + input.pOrgShiftBy2030Pct * (idx / 5))
        );

        const demand = Math.round(
          ((activeTourists * (effectivePOrg / 100)) / profile.gSize / profile.groupsPerSeason) *
            profile.kSeason *
            profile.kTurnover
        );

        byRegion[profile.id] = demand;
        flowByRegionThousands[profile.id] = Math.round(yearFlowThousands * 10) / 10;
        totalDemand += demand;
        totalFlowThousands += yearFlowThousands;
        totalActiveTourists += activeTourists;
      }

      const isFocused = input.selectedRegionId !== 'all' && input.selectedRegionId in byRegion;
      const focusedDemand = isFocused ? byRegion[input.selectedRegionId] : totalDemand;
      const focusedFlowThousands = isFocused
        ? flowByRegionThousands[input.selectedRegionId]
        : Math.round(totalFlowThousands * 10) / 10;

      return {
        year: String(year),
        byRegion,
        flowByRegionThousands,
        totalDemand,
        totalFlowThousands: Math.round(totalFlowThousands * 10) / 10,
        totalActiveTourists,
        focusedDemand,
        focusedFlowThousands,
      };
    });

    const first = yearlySeries[0];
    const last = yearlySeries[yearlySeries.length - 1];

    const regionSummaries: DfoRegional2030Summary[] = input.profiles.map((profile) => {
      const demand2025 = first.byRegion[profile.id] ?? 0;
      const demand2030 = last.byRegion[profile.id] ?? 0;
      const flow2025Thousands = first.flowByRegionThousands[profile.id] ?? 0;
      const flow2030Thousands = last.flowByRegionThousands[profile.id] ?? 0;
      const deficit2030 = Math.max(demand2030 - profile.registryCount, 0);
      const demandGrowthPct =
        demand2025 > 0 ? Math.round(((demand2030 - demand2025) / demand2025) * 100) : 0;
      const shareOfDfo2030Pct =
        last.totalDemand > 0 ? Math.round((demand2030 / last.totalDemand) * 1000) / 10 : 0;

      return {
        id: profile.id,
        name: profile.name,
        shortName: profile.shortName,
        activeSharePct:
          input.selectedRegionId === profile.id && input.customActiveSharePct !== undefined
            ? input.customActiveSharePct
            : profile.activeSharePct,
        registryCount: profile.registryCount,
        flow2025Thousands,
        flow2030Thousands,
        demand2025,
        demand2030,
        deficit2030,
        demandGrowthPct,
        shareOfDfo2030Pct,
        driverNote: profile.driverNote,
      };
    });

    const selectedSummary =
      input.selectedRegionId !== 'all'
        ? regionSummaries.find((r) => r.id === input.selectedRegionId) ?? null
        : null;

    const totalRegistry = input.profiles.reduce((sum, p) => sum + p.registryCount, 0);
    const activeRegistry = selectedSummary ? selectedSummary.registryCount : totalRegistry;
    const demand2025 = first.focusedDemand;
    const demand2030 = last.focusedDemand;
    const flow2025Thousands = first.focusedFlowThousands;
    const flow2030Thousands = last.focusedFlowThousands;
    const deficit2030 = Math.max(demand2030 - activeRegistry, 0);
    const growthPct =
      demand2025 > 0 ? Math.round(((demand2030 - demand2025) / demand2025) * 100) : 0;

    return {
      yearlySeries,
      regionSummaries,
      totals: {
        flow2025Thousands,
        flow2030Thousands,
        activeTourists2030: selectedSummary
          ? Math.round(
              flow2030Thousands * 1000 * (selectedSummary.activeSharePct / 100)
            )
          : last.totalActiveTourists,
        demand2025,
        demand2030,
        registryCount: activeRegistry,
        deficit2030,
        growthPct,
      },
    };
  },
};

export interface DfoRegionalProfileInput {
  id: string;
  name: string;
  shortName: string;
  baseFlowThousands: number;
  activeSharePct: number;
  pOrg: number;
  gSize: number;
  groupsPerSeason: number;
  kSeason: number;
  kTurnover: number;
  defaultFlowGrowthPct: number;
  registryCount: number;
  driverNote: string;
}

export interface DfoRegionalForecastInput {
  profiles: DfoRegionalProfileInput[];
  selectedRegionId: string; // 'all' or profile id
  flowMultiplierPct: number; // e.g. 100 = 1.0x
  annualFlowGrowthOverridePct: number | null; // null = use each region's baseline rate
  pOrgShiftBy2030Pct: number; // percentage point shift from 2025 to 2030 (e.g. 0..15)
  customBaseFlowThousands?: number;
  customActiveSharePct?: number;
}

export interface DfoRegionalYearPoint {
  year: string;
  byRegion: Record<string, number>;
  flowByRegionThousands: Record<string, number>;
  totalDemand: number;
  totalFlowThousands: number;
  totalActiveTourists: number;
  focusedDemand: number;
  focusedFlowThousands: number;
}

export interface DfoRegional2030Summary {
  id: string;
  name: string;
  shortName: string;
  activeSharePct: number;
  registryCount: number;
  flow2025Thousands: number;
  flow2030Thousands: number;
  demand2025: number;
  demand2030: number;
  deficit2030: number;
  demandGrowthPct: number;
  shareOfDfo2030Pct: number;
  driverNote: string;
}

export interface DfoRegionalForecastResult {
  yearlySeries: DfoRegionalYearPoint[];
  regionSummaries: DfoRegional2030Summary[];
  totals: {
    flow2025Thousands: number;
    flow2030Thousands: number;
    activeTourists2030: number;
    demand2025: number;
    demand2030: number;
    registryCount: number;
    deficit2030: number;
    growthPct: number;
  };
}

