import React, { useMemo, useState } from 'react';
import { Activity, GitCompare } from 'lucide-react';
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
  DFO_CERTIFIED_DYNAMICS_BY_REGION,
  DFO_REGIONS_DISTRIBUTION,
  type DfoCertifiedYearPoint,
} from '../data/researchData';
import { tracker } from '../utils/tracker';

interface DfoCertifiedDynamicsLineChartProps {
  selectedRegionId: string;
  comparisonRegionId?: string;
}

type HorizonFilter = 'all' | 'fact' | 'forecast';

interface ChartYearPoint {
  year: string;
  certifiedCount: number;
  certifiedFact: number | null;
  certifiedForecast: number | null;
  annualAdditions: number;
  phase: 'факт' | 'прогноз';
  note: string;
  comparisonCount: number | null;
  comparisonAdditions: number | null;
}

interface CustomTooltipPayloadEntry {
  dataKey?: string;
  name?: string;
  value?: number;
  color?: string;
  payload?: ChartYearPoint;
}

const CertifiedDynamicsTooltip: React.FC<{
  active?: boolean;
  payload?: CustomTooltipPayloadEntry[];
  label?: string;
  selectedName: string;
  comparisonName?: string;
  showComparison: boolean;
}> = ({ active, payload, label, selectedName, comparisonName, showComparison }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg p-3.5 shadow-lg max-w-xs text-xs space-y-2">
      <div className="flex items-baseline justify-between gap-4 border-b border-slate-700 pb-1.5">
        <span className="font-mono font-bold text-teal-300 tabular-nums">{label} г.</span>
        <span className="text-[11px] font-medium text-slate-300">
          {point.phase === 'факт' ? 'Фактический срез' : 'Прогноз РЦА / МЭР'}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-slate-200 truncate">
            <span className="w-2.5 h-2.5 rounded-xs bg-teal-500 shrink-0" aria-hidden="true" />
            <span className="truncate">{selectedName}</span>
          </span>
          <span className="font-mono font-semibold tabular-nums text-white shrink-0">
            {point.certifiedCount.toLocaleString('ru-RU')} чел.
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 text-[11px] text-slate-300">
          <span>Новых аттестаций за год</span>
          <span className="font-mono font-semibold tabular-nums text-teal-300">
            +{point.annualAdditions.toLocaleString('ru-RU')} чел.
          </span>
        </div>

        {showComparison && comparisonName && point.comparisonCount !== null && (
          <div className="pt-1.5 border-t border-slate-800 space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-slate-200 truncate">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 shrink-0" aria-hidden="true" />
                <span className="truncate">{comparisonName}</span>
              </span>
              <span className="font-mono font-semibold tabular-nums text-white shrink-0">
                {point.comparisonCount.toLocaleString('ru-RU')} чел.
              </span>
            </div>
            {point.comparisonAdditions !== null && (
              <div className="flex items-center justify-between gap-4 text-[11px] text-slate-400">
                <span>Прирост за год</span>
                <span className="font-mono tabular-nums">
                  +{point.comparisonAdditions.toLocaleString('ru-RU')} чел.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {point.note && (
        <p className="pt-1.5 border-t border-slate-700/80 text-[11px] text-slate-300 leading-snug">
          {point.note}
        </p>
      )}
    </div>
  );
};

export const DfoCertifiedDynamicsLineChart: React.FC<DfoCertifiedDynamicsLineChartProps> = ({
  selectedRegionId,
  comparisonRegionId,
}) => {
  const [horizonFilter, setHorizonFilter] = useState<HorizonFilter>('all');
  const [showComparisonOverlay, setShowComparisonOverlay] = useState<boolean>(false);

  const selectedRegion = useMemo(
    () =>
      DFO_REGIONS_DISTRIBUTION.find((r) => r.id === selectedRegionId) ??
      DFO_REGIONS_DISTRIBUTION[0],
    [selectedRegionId]
  );

  const comparisonRegion = useMemo(() => {
    if (!comparisonRegionId || comparisonRegionId === selectedRegion.id) return null;
    return DFO_REGIONS_DISTRIBUTION.find((r) => r.id === comparisonRegionId) ?? null;
  }, [comparisonRegionId, selectedRegion.id]);

  const rawSeries: DfoCertifiedYearPoint[] = useMemo(
    () =>
      DFO_CERTIFIED_DYNAMICS_BY_REGION[selectedRegion.id] ??
      DFO_CERTIFIED_DYNAMICS_BY_REGION.primorye,
    [selectedRegion.id]
  );

  const comparisonSeries: DfoCertifiedYearPoint[] | null = useMemo(() => {
    if (!comparisonRegion) return null;
    return DFO_CERTIFIED_DYNAMICS_BY_REGION[comparisonRegion.id] ?? null;
  }, [comparisonRegion]);

  const chartData: ChartYearPoint[] = useMemo(() => {
    const filtered = rawSeries.filter((pt) => {
      if (horizonFilter === 'fact') return pt.phase === 'факт';
      if (horizonFilter === 'forecast') return Number(pt.year) >= 2026;
      return true;
    });

    return filtered.map((pt) => {
      const yearNum = Number(pt.year);
      const compPt = comparisonSeries?.find((c) => c.year === pt.year) ?? null;

      return {
        year: pt.year,
        certifiedCount: pt.certifiedCount,
        certifiedFact: yearNum <= 2026 ? pt.certifiedCount : null,
        certifiedForecast: yearNum >= 2026 ? pt.certifiedCount : null,
        annualAdditions: pt.annualAdditions,
        phase: pt.phase,
        note: pt.note,
        comparisonCount: compPt ? compPt.certifiedCount : null,
        comparisonAdditions: compPt ? compPt.annualAdditions : null,
      };
    });
  }, [rawSeries, comparisonSeries, horizonFilter]);

  const metrics = useMemo(() => {
    const p2024 = rawSeries.find((p) => p.year === '2024') ?? rawSeries[0];
    const p2025 = rawSeries.find((p) => p.year === '2025') ?? rawSeries[1];
    const p2026 = rawSeries.find((p) => p.year === '2026') ?? rawSeries[2];
    const p2030 = rawSeries.find((p) => p.year === '2030') ?? rawSeries[rawSeries.length - 1];

    const growth2024To2026Pct =
      p2024.certifiedCount > 0
        ? Math.round(((p2026.certifiedCount - p2024.certifiedCount) / p2024.certifiedCount) * 100)
        : 0;

    const growthFactor2024To2030 =
      p2024.certifiedCount > 0
        ? Math.round((p2030.certifiedCount / p2024.certifiedCount) * 10) / 10
        : 0;

    const demandCoverage2030Pct = Math.min(
      100,
      Math.round((p2030.certifiedCount / Math.max(selectedRegion.estimatedDemand, 1)) * 1000) / 10
    );

    return {
      p2024,
      p2025,
      p2026,
      p2030,
      growth2024To2026Pct,
      growthFactor2024To2030,
      demandCoverage2030Pct,
    };
  }, [rawSeries, selectedRegion.estimatedDemand]);

  const isComparisonVisible = Boolean(showComparisonOverlay && comparisonRegion);

  return (
    <div
      aria-labelledby="dfo-certified-dynamics-heading"
      className="border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5 bg-white"
    >
      {/* Header Row */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 font-medium text-teal-700">
              <Activity className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Динамика по годам (Recharts)
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Выбранный регион на карте:{' '}
              <strong className="font-semibold text-slate-900">{selectedRegion.name}</strong>
            </span>
          </div>
          <h3 id="dfo-certified-dynamics-heading" className="text-lg font-bold text-slate-900">
            Динамика аттестованных инструкторов по годам: {selectedRegion.shortName} (2024–2030 гг.)
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Клик по любому субъекту на интерактивной карте ДФО выше обновляет кривую численности
            аттестованных гидов в Едином федеральном реестре (сплошная линия — факт 2024–2026 гг.,
            пунктир — прогноз РЦА/МЭР до 2030 г.).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {comparisonRegion && (
            <button
              type="button"
              onClick={() => {
                const next = !showComparisonOverlay;
                setShowComparisonOverlay(next);
                tracker.trackCustomInteraction(
                  'График динамики аттестованных: наложение сравнения',
                  next ? `${selectedRegion.shortName} vs ${comparisonRegion.shortName}` : 'выкл'
                );
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isComparisonVisible
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {isComparisonVisible
                ? `Сравнение: ${comparisonRegion.shortName} вкл.`
                : `Наложить: ${comparisonRegion.shortName}`}
            </button>
          )}

          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
            {(
              [
                { id: 'all', label: '2024–2030' },
                { id: 'fact', label: 'Факт 2024–2026' },
                { id: 'forecast', label: 'Прогноз 2026–2030' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setHorizonFilter(opt.id);
                  tracker.trackCustomInteraction(
                    'Фильтр периода динамики аттестованных',
                    opt.label
                  );
                }}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  horizonFilter === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4 Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
          <p className="text-[11px] text-slate-500">Старт реестра (2024 г.)</p>
          <p className="mt-1 text-lg font-bold font-mono text-slate-900 tabular-nums">
            {metrics.p2024.certifiedCount.toLocaleString('ru-RU')} чел.
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 font-mono tabular-nums">
            +{metrics.p2024.annualAdditions} за 2024 г.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
          <p className="text-[11px] text-slate-500">Факт 2025 → 2026 г.</p>
          <p className="mt-1 text-lg font-bold font-mono text-teal-800 tabular-nums">
            {metrics.p2025.certifiedCount.toLocaleString('ru-RU')} →{' '}
            {metrics.p2026.certifiedCount.toLocaleString('ru-RU')}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 font-mono tabular-nums">
            +{metrics.p2026.annualAdditions} новых в 2026 г.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
          <p className="text-[11px] text-slate-500">Рост факта (2024→2026)</p>
          <p className="mt-1 text-lg font-bold font-mono text-slate-900 tabular-nums">
            +{metrics.growth2024To2026Pct.toLocaleString('ru-RU')}%
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 font-mono tabular-nums">
            РЦА окт. 2026: +{selectedRegion.october2026Certified} чел.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
          <p className="text-[11px] text-slate-500">Ориентир к 2030 г.</p>
          <p className="mt-1 text-lg font-bold font-mono text-teal-700 tabular-nums">
            {metrics.p2030.certifiedCount.toLocaleString('ru-RU')} чел.
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 font-mono tabular-nums">
            Рост {metrics.growthFactor2024To2030}× к 2024 г.
          </p>
        </div>
      </div>

      {/* Recharts LineChart Viewport */}
      <div className="w-full h-[310px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 22, right: 20, left: -6, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11, fill: '#475569', fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={{ stroke: '#CBD5E1' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={{ stroke: '#CBD5E1' }}
              tickLine={false}
              tickFormatter={(v: number) => v.toLocaleString('ru-RU')}
            />
            <Tooltip
              content={
                <CertifiedDynamicsTooltip
                  selectedName={selectedRegion.shortName}
                  comparisonName={comparisonRegion?.shortName}
                  showComparison={isComparisonVisible}
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} iconType="plainline" />

            {chartData.some((pt) => pt.year === '2026') && (
              <ReferenceLine
                x="2026"
                stroke="#94A3B8"
                strokeDasharray="4 4"
                label={{
                  value: 'ПП № 1893 (01.10.2026)',
                  position: 'top',
                  fill: '#475569',
                  fontSize: 10.5,
                }}
              />
            )}

            {horizonFilter !== 'forecast' && (
              <Line
                type="monotone"
                dataKey="certifiedFact"
                name={`${selectedRegion.shortName}: факт (реестр)`}
                stroke="#0F766E"
                strokeWidth={3}
                dot={{ r: 4.5, strokeWidth: 2, fill: '#0F766E', stroke: '#FFFFFF' }}
                activeDot={{ r: 6.5 }}
                connectNulls={false}
              />
            )}

            {horizonFilter !== 'fact' && (
              <Line
                type="monotone"
                dataKey="certifiedForecast"
                name={`${selectedRegion.shortName}: прогноз РЦА/МЭР`}
                stroke="#0F766E"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                dot={{ r: 4, strokeWidth: 2, fill: '#FFFFFF', stroke: '#0F766E' }}
                activeDot={{ r: 6 }}
                connectNulls={false}
              />
            )}

            {isComparisonVisible && comparisonRegion && (
              <Line
                type="monotone"
                dataKey="comparisonCount"
                name={`${comparisonRegion.shortName} (для сравнения)`}
                stroke="#D97706"
                strokeWidth={2.25}
                dot={{ r: 3.5, strokeWidth: 1.75, fill: '#FFFFFF', stroke: '#D97706' }}
                activeDot={{ r: 5.5 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Compact Yearly Breakdown Strip */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <th className="py-2 px-3 font-semibold">Год</th>
              {rawSeries.map((pt) => (
                <th
                  key={pt.year}
                  className="py-2 px-3 font-mono font-semibold text-right tabular-nums"
                >
                  {pt.year}
                  <span className="block text-[10px] font-sans font-normal text-slate-400">
                    {pt.phase}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-2 px-3 font-medium text-slate-700 whitespace-nowrap">
                Аттестовано, чел.
              </td>
              {rawSeries.map((pt) => (
                <td
                  key={`cnt-${pt.year}`}
                  className={`py-2 px-3 font-mono font-semibold text-right tabular-nums ${
                    pt.phase === 'факт' ? 'text-slate-900' : 'text-teal-800'
                  }`}
                >
                  {pt.certifiedCount.toLocaleString('ru-RU')}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 px-3 text-slate-500 whitespace-nowrap">Прирост за год</td>
              {rawSeries.map((pt) => (
                <td
                  key={`add-${pt.year}`}
                  className="py-2 px-3 font-mono text-right text-slate-600 tabular-nums"
                >
                  +{pt.annualAdditions.toLocaleString('ru-RU')}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
