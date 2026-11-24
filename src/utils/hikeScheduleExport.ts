import {
  resolveJournalRegionId,
  getJournalRegionById,
  type ExperienceLogEntry,
  type ExpeditionComplexity,
} from '../domain/experience/ExperienceEntry.ts';
import {
  escapeIcsText,
  formatIcsUtcTimestamp,
} from './attestationCalendar.ts';
import { downloadTextFile } from './download.ts';

export { escapeIcsText, formatIcsUtcTimestamp };

export type HikeDisciplineId = 'hiking' | 'water' | 'mountain' | 'ski' | 'combined';

export type HikeReminderLeadDays = 1 | 3 | 10;

export interface PlannedHikeEntry {
  id: string;
  title: string;
  region: string;
  discipline: HikeDisciplineId;
  complexity: ExpeditionComplexity;
  startDateIso: string; // YYYY-MM-DD
  endDateIso: string; // YYYY-MM-DD
  startTimeLocal: string; // HH:MM (Asia/Vladivostok UTC+10)
  participantsCount: number;
  meetingPoint: string;
  reminderDaysBefore: HikeReminderLeadDays;
  notes: string;
}

export const HIKE_DISCIPLINE_OPTIONS: readonly {
  id: HikeDisciplineId;
  label: string;
}[] = [
  { id: 'hiking', label: 'Пешеходный туризм' },
  { id: 'water', label: 'Водный туризм и сплавы' },
  { id: 'mountain', label: 'Горный туризм' },
  { id: 'ski', label: 'Лыжный и зимний туризм' },
  { id: 'combined', label: 'Комбинированный маршрут' },
];

export const HIKE_REMINDER_OPTIONS: readonly {
  days: HikeReminderLeadDays;
  label: string;
  shortLabel: string;
}[] = [
  { days: 1, label: 'За 24 часа до выхода (контроль снаряжения)', shortLabel: 'За 24 ч' },
  { days: 3, label: 'За 3 дня (проверка прогноза и списка группы)', shortLabel: 'За 3 дня' },
  {
    days: 10,
    label: 'За 10 дней (срок обязательного уведомления МЧС)',
    shortLabel: 'За 10 дней · МЧС',
  },
];

export interface CalendarClientGuide {
  id: 'google' | 'yandex' | 'apple';
  name: string;
  steps: string;
  actionUrl?: string;
  actionLabel?: string;
}

export const CALENDAR_CLIENT_GUIDES: readonly CalendarClientGuide[] = [
  {
    id: 'google',
    name: 'Google Календарь',
    steps: 'Настройки -> Импорт и экспорт -> Выберите скачанный файл .ics и нажмите «Импортировать».',
    actionUrl: 'https://calendar.google.com/calendar/u/0/r/settings/export',
    actionLabel: 'Открыть импорт Google',
  },
  {
    id: 'yandex',
    name: 'Яндекс Календарь',
    steps: 'Нажмите «Создать календарь» или «Импорт» (значок шестерёнки) и загрузите файл .ics.',
    actionUrl: 'https://calendar.yandex.ru/',
    actionLabel: 'Открыть Яндекс Календарь',
  },
  {
    id: 'apple',
    name: 'Apple Календарь',
    steps: 'macOS: Файл -> Импорт (.ics). На iPhone/iPad: откройте скачанный файл и выберите «Добавить все».',
  },
];

const STORAGE_PREFIX = 'rca-planned-hikes-v1:';

function getStorageKey(userId?: string | null): string {
  return `${STORAGE_PREFIX}${userId ? userId : 'guest'}`;
}

export function getDisciplineLabel(discipline: HikeDisciplineId): string {
  return HIKE_DISCIPLINE_OPTIONS.find((d) => d.id === discipline)?.label ?? 'Пешеходный туризм';
}

