import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DFO_CORE_SIX_REGIONS,
  DFO_INQUIRY_REGIONS,
  DFO_REGIONS,
  DFO_SURVEY_REGIONS,
  buildRegionSelectOptions,
} from '../src/data/dfoRegions.ts';
import { deterministicHash, sanitizeFileSlug } from '../src/utils/pdfCanvasHelpers.ts';
import { buildQualificationUpdatesFeed } from '../src/utils/updatesFeed.ts';

test('Canonical DFO region constants stay deduplicated and complete', () => {
  assert.equal(new Set(DFO_REGIONS).size, DFO_REGIONS.length);
  assert.equal(DFO_REGIONS.length, 8);
  assert.equal(DFO_CORE_SIX_REGIONS.length, 6);
  assert.equal(DFO_SURVEY_REGIONS.length, 7);
  assert.equal(DFO_INQUIRY_REGIONS.length, 9);
  assert.ok(DFO_INQUIRY_REGIONS.includes('Другой регион ДФО'));
  assert.ok(DFO_SURVEY_REGIONS.includes('Магаданская область / Чукотский АО'));
});

test('buildRegionSelectOptions preserves custom value first without duplicating canonical regions', () => {
  assert.deepEqual(buildRegionSelectOptions('Приморский край'), [...DFO_REGIONS]);
  assert.deepEqual(buildRegionSelectOptions(''), [...DFO_REGIONS]);
  assert.deepEqual(buildRegionSelectOptions(null), [...DFO_REGIONS]);

  const custom = buildRegionSelectOptions('Еврейская АО');
  assert.equal(custom[0], 'Еврейская АО');
  assert.equal(custom.length, DFO_REGIONS.length + 1);
  assert.equal(new Set(custom).size, custom.length);
});

test('pdfCanvasHelpers deterministicHash and sanitizeFileSlug produce deterministic values', () => {
  const hashA = deterministicHash('rca-vostok-2027');
  const hashB = deterministicHash('rca-vostok-2027');
  const hashC = deterministicHash('rca-vostok-2028');

  assert.equal(hashA, hashB);
  assert.notEqual(hashA, hashC);
  assert.ok(hashA >= 0 && Number.isInteger(hashA));

  assert.equal(sanitizeFileSlug('  Иванов Сергей!! 2027  '), 'иванов_сергей_2027');
  assert.equal(sanitizeFileSlug('___', 'fallback'), 'fallback');
  assert.ok(sanitizeFileSlug('a'.repeat(80), 'doc', 16).length <= 16);
});

test('buildQualificationUpdatesFeed works with dynamic default todayIso date', () => {
  const items = buildQualificationUpdatesFeed({
    user: {
      id: 'u-dynamic',
      role: 'candidate',
      region: 'Приморский край',
      attestationExpiresAt: null,
    },
    qualification: {
      level: 'novice',
      label: 'Начинающий проводник',
      shortLabel: 'Базовый',
      complexityRange: '1 КС',
      description: 'Базовый уровень подготовки',
      reasons: ['Тестовый профиль'],
    },
    attestationPercent: 25,
    inquiries: [],
    journalEntries: [],
    regionalEvents: [],
  });

  assert.ok(items.length > 0);
  assert.ok(items.every((item) => item.id.length > 0 && item.title.length > 0));
});
