import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialSnapshot,
  createOfflineSnapshot,
  probeApiHealth,
} from '../src/utils/apiConnectionStatus.ts';

test('apiConnectionStatus: initial snapshot starts in checking state', () => {
  const initial = createInitialSnapshot();
  assert.equal(initial.status, 'checking');
  assert.equal(initial.latencyMs, null);
  assert.equal(initial.errorMessage, null);
});

test('apiConnectionStatus: offline snapshot transitions immediately to disconnected', () => {
  const snapshot = createOfflineSnapshot(() => 1_700_000_000_000);
  assert.equal(snapshot.status, 'disconnected');
  assert.equal(snapshot.lastCheckedAt, new Date(1_700_000_000_000).toISOString());
  assert.match(snapshot.errorMessage ?? '', /сетевое подключение/i);
});

test('probeApiHealth: returns connected on HTTP 200 healthy JSON', async () => {
  let tick = 1000;
  const fakeFetch: typeof fetch = async () => {
    tick += 18;
    return new Response(JSON.stringify({ status: 'healthy' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await probeApiHealth({
    fetchImpl: fakeFetch,
    now: () => tick,
  });

  assert.equal(result.status, 'connected');
  assert.equal(result.serverStatus, 'healthy');
  assert.equal(result.latencyMs, 18);
  assert.equal(result.errorMessage, null);
});

test('probeApiHealth: stays connected on HTTP 200 degraded JSON (API still serving)', async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ status: 'degraded' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

  const result = await probeApiHealth({ fetchImpl: fakeFetch });
  assert.equal(result.status, 'connected');
  assert.equal(result.serverStatus, 'degraded');
});

test('probeApiHealth: returns disconnected on HTTP 503 unhealthy', async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ status: 'unhealthy' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });

  const result = await probeApiHealth({ fetchImpl: fakeFetch });
  assert.equal(result.status, 'disconnected');
  assert.equal(result.serverStatus, 'unhealthy');
  assert.match(result.errorMessage ?? '', /503/);
});

test('probeApiHealth: returns disconnected when network request rejects', async () => {
  const fakeFetch: typeof fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  const result = await probeApiHealth({ fetchImpl: fakeFetch });
  assert.equal(result.status, 'disconnected');
  assert.equal(result.latencyMs, null);
  assert.match(result.errorMessage ?? '', /Нет связи/);
});

test('probeApiHealth: returns disconnected when request times out (AbortError)', async () => {
  const fakeFetch: typeof fetch = async (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });

  const result = await probeApiHealth({ fetchImpl: fakeFetch, timeoutMs: 15 });
  assert.equal(result.status, 'disconnected');
  assert.match(result.errorMessage ?? '', /время ожидания/i);
});

test('probeApiHealth: treats non-JSON 200 HTML fallback as disconnected', async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response('<!doctype html><html></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });

  const result = await probeApiHealth({ fetchImpl: fakeFetch });
  assert.equal(result.status, 'disconnected');
  assert.match(result.errorMessage ?? '', /Некорректный ответ/);
});
