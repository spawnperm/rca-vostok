export type CalendarEventKind = 'session' | 'webinar';

export interface AttestationCalendarEvent {
  id: string;
  kind: CalendarEventKind;
  kindLabel: string;
  title: string;
  shortTitle: string;
  startDateIso: string; // YYYY-MM-DD
  endDateIso: string; // YYYY-MM-DD
  startTimeVld: string; // HH:MM in Vladivostok (UTC+10)
  durationMinutes: number;
  regionLabel: string;
  formatLabel: string;
  location: string;
  organizer: string;
  description: string;
  inquiryRegion: string;
  inquiryTrack: string;
}

export const ATTESTATION_CALENDAR_EVENTS: AttestationCalendarEvent[] = [
  {
    id: 'cal-webinar-760',
    kind: 'webinar',
    kindLabel: 'Обучающий вебинар',
    title: 'Вебинар: Оформление паспорта маршрута (форма ПП РФ № 760) и типичные ошибки',
    shortTitle: 'Вебинар: ПП № 760',
    startDateIso: '2026-12-03',
    endDateIso: '2026-12-03',
    startTimeVld: '19:00',
    durationMinutes: 90,
    regionLabel: 'Онлайн (весь ДФО)',
    formatLabel: 'Онлайн-вебинар ВВГУ · 19:00 ВЛД (12:00 МСК)',
    location: 'Видеоконференция РЦА «Русский Восток» (ссылка после записи)',
    organizer: 'Галина Гомилевская · Председатель комиссии ВВГУ',
    description:
      'Практический разбор структуры паспорта маршрута, расчёта рисков, пропускной способности и согласования с администрациями ООПТ.',
    inquiryRegion: 'Приморский край',
    inquiryTrack: 'Пешеходный туризм',
  },
  {
    id: 'cal-webinar-contour-a',
    kind: 'webinar',
    kindLabel: 'Обучающий вебинар',
    title: 'Вебинар: Зачёт походного стажа (Контур А) и новые правила ПП РФ № 1893',
    shortTitle: 'Вебинар: Контур А',
    startDateIso: '2026-12-10',
    endDateIso: '2026-12-10',
    startTimeVld: '18:30',
    durationMinutes: 90,
    regionLabel: 'Онлайн (весь ДФО)',
    formatLabel: 'Онлайн-консультация · 18:30 ВЛД (11:30 МСК)',
    location: 'Онлайн-аудитория РЦА «Русский Восток»',
    organizer: 'Григорий Саранча · Руководитель РЦА «Русский Восток»',
    description:
      'Какие справки МКК, треки и договоры туроператоров принимаются для ускоренного допуска действующих гидов к аттестации.',
    inquiryRegion: 'Приморский край',
    inquiryTrack: 'Переаттестация действующего гида',
  },
  {
    id: 'cal-session-dec-water',
    kind: 'session',
    kindLabel: 'Аттестационная сессия',
    title: 'Зимняя аттестационная сессия: водный туризм и теоретический блок ВВГУ',
    shortTitle: 'Сессия: Вода (ВВГУ)',
    startDateIso: '2026-12-14',
    endDateIso: '2026-12-19',
    startTimeVld: '10:00',
    durationMinutes: 480,
    regionLabel: 'Приморский край (Владивосток)',
    formatLabel: 'Очная сессия · ВВГУ + тренажёрные спасработы',
    location: 'г. Владивосток, ул. Гоголя, д. 41 (ВВГУ)',
    organizer: 'Комиссия ВВГУ и ФСТР Приморского края',
    description:
      'Теоретическое тестирование, защита паспортов водных маршрутов 1–3 КС и спасработы на воде до старта весеннего паводка.',
    inquiryRegion: 'Приморский край',
    inquiryTrack: 'Водный туризм и сплавы',
  },
  {
    id: 'cal-webinar-wfa',
    kind: 'webinar',
    kindLabel: 'Обучающий вебинар',
    title: 'Вебинар: Первая помощь (Wilderness First Aid) и трекеры Garmin inReach на маршруте',
    shortTitle: 'Вебинар: WFA и связь',
    startDateIso: '2027-02-11',
    endDateIso: '2027-02-11',
    startTimeVld: '19:00',
    durationMinutes: 90,
    regionLabel: 'Онлайн (весь ДФО)',
    formatLabel: 'Онлайн-практикум · 19:00 ВЛД (12:00 МСК)',
    location: 'Видеоконференция РЦА «Русский Восток»',
    organizer: 'Елена Морозова · Эксперт ООПТ и WFA',
    description:
      'Разбор протоколов автономной первой помощи, алгоритма вызова МЧС через спутниковые трекеры и безопасности в ареале хищников.',
    inquiryRegion: 'Приморский край',
    inquiryTrack: 'Пешеходный туризм',
  },
  {
    id: 'cal-session-feb-khabarovsk',
    kind: 'session',
    kindLabel: 'Аттестационная сессия',
    title: 'Межрегиональная аттестационная сессия для гидов Хабаровского края (Контур А)',
    shortTitle: 'Сессия: Хабаровск',
    startDateIso: '2027-02-25',
    endDateIso: '2027-02-27',
    startTimeVld: '10:00',
    durationMinutes: 420,
    regionLabel: 'Хабаровский край / ВВГУ',
    formatLabel: 'Смешанный поток · Контур А (1–3 КС)',
    location: 'Дистанционная подача в Хабаровске · Комиссия ВВГУ (Владивосток)',
    organizer: 'Григорий Саранча · Андрей Киселёв (ФСТР Хабаровск)',
    description:
      'Единая сдача теоретического экзамена и защиты паспортов таёжно-речных маршрутов для выездной группы Хабаровского края.',
    inquiryRegion: 'Хабаровский край',
    inquiryTrack: 'Пешеходный туризм',
  },
  {
    id: 'cal-session-mar-kamchatka',
    kind: 'session',
    kindLabel: 'Аттестационная сессия',
    title: 'Переаттестация действующих гидов Камчатского края по ПП РФ № 1893',
    shortTitle: 'Сессия: Камчатка',
    startDateIso: '2027-03-12',
    endDateIso: '2027-03-14',
    startTimeVld: '10:00',
    durationMinutes: 420,
    regionLabel: 'Камчатский край',
    formatLabel: 'Межрегиональная переаттестация · 2–4 КС',
    location: 'г. Петропавловск-Камчатский / Межрегиональная комиссия РЦА',
    organizer: 'Наталья Соколова · Комиссия ВВГУ и ФСТР',
    description:
      'Подтверждение квалификации экспедиционных и вулканических гидов Камчатки до начала высокого весенне-летнего сезона.',
    inquiryRegion: 'Камчатский край',
    inquiryTrack: 'Переаттестация действующего гида',
  },
  {
    id: 'cal-webinar-shkotovo-prep',
    kind: 'webinar',
    kindLabel: 'Обучающий вебинар',
    title: 'Вебинар-инструктаж перед полевым этапом: Шкотовский полигон (переправы и ПСР)',
    shortTitle: 'Инструктаж: Полигон',
    startDateIso: '2027-04-06',
    endDateIso: '2027-04-06',
    startTimeVld: '18:30',
    durationMinutes: 75,
    regionLabel: 'Онлайн (Приморье и Сахалин)',
    formatLabel: 'Предэкзаменационный разбор · 18:30 ВЛД',
    location: 'Видеоконференция РЦА «Русский Восток»',
    organizer: 'Дмитрий Верещагин · Старший экзаменатор ФСТР',
    description:
      'Чек-лист личного снаряжения, требования к узлам, организации навесной переправы и критерии оценки полевых испытаний.',
    inquiryRegion: 'Приморский край',
    inquiryTrack: 'Пешеходный туризм',
  },
  {
    id: 'cal-session-apr-spring',
    kind: 'session',
    kindLabel: 'Аттестационная сессия',
    title: 'Весенняя полевая аттестационная сессия (Приморье, Сахалин и Курилы, 1–4 КС)',
    shortTitle: 'Сессия: Апрель (1–4 КС)',
    startDateIso: '2027-04-16',
    endDateIso: '2027-04-18',
    startTimeVld: '09:00',
    durationMinutes: 480,
    regionLabel: 'Приморский край / Сахалин',
    formatLabel: 'Очная теория (ВВГУ) + полигон Шкотовского р-на',
    location: 'г. Владивосток (ВВГУ) и хр. Ливадийский (Шкотовский округ)',
    organizer: 'Аттестационная комиссия ВВГУ и ФСТР',
    description:
      'Первая массовая весенняя сессия графика 2027 года по всем видам туризма (пешеходный, водный, горный, комбинированный).',
    inquiryRegion: 'Приморский край',
    inquiryTrack: 'Пешеходный туризм',
  },
  {
    id: 'cal-session-may-north',
    kind: 'session',
    kindLabel: 'Аттестационная сессия',
    title: 'Майская предсезонная аттестационная сессия (1–4 КС, Якутия и Амурская обл.)',
    shortTitle: 'Сессия: Май (1–4 КС)',
    startDateIso: '2027-05-14',
    endDateIso: '2027-05-16',
    startTimeVld: '09:00',
    durationMinutes: 480,
    regionLabel: 'Приморье · Якутия · Амур',
    formatLabel: 'Очно-дистанционный поток · 1–4 КС',
    location: 'Кампус ВВГУ и полигоны Приморского края',
    organizer: 'Межрегиональная комиссия РЦА «Русский Восток»',
    description:
      'Майский аттестационный поток перед открытием речной навигации и летнего сезона на ООПТ Дальнего Востока.',
    inquiryRegion: 'Другой регион ДФО',
    inquiryTrack: 'Водный туризм и сплавы',
  },
  {
    id: 'cal-session-jun-arctic',
    kind: 'session',
    kindLabel: 'Аттестационная сессия',
    title: 'Июньская предэкспедиционная сессия (1–4 КС, Магадан и Чукотка)',
    shortTitle: 'Сессия: Июнь (1–4 КС)',
    startDateIso: '2027-06-04',
    endDateIso: '2027-06-06',
    startTimeVld: '09:00',
    durationMinutes: 480,
    regionLabel: 'Магадан · Чукотка · ВВГУ',
    formatLabel: 'Летняя предэкспедиционная сессия · 1–4 КС',
    location: 'г. Владивосток (ВВГУ) + Шкотовский полигон',
    organizer: 'Комиссия ВВГУ и ФСТР',
    description:
      'Целевой предэкспедиционный блок для гидов-лидеров автономных маршрутов перед открытием короткого северного лета.',
    inquiryRegion: 'Другой регион ДФО',
    inquiryTrack: 'Пешеходный туризм',
  },
  {
    id: 'cal-session-oct1',
    kind: 'session',
    kindLabel: 'Аттестационная сессия',
    title: 'Осенняя аттестационная сессия РЦА «Русский Восток» (октябрь, поток 1, 1–4 КС)',
    shortTitle: 'Сессия: Окт. (1)',
    startDateIso: '2027-10-15',
    endDateIso: '2027-10-17',
    startTimeVld: '09:00',
    durationMinutes: 480,
    regionLabel: 'Приморский край (весь ДФО)',
    formatLabel: 'Очная сессия · 1–4 КС',
    location: 'г. Владивосток (ВВГУ) и полигон Шкотовского р-на',
    organizer: 'Комиссия ВВГУ и ФСТР',
    description:
      'Осенний аттестационный поток по итогам летнего походного сезона (зачёт наработанных туров и подготовка к сезону-2028).',
    inquiryRegion: 'Приморский край',
    inquiryTrack: 'Пешеходный туризм',
  },
  {
    id: 'cal-session-oct2',
    kind: 'session',
    kindLabel: 'Аттестационная сессия',
    title: 'Итоговая осенняя аттестационная сессия 2027 г. (поток 2, 1–4 КС)',
    shortTitle: 'Сессия: Окт. (2)',
    startDateIso: '2027-10-29',
    endDateIso: '2027-10-31',
    startTimeVld: '09:00',
    durationMinutes: 480,
    regionLabel: 'Приморский край (весь ДФО)',
    formatLabel: 'Очная сессия · 1–4 КС',
    location: 'г. Владивосток (ВВГУ) и полигон Шкотовского р-на',
    organizer: 'Комиссия ВВГУ и ФСТР',
    description:
      'Заключительная осенняя экзаменационная сессия 2027 года для всех категорий туризма и переаттестации действующих гидов.',
    inquiryRegion: 'Приморский край',
    inquiryTrack: 'Переаттестация действующего гида',
  },
];

