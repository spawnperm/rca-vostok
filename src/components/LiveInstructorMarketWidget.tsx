import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Calculator,
  Compass,
  RefreshCw,
} from 'lucide-react';
import type {
  LiveInstructorMarketSnapshot,
  LiveMarketRegionRow,
} from '../application/market/LiveInstructorMarketStats';
import type { SiteTabId } from '../utils/seo';
import { tracker } from '../utils/tracker';

interface LiveInstructorMarketWidgetProps {
  onNavigate: (tab: SiteTabId) => void;
}

type RegionScopeId =
  | 'all'
  | 'primorye'
  | 'kamchatka'
  | 'khabarovsk'
  | 'sakhalin'
  | 'north';

const REGION_SCOPE_FILTERS: readonly { id: RegionScopeId; label: string }[] = [
  { id: 'all', label: 'Весь ДФО (7)' },
  { id: 'primorye', label: 'Приморье' },
  { id: 'kamchatka', label: 'Камчатка' },
  { id: 'khabarovsk', label: 'Хабаровский кр.' },
  { id: 'sakhalin', label: 'Сахалин' },
  { id: 'north', label: 'Якутия · Амур · Север' },
];

const NORTH_REGION_IDS = new Set(['yakutia', 'amur', 'magadan-chukotka']);

function matchesRegionScope(regionId: string, scope: RegionScopeId): boolean {
  if (scope === 'all') return true;
  if (scope === 'north') return NORTH_REGION_IDS.has(regionId);
  return regionId === scope;
}

function formatClockTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '—';
  }
}

