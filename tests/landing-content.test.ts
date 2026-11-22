import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CERTIFICATION_SCHEDULE,
  CONTACTS,
  LANDING_SECTIONS,
  PROGRAMMES,
  formatSessionRange,
} from '../src/data/landingContent.ts';

// The landing content mirrors https://rca-vostok.ru/api/content. These tests
// pin the parts that are easy to break while editing: Russian month declension
// in date ranges, and the shape other components rely on.

test('formatSessionRange: uses the genitive month form inside a range', () => {
  // «16–18 апрель» is the failure this guards against: the nominative form
  // reads as a mistake in Russian, and toLocaleDateString returns it.
  assert.equal(formatSessionRange('2027-04-16', '2027-04-18'), '16–18 апреля 2027');
  assert.equal(formatSessionRange('2027-05-14', '2027-05-16'), '14–16 мая 2027');
  assert.equal(formatSessionRange('2027-06-04', '2027-06-06'), '4–6 июня 2027');
  assert.equal(formatSessionRange('2027-10-15', '2027-10-17'), '15–17 октября 2027');
});

test('formatSessionRange: names both months when the range crosses a boundary', () => {
  assert.equal(formatSessionRange('2027-01-30', '2027-02-02'), '30 января — 2 февраля 2027');
});

test('formatSessionRange: single-day interval stays readable', () => {
  assert.equal(formatSessionRange('2027-03-05', '2027-03-05'), '5–5 марта 2027');
});

test('certification schedule: five sessions of category 1-4 КС in 2027', () => {
  assert.equal(CERTIFICATION_SCHEDULE.length, 5);
  for (const slot of CERTIFICATION_SCHEDULE) {
    assert.equal(slot.category, '1–4 КС');
    assert.match(slot.start, /^2027-/);
    // Every session covers the seven discipline combinations from the site.
    assert.equal(slot.disciplines.length, 7);
    assert.ok(slot.disciplines.includes('пешеходный'));
    assert.ok(slot.disciplines.includes('водный'));
    assert.ok(slot.end >= slot.start);
  }
});

test('programmes: four training directions from the site', () => {
  assert.equal(PROGRAMMES.length, 4);
  const titles = PROGRAMMES.map((p) => p.title);
  assert.ok(titles.some((t) => t.includes('пешеходному туризму')));
  assert.ok(titles.some((t) => t.includes('водному туризму')));
  assert.ok(titles.includes('Экскурсовод'));
  assert.ok(titles.includes('Руководитель туристической группы'));
});

test('landing sections: match the navigation order of the source site', () => {
  assert.deepEqual(
    LANDING_SECTIONS.map((s) => s.id),
    ['learning', 'preparation', 'certification', 'consulting', 'contacts']
  );
});

test('contacts: phone, email and messengers are present', () => {
  assert.match(CONTACTS.phone, /^\+7/);
  assert.match(CONTACTS.email, /@/);
  assert.ok(CONTACTS.messengers.length >= 2);
  for (const messenger of CONTACTS.messengers) {
    assert.match(messenger.url, /^https:\/\//);
  }
});