export const CALENDAR_KEY_MONTHS: {
  year: number;
  month: number; // 0-indexed (0 = Jan, 11 = Dec)
  shortLabel: string;
  fullLabel: string;
}[] = [
  { year: 2026, month: 11, shortLabel: 'Дек 2026', fullLabel: 'Декабрь 2026' },
  { year: 2027, month: 1, shortLabel: 'Фев 2027', fullLabel: 'Февраль 2027' },
  { year: 2027, month: 2, shortLabel: 'Мар 2027', fullLabel: 'Март 2027' },
  { year: 2027, month: 3, shortLabel: 'Апр 2027', fullLabel: 'Апрель 2027' },
  { year: 2027, month: 4, shortLabel: 'Май 2027', fullLabel: 'Май 2027' },
  { year: 2027, month: 5, shortLabel: 'Июн 2027', fullLabel: 'Июнь 2027' },
  { year: 2027, month: 9, shortLabel: 'Окт 2027', fullLabel: 'Октябрь 2027' },
];

export interface CalendarDayCell {
  isoDate: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
}

function toIsoDateUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Builds Monday-first 35- or 42-day grid cells for a given month. */
export function buildCalendarMonthCells(year: number, monthZeroIndexed: number): CalendarDayCell[] {
  const firstOfMonth = new Date(Date.UTC(year, monthZeroIndexed, 1));
  const lastOfMonth = new Date(Date.UTC(year, monthZeroIndexed + 1, 0));

  // JS getUTCDay(): 0 = Sun, 1 = Mon ... 6 = Sat -> convert to Mon=0 .. Sun=6
  const startWeekday = (firstOfMonth.getUTCDay() + 6) % 7;
  const daysInMonth = lastOfMonth.getUTCDate();
  const totalCells = startWeekday + daysInMonth > 35 ? 42 : 35;

  const cells: CalendarDayCell[] = [];
  for (let i = 0; i < totalCells; i += 1) {
    const dayOffset = i - startWeekday;
    const cellDate = new Date(Date.UTC(year, monthZeroIndexed, 1 + dayOffset));
    cells.push({
      isoDate: toIsoDateUtc(cellDate),
      dayOfMonth: cellDate.getUTCDate(),
      inCurrentMonth: cellDate.getUTCMonth() === monthZeroIndexed,
    });
  }
  return cells;
}

