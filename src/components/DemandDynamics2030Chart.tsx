import React, { useMemo, useState } from 'react';
import { LineChart as LineChartIcon } from 'lucide-react';
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
  DemandForecastService,
  type DemandModelInput,
  type TourismScenarioId,
  type TourismScenarioYearPoint,
} from '../domain/certification/DemandForecastService.ts';
import { tracker } from '../utils/tracker';

interface DemandDynamics2030ChartProps {
  modelInput: DemandModelInput;
}

interface TooltipPayloadItem {
  dataKey?: string;
  name?: string;
  value?: number;
  color?: string;
  payload?: TourismScenarioYearPoint;
}

const ScenarioLineTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0]?.payload;

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg p-3.5 shadow-lg max-w-xs text-xs space-y-2">
      <div className="flex items-baseline justify-between gap-4 border-b border-slate-700 pb-1.5">
        <span className="font-mono font-bold text-teal-300 tabular-nums">{label} г.</span>
        {pt && (
          <span className="font-mono text-[11px] text-slate-300 tabular-nums">
            Реестр (план ВВГУ): {pt.projectedRegistry.toLocaleString('ru-RU')} чел.
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
              {typeof entry.value === 'number' ? entry.value.toLocaleString('ru-RU') : entry.value}{' '}
              чел.
            </span>
          </div>
        ))}
      </div>

      {pt?.milestoneNote && (
        <p className="pt-1.5 border-t border-slate-700/80 text-[11px] text-slate-300 leading-snug">
          {pt.milestoneNote}
        </p>
      )}
    </div>
  );
};

