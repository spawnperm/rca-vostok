/**
 * Landing content imported from the official website rca-vostok.ru.
 *
 * The site serves its content as JSON from `/api/content`; the structures here
 * mirror what it actually returns (section order, programme cards, the 2027
 * certification schedule, consulting services, contacts). Keeping it as typed
 * data rather than markup means the landing sections stay presentational and
 * the wording can be corrected in one place.
 *
 * Source: https://rca-vostok.ru/api/content (retrieved 2026-11-22).
 */

export interface ProgrammeCard {
  title: string;
  icon: 'tent' | 'waves' | 'camera' | 'flag';
}

export interface PreparationStep {
  title: string;
  icon: 'book' | 'map' | 'signpost';
}

export interface CertificationSlot {
  /** ISO date of the first day. */
  start: string;
  /** ISO date of the last day. */
  end: string;
  /** Category of difficulty covered by the session. */
  category: string;
  /** Disciplines examined in this session. */
  disciplines: string[];
}

export interface ConsultingService {
  title: string;
  accent: 'primary' | 'secondary';
  points: string[];
}

export interface ContactDetails {
  phone: string;
  email: string;
  address: string;
  messengers: { label: string; url: string }[];
  copyright: string;
}

export const SITE_BRAND = {
  line1: 'ОБУЧЕНИЕ В ТУРИЗМЕ:',
  line2: 'ЦЕНТР АТТЕСТАЦИИ «РУССКИЙ ВОСТОК»',
} as const;

export const SITE_ANNOUNCEMENT = {
  text: 'Набор на курсы по пешеходному туризму открыт',
  linkLabel: 'Записаться',
  url: 'https://dpo.vvsu.ru/программы/туризм/инструктор-проводник-по-пешеходному-туризму',
} as const;

export const HERO = {
  eyebrow: 'Профессиональное образование',
  title: 'Подготовка инструкторов-проводников по туризму',
  text: 'Обучение — Практика — Аттестация',
} as const;

/** «Реализуемые программы» — четыре направления подготовки. */
export const PROGRAMMES: readonly ProgrammeCard[] = [
  { title: 'Инструктор-проводник по пешеходному туризму', icon: 'tent' },
  { title: 'Инструктор-проводник по водному туризму', icon: 'waves' },
  { title: 'Экскурсовод', icon: 'camera' },
  { title: 'Руководитель туристической группы', icon: 'flag' },
];

/** «Практика по пешеходному туризму» — этапы подготовки. */
export const PREPARATION_STEPS: readonly PreparationStep[] = [
  { title: 'Подготовка к аттестации', icon: 'book' },
  { title: 'Практика по туризму', icon: 'map' },
  { title: 'Категорийные походы', icon: 'signpost' },
];

const ALL_DISCIPLINES = [
  'пешеходный',
  'водный',
  'пешеходный + водный',
  'спелеологический',
  'горный',
  'пешеходный + горный',
  'пешеходный + спелеологический',
];

/** «График аттестаций на 2027 год» — пять сессий категории 1–4 КС. */
export const CERTIFICATION_SCHEDULE: readonly CertificationSlot[] = [
  { start: '2027-04-16', end: '2027-04-18', category: '1–4 КС', disciplines: ALL_DISCIPLINES },
  { start: '2027-05-14', end: '2027-05-16', category: '1–4 КС', disciplines: ALL_DISCIPLINES },
  { start: '2027-06-04', end: '2027-06-06', category: '1–4 КС', disciplines: ALL_DISCIPLINES },
  { start: '2027-10-15', end: '2027-10-17', category: '1–4 КС', disciplines: ALL_DISCIPLINES },
  { start: '2027-10-29', end: '2027-10-31', category: '1–4 КС', disciplines: ALL_DISCIPLINES },
];

export const ATTESTATION_EXTERNAL = {
  label: 'Аттестация ФСТР',
  url: 'https://attestation.tssr.ru/rca_primorie',
} as const;

/** «Консалтинг» — услуги центра. */
export const CONSULTING_SERVICES: readonly ConsultingService[] = [
  {
    title: 'Разработка и оформление туристских маршрутов',
    accent: 'primary',
    points: [
      'Паспортизация маршрутов по Постановлению № 760 (форма 760). Подготовка полного комплекта документов: описание маршрута, оценка рисков, меры безопасности, расчёт пропускной способности, согласование с ООПТ.',
      'Планирование и нормирование маршрутов. Расчёт таймингов, темпа группы, точек контроля и запасных вариантов; подбор альтернативных выходов при ЧС.',
      'Адаптация под виды туризма. Пешие, горные, водные, комбинированные маршруты — с учётом специфики региона и категории сложности.',
    ],
  },
  {
    title: 'Подготовка к аттестации инструкторов-проводников и методическая поддержка',
    accent: 'secondary',
    points: [
      'Формирование программы подготовки. Учебные модули под билеты аттестации: первая помощь, топография, сопровождение группы, ПСР, работа в стрессовой ситуации.',
      'Моделирование экзаменационных ситуаций и разбор типичных ошибок кандидатов.',
      'Методические материалы и сопровождение куратора на всех этапах подготовки.',
    ],
  },
];

export const CONTACTS: ContactDetails = {
  phone: '+7 (991) 809 08 70',
  email: 'russian_east@bk.ru',
  address: 'г. Владивосток, ул. Гоголя, д. 41',
  messengers: [
    { label: 'Telegram', url: 'https://t.me/RusskiyVostok' },
    { label: 'ВКонтакте', url: 'https://vk.ru/rcaprm' },
  ],
  copyright: '© 2026 Центр аттестации «Русский Восток». Все права защищены.',
};

/** Sections of the public site, in the order the original navigation uses. */
export interface LandingSection {
  /** Anchor / site tab identifier. */
  id: string;
  label: string;
}

export const LANDING_SECTIONS: readonly LandingSection[] = [
  { id: 'learning', label: 'Обучение' },
  { id: 'preparation', label: 'Подготовка' },
  { id: 'certification', label: 'Аттестация' },
  { id: 'consulting', label: 'Консалтинг' },
  { id: 'contacts', label: 'Связь' },
];

/** Genitive month names — the form Russian uses in dates («16 апреля»). */
const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

/** Formats an ISO interval as «16–18 апреля 2027». */
export function formatSessionRange(start: string, end: string): string {
  const from = new Date(`${start}T00:00:00Z`);
  const to = new Date(`${end}T00:00:00Z`);
  const year = from.getUTCFullYear();
  const fromDay = from.getUTCDate();
  const toDay = to.getUTCDate();
  const fromMonth = MONTHS_GENITIVE[from.getUTCMonth()];

  // Same month: collapse into a range; otherwise name both months.
  if (from.getUTCMonth() === to.getUTCMonth()) {
    return `${fromDay}–${toDay} ${fromMonth} ${year}`;
  }
  const toMonth = MONTHS_GENITIVE[to.getUTCMonth()];
  return `${fromDay} ${fromMonth} — ${toDay} ${toMonth} ${year}`;
}
