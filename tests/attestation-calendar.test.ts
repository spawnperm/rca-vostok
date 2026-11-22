import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTESTATION_CALENDAR_EVENTS,
  buildCalendarMonthCells,
  buildGoogleCalendarUrl,
  buildIcsEventContent,
  getEventsForDate,
} from '../src/utils/attestationCalendar.ts';

test('ATTESTATION_CALENDAR_EVENTS includes both upcoming attestation sessions and webinars', () => {
  const sessions = ATTESTATION_CALENDAR_EVENTS.filter((e) => e.kind === 'session');
  const webinars = ATTESTATION_CALENDAR_EVENTS.filter((e) => e.kind === 'webinar');

  assert.ok(sessions.length >= 6);
  assert.ok(webinars.length >= 3);

  for (const ev of ATTESTATION_CALENDAR_EVENTS) {
    assert.ok(ev.startDateIso <= ev.endDateIso, `Invalid date range for ${ev.id}`);
    assert.ok(ev.durationMinutes >= 30);
  }
});

test('buildCalendarMonthCells generates Monday-first grid aligned with UTC weekdays', () => {
  // December 2026 starts on Tuesday (2026-12-01), so Monday 2026-11-30 is first cell
  const cells = buildCalendarMonthCells(2026, 11);
  assert.equal(cells.length, 35);
  assert.equal(cells[0].isoDate, '2026-11-30');
  assert.equal(cells[0].inCurrentMonth, false);
  assert.equal(cells[1].isoDate, '2026-12-01');
  assert.equal(cells[1].inCurrentMonth, true);
  assert.equal(cells[cells.length - 1].isoDate, '2027-01-03');
  assert.equal(cells[cells.length - 1].inCurrentMonth, false);
});

test('getEventsForDate matches single-day webinars and multi-day attestation sessions', () => {
  const webinarDay = getEventsForDate('2026-12-03');
  assert.equal(webinarDay.length, 1);
  assert.equal(webinarDay[0].kind, 'webinar');
  assert.equal(webinarDay[0].id, 'cal-webinar-760');

  // Dec 16 falls inside Dec 14-19 water tourism attestation session
  const sessionMidDay = getEventsForDate('2026-12-16');
  assert.equal(sessionMidDay.length, 1);
  assert.equal(sessionMidDay[0].kind, 'session');
  assert.equal(sessionMidDay[0].id, 'cal-session-dec-water');

  const emptyDay = getEventsForDate('2026-12-25');
  assert.equal(emptyDay.length, 0);
});

test('buildIcsEventContent formats RFC 5545 VCALENDAR with UTC+10 -> UTC conversion and VALARM', () => {
  const webinar = ATTESTATION_CALENDAR_EVENTS.find((e) => e.id === 'cal-webinar-760');
  assert.ok(webinar);

  // 2026-12-03 19:00 VLD (UTC+10) => 2026-12-03 09:00 UTC, +90 min => 10:30 UTC
  const fixedNow = new Date('2026-11-22T12:00:00.000Z');
  const ics = buildIcsEventContent(webinar, 1440, fixedNow);

  assert.ok(ics.includes('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.includes('DTSTART:20261203T090000Z\r\n'));
  assert.ok(ics.includes('DTEND:20261203T103000Z\r\n'));
  assert.ok(ics.includes('BEGIN:VALARM\r\n'));
  assert.ok(ics.includes('TRIGGER:-PT1440M\r\n'));
  assert.ok(ics.includes('END:VCALENDAR'));
  // Comma in SUMMARY or DESCRIPTION should be escaped according to RFC 5545
  assert.ok(ics.includes('\\,'));
});

test('buildGoogleCalendarUrl builds valid Google Calendar template URL with event window', () => {
  const session = ATTESTATION_CALENDAR_EVENTS.find((e) => e.id === 'cal-session-apr-spring');
  assert.ok(session);

  const rawUrl = buildGoogleCalendarUrl(session);
  const parsed = new URL(rawUrl);

  assert.equal(parsed.origin, 'https://calendar.google.com');
  assert.equal(parsed.pathname, '/calendar/render');
  assert.equal(parsed.searchParams.get('action'), 'TEMPLATE');
  assert.equal(parsed.searchParams.get('text'), session.title);
  assert.equal(parsed.searchParams.get('dates'), '20270415T230000Z/20270418T080000Z');
  assert.equal(parsed.searchParams.get('location'), session.location);
});
