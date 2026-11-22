import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FAR_EAST_TOURISM_HUBS,
  buildFallbackHubsWeather,
} from '../src/utils/hubsWeather.ts';

test('buildFallbackHubsWeather returns all 5 Far East tourism hubs with Vladivostok first', () => {
  const result = buildFallbackHubsWeather(new Date('2026-11-22T12:00:00Z'));

  assert.equal(result.source, 'climatology-fallback');
  assert.equal(result.hubs.length, FAR_EAST_TOURISM_HUBS.length);
  assert.equal(result.hubs[0]?.id, 'vladivostok');
  assert.equal(result.hubs[0]?.city, 'Владивосток');

  for (const hub of result.hubs) {
    assert.equal(typeof hub.tempC, 'number');
    assert.equal(typeof hub.windMs, 'number');
    assert.ok(hub.windGustMs >= hub.windMs);
    assert.ok(hub.humidityPct >= 0 && hub.humidityPct <= 100);
    assert.ok(hub.pressureMmHg > 600 && hub.pressureMmHg < 820);
    assert.match(hub.localTimeLabel, /^\d{2}:\d{2}$/);
    assert.ok(['favourable', 'caution', 'restricted'].includes(hub.guideStatus));
  }
});

test('buildFallbackHubsWeather is deterministic within the same hour', () => {
  const t1 = new Date('2026-07-15T06:10:00Z');
  const t2 = new Date('2026-07-15T06:45:00Z');
  const r1 = buildFallbackHubsWeather(t1);
  const r2 = buildFallbackHubsWeather(t2);

  assert.deepEqual(
    r1.hubs.map((h) => ({ id: h.id, tempC: h.tempC, windMs: h.windMs, condition: h.condition })),
    r2.hubs.map((h) => ({ id: h.id, tempC: h.tempC, windMs: h.windMs, condition: h.condition }))
  );
});
