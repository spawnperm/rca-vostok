import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, PieChart as PieChartIcon, Route } from 'lucide-react';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  EXPERIENCE_JOURNAL_UPDATED_EVENT,
  computeComplexityTierDistribution,
  readStoredExperienceJournal,
  type ComplexityTierSlice,
  type ExperienceLogEntry,
} from '../utils/experienceJournal';
import type { SessionUser } from '../utils/identityApi';

interface RouteComplexityPieWidgetProps {
  user: SessionUser | null;
  journalRevision?: number;
  onJumpToJournal?: () => void;
}

interface CustomPieTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: ComplexityTierSlice;
  }>;
}

const ComplexityPieTooltip: React.FC<CustomPieTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const slice = payload[0]?.payload;
  if (!slice) return null;

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg px-3.5 py-2.5 shadow-lg text-xs space-y-1">
      <div className="font-bold flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: slice.color }}
        />
        <span>{slice.name}</span>
      </div>
      <p className="text-slate-200">
        Маршрутов: <strong>{slice.tripsCount}</strong> ({slice.sharePct}%)
      </p>
      <p className="text-slate-300">
        Участников: <strong>{slice.participantsCount} чел.</strong>
      </p>
    </div>
  );
};

export const RouteComplexityPieWidget: React.FC<RouteComplexityPieWidgetProps> = ({
  user,
  journalRevision = 0,
  onJumpToJournal,
}) => {
  const userId = user?.id ?? null;
  const preferredRegion = user?.region;

  const [entries, setEntries] = useState<ExperienceLogEntry[]>(() =>
    readStoredExperienceJournal(userId, preferredRegion)
  );

  useEffect(() => {
    setEntries(readStoredExperienceJournal(userId, preferredRegion));
  }, [userId, preferredRegion, journalRevision]);

  useEffect(() => {
    const handleUpdated = () => {
      setEntries(readStoredExperienceJournal(userId, preferredRegion));
    };
    window.addEventListener(EXPERIENCE_JOURNAL_UPDATED_EVENT, handleUpdated);
    return () => {
      window.removeEventListener(EXPERIENCE_JOURNAL_UPDATED_EVENT, handleUpdated);
    };
  }, [userId, preferredRegion]);

  const distribution = useMemo(() => computeComplexityTierDistribution(entries), [entries]);

  return (
    <section
      id="route-complexity-pie-widget"
      aria-labelledby="route-complexity-pie-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <PieChartIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Аналитика журнала опыта · Структура сложности</span>
          </p>
          <h3 id="route-complexity-pie-heading" className="text-xl font-bold text-slate-900">
            Распределение сложности пройденных маршрутов
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Круговая диаграмма группирует записи из «Журнала профессионального опыта» на лёгкие
            (н/к, 1 КС), средние (2–3 КС) и сложные (4–5 КС) маршруты в реальном времени.
          </p>
        </div>

        {onJumpToJournal && (
          <button
            type="button"
            onClick={onJumpToJournal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          >
            <Route className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Редактировать журнал</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Content */}
      {distribution.totalTrips === 0 ? (
        <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-2">
          <p className="text-sm font-semibold text-slate-800">
            В журнале профессионального опыта пока нет записей
          </p>
          <p className="text-xs text-slate-600">
            Добавьте проведённые походы в форму выше, чтобы увидеть круговую диаграмму сложности.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Recharts Pie / Donut */}
          <div className="lg:col-span-6 relative bg-slate-50/70 border border-slate-200 rounded-xl p-4">
            <div className="h-[290px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribution.nonZeroSlices}
                    dataKey="tripsCount"
                    nameKey="shortName"
                    cx="50%"
                    cy="47%"
                    innerRadius={62}
                    outerRadius={102}
                    paddingAngle={distribution.nonZeroSlices.length > 1 ? 3 : 0}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  >
                    {distribution.nonZeroSlices.map((slice) => (
                      <Cell key={slice.key} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ComplexityPieTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={32}
                    formatter={(value) => (
                      <span className="text-xs font-medium text-slate-700">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Center KPI overlay inside Donut */}
            <div
              className="pointer-events-none absolute inset-x-0 top-[44%] -translate-y-1/2 flex flex-col items-center justify-center text-center"
              aria-hidden="true"
            >
              <span className="text-2xl font-bold text-slate-900 tabular-nums leading-none">
                {distribution.totalTrips}
              </span>
              <span className="text-[11px] font-medium text-slate-500 mt-1">
                {distribution.totalTrips === 1
                  ? 'маршрут'
                  : distribution.totalTrips < 5
                  ? 'маршрута'
                  : 'маршрутов'}
              </span>
            </div>
          </div>

          {/* Structured tier cards + insight */}
          <div className="lg:col-span-6 space-y-3">
            {distribution.slices.map((slice) => (
              <div
                key={slice.key}
                className="border border-slate-200 rounded-xl p-4 bg-white space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-bold text-slate-900">{slice.name}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-900 tabular-nums">
                    {slice.tripsCount} походов · {slice.sharePct}%
                  </span>
                </div>

                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${slice.sharePct}%`,
                      backgroundColor: slice.color,
                    }}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                  <span>{slice.description}</span>
                  <span className="font-semibold text-slate-700 tabular-nums">
                    {slice.participantsCount} чел.
                  </span>
                </div>
              </div>
            ))}

            {distribution.dominantTier && (
              <div className="px-4 py-3 bg-teal-50/75 border border-teal-200 rounded-xl text-xs text-teal-950 leading-relaxed">
                <strong>Профиль опыта:</strong> преобладают{' '}
                <span className="lowercase font-semibold">{distribution.dominantTier.name}</span> (
                {distribution.dominantTier.sharePct}% от всех записей). Всего проведено{' '}
                <strong>{distribution.totalParticipants} чел.</strong> по маршрутам журнала.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
