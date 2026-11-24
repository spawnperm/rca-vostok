import type { SiteTabId } from './seo.ts';

export interface TopNavItem {
  id: SiteTabId;
  label: string;
  matches?: readonly SiteTabId[];
}

export interface SidebarNavItem {
  id: SiteTabId;
  label: string;
  /** Set to false for private/authenticated workspaces that must stay out of search engines. */
  indexable?: boolean;
}

export interface SubTabManifestEntry {
  id: string;
  label: string;
  isDefault?: boolean;
  priority?: string;
  changefreq?: 'daily' | 'weekly' | 'monthly';
}

/** Concise 5-item primary navigation matching the consolidated site structure. */
export const TOP_NAV: readonly TopNavItem[] = [
  { id: 'home', label: 'Главная' },
  { id: 'learning', label: 'Обучение', matches: ['learning', 'preparation'] },
  { id: 'certification', label: 'Аттестация' },
  { id: 'routes', label: 'Маршруты', matches: ['routes', 'news'] },
  { id: 'faq', label: 'FAQ и связь', matches: ['faq', 'consulting', 'contacts'] },
];

export const SIDEBAR_NAV: readonly SidebarNavItem[] = [
  { id: 'overview', label: 'Обзор центра' },
  { id: 'calculator', label: 'Калькулятор' },
  { id: 'market', label: 'Рынок ДФО' },
  { id: 'dissertation', label: 'Диссертация' },
  { id: 'presentations', label: 'Презентации' },
  { id: 'analytics', label: 'Аналитика и SEO' },
  { id: 'account', label: 'Личный кабинет', indexable: false },
];

/** Canonical registry of sub-sections (?tab=<section>&sub=<sub>) exposed inside sections. */
export const SECTION_SUBTABS: Partial<Record<SiteTabId, readonly SubTabManifestEntry[]>> = {
  learning: [
    { id: 'programmes', label: 'Программы обучения', isDefault: true },
    { id: 'competencies', label: 'Граф компетенций', priority: '0.8' },
    { id: 'glossary', label: 'Глоссарий терминов', priority: '0.8' },
    { id: 'exam', label: 'Тренажёр экзамена ФСТР', priority: '0.8' },
    { id: 'library', label: 'Методическая библиотека', priority: '0.8' },
  ],
  certification: [
    { id: 'schedule', label: 'График аттестаций 2027', isDefault: true },
    { id: 'calendars', label: 'Единый календарь комиссий', priority: '0.8' },
    { id: 'locations', label: 'Карта площадок и полигонов', priority: '0.8' },
    { id: 'registry', label: 'Реестр проводников', priority: '0.8' },
  ],
  routes: [
    { id: 'routes', label: 'Маршруты Приморья и погода', isDefault: true },
    { id: 'news', label: 'Новости отрасли и НПА', priority: '0.8' },
  ],
  faq: [
    { id: 'faq', label: 'Частые вопросы (FAQ)', isDefault: true },
    { id: 'consulting', label: 'Консалтинг и форма № 760', priority: '0.7' },
    { id: 'contacts', label: 'Контакты РЦА', priority: '0.7' },
  ],
  overview: [
    { id: 'summary', label: 'Сводка и заявки', isDefault: true },
    { id: 'commission', label: 'Комиссия и партнёры', priority: '0.8' },
    { id: 'monitoring', label: 'Мониторинг и опросы', priority: '0.8' },
    { id: 'registry', label: 'Реестр и аккредитация', priority: '0.8' },
  ],
  calculator: [
    { id: 'demand_2030', label: 'Модель потребности 2030', isDefault: true },
    { id: 'costs_budget', label: 'Смета обучения и госпошлина', priority: '0.8' },
    { id: 'expert_rating', label: 'Рейтинг экспертов', priority: '0.8' },
  ],
  market: [
    { id: 'geo', label: 'Геоаналитика ДФО и Приморья', isDefault: true },
    { id: 'demand', label: 'Спрос и динамика регионов', priority: '0.8' },
    { id: 'strategy', label: 'Сегменты, риски и 7 мер', priority: '0.8' },
  ],
  analytics: [
    { id: 'behavior', label: 'Поведенческая аналитика', isDefault: true },
    { id: 'seo', label: 'SEO-мониторинг', priority: '0.5', changefreq: 'daily' },
    { id: 'api', label: 'Диагностика API', priority: '0.5', changefreq: 'daily' },
  ],
};

export function isTopNavActive(item: TopNavItem, activeTab: SiteTabId): boolean {
  if (item.matches) {
    return item.matches.includes(activeTab);
  }
  return activeTab === item.id;
}
