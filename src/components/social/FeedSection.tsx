import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  FileEdit,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Newspaper,
  Pencil,
  PenLine,
  Send,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  SocialApiError,
  socialApi,
  type FeedPost,
  type PostComment,
  type PostKind,
} from '../../utils/socialApi';

type FeedFilter = 'all' | 'article' | 'news' | 'mine';

interface FeedComposerProps {
  onPublished: (post: FeedPost) => void;
  canPublish: boolean;
  canPublishNews: boolean;
}

/**
 * In-feed composer & CMS authoring block.
 *
 * Publishes short updates, long-form blog articles, and (for curators/admins)
 * public site news, either immediately or saved as a private CMS draft.
 */
function FeedComposer({ onPublished, canPublish, canPublishNews }: FeedComposerProps) {
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

  const submit = async (publish: boolean) => {
    setError(null);

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
        publish,
      });
      onPublished(post);
      setTitle('');
      setBody('');
      setTagInput('');
      setKind('update');
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось сохранить публикацию.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit(true);
      }}
      className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        {(canPublishNews
          ? (['update', 'article', 'news'] as PostKind[])
          : (['update', 'article'] as PostKind[])
        ).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
          Опубликованная новость сразу появится на публичной странице в разделе «Новости». Черновик виден только вам.
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
        rows={kind === 'article' ? 8 : 3}
        placeholder={
          kind === 'article'
            ? 'Текст статьи: методика, маршрут, наблюдения… (от 200 символов)'
            : kind === 'news'
              ? 'Текст официальной новости для главной страницы… (от 40 символов)'
              : 'Чем поделитесь с сообществом?'
        }
        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 resize-y"
      />

      <div className="flex flex-wrap items-center gap-2.5">
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
          type="button"
          disabled={busy}
          onClick={() => void submit(false)}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <FileEdit className="w-3.5 h-3.5" aria-hidden="true" />
          <span>В черновик</span>
        </button>

        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{busy ? 'Сохраняем…' : 'Опубликовать'}</span>
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
  canEdit,
  canDelete,
  onOpen,
  onUpdated,
  onDeleted,
  onSelectAuthor,
}: {
  post: FeedPost;
  canInteract: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onOpen: (post: FeedPost) => void;
  onUpdated: (post: FeedPost) => void;
  onDeleted: (postId: string) => void;
  onSelectAuthor?: (userId: string) => void;
}) {
  const [liked, setLiked] = useState<boolean>(false);
  const [likeCount, setLikeCount] = useState<number>(post.likeCount);
  const [busy, setBusy] = useState<boolean>(false);
  const [editing, setEditing] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>(post.title);
  const [editBody, setEditBody] = useState<string>(post.body);
  const [editTags, setEditTags] = useState<string>(post.tags.join(', '));
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    setLikeCount(post.likeCount);
  }, [post.likeCount]);

  const like = async () => {
    if (!canInteract || busy || post.status !== 'published') return;
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

  const saveEdit = async (publish?: boolean) => {
    setBusy(true);
    setEditError(null);
    try {
      const tags = editTags
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#/, '').trim())
        .filter(Boolean);
      const updated = await socialApi.updatePost(post.id, {
        title: post.kind === 'article' || post.kind === 'news' ? editTitle.trim() : undefined,
        body: editBody.trim(),
        tags,
        ...(publish !== undefined ? { publish } : {}),
      });
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof SocialApiError ? err.message : 'Не удалось обновить запись.');
    } finally {
      setBusy(false);
    }
  };

  const quickPublish = async () => {
    setBusy(true);
    setEditError(null);
    try {
      const updated = await socialApi.updatePost(post.id, { publish: true });
      onUpdated(updated);
    } catch (err) {
      setEditError(err instanceof SocialApiError ? err.message : 'Не удалось опубликовать.');
    } finally {
      setBusy(false);
    }
  };

  const performDelete = async () => {
    setBusy(true);
    setEditError(null);
    try {
      await socialApi.deletePost(post.id);
      onDeleted(post.id);
    } catch (err) {
      setEditError(err instanceof SocialApiError ? err.message : 'Не удалось удалить запись.');
      setBusy(false);
    }
  };

  const published = post.publishedAt ? new Date(post.publishedAt) : new Date(post.createdAt);
  const isLongKind = post.kind === 'article' || post.kind === 'news';

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {onSelectAuthor ? (
            <button
              type="button"
              onClick={() => onSelectAuthor(post.authorId)}
              className="text-sm font-semibold text-slate-900 hover:text-teal-700 truncate cursor-pointer"
            >
              {post.authorName}
            </button>
          ) : (
            <p className="text-sm font-semibold text-slate-900 truncate">{post.authorName}</p>
          )}
          <p className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2">
            <span>
              {published.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            {post.kind === 'article' && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-teal-700 font-medium">
                  <PenLine className="w-3 h-3" aria-hidden="true" />
                  статья
                </span>
              </>
            )}
            {post.kind === 'news' && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-teal-800 font-semibold">
                  <Newspaper className="w-3 h-3" aria-hidden="true" />
                  новость сайта
                </span>
              </>
            )}
            {post.status === 'draft' && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-700 font-semibold">черновик CMS</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {post.status === 'draft' && canEdit && !editing && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void quickPublish()}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-700 text-white text-xs font-semibold rounded-md hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Check className="w-3 h-3" aria-hidden="true" />
              Опубликовать
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpen(post)}
            className="text-xs font-semibold text-teal-700 hover:text-teal-900 shrink-0 cursor-pointer"
          >
            Читать
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2.5 pt-1">
          {isLongKind && (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Заголовок"
              className="w-full px-3 py-2 text-sm font-medium border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
            />
          )}
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={isLongKind ? 6 : 3}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none resize-y"
          />
          <input
            value={editTags}
            onChange={(e) => setEditTags(e.target.value)}
            placeholder="теги через запятую"
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-teal-600 focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveEdit()}
              className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              Сохранить
            </button>
            {post.status === 'draft' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveEdit(true)}
                className="px-3 py-1.5 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 disabled:opacity-50 cursor-pointer"
              >
                Сохранить и опубликовать
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setEditTitle(post.title);
                setEditBody(post.body);
                setEditTags(post.tags.join(', '));
                setEditError(null);
              }}
              className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Отмена
            </button>
          </div>
          {editError && <p className="text-xs text-red-700">{editError}</p>}
        </div>
      ) : (
        <>
          {isLongKind && post.title && (
            <h3 className="text-base font-bold text-slate-900 leading-snug">{post.title}</h3>
          )}

          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {isLongKind ? post.excerpt : post.body}
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

          {editError && <p className="text-xs text-red-700">{editError}</p>}
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={like}
            disabled={!canInteract || post.status !== 'published'}
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

        {(canEdit || canDelete) && !editing && (
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Редактировать</span>
              </button>
            )}
            {canDelete &&
              (confirmDelete ? (
                <span className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void performDelete()}
                    className="text-xs font-semibold text-red-700 hover:underline cursor-pointer"
                  >
                    Удалить точно?
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Отмена
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-700 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Удалить</span>
                </button>
              ))}
          </div>
        )}
      </div>
    </article>
  );
}

