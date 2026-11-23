import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Award, Compass, MapPin, ShieldAlert, TrendingUp, Users } from 'lucide-react';
import {
  DFO_LABEL_OFFSETS,
  buildDfoD3MapLayout,
  createDfoD3ColorScale,
  createDfoD3RadiusScale,
  formatDfoSubjectMetricLabel,
  getDfoSubjectMetricValue,
  type DfoD3MetricMode,
  type DfoProjectedSubject,
} from '../utils/dfoD3MapData';
import { tracker } from '../utils/tracker';

const METRIC_TABS: readonly {
  id: DfoD3MetricMode;
  label: string;
  unitLabel: string;
  legendLow: string;
  legendHigh: string;
  gradientCss: string;
}[] = [
  {
    id: 'density',
    label: 'Плотность (на 10 тыс. км²)',
    unitLabel: 'инструкторов / 10 тыс. км²',
    legendLow: '0,05',
    legendHigh: '7,41',
    gradientCss: 'linear-gradient(90deg, #F1F5F9 0%, #99F6E4 45%, #0F766E 80%, #115E59 100%)',
  },
  {
    id: 'registry',
    label: 'В реестре (чел.)',
    unitLabel: 'аттест. в ЕФРТА',
    legendLow: '6 чел.',
    legendHigh: '343 чел.',
    gradientCss: 'linear-gradient(90deg, #F1F5F9 0%, #99F6E4 50%, #0F766E 100%)',
  },
  {
    id: 'deficit',
    label: 'Дефицит кадров',
    unitLabel: 'нехватка (чел.)',
    legendLow: '64 чел.',
    legendHigh: '2 268 чел.',
    gradientCss: 'linear-gradient(90deg, #FEF3C7 0%, #F59E0B 50%, #B91C1C 100%)',
  },
  {
    id: 'coveragePct',
    label: 'Покрытие спроса (%)',
    unitLabel: 'покрытие',
    legendLow: '5%',
    legendHigh: '37%',
    gradientCss: 'linear-gradient(90deg, #E2E8F0 0%, #5EEAD4 50%, #0F766E 100%)',
  },
];

function getDensityTierClass(tier: 'high' | 'medium' | 'low'): string {
  if (tier === 'high') return 'bg-teal-50 text-teal-800 border-teal-200';
  if (tier === 'medium') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-300';
}

