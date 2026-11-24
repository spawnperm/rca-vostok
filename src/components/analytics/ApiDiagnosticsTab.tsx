import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Code2,
  ExternalLink,
  Gauge,
  Play,
  RefreshCw,
  Server,
} from 'lucide-react';
import { formatDuration } from '../../utils/format';
import { ApiStatusIndicator } from '../ApiStatusIndicator';
import {
  API_CATEGORY_LABELS,
  API_ENDPOINTS_REFERENCE,
  type ApiEndpointCategory,
  type ServerMetricsSnapshot,
} from './types';

interface ProbeResult {
  status: number;
  ok: boolean;
  latencyMs: number;
  preview: string;
}

export const ApiDiagnosticsTab: React.FC = () => {
  const [metrics, setMetrics] = useState<ServerMetricsSnapshot | null>(null);
  const [metricsLoading, setMetricsLoading] = useState<boolean>(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | ApiEndpointCategory>('all');
  const [probes, setProbes] = useState<Record<string, ProbeResult>>({});
  const [probingPath, setProbingPath] = useState<string | null>(null);
  const [expandedProbePath, setExpandedProbePath] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const res = await fetch('/api/metrics', { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as ServerMetricsSnapshot;
      setMetrics(data);
    } catch (err) {
      setMetricsError(err instanceof Error ? err.message : 'Не удалось загрузить метрики');
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  const handleRunProbe = async (path: string) => {
    setProbingPath(path);
    const t0 = performance.now();
    try {
      const res = await fetch(path, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const latencyMs = Math.round(performance.now() - t0);
      const rawText = await res.text();
      let formatted = rawText;
      try {
        formatted = JSON.stringify(JSON.parse(rawText), null, 2);
      } catch {
        // non-json payload
      }
      setProbes((prev) => ({
        ...prev,
        [path]: {
          status: res.status,
          ok: res.ok,
          latencyMs,
          preview: formatted.slice(0, 1800),
        },
      }));
      setExpandedProbePath(path);
    } catch (err) {
      const latencyMs = Math.round(performance.now() - t0);
      setProbes((prev) => ({
        ...prev,
        [path]: {
          status: 0,
          ok: false,
          latencyMs,
          preview: err instanceof Error ? err.message : 'Сетевой сбой',
        },
      }));
      setExpandedProbePath(path);
    } finally {
      setProbingPath(null);
    }
  };

  const topRoutes = useMemo(() => {
    if (!metrics?.byRoute) return [];
    return Object.entries(metrics.byRoute)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6);
  }, [metrics]);

  const filteredEndpoints = useMemo(() => {
    if (categoryFilter === 'all') return API_ENDPOINTS_REFERENCE;
    return API_ENDPOINTS_REFERENCE.filter((ep) => ep.category === categoryFilter);
  }, [categoryFilter]);

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Connection & Links */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Проверка соединения</span>
              </p>
              <h2 className="text-base font-bold text-slate-900">Состояние серверного API</h2>
            </div>
            <ApiStatusIndicator />
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Сервер работает на Node.js / Express (порт 3000) с автоматическим выбором
            хранилища (PostgreSQL или локальные JSON-адаптеры), CSP-заголовками и Rate-limit.
          </p>

          <div className="pt-2 border-t border-slate-200 space-y-2.5">
            <a
              href="/api/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-between px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <Code2 className="w-4 h-4 text-teal-300" aria-hidden="true" />
                Интерактивная документация OpenAPI (Scalar)
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
            </a>
            <div className="grid grid-cols-2 gap-2.5">
              <a
                href="/api/health"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between px-3.5 py-2.5 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  /api/health
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              </a>
              <a
                href="/api/metrics"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between px-3.5 py-2.5 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  /api/metrics
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>

        {/* Live Telemetry from /api/metrics */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Телеметрия процесса (/api/metrics)
              </h2>
              <p className="text-xs text-slate-500">
                Живые счётчики HTTP-запросов, латентность и использование памяти Node.js
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchMetrics()}
              disabled={metricsLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${metricsLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Обновить метрики</span>
            </button>
          </div>

          {metricsError && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Не удалось прочитать /api/metrics: {metricsError}
            </p>
          )}

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <dt className="text-[11px] text-slate-500">Всего запросов</dt>
              <dd className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
                {metrics?.requests.total ?? '—'}
              </dd>
              <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                uptime {metrics ? formatDuration(metrics.uptimeSec) : '—'}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <dt className="text-[11px] text-slate-500">Задержка p50 / p95</dt>
              <dd className="mt-1 text-lg font-bold font-mono tabular-nums text-teal-800">
                {metrics ? `${metrics.latency.p50} / ${metrics.latency.p95} мс` : '—'}
              </dd>
              <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                макс. {metrics?.latency.max ?? 0} мс
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <dt className="text-[11px] text-slate-500">Ошибки 4xx / 5xx</dt>
              <dd className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
                {metrics
                  ? `${metrics.requests.clientErrors4xx} / ${metrics.requests.errors5xx}`
                  : '—'}
              </dd>
              <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                429 лимит: {metrics?.requests.rateLimited ?? 0}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <dt className="text-[11px] text-slate-500">Память Heap / RSS</dt>
              <dd className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
                {metrics
                  ? `${metrics.process.heapUsedMb} / ${metrics.process.rssMb} МБ`
                  : '—'}
              </dd>
              <p className="text-[11px] text-slate-500">Node.js runtime</p>
            </div>
          </dl>

          {topRoutes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-1.5 pr-3">Активный маршрут</th>
                    <th className="py-1.5 px-3 text-right">Вызовы</th>
                    <th className="py-1.5 px-3 text-right">Средн. (мс)</th>
                    <th className="py-1.5 pl-3 text-right">p95 (мс)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topRoutes.map(([routeKey, stat]) => (
                    <tr key={routeKey}>
                      <td className="py-1.5 pr-3 font-mono text-slate-800 truncate max-w-[260px]">
                        {routeKey}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {stat.count}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {stat.avgMs}
                      </td>
                      <td className="py-1.5 pl-3 text-right font-mono tabular-nums text-teal-800">
                        {stat.p95Ms}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Interactive API Reference & Live Endpoint Tester */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Справочник и живая проверка маршрутов REST API ({filteredEndpoints.length})
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Базовый префикс: <code className="font-mono">/api</code> · Для GET-методов доступна
              мгновенная проверка ответа сервера
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Фильтр категорий API"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start lg:self-auto"
          >
            {(Object.keys(API_CATEGORY_LABELS) as ('all' | ApiEndpointCategory)[]).map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={categoryFilter === cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {API_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">Метод</th>
                <th className="py-2 px-3">Маршрут</th>
                <th className="py-2 px-3">Назначение</th>
                <th className="py-2 px-3">Доступ</th>
                <th className="py-2 pl-3 text-right">Проверка</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredEndpoints.map((ep) => {
                const probe = probes[ep.path];
                const isExpanded = expandedProbePath === ep.path;
                return (
                  <React.Fragment key={`${ep.method}-${ep.path}`}>
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 pr-3 font-mono font-semibold text-teal-800 whitespace-nowrap">
                        {ep.method}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-900 whitespace-nowrap">
                        {ep.path}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{ep.description}</td>
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{ep.auth}</td>
                      <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                        {ep.testableGet ? (
                          <div className="inline-flex items-center gap-2">
                            {probe && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedProbePath(isExpanded ? null : ep.path)
                                }
                                className={`font-mono text-[11px] font-semibold tabular-nums underline cursor-pointer ${
                                  probe.ok ? 'text-teal-700' : 'text-amber-700'
                                }`}
                              >
                                {probe.status || 'ERR'} · {probe.latencyMs} мс
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={probingPath === ep.path}
                              onClick={() => void handleRunProbe(ep.path)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <Play className="w-3 h-3 text-teal-700" aria-hidden="true" />
                              <span>{probingPath === ep.path ? 'Запрос…' : 'Проверить'}</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                    {probe && isExpanded && (
                      <tr>
                        <td colSpan={5} className="bg-slate-950 text-slate-100 px-4 py-3">
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                            <span className="font-mono">
                              GET {ep.path} → HTTP {probe.status} ({probe.latencyMs} мс)
                            </span>
                            <button
                              type="button"
                              onClick={() => setExpandedProbePath(null)}
                              className="text-slate-300 hover:text-white cursor-pointer"
                            >
                              Скрыть ответ
                            </button>
                          </div>
                          <pre className="text-[11px] font-mono overflow-x-auto max-h-56 leading-relaxed text-teal-200">
                            {probe.preview}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
