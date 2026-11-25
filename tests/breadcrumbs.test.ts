import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildBreadcrumbs } from '../src/utils/breadcrumbs.ts';
import { SECTION_SEO_MAP, type SiteTabId } from '../src/utils/seo.ts';

test('buildBreadcrumbs: home renders single current root item', () => {
  const items = buildBreadcrumbs('home');
  assert.deepEqual(items, [
    {
      tab: 'home',
      label: 'Главная',
      isCurrent: true,
      isHome: true,
    },
  ]);
});

test('buildBreadcrumbs: landing sections show Главная -> Section', () => {
  const landingTabs: SiteTabId[] = [
    'learning',
    'preparation',
    'certification',
    'consulting',
    'news',
    'routes',
    'faq',
    'contacts',
  ];

  for (const tab of landingTabs) {
    const items = buildBreadcrumbs(tab);
    assert.equal(items.length, 2, `expected 2 items for ${tab}`);
    assert.equal(items[0].tab, 'home');
    assert.equal(items[0].isCurrent, false);
    assert.equal(items[1].tab, tab);
    assert.equal(items[1].label, SECTION_SEO_MAP[tab].name);
    assert.equal(items[1].isCurrent, true);
  }
});

test('buildBreadcrumbs: platform overview shows Главная -> Платформа: Обзор центра', () => {
  const items = buildBreadcrumbs('overview');
  assert.equal(items.length, 2);
  assert.equal(items[0].tab, 'home');
  assert.equal(items[0].isCurrent, false);
  assert.equal(items[1].tab, 'overview');
  assert.equal(items[1].isCurrent, true);
});

test('buildBreadcrumbs: platform subsections include overview parent for quick return', () => {
  const platformSubTabs: SiteTabId[] = [
    'calculator',
    'market',
    'dissertation',
    'presentations',
    'analytics',
    'account',
  ];

  for (const tab of platformSubTabs) {
    const items = buildBreadcrumbs(tab);
    assert.equal(items.length, 3, `expected 3 items for ${tab}`);
    assert.equal(items[0].tab, 'home');
    assert.equal(items[0].isCurrent, false);
    assert.equal(items[1].tab, 'overview');
    assert.equal(items[1].isCurrent, false);
    assert.equal(items[2].tab, tab);
    assert.equal(items[2].label, SECTION_SEO_MAP[tab].name);
    assert.equal(items[2].isCurrent, true);
  }
});
