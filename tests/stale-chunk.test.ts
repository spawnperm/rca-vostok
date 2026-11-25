import assert from 'node:assert/strict';
import { test } from 'vitest';

/**
 * Stale-chunk handling.
 *
 * Vite emits content-hashed asset names, so after a deploy an open tab still
 * running the previous index.html requests chunks that no longer exist. Two
 * rules keep that from looking like a broken feature:
 *
 *   1. the server must answer 404 for a missing /assets/* file instead of
 *      returning the SPA shell with status 200 — otherwise the browser parses
 *      HTML as JavaScript and the module fails to load;
 *   2. the client reloads once when a lazy chunk fails, so the tab picks up the
 *      new build automatically.
 *
 * The server rule is exercised against the running deployment; here the client
 * rule is pinned with a fake chunk loader.
 */

// Mirrors lazyWithReload in App.tsx without touching window/sessionStorage.
function makeReloader(
  storage: Map<string, string>,
  reload: () => void
): <T>(factory: () => Promise<T>, key: string) => () => Promise<T> {
  return <T,>(factory: () => Promise<T>, key: string) => async () => {
    try {
      return await factory();
    } catch (err) {
      const flag = `chunk-reload:${key}`;
      if (!storage.has(flag)) {
        storage.set(flag, '1');
        reload();
        return new Promise<T>(() => {});
      }
      storage.delete(flag);
      throw err;
    }
  };
}

test('stale chunk: first failure triggers exactly one reload', async () => {
  const storage = new Map<string, string>();
  let reloads = 0;
  const wrap = makeReloader(storage, () => {
    reloads += 1;
  });

  const load = wrap(() => Promise.reject(new Error('Failed to fetch dynamically imported module')), 'AccountSection');

  // The promise never resolves because the page is navigating away.
  const pending = load();
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(reloads, 1, 'must reload once');
  assert.equal(storage.get('chunk-reload:AccountSection'), '1');
  void pending;
});

test('stale chunk: a second failure does not loop, it surfaces the error', async () => {
  const storage = new Map<string, string>();
  let reloads = 0;
  const wrap = makeReloader(storage, () => {
    reloads += 1;
  });

  const failing = () => Promise.reject(new Error('still missing'));
  storage.set('chunk-reload:AccountSection', '1'); // as if already reloaded once

  await assert.rejects(() => wrap(failing, 'AccountSection')(), /still missing/);
  assert.equal(reloads, 0, 'must not reload a second time');
  assert.equal(storage.has('chunk-reload:AccountSection'), false, 'flag is cleared');
});

test('healthy chunk loads without touching the reload path', async () => {
  const storage = new Map<string, string>();
  let reloads = 0;
  const wrap = makeReloader(storage, () => {
    reloads += 1;
  });

  const value = await wrap(() => Promise.resolve({ default: 'ok' }), 'OverviewSection')();
  assert.equal(value.default, 'ok');
  assert.equal(reloads, 0);
  assert.equal(storage.size, 0);
});

test('reload flags are per-chunk, so one broken section does not suppress another', async () => {
  const storage = new Map<string, string>();
  let reloads = 0;
  const wrap = makeReloader(storage, () => {
    reloads += 1;
  });

  const failing = () => Promise.reject(new Error('missing'));

  void wrap(failing, 'AccountSection')();
  void wrap(failing, 'MarketSection')();
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(reloads, 2, 'each chunk gets its own reload attempt');
});
