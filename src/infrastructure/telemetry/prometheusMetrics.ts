import type { NextFunction, Request, Response } from 'express';

interface HistogramState {
  buckets: number[];
  bucketCounts: number[];
  sum: number;
  count: number;
}

export interface JsonPrometheusMetric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
  values: Array<{
    labels: Record<string, string>;
    value: number;
  }>;
}

const LATENCY_BUCKETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5];

const httpRequestsCounters = new Map<string, number>();
const rateLimitedCounters = new Map<string, number>();
const durationHistograms = new Map<string, HistogramState>();
let natsPublishedTotal = 0;

function labelKey(labels: Record<string, string>): string {
  return JSON.stringify(
    Object.keys(labels)
      .sort()
      .reduce<Record<string, string>>((acc, k) => {
        acc[k] = labels[k];
        return acc;
      }, {})
  );
}

function normalizeRouteLabel(req: Request): string {
  const raw = (req.baseUrl || '') + (req.route?.path || req.path || '/');
  return raw
    .replace(/\/[a-z]+_[a-zA-Z0-9_-]{4,}/g, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27}/gi, '/:uuid')
    .replace(/\/\d+/g, '/:num');
}

export function recordHttpObservation(
  method: string,
  route: string,
  statusCode: number,
  durationSeconds: number
): void {
  const key = labelKey({
    method: method.toUpperCase(),
    route,
    status_code: String(statusCode),
  });
  httpRequestsCounters.set(key, (httpRequestsCounters.get(key) ?? 0) + 1);

  if (statusCode === 429) {
    const rlKey = labelKey({ endpoint: route });
    rateLimitedCounters.set(rlKey, (rateLimitedCounters.get(rlKey) ?? 0) + 1);
  }

  let hist = durationHistograms.get(key);
  if (!hist) {
    hist = {
      buckets: LATENCY_BUCKETS,
      bucketCounts: new Array(LATENCY_BUCKETS.length).fill(0),
      sum: 0,
      count: 0,
    };
    durationHistograms.set(key, hist);
  }
  hist.sum += durationSeconds;
  hist.count += 1;
  for (let i = 0; i < LATENCY_BUCKETS.length; i += 1) {
    if (durationSeconds <= LATENCY_BUCKETS[i]) {
      hist.bucketCounts[i] += 1;
    }
  }
}

export function incrementNatsMetric(): void {
  natsPublishedTotal += 1;
}

export function prometheusHttpMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Mounted under `/api`, so the mount prefix has to be prepended before the
  // `/api` and `/metrics` filters below can match real request paths.
  const requestPath = `${req.baseUrl || ''}${req.path || '/'}`;
  if (!requestPath.startsWith('/api') && requestPath !== '/metrics') {
    next();
    return;
  }
  const startNs = process.hrtime.bigint();
  res.on('finish', () => {
    const elapsedSec = Number(process.hrtime.bigint() - startNs) / 1e9;
    recordHttpObservation(req.method, normalizeRouteLabel(req), res.statusCode, elapsedSec);
  });
  next();
}

function escapePromLabelValue(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function formatPromLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return '';
  return `{${entries.map(([k, v]) => `${k}="${escapePromLabelValue(v)}"`).join(',')}}`;
}

export function buildPrometheusSnapshot(): JsonPrometheusMetric[] {
  const mem = process.memoryUsage();
  const uptimeSeconds = Math.round(process.uptime());

  const reqValues: Array<{ labels: Record<string, string>; value: number }> = [];
  for (const [k, value] of httpRequestsCounters.entries()) {
    reqValues.push({ labels: JSON.parse(k) as Record<string, string>, value });
  }

  const rlValues: Array<{ labels: Record<string, string>; value: number }> = [];
  for (const [k, value] of rateLimitedCounters.entries()) {
    rlValues.push({ labels: JSON.parse(k) as Record<string, string>, value });
  }

  const durationSummaryValues: Array<{ labels: Record<string, string>; value: number }> = [];
  for (const [k, hist] of durationHistograms.entries()) {
    const parsed = JSON.parse(k) as Record<string, string>;
    durationSummaryValues.push({
      labels: parsed,
      value: hist.count > 0 ? Number(((hist.sum / hist.count) * 1000).toFixed(2)) : 0,
    });
  }

  return [
    {
      name: 'nexus_http_requests_total',
      help: 'Total HTTP API requests grouped by method, route, and status code',
      type: 'counter',
      values: reqValues,
    },
    {
      name: 'nexus_http_request_duration_avg_ms',
      help: 'Average HTTP API latency in milliseconds grouped by route',
      type: 'gauge',
      values: durationSummaryValues,
    },
    {
      name: 'nexus_http_rate_limited_total',
      help: 'Total HTTP requests rejected with 429 Too Many Requests',
      type: 'counter',
      values: rlValues,
    },
    {
      name: 'nexus_nats_published_session_total',
      help: 'Total NATS events observed in current runtime process',
      type: 'counter',
      values: [{ labels: {}, value: natsPublishedTotal }],
    },
    {
      name: 'nexus_process_resident_memory_bytes',
      help: 'Resident set size memory allocated by Node.js runtime',
      type: 'gauge',
      values: [{ labels: {}, value: mem.rss }],
    },
    {
      name: 'nexus_process_heap_used_bytes',
      help: 'Heap memory used by Node.js runtime',
      type: 'gauge',
      values: [{ labels: {}, value: mem.heapUsed }],
    },
    {
      name: 'nexus_process_uptime_seconds',
      help: 'Runtime uptime in seconds',
      type: 'gauge',
      values: [{ labels: {}, value: uptimeSeconds }],
    },
  ];
}

export function renderPrometheusText(): string {
  const lines: string[] = [];
  const snapshot = buildPrometheusSnapshot();

  for (const metric of snapshot) {
    lines.push(`# HELP ${metric.name} ${metric.help}`);
    lines.push(`# TYPE ${metric.name} ${metric.type}`);
    for (const item of metric.values) {
      lines.push(`${metric.name}${formatPromLabels(item.labels)} ${item.value}`);
    }
  }

  // Also include full histogram buckets for http_request_duration_seconds
  lines.push('# HELP http_request_duration_seconds Duration of HTTP requests in seconds');
  lines.push('# TYPE http_request_duration_seconds histogram');
  for (const [k, hist] of durationHistograms.entries()) {
    const baseLabels = JSON.parse(k) as Record<string, string>;
    for (let i = 0; i < hist.buckets.length; i += 1) {
      lines.push(
        `http_request_duration_seconds_bucket${formatPromLabels({ ...baseLabels, le: String(hist.buckets[i]) })} ${hist.bucketCounts[i]}`
      );
    }
    lines.push(
      `http_request_duration_seconds_bucket${formatPromLabels({ ...baseLabels, le: '+Inf' })} ${hist.count}`
    );
    lines.push(`http_request_duration_seconds_sum${formatPromLabels(baseLabels)} ${hist.sum.toFixed(6)}`);
    lines.push(`http_request_duration_seconds_count${formatPromLabels(baseLabels)} ${hist.count}`);
  }

  return `${lines.join('\n')}\n`;
}

export function isMetricsAuthorized(req: Request): boolean {
  const token = process.env.METRICS_TOKEN?.trim();
  if (!token) return true;
  const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const headerToken = req.header('x-metrics-token');
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  return bearer === token || headerToken === token || queryToken === token;
}
