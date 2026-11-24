import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Link2,
  LogIn,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import type { SessionUser } from '../utils/identityApi';
import type {
  ExamAutofillPayload,
  LinkedAccountDTO,
  LinkedProviderId,
} from '../domain/identity/LinkedAccounts';
import { LINKED_PROVIDER_META } from '../domain/identity/LinkedAccounts';
import {
  buildMonthCalendarGrid,
  filterExamSchedule,
  formatMonthTitleRu,
  getDefaultCalendarMonth,
  getInPersonExamSchedule,
  getSessionMonths,
  toUpcomingSessionCalendarEvent,
  WEEKDAYS_SHORT_RU,
  type ExamDisciplineFilter,
  type UpcomingSessionView,
} from '../utils/attestationCalendarBooking';
import {
  buildGoogleCalendarUrl,
  buildYandexCalendarUrl,
  downloadCalendarIcs,
} from '../utils/attestationCalendar';
import { tracker } from '../utils/tracker';
import { buildRegionSelectOptions, DFO_REGIONS } from '../data/dfoRegions';
import type { InquiryRecord } from './social/MyInquiriesSection';

interface AttestationSessionsCalendarWidgetProps {
  user: SessionUser | null;
  inquiries: InquiryRecord[];
  selectedExamDate?: string;
  linkedAccounts?: LinkedAccountDTO[];
  autofill?: ExamAutofillPayload | null;
  onSelectAutofillSource?: (provider: LinkedProviderId) => void;
  onJumpToLinkedAccounts?: () => void;
  onSessionBooked?: (sessionDateIso: string) => void;
  onSelectExamDate?: (sessionDateIso: string) => void;
  onJumpToInquiries?: () => void;
  onFocusAuth?: (mode?: 'login' | 'register') => void;
  externalReattestationPrefill?: { note: string; nonce: number } | null;
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

const DISCIPLINE_FILTERS: readonly { id: ExamDisciplineFilter; label: string }[] = [
  { id: 'all', label: 'Все направления' },
  { id: 'пешеходный', label: 'Пешеходный' },
  { id: 'водный', label: 'Водный' },
  { id: 'горный', label: 'Горный' },
  { id: 'спелеологический', label: 'Спелео' },
];

export const AttestationSessionsCalendarWidget: React.FC<
  AttestationSessionsCalendarWidgetProps
> = ({
  user,
  inquiries,
  selectedExamDate,
  linkedAccounts = [],
  autofill = null,
  onSelectAutofillSource,
  onJumpToLinkedAccounts,
  onSessionBooked,
  onSelectExamDate,
  onJumpToInquiries,
  onFocusAuth,
  externalReattestationPrefill,
}) => {
  const allSessions = useMemo(() => getInPersonExamSchedule(), []);
  const [disciplineFilter, setDisciplineFilter] = useState<ExamDisciplineFilter>('all');

  const sessions = useMemo(
    () => filterExamSchedule(allSessions, disciplineFilter),
    [allSessions, disciplineFilter]
  );

  const sessionMonths = useMemo(() => getSessionMonths(sessions), [sessions]);

  const initialSession = useMemo<UpcomingSessionView | undefined>(() => {
    if (selectedExamDate) {
      const matched = allSessions.find((s) => s.start === selectedExamDate);
      if (matched) return matched;
    }
    return allSessions[0];
  }, [allSessions, selectedExamDate]);

  const [selectedSessionStart, setSelectedSessionStart] = useState<string>(
    initialSession?.start ?? allSessions[0]?.start ?? '2026-12-14'
  );

  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() =>
    getDefaultCalendarMonth(allSessions, selectedExamDate)
  );

