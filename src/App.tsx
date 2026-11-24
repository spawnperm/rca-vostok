import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  Compass,
  GitBranch,
  HelpCircle,
  Menu,
  UserRound,
  X,
} from 'lucide-react';
import { Breadcrumbs } from './components/Breadcrumbs';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GitSyncModal } from './components/GitSyncModal';
import { NotificationsModal } from './components/NotificationsModal';
import { RcaAssistantChatWidget } from './components/RcaAssistantChatWidget';
import {
  CertificationSection,
  ConsultingSection,
  ContactsSection,
  HelpAndContactsWorkspace,
  LandingHero,
  LearningSection,
} from './components/landing/LandingSections';
import { RoutesAndNewsWorkspace } from './components/landing/NewsAndRoutes';
import { applySectionSeo, SECTION_SEO_MAP, type SiteTabId } from './utils/seo';
import { tracker } from './utils/tracker';

function lazyWithReload<T>(
  factory: () => Promise<T>,
  key: string
): () => Promise<T> {
  return async () => {
    try {
      return await factory();
    } catch (err) {
      const flag = `chunk-reload:${key}`;
      if (!sessionStorage.getItem(flag)) {
        sessionStorage.setItem(flag, '1');
        window.location.reload();
        return new Promise<T>(() => {});
      }
      sessionStorage.removeItem(flag);
      throw err;
    }
  };
}

const OverviewSection = lazy(
  lazyWithReload(
    () => import('./components/OverviewSection').then((m) => ({ default: m.OverviewSection })),
    'OverviewSection'
  )
);
const CalculatorSection = lazy(
  lazyWithReload(
    () => import('./components/CalculatorSection').then((m) => ({ default: m.CalculatorSection })),
    'CalculatorSection'
  )
);
const MarketSection = lazy(
  lazyWithReload(
    () => import('./components/MarketSection').then((m) => ({ default: m.MarketSection })),
    'MarketSection'
  )
);
const DissertationSection = lazy(
  lazyWithReload(
    () =>
      import('./components/DissertationSection').then((m) => ({
        default: m.DissertationSection,
      })),
    'DissertationSection'
  )
);
const PresentationsSection = lazy(
  lazyWithReload(
    () =>
      import('./components/PresentationsSection').then((m) => ({
        default: m.PresentationsSection,
      })),
    'PresentationsSection'
  )
);
const AnalyticsSection = lazy(
  lazyWithReload(
    () => import('./components/AnalyticsSection').then((m) => ({ default: m.AnalyticsSection })),
    'AnalyticsSection'
  )
);
const AccountSection = lazy(
  lazyWithReload(
    () => import('./components/AccountSection').then((m) => ({ default: m.AccountSection })),
    'AccountSection'
  )
);

/** Placeholder shown while a lazy section is being fetched. */
function SectionFallback({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-white border border-slate-200 rounded-xl p-8 space-y-3"
    >
      <span className="sr-only">Загрузка раздела «{label}»</span>
      <div className="h-4 w-40 bg-slate-100 rounded animate-pulse" aria-hidden="true" />
      <div className="h-3 w-full bg-slate-100 rounded animate-pulse" aria-hidden="true" />
      <div className="h-3 w-5/6 bg-slate-100 rounded animate-pulse" aria-hidden="true" />
      <p className="text-xs text-slate-500 pt-2">Загружаем «{label}»…</p>
    </div>
  );
}

/** Concise 5-item primary navigation matching the consolidated site structure. */
const TOP_NAV: readonly { id: SiteTabId; label: string; matches?: readonly SiteTabId[] }[] = [
  { id: 'home', label: 'Главная' },
  { id: 'learning', label: 'Обучение', matches: ['learning', 'preparation'] },
  { id: 'certification', label: 'Аттестация' },
  { id: 'routes', label: 'Маршруты', matches: ['routes', 'news'] },
  { id: 'faq', label: 'FAQ и связь', matches: ['faq', 'consulting', 'contacts'] },
];

