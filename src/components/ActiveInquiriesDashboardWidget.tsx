import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Clock,
  Database,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { tracker } from '../utils/tracker';

export interface InquiryStatsSnapshot {
  totalSubscriptions: number;
  activeCount: number;
  byStatus: {
    new: number;
    in_review: number;
    approved: number;
    rejected: number;
  };
  byRegion: { region: string; count: number }[];
  byTrack: { track: string; count: number }[];
  lastInquiryAt: string | null;
  updatedAt: string;
}

interface ActiveInquiriesDashboardWidgetProps {
  refreshKey?: number;
  onScrollToForm: () => void;
  onContactCurator: (source: string) => void;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
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

export const ActiveInquiriesDashboardWidget: React.FC<
  ActiveInquiriesDashboardWidgetProps
> = ({ refreshKey = 0, onScrollToForm, onContactCurator }) => {
  const [stats, setStats] = useState<InquiryStatsSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [streamConnected, setStreamConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (manual = false) => {
    if (manual) {
      setRefreshing(true);
    }
    try {
      const res = await fetch('/api/inquiries/stats', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as InquiryStatsSnapshot;
      setStats(data);
      setError(null);
    } catch {
      setError('Не удалось загрузить статистику заявок из базы РЦА.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch initial data and whenever parent signals a new submission via refreshKey
  useEffect(() => {
    void fetchStats(false);
  }, [fetchStats, refreshKey]);

  // Real-time Server-Sent Events stream with automatic polling fallback
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let pollTimer: number | null = null;

    const startFallbackPolling = () => {
      if (pollTimer !== null) return;
      pollTimer = window.setInterval(() => {
        void fetchStats(false);
      }, 15000);
    };

    if (typeof EventSource !== 'undefined') {
      eventSource = new EventSource('/api/inquiries/stats/stream');

      eventSource.addEventListener('open', () => {
        setStreamConnected(true);
        if (pollTimer !== null) {
          window.clearInterval(pollTimer);
          pollTimer = null;
        }
      });

      const handleStatsEvent = (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data) as InquiryStatsSnapshot;
          setStats(parsed);
          setLoading(false);
          setError(null);
          setStreamConnected(true);
        } catch {
          // Ignore malformed event payloads
        }
      };

      eventSource.addEventListener('message', handleStatsEvent);
      eventSource.addEventListener('stats', handleStatsEvent);

      eventSource.addEventListener('error', () => {
        setStreamConnected(false);
        startFallbackPolling();
      });
    } else {
      startFallbackPolling();
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
      }
    };
  }, [fetchStats]);

  const total = stats?.totalSubscriptions ?? 0;
  const activeCount = stats?.activeCount ?? 0;
  const byStatus = stats?.byStatus ?? { new: 0, in_review: 0, approved: 0, rejected: 0 };

  const newPct = total > 0 ? Math.round((byStatus.new / total) * 100) : 0;
  const reviewPct = total > 0 ? Math.round((byStatus.in_review / total) * 100) : 0;
  const approvedPct = total > 0 ? Math.round((byStatus.approved / total) * 100) : 0;
  const rejectedPct = total > 0 ? Math.max(0, 100 - newPct - reviewPct - approvedPct) : 0;

  const topRegions = stats?.byRegion.slice(0, 4) ?? [];
  const topTracks = stats?.byTrack.slice(0, 4) ?? [];

  return (
    <section
      aria-labelledby="active-inquiries-dashboard-heading"
      className="bg-slate-900 text-white border border-slate-800 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Top Bar */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-teal-300">
            <Database className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Реестр обращений соискателей · База РЦА «Русский Восток»</span>
          </div>
          <h2
            id="active-inquiries-dashboard-heading"
            className="text-xl sm:text-2xl font-bold text-white leading-snug"
          >
            Дашборд активных заявок на аттестацию
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Оперативная сводка по поступающим заявкам на включение в аттестационные потоки ВВГУ и
            межрегиональные комиссии ДФО в реальном времени.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800/90 border border-slate-700 rounded-lg text-xs text-slate-200 font-mono tabular-nums">
            <span
              className={`w-2 h-2 rounded-full ${
                streamConnected ? 'bg-teal-400 animate-pulse' : 'bg-amber-400'
              }`}
              aria-hidden="true"
            />
            <span>{streamConnected ? 'Поток реального времени' : 'Автообновление'}</span>
          </span>

          <button
            type="button"
            onClick={() => {
              void fetchStats(true);
              tracker.trackCustomInteraction('Дашборд заявок: ручное обновление');
            }}
            disabled={refreshing}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-100 text-xs font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Обновить</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 bg-red-950/60 border border-red-800 rounded-lg text-xs text-red-200"
        >
          {error}
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 border border-teal-700/60 rounded-xl p-5 flex flex-col justify-between gap-2">
          <p className="text-xs font-medium text-teal-300">Активные заявки в работе</p>
          <p className="text-4xl font-bold font-mono text-white tabular-nums">
            {loading ? '—' : activeCount}
          </p>
          <p className="text-[11px] text-slate-300">
            Новые обращения и заявки на проверке комиссии
          </p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-5 flex flex-col justify-between gap-2">
          <p className="text-xs font-medium text-slate-400">Ожидают первичной проверки</p>
          <p className="text-3xl font-bold font-mono text-amber-300 tabular-nums">
            {loading ? '—' : byStatus.new}
          </p>
          <p className="text-[11px] text-slate-400">Статус: «Новая» (входной поток)</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-5 flex flex-col justify-between gap-2">
          <p className="text-xs font-medium text-slate-400">На рассмотрении комиссии</p>
          <p className="text-3xl font-bold font-mono text-sky-300 tabular-nums">
            {loading ? '—' : byStatus.in_review}
          </p>
          <p className="text-[11px] text-slate-400">Сверка походного опыта и допусков</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-5 flex flex-col justify-between gap-2">
          <p className="text-xs font-medium text-slate-400">Всего в базе / Одобрено</p>
          <p className="text-3xl font-bold font-mono text-slate-100 tabular-nums">
            {loading ? '—' : `${total} / ${byStatus.approved}`}
          </p>
          <p className="text-[11px] text-slate-400">
            С учётом завершённых заявок{byStatus.rejected > 0 ? ` (откл.: ${byStatus.rejected})` : ''}
          </p>
        </div>
      </div>

      {/* Status Distribution Stacked Progress Bar */}
      <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-200">Воронка обработки заявок в базе РЦА</span>
          <span className="font-mono text-slate-400 tabular-nums">
            Доля активных: {total > 0 ? Math.round((activeCount / total) * 100) : 0}% от всех записей
          </span>
        </div>

        <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex">
          {total > 0 ? (
            <>
              {byStatus.new > 0 && (
                <div
                  className="h-full bg-amber-400 transition-all duration-300"
                  style={{ width: `${newPct}%` }}
                  title={`Новые: ${byStatus.new}`}
                />
              )}
              {byStatus.in_review > 0 && (
                <div
                  className="h-full bg-sky-400 transition-all duration-300"
                  style={{ width: `${reviewPct}%` }}
                  title={`На проверке: ${byStatus.in_review}`}
                />
              )}
              {byStatus.approved > 0 && (
                <div
                  className="h-full bg-teal-500 transition-all duration-300"
                  style={{ width: `${approvedPct}%` }}
                  title={`Одобрено: ${byStatus.approved}`}
                />
              )}
              {byStatus.rejected > 0 && (
                <div
                  className="h-full bg-slate-600 transition-all duration-300"
                  style={{ width: `${rejectedPct}%` }}
                  title={`Отклонено: ${byStatus.rejected}`}
                />
              )}
            </>
          ) : (
            <div className="h-full w-full bg-slate-800" />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-400" aria-hidden="true" />
            Новые ({byStatus.new})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-sky-400" aria-hidden="true" />
            На проверке ({byStatus.in_review})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-teal-500" aria-hidden="true" />
            Одобрено ({byStatus.approved})
          </span>
          {byStatus.rejected > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-600" aria-hidden="true" />
              Отклонено ({byStatus.rejected})
            </span>
          )}
        </div>
      </div>

      {/* Breakdown by Region & Track */}
      {total === 0 && !loading ? (
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
            В базе сейчас нет открытых заявок. Отправьте заявку в форме обратной связи внизу
            страницы — счётчик активных заявок и срез по направлениям обновятся мгновенно.
          </p>
          <button
            type="button"
            onClick={onScrollToForm}
            className="px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-500 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Перейти к форме заявки</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Regions Breakdown */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-5 space-y-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Заявки по регионам ДФО</span>
              <span className="font-mono text-slate-400 tabular-nums">
                {stats?.byRegion.length ?? 0} рег.
              </span>
            </div>
            <div className="space-y-3">
              {topRegions.map((item) => {
                const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div key={item.region} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="text-slate-200 truncate">{item.region}</span>
                      <span className="font-mono text-teal-300 tabular-nums shrink-0">
                        {item.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tracks Breakdown */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-5 space-y-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Востребованные направления</span>
              <span className="font-mono text-slate-400 tabular-nums">
                {stats?.byTrack.length ?? 0} треков
              </span>
            </div>
            <div className="space-y-3">
              {topTracks.map((item) => {
                const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div key={item.track} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="text-slate-200 truncate">{item.track}</span>
                      <span className="font-mono text-amber-300 tabular-nums shrink-0">
                        {item.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Footer Metadata & CTAs */}
      <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-slate-400 font-mono tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span>Обновлено: {formatDateTime(stats?.updatedAt)}</span>
          </span>
          {stats?.lastInquiryAt && (
            <span>Последнее обращение: {formatDateTime(stats.lastInquiryAt)}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onContactCurator('Дашборд активных заявок')}
            className="px-3.5 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-xs font-medium rounded-lg hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
            <span>Консультация куратора</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onScrollToForm();
              tracker.trackCustomInteraction('Дашборд заявок: переход к подаче заявки');
            }}
            className="px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-500 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Подать заявку на аттестацию</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
};
