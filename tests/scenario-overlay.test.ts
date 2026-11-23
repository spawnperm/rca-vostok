import assert from 'node:assert/strict';
import test from 'node:test';
import { DemandForecastService } from '../src/domain/certification/DemandForecastService.ts';
import {
  buildTwoScenarioOverlay,
  resolveDistinctOverlayPair,
} from '../src/utils/scenarioComparison.ts';

const SAMPLE_INPUT = {
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
};

test('resolveDistinctOverlayPair guarantees distinct scenarios when same id is passed twice', () => {
  const pair = resolveDistinctOverlayPair('baseline', 'baseline', [
    'conservative',
    'baseline',
    'accelerated',
    'allSeason',
  ]);

  assert.equal(pair.primary, 'baseline');
  assert.notEqual(pair.secondary, 'baseline');
});

test('buildTwoScenarioOverlay computes accurate 2025-2030 deltas between two overlaid scenarios', () => {
  const forecast = DemandForecastService.forecastTourismScenarios2030(SAMPLE_INPUT);
  const overlay = buildTwoScenarioOverlay(forecast, 'baseline', 'accelerated');

  assert.equal(overlay.scenarioA.id, 'baseline');
  assert.equal(overlay.scenarioB.id, 'accelerated');
  assert.equal(overlay.rows.length, 6);

  // In 2025 both scenarios share the calibrated baseline point
  assert.equal(overlay.rows[0].year, '2025');
  assert.equal(overlay.rows[0].deltaDemand, 0);

  // By 2030 accelerated scenario exceeds baseline significantly
  const row2030 = overlay.rows[5];
  assert.equal(row2030.year, '2030');
  assert.equal(row2030.demandA, overlay.demand2030A);
  assert.equal(row2030.demandB, overlay.demand2030B);
  assert.equal(row2030.deltaDemand, overlay.delta2030);
  assert.ok(overlay.delta2030 > 0);
  assert.ok(overlay.delta2030Pct > 0);
  assert.ok(overlay.pOrgDeltaBy2030 > 0);
});

test('buildTwoScenarioOverlay handles negative delta when overlaying slower scenario on faster one', () => {
  const forecast = DemandForecastService.forecastTourismScenarios2030(SAMPLE_INPUT);
  const overlay = buildTwoScenarioOverlay(forecast, 'accelerated', 'allSeason');

  assert.ok(overlay.delta2030 < 0);
  assert.equal(overlay.absDelta2030, Math.abs(overlay.delta2030));
  assert.ok(overlay.kSeasonDeltaBy2030 < 0);
});
