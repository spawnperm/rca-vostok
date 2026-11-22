import type pg from 'pg';
import type { AnalyticsRepository } from '../../../domain/analytics/AnalyticsRepository.ts';
import type {
  AnalyticsStoreData,
  BehaviorEventDTO,
  VisitorSessionDTO,
} from '../../../domain/analytics/BehaviorModels.ts';

/** Caps mirror the bounded-store limits of the file adapter. */
const MAX_SESSIONS = 500;
const MAX_EVENTS = 5000;

interface SessionRow {
  session_id: string;
  visitor_id: string;
  started_at: Date;
  last_seen_at: Date;
  device_type: string;
  browser: string;
  viewport: string;
  referrer: string;
  utm_source: string;
  landing_tab: string;
  tabs_visited: string[];
  max_scroll_depth: number;
  duration_sec: number;
  event_count: number;
  click_count: number;
}

interface EventRow {
  event_key: string;
  session_id: string;
  type: string;
  tab: string;
  occurred_at: Date;
  elapsed_ms: number;
  label: string | null;
  target_tag: string | null;
  x_pct: number | null;
  y_pct: number | null;
  scroll_depth: number | null;
  detail: string | null;
}

function toSessionDTO(row: SessionRow): VisitorSessionDTO {
  return {
    sessionId: row.session_id,
    visitorId: row.visitor_id,
    startedAt: row.started_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
    deviceType: row.device_type as VisitorSessionDTO['deviceType'],
    browser: row.browser,
    viewport: row.viewport,
    referrer: row.referrer,
    utmSource: row.utm_source,
    landingTab: row.landing_tab,
    tabsVisited: row.tabs_visited ?? [],
    maxScrollDepth: row.max_scroll_depth,
    durationSec: row.duration_sec,
    eventCount: row.event_count,
    clickCount: row.click_count,
  };
}

function toEventDTO(row: EventRow): BehaviorEventDTO {
  return {
    id: row.event_key,
    sessionId: row.session_id,
    type: row.type,
    tab: row.tab,
    timestamp: row.occurred_at.toISOString(),
    elapsedMs: row.elapsed_ms,
    label: row.label ?? undefined,
    targetTag: row.target_tag ?? undefined,
    xPct: row.x_pct ?? undefined,
    yPct: row.y_pct ?? undefined,
    scrollDepth: row.scroll_depth ?? undefined,
    detail: row.detail ?? undefined,
  };
}

/**
 * PostgreSQL adapter for the analytics bounded context.
 *
 * The domain aggregates behaviour in memory (`loadStore` -> mutate ->
 * `saveStore`), so this adapter materialises the bounded window of most
 * recent sessions and events, then writes the delta back inside a single
 * transaction. Retention trimming mirrors the file adapter: 500 sessions and
 * 5000 events.
 */
export class PostgresAnalyticsRepository implements AnalyticsRepository {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async loadStore(): Promise<AnalyticsStoreData> {
    const client = await this.pool.connect();
    try {
      const sessionsResult = await client.query<SessionRow>(
        `SELECT * FROM analytics_sessions
          ORDER BY last_seen_at DESC
          LIMIT $1`,
        [MAX_SESSIONS]
      );

      const eventsResult = await client.query<EventRow>(
        `SELECT event_key, session_id, type, tab, occurred_at, elapsed_ms,
                label, target_tag, x_pct, y_pct, scroll_depth, detail
           FROM analytics_events
          ORDER BY id DESC
          LIMIT $1`,
        [MAX_EVENTS]
      );

      const sessions: Record<string, VisitorSessionDTO> = {};
      for (const row of sessionsResult.rows) {
        sessions[row.session_id] = toSessionDTO(row);
      }

      // Loaded newest-first for the LIMIT; restore chronological order.
      const events = eventsResult.rows.map(toEventDTO).reverse();
      return { sessions, events };
    } finally {
      client.release();
    }
  }

  async saveStore(store: AnalyticsStoreData): Promise<void> {
    const sessionEntries = Object.entries(store.sessions)
      .sort((a, b) => (a[1].lastSeenAt < b[1].lastSeenAt ? 1 : -1))
      .slice(0, MAX_SESSIONS);
    const sessions = sessionEntries.map(([, s]) => s);
    const events = store.events.slice(-MAX_EVENTS);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const s of sessions) {
        await client.query(
          `INSERT INTO analytics_sessions (
             session_id, visitor_id, started_at, last_seen_at, device_type, browser,
             viewport, referrer, utm_source, landing_tab, tabs_visited,
             max_scroll_depth, duration_sec, event_count, click_count
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (session_id) DO UPDATE SET
             visitor_id = EXCLUDED.visitor_id,
             last_seen_at = EXCLUDED.last_seen_at,
             device_type = EXCLUDED.device_type,
             browser = EXCLUDED.browser,
             viewport = EXCLUDED.viewport,
             referrer = EXCLUDED.referrer,
             utm_source = EXCLUDED.utm_source,
             landing_tab = EXCLUDED.landing_tab,
             tabs_visited = EXCLUDED.tabs_visited,
             max_scroll_depth = EXCLUDED.max_scroll_depth,
             duration_sec = EXCLUDED.duration_sec,
             event_count = EXCLUDED.event_count,
             click_count = EXCLUDED.click_count`,
          [
            s.sessionId,
            s.visitorId,
            s.startedAt,
            s.lastSeenAt,
            s.deviceType,
            s.browser,
            s.viewport,
            s.referrer,
            s.utmSource,
            s.landingTab,
            s.tabsVisited,
            s.maxScrollDepth,
            s.durationSec,
            s.eventCount,
            s.clickCount,
          ]
        );
      }

      for (const ev of events) {
        await client.query(
          `INSERT INTO analytics_events (
             event_key, session_id, type, tab, occurred_at, elapsed_ms,
             label, target_tag, x_pct, y_pct, scroll_depth, detail
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT DO NOTHING`,
          [
            ev.id,
            ev.sessionId,
            ev.type,
            ev.tab,
            ev.timestamp,
            ev.elapsedMs,
            ev.label ?? null,
            ev.targetTag ?? null,
            ev.xPct ?? null,
            ev.yPct ?? null,
            ev.scrollDepth ?? null,
            ev.detail ?? null,
          ]
        );
      }

      // Retention: drop events belonging to sessions outside the window.
      if (sessions.length > 0) {
        const keep = sessions.map((s) => s.sessionId);
        await client.query(
          `DELETE FROM analytics_events
            WHERE session_id <> ALL($1::text[])`,
          [keep]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async reset(): Promise<void> {
    await this.pool.query('TRUNCATE analytics_events, analytics_sessions');
  }

  async getSession(
    sessionId: string
  ): Promise<{ session: VisitorSessionDTO; events: BehaviorEventDTO[] } | null> {
    const sessionResult = await this.pool.query<SessionRow>(
      'SELECT * FROM analytics_sessions WHERE session_id = $1',
      [sessionId]
    );
    if (sessionResult.rows.length === 0) {
      return null;
    }

    const eventsResult = await this.pool.query<EventRow>(
      `SELECT event_key, session_id, type, tab, occurred_at, elapsed_ms,
              label, target_tag, x_pct, y_pct, scroll_depth, detail
         FROM analytics_events
        WHERE session_id = $1
        ORDER BY id ASC`,
      [sessionId]
    );

    return {
      session: toSessionDTO(sessionResult.rows[0]),
      events: eventsResult.rows.map(toEventDTO),
    };
  }
}
