export type SubscriptionChannelKind = 'vacancy' | 'commission';

export interface DfoSubscriptionRegion {
  id: string;
  label: string;
  shortLabel: string;
}

export interface AttestationSubscriptionCategory {
  id: string;
  label: string;
  shortLabel: string;
  ksRange: string;
}

export interface NotificationSubscriptionPrefs {
  pushEnabled: boolean;
  regions: string[];
  categories: string[];
  notifyVacancies: boolean;
  notifyCommissions: boolean;
  updatedAtIso: string;
}

export interface PersonalizedPushAlertItem {
  id: string;
  kind: SubscriptionChannelKind;
  kindLabel: string;
  regionId: string;
  regionName: string;
  categoryIds: string[];
  categoryLabel: string;
  title: string;
  summary: string;
  dateOrDeadline: string;
  organization: string;
  compensationOrSeats: string;
}

export const SUBSCRIPTION_DFO_REGIONS: readonly DfoSubscriptionRegion[] = [
  { id: 'primorye', label: 'Приморский край', shortLabel: 'Приморье' },
  { id: 'khabarovsk', label: 'Хабаровский край', shortLabel: 'Хабаровск' },
  { id: 'kamchatka', label: 'Камчатский край', shortLabel: 'Камчатка' },
  { id: 'sakhalin', label: 'Сахалинская область', shortLabel: 'Сахалин' },
  { id: 'amur', label: 'Амурская область', shortLabel: 'Амурская обл.' },
  { id: 'yakutia', label: 'Республика Саха (Якутия)', shortLabel: 'Якутия' },
  { id: 'magadan-chukotka', label: 'Магаданская обл. и Чукотка', shortLabel: 'Магадан / Чукотка' },
];

export const SUBSCRIPTION_ATTESTATION_CATEGORIES: readonly AttestationSubscriptionCategory[] = [
  {
    id: 'hiking-1-2',
    label: 'Пешеходный туризм (1–2 КС)',
    shortLabel: 'Пешеходный 1–2 КС',
    ksRange: '1–2 КС',
  },
  {
    id: 'water-1-3',
    label: 'Водный туризм и сплавы (1–3 КС)',
    shortLabel: 'Водный 1–3 КС',
    ksRange: '1–3 КС',
  },
  {
    id: 'mountain-3-4',
    label: 'Горный и экспедиционный (3–4 КС)',
    shortLabel: 'Горный 3–4 КС',
    ksRange: '3–4 КС',
  },
  {
    id: 'speleo',
    label: 'Спелеологический туризм',
    shortLabel: 'Спелео',
    ksRange: '1–3 КС',
  },
  {
    id: 'oopt-eco',
    label: 'Экотропы ООПТ и прибрежные маршруты',
    shortLabel: 'ООПТ и экотропы',
    ksRange: '1–2 КС',
  },
];

