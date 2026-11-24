export interface SessionRecord {
  sessionId: string;
  visitorId: string;
  startedAt: string;
  lastSeenAt: string;
  deviceType: string;
  browser: string;
  viewport: string;
  referrer: string;
  utmSource: string;
  landingTab: string;
  tabsVisited: string[];
  maxScrollDepth: number;
  durationSec: number;
  eventCount: number;
  clickCount: number;
}

export interface AnalyticsSummaryResponse {
  totals: {
    sessions: number;
    uniqueVisitors: number;
    pageviews: number;
    totalEvents: number;
    totalClicks: number;
    avgDurationSec: number;
    avgScrollDepth: number;
  };
  tabStats: Record<string, { views: number; clicks: number; interactions: number }>;
  devices: Record<string, number>;
  referrers: Record<string, number>;
  timeline: { label: string; visits: number; events: number }[];
  topClicked: { label: string; tab: string; count: number }[];
  heatmapPoints: { xPct: number; yPct: number; tab: string; label: string }[];
  recentSessions: SessionRecord[];
}

export interface ServerSeoStatus {
  baseUrl: string;
  robotsUrl: string;
  sitemapUrl: string;
  robotsConfigured: boolean;
  sitemapConfigured: boolean;
  indexedRoutes: number;
}

export interface ServerMetricsSnapshot {
  uptimeSec: number;
  startedAt: string;
  requests: {
    total: number;
    errors5xx: number;
    clientErrors4xx: number;
    rateLimited: number;
  };
  latency: {
    p50: number;
    p95: number;
    max: number;
  };
  byRoute: Record<
    string,
    {
      count: number;
      errors: number;
      avgMs: number;
      p95Ms: number;
    }
  >;
  process: {
    rssMb: number;
    heapUsedMb: number;
  };
}

export type AnalyticsSubTab = 'behavior' | 'seo' | 'api';

export type ApiEndpointCategory =
  | 'system'
  | 'inquiries'
  | 'analytics'
  | 'cabinet'
  | 'assistant';

export interface ApiEndpointDoc {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  category: ApiEndpointCategory;
  description: string;
  auth: string;
  testableGet?: boolean;
}

export const TAB_LABELS: Record<string, string> = {
  home: 'Главная',
  learning: 'Обучение',
  preparation: 'Подготовка',
  certification: 'Аттестация',
  consulting: 'Консалтинг',
  news: 'Новости',
  routes: 'Маршруты',
  faq: 'FAQ',
  contacts: 'Связь',
  overview: 'Обзор центра',
  calculator: 'Калькулятор',
  market: 'Рынок ДФО',
  dissertation: 'Диссертация',
  presentations: 'Презентации',
  analytics: 'Аналитика и SEO',
  account: 'Личный кабинет',
};

export const PLATFORM_TABS_ORDER: readonly string[] = [
  'home',
  'learning',
  'preparation',
  'certification',
  'routes',
  'news',
  'consulting',
  'faq',
  'contacts',
  'overview',
  'calculator',
  'market',
  'dissertation',
  'presentations',
  'analytics',
  'account',
];

export const EVENT_TYPE_LABELS: Record<string, string> = {
  session_start: 'Начало сессии',
  pageview: 'Переход в раздел',
  click: 'Клик',
  scroll: 'Прокрутка',
  interaction: 'Взаимодействие',
  outbound: 'Внешний переход',
};

export const API_CATEGORY_LABELS: Record<'all' | ApiEndpointCategory, string> = {
  all: 'Все группы',
  system: 'Система и SEO',
  inquiries: 'Заявки и отзывы',
  analytics: 'Аналитика',
  cabinet: 'Профиль и рынок ДФО',
  assistant: 'AI-ассистент',
};

