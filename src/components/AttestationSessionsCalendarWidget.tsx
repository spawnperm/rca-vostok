import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  LogIn,
  MapPin,
} from 'lucide-react';
import type { SessionUser } from '../utils/identityApi';
import {
  buildMonthCalendarGrid,
  getDefaultCalendarMonth,
  getSessionMonths,
  getUpcomingAttestationSessions,
  formatMonthTitleRu,
  WEEKDAYS_SHORT_RU,
  type UpcomingSessionView,
} from '../utils/attestationCalendarBooking';
import {
  buildScheduleSlotCalendarEvent,
  downloadCalendarIcs,
} from '../utils/attestationCalendar';
import { tracker } from '../utils/tracker';
import type { InquiryRecord } from './social/MyInquiriesSection';

interface AttestationSessionsCalendarWidgetProps {
  user: SessionUser | null;
  inquiries: InquiryRecord[];
  selectedExamDate?: string;
  onSessionBooked?: (sessionDateIso: string) => void;
  onSelectExamDate?: (sessionDateIso: string) => void;
  onJumpToInquiries?: () => void;
  onFocusAuth?: () => void;
}

const DISCIPLINE_TO_TRACK: Record<string, string> = {
  пешеходный: 'Пешеходный туризм',
  водный: 'Водный туризм',
  'пешеходный + водный': 'Пешеходный + водный туризм',
  спелеологический: 'Спелеологический туризм',
  горный: 'Горный туризм',
  'пешеходный + горный': 'Пешеходный + горный туризм',
  'пешеходный + спелеологический': 'Пешеходный + спелеологический туризм',
};

const INQUIRY_STATUS_RU: Record<InquiryRecord['status'], string> = {
  new: 'Новая',
  in_review: 'На рассмотрении',
  needs_documents: 'Требуются документы',
  approved: 'Одобрено',
  rejected: 'Отклонено',
};

export const AttestationSessionsCalendarWidget: React.FC<
  AttestationSessionsCalendarWidgetProps