export function getEventsForDate(
  isoDate: string,
  events: AttestationCalendarEvent[] = ATTESTATION_CALENDAR_EVENTS
): AttestationCalendarEvent[] {
  return events.filter((ev) => isoDate >= ev.startDateIso && isoDate <= ev.endDateIso);
}

export type DfoRegionFilterId =
  | 'all'
  | 'primorye'
  | 'khabarovsk'
  | 'kamchatka'
  | 'sakhalin'
  | 'yakutia_amur'
  | 'magadan_chukotka';

export const DFO_REGION_FILTER_OPTIONS: readonly {
  id: DfoRegionFilterId;
  label: string;
}[] = [
  { id: 'all', label: 'Все регионы ДФО' },
  { id: 'primorye', label: 'Приморский край' },
  { id: 'khabarovsk', label: 'Хабаровский край' },
  { id: 'kamchatka', label: 'Камчатский край' },
  { id: 'sakhalin', label: 'Сахалинская область' },
  { id: 'yakutia_amur', label: 'Якутия и Амурская обл.' },
  { id: 'magadan_chukotka', label: 'Магадан и Чукотка' },
];

const REGION_KEYWORDS: Record<Exclude<DfoRegionFilterId, 'all'>, readonly string[]> = {
  primorye: ['примор', 'владивосток', 'шкотов'],
  khabarovsk: ['хабаров'],
  kamchatka: ['камчат'],
  sakhalin: ['сахалин', 'курил'],
  yakutia_amur: ['якут', 'амур'],
  magadan_chukotka: ['магадан', 'чукот'],
};