  const [applicantName, setApplicantName] = useState<string>(
    autofill?.fullName || user?.fullName || ''
  );
  const [applicantEmail, setApplicantEmail] = useState<string>(
    autofill?.email || user?.email || ''
  );
  const [applicantRegion, setApplicantRegion] = useState<string>(
    autofill?.region || user?.region || DFO_REGIONS[0]
  );
  const [discipline, setDiscipline] = useState<string>(
    initialSession?.disciplines[0] ?? 'пешеходный'
  );
  const [contactChannel, setContactChannel] = useState<string>(
    autofill?.contactChannel || ''
  );
  const [experienceNote, setExperienceNote] = useState<string>(
    autofill?.experienceNote || ''
  );
  const [autofillSourceNote, setAutofillSourceNote] = useState<string | null>(
    autofill ? autofill.sourceLabel : null
  );
  const [consentAccepted, setConsentAccepted] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justBookedDate, setJustBookedDate] = useState<string | null>(null);
  const [reminderLeadMinutes, setReminderLeadMinutes] = useState<number>(1440);
  const [icsNotice, setIcsNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedExamDate) return;
    const matched = allSessions.find((s) => s.start === selectedExamDate);
    if (matched) {
      setSelectedSessionStart(matched.start);
      setViewMonth({ year: matched.year, month: matched.month });
    }
  }, [selectedExamDate, allSessions]);

  useEffect(() => {
    if (!externalReattestationPrefill?.note) return;
    setExperienceNote(externalReattestationPrefill.note);
  }, [externalReattestationPrefill]);

  // Keep selectedSessionStart aligned if a discipline filter hides the current selection
  useEffect(() => {
    if (sessions.length === 0) return;
    const exists = sessions.some((s) => s.start === selectedSessionStart);
    if (!exists) {
      const next = sessions[0];
      setSelectedSessionStart(next.start);
      setViewMonth({ year: next.year, month: next.month });
    }
  }, [sessions, selectedSessionStart]);

  const selectedSession =
    sessions.find((s) => s.start === selectedSessionStart) ?? sessions[0] ?? allSessions[0];

  // Auto-populate applicant fields from linked Google/social account or base cabinet profile
  useEffect(() => {
    if (!user) return;
    if (autofill) {
      setApplicantName(autofill.fullName || user.fullName);
      setApplicantEmail(autofill.email || user.email);
      setApplicantRegion(autofill.region || user.region);
      setContactChannel(autofill.contactChannel || user.email);
      if (autofill.experienceNote) {
        setExperienceNote(autofill.experienceNote);
      }
      if (
        selectedSession &&
        selectedSession.disciplines.includes(autofill.preferredDiscipline)
      ) {
        setDiscipline(autofill.preferredDiscipline);
      }
      setAutofillSourceNote(autofill.sourceLabel);
    } else {
      setApplicantName((prev) => prev || user.fullName);
      setApplicantEmail((prev) => prev || user.email);
      setApplicantRegion((prev) => prev || user.region);
      setAutofillSourceNote(null);
    }
  }, [user, autofill, selectedSession]);

  // Ensure chosen booking discipline belongs to the selected session's exam disciplines
  useEffect(() => {
    if (!selectedSession) return;
    if (!selectedSession.disciplines.includes(discipline)) {
      if (
        autofill?.preferredDiscipline &&
        selectedSession.disciplines.includes(autofill.preferredDiscipline)
      ) {
        setDiscipline(autofill.preferredDiscipline);
      } else {
        setDiscipline(selectedSession.disciplines[0] ?? 'пешеходный');
      }
    }
  }, [selectedSession, discipline, autofill]);

  const bookedSessionDates = useMemo(() => {
    const dates = new Set<string>();
    for (const inq of inquiries) {
      if (inq.sessionDate && inq.status !== 'rejected') {
        dates.add(inq.sessionDate);
      }
    }
    return dates;
  }, [inquiries]);

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
      'Календарь аттестаций · Выбор экзамена',
      session.rangeLabel
    );
  };

  const shiftMonth = (delta: number) => {
    setViewMonth((prev) => {
      const d = new Date(Date.UTC(prev.year, prev.month + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });
  };

  const selectedCalendarEvent = useMemo(
    () => (selectedSession ? toUpcomingSessionCalendarEvent(selectedSession) : null),
    [selectedSession]
  );

  const selectedGoogleCalendarUrl = useMemo(
    () => (selectedCalendarEvent ? buildGoogleCalendarUrl(selectedCalendarEvent) : ''),
    [selectedCalendarEvent]
  );

  const handleExportIcs = () => {
    if (!selectedSession || !selectedCalendarEvent) return;
    const fileName = downloadCalendarIcs(selectedCalendarEvent, reminderLeadMinutes);
    setIcsNotice(
      `Файл ${fileName} скачан (.ics / iCalendar) — откройте его для добавления сессии «${selectedSession.rangeLabel}» в Google, Яндекс, Apple или Outlook Календарь.`
    );
    tracker.trackCustomInteraction(
      `Календарь аттестаций · Экспорт .ics (${reminderLeadMinutes} мин)`,
      selectedSession.start
    );
  };

  const handleBookSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !selectedSession) return;

    setSubmitError(null);
    setJustBookedDate(null);

    if (!consentAccepted) {
      setSubmitError('Подтвердите согласие на передачу регистрационной заявки в комиссию РЦА.');
      return;
    }

    setSubmitting(true);
    try {
      const trackLabel =
        DISCIPLINE_TO_TRACK[discipline] ?? `Инструктор-проводник (${discipline})`;
      const noteText = experienceNote.trim()
        ? `Регистрация на очный экзамен ${selectedSession.rangeLabel}. ${experienceNote.trim()}`
        : `Регистрация через «Календарь аттестаций» на очный экзамен ${selectedSession.rangeLabel} (${selectedSession.category}).`;

      const finalName = applicantName.trim() || user.fullName;
      const finalEmail = applicantEmail.trim() || user.email;
      const finalRegion = applicantRegion.trim() || user.region;

      const res = await fetch('/api/inquiries', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          fullName: finalName,
          email: finalEmail,
          contactChannel: contactChannel.trim() || finalEmail,
          region: finalRegion,
          track: trackLabel,
          experienceNote: noteText,
          sessionDate: selectedSession.start,
          consentAccepted: true,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setSubmitError(payload.error || 'Не удалось оформить регистрацию на выбранный экзамен.');
        return;
      }

      setJustBookedDate(selectedSession.rangeLabel);
      onSessionBooked?.(selectedSession.start);
      tracker.trackCustomInteraction(
        'Календарь аттестаций · Регистрация на экзамен',
        `${selectedSession.start} · ${trackLabel}`
      );
    } catch {
      setSubmitError('Ошибка сети при отправке регистрации. Попробуйте ещё раз.');
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
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-teal-700">
            <CalendarDays className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Очные экзамены 1–4 КС · РЦА «Русский Восток» (ВВГУ и ФСТР)</span>
            {user && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-slate-700">
                  Ваших регистраций: {bookedSessionDates.size}
                </span>
              </>
            )}
          </div>
          <h3
            id="attestation-calendar-heading"
            className="text-lg sm:text-xl font-bold text-slate-900"
          >
            Календарь аттестаций
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Расписание ближайших очных теоретических и полевых экзаменов. Выберите подходящий поток
            в календаре или списке сессий, чтобы ознакомиться с программой и зарегистрироваться.
          </p>
        </div>

        {/* Discipline Filter Controls */}
        <div
          role="tablist"
          aria-label="Фильтр экзаменов по виду туризма"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start shrink-0"
        >
          {DISCIPLINE_FILTERS.map((f) => {
            const active = disciplineFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setDisciplineFilter(f.id);
                  tracker.trackCustomInteraction(
                    `Календарь аттестаций · фильтр: ${f.label}`,
                    'account'
                  );
                }}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Month Tabs with Official Sessions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <span className="text-xs font-medium text-slate-500">
          Месяцы проведения ближайших экзаменов ({sessions.length}):
        </span>
        <div
          role="group"
          aria-label="Месяцы проведения аттестаций"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
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
                    handleSelectSession(firstInMonth);
                  }
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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

      {/* Main Split: Calendar Month Grid + Session Schedule vs Registration Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Month Matrix Calendar + Upcoming Exams List (6 cols) */}
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
              <div key={dayName} className="text-[11px] font-semibold text-slate-500 py-1">
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
                    title={`${cell.session.rangeLabel} · ${cell.session.title ?? cell.session.category}`}
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
              Выбранный экзамен
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-xs bg-teal-50 border border-teal-300"
                aria-hidden="true"
              />
              Очные экзамены РЦА
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-xs bg-emerald-50 border border-emerald-400"
                aria-hidden="true"
              />
              Вы зарегистрированы
            </span>
          </div>

          {/* Full Upcoming In-Person Exams List */}
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold text-slate-800">
              Расписание ближайших очных экзаменов ({sessions.length})
            </p>
            <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
              {sessions.map((slot) => {
                const active = slot.start === selectedSession?.start;
                const isBooked = bookedSessionDates.has(slot.start);
                return (
                  <li key={slot.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectSession(slot)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs flex items-start justify-between gap-3 transition-colors cursor-pointer ${
                        active
                          ? 'bg-white border-teal-700 text-slate-900 shadow-xs ring-1 ring-teal-700'
                          : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-bold text-slate-900 truncate">
                          {slot.rangeLabel} · {slot.category}
                        </p>
                        <p className="text-[11px] text-slate-600 truncate">
                          {slot.title ?? slot.venue}
                        </p>
                      </div>

                      <div className="text-right shrink-0 space-y-0.5 font-mono text-[11px] tabular-nums">
                        {isBooked ? (
                          <span className="text-emerald-700 font-bold block">Записаны</span>
                        ) : (
                          <span className="text-teal-800 font-semibold block">
                            {slot.availabilityLabel}
                          </span>
                        )}
                        {slot.seatsAvailable !== undefined && (
                          <span className="text-slate-500 block">
                            мест: {slot.seatsAvailable}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Right: Selected In-Person Exam Details + Registration Form (6 cols) */}
        <div className="lg:col-span-6 border border-slate-200 rounded-xl p-5 bg-white space-y-4">
          {selectedSession && (
            <>
              {/* Exam Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200">
                <div className="space-y-1 max-w-md">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-teal-700 font-mono tabular-nums">
                    <span>{selectedSession.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedSession.availabilityLabel}</span>
                    {selectedSession.startTimeVld && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Старт в {selectedSession.startTimeVld}</span>
                      </>
                    )}
                  </div>
                  <h4 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                    {selectedSession.rangeLabel}
                  </h4>
                  {selectedSession.title && (
                    <p className="text-xs font-semibold text-slate-800">{selectedSession.title}</p>
                  )}
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

              {/* Venue, Commission & Seats Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                <div className="space-y-0.5">
                  <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-teal-700 shrink-0" aria-hidden="true" />
                    <span>Площадка проведения</span>
                  </p>
                  <p className="font-semibold text-slate-900 leading-snug">
                    {selectedSession.venue}
                  </p>
                </div>

                <div className="space-y-0.5">
                  <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                    <Users className="w-3 h-3 text-teal-700 shrink-0" aria-hidden="true" />
                    <span>Квота и срок подачи</span>
                  </p>
                  <p className="font-semibold text-slate-900 font-mono tabular-nums">
                    {selectedSession.seatsAvailable ?? 12} из {selectedSession.seatsTotal ?? 30}{' '}
                    мест свободно
                  </p>
                  {selectedSession.registrationDeadlineLabel && (
                    <p className="text-[11px] text-slate-600">
                      Приём заявок {selectedSession.registrationDeadlineLabel}
                    </p>
                  )}
                </div>

                {selectedSession.commissionInfo && (
                  <div className="sm:col-span-2 pt-2 border-t border-slate-200 space-y-0.5">
                    <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-teal-700 shrink-0" aria-hidden="true" />
                      <span>Экзаменационная комиссия</span>
                    </p>
                    <p className="font-medium text-slate-800">{selectedSession.commissionInfo}</p>
                  </div>
                )}
              </div>

              {/* In-Person Exam Program by Day */}
              {selectedSession.dayPlan && selectedSession.dayPlan.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-800">
                    Программа очного экзамена:
                  </p>
                  <ul className="space-y-1 text-xs text-slate-700">
                    {selectedSession.dayPlan.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-mono font-bold text-teal-700 shrink-0">
                          {idx + 1}.
                        </span>
                        <span className="leading-snug">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Export Selected Session to Personal Calendar (.ics / iCalendar) */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-900 inline-flex items-center gap-1.5">
                    <CalendarPlus className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                    <span>Экспорт выбранного события в личный календарь</span>
                  </p>
                  <label className="text-[11px] text-slate-600 inline-flex items-center gap-1.5">
                    <span>Напоминание:</span>
                    <select
                      value={reminderLeadMinutes}
                      onChange={(e) => setReminderLeadMinutes(Number(e.target.value))}
                      className="px-2 py-1 text-[11px] bg-white border border-slate-300 rounded text-slate-800 font-medium focus:outline-none focus:border-teal-700"
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
                    onClick={handleExportIcs}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Скачать .ics (iCalendar)</span>
                  </button>

                  {selectedGoogleCalendarUrl && (
                    <a
                      href={selectedGoogleCalendarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>Google Календарь</span>
                      <ExternalLink className="w-3 h-3 text-slate-500" aria-hidden="true" />
                    </a>
                  )}

                  <a
                    href={buildYandexCalendarUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Яндекс Календарь</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" aria-hidden="true" />
                  </a>
                </div>

                {icsNotice && (
                  <p role="status" className="text-xs text-teal-900 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 font-medium">
                    {icsNotice}
                  </p>
                )}
              </div>

              {justBookedDate && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950 space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-bold">
                        Регистрация на очный экзамен {justBookedDate} подтверждена
                      </p>
                      <p className="text-emerald-800 mt-0.5">
                        Заявка сохранена в системе РЦА и добавлена в таблицу статусов кабинета.
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
                    Чтобы зарегистрироваться на очный экзамен{' '}
                    <span className="font-semibold">{selectedSession.rangeLabel}</span>, войдите в
                    личный кабинет или создайте учётную запись соискателя — после входа сессия
                    закрепится за вашим профилем.
                  </p>
                  {onFocusAuth && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onFocusAuth('login')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Войти и записаться</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onFocusAuth('register')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                        <span>Регистрация соискателя</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : existingBooking ? (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                      <CalendarCheck2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                      Вы зарегистрированы на этот экзамен
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
                <form onSubmit={handleBookSession} className="space-y-3.5 pt-1 border-t border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <p className="text-xs font-bold text-slate-900">
                      Онлайн-регистрация на очный экзамен ({selectedSession.rangeLabel})
                    </p>
                    {onJumpToLinkedAccounts && (
                      <button
                        type="button"
                        onClick={onJumpToLinkedAccounts}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-900 cursor-pointer"
                      >
                        <Link2 className="w-3 h-3" aria-hidden="true" />
                        <span>
                          {linkedAccounts.length > 0
                            ? 'Профили автозаполнения'
                            : 'Связать Google / соцсеть'}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Linked Profile Autofill Bar */}
                  {autofill ? (
                    <div className="bg-teal-50/70 border border-teal-200 rounded-lg p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-teal-900">
                          <Sparkles className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                          <span>
                            Автозаполнение: {autofillSourceNote || autofill.sourceLabel}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setApplicantName(autofill.fullName || user.fullName);
                            setApplicantEmail(autofill.email || user.email);
                            setApplicantRegion(autofill.region || user.region);
                            setContactChannel(autofill.contactChannel || user.email);
                            setExperienceNote(autofill.experienceNote || '');
                            if (
                              selectedSession.disciplines.includes(
                                autofill.preferredDiscipline
                              )
                            ) {
                              setDiscipline(autofill.preferredDiscipline);
                            }
                            setAutofillSourceNote(autofill.sourceLabel);
                          }}
                          className="text-[11px] font-semibold text-teal-800 hover:underline cursor-pointer"
                        >
                          Обновить поля из профиля
                        </button>
                      </div>

                      {linkedAccounts.length > 1 && onSelectAutofillSource && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-teal-800">Источник:</span>
                          {linkedAccounts.map((acc) => {
                            const active = acc.provider === autofill.sourceProvider;
                            return (
                              <button
                                key={acc.provider}
                                type="button"
                                onClick={() => onSelectAutofillSource(acc.provider)}
                                className={`px-2 py-0.5 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-teal-700 text-white border-teal-700'
                                    : 'bg-white text-teal-900 border-teal-200 hover:bg-teal-100'
                                }`}
                              >
                                {LINKED_PROVIDER_META[acc.provider].shortLabel}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    onJumpToLinkedAccounts && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                        <span>
                          Свяжите личный кабинет с Google или соцсетью (ВКонтакте, Telegram), чтобы
                          поля заявки заполнялись автоматически.
                        </span>
                        <button
                          type="button"
                          onClick={onJumpToLinkedAccounts}
                          className="font-semibold text-teal-700 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Настроить →
                        </button>
                      </div>
                    )
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label
                        htmlFor="calendar-booking-fullname"
                        className="block text-xs font-medium text-slate-700"
                      >
                        ФИО соискателя
                      </label>
                      <input
                        id="calendar-booking-fullname"
                        type="text"
                        required
                        value={applicantName}
                        onChange={(e) => setApplicantName(e.target.value)}
                        className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="calendar-booking-email"
                        className="block text-xs font-medium text-slate-700"
                      >
                        Email для протокола и пропуска
                      </label>
                      <input
                        id="calendar-booking-email"
                        type="email"
                        required
                        value={applicantEmail}
                        onChange={(e) => setApplicantEmail(e.target.value)}
                        className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label
                        htmlFor="calendar-booking-region"
                        className="block text-xs font-medium text-slate-700"
                      >
                        Регион соискателя
                      </label>
                      <select
                        id="calendar-booking-region"
                        value={applicantRegion}
                        onChange={(e) => setApplicantRegion(e.target.value)}
                        className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                      >
                        {buildRegionSelectOptions(applicantRegion).map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="calendar-booking-discipline"
                        className="block text-xs font-medium text-slate-700"
                      >
                        Направление аттестации
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
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="calendar-booking-contact"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Телефон, Telegram или профиль соцсети для связи комиссии
                    </label>
                    <input
                      id="calendar-booking-contact"
                      type="text"
                      value={contactChannel}
                      onChange={(e) => setContactChannel(e.target.value)}
                      placeholder="+7 (999) 000-00-00, @username или vk.com/..."
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="calendar-booking-note"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Категория сложности и комментарий к стажу
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
                      Подтверждаю актуальность сведений ({applicantName || user.fullName},{' '}
                      {applicantRegion || user.region}) и согласие на передачу заявки в приёмную
                      комиссию РЦА.
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
                        ? 'Оформляем регистрацию…'
                        : `Зарегистрироваться на экзамен (${selectedSession.rangeLabel})`}
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
