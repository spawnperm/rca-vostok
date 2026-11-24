import React from 'react';
import { prefetchSection } from './navigationConfig';

interface AppFooterProps {
  onNavigateAnalytics: () => void;
}

export const AppFooter: React.FC<AppFooterProps> = ({ onNavigateAnalytics }) => {
  return (
    <footer className="no-print border-t border-slate-200 bg-white mt-12">
      <div className="max-w-[1400px] mx-auto px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
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
            onClick={onNavigateAnalytics}
            onMouseEnter={() => prefetchSection('analytics')}
            onFocus={() => prefetchSection('analytics')}
            className="hover:text-slate-900 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            Аналитика, SEO и API
          </button>
          <span aria-hidden="true">·</span>
          <span>Специальность ВАК 5.2.3 (область 4.15)</span>
        </div>
      </div>
    </footer>
  );
};
