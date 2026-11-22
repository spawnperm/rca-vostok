import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'analytics-store.json');

const ALLOWED_EVENT_TYPES = new Set([
  'session_start',
  'pageview',
  'click',
  'scroll',
  'interaction',
  'outbound',
]);

interface BehaviorEvent {
  id: string;
  sessionId: string;
  type: string;
  tab: string;
  timestamp: string;
  elapsedMs: number;
  label?: string;
  targetTag?: string;
  xPct?: number;
  yPct?: number;
  scrollDepth?: number;
  detail?: string;
}

interface SessionRecord {
  sessionId: string;
  visitorId: string;
  startedAt: string;
  lastSeenAt: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  browser: string;
  viewport: string;
  referrer: string;
  utmSource: string;
  landingTab: string;
  tabsVisited: string[];
  maxScrollDepth: number;
  durationSec: number;
  eventCount: number;
  clickCount: number;
}

interface AnalyticsStore {
  sessions: Record<string, SessionRecord>;
  events: BehaviorEvent[];
}

function ensureStoreDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore(): AnalyticsStore {
  ensureStoreDir();
  if (!STORE_PATH.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid analytics store path');
  }
  if (!fs.existsSync(STORE_PATH)) {
    return { sessions: {}, events: [] };
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AnalyticsStore>;
    return {
      sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {},
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return { sessions: {}, events: [] };
  }
}

function saveStore(store: AnalyticsStore): void {
  ensureStoreDir();
  if (!STORE_PATH.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid analytics store path');
  }
  // Keep latest 5000 events and 500 sessions to bound disk usage
  const sessionEntries = Object.entries(store.sessions)
    .sort((a, b) => (a[1].lastSeenAt < b[1].lastSeenAt ? 1 : -1))
    .slice(0, 500);
  const trimmedSessions: Record<string, SessionRecord> = Object.fromEntries(sessionEntries);
  const trimmedEvents = store.events.slice(-5000);

  const tmpPath = path.resolve(DATA_DIR, 'analytics-store.tmp.json');
  if (!tmpPath.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid temp path');
  }
  fs.writeFileSync(
    tmpPath,
    JSON.stringify({ sessions: trimmedSessions, events: trimmedEvents }, null, 2),
    'utf-8'
  );
  fs.renameSync(tmpPath, STORE_PATH);
}

function sanitizeStr(val: unknown, maxLen = 160): string {
  if (typeof val !== 'string') return '';
  return val.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLen);
}

function clampNum(val: unknown, min: number, max: number): number | undefined {
  if (typeof val !== 'number' || !Number.isFinite(val)) return undefined;
  return Math.min(Math.max(Math.round(val * 10) / 10, min), max);
}

function parseUserAgent(ua: string): { deviceType: 'Desktop' | 'Mobile' | 'Tablet'; browser: string } {
  const lower = ua.toLowerCase();
  let deviceType: 'Desktop' | 'Mobile' | 'Tablet' = 'Desktop';
  if (/ipad|tablet/.test(lower)) deviceType = 'Tablet';
  else if (/mobi|android|iphone/.test(lower)) deviceType = 'Mobile';

  let browser = 'Другой';
  if (lower.includes('yabrowser')) browser = 'Яндекс.Браузер';
  else if (lower.includes('edg/')) browser = 'Edge';
  else if (lower.includes('chrome/')) browser = 'Chrome';
  else if (lower.includes('firefox/')) browser = 'Firefox';
  else if (lower.includes('safari/') && !lower.includes('chrome/')) browser = 'Safari';

  return { deviceType, browser };
}

