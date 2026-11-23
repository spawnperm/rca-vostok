import pg from 'pg';
import { appLogger } from '../../logging/Logger.ts';
import { INITIAL_DFO_CERTIFIED_GUIDES } from '../../../domain/certification/GuideLeaderboard.ts';

const { Pool } = pg;
const pgLog = appLogger.child('pg');
const migrationLog = appLogger.child('migrations');

export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  maxConnections?: number;
}

/**
 * Builds a shared connection pool from discrete PG* environment variables or
 * a single DATABASE_URL. Returns null when no database is configured, which
 * lets the composition root fall back to the file-backed adapters.
 */
export function createPool(config: DatabaseConfig = {}): pg.Pool | null {
  const connectionString = config.connectionString ?? process.env.DATABASE_URL;
  const host = config.host ?? process.env.PGHOST;
  const hasDiscrete = Boolean(host && process.env.PGDATABASE);

  if (!connectionString && !hasDiscrete) {
    return null;
  }

  const pool = connectionString
    ? new Pool({ connectionString, max: config.maxConnections ?? 10 })
    : new Pool({
        host,
        port: config.port ?? Number(process.env.PGPORT ?? 5432),
        database: config.database ?? process.env.PGDATABASE,
        user: config.user ?? process.env.PGUSER,
        password: config.password ?? process.env.PGPASSWORD,
        max: config.maxConnections ?? 10,
      });

  pool.on('error', (err) => {
    pgLog.error('PostgreSQL idle client error', err);
  });

  return pool;
}

/**
 * Minimal forward-only migration runner. Statements are idempotent so the
 * server can safely configure schema at boot.
 */
/**
 * Applied migration steps, in order. Each name is recorded in
 * `schema_migrations` after its step succeeds, so the schema of any deployment
 * can be inspected with a single query and a new step is never re-run.
 *
 * The individual steps remain idempotent (`CREATE TABLE IF NOT EXISTS`), which
 * also protects the case where a step succeeds but recording its version fails.
 */
const MIGRATION_STEPS: { version: string; run: (pool: pg.Pool) => Promise<void> }[] = [
  { version: '001_analytics_and_content', run: (p) => migrateAnalyticsAndContent(p) },
  { version: '002_identity', run: (p) => migrateIdentity(p) },
  { version: '003_social', run: (p) => migrateSocial(p) },
  { version: '004_chat', run: (p) => migrateChat(p) },
  { version: '005_media', run: (p) => migrateMedia(p) },
  { version: '006_guide_leaderboard', run: (p) => migrateGuideLeaderboard(p) },
  { version: '007_linked_accounts', run: (p) => migrateLinkedAccounts(p) },
];

/**
 * Number of migration steps this build knows about.
 *
 * Exported so the health endpoint can tell whether a running container has
 * applied the schema its code expects — a mismatch is a deployment problem that
 * otherwise surfaces only as a runtime query failure.
 */
export const MIGRATION_STEP_COUNT = MIGRATION_STEPS.length;

/**
 * Runs every pending migration step and records its version.
 *
 * Pending work happens under a PostgreSQL advisory lock so two containers
 * starting at once cannot apply the same step twice. Each step is its own
 * transaction: a failure rolls that step back and stops the run rather than
 * leaving a half-applied schema.
 */
