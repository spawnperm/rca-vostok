import React, { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { DEMAND_PRESETS, DemandPreset } from '../data/researchData';
import { DemandForecastService } from '../domain/certification/DemandForecastService.ts';
import {
  CALCULATOR_FORECAST_SCENARIOS,
  computeCalculatorScenarioProjection,
  type CalculatorForecastScenario,
} from '../utils/calculatorScenario2030';
import { tracker } from '../utils/tracker';
import { DemandDynamics2030Chart } from './DemandDynamics2030Chart';
import { DfoRegionalForecastModule } from './DfoRegionalForecastModule';
import { TrainingAndAttestationCostEstimator } from './TrainingAndAttestationCostEstimator';
import { IntensiveAttestationCostModule } from './IntensiveAttestationCostModule';
import { TrainingCostByComplexityChart } from './TrainingCostByComplexityChart';
import { StateDutyAttestationCalculator } from './StateDutyAttestationCalculator';
import { AttestationKnowledgeQuiz } from './AttestationKnowledgeQuiz';
import { ExpertRatingCalculatorWidget } from './ExpertRatingCalculatorWidget';

export const CalculatorSection: React.FC = () => {
  const [activePresetId, setActivePresetId] = useState<string>(DEMAND_PRESETS[0].id);
  const [forecastScenario2030, setForecastScenario2030] =
    useState<CalculatorForecastScenario>('baseline');
  const [scenarioSyncNonce, setScenarioSyncNonce] = useState<number>(0);
  const [tAct, setTAct] = useState<number>(DEMAND_PRESETS[0].tAct);
  const [pOrg, setPOrg] = useState<number>(DEMAND_PRESETS[0].pOrg);
  const [gSize, setGSize] = useState<number>(DEMAND_PRESETS[0].gSize);
  const [groupsPerSeason, setGroupsPerSeason] = useState<number>(DEMAND_PRESETS[0].groupsPerSeason);
  const [kSeason, setKSeason] = useState<number>(DEMAND_PRESETS[0].kSeason);
  const [kTurnover, setKTurnover] = useState<number>(DEMAND_PRESETS[0].kTurnover);
  const [registryCount, setRegistryCount] = useState<number>(DEMAND_PRESETS[0].registryCount);

  // Cohort planner controls (VVSU & RCA capacity)
  const [groupsPerYear, setGroupsPerYear] = useState<number>(4);
  const [cohortSize, setCohortSize] = useState<number>(25);
  const [conversionRate, setConversionRate] = useState<number>(75);

  const applyPreset = (preset: DemandPreset) => {
    setActivePresetId(preset.id);
    setTAct(preset.tAct);
    setPOrg(preset.pOrg);
    setGSize(preset.gSize);
    setGroupsPerSeason(preset.groupsPerSeason);
    setKSeason(preset.kSeason);
    setKTurnover(preset.kTurnover);
    setRegistryCount(preset.registryCount);
  };

  const applyRegionToMainCalculator = (profile: {
    tAct: number;
    pOrg: number;
    gSize: number;
    groupsPerSeason: number;
    kSeason: number;
    kTurnover: number;
    registryCount: number;
  }) => {
    setActivePresetId('custom');
    setTAct(profile.tAct);
    setPOrg(profile.pOrg);
    setGSize(profile.gSize);
    setGroupsPerSeason(profile.groupsPerSeason);
    setKSeason(profile.kSeason);
    setKTurnover(profile.kTurnover);
    setRegistryCount(profile.registryCount);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const modelInput = useMemo(
    () => ({
      tAct,
      pOrg,
      gSize,
      groupsPerSeason,
      kSeason,
      kTurnover,
      registryCount,
      groupsPerYear,
      cohortSize,
      conversionRate,
    }),
    [tAct, pOrg, gSize, groupsPerSeason, kSeason, kTurnover, registryCount, groupsPerYear, cohortSize, conversionRate]
  );

  const results = useMemo(
    () => DemandForecastService.calculate(modelInput),
    [modelInput]
  );

  const scenarioProjection = useMemo(
    () => computeCalculatorScenarioProjection(modelInput, forecastScenario2030),
    [modelInput, forecastScenario2030]
  );

  const handleSelectScenario2030 = (next: CalculatorForecastScenario) => {
    setForecastScenario2030(next);
    setScenarioSyncNonce((n) => n + 1);
    tracker.trackCustomInteraction('Калькулятор · сценарий к 2030 г.', next);
  };

  // SVG Sensitivity chart geometry
  const chartW = 540;
  const chartH = 210;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 30;
  const maxN = Math.max(...results.sensitivityPoints.map((pt) => pt.n), registryCount, 500);

  const polylinePoints = results.sensitivityPoints
    .map((pt, idx) => {
      const x = padL + (idx / (results.sensitivityPoints.length - 1)) * (chartW - padL - padR);
      const y = chartH - padB - (pt.n / maxN) * (chartH - padT - padB);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const currentMarkerX =
    padL + ((Math.min(Math.max(pOrg, 10), 50) - 10) / 40) * (chartW - padL - padR);
  const currentMarkerY =
    chartH - padB - (results.totalDemand / maxN) * (chartH - padT - padB);
  const registryLineY =
    chartH - padB - (registryCount / maxN) * (chartH - padT - padB);

  return (
    <div className="space-y-10">
      {/* Header & Formula Block */}
      <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <p className="text-xs font-medium text-teal-700">Интерактивная экономико-математическая модель</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 text-balance">
              Калькулятор кадровой потребности в инструкторах-проводниках
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Модель учитывает объём активного турпотока, долю организованных групп, норматив нагрузки
              на одного инструктора, сезонность (7-месячный сезон в Приморье) и отраслевую текучесть кадров.
            </p>
          </div>

          <button
            type="button"
            onClick={() => applyPreset(DEMAND_PRESETS[0])}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Сбросить к базе нояб. 2026</span>
          </button>
        </div>

        {/* Formula Banner */}
        <div className="bg-slate-900 text-white rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="font-mono text-sm sm:text-base tracking-tight">
            N = ((T_act × P_org) / G_size / G_season) × K_season × K_turnover
          </div>
          <div className="text-xs text-slate-300 font-mono tabular-nums">
            = (({tAct.toLocaleString('ru-RU')} × {(pOrg / 100).toFixed(2)}) / {gSize} / {groupsPerSeason}) × {kSeason.toFixed(2)} × {kTurnover.toFixed(2)} ={' '}
            <span className="text-teal-300 font-semibold">{results.totalDemand.toLocaleString('ru-RU')} чел.</span>
          </div>
        </div>

        {/* Presets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DEMAND_PRESETS.map((preset) => {
            const active = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`text-left p-4 rounded-lg border transition-colors cursor-pointer ${
                  active
                    ? 'bg-teal-50/70 border-teal-700 text-slate-900'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <p className="text-xs font-semibold text-slate-900">{preset.title}</p>
                <p className="mt-1 text-xs text-slate-500 leading-snug">{preset.subtitle}</p>
              </button>
            );
          })}
        </div>

        {/* 2030 Forecast Scenario Switcher */}
        <div className="pt-5 border-t border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-900">
              Сценарий моделирования потребности до 2030 года
            </p>
            <p className="text-xs text-slate-500">
              {scenarioProjection.option.assumptionsNote}
            </p>
          </div>

          <div
            role="radiogroup"
            aria-label="Сценарий прогноза потребности до 2030 года"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start lg:self-auto"
          >
            {CALCULATOR_FORECAST_SCENARIOS.map((opt) => {
              const active = forecastScenario2030 === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => handleSelectScenario2030(opt.id)}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-teal-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Simulator Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Controls */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <h2 className="text-lg font-bold text-slate-900">Входные параметры модели</h2>

          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="tAct" className="font-medium text-slate-700">
                  T_act — Активные туристы в год
                </label>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {tAct.toLocaleString('ru-RU')} чел.
                </span>
              </div>
              <input
                id="tAct"
                type="range"
                min={100000}
                max={1500000}
                step={5000}
                value={tAct}
                onChange={(e) => {
                  setActivePresetId('custom');
                  setTAct(Number(e.target.value));
                }}
                className="w-full accent-teal-700 cursor-pointer"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                База Минтуризма Приморья: 835 000 чел. (20% от 4 068,9 тыс. поездок).
              </p>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="pOrg" className="font-medium text-slate-700">
                  P_org — Доля организованных групп (ключевой фактор)
                </label>
                <span className="font-mono font-semibold text-teal-700 tabular-nums">
                  {pOrg}%
                </span>
              </div>
              <input
                id="pOrg"
                type="range"
                min={10}
                max={90}
                step={1}
                value={pOrg}
                onChange={(e) => {
                  setActivePresetId('custom');
                  setPOrg(Number(e.target.value));
                }}
                className="w-full accent-teal-700 cursor-pointer"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Консервативно 15–20% (автотуризм) · Базовый расчёт 30% · Камчатка 88%.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <label htmlFor="gSize" className="font-medium text-slate-700">
                    G_size (чел./группа)
                  </label>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">{gSize}</span>
                </div>
                <input
                  id="gSize"
                  type="range"
                  min={4}
                  max={15}
                  step={1}
                  value={gSize}
                  onChange={(e) => {
                    setActivePresetId('custom');
                    setGSize(Number(e.target.value));
                  }}
                  className="w-full accent-teal-700 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <label htmlFor="groupsSeason" className="font-medium text-slate-700">
                    Групп за сезон
                  </label>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">{groupsPerSeason}</span>
                </div>
                <input
                  id="groupsSeason"
                  type="range"
                  min={8}
                  max={30}
                  step={1}
                  value={groupsPerSeason}
                  onChange={(e) => {
                    setActivePresetId('custom');
                    setGroupsPerSeason(Number(e.target.value));
                  }}
                  className="w-full accent-teal-700 cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <label htmlFor="kSeason" className="font-medium text-slate-700">
                    K_season (пик)
                  </label>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {kSeason.toFixed(2)}
                  </span>
                </div>
                <input
                  id="kSeason"
                  type="range"
                  min={1.0}
                  max={1.6}
                  step={0.05}
                  value={kSeason}
                  onChange={(e) => {
                    setActivePresetId('custom');
                    setKSeason(Number(e.target.value));
                  }}
                  className="w-full accent-teal-700 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <label htmlFor="kTurnover" className="font-medium text-slate-700">
                    K_turnover (текучесть)
                  </label>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {kTurnover.toFixed(2)}
                  </span>
                </div>
                <input
                  id="kTurnover"
                  type="range"
                  min={1.0}
                  max={1.25}
                  step={0.01}
                  value={kTurnover}
                  onChange={(e) => {
                    setActivePresetId('custom');
                    setKTurnover(Number(e.target.value));
                  }}
                  className="w-full accent-teal-700 cursor-pointer"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="registry" className="font-medium text-slate-700">
                  Текущее легальное предложение (Реестр)
                </label>
                <span className="font-mono font-semibold text-red-700 tabular-nums">
                  {registryCount} чел.
                </span>
              </div>
              <input
                id="registry"
                type="range"
                min={20}
                max={600}
                step={5}
                value={registryCount}
                onChange={(e) => {
                  setActivePresetId('custom');
                  setRegistryCount(Number(e.target.value));
                }}
                className="w-full accent-red-700 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right: Results & Sensitivity Chart */}
        <div className="lg:col-span-7 space-y-6">
          {/* Output KPI strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Организованный поток</p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {results.organizedTourists.toLocaleString('ru-RU')}
              </p>
              <p className="mt-1 text-xs text-slate-600 font-mono tabular-nums">
                {results.humanGroupsPerYear.toLocaleString('ru-RU')} чел.-групп/год
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Итоговая потребность (N)</p>
              <p className="mt-1.5 text-2xl font-bold text-teal-700 font-mono tabular-nums">
                {results.totalDemand.toLocaleString('ru-RU')} чел.
              </p>
              <p className="mt-1 text-xs text-slate-600 font-mono tabular-nums">
                Базовая (без коэф.): {results.baseDemand.toLocaleString('ru-RU')}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Кадровый дефицит</p>
              <p className="mt-1.5 text-2xl font-bold text-red-700 font-mono tabular-nums">
                {results.deficit.toLocaleString('ru-RU')} чел.
              </p>
              <p className="mt-1 text-xs text-slate-600 font-mono tabular-nums">
                Разрыв: {results.gapMultiple.toFixed(1)}× от реестра
              </p>
            </div>
          </div>

          {/* Sensitivity Chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Чувствительность потребности к доле организованных групп (P_org)
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                10% → 50% (Приморье: коридор 15–30%)
              </span>
            </div>

            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className="w-full h-auto min-w-[440px]"
                role="img"
                aria-label="График зависимости потребности в инструкторах от доли организованных групп"
              >
                {/* Horizontal grid lines */}
                {[0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = chartH - padB - ratio * (chartH - padT - padB);
                  const val = Math.round(maxN * ratio);
                  return (
                    <g key={ratio}>
                      <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#E2E8F0" strokeWidth={1} />
                      <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px] font-mono">
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Axes */}
                <line x1={padL} y1={padT} x2={padL} y2={chartH - padB} stroke="#94A3B8" strokeWidth={1.5} />
                <line x1={padL} y1={chartH - padB} x2={chartW - padR} y2={chartH - padB} stroke="#94A3B8" strokeWidth={1.5} />

                {/* Conservative corridor 15%-30% */}
                <rect
                  x={padL + ((15 - 10) / 40) * (chartW - padL - padR)}
                  y={padT}
                  width={((30 - 15) / 40) * (chartW - padL - padR)}
                  height={chartH - padT - padB}
                  fill="#0F766E"
                  fillOpacity={0.07}
                />

                {/* Registry baseline */}
                <line
                  x1={padL}
                  y1={registryLineY}
                  x2={chartW - padR}
                  y2={registryLineY}
                  stroke="#B91C1C"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                />
                <text
                  x={chartW - padR}
                  y={Math.max(registryLineY - 6, padT + 10)}
                  textAnchor="end"
                  className="fill-red-700 text-[10px] font-mono font-semibold"
                >
                  Реестр: {registryCount} чел.
                </text>

                {/* Demand curve (>=1.5pt thick line) */}
                <polyline
                  fill="none"
                  stroke="#0F766E"
                  strokeWidth={2.5}
                  points={polylinePoints}
                />

                {/* Current P_org marker */}
                {pOrg >= 10 && pOrg <= 50 && (
                  <g>
                    <circle cx={currentMarkerX} cy={currentMarkerY} r={5} fill="#0F172A" stroke="#FFFFFF" strokeWidth={2} />
                    <text
                      x={Math.min(currentMarkerX + 8, chartW - 85)}
                      y={Math.max(currentMarkerY - 8, padT + 12)}
                      className="fill-slate-900 text-[11px] font-mono font-semibold"
                    >
                      {pOrg}%: {results.totalDemand}
                    </text>
                  </g>
                )}

                {/* X-axis ticks */}
                {results.sensitivityPoints.map((pt, idx) => {
                  const x = padL + (idx / (results.sensitivityPoints.length - 1)) * (chartW - padL - padR);
                  return (
                    <text
                      key={pt.p}
                      x={x}
                      y={chartH - 10}
                      textAnchor="middle"
                      className="fill-slate-500 text-[10px] font-mono"
                    >
                      {pt.p}%
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Cohort Closure Simulator with Active 2030 Scenario */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Моделирование численности к 2030 г. и набор ВВГУ ({scenarioProjection.option.label})
                </h3>
                <p className="text-xs text-slate-500">
                  {scenarioProjection.option.summary} Текучесть {((kTurnover - 1) * 100).toFixed(0)}%/год.
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-teal-700 tabular-nums shrink-0">
                +{results.annualNewCertified} аттест. / год
              </span>
            </div>

            {/* Scenario 2030 Modeled KPI Strip */}
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-3 border-y border-slate-200">
              <div>
                <dt className="text-[11px] text-slate-500">Потребность к 2030 г.</dt>
                <dd className="text-lg font-bold font-mono text-teal-800 tabular-nums mt-0.5">
                  {scenarioProjection.demand2030.toLocaleString('ru-RU')} чел.
                </dd>
                <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                  +{scenarioProjection.growthPct}% к базе 2025 г.
                </p>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">Прогноз реестра ВВГУ (2030)</dt>
                <dd className="text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                  {scenarioProjection.projectedRegistry2030.toLocaleString('ru-RU')} чел.
                </dd>
                <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                  Покрытие спроса: {scenarioProjection.coverage2030Pct}%
                </p>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">Остаточный дефицит 2030</dt>
                <dd className="text-lg font-bold font-mono text-red-700 tabular-nums mt-0.5">
                  {scenarioProjection.residualDeficit2030.toLocaleString('ru-RU')} чел.
                </dd>
                <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                  P_org {scenarioProjection.pOrg2030}% · K_season {scenarioProjection.kSeason2030.toFixed(2)}
                </p>
              </div>
            </dl>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="groupsYr" className="text-slate-600">Групп в год</label>
                  <span className="font-mono font-semibold tabular-nums">{groupsPerYear}</span>
                </div>
                <input
                  id="groupsYr"
                  type="range"
                  min={1}
                  max={16}
                  step={1}
                  value={groupsPerYear}
                  onChange={(e) => setGroupsPerYear(Number(e.target.value))}
                  className="w-full accent-teal-700 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="cohortSz" className="text-slate-600">Слушателей в группе</label>
                  <span className="font-mono font-semibold tabular-nums">{cohortSize}</span>
                </div>
                <input
                  id="cohortSz"
                  type="range"
                  min={10}
                  max={40}
                  step={5}
                  value={cohortSize}
                  onChange={(e) => setCohortSize(Number(e.target.value))}
                  className="w-full accent-teal-700 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="convRate" className="text-slate-600">Конверсия в реестр</label>
                  <span className="font-mono font-semibold tabular-nums">{conversionRate}%</span>
                </div>
                <input
                  id="convRate"
                  type="range"
                  min={40}
                  max={95}
                  step={5}
                  value={conversionRate}
                  onChange={(e) => setConversionRate(Number(e.target.value))}
                  className="w-full accent-teal-700 cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
              {scenarioProjection.yearly2026To2030.map((yr) => (
                <div key={yr.year} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center space-y-1">
                  <p className="text-xs font-mono font-semibold text-slate-500">{yr.year}</p>
                  <p className="text-base font-bold text-slate-900 font-mono tabular-nums">
                    {yr.projectedRegistry}
                  </p>
                  <p className="text-[10px] font-mono text-slate-500 tabular-nums">
                    цель {yr.targetDemand.toLocaleString('ru-RU')}
                  </p>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-700 transition-all duration-200" style={{ width: `${yr.coveragePct}%` }} />
                  </div>
                  <p className="text-[11px] font-mono text-teal-800 font-semibold tabular-nums">{yr.coveragePct}% цели</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Recharts LineChart: Instructor Demand Dynamics through 2030 by Tourism Scenarios */}
      <DemandDynamics2030Chart
        modelInput={modelInput}
        externalScenario={{
          id: scenarioProjection.option.tourismScenarioId,
          nonce: scenarioSyncNonce,
        }}
      />

      {/* Regional DFO 2030 Forecast Module with Tourist Flow */}
      <DfoRegionalForecastModule onApplyRegionToCalculator={applyRegionToMainCalculator} />

      {/* Training & Attestation Cost Estimator by Guide Category and DFO Region */}
      <TrainingAndAttestationCostEstimator />

      {/* Auxiliary cost estimator by complexity category & intensive days */}
      <IntensiveAttestationCostModule />

      {/* Recharts stacked bar chart of training cost across 1-3 complexity categories */}
      <TrainingCostByComplexityChart />

      {/* Interactive state duty & PP RF 891 fee calculator */}
      <StateDutyAttestationCalculator />

      {/* Expert Rating Calculator, Gauge Chart & Dynamic Collapsible Expert Tips */}
      <ExpertRatingCalculatorWidget />

      {/* 5-question interactive self-check quiz with instant feedback */}
      <AttestationKnowledgeQuiz />
    </div>
  );
};
