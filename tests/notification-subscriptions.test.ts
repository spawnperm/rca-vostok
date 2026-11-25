import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  buildDefaultSubscriptionPrefs,
  matchPersonalizedPushAlerts,
  sendBrowserPushNotification,
  SUBSCRIPTION_ATTESTATION_CATEGORIES,
  SUBSCRIPTION_DFO_REGIONS,
  type NotificationSubscriptionPrefs,
} from '../src/utils/notificationSubscriptions.ts';

test('buildDefaultSubscriptionPrefs maps user DFO region accurately', () => {
  const kam = buildDefaultSubscriptionPrefs('Камчатский край');
  assert.deepEqual(kam.regions, ['kamchatka']);
  assert.equal(kam.notifyVacancies, true);
  assert.equal(kam.notifyCommissions, true);

  const fallback = buildDefaultSubscriptionPrefs();
  assert.deepEqual(fallback.regions, ['primorye']);
  assert.ok(SUBSCRIPTION_DFO_REGIONS.length >= 7);
  assert.ok(SUBSCRIPTION_ATTESTATION_CATEGORIES.length >= 5);
});

test('matchPersonalizedPushAlerts filters by DFO region, attestation category, and event type', () => {
  const kamMountainVacOnly: NotificationSubscriptionPrefs = {
    pushEnabled: true,
    regions: ['kamchatka'],
    categories: ['mountain-3-4'],
    notifyVacancies: true,
    notifyCommissions: false,
    updatedAtIso: '2026-11-23T00:00:00.000Z',
  };

  const vacMatches = matchPersonalizedPushAlerts(kamMountainVacOnly);
  assert.ok(vacMatches.length >= 1);
  assert.ok(vacMatches.every((item) => item.regionId === 'kamchatka'));
  assert.ok(vacMatches.every((item) => item.kind === 'vacancy'));
  assert.ok(vacMatches.every((item) => item.categoryIds.includes('mountain-3-4')));

  const primCommissionsOnly: NotificationSubscriptionPrefs = {
    pushEnabled: true,
    regions: ['primorye'],
    categories: ['speleo'],
    notifyVacancies: false,
    notifyCommissions: true,
    updatedAtIso: '2026-11-23T00:00:00.000Z',
  };
  const commMatches = matchPersonalizedPushAlerts(primCommissionsOnly);
  assert.ok(commMatches.length >= 1);
  assert.ok(commMatches.every((item) => item.regionId === 'primorye'));
  assert.ok(commMatches.every((item) => item.kind === 'commission'));
  assert.ok(commMatches.every((item) => item.categoryIds.includes('speleo')));
});

test('matchPersonalizedPushAlerts returns empty array when filters or types are cleared', () => {
  const noTypes: NotificationSubscriptionPrefs = {
    pushEnabled: true,
    regions: ['primorye'],
    categories: ['hiking-1-2'],
    notifyVacancies: false,
    notifyCommissions: false,
    updatedAtIso: '2026-11-23T00:00:00.000Z',
  };
  assert.equal(matchPersonalizedPushAlerts(noTypes).length, 0);

  const noRegionsOrCategories: NotificationSubscriptionPrefs = {
    pushEnabled: true,
    regions: [],
    categories: [],
    notifyVacancies: true,
    notifyCommissions: true,
    updatedAtIso: '2026-11-23T00:00:00.000Z',
  };
  assert.equal(matchPersonalizedPushAlerts(noRegionsOrCategories).length, 0);
});

test('sendBrowserPushNotification degrades gracefully when Notification API is unavailable', () => {
  const sample = matchPersonalizedPushAlerts(buildDefaultSubscriptionPrefs('Приморский край'))[0];
  assert.ok(sample);
  const res = sendBrowserPushNotification(sample);
  assert.equal(res.dispatchedNative, false);
  assert.ok(res.message.includes(sample.regionName));
});
