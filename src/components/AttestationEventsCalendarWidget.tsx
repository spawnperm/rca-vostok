import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  MapPin,
  MessageSquare,
  Send,
  Video,
} from 'lucide-react';
import {
  ATTESTATION_CALENDAR_EVENTS,
  buildCalendarMonthCells,
  buildGoogleCalendarUrl,
  CALENDAR_KEY_MONTHS,
  downloadCalendarIcs,
  getEventsForDate,
  type AttestationCalendarEvent,
  type CalendarEventKind,
} from '../utils/attestationCalendar';
import { tracker } from '../utils/tracker';

const WEEKDAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;
const REMINDER_STORAGE_KEY = 'rca_calendar_reminders_v1';

interface AttestationEventsCalendarWidgetProps {
  onApplyForSession?: (regionName: string, trackName: string) => void;
  onContactCurator: (sourceLabel: string) => void;
}

export const AttestationEventsCalendarWidget: React.FC<
  AttestationEventsCalendarWidgetProps
> = ({ onApplyForSession, onContactCurator }) => {
  const [kindFilter, setKindFilter] = useState<'all' | CalendarEventKind>('all');
  const [monthIdx, setMonthIdx] = useState<number>(0); // Default: Декабрь 2026
  const [selectedEventId, setSelectedEventId] = useState<string>(
    ATTESTATION_CALENDAR_EVENTS[0].id
  );
  const [reminderLeadMinutes, setReminderLeadMinutes] = useState<number>(1440); // 1 day
  const [savedReminderIds, setSavedReminderIds] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(REMINDER_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(savedReminderIds));
    } catch {
      // ignore storage errors
    }
  }, [savedReminderIds]);

  const filteredEvents = useMemo(() => {
    if (kindFilter === 'all') return ATTESTATION_CALENDAR_EVENTS;
    return ATTESTATION_CALENDAR_EVENTS.filter((e) => e.kind === kindFilter);
  }, [kindFilter]);

  const currentMonth = CALENDAR_KEY_MONTHS[monthIdx] ?? CALENDAR_KEY_MONTHS[0];

  const monthCells = useMemo(
    () => buildCalendarMonthCells(currentMonth.year, currentMonth.month),
    [currentMonth.year, currentMonth.month]
  );

  const selectedEvent = useMemo(
    () =>
      filteredEvents.find((e) => e.id === selectedEventId) ??
      filteredEvents[0] ??
      ATTESTATION_CALENDAR_EVENTS[0],
    [filteredEvents, selectedEventId]
  );

  const selectEventAndSyncMonth = (ev: AttestationCalendarEvent) => {
    setSelectedEventId(ev.id);
    const [ey, em] = ev.startDateIso.split('-').map(Number);
    const idx = CALENDAR_KEY_MONTHS.findIndex(
      (m) => m.year === ey && m.month === em - 1
    );
    if (idx >= 0) {
      setMonthIdx(idx);
    }
    setDownloadNotice(null);
    tracker.trackCustomInteraction(`Календарь событий: ${ev.shortTitle}`, ev.startDateIso);
  };

  const handleToggleOnSiteReminder = (ev: AttestationCalendarEvent) => {
    setSavedReminderIds((prev) => {
      const exists = prev.includes(ev.id);
      const next = exists ? prev.filter((id) => id !== ev.id) : [...prev, ev.id];
      tracker.trackCustomInteraction(
        exists ? `Снято напоминание: ${ev.shortTitle}` : `Добавлено напоминание: ${ev.shortTitle}`,
        ev.startDateIso
      );
      return next;
    });
  };

  const handleDownloadIcs = (ev: AttestationCalendarEvent) => {
    const fileName = downloadCalendarIcs(ev, reminderLeadMinutes);
    if (!savedReminderIds.includes(ev.id)) {
      setSavedReminderIds((prev) => [...prev, ev.id]);
    }
    setDownloadNotice(`Файл ${fileName} скачан — откройте его для импорта в календарь.`);
    tracker.trackCustomInteraction(
      `Экспорт напоминания .ics: ${ev.shortTitle}`,
      `${reminderLeadMinutes} мин`
    );
  };

  const googleCalendarUrl = useMemo(
    () => buildGoogleCalendarUrl(selectedEvent),
    [selectedEvent]
  );

  const isSavedOnSite = savedReminderIds.includes(selectedEvent.id);

  return (
    <section
      aria-labelledby="attestation-events-calendar-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header & Event Kind Filters */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1 max-w-3xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Планировщик соискателя · Сессии и онлайн-вебинары 2026–2027</span>
          </p>
          <h2 id="attestation-events-calendar-heading" className="text-xl font-bold text-slate-900">
            Интерактивный календарь аттестационных сессий и обучающих вебинаров
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Выберите дату на календарной сетке, чтобы ознакомиться с программой вебинара или
            экзаменационной сессии и добавить напоминание в свой личный календарь (.ics или Google
            Календарь).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 border border-amber-200 text-amber-900 rounded-lg font-mono tabular-nums">
            <BellRing className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
            <span>Напоминания: {savedReminderIds.length}</span>
          </span>

          <div
            role="group"
            aria-label="Фильтр событий календаря"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {(
              [
                { id: 'all', label: `Все (${ATTESTATION_CALENDAR_EVENTS.length})` },
                { id: 'session', label: 'Сессии аттестации' },
                { id: 'webinar', label: 'Вебинары' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setKindFilter(tab.id);
                  tracker.trackCustomInteraction(`Фильтр календаря: ${tab.label}`);
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
      </div>

      {/* Main Split: Calendar Month Grid (6 cols) + Event & Reminder Inspector (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Month Calendar Grid */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
            {/* Month Controls */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={monthIdx === 0}
                onClick={() => setMonthIdx((i) => Math.max(0, i - 1))}
                aria-label="Предыдущий месяц"
                className="p-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>

              <p className="text-base font-bold text-slate-900">{currentMonth.fullLabel}</p>

              <button
                type="button"
                disabled={monthIdx >= CALENDAR_KEY_MONTHS.length - 1}
                onClick={() =>
                  setMonthIdx((i) => Math.min(CALENDAR_KEY_MONTHS.length - 1, i + 1))
                }
                aria-label="Следующий месяц"
                className="p-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Quick Month Jump Strip */}
            <div className="flex flex-wrap gap-1.5">
              {CALENDAR_KEY_MONTHS.map((m, idx) => (
                <button
                  key={`${m.year}-${m.month}`}
                  type="button"
                  onClick={() => setMonthIdx(idx)}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded-md border transition-colors cursor-pointer ${
                    monthIdx === idx
                      ? 'bg-slate-900 border-slate-900 text-white font-semibold'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-teal-600'
                  }`}
                >
                  {m.shortLabel}
                </button>
              ))}
            </div>

            {/* Weekday Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500 pt-1">
              {WEEKDAYS_RU.map((wd) => (
                <div key={wd} className="py-1">
                  {wd}
                </div>
              ))}
            </div>

            {/* Day Cells */}
            <div className="grid grid-cols-7 gap-1">
              {monthCells.map((cell) => {
                const dayEvents = getEventsForDate(cell.isoDate, filteredEvents);
                const hasSession = dayEvents.some((e) => e.kind === 'session');
                const hasWebinar = dayEvents.some((e) => e.kind === 'webinar');
                const isSelectedDay = dayEvents.some((e) => e.id === selectedEvent.id);
                const hasReminder = dayEvents.some((e) => savedReminderIds.includes(e.id));

                return (
                  <button
                    key={cell.isoDate}
                    type="button"
                    disabled={dayEvents.length === 0}
                    onClick={() => {
                      if (dayEvents[0]) {
                        selectEventAndSyncMonth(dayEvents[0]);
                      }
                    }}
                    title={dayEvents.map((e) => e.shortTitle).join(', ') || undefined}
                    className={`relative h-11 rounded-lg border text-xs font-mono tabular-nums flex flex-col items-center justify-center gap-0.5 transition-colors ${
                      !cell.inCurrentMonth ? 'opacity-40' : ''
                    } ${
                      isSelectedDay
                        ? 'bg-teal-700 border-teal-800 text-white font-bold shadow-xs cursor-pointer'
                        : dayEvents.length > 0
                        ? hasWebinar && !hasSession
                          ? 'bg-sky-50 border-sky-300 text-sky-900 font-semibold hover:bg-sky-100 cursor-pointer'
                          : 'bg-teal-50 border-teal-300 text-teal-900 font-semibold hover:bg-teal-100 cursor-pointer'
                        : 'bg-white border-slate-200/80 text-slate-500 cursor-default'
                    }`}
                  >
                    <span>{cell.dayOfMonth}</span>
                    {dayEvents.length > 0 && (
                      <span className="flex items-center gap-0.5">
                        {hasSession && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelectedDay ? 'bg-white' : 'bg-teal-700'
                            }`}
                            aria-hidden="true"
                          />
                        )}
                        {hasWebinar && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelectedDay ? 'bg-sky-200' : 'bg-sky-600'
                            }`}
                            aria-hidden="true"
                          />
                        )}
                        {hasReminder && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelectedDay ? 'bg-amber-300' : 'bg-amber-500'
                            }`}
                            aria-hidden="true"
                          />
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-200 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-700" aria-hidden="true" />
                Аттестационная сессия
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-600" aria-hidden="true" />
                Обучающий вебинар
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
                Добавлено напоминание
              </span>
            </div>
          </div>
        </div>

        {/* Right: Selected Event Details + Calendar Export */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
                  selectedEvent.kind === 'webinar'
                    ? 'bg-sky-50 border-sky-200 text-sky-900'
                    : 'bg-teal-50 border-teal-200 text-teal-800'
                }`}
              >
                {selectedEvent.kind === 'webinar' ? (
                  <Video className="w-3.5 h-3.5 text-sky-700" aria-hidden="true" />
                ) : (
                  <CalendarDays className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                )}
                <span>{selectedEvent.kindLabel}</span>
              </span>

              <span className="text-xs font-mono font-semibold text-slate-700 tabular-nums">
                {selectedEvent.startDateIso === selectedEvent.endDateIso
                  ? selectedEvent.startDateIso
                  : `${selectedEvent.startDateIso} — ${selectedEvent.endDateIso}`}
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              {selectedEvent.title}
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {selectedEvent.description}
            </p>

            <dl className="divide-y divide-slate-200 border-y border-slate-200 text-xs">
              <div className="py-2.5 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3">
                <dt className="text-slate-500 inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                  <span>Время и формат</span>
                </dt>
                <dd className="sm:col-span-2 font-medium text-slate-900">
                  {selectedEvent.formatLabel}
                </dd>
              </div>

              <div className="py-2.5 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3">
                <dt className="text-slate-500 inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                  <span>Площадка</span>
                </dt>
                <dd className="sm:col-span-2 text-slate-800">{selectedEvent.location}</dd>
              </div>

              <div className="py-2.5 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3">
                <dt className="text-slate-500">Ведущий / комиссия</dt>
                <dd className="sm:col-span-2 font-medium text-slate-900">
                  {selectedEvent.organizer}
                </dd>
              </div>
            </dl>

            {/* Add Reminder to Calendar Box */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-900 inline-flex items-center gap-1.5">
                  <CalendarPlus className="w-4 h-4 text-teal-700" aria-hidden="true" />
                  <span>Добавить напоминание в личный календарь</span>
                </p>

                <label className="text-[11px] text-slate-600 inline-flex items-center gap-1.5">
                  <span>Уведомить:</span>
                  <select
                    value={reminderLeadMinutes}
                    onChange={(e) => setReminderLeadMinutes(Number(e.target.value))}
                    className="px-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded text-slate-800 font-medium focus:outline-none focus:border-teal-700"
                  >
                    <option value={60}>за 1 час</option>
                    <option value={1440}>за 1 день</option>
                    <option value={4320}>за 3 дня</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadIcs(selectedEvent)}
                  className="px-3.5 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Добавить в календарь (.ics)</span>
                </button>

                <a
                  href={googleCalendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    tracker.trackCustomInteraction(
                      `Google Календарь: ${selectedEvent.shortTitle}`,
                      selectedEvent.startDateIso
                    )
                  }
                  className="px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
                >
                  <span>Google Календарь</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" aria-hidden="true" />
                </a>

                <span className="text-[11px] text-slate-500">
                  Формат <code className="font-mono">.ics</code> поддерживается Google, Яндекс
                  Календарём и Apple
                </span>

                <button
                  type="button"
                  onClick={() => handleToggleOnSiteReminder(selectedEvent)}
                  aria-pressed={isSavedOnSite}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                    isSavedOnSite
                      ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {isSavedOnSite ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
                      <span>Напоминание сохранено</span>
                    </>
                  ) : (
                    <>
                      <Bell className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                      <span>Отметить на сайте</span>
                    </>
                  )}
                </button>
              </div>

              {downloadNotice && (
                <p role="status" className="text-[11px] text-teal-800 font-medium">
                  {downloadNotice}
                </p>
              )}
            </div>

            {/* Action buttons for inquiry or curator */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  onContactCurator(
                    `Календарь: ${selectedEvent.shortTitle} (${selectedEvent.startDateIso})`
                  )
                }
                className="px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                <span>Задать вопрос ведущему</span>
              </button>

              {onApplyForSession && (
                <button
                  type="button"
                  onClick={() =>
                    onApplyForSession(selectedEvent.inquiryRegion, selectedEvent.inquiryTrack)
                  }
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
                  <span>Записаться на участие</span>
                </button>
              )}
            </div>
          </div>

          {/* Upcoming Events Strip */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex items-center justify-between">
              <span>Список предстоящих сессий и вебинаров</span>
              <span className="font-mono text-slate-500 tabular-nums">
                {filteredEvents.length} мероприятий
              </span>
            </div>
            <div className="divide-y divide-slate-200 max-h-[195px] overflow-y-auto">
              {filteredEvents.map((ev) => {
                const isSelected = ev.id === selectedEvent.id;
                const isReminded = savedReminderIds.includes(ev.id);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => selectEventAndSyncMonth(ev)}
                    className={`w-full px-4 py-2.5 text-left text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected ? 'bg-teal-50/80 font-semibold text-slate-900' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          ev.kind === 'webinar' ? 'bg-sky-600' : 'bg-teal-700'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="font-mono text-[11px] text-slate-500 shrink-0 tabular-nums">
                        {ev.startDateIso}
                      </span>
                      <span className="truncate">{ev.shortTitle}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 shrink-0">
                      {isReminded && (
                        <BellRing className="w-3.5 h-3.5 text-amber-600" aria-label="Напоминание включено" />
                      )}
                      <span className="text-[11px] text-slate-500">
                        {ev.kind === 'webinar' ? 'Вебинар' : 'Сессия'}
                      </span>
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
