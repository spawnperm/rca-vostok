/**
 * In-process metrics collected without an external dependency.
 *
 * The deployment has no Prometheus stack, so a full metrics pipeline would be
 * over-engineering. What operations actually need is: is the service up, how
 * many requests fail, and how slow is the p95. These counters answer that over
 * the lifetime of the process and are exposed at /api/metrics.
 *
 * Limitations are stated rather than hidden: counters reset on restart, and
 * there is no histogram bucketing — only min/avg/max and a bounded sample of
 * durations for percentiles.
 */

export interface RouteStat {
  count: number;
  errors: number;
  totalMs: number;
  maxMs: number;
  /** Bounded ring of recent durations, used for the p95 estimate. */
  samples: number[];
}

export interface MetricsSnapshot {
  uptimeSec: number;
  startedAt: string;
  requests: {
    total: number;
    errors5xx: number;
    clientErrors4xx: number;
    rateLimited: number;
  };
  latency: { p50: number; p95: number; max: number };
  byRoute: Record<string, { count: number; errors: number; avgMs: number; p95Ms: number }>;
  process: { rssMb: number; heapUsedMb: number };
}

/** Keeps memory bounded no matter how many routes exist. */
const MAX_TRACKED_ROUTES = 200;
const MAX_SAMPLES_PER_ROUTE = 200;

export class MetricsCollector {
  private readonly startedAt = new Date();
  private total = 0;
  private errors5xx = 0;
  private clientErrors4xx = 0;
  private rateLimited = 0;
  private readonly routes = new Map<string, RouteStat>();
  private readonly durations: number[] = [];

  /** Records one finished request. Called from the middleware. */
  record(method: string, path: string, status: number, durationMs: number): void {
    this.total += 1;
    if (status >= 500) this.errors5xx += 1;
    if (status === 429) this.rateLimited += 1;
    else if (status >= 400) this.clientErrors4xx += 1;

    if (this.durations.length < 500) this.durations.push(durationMs);

    // Route labels collapse path parameters so /api/posts/a and /api/posts/b
    // share a bucket instead of creating unbounded cardinality.
    const key = `${method} ${normalisePath(path)}`;
    let stat = this.routes.get(key);
    if (!stat) {
      if (this.routes.size >= MAX_TRACKED_ROUTES) return;
      stat = { count: 0, errors: 0, totalMs: 0, maxMs: 0, samples: [] };
      this.routes.set(key, stat);
    }

    stat.count += 1;
    stat.totalMs += durationMs;
    if (durationMs > stat.maxMs) stat.maxMs = durationMs;
    if (status >= 500) stat.errors += 1;
    if (stat.samples.length < MAX_SAMPLES_PER_ROUTE) stat.samples.push(durationMs);
    else stat.samples[stat.count % MAX_SAMPLES_PER_ROUTE] = durationMs;
  }

  snapshot(): MetricsSnapshot {
    const byRoute: MetricsSnapshot['byRoute'] = {};
    for (const [key, stat] of this.routes) {
      byRoute[key] = {
        count: stat.count,
        errors: stat.errors,
        avgMs: stat.count > 0 ? Math.round(stat.totalMs / stat.count) : 0,
        p95Ms: percentile(stat.samples, 0.95),
      };
    }

    const mem = process.memoryUsage();
    return {
      uptimeSec: Math.round((Date.now() - this.startedAt.getTime()) / 1000),
      startedAt: this.startedAt.toISOString(),
      requests: {
        total: this.total,
        errors5xx: this.errors5xx,
        clientErrors4xx: this.clientErrors4xx,
        rateLimited: this.rateLimited,
      },
      latency: {
        p50: percentile(this.durations, 0.5),
        p95: percentile(this.durations, 0.95),
        max: this.durations.length > 0 ? Math.max(...this.durations) : 0,
      },
      byRoute,
      process: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      },
    };
  }
}

/** Replaces dynamic segments so route cardinality stays bounded. */
function normalisePath(path: string): string {
  return path
    // Identifiers we generate: usr-, post-, msg-, chn-, alb-, ast-, inq-, fb-
    .replace(/\/(usr|post|cnt|msg|chn|alb|ast|inq|fb)-[^/]+/g, '/:id')
    // Bare uuid-ish or numeric segments.
    .replace(/\/[0-9a-f]{16,}/gi, '/:id')
    .replace(/\/\d+/g, '/:id')
    .slice(0, 120);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return Math.round(sorted[index]);
}

export { normalisePath };
