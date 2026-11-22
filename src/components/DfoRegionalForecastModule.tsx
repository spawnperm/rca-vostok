import React, { useMemo, useState } from 'react';
import { ArrowUpRight, RotateCcw, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
  DFO_REGIONAL_FLOW_PROFILES,
  type DfoRegionalFlowProfile,
} from '../data/researchData';
import { DemandForecastService } from '../domain/certification/DemandForecastService.ts';
import { tracker } from '../utils/tracker';

interface DfoRegionalForecastModuleProps {
  onApplyRegionToCalculator?: (profile: {
    tAct: number;
    pOrg: number;
    gSize: number;
    groupsPerSeason: number;
    kSeason: number;
    kTurnover: number;
    registryCount: number;
  }) => void;
}

interface StackedChartPoint {
  year: string;
  primorye: number;
  kamchatka: number;
  khabarovsk: number;
  sakhalin: number;
  otherNorth: number;
  totalDemand: number;
  totalFlowThousands: number;
  focusedDemand: number;
  focusedFlowThousands: number;
}

interface TooltipPayloadItem {
  dataKey?: string;
  name?: string;
  value?: number;
  color?: string;
  payload?: StackedChartPoint;
}

const REGION_STACK_SERIES = [
  { key: 'primorye', label: 'Приморский край', color: '#0F766E' },
  { key: 'kamchatka', label: 'Камчатский край', color: '#0F172A' },
  { key: 'khabarovsk', label: 'Хабаровский край', color: '#D97706' },
  { key: 'sakhalin', label: 'Сахалин и Курилы', color: '#0284C7' },
  { key: 'otherNorth', label: 'Якутия, Амурская обл., Магадан', color: '#64748B' },
] as const;

const ForecastYearTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  isAllRegions: boolean;
}> = ({ active, payload, label, isAllRegions }) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0]?.payload;

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg p-3.5 shadow-lg max-w-xs text-xs space-y-2">
      <div className="flex items-baseline justify-between gap-4 border-b border-slate-700 pb-1.5">
        <span className="font-mono font-bold text-teal-300 tabular-nums">{label} г.</span>
        {pt && (
          <span className="font-mono text-[11px] text-slate-300 tabular-nums">
            Турпоток:{' '}
            {(isAllRegions ? pt.totalFlowThousands : pt.focusedFlowThousands).toLocaleString(
              'ru-RU'
            )}{' '}
            тыс.
          </span>
        )}
      </div>

      <div className="space-y-1">
        {payload.map((entry) => {
          const isFlow = entry.dataKey === 'focusedFlowThousands';
          return (
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
                {typeof entry.value === 'number'
                  ? entry.value.toLocaleString('ru-RU')
                  : entry.value}{' '}
                {isFlow ? 'тыс. поездок' : 'чел.'}
              </span>
            </div>
          );
        })}
      </div>

      {pt && isAllRegions && (
        <div className="pt-1.5 border-t border-slate-700/80 flex items-center justify-between text-[11px] font-mono text-teal-300 tabular-nums">
          <span>Итого по ДФО:</span>
          <span>{pt.totalDemand.toLocaleString('ru-RU')} чел.</span>
        </div>
      )}
    </div>
  );
};

