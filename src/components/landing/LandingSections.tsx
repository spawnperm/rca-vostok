import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  CalendarDays,
  CalendarPlus,
  Camera,
  Check,
  CheckCircle2,
  Compass,
  ExternalLink,
  Flag,
  Mail,
  Map,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Signpost,
  Tent,
  Waves,
} from 'lucide-react';
import {
  ATTESTATION_EXTERNAL,
  CERTIFICATION_SCHEDULE,
  CONSULTING_SERVICES,
  CONTACTS,
  HERO,
  PREPARATION_STEPS,
  PROGRAMMES,
  SITE_ANNOUNCEMENT,
  formatSessionRange,
  type LandingSection,
} from '../../data/landingContent';
import {
  buildGoogleCalendarUrl,
  buildScheduleSlotCalendarEvent,
  buildYandexCalendarUrl,
  downloadCalendarIcs,
} from '../../utils/attestationCalendar';
import { tracker } from '../../utils/tracker';
import type { NavigateOptions, SiteTabId } from '../../utils/seo';
import { AttestationLocationsLeafletMap } from './AttestationLocationsLeafletMap';
import { CertificationCalendarHub } from '../CertificationCalendarHub';
import { CertifiedGuidesRegistryTable } from '../CertifiedGuidesRegistryTable';
import { GuideLearningRoadmapGraph } from '../GuideLearningRoadmapGraph';
import { InstructorCompetencyGraphD3 } from '../InstructorCompetencyGraphD3';
import { InteractiveGlossary } from '../InteractiveGlossary';
import { OverviewDemoCertificateSection } from '../OverviewDemoCertificateSection';
import { PlatformFeedbackForm } from '../PlatformFeedbackForm';
import { dispatchOpenRcaAssistant } from '../RcaAssistantChatWidget';
import { RecommendedLiteratureSection } from '../RecommendedLiteratureSection';
import { TrainingAndAssessmentHub } from '../TrainingAndAssessmentHub';
import { FAQSection, FAQ_ATTESTATION_ASSISTANT_PROMPT } from './FAQSection';

export { FAQSection };

const HERO_PHOTO_URL = '/src/assets/images/primorye_expedition_hero_1795470723261.jpg';

const PROGRAMME_DETAILS: Record<
  string,
  { hours: string; format: string; summary: string }
> = {
  'Инструктор-проводник по пешеходному туризму': {
    hours: '250 ч · ДПО ВВГУ',
    format: 'Очно-заочно + полигон',
    summary:
      'Топография, ориентирование, организация стоянок, ПСР и первая помощь на маршрутах 1–4 КС.',
  },
  'Инструктор-проводник по водному туризму': {
    hours: '250 ч · ДПО ВВГУ',
    format: 'Теория + сплавной полигон',
    summary:
      'Чтение лоции, управление катамараном/рафтом, спасработы с берега и страховка экипажей.',
  },
  Экскурсовод: {
    hours: '144 ч · ДПО ВВГУ',
    format: 'Очно-дистанционно',
    summary:
      'Методика ведения экскурсий, краеведение Дальнего Востока, работа с группой и аттестация.',
  },
  'Руководитель туристической группы': {
    hours: '72 ч · ДПО ВВГУ',
    format: 'Интенсив',
    summary:
      'Нормирование маршрута по ПП № 760, управление рисками, документация группы и взаимодействие с МЧС.',
  },
};

const PROGRAMME_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  tent: Tent,
  waves: Waves,
  camera: Camera,
  flag: Flag,
};

const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  book: BookOpen,
  map: Map,
  signpost: Signpost,
};

const STEP_SUMMARIES: readonly string[] = [
  'Теоретический модуль по НПА (ФЗ № 132-ФЗ, ПП № 1003/1893), картографии и первой помощи.',
  'Выездные учебно-тренировочные сборы на полигонах Приморья и отработка спасательных приёмов.',
  'Зачётное прохождение маршрута заявленной категории сложности с оформлением отчётной книжки.',
];

