import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarPlus,
  CheckCircle2,
  Clock,
  MessageSquare,
  Send,
  UserCheck,
  Video,
  X,
} from 'lucide-react';
import {
  ATTESTATION_CALENDAR_EVENTS,
  downloadCalendarIcs,
  type AttestationCalendarEvent,
} from '../utils/attestationCalendar';
import { tracker } from '../utils/tracker';

export interface PreparationWebinarItem {
  id: string;
  title: string;
  topicGroup: 'documents' | 'experience' | 'safety';
  topicLabel: string;
  dateIso: string;
  dateDisplay: string;
  timeLabel: string;
  durationMinutes: number;
  speaker: string;
  audience: string;
  summary: string;
  seatsRemaining: number;
  calendarEvent: AttestationCalendarEvent;
}

const RAW_WEBINAR_EVENTS: readonly PreparationWebinarItem[] = [
  ...ATTESTATION_CALENDAR_EVENTS.filter((ev) => ev.kind === 'webinar').map((ev): PreparationWebinarItem => {
    const topicGroup: PreparationWebinarItem['topicGroup'] = ev.id.includes('760')
      ? 'documents'
      : ev.id.includes('contour')
      ? 'experience'
      : 'safety';
    const topicLabel =
      topicGroup === 'documents'
        ? 'Паспорт маршрута и НПА'
        : topicGroup === 'experience'
        ? 'Контур А и зачёт стажа'
        : 'Практика, WFA и полигон';

    const [y, m, d] = ev.startDateIso.split('-');
    return {
      id: ev.id,
      title: ev.title.replace(/^Вебинар(-инструктаж)?:\s*/i, ''),
      topicGroup,
      topicLabel,
      dateIso: ev.startDateIso,
      dateDisplay: `${d}.${m}.${y}`,
      timeLabel: `${ev.startTimeVld} ВЛД`,
      durationMinutes: ev.durationMinutes,
      speaker: ev.organizer,
      audience: ev.regionLabel,
      summary: ev.description,
      seatsRemaining: ev.id.includes('760') ? 14 : ev.id.includes('contour') ? 19 : 22,
      calendarEvent: ev,
    };
  }),
  {
    id: 'cal-webinar-water-law',
    title: 'Водный туризм и сплавы: разбор требований ПП РФ № 1003, лоции и допуска по 1–3 КС',
    topicGroup: 'documents',
    topicLabel: 'Паспорт маршрута и НПА',
    dateIso: '2027-01-21',
    dateDisplay: '21.01.2027',
    timeLabel: '19:00 ВЛД',
    durationMinutes: 90,
    speaker: 'Андрей Киселёв · Эксперт ФСТР (водный туризм)',
    audience: 'Онлайн (весь ДФО)',
    summary:
      'Разбор критериев аттестации водных инструкторов-проводников: оформление лоции реки, страховка с берега, экипажное снаряжение и программа ВВГУ (10 мест).',
    seatsRemaining: 11,
    calendarEvent: {
      id: 'cal-webinar-water-law',
      kind: 'webinar',
      kindLabel: 'Обучающий вебинар',
      title: 'Вебинар: Водный туризм и сплавы — разбор требований ПП РФ № 1003 и 1–3 КС',
      shortTitle: 'Вебинар: Водный туризм',
      startDateIso: '2027-01-21',
      endDateIso: '2027-01-21',
      startTimeVld: '19:00',
      durationMinutes: 90,
      regionLabel: 'Онлайн (весь ДФО)',
      formatLabel: 'Онлайн-вебинар · 19:00 ВЛД (12:00 МСК)',
      location: 'Видеоконференция РЦА «Русский Восток»',
      organizer: 'Андрей Киселёв · Эксперт ФСТР',
      description:
        'Критерии аттестации водных инструкторов-проводников, оформление лоции реки и подготовка к практическому этапу.',
      inquiryRegion: 'Приморский край',
      inquiryTrack: 'Водный туризм и сплавы',
    },
  },
];

const WEBINAR_EVENTS: readonly PreparationWebinarItem[] = [...RAW_WEBINAR_EVENTS].sort((a, b) =>
  a.dateIso.localeCompare(b.dateIso)
);

const TOPIC_FILTERS: readonly {
  id: 'all' | PreparationWebinarItem['topicGroup'];
  label: string;
}[] = [
  { id: 'all', label: `Все вебинары (${WEBINAR_EVENTS.length})` },
  { id: 'documents', label: 'Паспорт маршрута и НПА' },
  { id: 'experience', label: 'Контур А и стаж' },
  { id: 'safety', label: 'Практика и WFA' },
];

