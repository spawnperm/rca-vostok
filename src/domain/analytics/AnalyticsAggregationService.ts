import type { AnalyticsStoreData, BehaviorEventDTO, VisitorSessionDTO } from './BehaviorModels.ts';

export interface AnalyticsSummaryDTO {
  totals: {
    sessions: number;
    uniqueVisitors: number;
    pageviews: number;
    totalEvents: number;
    totalClicks: number;
    avgDurationSec: number;
    avgScrollDepth: number;
  };
  tabStats: Record<string, { views: number; clicks: number; interactions: number }>;
  devices: Record<string, number>;
  referrers: Record<string, number>;
  timeline: { label: string; visits: number; events: number }[];
  topClicked: { label: string; tab: string; count: number }[];
  heatmapPoints: { xPct: number; yPct: number; tab: string; label: string }[];
  recentSessions: VisitorSessionDTO[];
}

export const AnalyticsAggregationService = {
  summarize(store: AnalyticsStoreData): AnalyticsSummaryDTO {
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

    const tabStatsMap: Record<string, { views: number; clicks: number; interactions: number }> = {};
    for (const ev of store.events) {
      if (!tabStatsMap[ev.tab]) {
        tabStatsMap[ev.tab] = { views: 0, clicks: 0, interactions: 0 };
      }
      if (ev.type === 'pageview' || ev.type === 'session_start') tabStatsMap[ev.tab].views += 1;
      if (ev.type === 'click') tabStatsMap[ev.tab].clicks += 1;
      if (ev.type === 'interaction') tabStatsMap[ev.tab].interactions += 1;
    }

    const devices: Record<string, number> = {};
    const referrers: Record<string, number> = {};
    for (const s of sessionsList) {
      devices[s.deviceType] = (devices[s.deviceType] || 0) + 1;
      const refKey = s.utmSource ? `${s.referrer} (utm: ${s.utmSource})` : s.referrer;
      referrers[refKey] = (referrers[refKey] || 0) + 1;
    }

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

    return {
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
    };
  },

  applyEventsToSession(
    session: VisitorSessionDTO,
    events: BehaviorEventDTO[],
    nowIso: string,
    viewport: string
  ): void {
    session.lastSeenAt = nowIso;
    session.viewport = viewport;

    for (const ev of events) {
      session.eventCount += 1;
      if (ev.type === 'click') {
        session.clickCount += 1;
      }
      if (!session.tabsVisited.includes(ev.tab)) {
        session.tabsVisited.push(ev.tab);
      }
      if (typeof ev.scrollDepth === 'number' && ev.scrollDepth > session.maxScrollDepth) {
        session.maxScrollDepth = ev.scrollDepth;
      }
      const sec = Math.round(ev.elapsedMs / 1000);
      if (sec > session.durationSec) {
        session.durationSec = sec;
      }
    }
  },
};
