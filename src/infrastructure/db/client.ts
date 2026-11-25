import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

/**
 * Database access, adopted from the mvr_ skeleton.
 *
 * Two engines behind one interface:
 *   - PostgreSQL through pg.Pool when DATABASE_URL is set (production)
 *   - PGlite (embedded, file-backed) otherwise, so tests and local runs need no
 *     external service
 *
 * The DDL below is the schema this platform actually uses. The mvr_ skeleton
 * shipped its own multi-tenant CRM tables; those are gone because this project's
 * domain does not have tenants, pipelines or deals.
 */

export type AppDatabase = PgliteDatabase<typeof schema> | NodePgDatabase<typeof schema>;

declare global {
  var _appDb: AppDatabase | undefined;
  var _pgliteClient: PGlite | undefined;
  var _pgPool: Pool | undefined;
  var _dbInitPromise: Promise<AppDatabase> | undefined;
}

/**
 * Schema for the eight bounded contexts.
 *
 * Kept as idempotent DDL rather than drizzle-kit migrations because the
 * existing database was created that way and already holds production rows:
 * switching to generated migrations would require a baseline dump, and doing
 * that silently during a deploy is how data gets lost. Every statement is
 * `IF NOT EXISTS`, so running it against the current database is a no-op.
 */
const DDL_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  region TEXT,
  role TEXT NOT NULL DEFAULT 'candidate',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (email);

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions (user_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS certification_inquiries (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  region TEXT,
  track TEXT,
  experience TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  consent_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS inquiries_user_idx ON certification_inquiries (user_id);

CREATE TABLE IF NOT EXISTS platform_feedback (
  id TEXT PRIMARY KEY,
  sender_name TEXT NOT NULL,
  email TEXT,
  feedback_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  rating INTEGER,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_sessions (
  session_id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_key TEXT NOT NULL,
  type TEXT NOT NULL,
  tab TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS analytics_events_natural_key
  ON analytics_events (session_id, event_key);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'update',
  title TEXT,
  body TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS post_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  headline TEXT,
  bio TEXT,
  region TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_channels (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  root_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS chat_reactions (
  message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS media_albums (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  title TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public',
  cover_asset_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  album_id TEXT REFERENCES media_albums(id) ON DELETE SET NULL,
  owner_id TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  title TEXT NOT NULL,
  object_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS experience_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  region TEXT,
  route_name TEXT,
  distance_km NUMERIC,
  started_on DATE,
  journal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lms_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  module_id TEXT,
  status TEXT NOT NULL DEFAULT 'not_started',
  score INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export function getDatabaseEngineInfo(): { engine: 'postgres' | 'pglite'; configured: boolean } {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return { engine: 'postgres', configured: true };
  return { engine: 'pglite', configured: false };
}

/** Applies the DDL. Safe to run repeatedly; every statement is idempotent. */
export async function runDdl(_db: AppDatabase): Promise<void> {
  // Execute through the raw driver rather than the Drizzle query builder: the
  // DDL is a multi-statement script, which drizzle's exec does not accept on
  // every adapter. Both globals are set by getDb() before this runs.
  if (globalThis._pgliteClient) {
    await globalThis._pgliteClient.exec(DDL_SQL);
    return;
  }
  if (globalThis._pgPool) {
    await globalThis._pgPool.query(DDL_SQL);
    return;
  }
  throw new Error('runDdl called before the database was initialised');
}

export async function getDb(): Promise<AppDatabase> {
  if (globalThis._appDb) return globalThis._appDb;
  if (globalThis._dbInitPromise) return globalThis._dbInitPromise;

  globalThis._dbInitPromise = (async () => {
    // Postgres configuration is owned by the persistence layer
    // (PostgresPool.createPool), which also understands PGHOST/PGDATABASE and
    // applies pool error handling. Reusing that decision here instead of
    // re-reading DATABASE_URL keeps a single source of truth — two independent
    // "is a database configured?" checks are how a service ends up half on
    // Postgres and half on an embedded engine.
    const { createPool } = await import('../persistence/pg/PostgresPool.ts');
    const sharedPool = createPool();

    if (sharedPool) {
      globalThis._pgPool = sharedPool as unknown as Pool;
      const db = drizzlePg(globalThis._pgPool, { schema });
      globalThis._appDb = db;
      return db;
    }

    // Embedded fallback: a directory-backed database, so a restart keeps data.
    const dataDir = process.env.PGLITE_DIR || path.resolve(process.cwd(), 'data/pgdata');
    fs.mkdirSync(dataDir, { recursive: true });
    const client = new PGlite(dataDir);
    globalThis._pgliteClient = client;
    const db = drizzlePglite(client, { schema });
    globalThis._appDb = db;
    return db;
  })();

  try {
    const db = await globalThis._dbInitPromise;
    // DDL runs after the engine is up, once per process.
    if (!globalThis.__ddlDone) {
      await runDdl(db);
      globalThis.__ddlDone = true;
    }
    return db;
  } catch (err) {
    globalThis._dbInitPromise = undefined;
    throw err;
  }
}

declare global {
  var __ddlDone: boolean | undefined;
}

export async function closeDatabase(): Promise<void> {
  if (globalThis._pgliteClient) {
    await globalThis._pgliteClient.close();
    globalThis._pgliteClient = undefined;
  }
  if (globalThis._pgPool) {
    await globalThis._pgPool.end();
    globalThis._pgPool = undefined;
  }
  globalThis._appDb = undefined;
  globalThis._dbInitPromise = undefined;
  globalThis.__ddlDone = undefined;
}
