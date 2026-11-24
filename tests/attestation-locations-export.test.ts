import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAttestationLocationsCsvContent,
  buildAttestationLocationsFilterSummary,
  buildAttestationLocationsPdfModel,
  formatAttestationExportFileSlug,
} from '../src/utils/attestationLocationsExport.ts';
import {
  DFO_ATTESTATION_LOCATIONS,
  filterAttestationLocations,
} from '../src/utils/attestationLocationsMap.ts';

test('formatAttestationExportFileSlug produces clean ASCII slugs for regions and filters', () => {
  assert.equal(formatAttestationExportFileSlug('all', 'all'), 'dfo');
  assert.equal(
    formatAttestationExportFileSlug('Приморский край', 'all'),
    'primorskiy-kray'
  );
  assert.equal(
    formatAttestationExportFileSlug('Приморский край', 'field_polygon'),
    'primorskiy-kray-field-polygon'
  );
});

test('buildAttestationLocationsCsvContent outputs UTF-8 BOM, headers, and filtered venue rows', () => {
  const primoryeVenues = filterAttestationLocations(
    DFO_ATTESTATION_LOCATIONS,
    'all',
    '',
    'Приморский край'
  );

  const csv = buildAttestationLocationsCsvContent({
    locations: primoryeVenues,
    regionFilter: 'Приморский край',
    kindFilter: 'all',
    searchQuery: '',
    exportedAt: new Date('2027-04-01T09:30:00Z'),
  });

  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM for Russian Excel');
  assert.ok(csv.includes('Реестр аттестованных площадок ДФО для работы комиссий'));
  assert.ok(csv.includes('Количество площадок в выгрузке;3'));
  assert.ok(csv.includes('№ п/п;Код;Субъект ДФО'));
  assert.ok(csv.includes('Головной центр РЦА «Русский Восток» (кампус ВВГУ)'));
  assert.ok(csv.includes('Полевой аттестационный полигон «Шкотовский»'));
  assert.ok(csv.includes('Национальный парк Бикин'));
  assert.ok(!csv.includes('г. Хабаровск'), 'Excluded regions must not appear in filtered CSV');
});

test('buildAttestationLocationsPdfModel paginates venues cleanly and computes summary counts', () => {
  const fullModel = buildAttestationLocationsPdfModel({
    locations: DFO_ATTESTATION_LOCATIONS,
    regionFilter: 'all',
    kindFilter: 'all',
    searchQuery: '',
    exportedAt: new Date('2027-04-01T09:30:00Z'),
  });

  assert.equal(fullModel.documentNumber, 'РЦА-ПЛЩ-20270401');
  assert.equal(fullModel.fileNameBase, 'rca-vostok-venues-dfo-2027-04-01');
  assert.equal(fullModel.totalVenues, DFO_ATTESTATION_LOCATIONS.length);
  assert.equal(fullModel.regionsCount, 7);
  assert.equal(fullModel.headquartersCount, 1);
  assert.equal(fullModel.fieldPolygonsCount, 2);
  assert.equal(fullModel.regionalHubsCount, 6);
  assert.equal(fullModel.pages.length, 3);
  assert.equal(fullModel.pages[0].length, 3);

  const summary = buildAttestationLocationsFilterSummary({
    regionFilter: 'Камчатский край',
    kindFilter: 'regional_hub',
    searchQuery: 'Авачин',
  });
  assert.ok(summary.includes('Камчатский край'));
  assert.ok(summary.includes('Выездные точки ДФО'));
  assert.ok(summary.includes('Авачин'));
});
