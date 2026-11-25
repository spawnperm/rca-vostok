import assert from 'node:assert/strict';
import { test } from 'vitest';
import { CERTIFIED_TOURIST_ROUTES } from '../src/data/researchData.ts';
import {
  DISTRICT_TO_ROUTE_ID,
  fetchRouteWeatherForecast,
} from '../src/utils/routeWeatherApi.ts';

test('fetchRouteWeatherForecast: returns forecast for all certified popular routes', async () => {
  for (const route of CERTIFIED_TOURIST_ROUTES) {
    const forecast = await fetchRouteWeatherForecast(route.id, { delayMs: 1 });
    assert.equal(forecast.routeId, route.id);
    assert.equal(forecast.routeName, route.name);
    assert.equal(forecast.hourlyOutlook.length, 4);
    assert.equal(forecast.dailyOutlook.length, 4);
    assert.ok(forecast.current.windSpeedMs >= 1.5);
    assert.ok(forecast.current.windGustMs >= forecast.current.windSpeedMs);
    assert.ok(forecast.current.humidityPct >= 30 && forecast.current.humidityPct <= 100);
    assert.ok(forecast.guideAdvisory.length > 20);
    assert.match(forecast.coordinatesLabel, /° N/);
  }
});

test('fetchRouteWeatherForecast: supports AbortSignal cancellation', async () => {
  const controller = new AbortController();
  const promise = fetchRouteWeatherForecast('route-pidan-falaza', {
    signal: controller.signal,
    delayMs: 250,
  });
  controller.abort();

  await assert.rejects(promise, /отменён/i);
});

test('fetchRouteWeatherForecast: rejects unknown route identifiers', async () => {
  await assert.rejects(
    fetchRouteWeatherForecast('non-existent-route', { delayMs: 1 }),
    /не найден/i
  );
});

test('DISTRICT_TO_ROUTE_ID: maps to valid route identifiers', () => {
  const validIds = new Set(CERTIFIED_TOURIST_ROUTES.map((r) => r.id));
  for (const routeId of Object.values(DISTRICT_TO_ROUTE_ID)) {
    assert.ok(validIds.has(routeId), `Expected valid route id, got ${routeId}`);
  }
});
