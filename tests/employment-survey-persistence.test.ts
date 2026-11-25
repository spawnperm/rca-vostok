import { it, describe, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type http from 'node:http';
import { createApp, type AppRuntime } from '../server.ts';
import { JsonFileEmploymentSurveyRepository } from '../src/infrastructure/persistence/JsonFileEmploymentSurveyRepository.ts';
import { LocalObjectStorage } from '../src/infrastructure/storage/GarageObjectStorage.ts';

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

const VALID_SURVEY_PAYLOAD = {
  respondentName: 'Алексей Орлов',
  region: 'Приморский край',
  discipline: 'Водный туризм и сплавы',
  complexityLevel: '3 КС',
  employmentStatus: 'Штатный инструктор туроператора',
  workloadRange: '76–120 дней в сезон (полный сезон)',
  tourDaysPerSeason: 85,
  groupsPerMonth: 5,
  hasActiveCertificate: true,
  reattestationUrgency: 'Срочно (срок истекает менее чем через 3 мес. или истёк)',
  preferredFormat: 'Выездная комиссия в своём субъекте ДФО',
  neededTopics: ['npa_760', 'field_rescue'],
  needsEmployerSubsidy: true,
  comment: 'Готов к выездной комиссии во Владивостоке',
};

describe('Employment Survey Repository, Object Storage Archiving & HTTP API', () => {
  let tmpDir: string;
  let runtime: AppRuntime;
  let server: http.Server;
  let baseUrl: string;
  let prevDatabaseUrl: string | undefined;
  let prevS3Endpoint: string | undefined;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rca-emp-survey-test-'));
    prevDatabaseUrl = process.env.DATABASE_URL;
    prevS3Endpoint = process.env.S3_ENDPOINT;
    delete process.env.DATABASE_URL;
    delete process.env.S3_ENDPOINT;

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
    if (prevS3Endpoint !== undefined) process.env.S3_ENDPOINT = prevS3Endpoint;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('validates, stores, updates archiveKey and deletes records in JsonFileEmploymentSurveyRepository', async () => {
    const repoDir = path.join(tmpDir, 'unit-repo');
    const repo = new JsonFileEmploymentSurveyRepository(repoDir);

    await assert.rejects(
      () =>
        repo.submit({
          ...VALID_SURVEY_PAYLOAD,
          region: 'Несуществующий регион',
        }),
      /субъект ДФО/
    );

    await assert.rejects(
      () =>
        repo.submit({
          ...VALID_SURVEY_PAYLOAD,
          neededTopics: [],
        }),
      /модуль подготовки/
    );

    const { record, summary } = await repo.submit(VALID_SURVEY_PAYLOAD, {
      ownerUserId: 'user-1',
    });
    assert.ok(record.id.startsWith('EMP-'));
    assert.equal(record.priorityLevel, 'high');
    assert.equal(summary.totalResponses, 1);
    assert.equal(summary.urgentReattestationCount, 1);

    await repo.updateArchiveKey(record.id, `surveys/entries/${record.id}.json`);
    const reloaded = await repo.findById(record.id);
    assert.equal(reloaded?.archiveObjectKey, `surveys/entries/${record.id}.json`);

    assert.equal(await repo.deleteById(record.id), true);
    assert.equal(await repo.findById(record.id), null);
    assert.equal((await repo.getSummary()).totalResponses, 0);
  });

  it('checks LocalObjectStorage health and put/get/delete behavior', async () => {
    const bucketDir = path.join(tmpDir, 'unit-bucket');
    const storage = new LocalObjectStorage(bucketDir);
    assert.equal(await storage.checkHealth(), true);

    await storage.put('surveys/test.json', Buffer.from('{"ok":true}', 'utf-8'), 'application/json', {
      cacheControl: 'no-store',
    });
    const obj = await storage.get('surveys/test.json');
    assert.ok(obj);
    assert.equal(obj.body.toString('utf-8'), '{"ok":true}');

    await storage.delete('surveys/test.json');
    assert.equal(await storage.get('surveys/test.json'), null);
  });

  it('persists surveys via HTTP, archives snapshot to object storage, and enforces owner/moderator DELETE RBAC', async () => {
    // 1. Health reports storage provider metadata
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const health = (await healthRes.json()) as {
      persistence: { adapter: string; storageProvider?: string };
      dependencies: { objectStorage?: { ok: boolean } };
    };
    assert.equal(health.persistence.storageProvider, 'local-disk');
    assert.equal(health.dependencies.objectStorage?.ok, true);

    // 2. OpenAPI documents new employment-survey routes
    const specRes = await fetch(`${baseUrl}/api/openapi.json`);
    assert.equal(specRes.status, 200);
    const spec = (await specRes.json()) as { paths: Record<string, unknown> };
    assert.ok('/api/employment-survey' in spec.paths);
    assert.ok('/api/employment-survey/archive' in spec.paths);
    assert.ok('/api/employment-survey/{id}' in spec.paths);

    // 3. Initial GET is empty
    const initRes = await fetch(`${baseUrl}/api/employment-survey`);
    assert.equal(initRes.status, 200);
    const initJson = (await initRes.json()) as {
      summary: { totalResponses: number };
      responses: unknown[];
      storageProvider: string;
    };
    assert.equal(initJson.summary.totalResponses, 0);
    assert.equal(initJson.responses.length, 0);
    assert.equal(initJson.storageProvider, 'local-disk');

    // 4. Register candidate A (first user -> also tests candidate vs non-owner) and candidate B
    const regARes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.20.0.1' },
      body: JSON.stringify({
        email: 'owner@rca-emp.ru',
        password: 'OwnerPass2026!',
        fullName: 'Орлов Алексей',
        region: 'Приморский край',
      }),
    });
    assert.equal(regARes.status, 201);
    const cookieA = extractCookie(getSetCookies(regARes), 'rca_session');

    const regBRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.20.0.2' },
      body: JSON.stringify({
        email: 'other@rca-emp.ru',
        password: 'OtherPass2026!',
        fullName: 'Петров Сергей',
        region: 'Камчатский край',
      }),
    });
    assert.equal(regBRes.status, 201);
    const cookieB = extractCookie(getSetCookies(regBRes), 'rca_session');

    // 5. Submit survey as candidate A -> persisted and archived to object storage
    const submitRes = await fetch(`${baseUrl}/api/employment-survey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'X-Requested-With': 'fetch',
      },
      body: JSON.stringify(VALID_SURVEY_PAYLOAD),
    });
    assert.equal(submitRes.status, 201);
    const submitJson = (await submitRes.json()) as {
      ok: boolean;
      entry: { id: string; archiveObjectKey: string; canDelete: boolean };
      summary: { totalResponses: number; urgentReattestationCount: number };
      archiveKey: string;
    };
    assert.equal(submitJson.ok, true);
    assert.equal(submitJson.entry.canDelete, true);
    assert.equal(submitJson.summary.totalResponses, 1);
    assert.equal(submitJson.summary.urgentReattestationCount, 1);
    assert.ok(submitJson.archiveKey.includes(submitJson.entry.id));

    // Verify per-entry object exists in LocalObjectStorage media-objects directory
    const entryFilePath = path.join(
      tmpDir,
      'media-objects',
      ...submitJson.archiveKey.split('/')
    );
    const entryRaw = await fs.readFile(entryFilePath, 'utf-8');
    assert.match(entryRaw, /Алексей Орлов/);

    // 6. Download archived consolidated snapshot from /api/employment-survey/archive
    const archiveRes = await fetch(`${baseUrl}/api/employment-survey/archive`);
    assert.equal(archiveRes.status, 200);
    assert.match(archiveRes.headers.get('content-disposition') ?? '', /rca-employment-reattestation-snapshot\.json/);
    const archiveJson = (await archiveRes.json()) as {
      summary: { totalResponses: number };
      responses: Array<{ id: string }>;
    };
    assert.equal(archiveJson.summary.totalResponses, 1);
    assert.equal(archiveJson.responses[0].id, submitJson.entry.id);

    // 7. DELETE RBAC checks: unauthenticated -> 401, non-owner B -> 403, owner A -> 200
    const unauthDelete = await fetch(`${baseUrl}/api/employment-survey/${submitJson.entry.id}`, {
      method: 'DELETE',
    });
    assert.equal(unauthDelete.status, 401);

    const forbiddenDelete = await fetch(`${baseUrl}/api/employment-survey/${submitJson.entry.id}`, {
      method: 'DELETE',
      headers: {
        Cookie: cookieB,
        'X-Requested-With': 'fetch',
      },
    });
    assert.equal(forbiddenDelete.status, 403);

    const ownerDelete = await fetch(`${baseUrl}/api/employment-survey/${submitJson.entry.id}`, {
      method: 'DELETE',
      headers: {
        Cookie: cookieA,
        'X-Requested-With': 'fetch',
      },
    });
    assert.equal(ownerDelete.status, 200);
    const deleteJson = (await ownerDelete.json()) as {
      ok: boolean;
      summary: { totalResponses: number };
    };
    assert.equal(deleteJson.ok, true);
    assert.equal(deleteJson.summary.totalResponses, 0);
  });
});
