import React, { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DemandForecastService,
  type DemandForecastResult,
  type DemandModelInput,
} from '../domain/certification/DemandForecastService.ts';
import {
  computeCalculatorScenarioProjection,
  type CalculatorScenarioProjection,
} from '../utils/calculatorScenario2030.ts';

interface SensitivityRechartsProps {
  pOrg: number;
  registryCount: number;
  results: DemandForecastResult;
}

export const CalculatorSensitivityRechartsChart: React.FC<SensitivityRechartsProps> = ({
  pOrg,
  registryCount,
  results,
}) => {
  const data = useMemo(
    () =>
      results.sensitivityPoints.map((pt) => ({
        pLabel: `${pt.p}%`,
        p: pt.p,
        demand: pt.n,
        registry: registryCount,
        deficit: Math.max(0, pt.n - registryCount),
      })),
    [results.sensitivityPoints, registryCount]
  );

  const snappedP = Math.round(Math.min(Math.max(pOrg, 10), 50) / 5) * 5;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Чувствительность потребности к доле организованных групп (P_org)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Кривая Recharts (10% → 50%) в сравнении с базовым реестром ({registryCount.toLocaleString('ru-RU')} чел.)
          </p>
        </div>
        <span className="text-xs text-teal-800 font-mono font-semibold tabular-nums">
          Текущая точка: {pOrg}% → {results.totalDemand.toLocaleString('ru-RU')} чел.
        </span>
      </div>

      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="calcSensFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0f766e" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#0f766e" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <ReferenceArea x1="15%" x2="30%" fill="#0f766e" fillOpacity={0.07} />
            <XAxis
              dataKey="pLabel"
              tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as (typeof data)[number] | undefined;
                if (!row) return null;
                return (
                  <div className="bg-slate-900 text-white rounded-lg px-3.5 py-2.5 text-xs shadow-lg border border-slate-700 space-y-1">
                    <div className="font-mono font-semibold text-teal-300">
                      Доля организованных групп: {label}
                    </div>
                    <div className="flex justify-between gap-4 font-mono tabular-nums">
                      <span className="text-slate-300">Потребность (N):</span>
                      <span className="font-bold">{row.demand.toLocaleString('ru-RU')} чел.</span>
                    </div>
                    <div className="flex justify-between gap-4 font-mono tabular-nums">
                      <span className="text-slate-300">Дефицит к реестру:</span>
                      <span className="text-red-300 font-semibold">
                        {row.deficit.toLocaleString('ru-RU')} чел.
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            <ReferenceLine
              y={registryCount}
              stroke="#b91c1c"
              strokeWidth={1.75}
              strokeDasharray="5 4"
              label={{
                value: `Реестр: ${registryCount}`,
                position: 'insideTopRight',
                fill: '#b91c1c',
                fontSize: 11,
                fontFamily: 'ui-monospace, monospace',
              }}
            />
            <ReferenceLine
              x={`${snappedP}%`}
              stroke="#0f172a"
              strokeDasharray="3 3"
              strokeWidth={1.25}
            />
            <Area
              type="monotone"
              dataKey="demand"
              name="Потребность в проводниках"
              stroke="#0f766e"
              strokeWidth={2.5}
              fill="url(#calcSensFill)"
              dot={{ r: 3.5, fill: '#0f766e', stroke: '#ffffff', strokeWidth: 1.5 }}
              activeDot={{ r: 5.5, fill: '#0f172a', stroke: '#ffffff', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

interface Yearly2030RechartsProps {
  modelInput: DemandModelInput;
  scenarioProjection: CalculatorScenarioProjection;
}

export const CalculatorYearly2030RechartsChart: React.FC<Yearly2030RechartsProps> = ({
  modelInput,
  scenarioProjection,
}) => {
  const [chartTab, setChartTab] = useState<'yearly_balance' | 'scenario_2030_gap'>('yearly_balance');

  const yearlyData = useMemo(() => {
    const full = DemandForecastService.forecastTourismScenarios2030(modelInput);
    const scKey = scenarioProjection.option.tourismScenarioId;
    return full.points.map((pt) => {
      const target = pt[scKey];
      const registry = pt.projectedRegistry;
      const deficit = Math.max(0, target - registry);
      return {
        year: pt.year,
        demand: target,
        registry,
        deficit,
        coveragePct: target > 0 ? Math.min(100, Math.round((registry / target) * 100)) : 0,
      };
    });
  }, [modelInput, scenarioProjection.option.tourismScenarioId]);

  const scenarioComparisonData = useMemo(() => {
    const ids: ('conservative' | 'baseline' | 'optimistic')[] = [
      'conservative',
      'baseline',
      'optimistic',
    ];
    return ids.map((id) => {
      const proj = computeCalculatorScenarioProjection(modelInput, id);
      return {
        name: proj.option.label,
        demand2030: proj.demand2030,
        registry2030: proj.projectedRegistry2030,
        deficit2030: proj.residualDeficit2030,
        coverage2030Pct: proj.coverage2030Pct,
      };
    });
  }, [modelInput]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-teal-700">Баланс спроса и подготовки (Recharts)</p>
          <h3 className="text-base font-bold text-slate-900 mt-0.5">
            Потребность, выпуск реестра ВВГУ и остаточный дефицит до 2030 года
          </h3>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setChartTab('yearly_balance')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              chartTab === 'yearly_balance'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Баланс по годам (2025–2030)
          </button>
          <button
            type="button"
            onClick={() => setChartTab('scenario_2030_gap')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              chartTab === 'scenario_2030_gap'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Срез 2030 по сценариям
          </button>
        </div>
      </div>

      <div className="h-[280px] w-full">
        {chartTab === 'yearly_balance' ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={yearlyData} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fill: '#475569', fontSize: 12, fontFamily: 'ui-monospace, monospace' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as (typeof yearlyData)[number] | undefined;
                  if (!row) return null;
                  return (
                    <div className="bg-slate-900 text-white rounded-lg px-3.5 py-2.5 text-xs shadow-lg border border-slate-700 space-y-1.5">
                      <div className="font-mono font-bold text-teal-300">
                        {label} г. · {scenarioProjection.option.label}
                      </div>
                      <div className="flex justify-between gap-4 font-mono tabular-nums">
                        <span className="text-slate-300">Прогноз потребности:</span>
                        <span className="font-bold">{row.demand.toLocaleString('ru-RU')} чел.</span>
                      </div>
                      <div className="flex justify-between gap-4 font-mono tabular-nums">
                        <span className="text-slate-300">Прогноз реестра ВВГУ:</span>
                        <span className="font-semibold text-teal-300">
                          {row.registry.toLocaleString('ru-RU')} чел. ({row.coveragePct}%)
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 font-mono tabular-nums">
                        <span className="text-slate-300">Остаточный дефицит:</span>
                        <span className="font-semibold text-red-300">
                          {row.deficit.toLocaleString('ru-RU')} чел.
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar
                dataKey="registry"
                name="Прогноз реестра ВВГУ"
                stackId="balance"
                fill="#0f766e"
                radius={[0, 0, 0, 0]}
                barSize={28}
              />
              <Bar
                dataKey="deficit"
                name="Остаточный дефицит"
                stackId="balance"
                fill="#fca5a5"
                radius={[4, 4, 0, 0]}
                barSize={28}
              />
              <Line
                type="monotone"
                dataKey="demand"
                name={`Потребность (${scenarioProjection.option.label})`}
                stroke="#0f172a"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#0f172a', stroke: '#ffffff', strokeWidth: 1.5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={scenarioComparisonData}
              margin={{ top: 10, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#334155', fontSize: 12, fontWeight: 600 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as (typeof scenarioComparisonData)[number] | undefined;
                  if (!row) return null;
                  return (
                    <div className="bg-slate-900 text-white rounded-lg px-3.5 py-2.5 text-xs shadow-lg border border-slate-700 space-y-1">
                      <div className="font-semibold text-teal-300">Сценарий 2030: {label}</div>
                      <div className="flex justify-between gap-4 font-mono tabular-nums">
                        <span className="text-slate-300">Спрос в 2030 г.:</span>
                        <span className="font-bold">{row.demand2030.toLocaleString('ru-RU')} чел.</span>
                      </div>
                      <div className="flex justify-between gap-4 font-mono tabular-nums">
                        <span className="text-slate-300">Реестр ВВГУ (2030):</span>
                        <span className="text-teal-300 font-semibold">
                          {row.registry2030.toLocaleString('ru-RU')} чел. ({row.coverage2030Pct}%)
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 font-mono tabular-nums">
                        <span className="text-slate-300">Дефицит 2030 г.:</span>
                        <span className="text-red-300 font-semibold">
                          {row.deficit2030.toLocaleString('ru-RU')} чел.
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar
                dataKey="demand2030"
                name="Потребность к 2030 г."
                fill="#0f172a"
                radius={[4, 4, 0, 0]}
                barSize={32}
              />
              <Bar
                dataKey="registry2030"
                name="Реестр ВВГУ (2030)"
                fill="#0f766e"
                radius={[4, 4, 0, 0]}
                barSize={32}
              />
              <Bar
                dataKey="deficit2030"
                name="Остаточный дефицит"
                fill="#dc2626"
                radius={[4, 4, 0, 0]}
                barSize={32}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
