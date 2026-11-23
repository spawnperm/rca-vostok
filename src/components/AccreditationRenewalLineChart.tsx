import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck2, Play, TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ACCREDITATION_RENEWAL_DYNAMICS,
  getAccreditationRenewalSeries,
  type AccreditationHorizonFilter,
  type AccreditationRenewalYearPoint,
} from '../data/dfoOverviewRegistryData';
import { tracker } from '../utils/tracker';

interface ChartPoint extends AccreditationRenewalYearPoint {
  activeFact: number | null;
  activePlanned: number | null;
  contoursDeltaYoY: number;
  roadmapCompletionPct: number;
}

interface TooltipPayloadEntry {
  payload?: ChartPoint;
}

const TOTAL_TARGET_CONTOURS = 7;

const AccreditationDynamicsTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg p-3.5 shadow-xl max-w-xs text-xs space-y-2">
      <div className="flex items-baseline justify-between gap-4 border-b border-slate-700 pb-1.5">
        <span className="font-mono font-bold text-teal-300 tabular-nums">{label} г.</span>
        <span className="text-[11px] font-medium text-slate-300">
          {pt.phase === 'факт' ? 'Факт реестра' : 'План развития'} · {pt.roadmapCompletionPct}% модели
        </span>
      </div>

      <p className="font-semibold text-white leading-snug">{pt.milestoneTitle}</p>

      <div className="space-y-1 text-[11px]">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-300 inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-teal-500 shrink-0" aria-hidden="true" />
            Действующих контуров:
          </span>
          <span className="font-mono font-bold text-white tabular-nums">
            {pt.activeContours} из {TOTAL_TARGET_CONTOURS}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-300 inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400 shrink-0" aria-hidden="true" />
            Прирост за год:
          </span>
          <span className="font-mono font-bold text-emerald-300 tabular-nums">
            {pt.contoursDeltaYoY > 0 ? `+${pt.contoursDeltaYoY}` : '0'} конт.
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-300 inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-sky-400 shrink-0" aria-hidden="true" />
            Продлений и аудитов за год:
          </span>
          <span className="font-mono font-bold text-sky-300 tabular-nums">
            {pt.renewalsAndUpdates}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-300 inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 shrink-0" aria-hidden="true" />
            В стадии согласования:
          </span>
          <span className="font-mono font-bold text-amber-300 tabular-nums">
            {pt.plannedExpansions}
          </span>
        </div>
      </div>

      <p className="pt-1.5 border-t border-slate-700/80 text-[11px] text-slate-300 leading-snug">
        {pt.milestoneDetails}
      </p>
    </div>
  );
};

