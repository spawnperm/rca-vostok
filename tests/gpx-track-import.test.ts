import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  ExperienceEntry,
} from '../src/domain/experience/ExperienceEntry.ts';
import {
  SAMPLE_DFO_GPX_TRACK,
  haversineDistanceKm,
  parseGpxTrack,
  resolveDfoRegionFromCoordinates,
} from '../src/domain/experience/GpxTrackParser.ts';
import { computeJournalMetrics } from '../src/domain/experience/ExperienceAnalyticsService.ts';
import { ValidationError } from '../src/domain/shared/DomainError.ts';

test('haversineDistanceKm computes accurate spherical distance', () => {
  // ~111.19 km per degree of latitude
  const dist = haversineDistanceKm({ lat: 43.0, lon: 132.0 }, { lat: 44.0, lon: 132.0 });
  assert.ok(dist > 110.5 && dist < 112.0, `Expected ~111.2 km, got ${dist}`);
});

test('resolveDfoRegionFromCoordinates maps DFO coordinates to the correct federal subject', () => {
  assert.equal(resolveDfoRegionFromCoordinates(43.0731, 132.6901).regionId, 'primorye');
  assert.equal(resolveDfoRegionFromCoordinates(53.255, 158.83).regionId, 'kamchatka');
  assert.equal(resolveDfoRegionFromCoordinates(51.95, 135.25).regionId, 'khabarovsk');
  assert.equal(resolveDfoRegionFromCoordinates(47.2, 142.8).regionId, 'sakhalin');
  assert.equal(resolveDfoRegionFromCoordinates(62.03, 129.73).regionId, 'yakutia');
  assert.equal(resolveDfoRegionFromCoordinates(53.0, 127.5).regionId, 'amur');
  assert.equal(resolveDfoRegionFromCoordinates(64.73, 177.51).regionId, 'magadan-chukotka');
});

test('parseGpxTrack extracts routeTitle, date, DFO region, distanceKm, and elevationGainM', () => {
  const parsed = parseGpxTrack(SAMPLE_DFO_GPX_TRACK, 'pidan_traverse.gpx');
  assert.equal(parsed.regionId, 'primorye');
  assert.equal(parsed.regionName, 'Приморский край');
  assert.equal(parsed.regionMatchType, 'polygon');
  assert.equal(parsed.date, '2026-09-19');
  assert.equal(parsed.pointsCount, 6);
  assert.ok(parsed.distanceKm > 4 && parsed.distanceKm < 12, `Unexpected distance ${parsed.distanceKm}`);
  assert.equal(parsed.elevationGainM, 1042); // (520-290)+(960-520)+(1332-960) = 1042m
  assert.match(parsed.routeTitle, /Пидан/);
  assert.match(parsed.suggestedNotes, /GPX-трек:/);
});

test('parseGpxTrack handles reversed attribute order, <rtept> fallback, and metadata date', () => {
  const kamchatkaRte = `<?xml version="1.0"?>
  <gpx version="1.1">
    <metadata><time>2026-08-03T06:00:00Z</time></metadata>
    <rte>
      <name>Авачинская &amp; Корякская перемычка</name>
      <rtept lon="158.780" lat="53.220" />
      <rtept lon="158.830" lat="53.260" />
    </rte>
  </gpx>`;

  const parsed = parseGpxTrack(kamchatkaRte, 'avacha.gpx');
  assert.equal(parsed.regionId, 'kamchatka');
  assert.equal(parsed.date, '2026-08-03');
  assert.equal(parsed.routeTitle, 'Авачинская & Корякская перемычка');
  assert.ok(parsed.distanceKm >= 4 && parsed.distanceKm <= 8);
});

test('parseGpxTrack rejects empty or malformed XML without GPX points', () => {
  assert.throws(() => parseGpxTrack('', 'empty.gpx'), ValidationError);
  assert.throws(() => parseGpxTrack('<html><body>not gpx</body></html>', 'bad.gpx'), ValidationError);
  assert.throws(() => parseGpxTrack('<gpx><trk></trk></gpx>', 'nopoints.gpx'), ValidationError);
});

test('ExperienceEntry validates distanceKm and computeJournalMetrics sums totalDistanceKm', () => {
  assert.throws(
    () =>
      ExperienceEntry.create({
        date: '2026-09-19',
        routeTitle: 'Некорректная дистанция',
        regionId: 'primorye',
        complexity: '2 КС',
        participantsCount: 8,
        distanceKm: 0,
      }),
    ValidationError
  );

  const entry1 = ExperienceEntry.create({
    date: '2026-09-19',
    routeTitle: 'Трек 1',
    regionId: 'primorye',
    complexity: '2 КС',
    participantsCount: 8,
    distanceKm: '12.46',
  }).toSnapshot();

  assert.equal(entry1.distanceKm, 12.5);

  const entry2 = ExperienceEntry.create({
    date: '2026-09-20',
    routeTitle: 'Трек 2',
    regionId: 'kamchatka',
    complexity: '3 КС',
    participantsCount: 6,
    distanceKm: 18,
  }).toSnapshot();

  const metrics = computeJournalMetrics([entry1, entry2]);
  assert.equal(metrics.totalDistanceKm, 30.5);
});
