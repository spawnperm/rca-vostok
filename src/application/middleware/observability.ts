import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export interface RequestWithId extends Request {
  requestId?: string;
}

interface HttpMetricsState {
  startedAtMs: number;
  requestsTotal: number;
  inFlight: number;
  errors5xx: number;
  errors4xx: number;
  latencySumMs: number;
  latencyCount: number;
  byMethodStatus: Map<string, number>;
}

const metricsState: HttpMetricsState = {
  startedAtMs: Date.now(),
  requestsTotal: 0,
  inFlight: 0,
  errors5xx: 0,
  errors4xx: 0,
  latencySumMs: 0,
  latencyCount: 0,
  byMethodStatus: new Map<string, number>(),
};

function fullRequestPath(req: Request): string {
  // This middleware is mounted under `/api`, so `req.path` alone is the path
  // relative to the mount point ("/health" instead of "/api/health"). Joining
  // baseUrl keeps log labels and route filters identical to what clients call.
  return `${req.baseUrl || ''}${req.path || '/'}` || '/';
}

function normalizeRouteLabel(req: Request): string {
  return fullRequestPath(req)
    .replace(/\/[a-z]+_[a-zA-Z0-9_-]{4,}/g, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27}/gi, '/:uuid')
    .slice(0, 80);
}

export function getOrCreateRequestId(req: Request): string {
  const withId = req as RequestWithId;
  if (withId.requestId) return withId.requestId;
  const incoming = req.headers['x-request-id'];
  const sanitized =
    typeof incoming === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(incoming.trim())
      ? incoming.trim()
      : `req_${crypto.randomUUID().slice(0, 12)}`;
  withId.requestId = sanitized;
  return sanitized;
}

export function requestObservabilityMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = getOrCreateRequestId(req);
  res.setHeader('X-Request-Id', requestId);

  const startedPerf = performance.now();
  metricsState.inFlight += 1;

  let finalized = false;
  const finalize = () => {
    if (finalized) return;
    finalized = true;
    metricsState.inFlight = Math.max(0, metricsState.inFlight - 1);
    metricsState.requestsTotal += 1;

    const durationMs = Math.max(0.1, performance.now() - startedPerf);
    metricsState.latencySumMs += durationMs;
    metricsState.latencyCount += 1;

    const status = res.statusCode || 200;
    if (status >= 500) {
      metricsState.errors5xx += 1;
    } else if (status >= 400) {
      metricsState.errors4xx += 1;
    }

    const key = `${req.method.toUpperCase()}|${Math.floor(status / 100)}xx`;
    metricsState.byMethodStatus.set(key, (metricsState.byMethodStatus.get(key) || 0) + 1);

    const logLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
    const requestPath = fullRequestPath(req);
    const shouldLog =
      logLevel === 'debug' ||
      (logLevel !== 'silent' &&
        (status >= 500 || (process.env.NODE_ENV === 'production' && !requestPath.startsWith('/api/health'))));

    if (shouldLog) {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
          requestId,
          method: req.method,
          route: normalizeRouteLabel(req),
          status,
          durationMs: Number(durationMs.toFixed(1)),
        })
      );
    }
  };

  res.on('finish', finalize);
  res.on('close', finalize);
  next();
}

export function getHttpMetricsSnapshot(extras?: {
  wsConnections?: number;
  sseSubscribers?: number;
}) {
  const mem = process.memoryUsage();
  const avgLatencyMs =
    metricsState.latencyCount > 0
      ? Number((metricsState.latencySumMs / metricsState.latencyCount).toFixed(2))
      : 0;

  const breakdown: Record<string, number> = {};
  for (const [k, v] of metricsState.byMethodStatus.entries()) {
    breakdown[k] = v;
  }

  return {
    uptimeSeconds: Math.floor(process.uptime()),
    startedAt: new Date(metricsState.startedAtMs).toISOString(),
    http: {
      requestsTotal: metricsState.requestsTotal,
      inFlight: metricsState.inFlight,
      errors4xx: metricsState.errors4xx,
      errors5xx: metricsState.errors5xx,
      avgLatencyMs,
      breakdown,
    },
    process: {
      rssBytes: mem.rss,
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
    },
    realtime: {
      mattermostWsClients: extras?.wsConnections ?? 0,
      natsSseSubscribers: extras?.sseSubscribers ?? 0,
    },
  };
}

export function formatPrometheusMetrics(extras?: {
  wsConnections?: number;
  sseSubscribers?: number;
}): string {
  const snap = getHttpMetricsSnapshot(extras);
  const lines: string[] = [
    '# HELP nexus_uptime_seconds Process uptime in seconds',
    '# TYPE nexus_uptime_seconds gauge',
    `nexus_uptime_seconds ${snap.uptimeSeconds}`,
    '',
    '# HELP nexus_http_requests_total Total HTTP requests handled by /api',
    '# TYPE nexus_http_requests_total counter',
    `nexus_http_requests_total ${snap.http.requestsTotal}`,
    '',
    '# HELP nexus_http_requests_in_flight Current in-flight /api HTTP requests',
    '# TYPE nexus_http_requests_in_flight gauge',
    `nexus_http_requests_in_flight ${snap.http.inFlight}`,
    '',
    '# HELP nexus_http_errors_total HTTP client and server errors',
    '# TYPE nexus_http_errors_total counter',
    `nexus_http_errors_total{class="4xx"} ${snap.http.errors4xx}`,
    `nexus_http_errors_total{class="5xx"} ${snap.http.errors5xx}`,
    '',
    '# HELP nexus_http_request_duration_ms_avg Average HTTP request latency in milliseconds',
    '# TYPE nexus_http_request_duration_ms_avg gauge',
    `nexus_http_request_duration_ms_avg ${snap.http.avgLatencyMs}`,
    '',
    '# HELP nexus_process_resident_memory_bytes Resident set size in bytes',
    '# TYPE nexus_process_resident_memory_bytes gauge',
    `nexus_process_resident_memory_bytes ${snap.process.rssBytes}`,
    '',
    '# HELP nexus_process_heap_used_bytes V8 heap used in bytes',
    '# TYPE nexus_process_heap_used_bytes gauge',
    `nexus_process_heap_used_bytes ${snap.process.heapUsedBytes}`,
    '',
    '# HELP nexus_realtime_connections Active real-time WebSocket and SSE clients',
    '# TYPE nexus_realtime_connections gauge',
    `nexus_realtime_connections{transport="mattermost_ws"} ${snap.realtime.mattermostWsClients}`,
    `nexus_realtime_connections{transport="nats_sse"} ${snap.realtime.natsSseSubscribers}`,
  ];

  return `${lines.join('\n')}\n`;
}
