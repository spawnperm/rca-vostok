import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CalendarDays,
  Compass,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { DFO_REGIONS_DISTRIBUTION } from '../data/researchData';
import {
  DFO_ATTESTATION_POINTS,
  filterAttestationPoints,
  type AttestationPointExpertGroup,
} from '../data/dfoOverviewRegistryData';
import { tracker } from '../utils/tracker';

interface DfoAttestationPointsWidgetProps {
  onContactCurator: (sourceLabel: string) => void;
}

const HQ_POINT = { x: 336, y: 382 };

const POINT_KIND_COLOR: Record<AttestationPointExpertGroup['pointKind'], string> = {
  headquarters: '#14B8A6', // teal-500
  field_polygon: '#F59E0B', // amber-500
  regional_point: '#38BDF8', // sky-400
};

export const DfoAttestationPointsWidget: React.FC<DfoAttestationPointsWidgetProps> = ({
  onContactCurator,
}) => {
  const [kindFilter, setKindFilter] = useState<'all' | AttestationPointExpertGroup['pointKind']>(
    'all'
  );
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [modalPoint, setModalPoint] = useState<AttestationPointExpertGroup | null>(null);

  const visiblePoints = useMemo(() => filterAttestationPoints(kindFilter), [kindFilter]);

  useEffect(() => {
    if (!modalPoint) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setModalPoint(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalPoint]);

  const handleOpenPointModal = (point: AttestationPointExpertGroup) => {
    setModalPoint(point);
    tracker.trackCustomInteraction(
      `Точка аттестации ДФО: ${point.shortName}`,
      point.expertGroup.groupCode
    );
  };

  const hoveredPoint = useMemo(
    () => DFO_ATTESTATION_POINTS.find((p) => p.id === hoveredPointId) ?? null,
    [hoveredPointId]
  );

  return (
    <section
      aria-labelledby="dfo-attestation-points-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header & Filter */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Карта ключевых экзаменационных площадок и полигонов</span>
          </p>
          <h2 id="dfo-attestation-points-heading" className="text-xl font-bold text-slate-900">
            Ключевые точки аттестации в регионах ДФО и экспертные группы
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Нажмите на любую отмеченную точку аттестации на карте или в перечне площадок, чтобы
            открыть всплывающее окно с составом экспертной группы, проверяемыми дисциплинами и
            графиком ближайших испытаний.
          </p>
        </div>

        <div
          role="group"
          aria-label="Фильтр типов точек аттестации"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {(
            [
              { id: 'all', label: `Все точки (${DFO_ATTESTATION_POINTS.length})` },
              { id: 'headquarters', label: 'Головной центр' },
              { id: 'field_polygon', label: 'Полевые полигоны' },
              { id: 'regional_point', label: 'Региональные пункты' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setKindFilter(tab.id);
                tracker.trackCustomInteraction(`Фильтр точек аттестации: ${tab.label}`);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                kindFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Layout: Dark Cartographic Coordinate Map + Quick Point Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Map Canvas (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-300 border-b border-slate-800 pb-3">
            <span>Клик по точке открывает карточку экспертной группы</span>
            <div className="flex flex-wrap items-center gap-3.5">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500" aria-hidden="true" />
                ВВГУ (центр)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" aria-hidden="true" />
                Полигон
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" aria-hidden="true" />
                Точка ДФО
              </span>
            </div>
          </div>

          <div className="relative w-full">
            <svg
              viewBox="0 0 640 430"
              className="w-full max-h-[380px] h-auto mx-auto select-none"
              role="img"
              aria-label="Интерактивная карта ключевых точек аттестации инструкторов-проводников в ДФО"
            >
              <rect x="0" y="0" width="640" height="430" fill="#0F172A" rx="8" />

              {/* Coordinate Grid */}
              <g stroke="#1E293B" strokeWidth="1" strokeDasharray="3 4">
                <line x1="0" y1="110" x2="640" y2="110" />
                <line x1="0" y1="220" x2="640" y2="220" />
                <line x1="0" y1="330" x2="640" y2="330" />
                <line x1="160" y1="0" x2="160" y2="430" />
                <line x1="320" y1="0" x2="320" y2="430" />
                <line x1="480" y1="0" x2="480" y2="430" />
              </g>

              {/* Subtle DFO Region Contours */}
              {DFO_REGIONS_DISTRIBUTION.map((region) => (
                <path
                  key={`ap-bg-${region.id}`}
                  d={region.svgPath}
                  fill="#1E293B"
                  fillOpacity={0.72}
                  stroke="#334155"
                  strokeWidth={1.2}
                  strokeLinejoin="round"
                />
              ))}

              {/* Connection Arcs to Vladivostok HQ */}
              <g fill="none">
                {visiblePoints
                  .filter((p) => p.id !== 'ap-vladivostok-vvgu')
                  .map((pt) => {
                    const isActive = pt.id === hoveredPointId || pt.id === modalPoint?.id;
                    const midX = (HQ_POINT.x + pt.x) / 2 - (pt.y < 260 ? 24 : 8);
                    const midY = (HQ_POINT.y + pt.y) / 2 + (pt.x > 400 ? 16 : -10);
                    return (
                      <path
                        key={`ap-arc-${pt.id}`}
                        d={`M ${HQ_POINT.x},${HQ_POINT.y} Q ${midX},${midY} ${pt.x},${pt.y}`}
                        stroke={isActive ? POINT_KIND_COLOR[pt.pointKind] : '#475569'}
                        strokeWidth={isActive ? 2.2 : 1.1}
                        strokeDasharray={isActive ? undefined : '4 4'}
                        strokeOpacity={isActive ? 0.95 : 0.5}
                      />
                    );
                  })}
              </g>

              {/* Clickable Attestation Point Pins */}
              {visiblePoints.map((pt) => {
                const isHovered = pt.id === hoveredPointId;
                const isModalOpen = pt.id === modalPoint?.id;
                const color = POINT_KIND_COLOR[pt.pointKind];

                return (
                  <g
                    key={pt.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`${pt.pointName} — открыть окно с информацией об экспертной группе ${pt.expertGroup.groupCode}`}
                    onClick={() => handleOpenPointModal(pt)}
                    onMouseEnter={() => setHoveredPointId(pt.id)}
                    onMouseLeave={() =>
                      setHoveredPointId((prev) => (prev === pt.id ? null : prev))
                    }
                    onFocus={() => setHoveredPointId(pt.id)}
                    onBlur={() =>
                      setHoveredPointId((prev) => (prev === pt.id ? null : prev))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenPointModal(pt);
                      }
                    }}
                    className="cursor-pointer focus:outline-none"
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered || isModalOpen ? 16 : 12}
                      fill={color}
                      fillOpacity={0.22}
                    />
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={pt.pointKind === 'headquarters' ? 8.5 : 6.5}
                      fill={color}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    />
                    <text
                      x={pt.x + pt.labelDx}
                      y={pt.y + pt.labelDy}
                      textAnchor={pt.labelAnchor}
                      className={`text-[10px] font-sans pointer-events-none ${
                        isHovered || isModalOpen
                          ? 'fill-white font-bold'
                          : 'fill-slate-200 font-medium'
                      }`}
                    >
                      {pt.shortName}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Preview Chip */}
            {hoveredPoint && (
              <div
                role="status"
                className="hidden sm:block absolute bottom-3 left-3 z-10 max-w-xs bg-slate-950/95 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white shadow-lg pointer-events-none"
              >
                <p className="text-[10px] font-mono text-teal-300">
                  {hoveredPoint.expertGroup.groupCode}
                </p>
                <p className="text-xs font-bold mt-0.5 leading-snug">{hoveredPoint.pointName}</p>
                <p className="text-[11px] text-slate-300 mt-1">
                  Председатель / куратор: {hoveredPoint.expertGroup.chairName}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Directory of Attestation Points (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-3">
          <div className="text-xs font-semibold text-slate-600 flex items-center justify-between px-1">
            <span>Точки проведения экзамена и полигоны</span>
            <span className="font-mono text-slate-500 tabular-nums">
              {visiblePoints.length} из {DFO_ATTESTATION_POINTS.length}
            </span>
          </div>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/40 max-h-[405px] overflow-y-auto">
            {visiblePoints.map((pt) => (
              <button
                key={pt.id}
                type="button"
                onClick={() => handleOpenPointModal(pt)}
                onMouseEnter={() => setHoveredPointId(pt.id)}
                onMouseLeave={() =>
                  setHoveredPointId((prev) => (prev === pt.id ? null : prev))
                }
                className="w-full p-4 text-left hover:bg-teal-50/60 transition-colors flex items-start justify-between gap-3 cursor-pointer"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: POINT_KIND_COLOR[pt.pointKind] }}
                      aria-hidden="true"
                    />
                    <span className="text-[11px] font-mono font-semibold text-teal-800">
                      {pt.expertGroup.groupCode}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 leading-snug">
                    {pt.pointName}
                  </p>
                  <p className="text-xs text-slate-600">
                    Эксперты ({pt.expertGroup.experts.length} чел.) · Старший:{' '}
                    <span className="font-medium text-slate-800">{pt.expertGroup.chairName}</span>
                  </p>
                </div>

                <span className="px-2.5 py-1 text-[11px] font-semibold text-teal-800 bg-white border border-teal-200 rounded-md shrink-0 whitespace-nowrap">
                  Эксперты
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Expert Group Popup Modal Window */}
      {modalPoint && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModalPoint(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="attestation-point-modal-title"
            className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="px-6 py-5 bg-slate-900 text-white flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-teal-800/80 text-teal-200 font-mono font-semibold">
                    {modalPoint.expertGroup.groupCode}
                  </span>
                  <span className="text-slate-300">{modalPoint.pointKindLabel}</span>
                </div>
                <h3
                  id="attestation-point-modal-title"
                  className="text-lg font-bold text-white leading-snug"
                >
                  {modalPoint.pointName}
                </h3>
                <p className="text-xs text-slate-300 inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" aria-hidden="true" />
                  <span>
                    {modalPoint.regionName} · {modalPoint.venue}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalPoint(null)}
                aria-label="Закрыть окно экспертной группы"
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Expert Group Chair Banner */}
              <div className="bg-teal-50/70 border border-teal-200 rounded-lg p-4 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-800 inline-flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{modalPoint.expertGroup.groupTitle}</span>
                </p>
                <p className="text-sm font-bold text-slate-900">
                  Руководитель группы: {modalPoint.expertGroup.chairName}
                </p>
                <p className="text-xs text-slate-700">{modalPoint.expertGroup.chairRole}</p>
              </div>

              {/* Expert Members List */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 inline-flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>Состав экспертной группы ({modalPoint.expertGroup.experts.length})</span>
                </p>

                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                  {modalPoint.expertGroup.experts.map((expert) => (
                    <div key={expert.name} className="p-3.5 space-y-1 bg-white first:rounded-t-lg last:rounded-b-lg">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900">{expert.name}</p>
                        <span className="text-[11px] font-mono text-teal-800">
                          {expert.credential}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{expert.focus}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Disciplines & Schedule */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Принимаемые профили и КС
                  </p>
                  <ul className="space-y-1 text-xs text-slate-800">
                    {modalPoint.expertGroup.disciplines.map((d) => (
                      <li key={d} className="flex items-start gap-1.5">
                        <ShieldCheck
                          className="w-3.5 h-3.5 text-teal-700 mt-0.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5 text-xs">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                      <span>Ближайшее окно экзаменов</span>
                    </p>
                    <p className="mt-1 font-mono font-semibold text-slate-900">
                      {modalPoint.expertGroup.nextExamWindow}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-slate-500">Формат и вместимость</p>
                    <p className="mt-0.5 text-slate-800 leading-relaxed">
                      {modalPoint.expertGroup.capacityNote}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 border-t border-slate-200 pt-3">
                Регламент оценки: {modalPoint.expertGroup.protocolStandard}
              </p>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const label = `Экспертная группа ${modalPoint.expertGroup.groupCode} (${modalPoint.shortName})`;
                  setModalPoint(null);
                  onContactCurator(label);
                }}
                className="px-4 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Задать вопрос экспертной группе</span>
              </button>

              <button
                type="button"
                onClick={() => setModalPoint(null)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Закрыть окно
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
