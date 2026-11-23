import {
  buildCalendarMonthCells,
  buildGoogleCalendarUrl,
  buildIcsEventContent,
  downloadCalendarIcs,
  type AttestationCalendarEvent,
  type CalendarDayCell,
} from './attestationCalendar.ts';

export type CertificationDfoEventType = 'exam' | 'meeting';

export type CertificationDfoRegionId =
  | 'all'
  | 'primorye'
  | 'khabarovsk'
  | 'kamchatka'
  | 'sakhalin'
  | 'amur'
  | 'yakutia';

export interface CertificationDfoEvent {
  id: string;
  type: CertificationDfoEventType;
  typeLabel: string;
  title: string;
  shortTitle: string;
  startDateIso: string; // YYYY-MM-DD
  endDateIso: string; // YYYY-MM-DD
  timeWindowLocal: string;
  regionId: Exclude<CertificationDfoRegionId, 'all'>;
  regionName: string;
  city: string;
  venue: string;
  commissionHost: string;
  categories: string;
  seatsTotal: number;
  seatsRemaining: number;
  description: string;
}

export const CERTIFICATION_DFO_REGIONS: readonly {
  id: CertificationDfoRegionId;
  label: string;
  shortLabel: string;
}[] = [
  { id: 'all', label: 'Все регионы ДФО', shortLabel: 'Весь ДФО' },
  { id: 'primorye', label: 'Приморский край', shortLabel: 'Приморье' },
  { id: 'khabarovsk', label: 'Хабаровский край', shortLabel: 'Хабаровск' },
  { id: 'kamchatka', label: 'Камчатский край', shortLabel: 'Камчатка' },
  { id: 'sakhalin', label: 'Сахалинская область', shortLabel: 'Сахалин' },
  { id: 'amur', label: 'Амурская область', shortLabel: 'Амурская обл.' },
  { id: 'yakutia', label: 'Республика Саха (Якутия)', shortLabel: 'Якутия' },
];

