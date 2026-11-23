import assert from 'node:assert/strict';
import test from 'node:test';
import { CERTIFIED_TOURIST_ROUTES } from '../src/data/researchData.ts';
import {
  DFO_REGION_CAMERA_PRESETS,
  filterDfoTouristRoutes,
  getAttestationPinBadge,
  getGuideRequirementSummary,
  sortRoutesForMarkerStacking,
  toLatLngPath,
} from '../src/utils/dfoRoutesMap.ts';

test('CERTIFIED_TOURIST_ROUTES covers DFO regions with valid coordinates and attestation requirements', () => {
  assert.ok(CERTIFIED_TOURIST_ROUTES.length >= 9);

  const regions = new Set(CERTIFIED_TOURIST_ROUTES.map((r) => r.regionId));
  assert.ok(regions.has('primorye'));
  assert.ok(regions.has('khabarovsk'));
  assert.ok(regions.has('kamchatka'));
  assert.ok(regions.has('sakhalin'));

  for (const route of CERTIFIED_TOURIST_ROUTES) {
    assert.ok(route.coordinates.length >= 2, `Missing track coordinates for ${route.id}`);
    const path = toLatLngPath(route.coordinates);
    assert.ok(path.every((pt) => Number.isFinite(pt.lat) && Number.isFinite(pt.lng)));
    assert.ok(route.difficultyCategory.length > 0);
    assert.ok(route.safetyProtocols.length > 0);
    assert.ok(getAttestationPinBadge(route).length >= 3);
    assert.ok(getGuideRequirementSummary(route).length > 10);
  }
});

test('filterDfoTouristRoutes filters by DFO region and guide attestation profile', () => {
  const all = filterDfoTouristRoutes(CERTIFIED_TOURIST_ROUTES, 'all', 'all');
  assert.equal(all.length, CERTIFIED_TOURIST_ROUTES.length);

  const kamchatka = filterDfoTouristRoutes(CERTIFIED_TOURIST_ROUTES, 'kamchatka', 'all');
  assert.equal(kamchatka.length, 1);
  assert.equal(kamchatka[0].id, 'route-kamchatka-volcano');

  const highComplexity = filterDfoTouristRoutes(
    CERTIFIED_TOURIST_ROUTES,
    'all',
    'high_complexity'
  );
  assert.ok(highComplexity.length >= 4);
  assert.ok(
    highComplexity.some((r) => r.id === 'route-khasan-gamova'),
    'OOPT routes must be included in high-complexity attestation filter'
  );
});

test('sortRoutesForMarkerStacking orders northern latitudes first so southern pins stack on top', () => {
  const stacked = sortRoutesForMarkerStacking(CERTIFIED_TOURIST_ROUTES);
  assert.equal(stacked.length, CERTIFIED_TOURIST_ROUTES.length);
  for (let i = 1; i < stacked.length; i++) {
    assert.ok(stacked[i - 1].position.lat >= stacked[i].position.lat);
    assert.ok(stacked[i].baseZIndex > stacked[i - 1].baseZIndex);
  }
  assert.ok(DFO_REGION_CAMERA_PRESETS.some((p) => p.id === 'all'));
});
