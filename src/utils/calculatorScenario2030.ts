import {
  DemandForecastService,
  type DemandModelInput,
  type TourismScenarioId,
} from '../domain/certification/DemandForecastService.ts';

export type CalculatorForecastScenario = 'conservative' | 'baseline' | 'optimistic';

export interface CalculatorScenarioOption {
  id: CalculatorForecastScenario;
  label: string;
  shortLabel: string;
  tourismScenarioId: TourismScenarioId;
  summary: string;
  assumptionsNote: string;
}

export interface CalculatorScenarioYearRow {
  year: string;
  targetDemand: number;
  projectedRegistry: number;
  coveragePct: number;
  deficit: number;
}

export interface CalculatorScenarioProjection {
  option: CalculatorScenarioOption;
  demand2026: number;
  demand2030: number;
  growthPct: number;
  projectedRegistry2030: number;
  residualDeficit2030: number;
  coverage2030Pct: number;
  pOrg2030: number;
  kSeason2030: number;
  yearly2026To2030: CalculatorScenarioYearRow[];
}

export const CALCULATOR_FORECAST_SCENARIOS: readonly CalculatorScenarioOption[] = [
  {
    id: 'conservative',
    label: 'Консервативный',
    shortLabel: 'Умеренный рост',
    tourismScenarioId: 'conservative',
    summary: 'Сдержанный рост турпотока (+4,5%/год) при сохранении доли самостоятельных групп.',
    assumptionsNote: 'Поток +4,5%/год · плавный переход в реестр (+2 п.п. P_org к 2030)',
  },
  {
    id: 'baseline',
    label: 'Базовый',
    shortLabel: 'Целевой прогноз ВВГУ',
    tourismScenarioId: 'baseline',
    summary: 'Инерционный рост активного туризма (+8,5%/год) и поэтапная легализация по ПП № 1893.',
    assumptionsNote: 'Поток +8,5%/год · легализация групп +6 п.п. P_org к 2030',
  },
  {
    id: 'optimistic',
    label: 'Оптимистичный',
    shortLabel: 'Курортный бум ДФО',
    tourismScenarioId: 'accelerated',
    summary: 'Ускоренный ввод курортов ДФО (+13,5%/год) и высокая доля организованных туров.',
    assumptionsNote: 'Поток +13,5%/год · расширение реестра +11 п.п. P_org к 2030',
  },
] as const;

export function getCalculatorScenarioOption(
  scenario: CalculatorForecastScenario
): CalculatorScenarioOption {
  return (
    CALCULATOR_FORECAST_SCENARIOS.find((opt) => opt.id === scenario) ??
    CALCULATOR_FORECAST_SCENARIOS[1]
  );
}

export function computeCalculatorScenarioProjection(
  input: DemandModelInput,
  scenario: CalculatorForecastScenario
): CalculatorScenarioProjection {
  const option = getCalculatorScenarioOption(scenario);
  const forecast = DemandForecastService.forecastTourismScenarios2030(input);
  const summary = forecast.summaries[option.tourismScenarioId];

  const yearly2026To2030: CalculatorScenarioYearRow[] = forecast.points
    .filter((pt) => Number(pt.year) >= 2026)
    .map((pt) => {
      const targetDemand = Math.max(1, pt[option.tourismScenarioId]);
      const projectedRegistry = pt.projectedRegistry;
      const coveragePct = Math.min(
        100,
        Math.round((projectedRegistry / targetDemand) * 100)
      );
      const deficit = Math.max(0, targetDemand - projectedRegistry);
      return {
        year: pt.year,
        targetDemand,
        projectedRegistry,
        coveragePct,
        deficit,
      };
    });

  const point2030 = yearly2026To2030[yearly2026To2030.length - 1];
  const projectedRegistry2030 = point2030?.projectedRegistry ?? input.registryCount;
  const coverage2030Pct = point2030?.coveragePct ?? 0;

  return {
    option,
    demand2026: summary.demand2026,
    demand2030: summary.demand2030,
    growthPct: summary.growthPct,
    projectedRegistry2030,
    residualDeficit2030: summary.deficit2030,
    coverage2030Pct,
    pOrg2030: summary.pOrg2030,
    kSeason2030: summary.kSeason2030,
    yearly2026To2030,
  };
}
