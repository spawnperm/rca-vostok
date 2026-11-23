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

  forecastTourismScenarios2030(input: DemandModelInput): TourismScenarios2030Result {
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

    const scenarioDefs: TourismScenarioConfig[] = [
      {
        id: 'conservative',
        label: 'Инерционный',
        shortLabel: 'Инерционный (+3,5%/год)',
        description:
          'Умеренный рост турпотока при высокой доле самостоятельного автотуризма и плавной легализации гидов.',
        annualFlowGrowthPct: 3.5,
        pOrgShiftBy2030Pct: 2,
        kSeasonDeltaBy2030: 0.02,
        registryMultiplier: 0.85,
        color: '#64748B',
      },
      {
        id: 'baseline',
        label: 'Базовый (ПП № 1893)',
        shortLabel: 'Базовый (+7,5%/год)',
        description:
          'Опорный сценарий Минтуризма ДФО и РЦА «Русский Восток»: легализация рынка после 01.10.2026 и ввод курорта «Приморье» в 2027 г.',
        annualFlowGrowthPct: 7.5,
        pOrgShiftBy2030Pct: 8,
        kSeasonDeltaBy2030: 0,
        registryMultiplier: 1.0,
        color: '#0F766E',
      },
      {
        id: 'accelerated',
        label: 'Ускоренный кластерный',
        shortLabel: 'Ускоренный (+11,5%/год)',
        description:
          'Запуск Хасанского морского кластера (+500 тыс. туристов с 2028 г.), новых экотроп ООПТ и высокой доли организованных туров.',
        annualFlowGrowthPct: 11.5,
        pOrgShiftBy2030Pct: 14,
        kSeasonDeltaBy2030: 0.05,
        registryMultiplier: 1.2,
        color: '#B91C1C',
      },
      {
        id: 'allSeason',
        label: 'Всесезонный трек',
        shortLabel: 'Всесезонный (сглаженный пик)',
        description:
          'Продление туристического сезона с 7 до 9,5 месяцев (глэмпинги, зимние восхождения, термальные маршруты), снижающее пиковую нагрузку K_season.',
        annualFlowGrowthPct: 8.5,
        pOrgShiftBy2030Pct: 10,
        kSeasonDeltaBy2030: -0.14,
        registryMultiplier: 1.1,
        color: '#D97706',
      },
    ];

    const annualTrained = Math.max(0, input.groupsPerYear) * Math.max(0, input.cohortSize);
    const annualNewCertified = Math.round(annualTrained * (input.conversionRate / 100));
    const attritionRate = Math.max(input.kTurnover - 1, 0);
    const years = [2025, 2026, 2027, 2028, 2029, 2030];

    const scenarioValues = new Map<TourismScenarioId, number[]>();
    for (const sc of scenarioDefs) {
      const series = years.map((_, idx) => {
        const tYear = input.tAct * Math.pow(1 + sc.annualFlowGrowthPct / 100, idx);
        const pYear = Math.min(95, Math.max(5, input.pOrg + sc.pOrgShiftBy2030Pct * (idx / 5)));
        const kSeasonYear = Math.max(1.0, input.kSeason + sc.kSeasonDeltaBy2030 * (idx / 5));
        return Math.round(
          ((tYear * (pYear / 100)) / input.gSize / input.groupsPerSeason) *
            kSeasonYear *
            input.kTurnover
        );
      });
      scenarioValues.set(sc.id, series);
    }

    const milestoneNotes: Record<string, string> = {
      '2025': 'Базовая калибровка по текущему потоку и параметрам модели N',
      '2026': 'Вступление ПП № 1893 (01.03) и дедлайн обязательной аттестации 01.10.2026',
      '2027': 'Ввод 1-й очереди курорта «Приморье» (бухта Алеут) и водного трека ВВГУ',
      '2028': 'Запуск Хасанского курортного кластера (+500 тыс. чел.) и новых экотроп ООПТ',
      '2029': 'Масштабирование мультипрофильных и всесезонных программ на ДФО',
      '2030': 'Завершение 5-летнего цикла переаттестации и целевой горизонт отрасли',
    };

    const registryBaseSeries: number[] = [];
    let currentReg = input.registryCount;
    for (let idx = 0; idx < years.length; idx += 1) {
      if (idx >= 2) {
        currentReg = Math.round(currentReg * (1 - attritionRate) + annualNewCertified);
      }
      registryBaseSeries.push(currentReg);
    }

    const points: TourismScenarioYearPoint[] = years.map((year, idx) => {
      const yStr = String(year);
      return {
        year: yStr,
        conservative: scenarioValues.get('conservative')![idx],
        baseline: scenarioValues.get('baseline')![idx],
        accelerated: scenarioValues.get('accelerated')![idx],
        allSeason: scenarioValues.get('allSeason')![idx],
        projectedRegistry: registryBaseSeries[idx],
        milestoneNote: milestoneNotes[yStr] ?? '',
      };
    });

    const summaries = {} as Record<TourismScenarioId, TourismScenarioSummary>;
    for (const sc of scenarioDefs) {
      const vals = scenarioValues.get(sc.id)!;
      const demand2025 = vals[0];
      const demand2026 = vals[1];
      const demand2030 = vals[vals.length - 1];
      const reg2030 = Math.round(
        input.registryCount * Math.pow(1 - attritionRate, 4) +
          annualNewCertified * sc.registryMultiplier * 4
      );
      const effectivePOrg2030 = Math.min(95, Math.max(5, Math.round(input.pOrg + sc.pOrgShiftBy2030Pct)));
      const effectiveKSeason2030 =
        Math.round(Math.max(1.0, input.kSeason + sc.kSeasonDeltaBy2030) * 100) / 100;

      summaries[sc.id] = {
        ...sc,
        demand2025,
        demand2026,
        demand2030,
        growthPct:
          demand2025 > 0 ? Math.round(((demand2030 - demand2025) / demand2025) * 100) : 0,
        deficit2030: Math.max(0, demand2030 - registryBaseSeries[registryBaseSeries.length - 1]),
        scenarioAdjustedRegistry2030: reg2030,
        pOrg2030: effectivePOrg2030,
        kSeason2030: effectiveKSeason2030,
      };
    }

    return {
      points,
      scenarios: scenarioDefs,
      summaries,
    };
  },
};

export type TourismScenarioId = 'conservative' | 'baseline' | 'accelerated' | 'allSeason';

export interface TourismScenarioConfig {
  id: TourismScenarioId;
  label: string;
  shortLabel: string;
  description: string;
  annualFlowGrowthPct: number;
  pOrgShiftBy2030Pct: number;
  kSeasonDeltaBy2030: number;
  registryMultiplier: number;
  color: string;
}

export interface TourismScenarioYearPoint {
  year: string;
  conservative: number;
  baseline: number;
  accelerated: number;
  allSeason: number;
  projectedRegistry: number;
  milestoneNote: string;
}

export interface TourismScenarioSummary extends TourismScenarioConfig {
  demand2025: number;
  demand2026: number;
  demand2030: number;
  growthPct: number;
  deficit2030: number;
  scenarioAdjustedRegistry2030: number;
  pOrg2030: number;
  kSeason2030: number;
}

export interface TourismScenarios2030Result {
  points: TourismScenarioYearPoint[];
  scenarios: TourismScenarioConfig[];
  summaries: Record<TourismScenarioId, TourismScenarioSummary>;
}

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
