import { z } from 'zod';
import { Comment, Post } from '../../domain/social/Post.ts';
import { SocialProfile } from '../../domain/social/SocialProfile.ts';
import type { Permission } from '../../domain/identity/Rbac.ts';
import { PERMISSIONS } from '../../domain/identity/Rbac.ts';
import type { Role } from '../../domain/identity/Rbac.ts';
import type { User } from '../../domain/identity/User.ts';
import { NotFoundError, ValidationError, type DomainEventBus } from '../../domain/shared/DomainError.ts';
import type { SocialRepository } from '../../domain/social/SocialRepository.ts';
import type { UserRepository } from '../../domain/identity/IdentityRepositories.ts';

/**
 * Zod schemas validate the HTTP boundary before the domain sees anything.
 *
 * The domain keeps its own invariants (password policy, title requirements),
 * so these schemas only coerce and bound shapes — they are the first line, not
 * the only one. Keeping them in the application layer means the router stays a
 * thin adapter and every endpoint is documented from one place (see OpenAPI).
 */

export const createPostSchema = z.object({
  kind: z.enum(['update', 'article']).optional(),
  title: z.string().max(200).optional(),
  body: z.string().min(1, 'Текст не может быть пустым').max(60000),
  coverAssetId: z.string().max(64).optional().nullable(),
  tags: z.array(z.string().max(32)).max(8).optional(),
  visibility: z.enum(['public', 'community']).optional(),
  publish: z.boolean().optional(),
});

export const updatePostSchema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().min(1).max(60000).optional(),
  tags: z.array(z.string().max(32)).max(8).optional(),
});

export const feedQuerySchema = z.object({
  authorId: z.string().max(64).optional(),
  kind: z.enum(['update', 'article']).optional(),
  tag: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const socialProfileSchema = z.object({
  headline: z.string().max(140).optional(),
  bio: z.string().max(1200).optional(),
  websiteUrl: z.string().max(200).optional(),
  coverAssetId: z.string().max(64).nullable().optional(),
  avatarAssetId: z.string().max(64).nullable().optional(),
  skills: z.array(z.string().max(40)).max(12).optional(),
});

/** Converts a ZodError into the project's ValidationError with readable text. */
export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join('.') || 'запрос';
    throw new ValidationError(`Некорректное поле «${path}»: ${first?.message ?? 'ошибка'}`);
  }
  return result.data;
}

/** Ensures the profile row exists, creating it lazily from identity data. */
async function ensureProfile(
  social: SocialRepository,
  user: User
): Promise<SocialProfile> {
  const existing = await social.findProfile(user.id);
  if (existing) return existing;

  const created = SocialProfile.createDefault({
    userId: user.id,
    displayName: user.fullName.value,
    region: user.region,
    organisation: user.organisation,
    role: user.role,
  });
  await social.saveProfile(created);
  return created;
}

export class GetSocialProfileUseCase {

  private readonly social: SocialRepository;
  private readonly users: UserRepository;

  constructor(social: SocialRepository, users: UserRepository) {
    this.social = social;
    this.users = users;
  }

  async execute(
    actor: User | null,
    targetUserId: string
  ): Promise<ReturnType<SocialProfile['toDTO']>> {
    const target = await this.users.findById(targetUserId);
    if (!target) {
      throw new NotFoundError('Пользователь не найден.');
    }

    const profile = await ensureProfile(this.social, target);

    const [followerCount, followingCount, postCount, albumCount] = await Promise.all([
      this.social.countFollowers(targetUserId),
      this.social.countFollowing(targetUserId),
      this.social.countPostsByAuthor(targetUserId),
      // Album count is owned by the media context; the profile shows posts only
      // here and the media tab loads its own counter.
      Promise.resolve(0),
    ]);

    const isFollowedByMe = actor
      ? await this.social.isFollowing(actor.id, targetUserId)
      : false;

    return profile.toDTO({
      followerCount,
      followingCount,
      postCount,
      albumCount,
      isFollowedByMe,
    });
  }
}

export class UpdateSocialProfileUseCase {

  private readonly social: SocialRepository;
  private readonly users: UserRepository;
  private readonly eventBus: DomainEventBus;

  constructor(social: SocialRepository, users: UserRepository, eventBus: DomainEventBus) {
    this.social = social;
    this.users = users;
    this.eventBus = eventBus;
  }

