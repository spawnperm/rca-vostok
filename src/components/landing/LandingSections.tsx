import React, { useState } from 'react';
import {
  BookOpen,
  CalendarPlus,
  Camera,
  Check,
  CheckCircle2,
  Compass,
  ExternalLink,
  Flag,
  Map,
  Phone,
  Mail,
  MapPin,
  Signpost,
  Tent,
  Waves,
  CalendarDays,
  MessageCircle,
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
  downloadCalendarIcs,
} from '../../utils/attestationCalendar';
import { tracker } from '../../utils/tracker';

/**
 * Landing sections imported from rca-vostok.ru.
 *
 * The public website is the authoritative source for this wording; these
 * components render that content with the platform's design system instead of
 * duplicating the original site's markup. Every section is anchored by its id
 * so the top navigation can jump to it.
 */

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

/** Hero block matching the site's headline and call to action. */
export function LandingHero({ onNavigate }: { onNavigate: (id: string) => void }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-800 via-teal-700 to-slate-800 text-white">
      <div className="relative px-8 py-14 sm:px-12 sm:py-20 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">
          {HERO.eyebrow}
        </p>
        <h1 className="mt-4 text-3xl sm:text-4xl font-bold leading-tight text-balance">
          {HERO.title}
        </h1>
        <p className="mt-4 text-base sm:text-lg text-teal-50/90">{HERO.text}</p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('learning')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-teal-900 text-sm font-semibold rounded-lg hover:bg-teal-50 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Compass className="w-4 h-4" aria-hidden="true" />
            Программы обучения
          </button>
          <button
            type="button"
            onClick={() => onNavigate('contacts')}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/40 text-sm font-semibold rounded-lg hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Phone className="w-4 h-4" aria-hidden="true" />
            Связаться
          </button>
        </div>

        <a
          href={SITE_ANNOUNCEMENT.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex items-center gap-2 text-xs font-medium text-teal-100 hover:text-white underline underline-offset-2"
        >
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400" aria-hidden="true" />
          {SITE_ANNOUNCEMENT.text}
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

/** «Реализуемые программы» — four programme cards. */
export function LearningSection() {
  return (
    <section className="space-y-6">
      <SectionHeading
        id="learning"
        eyebrow="Обучение"
        title="Реализуемые программы"
        lead="Профессиональная подготовка по направлениям, востребованным в активном туризме Приморья и ДФО."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PROGRAMMES.map((programme) => {
          const Icon = PROGRAMME_ICONS[programme.icon] ?? Compass;
          return (
            <article
              key={programme.title}
              className="flex items-start gap-4 bg-white border border-slate-200 rounded-xl p-5 hover:border-teal-300 transition-colors"
            >
              <span className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-teal-700" aria-hidden="true" />
              </span>
              <h3 className="text-sm font-semibold text-slate-900 leading-snug pt-2">
                {programme.title}
              </h3>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** «Практика по пешеходному туризму» — preparation stages. */
export function PreparationSection() {
  return (
    <section className="space-y-6">
      <SectionHeading
        id="preparation"
        eyebrow="Подготовка"
        title="Практика по пешеходному туризму"
        lead="Путь кандидата от теоретической подготовки до зачётного категорийного похода."
      />

      <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PREPARATION_STEPS.map((step, index) => {
          const Icon = STEP_ICONS[step.icon] ?? BookOpen;
          return (
            <li
              key={step.title}
              className="relative bg-white border border-slate-200 rounded-xl p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-slate-700" aria-hidden="true" />
                </span>
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** «График аттестаций на 2027 год» plus .ics calendar export & external ФСТР link. */
export function CertificationSection() {
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number>(0);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

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
      <SectionHeading
        id="certification"
        eyebrow="Аттестация"
        title="График ближайших аттестаций на 2027 год"
        lead="Сессии категории 1–4 КС. Выберите дату в таблице и нажмите «Добавить в календарь», чтобы экспортировать событие в формате .ics для Google или Яндекс Календаря."
      />

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

          <span className="text-xs text-slate-600">
            Выбрано:{' '}
            <strong className="font-semibold text-slate-900">
              {formatSessionRange(activeSlot.start, activeSlot.end)}
            </strong>{' '}
            · файл <code className="font-mono text-[11px]">.ics</code> подходит для Google и Яндекс
            Календаря
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
                <li key={point} className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed">
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
          <p className="text-sm font-semibold text-slate-900">{CONTACTS.phone}</p>
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
          case 'contacts':
            return <ContactsSection key={section.id} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
