import { BoundedNumber, SanitizedText } from '../shared/ValueObjects.ts';

export const ALLOWED_ANALYTICS_EVENT_TYPES = new Set<string>([
  'session_start',
  'pageview',
  'click',
  'scroll',
  'interaction',
  'outbound',
]);

export interface BehaviorEventDTO {
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

export interface VisitorSessionDTO {
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

export interface AnalyticsStoreData {
  sessions: Record<string, VisitorSessionDTO>;
  events: BehaviorEventDTO[];
}

export const BehaviorEventFactory = {
  createNormalized(
    raw: Record<string, unknown>,
    sessionId: string,
    index: number,
    fallbackIso: string
  ): BehaviorEventDTO | null {
    const type = SanitizedText.sanitizeRaw(raw.type, 32);
    if (!ALLOWED_ANALYTICS_EVENT_TYPES.has(type)) {
      return null;
    }

    const tab = SanitizedText.sanitizeRaw(raw.tab, 32) || 'overview';
    const elapsedMs = BoundedNumber.clampOrUndefined(raw.elapsedMs, 0, 86_400_000) ?? 0;
    const scrollDepth = BoundedNumber.clampOrUndefined(raw.scrollDepth, 0, 100);
    const xPct = BoundedNumber.clampOrUndefined(raw.xPct, 0, 100);
    const yPct = BoundedNumber.clampOrUndefined(raw.yPct, 0, 100);

    return {
      id: SanitizedText.sanitizeRaw(raw.id, 48) || `${Date.now()}-${index}`,
      sessionId,
      type,
      tab,
      timestamp: SanitizedText.sanitizeRaw(raw.timestamp, 40) || fallbackIso,
      elapsedMs,
      label: SanitizedText.sanitizeRaw(raw.label, 120) || undefined,
      targetTag: SanitizedText.sanitizeRaw(raw.targetTag, 24) || undefined,
      xPct,
      yPct,
      scrollDepth,
      detail: SanitizedText.sanitizeRaw(raw.detail, 160) || undefined,
    };
  },
};

export function parseUserAgentSummary(ua: string): {
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  browser: string;
} {
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
