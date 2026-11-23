import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FAVORITE_LITERATURE_EVENT,
  LITERATURE_DISCIPLINE_TABS,
  RECOMMENDED_LITERATURE,
  clearFavoriteLiteratureIds,
  filterRecommendedLiterature,
  getFavoriteLiteratureIds,
  removeFavoriteLiteratureId,
  syncGuestFavoritesToUser,
  toggleFavoriteLiteratureId,
} from '../src/utils/recommendedLiterature.ts';

function withMockWindowStorage(fn: (events: string[]) => void): void {
  const store = new Map<string, string>();
  const dispatched: string[] = [];
  const prevWindow = (globalThis as Record<string, unknown>).window;
  const prevCustomEvent = (globalThis as Record<string, unknown>).CustomEvent;

  class MockCustomEvent {
    type: string;
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type;
      this.detail = init?.detail;
    }
  }

  (globalThis as Record<string, unknown>).CustomEvent = MockCustomEvent;
  (globalThis as Record<string, unknown>).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
    dispatchEvent: (ev: { type: string }) => {
      dispatched.push(ev.type);
      return true;
    },
  };

  try {
    fn(dispatched);
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = prevWindow;
    }
    if (prevCustomEvent === undefined) {
      delete (globalThis as Record<string, unknown>).CustomEvent;
    } else {
      (globalThis as Record<string, unknown>).CustomEvent = prevCustomEvent;
    }
  }
}

test('RECOMMENDED_LITERATURE covers every discipline tab cleanly', () => {
  const specificTabs = LITERATURE_DISCIPLINE_TABS.filter((t) => t.id !== 'all');
  assert.ok(specificTabs.length >= 4);

  for (const tab of specificTabs) {
    const matches = filterRecommendedLiterature(RECOMMENDED_LITERATURE, {
      discipline: tab.id,
    });
    assert.ok(matches.length >= 2, `Expected at least 2 items for discipline ${tab.id}`);
    for (const item of matches) {
      assert.equal(item.discipline, tab.id);
      assert.equal(item.disciplineLabel, tab.label);
      assert.ok(item.title.length > 5);
      assert.ok(item.authors.length > 2);
      assert.ok(item.examRelevance.length > 5);
      assert.ok(item.tags.length >= 2);
    }
  }
});

test('filterRecommendedLiterature filters by discipline, search query, and favorites', () => {
  const water = filterRecommendedLiterature(RECOMMENDED_LITERATURE, {
    discipline: 'water_safety',
  });
  assert.equal(water.length, 2);

  const byTagOrText = filterRecommendedLiterature(RECOMMENDED_LITERATURE, {
    search: 'амурского тигра',
  });
  assert.equal(byTagOrText.length, 1);
  assert.equal(byTagOrText[0].id, 'lit-dfo-predators-oopt');

  const favOnly = filterRecommendedLiterature(RECOMMENDED_LITERATURE, {
    onlyFavorites: true,
    favoriteIds: ['lit-pp1893-commentary', 'lit-wfa-wilderness-aid'],
  });
  assert.deepEqual(
    favOnly.map((i) => i.id),
    ['lit-pp1893-commentary', 'lit-wfa-wilderness-aid']
  );

  const favAndDiscipline = filterRecommendedLiterature(RECOMMENDED_LITERATURE, {
    discipline: 'first_aid',
    onlyFavorites: true,
    favoriteIds: ['lit-pp1893-commentary', 'lit-wfa-wilderness-aid'],
  });
  assert.deepEqual(
    favAndDiscipline.map((i) => i.id),
    ['lit-wfa-wilderness-aid']
  );
});

test('SSR fallback returns empty favorites array when window is undefined', () => {
  assert.deepEqual(getFavoriteLiteratureIds(null), []);
  assert.deepEqual(getFavoriteLiteratureIds('user-1'), []);
});

test('Favorites storage supports toggle, remove, clear, and guest-to-user cabinet sync', () => {
  withMockWindowStorage((events) => {
    const first = toggleFavoriteLiteratureId('lit-pp1893-commentary', null);
    assert.equal(first.saved, true);
    assert.deepEqual(first.ids, ['lit-pp1893-commentary']);

    const second = toggleFavoriteLiteratureId('lit-water-rafting-safety', null);
    assert.equal(second.saved, true);
    assert.deepEqual(second.ids, ['lit-pp1893-commentary', 'lit-water-rafting-safety']);

    // Sync guest favorites into authenticated cabinet user
    const merged = syncGuestFavoritesToUser('guide-42');
    assert.deepEqual(merged, ['lit-pp1893-commentary', 'lit-water-rafting-safety']);
    assert.deepEqual(getFavoriteLiteratureIds(null), []);
    assert.deepEqual(getFavoriteLiteratureIds('guide-42'), [
      'lit-pp1893-commentary',
      'lit-water-rafting-safety',
    ]);

    // Toggle off & remove
    const afterRemove = removeFavoriteLiteratureId('lit-pp1893-commentary', 'guide-42');
    assert.deepEqual(afterRemove, ['lit-water-rafting-safety']);

    const toggledOff = toggleFavoriteLiteratureId('lit-water-rafting-safety', 'guide-42');
    assert.equal(toggledOff.saved, false);
    assert.deepEqual(toggledOff.ids, []);

    toggleFavoriteLiteratureId('lit-fstr-hiking-tactics', 'guide-42');
    assert.deepEqual(clearFavoriteLiteratureIds('guide-42'), []);

    assert.ok(events.every((e) => e === FAVORITE_LITERATURE_EVENT));
    assert.ok(events.length >= 6);
  });
});
