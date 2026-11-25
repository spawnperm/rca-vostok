import type { PortalSectionId } from '../../presentation/types.ts';

export type GlobalSearchEntityType =
  | 'all'
  | 'deal'
  | 'contact'
  | 'company'
  | 'task'
  | 'document'
  | 'cms'
  | 'adr';

export interface GlobalSearchDocument {
  id: string;
  type: Exclude<GlobalSearchEntityType, 'all'>;
  title: string;
  subtitle: string;
  badge: string;
  snippet: string;
  targetSection: PortalSectionId;
  keywords: string[];
  rawText: string;
  priorityWeight: number;
  meta?: Record<string, string | number | boolean | null>;
}

export interface GlobalSearchResultItem {
  id: string;
  type: Exclude<GlobalSearchEntityType, 'all'>;
  title: string;
  subtitle: string;
  badge: string;
  snippet: string;
  highlightSnippet: string;
  relevanceScore: number;
  targetSection: PortalSectionId;
  meta?: Record<string, string | number | boolean | null>;
}

export function normalizeSearchQuery(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\w\s\u0400-\u04FF.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildHighlightedSnippet(rawText: string, tokens: string[]): string {
  const clean = rawText.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (tokens.length === 0) return clean.slice(0, 140);

  const lower = clean.toLowerCase();
  let firstPos = -1;
  for (const tok of tokens) {
    const idx = lower.indexOf(tok);
    if (idx !== -1 && (firstPos === -1 || idx < firstPos)) {
      firstPos = idx;
    }
  }

  if (firstPos === -1) {
    return clean.length > 140 ? `${clean.slice(0, 137)}...` : clean;
  }

  const start = Math.max(0, firstPos - 40);
  const end = Math.min(clean.length, firstPos + 100);
  let slice = clean.slice(start, end);
  if (start > 0) slice = `...${slice}`;
  if (end < clean.length) slice = `${slice}...`;
  return slice;
}

export function rankSearchDocuments(
  docs: GlobalSearchDocument[],
  query: string,
  filterType: GlobalSearchEntityType = 'all',
  limit: number = 24
): GlobalSearchResultItem[] {
  const normalized = normalizeSearchQuery(query);
  const pool =
    filterType === 'all' ? docs : docs.filter((doc) => doc.type === filterType);

  if (!normalized) {
    return pool
      .slice()
      .sort((a, b) => b.priorityWeight - a.priorityWeight)
      .slice(0, limit)
      .map((doc) => ({
        id: doc.id,
        type: doc.type,
        title: doc.title,
        subtitle: doc.subtitle,
        badge: doc.badge,
        snippet: doc.snippet,
        highlightSnippet: doc.snippet,
        relevanceScore: doc.priorityWeight,
        targetSection: doc.targetSection,
        meta: doc.meta,
      }));
  }

  const queryTokens = normalized.split(' ').filter((t) => t.length > 0);
  const results: GlobalSearchResultItem[] = [];

  for (const doc of pool) {
    let score = 0;
    const titleLower = doc.title.toLowerCase();
    const subtitleLower = doc.subtitle.toLowerCase();
    const rawLower = doc.rawText.toLowerCase();

    if (normalized.length > 2 && (titleLower.includes(normalized) || rawLower.includes(normalized))) {
      score += 32;
    }

    let matchedCount = 0;
    for (const token of queryTokens) {
      let matched = false;
      if (titleLower.startsWith(token)) {
        score += 20;
        matched = true;
      } else if (titleLower.includes(token)) {
        score += 13;
        matched = true;
      }

      if (doc.keywords.some((kw) => kw.toLowerCase().includes(token))) {
        score += 10;
        matched = true;
      }

      if (subtitleLower.includes(token)) {
        score += 6;
        matched = true;
      }

      if (rawLower.includes(token)) {
        score += 3;
        matched = true;
      }

      if (matched) matchedCount += 1;
    }

    if (queryTokens.length > 1 && matchedCount === queryTokens.length) {
      score += 22;
    }

    if (score > 0) {
      score += doc.priorityWeight;
      results.push({
        id: doc.id,
        type: doc.type,
        title: doc.title,
        subtitle: doc.subtitle,
        badge: doc.badge,
        snippet: doc.snippet,
        highlightSnippet: buildHighlightedSnippet(doc.rawText || doc.snippet, queryTokens),
        relevanceScore: score,
        targetSection: doc.targetSection,
        meta: doc.meta,
      });
    }
  }

  results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return results.slice(0, limit);
}
