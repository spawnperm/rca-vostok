import {
  SECTION_SUBTABS,
  SIDEBAR_NAV,
  TOP_NAV,
} from './navigationManifest.ts';
import {
  PUBLIC_SITEMAP_ROUTES,
  SECTION_SEO_MAP,
  buildRouteUrl,
  type SiteTabId,
} from './seo.ts';

export type SitemapEntrySource = 'top-nav' | 'top-nav-alias' | 'sidebar' | 'subtab';

export interface SitemapEntry {
  tab: SiteTabId;
  subTab?: string;
  label: string;
  source: SitemapEntrySource;
  pathQuery: string;
  loc: string;
  lastmod: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
  priority: string;
}

export interface SitemapGenerationOptions {
  baseUrl?: string;
  lastmod?: string;
  includeSubTabs?: boolean;
}

export interface SitemapGenerationResult {
  baseUrl: string;
  lastmod: string;
  entries: SitemapEntry[];
  sectionCount: number;
  subSectionCount: number;
  xml: string;
}

export const DEFAULT_PRODUCTION_SITE_URL = 'https://rca-vostok.ru';

const ROUTE_META_BY_TAB = new Map(
  PUBLIC_SITEMAP_ROUTES.map((route) => [route.tab, route] as const)
);

export function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function resolveSitemapBaseUrl(explicitBaseUrl?: string): string {
  const candidates = [explicitBaseUrl, process.env.APP_URL, DEFAULT_PRODUCTION_SITE_URL];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const trimmed = candidate.trim();
    if (!trimmed || trimmed === 'MY_APP_URL') continue;
    if (/^https?:\/\/[^/]+/i.test(trimmed)) {
      return trimmed.replace(/\/+$/, '');
    }
  }
  return DEFAULT_PRODUCTION_SITE_URL;
}

function deriveSubTabPriority(parentPriority: string, override?: string): string {
  if (override) return override;
  const parsed = Number.parseFloat(parentPriority);
  if (!Number.isFinite(parsed)) return '0.7';
  return Math.max(0.5, parsed - 0.1).toFixed(1);
}

function buildEntryUrl(baseUrl: string, tab: SiteTabId, subTab?: string): { pathQuery: string; loc: string } {
  const built = buildRouteUrl('/', tab, subTab);
  const pathQuery = built === '/' ? '' : built.slice(1);
  return {
    pathQuery,
    loc: pathQuery ? `${baseUrl}/${pathQuery}` : `${baseUrl}/`,
  };
}

/**
 * Automatically collects all indexable sections and sub-sections from
 * `TOP_NAV`, `SIDEBAR_NAV`, and `SECTION_SUBTABS` while omitting private routes.
 */
export function buildSitemapEntries(options: SitemapGenerationOptions = {}): SitemapEntry[] {
  const baseUrl = resolveSitemapBaseUrl(options.baseUrl);
  const lastmod = options.lastmod ?? new Date().toISOString().split('T')[0];
  const includeSubTabs = options.includeSubTabs ?? true;

  const entries: SitemapEntry[] = [];
  const seenUrls = new Set<string>();
  const nonIndexableTabs = new Set<SiteTabId>(
    SIDEBAR_NAV.filter((item) => item.indexable === false).map((item) => item.id)
  );

  const pushEntry = (
    tab: SiteTabId,
    label: string,
    source: SitemapEntrySource,
    priority: string,
    changefreq: 'daily' | 'weekly' | 'monthly',
    subTab?: string
  ) => {
    if (nonIndexableTabs.has(tab)) return;
    const { pathQuery, loc } = buildEntryUrl(baseUrl, tab, subTab);
    if (seenUrls.has(loc)) return;
    seenUrls.add(loc);
    entries.push({
      tab,
      ...(subTab ? { subTab } : {}),
      label,
      source,
      pathQuery,
      loc,
      lastmod,
      changefreq,
      priority,
    });
  };

  const registerSectionWithSubTabs = (
    tab: SiteTabId,
    label: string,
    source: SitemapEntrySource,
    defaultPriority: string
  ) => {
    if (nonIndexableTabs.has(tab)) return;
    const seoRoute = ROUTE_META_BY_TAB.get(tab);
    const parentPriority = seoRoute?.priority ?? defaultPriority;
    const parentFreq = seoRoute?.changefreq ?? 'weekly';

    pushEntry(tab, label, source, parentPriority, parentFreq);

    if (!includeSubTabs || source === 'top-nav-alias') {
      return;
    }

    const subTabs = SECTION_SUBTABS[tab] ?? [];
    for (const sub of subTabs) {
      if (sub.isDefault) continue;
      pushEntry(
        tab,
        `${label} · ${sub.label}`,
        'subtab',
        deriveSubTabPriority(parentPriority, sub.priority),
        sub.changefreq ?? parentFreq,
        sub.id
      );
    }
  };

  // 1. Primary top navigation and its route aliases
  for (const item of TOP_NAV) {
    registerSectionWithSubTabs(item.id, item.label, 'top-nav', item.id === 'home' ? '1.0' : '0.9');
    if (item.matches) {
      for (const aliasTab of item.matches) {
        if (aliasTab === item.id) continue;
        const aliasLabel = SECTION_SEO_MAP[aliasTab]?.name ?? item.label;
        registerSectionWithSubTabs(aliasTab, aliasLabel, 'top-nav-alias', '0.8');
      }
    }
  }

  // 2. Analytical platform sidebar navigation
  for (const item of SIDEBAR_NAV) {
    if (item.indexable === false) continue;
    registerSectionWithSubTabs(item.id, item.label, 'sidebar', '0.8');
  }

  return entries;
}

export function renderSitemapXml(entries: readonly SitemapEntry[]): string {
  const urlsXml = entries
    .map(
      (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${escapeXml(entry.lastmod)}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>\n`;
}

export function generateSitemap(options: SitemapGenerationOptions = {}): SitemapGenerationResult {
  const baseUrl = resolveSitemapBaseUrl(options.baseUrl);
  const lastmod = options.lastmod ?? new Date().toISOString().split('T')[0];
  const entries = buildSitemapEntries({ ...options, baseUrl, lastmod });
  const subSectionCount = entries.filter((e) => e.source === 'subtab').length;
  const sectionCount = entries.length - subSectionCount;

  return {
    baseUrl,
    lastmod,
    entries,
    sectionCount,
    subSectionCount,
    xml: renderSitemapXml(entries),
  };
}

export function buildRobotsTxt(baseUrl?: string): string {
  const resolved = resolveSitemapBaseUrl(baseUrl);
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    `Sitemap: ${resolved}/sitemap.xml`,
    '',
  ].join('\n');
}
