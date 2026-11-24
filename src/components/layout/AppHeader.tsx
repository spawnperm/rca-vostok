import React from 'react';
import { Bell, Menu, UserRound, X } from 'lucide-react';
import type { NavigateOptions, SiteTabId } from '../../utils/seo';
import {
  TOP_NAV,
  isTopNavActive,
  prefetchModal,
  prefetchSection,
} from './navigationConfig';

interface AppHeaderProps {
  activeTab: SiteTabId;
  notificationsOpen: boolean;
  mobileSidebarOpen: boolean;
  onNavigate: (tab: SiteTabId, options?: NavigateOptions) => void;
  onOpenNotifications: () => void;
  onToggleMobileSidebar: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeTab,
  notificationsOpen,
  mobileSidebarOpen,
  onNavigate,
  onOpenNotifications,
  onToggleMobileSidebar,
}) => {
  return (
    <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between gap-6">
        <button
          type="button"
          onClick={() => onNavigate('home')}
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
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(item.id)}
                onMouseEnter={() => prefetchSection(item.id)}
                onFocus={() => prefetchSection(item.id)}
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
            onClick={onOpenNotifications}
            onMouseEnter={() => prefetchModal('notifications')}
            onFocus={() => prefetchModal('notifications')}
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
            onClick={() => onNavigate('account')}
            onMouseEnter={() => prefetchSection('account')}
            onFocus={() => prefetchSection('account')}
            aria-label="Личный кабинет"
            aria-current={activeTab === 'account' ? 'page' : undefined}
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
            onClick={onToggleMobileSidebar}
            aria-label={mobileSidebarOpen ? 'Закрыть меню платформы' : 'Открыть меню платформы'}
            aria-expanded={mobileSidebarOpen}
            aria-controls="mobile-platform-drawer"
            className="lg:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            {mobileSidebarOpen ? (
              <X className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Landing navigation on narrow screens */}
      <nav
        aria-label="Разделы сайта на мобильном экране"
        className="lg:hidden border-t border-slate-200 bg-white px-4 py-2 overflow-x-auto"
      >
        <div className="flex items-center gap-5">
          {TOP_NAV.map((item) => {
            const active = isTopNavActive(item, activeTab);
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(item.id)}
                className={`py-1.5 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                  active ? 'text-teal-800 border-teal-700' : 'text-slate-600 border-transparent'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
};
