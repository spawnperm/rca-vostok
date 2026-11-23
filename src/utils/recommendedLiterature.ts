export type LiteratureDiscipline =
  | 'all'
  | 'normative'
  | 'hiking_mountain'
  | 'water_safety'
  | 'first_aid'
  | 'dfo_ecology';

export interface RecommendedLiteratureItem {
  id: string;
  title: string;
  authors: string;
  publisherYear: string;
  discipline: Exclude<LiteratureDiscipline, 'all'>;
  disciplineLabel: string;
  pagesOrFormat: string;
  examRelevance: string;
  summary: string;
  tags: string[];
}

export const LITERATURE_DISCIPLINE_TABS: readonly {
  id: LiteratureDiscipline;
  label: string;
}[] = [
  { id: 'all', label: 'Все дисциплины' },
  { id: 'normative', label: 'Право и ПП № 1893' },
  { id: 'hiking_mountain', label: 'Пешеходный и горный' },
  { id: 'water_safety', label: 'Водный и спасработы' },
  { id: 'first_aid', label: 'Первая помощь (WFA)' },
  { id: 'dfo_ecology', label: 'Специфика ДФО и ООПТ' },
];

export const RECOMMENDED_LITERATURE: readonly RecommendedLiteratureItem[] = [
  {
    id: 'lit-pp1893-commentary',
    title: 'Комментарий к Правилам аттестации инструкторов-проводников (ПП РФ № 1003, № 1893 и № 760)',
    authors: 'Гомилевская Г. А., Саранча Г. А.',
    publisherYear: 'Владивосток: Изд-во ВВГУ, 2026',
    discipline: 'normative',
    disciplineLabel: 'Право и ПП № 1893',
    pagesOrFormat: '148 стр. · Методическое пособие',
    examRelevance: 'Обязательно к теоретическому тестированию и защите паспорта маршрута',
    summary:
      'Пошаговый разбор требований 132-ФЗ, структуры паспорта маршрута по форме ПП № 760, зачёта походного опыта по Контуру А и регламента работы с ЕФРТА.',
    tags: ['ПП № 1893', 'ПП № 760', 'Паспорт маршрута', 'ЕФРТА'],
  },
  {
    id: 'lit-legal-liability',
    title: 'Правовое обеспечение безопасности активного туризма и страхование ответственности туроператоров',
    authors: 'Сидоркина Ю. С., Волков К. В.',
    publisherYear: 'М.: Юрайт / РГУТИС, 2025',
    discipline: 'normative',
    disciplineLabel: 'Право и ПП № 1893',
    pagesOrFormat: '224 стр. · Учебник ДПО',
    examRelevance: 'Базовый блок программ ДПО ВВГУ (модуль «Правовые основы»)',
    summary:
      'Договорные отношения гида с туроператором, распределение ответственности при нештатных ситуациях, взаимодействие с МЧС и контрольно-надзорными органами.',
    tags: ['ФЗ № 132-ФЗ', 'Договоры', 'МЧС', 'Ответственность'],
  },
  {
    id: 'lit-fstr-hiking-tactics',
    title: 'Тактика и безопасность пешеходных и горных туристских маршрутов 1–4 категории сложности',
    authors: 'Федерация спортивного туризма России (под ред. Панова С. Н.)',
    publisherYear: 'М.: ТВТ Дивизион / ФСТР, 2024',
    discipline: 'hiking_mountain',
    disciplineLabel: 'Пешеходный и горный',
    pagesOrFormat: '368 стр. · Учебное руководство',
    examRelevance: 'Полевой этап на Шкотовском полигоне и экзаменационные билеты 1–4 КС',
    summary:
      'Планирование графика движения, прохождение осыпей, курумников, крутых склонов и переправ, выбор бивака и оценка метеорологических рисков.',
    tags: ['ФСТР', '1–4 КС', 'Переправы', 'Ориентирование'],
  },
  {
    id: 'lit-mountaineering-rescue',
    title: 'Школа альпинизма и горно-таёжных спасработ: техника работы с верёвкой и транспортировка',
    authors: 'Захаров П. П., Степенко Т. В.',
    publisherYear: 'М.: Спорт, 2024',
    discipline: 'hiking_mountain',
    disciplineLabel: 'Пешеходный и горный',
    pagesOrFormat: '312 стр. · Практикум',
    examRelevance: 'Практический зачёт по организации страховки и спасработ малой группой',
    summary:
      'Навесные и перильные переправы, полиспасты, самоспасение, эвакуация пострадавшего подручными средствами и работа на сложном скально-осыпном рельефе.',
    tags: ['ПСР', 'Страховка', 'Полиспаст', 'Эвакуация'],
  },
  {
    id: 'lit-water-rafting-safety',
    title: 'Безопасность на водных маршрутах: таёжные и горные реки, каякинг и спасработы на воде',
    authors: 'Юрин В. И., Свиридов А. М.',
    publisherYear: 'М.: ФСТР / ТВТ Дивизион, 2025',
    discipline: 'water_safety',
    disciplineLabel: 'Водный и спасработы',
    pagesOrFormat: '286 стр. · Учебник для ДПО',
    examRelevance: 'Профильная программа ДПО «Водный туризм» (1–4 КС)',
    summary:
      'Чтение струи и порогов, страховка с берега спасконцом «морковка» и с воды, тактика прохождения паводковых участков таёжных рек (Бикин, Хор, Анюй).',
    tags: ['Водный туризм', 'Сплавы', 'Паводки', 'Спасконец'],
  },
  {
    id: 'lit-sea-kayak-far-east',
    title: 'Прибрежный морской каякинг в акваториях Дальнего Востока: навигация и штормовая тактика',
    authors: 'Ткаченко И. В., Верещагин Д. А.',
    publisherYear: 'Владивосток / Южно-Сахалинск: ФСТР ДФО, 2025',
    discipline: 'water_safety',
    disciplineLabel: 'Водный и спасработы',
    pagesOrFormat: '196 стр. · Методическое издание',
    examRelevance: 'Приморский и Сахалинско-Курильский прибрежные водные маршруты',
    summary:
      'Учёт приливно-отливных течений, тягуна, ветровых сгонов и холодового шока при проведении морских и островных прогулок на каяках и SUP.',
    tags: ['Морской каякинг', 'Приморский край', 'Сахалин', 'Навигация'],
  },
  {
    id: 'lit-wfa-wilderness-aid',
    title: 'Первая помощь в удалённой и горно-таёжной местности (Wilderness First Aid)',
    authors: 'Морозова Е. В., Колесников А. П.',
    publisherYear: 'М.: Практическая медицина, 2025',
    discipline: 'first_aid',
    disciplineLabel: 'Первая помощь (WFA)',
    pagesOrFormat: '256 стр. · Иллюстрированный атлас',
    examRelevance: 'Обязательный модуль ПП РФ № 1893 и практический экзамен РЦА',
    summary:
      'Протокол осмотра пострадавшего MARCH/ABCDE, помощь при гипотермии, укусах змей и клещевом энцефалите, иммобилизация и ожидание эвакуации >4 часов.',
    tags: ['WFA', 'Гипотермия', 'Аптечка', 'Первая помощь'],
  },
  {
    id: 'lit-satellite-comms-inreach',
    title: 'Автономная спутниковая связь, трекинг и координация эвакуации на маршруте',
    authors: 'Саранча Г. А., Киселёв А. Н.',
    publisherYear: 'Владивосток: ВВГУ, 2026',
    discipline: 'first_aid',
    disciplineLabel: 'Первая помощь (WFA)',
    pagesOrFormat: '118 стр. · Практическое руководство',
    examRelevance: 'Блок «Аварийная связь и регистрация групп в МЧС» (экзамен 1–4 КС)',
    summary:
      'Настройка Garmin inReach / Iridium, передача точных координат бедствия в ЦУКС МЧС, расчёт энергобаланса пауэрбанков и резервное радиооповещение.',
    tags: ['Garmin inReach', 'МЧС', 'Трекинг', 'Автономия'],
  },
  {
    id: 'lit-dfo-predators-oopt',
    title: 'Протоколы безопасности в ареале амурского тигра и бурого медведя на ООПТ Приморья и ДФО',
    authors: 'Центр «Амурский тигр», ФГБУ «Земля леопарда», ВВГУ',
    publisherYear: 'Владивосток: Изд-во ВВГУ, 2025',
    discipline: 'dfo_ecology',
    disciplineLabel: 'Специфика ДФО и ООПТ',
    pagesOrFormat: '142 стр. · Справочник гида ДФО',
    examRelevance: 'Региональный компонент аттестации РЦА «Русский Восток»',
    summary:
      'Распознавание следов крупных хищников, правила стоянки и утилизации пищевых отходов, порядок действий группы при визуальном контакте и нормативы рекреационной нагрузки.',
    tags: ['Амурский тигр', 'Бурый медведь', 'ООПТ', 'Сихотэ-Алинь'],
  },
  {
    id: 'lit-far-east-clusters',
    title: 'Рекреационная география и паспортизация маршрутов Приморского края и Дальнего Востока',
    authors: 'Гомилевская Г. А., Романова Г. М.',
    publisherYear: 'Владивосток: ИТКИ ВВГУ, 2025',
    discipline: 'dfo_ecology',
    disciplineLabel: 'Специфика ДФО и ООПТ',
    pagesOrFormat: '274 стр. · Монография / учебное пособие',
    examRelevance: 'Проектирование паспортов маршрутов для курортов Приморья и ДФО',
    summary:
      'Сезонные окна активности (7 месяцев), характеристики узловых округов (Хасанский, Шкотовский, Лазовский, Тернейский) и расчёт допустимой нагрузки на экотропы.',
    tags: ['Приморский край', 'Маршруты ДФО', 'Рекреационная ёмкость', 'ВВГУ'],
  },
];