export async function runMigrations(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const client = await pool.connect();
  try {
    // Arbitrary constant identifying this application's migration lock.
    await client.query('SELECT pg_advisory_lock(730485921)');
    try {
      const applied = await client.query<{ version: string }>(
        'SELECT version FROM schema_migrations'
      );
      const done = new Set(applied.rows.map((r) => r.version));

      for (const step of MIGRATION_STEPS) {
        if (done.has(step.version)) continue;

        await client.query('BEGIN');
        try {
          await step.run(client as unknown as pg.Pool);
          await client.query(
            'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING',
            [step.version]
          );
          await client.query('COMMIT');
          migrationLog.info('Applied database migration', { version: step.version });
        } catch (err) {
          await client.query('ROLLBACK');
          throw new Error(
            `migration ${step.version} failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock(730485921)');
    }
  } finally {
    client.release();
  }
}

/** Reports which migrations a database has, for diagnostics. */
export async function readAppliedMigrations(pool: pg.Pool): Promise<string[]> {
  try {
    const res = await pool.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    return res.rows.map((r) => r.version);
  } catch {
    return [];
  }
}

/** Analytics, inquiries and feedback — the original tables. */
async function migrateAnalyticsAndContent(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS analytics_sessions (
      session_id       TEXT PRIMARY KEY,
      visitor_id       TEXT NOT NULL,
      started_at       TIMESTAMPTZ NOT NULL,
      last_seen_at     TIMESTAMPTZ NOT NULL,
      device_type      TEXT NOT NULL,
      browser          TEXT NOT NULL,
      viewport         TEXT NOT NULL,
      referrer         TEXT NOT NULL,
      utm_source       TEXT NOT NULL DEFAULT '',
      landing_tab      TEXT NOT NULL,
      tabs_visited     TEXT[] NOT NULL DEFAULT '{}',
      max_scroll_depth INTEGER NOT NULL DEFAULT 0,
      duration_sec     INTEGER NOT NULL DEFAULT 0,
      event_count      INTEGER NOT NULL DEFAULT 0,
      click_count      INTEGER NOT NULL DEFAULT 0
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS analytics_sessions_last_seen_idx
      ON analytics_sessions (last_seen_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id           BIGSERIAL PRIMARY KEY,
      event_key    TEXT NOT NULL,
      session_id   TEXT NOT NULL REFERENCES analytics_sessions(session_id) ON DELETE CASCADE,
      type         TEXT NOT NULL,
      tab          TEXT NOT NULL,
      occurred_at  TIMESTAMPTZ NOT NULL,
      elapsed_ms   INTEGER NOT NULL DEFAULT 0,
      label        TEXT,
      target_tag   TEXT,
      x_pct        DOUBLE PRECISION,
      y_pct        DOUBLE PRECISION,
      scroll_depth DOUBLE PRECISION,
      detail       TEXT
    );
  `);

  // The domain rewrites the whole bounded window on every saveStore call, so
  // inserts must be idempotent. A natural key is required for that: without a
  // unique constraint `ON CONFLICT DO NOTHING` silently does nothing and each
  // save duplicates the entire window.
  //
  // Repair before indexing: pre-existing duplicates make the unique index
  // impossible to create. The dedupe is a single ordered pass over a window
  // function — a self-join (`DELETE ... USING analytics_events b`) degenerates
  // into an O(n^2) scan without an index and hung production for 10+ minutes.
  // Only run when the index is missing, so a healthy DB skips it entirely.
  const hasNaturalKey = await pool.query<{ exists: boolean }>(
    `SELECT to_regclass('analytics_events_natural_key') IS NOT NULL AS exists`
  );

  if (!hasNaturalKey.rows[0]?.exists) {
    await pool.query(`
      DELETE FROM analytics_events
       WHERE id IN (
         SELECT id FROM (
           SELECT id,
                  ROW_NUMBER() OVER (
                    PARTITION BY session_id, event_key ORDER BY id
                  ) AS rn
             FROM analytics_events
         ) ranked
         WHERE rn > 1
       );
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS analytics_events_natural_key
        ON analytics_events (session_id, event_key);
    `);
  }

  await pool.query(`
    CREATE INDEX IF NOT EXISTS analytics_events_session_idx
      ON analytics_events (session_id, id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS certification_inquiries (
      id               TEXT PRIMARY KEY,
      full_name        TEXT NOT NULL,
      email            TEXT NOT NULL,
      contact_channel  TEXT NOT NULL DEFAULT '',
      region           TEXT NOT NULL,
      track            TEXT NOT NULL,
      experience_note  TEXT NOT NULL DEFAULT '',
      consent_accepted BOOLEAN NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_feedback (
      id              TEXT PRIMARY KEY,
      sender_name     TEXT NOT NULL,
      email           TEXT NOT NULL DEFAULT '',
      feedback_type   TEXT NOT NULL,
      platform_module TEXT NOT NULL,
      subject         TEXT NOT NULL,
      message         TEXT NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS platform_feedback_created_idx
      ON platform_feedback (created_at DESC);
  `);

}

/** Accounts, sessions and password-reset tokens. */
async function migrateIdentity(pool: pg.Pool): Promise<void> {
  // Accounts for the personal cabinet. Email is the login key, so it carries a
  // unique constraint; the role drives all RBAC decisions.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id             TEXT PRIMARY KEY,
      email          TEXT NOT NULL,
      full_name      TEXT NOT NULL,
      region         TEXT NOT NULL DEFAULT '',
      organisation   TEXT NOT NULL DEFAULT '',
      role           TEXT NOT NULL DEFAULT 'candidate',
      password_hash  TEXT NOT NULL,
      password_salt  TEXT NOT NULL,
      is_active      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at     TIMESTAMPTZ NOT NULL,
      last_login_at  TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (email);
  `);

  // The role is constrained at the storage layer as a second line of defence:
  // an unexpected value would otherwise be silently coerced by parseRole.
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_role_check
          CHECK (role IN ('candidate', 'instructor', 'curator', 'admin'));
      END IF;
    END $$;
  `);

  // Only the SHA-256 hash of a session token is stored.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      token_hash  TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL,
      expires_at  TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions (user_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS user_sessions_expires_idx ON user_sessions (expires_at);
  `);

  // Password-reset tokens: only the SHA-256 hash is stored, single use,
  // fifteen-minute lifetime (enforced in the domain, indexed here).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash  TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL,
      expires_at  TIMESTAMPTZ NOT NULL,
      used_at     TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
      ON password_reset_tokens (user_id);
  `);

  // Link inquiries to the account that submitted them, so the cabinet can show
  // "my applications". Nullable: requests created before this migration, and
  // anonymous submissions, have no owner.
  await pool.query(`
    ALTER TABLE certification_inquiries ADD COLUMN IF NOT EXISTS user_id TEXT;
  `);

  // Review lifecycle and calendar session booking fields.
  await pool.query(`
    ALTER TABLE certification_inquiries
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';
  `);

  await pool.query(`
    ALTER TABLE certification_inquiries
      ADD COLUMN IF NOT EXISTS session_date TEXT;
  `);

  await pool.query(`
    ALTER TABLE certification_inquiries
      ADD COLUMN IF NOT EXISTS status_comment TEXT NOT NULL DEFAULT '';
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'certification_inquiries_status_check'
      ) THEN
        ALTER TABLE certification_inquiries
          DROP CONSTRAINT certification_inquiries_status_check;
      END IF;
      ALTER TABLE certification_inquiries
        ADD CONSTRAINT certification_inquiries_status_check
        CHECK (status IN ('new', 'in_review', 'needs_documents', 'approved', 'rejected'));
    END $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'certification_inquiries_user_fk'
      ) THEN
        ALTER TABLE certification_inquiries
          ADD CONSTRAINT certification_inquiries_user_fk
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS certification_inquiries_user_idx
      ON certification_inquiries (user_id, created_at DESC);
  `);

  await migrateSocial(pool);
  await migrateChat(pool);
  await migrateMedia(pool);
}

/**
 * Social graph, feed and blog.
 *
 * Counters (like_count, comment_count) are denormalised on `posts` because the
 * feed renders them for every card; the authoritative rows stay in the join
 * tables and are recomputed on each mutation.
 */
async function migrateSocial(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_profiles (
      user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      display_name    TEXT NOT NULL,
      headline        TEXT NOT NULL DEFAULT '',
      bio             TEXT NOT NULL DEFAULT '',
      region          TEXT NOT NULL DEFAULT '',
      organisation    TEXT NOT NULL DEFAULT '',
      role            TEXT NOT NULL DEFAULT 'candidate',
      website_url     TEXT NOT NULL DEFAULT '',
      cover_asset_id  TEXT,
      avatar_asset_id TEXT,
      skills          TEXT[] NOT NULL DEFAULT '{}',
      created_at      TIMESTAMPTZ NOT NULL,
      updated_at      TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id              TEXT PRIMARY KEY,
      author_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author_name     TEXT NOT NULL,
      kind            TEXT NOT NULL DEFAULT 'update',
      title           TEXT NOT NULL DEFAULT '',
      body            TEXT NOT NULL,
      excerpt         TEXT NOT NULL DEFAULT '',
      cover_asset_id  TEXT,
      tags            TEXT[] NOT NULL DEFAULT '{}',
      visibility      TEXT NOT NULL DEFAULT 'community',
      status          TEXT NOT NULL DEFAULT 'published',
      like_count      INTEGER NOT NULL DEFAULT 0,
      comment_count   INTEGER NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ NOT NULL,
      updated_at      TIMESTAMPTZ NOT NULL,
      published_at    TIMESTAMPTZ
    );
  `);

  await pool.query(`
    DO $$
    BEGIN
      -- Drop and recreate so the constraint can gain values over time; the
      -- IF NOT EXISTS form would silently keep an outdated list forever.
      IF EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'posts_kind_check'
           AND pg_get_constraintdef(oid) NOT LIKE '%news%'
      ) THEN
        ALTER TABLE posts DROP CONSTRAINT posts_kind_check;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_kind_check') THEN
        ALTER TABLE posts ADD CONSTRAINT posts_kind_check
          CHECK (kind IN ('update', 'article', 'news'));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_status_check') THEN
        ALTER TABLE posts ADD CONSTRAINT posts_status_check
          CHECK (status IN ('draft', 'published', 'removed'));
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS posts_feed_idx
      ON posts (COALESCE(published_at, created_at) DESC);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS posts_author_idx ON posts (author_id);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS posts_tags_idx ON posts USING GIN (tags);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS post_comments (
      id          TEXT PRIMARY KEY,
      post_id     TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      body        TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS post_comments_post_idx ON post_comments (post_id, created_at);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS post_likes (
      post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_follows (
      follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      followee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (follower_id, followee_id),
      CONSTRAINT social_follows_no_self CHECK (follower_id <> followee_id)
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS social_follows_followee_idx ON social_follows (followee_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_activity (
      id         TEXT PRIMARY KEY,
      type       TEXT NOT NULL,
      actor_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_name TEXT NOT NULL,
      summary    TEXT NOT NULL,
      target_id  TEXT,
      created_at TIMESTAMPTZ NOT NULL
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS social_activity_actor_idx
      ON social_activity (actor_id, created_at DESC);
  `);
}

/**
 * Chat: channels, membership, messages (with threading) and reactions.
 * Modelled on Mattermost's Channel / Member / Post / Reaction object set.
 */
async function migrateChat(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_channels (
      id           TEXT PRIMARY KEY,
      slug         TEXT NOT NULL,
      display_name TEXT NOT NULL,
      purpose      TEXT NOT NULL DEFAULT '',
      type         TEXT NOT NULL DEFAULT 'public',
      created_by   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at   TIMESTAMPTZ NOT NULL
    );
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS chat_channels_slug_key ON chat_channels (slug);
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_channels_type_check') THEN
        ALTER TABLE chat_channels ADD CONSTRAINT chat_channels_type_check
          CHECK (type IN ('public', 'private'));
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_members (
      channel_id    TEXT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      display_name  TEXT NOT NULL,
      joined_at     TIMESTAMPTZ NOT NULL,
      last_read_at  TIMESTAMPTZ,
      PRIMARY KEY (channel_id, user_id)
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS chat_members_user_idx ON chat_members (user_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id          TEXT PRIMARY KEY,
      channel_id  TEXT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
      author_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      body        TEXT NOT NULL DEFAULT '',
      root_id     TEXT REFERENCES chat_messages(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL,
      edited_at   TIMESTAMPTZ,
      removed     BOOLEAN NOT NULL DEFAULT FALSE
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS chat_messages_channel_idx
      ON chat_messages (channel_id, created_at DESC);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS chat_messages_root_idx ON chat_messages (root_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_reactions (
      message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji      TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (message_id, user_id, emoji)
    );
  `);
}

/** Media albums and asset metadata (bytes live in Garage S3). */
async function migrateMedia(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_albums (
      id              TEXT PRIMARY KEY,
      owner_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_name      TEXT NOT NULL,
      title           TEXT NOT NULL,
      description     TEXT NOT NULL DEFAULT '',
      visibility      TEXT NOT NULL DEFAULT 'public',
      cover_asset_id  TEXT,
      created_at      TIMESTAMPTZ NOT NULL,
      updated_at      TIMESTAMPTZ NOT NULL
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS media_albums_owner_idx ON media_albums (owner_id);
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_albums_visibility_check') THEN
        ALTER TABLE media_albums ADD CONSTRAINT media_albums_visibility_check
          CHECK (visibility IN ('public', 'private'));
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_assets (
      id           TEXT PRIMARY KEY,
      album_id     TEXT REFERENCES media_albums(id) ON DELETE SET NULL,
      owner_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_name   TEXT NOT NULL,
      kind         TEXT NOT NULL,
      title        TEXT NOT NULL DEFAULT '',
      description  TEXT NOT NULL DEFAULT '',
      object_key   TEXT NOT NULL,
      mime_type    TEXT NOT NULL,
      size_bytes   BIGINT NOT NULL,
      duration_sec INTEGER,
      width        INTEGER,
      height       INTEGER,
      created_at   TIMESTAMPTZ NOT NULL
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS media_assets_album_idx ON media_assets (album_id, created_at DESC);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS media_assets_owner_idx ON media_assets (owner_id);
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_assets_kind_check') THEN
        ALTER TABLE media_assets ADD CONSTRAINT media_assets_kind_check
          CHECK (kind IN ('image', 'video', 'audio'));
      END IF;
    END $$;
  `);
}

/** Active certified DFO guides registry for regional leaderboard analytics. */
async function migrateGuideLeaderboard(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS certified_guides_registry (
      id                     TEXT PRIMARY KEY,
      user_id                TEXT REFERENCES users(id) ON DELETE SET NULL,
      full_name              TEXT NOT NULL,
      region                 TEXT NOT NULL,
      organisation           TEXT NOT NULL DEFAULT '',
      track                  TEXT NOT NULL DEFAULT 'hiking',
      certified_routes_count INTEGER NOT NULL DEFAULT 0,
      experience_years       INTEGER NOT NULL DEFAULT 0,
      max_complexity         TEXT NOT NULL DEFAULT '2 КС',
      registry_number        TEXT NOT NULL,
      is_active              BOOLEAN NOT NULL DEFAULT TRUE,
      last_attestation_date  DATE NOT NULL,
      updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'certified_guides_track_check') THEN
        ALTER TABLE certified_guides_registry
          ADD CONSTRAINT certified_guides_track_check
          CHECK (track IN ('hiking', 'water', 'expedition', 'ski', 'auto'));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'certified_guides_complexity_check') THEN
        ALTER TABLE certified_guides_registry
          ADD CONSTRAINT certified_guides_complexity_check
          CHECK (max_complexity IN ('1 КС', '2 КС', '3 КС', '4 КС'));
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS certified_guides_active_routes_idx
      ON certified_guides_registry (is_active, certified_routes_count DESC, experience_years DESC);
  `);

  for (const guide of INITIAL_DFO_CERTIFIED_GUIDES) {
    await pool.query(
      `INSERT INTO certified_guides_registry (
         id, user_id, full_name, region, organisation, track,
         certified_routes_count, experience_years, max_complexity,
         registry_number, is_active, last_attestation_date
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO NOTHING`,
      [
        guide.id,
        guide.userId,
        guide.fullName,
        guide.region,
        guide.organisation,
        guide.track,
        guide.certifiedRoutesCount,
        guide.experienceYears,
        guide.maxComplexity,
        guide.registryNumber,
        guide.isActive,
        guide.lastAttestationDate,
      ]
    );
  }
}

/** Linked Google and social network profiles for personal cabinet autofill. */
async function migrateLinkedAccounts(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_linked_accounts (
      user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider              TEXT NOT NULL,
      connection_method     TEXT NOT NULL DEFAULT 'profile_link',
      external_id           TEXT NOT NULL,
      display_name          TEXT NOT NULL DEFAULT '',
      email                 TEXT NOT NULL DEFAULT '',
      contact_channel       TEXT NOT NULL DEFAULT '',
      region                TEXT NOT NULL DEFAULT '',
      organisation          TEXT NOT NULL DEFAULT '',
      profile_url           TEXT NOT NULL DEFAULT '',
      preferred_track       TEXT NOT NULL DEFAULT '',
      experience_summary    TEXT NOT NULL DEFAULT '',
      use_for_exam_autofill BOOLEAN NOT NULL DEFAULT TRUE,
      linked_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, provider)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS user_linked_accounts_user_idx
      ON user_linked_accounts (user_id, updated_at DESC);
  `);
}

