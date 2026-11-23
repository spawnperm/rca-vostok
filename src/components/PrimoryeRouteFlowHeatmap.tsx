import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Flame, MapPin, ShieldAlert, Users } from 'lucide-react';
import {
  PRIMORYE_MONTH_LABELS,
  buildPrimoryeHeatmapMatrix,
  type HeatmapCellDatum,
  type HeatmapMetricMode,
  type HeatmapSortMode,
  type HeatmapTrackFilter,
} from '../data/primoryeFlowHeatmapData';
import { tracker } from '../utils/tracker';

const METRIC_LABELS: Record<HeatmapMetricMode, string> = {
  loadPct: 'Нагрузка на норму (%)',
  flowThousands: 'Турпоток (тыс. чел./мес.)',
  guidesNeeded: 'Потребность в гидах (чел.)',
};

const TRACK_FILTERS: readonly { id: HeatmapTrackFilter; label: string }[] = [
  { id: 'all', label: 'Все маршруты (9)' },
  { id: 'hiking', label: 'Пешеходный / горный' },
  { id: 'water', label: 'Водный' },
  { id: 'expedition', label: 'Экспедиционный / ООПТ' },
];

const SORT_MODES: readonly { id: HeatmapSortMode; label: string }[] = [
  { id: 'peakLoad', label: 'По пиковой нагрузке' },
  { id: 'annualFlow', label: 'По годовому потоку' },
  { id: 'southToNorth', label: 'Юг → Север' },
];

function formatCellValue(cell: HeatmapCellDatum, metricMode: HeatmapMetricMode): string {
  if (metricMode === 'loadPct') return `${cell.loadPct}%`;
  if (metricMode === 'flowThousands') {
    return cell.flowThousands === 0 ? '0' : cell.flowThousands.toFixed(1).replace('.', ',');
  }
  return String(cell.guidesNeeded);
}

