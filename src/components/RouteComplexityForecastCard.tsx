import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Compass,
  Gauge,
  Minus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  COMPLEXITY_BY_RANK,
  EXPERIENCE_JOURNAL_UPDATED_EVENT,
  complexityRankToLabel,
  forecastNextRouteComplexity,
  readStoredExperienceJournal,
  type ExperienceLogEntry,
  type RouteComplexityForecastPoint,
} from '../utils/experienceJournal';
import type { SessionUser } from '../utils/identityApi';

interface RouteComplexityForecastCardProps {
  user: SessionUser | null;
  onJumpToJournal?: () => void;
}

interface ForecastTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: RouteComplexityForecastPoint;
  }>;
}

const ForecastTooltip: React.FC<ForecastTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg px-3.5 py-2.5 shadow-lg text-xs space-y-1 max-w-xs">
      <p className="font-bold text-teal-300">
        {pt.isForecast ? 'Прогноз следующего похода' : `${pt.stepLabel} · ${pt.regionName}`}
      </p>
      <p className="text-slate-100 leading-snug">{pt.routeTitle}</p>
      {pt.actualLabel && (
        <p className="text-slate-300">
          Факт: <strong className="text-white">{pt.actualLabel}</strong>
        </p>
      )}
      <p className="text-slate-300">
        Линия тренда (МНК):{' '}
        <strong className="text-amber-300">
          {pt.trendRank.toFixed(2)} ({complexityRankToLabel(pt.trendRank)})
        </strong>
      </p>
      {pt.isForecast && pt.forecastRank !== null && (
        <p className="text-emerald-300 font-semibold">
          Рекомендованный уровень: {complexityRankToLabel(pt.forecastRank)}
        </p>
      )}
    </div>
  );
};

