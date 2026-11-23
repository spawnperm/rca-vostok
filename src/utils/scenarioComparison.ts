import type {
  TourismScenarioId,
  TourismScenarioSummary,
  TourismScenarios2030Result,
} from '../domain/certification/DemandForecastService.ts';

export type ScenarioChartMode = 'single' | 'overlay_two' | 'all';

export interface ScenarioOverlayYearRow {
  year: string;
  demandA: number;
  demandB: number;
  deltaDemand: number; // B - A
  deltaPct: number; // % diff of B vs A
  projectedRegistry: number;
  milestoneNote: string;
}

export interface TwoScenarioOverlayResult {
  scenarioA: TourismScenarioSummary;
  scenarioB: TourismScenarioSummary;
  rows: ScenarioOverlayYearRow[];
  demand2030A: number;
  demand2030B: number;
  delta2030: number; // B - A
  absDelta2030: number;
  delta2030Pct: number;
  deficit2030A: number;
  deficit2030B: number;
  deltaDeficit2030: number;
  pOrgDeltaBy2030: number;
  kSeasonDeltaBy2030: number;
}

/**
 * Ensures the overlaid second scenario is always distinct from the primary one.
 */
export function resolveDistinctOverlayPair(
  primaryId: TourismScenarioId,
  secondaryId: TourismScenarioId,
  allIds: readonly TourismScenarioId[]
): { primary: TourismScenarioId; secondary: TourismScenarioId } {
  if (primaryId !== secondaryId) {
    return { primary: primaryId, secondary: secondaryId };
  }
  const fallback = allIds.find((id) => id !== primaryId) ?? primaryId;
  return { primary: primaryId, secondary: fallback };
}

/**
 * Builds year-by-year comparison metrics for two overlaid 2030 tourism scenarios.
 */
export function buildTwoScenarioOverlay(
  forecast: TourismScenarios2030Result,
  primaryId: TourismScenarioId,
  secondaryId: TourismScenarioId
): TwoScenarioOverlayResult {
  const { primary, secondary } = resolveDistinctOverlayPair(
    primaryId,
    secondaryId,
    forecast.scenarios.map((s) => s.id)
  );

  const scenarioA = forecast.summaries[primary];
  const scenarioB = forecast.summaries[secondary];

  const rows: ScenarioOverlayYearRow[] = forecast.points.map((pt) => {
    const demandA = pt[primary];
    const demandB = pt[secondary];
    const deltaDemand = demandB - demandA;
    const deltaPct = demandA > 0 ? Math.round((deltaDemand / demandA) * 100) : 0;

    return {
      year: pt.year,
      demandA,
      demandB,
      deltaDemand,
      deltaPct,
      projectedRegistry: pt.projectedRegistry,
      milestoneNote: pt.milestoneNote,
    };
  });

  const demand2030A = scenarioA.demand2030;
  const demand2030B = scenarioB.demand2030;
  const delta2030 = demand2030B - demand2030A;
  const absDelta2030 = Math.abs(delta2030);
  const delta2030Pct = demand2030A > 0 ? Math.round((delta2030 / demand2030A) * 100) : 0;

  return {
    scenarioA,
    scenarioB,
    rows,
    demand2030A,
    demand2030B,
    delta2030,
    absDelta2030,
    delta2030Pct,
    deficit2030A: scenarioA.deficit2030,
    deficit2030B: scenarioB.deficit2030,
    deltaDeficit2030: scenarioB.deficit2030 - scenarioA.deficit2030,
    pOrgDeltaBy2030: scenarioB.pOrg2030 - scenarioA.pOrg2030,
    kSeasonDeltaBy2030:
      Math.round((scenarioB.kSeason2030 - scenarioA.kSeason2030) * 100) / 100,
  };
}