export const DfoRegionalForecastModule: React.FC<DfoRegionalForecastModuleProps> = ({
  onApplyRegionToCalculator,
}) => {
  const [selectedRegionId, setSelectedRegionId] = useState<string>('all');
  const [flowMultiplierPct, setFlowMultiplierPct] = useState<number>(100);
  const [useRegionalGrowthProfiles, setUseRegionalGrowthProfiles] = useState<boolean>(true);
  const [customAnnualGrowthPct, setCustomAnnualGrowthPct] = useState<number>(10);
  const [pOrgShiftBy2030Pct, setPOrgShiftBy2030Pct] = useState<number>(0);
  const [customBaseFlowThousands, setCustomBaseFlowThousands] = useState<number | null>(null);
  const [customActiveSharePct, setCustomActiveSharePct] = useState<number | null>(null);
  const [chartTab, setChartTab] = useState<'trajectory' | 'regions'>('trajectory');

  const selectedProfile: DfoRegionalFlowProfile | null = useMemo(
    () => DFO_REGIONAL_FLOW_PROFILES.find((p) => p.id === selectedRegionId) ?? null,
    [selectedRegionId]
  );

  const handleSelectRegion = (regionId: string) => {
    setSelectedRegionId(regionId);
    setCustomBaseFlowThousands(null);
    setCustomActiveSharePct(null);
    const chosen = DFO_REGIONAL_FLOW_PROFILES.find((p) => p.id === regionId);
    tracker.trackCustomInteraction(
      'Калькулятор прогноза ДФО 2030: регион',
      chosen?.shortName ?? 'Весь ДФО'
    );
  };

  const applyScenarioPreset = (
    preset: 'baseline' | 'boom' | 'moderate'
  ) => {
    if (preset === 'baseline') {
      setFlowMultiplierPct(100);
      setUseRegionalGrowthProfiles(true);
      setPOrgShiftBy2030Pct(0);
      setCustomBaseFlowThousands(null);
      setCustomActiveSharePct(null);
    } else if (preset === 'boom') {
      setFlowMultiplierPct(105);
      setUseRegionalGrowthProfiles(false);
      setCustomAnnualGrowthPct(14);
      setPOrgShiftBy2030Pct(5);
    } else {
      setFlowMultiplierPct(100);
      setUseRegionalGrowthProfiles(false);
      setCustomAnnualGrowthPct(4.5);
      setPOrgShiftBy2030Pct(0);
    }
    tracker.trackCustomInteraction('Калькулятор прогноза ДФО 2030: сценарий', preset);
  };

  const forecast = useMemo(() => {
    return DemandForecastService.forecastDfoRegions2030({
      profiles: DFO_REGIONAL_FLOW_PROFILES,
      selectedRegionId,
      flowMultiplierPct,
      annualFlowGrowthOverridePct: useRegionalGrowthProfiles ? null : customAnnualGrowthPct,
      pOrgShiftBy2030Pct,
      customBaseFlowThousands:
        selectedProfile && customBaseFlowThousands !== null ? customBaseFlowThousands : undefined,
      customActiveSharePct:
        selectedProfile && customActiveSharePct !== null ? customActiveSharePct : undefined,
    });
  }, [
    selectedRegionId,
    flowMultiplierPct,
    useRegionalGrowthProfiles,
    customAnnualGrowthPct,
    pOrgShiftBy2030Pct,
    selectedProfile,
    customBaseFlowThousands,
    customActiveSharePct,
  ]);

  const trajectoryChartData: StackedChartPoint[] = useMemo(() => {
    return forecast.yearlySeries.map((pt) => ({
      year: pt.year,
      primorye: pt.byRegion['primorye'] ?? 0,
      kamchatka: pt.byRegion['kamchatka'] ?? 0,
      khabarovsk: pt.byRegion['khabarovsk'] ?? 0,
      sakhalin: pt.byRegion['sakhalin'] ?? 0,
      otherNorth:
        (pt.byRegion['yakutia'] ?? 0) +
        (pt.byRegion['amur'] ?? 0) +
        (pt.byRegion['magadan-chukotka'] ?? 0),
      totalDemand: pt.totalDemand,
      totalFlowThousands: pt.totalFlowThousands,
      focusedDemand: pt.focusedDemand,
      focusedFlowThousands: pt.focusedFlowThousands,
    }));
  }, [forecast.yearlySeries]);

  const effectiveRegionBaseFlow = selectedProfile
    ? customBaseFlowThousands ?? selectedProfile.baseFlowThousands
    : 0;
  const effectiveRegionActiveShare = selectedProfile
    ? customActiveSharePct ?? selectedProfile.activeSharePct
    : 0;

  const flowGrowthTotalPct =
    forecast.totals.flow2025Thousands > 0
      ? Math.round(
          ((forecast.totals.flow2030Thousands - forecast.totals.flow2025Thousands) /
            forecast.totals.flow2025Thousands) *
            100
        )
      : 0;

  const gapMultiple2030 =
    forecast.totals.registryCount > 0
      ? (forecast.totals.demand2030 / forecast.totals.registryCount).toFixed(1)
      : '—';

  return (
    <section
      aria-labelledby="dfo-calculator-forecast-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Section Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-teal-700">
            <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Региональный прогноз ДФО до 2030 года</span>
          </div>
          <h2
            id="dfo-calculator-forecast-heading"
            className="text-xl sm:text-2xl font-bold text-slate-900"
          >
            Прогнозирование потребности по регионам ДФО с учётом туристического потока
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Модель пересчитывает годовой туристический поток каждого из 7 субъектов ДФО в активный
            сегмент и потребность в аттестованных проводниках до 2030 года с учётом динамики потока
            и легализации организованных групп (ПП РФ № 1893).
          </p>
        </div>

        {/* Scenario presets + Reset */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => applyScenarioPreset('baseline')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            База ДФО
          </button>
          <button
            type="button"
            onClick={() => applyScenarioPreset('boom')}
            className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Ускоренный поток (+14%/год)
          </button>
          <button
            type="button"
            onClick={() => applyScenarioPreset('moderate')}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Умеренный (+4,5%/год)
          </button>
        </div>
      </div>

      {/* Region Filter Strip */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100 rounded-xl">
        <button
          type="button"
          onClick={() => handleSelectRegion('all')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            selectedRegionId === 'all'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Весь ДФО (7 субъектов)
        </button>
        {DFO_REGIONAL_FLOW_PROFILES.map((profile) => {
          const active = selectedRegionId === profile.id;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => handleSelectRegion(profile.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              {profile.shortName}
            </button>
          );
        })}
      </div>

      {/* Interactive Controls + Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Tourist Flow Model Controls (5 cols) */}
        <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Параметры туристического потока
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {selectedProfile
                  ? `Фокус: ${selectedProfile.name}`
                  : 'Агрегированный расчёт по 7 субъектам ДФО'}
              </p>
            </div>
            {selectedProfile && onApplyRegionToCalculator && (
              <button
                type="button"
                onClick={() => {
                  const activeTourists = Math.round(
                    effectiveRegionBaseFlow *
                      (flowMultiplierPct / 100) *
                      1000 *
                      (effectiveRegionActiveShare / 100)
                  );
                  onApplyRegionToCalculator({
                    tAct: activeTourists,
                    pOrg: selectedProfile.pOrg,
                    gSize: selectedProfile.gSize,
                    groupsPerSeason: selectedProfile.groupsPerSeason,
                    kSeason: selectedProfile.kSeason,
                    kTurnover: selectedProfile.kTurnover,
                    registryCount: selectedProfile.registryCount,
                  });
                  tracker.trackCustomInteraction(
                    'Подстановка региона в верхний калькулятор',
                    selectedProfile.shortName
                  );
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 hover:border-teal-600 text-slate-800 text-[11px] font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>В модель N</span>
                <ArrowUpRight className="w-3 h-3 text-teal-700" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="space-y-4">
            {/* Macro Flow Multiplier */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="dfo-flow-multiplier" className="font-medium text-slate-700">
                  Индекс базового турпотока
                </label>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {flowMultiplierPct}%
                </span>
              </div>
              <input
                id="dfo-flow-multiplier"
                type="range"
                min={70}
                max={150}
                step={5}
                value={flowMultiplierPct}
                onChange={(e) => setFlowMultiplierPct(Number(e.target.value))}
                className="w-full accent-teal-700 cursor-pointer"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Масштабирует объём поездок относительно уровня 2025 г. (100% = факт).
              </p>
            </div>

            {/* Annual Growth Rate Mode */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-700">
                  Темп роста турпотока (2026–2030)
                </span>
                <button
                  type="button"
                  onClick={() => setUseRegionalGrowthProfiles((v) => !v)}
                  className="text-[11px] font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
                >
                  {useRegionalGrowthProfiles
                    ? 'Задать единый % вручную'
                    : 'Вернуть профили регионов'}
                </button>
              </div>

              {useRegionalGrowthProfiles ? (
                <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-[11px] text-slate-600">
                  Применяются отраслевые темпы субъектов: Приморье{' '}
                  <span className="font-mono font-semibold text-slate-900">+7,5%/год</span>,
                  Камчатка{' '}
                  <span className="font-mono font-semibold text-slate-900">+10%/год</span>,
                  Хабаровск и др.{' '}
                  <span className="font-mono font-semibold text-slate-900">+11,5–12%/год</span>.
                </div>
              ) : (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label htmlFor="dfo-annual-growth" className="text-slate-600">
                      Ежегодный прирост поездок
                    </label>
                    <span className="font-mono font-semibold text-teal-700 tabular-nums">
                      +{customAnnualGrowthPct.toFixed(1)}% / год
                    </span>
                  </div>
                  <input
                    id="dfo-annual-growth"
                    type="range"
                    min={0}
                    max={20}
                    step={0.5}
                    value={customAnnualGrowthPct}
                    onChange={(e) => setCustomAnnualGrowthPct(Number(e.target.value))}
                    className="w-full accent-teal-700 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* P_org shift due to compulsory attestation */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="dfo-porg-shift" className="font-medium text-slate-700">
                  Легализация организованных групп к 2030 г.
                </label>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  +{pOrgShiftBy2030Pct} п.п.
                </span>
              </div>
              <input
                id="dfo-porg-shift"
                type="range"
                min={0}
                max={15}
                step={1}
                value={pOrgShiftBy2030Pct}
                onChange={(e) => setPOrgShiftBy2030Pct(Number(e.target.value))}
                className="w-full accent-teal-700 cursor-pointer"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Сдвиг доли P_org к 2030 г. за счёт перехода туррынка в реестр и режимов ООПТ.
              </p>
            </div>

            {/* Region-specific Flow Overrides when a single region is focused */}
            {selectedProfile && (
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label htmlFor="region-base-flow" className="font-medium text-slate-700">
                      Турпоток «{selectedProfile.shortName}» (база)
                    </label>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {effectiveRegionBaseFlow.toLocaleString('ru-RU')} тыс.
                    </span>
                  </div>
                  <input
                    id="region-base-flow"
                    type="range"
                    min={Math.max(10, Math.round(selectedProfile.baseFlowThousands * 0.4))}
                    max={Math.round(selectedProfile.baseFlowThousands * 1.8)}
                    step={selectedProfile.baseFlowThousands > 500 ? 25 : 5}
                    value={effectiveRegionBaseFlow}
                    onChange={(e) => setCustomBaseFlowThousands(Number(e.target.value))}
                    className="w-full accent-teal-700 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label htmlFor="region-active-share" className="font-medium text-slate-700">
                      Доля активного туризма в потоке
                    </label>
                    <span className="font-mono font-semibold text-teal-700 tabular-nums">
                      {effectiveRegionActiveShare.toFixed(1)}%
                    </span>
                  </div>
                  <input
                    id="region-active-share"
                    type="range"
                    min={10}
                    max={40}
                    step={0.5}
                    value={effectiveRegionActiveShare}
                    onChange={(e) => setCustomActiveSharePct(Number(e.target.value))}
                    className="w-full accent-teal-700 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: KPIs + Chart (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 4 KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-[11px] text-slate-500">Турпоток 2030</p>
              <p className="mt-1 text-lg font-bold font-mono text-slate-900 tabular-nums">
                {forecast.totals.flow2030Thousands >= 1000
                  ? `${(forecast.totals.flow2030Thousands / 1000).toFixed(2)} млн`
                  : `${forecast.totals.flow2030Thousands.toLocaleString('ru-RU')} тыс.`}
              </p>
              <p className="mt-0.5 text-[11px] font-mono text-teal-700 tabular-nums">
                +{flowGrowthTotalPct}% к 2025 г.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-[11px] text-slate-500">Активных в 2030</p>
              <p className="mt-1 text-lg font-bold font-mono text-slate-900 tabular-nums">
                {forecast.totals.activeTourists2030 >= 1000000
                  ? `${(forecast.totals.activeTourists2030 / 1000000).toFixed(2)} млн`
                  : `${Math.round(forecast.totals.activeTourists2030 / 1000).toLocaleString('ru-RU')} тыс.`}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">целевой сегмент</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-[11px] text-slate-500">Спрос на гидов · 2030</p>
              <p className="mt-1 text-lg font-bold font-mono text-teal-800 tabular-nums">
                {forecast.totals.demand2030.toLocaleString('ru-RU')} чел.
              </p>
              <p className="mt-0.5 text-[11px] font-mono text-slate-600 tabular-nums">
                2025: {forecast.totals.demand2025.toLocaleString('ru-RU')} (+
                {forecast.totals.growthPct}%)
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-[11px] text-slate-500">Дефицит к реестру</p>
              <p className="mt-1 text-lg font-bold font-mono text-red-700 tabular-nums">
                {forecast.totals.deficit2030.toLocaleString('ru-RU')} чел.
              </p>
              <p className="mt-0.5 text-[11px] font-mono text-slate-600 tabular-nums">
                {gapMultiple2030}× от факта ({forecast.totals.registryCount})
              </p>
            </div>
          </div>

          {/* Chart Card */}
          <div className="border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {chartTab === 'trajectory'
                    ? selectedProfile
                      ? `Прогноз турпотока и потребности: ${selectedProfile.name}`
                      : 'Структура прогнозной потребности по регионам ДФО (2025–2030)'
                    : 'Сопоставление субъектов ДФО: база 2025 vs прогноз 2030'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {selectedProfile && chartTab === 'trajectory'
                    ? selectedProfile.driverNote
                    : 'Расчёт по формуле N через годовой поток активных туристов и норматив нагрузки'}
                </p>
              </div>

              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setChartTab('trajectory')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    chartTab === 'trajectory'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  2025–2030 гг.
                </button>
                <button
                  type="button"
                  onClick={() => setChartTab('regions')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    chartTab === 'regions'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  По субъектам
                </button>
              </div>
            </div>

            <div className="w-full h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                {chartTab === 'regions' ? (
                  <BarChart
                    data={forecast.regionSummaries}
                    margin={{ top: 10, right: 12, left: -8, bottom: 8 }}
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="shortName"
                      tick={{ fontSize: 10.5, fill: '#475569' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                      tickFormatter={(v: number) => v.toLocaleString('ru-RU')}
                    />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                    <Bar
                      dataKey="registryCount"
                      name="В реестре (сейчас)"
                      fill="#94A3B8"
                      radius={[3, 3, 0, 0]}
                    />
                    <Bar
                      dataKey="demand2025"
                      name="Спрос 2025 (чел.)"
                      fill="#D97706"
                      radius={[3, 3, 0, 0]}
                    />
                    <Bar
                      dataKey="demand2030"
                      name="Прогноз 2030 (чел.)"
                      fill="#0F766E"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                ) : selectedRegionId === 'all' ? (
                  <AreaChart
                    data={trajectoryChartData}
                    margin={{ top: 10, right: 16, left: -8, bottom: 8 }}
                  >
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
                    <Tooltip content={<ForecastYearTooltip isAllRegions={true} />} />
                    <Legend wrapperStyle={{ fontSize: '11.5px', paddingTop: '8px' }} />
                    {REGION_STACK_SERIES.map((reg) => (
                      <Area
                        key={reg.key}
                        type="monotone"
                        dataKey={reg.key}
                        name={reg.label}
                        stackId="dfo-forecast"
                        stroke={reg.color}
                        fill={reg.color}
                        fillOpacity={0.22}
                        strokeWidth={2}
                      />
                    ))}
                  </AreaChart>
                ) : (
                  <ComposedChart
                    data={trajectoryChartData}
                    margin={{ top: 10, right: 8, left: -8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 11, fill: '#475569', fontFamily: 'JetBrains Mono, monospace' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="guides"
                      tick={{ fontSize: 11, fill: '#0F766E', fontFamily: 'JetBrains Mono, monospace' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                      tickFormatter={(v: number) => v.toLocaleString('ru-RU')}
                    />
                    <YAxis
                      yAxisId="flow"
                      orientation="right"
                      tick={{ fontSize: 10.5, fill: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                      tickFormatter={(v: number) => `${Math.round(v)} т.`}
                    />
                    <Tooltip content={<ForecastYearTooltip isAllRegions={false} />} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                    <Bar
                      yAxisId="flow"
                      dataKey="focusedFlowThousands"
                      name="Турпоток (тыс. поездок)"
                      fill="#CBD5E1"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={36}
                    />
                    <Line
                      yAxisId="guides"
                      type="monotone"
                      dataKey="focusedDemand"
                      name="Потребность в проводниках (чел.)"
                      stroke="#0F766E"
                      strokeWidth={3}
                      dot={{ r: 4.5, strokeWidth: 2, fill: '#FFFFFF' }}
                      activeDot={{ r: 6.5 }}
                    />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Regional Breakdown Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Матрица прогноза по 7 субъектам ДФО (нажмите на строку для фокуса)
          </h3>
          <span className="text-[11px] font-mono text-slate-500 tabular-nums">
            ДФО 2030: {forecast.totals.demand2030.toLocaleString('ru-RU')} чел.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Субъект ДФО</th>
                <th className="py-2.5 px-3 font-semibold text-right">Поток 2025 → 2030 (тыс.)</th>
                <th className="py-2.5 px-3 font-semibold text-right">Активных</th>
                <th className="py-2.5 px-3 font-semibold text-right">Реестр</th>
                <th className="py-2.5 px-3 font-semibold text-right">Спрос 2025</th>
                <th className="py-2.5 px-3 font-semibold text-right">Прогноз 2030</th>
                <th className="py-2.5 px-4 font-semibold text-right">Дефицит 2030</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {forecast.regionSummaries.map((row) => {
                const isSelected = selectedRegionId === row.id;
                return (
                  <tr
                    key={row.id}
                    onClick={() => handleSelectRegion(isSelected ? 'all' : row.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-teal-50/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {row.name}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                      {row.flow2025Thousands.toLocaleString('ru-RU')} →{' '}
                      <span className="font-semibold text-slate-900">
                        {row.flow2030Thousands.toLocaleString('ru-RU')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                      {row.activeSharePct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                      {row.registryCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                      {row.demand2025.toLocaleString('ru-RU')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-teal-800">
                      {row.demand2030.toLocaleString('ru-RU')}{' '}
                      <span className="text-[10px] font-normal text-teal-700">
                        (+{row.demandGrowthPct}%)
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-red-700">
                      {row.deficit2030.toLocaleString('ru-RU')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