const WEBINAR_REG_STORAGE_KEY = 'rca_registered_webinars_v1';

interface OverviewWebinarsScheduleProps {
  onRegistered?: () => void;
  onContactCurator: (sourceLabel: string) => void;
}

export const OverviewWebinarsSchedule: React.FC<OverviewWebinarsScheduleProps> = ({
  onRegistered,
  onContactCurator,
}) => {
  const [topicFilter, setTopicFilter] = useState<'all' | PreparationWebinarItem['topicGroup']>(
    'all'
  );
  const [activeWebinarId, setActiveWebinarId] = useState<string | null>(null);
  const [registeredIds, setRegisteredIds] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(WEBINAR_REG_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });

  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [region, setRegion] = useState<string>('Приморский край');
  const [contactChannel, setContactChannel] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [justRegisteredTitle, setJustRegisteredTitle] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(WEBINAR_REG_STORAGE_KEY, JSON.stringify(registeredIds));
    } catch {
      // ignore storage errors
    }
  }, [registeredIds]);

  const filteredWebinars = useMemo(() => {
    if (topicFilter === 'all') return WEBINAR_EVENTS;
    return WEBINAR_EVENTS.filter((w) => w.topicGroup === topicFilter);
  }, [topicFilter]);

  const openRegistration = (webinar: PreparationWebinarItem) => {
    setError(null);
    setJustRegisteredTitle(null);
    setActiveWebinarId((cur) => (cur === webinar.id ? null : webinar.id));
    tracker.trackCustomInteraction('Вебинары РЦА: открыта форма записи', webinar.dateIso);
  };

  const handleSubmitRegistration = async (
    e: React.FormEvent<HTMLFormElement>,
    webinar: PreparationWebinarItem
  ) => {
    e.preventDefault();
    setError(null);

    if (fullName.trim().length < 2) {
      setError('Укажите ваше имя или ФИО (минимум 2 символа).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Укажите корректный email для получения ссылки на вебинар.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          contactChannel: contactChannel.trim(),
          region,
          track: `Онлайн-вебинар (${webinar.dateDisplay}): ${webinar.title.slice(0, 80)}`,
          experienceNote: `Запись на онлайн-вебинар ${webinar.dateDisplay} (${webinar.timeLabel}). Спикер: ${webinar.speaker}.`,
          sessionDate: webinar.dateIso,
          consentAccepted: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Не удалось подтвердить запись на вебинар.');
      }

      setRegisteredIds((prev) => (prev.includes(webinar.id) ? prev : [...prev, webinar.id]));
      setJustRegisteredTitle(webinar.title);
      setActiveWebinarId(null);
      onRegistered?.();
      tracker.trackCustomInteraction(
        `Вебинары РЦА: успешная запись (${webinar.dateIso})`,
        region
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки записи.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="overview-webinars-schedule"
      aria-labelledby="overview-webinars-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Онлайн-подготовка к экзамену · Весь ДФО</span>
          </p>
          <h2 id="overview-webinars-heading" className="text-xl font-bold text-slate-900 text-balance">
            Расписание онлайн-вебинаров для подготовки к аттестации
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Открытые методические вебинары экспертов ВВГУ и ФСТР. Выберите интересующую тему и
            запишитесь на трансляцию в один клик.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div
            role="tablist"
            aria-label="Фильтр онлайн-вебинаров"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {TOPIC_FILTERS.map((tab) => {
              const active = topicFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTopicFilter(tab.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
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
      </div>

      {justRegisteredTitle && (
        <div
          role="status"
          className="px-4 py-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-950 flex flex-wrap items-center justify-between gap-2"
        >
          <span className="inline-flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
            <span>
              Вы записаны на вебинар «{justRegisteredTitle}». Ссылка на подключение будет
              направлена на указанную почту.
            </span>
          </span>
          <button
            type="button"
            onClick={() => setJustRegisteredTitle(null)}
            aria-label="Скрыть уведомление о записи"
            className="p-1 text-teal-800 hover:text-teal-950 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="divide-y divide-slate-200 border-y border-slate-200">
        {filteredWebinars.map((webinar) => {
          const isRegistered = registeredIds.includes(webinar.id);
          const isFormOpen = activeWebinarId === webinar.id;

          return (
            <article key={webinar.id} className="py-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 min-w-0 flex-1">
                  <div className="sm:w-36 shrink-0 space-y-0.5 pt-0.5">
                    <p className="text-sm font-mono font-bold text-slate-900 tabular-nums">
                      {webinar.dateDisplay}
                    </p>
                    <p className="text-xs font-mono text-teal-700 tabular-nums inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span>{webinar.timeLabel}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                      {webinar.durationMinutes} мин
                    </p>
                  </div>

                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium text-teal-800">{webinar.topicLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{webinar.audience}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        мест: {webinar.seatsRemaining}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-slate-900 leading-snug">
                      {webinar.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
                      {webinar.summary}
                    </p>

                    <p className="text-xs text-slate-500">
                      Ведущий: <span className="font-medium text-slate-800">{webinar.speaker}</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 lg:pt-1">
                  <button
                    type="button"
                    onClick={() => downloadCalendarIcs(webinar.calendarEvent, 60)}
                    title="Скачать напоминание .ics"
                    className="px-3 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  >
                    <CalendarPlus className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                    <span>В календарь (.ics)</span>
                  </button>

                  {isRegistered ? (
                    <button
                      type="button"
                      onClick={() => openRegistration(webinar)}
                      className="px-4 py-2 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold rounded-lg hover:bg-emerald-100 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                      <span>Вы записаны</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-expanded={isFormOpen}
                      onClick={() => openRegistration(webinar)}
                      className="px-4 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                    >
                      <Send className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{isFormOpen ? 'Скрыть форму' : 'Записаться'}</span>
                    </button>
                  )}
                </div>
              </div>

              {isFormOpen && (
                <form
                  onSubmit={(e) => handleSubmitRegistration(e, webinar)}
                  noValidate
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-slate-900">
                      Быстрая запись на вебинар · {webinar.dateDisplay} ({webinar.timeLabel})
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveWebinarId(null)}
                      aria-label="Закрыть форму записи на вебинар"
                      className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label
                        htmlFor={`web-name-${webinar.id}`}
                        className="block text-[11px] font-semibold text-slate-700"
                      >
                        Имя или ФИО <span className="text-red-700">*</span>
                      </label>
                      <input
                        id={`web-name-${webinar.id}`}
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Алексей Смирнов"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor={`web-email-${webinar.id}`}
                        className="block text-[11px] font-semibold text-slate-700"
                      >
                        Email для ссылки <span className="text-red-700">*</span>
                      </label>
                      <input
                        id={`web-email-${webinar.id}`}
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="guide@example.ru"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor={`web-region-${webinar.id}`}
                        className="block text-[11px] font-semibold text-slate-700"
                      >
                        Регион ДФО
                      </label>
                      <select
                        id={`web-region-${webinar.id}`}
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                      >
                        <option value="Приморский край">Приморский край</option>
                        <option value="Хабаровский край">Хабаровский край</option>
                        <option value="Камчатский край">Камчатский край</option>
                        <option value="Сахалинская область">Сахалинская область</option>
                        <option value="Амурская область">Амурская область</option>
                        <option value="Республика Саха (Якутия)">Республика Саха (Якутия)</option>
                        <option value="Другой регион ДФО">Другой регион ДФО</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor={`web-contact-${webinar.id}`}
                        className="block text-[11px] font-semibold text-slate-700"
                      >
                        Telegram / телефон
                      </label>
                      <input
                        id={`web-contact-${webinar.id}`}
                        type="text"
                        value={contactChannel}
                        onChange={(e) => setContactChannel(e.target.value)}
                        placeholder="@nick или +7 ..."
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                      />
                    </div>
                  </div>

                  {error && (
                    <p role="alert" className="text-xs text-red-700 font-medium">
                      {error}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-500">
                      Запись фиксируется в журнале РЦА; уведомление придёт за 1 час до начала.
                    </span>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
                      <span>{submitting ? 'Регистрация…' : 'Подтвердить запись'}</span>
                    </button>
                  </div>
                </form>
              )}
            </article>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <span>
          Участие в методических онлайн-вебинарах РЦА «Русский Восток» для соискателей из ДФО —
          бесплатное по предварительной записи.
        </span>
        <button
          type="button"
          onClick={() => onContactCurator('Расписание онлайн-вебинаров')}
          className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Предложить тему вебинара</span>
        </button>
      </div>
    </section>
  );
};