export const DfoSubjectsD3SvgMap: React.FC = () => {
  const [metricMode, setMetricMode] = useState<DfoD3MetricMode>('density');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('primorye');
  const [hoveredSubjectId, setHoveredSubjectId] = useState<string | null>(null);
  const [hoverPointer, setHoverPointer] = useState<{ xPct: number; yPct: number } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const layout = useMemo(() => buildDfoD3MapLayout(760, 480), []);

  const colorScale = useMemo(
    () => createDfoD3ColorScale(layout.subjects, metricMode),
    [layout.subjects, metricMode]
  );

  const radiusScale = useMemo(
    () => createDfoD3RadiusScale(layout.subjects, metricMode),
    [layout.subjects, metricMode]
  );

  const densityBarWidthScale = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([0, Math.max(layout.maxDensityPer10kKm2, 7.5)])
        .range([4, 100])
        .clamp(true),
    [layout.maxDensityPer10kKm2]
  );

  // Use D3 selection to animate subject fill opacity & halo ring on hover/selection
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    svg
      .selectAll<SVGPathElement, unknown>('path[data-dfo-subject]')
      .transition()
      .duration(140)
      .attr('fill-opacity', function () {
        const id = this.getAttribute('data-dfo-subject');
        if (hoveredSubjectId && id === hoveredSubjectId) return 0.98;
        if (hoveredSubjectId && id !== hoveredSubjectId) return 0.62;
        return id === selectedSubjectId ? 0.94 : 0.85;
      });
  }, [hoveredSubjectId, selectedSubjectId, metricMode]);

  const hoveredSubject: DfoProjectedSubject | null = useMemo(
    () =>
      hoveredSubjectId
        ? layout.subjects.find((s) => s.id === hoveredSubjectId) ?? null
        : null,
    [layout.subjects, hoveredSubjectId]
  );

  const activeSubject: DfoProjectedSubject = useMemo(
    () =>
      hoveredSubject ??
      layout.subjects.find((s) => s.id === selectedSubjectId) ??
      layout.subjects[0],
    [hoveredSubject, layout.subjects, selectedSubjectId]
  );

  const sortedSubjects = useMemo(
    () =>
      [...layout.subjects].sort(
        (a, b) =>
          getDfoSubjectMetricValue(b, metricMode) -
          getDfoSubjectMetricValue(a, metricMode)
      ),
    [layout.subjects, metricMode]
  );

  const activeMetricMeta =
    METRIC_TABS.find((t) => t.id === metricMode) ?? METRIC_TABS[0];

  const handleSvgMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const [svgX, svgY] = d3.pointer(event, svgRef.current);
    const rawX = (svgX / layout.width) * 100;
    const rawY = (svgY / layout.height) * 100;
    setHoverPointer({
      xPct: Math.max(12, Math.min(68, rawX)),
      yPct: Math.max(6, Math.min(64, rawY)),
    });
  };

  const handleFocusOrHoverSubject = (subject: DfoProjectedSubject) => {
    setHoveredSubjectId(subject.id);
    setHoverPointer({
      xPct: Math.max(12, Math.min(66, (subject.centroid[0] / layout.width) * 100)),
      yPct: Math.max(8, Math.min(62, (subject.centroid[1] / layout.height) * 100)),
    });
  };

  const handleSelectSubject = (subject: DfoProjectedSubject) => {
    setSelectedSubjectId(subject.id);
    tracker.trackCustomInteraction(
      `D3-карта плотности ДФО: ${subject.shortName}`,
      `${subject.densityPer10kKm2} чел/10т.км²`
    );
  };

  return (
    <section
      id="dfo-d3-subjects-map"
      aria-labelledby="dfo-d3-map-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 scroll-mt-24"
    >
      {/* Header & Metric Switcher */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-teal-700">
            <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Картограмма плотности на D3.js (проекция d3.geoConicEqualArea + шкала плотности)</span>
          </div>
          <h2 id="dfo-d3-map-heading" className="text-xl font-bold text-slate-900">
            Плотность аттестованных инструкторов по субъектам ДФО
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Наведите курсор на субъект федерации на карте D3.js, чтобы увидеть плотность инструкторов
            на 10 000 км² территории, сопоставление со средним уровнем по ДФО и разрыв с расчётной
            потребностью.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Режим визуализации D3-карты ДФО"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start xl:self-auto"
        >
          {METRIC_TABS.map((tab) => {
            const active = metricMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setMetricMode(tab.id);
                  tracker.trackCustomInteraction(`D3-карта ДФО режим: ${tab.label}`, 'market');
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split: D3 SVG Canvas (8 cols) + Live Density Inspector (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left D3 Canvas */}
        <div className="lg:col-span-8 bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-4 relative">
          {/* Scale Legend Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 pb-3 border-b border-slate-200">
            <span>
              Средняя плотность по ДФО:{' '}
              <strong className="font-mono text-teal-800 tabular-nums">
                {layout.avgDensityPer10kKm2.toFixed(2).replace('.', ',')} чел./10 тыс. км²
              </strong>{' '}
              <span aria-hidden="true">·</span> Реестр:{' '}
              <strong className="font-mono text-slate-900 tabular-nums">
                {layout.totalRegistry.toLocaleString('ru-RU')} чел.
              </strong>
            </span>

            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] tabular-nums">{activeMetricMeta.legendLow}</span>
              <div
                className="w-24 h-2.5 rounded-full border border-slate-300"
                style={{ background: activeMetricMeta.gradientCss }}
                aria-hidden="true"
              />
              <span className="font-mono text-[11px] tabular-nums">{activeMetricMeta.legendHigh}</span>
            </div>
          </div>

          {/* Relative Map + Hover Density Tooltip Container */}
          <div className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-sky-50/60">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              onMouseMove={handleSvgMouseMove}
              onMouseLeave={() => {
                setHoveredSubjectId(null);
                setHoverPointer(null);
              }}
              className="w-full h-auto block select-none"
              role="img"
              aria-label="Интерактивная D3-карта плотности инструкторов-проводников по субъектам ДФО"
            >
              {/* Subtle SVG Hatch Pattern for Density Overlay on Hovered Region */}
              <defs>
                <pattern
                  id="dfo-density-dots"
                  width="8"
                  height="8"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="2.5" cy="2.5" r="1" fill="#0F172A" fillOpacity="0.22" />
                </pattern>
              </defs>

              {/* D3 Projected Graticule Grid */}
              <path
                d={layout.graticulePath}
                fill="none"
                stroke="#CBD5E1"
                strokeWidth={0.75}
                strokeDasharray="3 4"
                strokeOpacity={0.75}
              />

              {/* Sea Geographic Labels */}
              <text
                x={545}
                y={305}
                className="fill-slate-400 text-[11px] font-serif italic pointer-events-none"
              >
                Охотское море
              </text>
              <text
                x={465}
                y={452}
                className="fill-slate-400 text-[11px] font-serif italic pointer-events-none"
              >
                Японское море
              </text>
              <text
                x={648}
                y={220}
                className="fill-slate-400 text-[11px] font-serif italic pointer-events-none"
              >
                Тихий океан
              </text>

              {/* D3 Projected DFO Subject Polygons */}
              <g>
                {layout.subjects.map((subject) => {
                  const metricVal = getDfoSubjectMetricValue(subject, metricMode);
                  const fillColor = colorScale(metricVal);
                  const isHovered = hoveredSubjectId === subject.id;
                  const isSelected = selectedSubjectId === subject.id;

                  return (
                    <g key={subject.id}>
                      <path
                        data-dfo-subject={subject.id}
                        d={subject.pathData}
                        fill={fillColor}
                        fillOpacity={isHovered ? 0.98 : 0.86}
                        stroke={isHovered || isSelected ? '#0F172A' : '#475569'}
                        strokeWidth={isHovered ? 2.5 : isSelected ? 1.9 : 1.0}
                        strokeLinejoin="round"
                        tabIndex={0}
                        role="button"
                        aria-label={`${subject.name}: плотность ${subject.densityPer10kKm2.toFixed(2)} инструкторов на 10 тыс. км², в реестре ${subject.certifiedInRegistry} чел.`}
                        onMouseEnter={() => handleFocusOrHoverSubject(subject)}
                        onFocus={() => handleFocusOrHoverSubject(subject)}
                        onBlur={() => setHoveredSubjectId(null)}
                        onClick={() => handleSelectSubject(subject)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectSubject(subject);
                          }
                        }}
                        className="cursor-pointer focus:outline-none"
                      />
                      {isHovered && (
                        <path
                          d={subject.pathData}
                          fill="url(#dfo-density-dots)"
                          stroke="#0F172A"
                          strokeWidth={1.5}
                          className="pointer-events-none"
                        />
                      )}
                    </g>
                  );
                })}
              </g>

              {/* D3 ScaleSqrt Proportional Markers & Region Labels */}
              <g className="pointer-events-none">
                {layout.subjects.map((subject) => {
                  const [cx, cy] = subject.centroid;
                  const metricVal = getDfoSubjectMetricValue(subject, metricMode);
                  const radius = radiusScale(metricVal);
                  const isHighlighted =
                    hoveredSubjectId === subject.id || selectedSubjectId === subject.id;
                  const offset = DFO_LABEL_OFFSETS[subject.id] ?? {
                    dx: 0,
                    dy: 22,
                    anchor: 'middle',
                  };

                  return (
                    <g key={`marker-${subject.id}`}>
                      {isHighlighted && (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={radius + 5}
                          fill="none"
                          stroke="#0F172A"
                          strokeWidth={1.6}
                          strokeDasharray={hoveredSubjectId === subject.id ? undefined : '3 2'}
                        />
                      )}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill={metricMode === 'deficit' ? '#991B1B' : '#0F172A'}
                        fillOpacity={0.86}
                        stroke="#FFFFFF"
                        strokeWidth={1.6}
                      />
                      <text
                        x={cx}
                        y={cy + 3.5}
                        textAnchor="middle"
                        className="fill-white text-[10px] font-mono font-bold"
                      >
                        {formatDfoSubjectMetricLabel(subject, metricMode)}
                      </text>
                      <text
                        x={cx + offset.dx}
                        y={cy + offset.dy}
                        textAnchor={offset.anchor}
                        className={`text-[11px] font-sans ${
                          isHighlighted ? 'fill-slate-950 font-bold' : 'fill-slate-800 font-semibold'
                        }`}
                        style={{
                          paintOrder: 'stroke',
                          stroke: 'rgba(255, 255, 255, 0.92)',
                          strokeWidth: 3,
                        }}
                      >
                        {subject.shortName}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Interactive Hover Tooltip Visualizing Regional Instructor Density */}
            {hoveredSubject && hoverPointer && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  left: `${hoverPointer.xPct}%`,
                  top: `${hoverPointer.yPct}%`,
                }}
                className="pointer-events-none absolute z-20 w-72 bg-slate-900/95 text-white border border-slate-700 rounded-xl shadow-xl p-3.5 space-y-2.5 text-xs transition-opacity duration-100"
              >
                <div className="space-y-0.5 border-b border-slate-700 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-sm text-white leading-snug">
                      {hoveredSubject.name}
                    </p>
                  </div>
                  <p className="text-[11px] text-teal-300 leading-snug">
                    {hoveredSubject.densityTierLabel} · {hoveredSubject.areaKm2.toLocaleString('ru-RU')} км²
                  </p>
                </div>

                {/* Density Gauge Bar Scaled via d3.scaleLinear */}
                <div className="space-y-1 bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/80">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] text-slate-300">Плотность инструкторов</span>
                    <span className="font-mono font-bold text-teal-300 tabular-nums">
                      {hoveredSubject.densityPer10kKm2.toFixed(2).replace('.', ',')} / 10 тыс. км²
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-400 rounded-full transition-all duration-150"
                      style={{ width: `${densityBarWidthScale(hoveredSubject.densityPer10kKm2)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono tabular-nums">
                    <span>
                      {hoveredSubject.densityVsDfoAvgRatio >= 1
                        ? `в ${hoveredSubject.densityVsDfoAvgRatio.toFixed(1).replace('.', ',')}× выше ср. ДФО`
                        : `${Math.round(hoveredSubject.densityVsDfoAvgRatio * 100)}% от ср. ДФО`}
                    </span>
                    <span>
                      Спрос: {hoveredSubject.demandDensityPer10kKm2.toFixed(1).replace('.', ',')} / 10т.км²
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono tabular-nums">
                  <div>
                    <p className="text-[10px] text-slate-400 font-sans">В реестре ЕФРТА</p>
                    <p className="font-bold text-white">
                      {hoveredSubject.certifiedInRegistry.toLocaleString('ru-RU')} чел.
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-sans">Потребность / Дефицит</p>
                    <p className="font-bold text-amber-300">
                      {hoveredSubject.estimatedDemand.toLocaleString('ru-RU')} / −{hoveredSubject.deficit.toLocaleString('ru-RU')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-500">
            Картография D3.js: проекция `d3.geoConicEqualArea`, координатная сетка `d3.geoGraticule`,
            цветовая шкала `d3.scaleSequential`, маркеры `d3.scaleSqrt` и отслеживание курсора `d3.pointer`.
          </p>
        </div>

        {/* Right Live Density & Subject Inspector (4 cols) */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="space-y-1.5 border-b border-slate-200 pb-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-teal-700">
                  {hoveredSubject ? 'Плотность при наведении' : 'Выбранный субъект ДФО'}
                </p>
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded border ${getDensityTierClass(
                    activeSubject.densityTier
                  )}`}
                >
                  {activeSubject.densityTierLabel}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">{activeSubject.name}</h3>
              <p className="text-xs text-slate-600">{activeSubject.statusLabel}</p>
            </div>

            {/* Density Highlight Metric */}
            <div className="bg-teal-50/70 border border-teal-200 rounded-lg p-3.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-teal-950 inline-flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>Плотность инструкторов</span>
                </span>
                <span className="font-mono text-[11px] text-teal-800 tabular-nums">
                  {activeSubject.areaKm2.toLocaleString('ru-RU')} км²
                </span>
              </div>
              <p className="text-xl font-bold font-mono text-teal-800 tabular-nums">
                {activeSubject.densityPer10kKm2.toFixed(2).replace('.', ',')} чел. / 10 тыс. км²
              </p>
              <p className="text-[11px] text-teal-900/80 font-mono tabular-nums">
                Целевая плотность спроса: {activeSubject.demandDensityPer10kKm2.toFixed(1).replace('.', ',')}{' '}
                чел. / 10 тыс. км²
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                  <Award className="w-3 h-3 text-teal-700" aria-hidden="true" />
                  <span>В реестре</span>
                </p>
                <p className="mt-1 text-lg font-bold text-teal-700 font-mono tabular-nums">
                  {activeSubject.certifiedInRegistry.toLocaleString('ru-RU')} чел.
                </p>
                <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                  {activeSubject.registrySharePct}% от ДФО
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                  <Users className="w-3 h-3 text-slate-700" aria-hidden="true" />
                  <span>Потребность</span>
                </p>
                <p className="mt-1 text-lg font-bold text-slate-900 font-mono tabular-nums">
                  {activeSubject.estimatedDemand.toLocaleString('ru-RU')} чел.
                </p>
                <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                  Покрытие: {activeSubject.coveragePct.toFixed(1)}%
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-red-700" aria-hidden="true" />
                  <span>Дефицит</span>
                </p>
                <p className="mt-1 text-base font-bold text-red-700 font-mono tabular-nums">
                  −{activeSubject.deficit.toLocaleString('ru-RU')} чел.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                  <span>Поток окт. 2026</span>
                </p>
                <p className="mt-1 text-base font-bold text-slate-900 font-mono tabular-nums">
                  +{activeSubject.october2026Certified} чел.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <p className="font-semibold text-slate-900">Ведущие профили маршрутов:</p>
              <p className="text-slate-600 leading-relaxed">{activeSubject.keyTracks}</p>
            </div>
          </div>

          {/* Quick clickable ranking list */}
          <div className="space-y-1.5 pt-3 border-t border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500">
              Рейтинг субъектов ({activeMetricMeta.label}):
            </p>
            <ul className="divide-y divide-slate-100">
              {sortedSubjects.map((sub) => {
                const active = activeSubject.id === sub.id;
                return (
                  <li key={sub.id}>
                    <button
                      type="button"
                      onMouseEnter={() => handleFocusOrHoverSubject(sub)}
                      onMouseLeave={() => setHoveredSubjectId(null)}
                      onClick={() => handleSelectSubject(sub)}
                      className={`w-full py-1.5 px-2 rounded text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        active
                          ? 'bg-teal-50 text-teal-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{sub.shortName}</span>
                      <span className="font-mono tabular-nums shrink-0">
                        {formatDfoSubjectMetricLabel(sub, metricMode)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
};