export function matchesDirectDfoRegion(
  event: AttestationCalendarEvent,
  regionFilter: DfoRegionFilterId
): boolean {
  if (regionFilter === 'all') return true;
  const haystack = `${event.regionLabel} ${event.inquiryRegion} ${event.location} ${event.title}`.toLowerCase();
  return REGION_KEYWORDS[regionFilter].some((kw) => haystack.includes(kw));
}

export function matchesDfoRegionFilter(
  event: AttestationCalendarEvent,
  regionFilter: DfoRegionFilterId
): boolean {
  if (regionFilter === 'all') return true;
  if (matchesDirectDfoRegion(event, regionFilter)) return true;
  return event.regionLabel.toLowerCase().includes('весь дфо');
}

export function filterAttestationCalendarEvents(
  events: readonly AttestationCalendarEvent[],
  kindFilter: 'all' | CalendarEventKind,
  regionFilter: DfoRegionFilterId
): AttestationCalendarEvent[] {
  return events.filter((ev) => {
    const matchesKind = kindFilter === 'all' || ev.kind === kindFilter;
    return matchesKind && matchesDfoRegionFilter(ev, regionFilter);
  });
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatIcsUtcTimestamp(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

function computeUtcWindow(event: AttestationCalendarEvent): { startUtc: Date; endUtc: Date } {
  const [y, m, d] = event.startDateIso.split('-').map(Number);
  const [hh, mm] = event.startTimeVld.split(':').map(Number);
  // Vladivostok is UTC+10 year-round -> subtract 10h to get UTC
  const startMs = Date.UTC(y, m - 1, d, hh - 10, mm, 0);

  let endMs: number;
  if (event.endDateIso !== event.startDateIso) {
    const [ey, em, ed] = event.endDateIso.split('-').map(Number);
    endMs = Date.UTC(ey, em - 1, ed, 18 - 10, 0, 0);
  } else {
    endMs = startMs + event.durationMinutes * 60 * 1000;
  }

  return { startUtc: new Date(startMs), endUtc: new Date(endMs) };
}

/** Generates a standards-compliant RFC 5545 .ics calendar file with a VALARM reminder. */
export function buildIcsEventContent(
  event: AttestationCalendarEvent,
  reminderMinutesBefore = 1440,
  now = new Date()
): string {
  const { startUtc, endUtc } = computeUtcWindow(event);
  const safeMinutes = Math.max(15, Math.min(reminderMinutesBefore, 43200));

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RCA Russkiy Vostok//VVGU Calendar//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@rca-vostok.ru`,
    `DTSTAMP:${formatIcsUtcTimestamp(now)}`,
    `DTSTART:${formatIcsUtcTimestamp(startUtc)}`,
    `DTEND:${formatIcsUtcTimestamp(endUtc)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    `DESCRIPTION:${escapeIcsText(`${event.kindLabel} (${event.organizer}). ${event.description} Портал: https://rca-vostok.ru`)}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(`Напоминание РЦА «Русский Восток»: ${event.shortTitle}`)}`,
    `TRIGGER:-PT${safeMinutes}M`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

export function buildGoogleCalendarUrl(event: AttestationCalendarEvent): string {
  const { startUtc, endUtc } = computeUtcWindow(event);
  const dates = `${formatIcsUtcTimestamp(startUtc)}/${formatIcsUtcTimestamp(endUtc)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates,
    location: event.location,
    details: `${event.kindLabel} · ${event.organizer}\n\n${event.description}\n\nИсточник: https://rca-vostok.ru`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadCalendarIcs(
  event: AttestationCalendarEvent,
  reminderMinutesBefore = 1440
): string {
  const ics = buildIcsEventContent(event, reminderMinutesBefore);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const fileName = `RCA_Vostok_${event.startDateIso}_${event.id}.ics`;

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return fileName;
}

export interface ScheduleSlotLike {
  start: string;
  end: string;
  category: string;
  disciplines: readonly string[];
}

/** Converts a CertificationSlot or exam date window into an AttestationCalendarEvent for .ics export. */
export function buildScheduleSlotCalendarEvent(
  slot: ScheduleSlotLike,
  index = 0
): AttestationCalendarEvent {
  const disciplinesLabel = slot.disciplines.join(', ');
  return {
    id: `session-${slot.start}-${index + 1}`,
    kind: 'session',
    kindLabel: 'Аттестационная сессия',
    title: `Аттестация РЦА «Русский Восток» (${slot.category})`,
    shortTitle: `Сессия ${slot.start} (${slot.category})`,
    startDateIso: slot.start,
    endDateIso: slot.end || slot.start,
    startTimeVld: '09:00',
    durationMinutes: 480,
    regionLabel: 'Приморский край / весь ДФО',
    formatLabel: `Очная сессия · ${slot.category}`,
    location: 'г. Владивосток, ул. Гоголя, д. 41 (ВВГУ) и полигон Шкотовского р-на',
    organizer: 'Комиссия РЦА «Русский Восток» (ВВГУ и ФСТР)',
    description: `Направления: ${disciplinesLabel}. Регламент ПП РФ № 1003 и № 1893.`,
    inquiryRegion: 'Приморский край',
    inquiryTrack: 'Пешеходный туризм',
  };
}

/** Builds a Yandex Calendar link with informational import guidance alongside .ics download. */
export function buildYandexCalendarUrl(): string {
  return 'https://calendar.yandex.ru/';
}

