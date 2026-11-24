import React, { useMemo, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDurationClock } from '../../utils/format';
import type { ClientBehaviorEvent } from '../../utils/tracker';
import {
  EVENT_TYPE_LABELS,
  PLATFORM_TABS_ORDER,
  TAB_LABELS,
  type AnalyticsSummaryResponse,
} from './types';

interface ActivityTimelinePoint {
  label: string;
  visits: number;
  events: number;
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

const ActivityTimelineTooltip: React.FC<{
  active?: boolean;
  payload?: { payload?: ActivityTimelinePoint }[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;
  const eventsPerVisit =
    pt.visits > 0 ? (pt.events / pt.visits).toFixed(1) : String(pt.events);

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg p-3.5 shadow-lg text-xs space-y-1.5 min-w-[210px]">
      <div className="flex items-baseline justify-between gap-4 border-b border-slate-700 pb-1.5">
        <span className="font-mono font-bold text-teal-300 tabular-nums">{label}</span>
        <span className="text-[11px] text-slate-300">Интервал активности</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-300">Записано событий:</span>
        <span className="font-mono font-bold tabular-nums text-white">
          {pt.events.toLocaleString('ru-RU')}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-300">Уникальных визитов:</span>
        <span className="font-mono font-semibold tabular-nums text-teal-300">
          {pt.visits.toLocaleString('ru-RU')}
        </span>
      </div>
      <div className="pt-1 border-t border-slate-800 flex items-center justify-between gap-4 text-[11px] text-slate-400">
        <span>Интенсивность:</span>
        <span className="font-mono tabular-nums text-slate-200">{eventsPerVisit} соб./визит</span>
      </div>
    </div>
  );
};

interface BehavioralAnalyticsTabProps {
  summary: AnalyticsSummaryResponse | null;
  loading: boolean;
  currentSessionId: string;
  selectedSessionId: string;
  onSelectSessionId: (sid: string) => void;
  sessionEvents: ClientBehaviorEvent[];
  loadingSession: boolean;
  replayIndex: number;
  isReplaying: boolean;
  onToggleReplay: () => void;
  onSelectReplayIndex: (index: number) => void;
}

const HEATMAP_FILTER_TABS = [
  'all',
  'home',
  'learning',
  'certification',
  'routes',
  'overview',
  'calculator',
  'market',
  'account',
] as const;

export const BehavioralAnalyticsTab: React.FC<BehavioralAnalyticsTabProps> = ({
  summary,
  loading,
  currentSessionId,
  selectedSessionId,
  onSelectSessionId,
  sessionEvents,
  loadingSession,
  replayIndex,
  isReplaying,
  onToggleReplay,
  onSelectReplayIndex,
}) => {
  const [heatmapFilterTab, setHeatmapFilterTab] = useState<string>('all');

  const filteredHeatmap = useMemo(() => {
    const pts = summary?.heatmapPoints ?? [];
    if (heatmapFilterTab === 'all') return pts;
    return pts.filter((p) => p.tab === heatmapFilterTab);
  }, [summary, heatmapFilterTab]);

  const activeReplayEvent =
    replayIndex >= 0 && replayIndex < sessionEvents.length ? sessionEvents[replayIndex] : null;
  const timeline = summary?.timeline ?? [];

  if (loading && !summary) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((k) => (
          <div
            key={k}
            className="bg-white border border-slate-200 rounded-xl p-6 h-28 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
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
            {formatDurationClock(summary?.totals.avgDurationSec ?? 0)}
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
          <p className="mt-2 text-xs text-slate-600">Вовлечённость по прокрутке</p>
        </div>
      </section>

      {/* Activity Timeline & Tab Popularity */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Динамика активности (события по интервалам)
            </h2>
            <span className="text-xs font-mono text-slate-500">Серверный лог</span>
          </div>

          {timeline.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg text-center px-4">
              Пока недостаточно интервалов для графика — переходите между разделами сайта
            </div>
          ) : (
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timeline}
                  margin={{ top: 10, right: 12, left: -14, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="label"
                    tick={{
                      fontSize: 10.5,
                      fill: '#64748B',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{
                      fontSize: 10.5,
                      fill: '#64748B',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <Tooltip
                    trigger="hover"
                    cursor={{
                      stroke: '#0F766E',
                      strokeWidth: 1.5,
                      strokeDasharray: '4 4',
                    }}
                    allowEscapeViewBox={{ x: true, y: true }}
                    content={<ActivityTimelineTooltip />}
                  />
                  <Area
                    type="monotone"
                    dataKey="events"
                    name="События"
                    stroke="#0F766E"
                    fill="#0F766E"
                    fillOpacity={0.14}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#0F172A', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                    activeDot={{ r: 6.5, fill: '#0F766E', stroke: '#FFFFFF', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Популярность разделов платформы
            </h2>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {PLATFORM_TABS_ORDER.length} разделов
            </span>
          </div>
          <div className="overflow-x-auto max-h-[250px] overflow-y-auto">
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
                {PLATFORM_TABS_ORDER.map((tabKey) => {
                  const st = summary?.tabStats[tabKey] ?? {
                    views: 0,
                    clicks: 0,
                    interactions: 0,
                  };
                  return (
                    <tr key={tabKey} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 pr-3 font-medium text-slate-900">
                        {TAB_LABELS[tabKey] ?? tabKey}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-800">
                        {st.views}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-teal-800">
                        {st.clicks}
                      </td>
                      <td className="py-2 pl-3 text-right font-mono tabular-nums text-slate-600">
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
                <div
                  key={`${item.tab}-${item.label}`}
                  className="py-2.5 flex items-center justify-between gap-4"
                >
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
            <h2 className="text-base font-bold text-slate-900 mb-3">
              Устройства посетителей
            </h2>
            <div className="space-y-2 text-xs">
              {Object.entries(summary?.devices ?? {}).map(([dev, count]) => (
                <div
                  key={dev}
                  className="flex justify-between py-1.5 border-b border-slate-100"
                >
                  <span className="text-slate-700 font-medium">{dev}</span>
                  <span className="font-mono font-semibold tabular-nums">{count}</span>
                </div>
              ))}
              {Object.keys(summary?.devices ?? {}).length === 0 && (
                <p className="text-slate-500">Нет данных по устройствам.</p>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-900 mb-3">
              Источники переходов
            </h2>
            <div className="space-y-2 text-xs">
              {Object.entries(summary?.referrers ?? {}).map(([ref, count]) => (
                <div
                  key={ref}
                  className="flex justify-between py-1.5 border-b border-slate-100"
                >
                  <span className="text-slate-700 font-medium truncate pr-4">{ref}</span>
                  <span className="font-mono font-semibold tabular-nums shrink-0">
                    {count}
                  </span>
                </div>
              ))}
              {Object.keys(summary?.referrers ?? {}).length === 0 && (
                <p className="text-slate-500">Нет зафиксированных источников переходов.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Session Replay & Event Stream */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Записанные сессии</h2>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {summary?.recentSessions.length ?? 0} шт.
            </span>
          </div>

          <div className="divide-y divide-slate-200 max-h-[420px] overflow-y-auto pr-1">
            {(summary?.recentSessions ?? []).map((sess) => {
              const isSelected = sess.sessionId === selectedSessionId;
              const isCurrent = sess.sessionId === currentSessionId;
              return (
                <button
                  key={sess.sessionId}
                  type="button"
                  onClick={() => onSelectSessionId(sess.sessionId)}
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
                    <span>
                      {sess.deviceType} · {sess.browser}
                    </span>
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

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Лента поведения ({selectedSessionId.slice(0, 8)})
              </h2>
              <p className="text-xs text-slate-500">
                Хронологическая запись переходов, кликов, прокрутки и изменений параметров
              </p>
            </div>

            <button
              type="button"
              disabled={sessionEvents.length === 0}
              onClick={onToggleReplay}
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

          {activeReplayEvent && (
            <div className="p-3.5 bg-slate-900 text-white rounded-lg flex items-center justify-between gap-4 text-xs">
              <div className="min-w-0">
                <span className="font-mono text-teal-300 mr-2 tabular-nums">
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
            <div className="divide-y divide-slate-200 max-h-[340px] overflow-y-auto pr-1">
              {sessionEvents.map((ev, idx) => {
                const highlighted = idx === replayIndex;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onSelectReplayIndex(idx)}
                    className={`w-full text-left py-2.5 px-3 flex items-start justify-between gap-4 text-xs rounded-md cursor-pointer transition-colors ${
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
                  </button>
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
              Отображено точек:{' '}
              <span className="font-mono font-semibold tabular-nums">
                {filteredHeatmap.length}
              </span>
            </p>
          </div>

          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {HEATMAP_FILTER_TABS.map((t) => (
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
            ))}
          </div>
        </div>

        <div className="relative w-full aspect-[16/7] min-h-[240px] bg-slate-50 border border-slate-300 rounded-lg overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-8 border-b border-slate-200 bg-white/70 flex items-center px-4 text-[10px] text-slate-400 font-mono">
            Верхняя панель навигации (0% – 8% высоты экрана)
          </div>
          <div className="absolute inset-x-8 top-12 bottom-6 border border-dashed border-slate-200 rounded flex items-center justify-center text-xs text-slate-400 pointer-events-none">
            Рабочая область контента (
            {heatmapFilterTab === 'all' ? 'все разделы' : TAB_LABELS[heatmapFilterTab]})
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
  );
};
