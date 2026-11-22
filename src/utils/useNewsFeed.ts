import { useCallback, useEffect, useState } from 'react';

/**
 * Feed post as returned by /api/social/feed.
 *
 * The landing page reuses the community feed instead of maintaining a second
 * content store: a `news` post published from the cabinet appears on the public
 * site immediately, with no deploy.
 */
export interface NewsPost {
  id: string;
  authorName: string;
  title: string;
  body: string;
  excerpt: string;
  tags: string[];
  createdAt: string;
  publishedAt: string | null;
  status: 'draft' | 'published' | 'removed';
}

interface FeedResponse {
  posts: Array<{
    id: string;
    authorName: string;
    kind: string;
    title: string;
    body: string;
    excerpt: string;
    tags: string[];
    createdAt: string;
    publishedAt: string | null;
    status: NewsPost['status'];
  }>;
  total: number;
}

export interface NewsFeedState {
  news: NewsPost[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Loads published news for the public landing page.
 *
 * Deliberately silent on failure: the landing page must render even when the
 * API is unreachable, so a network error degrades to an empty list rather than
 * breaking the section.
 */
export function useNewsFeed(limit = 6): NewsFeedState {
  const [news, setNews] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState<number>(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/social/feed?kind=news&limit=${limit}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as FeedResponse;
      })
      .then((data) => {
        if (cancelled) return;
        setNews(
          data.posts
            .filter((p) => p.status === 'published')
            .map((p) => ({
              id: p.id,
              authorName: p.authorName,
              title: p.title,
              body: p.body,
              excerpt: p.excerpt,
              tags: p.tags,
              createdAt: p.createdAt,
              publishedAt: p.publishedAt,
              status: p.status,
            }))
        );
        setError(null);
      })
      .catch(() => {
        if (!cancelled) {
          // Degrade quietly: the static industry news below still renders.
          setNews([]);
          setError(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [limit, nonce]);

  return { news, loading, error, reload };
}
