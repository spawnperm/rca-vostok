import React, { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { OverviewSection } from './components/OverviewSection';
import { CalculatorSection } from './components/CalculatorSection';
import { MarketSection } from './components/MarketSection';
import { DissertationSection } from './components/DissertationSection';
import { PresentationsSection } from './components/PresentationsSection';
import { AnalyticsSection } from './components/AnalyticsSection';
import { applySectionSeo, SECTION_SEO_MAP, type SiteTabId } from './utils/seo';
import { tracker } from './utils/tracker';

const NAV_ITEMS: { id: SiteTabId; label: string }[] = [
  { id: 'overview', label: 'Обзор центра' },
  { id: 'calculator', label: 'Калькулятор' },
  { id: 'market', label: 'Рынок ДФО' },
  { id: 'dissertation', label: 'Диссертация' },
  { id: 'analytics', label: 'SEO и аналитика' },
];

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
  return 'overview';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<SiteTabId>(getInitialTab);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

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
    setMobileMenuOpen(false);
    tracker.trackTabChange(tab, SECTION_SEO_MAP[tab].name);

    const nextUrl =
      tab === 'overview'
        ? window.location.pathname
        : `${window.location.pathname}?tab=${tab}`;
    window.history.pushState({ tab }, '', nextUrl);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 1-row, 3-zone Top Bar Contract */}
      <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-[1240px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => navigateTo('overview')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            РЦА «Русский Восток»
          </button>

          {/* Zone 2: 5 concise single-line text nav links */}
          <nav aria-label="Основная навигация" className="hidden md:flex items-center gap-6">
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
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

          {/* Zone 3: 1 primary action + mobile menu button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigateTo('presentations')}
              className={`hidden sm:inline-flex px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                activeTab === 'presentations'
                  ? 'bg-teal-700 text-white hover:bg-teal-800'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              Режим защиты
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
              className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-6 py-4 space-y-2">
            {[...NAV_ITEMS, { id: 'presentations' as SiteTabId, label: 'Презентации (Режим защиты)' }].map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.id)}
                  className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active ? 'bg-teal-50 text-teal-800 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1240px] w-full mx-auto px-6 py-10">
        {activeTab === 'overview' && <OverviewSection onNavigate={navigateTo} />}
        {activeTab === 'calculator' && <CalculatorSection />}
        {activeTab === 'market' && <MarketSection />}
        {activeTab === 'dissertation' && <DissertationSection />}
        {activeTab === 'presentations' && <PresentationsSection />}
        {activeTab === 'analytics' && <AnalyticsSection />}
      </main>

      {/* Quiet Institutional Footer */}
      <footer className="no-print border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1240px] mx-auto px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            РЦА Приморского края «Русский Восток» · База: ВВГУ и Федерация спортивного туризма России
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
              SEO и статистика
            </button>
            <span aria-hidden="true">·</span>
            <span>Специальность ВАК 5.2.3 (область 4.15)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