export const LiveInstructorMarketWidget: React.FC<LiveInstructorMarketWidgetProps> = ({
  onNavigate,
}) => {
  const [snapshot, setSnapshot] = useState<LiveInstructorMarketSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [streamConnected, setStreamConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [regionScope, setRegionScope] = useState<RegionScopeId>('all');

  const fetchSnapshot = useCallback(async (manual = false) => {
    if (manual) {
      setRefreshing(true);
    }
    try {
      const res = await fetch('/api/market/live-stats', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as LiveInstructorMarketSnapshot;
      setSnapshot(data);
      setError(null);
    } catch {
      setError('Не удалось получить оперативную сводку по рынку инструкторов.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchSnapshot(false);
  }, [fetchSnapshot]);

  // Real-time Server-Sent Events connection with automatic HTTP polling fallback
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let pollTimer: number | null = null;

    const startPolling = () => {
      if (pollTimer !== null) return;
      pollTimer = window.setInterval(() => {
        void fetchSnapshot(false);
      }, 15_000);
    };

    if (typeof EventSource !== 'undefined') {
      eventSource = new EventSource('/api/market/live-stats/stream');

      eventSource.addEventListener('open', () => {
        setStreamConnected(true);
        if (pollTimer !== null) {
          window.clearInterval(pollTimer);
          pollTimer = null;
        }
      });

      eventSource.addEventListener('message', (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data) as LiveInstructorMarketSnapshot;
          setSnapshot(parsed);
          setLoading(false);
          setError(null);
          setStreamConnected(true);
        } catch {
          // Ignore malformed frame
        }
      });

      eventSource.addEventListener('error', () => {
        setStreamConnected(false);
        startPolling();
      });
    } else {
      startPolling();
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
      }
    };
  }, [fetchSnapshot]);

  const filteredRegions: LiveMarketRegionRow[] = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.regions.filter((r) => matchesRegionScope(r.id, regionScope));
  }, [snapshot, regionScope]);

  const scopedSummary = useMemo(() => {
    if (!snapshot) {
      return {
        certified: 0,
        demand: 0,
        deficit: 0,
        coveragePct: 0,
        activeInquiries: 0,
        leaderboardGuides: 0,
      };
    }

    if (regionScope === 'all') {
      return {
        certified: snapshot.headline.totalCertifiedInDfo,
        demand: snapshot.headline.totalEstimatedDemand,
        deficit: snapshot.headline.marketDeficitCount,
        coveragePct: snapshot.headline.coveragePercent,
        activeInquiries: snapshot.headline.activeInquiriesCount,
        leaderboardGuides: snapshot.headline.activeLeaderboardGuides,
      };
    }

    const certified = filteredRegions.reduce((sum, r) => sum + r.certifiedInRegistry, 0);
    const demand = filteredRegions.reduce((sum, r) => sum + r.estimatedDemand, 0);
    const deficit = Math.max(0, demand - certified);
    const coveragePct = demand > 0 ? Math.round((certified / demand) * 1000) / 10 : 0;
    const activeInquiries = filteredRegions.reduce((sum, r) => sum + r.activeInquiries, 0);
    const leaderboardGuides = filteredRegions.reduce((sum, r) => sum + r.leaderboardGuides, 0);

    return {
      certified,
      demand,
      deficit,
      coveragePct,
      activeInquiries,
      leaderboardGuides,
    };
  }, [snapshot, regionScope, filteredRegions]);

  return (
    <section
      id="analytical-platform-dfo"
      aria-labelledby="dfo-live-market-heading"
      className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 scroll-mt-24"
    >
      {/* Top Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wide text-teal-700">
              Аналитическая платформа ДФО
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <span
                className={`w-2 h-2 rounded-full ${
                  streamConnected ? 'bg-emerald-600' : 'bg-amber-500'
                }`}
                aria-hidden="true"
              />
              <span>
                {streamConnected
                  ? 'Данные в реальном времени (SSE)'
                  : 'Периодическое обновление'}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Синхронизация: {formatClockTime(snapshot?.updatedAt)}
            </span>
          </div>

          <h2
            id="dfo-live-market-heading"
            className="text-xl sm:text-2xl font-bold text-slate-900 text-balance"
          >
            Оперативный дашборд рынка инструкторов-проводников
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Сводка обеспеченности субъектов ДФО аттестованными кадрами (ЕФРТА), динамика заявок в
            комиссию РЦА «Русский Восток» и профиль действующих гидов по специализациям.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              void fetchSnapshot(true);
              tracker.trackCustomInteraction('Дашборд рынка ДФО · Обновить', 'home');
            }}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:border-teal-600 hover:text-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Обновить</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('overview')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
            <span>Полная аналитика</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Region Scope Filter Bar */}
      <div
        role="tablist"
        aria-label="Фильтр дашборда по регионам ДФО"
        className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
      >
        {REGION_SCOPE_FILTERS.map((scope) => {
          const active = regionScope === scope.id;
          return (
            <button
              key={scope.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setRegionScope(scope.id);
                tracker.trackCustomInteraction(
                  `Дашборд рынка ДФО · Фильтр ${scope.label}`,
                  'home'
                );
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {scope.label}
            </button>
          );
        })}
      </div>

      {/* Error State */}
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void fetchSnapshot(true)}
            className="px-3 py-1.5 bg-white border border-rose-300 rounded-lg font-semibold hover:bg-rose-100 cursor-pointer"
          >
            Повторить запрос
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !snapshot ? (
        <div className="space-y-4" aria-busy="true" aria-label="Загрузка статистики рынка">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-xl bg-slate-50 border border-slate-200 animate-pulse"
              />
            ))}
          </div>
          <div className="h-56 rounded-xl bg-slate-50 border border-slate-200 animate-pulse" />
        </div>
      ) : (
        snapshot && (
          <>
            {/* 4-Column Live KPI Strip */}
            <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5">
                <dt className="text-xs text-slate-500">В реестре ЕФРТА</dt>
                <dd className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
                  {scopedSummary.certified.toLocaleString('ru-RU')} чел.
                </dd>
                <p className="mt-0.5 text-[11px] text-teal-800 font-medium tabular-nums">
                  Охват {scopedSummary.coveragePct.toFixed(1).replace('.', ',')}% от спроса
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5">
                <dt className="text-xs text-slate-500">Кадровый дефицит</dt>
                <dd className="mt-1 text-xl font-bold font-mono text-amber-700 tabular-nums">
                  {scopedSummary.deficit.toLocaleString('ru-RU')} чел.
                </dd>
                <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                  Расчётная потребность {scopedSummary.demand.toLocaleString('ru-RU')} чел.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5">
                <dt className="text-xs text-slate-500">Заявки в комиссию РЦА</dt>
                <dd className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
                  {scopedSummary.activeInquiries} в работе
                </dd>
                <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                  Всего по ДФО: {snapshot.headline.totalInquiriesCount} · одобрено{' '}
                  {snapshot.headline.approvedInquiriesCount}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5">
                <dt className="text-xs text-slate-500">Профиль рынка и готовность</dt>
                <dd className="mt-1 text-xl font-bold font-mono text-teal-800 tabular-nums">
                  {snapshot.headline.avgExperienceYears.toFixed(1).replace('.', ',')} лет
                </dd>
                <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                  Средний стаж · готовность{' '}
                  {snapshot.headline.readinessResponsesCount > 0
                    ? `${snapshot.headline.avgReadinessPct}%`
                    : 'собирается'}
                </p>
              </div>
            </dl>

            {/* 2-Column Compact Analytics Body */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Regional Coverage Table */}
              <div className="lg:col-span-7 border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-900">
                    Обеспеченность субъектов ДФО (реестр / потребность)
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                    {filteredRegions.length}{' '}
                    {filteredRegions.length === 1 ? 'регион' : 'регионов'}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-white border-b border-slate-200 text-slate-500">
                      <tr>
                        <th scope="col" className="text-left font-semibold px-4 py-2.5">
                          Субъект ДФО
                        </th>
                        <th scope="col" className="text-right font-semibold px-3 py-2.5">
                          Реестр / Спрос
                        </th>
                        <th scope="col" className="text-right font-semibold px-3 py-2.5">
                          Дефицит
                        </th>
                        <th scope="col" className="text-right font-semibold px-4 py-2.5 w-36">
                          Покрытие
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRegions.map((reg) => {
                        const barWidth = Math.min(100, Math.max(3, reg.coveragePct));
                        return (
                          <tr
                            key={reg.id}
                            className="hover:bg-slate-50/80 transition-colors"
                          >
                            <td className="px-4 py-2.5">
                              <p className="font-semibold text-slate-900">{reg.shortName}</p>
                              <p className="text-[11px] text-slate-500">
                                Заявок в РЦА: {reg.activeInquiries} · В рейтинге:{' '}
                                {reg.leaderboardGuides}
                              </p>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-800 tabular-nums whitespace-nowrap">
                              {reg.certifiedInRegistry} /{' '}
                              {reg.estimatedDemand.toLocaleString('ru-RU')}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-amber-800 tabular-nums whitespace-nowrap">
                              −{reg.deficitCount.toLocaleString('ru-RU')}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-teal-700 rounded-full"
                                    style={{ width: `${barWidth}%` }}
                                  />
                                </div>
                                <span className="font-mono font-semibold text-slate-800 tabular-nums w-11 text-right">
                                  {reg.coveragePct.toFixed(1).replace('.', ',')}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right: Specializations + Live Stream Events */}
              <div className="lg:col-span-5 space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-900">
                      Структура специализаций
                    </h3>
                    <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                      {snapshot.headline.totalCertifiedRoutes} маршрутов
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {snapshot.tracks.slice(0, 5).map((tr) => (
                      <div key={tr.trackId} className="space-y-1">
                        <div className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="font-medium text-slate-800 truncate">{tr.label}</span>
                          <span className="font-mono text-[11px] text-slate-600 tabular-nums shrink-0">
                            {tr.totalActivity} · {tr.sharePct}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-700 rounded-full"
                            style={{ width: `${Math.max(4, tr.sharePct)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                      <span>Лента событий платформы</span>
                    </h3>
                    <span className="text-[11px] text-slate-500">Поток SSE</span>
                  </div>

                  {snapshot.recentEvents.length === 0 ? (
                    <p className="text-xs text-slate-500 leading-relaxed py-1">
                      Ожидание новых заявок, записей о походах и обновлений рейтинга гидов — данные
                      отобразятся автоматически.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {snapshot.recentEvents.slice(0, 4).map((ev) => (
                        <li
                          key={ev.id}
                          className="py-2 first:pt-0 last:pb-0 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 truncate">{ev.title}</p>
                            <p className="text-[11px] text-slate-500 truncate">{ev.detail}</p>
                          </div>
                          <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                            {formatClockTime(ev.occurredAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Deep-dive Platform Shortcuts */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Модули углублённого анализа РЦА «Русский Восток»:
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('market')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Карты и прогноз рынка ДФО</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('calculator')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Calculator className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Калькулятор дефицита и сметы</span>
                </button>
              </div>
            </div>
          </>
        )
      )}
    </section>
  );
};
