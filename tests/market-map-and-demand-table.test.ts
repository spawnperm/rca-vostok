import assert from 'node:assert/strict';
import { test } from 'vitest';
import { DFO_REGIONS_DISTRIBUTION, PRIMORYE_DISTRICTS } from '../src/data/researchData.ts';
import {
  buildDfoDemandComparisonRows,
  getDfoHorizonLabel,
  getDfoRegionDemandFor2030,
} from '../src/utils/dfoDemandComparison.ts';
import {
  PRIMORYE_ROUTE_CORRIDORS,
  getRouteMarkerOffset,
  summarizePrimoryeLayers,
} from '../src/utils/primoryeMapLayers.ts';

test('PRIMORYE_ROUTE_CORRIDORS connects valid Primorsky districts and totals match registry', () => {
  const validDistrictIds = new Set(PRIMORYE_DISTRICTS.map((d) => d.id));
  for (const corridor of PRIMORYE_ROUTE_CORRIDORS) {
    assert.ok(validDistrictIds.has(corridor.fromId), `Unknown fromId: ${corridor.fromId}`);
    assert.ok(validDistrictIds.has(corridor.toId), `Unknown toId: ${corridor.toId}`);
    assert.ok(corridor.routesCount > 0);
  }

  const summary = summarizePrimoryeLayers(PRIMORYE_DISTRICTS);
  assert.equal(summary.totalCertifiedInstructors, 122);
  assert.equal(summary.totalActiveRoutes, 178);
  assert.equal(summary.corridorsCount, PRIMORYE_ROUTE_CORRIDORS.length);

  for (const district of PRIMORYE_DISTRICTS) {
    const offset = getRouteMarkerOffset(district.id);
    assert.equal(typeof offset.dx, 'number');
    assert.equal(typeof offset.dy, 'number');
  }
});

test('buildDfoDemandComparisonRows compares all 7 DFO subjects against selected baseline region', () => {
  const currentRes = buildDfoDemandComparisonRows('kamchatka', 'current');
  assert.equal(currentRes.rows.length, DFO_REGIONS_DISTRIBUTION.length);
  assert.equal(currentRes.baseline.region.id, 'kamchatka');
  assert.equal(currentRes.baseline.deltaFromBaseline, 0);
  assert.equal(currentRes.baseline.isBaseline, true);

  const primoryeRow = currentRes.rows.find((r) => r.region.id === 'primorye');
  const kamchatkaRow = currentRes.rows.find((r) => r.region.id === 'kamchatka');
  assert.ok(primoryeRow && kamchatkaRow);
  assert.equal(
    primoryeRow.deltaFromBaseline,
    primoryeRow.currentDemand - kamchatkaRow.currentDemand
  );
  const expectedDemandSum = DFO_REGIONS_DISTRIBUTION.reduce(
    (sum, r) => sum + r.estimatedDemand,
    0
  );
  assert.equal(currentRes.totals.currentDemand, expectedDemandSum);
  assert.equal(currentRes.totals.currentDemand, 4530);

  const forecast2030Res = buildDfoDemandComparisonRows('primorye', 'forecast_2030_base');
  const prim2030 = forecast2030Res.rows.find((r) => r.region.id === 'primorye');
  assert.ok(prim2030);
  assert.equal(prim2030.activeDemandValue, getDfoRegionDemandFor2030('primorye', 'base'));
  assert.ok(prim2030.activeDemandValue > prim2030.currentDemand);
  assert.equal(getDfoHorizonLabel('forecast_2030_base'), 'Прогноз 2030 (базовый)');
});
