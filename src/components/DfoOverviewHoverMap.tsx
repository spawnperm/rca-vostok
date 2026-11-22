import React, { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, MapPin, Users } from 'lucide-react';
import { DFO_REGIONS_DISTRIBUTION, type DfoRegionDistribution } from '../data/researchData';
import { tracker } from '../utils/tracker';

interface RegionSessionScheduleInfo {
  nearestSessionDate: string;
  sessionType: string;
  venue: string;
}

const REGION_SESSION_SCHEDULE: Record<string, RegionSessionScheduleInfo> = {
  primorye: {
    nearestSessionDate: '14–19 декабря 2026',
    sessionType: 'Теория в ВВГУ (водный) · далее 16–18 апреля 2027 (1–4 КС)',
    venue: 'г. Владивосток (ВВГУ) + полигоны Шкотовского р-на',
  },
  kamchatka: {
    nearestSessionDate: 'Февраль–март 2027',
    sessionType: 'Межрегиональная комиссия РЦА · далее 14–16 мая 2027',
    venue: 'Приём документов дистанционно / сдача в ВВГУ и РЦА',
  },
  khabarovsk: {
    nearestSessionDate: 'Февраль–март 2027',
    sessionType: 'Выездная группа в РЦА · далее 16–18 апреля 2027',
    venue: 'Координация в Хабаровске + полигоны Приморья',
  },
  sakhalin: {
    nearestSessionDate: '16–18 апреля 2027',
    sessionType: 'Весенняя сессия (комбинированный профиль: пешка + вода)',
    venue: 'Выездное участие в весеннем потоке РЦА «Русский Восток»',
  },
  yakutia: {
    nearestSessionDate: '14–16 мая 2027',
    sessionType: 'Майская сессия (автономный и водный профиль 1–4 КС)',
    venue: 'Дистанционная сверка + очный экзамен на базе ВВГУ',
  },
  amur: {
    nearestSessionDate: '14–16 мая 2027',
    sessionType: 'Майская сессия (пешеходный и речной туризм 1–4 КС)',
    venue: 'Выездная аттестация на площадке РЦА «Русский Восток»',
  },
  'magadan-chukotka': {
    nearestSessionDate: '4–6 июня 2027',
    sessionType: 'Летняя предэкспедиционная сессия (1–4 КС)',
    venue: 'Межрегиональная комиссия ВВГУ и ФСТР',
  },
};

interface DfoOverviewHoverMapProps {
  onOpenMarket?: () => void;
}

