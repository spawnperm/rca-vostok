export type AttestationLocationKind = 'headquarters' | 'field_polygon' | 'regional_hub';

export type AttestationLocationFilterId = 'all' | AttestationLocationKind;

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface DfoAttestationLocation {
  id: string;
  name: string;
  shortName: string;
  badgeCode: string;
  kind: AttestationLocationKind;
  kindLabel: string;
  regionName: string;
  city: string;
  address: string;
  coordinates: LatLngPoint;
  trialFormats: string[];
  disciplines: string[];
  nextSessions: string;
  capacityNote: string;
  chairName: string;
  protocolNote: string;
}

export const ATTESTATION_KIND_FILTERS: readonly {
  id: AttestationLocationFilterId;
  label: string;
}[] = [
  { id: 'all', label: 'Все площадки ДФО' },
  { id: 'headquarters', label: 'База РЦА и теория' },
  { id: 'field_polygon', label: 'Полевые полигоны' },
  { id: 'regional_hub', label: 'Выездные точки ДФО' },
];

export const ATTESTATION_KIND_COLORS: Record<AttestationLocationKind, string> = {
  headquarters: '#0F766E',
  field_polygon: '#B45309',
  regional_hub: '#0369A1',
};

export const DFO_ATTESTATION_LOCATIONS: readonly DfoAttestationLocation[] = [
  {
    id: 'loc-vladivostok-vvgu',
    name: 'Головной центр РЦА «Русский Восток» (кампус ВВГУ)',
    shortName: 'Владивосток · ВВГУ',
    badgeCode: 'РЦА',
    kind: 'headquarters',
    kindLabel: 'Головной центр и теория',
    regionName: 'Приморский край',
    city: 'г. Владивосток',
    address: 'ул. Гоголя, д. 41, Институт туризма и креативных индустрий ВВГУ',
    coordinates: { lat: 43.1243, lng: 131.9035 },
    trialFormats: [
      'Очный теоретический экзамен по билетам 1–4 КС',
      'Защита паспорта туристского маршрута (ПП № 760)',
      'Верификация походного стажа и документов (Контур А / ФСТР)',
    ],
    disciplines: ['Пешеходный 1–4 КС', 'Водный 1–4 КС', 'Горный туризм', 'Спелеология'],
    nextSessions: '16–18 апреля 2027 · 14–16 мая 2027',
    capacityNote: 'До 30 соискателей за поток · аудитории теории и комиссия ВВГУ + ФСТР',
    chairName: 'Галина Гомилевская, Григорий Саранча',
    protocolNote: 'ФЗ № 132-ФЗ · ПП РФ № 1003 и № 1893 · Выгрузка в Единый реестр МЭР РФ',
  },
  {
    id: 'loc-shkotovo-polygon',
    name: 'Полевой аттестационный полигон «Шкотовский»',
    shortName: 'Шкотовский полигон',
    badgeCode: 'ПЛГ',
    kind: 'field_polygon',
    kindLabel: 'Полевой полигон испытаний',
    regionName: 'Приморский край',
    city: 'Шкотовский муниципальный округ',
    address: 'р-н г. Ливадийская (Пидан) и речной створ р. Шкотовка / Артемовка',
    coordinates: { lat: 43.198, lng: 132.685 },
    trialFormats: [
      'Навесные переправы и страховка на горно-таёжном рельефе',
      'Спасработы на бурной воде и транспортировка пострадавшего',
      'Автономная первая помощь (WFA) и работа с трекерами Garmin inReach',
    ],
    disciplines: ['Полевой этап 1–4 КС', 'Навесные переправы', 'ПСР и WFA'],
    nextSessions: '16–18 апреля 2027 · 14–16 мая 2027 · 4–6 июня 2027',
    capacityNote: 'Малые группы по 6–8 человек на 3 экзаменационных рубежах',
    chairName: 'Григорий Саранча, Дмитрий Верещагин',
    protocolNote: 'Обязательный практический этап для кандидатов Приморья и выездных групп ДФО',
  },
  {
    id: 'loc-bikin-oopt',
    name: 'Полевая площадка ООПТ «Национальный парк Бикин»',
    shortName: 'Нацпарк «Бикин»',
    badgeCode: 'ООПТ',
    kind: 'field_polygon',
    kindLabel: 'Полигон ООПТ и таёжных сплавов',
    regionName: 'Приморский край (Север)',
    city: 'Пожарский округ, с. Красный Яр',
    address: 'Визит-центр Национального парка «Бикин» и речной полигон р. Бикин',
    coordinates: { lat: 46.5405, lng: 135.349 },
    trialFormats: [
      'Отработка регламентов безопасности в ареале амурского тигра и медведя',
      'Практический зачёт на таёжных водных маршрутах (плоты / ульмаги)',
      'Проверка навыков радиосвязи и согласования выходов на кордоне ООПТ',
    ],
    disciplines: ['Водно-таёжный 1–3 КС', 'Экомаршруты ООПТ', 'Связь и эвакуация'],
    nextSessions: '4–6 июня 2027 (по согласованию с дирекцией ООПТ)',
    capacityNote: 'Выездная группа 10–12 проводников (включая гидов из числа КМНС)',
    chairName: 'Елена Морозова, Дмитрий Верещагин',
    protocolNote: 'Совместный стандарт ФСТР, Минприроды РФ и Центра «Амурский тигр»',
  },
  {
    id: 'loc-khabarovsk-hub',
    name: 'Выездная площадка · Хабаровский край',
    shortName: 'Хабаровск',
    badgeCode: 'ДФО',
    kind: 'regional_hub',
    kindLabel: 'Межрегиональная площадка ДФО',
    regionName: 'Хабаровский край',
    city: 'г. Хабаровск',
    address: 'Координационный узел ФСТР Хабаровского края (выездная сессия РЦА)',
    coordinates: { lat: 48.4802, lng: 135.0719 },
    trialFormats: [
      'Очный приём заявок и сверка маршрутных книжек / справок стажа',
      'Предварительное тестирование и консультации по паспорту маршрута',
      'Организация межрегиональных потоков на полевой этап РЦА',
    ],
    disciplines: ['Пешеходный 1–3 КС', 'Горно-таёжные сплавы', 'Экспедиционный'],
    nextSessions: 'Весенне-летний поток · 16–18 апреля 2027',
    capacityNote: 'Потоки по 8–15 соискателей · межрегиональная комиссия РЦА + ФСТР',
    chairName: 'Григорий Саранча, Андрей Киселёв',
    protocolNote: 'Межрегиональный протокол РЦА «Русский Восток» · Срок записи 5 лет',
  },
  {
    id: 'loc-kamchatka-hub',
    name: 'Партнёрская точка переаттестации · Камчатский край',
    shortName: 'Петропавловск-Камчатский',
    badgeCode: 'ДФО',
    kind: 'regional_hub',
    kindLabel: 'Пункт переаттестации ДФО',
    regionName: 'Камчатский край',
    city: 'г. Петропавловск-Камчатский',
    address: 'Координационный центр камчатских гидов (Авачинско-Мутновский кластер)',
    coordinates: { lat: 53.0245, lng: 158.6435 },
    trialFormats: [
      'Очная переаттестация действующих горных и вулканических гидов',
      'Защита паспортов высокогорных и экспедиционных маршрутов (2–4 КС)',
      'Аудит комплектов спутниковой связи и договоров с туроператорами',
    ],
    disciplines: ['Вулканические треки', 'Горный туризм 2–4 КС', 'Малые группы (4–6 чел.)'],
    nextSessions: '14–16 мая 2027 · октябрь 2027',
    capacityNote: 'Выездные комиссии по 6–10 специалистов с опытом активных туров',
    chairName: 'Галина Гомилевская, Наталья Соколова',
    protocolNote: 'Соответствие требованиям ПП РФ № 1893 для действующих гидов реестра',
  },
  {
    id: 'loc-sakhalin-hub',
    name: 'Островная площадка испытаний · Сахалин и Курилы',
    shortName: 'Южно-Сахалинск',
    badgeCode: 'ДФО',
    kind: 'regional_hub',
    kindLabel: 'Островная площадка ДФО',
    regionName: 'Сахалинская область',
    city: 'г. Южно-Сахалинск',
    address: 'Учебно-координационная площадка Сахалинской области и Курильских маршрутов',
    coordinates: { lat: 46.9591, lng: 142.738 },
    trialFormats: [
      'Очная сверка документов и допуск к комбинированному зачёту',
      'Отработка оценки ветро-волновой нагрузки и приливов на побережье',
      'Формирование островных потоков на экзамен РЦА «пешеходный + водный»',
    ],
    disciplines: ['Пешеходный 1–3 КС', 'Морской каякинг и SUP', 'Комбинированные туры'],
    nextSessions: '16–18 апреля 2027 · 15–17 октября 2027',
    capacityNote: 'Мультипрофильные группы 8–12 человек · сопровождение куратора ВВГУ',
    chairName: 'Дмитрий Верещагин, Игорь Ткаченко',
    protocolNote: 'Совмещённые билеты «пешеходный + водный» по методике ФСТР',
  },
  {
    id: 'loc-yakutia-hub',
    name: 'Северный экспедиционный узел · Республика Саха (Якутия)',
    shortName: 'Якутск',
    badgeCode: 'ДФО',
    kind: 'regional_hub',
    kindLabel: 'Северный узел ДФО',
    regionName: 'Республика Саха (Якутия)',
    city: 'г. Якутск',
    address: 'Координационный пункт НП «Ленские столбы» и дистанционного модуля ВВГУ',
    coordinates: { lat: 62.0355, lng: 129.6755 },
    trialFormats: [
      'Очный приём портфолио автономного стажа и договоров экспедиций',
      'Зачёт дистанционной теории ВВГУ перед выходом в очную комиссию',
      'Проверка протоколов холодовой безопасности и спутниковой эвакуации',
    ],
    disciplines: ['Автономные сплавы', 'Трекинг ООПТ', 'Экстремальная WFA'],
    nextSessions: '14–16 мая 2027 · 29–31 октября 2027',
    capacityNote: 'Северные потоки до 10 кандидатов · гибрид (теория + очный зачёт)',
    chairName: 'Елена Морозова, Николай Прокопьев',
    protocolNote: 'ПП РФ № 1893 · Повышенные стандарты автономности и связи',
  },
];

export function filterAttestationLocations(
  locations: readonly DfoAttestationLocation[],
  kindFilter: AttestationLocationFilterId,
  searchQuery = ''
): DfoAttestationLocation[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  return locations.filter((loc) => {
    if (kindFilter !== 'all' && loc.kind !== kindFilter) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    const searchable = [
      loc.name,
      loc.shortName,
      loc.regionName,
      loc.city,
      loc.address,
      ...loc.disciplines,
      ...loc.trialFormats,
    ]
      .join(' ')
      .toLowerCase();
    return searchable.includes(normalizedQuery);
  });
}

export function sortAttestationLocationsForStacking(
  locations: readonly DfoAttestationLocation[]
): { location: DfoAttestationLocation; baseZIndex: number }[] {
  return [...locations]
    .sort((a, b) => b.coordinates.lat - a.coordinates.lat)
    .map((location, index) => ({
      location,
      baseZIndex: index + 1,
    }));
}

export function buildAttestationGoogleMapsUrl(location: DfoAttestationLocation): string {
  const query = encodeURIComponent(`${location.coordinates.lat},${location.coordinates.lng}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
