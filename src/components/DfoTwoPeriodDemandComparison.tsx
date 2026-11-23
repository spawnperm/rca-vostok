import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, BarChart3, CalendarRange, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DEMAND_PERIOD_YEARS,
  TWO_PERIOD_PRESETS,
  buildTwoPeriodDemandComparison,
  type DemandPeriodScenario,
  type DemandPeriodYear,
  type TwoPeriodRegionRow,
  type TwoPeriodTrendPoint,
} from '../utils/dfoDemandPeriodComparison';
import { tracker } from '../utils/tracker';

interface PeriodBarTooltipEntry {
  name?: string;
  value?: number;
  color?: string;
  payload?: TwoPeriodRegionRow;
}

interface TrendLineTooltipEntry {
  name?: string;
  value?: number;
  color?: string;
  payload?: TwoPeriodTrendPoint;
}

const PeriodBarTooltip: React.FC<{
  active?: boolean;
  payload?: PeriodBarTooltipEntry[];
  periodA: DemandPeriodYear;
  periodB: DemandPeriodYear;
}> = ({ active, payload, periodA, periodB }) => {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg p-3.5 shadow-xl max-w-xs text-xs space-y-2">
      <div className="border-b border-slate-700 pb-1.5 font-bold text-teal-300">
        {row.regionName}
      </div>
      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between gap-4">
          <span className="text-slate-300">{periodA} г.:</span>
          <span className="font-mono font-bold text-white tabular-nums">
            {row.demandA.toLocaleString('ru-RU')} чел.
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-300">{periodB} г.:</span>
          <span className="font-mono font-bold text-teal-300 tabular-nums">
            {row.demandB.toLocaleString('ru-RU')} чел.
          </span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-slate-800">
          <span className="text-slate-300">Прирост между периодами:</span>
          <span className="font-mono font-bold text-amber-300 tabular-nums">
            {row.deltaAbsolute > 0 ? '+' : ''}
            {row.deltaAbsolute.toLocaleString('ru-RU')} ({row.deltaPercent > 0 ? '+' : ''}
            {row.deltaPercent}%)
          </span>
        </div>
      </div>
    </div>
  );
};

const PeriodTrendTooltip: React.FC<{
  active?: boolean;
  payload?: TrendLineTooltipEntry[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg p-3.5 shadow-xl max-w-xs text-xs space-y-2">
      <div className="flex items-baseline justify-between gap-4 border-b border-slate-700 pb-1.5">
        <span className="font-mono font-bold text-teal-300 tabular-nums">{label} г.</span>
        {point?.isBoundaryPeriod && (
          <span className="text-[11px] font-semibold text-amber-300">Выбранный период</span>
        )}
      </div>
      <div className="space-y-1 text-[11px]">
        {payload.map((entry) => (
          <div key={String(entry.name)} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 text-slate-200 truncate">
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: entry.color }}
                aria-hidden="true"
              />
              <span className="truncate">{entry.name}</span>
            </span>
            <span className="font-mono font-bold text-white tabular-nums shrink-0">
              {typeof entry.value === 'number'
                ? entry.value.toLocaleString('ru-RU')
                : entry.value}{' '}
              чел.
            </span>
          </div>
        ))}
      </div>
      {point?.driverNote && (
        <p className="pt-1.5 border-t border-slate-800 text-[11px] text-slate-300 leading-snug">
          {point.driverNote}
        </p>
      )}
    </div>
  );
};