function getBaseUrl(req: express.Request): string {
  const envUrl = process.env.APP_URL;
  if (envUrl && envUrl !== 'MY_APP_URL' && /^https?:\/\//.test(envUrl)) {
    return envUrl.replace(/\/+$/, '');
  }
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : req.protocol;
  const host = req.get('host') || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '256kb' }));

  let store = loadStore();

  // Dynamic robots.txt
  app.get('/robots.txt', (req, res) => {
    const baseUrl = getBaseUrl(req);
    res.type('text/plain; charset=utf-8');
    res.send(
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        `Sitemap: ${baseUrl}/sitemap.xml`,
      ].join('\n')
    );
  });

  // Dynamic sitemap.xml
  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = getBaseUrl(req);
    const today = new Date().toISOString().split('T')[0];
    const sections = [
      { slug: '', priority: '1.0', changefreq: 'weekly' },
      { slug: '?tab=calculator', priority: '0.9', changefreq: 'monthly' },
      { slug: '?tab=market', priority: '0.9', changefreq: 'monthly' },
      { slug: '?tab=dissertation', priority: '0.8', changefreq: 'monthly' },
      { slug: '?tab=presentations', priority: '0.8', changefreq: 'monthly' },
      { slug: '?tab=analytics', priority: '0.6', changefreq: 'daily' },
    ];
    const urlsXml = sections
      .map(
        (s) => `  <url>
    <loc>${baseUrl}/${s.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${s.changefreq}</changefreq>
    <priority>${s.priority}</priority>
  </url>`
      )
      .join('\n');

    res.type('application/xml; charset=utf-8');
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>`
    );
  });

  // Collect real visit & user behavior events
  app.post('/api/analytics/collect', (req, res) => {
    const body = req.body as {
      sessionId?: unknown;
      visitorId?: unknown;
      viewport?: unknown;
      referrer?: unknown;
      utmSource?: unknown;
      events?: unknown;
    };

    const sessionId = sanitizeStr(body.sessionId, 64);
    const visitorId = sanitizeStr(body.visitorId, 64) || sessionId;
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }

    const rawEvents = Array.isArray(body.events) ? body.events.slice(0, 50) : [];
    if (rawEvents.length === 0) {
      res.json({ ok: true, accepted: 0 });
      return;
    }

    const ua = sanitizeStr(req.get('user-agent') || '', 256);
    const { deviceType, browser } = parseUserAgent(ua);
    const viewport = sanitizeStr(body.viewport, 32) || '1440x900';
    const referrerRaw = sanitizeStr(body.referrer, 200);
    let referrerLabel = 'Прямой заход';
    if (referrerRaw) {
      try {
        const parsedRef = new URL(referrerRaw);
        referrerLabel = parsedRef.hostname;
      } catch {
        referrerLabel = referrerRaw.slice(0, 64);
      }
    }
    const utmSource = sanitizeStr(body.utmSource, 64);
    const nowIso = new Date().toISOString();

    if (!store.sessions[sessionId]) {
      const firstTab = sanitizeStr((rawEvents[0] as { tab?: unknown })?.tab, 32) || 'overview';
      store.sessions[sessionId] = {
        sessionId,
        visitorId,
        startedAt: nowIso,
        lastSeenAt: nowIso,
        deviceType,
        browser,
        viewport,
        referrer: referrerLabel,
        utmSource,
        landingTab: firstTab,
        tabsVisited: [firstTab],
        maxScrollDepth: 0,
        durationSec: 0,
        eventCount: 0,
        clickCount: 0,
      };
    }

    const session = store.sessions[sessionId];
    session.lastSeenAt = nowIso;
    session.viewport = viewport;

    let accepted = 0;
    for (const item of rawEvents) {
      if (!item || typeof item !== 'object') continue;
      const ev = item as Record<string, unknown>;
      const type = sanitizeStr(ev.type, 32);
      if (!ALLOWED_EVENT_TYPES.has(type)) continue;

      const tab = sanitizeStr(ev.tab, 32) || 'overview';
      const elapsedMs = clampNum(ev.elapsedMs, 0, 86_400_000) ?? 0;
      const scrollDepth = clampNum(ev.scrollDepth, 0, 100);
      const xPct = clampNum(ev.xPct, 0, 100);
      const yPct = clampNum(ev.yPct, 0, 100);

      const cleanEvent: BehaviorEvent = {
        id: sanitizeStr(ev.id, 48) || `${Date.now()}-${accepted}`,
        sessionId,
        type,
        tab,
        timestamp: sanitizeStr(ev.timestamp, 40) || nowIso,
        elapsedMs,
        label: sanitizeStr(ev.label, 120) || undefined,
        targetTag: sanitizeStr(ev.targetTag, 24) || undefined,
        xPct,
        yPct,
        scrollDepth,
        detail: sanitizeStr(ev.detail, 160) || undefined,
      };

      store.events.push(cleanEvent);
      accepted++;
      session.eventCount += 1;

      if (type === 'click') {
        session.clickCount += 1;
      }
      if (!session.tabsVisited.includes(tab)) {
        session.tabsVisited.push(tab);
      }
      if (typeof scrollDepth === 'number' && scrollDepth > session.maxScrollDepth) {
        session.maxScrollDepth = scrollDepth;
      }
      const sec = Math.round(elapsedMs / 1000);
      if (sec > session.durationSec) {
        session.durationSec = sec;
      }
    }

    if (accepted > 0) {
      saveStore(store);
    }

    res.json({ ok: true, accepted });
  });

  // Get aggregated visit statistics, heatmap points, and session summaries
  app.get('/api/analytics/summary', (_req, res) => {
    const sessionsList = Object.values(store.sessions).sort((a, b) =>
      a.lastSeenAt < b.lastSeenAt ? 1 : -1
    );
    const uniqueVisitors = new Set(sessionsList.map((s) => s.visitorId)).size;
    const pageviews = store.events.filter(
      (e) => e.type === 'pageview' || e.type === 'session_start'
    ).length;
    const totalClicks = store.events.filter((e) => e.type === 'click').length;

    const avgDurationSec =
      sessionsList.length > 0
        ? Math.round(
            sessionsList.reduce((acc, s) => acc + s.durationSec, 0) / sessionsList.length
          )
        : 0;

    const avgScrollDepth =
      sessionsList.length > 0
        ? Math.round(
            sessionsList.reduce((acc, s) => acc + s.maxScrollDepth, 0) / sessionsList.length
          )
        : 0;

    // Tab breakdown
    const tabStatsMap: Record<string, { views: number; clicks: number; interactions: number }> = {};
    for (const ev of store.events) {
      if (!tabStatsMap[ev.tab]) {
        tabStatsMap[ev.tab] = { views: 0, clicks: 0, interactions: 0 };
      }
      if (ev.type === 'pageview' || ev.type === 'session_start') tabStatsMap[ev.tab].views += 1;
      if (ev.type === 'click') tabStatsMap[ev.tab].clicks += 1;
      if (ev.type === 'interaction') tabStatsMap[ev.tab].interactions += 1;
    }

    // Device & Referrer breakdown
    const devices: Record<string, number> = {};
    const referrers: Record<string, number> = {};
    for (const s of sessionsList) {
      devices[s.deviceType] = (devices[s.deviceType] || 0) + 1;
      const refKey = s.utmSource ? `${s.referrer} (utm: ${s.utmSource})` : s.referrer;
      referrers[refKey] = (referrers[refKey] || 0) + 1;
    }

    // Hourly traffic buckets (last 24h or by session start hour)
    const timelineMap: Record<string, { label: string; visits: number; events: number }> = {};
    for (const s of sessionsList) {
      const dt = new Date(s.startedAt);
      const key = `${dt.toISOString().slice(0, 13)}:00`;
      const label = `${String(dt.getHours()).padStart(2, '0')}:00`;
      if (!timelineMap[key]) timelineMap[key] = { label, visits: 0, events: 0 };
      timelineMap[key].visits += 1;
      timelineMap[key].events += s.eventCount;
    }
    const timeline = Object.entries(timelineMap)
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .slice(-12)
      .map(([, val]) => val);

    // Top clicked labels
    const clickLabelsMap: Record<string, { label: string; tab: string; count: number }> = {};
    const heatmapPoints: { xPct: number; yPct: number; tab: string; label: string }[] = [];

    for (const ev of store.events) {
      if (ev.type === 'click') {
        if (typeof ev.xPct === 'number' && typeof ev.yPct === 'number') {
          heatmapPoints.push({
            xPct: ev.xPct,
            yPct: ev.yPct,
            tab: ev.tab,
            label: ev.label || ev.targetTag || 'Элемент',
          });
        }
        const key = `${ev.tab}::${ev.label || ev.targetTag || 'Клик'}`;
        if (!clickLabelsMap[key]) {
          clickLabelsMap[key] = {
            label: ev.label || ev.targetTag || 'Элемент интерфейса',
            tab: ev.tab,
            count: 0,
          };
        }
        clickLabelsMap[key].count += 1;
      }
    }

    const topClicked = Object.values(clickLabelsMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({
      totals: {
        sessions: sessionsList.length,
        uniqueVisitors,
        pageviews,
        totalEvents: store.events.length,
        totalClicks,
        avgDurationSec,
        avgScrollDepth,
      },
      tabStats: tabStatsMap,
      devices,
      referrers,
      timeline,
      topClicked,
      heatmapPoints: heatmapPoints.slice(-400),
      recentSessions: sessionsList.slice(0, 30),
    });
  });

  // Get detailed behavior event log for a specific session
  app.get('/api/analytics/sessions/:sessionId', (req, res) => {
    const sessionId = sanitizeStr(req.params.sessionId, 64);
    const session = store.sessions[sessionId];
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    const events = store.events.filter((e) => e.sessionId === sessionId);
    res.json({ session, events });
  });

  // Reset stored analytics logs
  app.delete('/api/analytics/reset', (_req, res) => {
    store = { sessions: {}, events: [] };
    saveStore(store);
    res.json({ ok: true });
  });

  // Server-side SEO endpoints check
  app.get('/api/seo/server-status', (req, res) => {
    const baseUrl = getBaseUrl(req);
    res.json({
      baseUrl,
      robotsUrl: `${baseUrl}/robots.txt`,
      sitemapUrl: `${baseUrl}/sitemap.xml`,
      robotsConfigured: true,
      sitemapConfigured: true,
      indexedRoutes: 6,
    });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
