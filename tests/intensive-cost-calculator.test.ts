import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMPLEXITY_TARIFFS,
  INTENSIVE_MAX_DAYS,
  INTENSIVE_MIN_DAYS,
  calculateIntensiveCost,
} from '../src/utils/intensiveCostCalculator.ts';

test('COMPLEXITY_TARIFFS covers 1 to 4 complexity grades with ascending tariffs', () => {
  assert.equal(COMPLEXITY_TARIFFS.length, 4);
  for (let i = 1; i < COMPLEXITY_TARIFFS.length; i++) {
    assert.ok(COMPLEXITY_TARIFFS[i].baseAttestationFee > COMPLEXITY_TARIFFS[i - 1].baseAttestationFee);
    assert.ok(COMPLEXITY_TARIFFS[i].dailyIntensiveRate > COMPLEXITY_TARIFFS[i - 1].dailyIntensiveRate);
    assert.ok(COMPLEXITY_TARIFFS[i].recommendedDays >= COMPLEXITY_TARIFFS[i - 1].recommendedDays);
  }
});

test('calculateIntensiveCost computes baseline 2 KS / 4 intensive days accurately', () => {
  const res = calculateIntensiveCost({
    complexityId: 'ks2',
    intensiveDays: 4,
    includeFieldGear: false,
    applyTrainingSubsidy: false,
  });

  assert.equal(res.attestationFee, 15000);
  assert.equal(res.nkTaxDuty, 0);
  assert.equal(res.grossTrainingCost, 3800 * 4);
  assert.equal(res.multiDayDiscount, 0);
  assert.equal(res.subsidyReduction, 0);
  assert.equal(res.fieldGearCost, 0);
  assert.equal(res.totalCost, 15000 + 15200);
  assert.equal(res.isBelowRecommendedDays, false);
});

test('calculateIntensiveCost applies 10% package discount for >=7 days and 50% subsidy when toggled', () => {
  const res = calculateIntensiveCost({
    complexityId: 'ks4',
    intensiveDays: 8,
    includeFieldGear: true,
    applyTrainingSubsidy: true,
  });

  const gross = 5500 * 8; // 44000
  const pkgDiscount = Math.round(gross * 0.1); // 4400
  const afterPkg = gross - pkgDiscount; // 39600
  const subsidy = Math.round(afterPkg * 0.5); // 19800
  const netTraining = afterPkg - subsidy; // 19800

  assert.equal(res.multiDayDiscount, pkgDiscount);
  assert.equal(res.subsidyReduction, subsidy);
  assert.equal(res.netTrainingCost, netTraining);
  assert.equal(res.fieldGearCost, 6200);
  assert.equal(res.totalCost, 25000 + netTraining + 6200);
});

test('calculateIntensiveCost clamps intensiveDays and flags below-recommended durations', () => {
  const low = calculateIntensiveCost({
    complexityId: 'ks3',
    intensiveDays: 0,
    includeFieldGear: false,
    applyTrainingSubsidy: false,
  });
  assert.equal(low.intensiveDays, INTENSIVE_MIN_DAYS);
  assert.equal(low.isBelowRecommendedDays, true);

  const high = calculateIntensiveCost({
    complexityId: 'ks1',
    intensiveDays: 99,
    includeFieldGear: false,
    applyTrainingSubsidy: false,
  });
  assert.equal(high.intensiveDays, INTENSIVE_MAX_DAYS);
  assert.equal(high.isBelowRecommendedDays, false);
});