export const FAVORITE_LITERATURE_EVENT = 'rca-literature-favorites-updated';
const STORAGE_PREFIX = 'rca_favorite_literature_v1:';
const GUEST_USER_KEY = 'guest';

export function filterRecommendedLiterature(
  items: readonly RecommendedLiteratureItem[],
  options: {
    discipline?: LiteratureDiscipline;
    search?: string;
    onlyFavorites?: boolean;
    favoriteIds?: readonly string[];
  }
): RecommendedLiteratureItem[] {
  const discipline = options.discipline ?? 'all';
  const needle = options.search?.trim().toLowerCase() ?? '';
  const onlyFavorites = options.onlyFavorites === true;
  const favSet = new Set(options.favoriteIds ?? []);

  return items.filter((item) => {
    if (discipline !== 'all' && item.discipline !== discipline) return false;
    if (onlyFavorites && !favSet.has(item.id)) return false;
    if (needle) {
      const hay = `${item.title} ${item.authors} ${item.disciplineLabel} ${item.summary} ${item.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

function getStorageKey(userId?: string | null): string {
  const normalized = userId?.trim() ? userId.trim() : GUEST_USER_KEY;
  return `${STORAGE_PREFIX}${normalized}`;
}

export function getFavoriteLiteratureIds(userId?: string | null): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const validIds = new Set(RECOMMENDED_LITERATURE.map((l) => l.id));
    return parsed.filter((id): id is string => typeof id === 'string' && validIds.has(id));
  } catch {
    return [];
  }
}

function saveFavoriteLiteratureIds(ids: string[], userId?: string | null): string[] {
  const validIds = new Set(RECOMMENDED_LITERATURE.map((l) => l.id));
  const unique = Array.from(new Set(ids)).filter((id) => validIds.has(id));
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(getStorageKey(userId), JSON.stringify(unique));
      window.dispatchEvent(new CustomEvent(FAVORITE_LITERATURE_EVENT, { detail: { ids: unique } }));
    } catch {
      // ignore storage quota errors cleanly
    }
  }
  return unique;
}

/** Merges guest-session favorites into an authenticated user's cabinet list on login. */
export function syncGuestFavoritesToUser(userId?: string | null): string[] {
  if (!userId || userId === GUEST_USER_KEY) {
    return getFavoriteLiteratureIds(GUEST_USER_KEY);
  }
  const userIds = getFavoriteLiteratureIds(userId);
  const guestIds = getFavoriteLiteratureIds(GUEST_USER_KEY);
  if (guestIds.length === 0) return userIds;

  const merged = Array.from(new Set([...userIds, ...guestIds]));
  saveFavoriteLiteratureIds(merged, userId);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(getStorageKey(GUEST_USER_KEY));
    } catch {
      // ignore
    }
  }
  return merged;
}

export function toggleFavoriteLiteratureId(
  itemId: string,
  userId?: string | null
): { ids: string[]; saved: boolean } {
  const current = getFavoriteLiteratureIds(userId);
  const exists = current.includes(itemId);
  const next = exists ? current.filter((id) => id !== itemId) : [...current, itemId];
  const savedIds = saveFavoriteLiteratureIds(next, userId);
  return { ids: savedIds, saved: !exists };
}

export function removeFavoriteLiteratureId(itemId: string, userId?: string | null): string[] {
  const current = getFavoriteLiteratureIds(userId);
  return saveFavoriteLiteratureIds(
    current.filter((id) => id !== itemId),
    userId
  );
}

export function clearFavoriteLiteratureIds(userId?: string | null): string[] {
  return saveFavoriteLiteratureIds([], userId);
}