export const AccreditationRenewalLineChart: React.FC = () => {
  const [horizon, setHorizon] = useState<AccreditationHorizonFilter>('all');
  const [animationKey, setAnimationKey] = useState<number>(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const chartData: ChartPoint[] = useMemo(() => {
    const filtered = getAccreditationRenewalSeries(horizon);
    return filtered.map((pt, idx) => {
      const yr = Number(pt.year);
      const prevPoint = idx > 0 ? filtered[idx - 1] : null;
      const contoursDeltaYoY = prevPoint ? Math.max(0, pt.activeContours - prevPoint.activeContours) : 0;
      const roadmapCompletionPct = Math.round((pt.activeContours / TOTAL_TARGET_CONTOURS) * 100);
      return {
        ...pt,
        activeFact: yr <= 2026 ? pt.activeContours : null,
        activePlanned: yr >= 2026 ? pt.activeContours : null,
        contoursDeltaYoY,
        roadmapCompletionPct,
      };
    });
  }, [horizon]);

  const totalRenewals2024To2030 = useMemo(
    () =>
      ACCREDITATION_RENEWAL_DYNAMICS.reduce(
        (sum, pt) => sum + pt.renewalsAndUpdates,
        0
      ),
    []
  );

  const current2026 =
    ACCREDITATION_RENEWAL_DYNAMICS.find((p) => p.year === '2026') ??
    ACCREDITATION_RENEWAL_DYNAMICS[2];

  const peakYear = useMemo(
    () =>
      ACCREDITATION_RENEWAL_DYNAMICS.reduce((best, cur) =>
        cur.renewalsAndUpdates > best.renewalsAndUpdates ? cur : best
      ),
    []
  );

  const animationsEnabled = !prefersReducedMotion;

  return (
    <section
      aria-labelledby="accreditation-renewal-chart-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header & Horizon Switch */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1 max-w-3xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Визуализация данных «Реестра аккредитации» (Recharts)</span>
          </p>
          <h2 id="accreditation-renewal-chart-heading" className="text-xl font-bold text-slate-900">
            Динамика роста и продления аккредитации РЦА по годам (2024–2030 гг.)
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Анимированный график отражает ежегодный рост действующих правовых контуров ВВГУ и РЦА
            «Русский Восток», частоту аудитов и контрольные циклы Единого федерального реестра МЭР РФ.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Горизонт графика продления лицензий"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {(
              [
                { id: 'all', label: 'Весь цикл (2024–2030)' },
                { id: 'fact', label: 'Факт 2024–2026' },
                { id: 'forecast', label: 'План 2026–2030' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setHorizon(opt.id);
                  setAnimationKey((k) => k + 1);
                  tracker.trackCustomInteraction(
                    'График продления лицензий: горизонт',
                    opt.label
                  );
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  horizon === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {animationsEnabled && (
            <button
              type="button"
              onClick={() => setAnimationKey((k) => k + 1)}
              title="Перезапустить анимацию построения графика"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" aria-hidden="true" />
              <span>Анимация</span>
            </button>
          )}
        </div>
      </div>

      {/* 3 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-[11px] text-slate-500">Действующие контуры (2026 г.)</p>
          <p className="mt-1 text-xl font-bold font-mono text-teal-800 tabular-nums">
            {current2026.activeContours} из 7 контуров
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600">
            +1 проектируемое расширение (автотуризм ДПО, I кв. 2027)
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-[11px] text-slate-500">Процедур продления и аудита (2024–2030)</p>
          <p className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
            {totalRenewals2024To2030} процедур
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600">
            Сквозное подтверждение лицензий ВВГУ, актов полигонов и ФСТР
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
            <CalendarCheck2 className="w-3.5 h-3.5 text-sky-700" aria-hidden="true" />
            <span>Пиковый год продлений</span>
          </p>
          <p className="mt-1 text-xl font-bold font-mono text-sky-800 tabular-nums">
            {peakYear.year} г. ({peakYear.renewalsAndUpdates} проц.)
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600">
            Завершение 5-летнего цикла записей Единого реестра МЭР РФ
          </p>
        </div>
      </div>

      {/* Animated Recharts LineChart with Rich Year-by-Year Tooltips */}
      <div className="w-full h-[310px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            key={`${horizon}-${animationKey}`}
            data={chartData}
            margin={{ top: 24, right: 20, left: -10, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11, fill: '#475569', fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={{ stroke: '#CBD5E1' }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              domain={[0, 8]}
              tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={{ stroke: '#CBD5E1' }}
              tickLine={false}
            />
            <Tooltip
              trigger="hover"
              shared
              cursor={{ stroke: '#0F766E', strokeWidth: 1.5, strokeDasharray: '4 4' }}
              allowEscapeViewBox={{ x: true, y: true }}
              content={<AccreditationDynamicsTooltip />}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} iconType="plainline" />

            {chartData.some((pt) => pt.year === '2026') && (
              <ReferenceLine
                x="2026"
                stroke="#94A3B8"
                strokeDasharray="4 4"
                label={{
                  value: 'ПП № 1893 (01.03.2026)',
                  position: 'top',
                  fill: '#475569',
                  fontSize: 10.5,
                }}
              />
            )}

            {horizon !== 'forecast' && (
              <Line
                type="monotone"
                dataKey="activeFact"
                name="Действующие лицензии и контуры (факт)"
                stroke="#0F766E"
                strokeWidth={3}
                dot={{ r: 4.5, strokeWidth: 2, fill: '#0F766E', stroke: '#FFFFFF' }}
                activeDot={{ r: 7, fill: '#0F766E', stroke: '#FFFFFF', strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={animationsEnabled}
                animationDuration={850}
                animationBegin={0}
                animationEasing="ease-out"
              />
            )}

            {horizon !== 'fact' && (
              <Line
                type="monotone"
                dataKey="activePlanned"
                name="Действующие лицензии и контуры (план)"
                stroke="#0F766E"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                dot={{ r: 4.5, strokeWidth: 2, fill: '#FFFFFF', stroke: '#0F766E' }}
                activeDot={{ r: 7, fill: '#0F766E', stroke: '#FFFFFF', strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={animationsEnabled}
                animationDuration={950}
                animationBegin={140}
                animationEasing="ease-out"
              />
            )}

            <Line
              type="monotone"
              dataKey="renewalsAndUpdates"
              name="Продления и аудиты за год"
              stroke="#0284C7"
              strokeWidth={2.5}
              dot={{ r: 4, strokeWidth: 2, fill: '#0284C7', stroke: '#FFFFFF' }}
              activeDot={{ r: 6.5, fill: '#0284C7', stroke: '#FFFFFF', strokeWidth: 2 }}
              isAnimationActive={animationsEnabled}
              animationDuration={1000}
              animationBegin={220}
              animationEasing="ease-out"
            />

            <Line
              type="monotone"
              dataKey="plannedExpansions"
              name="Новые модули на согласовании"
              stroke="#D97706"
              strokeWidth={2}
              strokeDasharray="3 3"
              dot={{ r: 3.5, strokeWidth: 1.5, fill: '#FFFFFF', stroke: '#D97706' }}
              activeDot={{ r: 6, fill: '#D97706', stroke: '#FFFFFF', strokeWidth: 2 }}
              isAnimationActive={animationsEnabled}
              animationDuration={900}
              animationBegin={320}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
