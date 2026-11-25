import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  DEFAULT_SELECTED_DFO_REGION_IDS,
  DFO_CONCENTRATION_PRESETS,
  buildMultiRegionConcentrationTimeSeries,
  buildMultiRegionCurrentBars,
  buildMultiRegionRadarProfile,
  getDfoRegionsConcentrationMeta,
  toggleDfoRegionId,
} from '../src/utils/dfoMultiRegionConcentration.ts';

test('getDfoRegionsConcentrationMeta computes positive territory concentration across all 7 DFO subjects', () => {
  const metas = getDfoRegionsConcentrationMeta();
  assert.equal(metas.length, 7);

  for (const meta of metas) {
    assert.ok(meta.areaKm2 > 0);
    assert.ok(meta.currentDensityPer10kKm2 > 0);
    assert.ok(meta.demandDensityPer10kKm2 >= meta.currentDensityPer10kKm2);
    assert.ok(meta.color.startsWith('#'));
  }

  const primorye = metas.find((m) => m.id === 'primorye');
  assert.ok(primorye);
  assert.equal(primorye.currentDensityPer10kKm2, 7.41);
});

test('toggleDfoRegionId adds/removes regions and preserves minimum selection count', () => {
  let ids = [...DEFAULT_SELECTED_DFO_REGION_IDS];
  ids = toggleDfoRegionId(ids, 'amur', 1);
  assert.ok(ids.includes('amur'));

  ids = toggleDfoRegionId(ids, 'kamchatka', 1);
  assert.ok(!ids.includes('kamchatka'));

  // Cannot drop below minimum count (1)
  const single = toggleDfoRegionId(['primorye'], 'primorye', 1);
  assert.deepEqual(single, ['primorye']);
});

test('buildMultiRegionCurrentBars and buildMultiRegionConcentrationTimeSeries build aligned chart datasets', () => {
  const all7 = DFO_CONCENTRATION_PRESETS.find((p) => p.id === 'all-7');
  assert.ok(all7);

  const bars = buildMultiRegionCurrentBars(all7.regionIds);
  assert.equal(bars.length, 7);
  for (const b of bars) {
    assert.ok(b.demandDensity >= b.certifiedDensity);
  }

  const series = buildMultiRegionConcentrationTimeSeries(['primorye', 'kamchatka', 'sakhalin']);
  assert.equal(series.length, 7);
  assert.equal(series[0].year, '2024');
  assert.equal(series[6].year, '2030');

  for (const point of series) {
    assert.equal(typeof point.primorye, 'number');
    assert.equal(typeof point.kamchatka, 'number');
    assert.equal(typeof point.sakhalin, 'number');
  }
  assert.ok(Number(series[6].primorye) > Number(series[1].primorye));
});

test('buildMultiRegionRadarProfile builds 6 normalized multidimensional axes with raw values for selected DFO regions', () => {
  const radar = buildMultiRegionRadarProfile(['primorye', 'kamchatka', 'sakhalin']);
  assert.equal(radar.length, 6);

  for (const axis of radar) {
    assert.ok(axis.metric.length > 0);
    assert.ok(axis.fullLabel.length > 0);
    assert.ok(axis.dfoMaxRaw > 0);

    for (const id of ['primorye', 'kamchatka', 'sakhalin']) {
      const score = Number(axis[id]);
      assert.ok(score >= 0 && score <= 100, `Expected 0..100 score for ${id} on ${axis.axisKey}, got ${score}`);
      assert.equal(typeof axis.rawValues[id], 'number');
    }
  }

  const registryAxis = radar.find((a) => a.axisKey === 'registryScale');
  assert.ok(registryAxis);
  assert.equal(registryAxis.kamchatka, 100);
  assert.ok(Number(registryAxis.rawValues.kamchatka) > Number(registryAxis.rawValues.primorye));

  const demandAxis = radar.find((a) => a.axisKey === 'demandScale');
  assert.ok(demandAxis);
  assert.equal(demandAxis.primorye, 100);
  assert.ok(Number(demandAxis.rawValues.primorye) > Number(demandAxis.rawValues.kamchatka));
});