export const DfoTwoPeriodDemandComparison: React.FC = () => {
  const [periodA, setPeriodA] = useState<DemandPeriodYear>('2025');
  const [periodB, setPeriodB] = useState<DemandPeriodYear>('2030');
  const [scenario, setScenario] = useState<DemandPeriodScenario>('base');

  const comparison = useMemo(
    () => buildTwoPeriodDemandComparison({ periodA, periodB, scenario }),
    [periodA, periodB, scenario]
  );

  const windowStart = Number(periodA) <= Number(periodB) ? periodA : periodB;
  const windowEnd = Number(periodA) <= Number(periodB) ? periodB : periodA;

  const handleSwapPeriods = () => {
    setPeriodA(periodB);
    setPeriodB(periodA);
    tracker.trackCustomInteraction(
      'Сравнение двух периодов: смена местами',
      `${periodB} ↔ ${periodA}`
    );
  };

  return (
    <section
      aria-labelledby="dfo-two-period-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header & Scenario Switch */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <CalendarRange className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Межвременной анализ трендов потребности 2025–2030 гг.</span>
          </p>
          <h2 id="dfo-two-period-heading" className="text-xl font-bold text-slate-900">
            Сравнение динамики потребности в инструкторах между двумя временными периодами
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Выберите два года на горизонте 2025–2030 гг., чтобы оценить прирост потребности по
            каждому субъекту ДФО, среднегодовой темп изменений и траекторию между точками.
          </p>
        </div>

        <div
          role="group"
          aria-label="Сценарий прогноза потребности"
          className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0"
        >
          <button
            type="button"
            onClick={() => {
              setScenario('base');
              tracker.trackCustomInteraction('Сравнение периодов ДФО: сценарий', 'Базовый');
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              scenario === 'base'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Базовый (30%)
          </button>
          <button
            type="button"
            onClick={() => {
              setScenario('conservative');
              tracker.trackCustomInteraction('Сравнение периодов ДФО: сценарий', 'Консервативный');
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              scenario === 'conservative'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Консервативный (18%)
          </button>
        </div>
      </div>

      {/* Period Pickers + Quick Horizon Presets */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-end">
          <div className="md:col-span-5 space-y-1.5">
            <label
              htmlFor="market-period-a-select"
              className="flex items-center gap-2 text-xs font-semibold text-slate-700"
            >
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-600 shrink-0" aria-hidden="true" />
              <span>Период 1 (базовый год)</span>
            </label>
            <select
              id="market-period-a-select"
              value={periodA}
              onChange={(e) => {
                const val = e.target.value as DemandPeriodYear;
                setPeriodA(val);
                tracker.trackCustomInteraction('Сравнение периодов: Период 1', val);
              }}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-2 focus:outline-teal-700 cursor-pointer"
            >
              {DEMAND_PERIOD_YEARS.map((yr) => (
                <option key={`pa-${yr}`} value={yr}>
                  {yr} год
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1 flex justify-center">
            <button
              type="button"
              onClick={handleSwapPeriods}
              aria-label="Поменять периоды местами"
              title="Поменять периоды местами"
              className="p-2.5 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="md:col-span-5 space-y-1.5">
            <label
              htmlFor="market-period-b-select"
              className="flex items-center gap-2 text-xs font-semibold text-slate-700"
            >
              <span className="w-2.5 h-2.5 rounded-xs bg-teal-700 shrink-0" aria-hidden="true" />
              <span>Период 2 (целевой год)</span>
            </label>
            <select
              id="market-period-b-select"
              value={periodB}
              onChange={(e) => {
                const val = e.target.value as DemandPeriodYear;
                setPeriodB(val);
                tracker.trackCustomInteraction('Сравнение периодов: Период 2', val);
              }}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-2 focus:outline-teal-700 cursor-pointer"
            >
              {DEMAND_PERIOD_YEARS.map((yr) => (
                <option key={`pb-${yr}`} value={yr}>
                  {yr} год
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 text-xs">
          <span className="text-slate-500 font-medium">Характерные интервалы:</span>
          {TWO_PERIOD_PRESETS.map((preset) => {
            const active = periodA === preset.periodA && periodB === preset.periodB;
            return (
              <button
                key={preset.id}
                type="button"
                title={preset.note}
                onClick={() => {
                  setPeriodA(preset.periodA);
                  setPeriodB(preset.periodB);
                  tracker.trackCustomInteraction('Сравнение периодов: пресет', preset.label);
                }}
                className={`px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-[11px] text-slate-500">Потребность ДФО ({comparison.periodA} г.)</p>
          <p className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
            {comparison.totalA.toLocaleString('ru-RU')} чел.
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600 line-clamp-2">
            {comparison.periodANote}
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-[11px] text-slate-500">Потребность ДФО ({comparison.periodB} г.)</p>
          <p className="mt-1 text-xl font-bold font-mono text-teal-800 tabular-nums">
            {comparison.totalB.toLocaleString('ru-RU')} чел.
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600 line-clamp-2">
            {comparison.periodBNote}
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-[11px] text-slate-500">Изменение за интервал</p>
          <p className="mt-1 text-xl font-bold font-mono text-amber-800 tabular-nums">
            {comparison.totalDeltaAbsolute > 0 ? '+' : ''}
            {comparison.totalDeltaAbsolute.toLocaleString('ru-RU')} чел.
          </p>
          <p className="mt-0.5 text-[11px] font-mono text-slate-600 tabular-nums">
            Относительный сдвиг: {comparison.totalDeltaPercent > 0 ? '+' : ''}
            {comparison.totalDeltaPercent}%
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-[11px] text-slate-500">Среднегодовой тренд (CAGR)</p>
          <p className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
            {comparison.yearSpan === 0
              ? '0%'
              : `${comparison.annualizedTotalGrowthPct > 0 ? '+' : ''}${comparison.annualizedTotalGrowthPct}% / год`}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600 tabular-nums">
            Горизонт: {comparison.yearSpan} {comparison.yearSpan === 1 ? 'год' : 'лет'}
          </p>
        </div>
      </div>

      {/* Dual Visualizations: Regional Bar Comparison + Inter-Year Trend Trajectory */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Regional Demand Period A vs Period B BarChart */}
        <div className="lg:col-span-6 border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
              <BarChart3 className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
              <h3>
                Срез по субъектам ДФО: {comparison.periodA} г. vs {comparison.periodB} г.
              </h3>
            </div>
            <p className="text-[11px] text-slate-500">
              Сопоставление потребности каждого региона в выбранных периодах (чел.)
            </p>
          </div>

          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comparison.regions}
                margin={{ top: 10, right: 12, left: -10, bottom: 16 }}
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="shortName"
                  tick={{ fontSize: 10.5, fill: '#475569' }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  tick={{
                    fontSize: 11,
                    fill: '#64748B',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(15, 118, 110, 0.08)' }}
                  content={
                    <PeriodBarTooltip
                      periodA={comparison.periodA}
                      periodB={comparison.periodB}
                    />
                  }
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />
                <Bar
                  dataKey="demandA"
                  name={`${comparison.periodA} г.`}
                  fill="#64748B"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="demandB"
                  name={`${comparison.periodB} г.`}
                  fill="#0F766E"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Multi-Year Trend Curve Highlighting Selected Interval */}
        <div className="lg:col-span-6 border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
              <TrendingUp className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
              <h3>
                Траектория тренда ДФО (коридор {windowStart}–{windowEnd} гг.)
              </h3>
            </div>
            <p className="text-[11px] text-slate-500">
              Выделен диапазон между выбранными периодами по совокупной потребности и основным кластерам
            </p>
          </div>

          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={comparison.trendSeries}
                margin={{ top: 14, right: 16, left: -8, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="year"
                  tick={{
                    fontSize: 11,
                    fill: '#475569',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fontSize: 11,
                    fill: '#64748B',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <Tooltip
                  trigger="hover"
                  shared
                  cursor={{ stroke: '#0F766E', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                  content={<PeriodTrendTooltip />}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }}
                  iconType="plainline"
                />

                {windowStart !== windowEnd && (
                  <ReferenceArea
                    x1={windowStart}
                    x2={windowEnd}
                    fill="#0F766E"
                    fillOpacity={0.07}
                  />
                )}
                <ReferenceLine
                  x={comparison.periodA}
                  stroke="#475569"
                  strokeDasharray="4 4"
                  label={{
                    value: `П1: ${comparison.periodA}`,
                    position: 'top',
                    fill: '#334155',
                    fontSize: 10.5,
                  }}
                />
                <ReferenceLine
                  x={comparison.periodB}
                  stroke="#0F766E"
                  strokeDasharray="4 4"
                  label={{
                    value: `П2: ${comparison.periodB}`,
                    position: 'top',
                    fill: '#0F766E',
                    fontSize: 10.5,
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="totalDemand"
                  name="Весь ДФО (сумма)"
                  stroke="#0F172A"
                  strokeWidth={2.75}
                  dot={{ r: 4, fill: '#FFFFFF', stroke: '#0F172A', strokeWidth: 2 }}
                  activeDot={{ r: 6.5, fill: '#0F172A', stroke: '#FFFFFF', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="primorye"
                  name="Приморский край"
                  stroke="#0F766E"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#FFFFFF', stroke: '#0F766E', strokeWidth: 2 }}
                  activeDot={{ r: 6.5, fill: '#0F766E', stroke: '#FFFFFF', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="kamchatka"
                  name="Камчатский край"
                  stroke="#D97706"
                  strokeWidth={2.2}
                  dot={{ r: 3.5, fill: '#FFFFFF', stroke: '#D97706', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#D97706', stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Compact Regional Growth Summary Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
              <th className="py-3 px-4">Регион ДФО</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">
                {comparison.periodA} г.
              </th>
              <th className="py-3 px-4 text-right whitespace-nowrap">
                {comparison.periodB} г.
              </th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Изменение (чел.)</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Динамика (%)</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Темп / год</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
            {comparison.regions.map((row) => (
              <tr key={row.regionId} className="hover:bg-slate-50/75 transition-colors">
                <td className="py-2.5 px-4 font-medium text-slate-900">{row.regionName}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                  {row.demandA.toLocaleString('ru-RU')}
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums text-teal-800 whitespace-nowrap">
                  {row.demandB.toLocaleString('ru-RU')}
                </td>
                <td
                  className={`py-2.5 px-4 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                    row.deltaAbsolute > 0
                      ? 'text-amber-800'
                      : row.deltaAbsolute < 0
                        ? 'text-teal-700'
                        : 'text-slate-500'
                  }`}
                >
                  {row.deltaAbsolute > 0 ? '+' : ''}
                  {row.deltaAbsolute.toLocaleString('ru-RU')}
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                  {row.deltaPercent > 0 ? '+' : ''}
                  {row.deltaPercent}%
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                  {comparison.yearSpan === 0
                    ? '—'
                    : `${row.annualizedGrowthPct > 0 ? '+' : ''}${row.annualizedGrowthPct}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
