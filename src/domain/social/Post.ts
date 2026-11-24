import { InvariantViolationError, ValidationError } from '../shared/DomainError.ts';
import { SanitizedText } from '../shared/ValueObjects.ts';

/**
 * A feed post can be a short update, a long-form blog article, or a news item.
 *
 * `news` is a first-class kind rather than a tag because news is surfaced on the
 * public landing page: it needs its own validation rules (a headline is
 * mandatory) and its own query, and a tag could be mistyped silently.
 */
export const POST_KINDS = ['update', 'article', 'news'] as const;
export type PostKind = (typeof POST_KINDS)[number];

export const POST_VISIBILITIES = ['public', 'community'] as const;
export type PostVisibility = (typeof POST_VISIBILITIES)[number];

export interface PostDTO {
  id: string;
  authorId: string;
  authorName: string;
  kind: PostKind;
  title: string;
  body: string;
  excerpt: string;
  coverAssetId: string | null;
  tags: string[];
  visibility: PostVisibility;
  status: 'draft' | 'published' | 'removed';
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface CreatePostInput {
  authorId: string;
  authorName: string;
  kind?: unknown;
  title?: unknown;
  body: unknown;
  coverAssetId?: unknown;
  tags?: unknown;
  visibility?: unknown;
  /** Publishing immediately is the default for the in-feed composer. */
  publish?: unknown;
}

export const POST_MAX_BODY = 20000;
export const ARTICLE_MAX_BODY = 60000;

/**
 * Aggregate root for the community feed and blog.
 *
 * A long-form article requires a title; a short update does not. The excerpt is
 * derived from the body so the feed never has to load full articles.
 */
export class Post {
  readonly id: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly kind: PostKind;
  readonly title: string;
  readonly body: string;
  readonly excerpt: string;
  readonly coverAssetId: string | null;
  readonly tags: readonly string[];
  readonly visibility: PostVisibility;
  readonly status: 'draft' | 'published' | 'removed';
  readonly likeCount: number;
  readonly commentCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt: string | null;

  private constructor(props: {
    id: string;
    authorId: string;
    authorName: string;
    kind: PostKind;
    title: string;
    body: string;
    excerpt: string;
    coverAssetId: string | null;
    tags: readonly string[];
    visibility: PostVisibility;
    status: 'draft' | 'published' | 'removed';
    likeCount: number;
    commentCount: number;
    createdAt: string;
    updatedAt: string;
    publishedAt: string | null;
  }) {
    this.id = props.id;
    this.authorId = props.authorId;
    this.authorName = props.authorName;
    this.kind = props.kind;
    this.title = props.title;
    this.body = props.body;
    this.excerpt = props.excerpt;
    this.coverAssetId = props.coverAssetId;
    this.tags = props.tags;
    this.visibility = props.visibility;
    this.status = props.status;
    this.likeCount = props.likeCount;
    this.commentCount = props.commentCount;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.publishedAt = props.publishedAt;
  }

