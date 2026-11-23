import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, Layers, MapPin, Route, UserCheck } from 'lucide-react';
import { PRIMORYE_DISTRICTS, type DistrictActivity } from '../data/researchData';
import {
  PRIMORYE_ROUTE_CORRIDORS,
  getRouteMarkerOffset,
  summarizePrimoryeLayers,
  type PrimoryeLayerVisibility,
  type PrimoryeMapLayerId,
} from '../utils/primoryeMapLayers';
import { tracker } from '../utils/tracker';

type ActivityLevelFilter = 'all' | DistrictActivity['activityLevel'];

export const PrimoryeActivityMap: React.FC = () => {
  const [profileFilter, setProfileFilter] = useState<'all' | 'hiking' | 'water' | 'expedition'>(
    'all'
  );
  const [levelFilter, setLevelFilter] = useState<ActivityLevelFilter>('all');
  const [layers, setLayers] = useState<PrimoryeLayerVisibility>({
    instructors: true,
    routes: true,
  });
  const [selectedId, setSelectedId] = useState<string>(PRIMORYE_DISTRICTS[0].id);

  const visibleDistricts = useMemo(() => {
    return PRIMORYE_DISTRICTS.filter((d) => {
      if (profileFilter !== 'all' && d.profile !== profileFilter) return false;
      if (levelFilter !== 'all' && d.activityLevel !== levelFilter) return false;
      return true;
    });
  }, [profileFilter, levelFilter]);

  const activeDistrict: DistrictActivity =
    visibleDistricts.find((d) => d.id === selectedId) ??
    visibleDistricts[0] ??
    PRIMORYE_DISTRICTS[0];

  const layerSummary = useMemo(
    () =>
      summarizePrimoryeLayers(
        visibleDistricts.length > 0 ? visibleDistricts : PRIMORYE_DISTRICTS
      ),
    [visibleDistricts]
  );

  const districtById = useMemo(
    () => new Map(PRIMORYE_DISTRICTS.map((d) => [d.id, d] as const)),
    []
  );

  const handleSelectDistrict = (d: DistrictActivity) => {
    setSelectedId(d.id);
    tracker.trackCustomInteraction(`Карта Приморья: ${d.shortName}`, d.profileLabel);
  };

  const handleToggleLayer = (layerId: PrimoryeMapLayerId) => {
    setLayers((prev) => {
      const nextValue = !prev[layerId];
      tracker.trackCustomInteraction(
        `Легенда карты Приморья: ${layerId === 'instructors' ? 'Инструкторы' : 'Маршруты'}`,
        nextValue ? 'Включено' : 'Скрыто'
      );
      return { ...prev, [layerId]: nextValue };
    });
  };

  const getLevelColor = (level: DistrictActivity['activityLevel']) => {
    if (level === 'высокая') return '#0F766E';
    if (level === 'растущая') return '#B45309';
    return '#475569';
  };

  const coveragePct = Math.min(
    Math.round(
      (activeDistrict.certifiedInRegistry / Math.max(activeDistrict.estimatedDemand, 1)) * 100
    ),
    100
  );

  const bothLayersHidden = !layers.instructors && !layers.routes;

  return (
    <section
      aria-labelledby="primorye-activity-map-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-teal-700">Пространственное распределение</p>
          <h2
            id="primorye-activity-map-heading"
            className="mt-1 text-xl font-bold text-slate-900"
          >
            Интерактивная карта активности проводников и маршрутов Приморского края
          </h2>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(
            [
              { id: 'all', label: 'Все профили (8)' },
              { id: 'hiking', label: 'Пешеходный и ООПТ' },
              { id: 'water', label: 'Водный и глэмпинги' },
              { id: 'expedition', label: 'Экспедиционный' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setProfileFilter(f.id);
                tracker.trackCustomInteraction(`Фильтр карты: ${f.label}`);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                profileFilter === f.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Layer & Intensity Legend Bar */}
      <div
        role="region"
        aria-label="Интерактивная легенда слоёв карты Приморского края"
        className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 mr-1">
            <Layers className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
            <span>Слои карты:</span>
          </span>

          <button
            type="button"
            aria-pressed={layers.instructors}
            onClick={() => handleToggleLayer('instructors')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              layers.instructors
                ? 'bg-white border-teal-600 text-slate-900 shadow-xs'
                : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800'
            }`}
          >
            <span
              className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                layers.instructors
                  ? 'bg-teal-700 border-teal-200'
                  : 'bg-slate-300 border-slate-200'
              }`}
              aria-hidden="true"
            />
            <UserCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Аттестованные инструкторы</span>
            <span className="font-mono text-[11px] tabular-nums text-slate-500">
              ({layerSummary.totalCertifiedInstructors} чел.)
            </span>
            {layers.instructors ? (
              <Eye className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            aria-pressed={layers.routes}
            onClick={() => handleToggleLayer('routes')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              layers.routes
                ? 'bg-white border-sky-600 text-slate-900 shadow-xs'
                : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800'
            }`}
          >
            <span
              className={`w-4 h-0.5 border-t-2 border-dashed shrink-0 ${
                layers.routes ? 'border-sky-600' : 'border-slate-400'
              }`}
              aria-hidden="true"
            />
            <Route className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Туристические маршруты</span>
            <span className="font-mono text-[11px] tabular-nums text-slate-500">
              ({layerSummary.totalActiveRoutes} м.)
            </span>
            {layers.routes ? (
              <Eye className="w-3.5 h-3.5 text-sky-700 shrink-0" aria-hidden="true" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Interactive Activity Level Filter inside Legend */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 mr-1">Активность:</span>
          {(
            [
              { id: 'all', label: 'Все', dotClass: 'bg-slate-400' },
              { id: 'высокая', label: 'Высокая', dotClass: 'bg-teal-700' },
              { id: 'растущая', label: 'Растущая', dotClass: 'bg-amber-700' },
              { id: 'умеренная', label: 'Экспедиционная', dotClass: 'bg-slate-600' },
            ] as const
          ).map((lvl) => {
            const active = levelFilter === lvl.id;
            return (
              <button
                key={lvl.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setLevelFilter(lvl.id);
                  tracker.trackCustomInteraction('Легенда Приморья: активность', lvl.label);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900 font-medium'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${lvl.dotClass}`} aria-hidden="true" />
                <span>{lvl.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* SVG Map Canvas */}
        <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pb-3 border-b border-slate-200">
            <span>Нажмите на округ для детального баланса кадров и маршрутов</span>
            <span className="font-mono tabular-nums text-slate-600">
              Активно слоёв: {Number(layers.instructors) + Number(layers.routes)} из 2
            </span>
          </div>

          <div className="w-full py-2 relative">
            <svg
              viewBox="0 0 460 515"
              className="w-full max-h-[430px] h-auto mx-auto select-none"
              role="img"
              aria-label="Интерактивная карта инструкторов и туристических маршрутов по районам Приморского края"
            >
              {/* Sea of Japan background tint */}
              <rect x="0" y="0" width="460" height="515" fill="#F1F5F9" rx="8" />

              {/* Primorsky Krai Stylized Geographic Polygon */}
              <path
                d="M 218,36 L 265,24 L 318,34 L 372,72 L 408,118 L 385,172 L 352,226 L 336,278 L 314,335 L 285,392 L 245,436 L 208,448 L 178,434 L 154,454 L 136,442 L 122,468 L 95,492 L 76,482 L 88,440 L 106,392 L 102,340 L 116,292 L 138,248 L 155,198 L 166,142 L 194,84 Z"
                fill="#FFFFFF"
                stroke="#94A3B8"
                strokeWidth="2"
              />

              {/* Lake Khanka */}
              <path
                d="M 108,295 C 122,286 138,298 134,322 C 130,342 114,344 106,326 Z"
                fill="#DBEAFE"
                stroke="#93C5FD"
                strokeWidth="1.2"
              />
              <text x="86" y="318" className="fill-slate-400 text-[9px] font-mono">
                оз. Ханка
              </text>

              {/* Sikhote-Alin mountain ridge schematic line */}
              <path
                d="M 262,70 Q 275,180 250,275 T 215,400"
                fill="none"
                stroke="#CBD5E1"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />

              {/* Sea Label */}
              <text x="342" y="405" className="fill-slate-400 text-[11px] font-serif italic">
                Японское море
              </text>
              <text x="155" y="488" className="fill-slate-400 text-[9px] font-mono">
                зал. Петра Великого
              </text>

              {/* Layer 2: Tourist Routes Corridors */}
              {layers.routes &&
                PRIMORYE_ROUTE_CORRIDORS.map((corridor) => {
                  const from = districtById.get(corridor.fromId);
                  const to = districtById.get(corridor.toId);
                  if (!from || !to) return null;
                  const fromVisible = visibleDistricts.some((vd) => vd.id === from.id);
                  const toVisible = visibleDistricts.some((vd) => vd.id === to.id);
                  const highlighted =
                    from.id === activeDistrict.id || to.id === activeDistrict.id;

                  return (
                    <g key={corridor.id}>
                      <title>{`${corridor.name}: ${corridor.routesCount} маршрутов (${corridor.categoryLabel})`}</title>
                      <line
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke={highlighted ? '#0369A1' : '#0284C7'}
                        strokeWidth={highlighted ? 2.8 : 2}
                        strokeDasharray="6 4"
                        strokeOpacity={fromVisible && toVisible ? (highlighted ? 0.92 : 0.6) : 0.2}
                      />
                    </g>
                  );
                })}

              {/* District Nodes */}
              {PRIMORYE_DISTRICTS.map((d) => {
                const isVisible = visibleDistricts.some((vd) => vd.id === d.id);
                const isSelected = d.id === activeDistrict.id;
                const fill = getLevelColor(d.activityLevel);
                const radius = Math.max(
                  8,
                  Math.min(18, Math.round(Math.sqrt(d.estimatedDemand) * 0.72))
                );
                const routeOffset = layers.instructors
                  ? getRouteMarkerOffset(d.id)
                  : { dx: 0, dy: 0 };

                return (
                  <g
                    key={d.id}
                    onClick={() => handleSelectDistrict(d)}
                    className={isVisible ? 'cursor-pointer' : 'opacity-25 cursor-pointer'}
                  >
                    <title>
                      {`${d.name} · В реестре: ${d.certifiedInRegistry} чел. · Потребность: ${d.estimatedDemand} чел. · Маршрутов: ${d.activeRoutesCount}`}
                    </title>

                    {/* Base clickable anchor dot when instructor layer is off */}
                    {!layers.instructors && layers.routes && (
                      <circle
                        cx={d.x}
                        cy={d.y}
                        r={isSelected ? 4.5 : 3}
                        fill="#0F172A"
                        fillOpacity={0.35}
                      />
                    )}

                    {/* Layer 1: Certified Instructors */}
                    {layers.instructors && (
                      <>
                        <circle
                          cx={d.x}
                          cy={d.y}
                          r={radius + (isSelected ? 5 : 2)}
                          fill={fill}
                          fillOpacity={isSelected ? 0.22 : 0.12}
                          stroke={isSelected ? '#0F172A' : 'none'}
                          strokeWidth={isSelected ? 1.5 : 0}
                        />
                        <circle
                          cx={d.x}
                          cy={d.y}
                          r={isSelected ? 7.5 : 5.5}
                          fill={fill}
                          stroke="#FFFFFF"
                          strokeWidth={1.8}
                        />
                      </>
                    )}

                    {/* Layer 2: Tourist Routes Hub Marker */}
                    {layers.routes && (
                      <g
                        transform={`translate(${d.x + routeOffset.dx}, ${d.y + routeOffset.dy})`}
                      >
                        <rect
                          x={-9}
                          y={-7}
                          width={18}
                          height={14}
                          rx={3}
                          fill={isSelected ? '#0369A1' : '#E0F2FE'}
                          stroke={isSelected ? '#FFFFFF' : '#0284C7'}
                          strokeWidth={1.3}
                        />
                        <text
                          x={0}
                          y={3.5}
                          textAnchor="middle"
                          className={`text-[8.5px] font-mono font-bold ${
                            isSelected ? 'fill-white' : 'fill-sky-900'
                          }`}
                        >
                          {d.activeRoutesCount}
                        </text>
                      </g>
                    )}

                    {/* District Name Label */}
                    {(!bothLayersHidden || isSelected) && (
                      <text
                        x={d.x + (d.id === 'khasan' || d.id === 'vladivostok' ? -10 : 12)}
                        y={d.y + (d.id === 'khasan' ? -12 : 4)}
                        textAnchor={
                          d.id === 'khasan' || d.id === 'vladivostok' ? 'end' : 'start'
                        }
                        className={`text-[10.5px] font-sans ${
                          isSelected ? 'fill-slate-950 font-bold' : 'fill-slate-700 font-medium'
                        }`}
                      >
                        {d.shortName}
                        {layers.instructors ? ` (${d.certifiedInRegistry})` : ''}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {bothLayersHidden && (
              <div className="absolute inset-4 bg-white/90 border border-slate-200 rounded-lg flex flex-col items-center justify-center p-6 text-center gap-3">
                <p className="text-sm font-semibold text-slate-900">
                  Оба слоя карты временно скрыты
                </p>
                <p className="text-xs text-slate-600 max-w-sm">
                  Включите отображение аттестованных инструкторов или туристических маршрутов в
                  интерактивной легенде над картой.
                </p>
                <button
                  type="button"
                  onClick={() => setLayers({ instructors: true, routes: true })}
                  className="px-4 py-2 text-xs font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 transition-colors cursor-pointer"
                >
                  Показать оба слоя
                </button>
              </div>
            )}
          </div>
        </div>

        {/* District Detail Inspector & List */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>{activeDistrict.profileLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>Активность: {activeDistrict.activityLevel}</span>
                </div>
                <h3 className="mt-1.5 text-lg font-bold text-slate-900">{activeDistrict.name}</h3>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1">
              <div
                className={`bg-white border rounded-lg p-3 ${
                  layers.instructors ? 'border-teal-300' : 'border-slate-200 opacity-75'
                }`}
              >
                <p className="text-[11px] text-slate-500">В реестре</p>
                <p className="mt-1 text-lg font-bold font-mono text-red-700 tabular-nums">
                  {activeDistrict.certifiedInRegistry} чел.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500">Потребность</p>
                <p className="mt-1 text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {activeDistrict.estimatedDemand} чел.
                </p>
              </div>
              <div
                className={`bg-white border rounded-lg p-3 ${
                  layers.routes ? 'border-sky-300' : 'border-slate-200 opacity-75'
                }`}
              >
                <p className="text-[11px] text-slate-500">Маршрутов</p>
                <p className="mt-1 text-lg font-bold font-mono text-sky-700 tabular-nums">
                  {activeDistrict.activeRoutesCount}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Обеспеченность легальными кадрами</span>
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
                <dt className="text-slate-500">Ключевые точки и ООПТ</dt>
                <dd className="mt-1 text-slate-800 leading-relaxed">{activeDistrict.keySpots}</dd>
              </div>
              <div className="py-2.5">
                <dt className="text-slate-500">Специфика безопасности и аттестации</dt>
                <dd className="mt-1 text-slate-800 leading-relaxed">{activeDistrict.safetyNote}</dd>
              </div>
              <div className="py-2.5 flex justify-between">
                <dt className="text-slate-500">Активное окно</dt>
                <dd className="font-mono font-medium text-slate-900">
                  {activeDistrict.seasonWindow}
                </dd>
              </div>
            </dl>
          </div>

          {/* Quick District Selector Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex justify-between">
              <span>Район / округ</span>
              <span>Реестр / Спрос / Маршруты</span>
            </div>
            <div className="divide-y divide-slate-200 max-h-[210px] overflow-y-auto">
              {visibleDistricts.length === 0 ? (
                <div className="px-4 py-5 text-xs text-slate-500 text-center space-y-2">
                  <p>Нет районов по выбранному сочетанию профиля и активности.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileFilter('all');
                      setLevelFilter('all');
                    }}
                    className="text-teal-700 font-semibold hover:underline cursor-pointer"
                  >
                    Сбросить фильтры
                  </button>
                </div>
              ) : (
                visibleDistricts.map((d) => {
                  const selected = d.id === activeDistrict.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleSelectDistrict(d)}
                      className={`w-full px-4 py-2.5 text-left text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        selected
                          ? 'bg-teal-50/80 font-semibold text-slate-900'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="truncate">{d.shortName}</span>
                      <span className="font-mono tabular-nums shrink-0 text-slate-600">
                        <span className="text-red-700">{d.certifiedInRegistry}</span> /{' '}
                        {d.estimatedDemand}{' '}
                        <span className="text-sky-700">· {d.activeRoutesCount} м.</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
