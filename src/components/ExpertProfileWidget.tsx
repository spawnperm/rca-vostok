import React, { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  CalendarPlus,
  CheckCircle2,
  Compass,
  MapPin,
  MessageSquare,
  Mic,
  Quote,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  EXPERT_PROFILES,
  filterExpertProfiles,
  getExpertCounts,
  type ExpertFilterKind,
  type ExpertProfile,
} from '../utils/expertProfiles';
import { tracker } from '../utils/tracker';

interface ExpertProfileWidgetProps {
  onContactCurator: (sourceLabel: string) => void;
  onApplyForSession?: (region: string, track: string) => void;
}

export const ExpertProfileWidget: React.FC<ExpertProfileWidgetProps> = ({
  onContactCurator,
  onApplyForSession,
}) => {
  const [roleFilter, setRoleFilter] = useState<ExpertFilterKind>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string>(EXPERT_PROFILES[0].id);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const counts = useMemo(() => getExpertCounts(), []);

  const visibleExperts = useMemo(
    () => filterExpertProfiles(roleFilter, searchQuery),
    [roleFilter, searchQuery]
  );

  const activeExpert: ExpertProfile | null = useMemo(() => {
    if (visibleExperts.length === 0) return null;
    return visibleExperts.find((item) => item.id === selectedId) ?? visibleExperts[0];
  }, [visibleExperts, selectedId]);

  const handleSelectRoleFilter = (nextFilter: ExpertFilterKind, label: string) => {
    setRoleFilter(nextFilter);
    const matched = filterExpertProfiles(nextFilter, searchQuery);
    if (matched.length > 0 && !matched.some((e) => e.id === selectedId)) {
      setSelectedId(matched[0].id);
    }
    tracker.trackCustomInteraction(`Профиль эксперта · фильтр: ${label}`);
  };

  const handleSelectExpert = (expert: ExpertProfile) => {
    setSelectedId(expert.id);
    tracker.trackCustomInteraction(
      `Профиль эксперта: ${expert.name}`,
      expert.roleSummaryLabel
    );
  };

  return (
    <section
      id="expert-profile-section"
      aria-labelledby="expert-profile-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 scroll-mt-24"
    >
      {/* Header & Filter Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Экспертный совет и спикеры · РЦА «Русский Восток»</span>
          </p>
          <h2 id="expert-profile-heading" className="text-xl font-bold text-slate-900">
            Профиль эксперта: аттестационная комиссия и ключевые спикеры
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Персональные карточки членов аттестационной комиссии ВВГУ / ФСТР и ключевых спикеров
            образовательных программ с описанием экзаменационных полномочий, тем выступлений и
            методических модулей.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Фильтр ролей экспертов"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {(
            [
              { id: 'all', label: `Все (${counts.all})` },
              { id: 'commission', label: `Аттестационная комиссия (${counts.commission})` },
              { id: 'speaker', label: `Ключевые спикеры (${counts.speaker})` },
            ] as const
          ).map((tab) => {
            const isSelected = roleFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleSelectRoleFilter(tab.id, tab.label)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
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

      {/* Search Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-lg">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск эксперта или спикера: фамилия, WFA, ООПТ, сплавы, ПП № 1893..."
            aria-label="Поиск по профилям экспертов и спикеров"
            className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Очистить поиск экспертов"
              className="p-1 text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="text-xs font-mono text-slate-500 tabular-nums shrink-0">
          Показано профилей: {visibleExperts.length} / {EXPERT_PROFILES.length}
        </p>
      </div>

      {/* Master-Detail Profile Showcase */}
      {!activeExpert ? (
        <div className="border border-slate-200 rounded-xl p-8 text-center space-y-3 bg-slate-50">
          <p className="text-sm font-medium text-slate-800">
            По запросу «{searchQuery}» профили экспертов и спикеров не найдены.
          </p>
          <button
            type="button"
            onClick={() => {
              setRoleFilter('all');
              setSearchQuery('');
              setSelectedId(EXPERT_PROFILES[0].id);
            }}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Сбросить фильтры
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Selector Directory */}
          <div
            role="listbox"
            aria-label="Список экспертов и ключевых спикеров"
            className="lg:col-span-4 space-y-2.5"
          >
            {visibleExperts.map((expert) => {
              const isSelected = expert.id === activeExpert.id;
              const imgFailed = failedImages[expert.id];
              const showPhoto = Boolean(expert.photoUrl) && !imgFailed;

              return (
                <button
                  key={expert.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectExpert(expert)}
                  className={`w-full text-left p-3.5 rounded-xl border flex items-start gap-3.5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                    isSelected
                      ? 'border-teal-700 bg-teal-50/40 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 flex items-center justify-center">
                    {showPhoto ? (
                      <img
                        src={expert.photoUrl as string}
                        alt={expert.photoAlt}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [expert.id]: true }))
                        }
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <span className="w-full h-full bg-slate-900 text-teal-300 text-xs font-mono font-bold flex items-center justify-center">
                        {expert.initials}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[11px] font-medium text-teal-800 truncate">
                      {expert.roleSummaryLabel}
                    </p>
                    <p className="text-sm font-bold text-slate-900 leading-snug">
                      {expert.name}
                    </p>
                    <p className="text-xs text-slate-500 leading-snug line-clamp-2">
                      {expert.institution}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Detailed Expert Profile Dossier */}
          <div className="lg:col-span-8 bg-slate-50 border border-slate-200 rounded-xl p-5 sm:p-6 space-y-6">
            {/* Identity Header */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-5 pb-5 border-b border-slate-200">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0">
                {activeExpert.photoUrl && !failedImages[activeExpert.id] ? (
                  <img
                    src={activeExpert.photoUrl}
                    alt={activeExpert.photoAlt}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [activeExpert.id]: true }))
                    }
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-900 to-teal-900 flex flex-col items-center justify-center text-white gap-1">
                    <Compass className="w-6 h-6 text-teal-300" aria-hidden="true" />
                    <span className="text-base font-bold font-mono">{activeExpert.initials}</span>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold text-teal-800">
                    {activeExpert.roleSummaryLabel}
                  </span>
                  <span aria-hidden="true" className="text-slate-400">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                    {activeExpert.region}
                  </span>
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                  {activeExpert.name}
                </h3>

                <p className="text-xs sm:text-sm font-medium text-slate-700">
                  {activeExpert.shortRole} — {activeExpert.institution}
                </p>

                <p className="text-xs font-mono text-teal-800 tabular-nums pt-0.5">
                  {activeExpert.disciplines}
                </p>
              </div>
            </div>

            {/* Bio */}
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {activeExpert.bio}
            </p>

            {/* Commission Mandate vs Keynote Speaker Tracks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                  <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                  <span>Работа в аттестационной комиссии</span>
                </div>
                <p className="text-xs font-medium text-teal-800 leading-snug">
                  {activeExpert.commissionMandate}
                </p>
                <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
                  {activeExpert.commissionDuties.map((duty) => (
                    <li key={duty} className="flex items-start gap-2">
                      <CheckCircle2
                        className="w-3.5 h-3.5 text-teal-700 mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{duty}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                  <Mic className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                  <span>Выступления спикера и учебные темы</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
                  {activeExpert.speakerTopics.map((topic, idx) => (
                    <li key={topic} className="flex items-start gap-2">
                      <span className="font-mono font-semibold text-teal-700 tabular-nums shrink-0">
                        0{idx + 1}.
                      </span>
                      <span>{topic}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-2.5 border-t border-slate-200 space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-500 inline-flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    <span>Методические модули ДПО</span>
                  </p>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {activeExpert.methodologicalModules.map((mod) => (
                      <li key={mod}>— {mod}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Expert Quote & Outcome */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 space-y-3">
              <div className="flex items-start gap-3">
                <Quote className="w-5 h-5 text-teal-700/70 shrink-0 mt-0.5" aria-hidden="true" />
                <blockquote className="font-serif text-sm sm:text-base text-slate-900 leading-relaxed">
                  «{activeExpert.quote}»
                </blockquote>
              </div>
              <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-500">Ключевой показатель и результат:</span>
                <span className="font-medium text-slate-800">{activeExpert.keyMetrics}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => onContactCurator(`Профиль эксперта: ${activeExpert.name}`)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <MessageSquare className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
                <span>Задать вопрос эксперту</span>
              </button>

              {onApplyForSession && (
                <button
                  type="button"
                  onClick={() => {
                    tracker.trackCustomInteraction(
                      `Профиль эксперта · запись: ${activeExpert.name}`,
                      activeExpert.recommendedTrack
                    );
                    onApplyForSession(
                      activeExpert.recommendedRegion,
                      activeExpert.recommendedTrack
                    );
                  }}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <CalendarPlus className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>Записаться на программу / сессию</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
