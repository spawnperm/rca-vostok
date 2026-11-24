import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  exportDfoAnalyticsCsv,
  exportDfoAnalyticsPdf,
} from '../utils/dfoReportExport';
import { downloadJsonFile } from '../utils/download';
import {
  runLiveDomSeoAudit,
  type LiveSeoAuditResult,
} from '../utils/seo';
import { tracker, type ClientBehaviorEvent } from '../utils/tracker';
import { ApiDiagnosticsTab } from './analytics/ApiDiagnosticsTab';
import { BehavioralAnalyticsTab } from './analytics/BehavioralAnalyticsTab';
import { SeoAuditTab } from './analytics/SeoAuditTab';
import type {
  AnalyticsSubTab,
  AnalyticsSummaryResponse,
  ServerSeoStatus,
} from './analytics/types';

interface AnalyticsSectionProps {
  initialSubTab?: string;
  onSubTabChange?: (subTab: string) => void;
}

const VALID_ANALYTICS_SUBTABS = new Set<AnalyticsSubTab>(['behavior', 'seo', 'api']);

function resolveAnalyticsSubTab(sub?: string): AnalyticsSubTab {
  if (sub && VALID_ANALYTICS_SUBTABS.has(sub as AnalyticsSubTab)) {
    return sub as AnalyticsSubTab;
  }
  return 'behavior';
}

