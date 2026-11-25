import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRub,
  formatSignedRub,
} from '../src/utils/format.ts';

// These helpers replaced four identical copies of formatRub and three variants
// of date formatting. The tests pin the output so consolidating them cannot
// quietly change what users see.

test('formatRub: groups thousands with a non-breaking space and adds the sign', () => {
  // ru-RU uses U+00A0 as the group separator.
  assert.equal(formatRub(1234), '1\u00A0234 ₽');
  assert.equal(formatRub(0), '0 ₽');
});

test('formatRub: negatives use the typographic minus, matching formatSignedRub', () => {
  assert.equal(formatRub(-500), '− 500 ₽');
  assert.equal(formatRub(-1234), '− 1\u00A0234 ₽');
  // Both helpers must agree on the sign glyph; a mix of "-" and "−" in one
  // table looks like a rendering bug.
  assert.equal(formatRub(-500).replace(' ₽', ''), formatSignedRub(-500).replace(' ₽', ''));
});

test('formatRub: rounds to whole rubles', () => {
  assert.equal(formatRub(12.4), '12 ₽');
  assert.equal(formatRub(12.6), '13 ₽');
});

test('formatRub: non-finite input degrades to a dash instead of "NaN ₽"', () => {
  assert.equal(formatRub(Number.NaN), '— ₽');
  assert.equal(formatRub(Number.POSITIVE_INFINITY), '— ₽');
});

test('formatNumber: optional fraction digits', () => {
  assert.equal(formatNumber(1234), '1\u00A0234');
  assert.equal(formatNumber(1.2345, 2), '1,23');
  assert.equal(formatNumber(Number.NaN), '—');
});

test('formatPercent: whole percents', () => {
  assert.equal(formatPercent(0), '0%');
  assert.equal(formatPercent(70.4), '70%');
  assert.equal(formatPercent(99.6), '100%');
});

test('formatSignedRub: zero is omitted, negatives get a typographic minus', () => {
  assert.equal(formatSignedRub(0), '', 'a zero row should be omittable');
  assert.equal(formatSignedRub(500), '+ 500 ₽');
  assert.equal(formatSignedRub(-500), '− 500 ₽');
});

test('formatDate: date-only input is rendered in UTC so the day never shifts', () => {
  // 2026-01-01 rendered in a negative-offset zone must still read "1 января".
  assert.equal(formatDate('2026-01-01'), '1 января 2026 г.');
  assert.equal(formatDate('2026-11-22'), '22 ноября 2026 г.');
});

test('formatDate: missing and invalid input are handled', () => {
  assert.equal(formatDate(null), '—');
  assert.equal(formatDate(undefined), '—');
  assert.equal(formatDate('not-a-date'), 'not-a-date');
});

test('formatDateTime: includes the clock', () => {
  const out = formatDateTime('2026-11-22T15:30:00Z');
  assert.match(out, /2026/);
  assert.match(out, /\d{1,2}:\d{2}/);
  assert.equal(formatDateTime(null), '—');
});

test('formatDuration: minutes, then hours with the remainder', () => {
  assert.equal(formatDuration(0), '0 мин');
  assert.equal(formatDuration(90), '1 мин');
  assert.equal(formatDuration(600), '10 мин');
  assert.equal(formatDuration(3600), '1 ч');
  assert.equal(formatDuration(7800), '2 ч 10 мин');
  assert.equal(formatDuration(Number.NaN), '0 мин');
});
