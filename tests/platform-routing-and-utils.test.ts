import assert from 'node:assert/strict';
import test from 'node:test';
import {
  escapeIcsText,
  formatIcsUtcTimestamp,
} from '../src/utils/attestationCalendar.ts';
import {
  formatDateIsoUtc,
  formatDateRuUtc,
  formatDurationClock,
  parseIsoDateUtc,
} from '../src/utils/format.ts';
import {
  escapeIcsText as hikeEscapeIcsText,
  formatIcsUtcTimestamp as hikeFormatIcsUtcTimestamp,
} from '../src/utils/hikeScheduleExport.ts';
import { validateCenterInquiry } from '../src/utils/inquiryApi.ts';
import {
  buildRouteUrl,
  parseRouteFromSearch,
  PUBLIC_SITEMAP_ROUTES,
} from '../src/utils/seo.ts';

test('SEO & Routing: parseRouteFromSearch and buildRouteUrl handle tab + sub deep-links', () => {
  assert.deepEqual(parseRouteFromSearch(''), { tab: 'home', subTab: undefined });
  assert.deepEqual(parseRouteFromSearch('?tab=unknown_tab'), { tab: 'home', subTab: undefined });
  assert.deepEqual(parseRouteFromSearch('?tab=learning&sub=competencies'), {
    tab: 'learning',
    subTab: 'competencies',
  });
  assert.deepEqual(parseRouteFromSearch('?tab=account&sub=preparation'), {
    tab: 'account',
    subTab: 'preparation',
  });

  assert.equal(buildRouteUrl('/', 'home'), '/');
  assert.equal(buildRouteUrl('/', 'learning'), '/?tab=learning');
  assert.equal(
    buildRouteUrl('/', 'certification', 'registry'),
    '/?tab=certification&sub=registry'
  );
  assert.equal(
    buildRouteUrl('/app', 'analytics', 'api'),
    '/app?tab=analytics&sub=api'
  );
});

test('SEO: PUBLIC_SITEMAP_ROUTES includes 15 public routes and excludes private account', () => {
  assert.equal(PUBLIC_SITEMAP_ROUTES.length, 15);
  const tabs = PUBLIC_SITEMAP_ROUTES.map((r) => r.tab);
  assert.ok(!tabs.includes('account'));
  assert.ok(tabs.includes('home'));
  assert.ok(tabs.includes('learning'));
  assert.ok(tabs.includes('certification'));
  assert.ok(tabs.includes('routes'));
  assert.ok(tabs.includes('analytics'));
});

test('Format helpers: duration clock and timezone-safe UTC dates', () => {
  assert.equal(formatDurationClock(0), '0 мин 00 с');
  assert.equal(formatDurationClock(-5), '0 мин 00 с');
  assert.equal(formatDurationClock(189), '3 мин 09 с');

  const dt = parseIsoDateUtc('2026-11-24');
  assert.equal(formatDateRuUtc(dt), '24.11.2026');
  assert.equal(formatDateIsoUtc(dt), '2026-11-24');

  const fallback = parseIsoDateUtc('invalid-date', 2027);
  assert.equal(formatDateIsoUtc(fallback), '2027-01-01');
});

test('Calendar utilities: ICS escaping and UTC timestamp helpers share one implementation', () => {
  assert.equal(escapeIcsText, hikeEscapeIcsText);
  assert.equal(formatIcsUtcTimestamp, hikeFormatIcsUtcTimestamp);
  assert.equal(escapeIcsText('Приморье, 1–2 КС; Владивосток\nСбор'), 'Приморье\\, 1–2 КС\\; Владивосток\\nСбор');
  assert.equal(formatIcsUtcTimestamp(new Date(Date.UTC(2027, 3, 16, 9, 5, 0))), '20270416T090500Z');
});

test('Inquiry validation: validates name, email, consent and optional experience note', () => {
  assert.ok(
    validateCenterInquiry({
      fullName: 'А',
      email: 'bad-email',
      region: 'Приморский край',
      track: 'Пешеходный туризм',
      consentAccepted: true,
    })
  );

  assert.ok(
    validateCenterInquiry({
      fullName: 'Иван Петров',
      email: 'ivan@example.ru',
      region: 'Приморский край',
      track: 'Пешеходный туризм',
      experienceNote: 'Да',
      consentAccepted: true,
    }, { requireNote: true })
  );

  assert.ok(
    validateCenterInquiry({
      fullName: 'Иван Петров',
      email: 'ivan@example.ru',
      region: 'Приморский край',
      track: 'Пешеходный туризм',
      consentAccepted: false,
    })
  );

  assert.equal(
    validateCenterInquiry({
      fullName: 'Иван Петров',
      email: 'ivan@example.ru',
      region: 'Приморский край',
      track: 'Пешеходный туризм',
      experienceNote: 'Уточнить пакет документов для Контура А',
      consentAccepted: true,
    }, { requireNote: true }),
    null
  );
});
