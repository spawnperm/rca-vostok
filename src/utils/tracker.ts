import type { SiteTabId } from './seo';

export interface ClientBehaviorEvent {
  id: string;
  type: 'session_start' | 'pageview' | 'click' | 'scroll' | 'interaction' | 'outbound';
  tab: SiteTabId;
  timestamp: string;
  elapsedMs: number;
  label?: string;
  targetTag?: string;
  xPct?: number;
  yPct?: number;
  scrollDepth?: number;
  detail?: string;
}

const VISITOR_STORAGE_KEY = 'rca_vostok_visitor_id';

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateVisitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing) return existing;
    const created = generateUuid();
    window.localStorage.setItem(VISITOR_STORAGE_KEY, created);
    return created;
  } catch {
    return generateUuid();
  }
}

class BehaviorTracker {
  private sessionId: string = generateUuid();
  private visitorId: string = getOrCreateVisitorId();
  private startedAtMs: number = Date.now();
  private currentTab: SiteTabId = 'overview';
  private queue: ClientBehaviorEvent[] = [];
  private localHistory: ClientBehaviorEvent[] = [];
  private flushTimer: number | null = null;
  private scrollMilestones: Set<number> = new Set();
  private maxScrollForTab: number = 0;
  private initialized: boolean = false;
  private listeners: Set<() => void> = new Set();

  public init(initialTab: SiteTabId): () => void {
    if (this.initialized) return () => {};
    this.initialized = true;
    this.currentTab = initialTab;
    this.startedAtMs = Date.now();

    this.enqueue({
      type: 'session_start',
      tab: initialTab,
      label: `Вход на сайт (${initialTab})`,
      scrollDepth: 0,
    });

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const interactive = target.closest('button, a, input, select, [role="button"]') as HTMLElement | null;
      const el = interactive || target;
      const tag = el.tagName.toLowerCase();

      // Capture clean human-readable label (never input values for privacy)
      let label =
        el.getAttribute('aria-label') ||
        el.getAttribute('data-track') ||
        (tag === 'input' ? el.getAttribute('id') || 'Ползунок / ввод' : el.textContent || '');
      label = label.replace(/\s+/g, ' ').trim().slice(0, 90);
      if (!label) label = `<${tag}>`;

      const vw = Math.max(window.innerWidth, 1);
      const vh = Math.max(window.innerHeight, 1);
      const xPct = Math.round((e.clientX / vw) * 1000) / 10;
      const yPct = Math.round((e.clientY / vh) * 1000) / 10;

      const isOutbound =
        tag === 'a' &&
        (el as HTMLAnchorElement).hostname &&
        (el as HTMLAnchorElement).hostname !== window.location.hostname;

      this.enqueue({
        type: isOutbound ? 'outbound' : 'click',
        tab: this.currentTab,
        label,
        targetTag: tag,
        xPct,
        yPct,
        detail: isOutbound ? (el as HTMLAnchorElement).href.slice(0, 120) : undefined,
      });
    };

    let scrollThrottle: number | null = null;
    const onScroll = () => {
      if (scrollThrottle !== null) return;
      scrollThrottle = window.setTimeout(() => {
        scrollThrottle = null;
        const docHeight = Math.max(
          document.documentElement.scrollHeight - window.innerHeight,
          1
        );
        const depth = Math.min(Math.round((window.scrollY / docHeight) * 100), 100);
        if (depth > this.maxScrollForTab) {
          this.maxScrollForTab = depth;
        }
        const milestones = [25, 50, 75, 100];
        for (const m of milestones) {
          if (depth >= m && !this.scrollMilestones.has(m)) {
            this.scrollMilestones.add(m);
            this.enqueue({
              type: 'scroll',
              tab: this.currentTab,
              label: `Прокрутка экрана ${m}%`,
              scrollDepth: m,
            });
          }
        }
      }, 250);
    };

    const onInputChange = (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      if (!target || target.tagName.toLowerCase() !== 'input') return;
      if (target.type === 'range') {
        const idLabel =
          document.querySelector(`label[for="${target.id}"]`)?.textContent?.trim() ||
          target.id ||
          'Параметр модели';
        this.enqueue({
          type: 'interaction',
          tab: this.currentTab,
          label: `Изменение: ${idLabel.slice(0, 60)}`,
          targetTag: 'input[range]',
          detail: `Значение: ${target.value}`,
        });
      }
    };

    const onVisibilityOrHide = () => {
      if (document.visibilityState === 'hidden') {
        this.flush(true);
      }
    };

    document.addEventListener('click', onClick, true);
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('change', onInputChange, true);
    document.addEventListener('visibilitychange', onVisibilityOrHide);
    window.addEventListener('pagehide', () => this.flush(true));

    this.flushTimer = window.setInterval(() => {
      this.flush(false);
    }, 2500);

    // Flush initial session_start immediately
    this.flush(false);

    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('change', onInputChange, true);
      document.removeEventListener('visibilitychange', onVisibilityOrHide);
      if (this.flushTimer !== null) window.clearInterval(this.flushTimer);
      this.flush(true);
      this.initialized = false;
    };
  }

  public trackTabChange(nextTab: SiteTabId, label: string): void {
    if (nextTab === this.currentTab) return;
    this.currentTab = nextTab;
    this.scrollMilestones.clear();
    this.maxScrollForTab = 0;

    this.enqueue({
      type: 'pageview',
      tab: nextTab,
      label: `Переход: ${label}`,
      scrollDepth: 0,
    });
    this.flush(false);
  }

  public trackCustomInteraction(label: string, detail?: string): void {
    this.enqueue({
      type: 'interaction',
      tab: this.currentTab,
      label,
      detail,
    });
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getLocalEvents(): ClientBehaviorEvent[] {
    return [...this.localHistory];
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) {
      fn();
    }
  }

  private enqueue(partial: Omit<ClientBehaviorEvent, 'id' | 'timestamp' | 'elapsedMs'>): void {
    const ev: ClientBehaviorEvent = {
      id: generateUuid(),
      timestamp: new Date().toISOString(),
      elapsedMs: Math.max(Date.now() - this.startedAtMs, 0),
      ...partial,
    };
    this.queue.push(ev);
    this.localHistory.push(ev);
    if (this.localHistory.length > 300) {
      this.localHistory = this.localHistory.slice(-300);
    }
    this.notify();
  }

  public flush(useBeacon = false): void {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, 50);

    const searchParams = new URLSearchParams(window.location.search);
    const payload = JSON.stringify({
      sessionId: this.sessionId,
      visitorId: this.visitorId,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      referrer: document.referrer || '',
      utmSource: searchParams.get('utm_source') || '',
      events: batch,
    });

    if (useBeacon && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/collect', blob);
      return;
    }

    fetch('/api/analytics/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Non-blocking telemetry send
    });
  }
}

export const tracker = new BehaviorTracker();
