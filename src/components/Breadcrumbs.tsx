import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { buildBreadcrumbs } from '../utils/breadcrumbs';
import type { SiteTabId } from '../utils/seo';

interface BreadcrumbsProps {
  activeTab: SiteTabId;
  onNavigate: (tab: SiteTabId) => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ activeTab, onNavigate }) => {
  const items = buildBreadcrumbs(activeTab);

  return (
    <div className="no-print border-b border-slate-200/80 bg-white/70">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5">
        <nav aria-label="Хлебные крошки">
          <ol className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm text-slate-600">
            {items.map((item, idx) => (
              <li key={item.tab} className="inline-flex items-center gap-1.5 min-w-0">
                {idx > 0 && (
                  <ChevronRight
                    className="w-3.5 h-3.5 text-slate-400 shrink-0"
                    aria-hidden="true"
                  />
                )}
                {item.isCurrent ? (
                  <span
                    aria-current="page"
                    className="inline-flex items-center gap-1.5 font-semibold text-slate-900 truncate"
                  >
                    {item.isHome && (
                      <Home className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                    )}
                    <span>{item.label}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate(item.tab)}
                    className="inline-flex items-center gap-1.5 text-slate-600 hover:text-teal-800 hover:underline underline-offset-4 transition-colors cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  >
                    {item.isHome && (
                      <Home className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                    )}
                    <span>{item.label}</span>
                  </button>
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </div>
  );
};