function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  lead?: string;
}) {
  return (
    <header id={id} className="scroll-mt-24 space-y-2">
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{eyebrow}</p>
      )}
      <h2 className="text-2xl font-bold text-slate-900 text-balance">{title}</h2>
      {lead && <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">{lead}</p>}
    </header>
  );
}

/** Hero block with documentary Primorye ridge visual and 4-column empirical KPI strip. */
export function LandingHero({
  onNavigate,
  onNavigateTab,
}: {
  onNavigate: (id: string) => void;
  onNavigateTab?: (tab: SiteTabId, options?: NavigateOptions) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-2xl bg-slate-900 text-white min-h-[380px] flex items-center">
        {!imgFailed && (
          <img
            src={HERO_PHOTO_URL}
            alt="Аттестованные инструкторы-проводники с группой на горно-прибрежном хребте Приморского края"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-slate-950/92 via-slate-900/80 to-slate-900/45"
        />

        <div className="relative z-10 px-7 py-12 sm:px-12 sm:py-16 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
            {HERO.eyebrow} · ВВГУ и ФСТР
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold leading-tight text-balance">
            {HERO.title}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-100/90 max-w-2xl leading-relaxed">
            {HERO.text} — единый региональный центр аттестации Приморского края и Дальнего Востока
            на базе Владивостокского государственного университета.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('learning')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-slate-900 text-sm font-semibold rounded-lg hover:bg-teal-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Compass className="w-4 h-4 text-teal-700" aria-hidden="true" />
              Программы и тренажёр
            </button>
            <button
              type="button"
              onClick={() => onNavigate('certification')}
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/45 bg-slate-950/35 text-white text-sm font-semibold rounded-lg hover:bg-white/15 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <CalendarDays className="w-4 h-4" aria-hidden="true" />
              График аттестаций 2027
            </button>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('overview')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-teal-200 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Аналитика центра</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <a
            href={SITE_ANNOUNCEMENT.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex items-center gap-2 text-xs font-medium text-teal-200 hover:text-white underline underline-offset-4"
          >
            <span>{SITE_ANNOUNCEMENT.text}</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          </a>
        </div>
      </section>

      {/* Full-width 4-column empirical KPI strip */}
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
          <dt className="text-xs text-slate-500">Проводников в реестре края</dt>
          <dd className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">122 чел.</dd>
          <p className="mt-0.5 text-[11px] text-slate-500">против 2 228 требуемых</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
          <dt className="text-xs text-slate-500">Активных туристов в Приморье</dt>
          <dd className="mt-1 text-xl font-bold font-mono text-teal-800 tabular-nums">~835 тыс.</dd>
          <p className="mt-0.5 text-[11px] text-slate-500">20% от 4,07 млн поездок</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
          <dt className="text-xs text-slate-500">Сессий аттестации 2027 г.</dt>
          <dd className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">5 сессий</dd>
          <p className="mt-0.5 text-[11px] text-slate-500">категории сложности 1–4 КС</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
          <dt className="text-xs text-slate-500">Охват округов и субъектов</dt>
          <dd className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">7 субъектов</dd>
          <p className="mt-0.5 text-[11px] text-slate-500">ДФО · выездные комиссии</p>
        </div>
      </dl>
    </div>
  );
}

/**
 * «Обучение и подготовка» — программы ДПО, этапы практики,
 * объединённый тренажёр экзамена/диагностики, библиотека и глоссарий.
 */
type LearningSubTabId = 'programmes' | 'competencies' | 'glossary' | 'exam' | 'library';

const VALID_LEARNING_SUBTABS = new Set<LearningSubTabId>([
  'programmes',
  'competencies',
  'glossary',
  'exam',
  'library',
]);

function resolveLearningSubTab(sub?: string): LearningSubTabId {
  if (sub && VALID_LEARNING_SUBTABS.has(sub as LearningSubTabId)) {
    return sub as LearningSubTabId;
  }
  return 'programmes';
}

export function LearningSection({
  initialSubTab = 'programmes',
  compact = false,
  onNavigateTab,
  onSubTabChange,
}: {
  initialSubTab?: string;
  compact?: boolean;
  onNavigateTab?: (tab: SiteTabId, options?: NavigateOptions) => void;
  onSubTabChange?: (subTab: string) => void;
}) {
  const [subTab, setSubTab] = useState<LearningSubTabId>(() =>
    resolveLearningSubTab(initialSubTab)
  );

  useEffect(() => {
    setSubTab(resolveLearningSubTab(initialSubTab));
  }, [initialSubTab]);

  const selectSubTab = (next: LearningSubTabId) => {
    setSubTab(next);
    onSubTabChange?.(next);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <SectionHeading
          id="learning"
          eyebrow="Обучение и подготовка"
          title="Программы ДПО, компетенции и тренажёр аттестации"
          lead="Профессиональная подготовка в ВВГУ, интерактивная карта связей компетенций (D3.js), траектория обучения, тренировка экзаменационных билетов ФСТР, глоссарий и литература."
        />

        {!compact && (
          <div
            role="tablist"
            aria-label="Разделы обучения и подготовки"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start lg:self-auto"
          >
            {(
              [
                { id: 'programmes', label: 'Программы и граф обучения' },
                { id: 'competencies', label: 'Связи компетенций' },
                { id: 'glossary', label: 'Глоссарий ФСТР' },
                { id: 'exam', label: 'Тренажёр и диагностика' },
                { id: 'library', label: 'Литература' },
              ] as const
            ).map((tab) => {
              const active = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    selectSubTab(tab.id);
                    tracker.trackCustomInteraction(`Обучение · ${tab.label}`, 'learning');
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
        )}
      </div>

      {(compact || subTab === 'programmes') && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PROGRAMMES.map((programme) => {
              const Icon = PROGRAMME_ICONS[programme.icon] ?? Compass;
              const detail = PROGRAMME_DETAILS[programme.title];
              return (
                <article
                  key={programme.title}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 hover:border-teal-300 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <span className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-teal-700" aria-hidden="true" />
                    </span>
                    <div className="space-y-1 min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">
                        {programme.title}
                      </h3>
                      {detail && (
                        <p className="text-xs text-teal-800 font-medium">
                          {detail.hours} · {detail.format}
                        </p>
                      )}
                    </div>
                  </div>
                  {detail && (
                    <p className="text-xs text-slate-600 leading-relaxed">{detail.summary}</p>
                  )}
                </article>
              );
            })}
          </div>

          {!compact ? (
            <GuideLearningRoadmapGraph
              onOpenExam={() => selectSubTab('exam')}
              onOpenLibrary={() => selectSubTab('library')}
              onNavigateTab={onNavigateTab}
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-1.5 max-w-2xl">
                <p className="text-xs font-medium text-teal-700">
                  4 программы ДПО · 16 компетенций в графе D3 · Тренажёр ФСТР · 50+ терминов
                </p>
                <h3 className="text-base font-bold text-slate-900">
                  Интерактивная среда обучения, граф компетенций (D3.js) и тренажёр ФСТР
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Откройте полный рабочий контур раздела «Обучение», чтобы изучить связи
                  компетенций, пройти тренировочные билеты, проверить категорию сложности и
                  воспользоваться библиотекой.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    onNavigateTab
                      ? onNavigateTab('learning', { subTab: 'competencies' })
                      : selectSubTab('competencies')
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Граф компетенций (D3)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onNavigateTab
                      ? onNavigateTab('learning', { subTab: 'exam' })
                      : selectSubTab('exam')
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Тренажёр экзамена</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onNavigateTab
                      ? onNavigateTab('learning', { subTab: 'library' })
                      : selectSubTab('library')
                  }
                  className="px-3 py-2 bg-white border border-slate-300 hover:border-teal-500 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Библиотека
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onNavigateTab
                      ? onNavigateTab('learning', { subTab: 'glossary' })
                      : selectSubTab('glossary')
                  }
                  className="px-3 py-2 bg-white border border-slate-300 hover:border-teal-500 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Глоссарий
                </button>
              </div>
            </div>
          )}

          {compact && (
            <div className="space-y-3 pt-1">
              <h3 className="text-sm font-bold text-slate-900">
                Базовые этапы подготовки к аттестации
              </h3>
              <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PREPARATION_STEPS.map((step, index) => {
                  const Icon = STEP_ICONS[step.icon] ?? BookOpen;
                  return (
                    <li
                      key={step.title}
                      className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
                          <Icon className="w-4 h-4 text-slate-700" aria-hidden="true" />
                        </span>
                        <span className="text-xs font-mono text-slate-400 tabular-nums">
                          0{index + 1}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900">{step.title}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {STEP_SUMMARIES[index]}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      )}

      {!compact && subTab === 'competencies' && (
        <InstructorCompetencyGraphD3
          onOpenExam={() => selectSubTab('exam')}
          onOpenGlossary={() => selectSubTab('glossary')}
          onOpenLibrary={() => selectSubTab('library')}
        />
      )}

      {!compact && subTab === 'glossary' && <InteractiveGlossary />}

      {!compact && subTab === 'exam' && <TrainingAndAssessmentHub onNavigateTab={onNavigateTab} />}

      {!compact && subTab === 'library' && (
        <div className="space-y-6">
          <RecommendedLiteratureSection />
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900">
                Нужно уточнить нормативный термин из пособия?
              </p>
              <p className="text-xs text-slate-600">
                Откройте глоссарий ФСТР с поиском по определениям ПП № 1003, 1893 и категорийным
                нормативам или перейдите к тренировочным билетам.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => selectSubTab('glossary')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:border-teal-500 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Открыть глоссарий ФСТР</span>
                <ArrowRight className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => selectSubTab('exam')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Тренажёр экзамена</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** «Практика по пешеходному туризму» — kept for backward compatibility of Preparation route. */
export function PreparationSection() {
  return <LearningSection initialSubTab="exam" />;
}

/**
 * «Аттестация» — график 2027 + .ics, единый календарь комиссий и вебинаров ДФО,
 * карта площадок, реестр аттестованных проводников и демо-удостоверение.
 */
type CertSubTabId = 'schedule' | 'calendars' | 'locations' | 'registry';

const VALID_CERT_SUBTABS = new Set<CertSubTabId>([
  'schedule',
  'calendars',
  'locations',
  'registry',
]);

function resolveCertSubTab(sub?: string): CertSubTabId {
  if (sub && VALID_CERT_SUBTABS.has(sub as CertSubTabId)) {
    return sub as CertSubTabId;
  }
  return 'schedule';
}

export function CertificationSection({
  compact = false,
  initialSubTab = 'schedule',
  onNavigateTab,
  onSubTabChange,
}: {
  compact?: boolean;
  initialSubTab?: string;
  onNavigateTab?: (tab: SiteTabId, options?: NavigateOptions) => void;
  onSubTabChange?: (subTab: string) => void;
}) {
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number>(0);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [certTab, setCertTab] = useState<CertSubTabId>(() => resolveCertSubTab(initialSubTab));

  useEffect(() => {
    setCertTab(resolveCertSubTab(initialSubTab));
  }, [initialSubTab]);

  const selectCertTab = (next: CertSubTabId) => {
    setCertTab(next);
    onSubTabChange?.(next);
  };

  const activeSlot = CERTIFICATION_SCHEDULE[selectedSlotIdx] ?? CERTIFICATION_SCHEDULE[0];
  const activeEvent = buildScheduleSlotCalendarEvent(activeSlot, selectedSlotIdx);
  const googleCalendarUrl = buildGoogleCalendarUrl(activeEvent);

  const handleExportIcs = () => {
    const fileName = downloadCalendarIcs(activeEvent, 1440);
    const rangeLabel = formatSessionRange(activeSlot.start, activeSlot.end);
    setExportNotice(
      `Файл ${fileName} скачан (${rangeLabel}) — откройте для импорта в Google Календарь или Яндекс Календарь.`
    );
    tracker.trackCustomInteraction(
      `График аттестаций · Добавить в календарь (.ics): ${rangeLabel}`,
      activeSlot.start
    );
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <SectionHeading
          id="certification"
          eyebrow="Аттестация и реестр"
          title="График аттестаций 2027, календарь ДФО и площадки"
          lead="Сессии категории 1–4 КС, экспорт событий в календарь, очные полигоны ДФО, федеральный реестр и образец квалификационного удостоверения."
        />

        {!compact && (
          <div
            role="tablist"
            aria-label="Подразделы аттестации"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start lg:self-auto"
          >
            {(
              [
                { id: 'schedule', label: 'Сессии 2027' },
                { id: 'calendars', label: 'Календарь ДФО и вебинары' },
                { id: 'locations', label: 'Площадки на карте' },
                { id: 'registry', label: 'Реестр и удостоверение' },
              ] as const
            ).map((tab) => {
              const active = certTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    selectCertTab(tab.id);
                    tracker.trackCustomInteraction(`Аттестация · ${tab.label}`, 'certification');
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
        )}
      </div>

      {(compact || certTab === 'schedule') && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <caption className="sr-only">Расписание сессий аттестации на 2027 год</caption>
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="text-left font-semibold px-5 py-3">
                    Даты
                  </th>
                  <th scope="col" className="text-left font-semibold px-5 py-3">
                    Категория
                  </th>
                  <th scope="col" className="text-left font-semibold px-5 py-3 hidden md:table-cell">
                    Виды туризма
                  </th>
                  <th scope="col" className="text-right font-semibold px-5 py-3">
                    Выбор
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {CERTIFICATION_SCHEDULE.map((slot, idx) => {
                  const isSelected = idx === selectedSlotIdx;
                  const rangeLabel = formatSessionRange(slot.start, slot.end);
                  return (
                    <tr
                      key={slot.start}
                      onClick={() => {
                        setSelectedSlotIdx(idx);
                        setExportNotice(null);
                      }}
                      className={`align-top transition-colors cursor-pointer ${
                        isSelected ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-5 py-3 font-medium text-slate-900 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <CalendarDays
                            className={`w-3.5 h-3.5 ${isSelected ? 'text-teal-700' : 'text-slate-400'}`}
                            aria-hidden="true"
                          />
                          {rangeLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-700 whitespace-nowrap font-mono tabular-nums">
                        {slot.category}
                      </td>
                      <td className="px-5 py-3 text-slate-600 hidden md:table-cell">
                        {slot.disciplines.join('; ')}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSlotIdx(idx);
                            setExportNotice(null);
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-teal-700 border-teal-700 text-white'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-teal-600'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" aria-hidden="true" />}
                          {isSelected ? 'Выбрано' : 'Выбрать'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportIcs}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <CalendarPlus className="w-4 h-4" aria-hidden="true" />
                <span>Добавить в календарь (.ics)</span>
              </button>

              <a
                href={googleCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  tracker.trackCustomInteraction(
                    `График аттестаций · Google Календарь: ${activeSlot.start}`,
                    activeSlot.category
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <span>Google Календарь</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              </a>

              <a
                href={buildYandexCalendarUrl()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  tracker.trackCustomInteraction(
                    `График аттестаций · Яндекс Календарь: ${activeSlot.start}`,
                    activeSlot.category
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <span>Яндекс Календарь</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              </a>

              <span className="text-xs text-slate-600">
                Выбрано:{' '}
                <strong className="font-semibold text-slate-900">
                  {formatSessionRange(activeSlot.start, activeSlot.end)}
                </strong>
              </span>
            </div>

            <a
              href={ATTESTATION_EXTERNAL.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              {ATTESTATION_EXTERNAL.label}
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          </div>

          {exportNotice && (
            <p
              role="status"
              className="text-xs text-teal-900 bg-teal-50 border border-teal-200 rounded-lg px-3.5 py-2.5 font-medium"
            >
              {exportNotice}
            </p>
          )}
        </div>
      )}

      {!compact && certTab === 'schedule' && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Маршрутизация по разделам аттестации
            </p>
            <p className="text-sm font-bold text-slate-900">
              Адреса очных полигонов, календарь выездных комиссий и запись на экзамен
            </p>
            <p className="text-xs text-slate-600">
              Откройте интерактивную карту площадок ДФО, выберите сессию в общем календаре или
              перейдите к личному расчёту готовности.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => selectCertTab('locations')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:border-teal-500 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>Открыть карту площадок</span>
            </button>
            <button
              type="button"
              onClick={() => selectCertTab('calendars')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:border-teal-500 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CalendarDays className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>Календарь и вебинары</span>
            </button>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('account', { subTab: 'preparation' })}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Запись в личном кабинете</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

      {!compact && certTab === 'calendars' && (
        <CertificationCalendarHub
          onNavigateTab={onNavigateTab}
          onApplyForSession={() =>
            onNavigateTab
              ? onNavigateTab('overview', { subTab: 'summary', anchor: 'inquiry-section' })
              : undefined
          }
          onContactCurator={() =>
            onNavigateTab
              ? onNavigateTab('contacts', { subTab: 'contacts' })
              : undefined
          }
        />
      )}

      {!compact && certTab === 'locations' && <AttestationLocationsLeafletMap />}

      {!compact && certTab === 'registry' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Реестр аттестованных проводников ДФО
                </p>
                <p className="text-xs text-slate-600">
                  Проверка сроков действия удостоверений и категорий сложности маршрутов
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('overview', { subTab: 'monitoring' })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Опросы и статистика центра</span>
                  <ArrowRight className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                </button>
              )}
              <Award className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
            </div>
          </div>
          <CertifiedGuidesRegistryTable />
          <OverviewDemoCertificateSection />
        </div>
      )}
    </section>
  );
}

/** «Консалтинг» — services offered by the centre. */
export function ConsultingSection() {
  return (
    <section className="space-y-6">
      <SectionHeading
        id="consulting"
        eyebrow="Консалтинг"
        title="Услуги центра"
        lead="Методическая и документальная поддержка туроператоров, гидов и организаций активного туризма."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {CONSULTING_SERVICES.map((service) => (
          <article
            key={service.title}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <h3 className="text-sm font-bold text-slate-900 leading-snug">{service.title}</h3>
            <ul className="space-y-2.5">
              {service.points.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed"
                >
                  <CheckCircle2
                    className="w-4 h-4 text-teal-700 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

/** «Связь» — contact details and messengers. */
export function ContactsSection() {
  return (
    <section className="space-y-6">
      <SectionHeading
        id="contacts"
        eyebrow="Связь"
        title="Контакты центра"
        lead="Позвоните, напишите на почту или в мессенджеры — ответим на вопросы об обучении и аттестации."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a
          href={`tel:${CONTACTS.phone.replace(/[^+\d]/g, '')}`}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-2 hover:border-teal-300 transition-colors"
        >
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Phone className="w-3.5 h-3.5" aria-hidden="true" />
            Телефон
          </span>
          <p className="text-sm font-semibold text-slate-900 font-mono tabular-nums">
            {CONTACTS.phone}
          </p>
        </a>

        <a
          href={`mailto:${CONTACTS.email}`}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-2 hover:border-teal-300 transition-colors"
        >
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Mail className="w-3.5 h-3.5" aria-hidden="true" />
            Почта
          </span>
          <p className="text-sm font-semibold text-slate-900 break-all">{CONTACTS.email}</p>
        </a>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
            Адрес
          </span>
          <p className="text-sm font-semibold text-slate-900">{CONTACTS.address}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {CONTACTS.messengers.map((messenger) => (
          <a
            key={messenger.label}
            href={messenger.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            {messenger.label}
          </a>
        ))}
      </div>

      <p className="text-xs text-slate-500">{CONTACTS.copyright}</p>
    </section>
  );
}

/**
 * Объединённый раздел «FAQ, консалтинг и связь» для верхнего меню «FAQ и связь».
 * Сводит частые вопросы, методический консалтинг (форма 760), контакты центра и форму обратной связи.
 */
type HelpSubTabId = 'faq' | 'consulting' | 'contacts';

const VALID_HELP_SUBTABS = new Set<HelpSubTabId>(['faq', 'consulting', 'contacts']);

function resolveHelpSubTab(sub?: string): HelpSubTabId {
  if (sub && VALID_HELP_SUBTABS.has(sub as HelpSubTabId)) {
    return sub as HelpSubTabId;
  }
  return 'faq';
}

export function HelpAndContactsWorkspace({
  initialSubTab = 'faq',
  onNavigateTab,
  onSubTabChange,
}: {
  initialSubTab?: string;
  onNavigateTab?: (tab: SiteTabId, options?: NavigateOptions) => void;
  onSubTabChange?: (subTab: string) => void;
}) {
  const [subTab, setSubTab] = useState<HelpSubTabId>(() => resolveHelpSubTab(initialSubTab));

  useEffect(() => {
    setSubTab(resolveHelpSubTab(initialSubTab));
  }, [initialSubTab]);

  const selectSubTab = (next: HelpSubTabId) => {
    setSubTab(next);
    onSubTabChange?.(next);
  };

  const handleOpenAttestationAssistant = (customPrompt?: string) => {
    const prompt = customPrompt ?? FAQ_ATTESTATION_ASSISTANT_PROMPT;
    tracker.trackCustomInteraction('FAQ и связь · Открыть Виртуального ассистента', 'faq');
    dispatchOpenRcaAssistant({
      prompt,
      mode: 'rag',
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl px-6 py-4">
        <div>
          <p className="text-xs font-medium text-teal-700">Справочный и контактный центр РЦА</p>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">
            Частые вопросы, консалтинг (форма 760) и обратная связь
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="tablist"
            aria-label="Подразделы помощи и контактов"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {(
              [
                { id: 'faq', label: 'Частые вопросы (FAQ)' },
                { id: 'consulting', label: 'Консалтинг и форма 760' },
                { id: 'contacts', label: 'Контакты и обратная связь' },
              ] as const
            ).map((tab) => {
              const active = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    selectSubTab(tab.id);
                    tracker.trackCustomInteraction(`FAQ и связь · ${tab.label}`, 'faq');
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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

          <button
            type="button"
            onClick={() => handleOpenAttestationAssistant()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <Bot className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
            <span>Виртуальный ассистент</span>
          </button>
        </div>
      </div>

      {subTab === 'faq' && (
        <FAQSection
          onNavigateToContacts={() => selectSubTab('contacts')}
          onNavigateToCertification={
            onNavigateTab ? () => onNavigateTab('certification', { subTab: 'schedule' }) : undefined
          }
          onOpenAssistant={handleOpenAttestationAssistant}
        />
      )}

      {subTab === 'consulting' && <ConsultingSection />}

      {subTab === 'contacts' && (
        <div className="space-y-8">
          <ContactsSection />
          <PlatformFeedbackForm
            onOpenCuratorModal={(sourceLabel) =>
              dispatchOpenRcaAssistant({
                prompt: `Консультация куратора (${sourceLabel}): подскажите порядок действий по моему вопросу.`,
                mode: 'rag',
              })
            }
          />
        </div>
      )}
    </div>
  );
}

/** Renders the sections requested by the landing router. */
export function LandingSections({ sections }: { sections: readonly LandingSection[] }) {
  return (
    <div className="space-y-16">
      {sections.map((section) => {
        switch (section.id) {
          case 'learning':
            return <LearningSection key={section.id} />;
          case 'preparation':
            return <PreparationSection key={section.id} />;
          case 'certification':
            return <CertificationSection key={section.id} />;
          case 'consulting':
            return <ConsultingSection key={section.id} />;
          case 'faq':
            return <FAQSection key={section.id} />;
          case 'contacts':
            return <ContactsSection key={section.id} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