export function getDefaultPlannedHikes(preferredRegion?: string): PlannedHikeEntry[] {
  const homeId = resolveJournalRegionId(preferredRegion);
  const homeRegion = getJournalRegionById(homeId);

  const primaryRoute: PlannedHikeEntry =
    homeId === 'kamchatka'
      ? {
          id: 'hike-plan-1',
          title: 'Восхождение на Авачинский вулкан (группа 10 чел.)',
          region: 'Камчатский край',
          discipline: 'mountain',
          complexity: '2 КС',
          startDateIso: '2027-04-24',
          endDateIso: '2027-04-25',
          startTimeLocal: '07:30',
          participantsCount: 10,
          meetingPoint: 'Базовый лагерь Авача (кордон парка)',
          reminderDaysBefore: 10,
          notes: 'Уведомление МЧС за 10 дней, проверка кошек и ледорубов.',
        }
      : homeId === 'sakhalin'
        ? {
            id: 'hike-plan-1',
            title: 'Береговой маршрут: мыс Птичий — мыс Великан',
            region: 'Сахалинская область',
            discipline: 'hiking',
            complexity: '1 КС',
            startDateIso: '2027-04-24',
            endDateIso: '2027-04-24',
            startTimeLocal: '08:00',
            participantsCount: 14,
            meetingPoint: 'г. Южно-Сахалинск, ж/д вокзал (выезд вахтовки)',
            reminderDaysBefore: 10,
            notes: 'Сверка таблицы приливов и проверка спутникового трекера.',
          }
        : {
            id: 'hike-plan-1',
            title:
              homeId === 'primorye'
                ? 'Ливадийский хребет · г. Фалаза — г. Пидан (траверс)'
                : `Учебный поход выходного дня · ${homeRegion.shortName}`,
            region: homeRegion.name,
            discipline: 'hiking',
            complexity: '2 КС',
            startDateIso: '2027-04-24',
            endDateIso: '2027-04-25',
            startTimeLocal: '08:00',
            participantsCount: 12,
            meetingPoint:
              homeId === 'primorye'
                ? 'с. Анисимовка, парковка у ж/д станции'
                : `Сбор группы: ${homeRegion.shortName}`,
            reminderDaysBefore: 10,
            notes: 'Регистрация группы в МЧС, проверка аптечки WFA и радиосвязи.',
          };

  return [
    primaryRoute,
    {
      id: 'hike-plan-2',
      title: 'Сплав по р. Кема · весенний паводок (рафтинг)',
      region: 'Приморский край',
      discipline: 'water',
      complexity: '3 КС',
      startDateIso: '2027-05-21',
      endDateIso: '2027-05-24',
      startTimeLocal: '09:00',
      participantsCount: 8,
      meetingPoint: 'пос. Амгу / стапель на р. Кема',
      reminderDaysBefore: 10,
      notes: 'Обязательны каски, спасжилеты и проверка спасбросков до выхода на воду.',
    },
    {
      id: 'hike-plan-3',
      title: 'Экспедиция по хребту Дуссе-Алинь · оз. Корбохон',
      region: 'Хабаровский край',
      discipline: 'combined',
      complexity: '4 КС',
      startDateIso: '2027-06-18',
      endDateIso: '2027-06-25',
      startTimeLocal: '07:00',
      participantsCount: 9,
      meetingPoint: 'ст. Бриакан, встреча у заброски',
      reminderDaysBefore: 10,
      notes: 'Оформление пропуска в Буреинский заповедник и установка КСР в МКК.',
    },
  ];
}

export function readStoredPlannedHikes(
  userId?: string | null,
  preferredRegion?: string
): PlannedHikeEntry[] {
  if (typeof window === 'undefined') {
    return getDefaultPlannedHikes(preferredRegion);
  }
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) {
      return getDefaultPlannedHikes(preferredRegion);
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return getDefaultPlannedHikes(preferredRegion);
    }
    const valid = parsed.filter(
      (item): item is PlannedHikeEntry =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as PlannedHikeEntry).id === 'string' &&
        typeof (item as PlannedHikeEntry).title === 'string' &&
        typeof (item as PlannedHikeEntry).startDateIso === 'string' &&
        typeof (item as PlannedHikeEntry).endDateIso === 'string'
    );
    return valid.length > 0
      ? [...valid].sort((a, b) => a.startDateIso.localeCompare(b.startDateIso))
      : [];
  } catch {
    return getDefaultPlannedHikes(preferredRegion);
  }
}

export function writeStoredPlannedHikes(
  userId: string | null | undefined,
  hikes: readonly PlannedHikeEntry[]
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(hikes));
  } catch {
    // ignore storage quota errors gracefully
  }
}

export function convertExperienceEntryToPlannedHike(
  entry: ExperienceLogEntry,
  targetStartDateIso: string,
  now = new Date()
): PlannedHikeEntry {
  return {
    id: `hike-from-${entry.id}-${now.getTime()}`,
    title: entry.routeTitle,
    region: entry.regionName,
    discipline: entry.routeTitle.toLowerCase().includes('сплав')
      ? 'water'
      : entry.routeTitle.toLowerCase().includes('горн') ||
          entry.routeTitle.toLowerCase().includes('траверс')
        ? 'mountain'
        : 'hiking',
    complexity: entry.complexity,
    startDateIso: targetStartDateIso,
    endDateIso: targetStartDateIso,
    startTimeLocal: '08:00',
    participantsCount: entry.participantsCount,
    meetingPoint: entry.startPoint?.label ?? entry.regionName,
    reminderDaysBefore: 10,
    notes: entry.notes || 'Маршрут перенесён из журнала походного стажа.',
  };
}