export const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({
  initialSubTab,
  onSubTabChange,
}) => {
  const [subTab, setSubTab] = useState<AnalyticsSubTab>(() =>
    resolveAnalyticsSubTab(initialSubTab)
  );
  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState<boolean>(false);

  const [localEvents, setLocalEvents] = useState<ClientBehaviorEvent[]>(() =>
    tracker.getLocalEvents()
  );

  // Behavior Replay state
  const [selectedSessionId, setSelectedSessionId] = useState<string>(tracker.getSessionId());
  const [sessionEvents, setSessionEvents] = useState<ClientBehaviorEvent[]>([]);
  const [loadingSession, setLoadingSession] = useState<boolean>(false);
  const [replayIndex, setReplayIndex] = useState<number>(-1);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);

  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // SEO state
  const [seoAudit, setSeoAudit] = useState<LiveSeoAuditResult>(() => runLiveDomSeoAudit());
  const [serverSeo, setServerSeo] = useState<ServerSeoStatus | null>(null);

  const currentSessionId = tracker.getSessionId();

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(resolveAnalyticsSubTab(initialSubTab));
    }
  }, [initialSubTab]);

  const handleSelectSubTab = (next: AnalyticsSubTab) => {
    setSubTab(next);
    onSubTabChange?.(next);
  };

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
    void fetchSummary();
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
      void fetchSessionDetail(selectedSessionId);
    } else if (subTab === 'seo') {
      setSeoAudit(runLiveDomSeoAudit());
    }
  }, [subTab, selectedSessionId, fetchSessionDetail]);

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
      regionFilterId: 'all',
      compareRegionAId: 'primorye',
      compareRegionBId: 'kamchatka',
      analyticsTotals: summary?.totals ?? null,
    });
    setExportMenuOpen(false);
    tracker.trackCustomInteraction('Экспорт сводки ДФО и аналитики: CSV', 'analytics');
  };

  const handleExportDfoPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportDfoAnalyticsPdf({
        regionFilterId: 'all',
        compareRegionAId: 'primorye',
        compareRegionBId: 'kamchatka',
        analyticsTotals: summary?.totals ?? null,
      });
      tracker.trackCustomInteraction('Экспорт сводки ДФО и аналитики: PDF', 'analytics');
    } catch {
      setErrorMsg('Не удалось сформировать PDF-отчет.');
    } finally {
      setExportingPdf(false);
      setExportMenuOpen(false);
    }
  };

  const handleExportJson = () => {
    if (!summary) return;
    downloadJsonFile(
      summary,
      `rca-vostok-analytics-${new Date().toISOString().slice(0, 10)}.json`
    );
  };

  const handleResetAnalytics = async () => {
    try {
      setErrorMsg(null);
      const res = await fetch('/api/analytics/reset', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'fetch' },
      });
      if (res.ok) {
        setConfirmClear(false);
        setSessionEvents([]);
        await fetchSummary();
        return;
      }
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setConfirmClear(false);
      if (res.status === 401 || res.status === 403) {
        setErrorMsg(
          payload.error ||
            'Очистка журнала аналитики доступна только авторизованному куратору или администратору в личном кабинете.'
        );
      } else {
        setErrorMsg(payload.error || `Не удалось очистить журнал (${res.status})`);
      }
    } catch {
      setErrorMsg('Не удалось очистить журнал');
    }
  };

  return (
    <div className="space-y-8">
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span>Поведенческая аналитика</span>
              <span aria-hidden="true">·</span>
              <span>SEO-аудит</span>
              <span aria-hidden="true">·</span>
              <span>API и OpenAPI</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 text-balance">
              Аналитика платформы, SEO-мониторинг и диагностика API
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Единый пульт администратора и исследователя: статистика посещений, воспроизведение
              пользовательских сессий, карта кликов, живой SEO-аудит и телеметрия серверного API.
              Текущая сессия:{' '}
              <span className="font-mono text-slate-800">{currentSessionId.slice(0, 8)}</span>{' '}
              ({localEvents.length} событий).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void fetchSummary();
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
                <span>{exportingPdf ? 'Подготовка PDF…' : 'Экспорт отчёта'}</span>
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
                  aria-label="Выбор формата экспорта отчёта"
                  className="absolute right-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-30 space-y-1"
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
                      <p className="text-xs font-semibold text-slate-900">Сводный отчёт PDF (А4)</p>
                      <p className="text-[11px] text-slate-500">ДФО + метрики платформы</p>
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
                      <p className="text-[11px] text-slate-500">Показатели ДФО и спроса</p>
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
              <span>JSON</span>
            </button>

            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="px-3.5 py-2 bg-white border border-slate-300 text-red-700 text-xs font-medium rounded-lg hover:bg-red-50 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Сбросить</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleResetAnalytics}
                  className="px-3 py-2 bg-red-700 text-white text-xs font-semibold rounded-lg hover:bg-red-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Подтвердить
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
        <div
          role="tablist"
          aria-label="Подразделы аналитики"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {(
            [
              { id: 'behavior', label: 'Поведенческая аналитика' },
              { id: 'seo', label: 'SEO-аудит и индексация' },
              { id: 'api', label: 'API, метрики и OpenAPI' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={subTab === tab.id}
              onClick={() => handleSelectSubTab(tab.id)}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
            {errorMsg}
          </div>
        )}
      </section>

      {subTab === 'behavior' && (
        <BehavioralAnalyticsTab
          summary={summary}
          loading={loading}
          currentSessionId={currentSessionId}
          selectedSessionId={selectedSessionId}
          onSelectSessionId={setSelectedSessionId}
          sessionEvents={sessionEvents}
          loadingSession={loadingSession}
          replayIndex={replayIndex}
          isReplaying={isReplaying}
          onToggleReplay={() => {
            if (isReplaying) {
              setIsReplaying(false);
            } else {
              if (replayIndex >= sessionEvents.length - 1 || replayIndex < 0) {
                setReplayIndex(0);
              }
              setIsReplaying(true);
            }
          }}
          onSelectReplayIndex={(idx) => {
            setIsReplaying(false);
            setReplayIndex(idx);
          }}
        />
      )}

      {subTab === 'seo' && <SeoAuditTab seoAudit={seoAudit} serverSeo={serverSeo} />}

      {subTab === 'api' && <ApiDiagnosticsTab />}
    </div>
  );
};
