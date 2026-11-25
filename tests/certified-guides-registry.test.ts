import assert from 'node:assert/strict';
import { test } from 'vitest';
import { INITIAL_DFO_CERTIFIED_GUIDES } from '../src/domain/certification/GuideLeaderboard.ts';
import {
  computeValidUntilDate,
  filterCertifiedGuidesRegistry,
} from '../src/utils/certifiedGuidesRegistry.ts';

const FIXED_REF_DATE = new Date(Date.UTC(2026, 10, 23));

test('computeValidUntilDate adds exactly 5 years to attestation issue date', () => {
  const dt = computeValidUntilDate('2022-03-10');
  assert.equal(dt.getUTCFullYear(), 2027);
  assert.equal(dt.getUTCMonth(), 2);
  assert.equal(dt.getUTCDate(), 10);
});

test('filterCertifiedGuidesRegistry filters by DFO region, specialization track, validity band, and search', () => {
  const all = filterCertifiedGuidesRegistry(INITIAL_DFO_CERTIFIED_GUIDES, {}, FIXED_REF_DATE);
  assert.ok(all.totalActive >= 16);
  assert.ok(all.availableRegions.includes('Приморский край'));
  assert.ok(all.availableRegions.includes('Чукотский АО'));
  assert.ok(all.expiringCount >= 1);

  const primorye = filterCertifiedGuidesRegistry(
    INITIAL_DFO_CERTIFIED_GUIDES,
    { region: 'Приморский край' },
    FIXED_REF_DATE
  );
  assert.ok(primorye.rows.length > 0);
  assert.ok(primorye.rows.every((r) => r.region === 'Приморский край'));

  const waterTrack = filterCertifiedGuidesRegistry(
    INITIAL_DFO_CERTIFIED_GUIDES,
    { track: 'water' },
    FIXED_REF_DATE
  );
  assert.ok(waterTrack.rows.length > 0);
  assert.ok(waterTrack.rows.every((r) => r.track === 'water'));

  const expiringSoon = filterCertifiedGuidesRegistry(
    INITIAL_DFO_CERTIFIED_GUIDES,
    { validity: 'expiring_12m' },
    FIXED_REF_DATE
  );
  assert.ok(expiringSoon.rows.length >= 1);
  assert.ok(expiringSoon.rows.every((r) => r.validityBand === 'expiring_12m'));

  const searchResult = filterCertifiedGuidesRegistry(
    INITIAL_DFO_CERTIFIED_GUIDES,
    { search: 'МЭР-ДФО-0003' },
    FIXED_REF_DATE
  );
  assert.equal(searchResult.rows.length, 1);
  assert.equal(searchResult.rows[0]?.id, 'guide-dfo-015');
});
