import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Flame, MapPin, ShieldAlert, Users } from 'lucide-react';
import {
  buildPrimoryeMunicipalD3Layout,
  createPrimoryeHeatmapColorScale,
  formatPrimoryeMetricValue,
  getPrimoryeMunicipalityMetricValue,
  type PrimoryeHeatmapMetric,
  type PrimoryeMunicipalityComputed,
} from '../utils/primoryeMunicipalHeatmapData';
import { tracker } from '../utils/tracker';

const METRIC_OPTIONS: readonly {
  id: PrimoryeHeatmapMetric;
  label: string;
  description: string;
}[] = [
  {
    id: 'density',
    label: 'Концентрация (на 1 000 км²)',
    description: 'Плотность аттестованных инструкторов на 1 000 км² территории муниципалитета',
  },
  {
    id: 'certified',
    label: 'В реестре (чел.)',
    description: 'Число аттестованных инструкторов-проводников в Едином федеральном реестре',
  },
  {
    id: 'coveragePct',
    label: 'Обеспеченность (%)',
    description: 'Доля текущего спроса, закрытая действующими аттестованными кадрами',
  },
  {
    id: 'deficit',
    label: 'Кадровый дефицит',
    description: 'Незакрытая потребность муниципального образования в инструкторах',
  },
];

