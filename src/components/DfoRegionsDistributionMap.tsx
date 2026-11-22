import React, { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { DFO_REGIONS_DISTRIBUTION, type DfoRegionDistribution } from '../data/researchData';
import { tracker } from '../utils/tracker';
import type { DfoRegionFilterId } from './DfoDemandForecastChart';

type MapMetricMode = 'registry' | 'demand' | 'october2026';

interface DfoRegionsDistributionMapProps {
  regionFilter?: DfoRegionFilterId;
  onSelectRegionFilter?: (regionId: DfoRegionFilterId) => void;
}

export const DfoRegionsDistributionMap: React.FC<DfoRegionsDistributionMapProps> = ({
  regionFilter = 'all',
  onSelectRegionFilter,
}) => {
  const [metricMode, setMetricMode] = useState<MapMetricMode>('registry');
  const [internalSelectedId, setInternalSelectedId] = useState<string>('primorye');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const effectiveSelectedId = regionFilter === 'all' ? internalSelectedId : regionFilter;
  const isFilteredSingle = regionFilter !== 'all';

  const activeRegion: DfoRegionDistribution = useMemo(
    () =>
      DFO_REGIONS_DISTRIBUTION.find((r) => r.id === effectiveSelectedId) ??
      DFO_REGIONS_DISTRIBUTION[0],
    [effectiveSelectedId]
  );

  const totalRegistry = useMemo(
    () => DFO_REGIONS_DISTRIBUTION.reduce((sum, r) => sum + r.certifiedInRegistry, 0),
    []
  );
  const totalDemand = useMemo(
    () => DFO_REGIONS_DISTRIBUTION.reduce((sum, r) => sum + r.estimatedDemand, 0),
    []
  );
  const totalOct2026 = useMemo(
    () => DFO_REGIONS_DISTRIBUTION.reduce((sum, r) => sum + r.october2026Certified, 0),
    []
  );

  const handleSelectRegion = (region: DfoRegionDistribution) => {
    setInternalSelectedId(region.id);
    if (onSelectRegionFilter) {
      onSelectRegionFilter(region.id as DfoRegionFilterId);
    }
    tracker.trackCustomInteraction(`Карта ДФО: ${region.shortName}`, metricMode);
  };

  const getRegionMetricValue = (r: DfoRegionDistribution): number => {
    if (metricMode === 'registry') return r.certifiedInRegistry;
    if (metricMode === 'demand') return r.estimatedDemand;
    return r.october2026Certified;
  };

  const getBubbleRadius = (r: DfoRegionDistribution): number => {
    const val = getRegionMetricValue(r);
    if (metricMode === 'registry') {
      return Math.max(7, Math.min(26, Math.round(Math.sqrt(val) * 1.35)));
    }
    if (metricMode === 'demand') {
      return Math.max(8, Math.min(28, Math.round(Math.sqrt(val) * 0.56)));
    }
    return val > 0 ? Math.max(9, Math.min(22, val + 6)) : 5;
  };

  const getRegionFill = (
    r: DfoRegionDistribution,
    isSelected: boolean,
    isHovered: boolean
  ): string => {
    if (isSelected) return '#CCFBF1';
    if (isHovered) return '#F0FDFA';
    if (metricMode === 'october2026' && r.october2026Certified > 0) return '#F0FDFA';
    return '#FFFFFF';
  };

  const getBubbleColor = (r: DfoRegionDistribution): string => {
    if (metricMode === 'registry') {
      if (r.certifiedInRegistry >= 100) return '#0F766E';
      if (r.certifiedInRegistry >= 30) return '#B45309';
      return '#475569';
    }
    if (metricMode === 'demand') {
      if (r.estimatedDemand >= 900) return '#B91C1C';
      if (r.estimatedDemand >= 300) return '#B45309';
      return '#475569';
    }
    return r.october2026Certified > 0 ? '#0F766E' : '#94A3B8';
  };

  const coveragePct = Math.min(
    Math.round((activeRegion.certifiedInRegistry / Math.max(activeRegion.estimatedDemand, 1)) * 100),
    100
  );
  const registrySharePct = Math.round((activeRegion.certifiedInRegistry / totalRegistry) * 100);

  return (
    <section
      aria-labelledby="dfo-geo-map-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700">
            Пространственная аналитика Дальнего Востока
            {isFilteredSingle ? ` · Выбран: ${activeRegion.name}` : ''}
          </p>
          <h2 id="dfo-geo-map-heading" className="text-lg sm:text-xl font-bold text-slate-900">
            Географическое распределение аттестованных проводников по регионам ДФО
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Сопоставление численности специалистов в Едином федеральном реестре, расчётного
            спроса и межрегиональной географии октябрьской сессии РЦА «Русский Восток» (ВВГУ).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isFilteredSingle && onSelectRegionFilter && (
            <button
              type="button"
              onClick={() => onSelectRegionFilter('all')}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Показать весь ДФО
            </button>
          )}

          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'registry', label: `В реестре (${totalRegistry})` },
                { id: 'demand', label: `Спрос (${totalDemand.toLocaleString('ru-RU')})` },
                { id: 'october2026', label: `Сессия РЦА окт. 2026 (${totalOct2026})` },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  setMetricMode(mode.id);
                  tracker.trackCustomInteraction(`Режим карты ДФО: ${mode.label}`);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  metricMode === mode.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* SVG Map Canvas (7 cols) */}
        <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pb-3 border-b border-slate-200">
            <span>Выберите регион на карте или в фильтре ДФО</span>
            <div className="flex flex-wrap items-center gap-4">
              {metricMode === 'registry' && (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-700" aria-hidden="true" />
                    &ge; 100 в реестре
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-700" aria-hidden="true" />
                    30–99
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-600" aria-hidden="true" />
                    &lt; 30
                  </span>
                </>
              )}
              {metricMode === 'demand' && (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-700" aria-hidden="true" />
                    Высокий дефицит (&ge; 900)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-700" aria-hidden="true" />
                    Средний (300–899)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-600" aria-hidden="true" />
                    До 300
                  </span>
                </>
              )}
              {metricMode === 'october2026' && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-700" aria-hidden="true" />
                  Поток соискателей в РЦА «Русский Восток» (Владивосток)
                </span>
              )}
            </div>
          </div>

          <div className="w-full">
            <svg
              viewBox="0 0 640 430"
              className="w-full max-h-[410px] h-auto mx-auto select-none"
              role="img"
              aria-label="Географическая карта распределения аттестованных инструкторов-проводников по регионам ДФО"
            >
              {/* Sea backdrop */}
              <rect x="0" y="0" width="640" height="430" fill="#EFF6FF" rx="8" />

              {/* Subtle latitude/longitude grid lines */}
              <g stroke="#DCE7F3" strokeWidth="1" strokeDasharray="3 4">
                <line x1="0" y1="110" x2="640" y2="110" />
                <line x1="0" y1="220" x2="640" y2="220" />
                <line x1="0" y1="330" x2="640" y2="330" />
                <line x1="160" y1="0" x2="160" y2="430" />
                <line x1="320" y1="0" x2="320" y2="430" />
                <line x1="480" y1="0" x2="480" y2="430" />
              </g>

              {/* Water body labels */}
              <text x="456" y="275" className="fill-slate-400 text-[10px] font-serif italic">
                Охотское море
              </text>
              <text x="380" y="408" className="fill-slate-400 text-[10px] font-serif italic">
                Японское море
              </text>
              <text x="536" y="295" className="fill-slate-400 text-[10px] font-serif italic">
                Тихий океан
              </text>

              {/* Regional polygons */}
              {DFO_REGIONS_DISTRIBUTION.map((region) => {
                const isSelected = region.id === activeRegion.id;
                const isHovered = region.id === hoveredId;
                const dimNonSelected = isFilteredSingle && !isSelected && !isHovered;
                return (
                  <path
                    key={region.id}
                    d={region.svgPath}
                    fill={getRegionFill(region, isSelected, isHovered)}
                    fillOpacity={dimNonSelected ? 0.55 : 1}
                    stroke={isSelected ? '#0F766E' : '#94A3B8'}
                    strokeWidth={isSelected ? 2.2 : 1.3}
                    strokeLinejoin="round"
                    onClick={() => handleSelectRegion(region)}
                    onMouseEnter={() => setHoveredId(region.id)}
                    onMouseLeave={() => setHoveredId((prev) => (prev === region.id ? null : prev))}
                    className="transition-colors duration-150 cursor-pointer"
                  />
                );
              })}

              {/* Interregional RTsA flow arcs in October 2026 mode */}
              {metricMode === 'october2026' && (
                <g fill="none" stroke="#0F766E" strokeWidth="1.8" strokeDasharray="4 4">
                  <path d="M 342,248 Q 318,308 345,368" />
                  <path d="M 503,172 Q 470,310 345,368" />
                </g>
              )}

              {/* Data bubbles + labels */}
              {DFO_REGIONS_DISTRIBUTION.map((region) => {
                const isSelected = region.id === activeRegion.id;
                const isHovered = region.id === hoveredId;
                const dimNonSelected = isFilteredSingle && !isSelected && !isHovered;
                const radius = getBubbleRadius(region);
                const bubbleColor = getBubbleColor(region);
                const val = getRegionMetricValue(region);

                return (
                  <g
                    key={`node-${region.id}`}
                    onClick={() => handleSelectRegion(region)}
                    onMouseEnter={() => setHoveredId(region.id)}
                    onMouseLeave={() => setHoveredId((prev) => (prev === region.id ? null : prev))}
                    opacity={dimNonSelected ? 0.45 : 1}
                    className="cursor-pointer transition-opacity duration-150"
                  >
                    {isSelected && (
                      <circle
                        cx={region.cx}
                        cy={region.cy}
                        r={radius + 5}
                        fill="none"
                        stroke="#0F172A"
                        strokeWidth={1.6}
                      />
                    )}
                    <circle
                      cx={region.cx}
                      cy={region.cy}
                      r={radius}
                      fill={bubbleColor}
                      fillOpacity={0.88}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    />
                    <text
                      x={region.cx}
                      y={region.cy + 3.5}
                      textAnchor="middle"
                      className="fill-white text-[9.5px] font-mono font-bold pointer-events-none"
                    >
                      {val}
                    </text>
                    <text
                      x={region.labelX}
                      y={region.labelY}
                      textAnchor={region.labelAnchor ?? 'start'}
                      className={`text-[10.5px] font-sans pointer-events-none ${
                        isSelected ? 'fill-slate-950 font-bold' : 'fill-slate-700 font-medium'
                      }`}
                    >
                      {region.shortName}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Region Inspector + Comparison List (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-5">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                <span>{activeRegion.statusLabel}</span>
              </div>
              <h3 className="mt-1.5 text-lg font-bold text-slate-900">{activeRegion.name}</h3>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500">В реестре</p>
                <p className="mt-1 text-lg font-bold font-mono text-teal-800 tabular-nums">
                  {activeRegion.certifiedInRegistry} чел.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500">Спрос</p>
                <p className="mt-1 text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {activeRegion.estimatedDemand.toLocaleString('ru-RU')}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500">Доля ДФО</p>
                <p className="mt-1 text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {registrySharePct}%
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Покрытие расчётного спроса</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {coveragePct}%
                </span>
              </div>
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-700"
                  style={{ width: `${Math.max(coveragePct, 2)}%` }}
                />
              </div>
            </div>

            <dl className="divide-y divide-slate-200 text-xs">
              <div className="py-2.5">
                <dt className="text-slate-500">Ключевые направления</dt>
                <dd className="mt-1 text-slate-800 leading-relaxed">{activeRegion.keyTracks}</dd>
              </div>
              <div className="py-2.5">
                <dt className="text-slate-500">Аналитический комментарий</dt>
                <dd className="mt-1 text-slate-800 leading-relaxed">{activeRegion.note}</dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-3">
                <dt className="text-slate-500">Выпуск РЦА (окт. 2026)</dt>
                <dd className="font-mono font-semibold text-teal-800 tabular-nums">
                  {activeRegion.october2026Certified > 0
                    ? `+${activeRegion.october2026Certified} чел.`
                    : 'Поток формируется'}
                </dd>
              </div>
            </dl>
          </div>

          {/* All 7 DFO regions quick list */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex justify-between">
              <span>Субъект ДФО</span>
              <span>Реестр / Спрос</span>
            </div>
            <div className="divide-y divide-slate-200 max-h-[210px] overflow-y-auto">
              {DFO_REGIONS_DISTRIBUTION.map((r) => {
                const selected = r.id === activeRegion.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectRegion(r)}
                    className={`w-full px-4 py-2.5 text-left text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      selected
                        ? 'bg-teal-50/80 font-semibold text-slate-900'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="truncate">{r.name}</span>
                    <span className="font-mono tabular-nums shrink-0 text-slate-600">
                      <span className="text-teal-800 font-semibold">{r.certifiedInRegistry}</span> /{' '}
                      {r.estimatedDemand.toLocaleString('ru-RU')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
