import assert from 'node:assert/strict';
import test from 'node:test';
import { buildIcsEventContent } from '../src/utils/attestationCalendar.ts';
import {
  MARKET_CALENDAR_MONTHS,
  MARKET_FIELD_COMMISSIONS_AND_SEMINARS,
  buildMarketCalendarMonthGrid,
  filterMarketCalendarEvents,
  getMarketEventsForIsoDate,
  toCalendarExportEvent,
} from '../src/utils/fieldCommissionsCalendar.ts';
import { PRIMORYE_ACTIVITY_ZONES } from '../src/utils/primoryeMapLayers.ts';
import {
  PRIMORYE_MUNICIPALITIES,
  buildPrimoryeMunicipalD3Layout,
  createPrimoryeHeatmapColorScale,
  formatPrimoryeMetricValue,
  getPrimoryeMunicipalityMetricValue,
} from '../src/utils/primoryeMunicipalHeatmapData.ts';

test('PRIMORYE_ACTIVITY_ZONES defines coastal, ridge, and north expedition clusters', () => {
  assert.equal(PRIMORYE_ACTIVITY_ZONES.length, 3);
  for (const zone of PRIMORYE_ACTIVITY_ZONES) {
    assert.ok(zone.name.length > 5);
    assert.ok(zone.rx > 20 && zone.ry > 20);
  }
});

test('buildPrimoryeMunicipalD3Layout projects all municipalities cleanly with D3 color scales', () => {
  const layout = buildPrimoryeMunicipalD3Layout(560, 470);
  assert.equal(layout.municipalities.length, PRIMORYE_MUNICIPALITIES.length);
  assert.equal(layout.totalCertified, 122);
  assert.ok(layout.totalDemand > layout.totalCertified);

  for (const m of layout.municipalities) {
    assert.ok(m.pathData.startsWith('M'), `Missing SVG path for ${m.id}`);
    assert.ok(Number.isFinite(m.centroidX) && Number.isFinite(m.centroidY));
    assert.ok(m.densityPer1000Km2 >= 0);
  }

  for (const metric of ['density', 'certified', 'coveragePct', 'deficit'] as const) {
    const scaleCfg = createPrimoryeHeatmapColorScale(layout.municipalities, metric);
    assert.ok(scaleCfg.domainMax >= 1);
    const vld = layout.municipalities.find((m) => m.id === 'muni-vladivostok');
    assert.ok(vld);
    const val = getPrimoryeMunicipalityMetricValue(vld, metric);
    const color = scaleCfg.scale(val);
    assert.ok(color.length > 0);
    assert.ok(formatPrimoryeMetricValue(vld, metric).length > 0);
  }
});

test('MarketFieldCommissionsCalendar filters commissions/seminars and generates valid .ics payloads', () => {
  const commissions = filterMarketCalendarEvents({ typeFilter: 'field_commission' });
  const seminars = filterMarketCalendarEvents({ typeFilter: 'seminar' });
  assert.ok(commissions.length >= 4);
  assert.ok(seminars.length >= 4);
  assert.equal(
    commissions.length + seminars.length,
    MARKET_FIELD_COMMISSIONS_AND_SEMINARS.length
  );

  const primoryeOnly = filterMarketCalendarEvents({ regionFilter: 'primorye' });
  assert.ok(primoryeOnly.every((e) => e.regionGroup === 'primorye'));

  const firstMonth = MARKET_CALENDAR_MONTHS[0];
  const grid = buildMarketCalendarMonthGrid(firstMonth.year, firstMonth.month);
  assert.ok(grid.length === 35 || grid.length === 42);

  const dec17Events = getMarketEventsForIsoDate('2026-12-17');
  assert.ok(dec17Events.some((e) => e.id === 'mfc-comm-nakhodka-dec'));

  const exportEv = toCalendarExportEvent(MARKET_FIELD_COMMISSIONS_AND_SEMINARS[0]);
  const ics = buildIcsEventContent(exportEv, 1440, new Date('2026-11-23T00:00:00Z'));
  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes(exportEv.id));
});