function PostDetail({
  post,
  canInteract,
  onCommentAdded,
  onClose,
}: {
  post: FeedPost;
  canInteract: boolean;
  onCommentAdded: (postId: string) => void;
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
      onCommentAdded(post.id);
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось отправить комментарий.');
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/40 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="bg-white rounded-xl border border-slate-200 w-full max-w-3xl my-8">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-200">
          <div>
            {(post.kind === 'article' || post.kind === 'news') && post.title && (
              <h2 className="text-lg font-bold text-slate-900">{post.title}</h2>
            )}
            <p className="text-xs text-slate-500">
              {post.authorName} ·{' '}
              {new Date(post.publishedAt ?? post.createdAt).toLocaleDateString('ru-RU')}
              {post.kind === 'news' ? ' · новость сайта' : ''}
              {post.status === 'draft' ? ' · черновик' : ''}
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

            {canInteract && post.status === 'published' ? (
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
            ) : post.status !== 'published' ? (
              <p className="text-xs text-slate-500">Комментарии откроются после публикации черновика.</p>
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

export function FeedSection({
  canInteract,
  canPublishNews = false,
  currentUserId = null,
  authorFilterUserId,
  onSelectAuthor,
  onContentMutated,
}: {
  canInteract: boolean;
  canPublishNews?: boolean;
  currentUserId?: string | null;
  authorFilterUserId?: string;
  onSelectAuthor?: (userId: string) => void;
  onContentMutated?: () => void;
}) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [openPost, setOpenPost] = useState<FeedPost | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await socialApi.feed({
        kind: filter === 'article' ? 'article' : filter === 'news' ? 'news' : undefined,
        authorId: authorFilterUserId
          ? authorFilterUserId
          : filter === 'mine' && currentUserId
            ? currentUserId
            : undefined,
        limit: 20,
      });
      setPosts(res.posts);
      setError(null);
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось загрузить ленту.');
    } finally {
      setLoading(false);
    }
  }, [authorFilterUserId, currentUserId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filterTabs: { id: FeedFilter; label: string }[] = [
    { id: 'all', label: 'Вся лента' },
    { id: 'article', label: 'Блог' },
    { id: 'news', label: 'Новости сайта' },
    ...(currentUserId && !authorFilterUserId ? [{ id: 'mine' as const, label: 'Мои и черновики' }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {filterTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border whitespace-nowrap shrink-0 cursor-pointer ${
                filter === t.id
                  ? 'bg-teal-50 border-teal-300 text-teal-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          Обновить
        </button>
      </div>

      {!authorFilterUserId && (
        <FeedComposer
          canPublish={canInteract}
          canPublishNews={canPublishNews}
          onPublished={(post) => {
            if (post.status === 'published' || filter === 'mine') {
              setPosts((prev) => [post, ...prev]);
            } else {
              setFilter('mine');
            }
            onContentMutated?.();
          }}
        />
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading && <p className="text-sm text-slate-500">Загружаем ленту…</p>}

      {!loading && posts.length === 0 && (
        <div className="text-center py-12 text-slate-500 space-y-2 border border-dashed border-slate-200 rounded-xl">
          <ImageIcon className="w-8 h-8 mx-auto text-slate-300" aria-hidden="true" />
          <p className="text-sm">Пока нет публикаций в выбранной категории.</p>
        </div>
      )}

      <div className="space-y-4">
        {posts.map((post) => {
          const isAuthor = Boolean(currentUserId) && post.authorId === currentUserId;
          // News edits always require moderator permission server-side.
          const canEditPost =
            post.kind === 'news'
              ? canPublishNews
              : isAuthor || canPublishNews;
          const canDeletePost = isAuthor || canPublishNews;

          return (
            <PostCard
              key={post.id}
              post={post}
              canInteract={canInteract}
              canEdit={canEditPost}
              canDelete={canDeletePost}
              onOpen={setOpenPost}
              onSelectAuthor={onSelectAuthor}
              onUpdated={(updated) => {
                setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                onContentMutated?.();
              }}
              onDeleted={(postId) => {
                setPosts((prev) => prev.filter((p) => p.id !== postId));
                onContentMutated?.();
              }}
            />
          );
        })}
      </div>

      {openPost && (
        <PostDetail
          post={openPost}
          canInteract={canInteract}
          onCommentAdded={(postId) => {
            setPosts((prev) =>
              prev.map((p) =>
                p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p
              )
            );
          }}
          onClose={() => setOpenPost(null)}
        />
      )}
    </div>
  );
}