  static create(input: CreatePostInput): Post {
    const kind = Post.isKind(input.kind) ? input.kind : 'update';
    const isArticle = kind === 'article';
    const isNews = kind === 'news';

    const rawBody = SanitizedText.sanitizeRaw(
      input.body,
      isArticle ? ARTICLE_MAX_BODY : POST_MAX_BODY
    );

    // News is a short announcement, so the floor is higher than a feed update
    // but far below an article; the figure is what makes a headline useful.
    const minBody = isArticle ? 200 : isNews ? 40 : 2;
    if (rawBody.replace(/\s+/g, '').length < minBody) {
      throw new ValidationError(
        isArticle
          ? 'Статья должна содержать не менее 200 символов.'
          : isNews
            ? 'Новость должна содержать не менее 40 символов.'
            : 'Запись слишком короткая.'
      );
    }

    // Articles and news are addressable content, so they need a heading.
    const rawTitle = SanitizedText.sanitizeRaw(input.title, 200);
    if ((isArticle || isNews) && rawTitle.length < 3) {
      throw new ValidationError(
        isArticle
          ? 'Для статьи обязателен заголовок (не менее 3 символов).'
          : 'Для новости обязателен заголовок (не менее 3 символов).'
      );
    }

    // Count distinct valid tags BEFORE truncation: normalizeTags caps the
    // result at 8, so checking afterwards would make this rule unreachable.
    const distinctTags = Post.distinctTags(input.tags);
    if (distinctTags.length > 8) {
      throw new ValidationError('Допускается не более 8 тегов.');
    }
    const tags = distinctTags.slice(0, 8);

    const now = new Date().toISOString();
    const shouldPublish = input.publish !== false;

    return new Post({
      id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      authorId: input.authorId,
      authorName: SanitizedText.sanitizeRaw(input.authorName, 120) || 'Участник',
      kind,
      title: rawTitle,
      body: rawBody,
      excerpt: Post.buildExcerpt(rawBody, isArticle ? 260 : 180),
      coverAssetId:
        SanitizedText.sanitizeRaw(input.coverAssetId, 64) || null,
      tags,
      visibility: Post.isVisibility(input.visibility) ? input.visibility : 'community',
      status: shouldPublish ? 'published' : 'draft',
      likeCount: 0,
      commentCount: 0,
      createdAt: now,
      updatedAt: now,
      publishedAt: shouldPublish ? now : null,
    });
  }

  private static isKind(value: unknown): value is PostKind {
    return typeof value === 'string' && (POST_KINDS as readonly string[]).includes(value);
  }

  private static isVisibility(value: unknown): value is PostVisibility {
    return (
      typeof value === 'string' && (POST_VISIBILITIES as readonly string[]).includes(value)
    );
  }

