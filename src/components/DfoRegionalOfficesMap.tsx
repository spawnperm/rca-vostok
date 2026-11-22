import React, { useMemo, useState } from 'react';
import {
  Building2,
  Check,
  Clock,
  Copy,
  GraduationCap,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  UserCheck,
} from 'lucide-react';
import {
  DFO_REGIONS_DISTRIBUTION,
  type DfoRegionDistribution,
} from '../data/researchData';
import {
  DFO_REGIONAL_TRAINING_OFFICES,
  getOfficesByRegionId,
  type DfoTrainingOffice,
} from '../data/dfoOverviewRegistryData';
import { tracker } from '../utils/tracker';

interface DfoRegionalOfficesMapProps {
  onContactCurator: (sourceLabel: string) => void;
  onApplyForSession?: (regionName: string, trackName: string) => void;
}

export const DfoRegionalOfficesMap: React.FC<DfoRegionalOfficesMapProps> = ({
  onContactCurator,
  onApplyForSession,
}) => {
  const [selectedRegionId, setSelectedRegionId] = useState<string>('primorye');
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [copiedOfficeId, setCopiedOfficeId] = useState<string | null>(null);

  const selectedRegion: DfoRegionDistribution = useMemo(
    () =>
      DFO_REGIONS_DISTRIBUTION.find((r) => r.id === selectedRegionId) ??
      DFO_REGIONS_DISTRIBUTION[0],
    [selectedRegionId]
  );

  const activeOffices: DfoTrainingOffice[] = useMemo(
    () => getOfficesByRegionId(selectedRegion.id),
    [selectedRegion.id]
  );

  const handleSelectRegion = (region: DfoRegionDistribution) => {
    setSelectedRegionId(region.id);
    tracker.trackCustomInteraction(
      `Карта отделений ДФО: ${region.shortName}`,
      `${getOfficesByRegionId(region.id).length} отд.`
    );
  };

  const handleCopyContacts = async (office: DfoTrainingOffice) => {
    const text = `${office.officeName}\n${office.address}\nТел.: ${office.phone}\nEmail: ${office.email}\nКоординатор: ${office.coordinatorName}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedOfficeId(office.id);
      tracker.trackCustomInteraction(`Скопированы контакты: ${office.city}`);
      window.setTimeout(() => {
        setCopiedOfficeId((prev) => (prev === office.id ? null : prev));
      }, 2000);
    } catch {
      // Clipboard API unavailable in restricted contexts
    }
  };

  return (
    <section
      aria-labelledby="dfo-regional-offices-map-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Интерактивный справочник региональных центров подготовки</span>
          </p>
          <h2 id="dfo-regional-offices-map-heading" className="text-xl font-bold text-slate-900">
            Карта ДФО: контакты региональных отделений подготовки проводников
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Нажмите на любой регион Дальневосточного федерального округа на карте или в списке, чтобы
            открыть адрес, телефон, почту, расписание приёма и учебные программы профильного отделения.
          </p>
        </div>

        <div className="text-xs text-slate-500 font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 shrink-0">
          {DFO_REGIONS_DISTRIBUTION.length} субъектов ДФО · {DFO_REGIONAL_TRAINING_OFFICES.length} отделений
        </div>
      </div>

      {/* Main Layout: SVG Map (6 cols) + Contacts Inspector (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Interactive DFO Polygon Map */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4 space-y-3">
            <div className="relative w-full">
              <svg
                viewBox="0 0 640 430"
                className="w-full max-h-[360px] h-auto mx-auto select-none"
                role="img"
                aria-label="Интерактивная карта субъектов ДФО для выбора контактов региональных отделений"
              >
                <rect x="0" y="0" width="640" height="430" fill="#F0F9FF" rx="8" />

                {/* Subtle grid */}
                <g stroke="#DCE7F3" strokeWidth="1" strokeDasharray="3 4">
                  <line x1="0" y1="110" x2="640" y2="110" />
                  <line x1="0" y1="220" x2="640" y2="220" />
                  <line x1="0" y1="330" x2="640" y2="330" />
                  <line x1="160" y1="0" x2="160" y2="430" />
                  <line x1="320" y1="0" x2="320" y2="430" />
                  <line x1="480" y1="0" x2="480" y2="430" />
                </g>

                {DFO_REGIONS_DISTRIBUTION.map((region) => {
                  const isSelected = region.id === selectedRegion.id;
                  const isHovered = region.id === hoveredRegionId;
                  const officeCount = getOfficesByRegionId(region.id).length;

                  const fill = isSelected
                    ? '#0F766E'
                    : isHovered
                    ? '#CCFBF1'
                    : '#FFFFFF';

                  return (
                    <path
                      key={region.id}
                      d={region.svgPath}
                      tabIndex={0}
                      role="button"
                      aria-pressed={isSelected}
                      aria-label={`${region.name}: ${officeCount} региональных отделений подготовки проводников`}
                      fill={fill}
                      stroke={isSelected ? '#0F172A' : isHovered ? '#0F766E' : '#94A3B8'}
                      strokeWidth={isSelected ? 2.4 : isHovered ? 2 : 1.3}
                      strokeLinejoin="round"
                      onMouseEnter={() => setHoveredRegionId(region.id)}
                      onMouseLeave={() =>
                        setHoveredRegionId((prev) => (prev === region.id ? null : prev))
                      }
                      onClick={() => handleSelectRegion(region)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectRegion(region);
                        }
                      }}
                      className="transition-colors duration-150 cursor-pointer focus:outline-none"
                    />
                  );
                })}

                {DFO_REGIONS_DISTRIBUTION.map((region) => {
                  const isSelected = region.id === selectedRegion.id;
                  const officeCount = getOfficesByRegionId(region.id).length;

                  return (
                    <g key={`office-pin-${region.id}`} className="pointer-events-none">
                      <circle
                        cx={region.cx}
                        cy={region.cy}
                        r={isSelected ? 13 : 10}
                        fill={isSelected ? '#FFFFFF' : '#0F172A'}
                        stroke={isSelected ? '#0F172A' : '#FFFFFF'}
                        strokeWidth={2}
                      />
                      <text
                        x={region.cx}
                        y={region.cy + 3.5}
                        textAnchor="middle"
                        className={`text-[9.5px] font-mono font-bold ${
                          isSelected ? 'fill-teal-800' : 'fill-white'
                        }`}
                      >
                        {officeCount}
                      </text>
                      <text
                        x={region.labelX}
                        y={region.labelY}
                        textAnchor={region.labelAnchor ?? 'start'}
                        className={`text-[10px] font-sans ${
                          isSelected
                            ? 'fill-slate-950 font-bold'
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

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-[11px] text-slate-600">
              <span>Цифра на маркере — число отделений подготовки в регионе</span>
              <span className="font-medium text-teal-800">Выбрано: {selectedRegion.name}</span>
            </div>
          </div>

          {/* Region Chips Quick Switch */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Выбор субъекта ДФО">
            {DFO_REGIONS_DISTRIBUTION.map((region) => {
              const isSelected = region.id === selectedRegion.id;
              return (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => handleSelectRegion(region)}
                  aria-pressed={isSelected}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 border-slate-900 text-white font-semibold'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-teal-600 hover:text-teal-800'
                  }`}
                >
                  {region.shortName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Regional Offices Contacts Display */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                Контактные данные региональных отделений
              </p>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">{selectedRegion.name}</h3>
            </div>
            <span className="px-2.5 py-1 text-xs font-mono font-semibold bg-teal-50 text-teal-800 border border-teal-200 rounded-md tabular-nums">
              {activeOffices.length}{' '}
              {activeOffices.length === 1 ? 'отделение' : 'отделения'}
            </span>
          </div>

          <div className="space-y-4">
            {activeOffices.map((office) => {
              const isCopied = copiedOfficeId === office.id;
              return (
                <article
                  key={office.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <span className="inline-block px-2 py-0.5 text-[11px] font-semibold bg-white border border-slate-200 text-teal-800 rounded">
                        {office.officeTypeLabel}
                      </span>
                      <h4 className="text-base font-bold text-slate-900 leading-snug">
                        {office.officeName}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyContacts(office)}
                      className="px-2.5 py-1.5 text-[11px] font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                          <span className="text-teal-800">Скопировано</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                          <span>Копировать</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Contact Grid */}
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white border border-slate-200 rounded-lg p-3.5 text-xs">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <dt className="text-slate-500">Адрес отделения</dt>
                        <dd className="mt-0.5 font-medium text-slate-900 leading-snug">
                          {office.address}
                        </dd>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <dt className="text-slate-500">Часы работы</dt>
                        <dd className="mt-0.5 font-medium text-slate-900 leading-snug">
                          {office.hours}
                        </dd>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Phone className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <dt className="text-slate-500">Телефон приёма</dt>
                        <dd className="mt-0.5">
                          <a
                            href={`tel:${office.phone.replace(/[^\d+]/g, '')}`}
                            className="font-mono font-semibold text-teal-800 hover:underline"
                          >
                            {office.phone}
                          </a>
                        </dd>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Mail className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <dt className="text-slate-500">Электронная почта</dt>
                        <dd className="mt-0.5">
                          <a
                            href={`mailto:${office.email}`}
                            className="font-mono font-semibold text-teal-800 hover:underline break-all"
                          >
                            {office.email}
                          </a>
                        </dd>
                      </div>
                    </div>
                  </dl>

                  {/* Coordinator */}
                  <div className="flex items-start gap-2.5 text-xs bg-white border border-slate-200 rounded-lg px-3.5 py-2.5">
                    <UserCheck className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <span className="font-semibold text-slate-900">{office.coordinatorName}</span>
                      <span className="text-slate-500"> — {office.coordinatorRole}</span>
                    </div>
                  </div>

                  {/* Training programs */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 inline-flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                      <span>Программы подготовки проводников</span>
                    </p>
                    <ul className="space-y-1 text-xs text-slate-700">
                      {office.trainingPrograms.map((prog) => (
                        <li key={prog}>· {prog}</li>
                      ))}
                    </ul>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-200 pt-2.5">
                    {office.notes}
                  </p>

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        onContactCurator(`Региональное отделение: ${office.city} (${office.regionName})`)
                      }
                      className="px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
                      <span>Связаться с отделением</span>
                    </button>

                    {onApplyForSession && (
                      <button
                        type="button"
                        onClick={() =>
                          onApplyForSession(selectedRegion.name, 'Пешеходный туризм')
                        }
                        className="px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                        <span>Записаться на поток</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
