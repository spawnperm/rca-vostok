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
-- ── mvr_ platform schema (tenants, IAM, CRM, Mattermost, Office, NocoBase) ──
-- Migrated with the mvr_ code base. Without these tables every mvr_ router
-- failed on its first query.


CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subdomain TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'growth',
  status TEXT NOT NULL DEFAULT 'active',
  max_users INTEGER NOT NULL DEFAULT 50,
  max_deals INTEGER NOT NULL DEFAULT 10000,
  traefik_rule TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  data_scope TEXT NOT NULL DEFAULT 'all',
  hidden_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE roles ADD COLUMN IF NOT EXISTS data_scope TEXT NOT NULL DEFAULT 'all';
ALTER TABLE roles ADD COLUMN IF NOT EXISTS hidden_fields JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS role_permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL,
  permission TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipelines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  pipeline_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_won BOOLEAN NOT NULL DEFAULT FALSE,
  is_lost BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE companies ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT '',
  company_id TEXT,
  company_name TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  pipeline_id TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  title TEXT NOT NULL,
  budget INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RUB',
  contact_id TEXT,
  company_id TEXT,
  owner_id TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  loss_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT,
  assignee_id TEXT NOT NULL,
  task_type TEXT NOT NULL DEFAULT 'followup',
  title TEXT NOT NULL,
  due_at TIMESTAMP NOT NULL,
  reminder_at TIMESTAMP,
  reminder_notified_at TIMESTAMP,
  deadline_notified_at TIMESTAMP,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 60;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_notified_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deadline_notified_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'note',
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_profiles (
  user_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  handle TEXT NOT NULL,
  headline TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT 'Москва',
  cover_url TEXT NOT NULL,
  status_text TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  friends_count INTEGER NOT NULL DEFAULT 24,
  followers_count INTEGER NOT NULL DEFAULT 118
);

