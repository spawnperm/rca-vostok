import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  MapPin,
  Users,
} from 'lucide-react';
import {
  MARKET_CALENDAR_MONTHS,
  MARKET_FIELD_COMMISSIONS_AND_SEMINARS,
  buildMarketCalendarMonthGrid,
  downloadMarketEventIcs,
  filterMarketCalendarEvents,
  getMarketEventsForIsoDate,
  type MarketCalendarEventType,
  type MarketFieldEvent,
} from '../utils/fieldCommissionsCalendar';
import { tracker } from '../utils/tracker';

const WEEKDAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;
const SAVED_MARKET_EVENTS_KEY = 'rca_market_field_calendar_saved_v1';

export const MarketFieldCommissionsCalendar: React.FC = () => {
  const [typeFilter, setTypeFilter] = useState<'all' | MarketCalendarEventType>('all');
  const [regionFilter, setRegionFilter] = useState<'all' | 'primorye' | 'dfo'>('all');
  const [monthIdx, setMonthIdx] = useState<number>(0);
  const [selectedEventId, setSelectedEventId] = useState<string>(
    MARKET_FIELD_COMMISSIONS_AND_SEMINARS[0].id
  );
  const [savedEventIds, setSavedEventIds] = useState<string[]>(() => {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const raw = window.localStorage.getItem(SAVED_MARKET_EVENTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  const [icsNotice, setIcsNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(SAVED_MARKET_EVENTS_KEY, JSON.stringify(savedEventIds));
    } catch {
      // ignore quota errors
    }
  }, [savedEventIds]);

  const filteredEvents = useMemo(
    () => filterMarketCalendarEvents({ typeFilter, regionFilter }),
    [typeFilter, regionFilter]
  );

  const selectedEvent = useMemo(
    () =>
      filteredEvents.find((e) => e.id === selectedEventId) ??
      filteredEvents[0] ??
      MARKET_FIELD_COMMISSIONS_AND_SEMINARS[0],
    [filteredEvents, selectedEventId]
  );

  const currentMonth = MARKET_CALENDAR_MONTHS[monthIdx] ?? MARKET_CALENDAR_MONTHS[0];

  const monthCells = useMemo(
    () => buildMarketCalendarMonthGrid(currentMonth.year, currentMonth.month),
    [currentMonth.year, currentMonth.month]
  );

  const selectEventAndSyncMonth = (ev: MarketFieldEvent) => {
    setSelectedEventId(ev.id);
    setIcsNotice(null);
    const [ey, em] = ev.startDateIso.split('-').map(Number);
    const foundMonthIdx = MARKET_CALENDAR_MONTHS.findIndex(
      (m) => m.year === ey && m.month === em - 1
    );
    if (foundMonthIdx >= 0) {
      setMonthIdx(foundMonthIdx);
    }
    tracker.trackCustomInteraction(`Рынок ДФО · Календарь: ${ev.shortTitle}`, ev.startDateIso);
  };

  const handleToggleSaved = (ev: MarketFieldEvent) => {
    setSavedEventIds((prev) => {
      const exists = prev.includes(ev.id);
      const next = exists ? prev.filter((id) => id !== ev.id) : [...prev, ev.id];
      tracker.trackCustomInteraction(
        exists ? 'Календарь комиссий: снята отметка' : 'Календарь комиссий: добавлено в план',
        ev.shortTitle
      );
      return next;
    });
  };

  const handleExportIcs = (ev: MarketFieldEvent) => {
    const fileName = downloadMarketEventIcs(ev);
    if (!savedEventIds.includes(ev.id)) {
      setSavedEventIds((prev) => [...prev, ev.id]);
    }
    setIcsNotice(`Файл ${fileName} сохранён — можно импортировать в календарь.`);
    tracker.trackCustomInteraction('Календарь комиссий: экспорт .ics', ev.shortTitle);
  };

  const isSaved = savedEventIds.includes(selectedEvent.id);

  return (
    <section
      aria-labelledby="market-field-calendar-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header & Dual Filters */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1.5 max-w-3xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>График выездной работы РЦА «Русский Восток» · 2026–2027</span>
          </p>
          <h2 id="market-field-calendar-heading" className="text-xl font-bold text-slate-900">
            Календарь выездных аттестационных комиссий и обучающих семинаров
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Ближайшие даты выездного приёма экзаменов по округам Приморского края и регионам ДФО,
            а также очных практических семинаров для инструкторов-проводников.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Тип события в календаре рынка ДФО"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {(
              [
                { id: 'all', label: `Все (${MARKET_FIELD_COMMISSIONS_AND_SEMINARS.length})` },
                { id: 'field_commission', label: 'Выездные комиссии' },
                { id: 'seminar', label: 'Обучающие семинары' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setTypeFilter(tab.id);
                  tracker.trackCustomInteraction('Календарь комиссий: тип', tab.label);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  typeFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label="География площадок"
            className="inline-flex items-center gap-1 p-1 bg-slate-50 border border-slate-200 rounded-lg"
          >
            {(
              [
                { id: 'all', label: 'Весь ДФО' },
                { id: 'primorye', label: 'Приморье' },
                { id: 'dfo', label: 'Выезды ДФО' },
              ] as const
            ).map((rf) => (
              <button
                key={rf.id}
                type="button"
                onClick={() => setRegionFilter(rf.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  regionFilter === rf.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {rf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid: Calendar Grid (6 cols) + Event Card & Upcoming List (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Month Calendar Grid */}
        <div className="lg:col-span-6 bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
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
              disabled={monthIdx >= MARKET_CALENDAR_MONTHS.length - 1}
              onClick={() =>
                setMonthIdx((i) => Math.min(MARKET_CALENDAR_MONTHS.length - 1, i + 1))
              }
              aria-label="Следующий месяц"
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Quick Month Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {MARKET_CALENDAR_MONTHS.map((m, idx) => (
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

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500 pt-1">
            {WEEKDAYS_RU.map((wd) => (
              <div key={wd} className="py-1">
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((cell) => {
              const dayEvents = getMarketEventsForIsoDate(cell.isoDate, filteredEvents);
              const hasCommission = dayEvents.some((e) => e.type === 'field_commission');
              const hasSeminar = dayEvents.some((e) => e.type === 'seminar');
              const isSelectedDay = dayEvents.some((e) => e.id === selectedEvent.id);

              return (
                <button
                  key={cell.isoDate}
                  type="button"
                  disabled={dayEvents.length === 0}
                  onClick={() => {
                    if (dayEvents[0]) selectEventAndSyncMonth(dayEvents[0]);
                  }}
                  title={dayEvents.map((e) => e.shortTitle).join(', ') || undefined}
                  className={`relative h-11 rounded-lg border text-xs font-mono tabular-nums flex flex-col items-center justify-center gap-0.5 transition-colors ${
                    !cell.inCurrentMonth ? 'opacity-40' : ''
                  } ${
                    isSelectedDay
                      ? 'bg-teal-700 border-teal-800 text-white font-bold shadow-xs cursor-pointer'
                      : dayEvents.length > 0
                        ? hasSeminar && !hasCommission
                          ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold hover:bg-amber-100 cursor-pointer'
                          : 'bg-teal-50 border-teal-300 text-teal-900 font-semibold hover:bg-teal-100 cursor-pointer'
                        : 'bg-white border-slate-200/80 text-slate-500 cursor-default'
                  }`}
                >
                  <span>{cell.dayOfMonth}</span>
                  {dayEvents.length > 0 && (
                    <span className="flex items-center gap-0.5">
                      {hasCommission && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSelectedDay ? 'bg-white' : 'bg-teal-700'
                          }`}
                          aria-hidden="true"
                        />
                      )}
                      {hasSeminar && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSelectedDay ? 'bg-amber-200' : 'bg-amber-600'
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

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 text-[11px] text-slate-600">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-700" aria-hidden="true" />
                Выездная комиссия РЦА
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-600" aria-hidden="true" />
                Обучающий семинар
              </span>
            </div>
            <span className="font-mono tabular-nums text-slate-500">
              Отмечено в плане: {savedEventIds.length}
            </span>
          </div>
        </div>

        {/* Right: Selected Event Inspector & Compact Upcoming Strip */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-teal-800">
                {selectedEvent.type === 'seminar' ? (
                  <GraduationCap className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                ) : (
                  <Users className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                )}
                <span>{selectedEvent.typeLabel}</span>
                <span aria-hidden="true" className="text-slate-400">·</span>
                <span className="text-slate-600 font-normal">
                  Квота {selectedEvent.quotaSeats} мест
                </span>
              </span>

              <span className="font-mono font-semibold text-slate-800 tabular-nums">
                {selectedEvent.startDateIso === selectedEvent.endDateIso
                  ? selectedEvent.startDateIso
                  : `${selectedEvent.startDateIso} — ${selectedEvent.endDateIso}`}
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              {selectedEvent.title}
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {selectedEvent.summary}
            </p>

            <dl className="divide-y divide-slate-200 border-y border-slate-200 text-xs">
              <div className="py-2.5 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3">
                <dt className="text-slate-500 inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                  <span>Площадка и округ</span>
                </dt>
                <dd className="sm:col-span-2 font-medium text-slate-900">
                  {selectedEvent.municipalityOrRegion} · {selectedEvent.venue}
                </dd>
              </div>

              <div className="py-2.5 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3">
                <dt className="text-slate-500 inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                  <span>Время и треки</span>
                </dt>
                <dd className="sm:col-span-2 text-slate-800">
                  <span className="font-mono font-semibold tabular-nums">
                    {selectedEvent.timeWindowVld}
                  </span>{' '}
                  · {selectedEvent.tracks}
                </dd>
              </div>

              <div className="py-2.5 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3">
                <dt className="text-slate-500">Комиссия / ведущий</dt>
                <dd className="sm:col-span-2 font-medium text-slate-900">
                  {selectedEvent.commissionChairOrSpeaker}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleExportIcs(selectedEvent)}
                className="px-3.5 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Скачать в календарь (.ics)</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleSaved(selectedEvent)}
                aria-pressed={isSaved}
                className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                  isSaved
                    ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {isSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
                    <span>В моём плане</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    <span>Сохранить дату</span>
                  </>
                )}
              </button>
            </div>

            {icsNotice && (
              <p role="status" className="text-[11px] font-medium text-teal-800">
                {icsNotice}
              </p>
            )}
          </div>

          {/* Upcoming Schedule List */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex items-center justify-between">
              <span>Ближайшие выездные комиссии и семинары</span>
              <span className="font-mono text-slate-500 tabular-nums">
                {filteredEvents.length} дат
              </span>
            </div>
            <div className="divide-y divide-slate-200 max-h-[210px] overflow-y-auto">
              {filteredEvents.map((ev) => {
                const selected = ev.id === selectedEvent.id;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => selectEventAndSyncMonth(ev)}
                    className={`w-full px-4 py-2.5 text-left text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      selected
                        ? 'bg-teal-50/80 font-semibold text-slate-900'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          ev.type === 'seminar' ? 'bg-amber-600' : 'bg-teal-700'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="font-mono text-[11px] text-slate-500 shrink-0 tabular-nums">
                        {ev.startDateIso}
                      </span>
                      <span className="truncate">{ev.shortTitle}</span>
                    </span>
                    <span className="text-[11px] text-slate-500 shrink-0">
                      {ev.municipalityOrRegion.split('·')[0].trim()}
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
