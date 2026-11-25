import { lazy, type ComponentType } from 'react';
import {
  SECTION_SUBTABS,
  SIDEBAR_NAV,
  SIDEBAR_NAV_GROUPS,
  TOP_NAV,
  isTopNavActive,
  type SidebarNavGroup,
  type SidebarNavItem,
  type SubTabManifestEntry,
  type TopNavItem,
} from '../../utils/navigationManifest';
import type { SiteTabId } from '../../utils/seo';

export {
  SECTION_SUBTABS,
  SIDEBAR_NAV,
  SIDEBAR_NAV_GROUPS,
  TOP_NAV,
  isTopNavActive,
  type SidebarNavGroup,
  type SidebarNavItem,
  type SubTabManifestEntry,
  type TopNavItem,
};

export function lazyWithReload<T extends { default: ComponentType<any> }>(
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

const sectionImports = {
  overview: () => import('../OverviewSection').then((m) => ({ default: m.OverviewSection })),
  calculator: () => import('../CalculatorSection').then((m) => ({ default: m.CalculatorSection })),
  market: () => import('../MarketSection').then((m) => ({ default: m.MarketSection })),
  dissertation: () =>
    import('../DissertationSection').then((m) => ({ default: m.DissertationSection })),
  presentations: () =>
    import('../PresentationsSection').then((m) => ({ default: m.PresentationsSection })),
  analytics: () => import('../AnalyticsSection').then((m) => ({ default: m.AnalyticsSection })),
  account: () => import('../AccountSection').then((m) => ({ default: m.AccountSection })),
} as const;

export const OverviewSection = lazy(lazyWithReload(sectionImports.overview, 'OverviewSection'));
export const CalculatorSection = lazy(lazyWithReload(sectionImports.calculator, 'CalculatorSection'));
export const MarketSection = lazy(lazyWithReload(sectionImports.market, 'MarketSection'));
export const DissertationSection = lazy(
  lazyWithReload(sectionImports.dissertation, 'DissertationSection')
);
export const PresentationsSection = lazy(
  lazyWithReload(sectionImports.presentations, 'PresentationsSection')
);
export const AnalyticsSection = lazy(lazyWithReload(sectionImports.analytics, 'AnalyticsSection'));
export const AccountSection = lazy(lazyWithReload(sectionImports.account, 'AccountSection'));

export const NotificationsModalLazy = lazy(
  lazyWithReload(
    () => import('../NotificationsModal').then((m) => ({ default: m.NotificationsModal })),
    'NotificationsModal'
  )
);

export const GitSyncModalLazy = lazy(
  lazyWithReload(
    () => import('../GitSyncModal').then((m) => ({ default: m.GitSyncModal })),
    'GitSyncModal'
  )
);

const prefetched = new Set<string>();

/** Preloads a lazy route chunk on hover/focus without blocking rendering. */
export function prefetchSection(tab: SiteTabId): void {
  if (prefetched.has(tab)) return;
  const loader = (sectionImports as Record<string, (() => Promise<unknown>) | undefined>)[tab];
  if (!loader) return;
  prefetched.add(tab);
  void loader().catch(() => {
    prefetched.delete(tab);
  });
}

export function prefetchModal(kind: 'notifications' | 'gitSync'): void {
  const key = `modal:${kind}`;
  if (prefetched.has(key)) return;
  prefetched.add(key);
  const promise =
    kind === 'notifications'
      ? import('../NotificationsModal')
      : import('../GitSyncModal');
  void promise.catch(() => {
    prefetched.delete(key);
  });
}
