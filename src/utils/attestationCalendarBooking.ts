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
