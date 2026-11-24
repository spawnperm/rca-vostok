import React, { Suspense, useEffect, useState } from 'react';
import { ArrowRight, BarChart3, Compass, HelpCircle } from 'lucide-react';
import { Breadcrumbs } from './components/Breadcrumbs';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LiveInstructorMarketWidget } from './components/LiveInstructorMarketWidget';
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
import { AppFooter } from './components/layout/AppFooter';
import { AppHeader } from './components/layout/AppHeader';
import { PlatformSidebar } from './components/layout/PlatformSidebar';
import {
  AccountSection,
  AnalyticsSection,
  CalculatorSection,
  DissertationSection,
  GitSyncModalLazy,
  MarketSection,
  NotificationsModalLazy,
  OverviewSection,
  PresentationsSection,
  prefetchSection,
} from './components/layout/navigationConfig';
import {
  applySectionSeo,
  buildRouteUrl,
  parseRouteFromSearch,
  SECTION_SEO_MAP,
  type NavigateOptions,
  type SiteTabId,
} from './utils/seo';
import { tracker } from './utils/tracker';

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

export default function App() {
  const [route, setRoute] = useState<{ tab: SiteTabId; subTab?: string }>(() =>
    parseRouteFromSearch(window.location.search)
  );
  const activeTab = route.tab;
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
      const next = parseRouteFromSearch(window.location.search);
      setRoute(next);
      tracker.trackTabChange(next.tab, SECTION_SEO_MAP[next.tab].name);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = (tab: SiteTabId, options?: NavigateOptions) => {
    const nextSubTab = options?.subTab;
    setRoute({ tab, subTab: nextSubTab });
    setMobileSidebarOpen(false);
    tracker.trackTabChange(tab, SECTION_SEO_MAP[tab].name);

    const nextUrl = buildRouteUrl(window.location.pathname, tab, nextSubTab);
    window.history.pushState({ tab, subTab: nextSubTab }, '', nextUrl);

    if (options?.anchor) {
      const targetId = options.anchor;
      let attempts = 0;
      const tryScroll = () => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        attempts += 1;
        if (attempts < 10) {
          window.setTimeout(tryScroll, 70);
        }
      };
      window.setTimeout(tryScroll, 50);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubTabChange = (subTab: string) => {
    setRoute((prev) => {
      const nextUrl = buildRouteUrl(window.location.pathname, prev.tab, subTab);
      window.history.replaceState({ tab: prev.tab, subTab }, '', nextUrl);
      return { ...prev, subTab };
    });
  };

  /** Jumps to an anchor inside the landing hub. */
  const scrollToSection = (id: string) => {
    if (activeTab !== 'home') {
      setRoute({ tab: 'home' });
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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-slate-900 focus:text-white focus:rounded-lg focus:text-xs focus:font-semibold"
      >
        Перейти к основному содержимому
      </a>

      <AppHeader
        activeTab={activeTab}
        notificationsOpen={notificationsOpen}
        mobileSidebarOpen={mobileSidebarOpen}
        onNavigate={navigateTo}
        onOpenNotifications={() => {
          setNotificationsOpen(true);
          tracker.trackCustomInteraction('Открытие окна уведомлений', 'header');
        }}
        onToggleMobileSidebar={() => setMobileSidebarOpen((o) => !o)}
      />

      <Breadcrumbs activeTab={activeTab} onNavigate={navigateTo} />

      {/* Body: content + right-hand platform sidebar */}
      <div className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 pt-6 pb-8 flex gap-6">
        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 focus:outline-none">
          {mapsQuotaExceeded && (
            <div
              role="status"
              className="mb-6 bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2.5 rounded-xl text-xs"
            >
              Интерактивный слой Google Maps временно переключён в резервный режим из-за квоты API;
              доступны картографические слои ДФО и Приморья без потери данных.
            </div>
          )}

          <ErrorBoundary onReset={() => navigateTo('home')}>
            {activeTab === 'home' && (
              <div className="space-y-14">
                <LandingHero onNavigate={scrollToSection} onNavigateTab={navigateTo} />

                <div className="space-y-4">
                  <LearningSection compact onNavigateTab={navigateTo} />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => navigateTo('learning', { subTab: 'exam' })}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:text-teal-950 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>Открыть тренажёр экзамена ФСТР, библиотеку и глоссарий</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <CertificationSection compact onNavigateTab={navigateTo} />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => navigateTo('certification', { subTab: 'calendars' })}
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
                    onMouseEnter={() => prefetchSection('overview')}
                    onFocus={() => prefetchSection('overview')}
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

                <LiveInstructorMarketWidget onNavigate={navigateTo} />

                <ContactsSection />
              </div>
            )}

            {activeTab === 'learning' && (
              <LearningSection
                initialSubTab={route.subTab}
                onNavigateTab={navigateTo}
                onSubTabChange={handleSubTabChange}
              />
            )}
            {activeTab === 'preparation' && (
              <LearningSection
                initialSubTab={route.subTab || 'exam'}
                onNavigateTab={navigateTo}
                onSubTabChange={handleSubTabChange}
              />
            )}
            {activeTab === 'certification' && (
              <CertificationSection
                initialSubTab={route.subTab}
                onNavigateTab={navigateTo}
                onSubTabChange={handleSubTabChange}
              />
            )}
            {activeTab === 'routes' && (
              <RoutesAndNewsWorkspace
                initialSubTab={route.subTab || 'routes'}
                onSubTabChange={handleSubTabChange}
              />
            )}
            {activeTab === 'news' && (
              <RoutesAndNewsWorkspace
                initialSubTab={route.subTab || 'news'}
                onSubTabChange={handleSubTabChange}
              />
            )}
            {activeTab === 'faq' && (
              <HelpAndContactsWorkspace
                initialSubTab={route.subTab || 'faq'}
                onNavigateTab={navigateTo}
                onSubTabChange={handleSubTabChange}
              />
            )}
            {activeTab === 'consulting' && (
              <HelpAndContactsWorkspace
                initialSubTab={route.subTab || 'consulting'}
                onNavigateTab={navigateTo}
                onSubTabChange={handleSubTabChange}
              />
            )}
            {activeTab === 'contacts' && (
              <HelpAndContactsWorkspace
                initialSubTab={route.subTab || 'contacts'}
                onNavigateTab={navigateTo}
                onSubTabChange={handleSubTabChange}
              />
            )}

            {/* Lazy analytical platform sections */}
            <Suspense fallback={<SectionFallback label={SECTION_SEO_MAP[activeTab].name} />}>
              {activeTab === 'overview' && (
                <OverviewSection
                  initialSubTab={route.subTab}
                  onSubTabChange={handleSubTabChange}
                  onNavigate={navigateTo}
                />
              )}
              {activeTab === 'calculator' && (
                <CalculatorSection
                  initialSubTab={route.subTab}
                  onSubTabChange={handleSubTabChange}
                />
              )}
              {activeTab === 'market' && (
                <MarketSection
                  initialSubTab={route.subTab}
                  onSubTabChange={handleSubTabChange}
                  onNavigate={navigateTo}
                />
              )}
              {activeTab === 'dissertation' && <DissertationSection />}
              {activeTab === 'presentations' && <PresentationsSection />}
              {activeTab === 'analytics' && (
                <AnalyticsSection
                  initialSubTab={route.subTab}
                  onSubTabChange={handleSubTabChange}
                />
              )}
              {activeTab === 'account' && (
                <AccountSection
                  initialSubTab={route.subTab}
                  onSubTabChange={handleSubTabChange}
                  onNavigate={navigateTo}
                  onOpenGitSync={() => setGitSyncOpen(true)}
                />
              )}
            </Suspense>
          </ErrorBoundary>
        </main>

        <PlatformSidebar
          activeTab={activeTab}
          sidebarOpen={sidebarOpen}
          mobileSidebarOpen={mobileSidebarOpen}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
          onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
          onNavigate={navigateTo}
          onOpenGitSync={() => setGitSyncOpen(true)}
        />
      </div>

      <AppFooter onNavigateAnalytics={() => navigateTo('analytics')} />

      {notificationsOpen && (
        <Suspense fallback={null}>
          <NotificationsModalLazy
            open={notificationsOpen}
            onClose={() => setNotificationsOpen(false)}
            onNavigate={navigateTo}
          />
        </Suspense>
      )}

      {gitSyncOpen && (
        <Suspense fallback={null}>
          <GitSyncModalLazy
            open={gitSyncOpen}
            onClose={() => setGitSyncOpen(false)}
            bearerToken={gitBearerToken}
            onTokenChange={setGitBearerToken}
          />
        </Suspense>
      )}

      <RcaAssistantChatWidget activeTab={activeTab} />
    </div>
  );
}