function getRelativeLuminance(hexOrRgb: string): number {
  const c = d3.color(hexOrRgb)?.rgb();
  if (!c) return 1;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

export const PrimoryeRouteFlowHeatmap: React.FC = () => {
  const [metricMode, setMetricMode] = useState<HeatmapMetricMode>('loadPct');
  const [trackFilter, setTrackFilter] = useState<HeatmapTrackFilter>('all');
  const [sortMode, setSortMode] = useState<HeatmapSortMode>('peakLoad');
  const [hoveredCell, setHoveredCell] = useState<HeatmapCellDatum | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('khasan-gamova');

  const legendSvgRef = useRef<SVGSVGElement | null>(null);

  const matrix = useMemo(
    () => buildPrimoryeHeatmapMatrix({ trackFilter, sortMode, metricMode }),
    [trackFilter, sortMode, metricMode]
  );

  // Keep selectedRouteId aligned when trackFilter changes
  useEffect(() => {
    if (
      matrix.routes.length > 0 &&
      !matrix.routes.some((r) => r.profile.id === selectedRouteId)
    ) {
      setSelectedRouteId(matrix.routes[0].profile.id);
    }
  }, [matrix.routes, selectedRouteId]);

  const selectedRouteSummary = useMemo(
    () =>
      matrix.routes.find((r) => r.profile.id === selectedRouteId) ??
      matrix.routes[0] ??
      null,
    [matrix.routes, selectedRouteId]
  );

  // D3 domain & scales
  const margin = { top: 44, right: 108, bottom: 26, left: 238 };
  const cellHeight = 42;
  const innerWidth = 684;
  const innerHeight = Math.max(matrix.routes.length, 1) * cellHeight;
  const svgWidth = margin.left + innerWidth + margin.right;
  const svgHeight = margin.top + innerHeight + margin.bottom;

  const xScale = useMemo(
    () =>
      d3
        .scaleBand<string>()
        .domain([...PRIMORYE_MONTH_LABELS])
        .range([0, innerWidth])
        .paddingInner(0.08)
        .paddingOuter(0.04),
    [innerWidth]
  );

  const yScale = useMemo(
    () =>
      d3
        .scaleBand<string>()
        .domain(matrix.routes.map((r) => r.profile.id))
        .range([0, innerHeight])
        .paddingInner(0.12)
        .paddingOuter(0.06),
    [matrix.routes, innerHeight]
  );

  const maxDomain = useMemo(() => {
    if (metricMode === 'loadPct') return Math.max(125, matrix.maxMetricValue);
    return Math.max(1, matrix.maxMetricValue);
  }, [metricMode, matrix.maxMetricValue]);

  const colorInterpolator = useMemo(
    () =>
      d3.interpolateRgbBasis([
        '#F8FAFC',
        '#CCFBF1',
        '#5EEAD4',
        '#0F766E',
        '#D97706',
        '#B91C1C',
      ]),
    []
  );

  const colorScale = useMemo(
    () => d3.scaleSequential(colorInterpolator).domain([0, maxDomain]).clamp(true),
    [colorInterpolator, maxDomain]
  );

  // Render crisp D3 continuous color legend & axis ticks
  useEffect(() => {
    const svgEl = legendSvgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = 280;
    const height = 42;
    const barLeft = 10;
    const barWidth = width - 20;
    const barHeight = 11;

    const defs = svg.append('defs');
    const gradId = 'primorye-heatmap-legend-grad';
    const linearGrad = defs
      .append('linearGradient')
      .attr('id', gradId)
      .attr('x1', '0%')
      .attr('x2', '100%')
      .attr('y1', '0%')
      .attr('y2', '0%');

    const stops = d3.range(0, 1.05, 0.1);
    linearGrad
      .selectAll('stop')
      .data(stops)
      .join('stop')
      .attr('offset', (d) => `${Math.round(d * 100)}%`)
      .attr('stop-color', (d) => colorInterpolator(d));

    svg
      .append('rect')
      .attr('x', barLeft)
      .attr('y', 4)
      .attr('width', barWidth)
      .attr('height', barHeight)
      .attr('rx', 3)
      .attr('fill', `url(#${gradId})`)
      .attr('stroke', '#CBD5E1')
      .attr('stroke-width', 0.8);

    const legendAxisScale = d3.scaleLinear().domain([0, maxDomain]).range([barLeft, barLeft + barWidth]);
    const ticks =
      metricMode === 'loadPct'
        ? [0, 40, 80, 100, maxDomain]
        : [0, Math.round(maxDomain * 0.25), Math.round(maxDomain * 0.5), Math.round(maxDomain * 0.75), maxDomain];

    const axis = d3
      .axisBottom(legendAxisScale)
      .tickValues(ticks)
      .tickSize(4)
      .tickFormat((val) => {
        const num = Number(val);
        if (metricMode === 'loadPct') return `${num}%`;
        if (metricMode === 'flowThousands') return `${num}т`;
        return String(num);
      });

    const axisGroup = svg
      .append('g')
      .attr('transform', `translate(0, ${4 + barHeight})`)
      .call(axis);

    axisGroup.select('.domain').remove();
    axisGroup.selectAll('line').attr('stroke', '#94A3B8');
    axisGroup
      .selectAll('text')
      .attr('fill', '#475569')
      .attr('font-size', '10px')
      .attr('font-family', 'JetBrains Mono, monospace');
  }, [colorInterpolator, maxDomain, metricMode]);

  const activeCell =
    hoveredCell ??
    (selectedRouteSummary
      ? matrix.cells.find(
          (c) =>
            c.routeId === selectedRouteSummary.profile.id &&
            c.monthLabel === selectedRouteSummary.peakMonthLabel
        ) ?? null
      : null);

  return (
    <section
      aria-labelledby="primorye-heatmap-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-teal-700">
            <Flame className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Тепловая карта Приморского края · D3.js</span>
            <span aria-hidden="true" className="text-slate-400">·</span>
            <span className="text-slate-500">9 ключевых маршрутов × 12 месяцев</span>
          </div>
          <h2 id="primorye-heatmap-heading" className="text-lg sm:text-xl font-bold text-slate-900">
            Интенсивность туристических потоков и нагрузка на популярные маршруты Приморья
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Матрица визуализирует месячную загрузку экотроп ООПТ, горных хребтов и водных трасс
            Приморского края. Выделен 7-месячный активный сезон (март–ноябрь) и зоны перегрузки
            пропускной способности (≥90%).
          </p>
        </div>

        {/* Metric Switcher */}
        <div
          role="tablist"
          aria-label="Метрика тепловой карты Приморья"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0"
        >
          {(Object.keys(METRIC_LABELS) as HeatmapMetricMode[]).map((mode) => {
            const active = metricMode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setMetricMode(mode);
                  tracker.trackCustomInteraction('Тепловая карта Приморья: метрика', mode);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {METRIC_LABELS[mode]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter & Sort Bar + D3 Legend */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {TRACK_FILTERS.map((tf) => {
              const active = trackFilter === tf.id;
              return (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => {
                    setTrackFilter(tf.id);
                    tracker.trackCustomInteraction('Тепловая карта Приморья: трек', tf.id);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>

          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-50 border border-slate-200 rounded-lg">
            {SORT_MODES.map((sm) => {
              const active = sortMode === sm.id;
              return (
                <button
                  key={sm.id}
                  type="button"
                  onClick={() => setSortMode(sm.id)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sm.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* D3 Axis-Driven Color Scale Legend */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
            Шкала D3:
          </span>
          <svg
            ref={legendSvgRef}
            width={280}
            height={42}
            aria-label={`Шкала интенсивности: ${METRIC_LABELS[metricMode]}`}
            className="overflow-visible"
          />
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Годовой поток по выборке</p>
          <p className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
            {matrix.totalAnnualFlowThousands.toLocaleString('ru-RU')} тыс.
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Пиковый месяц в крае</p>
          <p className="mt-1 text-xl font-bold font-mono text-teal-800 tabular-nums">
            {matrix.peakMonthAggregateLabel} · {matrix.peakMonthAggregateFlowThousands.toLocaleString('ru-RU')} тыс.
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Маршруто-месяцев ≥90% нормы</p>
          <p className="mt-1 text-xl font-bold font-mono text-amber-700 tabular-nums">
            {matrix.overloadedRouteMonthsCount} зон
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
          <p className="text-[11px] font-medium text-slate-500">Фокус-маршрут (пик)</p>
          <p className="mt-1 text-xl font-bold font-mono text-red-700 tabular-nums">
            {selectedRouteSummary ? `${selectedRouteSummary.peakLoadPct}% (${selectedRouteSummary.peakMonthLabel})` : '—'}
          </p>
        </div>
      </div>

      {/* Main D3 Matrix Heatmap SVG */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[780px] select-none"
          role="img"
          aria-label="Интерактивная тепловая карта интенсивности туристических потоков в Приморском крае по месяцам"
        >
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Active 7-Month Primorye Season Backdrop Corridor (Mar..Nov) */}
            {(() => {
              const marX = xScale('Мар') ?? 0;
              const novX = xScale('Ноя') ?? 0;
              const bandW = xScale.bandwidth();
              const corridorW = novX + bandW - marX;
              return (
                <g>
                  <rect
                    x={marX - 4}
                    y={-28}
                    width={corridorW + 8}
                    height={innerHeight + 34}
                    rx={6}
                    fill="#0F766E"
                    fillOpacity={0.04}
                    stroke="#0F766E"
                    strokeOpacity={0.18}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={marX + corridorW / 2}
                    y={-32}
                    textAnchor="middle"
                    className="fill-teal-800 text-[10px] font-semibold"
                  >
                    Активный сезон в Приморье (март – ноябрь)
                  </text>
                </g>
              );
            })()}

            {/* Month Column Headers */}
            {PRIMORYE_MONTH_LABELS.map((month) => {
              const x = xScale(month) ?? 0;
              const isColHovered = hoveredCell?.monthLabel === month;
              return (
                <text
                  key={month}
                  x={x + xScale.bandwidth() / 2}
                  y={-10}
                  textAnchor="middle"
                  className={`text-[11px] font-mono ${
                    isColHovered ? 'fill-teal-800 font-bold' : 'fill-slate-600 font-medium'
                  }`}
                >
                  {month}
                </text>
              );
            })}

            {/* Right-side Column Header for Annual Flow / Peak */}
            <text
              x={innerWidth + 14}
              y={-10}
              className="fill-slate-500 text-[10.5px] font-mono font-semibold"
            >
              Год · Пик
            </text>

            {/* Route Y-Axis Labels & Summary Stats */}
            {matrix.routes.map((row) => {
              const y = yScale(row.profile.id) ?? 0;
              const isSelected = row.profile.id === selectedRouteId;
              const isRowHovered = hoveredCell?.routeId === row.profile.id;
              return (
                <g
                  key={row.profile.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedRouteId(row.profile.id);
                    tracker.trackCustomInteraction(
                      'Тепловая карта Приморья: выбор маршрута',
                      row.profile.shortName
                    );
                  }}
                >
                  {(isSelected || isRowHovered) && (
                    <rect
                      x={-margin.left + 4}
                      y={y - 1}
                      width={margin.left + innerWidth + margin.right - 8}
                      height={yScale.bandwidth() + 2}
                      rx={5}
                      fill={isSelected ? '#F0FDFA' : '#F8FAFC'}
                      stroke={isSelected ? '#99F6E4' : '#E2E8F0'}
                      strokeWidth={1}
                    />
                  )}
                  <text
                    x={-12}
                    y={y + yScale.bandwidth() / 2 - 4}
                    textAnchor="end"
                    className={`text-[11.5px] ${
                      isSelected ? 'fill-teal-900 font-bold' : 'fill-slate-800 font-semibold'
                    }`}
                  >
                    {row.profile.shortName}
                  </text>
                  <text
                    x={-12}
                    y={y + yScale.bandwidth() / 2 + 10}
                    textAnchor="end"
                    className="fill-slate-500 text-[10px]"
                  >
                    {row.profile.districtName} · норма {row.profile.monthlyCapacityThousands}т
                  </text>

                  <text
                    x={innerWidth + 14}
                    y={y + yScale.bandwidth() / 2 + 4}
                    className="fill-slate-700 text-[11px] font-mono tabular-nums font-medium"
                  >
                    {row.annualFlowThousands}т ·{' '}
                    <tspan
                      fill={
                        row.peakLoadPct >= 100
                          ? '#B91C1C'
                          : row.peakLoadPct >= 85
                            ? '#B45309'
                            : '#0F766E'
                      }
                      fontWeight={700}
                    >
                      {row.peakLoadPct}%
                    </tspan>
                  </text>
                </g>
              );
            })}

            {/* D3 Band-Scaled Matrix Cells */}
            {matrix.cells.map((cell) => {
              const x = xScale(cell.monthLabel) ?? 0;
              const y = yScale(cell.routeId) ?? 0;
              const w = xScale.bandwidth();
              const h = yScale.bandwidth();
              const fill = colorScale(cell.metricValue);
              const lum = getRelativeLuminance(fill);
              const textColor = lum < 0.42 ? '#FFFFFF' : '#0F172A';
              const isActive =
                hoveredCell?.routeId === cell.routeId &&
                hoveredCell?.monthIndex === cell.monthIndex;

              return (
                <g
                  key={`${cell.routeId}-${cell.monthIndex}`}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredCell(cell)}
                  onMouseLeave={() => setHoveredCell(null)}
                  onClick={() => {
                    setSelectedRouteId(cell.routeId);
                    setHoveredCell(cell);
                    tracker.trackCustomInteraction(
                      'Тепловая карта Приморья: ячейка',
                      `${cell.routeShortName} (${cell.monthLabel})`
                    );
                  }}
                >
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx={4}
                    fill={fill}
                    stroke={
                      isActive
                        ? '#0F172A'
                        : cell.loadPct >= 100
                          ? '#991B1B'
                          : '#E2E8F0'
                    }
                    strokeWidth={isActive ? 2.2 : cell.loadPct >= 100 ? 1.2 : 0.7}
                  />
                  <text
                    x={x + w / 2}
                    y={y + h / 2 + 4}
                    textAnchor="middle"
                    fill={textColor}
                    className="text-[10.5px] font-mono tabular-nums font-semibold pointer-events-none"
                  >
                    {formatCellValue(cell, metricMode)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Interactive Cell Hover Bar + Selected Route Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Live Cell Detail Readout (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 text-white rounded-xl p-5 flex flex-col justify-between gap-4">
          {activeCell ? (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-mono text-teal-300 font-semibold">
                    {activeCell.monthLabel} · {activeCell.districtName}
                  </span>
                  <span
                    className={`font-mono font-bold tabular-nums ${
                      activeCell.loadPct >= 100
                        ? 'text-red-300'
                        : activeCell.loadPct >= 85
                          ? 'text-amber-300'
                          : 'text-teal-300'
                    }`}
                  >
                    Загрузка {activeCell.loadPct}%
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white leading-snug">
                  {activeCell.routeShortName}
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-700/80 text-xs">
                <div>
                  <p className="text-slate-400 text-[11px]">Поток в месяц</p>
                  <p className="mt-0.5 font-mono font-bold text-white tabular-nums">
                    {activeCell.flowThousands.toFixed(1).replace('.', ',')} тыс.
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-[11px]">Норма тропы</p>
                  <p className="mt-0.5 font-mono font-bold text-slate-200 tabular-nums">
                    {activeCell.capacityThousands} тыс.
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-[11px]">Нужно гидов</p>
                  <p className="mt-0.5 font-mono font-bold text-teal-300 tabular-nums">
                    {activeCell.guidesNeeded} / {activeCell.certifiedGuidesAvailable}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-300">
              Наведите курсор на ячейку матрицы, чтобы увидеть расчёт потока и потребности в гидах.
            </p>
          )}
        </div>

        {/* Selected Route Passport & Staffing Inspector (7 cols) */}
        {selectedRouteSummary && (
          <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5 font-medium text-teal-800">
                  <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{selectedRouteSummary.profile.districtName}</span>
                </span>
                <span>{selectedRouteSummary.profile.trackLabel}</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="font-mono">{selectedRouteSummary.profile.difficultyCategory}</span>
              </div>

              <h3 className="text-base font-bold text-slate-900">
                {selectedRouteSummary.profile.fullName}
              </h3>

              <p className="text-xs text-slate-700 leading-relaxed">
                <strong className="font-semibold text-slate-900">Пиковая динамика: </strong>
                {selectedRouteSummary.profile.peakDriver}.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200 text-xs">
              <div className="flex items-start gap-2">
                <Users className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-slate-500">В реестре / пик</p>
                  <p className="font-mono font-bold text-slate-900 tabular-nums">
                    {selectedRouteSummary.profile.certifiedGuidesAvailable} /{' '}
                    {selectedRouteSummary.peakGuidesNeeded} гидов
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-slate-500">Дефицит в пик ({selectedRouteSummary.peakMonthLabel})</p>
                  <p className="font-mono font-bold text-red-700 tabular-nums">
                    {selectedRouteSummary.guideGapAtPeak > 0
                      ? `−${selectedRouteSummary.guideGapAtPeak} чел.`
                      : 'Покрыто'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-slate-500">Норма / организованность</p>
                <p className="font-mono font-semibold text-slate-800 tabular-nums">
                  {selectedRouteSummary.profile.groupNorm} чел. · {selectedRouteSummary.profile.organizedSharePct}%
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              {selectedRouteSummary.profile.safetyNote}
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
