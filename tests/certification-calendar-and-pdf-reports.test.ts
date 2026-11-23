import assert from 'node:assert/strict';
import test from 'node:test';
import { HORIZON_STAGES } from '../src/data/researchData.ts';
import { DemandForecastService } from '../src/domain/certification/DemandForecastService.ts';
import {
  buildCalculatorReportPayload,
  buildMarketReportPayload,
} from '../src/utils/analyticsPdfReports.ts';
import { computeCalculatorScenarioProjection } from '../src/utils/calculatorScenario2030.ts';
import {
  buildCertificationGoogleCalendarUrl,
  buildCertificationMonthGrid,
  CERTIFICATION_DFO_EVENTS,
  filterCertificationDfoEvents,
  getCertificationEventsForIsoDate,
  toCertificationExportEvent,
} from '../src/utils/certificationDfoCalendar.ts';
import { buildIcsEventContent } from '../src/utils/attestationCalendar.ts';

test('certificationDfoCalendar covers exams and in-person meetings across DFO regions', () => {
  const allEvents = filterCertificationDfoEvents({});
  assert.equal(allEvents.length, CERTIFICATION_DFO_EVENTS.length);
  assert.ok(allEvents.some((ev) => ev.type === 'exam'));
  assert.ok(allEvents.some((ev) => ev.type === 'meeting'));

  const examsOnly = filterCertificationDfoEvents({ typeFilter: 'exam' });
  assert.ok(examsOnly.length >= 6);
  assert.ok(examsOnly.every((ev) => ev.type === 'exam'));

  const meetingsOnly = filterCertificationDfoEvents({ typeFilter: 'meeting' });
  assert.ok(meetingsOnly.length >= 4);
  assert.ok(meetingsOnly.every((ev) => ev.type === 'meeting'));

  for (const reg of ['primorye', 'khabarovsk', 'kamchatka', 'sakhalin', 'amur', 'yakutia'] as const) {
    const regEvents = filterCertificationDfoEvents({ regionId: reg });
    assert.ok(regEvents.length >= 1, `Expected events for region ${reg}`);
  }
});

test('certificationDfoCalendar builds valid month grids, date lookups, and ICS/Google exports', () => {
  const april2027Grid = buildCertificationMonthGrid(2027, 3);
  assert.ok(april2027Grid.length === 35 || april2027Grid.length === 42);

  const day17Events = getCertificationEventsForIsoDate('2027-04-17');
  assert.ok(day17Events.some((ev) => ev.id === 'cert-dfo-prim-exam-apr'));

  const sampleEvent = CERTIFICATION_DFO_EVENTS[0];
  const exportEvent = toCertificationExportEvent(sampleEvent);
  const ics = buildIcsEventContent(exportEvent, 1440, new Date('2026-11-23T00:00:00Z'));
  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('BEGIN:VEVENT'));
  assert.ok(ics.includes('Кампус ВВГУ'));

  const gCalUrl = buildCertificationGoogleCalendarUrl(sampleEvent);
  assert.ok(gCalUrl.startsWith('https://calendar.google.com/calendar/render?'));
});

test('buildCalculatorReportPayload produces accurate 2030 forecast and scenario summary', () => {
  const modelInput = {
    tAct: 185000,
    pOrg: 25,
    gSize: 10,
    groupsPerSeason: 8,
    kSeason: 1.45,
    kTurnover: 1.15,
    registryCount: 122,
    groupsPerYear: 6,
    cohortSize: 25,
    conversionRate: 80,
  };
  const results = DemandForecastService.calculate(modelInput);
  const scenarioProjection = computeCalculatorScenarioProjection(modelInput, 'optimistic');

  const payload = buildCalculatorReportPayload({
    modelInput,
    results,
    scenarioProjection,
    presetLabel: 'Приморье: базовый сценарий',
    now: new Date('2026-11-23T12:00:00Z'),
  });

  assert.equal(payload.docNumber, 'РЦА-2026/CALC-1123');
  assert.equal(payload.scenarioLabel, 'Оптимистичный');
  assert.equal(payload.currentResults.totalDemand, results.totalDemand);
  assert.equal(payload.projection2030.demand2030, scenarioProjection.demand2030);
  assert.equal(payload.yearlyRows.length, 5);
  assert.equal(payload.allScenarios2030.length, 3);
  assert.ok(payload.allScenarios2030[2].demand2030 >= payload.allScenarios2030[0].demand2030);
});

test('buildMarketReportPayload aggregates all 7 DFO regions and filters recommendations', () => {
  const payloadAll = buildMarketReportPayload({
    activeHorizon: HORIZON_STAGES[1],
    stakeholderFilter: 'all',
    now: new Date('2026-11-23T12:00:00Z'),
  });

  assert.equal(payloadAll.docNumber, 'РЦА-2026/MKT-1123');
  assert.equal(payloadAll.regions.length, 7);
  assert.equal(payloadAll.bottlenecks.length, 5);
  assert.equal(payloadAll.recommendations.length, 7);
  assert.ok(payloadAll.totals.demand2025 > payloadAll.totals.registry);
  assert.ok(payloadAll.totals.demand2030Base >= payloadAll.totals.demand2030Conservative);

  const payloadFiltered = buildMarketReportPayload({
    activeHorizon: HORIZON_STAGES[0],
    stakeholderFilter: 'ВВГУ и РЦА',
    now: new Date('2026-11-23T12:00:00Z'),
  });
  assert.ok(payloadFiltered.recommendations.length > 0 && payloadFiltered.recommendations.length < 7);
  assert.ok(payloadFiltered.recommendations.every((r) => r.stakeholder === 'ВВГУ и РЦА'));
});
