import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Check, Copy, Pause, Play, RefreshCw } from 'lucide-react';
import { refineClient } from '../../application/refine/client.ts';
import type { JsonPrometheusMetric } from '../../infrastructure/telemetry/prometheusMetrics.ts';
import { getErrorMessage } from '../../shared/formatters.ts';

interface PrometheusMetricsViewerProps {
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
}

export const PrometheusMetricsViewer: React.FC<PrometheusMetricsViewerProps> = ({
  onNotify,
}) => {
  const [metrics, setMetrics] = useState<JsonPrometheusMetric[]>([]);
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [livePolling, setLivePolling] = useState(true);
  const [lastScrapedAt, setLastScrapedAt] = useState<string | null>(null);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const [jsonRes, textRes] = await Promise.all([
        refineClient.request<{ metrics: JsonPrometheusMetric[]; collectedAt: string }>(
          '/api/metrics/json'
        ),
        fetch('/metrics').then((r) => (r.ok ? r.text() : '')),
      ]);
      setMetrics(jsonRes.metrics || []);
      setRawText(textRes);
      setLastScrapedAt(jsonRes.collectedAt || new Date().toISOString());
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка загрузки Prometheus-метрик'), 'err');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    if (!livePolling) return;
    const timer = window.setInterval(() => {
      void loadMetrics();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [livePolling, loadMetrics]);

  const summary = useMemo(() => {
    const findSingle = (name: string) =>
      metrics.find((m) => m.name === name)?.values?.[0]?.value ?? 0;
    const reqMetric = metrics.find((m) => m.name === 'nexus_http_requests_total');
    const totalRequests = (reqMetric?.values || []).reduce((sum, item) => sum + item.value, 0);
    return {
      totalRequests,
      natsPublished: findSingle('nexus_nats_published_session_total'),
      rssMb: Math.round(findSingle('nexus_process_resident_memory_bytes') / (1024 * 1024)),
      uptimeSec: findSingle('nexus_process_uptime_seconds'),
    };
  }, [metrics]);

  const routeChartData = useMemo(() => {
    const reqMetric = metrics.find((m) => m.name === 'nexus_http_requests_total');
    const latMetric = metrics.find((m) => m.name === 'nexus_http_request_duration_avg_ms');
    const byRoute = new Map<string, { route: string; requests: number; avgLatencyMs: number }>();

    for (const v of reqMetric?.values || []) {
      const route = `${v.labels.method || 'GET'} ${v.labels.route || '/'}`;
      const existing = byRoute.get(route) || { route, requests: 0, avgLatencyMs: 0 };
      existing.requests += v.value;
      byRoute.set(route, existing);
    }
    for (const v of latMetric?.values || []) {
      const route = `${v.labels.method || 'GET'} ${v.labels.route || '/'}`;
      const existing = byRoute.get(route) || { route, requests: 0, avgLatencyMs: 0 };
      existing.avgLatencyMs = v.value;
      byRoute.set(route, existing);
    }

    return Array.from(byRoute.values())
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 8);
  }, [metrics]);

  const handleCopyScrapeCmd = async () => {
    try {
      await navigator.clipboard.writeText(`curl -s ${window.location.origin}/metrics`);
      setCopiedCurl(true);
      window.setTimeout(() => setCopiedCurl(false), 1800);
      onNotify('Команда scrape для Prometheus скопирована');
    } catch {
      onNotify('Не удалось скопировать в буфер обмена', 'err');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Activity className="h-4 w-4 text-[#0077FF]" />
            Экспортёр Prometheus (/metrics · OpenMetrics 0.0.4)
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Реальное время · Последний срез:{' '}
            {lastScrapedAt ? new Date(lastScrapedAt).toLocaleTimeString('ru-RU') : '—'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setLivePolling((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            {livePolling ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {livePolling ? 'Пауза (5с)' : 'Возобновить'}
          </button>
          <button
            type="button"
            onClick={() => void handleCopyScrapeCmd()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            {copiedCurl ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedCurl ? 'Скопировано' : 'curl /metrics'}
          </button>
          <button
            type="button"
            onClick={() => void loadMetrics()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0066DB] disabled:opacity-60 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <div className="text-[11px] font-medium text-slate-500">HTTP-запросы (сессия)</div>
          <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums">
            {summary.totalRequests}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <div className="text-[11px] font-medium text-slate-500">Событий NATS</div>
          <div className="mt-1 text-xl font-bold text-[#0077FF] tabular-nums">
            {summary.natsPublished}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <div className="text-[11px] font-medium text-slate-500">Память RSS процесса</div>
          <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums">
            {summary.rssMb} MB
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <div className="text-[11px] font-medium text-slate-500">Uptime сервера</div>
          <div className="mt-1 text-xl font-bold text-emerald-700 tabular-nums">
            {summary.uptimeSec} сек
          </div>
        </div>
      </div>

      {/* Top Routes Recharts Visualization + Raw Prometheus Exposition */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-7">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-900">Нагрузка и задержка API-маршрутов</span>
            <span className="text-slate-500">Запросы · Средняя задержка (мс)</span>
          </div>
          {routeChartData.length === 0 ? (
            <div className="flex h-60 items-center justify-center text-xs text-slate-400">
              Выполните несколько запросов в портале для наполнения гистограмм
            </div>
          ) : (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={routeChartData} margin={{ top: 8, right: 12, left: -12, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="route"
                    tick={{ fontSize: 10, fill: '#475569' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip />
                  <Bar dataKey="requests" name="Запросов" fill="#0077FF" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="avgLatencyMs" name="Задержка (мс)" fill="#16A34A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-5">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-900">Сырой вывод /api/metrics</span>
            <span className="font-mono text-[11px] text-slate-400">text/plain; version=0.0.4</span>
          </div>
          <pre className="h-60 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-200">
            {rawText || '# Ожидание данных метрик...'}
          </pre>
        </div>
      </div>
    </div>
  );
};
