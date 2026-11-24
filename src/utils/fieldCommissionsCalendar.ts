import {
  buildCalendarMonthCells,
  downloadCalendarIcs,
  type AttestationCalendarEvent,
  type CalendarDayCell,
} from './attestationCalendar.ts';

export type MarketCalendarEventType = 'field_commission' | 'seminar';

export interface MarketFieldEvent {
  id: string;
  type: MarketCalendarEventType;
  typeLabel: string;
  title: string;
  shortTitle: string;
  startDateIso: string; // YYYY-MM-DD
  endDateIso: string; // YYYY-MM-DD
  timeWindowVld: string;
  municipalityOrRegion: string;
  regionGroup: 'primorye' | 'dfo';
  venue: string;
  commissionChairOrSpeaker: string;
  quotaSeats: number;
  tracks: string;
  summary: string;
}

export const MARKET_CALENDAR_MONTHS: readonly {
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
];

export const MARKET_FIELD_COMMISSIONS_AND_SEMINARS: readonly MarketFieldEvent[] = [
  {
    id: 'mfc-sem-tiger-dec',
    type: 'seminar',
    typeLabel: 'Обучающий семинар',
    title: 'Семинар для инструкторов: протоколы безопасности в ареале амурского тигра и бурого медведя',
    shortTitle: 'Семинар: Фауна и ООПТ',
    startDateIso: '2026-12-08',
    endDateIso: '2026-12-08',
    timeWindowVld: '14:00 – 18:00 ВЛД',
    municipalityOrRegion: 'Приморский край · Владивосток',
    regionGroup: 'primorye',
    venue: 'Кампус ВВГУ (ул. Гоголя, 41) + Центр «Амурский тигр»',
    commissionChairOrSpeaker: 'Эксперты Центра «Амурский тигр» и ФГБУ «Земля леопарда»',
    quotaSeats: 45,
    tracks: 'ООПТ, пешеходный и экспедиционный треки',
    summary:
      'Обязательный региональный модуль ДФО: распознавание следов, отпугивающие средства, алгоритм действий при встрече с хищником и работа с группами на кордонах.',
  },
  {
    id: 'mfc-comm-nakhodka-dec',
    type: 'field_commission',
    typeLabel: 'Выездная комиссия',
    title: 'Выездная аттестационная комиссия РЦА для прибрежного кластера Находка — Партизанск',
    shortTitle: 'Комиссия: Находка',
    startDateIso: '2026-12-17',
    endDateIso: '2026-12-18',
    timeWindowVld: '09:30 – 17:30 ВЛД',
    municipalityOrRegion: 'Приморский край · Находкинский ГО',
    regionGroup: 'primorye',
    venue: 'г. Находка · площадка туристского кластера «Залив Восток»',
    commissionChairOrSpeaker: 'Галина Гомилевская · Дмитрий Верещагин (РЦА / ФСТР)',
    quotaSeats: 24,
    tracks: 'Водный туризм, SUP, прибрежные маршруты 1–2 КС',
    summary:
      'Выездное заседание комиссии для гидов глэмпингов и баз отдыха Южного Приморья без необходимости выезда во Владивосток: теория + защита паспорта маршрута.',
  },
  {
    id: 'mfc-sem-pp760-feb',
    type: 'seminar',
    typeLabel: 'Обучающий семинар',
    title: 'Практический семинар: оформление паспорта маршрута (ПП № 760) и регистрация в ЕФРТА',
    shortTitle: 'Семинар: Паспорт ПП № 760',
    startDateIso: '2027-02-05',
    endDateIso: '2027-02-05',
    timeWindowVld: '15:00 – 19:00 ВЛД',
    municipalityOrRegion: 'Приморский край · Уссурийский ГО',
    regionGroup: 'primorye',
    venue: 'г. Уссурийск · Деловой центр туроператоров (очно + трансляция)',
    commissionChairOrSpeaker: 'Григорий Саранча · Руководитель РЦА «Русский Восток»',
    quotaSeats: 35,
    tracks: 'Все виды туризма (Контур А и Контур Б)',
    summary:
      'Пошаговая проверка документов для допуска к аттестации 2027 года, заполнение карты маршрута и критерии зачёта походного опыта действующих проводников.',
  },
  {
    id: 'mfc-comm-khabarovsk-feb',
    type: 'field_commission',
    typeLabel: 'Выездная комиссия',
    title: 'Выездная межрегиональная комиссия ВВГУ и РЦА для гидов Хабаровского края',
    shortTitle: 'Комиссия: Хабаровск',
    startDateIso: '2027-02-25',
    endDateIso: '2027-02-27',
    timeWindowVld: '09:00 – 18:00 ВЛД',
    municipalityOrRegion: 'Хабаровский край · г. Хабаровск',
    regionGroup: 'dfo',
    venue: 'г. Хабаровск · Краевой визит-центр «Амурский утёс» и учебный полигон',
    commissionChairOrSpeaker: 'Межрегиональная комиссия РЦА «Русский Восток» и ФСТР',
    quotaSeats: 30,
    tracks: 'Таёжные сплавы и пешеходные маршруты 1–3 КС',
    summary:
      'Выездной приём квалификационных экзаменов по запросу туроператоров Хабаровского края: зачёт стажа по Контуру А и полевые нормативы.',
  },
  {
    id: 'mfc-sem-wfa-mar',
    type: 'seminar',
    typeLabel: 'Обучающий семинар',
    title: 'Полевой семинар-практикум: Wilderness First Aid и спутниковая координация с МЧС',
    shortTitle: 'Семинар: Первая помощь WFA',
    startDateIso: '2027-03-19',
    endDateIso: '2027-03-20',
    timeWindowVld: '10:00 – 17:00 ВЛД',
    municipalityOrRegion: 'Приморский край · Шкотовский округ',
    regionGroup: 'primorye',
    venue: 'Шкотовский полигон (подножие г. Ливадийская / Пидан)',
    commissionChairOrSpeaker: 'Елена Морозова (WFA) · Инструкторы ПСС МЧС Приморья',
    quotaSeats: 20,
    tracks: 'Пешеходный, горный и экспедиционный треки',
    summary:
      'Двухдневная отработка протокола MARCH, иммобилизации на осыпном склоне, работы при гипотермии и передачи координат бедствия по Garmin inReach.',
  },
  {
    id: 'mfc-comm-khasan-apr',
    type: 'field_commission',
    typeLabel: 'Выездная комиссия',
    title: 'Выездная аттестационная комиссия в Хасанском округе (нацпарк «Земля леопарда» и бухта Алеут)',
    shortTitle: 'Комиссия: Хасан (бухта Алеут)',
    startDateIso: '2027-04-09',
    endDateIso: '2027-04-10',
    timeWindowVld: '09:30 – 18:00 ВЛД',
    municipalityOrRegion: 'Приморский край · Хасанский округ',
    regionGroup: 'primorye',
    venue: 'с. Барабаш / бухта Алеут (визит-центр ФГБУ «Земля леопарда»)',
    commissionChairOrSpeaker: 'Комиссия РЦА «Русский Восток» и администрация ООПТ',
    quotaSeats: 26,
    tracks: 'Экотропы ООПТ, прибрежный и курортный сервис 1–2 КС',
    summary:
      'Специализированная выездная комиссия для гидов Хасанского кластера перед майским стартом туристического сезона и вводом первой очереди курорта «Приморье».',
  },
  {
    id: 'mfc-comm-sakhalin-apr',
    type: 'field_commission',
    typeLabel: 'Выездная комиссия',
    title: 'Выездная комиссия РЦА и ФСТР: Сахалинская область и Курильские маршруты',
    shortTitle: 'Комиссия: Сахалин',
    startDateIso: '2027-04-22',
    endDateIso: '2027-04-24',
    timeWindowVld: '09:00 – 17:30 САХ',
    municipalityOrRegion: 'Сахалинская область · г. Южно-Сахалинск',
    regionGroup: 'dfo',
    venue: 'г. Южно-Сахалинск · Учебно-тренировочный полигон СТК «Горный воздух»',
    commissionChairOrSpeaker: 'Наталья Соколова · Эксперты РЦА и ФСТР Сахалина',
    quotaSeats: 22,
    tracks: 'Горно-прибрежный и морской каякинг 1–3 КС',
    summary:
      'Выездной экзаменационный блок для проводников островных и курильских маршрутов по обновлённому регламенту ПП РФ № 1893.',
  },
  {
    id: 'mfc-sem-water-may',
    type: 'seminar',
    typeLabel: 'Обучающий семинар',
    title: 'Очный семинар на воде: спасработы на таёжных реках и техника страховки «морковкой»',
    shortTitle: 'Семинар: Сплавы и спасработы',
    startDateIso: '2027-05-07',
    endDateIso: '2027-05-08',
    timeWindowVld: '09:30 – 17:00 ВЛД',
    municipalityOrRegion: 'Приморский край · Партизанский округ',
    regionGroup: 'primorye',
    venue: 'р. Партизанская (порог Ворошиловский)',
    commissionChairOrSpeaker: 'Андрей Киселёв · Мастера спорта ФСТР по водному туризму',
    quotaSeats: 18,
    tracks: 'Водный туризм 2–3 КС',
    summary:
      'Практический семинар ДПО ВВГУ перед началом сплавного сезона: чтение паводковой струи, переправа с катамараном и спасение в холодной воде.',
  },
  {
    id: 'mfc-comm-terney-jun',
    type: 'field_commission',
    typeLabel: 'Выездная комиссия',
    title: 'Северная выездная комиссия РЦА (Терней — нацпарк «Бикин» — Лазо)',
    shortTitle: 'Комиссия: Терней / Бикин',
    startDateIso: '2027-06-11',
    endDateIso: '2027-06-12',
    timeWindowVld: '09:00 – 17:30 ВЛД',
    municipalityOrRegion: 'Приморский край · Тернейский / Пожарский округа',
    regionGroup: 'primorye',
    venue: 'пгт Терней · база Сихотэ-Алинского заповедника',
    commissionChairOrSpeaker: 'Выездная коллегия ВВГУ, ФСТР и ЦАТ',
    quotaSeats: 16,
    tracks: 'Автономный экспедиционный и водно-таёжный туризм 3–4 КС',
    summary:
      'Выездная аттестация проводников северных округов Приморья, работающих на удалённых маршрутах Сихотэ-Алиня и национального парка «Бикин».',
  },
];

