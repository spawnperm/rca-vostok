import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyComplexityTier,
  computeComplexityTierDistribution,
  computeJournalMetrics,
  formatJournalMonthLabel,
  formatRussianJournalDate,
  getDefaultJournalEntries,
  resolveJournalRegionId,
  validateJournalEntryInput,
  type ExperienceLogEntry,
} from '../src/utils/experienceJournal.ts';

test('resolveJournalRegionId maps DFO region names and clusters accurately', () => {
  assert.equal(resolveJournalRegionId('Приморский край'), 'primorye');
  assert.equal(resolveJournalRegionId('Камчатский край'), 'kamchatka');
  assert.equal(resolveJournalRegionId('Магаданская область'), 'magadan-chukotka');
  assert.equal(resolveJournalRegionId('Чукотский АО'), 'magadan-chukotka');
  assert.equal(resolveJournalRegionId('Республика Саха (Якутия)'), 'yakutia');
  assert.equal(resolveJournalRegionId(''), 'primorye');
});

test('validateJournalEntryInput accepts valid expedition entry and rejects invalid counts or dates', () => {
  const fixedNow = new Date('2026-11-23T12:00:00Z');

  const okRes = validateJournalEntryInput(
    {
      date: '2026-10-05',
      routeTitle: '',
      regionId: 'kamchatka',
      complexity: '3 КС',
      participantsCount: '12',
      notes: 'МЧС уведомлено',
    },
    fixedNow
  );

  assert.equal(okRes.ok, true);
  if (okRes.ok) {
    assert.equal(okRes.entry.regionName, 'Камчатский край');
    assert.equal(okRes.entry.participantsCount, 12);
    assert.equal(okRes.entry.complexity, '3 КС');
    assert.match(okRes.entry.routeTitle, /Маршрут 3 КС · Камчатка/);
  }

  const badDate = validateJournalEntryInput({
    date: 'not-a-date',
    routeTitle: 'Тест',
    regionId: 'primorye',
    complexity: '1 КС',
    participantsCount: 8,
  });
  assert.equal(badDate.ok, false);

  const badCount = validateJournalEntryInput({
    date: '2026-10-05',
    routeTitle: 'Тест',
    regionId: 'primorye',
    complexity: '1 КС',
    participantsCount: 0,
  });
  assert.equal(badCount.ok, false);
});

test('computeJournalMetrics aggregates totals, region distribution, timeline series, and complexity shares', () => {
  const entries: ExperienceLogEntry[] = [
    {
      id: '1',
      date: '2026-09-10',
      routeTitle: 'Пидан',
      regionId: 'primorye',
      regionName: 'Приморский край',
      complexity: '1 КС',
      participantsCount: 10,
      notes: '',
      createdAt: '2026-09-10T00:00:00Z',
    },
    {
      id: '2',
      date: '2026-09-22',
      routeTitle: 'Ольховая',
      regionId: 'primorye',
      regionName: 'Приморский край',
      complexity: '2 КС',
      participantsCount: 8,
      notes: '',
      createdAt: '2026-09-22T00:00:00Z',
    },
    {
      id: '3',
      date: '2026-10-15',
      routeTitle: 'Ключевская',
      regionId: 'kamchatka',
      regionName: 'Камчатский край',
      complexity: '4 КС',
      participantsCount: 6,
      notes: '',
      createdAt: '2026-10-15T00:00:00Z',
    },
  ];

  const metrics = computeJournalMetrics(entries);

  assert.equal(metrics.totalTrips, 3);
  assert.equal(metrics.totalParticipants, 24);
  assert.equal(metrics.activeRegionsCount, 2);
  assert.equal(metrics.maxComplexity, '4 КС');
  assert.equal(metrics.avgGroupSize, 8);

  assert.equal(metrics.byRegionMap.primorye.tripsCount, 2);
  assert.equal(metrics.byRegionMap.primorye.participantsCount, 18);
  assert.equal(metrics.byRegionMap.primorye.maxComplexity, '2 КС');
  assert.equal(metrics.byRegionMap.primorye.latestDate, '2026-09-22');

  assert.equal(metrics.byRegionMap.kamchatka.tripsCount, 1);
  assert.equal(metrics.byRegionMap.yakutia.tripsCount, 0);

  assert.equal(metrics.timelineSeries.length, 2);
  assert.equal(metrics.timelineSeries[0].periodKey, '2026-09');
  assert.equal(metrics.timelineSeries[0].tripsCount, 2);
  assert.equal(metrics.timelineSeries[0].participantsCount, 18);
  assert.equal(metrics.timelineSeries[1].periodKey, '2026-10');
  assert.equal(metrics.timelineSeries[1].tripsCount, 1);

  const fourKs = metrics.complexitySeries.find((c) => c.complexity === '4 КС');
  assert.equal(fourKs?.tripsCount, 1);
  assert.equal(fourKs?.participantsCount, 6);
});

test('getDefaultJournalEntries and date formatters produce sorted Russian entries', () => {
  const defaults = getDefaultJournalEntries('Хабаровский край');
  assert.equal(defaults.length, 5);
  assert.equal(defaults[0].regionId, 'khabarovsk');
  assert.equal(formatRussianJournalDate('2026-10-12'), '12.10.2026');
  assert.equal(formatJournalMonthLabel('2026-10'), 'Окт 2026');
});

test('computeComplexityTierDistribution groups trips into easy, medium, and hard slices', () => {
  assert.equal(classifyComplexityTier('н/к'), 'easy');
  assert.equal(classifyComplexityTier('1 КС'), 'easy');
  assert.equal(classifyComplexityTier('2 КС'), 'medium');
  assert.equal(classifyComplexityTier('3 КС'), 'medium');
  assert.equal(classifyComplexityTier('4 КС'), 'hard');
  assert.equal(classifyComplexityTier('5 КС'), 'hard');

  const defaults = getDefaultJournalEntries('Приморский край');
  const dist = computeComplexityTierDistribution(defaults);

  assert.equal(dist.totalTrips, 5);
  assert.equal(dist.slices.length, 3);
  assert.equal(dist.nonZeroSlices.length, 3);

  const easy = dist.slices.find((s) => s.key === 'easy');
  const medium = dist.slices.find((s) => s.key === 'medium');
  const hard = dist.slices.find((s) => s.key === 'hard');

  assert.equal(easy?.tripsCount, 2);
  assert.equal(easy?.sharePct, 40);
  assert.equal(medium?.tripsCount, 2);
  assert.equal(medium?.sharePct, 40);
  assert.equal(hard?.tripsCount, 1);
  assert.equal(hard?.sharePct, 20);

  const emptyDist = computeComplexityTierDistribution([]);
  assert.equal(emptyDist.totalTrips, 0);
  assert.equal(emptyDist.nonZeroSlices.length, 0);
  assert.equal(emptyDist.dominantTier, null);
});
