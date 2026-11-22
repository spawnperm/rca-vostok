import pg from 'pg';

const { Pool } = pg;

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
    console.error('[pg] idle client error', err.message);
  });

  return pool;
}

/**
 * Minimal forward-only migration runner. Statements are idempotent so the
 * server can safely configure schema at boot.
 */
export async function runMigrations(pool: pg.Pool): Promise<void> {
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

  // ── Identity bounded context ──────────────────────────────────────────────
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
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_kind_check') THEN
        ALTER TABLE posts ADD CONSTRAINT posts_kind_check
          CHECK (kind IN ('update', 'article'));
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
