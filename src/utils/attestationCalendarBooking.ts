import { CERTIFICATION_SCHEDULE, formatSessionRange } from '../data/landingContent.ts';

export interface UpcomingSessionView {
  id: string;
  start: string;
  end: string;
  rangeLabel: string;
  monthLabel: string;
  year: number;
  month: number; // 0-indexed (0 = Jan .. 11 = Dec)
  category: string;
  disciplines: string[];
  venue: string;
  daysUntilStart: number;
  availabilityLabel: string;
  title?: string;
  examFormat?: string;
  regionLabel?: string;
  startTimeVld?: string;
  commissionInfo?: string;
  seatsTotal?: number;
  seatsAvailable?: number;
  registrationDeadlineLabel?: string;
  dayPlan?: string[];
}

export interface SessionMonthTab {
  key: string;
  year: number;
  month: number;
  label: string;
  shortLabel: string;
  sessionCount: number;
}

export interface CalendarDayCell {
  isoDate: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  session: UpcomingSessionView | null;
  isSessionStart: boolean;
  isSessionEnd: boolean;
  isBooked: boolean;
}

const MONTHS_NOMINATIVE_RU = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const MONTHS_SHORT_RU = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек',
];

export const WEEKDAYS_SHORT_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

export function diffUtcDays(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime();
  const b = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

export function formatMonthTitleRu(year: number, monthZeroBased: number): string {
  const name = MONTHS_NOMINATIVE_RU[monthZeroBased] ?? '';
  return `${name} ${year}`;
}

export function getUpcomingAttestationSessions(
  todayIso = new Date().toISOString().slice(0, 10)
): UpcomingSessionView[] {
  const all: UpcomingSessionView[] = CERTIFICATION_SCHEDULE.map((slot) => {
    const startDate = new Date(`${slot.start}T00:00:00Z`);
    const year = startDate.getUTCFullYear();
    const month = startDate.getUTCMonth();
    const daysUntilStart = diffUtcDays(todayIso, slot.start);
    const daysUntilEnd = diffUtcDays(todayIso, slot.end);

    let availabilityLabel: string;
    if (daysUntilEnd < 0) {
      availabilityLabel = 'Сессия завершена';
    } else if (daysUntilStart <= 0) {
      availabilityLabel = 'Идёт сейчас';
    } else if (daysUntilStart === 1) {
      availabilityLabel = 'Завтра · приём открыт';
    } else {
      availabilityLabel = `Через ${daysUntilStart} дн.`;
    }

    return {
      id: `session-${slot.start}`,
      start: slot.start,
      end: slot.end,
      rangeLabel: formatSessionRange(slot.start, slot.end),
      monthLabel: formatMonthTitleRu(year, month),
      year,
      month,
      category: slot.category,
      disciplines: [...slot.disciplines],
      venue: 'г. Владивосток (ВВГУ) и полигон Шкотовского р-на',
      daysUntilStart,
      availabilityLabel,
    };
  });

  const upcoming = all.filter((s) => s.end >= todayIso);
  return upcoming.length > 0 ? upcoming : all;
}

export function getSessionMonths(sessions: UpcomingSessionView[]): SessionMonthTab[] {
  const map = new Map<string, SessionMonthTab>();
  for (const session of sessions) {
    const key = `${session.year}-${String(session.month + 1).padStart(2, '0')}`;
    const existing = map.get(key);
    if (existing) {
      existing.sessionCount += 1;
    } else {
      map.set(key, {
        key,
        year: session.year,
        month: session.month,
        label: `${MONTHS_NOMINATIVE_RU[session.month]} ${session.year}`,
        shortLabel: `${MONTHS_SHORT_RU[session.month]} ${session.year}`,
        sessionCount: 1,
      });
    }
  }
  return Array.from(map.values());
}

export function getDefaultCalendarMonth(
  sessions: UpcomingSessionView[],
  selectedDateIso?: string
): { year: number; month: number } {
  if (selectedDateIso && /^\d{4}-\d{2}-\d{2}$/.test(selectedDateIso)) {
    const matched = sessions.find(
      (s) => selectedDateIso >= s.start && selectedDateIso <= s.end
    );
    if (matched) {
      return { year: matched.year, month: matched.month };
    }
    const d = new Date(`${selectedDateIso}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) {
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    }
  }
  const first = sessions[0];
  if (first) {
    return { year: first.year, month: first.month };
  }
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
}

export function buildMonthCalendarGrid(
  year: number,
  monthZeroBased: number,
  sessions: UpcomingSessionView[],
  bookedSessionDates: Set<string>,
  todayIso = new Date().toISOString().slice(0, 10)
): CalendarDayCell[] {
  const firstOfMonth = new Date(Date.UTC(year, monthZeroBased, 1));
  // Convert JS getUTCDay (0=Sun..6=Sat) to Monday-first index (0=Mon..6=Sun)
  const startWeekday = (firstOfMonth.getUTCDay() + 6) % 7;

  const daysInMonth = new Date(Date.UTC(year, monthZeroBased + 1, 0)).getUTCDate();
  const totalCells = startWeekday + daysInMonth > 35 ? 42 : 35;

  const gridStart = new Date(Date.UTC(year, monthZeroBased, 1 - startWeekday));
  const cells: CalendarDayCell[] = [];

  for (let i = 0; i < totalCells; i += 1) {
    const cellDate = new Date(gridStart.getTime() + i * 86400000);
    const isoDate = cellDate.toISOString().slice(0, 10);
    const dayOfMonth = cellDate.getUTCDate();
    const inCurrentMonth =
      cellDate.getUTCFullYear() === year && cellDate.getUTCMonth() === monthZeroBased;
    const weekday = (cellDate.getUTCDay() + 6) % 7;
    const isWeekend = weekday === 5 || weekday === 6;

    const matchedSession =
      sessions.find((s) => isoDate >= s.start && isoDate <= s.end) ?? null;

    cells.push({
      isoDate,
      dayOfMonth,
      inCurrentMonth,
      isToday: isoDate === todayIso,
      isWeekend,
      session: matchedSession,
      isSessionStart: matchedSession ? isoDate === matchedSession.start : false,
      isSessionEnd: matchedSession ? isoDate === matchedSession.end : false,
      isBooked: matchedSession ? bookedSessionDates.has(matchedSession.start) : false,
    });
  }

  return cells;
}

interface InPersonExamExtraMeta {
  start: string;
  end: string;
  category: string;
  disciplines: string[];
  title: string;
  examFormat: string;
  regionLabel: string;
  venue: string;
  startTimeVld: string;
  commissionInfo: string;
  seatsTotal: number;
  seatsAvailable: number;
  dayPlan: string[];
}

const IN_PERSON_EXAMS_EXTENDED: readonly InPersonExamExtraMeta[] = [
  {
    start: '2026-12-14',
    end: '2026-12-19',
    category: '1–3 КС',
    disciplines: ['водный', 'пешеходный', 'пешеходный + водный'],
    title: 'Зимний очный экзамен (Водный туризм и теория ВВГУ)',
    examFormat: 'Очный экзамен · Кампус и тренажёрный зал ВВГУ',
    regionLabel: 'Приморский край (г. Владивосток)',
    venue: 'г. Владивосток, ул. Гоголя, д. 41 (ВВГУ)',
    startTimeVld: '10:00 ВЛД',
    commissionInfo: 'Галина Гомилевская, Дмитрий Верещагин (ФСТР ПК)',
    seatsTotal: 25,
    seatsAvailable: 7,
    dayPlan: [
      'День 1–2: очное тестирование по ПП РФ № 1003/1893 и защита паспортов № 760',
      'День 3–4: тренажёрная практика ПСР на воде, узлы, переправы и WFA',
      'День 5–6: итоговый зачёт комиссии и оформление протокола для ЕФРТА',
    ],
  },
  {
    start: '2027-02-25',
    end: '2027-02-27',
    category: '1–3 КС',
    disciplines: ['пешеходный', 'водный', 'пешеходный + водный'],
    title: 'Межрегиональный очный экзамен (Поток Хабаровского края)',
    examFormat: 'Очный экзамен · Выездная комиссия РЦА и ВВГУ',
    regionLabel: 'Хабаровский край / Владивосток',
    venue: 'г. Владивосток (ВВГУ) + сверка документов в Хабаровске',
    startTimeVld: '10:00 ВЛД',
    commissionInfo: 'Григорий Саранча, Андрей Киселёв (ФСТР Хабаровск)',
    seatsTotal: 20,
    seatsAvailable: 9,
    dayPlan: [
      'День 1: очный теоретический экзамен и проверка походного стажа (Контур А/Б)',
      'День 2–3: защита маршрутных паспортов таёжных сплавов и контрольный практикум',
    ],
  },
  {
    start: '2027-03-12',
    end: '2027-03-14',
    category: '2–4 КС',
    disciplines: ['горный', 'пешеходный', 'пешеходный + горный'],
    title: 'Очная сессия переаттестации (Камчатский поток)',
    examFormat: 'Очный экзамен · Экспедиционный и горный профиль',
    regionLabel: 'Камчатский край / Межрегиональный центр',
    venue: 'г. Петропавловск-Камчатский / Межрегиональная комиссия РЦА',
    startTimeVld: '10:00 ВЛД',
    commissionInfo: 'Наталья Соколова, Дмитрий Верещагин',
    seatsTotal: 20,
    seatsAvailable: 6,
    dayPlan: [
      'День 1: проверка стажа переаттестации по ПП РФ № 1893 и тестирование',
      'День 2–3: горно-вулканические спасработы, связь и первая помощь (WFA)',
    ],
  },
  {
    start: '2027-04-16',
    end: '2027-04-18',
    category: '1–4 КС',
    disciplines: [...CERTIFICATION_SCHEDULE[0].disciplines],
    title: 'Весенний очно-полевой экзамен (Приморье, Сахалин, Курилы)',
    examFormat: 'Очный экзамен · Теория (ВВГУ) + полигон',
    regionLabel: 'Приморский край / Весь ДФО',
    venue: 'г. Владивосток (ВВГУ) и полигон Шкотовского р-на',
    startTimeVld: '09:00 ВЛД',
    commissionInfo: 'Главная аттестационная комиссия ВВГУ и ФСТР',
    seatsTotal: 30,
    seatsAvailable: 14,
    dayPlan: [
      'День 1: компьютерное тестирование и очная защита паспорта маршрута в ВВГУ',
      'День 2–3: полевой выход (хр. Ливадийский / р. Шкотовка) — переправы, WFA, ориентирование',
    ],
  },
  {
    start: '2027-05-14',
    end: '2027-05-16',
    category: '1–4 КС',
    disciplines: [...CERTIFICATION_SCHEDULE[1].disciplines],
    title: 'Майский предсезонный очный экзамен (все виды туризма)',
    examFormat: 'Очный экзамен · Теория (ВВГУ) + полигон',
    regionLabel: 'Приморье · Якутия · Амурская обл.',
    venue: 'г. Владивосток (ВВГУ) и полигон Шкотовского р-на',
    startTimeVld: '09:00 ВЛД',
    commissionInfo: 'Межрегиональная комиссия РЦА «Русский Восток»',
    seatsTotal: 30,
    seatsAvailable: 18,
    dayPlan: [
      'День 1: очный экзаменационный билет и проверка документов МЧС / ООПТ',
      'День 2–3: полевой полигон — спасработы в автономной среде и радиосвязь',
    ],
  },
  {
    start: '2027-06-04',
    end: '2027-06-06',
    category: '1–4 КС',
    disciplines: [...CERTIFICATION_SCHEDULE[2].disciplines],
    title: 'Июньский очно-полевой экзамен перед летним сезоном',
    examFormat: 'Очный экзамен · Теория (ВВГУ) + полигон',
    regionLabel: 'Весь ДФО (вкл. Магадан и Чукотку)',
    venue: 'г. Владивосток (ВВГУ) и полигон Шкотовского р-на',
    startTimeVld: '09:00 ВЛД',
    commissionInfo: 'Аттестационная комиссия ВВГУ и ФСТР',
    seatsTotal: 30,
    seatsAvailable: 21,
    dayPlan: [
      'День 1: теоретический блок, защита маршрутов и оценка рисков ЧС',
      'День 2–3: контрольные испытания на горно-таёжном и речном полигоне',
    ],
  },
  {
    start: '2027-10-15',
    end: '2027-10-17',
    category: '1–4 КС',
    disciplines: [...CERTIFICATION_SCHEDULE[3].disciplines],
    title: 'Осенний очный экзамен (первый октябрьский поток)',
    examFormat: 'Очный экзамен · Теория (ВВГУ) + полигон',
    regionLabel: 'Весь ДФО',
    venue: 'г. Владивосток (ВВГУ) и полигон Шкотовского р-на',
    startTimeVld: '09:00 ВЛД',
    commissionInfo: 'Аттестационная комиссия ВВГУ и ФСТР',
    seatsTotal: 30,
    seatsAvailable: 26,
    dayPlan: [
      'День 1: очный разбор итоговых маршрутных отчётов и тестирование',
      'День 2–3: практические испытания на осеннем полевом полигоне',
    ],
  },
  {
    start: '2027-10-29',
    end: '2027-10-31',
    category: '1–4 КС',
    disciplines: [...CERTIFICATION_SCHEDULE[4].disciplines],
    title: 'Осенний очный экзамен (заключительный поток 2027 г.)',
    examFormat: 'Очный экзамен · Теория (ВВГУ) + полигон',
    regionLabel: 'Весь ДФО',
    venue: 'г. Владивосток (ВВГУ) и полигон Шкотовского р-на',
    startTimeVld: '09:00 ВЛД',
    commissionInfo: 'Аттестационная комиссия ВВГУ и ФСТР',
    seatsTotal: 30,
    seatsAvailable: 28,
    dayPlan: [
      'День 1: теоретический экзамен и защита паспортов по ПП № 760',
      'День 2–3: полевая аттестация и передача протоколов в ЕФРТА',
    ],
  },
];

function computeDeadlineLabel(startIso: string): string {
  const start = new Date(`${startIso}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return 'За 10 дней до экзамена';
  const deadline = new Date(start.getTime() - 10 * 86400000);
  return `до ${deadline.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })}`;
}

export function getInPersonExamSchedule(
  todayIso = new Date().toISOString().slice(0, 10)
): UpcomingSessionView[] {
  const all: UpcomingSessionView[] = IN_PERSON_EXAMS_EXTENDED.map((slot) => {
    const startDate = new Date(`${slot.start}T00:00:00Z`);
    const year = startDate.getUTCFullYear();
    const month = startDate.getUTCMonth();
    const daysUntilStart = diffUtcDays(todayIso, slot.start);
    const daysUntilEnd = diffUtcDays(todayIso, slot.end);

    let availabilityLabel: string;
    if (daysUntilEnd < 0) {
      availabilityLabel = 'Экзамен завершён';
    } else if (daysUntilStart <= 0) {
      availabilityLabel = 'Идёт сейчас';
    } else if (daysUntilStart === 1) {
      availabilityLabel = 'Завтра · приём открыт';
    } else {
      availabilityLabel = `Через ${daysUntilStart} дн.`;
    }

    return {
      id: `exam-${slot.start}`,
      start: slot.start,
      end: slot.end,
      rangeLabel: formatSessionRange(slot.start, slot.end),
      monthLabel: formatMonthTitleRu(year, month),
      year,
      month,
      category: slot.category,
      disciplines: [...slot.disciplines],
      venue: slot.venue,
      daysUntilStart,
      availabilityLabel,
      title: slot.title,
      examFormat: slot.examFormat,
      regionLabel: slot.regionLabel,
      startTimeVld: slot.startTimeVld,
      commissionInfo: slot.commissionInfo,
      seatsTotal: slot.seatsTotal,
      seatsAvailable: slot.seatsAvailable,
      registrationDeadlineLabel: computeDeadlineLabel(slot.start),
      dayPlan: [...slot.dayPlan],
    };
  });

  const upcoming = all.filter((s) => s.end >= todayIso);
  return upcoming.length > 0 ? upcoming : all;
}

export type ExamDisciplineFilter =
  | 'all'
  | 'пешеходный'
  | 'водный'
  | 'горный'
  | 'спелеологический';

export function filterExamSchedule(
  sessions: readonly UpcomingSessionView[],
  disciplineFilter: ExamDisciplineFilter
): UpcomingSessionView[] {
  if (disciplineFilter === 'all') return [...sessions];
  return sessions.filter((s) =>
    s.disciplines.some((d) => d.includes(disciplineFilter))
  );
}

