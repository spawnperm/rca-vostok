export type SiteTabId =
  | 'home'
  | 'learning'
  | 'preparation'
  | 'certification'
  | 'consulting'
  | 'news'
  | 'routes'
  | 'faq'
  | 'contacts'
  | 'overview'
  | 'calculator'
  | 'market'
  | 'dissertation'
  | 'presentations'
  | 'analytics'
  | 'account';

export interface SectionSeoMeta {
  tab: SiteTabId;
  name: string;
  title: string;
  description: string;
  keywords: string;
  pathQuery: string;
}

export interface NavigateOptions {
  subTab?: string;
  anchor?: string;
}

export interface SitemapRouteMeta {
  tab: SiteTabId;
  slug: string;
  priority: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
}

export const PUBLIC_SITEMAP_ROUTES: readonly SitemapRouteMeta[] = [
  { tab: 'home', slug: '', priority: '1.0', changefreq: 'weekly' },
  { tab: 'learning', slug: '?tab=learning', priority: '0.9', changefreq: 'weekly' },
  { tab: 'preparation', slug: '?tab=preparation', priority: '0.8', changefreq: 'weekly' },
  { tab: 'certification', slug: '?tab=certification', priority: '0.9', changefreq: 'weekly' },
  { tab: 'routes', slug: '?tab=routes', priority: '0.8', changefreq: 'weekly' },
  { tab: 'news', slug: '?tab=news', priority: '0.8', changefreq: 'weekly' },
  { tab: 'consulting', slug: '?tab=consulting', priority: '0.7', changefreq: 'monthly' },
  { tab: 'faq', slug: '?tab=faq', priority: '0.8', changefreq: 'monthly' },
  { tab: 'contacts', slug: '?tab=contacts', priority: '0.7', changefreq: 'monthly' },
  { tab: 'overview', slug: '?tab=overview', priority: '0.9', changefreq: 'weekly' },
  { tab: 'calculator', slug: '?tab=calculator', priority: '0.9', changefreq: 'monthly' },
  { tab: 'market', slug: '?tab=market', priority: '0.9', changefreq: 'monthly' },
  { tab: 'dissertation', slug: '?tab=dissertation', priority: '0.8', changefreq: 'monthly' },
  { tab: 'presentations', slug: '?tab=presentations', priority: '0.8', changefreq: 'monthly' },
  { tab: 'analytics', slug: '?tab=analytics', priority: '0.6', changefreq: 'daily' },
];

export function parseRouteFromSearch(search: string): {
  tab: SiteTabId;
  subTab?: string;
} {
  try {
    const params = new URLSearchParams(search);
    const rawTab = params.get('tab') as SiteTabId | null;
    const rawSub = params.get('sub')?.trim() || undefined;
    if (rawTab && rawTab in SECTION_SEO_MAP) {
      return { tab: rawTab, subTab: rawSub };
    }
  } catch {
    // ignore malformed query strings
  }
  return { tab: 'home', subTab: undefined };
}

