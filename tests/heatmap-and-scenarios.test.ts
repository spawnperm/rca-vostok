import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  PRIMORYE_ROUTE_FLOW_PROFILES,
  buildPrimoryeHeatmapMatrix,
} from '../src/data/primoryeFlowHeatmapData.ts';
import { DemandForecastService } from '../src/domain/certification/DemandForecastService.ts';

test('buildPrimoryeHeatmapMatrix builds 12-month cells for all 9 Primorye routes and detects summer OOPT overloads', () => {
  const result = buildPrimoryeHeatmapMatrix({
    trackFilter: 'all',
    sortMode: 'peakLoad',
    metricMode: 'loadPct',
  });

  assert.equal(result.routes.length, PRIMORYE_ROUTE_FLOW_PROFILES.length);
  assert.equal(result.cells.length, PRIMORYE_ROUTE_FLOW_PROFILES.length * 12);
  assert.ok(result.totalAnnualFlowThousands > 800);
  assert.ok(result.overloadedRouteMonthsCount >= 5);
  assert.equal(result.peakMonthAggregateLabel, 'Авг');
  // Sorted descending by peakLoadPct
  assert.ok(result.routes[0].peakLoadPct >= result.routes[1].peakLoadPct);
  assert.ok(result.routes[0].peakLoadPct > 100);
});

test('buildPrimoryeHeatmapMatrix filters by track and switches metric to guidesNeeded cleanly', () => {
  const waterOnly = buildPrimoryeHeatmapMatrix({
    trackFilter: 'water',
    sortMode: 'annualFlow',
    metricMode: 'guidesNeeded',
  });

  assert.equal(waterOnly.routes.length, 1);
  assert.equal(waterOnly.routes[0].profile.id, 'partizanskaya-water');
  assert.equal(waterOnly.cells.length, 12);
  const janCell = waterOnly.cells.find((c) => c.monthLabel === 'Янв');
  const augCell = waterOnly.cells.find((c) => c.monthLabel === 'Авг');
  assert.equal(janCell?.metricValue, 0);
  assert.ok((augCell?.metricValue ?? 0) > 10);
});

test('DemandForecastService.forecastTourismScenarios2030 projects ordered trajectories across 4 tourism scenarios', () => {
  const res = DemandForecastService.forecastTourismScenarios2030({
    tAct: 835000,
    pOrg: 30,
    gSize: 10,
    groupsPerSeason: 15,
    kSeason: 1.3,
    kTurnover: 1.1,
    registryCount: 122,
    groupsPerYear: 4,
    cohortSize: 25,
    conversionRate: 75,
  });

  assert.equal(res.points.length, 6);
  assert.equal(res.points[0].year, '2025');
  assert.equal(res.points[5].year, '2030');
  assert.equal(res.scenarios.length, 4);

  const cons2030 = res.summaries.conservative.demand2030;
  const base2030 = res.summaries.baseline.demand2030;
  const acc2030 = res.summaries.accelerated.demand2030;
  const allSeason2030 = res.summaries.allSeason.demand2030;

  assert.ok(cons2030 < base2030);
  assert.ok(base2030 < acc2030);
  assert.ok(allSeason2030 > cons2030 && allSeason2030 < acc2030);
  assert.ok(res.summaries.allSeason.kSeason2030 < res.summaries.baseline.kSeason2030);
  assert.ok(res.points[5].projectedRegistry > res.points[0].projectedRegistry);
});
