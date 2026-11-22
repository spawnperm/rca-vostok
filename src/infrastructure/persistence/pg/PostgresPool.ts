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
}
