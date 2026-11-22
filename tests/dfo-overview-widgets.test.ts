import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCREDITATION_REGISTRY_ENTRIES,
  ACCREDITATION_RENEWAL_DYNAMICS,
  DFO_ATTESTATION_POINTS,
  DFO_REGIONAL_TRAINING_OFFICES,
  filterAccreditationEntries,
  filterAttestationPoints,
  getAccreditationRenewalSeries,
  getAccreditationSummaryStats,
  getOfficesByRegionId,
} from '../src/data/dfoOverviewRegistryData.ts';
import { DFO_REGIONS_DISTRIBUTION } from '../src/data/researchData.ts';
import { buildAccreditationExportPayload } from '../src/utils/accreditationRegistryPdf.ts';

test('DFO_REGIONAL_TRAINING_OFFICES covers all 7 DFO macro-regions with valid contacts', () => {
  for (const region of DFO_REGIONS_DISTRIBUTION) {
    const offices = getOfficesByRegionId(region.id);
    assert.ok(
      offices.length >= 1,
      `Expected at least one regional office for ${region.name}`
    );
    for (const office of offices) {
      assert.ok(office.phone.startsWith('+7'), `Invalid phone for ${office.id}`);
      assert.ok(office.email.includes('@'), `Invalid email for ${office.id}`);
      assert.ok(office.address.length > 5, `Missing address for ${office.id}`);
      assert.ok(
        office.trainingPrograms.length >= 2,
        `Expected training programs for ${office.id}`
      );
    }
  }
  assert.ok(DFO_REGIONAL_TRAINING_OFFICES.length >= 7);
});

test('DFO_ATTESTATION_POINTS maps key points inside SVG bounds with full expert group info', () => {
  assert.ok(DFO_ATTESTATION_POINTS.length >= 6);

  for (const pt of DFO_ATTESTATION_POINTS) {
    assert.ok(pt.x >= 0 && pt.x <= 640, `x out of bounds for ${pt.id}`);
    assert.ok(pt.y >= 0 && pt.y <= 430, `y out of bounds for ${pt.id}`);
    assert.ok(pt.expertGroup.chairName.length > 0);
    assert.ok(pt.expertGroup.experts.length >= 2);
    assert.ok(pt.expertGroup.disciplines.length >= 2);
    assert.ok(pt.expertGroup.nextExamWindow.length > 0);
  }

  const hqOnly = filterAttestationPoints('headquarters');
  assert.equal(hqOnly.length, 1);
  assert.equal(hqOnly[0].id, 'ap-vladivostok-vvgu');

  const polygons = filterAttestationPoints('field_polygon');
  assert.ok(polygons.length >= 2);
});

test('ACCREDITATION_REGISTRY_ENTRIES tracks RF legal norms and category/status filtering', () => {
  const stats = getAccreditationSummaryStats();
  assert.equal(stats.total, ACCREDITATION_REGISTRY_ENTRIES.length);
  assert.equal(stats.verifiedCount + stats.inProgressCount, stats.total);
  assert.ok(stats.verifiedCount >= 5);

  const eduOnly = filterAccreditationEntries('education');
  assert.ok(eduOnly.some((e) => e.legalNorm.includes('273-ФЗ')));

  const attOnly = filterAccreditationEntries('attestation');
  assert.ok(attOnly.some((e) => e.legalNorm.includes('132-ФЗ')));
  assert.ok(attOnly.some((e) => e.legalNorm.includes('1893')));

  const registryOnly = filterAccreditationEntries('registry');
  assert.ok(registryOnly.some((e) => e.legalNorm.includes('152-ФЗ')));
});

test('buildAccreditationExportPayload prepares summary counts and Cyrillic metadata for PDF export', () => {
  const fixedDate = new Date('2026-11-22T12:00:00.000Z');
  const fullPayload = buildAccreditationExportPayload(
    ACCREDITATION_REGISTRY_ENTRIES,
    'Все записи',
    fixedDate
  );
  assert.equal(fullPayload.exportedAtIso, '2026-11-22');
  assert.equal(fullPayload.totalCount, ACCREDITATION_REGISTRY_ENTRIES.length);
  assert.ok(fullPayload.docNumber.startsWith('РЦА-2026/РА-1122-'));
  assert.equal(
    fullPayload.verifiedCount + fullPayload.inProgressCount,
    fullPayload.totalCount
  );

  const attOnly = filterAccreditationEntries('attestation');
  const filteredPayload = buildAccreditationExportPayload(
    attOnly,
    'Полномочия РЦА и ФСТР',
    fixedDate
  );
  assert.equal(filteredPayload.totalCount, attOnly.length);
  assert.equal(filteredPayload.filterLabel, 'Полномочия РЦА и ФСТР');
  assert.equal(filteredPayload.inProgressCount, 0);
});

test('getAccreditationRenewalSeries filters yearly licensing dynamics and references valid registry IDs', () => {
  const validIds = new Set(ACCREDITATION_REGISTRY_ENTRIES.map((e) => e.id));
  assert.equal(ACCREDITATION_RENEWAL_DYNAMICS.length, 7);

  for (const pt of ACCREDITATION_RENEWAL_DYNAMICS) {
    assert.ok(pt.registryIds.length >= 2);
    for (const id of pt.registryIds) {
      assert.ok(validIds.has(id), `Unknown registry id ${id} in year ${pt.year}`);
    }
  }

  const factOnly = getAccreditationRenewalSeries('fact');
  assert.deepEqual(
    factOnly.map((p) => p.year),
    ['2024', '2025', '2026']
  );

  const forecastOnly = getAccreditationRenewalSeries('forecast');
  assert.deepEqual(
    forecastOnly.map((p) => p.year),
    ['2026', '2027', '2028', '2029', '2030']
  );
});
