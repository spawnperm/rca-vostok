import { SECTION_SEO_MAP, type SiteTabId } from './seo.ts';

export interface BreadcrumbItem {
  tab: SiteTabId;
  label: string;
  isCurrent: boolean;
  isHome?: boolean;
}

const PLATFORM_TABS = new Set<SiteTabId>([
  'overview',
  'calculator',
  'market',
  'dissertation',
  'presentations',
  'analytics',
  'account',
]);

export function buildBreadcrumbs(activeTab: SiteTabId): BreadcrumbItem[] {
  if (activeTab === 'home') {
    return [
      {
        tab: 'home',
        label: SECTION_SEO_MAP.home.name,
        isCurrent: true,
        isHome: true,
      },
    ];
  }

  const root: BreadcrumbItem = {
    tab: 'home',
    label: SECTION_SEO_MAP.home.name,
    isCurrent: false,
    isHome: true,
  };

  if (activeTab === 'overview') {
    return [
      root,
      {
        tab: 'overview',
        label: 'Платформа: Обзор центра',
        isCurrent: true,
      },
    ];
  }

  if (PLATFORM_TABS.has(activeTab)) {
    return [
      root,
      {
        tab: 'overview',
        label: 'Платформа (Обзор центра)',
        isCurrent: false,
      },
      {
        tab: activeTab,
        label: SECTION_SEO_MAP[activeTab].name,
        isCurrent: true,
      },
    ];
  }

  return [
    root,
    {
      tab: activeTab,
      label: SECTION_SEO_MAP[activeTab].name,
      isCurrent: true,
    },
  ];
}