export const CERTIFICATION_DFO_MONTHS: readonly {
  year: number;
  month: number; // 0-indexed
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

export const CERTIFICATION_DFO_EVENTS: readonly CertificationDfoEvent[] = [
  {
    id: 'cert-dfo-vvo-meeting-dec',
    type: 'meeting',
    typeLabel: 'Очная встреча',
    title: 'Открытая встреча комиссии РЦА с кандидатами: разбор билетов и паспортов маршрута',
    shortTitle: 'Встреча РЦА (ВВГУ)',
    startDateIso: '2026-12-04',
    endDateIso: '2026-12-04',
    timeWindowLocal: '17:30 – 19:30 ВЛД',
    regionId: 'primorye',
    regionName: 'Приморский край',
    city: 'г. Владивосток',
    venue: 'Кампус ВВГУ (ул. Гоголя, д. 41, ауд. 1501)',
    commissionHost: 'Галина Гомилевская · Григорий Саранча',
    categories: '1–4 КС · Контур А и Б',
    seatsTotal: 50,
    seatsRemaining: 14,
    description:
      'Очная консультация по подготовке пакета документов для ЕФРТА, проверке справок МКК и допуску к зимне-весенним экзаменам.',
  },
  {
    id: 'cert-dfo-vvo-exam-dec',
    type: 'exam',
    typeLabel: 'Экзамен',
    title: 'Зимний квалификационный экзамен: теория и водный блок (ВВГУ)',
    shortTitle: 'Экзамен: ВВГУ (Вода)',
    startDateIso: '2026-12-14',
    endDateIso: '2026-12-16',
    timeWindowLocal: '09:30 – 17:30 ВЛД',
    regionId: 'primorye',
    regionName: 'Приморский край',
    city: 'г. Владивосток',
    venue: 'ул. Гоголя, д. 41 (ВВГУ) + учебный бассейн',
    commissionHost: 'Комиссия ВВГУ и ФСТР Приморского края',
    categories: '1–3 КС · Водный и пешеходный',
    seatsTotal: 28,
    seatsRemaining: 7,
    description:
      'Теоретическое тестирование, защита паспорта водного маршрута по ПП РФ № 760 и проверка навыков спасработ.',
  },
  {
    id: 'cert-dfo-amur-meeting-feb',
    type: 'meeting',
    typeLabel: 'Очная встреча',
    title: 'Очный приём документов и предэкзаменационная встреча для гидов Амурской области',
    shortTitle: 'Встреча: Благовещенск',
    startDateIso: '2027-02-12',
    endDateIso: '2027-02-12',
    timeWindowLocal: '14:00 – 17:30 АМР',
    regionId: 'amur',
    regionName: 'Амурская область',
    city: 'г. Благовещенск',
    venue: 'г. Благовещенск · Центр «Мой бизнес» / площадка туроператоров',
    commissionHost: 'Выездной секретариат РЦА «Русский Восток»',
    categories: '1–3 КС · Пешеходный и водный',
    seatsTotal: 35,
    seatsRemaining: 19,
    description:
      'Проверка походного стажа, консультация по медицинскому допуску и маршрутным листам перед весенним экзаменационным циклом.',
  },
  {
    id: 'cert-dfo-khv-exam-feb',
    type: 'exam',
    typeLabel: 'Экзамен',
    title: 'Выездной экзамен РЦА в Хабаровском крае: теория + защита маршрутов 1–3 КС',
    shortTitle: 'Экзамен: Хабаровск',
    startDateIso: '2027-02-25',
    endDateIso: '2027-02-27',
    timeWindowLocal: '09:00 – 18:00 ХАБ',
    regionId: 'khabarovsk',
    regionName: 'Хабаровский край',
    city: 'г. Хабаровск',
    venue: 'г. Хабаровск · Краевой визит-центр и полигон «Хехцир»',
    commissionHost: 'Межрегиональная комиссия РЦА и ФСТР',
    categories: '1–3 КС · Таёжный и водный',
    seatsTotal: 30,
    seatsRemaining: 9,
    description:
      'Комплексный квалификационный экзамен для проводников Хабаровского края: тестирование, навигация, ПСР и первая помощь.',
  },
  {
    id: 'cert-dfo-kam-exam-mar',
    type: 'exam',
    typeLabel: 'Экзамен',
    title: 'Выездная экзаменационная сессия и переаттестация гидов Камчатского края',
    shortTitle: 'Экзамен: Камчатка',
    startDateIso: '2027-03-12',
    endDateIso: '2027-03-14',
    timeWindowLocal: '09:30 – 17:30 КАМ',
    regionId: 'kamchatka',
    regionName: 'Камчатский край',
    city: 'г. Петропавловск-Камчатский',
    venue: 'г. Петропавловск-Камчатский · Центр подготовки спасателей и гидов',
    commissionHost: 'Наталья Соколова · Комиссия ВВГУ и ФСТР',
    categories: '2–4 КС · Горный, пешеходный, экспедиции',
    seatsTotal: 25,
    seatsRemaining: 6,
    description:
      'Оценка практических навыков на вулканическом и снежно-ледовом рельефе, проверка протоколов спутниковой координации.',
  },
  {
    id: 'cert-dfo-yak-meeting-mar',
    type: 'meeting',
    typeLabel: 'Очная встреча',
    title: 'Очная методическая встреча в Якутске: подготовка к полевому этапу на Ленских столбах',
    shortTitle: 'Встреча: Якутск',
    startDateIso: '2027-03-26',
    endDateIso: '2027-03-26',
    timeWindowLocal: '11:00 – 15:30 ЯКТ',
    regionId: 'yakutia',
    regionName: 'Республика Саха (Якутия)',
    city: 'г. Якутск',
    venue: 'г. Якутск · Площадка Агентства развития туризма РС(Я)',
    commissionHost: 'Представители РЦА «Русский Восток» и МКК РС(Я)',
    categories: '1–4 КС · Автономный и речной',
    seatsTotal: 40,
    seatsRemaining: 22,
    description:
      'Очное собеседование по зачёту северного экспедиционного стажа и разбор требований безопасности при низких температурах.',
  },
  {
    id: 'cert-dfo-prim-meeting-apr',
    type: 'meeting',
    typeLabel: 'Очная встреча',
    title: 'Очный инструктаж перед апрельским потоком: снаряжение и переправа (Шкотовский р-н)',
    shortTitle: 'Инструктаж (Приморье)',
    startDateIso: '2027-04-09',
    endDateIso: '2027-04-09',
    timeWindowLocal: '16:00 – 19:00 ВЛД',
    regionId: 'primorye',
    regionName: 'Приморский край',
    city: 'г. Владивосток',
    venue: 'Кампус ВВГУ (ул. Гоголя, д. 41, ауд. 1612)',
    commissionHost: 'Дмитрий Верещагин · Эксперты ФСТР',
    categories: '1–4 КС · Все виды туризма',
    seatsTotal: 45,
    seatsRemaining: 16,
    description:
      'Проверка личного страховочного комплекта, разбор маршрутной карты Шкотовского полигона и ответы на вопросы экзаменуемых.',
  },
  {
    id: 'cert-dfo-prim-exam-apr',
    type: 'exam',
    typeLabel: 'Экзамен',
    title: 'Апрельская аттестационная сессия (график ФСТР 2027): теория + полигон',
    shortTitle: 'Экзамен: Приморье (Апр)',
    startDateIso: '2027-04-16',
    endDateIso: '2027-04-18',
    timeWindowLocal: '09:00 – 18:00 ВЛД',
    regionId: 'primorye',
    regionName: 'Приморский край',
    city: 'г. Владивосток / Шкотовский р-н',
    venue: 'ВВГУ (ул. Гоголя, д. 41) и полигон хр. Ливадийский',
    commissionHost: 'Аттестационная комиссия РЦА «Русский Восток»',
    categories: '1–4 КС · 7 дисциплин',
    seatsTotal: 32,
    seatsRemaining: 11,
    description:
      'Плановый экзамен по пешеходному, водному, горному и спелеологическому туризму с практикой на естественном рельефе.',
  },
  {
    id: 'cert-dfo-sakh-exam-apr',
    type: 'exam',
    typeLabel: 'Экзамен',
    title: 'Выездной экзамен РЦА в Сахалинской области (островные и курильские маршруты)',
    shortTitle: 'Экзамен: Сахалин',
    startDateIso: '2027-04-23',
    endDateIso: '2027-04-25',
    timeWindowLocal: '09:00 – 17:30 САХ',
    regionId: 'sakhalin',
    regionName: 'Сахалинская область',
    city: 'г. Южно-Сахалинск',
    venue: 'г. Южно-Сахалинск · СТК «Горный воздух»',
    commissionHost: 'Выездная коллегия РЦА и ФСТР Сахалина',
    categories: '1–3 КС · Горный, прибрежный, морской',
    seatsTotal: 24,
    seatsRemaining: 8,
    description:
      'Оценка навигации в условиях тумана, оказания первой помощи и взаимодействия с группой на прибрежных и горных тропах.',
  },
  {
    id: 'cert-dfo-prim-exam-may',
    type: 'exam',
    typeLabel: 'Экзамен',
    title: 'Майская аттестационная сессия (график ФСТР 2027): предсезонный поток',
    shortTitle: 'Экзамен: Приморье (Май)',
    startDateIso: '2027-05-14',
    endDateIso: '2027-05-16',
    timeWindowLocal: '09:00 – 18:00 ВЛД',
    regionId: 'primorye',
    regionName: 'Приморский край',
    city: 'г. Владивосток / Шкотовский р-н',
    venue: 'ВВГУ (ул. Гоголя, д. 41) и Шкотовский полигон',
    commissionHost: 'Аттестационная комиссия РЦА «Русский Восток»',
    categories: '1–4 КС · 7 дисциплин',
    seatsTotal: 32,
    seatsRemaining: 15,
    description:
      'Основная майская экзаменационная сессия перед открытием массового летнего сезона в Приморье и соседних субъектах ДФО.',
  },
  {
    id: 'cert-dfo-amur-exam-may',
    type: 'exam',
    typeLabel: 'Экзамен',
    title: 'Выездной экзамен для гидов Амурской области: Зейский и Бурейский кластеры',
    shortTitle: 'Экзамен: Благовещенск',
    startDateIso: '2027-05-28',
    endDateIso: '2027-05-29',
    timeWindowLocal: '09:30 – 17:30 АМР',
    regionId: 'amur',
    regionName: 'Амурская область',
    city: 'г. Благовещенск',
    venue: 'г. Благовещенск · Учебно-тренировочная база МЧС и туризма',
    commissionHost: 'Межрегиональная комиссия РЦА «Русский Восток»',
    categories: '1–3 КС · Пешеходный и водный',
    seatsTotal: 22,
    seatsRemaining: 12,
    description:
      'Теоретическое тестирование, разбор кейсов по безопасности на воде и полевой зачёт по топографии.',
  },
  {
    id: 'cert-dfo-prim-exam-jun',
    type: 'exam',
    typeLabel: 'Экзамен',
    title: 'Июньская аттестационная сессия (график ФСТР 2027): летний поток',
    shortTitle: 'Экзамен: Приморье (Июн)',
    startDateIso: '2027-06-04',
    endDateIso: '2027-06-06',
    timeWindowLocal: '09:00 – 18:00 ВЛД',
    regionId: 'primorye',
    regionName: 'Приморский край',
    city: 'г. Владивосток / Шкотовский р-н',
    venue: 'ВВГУ (ул. Гоголя, д. 41) и Шкотовский полигон',
    commissionHost: 'Аттестационная комиссия РЦА «Русский Восток»',
    categories: '1–4 КС · 7 дисциплин',
    seatsTotal: 30,
    seatsRemaining: 18,
    description:
      'Заключительная летняя сессия в Приморье перед стартом детских и корпоративных туров.',
  },
  {
    id: 'cert-dfo-yak-exam-jun',
    type: 'exam',
    typeLabel: 'Экзамен',
    title: 'Выездной экзамен РЦА в Якутии: речные и горно-таёжные маршруты',
    shortTitle: 'Экзамен: Якутск',
    startDateIso: '2027-06-18',
    endDateIso: '2027-06-19',
    timeWindowLocal: '09:00 – 17:30 ЯКТ',
    regionId: 'yakutia',
    regionName: 'Республика Саха (Якутия)',
    city: 'г. Якутск',
    venue: 'г. Якутск · Учебно-экзаменационная площадка СВФУ',
    commissionHost: 'Выездная комиссия РЦА и ФСТР',
    categories: '1–4 КС · Водный и пешеходный',
    seatsTotal: 24,
    seatsRemaining: 14,
    description:
      'Аттестация гидов сплавов по рекам Лена, Синяя, Амга и горных маршрутов хребта Черского.',
  },
  {
    id: 'cert-dfo-prim-meeting-oct',
    type: 'meeting',
    typeLabel: 'Очная встреча',
    title: 'Осенняя очная встреча-разбор с комиссией РЦА по итогам сезона 2027 г.',
    shortTitle: 'Встреча РЦА (Октябрь)',
    startDateIso: '2027-10-08',
    endDateIso: '2027-10-08',
    timeWindowLocal: '18:00 – 20:00 ВЛД',
    regionId: 'primorye',
    regionName: 'Приморский край',
    city: 'г. Владивосток',
    venue: 'Кампус ВВГУ (ул. Гоголя, д. 41)',
    commissionHost: 'Галина Гомилевская · Григорий Саранча',
    categories: 'Все категории · Контур А и Б',
    seatsTotal: 45,
    seatsRemaining: 31,
    description:
      'Подведение итогов летних маршрутов, зачёт фактического походного стажа и сверка документов перед осенними экзаменами.',
  },
  {
    id: 'cert-dfo-prim-exam-oct1',
    type: 'exam',
    typeLabel: 'Экзамен',
    title: 'Осенний экзамен 2027 г. (поток 1): очная сдача в ВВГУ и на полигоне',
    shortTitle: 'Экзамен: Окт. поток 1',
    startDateIso: '2027-10-15',
    endDateIso: '2027-10-17',
    timeWindowLocal: '09:00 – 18:00 ВЛД',
    regionId: 'primorye',
    regionName: 'Приморский край',
    city: 'г. Владивосток / Шкотовский р-н',
    venue: 'ВВГУ (ул. Гоголя, д. 41) и Шкотовский полигон',
    commissionHost: 'Аттестационная комиссия РЦА «Русский Восток»',
    categories: '1–4 КС · 7 дисциплин',
    seatsTotal: 32,
    seatsRemaining: 24,
    description:
      'Первый осенний поток аттестации 2027 года для соискателей со всех регионов Дальнего Востока.',
  },
  {
    id: 'cert-dfo-prim-exam-oct2',
    type: 'exam',
    typeLabel: 'Экзамен',
    title: 'Осенний экзамен 2027 г. (поток 2): итоговая сессия года',
    shortTitle: 'Экзамен: Окт. поток 2',
    startDateIso: '2027-10-29',
    endDateIso: '2027-10-31',
    timeWindowLocal: '09:00 – 18:00 ВЛД',
    regionId: 'primorye',
    regionName: 'Приморский край',
    city: 'г. Владивосток / Шкотовский р-н',
    venue: 'ВВГУ (ул. Гоголя, д. 41) и Шкотовский полигон',
    commissionHost: 'Аттестационная комиссия РЦА «Русский Восток»',
    categories: '1–4 КС · 7 дисциплин',
    seatsTotal: 32,
    seatsRemaining: 27,
    description:
      'Итоговая аттестационная сессия 2027 года по всем видам туризма и продлению аттестатов.',
  },
];

export function filterCertificationDfoEvents(options: {
  regionId?: CertificationDfoRegionId;
  typeFilter?: 'all' | CertificationDfoEventType;
}): CertificationDfoEvent[] {
  const regionId = options.regionId ?? 'all';
  const typeFilter = options.typeFilter ?? 'all';

  return CERTIFICATION_DFO_EVENTS.filter((ev) => {
    if (regionId !== 'all' && ev.regionId !== regionId) return false;
    if (typeFilter !== 'all' && ev.type !== typeFilter) return false;
    return true;
  });
}

export function getCertificationEventsForIsoDate(
  isoDate: string,
  events: readonly CertificationDfoEvent[] = CERTIFICATION_DFO_EVENTS
): CertificationDfoEvent[] {
  return events.filter((ev) => isoDate >= ev.startDateIso && isoDate <= ev.endDateIso);
}

export function buildCertificationMonthGrid(
  year: number,
  monthZeroIndexed: number
): CalendarDayCell[] {
  return buildCalendarMonthCells(year, monthZeroIndexed);
}

export function toCertificationExportEvent(ev: CertificationDfoEvent): AttestationCalendarEvent {
  return {
    id: ev.id,
    kind: ev.type === 'exam' ? 'session' : 'webinar',
    kindLabel: ev.typeLabel,
    title: ev.title,
    shortTitle: ev.shortTitle,
    startDateIso: ev.startDateIso,
    endDateIso: ev.endDateIso,
    startTimeVld: ev.timeWindowLocal.slice(0, 5),
    durationMinutes: ev.type === 'exam' ? 480 : 180,
    regionLabel: `${ev.regionName} (${ev.city})`,
    formatLabel: ev.timeWindowLocal,
    location: ev.venue,
    organizer: ev.commissionHost,
    description: `${ev.categories}. ${ev.description}`,
    inquiryRegion: ev.regionName,
    inquiryTrack: ev.categories,
  };
}

export function downloadCertificationEventIcs(ev: CertificationDfoEvent): string {
  const mapped = toCertificationExportEvent(ev);
  buildIcsEventContent(mapped, 1440);
  return downloadCalendarIcs(mapped, 1440);
}

export function buildCertificationGoogleCalendarUrl(ev: CertificationDfoEvent): string {
  return buildGoogleCalendarUrl(toCertificationExportEvent(ev));
}
