import React, { useCallback, useEffect, useState } from 'react';
import {
  Heart,
  MessageCircle,
  PenLine,
  Send,
  Tag,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import {
  SocialApiError,
  socialApi,
  type FeedPost,
  type PostComment,
  type PostKind,
} from '../../utils/socialApi';

interface FeedComposerProps {
  onPublished: (post: FeedPost) => void;
  canPublish: boolean;
}

/**
 * In-feed composer.
 *
 * The same component publishes both short updates and long-form blog articles;
 * `kind` switches the validation rules server-side (an article requires a
 * title and at least 200 characters).
 */
function FeedComposer({ onPublished, canPublish }: FeedComposerProps) {
  const [kind, setKind] = useState<PostKind>('update');
  const [title, setTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [tagInput, setTagInput] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!canPublish) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-sm text-slate-600">
        Войдите в личный кабинет, чтобы публиковать записи и статьи.
      </div>
    );
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    // Mirrors the domain floors: an article needs 200 characters, a news item
    // 40, and a plain update just a few words.
    const minBody = kind === 'article' ? 200 : kind === 'news' ? 40 : 2;
    if (body.trim().length < minBody) {
      setError(
        kind === 'article'
          ? 'Статья должна содержать не менее 200 символов.'
          : kind === 'news'
            ? 'Новость должна содержать не менее 40 символов.'
            : 'Напишите хотя бы несколько слов.'
      );
      return;
    }
    if ((kind === 'article' || kind === 'news') && title.trim().length < 3) {
      setError(kind === 'article' ? 'Для статьи нужен заголовок.' : 'Для новости нужен заголовок.');
      return;
    }

    setBusy(true);
    try {
      const tags = tagInput
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#/, '').trim())
        .filter(Boolean);

      const post = await socialApi.createPost({
        kind,
        title: kind === 'article' || kind === 'news' ? title.trim() : undefined,
        body: body.trim(),
        tags,
      });
      onPublished(post);
      setTitle('');
      setBody('');
      setTagInput('');
      setKind('update');
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось опубликовать запись.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        {(['update', 'article', 'news'] as PostKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              kind === k
                ? 'bg-teal-50 border-teal-300 text-teal-800'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {k === 'update' ? 'Запись' : k === 'article' ? 'Статья в блог' : 'Новость на сайт'}
          </button>
        ))}
      </div>

      {kind === 'news' && (
        <p className="text-[11px] text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
          Новость сразу появится на публичной странице в разделе «Новости».
        </p>
      )}

      {(kind === 'article' || kind === 'news') && (
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === 'article' ? 'Заголовок статьи' : 'Заголовок новости'}
          className="w-full px-3 py-2.5 text-sm font-medium border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
        />
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={kind === 'article' ? 10 : 3}
        placeholder={
          kind === 'article'
            ? 'Текст статьи: методика, маршрут, наблюдения…'
            : 'Чем поделитесь с сообществом?'
        }
        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 resize-y"
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
          <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="теги через запятую"
            className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-teal-600 focus:outline-none"
          />
        </div>

        <span className="text-[11px] text-slate-400 tabular-nums">
          {body.length} {kind === 'article' ? '/ 60000' : '/ 20000'}
        </span>

        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-60 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" aria-hidden="true" />
          {busy ? 'Публикуем…' : 'Опубликовать'}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </form>
  );
}

