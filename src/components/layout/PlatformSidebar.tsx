import React, { useEffect, useRef } from 'react';
import {
  BookOpen,
  Calculator,
  ChartLine,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  LayoutDashboard,
  Map,
  Presentation,
  UserRound,
  X,
} from 'lucide-react';
import type { NavigateOptions, SiteTabId } from '../../utils/seo';
import { tracker } from '../../utils/tracker';
import { SIDEBAR_NAV, SIDEBAR_NAV_GROUPS, prefetchModal, prefetchSection } from './navigationConfig';
import type { SidebarNavItem } from './navigationConfig';

interface PlatformSidebarProps {
  activeTab: SiteTabId;
  sidebarOpen: boolean;
  mobileSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onCloseMobileSidebar: () => void;
  onNavigate: (tab: SiteTabId, options?: NavigateOptions) => void;
  onOpenGitSync: (source: 'sidebar' | 'mobile_drawer') => void;
}


/** Maps a manifest icon name to its component. Kept here so navigationConfig stays data-only. */
const SIDEBAR_ICONS: Record<string, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  LayoutDashboard,
  ChartLine,
  Map,
  Calculator,
  Presentation,
  BookOpen,
  UserRound,
};

function resolveIcon(name?: string) {
  return name ? SIDEBAR_ICONS[name] ?? LayoutDashboard : LayoutDashboard;
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
        <div className="sticky top-24 bg-slate-900 border border-slate-800 rounded-xl p-2 shadow-lg flex max-h-[calc(100vh-8rem)] flex-col">
          <div className="flex items-center justify-between mb-2 px-1">
            {sidebarOpen && (
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Платформа
              </h2>
            )}
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-expanded={sidebarOpen}
              aria-label={sidebarOpen ? 'Свернуть меню' : 'Развернуть меню'}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              {sidebarOpen ? (
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>

          <nav aria-label="Разделы платформы" className="flex-1 overflow-y-auto">
            {SIDEBAR_NAV_GROUPS.map((group, groupIndex) => (
              <div key={group.id} className={groupIndex === 0 ? '' : 'mt-5'}>
                {/* Band label, as on the mvr rail. Hidden when collapsed, where
                    the icons plus tooltips carry the meaning instead. */}
                {sidebarOpen ? (
                  <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {group.label}
                  </p>
                ) : (
                  <div className="my-2 mx-2 border-t border-slate-700/60" aria-hidden="true" />
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = activeTab === item.id;
                    const Icon = resolveIcon(item.icon);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={active ? 'page' : undefined}
                        onClick={() => onNavigate(item.id)}
                        onMouseEnter={() => prefetchSection(item.id)}
                        onFocus={() => prefetchSection(item.id)}
                        title={!sidebarOpen ? `${item.label}${item.hint ? ` — ${item.hint}` : ''}` : item.hint}
                        className={`w-full inline-flex items-center rounded-lg text-sm transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 ${
                          sidebarOpen ? 'gap-2.5 px-3 py-2' : 'justify-center px-0 py-2'
                        } ${
                          active
                            ? 'bg-teal-500/15 text-teal-100 font-semibold ring-1 ring-inset ring-teal-400/30'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${active ? 'text-teal-300' : 'text-slate-400'}`}
                          aria-hidden={true}
                        />
                        {sidebarOpen && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                onOpenGitSync('sidebar');
                tracker.trackCustomInteraction('Открытие синхронизации Git', 'sidebar');
              }}
              onMouseEnter={() => prefetchModal('gitSync')}
              onFocus={() => prefetchModal('gitSync')}
              title={!sidebarOpen ? 'Отправить в main (Git)' : undefined}
              className={`w-full inline-flex items-center gap-2 rounded-lg text-xs font-semibold border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                sidebarOpen ? 'px-3 py-2 justify-start' : 'px-2 py-2 justify-center'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5 text-teal-300 shrink-0" aria-hidden="true" />
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
