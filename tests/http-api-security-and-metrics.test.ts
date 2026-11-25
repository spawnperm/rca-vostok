import { it, describe, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type http from 'node:http';
import { createApp, type AppRuntime } from '../server.ts';
import { MetricsCollector } from '../src/infrastructure/http/Metrics.ts';
import { RateLimiter } from '../src/infrastructure/http/RateLimiter.ts';

function extractCookie(setCookieHeaders: string[], name: string): string {
  for (const raw of setCookieHeaders) {
    const pair = raw.split(';')[0]?.trim();
    if (pair && pair.startsWith(`${name}=`)) {
      return pair;
    }
  }
  return '';
}

function getSetCookies(res: Response): string[] {
  const headersAny = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headersAny.getSetCookie === 'function') {
    return headersAny.getSetCookie();
  }
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

describe('HTTP API, Security Hardening, OpenAPI & Metrics', () => {
  let tmpDir: string;
  let runtime: AppRuntime;
  let server: http.Server;
  let baseUrl: string;
  let prevDatabaseUrl: string | undefined;
  let prevAdminSetupKey: string | undefined;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rca-http-test-'));
    prevDatabaseUrl = process.env.DATABASE_URL;
    prevAdminSetupKey = process.env.RCA_ADMIN_SETUP_KEY;
    delete process.env.DATABASE_URL;
    delete process.env.RCA_ADMIN_SETUP_KEY;

    runtime = await createApp({
      dataDir: tmpDir,
      isProd: false,
      registerVite: false,
      startHousekeeping: false,
    });

    await new Promise<void>((resolve) => {
      server = runtime.app.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    assert.ok(addr && typeof addr === 'object');
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await runtime.close();
    if (prevDatabaseUrl !== undefined) process.env.DATABASE_URL = prevDatabaseUrl;
    if (prevAdminSetupKey !== undefined) process.env.RCA_ADMIN_SETUP_KEY = prevAdminSetupKey;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('serves liveness, readiness, robots.txt, sitemap.xml and complete OpenAPI 3.1 contract', async () => {
    const [healthRes, liveRes, readyRes, robotsRes, sitemapRes, openapiRes] = await Promise.all([
      fetch(`${baseUrl}/api/health`),
      fetch(`${baseUrl}/api/health/live`),
      fetch(`${baseUrl}/api/health/ready`),
      fetch(`${baseUrl}/robots.txt`),
      fetch(`${baseUrl}/sitemap.xml`),
      fetch(`${baseUrl}/api/openapi.json`),
    ]);

    assert.equal(healthRes.status, 200);
    assert.equal(liveRes.status, 200);
    assert.equal(readyRes.status, 200);

    const liveBody = (await liveRes.json()) as { status: string; uptimeSec: number };
    assert.equal(liveBody.status, 'alive');

    const readyBody = (await readyRes.json()) as { status: string };
    assert.ok(readyBody.status === 'ready' || readyBody.status === 'healthy');

    assert.equal(robotsRes.status, 200);
    const robotsTxt = await robotsRes.text();
    assert.match(robotsTxt, /Sitemap: .+\/sitemap\.xml/);

    assert.equal(sitemapRes.status, 200);
    const sitemapXml = await sitemapRes.text();
    assert.match(sitemapXml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);

    assert.equal(openapiRes.status, 200);
    const spec = (await openapiRes.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    assert.equal(spec.openapi, '3.1.0');
    assert.ok('/api/health/live' in spec.paths);
    assert.ok('/api/health/ready' in spec.paths);
    assert.ok('/api/metrics' in spec.paths);
    assert.ok('/api/account/leaderboard-sync' in spec.paths);
    assert.ok('/api/weather/hubs' in spec.paths);
    assert.ok('/media/{assetId}' in spec.paths);
  });

  it('applies strict security headers, request IDs, JSON 404 for unknown API paths and 400 on malformed JSON', async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(res.status, 404);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.ok(res.headers.get('x-request-id'));
    const csp = res.headers.get('content-security-policy') ?? '';
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /base-uri 'none'/);
    assert.match(csp, /https:\/\/maps\.googleapis\.com/);
    const notFoundJson = (await res.json()) as { code?: string };
    assert.equal(notFoundJson.code, 'NOT_FOUND');

    const badJsonRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":',
    });
    assert.equal(badJsonRes.status, 400);
    const badJsonBody = (await badJsonRes.json()) as { code?: string };
    assert.equal(badJsonBody.code, 'INVALID_JSON');
  });

  it('keeps updating latency percentiles past 500 samples and exports Prometheus metrics', async () => {
    const collector = new MetricsCollector();
    for (let i = 0; i < 500; i += 1) {
      collector.record('GET', '/api/health', 200, 10);
    }
    for (let i = 0; i < 500; i += 1) {
      collector.record('GET', '/api/health', 200, 120);
    }
    const snap = collector.snapshot();
    assert.equal(snap.requests.total, 1000);
    assert.equal(snap.latency.p50, 120);
    assert.equal(snap.latency.p95, 120);
    assert.equal(snap.latency.max, 120);

    const promRes = await fetch(`${baseUrl}/api/metrics?format=prometheus`);
    assert.equal(promRes.status, 200);
    assert.match(promRes.headers.get('content-type') ?? '', /text\/plain/);
    const promText = await promRes.text();
    assert.match(promText, /# TYPE rca_http_requests_total counter/);
    assert.match(promText, /rca_http_latency_ms\{quantile="0\.95"\}/);
  });

  it('bounds RateLimiter bucket memory under churn', () => {
    const limiter = new RateLimiter([{ name: 'test', windowMs: 60_000, max: 3 }], 5);
    for (let i = 0; i < 20; i += 1) {
      const outcome = limiter.hit('test', `ip-${i}`);
      assert.equal(outcome.allowed, true);
    }
    assert.equal(limiter.size(), 5);
  });

  it('protects DELETE /api/analytics/reset via RBAC and blocks cross-origin cookie mutations via CSRF', async () => {
    // 1. Unauthenticated caller receives 401
    const unauthRes = await fetch(`${baseUrl}/api/analytics/reset`, {
      method: 'DELETE',
    });
    assert.equal(unauthRes.status, 401);

    // 2. Register a candidate user (gets rca_session cookie)
    const regCandidateRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.10.0.1',
      },
      body: JSON.stringify({
        email: 'candidate@rca-test.ru',
        password: 'CandidatePass2026',
        fullName: 'Петров Иван',
        region: 'Приморский край',
      }),
    });
    assert.equal(regCandidateRes.status, 201);
    const candidateCookie = extractCookie(getSetCookies(regCandidateRes), 'rca_session');
    assert.ok(candidateCookie.startsWith('rca_session='));

    // 3. Cross-origin cookie mutation without X-Requested-With is blocked by CSRF middleware (403)
    const csrfBlockedRes = await fetch(`${baseUrl}/api/account/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: candidateCookie,
        Origin: 'https://evil.example',
      },
      body: JSON.stringify({ fullName: 'Подмена' }),
    });
    assert.equal(csrfBlockedRes.status, 403);
    const csrfJson = (await csrfBlockedRes.json()) as { code?: string };
    assert.equal(csrfJson.code, 'CSRF_ORIGIN_MISMATCH');

    // 4. Same-origin / X-Requested-With cookie mutation passes CSRF
    const sameOriginRes = await fetch(`${baseUrl}/api/account/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: candidateCookie,
        'X-Requested-With': 'fetch',
      },
      body: JSON.stringify({ fullName: 'Петров Иван Сергеевич' }),
    });
    assert.equal(sameOriginRes.status, 200);

    // 5. Candidate lacks analytics:view -> DELETE /api/analytics/reset returns 403
    const forbiddenReset = await fetch(`${baseUrl}/api/analytics/reset`, {
      method: 'DELETE',
      headers: {
        Cookie: candidateCookie,
        'X-Requested-With': 'fetch',
      },
    });
    assert.equal(forbiddenReset.status, 403);

    // 6. Claim admin bootstrap and verify authorized DELETE /api/analytics/reset succeeds (200)
    const claimRes = await fetch(`${baseUrl}/api/account/claim-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: candidateCookie,
        'X-Requested-With': 'fetch',
      },
      body: JSON.stringify({}),
    });
    assert.equal(claimRes.status, 200);

    const allowedReset = await fetch(`${baseUrl}/api/analytics/reset`, {
      method: 'DELETE',
      headers: {
        Cookie: candidateCookie,
        'X-Requested-With': 'fetch',
      },
    });
    assert.equal(allowedReset.status, 200);
    const resetBody = (await allowedReset.json()) as { ok: boolean };
    assert.equal(resetBody.ok, true);
  });

  it('never emits wildcard postMessage origin in OAuth callback HTML', async () => {
    const res = await fetch(`${baseUrl}/api/account/oauth/google/callback?error=access_denied`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.doesNotMatch(html, /postMessage\([^,]+,\s*['"]\*['"]\)/);
    assert.match(html, /window\.opener\.postMessage\(data,\s*targetOrigin\)/);
    assert.match(html, /<script nonce="/);
  });

  it('throttles repeated registration bursts per IP with 429 and Retry-After', async () => {
    let lastRes: Response | null = null;
    for (let i = 0; i < 11; i += 1) {
      lastRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '198.51.100.77',
        },
        body: JSON.stringify({
          email: `burst-${i}@rca-test.ru`,
          password: 'BurstUserPass2026',
          fullName: 'Тестовый Кандидат',
          region: 'Приморский край',
        }),
      });
    }
    assert.ok(lastRes);
    assert.equal(lastRes.status, 429);
    assert.ok(lastRes.headers.get('retry-after'));
  });
});