export function filterMarketCalendarEvents(options: {
  typeFilter?: 'all' | MarketCalendarEventType;
  regionFilter?: 'all' | 'primorye' | 'dfo';
}): MarketFieldEvent[] {
  const typeFilter = options.typeFilter ?? 'all';
  const regionFilter = options.regionFilter ?? 'all';

  return MARKET_FIELD_COMMISSIONS_AND_SEMINARS.filter((ev) => {
    if (typeFilter !== 'all' && ev.type !== typeFilter) return false;
    if (regionFilter !== 'all' && ev.regionGroup !== regionFilter) return false;
    return true;
  });
}

export function getMarketEventsForIsoDate(
  isoDate: string,
  events: readonly MarketFieldEvent[] = MARKET_FIELD_COMMISSIONS_AND_SEMINARS
): MarketFieldEvent[] {
  return events.filter((ev) => isoDate >= ev.startDateIso && isoDate <= ev.endDateIso);
}

export function buildMarketCalendarMonthGrid(
  year: number,
  monthZeroIndexed: number
): CalendarDayCell[] {
  return buildCalendarMonthCells(year, monthZeroIndexed);
}

export function toCalendarExportEvent(ev: MarketFieldEvent): AttestationCalendarEvent {
  return {
    id: ev.id,
    kind: ev.type === 'seminar' ? 'webinar' : 'session',
    kindLabel: ev.typeLabel,
    title: ev.title,
    shortTitle: ev.shortTitle,
    startDateIso: ev.startDateIso,
    endDateIso: ev.endDateIso,
    startTimeVld: ev.timeWindowVld.slice(0, 5),
    durationMinutes: ev.type === 'seminar' ? 240 : 480,
    regionLabel: ev.municipalityOrRegion,
    formatLabel: ev.timeWindowVld,
    location: ev.venue,
    organizer: ev.commissionChairOrSpeaker,
    description: `${ev.tracks}. ${ev.summary}`,
    inquiryRegion: ev.municipalityOrRegion,
    inquiryTrack: ev.tracks,
  };
}

export function downloadMarketEventIcs(ev: MarketFieldEvent): string {
  const mapped = toCalendarExportEvent(ev);
  return downloadCalendarIcs(mapped, 1440);
}
