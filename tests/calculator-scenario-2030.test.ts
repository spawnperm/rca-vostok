import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  CALCULATOR_FORECAST_SCENARIOS,
  computeCalculatorScenarioProjection,
} from '../src/utils/calculatorScenario2030.ts';

const SAMPLE_MODEL_INPUT = {
  tAct: 320000,
  pOrg: 35,
  gSize: 12,
  groupsPerSeason: 10,
  kSeason: 1.4,
  kTurnover: 1.15,
  registryCount: 122,
  groupsPerYear: 4,
  cohortSize: 20,
  conversionRate: 80,
};

test('CALCULATOR_FORECAST_SCENARIOS exposes conservative, baseline, and optimistic modes', () => {
  const ids = CALCULATOR_FORECAST_SCENARIOS.map((s) => s.id);
  assert.deepEqual(ids, ['conservative', 'baseline', 'optimistic']);
});

test('computeCalculatorScenarioProjection produces ordered 2030 instructor demand across scenarios', () => {
  const conservative = computeCalculatorScenarioProjection(SAMPLE_MODEL_INPUT, 'conservative');
  const baseline = computeCalculatorScenarioProjection(SAMPLE_MODEL_INPUT, 'baseline');
  const optimistic = computeCalculatorScenarioProjection(SAMPLE_MODEL_INPUT, 'optimistic');

  assert.equal(conservative.yearly2026To2030.length, 5);
  assert.equal(baseline.yearly2026To2030.length, 5);
  assert.equal(optimistic.yearly2026To2030.length, 5);

  assert.ok(optimistic.demand2030 > baseline.demand2030);
  assert.ok(baseline.demand2030 > conservative.demand2030);
  assert.ok(optimistic.residualDeficit2030 >= baseline.residualDeficit2030);

  for (const row of baseline.yearly2026To2030) {
    assert.ok(row.coveragePct >= 0 && row.coveragePct <= 100);
    assert.ok(row.deficit >= 0);
  }
});