export const API_ENDPOINTS_REFERENCE: readonly ApiEndpointDoc[] = [
  {
    method: 'GET',
    path: '/api/health',
    category: 'system',
    description: 'Проверка готовности сервера, шины событий и адаптера хранения (PostgreSQL / JSON)',
    auth: 'Публичный',
    testableGet: true,
  },
  {
    method: 'GET',
    path: '/api/metrics',
    category: 'system',
    description: 'Снимок телеметрии процесса: счётчики запросов, ошибки 4xx/5xx, p50/p95 латентности, память',
    auth: 'Публичный',
    testableGet: true,
  },
  {
    method: 'GET',
    path: '/api/seo/server-status',
    category: 'system',
    description: 'Статус robots.txt, sitemap.xml и число публичных индексируемых маршрутов',
    auth: 'Публичный',
    testableGet: true,
  },
  {
    method: 'GET',
    path: '/api/analytics/summary',
    category: 'analytics',
    description: 'Агрегированная статистика сессий, кликов, устройств и тепловой карты',
    auth: 'Публичный',
    testableGet: true,
  },
  {
    method: 'POST',
    path: '/api/analytics/collect',
    category: 'analytics',
    description: 'Приём пакета поведенческих событий клиентского трекера',
    auth: 'Публичный / Rate-limit',
  },
  {
    method: 'DELETE',
    path: '/api/analytics/reset',
    category: 'analytics',
    description: 'Сброс накопленного журнала поведенческих событий',
    auth: 'Публичный',
  },
  {
    method: 'GET',
    path: '/api/inquiries/stats',
    category: 'inquiries',
    description: 'Сводная статистика заявок на обучение и аттестацию по субъектам и трекам ДФО',
    auth: 'Публичный',
    testableGet: true,
  },
  {
    method: 'GET',
    path: '/api/inquiries/stats/stream',
    category: 'inquiries',
    description: 'Поток обновлений счётчика заявок в реальном времени (Server-Sent Events)',
    auth: 'Публичный / SSE',
  },
  {
    method: 'POST',
    path: '/api/inquiries',
    category: 'inquiries',
    description: 'Регистрация новой заявки соискателя или запроса консультации куратора РЦА',
    auth: 'Публичный / Валидация',
  },
  {
    method: 'GET',
    path: '/api/account/inquiries',
    category: 'inquiries',
    description: 'Персональный список заявок авторизованного пользователя и статусы рассмотрения',
    auth: 'Сессия / RBAC',
    testableGet: true,
  },
  {
    method: 'GET',
    path: '/api/feedback/stats',
    category: 'inquiries',
    description: 'Общее количество и распределение обращений обратной связи платформы',
    auth: 'Публичный',
    testableGet: true,
  },
  {
    method: 'GET',
    path: '/api/feedback/reviews',
    category: 'inquiries',
    description: 'Опубликованные отзывы соискателей и проводников о прохождении аттестации',
    auth: 'Публичный',
    testableGet: true,
  },
  {
    method: 'POST',
    path: '/api/feedback',
    category: 'inquiries',
    description: 'Отправка отзыва, предложения или технического обращения в центр РЦА',
    auth: 'Публичный / Валидация',
  },
  {
    method: 'GET',
    path: '/api/auth/session',
    category: 'cabinet',
    description: 'Проверка текущей сессии пользователя, роли и матрицы разрешений RBAC',
    auth: 'Сессия / Cookie',
    testableGet: true,
  },
  {
    method: 'GET',
    path: '/api/guides/leaderboard',
    category: 'cabinet',
    description: 'Рейтинг аттестованных инструкторов-проводников ДФО по маршрутам и стажу',
    auth: 'Публичный',
    testableGet: true,
  },
  {
    method: 'GET',
    path: '/api/market/live-stats',
    category: 'cabinet',
    description: 'Живая сводка кадрового рынка ДФО (спрос, реестр, опросы готовности)',
    auth: 'Публичный',
    testableGet: true,
  },
  {
    method: 'GET',
    path: '/api/weather/hubs',
    category: 'cabinet',
    description: 'Текущая метеосводка и условия на маршрутах ключевых узлов Дальнего Востока',
    auth: 'Публичный',
    testableGet: true,
  },
  {
    method: 'GET',
    path: '/api/maps/config',
    category: 'cabinet',
    description: 'Конфигурация картографического слоя для клиентского модуля маршрутов ДФО',
    auth: 'Публичный',
    testableGet: true,
  },
  {
    method: 'POST',
    path: '/api/assistant/chat',
    category: 'assistant',
    description: 'Консультант по регламенту ПП № 1003/1893, паспортизации № 760 и программам ВВГУ',
    auth: 'Публичный / Rate-limit',
  },
];