function PostCard({
  post,
  canInteract,
  onOpen,
}: {
  post: FeedPost;
  canInteract: boolean;
  onOpen: (post: FeedPost) => void;
}) {
  const [liked, setLiked] = useState<boolean>(false);
  const [likeCount, setLikeCount] = useState<number>(post.likeCount);
  const [busy, setBusy] = useState<boolean>(false);

  const like = async () => {
    if (!canInteract || busy) return;
    setBusy(true);
    try {
      const res = await socialApi.toggleLike(post.id);
      setLiked(res.liked);
      setLikeCount(res.count);
    } catch {
      // A failed like must not break the feed.
    } finally {
      setBusy(false);
    }
  };

  const published = post.publishedAt ? new Date(post.publishedAt) : new Date(post.createdAt);

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{post.authorName}</p>
          <p className="text-xs text-slate-500">
            {published.toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            {post.kind === 'article' && (
              <span className="ml-2 inline-flex items-center gap-1 text-teal-700 font-medium">
                <PenLine className="w-3 h-3" aria-hidden="true" />
                статья
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpen(post)}
          className="text-xs font-semibold text-teal-700 hover:text-teal-900 shrink-0 cursor-pointer"
        >
          Читать
        </button>
      </div>

      {post.kind === 'article' && post.title && (
        <h3 className="text-base font-bold text-slate-900 leading-snug">{post.title}</h3>
      )}

      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
        {post.kind === 'article' ? post.excerpt : post.body}
      </p>

      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] rounded"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 pt-1 border-t border-slate-100">
        <button
          type="button"
          onClick={like}
          disabled={!canInteract}
          aria-pressed={liked}
          className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer ${
            liked ? 'text-red-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} aria-hidden="true" />
          {likeCount}
        </button>

        <button
          type="button"
          onClick={() => onOpen(post)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
        >
          <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
          {post.commentCount}
        </button>
      </div>
    </article>
  );
}

function PostDetail({
  post,
  canInteract,
  onClose,
}: {
  post: FeedPost;
  canInteract: boolean;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [draft, setDraft] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    socialApi
      .getPost(post.id)
      .then((res) => {
        if (!cancelled) setComments(res.comments);
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить комментарии.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [post.id]);

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draft.trim().length === 0) return;
    setError(null);
    try {
      const comment = await socialApi.addComment(post.id, draft.trim());
      setComments((prev) => [...prev, comment]);
      setDraft('');
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось отправить комментарий.');
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/40 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="bg-white rounded-xl border border-slate-200 w-full max-w-3xl my-8">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-200">
          <div>
            {post.kind === 'article' && (
              <h2 className="text-lg font-bold text-slate-900">{post.title}</h2>
            )}
            <p className="text-xs text-slate-500">
              {post.authorName} ·{' '}
              {new Date(post.publishedAt ?? post.createdAt).toLocaleDateString('ru-RU')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">{post.body}</p>

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] rounded">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Комментарии ({comments.length})
            </h3>

            {loading && <p className="text-sm text-slate-500">Загружаем…</p>}

            {!loading && comments.length === 0 && (
              <p className="text-sm text-slate-500">Пока нет комментариев.</p>
            )}

            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-900">{c.authorName}</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{c.body}</p>
                </li>
              ))}
            </ul>

            {canInteract ? (
              <form onSubmit={send} className="flex items-start gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  placeholder="Ваш комментарий"
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  Отправить
                </button>
              </form>
            ) : (
              <p className="text-xs text-slate-500">Войдите, чтобы комментировать.</p>
            )}

            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeedSection({ canInteract }: { canInteract: boolean }) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'article'>('all');
  const [openPost, setOpenPost] = useState<FeedPost | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await socialApi.feed({
        kind: filter === 'article' ? 'article' : undefined,
        limit: 20,
      });
      setPosts(res.posts);
      setError(null);
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось загрузить ленту.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
              filter === 'all'
                ? 'bg-teal-50 border-teal-300 text-teal-800'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            Вся лента
          </button>
          <button
            type="button"
            onClick={() => setFilter('article')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
              filter === 'article'
                ? 'bg-teal-50 border-teal-300 text-teal-800'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            Блог
          </button>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          Обновить
        </button>
      </div>

      <FeedComposer
        canPublish={canInteract}
        onPublished={(post) => setPosts((prev) => [post, ...prev])}
      />

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading && <p className="text-sm text-slate-500">Загружаем ленту…</p>}

      {!loading && posts.length === 0 && (
        <div className="text-center py-12 text-slate-500 space-y-2">
          <ImageIcon className="w-8 h-8 mx-auto text-slate-300" aria-hidden="true" />
          <p className="text-sm">Пока нет публикаций. Станьте первым автором.</p>
        </div>
      )}

      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            canInteract={canInteract}
            onOpen={setOpenPost}
          />
        ))}
      </div>

      {openPost && (
        <PostDetail
          post={openPost}
          canInteract={canInteract}
          onClose={() => setOpenPost(null)}
        />
      )}
    </div>
  );
}
