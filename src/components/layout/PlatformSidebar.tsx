import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, GitBranch, X } from 'lucide-react';
import type { NavigateOptions, SiteTabId } from '../../utils/seo';
import { tracker } from '../../utils/tracker';
import { SIDEBAR_NAV, prefetchModal, prefetchSection } from './navigationConfig';

interface PlatformSidebarProps {
  activeTab: SiteTabId;
  sidebarOpen: boolean;
  mobileSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onCloseMobileSidebar: () => void;
  onNavigate: (tab: SiteTabId, options?: NavigateOptions) => void;
  onOpenGitSync: (source: 'sidebar' | 'mobile_drawer') => void;
}

export const PlatformSidebar: React.FC<PlatformSidebarProps> = ({
  activeTab,
  sidebarOpen,
  mobileSidebarOpen,
  onToggleSidebar,
  onCloseMobileSidebar,
  onNavigate,
  onOpenGitSync,
}) => {
  const drawerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const previousFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const firstBtn = drawerRef.current?.querySelector<HTMLElement>('button:not([disabled])');
      firstBtn?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseMobileSidebar();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocused?.focus?.();
    };
  }, [mobileSidebarOpen, onCloseMobileSidebar]);

  return (
    <>
      {/* Desktop right sidebar: analytical platform */}
      <aside
        aria-label="Навигация аналитической платформы"
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
              onClick={onToggleSidebar}
              aria-expanded={sidebarOpen}
              aria-label={sidebarOpen ? 'Свернуть меню' : 'Развернуть меню'}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              {sidebarOpen ? (
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
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
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onNavigate(item.id)}
                  onMouseEnter={() => prefetchSection(item.id)}
                  onFocus={() => prefetchSection(item.id)}
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
                onOpenGitSync('sidebar');
                tracker.trackCustomInteraction('Открытие синхронизации Git', 'sidebar');
              }}
              onMouseEnter={() => prefetchModal('gitSync')}
              onFocus={() => prefetchModal('gitSync')}
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

      {/* Platform navigation drawer for small screens */}
      {mobileSidebarOpen && (
        <div
          id="mobile-platform-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-platform-drawer-title"
          className="lg:hidden fixed inset-0 z-40"
        >
          <button
            type="button"
            aria-label="Закрыть меню"
            onClick={onCloseMobileSidebar}
            className="absolute inset-0 bg-slate-900/40"
          />
          <nav
            ref={drawerRef}
            aria-label="Разделы платформы"
            className="absolute right-0 top-0 h-full w-72 bg-white shadow-xl p-4 space-y-1 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-2">
              <h2
                id="mobile-platform-drawer-title"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Платформа
              </h2>
              <button
                type="button"
                onClick={onCloseMobileSidebar}
                aria-label="Закрыть"
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            {SIDEBAR_NAV.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onNavigate(item.id)}
                  onMouseEnter={() => prefetchSection(item.id)}
                  onFocus={() => prefetchSection(item.id)}
                  className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
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
                  onCloseMobileSidebar();
                  onOpenGitSync('mobile_drawer');
                  tracker.trackCustomInteraction('Открытие синхронизации Git', 'mobile_drawer');
                }}
                className="w-full inline-flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <GitBranch className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                <span>Отправить в main</span>
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
};
