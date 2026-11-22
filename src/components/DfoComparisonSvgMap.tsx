import React, { useMemo, useState } from 'react';
import { DFO_REGIONS_DISTRIBUTION, type DfoRegionDistribution } from '../data/researchData';
import { tracker } from '../utils/tracker';
import { registryRadius, demandRadius, shareRadius } from '../utils/dfoMapScale.ts';

export type ComparisonSlot = 'A' | 'B';
export type DfoMapMetricMode = 'registry' | 'demand' | 'october2026';

interface DfoComparisonSvgMapProps {
  regionAId: string;
  regionBId: string;
  activeSlot: ComparisonSlot;
  onChangeActiveSlot: (slot: ComparisonSlot) => void;
  onPickRegion: (regionId: string) => void;
}

const REGION_A_COLOR = '#0F766E';
const REGION_B_COLOR = '#D97706';

export const DfoComparisonSvgMap: React.FC<DfoComparisonSvgMapProps> = ({
  regionAId,
  regionBId,
  activeSlot,
  onChangeActiveSlot,
  onPickRegion,
}) => {
  const [metricMode, setMetricMode] = useState<DfoMapMetricMode>('registry');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const totals = useMemo(() => {
    return {
      registry: DFO_REGIONS_DISTRIBUTION.reduce((sum, r) => sum + r.certifiedInRegistry, 0),
      demand: DFO_REGIONS_DISTRIBUTION.reduce((sum, r) => sum + r.estimatedDemand, 0),
      october2026: DFO_REGIONS_DISTRIBUTION.reduce((sum, r) => sum + r.october2026Certified, 0),
    };
  }, []);

  const regionA = useMemo(
    () => DFO_REGIONS_DISTRIBUTION.find((r) => r.id === regionAId) ?? DFO_REGIONS_DISTRIBUTION[0],
    [regionAId]
  );

  const regionB = useMemo(
    () => DFO_REGIONS_DISTRIBUTION.find((r) => r.id === regionBId) ?? DFO_REGIONS_DISTRIBUTION[1],
    [regionBId]
  );

  const hoveredRegion = useMemo(
    () => DFO_REGIONS_DISTRIBUTION.find((r) => r.id === hoveredId) ?? null,
    [hoveredId]
  );

  const getMetricValue = (r: DfoRegionDistribution): number => {
    if (metricMode === 'registry') return r.certifiedInRegistry;
    if (metricMode === 'demand') return r.estimatedDemand;
    return r.october2026Certified;
  };

  // Sizing lives in utils/dfoMapScale so both bubble maps agree on what a
  // given count looks like; the constants used to differ between them.
  const getBubbleRadius = (r: DfoRegionDistribution): number => {
    const val = getMetricValue(r);
    if (metricMode === 'registry') return registryRadius(val);
    if (metricMode === 'demand') return demandRadius(val);
    return shareRadius(val);
  };

  const getRegionFill = (
    regionId: string,
    isSelectedA: boolean,
    isSelectedB: boolean,
    isHovered: boolean
  ): string => {
    if (isSelectedA) return '#CCFBF1';
    if (isSelectedB) return '#FEF3C7';
    if (isHovered) {
      return activeSlot === 'A' ? '#F0FDFA' : '#FFFBEB';
    }
    if (metricMode === 'october2026') {
      const reg = DFO_REGIONS_DISTRIBUTION.find((r) => r.id === regionId);
      if (reg && reg.october2026Certified > 0) return '#F8FAFC';
    }
    return '#FFFFFF';
  };

  const getRegionStroke = (
    isSelectedA: boolean,
    isSelectedB: boolean,
    isHovered: boolean
  ): string => {
    if (isSelectedA) return REGION_A_COLOR;
    if (isSelectedB) return REGION_B_COLOR;
    if (isHovered) return activeSlot === 'A' ? REGION_A_COLOR : REGION_B_COLOR;
    return '#94A3B8';
  };

  const getBubbleColor = (
    r: DfoRegionDistribution,
    isSelectedA: boolean,
    isSelectedB: boolean
  ): string => {
    if (isSelectedA) return REGION_A_COLOR;
    if (isSelectedB) return REGION_B_COLOR;
    if (metricMode === 'october2026' && r.october2026Certified === 0) return '#94A3B8';
    return '#475569';
  };

  const handleRegionActivate = (region: DfoRegionDistribution) => {
    onPickRegion(region.id);
    tracker.trackCustomInteraction(
      `SVG-карта ДФО (сравнение, слот ${activeSlot})`,
      region.shortName
    );
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-4">
      {/* Map Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-600 font-medium">Клик заполняет:</span>
          <div className="inline-flex items-center gap-1 p-0.5 bg-white border border-slate-200 rounded-lg">
            <button
              type="button"
              onClick={() => onChangeActiveSlot('A')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeSlot === 'A'
                  ? 'bg-teal-700 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  activeSlot === 'A' ? 'bg-white' : 'bg-teal-700'
                }`}
                aria-hidden="true"
              />
              Регион А
            </button>
            <button
              type="button"
              onClick={() => onChangeActiveSlot('B')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeSlot === 'B'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  activeSlot === 'B' ? 'bg-white' : 'bg-amber-600'
                }`}
                aria-hidden="true"
              />
              Регион Б
            </button>
          </div>
        </div>

        {/* Metric layer switcher */}
        <div className="inline-flex flex-wrap items-center gap-1 p-0.5 bg-white border border-slate-200 rounded-lg">
          {(
            [
              { id: 'registry', label: `Реестр (${totals.registry})` },
              { id: 'demand', label: `Спрос (${totals.demand.toLocaleString('ru-RU')})` },
              { id: 'october2026', label: `РЦА окт. (${totals.october2026})` },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => {
                setMetricMode(mode.id);
                tracker.trackCustomInteraction('Слой SVG-карты ДФО (сравнение)', mode.label);
              }}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                metricMode === mode.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div className="w-full relative">
        <svg
          viewBox="0 0 640 430"
          className="w-full max-h-[395px] h-auto mx-auto select-none"
          role="group"
          aria-label="Интерактивная карта субъектов Дальнего Востока для выбора пары регионов сравнения"
        >
          {/* Sea backdrop */}
          <rect x="0" y="0" width="640" height="430" fill="#EFF6FF" rx="8" />

          {/* Subtle latitude/longitude grid */}
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
            const isSelectedA = region.id === regionA.id;
            const isSelectedB = region.id === regionB.id;
            const isHovered = region.id === hoveredId;

            return (
              <path
                key={region.id}
                d={region.svgPath}
                fill={getRegionFill(region.id, isSelectedA, isSelectedB, isHovered)}
                stroke={getRegionStroke(isSelectedA, isSelectedB, isHovered)}
                strokeWidth={isSelectedA || isSelectedB ? 2.4 : isHovered ? 2 : 1.3}
                strokeLinejoin="round"
                tabIndex={0}
                role="button"
                aria-label={`Выбрать ${region.name} для сравнения (${region.certifiedInRegistry} в реестре, спрос ${region.estimatedDemand})`}
                onClick={() => handleRegionActivate(region)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRegionActivate(region);
                  }
                }}
                onMouseEnter={() => setHoveredId(region.id)}
                onMouseLeave={() => setHoveredId((prev) => (prev === region.id ? null : prev))}
                className="transition-colors duration-150 cursor-pointer focus:outline-none"
              />
            );
          })}

          {/* Comparison connector line between Region A and Region B */}
          {regionA.id !== regionB.id && (
            <line
              x1={regionA.cx}
              y1={regionA.cy}
              x2={regionB.cx}
              y2={regionB.cy}
              stroke="#1E293B"
              strokeWidth={1.6}
              strokeDasharray="5 4"
              strokeOpacity={0.55}
              className="pointer-events-none"
            />
          )}

          {/* Data bubbles, badges & region labels */}
          {DFO_REGIONS_DISTRIBUTION.map((region) => {
            const isSelectedA = region.id === regionA.id;
            const isSelectedB = region.id === regionB.id;
            const isHovered = region.id === hoveredId;
            const radius = getBubbleRadius(region);
            const bubbleColor = getBubbleColor(region, isSelectedA, isSelectedB);
            const val = getMetricValue(region);

            return (
              <g
                key={`node-${region.id}`}
                onClick={() => handleRegionActivate(region)}
                onMouseEnter={() => setHoveredId(region.id)}
                onMouseLeave={() => setHoveredId((prev) => (prev === region.id ? null : prev))}
                className="cursor-pointer"
              >
                {(isSelectedA || isSelectedB) && (
                  <circle
                    cx={region.cx}
                    cy={region.cy}
                    r={radius + 5}
                    fill="none"
                    stroke={isSelectedA ? REGION_A_COLOR : REGION_B_COLOR}
                    strokeWidth={1.8}
                  />
                )}

                <circle
                  cx={region.cx}
                  cy={region.cy}
                  r={radius}
                  fill={bubbleColor}
                  fillOpacity={isSelectedA || isSelectedB || isHovered ? 0.96 : 0.84}
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

                {(isSelectedA || isSelectedB) && (
                  <g className="pointer-events-none">
                    <circle
                      cx={region.cx + radius + 3}
                      cy={region.cy - radius - 1}
                      r={8.5}
                      fill={isSelectedA ? REGION_A_COLOR : REGION_B_COLOR}
                      stroke="#FFFFFF"
                      strokeWidth={1.5}
                    />
                    <text
                      x={region.cx + radius + 3}
                      y={region.cy - radius + 2.5}
                      textAnchor="middle"
                      className="fill-white text-[9.5px] font-sans font-bold"
                    >
                      {isSelectedA ? 'А' : 'Б'}
                    </text>
                  </g>
                )}

                <text
                  x={region.labelX}
                  y={region.labelY}
                  textAnchor={region.labelAnchor ?? 'start'}
                  className={`text-[10.5px] font-sans pointer-events-none ${
                    isSelectedA || isSelectedB
                      ? 'fill-slate-950 font-bold'
                      : isHovered
                        ? 'fill-slate-900 font-semibold'
                        : 'fill-slate-700 font-medium'
                  }`}
                >
                  {region.shortName}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Bottom status / legend bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 text-[11px] text-slate-600">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
            <span className="w-2.5 h-2.5 rounded-xs bg-teal-700" aria-hidden="true" />
            А: {regionA.shortName}
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-600" aria-hidden="true" />
            Б: {regionB.shortName}
          </span>
        </div>

        <span className="text-slate-500">
          {hoveredRegion
            ? `Клик установит в «Регион ${activeSlot}»: ${hoveredRegion.name}`
            : 'Нажмите на любой регион на карте для подстановки в форму'}
        </span>
      </div>
    </div>
  );
};