export const DfoOverviewHoverMap: React.FC<DfoOverviewHoverMapProps> = ({ onOpenMarket }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>('primorye');

  const activeId = hoveredId ?? selectedId;
  const activeRegion: DfoRegionDistribution = useMemo(
    () => DFO_REGIONS_DISTRIBUTION.find((r) => r.id === activeId) ?? DFO_REGIONS_DISTRIBUTION[0],
    [activeId]
  );

  const hoveredRegion: DfoRegionDistribution | null = useMemo(
    () =>
      hoveredId ? DFO_REGIONS_DISTRIBUTION.find((r) => r.id === hoveredId) ?? null : null,
    [hoveredId]
  );

  const activeSession = REGION_SESSION_SCHEDULE[activeRegion.id];
  const hoveredSession = hoveredRegion ? REGION_SESSION_SCHEDULE[hoveredRegion.id] : null;

  const getRegionColor = (r: DfoRegionDistribution, isActive: boolean): string => {
    if (isActive) return '#CCFBF1';
    if (r.certifiedInRegistry >= 100) return '#F0FDFA';
    return '#FFFFFF';
  };

  const getBadgeColor = (r: DfoRegionDistribution): string => {
    if (r.certifiedInRegistry >= 100) return '#0F766E';
    if (r.certifiedInRegistry >= 30) return '#B45309';
    return '#475569';
  };

  return (
    <section
      aria-labelledby="overview-dfo-hover-map-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700">
            География ДФО и ближайшие потоки
          </p>
          <h2 id="overview-dfo-hover-map-heading" className="text-xl font-bold text-slate-900">
            Интерактивная карта ДФО: реестр проводников и даты сессий
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Наведите курсор на субъект Дальнего Востока, чтобы увидеть число аттестованных
            специалистов в федеральном реестре и ближайшие сроки аттестации.
          </p>
        </div>

        {onOpenMarket && (
          <button
            type="button"
            onClick={onOpenMarket}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Подробная карта и маршруты ДФО</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Compact SVG Map with Floating Hover Card (7 cols) */}
        <div className="lg:col-span-7 relative bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
          <div className="relative w-full">
            <svg
              viewBox="0 0 640 430"
              className="w-full max-h-[320px] h-auto mx-auto select-none"
              role="img"
              aria-label="Интерактивная карта ДФО с количеством аттестованных проводников и датами сессий"
            >
              <rect x="0" y="0" width="640" height="430" fill="#EFF6FF" rx="8" />

              <g stroke="#DCE7F3" strokeWidth="1" strokeDasharray="3 4">
                <line x1="0" y1="110" x2="640" y2="110" />
                <line x1="0" y1="220" x2="640" y2="220" />
                <line x1="0" y1="330" x2="640" y2="330" />
                <line x1="160" y1="0" x2="160" y2="430" />
                <line x1="320" y1="0" x2="320" y2="430" />
                <line x1="480" y1="0" x2="480" y2="430" />
              </g>

              {DFO_REGIONS_DISTRIBUTION.map((region) => {
                const isActive = region.id === activeRegion.id;
                return (
                  <path
                    key={region.id}
                    d={region.svgPath}
                    tabIndex={0}
                    role="button"
                    aria-label={`${region.name}: ${region.certifiedInRegistry} аттестовано, ближайшая сессия ${REGION_SESSION_SCHEDULE[region.id]?.nearestSessionDate ?? ''}`}
                    fill={getRegionColor(region, isActive)}
                    stroke={isActive ? '#0F766E' : '#94A3B8'}
                    strokeWidth={isActive ? 2.4 : 1.3}
                    strokeLinejoin="round"
                    onMouseEnter={() => {
                      setHoveredId(region.id);
                    }}
                    onMouseLeave={() =>
                      setHoveredId((prev) => (prev === region.id ? null : prev))
                    }
                    onFocus={() => setHoveredId(region.id)}
                    onBlur={() =>
                      setHoveredId((prev) => (prev === region.id ? null : prev))
                    }
                    onClick={() => {
                      setSelectedId(region.id);
                      tracker.trackCustomInteraction(
                        `Мини-карта ДФО: ${region.shortName}`,
                        REGION_SESSION_SCHEDULE[region.id]?.nearestSessionDate
                      );
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(region.id);
                      }
                    }}
                    className="transition-colors duration-150 cursor-pointer focus:outline-none"
                  />
                );
              })}

              {DFO_REGIONS_DISTRIBUTION.map((region) => {
                const isActive = region.id === activeRegion.id;
                const badgeColor = getBadgeColor(region);
                const radius = region.certifiedInRegistry >= 100 ? 15 : region.certifiedInRegistry >= 30 ? 12 : 10;

                return (
                  <g
                    key={`pin-${region.id}`}
                    className="pointer-events-none"
                  >
                    {isActive && (
                      <circle
                        cx={region.cx}
                        cy={region.cy}
                        r={radius + 4}
                        fill="none"
                        stroke="#0F172A"
                        strokeWidth={1.5}
                      />
                    )}
                    <circle
                      cx={region.cx}
                      cy={region.cy}
                      r={radius}
                      fill={badgeColor}
                      fillOpacity={0.92}
                      stroke="#FFFFFF"
                      strokeWidth={1.8}
                    />
                    <text
                      x={region.cx}
                      y={region.cy + 3.5}
                      textAnchor="middle"
                      className="fill-white text-[9.5px] font-mono font-bold"
                    >
                      {region.certifiedInRegistry}
                    </text>
                    <text
                      x={region.labelX}
                      y={region.labelY}
                      textAnchor={region.labelAnchor ?? 'start'}
                      className={`text-[10px] font-sans ${
                        isActive ? 'fill-slate-950 font-bold' : 'fill-slate-700 font-medium'
                      }`}
                    >
                      {region.shortName}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Floating Hover Tooltip */}
            {hoveredRegion && hoveredSession && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  left: `${Math.min(Math.max((hoveredRegion.cx / 640) * 100, 18), 72)}%`,
                  top: `${hoveredRegion.cy > 230 ? Math.max((hoveredRegion.cy / 430) * 100 - 28, 6) : Math.min((hoveredRegion.cy / 430) * 100 + 8, 62)}%`,
                }}
                className="hidden sm:block absolute z-20 -translate-x-1/2 w-64 p-3.5 rounded-lg bg-slate-900/95 text-white shadow-lg border border-slate-700 pointer-events-none"
              >
                <p className="text-xs font-bold text-white leading-snug">{hoveredRegion.name}</p>
                <div className="mt-2 space-y-1.5 text-[11px]">
                  <p className="flex items-center justify-between gap-2 text-slate-200">
                    <span>Аттестовано в реестре:</span>
                    <span className="font-mono font-bold text-teal-300 tabular-nums">
                      {hoveredRegion.certifiedInRegistry} чел.
                    </span>
                  </p>
                  {hoveredRegion.october2026Certified > 0 && (
                    <p className="flex items-center justify-between gap-2 text-slate-300">
                      <span>Выпуск РЦА (окт. 2026):</span>
                      <span className="font-mono font-semibold text-teal-300 tabular-nums">
                        +{hoveredRegion.october2026Certified} чел.
                      </span>
                    </p>
                  )}
                  <div className="pt-1.5 border-t border-slate-700/80">
                    <p className="text-slate-400">Ближайшая сессия:</p>
                    <p className="font-mono font-semibold text-amber-300 mt-0.5">
                      {hoveredSession.nearestSessionDate}
                    </p>
                    <p className="text-slate-300 leading-snug mt-0.5">
                      {hoveredSession.sessionType}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 mt-2 border-t border-slate-200 text-[11px] text-slate-500">
            <span>Число на маркере — количество аттестованных проводников в реестре</span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-teal-700" aria-hidden="true" />
                &ge; 100
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-700" aria-hidden="true" />
                30–99
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-600" aria-hidden="true" />
                &lt; 30
              </span>
            </div>
          </div>
        </div>

        {/* Active Region Card + Quick List (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium text-teal-700 inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" aria-hidden="true" />
                  <span>{activeRegion.statusLabel}</span>
                </p>
                <h3 className="mt-1 text-base font-bold text-slate-900">{activeRegion.name}</h3>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                  <Users className="w-3 h-3 text-teal-700" aria-hidden="true" />
                  <span>В реестре</span>
                </p>
                <p className="mt-1 text-lg font-bold font-mono text-teal-800 tabular-nums">
                  {activeRegion.certifiedInRegistry} чел.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                  <CalendarDays className="w-3 h-3 text-amber-700" aria-hidden="true" />
                  <span>Ближайшая сессия</span>
                </p>
                <p className="mt-1 text-xs font-bold font-mono text-slate-900 leading-snug">
                  {activeSession?.nearestSessionDate ?? 'Уточняется'}
                </p>
              </div>
            </div>

            {activeSession && (
              <div className="text-xs text-slate-700 space-y-1 pt-2 border-t border-slate-200">
                <p className="font-medium text-slate-900">{activeSession.sessionType}</p>
                <p className="text-slate-600">{activeSession.venue}</p>
              </div>
            )}
          </div>

          {/* Compact Region Selector List */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 flex justify-between">
              <span>Субъект ДФО</span>
              <span>Реестр · Сессия</span>
            </div>
            <div className="divide-y divide-slate-200 max-h-[168px] overflow-y-auto">
              {DFO_REGIONS_DISTRIBUTION.map((r) => {
                const isActive = r.id === activeRegion.id;
                const info = REGION_SESSION_SCHEDULE[r.id];
                return (
                  <button
                    key={r.id}
                    type="button"
                    onMouseEnter={() => setHoveredId(r.id)}
                    onMouseLeave={() => setHoveredId((prev) => (prev === r.id ? null : prev))}
                    onClick={() => {
                      setSelectedId(r.id);
                      tracker.trackCustomInteraction(`Мини-карта ДФО: ${r.shortName}`);
                    }}
                    className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-teal-50/80 font-semibold text-slate-900'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="truncate">{r.shortName}</span>
                    <span className="font-mono text-[11px] text-slate-600 tabular-nums shrink-0">
                      <span className="text-teal-800 font-semibold">{r.certifiedInRegistry}</span> ·{' '}
                      {info?.nearestSessionDate}
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