  async execute(actor: User, rawInput: unknown): Promise<ReturnType<SocialProfile['toDTO']>> {
    actor.assertCan(PERMISSIONS.EDIT_OWN_PROFILE);

    const input = parseOrThrow(socialProfileSchema, rawInput ?? {});
    const current = await ensureProfile(this.social, actor);
    const updated = current.update(input);
    await this.social.saveProfile(updated);

    this.eventBus.publish({
      eventName: 'social.profile_updated',
      occurredAt: new Date().toISOString(),
      boundedContext: 'identity',
      payload: { userId: actor.id },
    });

    return updated.toDTO({
      followerCount: await this.social.countFollowers(actor.id),
      followingCount: await this.social.countFollowing(actor.id),
      postCount: await this.social.countPostsByAuthor(actor.id),
      albumCount: 0,
      isFollowedByMe: false,
    });
  }
}

export class CreatePostUseCase {

  private readonly social: SocialRepository;
  private readonly eventBus: DomainEventBus;

  constructor(social: SocialRepository, eventBus: DomainEventBus) {
    this.social = social;
    this.eventBus = eventBus;
  }

  async execute(actor: User, rawInput: unknown): Promise<ReturnType<Post['toDTO']>> {
    actor.assertCan(PERMISSIONS.PUBLISH_POST);
    const input = parseOrThrow(createPostSchema, rawInput);

    const post = Post.create({
      authorId: actor.id,
      authorName: actor.fullName.value,
      kind: input.kind,
      title: input.title,
      body: input.body,
      coverAssetId: input.coverAssetId,
      tags: input.tags,
      visibility: input.visibility,
      publish: input.publish,
    });

    await this.social.savePost(post);

    if (post.status === 'published') {
      await this.social.recordActivity({
        id: `act-${post.id}`,
        type: 'post',
        actorId: actor.id,
        actorName: actor.fullName.value,
        summary:
          post.kind === 'article'
            ? `Опубликована статья «${post.title}»`
            : 'Опубликована запись в ленте',
        targetId: post.id,
        createdAt: post.createdAt,
      });
    }

    this.eventBus.publish({
      eventName: 'social.post_published',
      occurredAt: post.createdAt,
      boundedContext: 'identity',
      payload: { postId: post.id, authorId: actor.id, kind: post.kind },
    });

    return post.toDTO();
  }
}

export class UpdatePostUseCase {
  private readonly social: SocialRepository;

  constructor(social: SocialRepository) {
    this.social = social;
  }

  async execute(actor: User, postId: string, rawInput: unknown): Promise<ReturnType<Post['toDTO']>> {
    const post = await this.social.findPost(postId);
    if (!post) throw new NotFoundError('Запись не найдена.');

    // Authors edit their own content; moderators may edit anything.
    if (post.authorId !== actor.id) {
      actor.assertCan(PERMISSIONS.MODERATE_CONTENT);
    } else {
      actor.assertCan(PERMISSIONS.PUBLISH_POST);
    }

    const input = parseOrThrow(updatePostSchema, rawInput);
    const updated = post.edit(input);
    await this.social.savePost(updated);
    return updated.toDTO();
  }
}

export class DeletePostUseCase {
  private readonly social: SocialRepository;

  constructor(social: SocialRepository) {
    this.social = social;
  }

  async execute(actor: User, postId: string): Promise<{ ok: true }> {
    const post = await this.social.findPost(postId);
    if (!post) throw new NotFoundError('Запись не найдена.');

    if (post.authorId !== actor.id) {
      actor.assertCan(PERMISSIONS.MODERATE_CONTENT);
    }

    await this.social.deletePost(postId);
    return { ok: true };
  }
}

export class ListFeedUseCase {
  private readonly social: SocialRepository;

  constructor(social: SocialRepository) {
    this.social = social;
  }