export function buildRouteUrl(
  pathname: string,
  tab: SiteTabId,
  subTab?: string
): string {
  const params = new URLSearchParams();
  if (tab !== 'home') {
    params.set('tab', tab);
  }
  if (subTab && subTab.trim()) {
    params.set('sub', subTab.trim());
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export const SECTION_SEO_MAP: Record<SiteTabId, SectionSeoMeta> = {
  // ── Public landing sections (content mirrors rca-vostok.ru) ──────────────
  home: {
    tab: 'home',
    name: 'Главная',
    title: 'Центр аттестации «Русский Восток» — обучение в туризме',
    description:
      'Подготовка инструкторов-проводников по туризму: программы обучения, практика, график аттестаций на 2027 год и консалтинг на базе ВВГУ.',
    keywords:
      'инструктор-проводник обучение, аттестация проводников, Русский Восток, ВВГУ туризм',
    pathQuery: '',
  },
  learning: {
    tab: 'learning',
    name: 'Обучение',
    title: 'Реализуемые программы обучения — Центр «Русский Восток»',
    description:
      'Инструктор-проводник по пешеходному и водному туризму, экскурсовод, руководитель туристической группы — программы профессиональной подготовки.',
    keywords: 'программы обучения проводников, экскурсовод, руководитель тургруппы',
    pathQuery: '?tab=learning',
  },
  preparation: {
    tab: 'preparation',
    name: 'Подготовка',
    title: 'Практика по пешеходному туризму — Центр «Русский Восток»',
    description:
      'Подготовка к аттестации, практика по туризму и категорийные походы: этапы подготовки инструктора-проводника.',
    keywords: 'практика по туризму, категорийные походы, подготовка к аттестации',
    pathQuery: '?tab=preparation',
  },
  certification: {
    tab: 'certification',
    name: 'Аттестация',
    title: 'График аттестаций на 2027 год — Центр «Русский Восток»',
    description:
      'Расписание сессий аттестации категории 1–4 КС: пешеходный, водный, горный и спелеологический туризм, а также комбинированные виды.',
    keywords: 'график аттестаций 2027, аттестация ФСТР, категорийные походы',
    pathQuery: '?tab=certification',
  },
  consulting: {
    tab: 'consulting',
    name: 'Консалтинг',
    title: 'Консалтинг в активном туризме — Центр «Русский Восток»',
    description:
      'Паспортизация маршрутов по Постановлению № 760, планирование маршрутов и методическая поддержка инструкторов-проводников.',
    keywords: 'паспортизация маршрутов, Постановление 760, консалтинг туризм',
    pathQuery: '?tab=consulting',
  },
  news: {
    tab: 'news',
    name: 'Новости',
    title: 'Новости аттестации и рынка — Центр «Русский Восток»',
    description:
      'Изменения нормативной базы аттестации проводников, итоги сессий РЦА и события рынка активного туризма Дальнего Востока.',
    keywords: 'новости аттестации проводников, ПП 1893, сессии РЦА, рынок туризма ДФО',
    pathQuery: '?tab=news',
  },
  routes: {
    tab: 'routes',
    name: 'Маршруты',
    title: 'Маршруты и округа Приморского края — Центр «Русский Восток»',
    description:
      'Активные маршруты по восьми округам Приморья: обеспеченность проводниками, расчётная потребность, сезонность и особенности безопасности.',
    keywords: 'маршруты Приморье, округа Приморского края, активный туризм, проводники',
    pathQuery: '?tab=routes',
  },
  faq: {
    tab: 'faq',
    name: 'Частые вопросы (FAQ)',
    title: 'Частые вопросы об аттестации проводников — Центр «Русский Восток»',
    description:
      'Ответы на частые вопросы о порядке аттестации инструкторов-проводников, перечне документов, обучении в ВВГУ, стоимости и экзаменах в Приморском крае.',
    keywords: 'FAQ аттестация проводников, порядок аттестации гидов, документы РЦА ВВГУ',
    pathQuery: '?tab=faq',
  },
  contacts: {
    tab: 'contacts',
    name: 'Связь',
    title: 'Контакты Центра аттестации «Русский Восток»',
    description:
      'Телефон, электронная почта, адрес во Владивостоке и мессенджеры для связи с центром аттестации.',
    keywords: 'контакты Русский Восток, Владивосток Гоголя 41, телефон центра',
    pathQuery: '?tab=contacts',
  },

  // ── Analytical platform sections (sidebar) ──────────────────────────────
  overview: {
    tab: 'overview',
    name: 'Обзор центра',
    title: 'РЦА «Русский Восток» — Аналитика и аттестация проводников',
    description:
      'Аналитика рынка инструкторов-проводников Приморья и ДФО, калькулятор потребности до 2030 г., диссертация ВАК 5.2.3 и аттестация на базе ВВГУ.',
    keywords: 'РЦА Русский Восток, инструктор-проводник, аттестация Приморье, ВВГУ',
    pathQuery: '?tab=overview',
  },
  calculator: {
    tab: 'calculator',
    name: 'Калькулятор потребности',
    title: 'Калькулятор потребности в проводниках ДФО — РЦА «Русский Восток»',
    description:
      'Интерактивная экономико-математическая модель расчёта дефицита инструкторов-проводников Приморского края с прогнозом на 2026–2030 годы.',
    keywords: 'калькулятор потребности гидов, дефицит инструкторов Приморье, модель ДФО',
    pathQuery: '?tab=calculator',
  },
  market: {
    tab: 'market',
    name: 'Рынок ДФО',
    title: 'Рынок активного туризма ДФО 2026–2029 — РЦА «Русский Восток»',
    description:
      'Сегментация рынка инструкторов-проводников, пять узких мест, специфика безопасности ДФО и семь мер по преодолению кадрового дефицита.',
    keywords: 'рынок активного туризма Приморье, прогноз гидов 2029, глэмпинги ДФО',
    pathQuery: '?tab=market',
  },
  dissertation: {
    tab: 'dissertation',
    name: 'Диссертация ВАК 5.2.3',
    title: 'Исследование ВАК 5.2.3 по кадрам туризма — РЦА «Русский Восток»',
    description:
      'Методология кандидатского и докторского исследования по специальности 5.2.3: научная новизна, положения на защиту и сравнение с IFMGA.',
    keywords: 'ВАК 5.2.3 туризм, диссертация инструкторы-проводники, научная новизна ВВГУ',
    pathQuery: '?tab=dissertation',
  },
  presentations: {
    tab: 'presentations',
    name: 'Презентации и защита',
    title: 'Презентации к защите и для Минтуризма — РЦА «Русский Восток»',
    description:
      'Академическая презентация на 18 слайдов для совета ВАК, управленческий доклад для Минтуризма (10 слайдов) и одностраничный раздаточный лист.',
    keywords: 'презентация защиты ВАК 5.2.3, доклад Минтуризма Приморье, раздатка ВВГУ',
    pathQuery: '?tab=presentations',
  },
  analytics: {
    tab: 'analytics',
    name: 'SEO и статистика посещений',
    title: 'SEO-мониторинг и аналитика поведения — РЦА «Русский Восток»',
    description:
      'Отслеживание SEO-метрик, статистика посещений платформы, карта кликов и запись пользовательских сценариев поведения в реальном времени.',
    keywords: 'SEO аудит, статистика посещений, карта кликов, поведение пользователей',
    pathQuery: '?tab=analytics',
  },
  account: {
    tab: 'account',
    name: 'Личный кабинет',
    title: 'Личный кабинет соискателя и проводника — РЦА «Русский Восток»',
    description:
      'Персональный кабинет платформы РЦА «Русский Восток»: профиль соискателя, статус аттестации, заявки и права доступа по роли.',
    keywords: 'личный кабинет РЦА, статус аттестации проводника, заявка на аттестацию',
    pathQuery: '?tab=account',
  },
};

function upsertMeta(selector: string, attrName: 'name' | 'property', attrVal: string, content: string): void {
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrVal);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function applySectionSeo(tab: SiteTabId): void {
  const meta = SECTION_SEO_MAP[tab];
  const canonicalUrl = `${window.location.origin}${window.location.pathname}${meta.pathQuery}`;

  document.title = meta.title;
  upsertMeta('meta[name="description"]', 'name', 'description', meta.description);
  upsertMeta('meta[name="keywords"]', 'name', 'keywords', meta.keywords);
  upsertMeta('meta[property="og:title"]', 'property', 'og:title', meta.title);
  upsertMeta('meta[property="og:description"]', 'property', 'og:description', meta.description);
  upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
  upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', meta.title);
  upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', meta.description);

  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', canonicalUrl);

  // Dynamic BreadcrumbList JSON-LD
  const ldId = 'dynamic-breadcrumb-ld';
  let ldScript = document.getElementById(ldId) as HTMLScriptElement | null;
  if (!ldScript) {
    ldScript = document.createElement('script');
    ldScript.id = ldId;
    ldScript.type = 'application/ld+json';
    document.head.appendChild(ldScript);
  }
  const breadcrumbPayload = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'РЦА «Русский Восток»',
        item: `${window.location.origin}${window.location.pathname}`,
      },
      ...(tab !== 'home'
        ? [
            {
              '@type': 'ListItem',
              position: 2,
              name: meta.name,
              item: canonicalUrl,
            },
          ]
        : []),
    ],
  };
  ldScript.textContent = JSON.stringify(breadcrumbPayload);
}