export const PERSONALIZED_PUSH_FEED_ITEMS: readonly PersonalizedPushAlertItem[] = [
  {
    id: 'push-vac-prim-leopard',
    kind: 'vacancy',
    kindLabel: 'Вакансия',
    regionId: 'primorye',
    regionName: 'Приморский край',
    categoryIds: ['hiking-1-2', 'oopt-eco'],
    categoryLabel: 'Пешеходный 1–2 КС · ООПТ',
    title: 'Инструктор-проводник экомаршрутов нацпарка «Земля леопарда»',
    summary:
      'Сезонная занятость май–октябрь, сопровождение групп до 12 чел., требуется аттестат в ЕФРТА и модуль безопасности в ареале крупных хищников.',
    dateOrDeadline: 'Набор до 15 мар. 2027',
    organization: 'ФГБУ «Земля леопарда» и партнёрские туроператоры',
    compensationOrSeats: 'от 95 000 ₽/мес · 6 позиций',
  },
  {
    id: 'push-comm-prim-apr',
    kind: 'commission',
    kindLabel: 'Комиссия РЦА',
    regionId: 'primorye',
    regionName: 'Приморский край',
    categoryIds: ['hiking-1-2', 'water-1-3', 'mountain-3-4', 'speleo', 'oopt-eco'],
    categoryLabel: '1–4 КС · Все категории',
    title: 'Открыт приём заявок на апрельскую аттестационную комиссию (ВВГУ + Шкотовский полигон)',
    summary:
      'Очное теоретическое тестирование во Владивостоке и полевые испытания на хр. Ливадийский. Необходимо подать паспорт маршрута по форме ПП № 760.',
    dateOrDeadline: '16–18 апр. 2027',
    organization: 'РЦА «Русский Восток» (ВВГУ / ФСТР)',
    compensationOrSeats: '11 свободных мест из 32',
  },
  {
    id: 'push-vac-kam-volcano',
    kind: 'vacancy',
    kindLabel: 'Вакансия',
    regionId: 'kamchatka',
    regionName: 'Камчатский край',
    categoryIds: ['mountain-3-4', 'hiking-1-2'],
    categoryLabel: 'Горный 3–4 КС · Экспедиции',
    title: 'Ведущий гид на вулканические траверсы (Ключевская и Толбачинская группы)',
    summary:
      'Требуется действующая аттестация 3–4 КС, опыт работы со спутниковым трекером Garmin inReach и сертификат Wilderness First Aid.',
    dateOrDeadline: 'Старт контракта: июнь 2027',
    organization: 'Туроператор «Камчатка Экспедишн»',
    compensationOrSeats: '140 000–185 000 ₽/мес · 4 позиции',
  },
  {
    id: 'push-comm-kam-mar',
    kind: 'commission',
    kindLabel: 'Комиссия РЦА',
    regionId: 'kamchatka',
    regionName: 'Камчатский край',
    categoryIds: ['mountain-3-4', 'hiking-1-2'],
    categoryLabel: '2–4 КС · Горный и пешеходный',
    title: 'Выездная комиссия переаттестации гидов Камчатского края по ПП РФ № 1893',
    summary:
      'Подтверждение квалификации действующих проводников по Контуру А и защита горно-экспедиционных маршрутов до начала сезона.',
    dateOrDeadline: '12–14 мар. 2027',
    organization: 'Межрегиональная коллегия ВВГУ и ФСТР',
    compensationOrSeats: '6 свободных мест из 25',
  },
  {
    id: 'push-vac-khv-anyuy',
    kind: 'vacancy',
    kindLabel: 'Вакансия',
    regionId: 'khabarovsk',
    regionName: 'Хабаровский край',
    categoryIds: ['water-1-3', 'oopt-eco'],
    categoryLabel: 'Водный 1–3 КС · ООПТ',
    title: 'Инструктор-проводник таёжных сплавов по рекам Анюй и Хор',
    summary:
      'Вождение рафтов и катамаранов на участках 2–3 КС, спасработы на воде, взаимодействие с кордонами нацпарка «Анюйский».',
    dateOrDeadline: 'Отклик до 20 фев. 2027',
    organization: 'Клуб экспедиционного туризма «Амур-Тропа»',
    compensationOrSeats: '110 000 ₽/мес · 5 позиций',
  },
  {
    id: 'push-comm-khv-feb',
    kind: 'commission',
    kindLabel: 'Комиссия РЦА',
    regionId: 'khabarovsk',
    regionName: 'Хабаровский край',
    categoryIds: ['water-1-3', 'hiking-1-2'],
    categoryLabel: '1–3 КС · Таёжный и водный',
    title: 'Выездная комиссия РЦА в Хабаровске (полигон «Хехцир»)',
    summary:
      'Выездной экзамен для туроператоров и гидов Хабаровского края: зачёт стажа, водные нормативы и тестирование по ПП № 760.',
    dateOrDeadline: '25–27 фев. 2027',
    organization: 'РЦА «Русский Восток» и ФСТР Хабаровска',
    compensationOrSeats: '9 свободных мест из 30',
  },
  {
    id: 'push-vac-sakh-kuril',
    kind: 'vacancy',
    kindLabel: 'Вакансия',
    regionId: 'sakhalin',
    regionName: 'Сахалинская область',
    categoryIds: ['oopt-eco', 'water-1-3', 'hiking-1-2'],
    categoryLabel: 'ООПТ · Прибрежный 1–2 КС',
    title: 'Гид островных и прибрежных маршрутов (Итуруп, Кунашир, мыс Великан)',
    summary:
      'Проведение многодневных комбинированных туров в условиях морского тумана и приливной береговой линии.',
    dateOrDeadline: 'Открыта до 10 апр. 2027',
    organization: 'Сахалинский кластер приключенческого туризма',
    compensationOrSeats: '125 000 ₽/мес · 4 позиции',
  },
  {
    id: 'push-comm-sakh-apr',
    kind: 'commission',
    kindLabel: 'Комиссия РЦА',
    regionId: 'sakhalin',
    regionName: 'Сахалинская область',
    categoryIds: ['hiking-1-2', 'mountain-3-4', 'oopt-eco'],
    categoryLabel: '1–3 КС · Горно-прибрежный',
    title: 'Выездное заседание комиссии на базе СТК «Горный воздух» (Южно-Сахалинск)',
    summary:
      'Оценка ориентирования в условиях ограниченной видимости и приём документов на внесение в федеральный реестр.',
    dateOrDeadline: '23–25 апр. 2027',
    organization: 'Комиссия РЦА и ФСТР Сахалина',
    compensationOrSeats: '8 свободных мест из 24',
  },
  {
    id: 'push-comm-amur-may',
    kind: 'commission',
    kindLabel: 'Комиссия РЦА',
    regionId: 'amur',
    regionName: 'Амурская область',
    categoryIds: ['hiking-1-2', 'water-1-3'],
    categoryLabel: '1–3 КС · Пешеходный и водный',
    title: 'Выездная экзаменационная комиссия в Благовещенске (Зейский и Бурейский кластеры)',
    summary:
      'Очная аттестация проводников водно-таёжных маршрутов и инструкторов приграничных экотроп Амурской области.',
    dateOrDeadline: '28–29 мая 2027',
    organization: 'Межрегиональная комиссия РЦА «Русский Восток»',
    compensationOrSeats: '12 свободных мест из 22',
  },
  {
    id: 'push-vac-yak-lena',
    kind: 'vacancy',
    kindLabel: 'Вакансия',
    regionId: 'yakutia',
    regionName: 'Республика Саха (Якутия)',
    categoryIds: ['water-1-3', 'mountain-3-4', 'oopt-eco'],
    categoryLabel: 'Водный 1–3 КС · ООПТ',
    title: 'Проводник речных экспедиций (нацпарк «Ленские столбы» и р. Синяя)',
    summary:
      'Сопровождение туристических судов и байдарочных групп, оформление маршрутных уведомлений МЧС за 10 рабочих дней.',
    dateOrDeadline: 'Отбор до 30 апр. 2027',
    organization: 'Экспедиционный оператор Якутии',
    compensationOrSeats: '120 000 ₽/мес · 3 позиции',
  },
  {
    id: 'push-vac-magadan-speleo',
    kind: 'vacancy',
    kindLabel: 'Вакансия',
    regionId: 'magadan-chukotka',
    regionName: 'Магаданская обл. и Чукотка',
    categoryIds: ['mountain-3-4', 'speleo'],
    categoryLabel: 'Экспедиции 3–4 КС · Спелео',
    title: 'Руководитель автономных маршрутов на хребте Черского и озере Джека Лондона',
    summary:
      'Автономные экспедиции длительностью 10–14 дней, требуются допуск 3–4 КС, радиосвязь и навыки эвакуации.',
    dateOrDeadline: 'Набор до 1 мая 2027',
    organization: 'Северо-Восточное экспедиционное бюро',
    compensationOrSeats: '165 000 ₽/мес · 2 позиции',
  },
  {
    id: 'push-comm-prim-speleo-may',
    kind: 'commission',
    kindLabel: 'Комиссия РЦА',
    regionId: 'primorye',
    regionName: 'Приморский край',
    categoryIds: ['speleo', 'mountain-3-4'],
    categoryLabel: 'Спелео и горный 1–4 КС',
    title: 'Специализированная секция комиссии: спелеотуризм и вертикальная техника ПСР',
    summary:
      'Проверка работы с верёвочной страховкой, узлами и подъёмом пострадавшего в рамках майской аттестационной сессии.',
    dateOrDeadline: '14–16 мая 2027',
    organization: 'РЦА «Русский Восток» и спелеосекция ФСТР',
    compensationOrSeats: '15 свободных мест из 32',
  },
];