  async execute(rawQuery: unknown, viewer: User | null): Promise<{
    posts: ReturnType<Post['toDTO']>[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const query = parseOrThrow(feedQuerySchema, rawQuery ?? {});
    const includeUnpublished = Boolean(
      viewer && query.authorId && query.authorId === viewer.id
    );

    const { posts, total } = await this.social.listPosts({
      authorId: query.authorId,
      kind: query.kind,
      tag: query.tag,
      limit: query.limit,
      offset: query.offset,
      includeUnpublished,
    });

    return {
      posts: posts.map((p) => p.toDTO()),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }
}

export class GetPostUseCase {
  private readonly social: SocialRepository;

  constructor(social: SocialRepository) {
    this.social = social;
  }

  async execute(postId: string): Promise<{
    post: ReturnType<Post['toDTO']>;
    comments: ReturnType<Comment['toDTO']>[];
  }> {
    const post = await this.social.findPost(postId);
    if (!post || post.status === 'removed') {
      throw new NotFoundError('Запись не найдена.');
    }

    const comments = await this.social.listComments(postId);
    return { post: post.toDTO(), comments: comments.map((c) => c.toDTO()) };
  }
}

export class AddCommentUseCase {

  private readonly social: SocialRepository;
  private readonly eventBus: DomainEventBus;

  constructor(social: SocialRepository, eventBus: DomainEventBus) {
    this.social = social;
    this.eventBus = eventBus;
  }

  async execute(
    actor: User,
    postId: string,
    rawInput: unknown
  ): Promise<ReturnType<Comment['toDTO']>> {
    actor.assertCan(PERMISSIONS.COMMENT);

    const post = await this.social.findPost(postId);
    if (!post || post.status !== 'published') {
      throw new NotFoundError('Запись не найдена.');
    }

    const input = parseOrThrow(
      z.object({ body: z.string().min(1).max(2000) }),
      rawInput
    );

    const comment = Comment.create({
      postId,
      authorId: actor.id,
      authorName: actor.fullName.value,
      body: input.body,
    });

    await this.social.saveComment(comment);

    this.eventBus.publish({
      eventName: 'social.comment_added',
      occurredAt: comment.createdAt,
      boundedContext: 'identity',
      payload: { postId, commentId: comment.id, authorId: actor.id },
    });

    return comment.toDTO();
  }
}

export class ToggleLikeUseCase {

  private readonly social: SocialRepository;
  private readonly eventBus: DomainEventBus;

  constructor(social: SocialRepository, eventBus: DomainEventBus) {
    this.social = social;
    this.eventBus = eventBus;
  }

  async execute(actor: User, postId: string): Promise<{ liked: boolean; count: number }> {
    actor.assertCan(PERMISSIONS.REACT);

    const post = await this.social.findPost(postId);
    if (!post || post.status !== 'published') {
      throw new NotFoundError('Запись не найдена.');
    }

    const result = await this.social.toggleLike(postId, actor.id);
    this.eventBus.publish({
      eventName: 'social.post_liked',
      occurredAt: new Date().toISOString(),
      boundedContext: 'identity',
      payload: { postId, userId: actor.id, liked: result.liked },
    });
    return result;
  }
}

export class FollowUserUseCase {
  private readonly social: SocialRepository;

  constructor(social: SocialRepository) {
    this.social = social;
  }

  async execute(
    actor: User,
    targetUserId: string,
    follow: boolean
  ): Promise<{ following: boolean; followerCount: number }> {
    actor.assertCan(PERMISSIONS.FOLLOW);

    if (actor.id === targetUserId) {
      throw new ValidationError('Нельзя подписаться на себя.');
    }

    if (follow) {
      await this.social.follow(actor.id, targetUserId);
      await this.social.recordActivity({
        id: `act-follow-${actor.id}-${targetUserId}`,
        type: 'follow',
        actorId: actor.id,
        actorName: actor.fullName.value,
        summary: 'Подписка на участника',
        targetId: targetUserId,
        createdAt: new Date().toISOString(),
      });
    } else {
      await this.social.unfollow(actor.id, targetUserId);
    }

    return {
      following: follow,
      followerCount: await this.social.countFollowers(targetUserId),
    };
  }
}

export class ListActivityUseCase {
  private readonly social: SocialRepository;

  constructor(social: SocialRepository) {
    this.social = social;
  }

  async execute(actor: User, limit = 20): Promise<ReturnType<SocialRepository['listActivity']> extends Promise<infer T> ? T : never> {
    return this.social.listActivity(actor.id, Math.min(Math.max(limit, 1), 50));
  }
}

/** Types re-exported for the router. */
export type { Permission, Role };