export const DemandDynamics2030Chart: React.FC<DemandDynamics2030ChartProps> = ({
  modelInput,
}) => {
  const [activeScenario, setActiveScenario] = useState<TourismScenarioId>('baseline');
  const [compareAllScenarios, setCompareAllScenarios] = useState<boolean>(false);
  const [showRegistryLine, setShowRegistryLine] = useState<boolean>(true);

  const scenarioForecast = useMemo(
    () => DemandForecastService.forecastTourismScenarios2030(modelInput),
    [modelInput]
  );

  const selectedSummary = scenarioForecast.summaries[activeScenario];

  return (
    <section
      aria-labelledby="calculator-scenarios-2030-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header & Scenario Switcher */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-teal-700">
            <LineChartIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Линейный прогноз Recharts · 2025–2030 гг.</span>
            <span aria-hidden="true" className="text-slate-400">·</span>
            <span className="text-slate-500">
              Калибровка от текущих параметров калькулятора
            </span>
          </div>
          <h2
            id="calculator-scenarios-2030-heading"
            className="text-xl sm:text-2xl font-bold text-slate-900"
          >
            Прогнозируемая динамика потребности в инструкторах-проводниках до 2030 года
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {selectedSummary.description}
          </p>
        </div>

        {/* Comparison & Registry Overlays */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            aria-pressed={compareAllScenarios}
            onClick={() => {
              setCompareAllScenarios((prev) => {
                const next = !prev;
                tracker.trackCustomInteraction(
                  'Калькулятор 2030: сравнение сценариев',
                  next ? 'все' : activeScenario
                );
                return next;
              });
            }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              compareAllScenarios
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
            }`}
          >
            {compareAllScenarios ? 'Сравнение: все 4 сценария' : 'Сравнить все сценарии'}
          </button>

          <button
            type="button"
            aria-pressed={showRegistryLine}
            onClick={() => setShowRegistryLine((prev) => !prev)}
            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showRegistryLine
                ? 'bg-teal-50 border-teal-700 text-teal-900'
                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {showRegistryLine ? '✓ Линия реестра ВВГУ' : '+ Линия реестра ВВГУ'}
          </button>
        </div>
      </div>

      {/* Tourism Development Scenario Selector Tabs */}
      <div
        role="tablist"
        aria-label="Сценарии развития туризма до 2030 года"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5"
      >
        {scenarioForecast.scenarios.map((sc) => {
          const isSelected = activeScenario === sc.id;
          const stats = scenarioForecast.summaries[sc.id];
          return (
            <button
              key={sc.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => {
                setActiveScenario(sc.id);
                tracker.trackCustomInteraction('Калькулятор 2030: сценарий', sc.label);
              }}
              className={`text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-teal-50/70 border-teal-700 text-slate-900'
                  : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 truncate">{sc.label}</span>
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: sc.color }}
                  aria-hidden="true"
                />
              </div>
              <p className="mt-1 font-mono text-sm font-bold text-teal-800 tabular-nums">
                {stats.demand2030.toLocaleString('ru-RU')} чел.{' '}
                <span className="text-[11px] font-normal text-slate-600">
                  (+{stats.growthPct}%)
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 font-mono tabular-nums">
                Поток +{sc.annualFlowGrowthPct}%/г · P_org {stats.pOrg2030}%
              </p>
            </button>
          );
        })}
      </div>

      {/* 4 Scenario KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
          <p className="text-[11px] text-slate-500 font-medium">
            Потребность в 2026 г. ({selectedSummary.label})
          </p>
          <p className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
            {selectedSummary.demand2026.toLocaleString('ru-RU')} чел.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
          <p className="text-[11px] text-slate-500 font-medium">Прогноз на 2030 год</p>
          <p className="mt-1 text-xl font-bold font-mono text-teal-800 tabular-nums">
            {selectedSummary.demand2030.toLocaleString('ru-RU')} чел.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
          <p className="text-[11px] text-slate-500 font-medium">Прирост за 2025–2030</p>
          <p className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
            +{selectedSummary.growthPct}%{' '}
            <span className="text-xs font-normal text-slate-500">
              (K_season {selectedSummary.kSeason2030.toFixed(2)})
            </span>
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
          <p className="text-[11px] text-slate-500 font-medium">Остаточный дефицит (2030)</p>
          <p className="mt-1 text-xl font-bold font-mono text-red-700 tabular-nums">
            {selectedSummary.deficit2030.toLocaleString('ru-RU')} чел.
          </p>
        </div>
      </div>

      {/* Recharts LineChart */}
      <div className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-white">
        <div className="w-full h-[330px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={scenarioForecast.points}
              margin={{ top: 18, right: 20, left: 0, bottom: 8 }}
            >
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
              <Tooltip content={<ScenarioLineTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} iconType="plainline" />

              <ReferenceLine
                x="2026"
                stroke="#0F172A"
                strokeDasharray="4 4"
                strokeOpacity={0.45}
                label={{
                  value: 'ПП № 1893',
                  position: 'top',
                  fill: '#475569',
                  fontSize: 10,
                }}
              />
              <ReferenceLine
                x="2028"
                stroke="#0F766E"
                strokeDasharray="4 4"
                strokeOpacity={0.45}
                label={{
                  value: 'Кластер ДФО',
                  position: 'top',
                  fill: '#0F766E',
                  fontSize: 10,
                }}
              />

              {compareAllScenarios ? (
                scenarioForecast.scenarios.map((sc) => (
                  <Line
                    key={sc.id}
                    type="monotone"
                    dataKey={sc.id}
                    name={sc.shortLabel}
                    stroke={sc.color}
                    strokeWidth={sc.id === activeScenario ? 3.5 : 2}
                    strokeOpacity={sc.id === activeScenario ? 1 : 0.72}
                    dot={{
                      r: sc.id === activeScenario ? 4.5 : 3,
                      strokeWidth: 2,
                      fill: '#FFFFFF',
                    }}
                    activeDot={{ r: 6.5 }}
                  />
                ))
              ) : (
                <Line
                  type="monotone"
                  dataKey={activeScenario}
                  name={`Потребность (${selectedSummary.shortLabel})`}
                  stroke={selectedSummary.color}
                  strokeWidth={3.2}
                  dot={{ r: 5, strokeWidth: 2, fill: '#FFFFFF' }}
                  activeDot={{ r: 7 }}
                />
              )}

              {showRegistryLine && (
                <Line
                  type="monotone"
                  dataKey="projectedRegistry"
                  name="Прогноз легального реестра (набор ВВГУ)"
                  stroke="#0284C7"
                  strokeDasharray="6 4"
                  strokeWidth={2.2}
                  dot={{ r: 3.5, fill: '#0284C7' }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
        Расчёт динамически реагирует на ползунки модели выше (активные туристы{' '}
        <span className="font-mono text-slate-700 tabular-nums">
          {modelInput.tAct.toLocaleString('ru-RU')}
        </span>
        , базовая доля организованных групп{' '}
        <span className="font-mono text-slate-700 tabular-nums">{modelInput.pOrg}%</span>,
        ежегодный выпуск{' '}
        <span className="font-mono text-slate-700 tabular-nums">
          {modelInput.groupsPerYear * modelInput.cohortSize}
        </span>{' '}
        чел. при конверсии{' '}
        <span className="font-mono text-slate-700 tabular-nums">{modelInput.conversionRate}%</span>
        ).
      </p>
    </section>
  );
};
