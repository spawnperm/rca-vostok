import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, BarChart3, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
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
  DFO_REGIONS_DISTRIBUTION,
  type DfoRegionDistribution,
} from '../data/researchData';
import { tracker } from '../utils/tracker';
import { DfoCertifiedDynamicsLineChart } from './DfoCertifiedDynamicsLineChart';
import { DfoComparisonSvgMap, type ComparisonSlot } from './DfoComparisonSvgMap';

const OTHER_CLUSTER_WEIGHTS: Record<string, number> = {
  sakhalin: 320 / 680,
  yakutia: 180 / 680,
  amur: 110 / 680,
  'magadan-chukotka': 70 / 680,
};

const QUICK_PAIRS: { label: string; a: string; b: string }[] = [
  { label: 'Приморье vs Камчатка', a: 'primorye', b: 'kamchatka' },
  { label: 'Приморье vs Хабаровск', a: 'primorye', b: 'khabarovsk' },
  { label: 'Камчатка vs Сахалин', a: 'kamchatka', b: 'sakhalin' },
];

const REGION_A_COLOR = '#0F766E';
const REGION_B_COLOR = '#D97706';

interface RegionSnapshot {
  region: DfoRegionDistribution;
  deficit: number;
  coveragePct: number;
  registrySharePct: number;
  demandSharePct: number;
  octoberShareOfRegistryPct: number;
  demand2030Base: number;
  demand2030Conservative: number;
}

interface BarComparisonDatum {
  metric: string;
  regionA: number;
  regionB: number;
  unit: string;
}

interface LineComparisonDatum {
  year: string;
  regionA: number;
  regionB: number;
  driverNote: string;
}

interface BarTooltipPayloadEntry {
  dataKey?: string;
  name?: string;
  value?: number;
  color?: string;
  payload?: BarComparisonDatum;
}

interface LineTooltipPayloadEntry {
  dataKey?: string;
  name?: string;
  value?: number;
  color?: string;
  payload?: LineComparisonDatum;
}

function getForecastDemandForRegion(
  regionId: string,
  point: (typeof DFO_REGIONAL_DEMAND_FORECAST_2025_2030.base)[number]
): number {
  if (regionId === 'primorye') return point.primorye;
  if (regionId === 'kamchatka') return point.kamchatka;
  if (regionId === 'khabarovsk') return point.khabarovsk;
  if (regionId in OTHER_CLUSTER_WEIGHTS) {
    return Math.round(point.sakhalinAndOther * OTHER_CLUSTER_WEIGHTS[regionId]);
  }
  return point.totalDemand;
}

const ComparisonBarTooltip: React.FC<{
  active?: boolean;
  payload?: BarTooltipPayloadEntry[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const unit = payload[0]?.payload?.unit ?? 'чел.';

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg p-3.5 shadow-lg max-w-xs text-xs space-y-2">
      <div className="border-b border-slate-700 pb-1.5 font-semibold text-teal-300">
        {label}
      </div>
      <div className="space-y-1.5">
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
              {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ComparisonLineTooltip: React.FC<{
  active?: boolean;
  payload?: LineTooltipPayloadEntry[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg p-3.5 shadow-lg max-w-xs text-xs space-y-2">
      <div className="flex items-baseline justify-between gap-4 border-b border-slate-700 pb-1.5">
        <span className="font-mono font-bold text-teal-300 tabular-nums">Срез: {label} г.</span>
        {point && (
          <span className="font-mono text-[11px] text-slate-300 tabular-nums">
            Разрыв: {Math.abs(point.regionA - point.regionB).toLocaleString('ru-RU')} инстр.
          </span>
        )}
      </div>
      <div className="space-y-1.5">
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
              {typeof entry.value === 'number' ? entry.value.toLocaleString('ru-RU') : entry.value} инструкторов
            </span>
          </div>
        ))}
      </div>
      {point?.driverNote && (
        <p className="pt-1.5 border-t border-slate-700/80 text-[11px] text-slate-300 leading-snug">
          {point.driverNote}
        </p>
      )}
    </div>
  );
};

