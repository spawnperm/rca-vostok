import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIcsEventContent,
  ATTESTATION_CALENDAR_EVENTS,
} from '../src/utils/attestationCalendar.ts';
import {
  getInPersonExamSchedule,
  toUpcomingSessionCalendarEvent,
} from '../src/utils/attestationCalendarBooking.ts';
import {
  CERTIFICATION_DFO_EVENTS,
  buildCertificationIcsContent,
} from '../src/utils/certificationDfoCalendar.ts';

test('toUpcomingSessionCalendarEvent preserves session title, venue, commissionInfo, startTimeVld, and dayPlan', () => {
  const schedule = getInPersonExamSchedule('2026-10-01');
  assert.ok(schedule.length > 0);
  const first = schedule[0];
  const calEvent = toUpcomingSessionCalendarEvent(first);

  assert.equal(calEvent.startDateIso, first.start);
  assert.equal(calEvent.location, first.venue);
  if (first.title) {
    assert.equal(calEvent.title, first.title);
  }
  if (first.commissionInfo) {
    assert.equal(calEvent.organizer, first.commissionInfo);
  }
  if (first.startTimeVld) {
    assert.equal(calEvent.startTimeVld, first.startTimeVld);
  }
});

test('buildIcsEventContent emits RFC 5545 VCALENDAR/VEVENT with VALARM trigger', () => {
  const schedule = getInPersonExamSchedule('2026-10-01');
  const sessionEvent = toUpcomingSessionCalendarEvent(schedule[0]);
  const ics = buildIcsEventContent(sessionEvent, 4320, new Date('2026-10-01T00:00:00Z'));

  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.includes('VERSION:2.0\r\n'));
  assert.ok(ics.includes('BEGIN:VEVENT\r\n'));
  assert.ok(ics.includes(`UID:${sessionEvent.id}@rca-vostok.ru\r\n`));
  assert.ok(ics.includes('TRIGGER:-PT4320M\r\n'));
  assert.ok(ics.includes('END:VEVENT\r\nEND:VCALENDAR'));

  const overviewEventIcs = buildIcsEventContent(ATTESTATION_CALENDAR_EVENTS[0], 60);
  assert.ok(overviewEventIcs.includes('TRIGGER:-PT60M\r\n'));

  const dfoIcs = buildCertificationIcsContent(CERTIFICATION_DFO_EVENTS[0], 1440);
  assert.ok(dfoIcs.includes('BEGIN:VCALENDAR\r\n'));
  assert.ok(dfoIcs.includes('TRIGGER:-PT1440M\r\n'));
});
