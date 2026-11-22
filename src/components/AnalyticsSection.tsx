import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Pause,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  exportDfoAnalyticsCsv,
  exportDfoAnalyticsPdf,
} from '../utils/dfoReportExport';
import {
  runLiveDomSeoAudit,
  SECTION_SEO_MAP,
  type LiveSeoAuditResult,
  type SiteTabId,
} from '../utils/seo';
import { DFO_REGIONS_DISTRIBUTION } from '../data/researchData';
import { tracker, type ClientBehaviorEvent } from '../utils/tracker';
import { DfoDemandForecastChart, type DfoRegionFilterId } from './DfoDemandForecastChart';
import { DfoHubsInteractiveMap } from './DfoHubsInteractiveMap';
import { DfoRegionsComparisonTable } from './DfoRegionsComparisonTable';
import { DfoRegionsDistributionMap } from './DfoRegionsDistributionMap';

interface SessionRecord {
  sessionId: string;
  visitorId: string;
  startedAt: string;
  lastSeenAt: string;
  deviceType: string;
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

interface AnalyticsSummaryResponse {
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
  recentSessions: SessionRecord[];
}

interface ServerSeoStatus {
  baseUrl: string;
  robotsUrl: string;
  sitemapUrl: string;
  robotsConfigured: boolean;
  sitemapConfigured: boolean;
  indexedRoutes: number;
}

const TAB_LABELS: Record<string, string> = {
  overview: 'Обзор центра',
  calculator: 'Калькулятор',
  market: 'Рынок ДФО',
  dissertation: 'Диссертация',
  presentations: 'Презентации',
  analytics: 'SEO и аналитика',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  session_start: 'Начало сессии',
  pageview: 'Переход в раздел',
  click: 'Клик',
  scroll: 'Прокрутка',
  interaction: 'Взаимодействие',
  outbound: 'Внешний переход',
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m} мин ${String(s).padStart(2, '0')} с`;
}

function formatTimeStamp(iso: string): string {
  try {
    const dt = new Date(iso);
    return dt.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const AnalyticsSection: React.FC = () => {
  const [subTab, setSubTab] = useState<'visits' | 'behavior' | 'seo'>('visits');
  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState<boolean>(false);

  // Live current session buffer
  const [localEvents, setLocalEvents] = useState<ClientBehaviorEvent[]>(() =>
    tracker.getLocalEvents()
  );

  // Behavior Replay state
  const [selectedSessionId, setSelectedSessionId] = useState<string>(tracker.getSessionId());
  const [sessionEvents, setSessionEvents] = useState<ClientBehaviorEvent[]>([]);
  const [loadingSession, setLoadingSession] = useState<boolean>(false);
  const [replayIndex, setReplayIndex] = useState<number>(-1);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [heatmapFilterTab, setHeatmapFilterTab] = useState<string>('all');
  const [dfoRegionFilter, setDfoRegionFilter] = useState<DfoRegionFilterId>('all');
  const [compareRegionAId, setCompareRegionAId] = useState<string>('primorye');
  const [compareRegionBId, setCompareRegionBId] = useState<string>('kamchatka');
  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // SEO state
  const [seoAudit, setSeoAudit] = useState<LiveSeoAuditResult>(() => runLiveDomSeoAudit());
  const [serverSeo, setServerSeo] = useState<ServerSeoStatus | null>(null);
  const [previewSeoTab, setPreviewSeoTab] = useState<SiteTabId>('overview');

  const currentSessionId = tracker.getSessionId();

  const fetchSummary = useCallback(async () => {
    try {
      setErrorMsg(null);
      tracker.flush(false);
      const res = await fetch('/api/analytics/summary');
      if (!res.ok) throw new Error(`Ошибка сервера (${res.status})`);
      const data = (await res.json()) as AnalyticsSummaryResponse;
      setSummary(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Не удалось загрузить статистику');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSessionDetail = useCallback(
    async (sid: string) => {
      setLoadingSession(true);
      setIsReplaying(false);
      setReplayIndex(-1);
      try {
        const res = await fetch(`/api/analytics/sessions/${encodeURIComponent(sid)}`);
        if (res.ok) {
          const data = (await res.json()) as { events: ClientBehaviorEvent[] };
          if (sid === currentSessionId) {
            // Merge any unflushed local events cleanly
            const serverIds = new Set(data.events.map((e) => e.id));
            const merged = [
              ...data.events,
              ...tracker.getLocalEvents().filter((e) => !serverIds.has(e.id)),
            ];
            setSessionEvents(merged);
          } else {
            setSessionEvents(data.events);
          }
        } else if (sid === currentSessionId) {
          setSessionEvents(tracker.getLocalEvents());
        }
      } catch {
        if (sid === currentSessionId) {
          setSessionEvents(tracker.getLocalEvents());
        }
      } finally {
        setLoadingSession(false);
      }
    },
    [currentSessionId]
  );

  useEffect(() => {
    fetchSummary();
    fetch('/api/seo/server-status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setServerSeo(d as ServerSeoStatus);
      })
      .catch(() => {});

    const unsub = tracker.subscribe(() => {
      setLocalEvents(tracker.getLocalEvents());
    });
    return () => {
      unsub();
    };
  }, [fetchSummary]);

  useEffect(() => {
    if (subTab === 'behavior') {
      fetchSessionDetail(selectedSessionId);
    } else if (subTab === 'seo') {
      setSeoAudit(runLiveDomSeoAudit());
    }
  }, [subTab, selectedSessionId, fetchSessionDetail]);

  // Step-by-step session replay timer
  useEffect(() => {
    if (!isReplaying || sessionEvents.length === 0) return;
    if (replayIndex >= sessionEvents.length - 1) {
      setIsReplaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setReplayIndex((prev) => Math.min(prev + 1, sessionEvents.length - 1));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [isReplaying, replayIndex, sessionEvents.length]);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [exportMenuOpen]);

  const handleExportDfoCsv = () => {
    exportDfoAnalyticsCsv({
      regionFilterId: dfoRegionFilter,
      compareRegionAId,
      compareRegionBId,
      analyticsTotals: summary?.totals ?? null,
    });
    setExportMenuOpen(false);
    tracker.trackCustomInteraction('Экспорт отчета ДФО: CSV', dfoRegionFilter);
  };

  const handleExportDfoPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportDfoAnalyticsPdf({
        regionFilterId: dfoRegionFilter,
        compareRegionAId,
        compareRegionBId,
        analyticsTotals: summary?.totals ?? null,
      });
      tracker.trackCustomInteraction('Экспорт отчета ДФО: PDF', dfoRegionFilter);
    } catch {
      setErrorMsg('Не удалось сформировать PDF-отчет.');
    } finally {
      setExportingPdf(false);
      setExportMenuOpen(false);
    }
  };

  const handleExportJson = () => {
    if (!summary) return;
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rca-vostok-analytics-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics/reset', { method: 'DELETE' });
      if (res.ok) {
        setConfirmClear(false);
        setSessionEvents([]);
        await fetchSummary();
      }
    } catch {
      setErrorMsg('Не удалось очистить журнал');
    }
  };

  const filteredHeatmap = useMemo(() => {
    const pts = summary?.heatmapPoints ?? [];
    if (heatmapFilterTab === 'all') return pts;
    return pts.filter((p) => p.tab === heatmapFilterTab);
  }, [summary, heatmapFilterTab]);

  const previewSeo = SECTION_SEO_MAP[previewSeoTab];
  const activeReplayEvent =
    replayIndex >= 0 && replayIndex < sessionEvents.length ? sessionEvents[replayIndex] : null;

  // Timeline SVG geometry
  const timeline = summary?.timeline ?? [];
  const chartW = 520;
  const chartH = 180;
  const padL = 36;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const maxEvents = Math.max(...timeline.map((t) => t.events), 10);

  return (
    <div className="space-y-8">
      {/* Header & Sub-navigation */}
      <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span>Веб-аналитика</span>
              <span aria-hidden="true">·</span>
              <span>Запись сессий и кликов</span>
              <span aria-hidden="true">·</span>
              <span>SEO-аудит</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 text-balance">
              Мониторинг SEO, статистика посещений и запись поведения пользователей
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Фиксируются реальные визиты, переходы между разделами, глубина прокрутки, координаты
              кликов и взаимодействия с моделью. Текущая сессия:{' '}
              <span className="font-mono text-slate-800">{currentSessionId.slice(0, 8)}</span>{' '}
              ({localEvents.length} событий).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                fetchSummary();
                setSeoAudit(runLiveDomSeoAudit());
              }}
              className="px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Обновить</span>
            </button>
            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
                onClick={() => setExportMenuOpen((prev) => !prev)}
                className="px-3.5 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{exportingPdf ? 'Подготовка PDF…' : 'Экспорт отчета'}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    exportMenuOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {exportMenuOpen && (
                <div
                  role="menu"
                  aria-label="Выбор формата экспорта отчета"
                  className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-30 space-y-1"
                >
                  <button
                    type="button"
                    role="menuitem"
                    disabled={exportingPdf}
                    onClick={() => {
                      void handleExportDfoPdf();
                    }}
                    className="w-full px-3 py-2 text-left rounded-lg hover:bg-slate-50 transition-colors flex items-start gap-2.5 cursor-pointer disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-xs font-semibold text-slate-900">Отчет в PDF (А4)</p>
                      <p className="text-[11px] text-slate-500">
                        Сводка ДФО и парное сравнение
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleExportDfoCsv}
                    className="w-full px-3 py-2 text-left rounded-lg hover:bg-slate-50 transition-colors flex items-start gap-2.5 cursor-pointer"
                  >
                    <FileSpreadsheet
                      className="w-4 h-4 text-teal-700 mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-900">Таблица в CSV (Excel)</p>
                      <p className="text-[11px] text-slate-500">
                        Реестр, спрос, дефицит, 2030 г.
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleExportJson}
              disabled={!summary}
              className="px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-lg hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Экспорт JSON</span>
            </button>
            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="px-3.5 py-2 bg-white border border-slate-300 text-red-700 text-xs font-medium rounded-lg hover:bg-red-50 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Сбросить журнал</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleResetAnalytics}
                  className="px-3 py-2 bg-red-700 text-white text-xs font-semibold rounded-lg hover:bg-red-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Подтвердить сброс
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-3 py-2 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Отмена
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setSubTab('visits')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'visits'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Статистика посещений
          </button>
          <button
            type="button"
            onClick={() => setSubTab('behavior')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'behavior'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Запись поведения и карта кликов
          </button>
          <button
            type="button"
            onClick={() => setSubTab('seo')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'seo'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            SEO-аудит и сниппеты
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
            {errorMsg}
          </div>
        )}
      </section>

      {/* SUB-TAB 1: VISIT STATISTICS */}
      {subTab === 'visits' && (
        <div className="space-y-8">
          {loading && !summary ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((k) => (
                <div key={k} className="bg-white border border-slate-200 rounded-xl p-6 h-28 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* 4 KPI cards */}
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <p className="text-xs font-medium text-slate-500">Записано сессий (визитов)</p>
                  <p className="mt-2 text-3xl font-bold font-mono text-slate-900 tabular-nums">
                    {summary?.totals.sessions ?? 0}
                  </p>
                  <p className="mt-2 text-xs text-slate-600 font-mono tabular-nums">
                    Уникальных устройств: {summary?.totals.uniqueVisitors ?? 0}
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <p className="text-xs font-medium text-slate-500">Просмотры разделов</p>
                  <p className="mt-2 text-3xl font-bold font-mono text-teal-700 tabular-nums">
                    {summary?.totals.pageviews ?? 0}
                  </p>
                  <p className="mt-2 text-xs text-slate-600 font-mono tabular-nums">
                    Всего событий: {summary?.totals.totalEvents ?? 0}
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <p className="text-xs font-medium text-slate-500">Средняя длительность</p>
                  <p className="mt-2 text-3xl font-bold font-mono text-slate-900 tabular-nums">
                    {formatDuration(summary?.totals.avgDurationSec ?? 0)}
                  </p>
                  <p className="mt-2 text-xs text-slate-600 font-mono tabular-nums">
                    Кликов всего: {summary?.totals.totalClicks ?? 0}
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <p className="text-xs font-medium text-slate-500">Средняя глубина скролла</p>
                  <p className="mt-2 text-3xl font-bold font-mono text-slate-900 tabular-nums">
                    {summary?.totals.avgScrollDepth ?? 0}%
                  </p>
                  <p className="mt-2 text-xs text-slate-600">
                    Вовлечённость по прокрутке
                  </p>
                </div>
              </section>

              {/* Activity Timeline & Tab Popularity */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      Динамика активности (события по часам)
                    </h2>
                    <span className="text-xs font-mono text-slate-500">Серверный лог</span>
                  </div>

                  {timeline.length === 0 ? (
                    <div className="h-44 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg">
                      Пока недостаточно интервалов для графика — переходите между разделами сайта
                    </div>
                  ) : (
                    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto">
                      {[0.25, 0.5, 0.75, 1].map((r) => {
                        const y = chartH - padB - r * (chartH - padT - padB);
                        return (
                          <g key={r}>
                            <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#E2E8F0" strokeWidth={1} />
                            <text x={padL - 6} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px] font-mono">
                              {Math.round(maxEvents * r)}
                            </text>
                          </g>
                        );
                      })}
                      <line x1={padL} y1={padT} x2={padL} y2={chartH - padB} stroke="#94A3B8" strokeWidth={1.5} />
                      <line x1={padL} y1={chartH - padB} x2={chartW - padR} y2={chartH - padB} stroke="#94A3B8" strokeWidth={1.5} />

                      {timeline.length > 1 && (
                        <polyline
                          fill="none"
                          stroke="#0F766E"
                          strokeWidth={2.5}
                          points={timeline
                            .map((pt, idx) => {
                              const x = padL + (idx / (timeline.length - 1)) * (chartW - padL - padR);
                              const y = chartH - padB - (pt.events / maxEvents) * (chartH - padT - padB);
                              return `${x.toFixed(1)},${y.toFixed(1)}`;
                            })
                            .join(' ')}
                        />
                      )}

                      {timeline.map((pt, idx) => {
                        const x =
                          timeline.length === 1
                            ? (padL + chartW - padR) / 2
                            : padL + (idx / (timeline.length - 1)) * (chartW - padL - padR);
                        const y = chartH - padB - (pt.events / maxEvents) * (chartH - padT - padB);
                        return (
                          <g key={pt.label + idx}>
                            <circle cx={x} cy={y} r={4} fill="#0F172A" />
                            <text x={x} y={chartH - 10} textAnchor="middle" className="fill-slate-500 text-[10px] font-mono">
                              {pt.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  )}
                </div>

                <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <h2 className="text-base font-bold text-slate-900">
                    Популярность разделов платформы
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 pr-3">Раздел</th>
                          <th className="py-2 px-3 text-right">Просмотры</th>
                          <th className="py-2 px-3 text-right">Клики</th>
                          <th className="py-2 pl-3 text-right">Действия</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {Object.keys(TAB_LABELS).map((tabKey) => {
                          const st = summary?.tabStats[tabKey] ?? { views: 0, clicks: 0, interactions: 0 };
                          return (
                            <tr key={tabKey}>
                              <td className="py-2.5 pr-3 font-medium text-slate-900">
                                {TAB_LABELS[tabKey]}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                                {st.views}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-teal-800">
                                {st.clicks}
                              </td>
                              <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-slate-600">
                                {st.interactions}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* Synchronized DFO Regional Filter Bar */}
              <section
                aria-labelledby="dfo-filter-heading"
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-teal-700">
                      Синхронизированный региональный срез
                    </p>
                    <h2 id="dfo-filter-heading" className="text-base sm:text-lg font-bold text-slate-900">
                      Фильтр по регионам ДФО для графиков и карт
                    </h2>
                  </div>

                  {dfoRegionFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => {
                        setDfoRegionFilter('all');
                        tracker.trackCustomInteraction('Фильтр регионов ДФО: Все субъекты');
                      }}
                      className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Сбросить фильтр (весь ДФО)
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setDfoRegionFilter('all');
                      tracker.trackCustomInteraction('Фильтр регионов ДФО: Все субъекты');
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      dfoRegionFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Все регионы ДФО ({DFO_REGIONS_DISTRIBUTION.length})
                  </button>
                  {DFO_REGIONS_DISTRIBUTION.map((reg) => (
                    <button
                      key={reg.id}
                      type="button"
                      onClick={() => {
                        setDfoRegionFilter(reg.id as DfoRegionFilterId);
                        tracker.trackCustomInteraction(`Фильтр регионов ДФО: ${reg.shortName}`);
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        dfoRegionFilter === reg.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {reg.shortName}
                    </button>
                  ))}
                </div>

                {dfoRegionFilter !== 'all' &&
                  (() => {
                    const chosen = DFO_REGIONS_DISTRIBUTION.find((r) => r.id === dfoRegionFilter);
                    if (!chosen) return null;
                    const deficit = Math.max(0, chosen.estimatedDemand - chosen.certifiedInRegistry);
                    return (
                      <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span className="font-semibold text-slate-900">{chosen.name}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          В реестре: <strong className="text-teal-800">{chosen.certifiedInRegistry} чел.</strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          Спрос 2025: <strong className="text-slate-900">{chosen.estimatedDemand.toLocaleString('ru-RU')} чел.</strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          Кадровый разрыв: <strong className="text-slate-900">{deficit.toLocaleString('ru-RU')} чел.</strong>
                        </span>
                      </div>
                    );
                  })()}
              </section>

              {/* DFO Regional Demand Forecast through 2030 (Recharts) */}
              <DfoDemandForecastChart
                regionFilter={dfoRegionFilter}
                onResetRegionFilter={() => setDfoRegionFilter('all')}
              />

              {/* DFO Geographic Distribution of Certified Guides (SVG) */}
              <DfoRegionsDistributionMap
                regionFilter={dfoRegionFilter}
                onSelectRegionFilter={setDfoRegionFilter}
              />

              {/* DFO Regional Representatives & Partner Tourism Hubs Map */}
              <DfoHubsInteractiveMap
                regionFilter={dfoRegionFilter}
                onSelectRegionFilter={setDfoRegionFilter}
              />

              {/* Two-Region DFO Certification Metrics Comparison Table */}
              <DfoRegionsComparisonTable
                regionAId={compareRegionAId}
                regionBId={compareRegionBId}
                onChangeRegionA={setCompareRegionAId}
                onChangeRegionB={setCompareRegionBId}
                onExportCsv={handleExportDfoCsv}
                onExportPdf={() => {
                  void handleExportDfoPdf();
                }}
              />

              {/* Top Clicked Elements + Devices/Referrers */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <h2 className="text-base font-bold text-slate-900">
                    Самые востребованные элементы интерфейса
                  </h2>
                  {!summary || summary.topClicked.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Клики по кнопкам, фильтрам и ссылкам появятся здесь автоматически.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-200 text-xs">
                      {summary.topClicked.map((item) => (
                        <div key={`${item.tab}-${item.label}`} className="py-2.5 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{item.label}</p>
                            <p className="text-[11px] text-slate-500">
                              {TAB_LABELS[item.tab] ?? item.tab}
                            </p>
                          </div>
                          <span className="font-mono font-semibold text-teal-800 tabular-nums shrink-0">
                            {item.count} кл.
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 mb-3">Устройства посетителей</h2>
                    <div className="space-y-2 text-xs">
                      {Object.entries(summary?.devices ?? {}).map(([dev, count]) => (
                        <div key={dev} className="flex justify-between py-1.5 border-b border-slate-100">
                          <span className="text-slate-700 font-medium">{dev}</span>
                          <span className="font-mono font-semibold tabular-nums">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-slate-900 mb-3">Источники переходов</h2>
                    <div className="space-y-2 text-xs">
                      {Object.entries(summary?.referrers ?? {}).map(([ref, count]) => (
                        <div key={ref} className="flex justify-between py-1.5 border-b border-slate-100">
                          <span className="text-slate-700 font-medium truncate pr-4">{ref}</span>
                          <span className="font-mono font-semibold tabular-nums shrink-0">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {/* SUB-TAB 2: BEHAVIOR RECORDING & CLICK HEATMAP */}
      {subTab === 'behavior' && (
        <div className="space-y-8">
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sessions List */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Записанные сессии</h2>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  {summary?.recentSessions.length ?? 0} шт.
                </span>
              </div>

              <div className="divide-y divide-slate-200 max-h-[480px] overflow-y-auto pr-1">
                {(summary?.recentSessions ?? []).map((sess) => {
                  const isSelected = sess.sessionId === selectedSessionId;
                  const isCurrent = sess.sessionId === currentSessionId;
                  return (
                    <button
                      key={sess.sessionId}
                      type="button"
                      onClick={() => setSelectedSessionId(sess.sessionId)}
                      className={`w-full text-left py-3 px-3 rounded-lg transition-colors cursor-pointer ${
                        isSelected ? 'bg-teal-50/80' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono font-semibold text-slate-900">
                          {sess.sessionId.slice(0, 8)}
                          {isCurrent ? ' (текущая)' : ''}
                        </span>
                        <span className="text-slate-500 font-mono tabular-nums">
                          {formatTimeStamp(sess.startedAt)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                        <span>{sess.deviceType} · {sess.browser}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{sess.viewport}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {sess.eventCount} соб. / {sess.maxScrollDepth}% скролл
                        </span>
                      </div>
                    </button>
                  );
                })}
                {(summary?.recentSessions ?? []).length === 0 && (
                  <p className="py-6 text-xs text-slate-500 text-center">
                    Записанные сессии появятся после отправки первых событий.
                  </p>
                )}
              </div>
            </div>

            {/* Behavior Replay Timeline */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Лента поведения пользователя ({selectedSessionId.slice(0, 8)})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Хронологическая запись переходов, кликов, прокрутки и изменений параметров
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={sessionEvents.length === 0}
                    onClick={() => {
                      if (isReplaying) {
                        setIsReplaying(false);
                      } else {
                        if (replayIndex >= sessionEvents.length - 1 || replayIndex < 0) {
                          setReplayIndex(0);
                        }
                        setIsReplaying(true);
                      }
                    }}
                    className="px-3.5 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isReplaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Пауза</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Воспроизвести путь</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {activeReplayEvent && (
                <div className="p-3.5 bg-slate-900 text-white rounded-lg flex items-center justify-between gap-4 text-xs">
                  <div>
                    <span className="font-mono text-teal-300 mr-2">
                      +{Math.round(activeReplayEvent.elapsedMs / 1000)}с
                    </span>
                    <span className="font-semibold">
                      {EVENT_TYPE_LABELS[activeReplayEvent.type] || activeReplayEvent.type}:
                    </span>{' '}
                    <span>{activeReplayEvent.label}</span>
                  </div>
                  <span className="font-mono text-slate-400 shrink-0 tabular-nums">
                    Шаг {replayIndex + 1} / {sessionEvents.length}
                  </span>
                </div>
              )}

              {loadingSession ? (
                <p className="text-xs text-slate-500 py-8 text-center">Загрузка ленты событий…</p>
              ) : sessionEvents.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">
                  Для выбранной сессии события ещё не зафиксированы.
                </p>
              ) : (
                <div className="divide-y divide-slate-200 max-h-[380px] overflow-y-auto pr-1">
                  {sessionEvents.map((ev, idx) => {
                    const highlighted = idx === replayIndex;
                    return (
                      <div
                        key={ev.id}
                        onClick={() => {
                          setIsReplaying(false);
                          setReplayIndex(idx);
                        }}
                        className={`py-2.5 px-3 flex items-start justify-between gap-4 text-xs rounded-md cursor-pointer transition-colors ${
                          highlighted ? 'bg-teal-50 border border-teal-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-slate-400 tabular-nums">
                              +{Math.round(ev.elapsedMs / 1000)}с
                            </span>
                            <span className="font-semibold text-slate-900">
                              {EVENT_TYPE_LABELS[ev.type] || ev.type}
                            </span>
                            <span className="text-slate-400">/</span>
                            <span className="text-teal-800 font-medium">
                              {TAB_LABELS[ev.tab] ?? ev.tab}
                            </span>
                          </div>
                          <p className="text-slate-700 truncate">{ev.label}</p>
                          {ev.detail && <p className="text-[11px] text-slate-500">{ev.detail}</p>}
                        </div>

                        {typeof ev.xPct === 'number' && typeof ev.yPct === 'number' && (
                          <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                            {ev.xPct}%, {ev.yPct}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Click Heatmap Canvas */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Карта кликов по области экрана (Click Heatmap)
                </h2>
                <p className="text-xs text-slate-500">
                  Отображено точек: <span className="font-mono font-semibold tabular-nums">{filteredHeatmap.length}</span>
                </p>
              </div>

              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['all', 'overview', 'calculator', 'market', 'dissertation', 'presentations', 'analytics'] as const).map(
                  (t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setHeatmapFilterTab(t)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        heatmapFilterTab === t
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t === 'all' ? 'Все разделы' : TAB_LABELS[t]}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="relative w-full aspect-[16/7] min-h-[240px] bg-slate-50 border border-slate-300 rounded-lg overflow-hidden">
              {/* Mocked structural wireframe of viewport to give spatial context */}
              <div className="absolute inset-x-0 top-0 h-8 border-b border-slate-200 bg-white/70 flex items-center px-4 text-[10px] text-slate-400 font-mono">
                Верхняя панель навигации (0% – 8% высоты экрана)
              </div>
              <div className="absolute inset-x-8 top-12 bottom-6 border border-dashed border-slate-200 rounded flex items-center justify-center text-xs text-slate-400 pointer-events-none">
                Рабочая область контента ({heatmapFilterTab === 'all' ? 'все разделы' : TAB_LABELS[heatmapFilterTab]})
              </div>

              {filteredHeatmap.map((pt, i) => (
                <div
                  key={`${pt.xPct}-${pt.yPct}-${i}`}
                  title={`${TAB_LABELS[pt.tab] ?? pt.tab}: ${pt.label} (${pt.xPct}%, ${pt.yPct}%)`}
                  style={{ left: `${pt.xPct}%`, top: `${pt.yPct}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-red-600/20 border border-red-700/60 flex items-center justify-center"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-700" />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* SUB-TAB 3: SEO AUDIT & PREVIEWS */}
      {subTab === 'seo' && (
        <div className="space-y-8">
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Live DOM Audit */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Живой аудит SEO текущей страницы
                  </h2>
                  <p className="text-xs text-slate-500">
                    Автоматическая проверка мета-тегов, OpenGraph, микроразметки и заголовков в DOM
                  </p>
                </div>
                <span className="font-mono text-2xl font-bold text-teal-700 tabular-nums">
                  {seoAudit.score}%
                </span>
              </div>

              <div className="divide-y divide-slate-200">
                {seoAudit.checks.map((chk) => (
                  <div key={chk.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {chk.status === 'pass' ? (
                          <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                        )}
                        <span className="font-semibold text-slate-900">{chk.label}</span>
                      </div>
                      <p className="text-slate-500 pl-6 truncate">{chk.valuePreview}</p>
                    </div>
                    <span className="font-mono text-[11px] text-slate-600 shrink-0 tabular-nums">
                      {chk.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* SERP & OpenGraph Preview + Technical Endpoints */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-slate-900">Превью сниппета в поиске</h2>
                  <select
                    aria-label="Выберите раздел для превью SEO"
                    value={previewSeoTab}
                    onChange={(e) => setPreviewSeoTab(e.target.value as SiteTabId)}
                    className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-white text-slate-800"
                  >
                    {Object.values(SECTION_SEO_MAP).map((s) => (
                      <option key={s.tab} value={s.tab}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Engine Result Card */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                  <p className="text-[11px] text-slate-500 font-mono truncate">
                    {serverSeo?.baseUrl || window.location.origin}/{previewSeo.pathQuery}
                  </p>
                  <p className="text-base font-semibold text-blue-800 leading-snug">
                    {previewSeo.title}
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {previewSeo.description}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 pt-1 tabular-nums">
                    title: {previewSeo.title.length} симв. · description: {previewSeo.description.length} симв.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-900">Технические файлы индексации</h2>
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">robots.txt</p>
                      <p className="text-slate-500">Разрешает индексацию, закрывает /api/</p>
                    </div>
                    <a
                      href="/robots.txt"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-700 hover:text-teal-900 font-medium inline-flex items-center gap-1 shrink-0"
                    >
                      <span>Открыть</span>
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">sitemap.xml</p>
                      <p className="text-slate-500 font-mono tabular-nums">
                        {serverSeo?.indexedRoutes ?? 6} индексируемых маршрутов
                      </p>
                    </div>
                    <a
                      href="/sitemap.xml"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-700 hover:text-teal-900 font-medium inline-flex items-center gap-1 shrink-0"
                    >
                      <span>Открыть</span>
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
