import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, RefreshCw, Star } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { tracker } from '../utils/tracker';

interface ReviewRatingBucket {
  score: number;
  label: string;
  sessionCount: number;
  expertsCount: number;
}

interface ReviewStatsPayload {
  totalReviews: number;
  sessionAverage: number | null;
  expertsAverage: number | null;
  recommendationCount: number;
  distribution: ReviewRatingBucket[];
}

type MetricSeriesFilter = 'both' | 'session' | 'experts';

interface ReviewStatsWidgetProps {
  refreshKey?: number;
}

function ReviewTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-md px-3.5 py-2.5 text-xs space-y-1.5">
      <p className="font-bold text-slate-900">Оценка: {label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <span
              className="w-2.5 h-2.5 rounded-xs shrink-0"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            {entry.name}
          </span>
          <span className="font-mono font-semibold text-slate-900 tabular-nums">
            {entry.value ?? 0} шт.
          </span>
        </div>
      ))}
    </div>
  );
}

export const ReviewStatsWidget: React.FC<ReviewStatsWidgetProps> = ({ refreshKey = 0 }) => {
  const [stats, setStats] = useState<ReviewStatsPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [seriesFilter, setSeriesFilter] = useState<MetricSeriesFilter>('both');

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/feedback/reviews-summary', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error('Не удалось загрузить статистику оценок.');
      }
      const data = (await res.json()) as ReviewStatsPayload;
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки статистики оценок.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats, refreshKey]);

  const recommendShare =
    stats && stats.totalReviews > 0
      ? Math.round((stats.recommendationCount / stats.totalReviews) * 100)
      : null;

  return (
    <section
      aria-labelledby="review-stats-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
    >
      {/* Header + Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700">
            <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Мониторинг качества аттестаций</span>
          </div>
          <h3 id="review-stats-heading" className="text-base font-bold text-slate-900">
            Статистика оценок
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Распределение пользовательских оценок (от 1 до 5) по качеству аттестационных сессий и
            работе экспертов комиссии РЦА «Русский Восток».
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Выбор показателей диаграммы"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {(
              [
                { id: 'both', label: 'Оба' },
                { id: 'session', label: 'Сессии' },
                { id: 'experts', label: 'Эксперты' },
              ] as const
            ).map((opt) => {
              const active = seriesFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSeriesFilter(opt.id);
                    tracker.trackCustomInteraction(
                      'Статистика оценок: переключение серии',
                      opt.label
                    );
                  }}
                  aria-pressed={active}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => void loadStats()}
            disabled={loading}
            aria-label="Обновить статистику оценок"
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-700' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3.5 border-y border-slate-200">
        <div>
          <dt className="text-xs text-slate-500">Отзывов учтено</dt>
          <dd className="text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5">
            {stats ? stats.totalReviews : '—'}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-slate-500">Средняя: сессии</dt>
          <dd className="text-lg font-bold font-mono text-teal-800 tabular-nums mt-0.5 inline-flex items-center gap-1">
            <Star className="w-4 h-4 text-amber-500" fill="currentColor" aria-hidden="true" />
            <span>
              {stats?.sessionAverage !== null && stats?.sessionAverage !== undefined
                ? stats.sessionAverage.toFixed(1)
                : '—'}
            </span>
          </dd>
        </div>

        <div>
          <dt className="text-xs text-slate-500">Средняя: эксперты</dt>
          <dd className="text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5 inline-flex items-center gap-1">
            <Star className="w-4 h-4 text-amber-500" fill="currentColor" aria-hidden="true" />
            <span>
              {stats?.expertsAverage !== null && stats?.expertsAverage !== undefined
                ? stats.expertsAverage.toFixed(1)
                : '—'}
            </span>
          </dd>
        </div>

        <div>
          <dt className="text-xs text-slate-500">Рекомендуют центр</dt>
          <dd className="text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5">
            {recommendShare !== null ? `${recommendShare}%` : '—'}
          </dd>
        </div>
      </dl>

      {/* Chart Area */}
      {loading && !stats ? (
        <div role="status" className="h-[260px] flex items-center justify-center bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500">Загружаем распределение оценок…</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadStats()}
            className="px-3 py-1.5 bg-white border border-rose-300 rounded-md font-semibold hover:bg-rose-50 cursor-pointer"
          >
            Повторить
          </button>
        </div>
      ) : (
        stats && (
          <div className="space-y-3">
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.distribution}
                  margin={{ top: 10, right: 12, left: -12, bottom: 4 }}
                  barGap={6}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ReviewTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.7)' }} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    iconType="square"
                  />
                  {(seriesFilter === 'both' || seriesFilter === 'session') && (
                    <Bar
                      dataKey="sessionCount"
                      name="Качество аттестационных сессий"
                      fill="#0f766e"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={36}
                    />
                  )}
                  {(seriesFilter === 'both' || seriesFilter === 'experts') && (
                    <Bar
                      dataKey="expertsCount"
                      name="Работа экспертов и комиссии"
                      fill="#0284c7"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={36}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {stats.totalReviews === 0 && (
              <p className="text-xs text-slate-500 leading-relaxed">
                Пользовательских оценок пока нет. Оставьте первый отзыв о работе экспертов и
                аттестационной сессии в форме ниже — диаграмма обновится автоматически.
              </p>
            )}
          </div>
        )
      )}
    </section>
  );
};
