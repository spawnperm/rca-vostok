import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Layers, LineChart as LineChartIcon } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
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
import {
  buildTwoScenarioOverlay,
  resolveDistinctOverlayPair,
  type ScenarioChartMode,
} from '../utils/scenarioComparison.ts';
import { tracker } from '../utils/tracker';

interface DemandDynamics2030ChartProps {
  modelInput: DemandModelInput;
  externalScenario?: { id: TourismScenarioId; nonce: number } | null;
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
  overlayPair?: {
    idA: TourismScenarioId;
    labelA: string;
    idB: TourismScenarioId;
    labelB: string;
  } | null;
}> = ({ active, payload, label, overlayPair }) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0]?.payload;

  // Deduplicate entries (Area + Line share the same dataKey when overlaid)
  const seenKeys = new Set<string>();
  const uniquePayload = payload.filter((entry) => {
    const key = String(entry.dataKey ?? '');
    if (!key || seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  const valA = overlayPair && pt ? pt[overlayPair.idA] : null;
  const valB = overlayPair && pt ? pt[overlayPair.idB] : null;
  const diff = valA !== null && valB !== null ? valB - valA : null;
  const diffPct =
    diff !== null && valA !== null && valA > 0 ? Math.round((diff / valA) * 100) : null;

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
        {uniquePayload.map((entry) => (
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

      {overlayPair && diff !== null && (
        <div className="pt-1.5 border-t border-slate-700/80 flex items-center justify-between gap-3 text-[11px] font-mono tabular-nums">
          <span className="text-slate-300">Разница (Б − А):</span>
          <span className={diff >= 0 ? 'text-amber-300 font-semibold' : 'text-teal-300 font-semibold'}>
            {diff >= 0 ? '+' : '−'}
            {Math.abs(diff).toLocaleString('ru-RU')} чел.
            {diffPct !== null ? ` (${diff >= 0 ? '+' : ''}${diffPct}%)` : ''}
          </span>
        </div>
      )}

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
  externalScenario,
}) => {
  const [chartMode, setChartMode] = useState<ScenarioChartMode>('overlay_two');
  const [activeScenario, setActiveScenario] = useState<TourismScenarioId>('baseline');
  const [secondaryScenario, setSecondaryScenario] = useState<TourismScenarioId>('accelerated');
  const [activeOverlaySlot, setActiveOverlaySlot] = useState<'A' | 'B'>('B');
  const [showRegistryLine, setShowRegistryLine] = useState<boolean>(true);

  useEffect(() => {
    if (!externalScenario?.nonce) return;
    const targetId = externalScenario.id;
    setActiveScenario(targetId);
    if (targetId === secondaryScenario) {
      setSecondaryScenario(targetId === 'baseline' ? 'accelerated' : 'baseline');
    }
  }, [externalScenario, secondaryScenario]);

  const scenarioForecast = useMemo(
    () => DemandForecastService.forecastTourismScenarios2030(modelInput),
    [modelInput]
  );

  const allScenarioIds = useMemo(
    () => scenarioForecast.scenarios.map((s) => s.id),
    [scenarioForecast.scenarios]
  );

  const resolvedPair = useMemo(
    () => resolveDistinctOverlayPair(activeScenario, secondaryScenario, allScenarioIds),
    [activeScenario, secondaryScenario, allScenarioIds]
  );

  const overlayComparison = useMemo(
    () => buildTwoScenarioOverlay(scenarioForecast, resolvedPair.primary, resolvedPair.secondary),
    [scenarioForecast, resolvedPair]
  );

  const selectedSummary = scenarioForecast.summaries[activeScenario];

  const handleModeChange = (mode: ScenarioChartMode) => {
    setChartMode(mode);
    tracker.trackCustomInteraction('Калькулятор 2030: режим сравнения', mode);
  };

  const handleSelectScenarioA = (nextId: TourismScenarioId) => {
    if (nextId === resolvedPair.secondary) {
      setSecondaryScenario(resolvedPair.primary);
    }
    setActiveScenario(nextId);
    tracker.trackCustomInteraction('Калькулятор 2030: сценарий А', nextId);
  };

  const handleSelectScenarioB = (nextId: TourismScenarioId) => {
    if (nextId === resolvedPair.primary) {
      setActiveScenario(resolvedPair.secondary);
    }
    setSecondaryScenario(nextId);
    tracker.trackCustomInteraction('Калькулятор 2030: сценарий Б', nextId);
  };

  const handleSwapOverlay = () => {
    setActiveScenario(resolvedPair.secondary);
    setSecondaryScenario(resolvedPair.primary);
    tracker.trackCustomInteraction(
      'Калькулятор 2030: обмен сценариев',
      `${resolvedPair.secondary} ↔ ${resolvedPair.primary}`
    );
  };

  const handleScenarioCardClick = (scId: TourismScenarioId) => {
    if (chartMode === 'overlay_two') {
      if (activeOverlaySlot === 'A') {
        handleSelectScenarioA(scId);
      } else {
        handleSelectScenarioB(scId);
      }
      return;
    }
    setActiveScenario(scId);
    tracker.trackCustomInteraction('Калькулятор 2030: сценарий', scId);
  };

  return (
    <section
      aria-labelledby="calculator-scenarios-2030-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header & Mode Switcher */}
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
            {chartMode === 'overlay_two'
              ? `Наложение траекторий «${overlayComparison.scenarioA.label}» и «${overlayComparison.scenarioB.label}» для прямого сравнения спроса и кадрового дефицита к 2030 году.`
              : selectedSummary.description}
          </p>
        </div>

        {/* Comparison Mode & Registry Overlays */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Режим отображения сценариев"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            <button
              type="button"
              aria-pressed={chartMode === 'single'}
              onClick={() => handleModeChange('single')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                chartMode === 'single'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1 сценарий
            </button>
            <button
              type="button"
              aria-pressed={chartMode === 'overlay_two'}
              onClick={() => handleModeChange('overlay_two')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                chartMode === 'overlay_two'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Наложить 2 сценария</span>
            </button>
            <button
              type="button"
              aria-pressed={chartMode === 'all'}
              onClick={() => handleModeChange('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                chartMode === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Все 4
            </button>
          </div>

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

      {/* Pairwise Overlay Controls (shown when overlay_two is active) */}
      {chartMode === 'overlay_two' && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-slate-900">
                Пара сценариев для наложения на график (2025–2030 гг.)
              </p>
              <p className="text-[11px] text-slate-500">
                Выберите сценарии А (сплошная линия) и Б (пунктирная линия) в списках или кликните по карточкам ниже.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSwapOverlay}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>Поменять А ↔ Б</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Scenario A Selector */}
            <div
              className={`bg-white border rounded-lg p-3.5 space-y-2 transition-colors ${
                activeOverlaySlot === 'A' ? 'border-teal-700' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="scenario-overlay-a"
                  className="text-xs font-semibold text-slate-900 inline-flex items-center gap-2"
                >
                  <span
                    className="w-4 h-0.5 inline-block shrink-0"
                    style={{ backgroundColor: overlayComparison.scenarioA.color }}
                    aria-hidden="true"
                  />
                  <span>Сценарий А (основной · сплошная)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setActiveOverlaySlot('A')}
                  className={`text-[11px] font-medium px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    activeOverlaySlot === 'A'
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {activeOverlaySlot === 'A' ? 'Выбор карточкой' : 'Выбирать карточкой'}
                </button>
              </div>
              <select
                id="scenario-overlay-a"
                value={resolvedPair.primary}
                onChange={(e) => handleSelectScenarioA(e.target.value as TourismScenarioId)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-teal-700"
              >
                {scenarioForecast.scenarios.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.label} — {sc.shortLabel}
                  </option>
                ))}
              </select>
            </div>

            {/* Scenario B Selector */}
            <div
              className={`bg-white border rounded-lg p-3.5 space-y-2 transition-colors ${
                activeOverlaySlot === 'B' ? 'border-teal-700' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="scenario-overlay-b"
                  className="text-xs font-semibold text-slate-900 inline-flex items-center gap-2"
                >
                  <span
                    className="w-4 border-t-2 border-dashed inline-block shrink-0"
                    style={{ borderColor: overlayComparison.scenarioB.color }}
                    aria-hidden="true"
                  />
                  <span>Сценарий Б (наложение · пунктир)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setActiveOverlaySlot('B')}
                  className={`text-[11px] font-medium px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    activeOverlaySlot === 'B'
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {activeOverlaySlot === 'B' ? 'Выбор карточкой' : 'Выбирать карточкой'}
                </button>
              </div>
              <select
                id="scenario-overlay-b"
                value={resolvedPair.secondary}
                onChange={(e) => handleSelectScenarioB(e.target.value as TourismScenarioId)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-teal-700"
              >
                {scenarioForecast.scenarios.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.label} — {sc.shortLabel}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Tourism Development Scenario Selector Cards */}
      <div
        role="tablist"
        aria-label="Сценарии развития туризма до 2030 года"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5"
      >
        {scenarioForecast.scenarios.map((sc) => {
          const isA =
            chartMode === 'overlay_two'
              ? resolvedPair.primary === sc.id
              : activeScenario === sc.id;
          const isB = chartMode === 'overlay_two' && resolvedPair.secondary === sc.id;
          const isHighlighted = isA || isB;
          const stats = scenarioForecast.summaries[sc.id];

          return (
            <button
              key={sc.id}
              type="button"
              role="tab"
              aria-selected={isHighlighted}
              onClick={() => handleScenarioCardClick(sc.id)}
              className={`text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                isA
                  ? 'bg-teal-50/70 border-teal-700 text-slate-900'
                  : isB
                  ? 'bg-amber-50/60 border-amber-600 text-slate-900'
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

              {chartMode === 'overlay_two' && (isA || isB) && (
                <p className="mt-1 text-[11px] font-mono font-semibold text-slate-700">
                  {isA ? 'Сценарий А · сплошная' : 'Сценарий Б · пунктир'}
                </p>
              )}

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

      {/* KPI Strip: adapts between Pairwise Comparison vs Single Focus */}
      {chartMode === 'overlay_two' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
            <p className="text-[11px] text-slate-500 font-medium truncate">
              А · {overlayComparison.scenarioA.label} (2030)
            </p>
            <p className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
              {overlayComparison.demand2030A.toLocaleString('ru-RU')} чел.
            </p>
            <p className="mt-0.5 text-[11px] font-mono text-slate-500 tabular-nums">
              Дефицит: {overlayComparison.deficit2030A.toLocaleString('ru-RU')} чел.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
            <p className="text-[11px] text-slate-500 font-medium truncate">
              Б · {overlayComparison.scenarioB.label} (2030)
            </p>
            <p className="mt-1 text-xl font-bold font-mono text-teal-800 tabular-nums">
              {overlayComparison.demand2030B.toLocaleString('ru-RU')} чел.
            </p>
            <p className="mt-0.5 text-[11px] font-mono text-slate-500 tabular-nums">
              Дефицит: {overlayComparison.deficit2030B.toLocaleString('ru-RU')} чел.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
            <p className="text-[11px] text-slate-500 font-medium">
              Расхождение к 2030 г. (Б − А)
            </p>
            <p
              className={`mt-1 text-xl font-bold font-mono tabular-nums ${
                overlayComparison.delta2030 >= 0 ? 'text-amber-700' : 'text-teal-700'
              }`}
            >
              {overlayComparison.delta2030 >= 0 ? '+' : '−'}
              {overlayComparison.absDelta2030.toLocaleString('ru-RU')} чел.
            </p>
            <p className="mt-0.5 text-[11px] font-mono text-slate-600 tabular-nums">
              Относит. сдвиг: {overlayComparison.delta2030 >= 0 ? '+' : ''}
              {overlayComparison.delta2030Pct}%
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
            <p className="text-[11px] text-slate-500 font-medium">
              Сдвиг структурных факторов (Б − А)
            </p>
            <p className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
              {overlayComparison.pOrgDeltaBy2030 >= 0 ? '+' : ''}
              {overlayComparison.pOrgDeltaBy2030} п.п. P_org
            </p>
            <p className="mt-0.5 text-[11px] font-mono text-slate-600 tabular-nums">
              K_season: {overlayComparison.kSeasonDeltaBy2030 >= 0 ? '+' : ''}
              {overlayComparison.kSeasonDeltaBy2030.toFixed(2)}
            </p>
          </div>
        </div>
      ) : (
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
      )}

      {/* Recharts ComposedChart (supports crisp Area+Line overlay for 2 scenarios) */}
      <div className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-white">
        <div className="w-full h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
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
              <Tooltip
                cursor={{ stroke: '#0F766E', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                content={
                  <ScenarioLineTooltip
                    overlayPair={
                      chartMode === 'overlay_two'
                        ? {
                            idA: overlayComparison.scenarioA.id,
                            labelA: overlayComparison.scenarioA.label,
                            idB: overlayComparison.scenarioB.id,
                            labelB: overlayComparison.scenarioB.label,
                          }
                        : null
                    }
                  />
                }
              />
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

              {chartMode === 'all' &&
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
                ))}

              {chartMode === 'overlay_two' && (
                <>
                  <Area
                    type="monotone"
                    dataKey={overlayComparison.scenarioA.id}
                    name={`А: ${overlayComparison.scenarioA.shortLabel}`}
                    stroke={overlayComparison.scenarioA.color}
                    fill={overlayComparison.scenarioA.color}
                    fillOpacity={0.09}
                    strokeWidth={3.2}
                    dot={{ r: 4.5, strokeWidth: 2, fill: '#FFFFFF' }}
                    activeDot={{ r: 6.5 }}
                  />
                  <Area
                    type="monotone"
                    dataKey={overlayComparison.scenarioB.id}
                    name={`Б: ${overlayComparison.scenarioB.shortLabel}`}
                    stroke={overlayComparison.scenarioB.color}
                    fill={overlayComparison.scenarioB.color}
                    fillOpacity={0.08}
                    strokeWidth={3.2}
                    strokeDasharray="7 4"
                    dot={{ r: 4.5, strokeWidth: 2, fill: '#FFFFFF' }}
                    activeDot={{ r: 6.5 }}
                  />
                </>
              )}

              {chartMode === 'single' && (
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
                  strokeDasharray="4 4"
                  strokeWidth={2.2}
                  dot={{ r: 3.5, fill: '#0284C7' }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Year-by-year Divergence Table in Overlay Mode */}
      {chartMode === 'overlay_two' && (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-2.5 px-4 font-semibold">Год</th>
                <th className="py-2.5 px-4 font-semibold text-right">
                  А · {overlayComparison.scenarioA.label}
                </th>
                <th className="py-2.5 px-4 font-semibold text-right">
                  Б · {overlayComparison.scenarioB.label}
                </th>
                <th className="py-2.5 px-4 font-semibold text-right">Разница (Б − А)</th>
                <th className="py-2.5 px-4 font-semibold text-right">Реестр (план ВВГУ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {overlayComparison.rows.map((row) => (
                <tr key={row.year} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 tabular-nums">
                    {row.year}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-right text-slate-900 tabular-nums">
                    {row.demandA.toLocaleString('ru-RU')} чел.
                  </td>
                  <td className="py-2.5 px-4 font-mono text-right font-semibold text-teal-800 tabular-nums">
                    {row.demandB.toLocaleString('ru-RU')} чел.
                  </td>
                  <td
                    className={`py-2.5 px-4 font-mono text-right font-semibold tabular-nums ${
                      row.deltaDemand === 0
                        ? 'text-slate-500'
                        : row.deltaDemand > 0
                        ? 'text-amber-700'
                        : 'text-teal-700'
                    }`}
                  >
                    {row.deltaDemand === 0
                      ? '0 чел.'
                      : `${row.deltaDemand > 0 ? '+' : '−'}${Math.abs(row.deltaDemand).toLocaleString('ru-RU')} (${row.deltaDemand > 0 ? '+' : ''}${row.deltaPct}%)`}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-right text-sky-800 tabular-nums">
                    {row.projectedRegistry.toLocaleString('ru-RU')} чел.
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
