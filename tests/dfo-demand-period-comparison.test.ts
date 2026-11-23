import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMAND_PERIOD_YEARS,
  TWO_PERIOD_PRESETS,
  buildTwoPeriodDemandComparison,
} from '../src/utils/dfoDemandPeriodComparison.ts';

describe('buildTwoPeriodDemandComparison', () => {
  it('computes forward 2025 -> 2030 base scenario demand deltas and CAGR', () => {
    const result = buildTwoPeriodDemandComparison({
      periodA: '2025',
      periodB: '2030',
      scenario: 'base',
    });

    assert.equal(result.periodA, '2025');
    assert.equal(result.periodB, '2030');
    assert.equal(result.yearSpan, 5);
    assert.equal(result.totalA, 4530);
    assert.equal(result.totalB, 7070);
    assert.equal(result.totalDeltaAbsolute, 2540);
    assert.equal(result.totalDeltaPercent, 56.1);
    assert.ok(result.annualizedTotalGrowthPct > 9 && result.annualizedTotalGrowthPct < 10);

    assert.equal(result.regions.length, 7);
    const primorye = result.regions.find((r) => r.regionId === 'primorye');
    assert.ok(primorye);
    assert.equal(primorye.demandA, 2390);
    assert.equal(primorye.demandB, 3450);
    assert.equal(primorye.deltaAbsolute, 1060);
    assert.equal(primorye.deltaPercent, 44.4);
  });

  it('computes conservative scenario totals cleanly', () => {
    const result = buildTwoPeriodDemandComparison({
      periodA: '2025',
      periodB: '2028',
      scenario: 'conservative',
    });

    assert.equal(result.scenario, 'conservative');
    assert.equal(result.yearSpan, 3);
    assert.equal(result.totalA, 2960);
    assert.ok(result.totalB > result.totalA);
    assert.equal(result.totalDeltaAbsolute, result.totalB - result.totalA);
  });

  it('handles reversed periods (2030 -> 2025) with negative deltas and negative CAGR', () => {
    const result = buildTwoPeriodDemandComparison({
      periodA: '2030',
      periodB: '2025',
      scenario: 'base',
    });

    assert.equal(result.yearSpan, 5);
    assert.equal(result.totalA, 7070);
    assert.equal(result.totalB, 4530);
    assert.equal(result.totalDeltaAbsolute, -2540);
    assert.ok(result.totalDeltaPercent < 0);
    assert.ok(result.annualizedTotalGrowthPct < 0);

    const boundaries = result.trendSeries.filter((p) => p.isBoundaryPeriod).map((p) => p.year);
    assert.deepEqual(boundaries, ['2025', '2030']);
    assert.ok(result.trendSeries.every((p) => p.inSelectedWindow));
  });

  it('returns zero delta and zero CAGR when comparing identical years', () => {
    const result = buildTwoPeriodDemandComparison({
      periodA: '2027',
      periodB: '2027',
      scenario: 'base',
    });

    assert.equal(result.yearSpan, 0);
    assert.equal(result.totalDeltaAbsolute, 0);
    assert.equal(result.totalDeltaPercent, 0);
    assert.equal(result.annualizedTotalGrowthPct, 0);
    assert.ok(result.regions.every((r) => r.deltaAbsolute === 0 && r.annualizedGrowthPct === 0));

    const inWindow = result.trendSeries.filter((p) => p.inSelectedWindow).map((p) => p.year);
    assert.deepEqual(inWindow, ['2027']);
  });

  it('marks trendSeries window flags accurately for interior intervals and validates presets', () => {
    assert.equal(DEMAND_PERIOD_YEARS.length, 6);
    assert.equal(TWO_PERIOD_PRESETS.length, 4);

    const result = buildTwoPeriodDemandComparison({
      periodA: '2026',
      periodB: '2028',
      scenario: 'base',
    });

    const inWindow = result.trendSeries.filter((p) => p.inSelectedWindow).map((p) => p.year);
    const boundaries = result.trendSeries.filter((p) => p.isBoundaryPeriod).map((p) => p.year);
    assert.deepEqual(inWindow, ['2026', '2027', '2028']);
    assert.deepEqual(boundaries, ['2026', '2028']);
  });
});