  /** "#туризм Приморье" -> ["туризм", "Приморье"] without duplicates. */
  private static distinctTags(input: unknown): string[] {
    if (!Array.isArray(input)) return [];
    const seen = new Set<string>();
    for (const raw of input) {
      const tag = SanitizedText.sanitizeRaw(raw, 32).replace(/^#/, '');
      if (tag) seen.add(tag.toLowerCase());
    }
    return [...seen];
  }

  /** Kept for the edit path, which enforces the cap inline. */
  private static normalizeTags(input: unknown): string[] {
    return Post.distinctTags(input).slice(0, 8);
  }

  private static buildExcerpt(body: string, max: number): string {
    const flat = body.replace(/\s+/g, ' ').trim();
    return flat.length <= max ? flat : `${flat.slice(0, max).trimEnd()}…`;
  }

  static rehydrate(props: {
    id: string;
    authorId: string;
    authorName: string;
    kind: string;
    title: string;
    body: string;
    excerpt: string;
    coverAssetId: string | null;
    tags: string[];
    visibility: string;
    status: string;
    likeCount: number;
    commentCount: number;
    createdAt: string;
    updatedAt: string;
    publishedAt: string | null;
  }): Post {
    return new Post({
      id: props.id,
      authorId: props.authorId,
      authorName: props.authorName,
      kind: Post.isKind(props.kind) ? props.kind : 'update',
      title: props.title,
      body: props.body,
      excerpt: props.excerpt,
      coverAssetId: props.coverAssetId,
      tags: props.tags,
      visibility: Post.isVisibility(props.visibility) ? props.visibility : 'community',
      status:
        props.status === 'draft' || props.status === 'removed' ? props.status : 'published',
      likeCount: props.likeCount,
      commentCount: props.commentCount,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      publishedAt: props.publishedAt,
    });
  }

  /** Authoring rules: only the author may edit, and removal is soft. */
  assertAuthoredBy(userId: string): void {
    if (this.authorId !== userId) {
      throw new InvariantViolationError(
        'Изменять запись может только её автор.',
        'FORBIDDEN'
      );
    }
  }

  edit(input: { title?: unknown; body?: unknown; tags?: unknown; publish?: unknown }): Post {
    if (this.status === 'removed') {
      throw new InvariantViolationError('Запись удалена и не может быть изменена.');
    }

    const isArticle = this.kind === 'article';
    const isNews = this.kind === 'news';
    const body =
      input.body === undefined
        ? this.body
        : SanitizedText.sanitizeRaw(
            input.body,
            isArticle ? ARTICLE_MAX_BODY : POST_MAX_BODY
          );

    const minBody = isArticle ? 200 : isNews ? 40 : 2;
    if (body.replace(/\s+/g, '').length < minBody) {
      throw new ValidationError(
        isArticle
          ? 'Статья должна содержать не менее 200 символов.'
          : isNews
            ? 'Новость должна содержать не менее 40 символов.'
            : 'Запись слишком короткая.'
      );
    }

    const title =
      input.title === undefined ? this.title : SanitizedText.sanitizeRaw(input.title, 200);
    if ((isArticle || isNews) && title.length < 3) {
      throw new ValidationError(
        isArticle
          ? 'Для статьи обязателен заголовок (не менее 3 символов).'
          : 'Для новости обязателен заголовок (не менее 3 символов).'
      );
    }

    const now = new Date().toISOString();
    let status: 'draft' | 'published' | 'removed' = this.status;
    let publishedAt = this.publishedAt;
    if (input.publish === true) {
      status = 'published';
      publishedAt = this.publishedAt ?? now;
    } else if (input.publish === false) {
      status = 'draft';
      publishedAt = null;
    }

    return new Post({
      id: this.id,
      authorId: this.authorId,
      authorName: this.authorName,
      kind: this.kind,
      title,
      body,
      excerpt: Post.buildExcerpt(body, isArticle ? 260 : 180),
      coverAssetId: this.coverAssetId,
      tags: input.tags === undefined ? this.tags : Post.normalizeTags(input.tags),
      visibility: this.visibility,
      status,
      likeCount: this.likeCount,
      commentCount: this.commentCount,
      createdAt: this.createdAt,
      updatedAt: now,
      publishedAt,
    });
  }

  withCounts(likeCount: number, commentCount: number): Post {
    return new Post({
      id: this.id,
      authorId: this.authorId,
      authorName: this.authorName,
      kind: this.kind,
      title: this.title,
      body: this.body,
      excerpt: this.excerpt,
      coverAssetId: this.coverAssetId,
      tags: this.tags,
      visibility: this.visibility,
      status: this.status,
      likeCount,
      commentCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      publishedAt: this.publishedAt,
    });
  }

  toDTO(): PostDTO {
    return {
      id: this.id,
      authorId: this.authorId,
      authorName: this.authorName,
      kind: this.kind,
      title: this.title,
      body: this.body,
      excerpt: this.excerpt,
      coverAssetId: this.coverAssetId,
      tags: [...this.tags],
      visibility: this.visibility,
      status: this.status,
      likeCount: this.likeCount,
      commentCount: this.commentCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      publishedAt: this.publishedAt,
    };
  }
}

export interface CommentDTO {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export class Comment {
  readonly id: string;
  readonly postId: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly body: string;
  readonly createdAt: string;

  private constructor(props: {
    id: string;
    postId: string;
    authorId: string;
    authorName: string;
    body: string;
    createdAt: string;
  }) {
    this.id = props.id;
    this.postId = props.postId;
    this.authorId = props.authorId;
    this.authorName = props.authorName;
    this.body = props.body;
    this.createdAt = props.createdAt;
  }

  static create(input: {
    postId: string;
    authorId: string;
    authorName: string;
    body: unknown;
  }): Comment {
    const body = SanitizedText.create(input.body, {
      fieldLabel: 'Комментарий',
      minLen: 1,
      maxLen: 2000,
    });

    return new Comment({
      id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      postId: input.postId,
      authorId: input.authorId,
      authorName: SanitizedText.sanitizeRaw(input.authorName, 120) || 'Участник',
      body: body.value,
      createdAt: new Date().toISOString(),
    });
  }

  static rehydrate(props: {
    id: string;
    postId: string;
    authorId: string;
    authorName: string;
    body: string;
    createdAt: string;
  }): Comment {
    return new Comment(props);
  }

  toDTO(): CommentDTO {
    return {
      id: this.id,
      postId: this.postId,
      authorId: this.authorId,
      authorName: this.authorName,
      body: this.body,
      createdAt: this.createdAt,
    };
  }
}