const SIDEBAR_NAV: readonly { id: SiteTabId; label: string }[] = [
  { id: 'overview', label: 'Обзор центра' },
  { id: 'calculator', label: 'Калькулятор' },
  { id: 'market', label: 'Рынок ДФО' },
  { id: 'dissertation', label: 'Диссертация' },
  { id: 'presentations', label: 'Презентации' },
  { id: 'analytics', label: 'Аналитика и SEO' },
  { id: 'account', label: 'Личный кабинет' },
];

function isTopNavActive(item: (typeof TOP_NAV)[number], activeTab: SiteTabId): boolean {
  if (item.matches) {
    return item.matches.includes(activeTab);
  }
  return activeTab === item.id;
}

function getInitialTab(): SiteTabId {
  try {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab') as SiteTabId | null;
    if (t && t in SECTION_SEO_MAP) {
      return t;
    }
  } catch {
    // fallback
  }
  return 'home';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<SiteTabId>(getInitialTab);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [gitSyncOpen, setGitSyncOpen] = useState<boolean>(false);
  const [gitBearerToken, setGitBearerToken] = useState<string | null>(null);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState<boolean>(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  useEffect(() => {
    const cleanup = tracker.init(activeTab);
    return cleanup;
    // Run once on mount with initial tab
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applySectionSeo(activeTab);
  }, [activeTab]);

  useEffect(() => {
    const onPopState = () => {
      const next = getInitialTab();
      setActiveTab(next);
      tracker.trackTabChange(next, SECTION_SEO_MAP[next].name);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = (tab: SiteTabId) => {
    setActiveTab(tab);
    setMobileSidebarOpen(false);
    tracker.trackTabChange(tab, SECTION_SEO_MAP[tab].name);

    const nextUrl =
      tab === 'home' ? window.location.pathname : `${window.location.pathname}?tab=${tab}`;
    window.history.pushState({ tab }, '', nextUrl);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** Jumps to an anchor inside the landing hub. */
  const scrollToSection = (id: string) => {
    if (activeTab !== 'home') {
      setActiveTab('home');
      window.history.pushState({ tab: 'home' }, '', window.location.pathname);
    }
    window.setTimeout(() => {
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (id in SECTION_SEO_MAP) {
        navigateTo(id as SiteTabId);
      }
    }, 60);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top bar: strict 3-zone layout (Brand | 5 primary links | utility actions) */}
      <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={() => navigateTo('home')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            РЦА «Русский Восток»
          </button>

          <nav aria-label="Разделы сайта" className="hidden lg:flex items-center gap-6">
            {TOP_NAV.map((item) => {
              const active = isTopNavActive(item, activeTab);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.id)}
                  className={`py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 ${
                    active
                      ? 'text-teal-800 border-teal-700'
                      : 'text-slate-600 border-transparent hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen(true);
                tracker.trackCustomInteraction('Открытие окна уведомлений', 'header');
              }}
              aria-label="Уведомления"
              aria-haspopup="dialog"
              aria-expanded={notificationsOpen}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                notificationsOpen
                  ? 'bg-teal-50 border-teal-300 text-teal-800'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Bell className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Уведомления</span>
            </button>

            <button
              type="button"
              onClick={() => navigateTo('account')}
              aria-label="Личный кабинет"
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                activeTab === 'account'
                  ? 'bg-teal-50 border-teal-300 text-teal-800'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <UserRound className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Кабинет</span>
            </button>

            {/* Sidebar toggle doubles as the platform menu on small screens. */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen((o) => !o)}
              aria-label={mobileSidebarOpen ? 'Закрыть меню платформы' : 'Открыть меню платформы'}
              aria-expanded={mobileSidebarOpen}
              className="lg:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Landing navigation on narrow screens */}
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-2 overflow-x-auto">
          <div className="flex items-center gap-5">
            {TOP_NAV.map((item) => {
              const active = isTopNavActive(item, activeTab);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.id)}
                  className={`py-1.5 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                    active
                      ? 'text-teal-800 border-teal-700'
                      : 'text-slate-600 border-transparent'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <Breadcrumbs activeTab={activeTab} onNavigate={navigateTo} />

      {/* Body: content + right-hand platform sidebar */}
      <div className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 pt-6 pb-8 flex gap-6">
        <main className="flex-1 min-w-0">
          {mapsQuotaExceeded && (
            <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2.5 rounded-xl text-xs">
              Интерактивный слой Google Maps временно переключён в резервный режим из-за квоты API;
              доступны картографические слои ДФО и Приморья без потери данных.
            </div>
          )}

          <ErrorBoundary onReset={() => navigateTo('home')}>
            {activeTab === 'home' && (
              <div className="space-y-14">
                <LandingHero onNavigate={scrollToSection} onNavigateTab={navigateTo} />

                <div className="space-y-4">
                  <LearningSection compact />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => navigateTo('learning')}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:text-teal-950 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>Открыть тренажёр экзамена ФСТР, библиотеку и глоссарий</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <CertificationSection compact />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => navigateTo('certification')}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:text-teal-950 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>Календарь комиссий ДФО, карта площадок и реестр ФСТР</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <ConsultingSection />

                {/* Quick portal directory for Routes, FAQ, and Analytical Platform */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => navigateTo('routes')}
                    className="text-left bg-white border border-slate-200 rounded-xl p-5 space-y-2 hover:border-teal-300 transition-colors cursor-pointer"
                  >
                    <Compass className="w-5 h-5 text-teal-700" aria-hidden="true" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Маршруты и новости отрасли
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Обеспеченность проводниками по 8 округам Приморья, сезонность и обновления
                      НПА.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateTo('faq')}
                    className="text-left bg-white border border-slate-200 rounded-xl p-5 space-y-2 hover:border-teal-300 transition-colors cursor-pointer"
                  >
                    <HelpCircle className="w-5 h-5 text-teal-700" aria-hidden="true" />
                    <h3 className="text-sm font-bold text-slate-900">Частые вопросы (FAQ)</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Порядок допуска, зачёт стажа (Контур А), стоимость ДПО ВВГУ и экспорт
                      справочника в PDF.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateTo('overview')}
                    className="text-left bg-slate-900 text-white border border-slate-900 rounded-xl p-5 space-y-2 hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <BarChart3 className="w-5 h-5 text-teal-300" aria-hidden="true" />
                    <h3 className="text-sm font-bold">Аналитическая платформа ДФО</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Модель дефицита кадров до 2030 года, геоаналитика, смета и диссертация ВАК
                      5.2.3.
                    </p>
                  </button>
                </section>

                <ContactsSection />
              </div>
            )}

            {activeTab === 'learning' && <LearningSection />}
            {activeTab === 'preparation' && <LearningSection initialSubTab="exam" />}
            {activeTab === 'certification' && <CertificationSection />}
            {activeTab === 'routes' && <RoutesAndNewsWorkspace initialSubTab="routes" />}
            {activeTab === 'news' && <RoutesAndNewsWorkspace initialSubTab="news" />}
            {activeTab === 'faq' && (
              <HelpAndContactsWorkspace initialSubTab="faq" onNavigateTab={navigateTo} />
            )}
            {activeTab === 'consulting' && (
              <HelpAndContactsWorkspace initialSubTab="consulting" onNavigateTab={navigateTo} />
            )}
            {activeTab === 'contacts' && (
              <HelpAndContactsWorkspace initialSubTab="contacts" onNavigateTab={navigateTo} />
            )}

            {/* Lazy analytical platform sections */}
            <Suspense fallback={<SectionFallback label={SECTION_SEO_MAP[activeTab].name} />}>
              {activeTab === 'overview' && <OverviewSection onNavigate={navigateTo} />}
              {activeTab === 'calculator' && <CalculatorSection />}
              {activeTab === 'market' && <MarketSection />}
              {activeTab === 'dissertation' && <DissertationSection />}
              {activeTab === 'presentations' && <PresentationsSection />}
              {activeTab === 'analytics' && <AnalyticsSection />}
              {activeTab === 'account' && (
                <AccountSection
                  onNavigate={navigateTo}
                  onOpenGitSync={() => setGitSyncOpen(true)}
                />
              )}
            </Suspense>
          </ErrorBoundary>
        </main>

        {/* Right sidebar: analytical platform */}
        <aside
          className={`no-print shrink-0 transition-all duration-200 ${
            sidebarOpen ? 'w-60' : 'w-12'
          } hidden lg:block`}
        >
          <div className="sticky top-24">
            <div className="flex items-center justify-between mb-3">
              {sidebarOpen && (
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Платформа
                </h2>
              )}
              <button
                type="button"
                onClick={() => setSidebarOpen((o) => !o)}
                aria-label={sidebarOpen ? 'Свернуть меню' : 'Развернуть меню'}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
              >
                {sidebarOpen ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </button>
            </div>

            <nav aria-label="Разделы платформы" className="space-y-0.5">
              {SIDEBAR_NAV.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo(item.id)}
                    title={!sidebarOpen ? item.label : undefined}
                    className={`block w-full text-left rounded-lg text-sm transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                      sidebarOpen ? 'px-3 py-2' : 'px-2 py-2 text-center'
                    } ${
                      active
                        ? 'bg-teal-50 text-teal-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {sidebarOpen ? item.label : item.label.slice(0, 1)}
                  </button>
                );
              })}
            </nav>

            <div className="mt-4 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setGitSyncOpen(true);
                  tracker.trackCustomInteraction('Открытие синхронизации Git', 'sidebar');
                }}
                title={!sidebarOpen ? 'Отправить в main (Git)' : undefined}
                className={`w-full inline-flex items-center gap-2 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                  sidebarOpen ? 'px-3 py-2 justify-start' : 'px-2 py-2 justify-center'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                {sidebarOpen && <span>Отправить в main</span>}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Platform navigation drawer for small screens */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Закрыть меню"
            onClick={() => setMobileSidebarOpen(false)}
            className="absolute inset-0 bg-slate-900/40"
          />
          <nav
            aria-label="Разделы платформы"
            className="absolute right-0 top-0 h-full w-72 bg-white shadow-xl p-4 space-y-1 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Платформа
              </h2>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Закрыть"
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {SIDEBAR_NAV.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.id)}
                  className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-teal-50 text-teal-900 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            <div className="pt-3 mt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setMobileSidebarOpen(false);
                  setGitSyncOpen(true);
                  tracker.trackCustomInteraction('Открытие синхронизации Git', 'mobile_drawer');
                }}
                className="w-full inline-flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <GitBranch className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                <span>Отправить в main</span>
              </button>
            </div>
          </nav>
        </div>
      )}

      <footer className="no-print border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1400px] mx-auto px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            РЦА Приморского края «Русский Восток» · База: ВВГУ и Федерация спортивного туризма
            России
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="https://rca-vostok.ru/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 transition-colors"
            >
              rca-vostok.ru
            </a>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => navigateTo('analytics')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Аналитика, SEO и API
            </button>
            <span aria-hidden="true">·</span>
            <span>Специальность ВАК 5.2.3 (область 4.15)</span>
          </div>
        </div>
      </footer>

      <NotificationsModal
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onNavigate={navigateTo}
      />

      <GitSyncModal
        open={gitSyncOpen}
        onClose={() => setGitSyncOpen(false)}
        bearerToken={gitBearerToken}
        onTokenChange={setGitBearerToken}
      />

      <RcaAssistantChatWidget activeTab={activeTab} />
    </div>
  );
}