> = ({
  user,
  inquiries,
  selectedExamDate,
  onSessionBooked,
  onSelectExamDate,
  onJumpToInquiries,
  onFocusAuth,
}) => {
  const sessions = useMemo(() => getUpcomingAttestationSessions(), []);
  const sessionMonths = useMemo(() => getSessionMonths(sessions), [sessions]);

  const initialSession = useMemo<UpcomingSessionView | undefined>(() => {
    if (selectedExamDate) {
      const matched = sessions.find((s) => s.start === selectedExamDate);
      if (matched) return matched;
    }
    return sessions[0];
  }, [sessions, selectedExamDate]);

  const [selectedSessionStart, setSelectedSessionStart] = useState<string>(
    initialSession?.start ?? sessions[0]?.start ?? '2027-04-16'
  );

  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() =>
    getDefaultCalendarMonth(sessions, selectedExamDate)
  );

  const [discipline, setDiscipline] = useState<string>(
    initialSession?.disciplines[0] ?? 'пешеходный'
  );
  const [contactChannel, setContactChannel] = useState<string>('');
  const [experienceNote, setExperienceNote] = useState<string>('');
  const [consentAccepted, setConsentAccepted] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justBookedDate, setJustBookedDate] = useState<string | null>(null);
  const [icsNotice, setIcsNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedExamDate) return;
    const matched = sessions.find((s) => s.start === selectedExamDate);
    if (matched) {
      setSelectedSessionStart(matched.start);
      setViewMonth({ year: matched.year, month: matched.month });
    }
  }, [selectedExamDate, sessions]);

  const bookedSessionDates = useMemo(() => {
    const dates = new Set<string>();
    for (const inq of inquiries) {
      if (inq.sessionDate && inq.status !== 'rejected') {
        dates.add(inq.sessionDate);
      }
    }
    return dates;
  }, [inquiries]);

  const selectedSession =
    sessions.find((s) => s.start === selectedSessionStart) ?? sessions[0];

  const existingBooking = useMemo(
    () =>
      inquiries.find(
        (inq) => inq.sessionDate === selectedSession?.start && inq.status !== 'rejected'
      ) ?? null,
    [inquiries, selectedSession?.start]
  );

  const calendarCells = useMemo(
    () =>
      buildMonthCalendarGrid(
        viewMonth.year,
        viewMonth.month,
        sessions,
        bookedSessionDates
      ),
    [viewMonth.year, viewMonth.month, sessions, bookedSessionDates]
  );

  const handleSelectSession = (session: UpcomingSessionView) => {
    setSelectedSessionStart(session.start);
    setViewMonth({ year: session.year, month: session.month });
    setSubmitError(null);
    setJustBookedDate(null);
    setIcsNotice(null);
    onSelectExamDate?.(session.start);
    tracker.trackCustomInteraction(
      'Календарь сессий · Выбор даты',
      session.rangeLabel
    );
  };

  const shiftMonth = (delta: number) => {
    setViewMonth((prev) => {
      const d = new Date(Date.UTC(prev.year, prev.month + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });
  };

  const handleExportIcs = () => {
    if (!selectedSession) return;
    const ev = buildScheduleSlotCalendarEvent({
      start: selectedSession.start,
      end: selectedSession.end,
      category: selectedSession.category,
      disciplines: selectedSession.disciplines,
    });
    const fileName = downloadCalendarIcs(ev, 1440);
    setIcsNotice(
      `Файл ${fileName} скачан — добавьте сессию ${selectedSession.rangeLabel} в Google или Яндекс Календарь.`
    );
    tracker.trackCustomInteraction(
      'Календарь сессий · Экспорт .ics',
      selectedSession.start
    );
  };

  const handleBookSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !selectedSession) return;

    setSubmitError(null);
    setJustBookedDate(null);

    if (!consentAccepted) {
      setSubmitError('Подтвердите согласие на обработку заявки и получение уведомлений.');
      return;
    }

    setSubmitting(true);
    try {
      const trackLabel =
        DISCIPLINE_TO_TRACK[discipline] ?? `Инструктор-проводник (${discipline})`;
      const noteText = experienceNote.trim()
        ? `Запись на сессию ${selectedSession.rangeLabel}. ${experienceNote.trim()}`
        : `Запись через календарь личного кабинета на аттестационную сессию ${selectedSession.rangeLabel} (${selectedSession.category}).`;

      const res = await fetch('/api/inquiries', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          fullName: user.fullName,
          email: user.email,
          contactChannel: contactChannel.trim() || user.email,
          region: user.region,
          track: trackLabel,
          experienceNote: noteText,
          sessionDate: selectedSession.start,
          consentAccepted: true,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setSubmitError(payload.error || 'Не удалось оформить запись на выбранную дату.');
        return;
      }

      setJustBookedDate(selectedSession.rangeLabel);
      setExperienceNote('');
      onSessionBooked?.(selectedSession.start);
      tracker.trackCustomInteraction(
        'Календарь сессий · Запись на аттестацию',
        `${selectedSession.start} · ${trackLabel}`
      );
    } catch {
      setSubmitError('Ошибка сети при отправке записи. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="attestation-sessions-calendar"
      aria-labelledby="attestation-calendar-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Официальный график сессий 1–4 КС · РЦА «Русский Восток»</span>
          </p>
          <h3
            id="attestation-calendar-heading"
            className="text-lg sm:text-xl font-bold text-slate-900"
          >
            Календарь ближайших аттестаций и запись
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Выберите дату аттестационной сессии прямо в календаре или списке ближайших потоков,
            чтобы зафиксировать участие и отслеживать статус заявки в кабинете.
          </p>
        </div>

        {/* Quick Month Tabs with Official Sessions */}
        <div
          role="group"
          aria-label="Месяцы проведения аттестаций"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start shrink-0"
        >
          {sessionMonths.map((tab) => {
            const active = viewMonth.year === tab.year && viewMonth.month === tab.month;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setViewMonth({ year: tab.year, month: tab.month });
                  const firstInMonth = sessions.find(
                    (s) => s.year === tab.year && s.month === tab.month
                  );
                  if (firstInMonth) {
                    setSelectedSessionStart(firstInMonth.start);
                    onSelectExamDate?.(firstInMonth.start);
                  }
                }}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split: Calendar Month Grid + Session Booking / Upcoming List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Month Matrix Calendar */}
        <div className="lg:col-span-6 border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-slate-900">
              {formatMonthTitleRu(viewMonth.year, viewMonth.month)}
            </h4>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Предыдущий месяц"
                className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Следующий месяц"
                className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Weekday Headings */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS_SHORT_RU.map((dayName) => (
              <div
                key={dayName}
                className="text-[11px] font-semibold text-slate-500 py-1"
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Days Matrix */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell) => {
              const hasSession = Boolean(cell.session);
              const isSelectedSession =
                cell.session && cell.session.start === selectedSession?.start;

              if (hasSession && cell.session) {
                return (
                  <button
                    key={cell.isoDate}
                    type="button"
                    onClick={() => handleSelectSession(cell.session!)}
                    title={`${cell.session.rangeLabel} · Сессия ${cell.session.category}`}
                    aria-pressed={Boolean(isSelectedSession)}
                    className={`relative h-10 rounded-lg font-mono text-xs font-bold tabular-nums flex flex-col items-center justify-center border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                      cell.isBooked
                        ? isSelectedSession
                          ? 'bg-emerald-700 border-emerald-700 text-white ring-2 ring-emerald-200'
                          : 'bg-emerald-50 border-emerald-400 text-emerald-900 hover:bg-emerald-100'
                        : isSelectedSession
                        ? 'bg-teal-700 border-teal-700 text-white ring-2 ring-teal-200'
                        : 'bg-teal-50 border-teal-300 text-teal-900 hover:bg-teal-100'
                    }`}
                  >
                    <span>{cell.dayOfMonth}</span>
                    <span
                      aria-hidden="true"
                      className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                        isSelectedSession
                          ? 'bg-white'
                          : cell.isBooked
                          ? 'bg-emerald-600'
                          : 'bg-teal-600'
                      }`}
                    />
                  </button>
                );
              }

              return (
                <div
                  key={cell.isoDate}
                  className={`h-10 rounded-lg font-mono text-xs tabular-nums flex items-center justify-center ${
                    !cell.inCurrentMonth
                      ? 'text-slate-300'
                      : cell.isToday
                      ? 'bg-slate-900 text-white font-bold'
                      : cell.isWeekend
                      ? 'text-slate-500 bg-white/60'
                      : 'text-slate-700 bg-white/80'
                  }`}
                >
                  {cell.dayOfMonth}
                </div>
              );
            })}
          </div>

          {/* Calendar Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-slate-200 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-teal-700" aria-hidden="true" />
              Выбранная сессия
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-xs bg-teal-50 border border-teal-300"
                aria-hidden="true"
              />
              Даты аттестации РЦА
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-xs bg-emerald-50 border border-emerald-400"
                aria-hidden="true"
              />
              Есть ваша запись
            </span>
          </div>

          {/* Compact Upcoming Sessions List */}
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold text-slate-800">
              Ближайшие даты аттестационных сессий
            </p>
            <ul className="space-y-1.5">
              {sessions.map((slot) => {
                const active = slot.start === selectedSession?.start;
                const isBooked = bookedSessionDates.has(slot.start);
                return (
                  <li key={slot.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectSession(slot)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        active
                          ? 'bg-white border-teal-600 text-slate-900 shadow-xs'
                          : 'bg-white/70 border-slate-200 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <span className="font-semibold truncate">{slot.rangeLabel}</span>
                      <span className="inline-flex items-center gap-2 shrink-0 font-mono text-[11px] tabular-nums">
                        {isBooked ? (
                          <span className="text-emerald-700 font-semibold">Записаны</span>
                        ) : (
                          <span className="text-slate-500">{slot.availabilityLabel}</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Right: Selected Session Details + Direct Booking Form */}
        <div className="lg:col-span-6 border border-slate-200 rounded-xl p-5 bg-white space-y-4">
          {selectedSession && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-teal-700 font-mono tabular-nums">
                    Сессия {selectedSession.category} · {selectedSession.availabilityLabel}
                  </p>
                  <h4 className="text-base sm:text-lg font-bold text-slate-900">
                    {selectedSession.rangeLabel}
                  </h4>
                  <p className="text-xs text-slate-600 inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                    <span>{selectedSession.venue}</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportIcs}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <CalendarPlus className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>В календарь (.ics)</span>
                </button>
              </div>

              {icsNotice && (
                <p className="text-xs text-teal-900 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                  {icsNotice}
                </p>
              )}

              {justBookedDate && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950 space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="font-bold">Запись на сессию {justBookedDate} оформлена</p>
                      <p className="text-emerald-800 mt-0.5">
                        Заявка сохранена в системе РЦА и добавлена в таблицу статусов ниже.
                      </p>
                    </div>
                  </div>
                  {onJumpToInquiries && (
                    <button
                      type="button"
                      onClick={onJumpToInquiries}
                      className="text-xs font-semibold text-emerald-800 underline hover:text-emerald-950 cursor-pointer"
                    >
                      Перейти к статусу заявки
                    </button>
                  )}
                </div>
              )}

              {!user ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    Для записи на дату <span className="font-semibold">{selectedSession.rangeLabel}</span>{' '}
                    войдите или зарегистрируйтесь в личном кабинете — после этого выбранная сессия
                    закрепится за вашим профилем и попадёт в таблицу статусов.
                  </p>
                  {onFocusAuth && (
                    <button
                      type="button"
                      onClick={onFocusAuth}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Войти для записи на дату</span>
                    </button>
                  )}
                </div>
              ) : existingBooking ? (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                      <CalendarCheck2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                      Вы уже записаны на эту дату
                    </span>
                    <span className="text-xs font-semibold text-emerald-800">
                      Статус: {INQUIRY_STATUS_RU[existingBooking.status]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700">
                    Направление: <span className="font-medium">{existingBooking.track}</span> ·{' '}
                    Регион: {existingBooking.region}
                  </p>
                  {onJumpToInquiries && (
                    <button
                      type="button"
                      onClick={onJumpToInquiries}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-900 text-xs font-semibold rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Отслеживать в таблице заявок</span>
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleBookSession} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="calendar-booking-discipline"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Направление аттестации на сессию {selectedSession.rangeLabel}
                    </label>
                    <select
                      id="calendar-booking-discipline"
                      value={discipline}
                      onChange={(e) => setDiscipline(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    >
                      {selectedSession.disciplines.map((d) => (
                        <option key={d} value={d}>
                          {DISCIPLINE_TO_TRACK[d] ?? d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="calendar-booking-contact"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Телефон или Telegram для связи
                    </label>
                    <input
                      id="calendar-booking-contact"
                      type="text"
                      value={contactChannel}
                      onChange={(e) => setContactChannel(e.target.value)}
                      placeholder="+7 (999) 000-00-00 или @username"
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="calendar-booking-note"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Категория маршрутов / комментарий к опыту
                    </label>
                    <textarea
                      id="calendar-booking-note"
                      rows={2}
                      value={experienceNote}
                      onChange={(e) => setExperienceNote(e.target.value)}
                      placeholder="Например: Приморье / Камчатка, 2 КС, требуется контур ДПО ВВГУ"
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    />
                  </div>

                  <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentAccepted}
                      onChange={(e) => setConsentAccepted(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                    />
                    <span>
                      Подтверждаю актуальность сведений профиля ({user.fullName}, {user.region}) и
                      согласие на передачу заявки в приёмную комиссию РЦА.
                    </span>
                  </label>

                  {submitError && (
                    <p
                      role="alert"
                      className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                    >
                      {submitError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  >
                    <CalendarCheck2 className="w-4 h-4" aria-hidden="true" />
                    <span>
                      {submitting
                        ? 'Оформляем запись…'
                        : `Записаться на ${selectedSession.rangeLabel}`}
                    </span>
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
};
