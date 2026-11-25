import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

export type AppDatabase = PgliteDatabase<typeof schema> | NodePgDatabase<typeof schema>;

declare global {
  var _appDb: AppDatabase | undefined;
  var _pgliteClient: PGlite | undefined;
  var _pgPool: Pool | undefined;
  var _dbInitPromise: Promise<AppDatabase> | undefined;
}

const DDL_SQL = `
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
`;

export async function getDb(): Promise<AppDatabase> {
  if (global._appDb) {
    return global._appDb;
  }
  if (!global._dbInitPromise) {
    global._dbInitPromise = (async () => {
      if (process.env.POSTGRES_URL) {
        const pool = new Pool({ connectionString: process.env.POSTGRES_URL, max: 10 });
        await pool.query(DDL_SQL);
        global._pgPool = pool;
        global._appDb = drizzlePg(pool, { schema });
        return global._appDb;
      }

      const rawDir = process.env.PGDATA_DIR;
      let client: PGlite;
      if (rawDir === 'memory://') {
        client = new PGlite();
      } else {
        const dataDir = rawDir || path.resolve(process.cwd(), 'data', 'pgdata');
        fs.mkdirSync(dataDir, { recursive: true });
        client = new PGlite(dataDir);
      }
      await client.waitReady;
      await client.exec(DDL_SQL);
      global._pgliteClient = client;
      global._appDb = drizzlePglite(client, { schema });
      return global._appDb;
    })();
  }
  return global._dbInitPromise;
}

export async function closeDatabase(): Promise<void> {
  if (global._pgPool) {
    await global._pgPool.end().catch(() => {});
    global._pgPool = undefined;
  }
  if (global._pgliteClient) {
    await global._pgliteClient.close().catch(() => {});
    global._pgliteClient = undefined;
  }
  global._appDb = undefined;
  global._dbInitPromise = undefined;
}

export function getDatabaseEngineInfo() {
  return {
    engine: process.env.POSTGRES_URL ? 'PostgreSQL (External Pool)' : 'PostgreSQL 16 (Embedded PGlite in-project)',
    persistence: process.env.POSTGRES_URL ? 'TCP Pool' : process.env.PGDATA_DIR || './data/pgdata',
  };
}