export function computeHikeUtcWindow(hike: PlannedHikeEntry): { startUtc: Date; endUtc: Date } {
  const [sy, sm, sd] = hike.startDateIso.split('-').map(Number);
  const [hhRaw, mmRaw] = (hike.startTimeLocal || '08:00').split(':').map(Number);
  const hh = Number.isFinite(hhRaw) ? hhRaw : 8;
  const mm = Number.isFinite(mmRaw) ? mmRaw : 0;

  // Far East base offset (Vladivostok UTC+10) -> convert to UTC for universal compatibility
  const startMs = Date.UTC(sy, (sm || 1) - 1, sd || 1, hh - 10, mm, 0);

  const safeEndIso = hike.endDateIso >= hike.startDateIso ? hike.endDateIso : hike.startDateIso;
  const [ey, em, ed] = safeEndIso.split('-').map(Number);
  const endMs =
    safeEndIso === hike.startDateIso
      ? startMs + 9 * 60 * 60 * 1000 // single-day hike defaults to 9h field window
      : Date.UTC(ey, (em || 1) - 1, ed || 1, 18 - 10, 0, 0);

  return {
    startUtc: new Date(startMs),
    endUtc: new Date(Math.max(endMs, startMs + 60 * 60 * 1000)),
  };
}

export interface BuildHikesScheduleIcsOptions {
  calendarName?: string;
  overrideReminderDays?: HikeReminderLeadDays;
  now?: Date;
}

/**
 * Generates an RFC 5545 multi-event .ics calendar file compatible with
 * Google Calendar, Yandex Calendar, and Apple Calendar.
 */
export function buildHikesScheduleIcs(
  hikes: readonly PlannedHikeEntry[],
  options: BuildHikesScheduleIcsOptions = {}
): string {
  if (hikes.length === 0) {
    throw new Error('Выберите хотя бы один запланированный маршрут для экспорта в .ics.');
  }

  const now = options.now ?? new Date();
  const dtStamp = formatIcsUtcTimestamp(now);
  const calName = options.calendarName ?? 'График походов · РЦА «Русский Восток»';

  const sortedHikes = [...hikes].sort((a, b) =>
    a.startDateIso.localeCompare(b.startDateIso)
  );

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RCA Russkiy Vostok//Hike Schedule//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calName)}`,
    'X-WR-TIMEZONE:Asia/Vladivostok',
  ];

  for (const hike of sortedHikes) {
    const { startUtc, endUtc } = computeHikeUtcWindow(hike);
    const disciplineLabel = getDisciplineLabel(hike.discipline);
    const leadDays = options.overrideReminderDays ?? hike.reminderDaysBefore ?? 10;
    const summary = `[${hike.complexity}] ${hike.title}`;
    const location = [hike.region, hike.meetingPoint].filter(Boolean).join(' · ');

    const descriptionParts = [
      `Вид туризма: ${disciplineLabel}`,
      `Категория сложности: ${hike.complexity}`,
      `Численность группы: ${hike.participantsCount} чел.`,
      hike.meetingPoint ? `Точка сбора: ${hike.meetingPoint}` : '',
      hike.notes ? `Примечания: ${hike.notes}` : '',
      'Контроль ТБ: уведомить МЧС не позднее чем за 10 дней до выхода и зафиксировать КСР.',
      'Портал: https://rca-vostok.ru',
    ].filter(Boolean);

    lines.push(
      'BEGIN:VEVENT',
      `UID:${hike.id}@rca-vostok.ru`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${formatIcsUtcTimestamp(startUtc)}`,
      `DTEND:${formatIcsUtcTimestamp(endUtc)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `LOCATION:${escapeIcsText(location)}`,
      `DESCRIPTION:${escapeIcsText(descriptionParts.join('\n'))}`,
      `CATEGORIES:${escapeIcsText(`Туризм,Поход,${disciplineLabel},${hike.complexity}`)}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(`Подготовка к походу (${leadDays} дн. до старта): ${hike.title}`)}`,
      `TRIGGER:-P${leadDays}D`,
      'END:VALARM',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function buildGoogleCalendarHikeUrl(hike: PlannedHikeEntry): string {
  const { startUtc, endUtc } = computeHikeUtcWindow(hike);
  const dates = `${formatIcsUtcTimestamp(startUtc)}/${formatIcsUtcTimestamp(endUtc)}`;
  const disciplineLabel = getDisciplineLabel(hike.discipline);
  const details = [
    `${disciplineLabel} · ${hike.complexity}`,
    `Группа: ${hike.participantsCount} чел.`,
    hike.meetingPoint ? `Точка сбора: ${hike.meetingPoint}` : '',
    hike.notes ? `Заметки: ${hike.notes}` : '',
    'Источник: РЦА «Русский Восток» (https://rca-vostok.ru)',
  ]
    .filter(Boolean)
    .join('\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `[${hike.complexity}] ${hike.title}`,
    dates,
    location: [hike.region, hike.meetingPoint].filter(Boolean).join(', '),
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadHikesScheduleIcs(
  hikes: readonly PlannedHikeEntry[],
  options: BuildHikesScheduleIcsOptions = {}
): { fileName: string; eventCount: number; icsContent: string } {
  const icsContent = buildHikesScheduleIcs(hikes, options);
  const now = options.now ?? new Date();
  const dateStamp = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  const fileName = `RCA_Vostok_Hikes_Schedule_${dateStamp}.ics`;

  downloadTextFile(icsContent, fileName, 'text/calendar;charset=utf-8');

  return { fileName, eventCount: hikes.length, icsContent };
}
