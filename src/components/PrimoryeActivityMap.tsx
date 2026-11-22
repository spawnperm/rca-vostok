import React, { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { PRIMORYE_DISTRICTS, type DistrictActivity } from '../data/researchData';
import { tracker } from '../utils/tracker';

export const PrimoryeActivityMap: React.FC = () => {
  const [profileFilter, setProfileFilter] = useState<'all' | 'hiking' | 'water' | 'expedition'>('all');
  const [selectedId, setSelectedId] = useState<string>(PRIMORYE_DISTRICTS[0].id);

  const visibleDistricts = useMemo(() => {
    if (profileFilter === 'all') return PRIMORYE_DISTRICTS;
    return PRIMORYE_DISTRICTS.filter((d) => d.profile === profileFilter);
  }, [profileFilter]);

  const activeDistrict: DistrictActivity =
    visibleDistricts.find((d) => d.id === selectedId) ??
    visibleDistricts[0] ??
    PRIMORYE_DISTRICTS[0];

  const handleSelectDistrict = (d: DistrictActivity) => {
    setSelectedId(d.id);
    tracker.trackCustomInteraction(`Карта Приморья: ${d.shortName}`, d.profileLabel);
  };

  const getLevelColor = (level: DistrictActivity['activityLevel']) => {
    if (level === 'высокая') return '#0F766E';
    if (level === 'растущая') return '#B45309';
    return '#475569';
  };

  const coveragePct = Math.min(
    Math.round((activeDistrict.certifiedInRegistry / Math.max(activeDistrict.estimatedDemand, 1)) * 100),
    100
  );

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-teal-700">Пространственное распределение</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">
            Интерактивная карта активности проводников по районам Приморского края
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* SVG Map Canvas */}
        <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pb-3 border-b border-slate-200">
            <span>Нажмите на округ для детального баланса кадров</span>
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-700" aria-hidden="true" />
                Высокая активность
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-700" aria-hidden="true" />
                Растущая
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-600" aria-hidden="true" />
                Экспедиционная
              </span>
            </div>
          </div>

          <div className="w-full py-2">
            <svg
              viewBox="0 0 460 515"
              className="w-full max-h-[430px] h-auto mx-auto select-none"
              role="img"
              aria-label="Карта активности инструкторов-проводников по районам Приморского края"
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

              {/* District Nodes */}
              {PRIMORYE_DISTRICTS.map((d) => {
                const isVisible = visibleDistricts.some((vd) => vd.id === d.id);
                const isSelected = d.id === activeDistrict.id;
                const fill = getLevelColor(d.activityLevel);
                const radius = Math.max(8, Math.min(18, Math.round(Math.sqrt(d.estimatedDemand) * 0.72)));

                return (
                  <g
                    key={d.id}
                    onClick={() => handleSelectDistrict(d)}
                    className={isVisible ? 'cursor-pointer' : 'opacity-25 cursor-pointer'}
                  >
                    {/* Demand halo */}
                    <circle
                      cx={d.x}
                      cy={d.y}
                      r={radius + (isSelected ? 5 : 2)}
                      fill={fill}
                      fillOpacity={isSelected ? 0.22 : 0.12}
                      stroke={isSelected ? '#0F172A' : 'none'}
                      strokeWidth={isSelected ? 1.5 : 0}
                    />
                    {/* Core point */}
                    <circle
                      cx={d.x}
                      cy={d.y}
                      r={isSelected ? 7 : 5.5}
                      fill={fill}
                      stroke="#FFFFFF"
                      strokeWidth={1.8}
                    />
                    {/* Label */}
                    <text
                      x={d.x + (d.id === 'khasan' || d.id === 'vladivostok' ? -8 : 11)}
                      y={d.y + (d.id === 'khasan' ? -10 : 4)}
                      textAnchor={d.id === 'khasan' || d.id === 'vladivostok' ? 'end' : 'start'}
                      className={`text-[10.5px] font-sans ${
                        isSelected ? 'fill-slate-950 font-bold' : 'fill-slate-700 font-medium'
                      }`}
                    >
                      {d.shortName}
                    </text>
                  </g>
                );
              })}
            </svg>
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
              <div className="bg-white border border-slate-200 rounded-lg p-3">
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
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500">Маршрутов</p>
                <p className="mt-1 text-lg font-bold font-mono text-teal-700 tabular-nums">
                  {activeDistrict.activeRoutesCount}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Обеспеченность легальными кадрами</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">{coveragePct}%</span>
              </div>
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-teal-700" style={{ width: `${Math.max(coveragePct, 2)}%` }} />
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
                <dd className="font-mono font-medium text-slate-900">{activeDistrict.seasonWindow}</dd>
              </div>
            </dl>
          </div>

          {/* Quick District Selector Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex justify-between">
              <span>Район / округ</span>
              <span>Реестр / Спрос</span>
            </div>
            <div className="divide-y divide-slate-200 max-h-[210px] overflow-y-auto">
              {visibleDistricts.map((d) => {
                const selected = d.id === activeDistrict.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleSelectDistrict(d)}
                    className={`w-full px-4 py-2.5 text-left text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      selected ? 'bg-teal-50/80 font-semibold text-slate-900' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="truncate">{d.shortName}</span>
                    <span className="font-mono tabular-nums shrink-0 text-slate-600">
                      <span className="text-red-700">{d.certifiedInRegistry}</span> / {d.estimatedDemand}
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