export const RouteComplexityForecastCard: React.FC<RouteComplexityForecastCardProps> = ({
  user,
  onJumpToJournal,
}) => {
  const userId = user?.id ?? null;
  const preferredRegion = user?.region;

  const [entries, setEntries] = useState<ExperienceLogEntry[]>(() =>
    readStoredExperienceJournal(userId, preferredRegion)
  );

  useEffect(() => {
    setEntries(readStoredExperienceJournal(userId, preferredRegion));
  }, [userId, preferredRegion]);

  useEffect(() => {
    const handleUpdated = () => {
      setEntries(readStoredExperienceJournal(userId, preferredRegion));
    };
    window.addEventListener(EXPERIENCE_JOURNAL_UPDATED_EVENT, handleUpdated);
    return () => {
      window.removeEventListener(EXPERIENCE_JOURNAL_UPDATED_EVENT, handleUpdated);
    };
  }, [userId, preferredRegion]);

  const forecast = useMemo(() => forecastNextRouteComplexity(entries), [entries]);

  const TrendIcon =
    forecast.trendDirection === 'up'
      ? TrendingUp
      : forecast.trendDirection === 'down'
      ? TrendingDown
      : Minus;

  const trendBadgeClass =
    forecast.trendDirection === 'up'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : forecast.trendDirection === 'down'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-slate-100 text-slate-700 border-slate-300';

  return (
    <section
      id="route-complexity-forecast"
      aria-labelledby="route-complexity-forecast-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Прогностическая аналитика · Линейный тренд (МНК)</span>
          </p>
          <h3 id="route-complexity-forecast-heading" className="text-xl font-bold text-slate-900">
            Прогноз следующего уровня сложности маршрута
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Оценивает динамику ваших походов из «Журнала профессионального опыта» с помощью
            линейной регрессии и скользящего среднего последних маршрутов с учётом шага безопасности
            ФСТР (+1 КС).
          </p>
        </div>

        {onJumpToJournal && (
          <button
            type="button"
            onClick={onJumpToJournal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Внести новый поход</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Top Forecast Recommendation + Statistical Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Highlighted Recommended Next Level Card */}
        <div className="lg:col-span-5 bg-slate-900 text-white rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-300">
                Рекомендуемый уровень
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${trendBadgeClass}`}
              >
                <TrendIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>{forecast.stepProgressionLabel}</span>
              </span>
            </div>

            <div className="flex items-baseline gap-3 pt-1">
              <span className="text-4xl font-extrabold tracking-tight text-white">
                {forecast.recommendedComplexity}
              </span>
              <span className="text-xs text-slate-300">
                (расчёт: {forecast.predictedNumericRank.toFixed(2)} КС)
              </span>
            </div>

            <p className="text-xs text-teal-200 font-medium">{forecast.recommendedDescription}</p>
          </div>

          <p className="text-xs text-slate-200 leading-relaxed pt-3 border-t border-slate-700">
            {forecast.rationale}
          </p>
        </div>

        {/* Statistical Trend Metrics & Confidence */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-2">
            <span className="text-[11px] font-medium text-slate-500">
              Линейный тренд (наклон)
            </span>
            <p className="text-lg font-bold text-slate-900 tabular-nums">
              {forecast.slopePerTrip > 0 ? '+' : ''}
              {forecast.slopePerTrip.toFixed(2)} КС
            </p>
            <p className="text-[11px] text-slate-600 leading-snug">{forecast.trendLabel}</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-2">
            <span className="text-[11px] font-medium text-slate-500">
              Средняя сложность (все → 3 посл.)
            </span>
            <p className="text-lg font-bold text-slate-900 tabular-nums">
              {forecast.sampleSize > 0
                ? `${forecast.overallMeanRank.toFixed(1)} → ${forecast.recentMeanRank.toFixed(1)}`
                : '0.0'}
            </p>
            <p className="text-[11px] text-slate-600 leading-snug">
              Макс. в журнале: <strong>{forecast.maxObservedComplexity}</strong>
            </p>
          </div>

          <div className="bg-teal-50/75 border border-teal-200 rounded-xl p-4 flex flex-col justify-between space-y-2">
            <span className="text-[11px] font-medium text-teal-800 inline-flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>Уверенность прогноза</span>
            </span>
            <p className="text-lg font-bold text-teal-950 tabular-nums">
              {forecast.confidencePercent}%
            </p>
            <p className="text-[11px] text-teal-900 leading-snug">
              {forecast.confidenceLabel} · выборка: {forecast.sampleSize}
            </p>
          </div>

          {/* Trend Recharts Line Chart spanning all 3 columns on sm+ */}
          <div className="sm:col-span-3 border border-slate-200 rounded-xl p-4 bg-white space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-900">
                Хронология сложности походов и линия прогноза
              </p>
              <span className="text-[11px] text-slate-500">
                Шкала: н/к (0) — 5 КС (5)
              </span>
            </div>

            {forecast.points.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center bg-slate-50 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500">
                Добавьте записи в «Журнал профессионального опыта» для построения линии тренда.
              </div>
            ) : (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={forecast.points}
                    margin={{ top: 10, right: 16, left: -12, bottom: 2 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="stepLabel" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis
                      domain={[0, 5]}
                      ticks={[0, 1, 2, 3, 4, 5]}
                      tickFormatter={(val: number) => COMPLEXITY_BY_RANK[val] ?? String(val)}
                      tick={{ fontSize: 11, fill: '#334155' }}
                    />
                    <Tooltip content={<ForecastTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Line
                      type="monotone"
                      dataKey="actualRank"
                      name="Факт (КС)"
                      stroke="#0F766E"
                      strokeWidth={2.5}
                      dot={{ r: 4.5, fill: '#0F766E', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                      connectNulls={false}
                    />
                    <Line
                      type="linear"
                      dataKey="trendRank"
                      name="Тренд (МНК)"
                      stroke="#64748B"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecastRank"
                      name="Прогноз следующего уровня"
                      stroke="#D97706"
                      strokeWidth={2.5}
                      strokeDasharray="4 3"
                      dot={{ r: 5.5, fill: '#D97706', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