function getRelativeLuminance(colorStr: string): number {
  const c = d3.color(colorStr)?.rgb();
  if (!c) return 1;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

export const PrimoryeMunicipalD3Heatmap: React.FC = () => {
  const [metric, setMetric] = useState<PrimoryeHeatmapMetric>('density');
  const [selectedId, setSelectedId] = useState<string>('muni-vladivostok');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pointerPct, setPointerPct] = useState<{ x: number; y: number } | null>(null);

  const mapSvgRef = useRef<SVGSVGElement | null>(null);
  const legendSvgRef = useRef<SVGSVGElement | null>(null);

  const layout = useMemo(() => buildPrimoryeMunicipalD3Layout(560, 470), []);

  const colorConfig = useMemo(
    () => createPrimoryeHeatmapColorScale(layout.municipalities, metric),
    [layout.municipalities, metric]
  );

  // Use D3 selection transitions for smooth polygon highlight & dimming on hover/selection
  useEffect(() => {
    if (!mapSvgRef.current) return;
    const svg = d3.select(mapSvgRef.current);
    svg
      .selectAll<SVGPathElement, unknown>('path[data-primorye-muni]')
      .transition()
      .duration(140)
      .attr('fill-opacity', function () {
        const id = this.getAttribute('data-primorye-muni');
        if (hoveredId && id === hoveredId) return 1;
        if (hoveredId && id !== hoveredId) return 0.58;
        return id === selectedId ? 0.96 : 0.88;
      });
  }, [hoveredId, selectedId, metric]);

  // Render D3 continuous gradient scale bar & bottom axis
  useEffect(() => {
    const svgEl = legendSvgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = 280;
    const padX = 12;
    const barW = width - padX * 2;
    const barH = 10;

    const defs = svg.append('defs');
    const gradId = `primorye-muni-heat-grad-${metric}`;
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
      .attr('offset', (t) => `${Math.round(t * 100)}%`)
      .attr('stop-color', (t) => colorConfig.interpolator(t));

    svg
      .append('rect')
      .attr('x', padX)
      .attr('y', 4)
      .attr('width', barW)
      .attr('height', barH)
      .attr('rx', 3)
      .attr('fill', `url(#${gradId})`)
      .attr('stroke', '#CBD5E1')
      .attr('stroke-width', 0.8);

    const axisScale =
      metric === 'density'
        ? d3.scaleSqrt().domain([0, colorConfig.domainMax]).range([padX, padX + barW])
        : d3.scaleLinear().domain([0, colorConfig.domainMax]).range([padX, padX + barW]);

    const tickVals =
      metric === 'density'
        ? [0, 2, 10, 35, Math.round(colorConfig.domainMax)]
        : [
            0,
            Math.round(colorConfig.domainMax * 0.25),
            Math.round(colorConfig.domainMax * 0.5),
            Math.round(colorConfig.domainMax * 0.75),
            Math.round(colorConfig.domainMax),
          ];

    const axis = d3
      .axisBottom(axisScale)
      .tickValues(tickVals)
      .tickSize(4)
      .tickFormat((val) => {
        const n = Number(val);
        if (metric === 'coveragePct') return `${n}%`;
        return String(n);
      });

    const axisG = svg
      .append('g')
      .attr('transform', `translate(0, ${4 + barH})`)
      .call(axis);

    axisG.select('.domain').remove();
    axisG.selectAll('line').attr('stroke', '#94A3B8');
    axisG
      .selectAll('text')
      .attr('fill', '#475569')
      .attr('font-size', '10px')
      .attr('font-family', 'JetBrains Mono, monospace');
  }, [colorConfig, metric]);

  const sortedMunicipalities = useMemo(() => {
    return [...layout.municipalities].sort(
      (a, b) =>
        getPrimoryeMunicipalityMetricValue(b, metric) -
        getPrimoryeMunicipalityMetricValue(a, metric)
    );
  }, [layout.municipalities, metric]);

  const hoveredMunicipality: PrimoryeMunicipalityComputed | null = useMemo(
    () =>
      hoveredId ? layout.municipalities.find((m) => m.id === hoveredId) ?? null : null,
    [layout.municipalities, hoveredId]
  );

  const activeMunicipality: PrimoryeMunicipalityComputed = useMemo(
    () =>
      hoveredMunicipality ??
      layout.municipalities.find((m) => m.id === selectedId) ??
      layout.municipalities[0],
    [hoveredMunicipality, layout.municipalities, selectedId]
  );

  const activeMetricMeta =
    METRIC_OPTIONS.find((o) => o.id === metric) ?? METRIC_OPTIONS[0];

  const handleSelectMunicipality = (item: PrimoryeMunicipalityComputed) => {
    setSelectedId(item.id);
    tracker.trackCustomInteraction(
      'Тепловая карта Приморья (D3): муниципалитет',
      item.shortName
    );
  };

  return (
    <section
      aria-labelledby="primorye-municipal-d3-heatmap-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header & Metric Switcher */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-teal-700">
            <Flame className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Тепловая карта Приморского края · D3.js</span>
            <span aria-hidden="true" className="text-slate-400">·</span>
            <span className="text-slate-500">
              {layout.municipalities.length} муниципальных кластеров
            </span>
          </div>
          <h2
            id="primorye-municipal-d3-heatmap-heading"
            className="text-xl font-bold text-slate-900"
          >
            Тепловая карта концентрации аттестованных инструкторов по муниципалитетам Приморья
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {activeMetricMeta.description}. Наведите курсор на муниципальное образование для
            просмотра точной плотности или нажмите для фиксации паспорта территории.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Показатель муниципальной тепловой карты Приморья"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0"
        >
          {METRIC_OPTIONS.map((opt) => {
            const active = metric === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setMetric(opt.id);
                  tracker.trackCustomInteraction('Тепловая карта Приморья D3: метрика', opt.id);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split: D3 Municipal Polygon Map (7 cols) + Ranking & Detail Inspector (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: D3 GeoPath Choropleth Heatmap */}
        <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-4 relative">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <span className="text-xs text-slate-600">
              Итого по Приморью:{' '}
              <strong className="font-mono text-slate-900 tabular-nums">
                {layout.totalCertified} чел.
              </strong>{' '}
              в реестре при спросе{' '}
              <strong className="font-mono text-slate-900 tabular-nums">
                {layout.totalDemand.toLocaleString('ru-RU')} чел.
              </strong>
            </span>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-medium text-slate-500">Шкала D3:</span>
              <svg
                ref={legendSvgRef}
                width={280}
                height={38}
                aria-label={`Легенда шкалы тепловой карты: ${activeMetricMeta.label}`}
                className="overflow-visible"
              />
            </div>
          </div>

          <div
            className="relative w-full"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
              const y = ((e.clientY - rect.top) / Math.max(rect.height, 1)) * 100;
              setPointerPct({ x, y });
            }}
            onMouseLeave={() => {
              setHoveredId(null);
              setPointerPct(null);
            }}
          >
            <svg
              ref={mapSvgRef}
              viewBox="0 0 560 470"
              className="w-full max-h-[445px] h-auto mx-auto select-none"
              role="img"
              aria-label="Интерактивная тепловая карта концентрации аттестованных инструкторов по муниципальным образованиям Приморского края"
            >
              <rect x="0" y="0" width="560" height="470" rx="8" fill="#F1F5F9" />

              <text x="412" y="388" className="fill-slate-400 text-[11px] font-serif italic">
                Японское море
              </text>
              <text x="206" y="454" className="fill-slate-400 text-[9px] font-mono">
                зал. Петра Великого
              </text>

              {layout.municipalities.map((m) => {
                const metricVal = getPrimoryeMunicipalityMetricValue(m, metric);
                const fillColor = colorConfig.scale(metricVal);
                const isSelected = m.id === selectedId;
                const isHovered = m.id === hoveredId;
                const lum = getRelativeLuminance(fillColor);
                const labelFill = lum < 0.4 ? '#FFFFFF' : '#0F172A';

                return (
                  <g
                    key={m.id}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredId(m.id)}
                    onClick={() => handleSelectMunicipality(m)}
                  >
                    <path
                      data-primorye-muni={m.id}
                      d={m.pathData}
                      fill={fillColor}
                      stroke={isHovered || isSelected ? '#0F172A' : '#FFFFFF'}
                      strokeWidth={isHovered || isSelected ? 2.2 : 1.2}
                    />
                    <text
                      x={m.labelX}
                      y={m.labelY - 2}
                      textAnchor="middle"
                      fill={labelFill}
                      className="text-[9.5px] font-sans font-semibold pointer-events-none"
                    >
                      {m.shortName}
                    </text>
                    <text
                      x={m.labelX}
                      y={m.labelY + 10}
                      textAnchor="middle"
                      fill={labelFill}
                      className="text-[9px] font-mono tabular-nums font-bold pointer-events-none"
                    >
                      {metric === 'density'
                        ? `${m.densityPer1000Km2.toFixed(1).replace('.', ',')}`
                        : metric === 'certified'
                          ? `${m.certifiedInRegistry}`
                          : metric === 'coveragePct'
                            ? `${m.coveragePct}%`
                            : `${m.deficit}`}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Floating Hover Tooltip */}
            {hoveredMunicipality && pointerPct && (
              <div
                role="status"
                className="pointer-events-none absolute z-10 bg-slate-900 text-white border border-slate-700 rounded-lg p-3 shadow-xl text-xs w-64 space-y-1.5"
                style={{
                  left: `${Math.min(Math.max(pointerPct.x + 2, 4), 58)}%`,
                  top: `${Math.min(Math.max(pointerPct.y - 8, 4), 68)}%`,
                }}
              >
                <div className="flex items-baseline justify-between gap-2 border-b border-slate-700 pb-1">
                  <span className="font-bold text-teal-300 truncate">
                    {hoveredMunicipality.shortName}
                  </span>
                  <span className="font-mono text-[11px] text-slate-300 shrink-0 tabular-nums">
                    {hoveredMunicipality.areaKm2.toLocaleString('ru-RU')} км²
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Концентрация:</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {hoveredMunicipality.densityPer1000Km2.toFixed(2).replace('.', ',')} / 1 000 км²
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">В реестре / спрос:</span>
                  <span className="font-mono font-semibold text-white tabular-nums">
                    {hoveredMunicipality.certifiedInRegistry} / {hoveredMunicipality.estimatedDemand} чел.
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Дефицит (покрытие):</span>
                  <span className="font-mono font-semibold text-amber-300 tabular-nums">
                    {hoveredMunicipality.deficit} чел. ({hoveredMunicipality.coveragePct}%)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Active Municipality Card & Sorted Concentration Table */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-5">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                <span>{activeMunicipality.zoneLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-teal-800">
                  {activeMunicipality.concentrationLabel}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {activeMunicipality.name}
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500">Концентрация</p>
                <p className="mt-1 text-base font-bold font-mono text-teal-800 tabular-nums">
                  {activeMunicipality.densityPer1000Km2.toFixed(2).replace('.', ',')}
                </p>
                <p className="text-[10px] text-slate-400">на 1 000 км²</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                  <Users className="w-3 h-3 text-teal-700" aria-hidden="true" />
                  <span>В реестре</span>
                </p>
                <p className="mt-1 text-base font-bold font-mono text-slate-900 tabular-nums">
                  {activeMunicipality.certifiedInRegistry} чел.
                </p>
                <p className="text-[10px] text-slate-400">
                  покрытие {activeMunicipality.coveragePct}%
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-red-700" aria-hidden="true" />
                  <span>Дефицит</span>
                </p>
                <p className="mt-1 text-base font-bold font-mono text-red-700 tabular-nums">
                  {activeMunicipality.deficit} чел.
                </p>
                <p className="text-[10px] text-slate-400">
                  спрос {activeMunicipality.estimatedDemand}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed pt-2 border-t border-slate-200">
              <strong className="font-semibold text-slate-900">Узлы и маршруты: </strong>
              {activeMunicipality.keyHubs} ({activeMunicipality.activeRoutesCount} активных
              маршрутов).
            </p>
          </div>

          {/* Ranked Municipal List */}
          <div className="border border-slate-200 rounded-xl overflow-hidden flex-1 flex flex-col">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex justify-between">
              <span>Муниципальное образование</span>
              <span>{activeMetricMeta.label}</span>
            </div>
            <div className="divide-y divide-slate-200 max-h-[250px] overflow-y-auto">
              {sortedMunicipalities.map((m) => {
                const isSelected = m.id === activeMunicipality.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onMouseEnter={() => setHoveredId(m.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => handleSelectMunicipality(m)}
                    className={`w-full px-4 py-2.5 text-left text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50/80 font-semibold text-slate-900'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="truncate">{m.shortName}</span>
                    <span className="font-mono tabular-nums text-slate-900 shrink-0">
                      {formatPrimoryeMetricValue(m, metric)}
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
