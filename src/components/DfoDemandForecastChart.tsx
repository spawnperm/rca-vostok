import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DFO_REGIONAL_DEMAND_FORECAST_2025_2030,
  type DfoRegionalDemandPoint,
} from '../data/researchData';
import { tracker } from '../utils/tracker';

interface ForecastTooltipPayloadEntry {
  dataKey?: string;
  name?: string;
  value?: number;
  color?: string;
  payload?: DfoRegionalDemandPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ForecastTooltipPayloadEntry[];
  label?: string;
}

const REGION_SERIES = [
  { key: 'primorye', label: 'Приморский край', color: '#0F766E' },
  { key: 'kamchatka', label: 'Камчатский край', color: '#0F172A' },
  { key: 'khabarovsk', label: 'Хабаровский край', color: '#D97706' },
  { key: 'sakhalinAndOther', label: 'Сахалин и др. субъекты ДФО', color: '#475569' },
] as const;

const CustomForecastTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg p-3.5 shadow-lg max-w-xs text-xs space-y-2">
      <div className="flex items-baseline justify-between gap-4 border-b border-slate-700 pb-1.5">
        <span className="font-mono font-bold text-teal-300 tabular-nums">{label} г.</span>
        {point && (
          <span className="font-mono font-semibold text-white tabular-nums">
            Итого ДФО: {point.totalDemand.toLocaleString('ru-RU')} чел.
          </span>
        )}
      </div>

      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-200 truncate">
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: entry.color }}
                aria-hidden="true"
              />
              <span className="truncate">{entry.name}</span>
            </span>
            <span className="font-mono font-semibold tabular-nums text-white shrink-0">
              {typeof entry.value === 'number' ? entry.value.toLocaleString('ru-RU') : entry.value} чел.
            </span>
          </div>
        ))}
      </div>

      {point && (
        <div className="pt-1.5 border-t border-slate-700/80 space-y-1 text-[11px] text-slate-300 leading-snug">
          <p className="font-mono tabular-nums text-teal-300">
            Прогноз реестра ДФО: {point.projectedRegistry.toLocaleString('ru-RU')} чел.
          </p>
          <p>{point.driverNote}</p>
        </div>
      )}
    </div>
  );
};

export const DfoDemandForecastChart: React.FC = () => {
  const [scenario, setScenario] = useState<'base' | 'conservative'>('base');
  const [chartType, setChartType] = useState<'lines' | 'stacked'>('lines');

  const seriesData = useMemo(
    () => DFO_REGIONAL_DEMAND_FORECAST_2025_2030[scenario],
    [scenario]
  );

  const firstPoint = seriesData[0];
  const lastPoint = seriesData[seriesData.length - 1];
  const growthPct = Math.round(
    ((lastPoint.totalDemand - firstPoint.totalDemand) / Math.max(firstPoint.totalDemand, 1)) * 100
  );
  const primoryeShare2030 = Math.round((lastPoint.primorye / lastPoint.totalDemand) * 100);
  const coverage2030Pct = Math.round((lastPoint.projectedRegistry / lastPoint.totalDemand) * 100);

  return (
    <section
      aria-labelledby="dfo-forecast-chart-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700">
            Эконометрический прогноз до 2030 года
          </p>
          <h2 id="dfo-forecast-chart-heading" className="text-lg sm:text-xl font-bold text-slate-900">
            Прогнозируемая динамика спроса на аттестованных инструкторов-проводников в регионах ДФО
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Оценка совокупной потребности по ключевым субъектам Дальнего Востока с учётом
            нормативного дедлайна № 1893, ввода курорта «Приморье» (2027 г.), Хасанского кластера
            (2028 г.) и пятилетнего цикла переаттестации (2030 г.).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setScenario('base');
                tracker.trackCustomInteraction('Прогноз ДФО 2030: Базовый сценарий');
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scenario === 'base'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Базовый (P_org 30%)
            </button>
            <button
              type="button"
              onClick={() => {
                setScenario('conservative');
                tracker.trackCustomInteraction('Прогноз ДФО 2030: Консервативный сценарий');
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

          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setChartType('lines')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                chartType === 'lines'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              По регионам
            </button>
            <button
              type="button"
              onClick={() => setChartType('stacked')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                chartType === 'stacked'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Накопительный
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-[11px] font-medium text-slate-500">Спрос по ДФО · 2026 г.</p>
          <p className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
            {seriesData[1].totalDemand.toLocaleString('ru-RU')} чел.
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-[11px] font-medium text-slate-500">Прогноз по ДФО · 2030 г.</p>
          <p className="mt-1 text-xl font-bold font-mono text-teal-800 tabular-nums">
            {lastPoint.totalDemand.toLocaleString('ru-RU')} чел.
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-[11px] font-medium text-slate-500">Прирост спроса (2025–2030)</p>
          <p className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
            +{growthPct}%
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-[11px] font-medium text-slate-500">Доля Приморья / Покрытие 2030</p>
          <p className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
            {primoryeShare2030}% / {coverage2030Pct}%
          </p>
        </div>
      </div>

      {/* Recharts Container */}
      <div className="w-full h-[340px] pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'lines' ? (
            <LineChart data={seriesData} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 12, fill: '#475569', fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={{ stroke: '#CBD5E1' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={{ stroke: '#CBD5E1' }}
                tickLine={false}
                tickFormatter={(v: number) => v.toLocaleString('ru-RU')}
              />
              <Tooltip content={<CustomForecastTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
                iconType="plainline"
              />
              {REGION_SERIES.map((reg) => (
                <Line
                  key={reg.key}
                  type="monotone"
                  dataKey={reg.key}
                  name={reg.label}
                  stroke={reg.color}
                  strokeWidth={2.5}
                  dot={{ r: 4, strokeWidth: 2, fill: '#FFFFFF' }}
                  activeDot={{ r: 6 }}
                />
              ))}
              <Line
                type="monotone"
                dataKey="projectedRegistry"
                name="Целевое покрытие реестром ДФО"
                stroke="#0D9488"
                strokeDasharray="5 5"
                strokeWidth={2}
                dot={{ r: 3, fill: '#0D9488' }}
              />
            </LineChart>
          ) : (
            <AreaChart data={seriesData} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 12, fill: '#475569', fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={{ stroke: '#CBD5E1' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={{ stroke: '#CBD5E1' }}
                tickLine={false}
                tickFormatter={(v: number) => v.toLocaleString('ru-RU')}
              />
              <Tooltip content={<CustomForecastTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
              {REGION_SERIES.map((reg) => (
                <Area
                  key={reg.key}
                  type="monotone"
                  dataKey={reg.key}
                  name={reg.label}
                  stackId="dfo-demand"
                  stroke={reg.color}
                  fill={reg.color}
                  fillOpacity={0.18}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-200 leading-relaxed">
        Источник расчётов: модель ВВГУ и РЦА «Русский Восток» (P_org = {scenario === 'base' ? '30%' : '18%'},
        7-месячный сезон в Приморье, контрольные данные по Камчатке и Хабаровскому краю).
      </p>
    </section>
  );
};
