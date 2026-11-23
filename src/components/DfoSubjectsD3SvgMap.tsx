import React, { useMemo, useState } from 'react';
import { Award, MapPin, ShieldAlert, TrendingUp, Users } from 'lucide-react';
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

export const DfoSubjectsD3SvgMap: React.FC = () => {
  const [metricMode, setMetricMode] = useState<DfoD3MetricMode>('registry');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('primorye');
  const [hoveredSubjectId, setHoveredSubjectId] = useState<string | null>(null);
  const [hoverPointer, setHoverPointer] = useState<{ xPct: number; yPct: number } | null>(null);

  const layout = useMemo(() => buildDfoD3MapLayout(760, 480), []);

  const colorScale = useMemo(
    () => createDfoD3ColorScale(layout.subjects, metricMode),
    [layout.subjects, metricMode]
  );

  const radiusScale = useMemo(
    () => createDfoD3RadiusScale(layout.subjects, metricMode),
    [layout.subjects, metricMode]
  );

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
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const rawX = ((event.clientX - rect.left) / rect.width) * 100;
    const rawY = ((event.clientY - rect.top) / rect.height) * 100;
    setHoverPointer({
      xPct: Math.max(12, Math.min(72, rawX)),
      yPct: Math.max(8, Math.min(68, rawY)),
    });
  };

  const handleFocusOrHoverSubject = (subject: DfoProjectedSubject) => {
    setHoveredSubjectId(subject.id);
    setHoverPointer({
      xPct: Math.max(10, Math.min(68, (subject.centroid[0] / layout.width) * 100)),
      yPct: Math.max(8, Math.min(64, (subject.centroid[1] / layout.height) * 100)),
    });
  };

  const handleSelectSubject = (subject: DfoProjectedSubject) => {
    setSelectedSubjectId(subject.id);
    tracker.trackCustomInteraction(`D3-карта ДФО: ${subject.shortName}`, 'market');
  };

  return (
    <section
      id="dfo-d3-subjects-map"
      aria-labelledby="dfo-d3-map-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 scroll-mt-24"
    >
      {/* Header & Metric Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-teal-700">
            <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Интерактивная SVG-картография на базе D3.js (проекция d3.geoConicEqualArea)</span>
          </div>
          <h2 id="dfo-d3-map-heading" className="text-xl font-bold text-slate-900">
            Субъекты Дальневосточного федерального округа: статистика аттестованных инструкторов
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Наведите курсор на любой регион ДФО (или выберите строку в рейтинге), чтобы увидеть
            число инструкторов в ЕФРТА, расчётную потребность, дефицит и долю в округе.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Режим окраски D3-карты ДФО"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start lg:self-auto"
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

      {/* Main Split: D3 SVG Canvas (8 cols) + Live Subject Inspector (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left D3 Canvas */}
        <div className="lg:col-span-8 bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-4 relative">
          {/* Scale Legend Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 pb-3 border-b border-slate-200">
            <span>
              Всего по ДФО в реестре:{' '}
              <strong className="font-mono text-slate-900 tabular-nums">
                {layout.totalRegistry.toLocaleString('ru-RU')} чел.
              </strong>{' '}
              · Спрос:{' '}
              <strong className="font-mono text-slate-900 tabular-nums">
                {layout.totalDemand.toLocaleString('ru-RU')} чел.
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

          {/* Relative Map + Hover Tooltip Container */}
          <div className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-sky-50/60">
            <svg
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              onMouseMove={handleSvgMouseMove}
              onMouseLeave={() => {
                setHoveredSubjectId(null);
                setHoverPointer(null);
              }}
              className="w-full h-auto block select-none"
              role="img"
              aria-label="Интерактивная SVG-карта субъектов ДФО на библиотеке D3.js"
            >
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
                    <path
                      key={subject.id}
                      d={subject.pathData}
                      fill={fillColor}
                      fillOpacity={isHovered ? 0.96 : 0.86}
                      stroke={isHovered || isSelected ? '#0F172A' : '#475569'}
                      strokeWidth={isHovered ? 2.4 : isSelected ? 1.9 : 1.0}
                      strokeLinejoin="round"
                      tabIndex={0}
                      role="button"
                      aria-label={`${subject.name}: в реестре ${subject.certifiedInRegistry} чел., потребность ${subject.estimatedDemand} чел.`}
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
                      className="cursor-pointer transition-opacity duration-150 focus:outline-none"
                    />
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
                          r={radius + 4}
                          fill="none"
                          stroke="#0F172A"
                          strokeWidth={1.6}
                        />
                      )}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill={metricMode === 'deficit' ? '#991B1B' : '#0F172A'}
                        fillOpacity={0.85}
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
                          stroke: 'rgba(255, 255, 255, 0.9)',
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

            {/* Interactive Hover Tooltip Card */}
            {hoveredSubject && hoverPointer && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  left: `${hoverPointer.xPct}%`,
                  top: `${hoverPointer.yPct}%`,
                }}
                className="pointer-events-none absolute z-20 w-64 bg-slate-900/95 text-white border border-slate-700 rounded-xl shadow-lg p-3.5 space-y-2 text-xs transition-opacity duration-100"
              >
                <div className="space-y-0.5 border-b border-slate-700 pb-2">
                  <p className="font-bold text-sm text-white leading-snug">
                    {hoveredSubject.name}
                  </p>
                  <p className="text-[11px] text-teal-300 leading-snug">
                    {hoveredSubject.statusLabel}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono tabular-nums">
                  <div>
                    <p className="text-[10px] text-slate-400 font-sans">В реестре ЕФРТА</p>
                    <p className="font-bold text-teal-300">
                      {hoveredSubject.certifiedInRegistry.toLocaleString('ru-RU')} чел.
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-sans">Расчётный спрос</p>
                    <p className="font-bold text-white">
                      {hoveredSubject.estimatedDemand.toLocaleString('ru-RU')} чел.
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-sans">Дефицит кадров</p>
                    <p className="font-bold text-amber-300">
                      −{hoveredSubject.deficit.toLocaleString('ru-RU')} чел.
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-sans">Обеспеченность</p>
                    <p className="font-bold text-white">{hoveredSubject.coveragePct.toFixed(1)}%</p>
                  </div>
                </div>

                {hoveredSubject.october2026Certified > 0 && (
                  <p className="text-[11px] text-emerald-300 pt-1 border-t border-slate-700 font-mono tabular-nums">
                    Окт. 2026 (РЦА): +{hoveredSubject.october2026Certified} аттестованных
                  </p>
                )}
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-500">
            Проекция D3.js: коническая равновеликая (`d3.geoConicEqualArea`) с масштабированием
            маркеров через `d3.scaleSqrt`. Нажмите на субъект для фиксации карточки справа.
          </p>
        </div>

        {/* Right Live Statistical Panel (4 cols) */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="space-y-1 border-b border-slate-200 pb-3">
              <p className="text-[11px] font-semibold text-teal-700">
                {hoveredSubject ? 'Данные при наведении' : 'Выбранный субъект ДФО'}
              </p>
              <h3 className="text-base font-bold text-slate-900">{activeSubject.name}</h3>
              <p className="text-xs text-slate-600">{activeSubject.statusLabel}</p>
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

            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3">
              {activeSubject.note}
            </p>
          </div>

          {/* Quick clickable ranking list */}
          <div className="space-y-1.5 pt-3 border-t border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500">
              Быстрый выбор субъекта ({activeMetricMeta.label}):
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