CREATE TABLE IF NOT EXISTS social_groups (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  members_count INTEGER NOT NULL DEFAULT 12,
  is_joined BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  attachment_type TEXT NOT NULL DEFAULT 'none',
  attachment_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  likes_count INTEGER NOT NULL DEFAULT 0,
  liked_by_users JSONB NOT NULL DEFAULT '[]'::jsonb,
  reposts_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_comments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugins (
  id TEXT PRIMARY KEY,
  npm_package_name TEXT NOT NULL UNIQUE,
  version TEXT NOT NULL,
  verdaccio_url TEXT NOT NULL,
  tarball_sha512 TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  author TEXT NOT NULL,
  description TEXT NOT NULL,
  slot TEXT NOT NULL,
  permissions_required JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  downloads INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_plugins (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  installed_by TEXT NOT NULL,
  installed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_blocks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  section_type TEXT NOT NULL DEFAULT 'announcement',
  body TEXT NOT NULL,
  cta_label TEXT NOT NULL DEFAULT 'Подробнее',
  published BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS harness_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  workflow_name TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'completed',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nats_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'followup',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS garage_buckets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'garage-eu-1',
  visibility TEXT NOT NULL DEFAULT 'private',
  quota_mb INTEGER NOT NULL DEFAULT 5120,
  endpoint TEXT NOT NULL DEFAULT 'http://s3.platform.local:3900',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS garage_objects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  bucket_id TEXT NOT NULL,
  bucket_name TEXT NOT NULL,
  object_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  etag TEXT NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  linked_entity_type TEXT NOT NULL DEFAULT 'office_document',
  linked_entity_id TEXT,
  created_by TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forgejo_repos (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  owner_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  clone_url TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  lfs_bucket TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  stars_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forgejo_commits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  repo_id TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  commit_sha TEXT NOT NULL,
  message TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  files_changed INTEGER NOT NULL DEFAULT 1,
  s3_object_key TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS office_documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'xlsx',
  deal_id TEXT,
  bucket_name TEXT NOT NULL,
  object_key TEXT NOT NULL,
  forgejo_repo_id TEXT,
  latest_commit_sha TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nocobase_collections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  default_view TEXT NOT NULL DEFAULT 'table',
  kanban_group_by TEXT,
  calendar_date_field TEXT,
  pinned_to_dashboard BOOLEAN NOT NULL DEFAULT FALSE,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nocobase_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  collection_key TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nocobase_workflows (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  condition JSONB,
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  n8n_definition JSONB,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  runs_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE nocobase_workflows ADD COLUMN IF NOT EXISTS n8n_definition JSONB;

CREATE TABLE IF NOT EXISTS nocobase_workflow_executions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  workflow_name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  context_summary TEXT NOT NULL DEFAULT '',
  steps_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nocobase_approvals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'general',
  entity_id TEXT,
  entity_label TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL DEFAULT 0,
  requester_id TEXT NOT NULL,
  approver_role_code TEXT NOT NULL DEFAULT 'sales_head',
  status TEXT NOT NULL DEFAULT 'pending',
  comment TEXT NOT NULL DEFAULT '',
  decision_note TEXT NOT NULL DEFAULT '',
  decided_by TEXT,
  decided_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_table_schemas (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  view_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mm_teams (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'O',
  create_at TEXT NOT NULL,
  update_at TEXT NOT NULL,
  delete_at TEXT NOT NULL DEFAULT '0'
);

CREATE TABLE IF NOT EXISTS mm_channels (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'O',
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  header TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  creator_id TEXT NOT NULL,
  total_msg_count INTEGER NOT NULL DEFAULT 0,
  total_msg_count_root INTEGER NOT NULL DEFAULT 0,
  last_post_at TEXT NOT NULL DEFAULT '0',
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  create_at TEXT NOT NULL,
  update_at TEXT NOT NULL,
  delete_at TEXT NOT NULL DEFAULT '0'
);

CREATE TABLE IF NOT EXISTS mm_channel_members (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  roles TEXT NOT NULL DEFAULT 'channel_user',
  last_viewed_at TEXT NOT NULL DEFAULT '0',
  msg_count INTEGER NOT NULL DEFAULT 0,
  msg_count_root INTEGER NOT NULL DEFAULT 0,
  mention_count INTEGER NOT NULL DEFAULT 0,
  notify_props JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_update_at TEXT NOT NULL DEFAULT '0'
);

CREATE TABLE IF NOT EXISTS mm_posts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  root_id TEXT NOT NULL DEFAULT '',
  original_id TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  hashtags TEXT NOT NULL DEFAULT '',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  reply_count INTEGER NOT NULL DEFAULT 0,
  social_post_id TEXT,
  create_at TEXT NOT NULL,
  update_at TEXT NOT NULL,
  edit_at TEXT NOT NULL DEFAULT '0',
  delete_at TEXT NOT NULL DEFAULT '0'
);

CREATE TABLE IF NOT EXISTS mm_reactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  emoji_name TEXT NOT NULL,
  create_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions (role_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_active ON users (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_deals_tenant_stage ON deals (tenant_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_tenant_owner ON deals (tenant_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_companies_tenant ON companies (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_due ON tasks (tenant_id, due_at);
CREATE INDEX IF NOT EXISTS idx_timeline_tenant_deal ON timeline_events (tenant_id, deal_id, created_at);
CREATE INDEX IF NOT EXISTS idx_social_posts_tenant_created ON social_posts (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_nats_events_tenant_created ON nats_events (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_office_docs_tenant_updated ON office_documents (tenant_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_nocobase_records_tenant_col ON nocobase_records (tenant_id, collection_key);
CREATE INDEX IF NOT EXISTS idx_mm_channels_tenant ON mm_channels (tenant_id, delete_at);
CREATE INDEX IF NOT EXISTS idx_mm_channel_members_user ON mm_channel_members (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_mm_posts_tenant_channel ON mm_posts (tenant_id, channel_id, delete_at);


-- ── this platform's own tables ──

CREATE TABLE IF NOT EXISTS rca_users (
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
CREATE UNIQUE INDEX IF NOT EXISTS rca_users_email_key ON rca_users (email);

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES rca_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions (user_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES rca_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS certification_inquiries (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES rca_users(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS rca_social_profiles (
  user_id TEXT PRIMARY KEY REFERENCES rca_users(id) ON DELETE CASCADE,
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

/**
 * Engine description.
 *
 * `persistence` is kept because the mvr_ telemetry module reads it as the
 * display endpoint (`dbInfo.persistence`), and its health panel would otherwise
 * show `undefined` where the connection target belongs.
 */
export function getDatabaseEngineInfo(): {
  engine: 'postgres' | 'pglite';
  configured: boolean;
  persistence: string;
} {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    // Never echo credentials: show only host and database.
    try {
      const parsed = new URL(url);
      return {
        engine: 'postgres',
        configured: true,
        persistence: `${parsed.hostname}${parsed.pathname}`,
      };
    } catch {
      return { engine: 'postgres', configured: true, persistence: 'postgres' };
    }
  }
  return {
    engine: 'pglite',
    configured: false,
    persistence: process.env.PGLITE_DIR || 'data/pgdata',
  };
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
