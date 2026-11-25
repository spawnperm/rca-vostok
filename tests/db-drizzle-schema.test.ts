import { test, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The DDL in client.ts and the Drizzle schema in schema.ts describe the same
// tables. A mismatch between them is silent: Drizzle would build queries for
// columns the database does not have. This suite applies the DDL to a real
// PGlite instance and checks the result.

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-db-'));
process.env.PGLITE_DIR = tmpDir;
delete process.env.DATABASE_URL;

const { getDb, getDatabaseEngineInfo, closeDatabase } = await import(
  '../src/infrastructure/db/client.ts'
);

afterAll(async () => {
  await closeDatabase();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('engine selection: PGlite when DATABASE_URL is absent', () => {
  const info = getDatabaseEngineInfo();
  expect(info.engine).toBe('pglite');
  expect(info.configured).toBe(false);
});

test('engine selection: postgres when DATABASE_URL is set', () => {
  const prev = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
  const info = getDatabaseEngineInfo();
  expect(info.engine).toBe('postgres');
  expect(info.configured).toBe(true);
  if (prev === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = prev;
});

test('DDL creates every table the Drizzle schema declares', async () => {
  const db = await getDb();
  expect(db).toBeTruthy();

  const expected = [
    'users',
    'user_sessions',
    'password_reset_tokens',
    'certification_inquiries',
    'platform_feedback',
    'analytics_sessions',
    'analytics_events',
    'posts',
    'post_comments',
    'social_profiles',
    'chat_channels',
    'chat_messages',
    'chat_reactions',
    'media_albums',
    'media_assets',
    'experience_entries',
    'lms_progress',
    'schema_migrations',
  ];

  const res = await (globalThis as { _pgliteClient?: { query(sql: string): Promise<{ rows: unknown[] }> } })
    ._pgliteClient!.query(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1`
    );
  const tables = (res.rows as { tablename: string }[]).map((r) => r.tablename);

  for (const t of expected) {
    expect(tables, `missing table ${t}`).toContain(t);
  }
});

test('the natural-key index on analytics events exists (dedupe guard)', async () => {
  const res = await (globalThis as { _pgliteClient?: { query(sql: string): Promise<{ rows: unknown[] }> } })
    ._pgliteClient!.query(
      `SELECT indexname FROM pg_indexes WHERE tablename='analytics_events'`
    );
  const names = (res.rows as { indexname: string }[]).map((r) => r.indexname);
  expect(names).toContain('analytics_events_natural_key');
});

test('inquiries.user_id references users (owner linkage survives)', async () => {
  const res = await (globalThis as { _pgliteClient?: { query(sql: string): Promise<{ rows: unknown[] }> } })
    ._pgliteClient!.query(
      `SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name='certification_inquiries' AND constraint_type='FOREIGN KEY'`
    );
  expect((res.rows as unknown[]).length).toBeGreaterThan(0);
});

test('DDL is idempotent: applying it twice does not throw', async () => {
  await getDb();
  const { runDdl } = await import('../src/infrastructure/db/client.ts');
  await expect(runDdl(await getDb())).resolves.not.toThrow();
});