export const DfoRegionComparisonChart: React.FC = () => {
  const [regionAId, setRegionAId] = useState<string>('primorye');
  const [regionBId, setRegionBId] = useState<string>('kamchatka');
  const [mapFocusedRegionId, setMapFocusedRegionId] = useState<string>('primorye');
  const [activeSlot, setActiveSlot] = useState<ComparisonSlot>('A');
  const [barMetricMode, setBarMetricMode] = useState<'counts' | 'rates'>('counts');
  const [forecastScenario, setForecastScenario] = useState<'base' | 'conservative'>('base');

  const totals = useMemo(() => {
    const totalRegistry = DFO_REGIONS_DISTRIBUTION.reduce(
      (sum, r) => sum + r.certifiedInRegistry,
      0
    );
    const totalDemand = DFO_REGIONS_DISTRIBUTION.reduce((sum, r) => sum + r.estimatedDemand, 0);
    return { totalRegistry, totalDemand };
  }, []);

  const buildSnapshot = (regionId: string): RegionSnapshot => {
    const region =
      DFO_REGIONS_DISTRIBUTION.find((r) => r.id === regionId) ?? DFO_REGIONS_DISTRIBUTION[0];
    const deficit = Math.max(region.estimatedDemand - region.certifiedInRegistry, 0);
    const coveragePct =
      Math.round((region.certifiedInRegistry / Math.max(region.estimatedDemand, 1)) * 1000) / 10;
    const registrySharePct =
      Math.round((region.certifiedInRegistry / Math.max(totals.totalRegistry, 1)) * 1000) / 10;
    const demandSharePct =
      Math.round((region.estimatedDemand / Math.max(totals.totalDemand, 1)) * 1000) / 10;
    const octoberShareOfRegistryPct =
      Math.round((region.october2026Certified / Math.max(region.certifiedInRegistry, 1)) * 1000) /
      10;

    const base2030 =
      DFO_REGIONAL_DEMAND_FORECAST_2025_2030.base[
        DFO_REGIONAL_DEMAND_FORECAST_2025_2030.base.length - 1
      ];
    const cons2030 =
      DFO_REGIONAL_DEMAND_FORECAST_2025_2030.conservative[
        DFO_REGIONAL_DEMAND_FORECAST_2025_2030.conservative.length - 1
      ];

    return {
      region,
      deficit,
      coveragePct,
      registrySharePct,
      demandSharePct,
      octoberShareOfRegistryPct,
      demand2030Base: getForecastDemandForRegion(region.id, base2030),
      demand2030Conservative: getForecastDemandForRegion(region.id, cons2030),
    };
  };

  const snapA = useMemo(() => buildSnapshot(regionAId), [regionAId, totals]);
  const snapB = useMemo(() => buildSnapshot(regionBId), [regionBId, totals]);

  const handleSelectRegionA = (nextId: string) => {
    if (nextId === regionBId) {
      setRegionBId(regionAId);
    }
    setRegionAId(nextId);
    setMapFocusedRegionId(nextId);
    const chosen = DFO_REGIONS_DISTRIBUTION.find((r) => r.id === nextId);
    tracker.trackCustomInteraction(
      'Сравнение регионов ДФО (А)',
      chosen?.shortName ?? nextId
    );
  };

  const handleSelectRegionB = (nextId: string) => {
    if (nextId === regionAId) {
      setRegionAId(regionBId);
    }
    setRegionBId(nextId);
    setMapFocusedRegionId(nextId);
    const chosen = DFO_REGIONS_DISTRIBUTION.find((r) => r.id === nextId);
    tracker.trackCustomInteraction(
      'Сравнение регионов ДФО (Б)',
      chosen?.shortName ?? nextId
    );
  };

  const handleSwapRegions = () => {
    setRegionAId(regionBId);
    setRegionBId(regionAId);
    setMapFocusedRegionId(regionBId);
    tracker.trackCustomInteraction(
      'Сравнение регионов ДФО: обмен',
      `${snapB.region.shortName} ↔ ${snapA.region.shortName}`
    );
  };

  const handlePickRegionFromMap = (pickedId: string) => {
    setMapFocusedRegionId(pickedId);
    if (activeSlot === 'A') {
      if (pickedId === regionBId) {
        setRegionBId(regionAId);
      }
      setRegionAId(pickedId);
      setActiveSlot('B');
    } else {
      if (pickedId === regionAId) {
        setRegionAId(regionBId);
      }
      setRegionBId(pickedId);
      setActiveSlot('A');
    }
  };

  const barChartData: BarComparisonDatum[] = useMemo(() => {
    if (barMetricMode === 'counts') {
      return [
        {
          metric: 'В реестре',
          regionA: snapA.region.certifiedInRegistry,
          regionB: snapB.region.certifiedInRegistry,
          unit: 'чел.',
        },
        {
          metric: 'Выпуск РЦА (окт. 2026)',
          regionA: snapA.region.october2026Certified,
          regionB: snapB.region.october2026Certified,
          unit: 'чел.',
        },
        {
          metric: 'Дефицит кадров',
          regionA: snapA.deficit,
          regionB: snapB.deficit,
          unit: 'чел.',
        },
        {
          metric: 'Расчётный спрос',
          regionA: snapA.region.estimatedDemand,
          regionB: snapB.region.estimatedDemand,
          unit: 'чел.',
        },
      ];
    }

    return [
      {
        metric: 'Покрытие спроса',
        regionA: snapA.coveragePct,
        regionB: snapB.coveragePct,
        unit: '%',
      },
      {
        metric: 'Доля в реестре ДФО',
        regionA: snapA.registrySharePct,
        regionB: snapB.registrySharePct,
        unit: '%',
      },
      {
        metric: 'Доля в спросе ДФО',
        regionA: snapA.demandSharePct,
        regionB: snapB.demandSharePct,
        unit: '%',
      },
      {
        metric: 'Прирост окт. 2026 / реестр',
        regionA: snapA.octoberShareOfRegistryPct,
        regionB: snapB.octoberShareOfRegistryPct,
        unit: '%',
      },
    ];
  }, [barMetricMode, snapA, snapB]);

  const forecastLineData: LineComparisonDatum[] = useMemo(() => {
    const series = DFO_REGIONAL_DEMAND_FORECAST_2025_2030[forecastScenario];
    return series.map((pt) => ({
      year: pt.year,
      regionA: getForecastDemandForRegion(snapA.region.id, pt),
      regionB: getForecastDemandForRegion(snapB.region.id, pt),
      driverNote: pt.driverNote,
    }));
  }, [forecastScenario, snapA.region.id, snapB.region.id]);

  const coverageRatioText = useMemo(() => {
    const high = Math.max(snapA.coveragePct, snapB.coveragePct);
    const low = Math.max(Math.min(snapA.coveragePct, snapB.coveragePct), 0.1);
    const ratio = Math.round((high / low) * 10) / 10;
    const leader =
      snapA.coveragePct >= snapB.coveragePct ? snapA.region.shortName : snapB.region.shortName;
    return `${leader} опережает по обеспеченности реестром в ${ratio}×`;
  }, [snapA, snapB]);

  return (
    <section
      aria-labelledby="dfo-region-comparison-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-medium text-teal-700">
            Межрегиональное сопоставление показателей аттестации
          </p>
          <h2
            id="dfo-region-comparison-heading"
            className="text-xl font-bold text-slate-900"
          >
            Сравнение двух субъектов ДФО по реестру, дефициту и прогнозу спроса
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Выберите любые два региона Дальнего Востока для визуального анализа разрыва между
            фактическим числом аттестованных проводников, текущим дефицитом и траекторией спроса до
            2030 года.
          </p>
        </div>

        {/* Quick preset pairs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_PAIRS.map((pair) => {
            const isActive = regionAId === pair.a && regionBId === pair.b;
            return (
              <button
                key={pair.label}
                type="button"
                onClick={() => {
                  setRegionAId(pair.a);
                  setRegionBId(pair.b);
                  setMapFocusedRegionId(pair.a);
                  tracker.trackCustomInteraction('Пресет сравнения ДФО', pair.label);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {pair.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive DFO SVG Map + Comparison Selection Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7">
          <DfoComparisonSvgMap
            regionAId={regionAId}
            regionBId={regionBId}
            activeSlot={activeSlot}
            onChangeActiveSlot={setActiveSlot}
            onPickRegion={handlePickRegionFromMap}
          />
        </div>

        <form
          onSubmit={(e) => e.preventDefault()}
          aria-label="Форма выбора регионов ДФО для сравнения"
          className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-5"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Форма выбора регионов для сравнения
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Клик по карте автоматически заполняет активное поле и переключает пару
                </p>
              </div>
              <span
                className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded border shrink-0 ${
                  activeSlot === 'A'
                    ? 'bg-teal-50 text-teal-800 border-teal-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                Слот {activeSlot === 'A' ? 'А' : 'Б'}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="compare-region-a"
                  className="flex items-center gap-2 text-xs font-semibold text-slate-700"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: REGION_A_COLOR }}
                    aria-hidden="true"
                  />
                  Регион А (основной)
                </label>
                {activeSlot === 'A' && (
                  <span className="text-[11px] font-medium text-teal-700">
                    выбирается с карты
                  </span>
                )}
              </div>
              <select
                id="compare-region-a"
                value={regionAId}
                onFocus={() => setActiveSlot('A')}
                onChange={(e) => handleSelectRegionA(e.target.value)}
                className={`w-full px-3.5 py-2.5 bg-white border rounded-lg text-sm font-medium text-slate-900 focus:outline-2 focus:outline-teal-700 cursor-pointer transition-colors ${
                  activeSlot === 'A'
                    ? 'border-teal-600 ring-2 ring-teal-600/15'
                    : 'border-slate-300'
                }`}
              >
                {DFO_REGIONS_DISTRIBUTION.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.certifiedInRegistry} в реестре /{' '}
                    {r.estimatedDemand.toLocaleString('ru-RU')} спрос)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={handleSwapRegions}
                aria-label="Поменять выбранные регионы местами"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
                Поменять регионы местами
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="compare-region-b"
                  className="flex items-center gap-2 text-xs font-semibold text-slate-700"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: REGION_B_COLOR }}
                    aria-hidden="true"
                  />
                  Регион Б (для сравнения)
                </label>
                {activeSlot === 'B' && (
                  <span className="text-[11px] font-medium text-amber-700">
                    выбирается с карты
                  </span>
                )}
              </div>
              <select
                id="compare-region-b"
                value={regionBId}
                onFocus={() => setActiveSlot('B')}
                onChange={(e) => handleSelectRegionB(e.target.value)}
                className={`w-full px-3.5 py-2.5 bg-white border rounded-lg text-sm font-medium text-slate-900 focus:outline-2 focus:outline-amber-600 cursor-pointer transition-colors ${
                  activeSlot === 'B'
                    ? 'border-amber-500 ring-2 ring-amber-500/15'
                    : 'border-slate-300'
                }`}
              >
                {DFO_REGIONS_DISTRIBUTION.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.certifiedInRegistry} в реестре /{' '}
                    {r.estimatedDemand.toLocaleString('ru-RU')} спрос)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick pair delta preview inside form */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span>Разница в реестре (А − Б)</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {snapA.region.certifiedInRegistry - snapB.region.certifiedInRegistry >= 0 ? '+' : ''}
                {snapA.region.certifiedInRegistry - snapB.region.certifiedInRegistry} чел.
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>Разница в спросе (А − Б)</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {snapA.region.estimatedDemand - snapB.region.estimatedDemand >= 0 ? '+' : ''}
                {(snapA.region.estimatedDemand - snapB.region.estimatedDemand).toLocaleString(
                  'ru-RU'
                )}{' '}
                чел.
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-500 pt-1.5 border-t border-slate-100">
              <span>Соотношение покрытия</span>
              <span className="font-mono font-semibold text-teal-800 tabular-nums">
                {snapA.coveragePct}% vs {snapB.coveragePct}%
              </span>
            </div>
          </div>
        </form>
      </div>

      {/* Yearly Certified Instructors Recharts LineChart for the Map-Selected Region */}
      <DfoCertifiedDynamicsLineChart
        selectedRegionId={mapFocusedRegionId}
        comparisonRegionId={mapFocusedRegionId === regionAId ? regionBId : regionAId}
      />

      {/* Side-by-Side KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[
          { snap: snapA, color: REGION_A_COLOR, label: 'Регион А', barClass: 'bg-teal-700', borderClass: 'border-teal-200/80' },
          { snap: snapB, color: REGION_B_COLOR, label: 'Регион Б', barClass: 'bg-amber-600', borderClass: 'border-amber-200/80' },
        ].map(({ snap, color, label, barClass, borderClass }) => (
          <div
            key={`${label}-${snap.region.id}`}
            className={`bg-slate-50 border ${borderClass} rounded-xl p-5 space-y-4`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                  <span aria-hidden="true">·</span>
                  <span>{snap.region.statusLabel}</span>
                </div>
                <h3 className="mt-1 text-base sm:text-lg font-bold text-slate-900">
                  {snap.region.name}
                </h3>
              </div>
              <span className="font-mono text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md px-2.5 py-1 tabular-nums shrink-0">
                Покрытие: {snap.coveragePct}%
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500">В реестре</p>
                <p className="mt-1 text-base font-bold font-mono text-slate-900 tabular-nums">
                  {snap.region.certifiedInRegistry} чел.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500">Спрос (база)</p>
                <p className="mt-1 text-base font-bold font-mono text-slate-900 tabular-nums">
                  {snap.region.estimatedDemand.toLocaleString('ru-RU')}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500">Дефицит</p>
                <p className="mt-1 text-base font-bold font-mono text-red-700 tabular-nums">
                  {snap.deficit.toLocaleString('ru-RU')}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500">РЦА окт. 2026</p>
                <p className="mt-1 text-base font-bold font-mono text-teal-800 tabular-nums">
                  {snap.region.october2026Certified > 0
                    ? `+${snap.region.october2026Certified} чел.`
                    : '0 чел.'}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Обеспеченность расчётного спроса реестром</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {snap.coveragePct}% (доля в ДФО: {snap.registrySharePct}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${barClass} transition-all duration-300`}
                  style={{ width: `${Math.min(Math.max(snap.coveragePct, 2), 100)}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-200/80 pt-3">
              <span className="font-semibold text-slate-800">Профиль:</span> {snap.region.keyTracks}.{' '}
              {snap.region.note}
            </p>
          </div>
        ))}
      </div>

      {/* Dual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Attestation Metrics Grouped BarChart */}
        <div className="lg:col-span-6 border border-slate-200 rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <BarChart3 className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                <h3>Структура аттестации и разрыв</h3>
              </div>
              <p className="text-[11px] text-slate-500">
                {barMetricMode === 'counts'
                  ? 'Сопоставление численности в реестре, выпуска РЦА и кадрового дефицита'
                  : 'Нормализованные доли: покрытие спроса, вес в ДФО и темп легализации'}
              </p>
            </div>

            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => {
                  setBarMetricMode('counts');
                  tracker.trackCustomInteraction('Сравнение ДФО: режим численности');
                }}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  barMetricMode === 'counts'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Чел.
              </button>
              <button
                type="button"
                onClick={() => {
                  setBarMetricMode('rates');
                  tracker.trackCustomInteraction('Сравнение ДФО: режим процентов');
                }}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  barMetricMode === 'rates'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Доли (%)
              </button>
            </div>
          </div>

          <div className="w-full h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barChartData}
                margin={{ top: 10, right: 12, left: -8, bottom: 8 }}
                barGap={6}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="metric"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                  tickFormatter={(v: number) =>
                    barMetricMode === 'rates' ? `${v}%` : v.toLocaleString('ru-RU')
                  }
                />
                <Tooltip
                  cursor={{ fill: 'rgba(15, 118, 110, 0.08)' }}
                  content={<ComparisonBarTooltip />}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar
                  dataKey="regionA"
                  name={snapA.region.shortName}
                  fill={REGION_A_COLOR}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={38}
                />
                <Bar
                  dataKey="regionB"
                  name={snapB.region.shortName}
                  fill={REGION_B_COLOR}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={38}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: 2025-2030 Demand Trajectory LineChart */}
        <div className="lg:col-span-6 border border-slate-200 rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <TrendingUp className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                <h3>Динамика потребности 2025–2030 гг.</h3>
              </div>
              <p className="text-[11px] text-slate-500">
                Наведите на точку линии, чтобы увидеть точное количество инструкторов по годам
              </p>
            </div>

            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => {
                  setForecastScenario('base');
                  tracker.trackCustomInteraction('Сравнение ДФО прогноз: базовый');
                }}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  forecastScenario === 'base'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Базовый (30%)
              </button>
              <button
                type="button"
                onClick={() => {
                  setForecastScenario('conservative');
                  tracker.trackCustomInteraction('Сравнение ДФО прогноз: консервативный');
                }}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  forecastScenario === 'conservative'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Консерв. (18%)
              </button>
            </div>
          </div>

          <div className="w-full h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={forecastLineData}
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
                <Tooltip
                  trigger="hover"
                  cursor={{ stroke: '#0F766E', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                  allowEscapeViewBox={{ x: true, y: true }}
                  content={<ComparisonLineTooltip />}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                  iconType="plainline"
                />
                <Line
                  type="monotone"
                  dataKey="regionA"
                  name={`${snapA.region.shortName} (прогноз)`}
                  stroke={REGION_A_COLOR}
                  strokeWidth={2.75}
                  dot={(dotProps) => {
                    const { cx, cy, payload, value } = dotProps as {
                      cx?: number;
                      cy?: number;
                      value?: number;
                      payload?: LineComparisonDatum;
                    };
                    if (typeof cx !== 'number' || typeof cy !== 'number') {
                      return <g key={`empty-a-${payload?.year ?? 'x'}`} />;
                    }
                    return (
                      <g key={`dot-a-${payload?.year}`}>
                        <title>{`${payload?.year} г. (${snapA.region.shortName}): ${typeof value === 'number' ? value.toLocaleString('ru-RU') : value} инструкторов`}</title>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={4.5}
                          fill="#FFFFFF"
                          stroke={REGION_A_COLOR}
                          strokeWidth={2}
                          className="cursor-pointer"
                        />
                      </g>
                    );
                  }}
                  activeDot={{ r: 7, fill: REGION_A_COLOR, stroke: '#FFFFFF', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="regionB"
                  name={`${snapB.region.shortName} (прогноз)`}
                  stroke={REGION_B_COLOR}
                  strokeWidth={2.75}
                  dot={(dotProps) => {
                    const { cx, cy, payload, value } = dotProps as {
                      cx?: number;
                      cy?: number;
                      value?: number;
                      payload?: LineComparisonDatum;
                    };
                    if (typeof cx !== 'number' || typeof cy !== 'number') {
                      return <g key={`empty-b-${payload?.year ?? 'x'}`} />;
                    }
                    return (
                      <g key={`dot-b-${payload?.year}`}>
                        <title>{`${payload?.year} г. (${snapB.region.shortName}): ${typeof value === 'number' ? value.toLocaleString('ru-RU') : value} инструкторов`}</title>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={4.5}
                          fill="#FFFFFF"
                          stroke={REGION_B_COLOR}
                          strokeWidth={2}
                          className="cursor-pointer"
                        />
                      </g>
                    );
                  }}
                  activeDot={{ r: 7, fill: REGION_B_COLOR, stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Comparative Insight Footer */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700">
        <p className="leading-relaxed">
          <span className="font-semibold text-slate-900">Вывод по паре субъектов:</span>{' '}
          {coverageRatioText}. Разница в текущем дефиците составляет{' '}
          <span className="font-mono font-semibold text-slate-900 tabular-nums">
            {Math.abs(snapA.deficit - snapB.deficit).toLocaleString('ru-RU')} чел.
          </span>
          , а к 2030 году в{' '}
          {forecastScenario === 'base' ? 'базовом' : 'консервативном'} сценарии расчётная
          потребность достигнет{' '}
          <span className="font-mono font-semibold text-teal-800 tabular-nums">
            {(forecastScenario === 'base'
              ? snapA.demand2030Base
              : snapA.demand2030Conservative
            ).toLocaleString('ru-RU')}
          </span>{' '}
          чел. ({snapA.region.shortName}) против{' '}
          <span className="font-mono font-semibold text-amber-700 tabular-nums">
            {(forecastScenario === 'base'
              ? snapB.demand2030Base
              : snapB.demand2030Conservative
            ).toLocaleString('ru-RU')}
          </span>{' '}
          чел. ({snapB.region.shortName}).
        </p>
      </div>
    </section>
  );
};
