import assert from 'node:assert/strict';
import { test } from 'vitest';
import { parseByteRange } from '../src/infrastructure/http/MediaRouter.ts';

// Video and audio seeking depend on correct Range handling; a wrong end offset
// truncates the file and a wrong start makes the player stutter.

test('parseByteRange: explicit start and end', () => {
  assert.deepEqual(parseByteRange('bytes=0-99', 1000), { start: 0, end: 99 });
  assert.deepEqual(parseByteRange('bytes=500-599', 1000), { start: 500, end: 599 });
});

test('parseByteRange: open-ended range takes the rest of the file', () => {
  assert.deepEqual(parseByteRange('bytes=900-', 1000), { start: 900, end: 999 });
});

test('parseByteRange: suffix range means the last N bytes', () => {
  assert.deepEqual(parseByteRange('bytes=-100', 1000), { start: 900, end: 999 });
  // A suffix larger than the file clamps to the whole thing.
  assert.deepEqual(parseByteRange('bytes=-5000', 1000), { start: 0, end: 999 });
});

test('parseByteRange: end beyond the file is clamped', () => {
  assert.deepEqual(parseByteRange('bytes=990-5000', 1000), { start: 990, end: 999 });
});

test('parseByteRange: malformed headers are rejected', () => {
  for (const header of [
    'bytes=',
    'bytes=-',
    'bytes=abc-def',
    'bytes=100-50', // inverted
    'bytes=1000-', // start past the end
    'items=0-10', // wrong unit
    '',
  ]) {
    assert.equal(parseByteRange(header, 1000), null, `should reject: "${header}"`);
  }
});

test('parseByteRange: zero-length file has no satisfiable range', () => {
  assert.equal(parseByteRange('bytes=0-10', 0), null);
});

test('parseByteRange: single byte range', () => {
  assert.deepEqual(parseByteRange('bytes=5-5', 100), { start: 5, end: 5 });
});