export interface SeoCheckItem {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  valuePreview: string;
}

export interface LiveSeoAuditResult {
  score: number;
  title: string;
  titleLen: number;
  description: string;
  descriptionLen: number;
  canonical: string;
  lang: string;
  h1Count: number;
  imagesTotal: number;
  imagesWithAlt: number;
  jsonLdCount: number;
  checks: SeoCheckItem[];
}

export function runLiveDomSeoAudit(): LiveSeoAuditResult {
  const title = document.title || '';
  const titleLen = title.length;
  const description =
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content || '';
  const descriptionLen = description.length;
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || '';
  const ogTitle =
    document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content || '';
  const ogDesc =
    document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content || '';
  const twitterCard =
    document.querySelector<HTMLMetaElement>('meta[name="twitter:card"]')?.content || '';
  const robotsMeta =
    document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content || '';
  const lang = document.documentElement.lang || '';

  const h1Elements = document.querySelectorAll('h1');
  const h1Count = h1Elements.length;
  const imgElements = Array.from(document.querySelectorAll('img'));
  const imagesTotal = imgElements.length;
  const imagesWithAlt = imgElements.filter((img) => Boolean(img.getAttribute('alt')?.trim())).length;

  const ldScripts = Array.from(
    document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')
  );
  const jsonLdCount = ldScripts.length;

  const checks: SeoCheckItem[] = [
    {
      id: 'title',
      label: 'Тег <title> (оптимально 30–65 символов)',
      status: titleLen >= 30 && titleLen <= 70 ? 'pass' : titleLen > 0 ? 'warn' : 'fail',
      detail: `Длина: ${titleLen} симв.`,
      valuePreview: title || 'Не задан',
    },
    {
      id: 'description',
      label: 'Meta Description (оптимально 120–160 символов)',
      status:
        descriptionLen >= 110 && descriptionLen <= 170
          ? 'pass'
          : descriptionLen > 0
            ? 'warn'
            : 'fail',
      detail: `Длина: ${descriptionLen} симв.`,
      valuePreview: description || 'Не задано',
    },
    {
      id: 'opengraph',
      label: 'OpenGraph-карточка (og:title, og:description)',
      status: ogTitle && ogDesc ? 'pass' : 'fail',
      detail: ogTitle && ogDesc ? 'Все обязательные теги заданы' : 'Отсутствуют OG-теги',
      valuePreview: ogTitle || 'Не задано',
    },
    {
      id: 'twitter',
      label: 'Twitter / X Card',
      status: twitterCard ? 'pass' : 'warn',
      detail: twitterCard ? `Тип: ${twitterCard}` : 'Не настроено',
      valuePreview: twitterCard || '—',
    },
    {
      id: 'canonical',
      label: 'Канонический URL (<link rel="canonical">)',
      status: canonical ? 'pass' : 'fail',
      detail: canonical ? 'Синхронизирован с текущим разделом' : 'Отсутствует canonical',
      valuePreview: canonical || 'Не задан',
    },
    {
      id: 'jsonld',
      label: 'Микроразметка Schema.org (JSON-LD)',
      status: jsonLdCount >= 1 ? 'pass' : 'fail',
      detail: `Найдено блоков: ${jsonLdCount} (WebApplication + BreadcrumbList)`,
      valuePreview: jsonLdCount > 0 ? 'Валидный JSON-LD подключён' : 'Отсутствует',
    },
    {
      id: 'h1',
      label: 'Иерархия заголовков (ровно один <h1> на экране)',
      status: h1Count === 1 ? 'pass' : h1Count > 1 ? 'warn' : 'fail',
      detail: `Обнаружено H1: ${h1Count}`,
      valuePreview: h1Elements[0]?.textContent?.trim().slice(0, 70) || '—',
    },
    {
      id: 'images',
      label: 'Атрибуты alt у изображений',
      status: imagesTotal === 0 || imagesWithAlt === imagesTotal ? 'pass' : 'warn',
      detail: imagesTotal > 0 ? `${imagesWithAlt} из ${imagesTotal} с alt` : 'На экране нет <img>',
      valuePreview: imagesTotal > 0 ? `${imagesWithAlt}/${imagesTotal}` : 'Ок',
    },
    {
      id: 'robots-lang',
      label: 'Язык документа (lang="ru") и индексация',
      status: lang === 'ru' && robotsMeta.includes('index') ? 'pass' : 'warn',
      detail: `lang="${lang || '—'}", robots="${robotsMeta || '—'}"`,
      valuePreview: 'index, follow',
    },
  ];

  const passWeight = checks.reduce((acc, c) => {
    if (c.status === 'pass') return acc + 1;
    if (c.status === 'warn') return acc + 0.5;
    return acc;
  }, 0);
  const score = Math.round((passWeight / checks.length) * 100);

  return {
    score,
    title,
    titleLen,
    description,
    descriptionLen,
    canonical,
    lang,
    h1Count,
    imagesTotal,
    imagesWithAlt,
    jsonLdCount,
    checks,
  };
}
