import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Users,
} from 'lucide-react';
import { formatSessionRange } from '../data/landingContent.ts';
import {
  buildCertificationGoogleCalendarUrl,
  buildCertificationMonthGrid,
  CERTIFICATION_DFO_MONTHS,
  CERTIFICATION_DFO_REGIONS,
  downloadCertificationEventIcs,
  filterCertificationDfoEvents,
  getCertificationEventsForIsoDate,
  type CertificationDfoEvent,
  type CertificationDfoEventType,
  type CertificationDfoRegionId,
} from '../utils/certificationDfoCalendar.ts';
import { buildYandexCalendarUrl } from '../utils/attestationCalendar.ts';
import { tracker } from '../utils/tracker.ts';

const WEEKDAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

export const CertificationAttestationCalendar: React.FC = () => {
  const [regionId, setRegionId] = useState<CertificationDfoRegionId>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | CertificationDfoEventType>('all');
  const [monthIdx, setMonthIdx] = useState<number>(3); // April 2027 default (contains spring sessions)
  const [selectedEventId, setSelectedEventId] = useState<string>('cert-dfo-prim-exam-apr');
  const [reminderLeadMinutes, setReminderLeadMinutes] = useState<number>(1440);
  const [icsNotice, setIcsNotice] = useState<string | null>(null);

  const filteredEvents = useMemo(
    () => filterCertificationDfoEvents({ regionId, typeFilter }),
    [regionId, typeFilter]
  );

  const activeMonth = CERTIFICATION_DFO_MONTHS[monthIdx] ?? CERTIFICATION_DFO_MONTHS[0];

  const monthCells = useMemo(
    () => buildCertificationMonthGrid(activeMonth.year, activeMonth.month),
    [activeMonth.year, activeMonth.month]
  );

  const activeEvent: CertificationDfoEvent | null = useMemo(() => {
    if (filteredEvents.length === 0) return null;
    return filteredEvents.find((ev) => ev.id === selectedEventId) ?? filteredEvents[0];
  }, [filteredEvents, selectedEventId]);

  const monthEventsCount = useMemo(() => {
    const prefix = `${activeMonth.year}-${String(activeMonth.month + 1).padStart(2, '0')}`;
    return filteredEvents.filter(
      (ev) => ev.startDateIso.startsWith(prefix) || ev.endDateIso.startsWith(prefix)
    ).length;
  }, [activeMonth.year, activeMonth.month, filteredEvents]);

  const handleSelectEvent = (ev: CertificationDfoEvent) => {
    setSelectedEventId(ev.id);
    setIcsNotice(null);
    const [yStr, mStr] = ev.startDateIso.split('-');
    const yNum = Number(yStr);
    const mNum = Number(mStr) - 1;
    const foundMonth = CERTIFICATION_DFO_MONTHS.findIndex(
      (m) => m.year === yNum && m.month === mNum
    );
    if (foundMonth >= 0) {
      setMonthIdx(foundMonth);
    }
    tracker.trackCustomInteraction(`Календарь аттестаций · выбор: ${ev.shortTitle}`, ev.regionName);
  };

  const handleSelectRegion = (nextRegion: CertificationDfoRegionId) => {
    setRegionId(nextRegion);
    setIcsNotice(null);
    const nextEvents = filterCertificationDfoEvents({ regionId: nextRegion, typeFilter });
    if (nextEvents[0]) {
      setSelectedEventId(nextEvents[0].id);
      const [yStr, mStr] = nextEvents[0].startDateIso.split('-');
      const foundMonth = CERTIFICATION_DFO_MONTHS.findIndex(
        (m) => m.year === Number(yStr) && m.month === Number(mStr) - 1
      );
      if (foundMonth >= 0) setMonthIdx(foundMonth);
    }
    tracker.trackCustomInteraction('Календарь аттестаций · фильтр региона ДФО', nextRegion);
  };

  const handleSelectType = (nextType: 'all' | CertificationDfoEventType) => {
    setTypeFilter(nextType);
    setIcsNotice(null);
    const nextEvents = filterCertificationDfoEvents({ regionId, typeFilter: nextType });
    if (nextEvents[0] && !nextEvents.some((ev) => ev.id === selectedEventId)) {
      setSelectedEventId(nextEvents[0].id);
    }
  };

  const handleDownloadIcs = () => {
    if (!activeEvent) return;
    const fileName = downloadCertificationEventIcs(activeEvent, reminderLeadMinutes);
    setIcsNotice(
      `Файл ${fileName} (.ics / iCalendar) сохранён — импортируйте его в Google, Яндекс, Apple или Outlook Календарь.`
    );
    tracker.trackCustomInteraction(
      `Календарь аттестаций · .ics: ${activeEvent.shortTitle} (${reminderLeadMinutes} мин)`,
      activeEvent.startDateIso
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
            Регионы ДФО · Экзамены и очные встречи
          </p>
          <h3 className="text-xl font-bold text-slate-900">Календарь аттестаций</h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Единое расписание очных квалификационных экзаменов (теория и полигон), выездных заседаний
            комиссии РЦА и очных встреч с кандидатами в субъектах Дальневосточного федерального округа.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: 'Все события' },
                { id: 'exam', label: 'Экзамены' },
                { id: 'meeting', label: 'Очные встречи' },
              ] as const
            ).map((opt) => {
              const active = typeFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectType(opt.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-medium sr-only">Регион ДФО</span>
            <select
              aria-label="Регион ДФО"
              value={regionId}
              onChange={(e) => handleSelectRegion(e.target.value as CertificationDfoRegionId)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-2 focus:outline-teal-700 cursor-pointer"
            >
              {CERTIFICATION_DFO_REGIONS.map((reg) => (
                <option key={reg.id} value={reg.id}>
                  {reg.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Main Layout: Calendar Grid + Upcoming List & Selected Event Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Month Picker + Calendar Grid */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-teal-700" aria-hidden="true" />
              <span className="text-sm font-bold text-slate-900">{activeMonth.fullLabel}</span>
            </div>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              Событий в месяце: {monthEventsCount}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {CERTIFICATION_DFO_MONTHS.map((m, idx) => {
              const isSelected = idx === monthIdx;
              const prefix = `${m.year}-${String(m.month + 1).padStart(2, '0')}`;
              const hasEvents = filteredEvents.some((ev) => ev.startDateIso.startsWith(prefix));
              return (
                <button
                  key={m.shortLabel}
                  type="button"
                  onClick={() => setMonthIdx(idx)}
                  className={`px-2.5 py-1.5 text-xs font-mono rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 border-slate-900 text-white font-semibold'
                      : hasEvents
                      ? 'bg-white border-slate-200 text-slate-800 hover:border-teal-600'
                      : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {m.shortLabel}
                </button>
              );
            })}
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
              {WEEKDAYS_RU.map((day) => (
                <div
                  key={day}
                  className="py-2 text-center text-[11px] font-semibold text-slate-500 uppercase"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 bg-white">
              {monthCells.map((cell) => {
                const dayEvents = getCertificationEventsForIsoDate(cell.isoDate, filteredEvents);
                const hasExam = dayEvents.some((ev) => ev.type === 'exam');
                const hasMeeting = dayEvents.some((ev) => ev.type === 'meeting');
                const isActiveDay =
                  activeEvent != null &&
                  cell.isoDate >= activeEvent.startDateIso &&
                  cell.isoDate <= activeEvent.endDateIso;

                return (
                  <button
                    key={cell.isoDate}
                    type="button"
                    disabled={dayEvents.length === 0}
                    onClick={() => {
                      if (dayEvents[0]) handleSelectEvent(dayEvents[0]);
                    }}
                    className={`min-h-[54px] p-1.5 flex flex-col items-center justify-between transition-colors text-left ${
                      !cell.inCurrentMonth ? 'bg-slate-50/70 text-slate-300' : 'text-slate-800'
                    } ${
                      dayEvents.length > 0
                        ? isActiveDay
                          ? 'bg-teal-50 ring-1 ring-inset ring-teal-700 cursor-pointer'
                          : 'hover:bg-slate-50 cursor-pointer'
                        : 'cursor-default'
                    }`}
                  >
                    <span
                      className={`text-xs font-mono tabular-nums ${
                        isActiveDay
                          ? 'font-bold text-teal-800'
                          : dayEvents.length > 0
                          ? 'font-semibold text-slate-900'
                          : ''
                      }`}
                    >
                      {cell.dayOfMonth}
                    </span>

                    {dayEvents.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        {hasExam && (
                          <span
                            className="w-2 h-2 rounded-full bg-teal-700"
                            title="Квалификационный экзамен"
                          />
                        )}
                        {hasMeeting && (
                          <span
                            className="w-2 h-2 rounded-full bg-amber-600"
                            title="Очная встреча с комиссией"
                          />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-700 inline-block" />
              <span>Квалификационный экзамен</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" />
              <span>Очная встреча / разбор документов</span>
            </span>
          </div>
        </div>

        {/* Right: Upcoming Events List + Active Event Inspector */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">
              Ближайшие даты ({filteredEvents.length})
            </h4>
            <span className="text-xs text-slate-500">Выберите событие для просмотра площадки</span>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-600">
              По выбранному сочетанию региона и типа событий дат не найдено. Сбросьте фильтр на «Все
              события».
            </div>
          ) : (
            <>
              <div className="max-h-[220px] overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {filteredEvents.map((ev) => {
                  const selected = activeEvent?.id === ev.id;
                  const dateLabel =
                    ev.startDateIso === ev.endDateIso
                      ? ev.startDateIso.split('-').reverse().join('.')
                      : formatSessionRange(ev.startDateIso, ev.endDateIso);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => handleSelectEvent(ev)}
                      className={`w-full text-left px-4 py-3 flex items-start justify-between gap-3 transition-colors cursor-pointer ${
                        selected ? 'bg-teal-50/80' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span
                            className={`font-semibold ${
                              ev.type === 'exam' ? 'text-teal-700' : 'text-amber-700'
                            }`}
                          >
                            {ev.typeLabel}
                          </span>
                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span className="font-medium text-slate-600">{ev.regionName}</span>
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                          {ev.shortTitle}
                        </p>
                      </div>
                      <span className="text-xs font-mono text-slate-700 whitespace-nowrap shrink-0 tabular-nums pt-0.5">
                        {dateLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeEvent && (
                <div className="border border-slate-200 rounded-xl bg-slate-50 p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <span
                        className={`text-xs font-semibold uppercase tracking-wide ${
                          activeEvent.type === 'exam' ? 'text-teal-700' : 'text-amber-700'
                        }`}
                      >
                        {activeEvent.typeLabel} · {activeEvent.regionName}
                      </span>
                      <h5 className="text-base font-bold text-slate-900 leading-snug">
                        {activeEvent.title}
                      </h5>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {activeEvent.description}
                  </p>

                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-200">
                    <div className="flex items-start gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" aria-hidden="true" />
                      <div>
                        <dt className="text-slate-500">Дата и время</dt>
                        <dd className="font-semibold text-slate-900 font-mono tabular-nums">
                          {activeEvent.startDateIso === activeEvent.endDateIso
                            ? activeEvent.startDateIso.split('-').reverse().join('.')
                            : formatSessionRange(activeEvent.startDateIso, activeEvent.endDateIso)}{' '}
                          · {activeEvent.timeWindowLocal}
                        </dd>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" aria-hidden="true" />
                      <div>
                        <dt className="text-slate-500">Площадка проведения</dt>
                        <dd className="font-semibold text-slate-900">
                          {activeEvent.city}: {activeEvent.venue}
                        </dd>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Users className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" aria-hidden="true" />
                      <div>
                        <dt className="text-slate-500">Комиссия и категории</dt>
                        <dd className="font-medium text-slate-800">
                          {activeEvent.commissionHost} · {activeEvent.categories}
                        </dd>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <CheckCircle2
                        className="w-3.5 h-3.5 text-teal-700 mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      <div>
                        <dt className="text-slate-500">Квота группы</dt>
                        <dd className="font-semibold text-teal-800 font-mono tabular-nums">
                          Свободно {activeEvent.seatsRemaining} из {activeEvent.seatsTotal} мест
                        </dd>
                      </div>
                    </div>
                  </dl>

                  <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200/80">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadIcs}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Добавить в календарь (.ics)</span>
                      </button>

                      <a
                        href={buildCertificationGoogleCalendarUrl(activeEvent)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        <span>Google Календарь</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                      </a>

                      <a
                        href={buildYandexCalendarUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        <span>Яндекс Календарь</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                      </a>
                    </div>

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

                  {icsNotice && (
                    <p
                      role="status"
                      className="text-xs text-teal-900 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 font-medium"
                    >
                      {icsNotice}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