const STORAGE_PREFIX = 'rca_push_subscriptions_v1:';

export function buildDefaultSubscriptionPrefs(userRegion?: string): NotificationSubscriptionPrefs {
  const defaultRegions: string[] = [];
  if (userRegion) {
    if (userRegion.includes('Приморск')) defaultRegions.push('primorye');
    else if (userRegion.includes('Хабаровск')) defaultRegions.push('khabarovsk');
    else if (userRegion.includes('Камчат')) defaultRegions.push('kamchatka');
    else if (userRegion.includes('Сахалин')) defaultRegions.push('sakhalin');
    else if (userRegion.includes('Амур')) defaultRegions.push('amur');
    else if (userRegion.includes('Якут')) defaultRegions.push('yakutia');
    else if (userRegion.includes('Магадан') || userRegion.includes('Чукот')) {
      defaultRegions.push('magadan-chukotka');
    }
  }
  if (defaultRegions.length === 0) {
    defaultRegions.push('primorye');
  }

  return {
    pushEnabled: false,
    regions: defaultRegions,
    categories: ['hiking-1-2', 'oopt-eco'],
    notifyVacancies: true,
    notifyCommissions: true,
    updatedAtIso: new Date().toISOString(),
  };
}

export function readNotificationSubscriptionPrefs(
  userId?: string,
  userRegion?: string
): NotificationSubscriptionPrefs {
  const fallback = buildDefaultSubscriptionPrefs(userRegion);
  if (typeof window === 'undefined') return fallback;

  const key = `${STORAGE_PREFIX}${userId || 'guest'}`;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<NotificationSubscriptionPrefs>;
    return {
      pushEnabled: Boolean(parsed.pushEnabled),
      regions: Array.isArray(parsed.regions)
        ? parsed.regions.filter((r): r is string => typeof r === 'string')
        : fallback.regions,
      categories: Array.isArray(parsed.categories)
        ? parsed.categories.filter((c): c is string => typeof c === 'string')
        : fallback.categories,
      notifyVacancies:
        typeof parsed.notifyVacancies === 'boolean' ? parsed.notifyVacancies : true,
      notifyCommissions:
        typeof parsed.notifyCommissions === 'boolean' ? parsed.notifyCommissions : true,
      updatedAtIso:
        typeof parsed.updatedAtIso === 'string' ? parsed.updatedAtIso : fallback.updatedAtIso,
    };
  } catch {
    return fallback;
  }
}

