import crypto from 'crypto';
import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { PolicyEvaluator } from '../../domain/iam/rbac.ts';
import {
  CreatePostCommentSchema,
  CreateSocialGroupSchema,
  CreateWallPostSchema,
  UpdateProfileSchema,
  VotePollSchema,
} from '../../domain/social/entities.ts';
import { getDb } from '../../infrastructure/db/client.ts';
import {
  deals,
  socialComments,
  socialGroups,
  socialPosts,
  socialProfiles,
  users,
} from '../../infrastructure/db/schema.ts';
import { natsBus } from '../../infrastructure/nats/eventBus.ts';
import {
  syncSocialCommentToMattermost,
  syncSocialLikeToMattermost,
  syncSocialPostDeletionToMattermost,
  syncSocialPostToMattermost,
} from '../../infrastructure/mattermost/mattermostSync.ts';
import { requireAuth, requirePermission } from '../middleware/tenantAndAuth.ts';
import { asyncHandler, parseBody } from './routeHelpers.ts';

export function createSocialRouter(): Router {
  const router = Router();

  router.get(
    '/social/cabinet',
    requireAuth,
    requirePermission('social:read'),
    asyncHandler('Ошибка загрузки профиля соцсети', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [profiles, tenantUsers, groups, posts, comments, dealRows] = await Promise.all([
        db.select().from(socialProfiles).where(eq(socialProfiles.tenantId, tenantId)),
        db
          .select({ id: users.id, fullName: users.fullName, avatarUrl: users.avatarUrl, roleId: users.roleId })
          .from(users)
          .where(eq(users.tenantId, tenantId)),
        db.select().from(socialGroups).where(eq(socialGroups.tenantId, tenantId)),
        db.select().from(socialPosts).where(eq(socialPosts.tenantId, tenantId)).orderBy(desc(socialPosts.createdAt)),
        db.select().from(socialComments).where(eq(socialComments.tenantId, tenantId)),
        db
          .select({ id: deals.id, title: deals.title, budget: deals.budget, currency: deals.currency })
          .from(deals)
          .where(eq(deals.tenantId, tenantId)),
      ]);

      const myProfileRow = profiles.find((p) => p.userId === req.actor!.userId) || {
        userId: req.actor!.userId,
        tenantId,
        handle: req.actor!.email.split('@')[0],
        headline: req.actor!.roleName,
        department: 'Корпоративный портал',
        city: 'Москва',
        coverUrl: '/src/assets/images/profile_cover_banner_1795559385959.jpg',
        statusText: 'В сети',
        bio: 'Участник рабочего пространства NexusHarness.',
        skills: ['CRM', 'Collaboration'],
        friendsCount: 18,
        followersCount: 64,
      };

      const enrichedPosts = posts.map((post) => {
        const author = tenantUsers.find((u) => u.id === post.authorId);
        const postComments = comments
          .filter((c) => c.postId === post.id)
          .map((c) => {
            const cAuthor = tenantUsers.find((u) => u.id === c.authorId);
            return {
              ...c,
              authorName: cAuthor?.fullName || 'Сотрудник',
              authorAvatar: cAuthor?.avatarUrl || '',
            };
          });
        return {
          ...post,
          authorName: author?.fullName || 'Сотрудник',
          authorAvatar: author?.avatarUrl || '',
          likedByMe: post.likedByUsers.includes(req.actor!.userId),
          comments: postComments,
        };
      });

      const teamMembers = tenantUsers.map((u) => {
        const p = profiles.find((pr) => pr.userId === u.id);
        return {
          userId: u.id,
          fullName: u.fullName,
          avatarUrl: u.avatarUrl,
          headline: p?.headline || 'Специалист портала',
          department: p?.department || 'Команда',
          city: p?.city || 'Москва',
          statusText: p?.statusText || 'В сети',
          skills: p?.skills || [],
          isOnline: true,
        };
      });

      res.json({
        profile: {
          ...myProfileRow,
          fullName: req.actor!.fullName,
          avatarUrl: req.actor!.avatarUrl,
          roleName: req.actor!.roleName,
        },
        posts: enrichedPosts,
        groups,
        teamMembers,
        attachableDeals: dealRows,
      });
    })
  );

  router.patch(
    '/social/profile',
    requireAuth,
    requirePermission('social:post'),
    asyncHandler('Ошибка обновления профиля', async (req, res) => {
      const data = parseBody(UpdateProfileSchema, req, res, 'Некорректные данные профиля');
      if (!data) return;

      const db = await getDb();
      const userId = req.actor!.userId;
      if (data.fullName) {
        await db.update(users).set({ fullName: data.fullName }).where(eq(users.id, userId));
      }

      const [existing] = await db.select().from(socialProfiles).where(eq(socialProfiles.userId, userId));
      const updateFields = {
        headline: data.headline ?? existing?.headline ?? '',
        department: data.department ?? existing?.department ?? '',
        city: data.city ?? existing?.city ?? 'Москва',
        statusText: data.statusText ?? existing?.statusText ?? '',
        bio: data.bio ?? existing?.bio ?? '',
        skills: data.skills ?? existing?.skills ?? [],
      };

      if (existing) {
        await db.update(socialProfiles).set(updateFields).where(eq(socialProfiles.userId, userId));
      } else {
        await db.insert(socialProfiles).values({
          userId,
          tenantId: req.tenant!.id,
          handle: req.actor!.email.split('@')[0],
          coverUrl: '/src/assets/images/profile_cover_banner_1795559385959.jpg',
          ...updateFields,
        });
      }

      res.json({ updated: true });
    })
  );

  router.post(
    '/social/posts',
    requireAuth,
    requirePermission('social:post'),
    asyncHandler('Ошибка создания поста', async (req, res) => {
      const data = parseBody(CreateWallPostSchema, req, res, 'Ошибка валидации публикации');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [post] = await db
        .insert(socialPosts)
        .values({
          id: `post_${crypto.randomUUID().slice(0, 10)}`,
          tenantId,
          authorId: req.actor!.userId,
          content: data.content,
          attachmentType: data.attachmentType,
          attachmentData: data.attachmentData,
          likesCount: 0,
          likedByUsers: [],
          repostsCount: 0,
        })
        .returning();

      await syncSocialPostToMattermost(post, tenantId);

      await natsBus.publish(tenantId, `social.${req.tenant!.subdomain}.post.created`, req.actor!.userId, {
        postId: post.id,
        authorName: req.actor!.fullName,
        preview: data.content.slice(0, 80),
      });

      res.status(201).json({ post });
    })
  );

  router.delete(
    '/social/posts/:id',
    requireAuth,
    requirePermission('social:post'),
    asyncHandler('Ошибка удаления публикации', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [post] = await db
        .select()
        .from(socialPosts)
        .where(and(eq(socialPosts.id, req.params.id), eq(socialPosts.tenantId, tenantId)));
      if (!post) return res.status(404).json({ error: 'Публикация не найдена' });

      const canModerate = PolicyEvaluator.hasPermission(req.actor!.permissions, 'social:moderate');
      if (post.authorId !== req.actor!.userId && !canModerate) {
        return res.status(403).json({ error: 'Недостаточно прав для удаления чужой публикации' });
      }

      await db.delete(socialComments).where(eq(socialComments.postId, post.id));
      await db.delete(socialPosts).where(eq(socialPosts.id, post.id));
      await syncSocialPostDeletionToMattermost(post.id, tenantId);
      res.json({ deleted: true });
    })
  );

  router.post(
    '/social/posts/:id/like',
    requireAuth,
    requirePermission('social:read'),
    asyncHandler('Ошибка обработки лайка', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [post] = await db
        .select()
        .from(socialPosts)
        .where(and(eq(socialPosts.id, req.params.id), eq(socialPosts.tenantId, tenantId)));
      if (!post) return res.status(404).json({ error: 'Пост не найден' });

      const userId = req.actor!.userId;
      const alreadyLiked = post.likedByUsers.includes(userId);
      const nextLikedBy = alreadyLiked
        ? post.likedByUsers.filter((id) => id !== userId)
        : [...post.likedByUsers, userId];

      const [updated] = await db
        .update(socialPosts)
        .set({
          likedByUsers: nextLikedBy,
          likesCount: nextLikedBy.length,
        })
        .where(eq(socialPosts.id, post.id))
        .returning();

      await syncSocialLikeToMattermost(post.id, userId, !alreadyLiked, tenantId);
      await syncSocialPostToMattermost(updated, tenantId);

      res.json({ post: updated, likedByMe: !alreadyLiked });
    })
  );

  router.post(
    '/social/posts/:id/repost',
    requireAuth,
    requirePermission('social:post'),
    asyncHandler('Ошибка репоста публикации', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [post] = await db
        .select()
        .from(socialPosts)
        .where(and(eq(socialPosts.id, req.params.id), eq(socialPosts.tenantId, tenantId)));
      if (!post) return res.status(404).json({ error: 'Пост не найден' });

      const [updated] = await db
        .update(socialPosts)
        .set({ repostsCount: post.repostsCount + 1 })
        .where(eq(socialPosts.id, post.id))
        .returning();

      await syncSocialPostToMattermost(updated, tenantId);

      res.json({ post: updated });
    })
  );

  router.post(
    '/social/posts/:id/vote',
    requireAuth,
    requirePermission('social:read'),
    asyncHandler('Ошибка голосования в опросе', async (req, res) => {
      const data = parseBody(VotePollSchema, req, res, 'Некорректный вариант опроса');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [post] = await db
        .select()
        .from(socialPosts)
        .where(and(eq(socialPosts.id, req.params.id), eq(socialPosts.tenantId, tenantId)));
      if (!post || post.attachmentType !== 'poll') {
        return res.status(404).json({ error: 'Опрос не найден' });
      }

      const rawData = (post.attachmentData || {}) as Record<string, unknown>;
      const options = Array.isArray(rawData.options) ? (rawData.options as string[]) : [];
      if (data.optionIndex < 0 || data.optionIndex >= options.length) {
        return res.status(400).json({ error: 'Указанный вариант ответа отсутствует' });
      }

      const votesMap = {
        ...((rawData.votes && typeof rawData.votes === 'object' ? rawData.votes : {}) as Record<string, number>),
      };
      votesMap[req.actor!.userId] = data.optionIndex;

      const nextAttachmentData = {
        ...rawData,
        votes: votesMap,
      };

      const [updated] = await db
        .update(socialPosts)
        .set({ attachmentData: nextAttachmentData })
        .where(eq(socialPosts.id, post.id))
        .returning();

      await syncSocialPostToMattermost(updated, tenantId);

      res.json({ post: updated });
    })
  );

  router.post(
    '/social/posts/:id/comments',
    requireAuth,
    requirePermission('social:post'),
    asyncHandler('Ошибка добавления комментария', async (req, res) => {
      const data = parseBody(CreatePostCommentSchema, req, res, 'Некорректный комментарий');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [post] = await db
        .select({ id: socialPosts.id })
        .from(socialPosts)
        .where(and(eq(socialPosts.id, req.params.id), eq(socialPosts.tenantId, tenantId)));
      if (!post) return res.status(404).json({ error: 'Публикация не найдена в текущем тенанте' });

      const [comment] = await db
        .insert(socialComments)
        .values({
          id: `cmt_${crypto.randomUUID().slice(0, 10)}`,
          tenantId,
          postId: post.id,
          authorId: req.actor!.userId,
          body: data.body,
        })
        .returning();

      await syncSocialCommentToMattermost(comment, tenantId);

      await natsBus.publish(tenantId, `social.${req.tenant!.subdomain}.comment.created`, req.actor!.userId, {
        postId: post.id,
        commentId: comment.id,
        authorName: req.actor!.fullName,
        preview: data.body.slice(0, 80),
      });

      res.status(201).json({ comment });
    })
  );

  router.post(
    '/social/groups',
    requireAuth,
    requirePermission('social:moderate'),
    asyncHandler('Ошибка создания сообщества', async (req, res) => {
      const data = parseBody(CreateSocialGroupSchema, req, res);
      if (!data) return;

      const db = await getDb();
      const [group] = await db
        .insert(socialGroups)
        .values({
          id: `grp_${crypto.randomUUID().slice(0, 8)}`,
          tenantId: req.tenant!.id,
          name: data.name,
          description: data.description,
          category: data.category,
          membersCount: 1,
          isJoined: true,
        })
        .returning();

      res.status(201).json({ group });
    })
  );

  router.post(
    '/social/groups/:id/toggle',
    requireAuth,
    requirePermission('social:read'),
    asyncHandler('Ошибка участия в группе', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [grp] = await db
        .select()
        .from(socialGroups)
        .where(and(eq(socialGroups.id, req.params.id), eq(socialGroups.tenantId, tenantId)));
      if (!grp) return res.status(404).json({ error: 'Группа не найдена' });

      const nextJoined = !grp.isJoined;
      const [updated] = await db
        .update(socialGroups)
        .set({
          isJoined: nextJoined,
          membersCount: nextJoined ? grp.membersCount + 1 : Math.max(0, grp.membersCount - 1),
        })
        .where(eq(socialGroups.id, grp.id))
        .returning();
      res.json({ group: updated });
    })
  );

  return router;
}