export function saveNotificationSubscriptionPrefs(
  prefs: NotificationSubscriptionPrefs,
  userId?: string
): NotificationSubscriptionPrefs {
  const updated: NotificationSubscriptionPrefs = {
    ...prefs,
    updatedAtIso: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    const key = `${STORAGE_PREFIX}${userId || 'guest'}`;
    try {
      window.localStorage.setItem(key, JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }
  }
  return updated;
}

export function matchPersonalizedPushAlerts(
  prefs: NotificationSubscriptionPrefs,
  items: readonly PersonalizedPushAlertItem[] = PERSONALIZED_PUSH_FEED_ITEMS
): PersonalizedPushAlertItem[] {
  const hasRegionFilter = prefs.regions.length > 0;
  const hasCategoryFilter = prefs.categories.length > 0;

  if (!hasRegionFilter && !hasCategoryFilter) return [];
  if (!prefs.notifyVacancies && !prefs.notifyCommissions) return [];

  return items.filter((item) => {
    if (item.kind === 'vacancy' && !prefs.notifyVacancies) return false;
    if (item.kind === 'commission' && !prefs.notifyCommissions) return false;

    const regionMatch = !hasRegionFilter || prefs.regions.includes(item.regionId);
    const categoryMatch =
      !hasCategoryFilter || item.categoryIds.some((cid) => prefs.categories.includes(cid));

    return regionMatch && categoryMatch;
  });
}

export type BrowserPushPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

export function getBrowserPushPermissionStatus(): BrowserPushPermissionStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

export async function requestBrowserPushPermission(): Promise<BrowserPushPermissionStatus> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await window.Notification.requestPermission();
    return result;
  } catch {
    return window.Notification.permission ?? 'denied';
  }
}

export function sendBrowserPushNotification(alert: PersonalizedPushAlertItem): {
  dispatchedNative: boolean;
  message: string;
} {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (window.Notification.permission === 'granted') {
      try {
        new window.Notification(`${alert.kindLabel} · ${alert.regionName}`, {
          body: `${alert.title} (${alert.dateOrDeadline})`,
          tag: alert.id,
        });
        return {
          dispatchedNative: true,
          message: `Push-уведомление отправлено в браузер: «${alert.title}».`,
        };
      } catch {
        // Fallback when iframe blocks constructor
      }
    }
  }

  return {
    dispatchedNative: false,
    message: `Персональное уведомление сформировано по подписке (${alert.regionName}): «${alert.title}».`,
  };
}
