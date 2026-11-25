import crypto from 'crypto';
import type { ChannelMembership } from '@mattermost/types/channels';
import type { PostSearchResults } from '@mattermost/types/posts';
import type { TeamMembership } from '@mattermost/types/teams';
import type { UserStatus } from '@mattermost/types/users';
import { and, desc, eq, ilike, inArray } from 'drizzle-orm';
import { Router } from 'express';
import { PolicyEvaluator } from '../../domain/iam/rbac.ts';
import {
  CreateMmChannelSchema,
  CreateMmPostSchema,
  CreateMmReactionSchema,
  DirectMmChannelSchema,
  extractHashtags,
  getDirectChannelName,
  NEWS_FEED_CHANNEL_NAME,
  PatchMmPostSchema,
  SearchMmPostsSchema,
  UserStatusesByIdsSchema,
  ViewChannelSchema,
} from '../../domain/mattermost/schemas.ts';
import { getDb } from '../../infrastructure/db/client.ts';
import {
  mmChannelMembers,
  mmChannels,
  mmPosts,
  mmReactions,
  socialComments,
  socialPosts,
  socialProfiles,
  users,
} from '../../infrastructure/db/schema.ts';
import {
  ensureTenantMattermostSetup,
  getUserProfilesForTenant,
  hydrateMattermostPostList,
  hydrateMattermostSinglePost,
  listChannelPostsSorted,
  listThreadPosts,
  toMattermostChannel,
  toMattermostChannelMember,
  toMattermostReaction,
  toMattermostTeam,
  toMattermostUserProfile,
} from '../../infrastructure/mattermost/mattermostSync.ts';
import { mattermostHub } from '../../infrastructure/mattermost/wsServer.ts';
import { natsBus } from '../../infrastructure/nats/eventBus.ts';
import { requireAuth, requirePermission } from '../middleware/tenantAndAuth.ts';
import { asyncHandler, parseBody } from './routeHelpers.ts';

async function getRestrictedAllowedUserIds(
  tenantId: string,
  channelId: string,
  channelType: string
): Promise<Set<string> | null> {
  if (channelType !== 'P' && channelType !== 'D' && channelType !== 'G') {
    return null;
  }
  const db = await getDb();
  const members = await db
    .select({ userId: mmChannelMembers.userId })
    .from(mmChannelMembers)
    .where(and(eq(mmChannelMembers.tenantId, tenantId), eq(mmChannelMembers.channelId, channelId)));
  return new Set(members.map((m) => m.userId));
}

async function assertChannelAccess(
  tenantId: string,
  userId: string,
  channelId: string
): Promise<{
  channel: typeof mmChannels.$inferSelect | null;
  allowedUserIds: Set<string> | null;
  forbidden: boolean;
}> {
  const db = await getDb();
  const [channel] = await db
    .select()
    .from(mmChannels)
    .where(and(eq(mmChannels.id, channelId), eq(mmChannels.tenantId, tenantId), eq(mmChannels.deleteAt, '0')));
  if (!channel) {
    return { channel: null, allowedUserIds: null, forbidden: false };
  }
  const allowedUserIds = await getRestrictedAllowedUserIds(tenantId, channel.id, channel.type);
  if (allowedUserIds && !allowedUserIds.has(userId)) {
    return { channel, allowedUserIds, forbidden: true };
  }
  return { channel, allowedUserIds, forbidden: false };
}

export function createMattermostRouter(): Router {
  const router = Router();

  // @mattermost/client Client4 checks `headers.get('Content-Type') === 'application/json'` strictly
  // (Express res.json() adds '; charset=utf-8', causing Client4 to skip JSON.parse).
  router.use((_req, res, next) => {
    res.json = ((body: unknown) => {
      let payload = body;
      if (
        res.statusCode >= 400 &&
        body &&
        typeof body === 'object' &&
        !Array.isArray(body) &&
        'error' in body &&
        !('message' in body)
      ) {
        payload = { ...(body as Record<string, unknown>), message: (body as { error: unknown }).error };
      }
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json');
      }
      res.end(JSON.stringify(payload));
      return res;
    }) as typeof res.json;
    next();
  });

  // Current user profile (Mattermost UserProfile)
  router.get(
    '/users/me',
    requireAuth,
    requirePermission('social:read'),
    asyncHandler('Ошибка получения профиля Mattermost', async (req, res) => {
      const db = await getDb();
      const [userRow] = await db.select().from(users).where(eq(users.id, req.actor!.userId));
      if (!userRow) return res.status(404).json({ error: 'Пользователь не найден' });
      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userRow.id));
      res.json(toMattermostUserProfile(userRow, profile));
    })
  );

  // Team directory users
  router.get(
    '/users',
    requireAuth,
    requirePermission('social:read'),
    asyncHandler('Ошибка получения списка пользователей Mattermost', async (req, res) => {
      const profiles = await getUserProfilesForTenant(req.tenant!.id);
      res.json(profiles);
    })
  );

  // Real-time online/offline status lookup
  router.post(
    '/users/status/ids',
    requireAuth,
    requirePermission('social:read'),
    asyncHandler('Ошибка получения статусов пользователей', async (req, res) => {
      const ids = parseBody(UserStatusesByIdsSchema, req, res, 'Некорректный список ID пользователей');
      if (!ids) return;
      const online = mattermostHub.getOnlineUserIds(req.tenant!.id);
      const now = Date.now();
      const statuses: UserStatus[] = ids.map((uid) => ({
        user_id: uid,
        status: online.has(uid) ? 'online' : 'offline',
        manual: false,
        last_activity_at: now,
      }));
      res.json(statuses);
    })
  );

  // Teams for current user
  router.get(
    '/users/me/teams',
    requireAuth,
    requirePermission('social:read'),
    asyncHandler('Ошибка получения команд Mattermost', async (req, res) => {
      const { team } = await ensureTenantMattermostSetup(
        req.tenant!.id,
        req.tenant!.subdomain,
        req.tenant!.name
      );
      res.json([toMattermostTeam(team)]);
    })
  );

  router.get(
    '/users/me/teams/members',
    requireAuth,
    requirePermission('social:read'),
    asyncHandler('Ошибка получения членства в команде', async (req, res) => {
      const { team } = await ensureTenantMattermostSetup(
        req.tenant!.id,
        req.tenant!.subdomain,
        req.tenant!.name
      );
      const membership: TeamMembership = {
        team_id: team.id,
        user_id: req.actor!.userId,
        roles: PolicyEvaluator.hasPermission(req.actor!.permissions, 'social:moderate')
          ? 'team_user team_admin'
          : 'team_user',
        delete_at: 0,
        scheme_user: true,
        scheme_admin: PolicyEvaluator.hasPermission(req.actor!.permissions, 'social:moderate'),
        scheme_guest: false,
        mention_count: 0,
        mention_count_root: 0,
        msg_count: 0,
        msg_count_root: 0,
      };
      res.json([membership]);
    })
  );

  // Channels accessible by current user in team (includes Public, Private & Direct Messages)
  router.get(
    '/users/me/teams/:teamId/channels',
    requireAuth,
    requirePermission('social:read'),
    asyncHandler('Ошибка загрузки каналов Mattermost', async (req, res) => {
      const tenantId = req.tenant!.id;
      const actorId = req.actor!.userId;
      await ensureTenantMattermostSetup(tenantId, req.tenant!.subdomain, req.tenant!.name);

      const db = await getDb();
      const [allChannels, myMemberships] = await Promise.all([
        db
          .select()
          .from(mmChannels)
          .where(and(eq(mmChannels.tenantId, tenantId), eq(mmChannels.deleteAt, '0'))),
        db
          .select()
          .from(mmChannelMembers)
          .where(and(eq(mmChannelMembers.tenantId, tenantId), eq(mmChannelMembers.userId, actorId))),
      ]);

      const memberChannelIds = new Set(myMemberships.map((m) => m.channelId));
      const visible = allChannels.filter(
        (ch) =>
          (ch.teamId === req.params.teamId && ch.type === 'O') ||
          ((ch.teamId === req.params.teamId || ch.type === 'D') && memberChannelIds.has(ch.id))
      );

      // Sort: #news-feed first, then town-square, then public/private, then DMs
      const orderWeight = (ch: typeof mmChannels.$inferSelect) => {
        if (ch.name === NEWS_FEED_CHANNEL_NAME) return 0;
        if (ch.name === 'town-square') return 1;
        if (ch.type === 'O') return 2;
        if (ch.type === 'P') return 3;
        return 4;
      };
      visible.sort((a, b) => orderWeight(a) - orderWeight(b) || a.displayName.localeCompare(b.displayName));

      res.json(
        visible.map((ch) => {
          const mapped = toMattermostChannel(ch);
          if (ch.type === 'D') {
            const parts = ch.name.split('__');
            const peerId = parts.find((p) => p !== actorId) || parts[0];
            mapped.teammate_id = peerId;
          }
          return mapped;
        })
      );
    })
  );

  // Channel memberships for user
  router.get(
    '/users/:userId/channel_members',
    requireAuth,
    requirePermission('social:read'),
    asyncHandler('Ошибка загрузки подписок на каналы', async (req, res) => {
      const targetUserId = req.params.userId === 'me' ? req.actor!.userId : req.params.userId;
      if (targetUserId !== req.actor!.userId && !PolicyEvaluator.hasPermission(req.actor!.permissions, 'social:moderate')) {
        return res.status(403).json({ error: 'Недостаточно прав для просмотра подписок другого пользователя' });
      }
      const db = await getDb();
      const rows = await db
        .select()
        .from(mmChannelMembers)
        .where(
          and(
            eq(mmChannelMembers.tenantId, req.tenant!.id),
            eq(mmChannelMembers.userId, targetUserId)
          )
        );
      const list: ChannelMembership[] = rows.map(toMattermostChannelMember);
      res.json(list);
    })
  );

  // Create Public ('O') or Private ('P') channel
  router.post(
    '/channels',
    requireAuth,
    requirePermission('social:post'),
    asyncHandler('Ошибка создания канала Mattermost', async (req, res) => {
      const data = parseBody(CreateMmChannelSchema, req, res, 'Некорректные параметры канала');
      if (!data) return;

      const tenantId = req.tenant!.id;
      const actorId = req.actor!.userId;
      const { team } = await ensureTenantMattermostSetup(tenantId, req.tenant!.subdomain, req.tenant!.name);
      if (data.team_id !== team.id) {
        return res.status(404).json({ error: 'Команда не найдена в текущем тенанте' });
      }

      const db = await getDb();
      const slug = data.name.toLowerCase();
      const [dup] = await db
        .select({ id: mmChannels.id })
        .from(mmChannels)
        .where(and(eq(mmChannels.tenantId, tenantId), eq(mmChannels.name, slug), eq(mmChannels.deleteAt, '0')));
      if (dup) {
        return res.status(409).json({ error: `Канал #${slug} уже существует` });
      }

      const nowStr = String(Date.now());
      const [created] = await db
        .insert(mmChannels)
        .values({
          id: `mmc_${crypto.randomUUID().slice(0, 10)}`,
          tenantId,
          teamId: team.id,
          type: data.type,
          name: slug,
          displayName: data.display_name,
          header: data.header,
          purpose: data.purpose,
          creatorId: actorId,
          totalMsgCount: 0,
          totalMsgCountRoot: 0,
          lastPostAt: nowStr,
          props: {},
          createAt: nowStr,
          updateAt: nowStr,
          deleteAt: '0',
        })
        .returning();

      const memberUserIds =
        data.type === 'O'
          ? (
              await db.select({ id: users.id }).from(users).where(eq(users.tenantId, tenantId))
            ).map((u) => u.id)
          : [actorId];

      await db.insert(mmChannelMembers).values(
        memberUserIds.map((uid) => ({
          id: `mmcm_${crypto.randomUUID().slice(0, 10)}`,
          tenantId,
          channelId: created.id,
          userId: uid,
          roles: uid === actorId ? 'channel_user channel_admin' : 'channel_user',
          lastViewedAt: nowStr,
          msgCount: 0,
          msgCountRoot: 0,
          mentionCount: 0,
          notifyProps: { desktop: 'default', email: 'default', mark_unread: 'all', push: 'default' },
          lastUpdateAt: nowStr,
        }))
      );

      const channelDto = toMattermostChannel(created);
      mattermostHub.broadcastEvent({
        event: 'channel_created',
        tenantId,
        teamId: team.id,
        allowedUserIds: data.type === 'P' ? new Set(memberUserIds) : null,
        data: { channel_id: created.id, team_id: team.id },
      });

      res.status(201).json(channelDto);
    })
  );

  // Create or fetch Direct Message ('D') channel between two users
  router.post(
    '/channels/direct',
    requireAuth,
    requirePermission('social:post'),
    asyncHandler('Ошибка создания личного чата Mattermost', async (req, res) => {
      const userIds = parseBody(DirectMmChannelSchema, req, res, 'Укажите 2 ID пользователей для DM');
      if (!userIds) return;

      const actorId = req.actor!.userId;
      const tenantId = req.tenant!.id;
      if (!userIds.includes(actorId)) {
        return res.status(403).json({ error: 'Можно создавать личный чат только со своим участием' });
      }

      const [uA, uB] = userIds;
      const peerId = uA === actorId ? uB : uA;
      const db = await getDb();
      const [peerRow] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, peerId), eq(users.tenantId, tenantId)));
      if (!peerRow) {
        return res.status(404).json({ error: 'Собеседник не найден в текущем тенанте' });
      }

      const { team } = await ensureTenantMattermostSetup(tenantId, req.tenant!.subdomain, req.tenant!.name);
      const dmName = getDirectChannelName(actorId, peerId);

      const [existing] = await db
        .select()
        .from(mmChannels)
        .where(and(eq(mmChannels.tenantId, tenantId), eq(mmChannels.name, dmName)));
      if (existing) {
        const dto = toMattermostChannel(existing);
        dto.teammate_id = peerId;
        return res.json(dto);
      }

      const nowStr = String(Date.now());
      const [created] = await db
        .insert(mmChannels)
        .values({
          id: `mmc_dm_${crypto.randomUUID().slice(0, 10)}`,
          tenantId,
          teamId: team.id,
          type: 'D',
          name: dmName,
          displayName: peerRow.fullName,
          header: `Личные сообщения`,
          purpose: '',
          creatorId: actorId,
          totalMsgCount: 0,
          totalMsgCountRoot: 0,
          lastPostAt: nowStr,
          props: { participants: [actorId, peerId].sort() },
          createAt: nowStr,
          updateAt: nowStr,
          deleteAt: '0',
        })
        .returning();

      const uniqueParticipants = Array.from(new Set([actorId, peerId]));
      await db.insert(mmChannelMembers).values(
        uniqueParticipants.map((uid) => ({
          id: `mmcm_${crypto.randomUUID().slice(0, 10)}`,
          tenantId,
          channelId: created.id,
          userId: uid,
          roles: 'channel_user',
          lastViewedAt: nowStr,
          msgCount: 0,
          msgCountRoot: 0,
          mentionCount: 0,
          notifyProps: { desktop: 'all', email: 'default', mark_unread: 'all', push: 'all' },
          lastUpdateAt: nowStr,
        }))
      );

      mattermostHub.broadcastEvent({
        event: 'direct_added',
        tenantId,
        channelId: created.id,
        allowedUserIds: new Set(uniqueParticipants),
        data: { creator_id: actorId, teammate_id: peerId },
      });

      const dto = toMattermostChannel(created);
      dto.teammate_id = peerId;
      res.status(201).json(dto);
    })
  );

  // Mark channel as viewed / update read cursor
  router.post(
    '/channels/members/me/view',
    requireAuth,
    requirePermission('social:read'),
    asyncHandler('Ошибка обновления статуса прочтения канала', async (req, res) => {
      const data = parseBody(ViewChannelSchema, req, res);
      if (!data) return;

      const tenantId = req.tenant!.id;
      const actorId = req.actor!.userId;
      const { channel, forbidden } = await assertChannelAccess(tenantId, actorId, data.channel_id);
      if (!channel) return res.status(404).json({ error: 'Канал не найден' });
      if (forbidden) return res.status(403).json({ error: 'Нет доступа к приватному каналу' });

      const now = Date.now();
      const nowStr = String(now);
      const db = await getDb();
      const [member] = await db
        .select()
        .from(mmChannelMembers)
        .where(
          and(
            eq(mmChannelMembers.tenantId, tenantId),
            eq(mmChannelMembers.channelId, channel.id),
            eq(mmChannelMembers.userId, actorId)
          )
        );

      if (member) {
        await db
          .update(mmChannelMembers)
          .set({
            lastViewedAt: nowStr,
            msgCount: channel.totalMsgCount,
            msgCountRoot: channel.totalMsgCountRoot,
            mentionCount: 0,
            lastUpdateAt: nowStr,
          })
          .where(eq(mmChannelMembers.id, member.id));
      } else {
        await db.insert(mmChannelMembers).values({
          id: `mmcm_${crypto.randomUUID().slice(0, 10)}`,
          tenantId,
          channelId: channel.id,
          userId: actorId,
          roles: 'channel_user',
          lastViewedAt: nowStr,
          msgCount: channel.totalMsgCount,
          msgCountRoot: channel.totalMsgCountRoot,
          mentionCount: 0,
          notifyProps: { desktop: 'default', email: 'default', mark_unread: 'all', push: 'default' },
          lastUpdateAt: nowStr,
        });
      }

      mattermostHub.broadcastEvent({
        event: 'channel_viewed',
        tenantId,
        userId: actorId,
        data: { channel_id: channel.id },
      });

      res.json({
        status: 'OK',
        last_viewed_at_times: { [channel.id]: now },
      });
    })
  );

  // List posts in channel (Mattermost PaginatedPostList)
  router.get(
    '/channels/:channelId/posts',
    requireAuth,
    requirePermission('social:read'),
    asyncHandler('Ошибка загрузки сообщений канала', async (req, res) => {
      const tenantId = req.tenant!.id;
      const actorId = req.actor!.userId;
      await ensureTenantMattermostSetup(tenantId, req.tenant!.subdomain, req.tenant!.name);

      const { channel, forbidden } = await assertChannelAccess(tenantId, actorId, req.params.channelId);
      if (!channel) return res.status(404).json({ error: 'Канал не найден' });
      if (forbidden) return res.status(403).json({ error: 'Нет доступа к сообщениям канала' });

      const list = await listChannelPostsSorted(tenantId, channel.id);
      res.json(list);
    })
  );

  // Create post or thread reply (syncs bidirectionally with social_posts/social_comments when in #news-feed)
  router.post(
    '/posts',
    requireAuth,
    requirePermission('social:post'),
    asyncHandler('Ошибка отправки сообщения Mattermost', async (req, res) => {
      const data = parseBody(CreateMmPostSchema, req, res, 'Некорректные данные сообщения');
      if (!data) return;

      const tenantId = req.tenant!.id;
      const actorId = req.actor!.userId;
      await ensureTenantMattermostSetup(tenantId, req.tenant!.subdomain, req.tenant!.name);

      const { channel, allowedUserIds, forbidden } = await assertChannelAccess(
        tenantId,
        actorId,
        data.channel_id
      );
      if (!channel) return res.status(404).json({ error: 'Канал не найден' });
      if (forbidden) return res.status(403).json({ error: 'Вы не участник этого канала' });

      const db = await getDb();
      let rootRow: typeof mmPosts.$inferSelect | null = null;
      if (data.root_id) {
        const [foundRoot] = await db
          .select()
          .from(mmPosts)
          .where(
            and(
              eq(mmPosts.id, data.root_id),
              eq(mmPosts.channelId, channel.id),
              eq(mmPosts.tenantId, tenantId),
              eq(mmPosts.deleteAt, '0')
            )
          );
        if (!foundRoot) {
          return res.status(404).json({ error: 'Корневое сообщение треда не найдено' });
        }
        rootRow = foundRoot;
      }

      const now = Date.now();
      const nowStr = String(now);
      const isNewsFeed = channel.name === NEWS_FEED_CHANNEL_NAME;
      const postId = isNewsFeed
        ? data.root_id
          ? `cmt_${crypto.randomUUID().slice(0, 10)}`
          : `post_${crypto.randomUUID().slice(0, 10)}`
        : `mmp_${crypto.randomUUID().slice(0, 10)}`;

      const propsObj: Record<string, unknown> = { ...(data.props || {}) };
      let linkedSocialPostId: string | null = null;

      // 1. Bidirectional sync into Social Network tables if posted in #news-feed or thread of a social post
      if (isNewsFeed && !data.root_id) {
        const rawAttType = typeof propsObj.attachmentType === 'string' ? propsObj.attachmentType : 'none';
        const attachmentType =
          rawAttType === 'deal' || rawAttType === 'poll' || rawAttType === 'doc' ? rawAttType : 'none';
        const attachmentData =
          propsObj.attachmentData && typeof propsObj.attachmentData === 'object'
            ? (propsObj.attachmentData as Record<string, unknown>)
            : {};

        await db.insert(socialPosts).values({
          id: postId,
          tenantId,
          authorId: actorId,
          content: data.message,
          attachmentType,
          attachmentData,
          likesCount: 0,
          likedByUsers: [],
          repostsCount: 0,
        });
        linkedSocialPostId = postId;
        propsObj.socialPostId = postId;
        propsObj.attachmentType = attachmentType;
        propsObj.attachmentData = attachmentData;
        propsObj.likesCount = 0;
        propsObj.likedByUsers = [];
        propsObj.repostsCount = 0;
      } else if (rootRow && (rootRow.socialPostId || isNewsFeed)) {
        const targetSocialPostId = rootRow.socialPostId || rootRow.id;
        const [parentSocial] = await db
          .select({ id: socialPosts.id })
          .from(socialPosts)
          .where(and(eq(socialPosts.id, targetSocialPostId), eq(socialPosts.tenantId, tenantId)));
        if (parentSocial) {
          await db.insert(socialComments).values({
            id: postId,
            tenantId,
            postId: parentSocial.id,
            authorId: actorId,
            body: data.message,
          });
          linkedSocialPostId = parentSocial.id;
          propsObj.socialCommentId = postId;
          propsObj.socialPostId = parentSocial.id;
        }
      }

      const [inserted] = await db
        .insert(mmPosts)
        .values({
          id: postId,
          tenantId,
          channelId: channel.id,
          userId: actorId,
          rootId: data.root_id || '',
          originalId: '',
          message: data.message,
          type: data.type || '',
          props: propsObj,
          hashtags: extractHashtags(data.message),
          isPinned: false,
          replyCount: 0,
          socialPostId: linkedSocialPostId,
          createAt: nowStr,
          updateAt: nowStr,
          editAt: '0',
          deleteAt: '0',
        })
        .returning();

      if (rootRow) {
        await db
          .update(mmPosts)
          .set({ replyCount: rootRow.replyCount + 1, updateAt: nowStr })
          .where(eq(mmPosts.id, rootRow.id));
      }

      await db
        .update(mmChannels)
        .set({
          lastPostAt: nowStr,
          updateAt: nowStr,
          totalMsgCount: channel.totalMsgCount + 1,
          totalMsgCountRoot: data.root_id ? channel.totalMsgCountRoot : channel.totalMsgCountRoot + 1,
        })
        .where(eq(mmChannels.id, channel.id));

      const hydrated = await hydrateMattermostSinglePost(inserted, tenantId);
      if (data.pending_post_id) {
        hydrated.pending_post_id = data.pending_post_id;
      }

      if (isNewsFeed && !data.root_id) {
        await natsBus.publish(tenantId, `social.${req.tenant!.subdomain}.post.created`, actorId, {
          postId: inserted.id,
          channelId: channel.id,
          authorName: req.actor!.fullName,
          preview: data.message.slice(0, 80),
        });
      } else if (linkedSocialPostId && data.root_id) {
        await natsBus.publish(tenantId, `social.${req.tenant!.subdomain}.comment.created`, actorId, {
          postId: linkedSocialPostId,
          commentId: inserted.id,
          authorName: req.actor!.fullName,
          preview: data.message.slice(0, 80),
        });
      } else {
        await natsBus.publish(tenantId, `mattermost.${req.tenant!.subdomain}.post.created`, actorId, {
          postId: inserted.id,
          channelId: channel.id,
          channelName: channel.displayName,
          authorName: req.actor!.fullName,
          preview: data.message.slice(0, 80),
        });
      }

      mattermostHub.broadcastEvent({
        event: 'posted',
        tenantId,
        channelId: channel.id,
        teamId: channel.teamId,
        allowedUserIds,
        data: {
          channel_display_name: channel.displayName,
          channel_name: channel.name,
          channel_type: channel.type,
          post: JSON.stringify(hydrated),
          sender_name: req.actor!.fullName,
          team_id: channel.teamId,
        },
      });

      res.status(201).json(hydrated);
    })
  );

  // Patch message (edit text, pin, props)
  router.put(
    '/posts/:postId/patch',
    requireAuth,
    requirePermission('social:post'),
    asyncHandler('Ошибка редактирования сообщения', async (req, res) => {
      const data = parseBody(PatchMmPostSchema, req, res, 'Некорректные данные обновления');
      if (!data) return;

      const tenantId = req.tenant!.id;
      const actorId = req.actor!.userId;
      const db = await getDb();
      const [postRow] = await db
        .select()
        .from(mmPosts)
        .where(
          and(
            eq(mmPosts.id, req.params.postId),
            eq(mmPosts.tenantId, tenantId),
            eq(mmPosts.deleteAt, '0')
          )
        );
      if (!postRow) return res.status(404).json({ error: 'Сообщение не найдено' });

      const canModerate = PolicyEvaluator.hasPermission(req.actor!.permissions, 'social:moderate');
      if (postRow.userId !== actorId && !canModerate) {
        return res.status(403).json({ error: 'Нет прав на редактирование чужого сообщения' });
      }

      const nowStr = String(Date.now());
      const nextMessage = data.message ?? postRow.message;
      const nextProps = data.props ? { ...(postRow.props || {}), ...data.props } : postRow.props;

      const [updated] = await db
        .update(mmPosts)
        .set({
          message: nextMessage,
          isPinned: data.is_pinned ?? postRow.isPinned,
          props: nextProps,
          hashtags: extractHashtags(nextMessage),
          editAt: data.message ? nowStr : postRow.editAt,
          updateAt: nowStr,
        })
        .where(eq(mmPosts.id, postRow.id))
        .returning();

      if (postRow.socialPostId && !postRow.rootId && data.message) {
        await db
          .update(socialPosts)
          .set({ content: nextMessage })
          .where(and(eq(socialPosts.id, postRow.socialPostId), eq(socialPosts.tenantId, tenantId)));
      }

      const [ch] = await db.select().from(mmChannels).where(eq(mmChannels.id, postRow.channelId));
      const allowedUserIds = ch
        ? await getRestrictedAllowedUserIds(tenantId, ch.id, ch.type)
        : null;

      const hydrated = await hydrateMattermostSinglePost(updated, tenantId);
      mattermostHub.broadcastEvent({
        event: 'post_edited',
        tenantId,
        channelId: postRow.channelId,
        allowedUserIds,
        data: { post: JSON.stringify(hydrated) },
      });

      res.json(hydrated);
    })
  );

  // Pin / Unpin post
  router.post(
    '/posts/:postId/pin',
    requireAuth,
    requirePermission('social:post'),
    asyncHandler('Ошибка закрепления сообщения', async (req, res) => {
      const tenantId = req.tenant!.id;
      const db = await getDb();
      const [postRow] = await db
        .select()
        .from(mmPosts)
        .where(and(eq(mmPosts.id, req.params.postId), eq(mmPosts.tenantId, tenantId), eq(mmPosts.deleteAt, '0')));
      if (!postRow) return res.status(404).json({ error: 'Сообщение не найдено' });

      const { forbidden, allowedUserIds } = await assertChannelAccess(tenantId, req.actor!.userId, postRow.channelId);
      if (forbidden) return res.status(403).json({ error: 'Нет доступа к каналу' });

      const [updated] = await db
        .update(mmPosts)
        .set({ isPinned: true, updateAt: String(Date.now()) })
        .where(eq(mmPosts.id, postRow.id))
        .returning();

      const hydrated = await hydrateMattermostSinglePost(updated, tenantId);
      mattermostHub.broadcastEvent({
        event: 'post_edited',
        tenantId,
        channelId: postRow.channelId,
        allowedUserIds,
        data: { post: JSON.stringify(hydrated) },
      });

      res.json({ status: 'OK' });
    })
  );

  router.post(
    '/posts/:postId/unpin',
    requireAuth,
    requirePermission('social:post'),
    asyncHandler('Ошибка открепления сообщения', async (req, res) => {
      const tenantId = req.tenant!.id;
      const db = await getDb();
      const [postRow] = await db
        .select()
        .from(mmPosts)
        .where(and(eq(mmPosts.id, req.params.postId), eq(mmPosts.tenantId, tenantId), eq(mmPosts.deleteAt, '0')));
      if (!postRow) return res.status(404).json({ error: 'Сообщение не найдено' });

      const { forbidden, allowedUserIds } = await assertChannelAccess(tenantId, req.actor!.userId, postRow.channelId);
      if (forbidden) return res.status(403).json({ error: 'Нет доступа к каналу' });

      const [updated] = await db
        .update(mmPosts)
        .set({ isPinned: false, updateAt: String(Date.now()) })
        .where(eq(mmPosts.id, postRow.id))
        .returning();

      const hydrated = await hydrateMattermostSinglePost(updated, tenantId);
      mattermostHub.broadcastEvent({
        event: 'post_edited',
        tenantId,
        channelId: postRow.channelId,
        allowedUserIds,
        data: { post: JSON.stringify(hydrated) },
      });

      res.json({ status: 'OK' });
    })
  );

  // Soft-delete post (syncs deletion to social_posts/social_comments)
  router.delete(
    '/posts/:postId',
    requireAuth,
    requirePermission('social:post'),
    asyncHandler('Ошибка удаления сообщения', async (req, res) => {
      const tenantId = req.tenant!.id;
      const actorId = req.actor!.userId;
      const db = await getDb();
      const [postRow] = await db
        .select()
        .from(mmPosts)
        .where(and(eq(mmPosts.id, req.params.postId), eq(mmPosts.tenantId, tenantId), eq(mmPosts.deleteAt, '0')));
      if (!postRow) return res.status(404).json({ error: 'Сообщение не найдено' });

      const canModerate = PolicyEvaluator.hasPermission(req.actor!.permissions, 'social:moderate');
      if (postRow.userId !== actorId && !canModerate) {
        return res.status(403).json({ error: 'Недостаточно прав для удаления чужого сообщения' });
      }

      const nowStr = String(Date.now());
      await db.update(mmPosts).set({ deleteAt: nowStr, updateAt: nowStr }).where(eq(mmPosts.id, postRow.id));
      if (!postRow.rootId) {
        await db
          .update(mmPosts)
          .set({ deleteAt: nowStr, updateAt: nowStr })
          .where(and(eq(mmPosts.tenantId, tenantId), eq(mmPosts.rootId, postRow.id)));
      } else {
        const [rootRow] = await db
          .select()
          .from(mmPosts)
          .where(and(eq(mmPosts.id, postRow.rootId), eq(mmPosts.tenantId, tenantId)));
        if (rootRow) {
          await db
            .update(mmPosts)
            .set({ replyCount: Math.max(0, rootRow.replyCount - 1), updateAt: nowStr })
            .where(eq(mmPosts.id, rootRow.id));
        }
      }

      if (postRow.socialPostId) {
        if (!postRow.rootId) {
          await db.delete(socialComments).where(eq(socialComments.postId, postRow.socialPostId));
          await db.delete(socialPosts).where(eq(socialPosts.id, postRow.socialPostId));
        } else {
          await db.delete(socialComments).where(eq(socialComments.id, postRow.id));
        }
      }

      const [ch] = await db.select().from(mmChannels).where(eq(mmChannels.id, postRow.channelId));
      const allowedUserIds = ch
        ? await getRestrictedAllowedUserIds(tenantId, ch.id, ch.type)
        : null;

      const deletedDto = await hydrateMattermostSinglePost({ ...postRow, deleteAt: nowStr }, tenantId);
      mattermostHub.broadcastEvent({
        event: 'post_deleted',
        tenantId,
        channelId: postRow.channelId,
        allowedUserIds,
        data: { post: JSON.stringify(deletedDto) },
      });

      res.json({ status: 'OK' });
    })
  );

  // Thread posts (root + all replies)
  router.get(
    '/posts/:postId/thread',
    requireAuth,
    requirePermission('social:read'),
    asyncHandler('Ошибка загрузки треда сообщений', async (req, res) => {
      const tenantId = req.tenant!.id;
      const db = await getDb();
      const [target] = await db
        .select()
        .from(mmPosts)
        .where(and(eq(mmPosts.id, req.params.postId), eq(mmPosts.tenantId, tenantId), eq(mmPosts.deleteAt, '0')));
      if (!target) return res.status(404).json({ error: 'Тред не найден' });

      const { forbidden } = await assertChannelAccess(tenantId, req.actor!.userId, target.channelId);
      if (forbidden) return res.status(403).json({ error: 'Нет доступа к каналу' });

      const rootId = target.rootId || target.id;
      const thread = await listThreadPosts(tenantId, rootId);
      res.json(thread);
    })
  );

  // Add reaction (syncs 'heart' emoji with social_posts likes)
  router.post(
    '/reactions',
    requireAuth,
    requirePermission('social:read'),
    asyncHandler('Ошибка добавления реакции', async (req, res) => {
      const data = parseBody(CreateMmReactionSchema, req, res, 'Некорректная реакция');
      if (!data) return;

      const tenantId = req.tenant!.id;
      const actorId = req.actor!.userId;
      const db = await getDb();
      const [postRow] = await db
        .select()
        .from(mmPosts)
        .where(and(eq(mmPosts.id, data.post_id), eq(mmPosts.tenantId, tenantId), eq(mmPosts.deleteAt, '0')));
      if (!postRow) return res.status(404).json({ error: 'Сообщение не найдено' });

      const { forbidden, allowedUserIds } = await assertChannelAccess(tenantId, actorId, postRow.channelId);
      if (forbidden) return res.status(403).json({ error: 'Нет доступа к каналу' });

      const [existing] = await db
        .select()
        .from(mmReactions)
        .where(
          and(
            eq(mmReactions.tenantId, tenantId),
            eq(mmReactions.postId, postRow.id),
            eq(mmReactions.userId, actorId),
            eq(mmReactions.emojiName, data.emoji_name)
          )
        );

      let row = existing;
      if (!row) {
        [row] = await db
          .insert(mmReactions)
          .values({
            id: `mmr_${crypto.randomUUID().slice(0, 10)}`,
            tenantId,
            userId: actorId,
            postId: postRow.id,
            emojiName: data.emoji_name,
            createAt: String(Date.now()),
          })
          .returning();
      }

      if (data.emoji_name === 'heart' && postRow.socialPostId && !postRow.rootId) {
        const [sp] = await db
          .select()
          .from(socialPosts)
          .where(and(eq(socialPosts.id, postRow.socialPostId), eq(socialPosts.tenantId, tenantId)));
        if (sp && !sp.likedByUsers.includes(actorId)) {
          const nextLiked = [...sp.likedByUsers, actorId];
          await db
            .update(socialPosts)
            .set({ likedByUsers: nextLiked, likesCount: nextLiked.length })
            .where(eq(socialPosts.id, sp.id));
          await db
            .update(mmPosts)
            .set({
              props: { ...(postRow.props || {}), likedByUsers: nextLiked, likesCount: nextLiked.length },
            })
            .where(eq(mmPosts.id, postRow.id));
        }
      }

      const reactionDto = toMattermostReaction(row);
      if (!existing) {
        mattermostHub.broadcastEvent({
          event: 'reaction_added',
          tenantId,
          channelId: postRow.channelId,
          allowedUserIds,
          data: { reaction: JSON.stringify(reactionDto) },
        });
      }

      res.json(reactionDto);
    })
  );

  // Remove reaction
  router.delete(
    '/users/:userId/posts/:postId/reactions/:emojiName',
    requireAuth,
    requirePermission('social:read'),
    asyncHandler('Ошибка удаления реакции', async (req, res) => {
      const tenantId = req.tenant!.id;
      const actorId = req.actor!.userId;
      const targetUserId = req.params.userId === 'me' ? actorId : req.params.userId;
      const canModerate = PolicyEvaluator.hasPermission(req.actor!.permissions, 'social:moderate');
      if (targetUserId !== actorId && !canModerate) {
        return res.status(403).json({ error: 'Нельзя удалить чужую реакцию' });
      }

      const db = await getDb();
      const [postRow] = await db
        .select()
        .from(mmPosts)
        .where(and(eq(mmPosts.id, req.params.postId), eq(mmPosts.tenantId, tenantId)));
      if (!postRow) return res.status(404).json({ error: 'Сообщение не найдено' });

      const { forbidden, allowedUserIds } = await assertChannelAccess(tenantId, actorId, postRow.channelId);
      if (forbidden) return res.status(403).json({ error: 'Нет доступа к каналу' });

      const [existing] = await db
        .select()
        .from(mmReactions)
        .where(
          and(
            eq(mmReactions.tenantId, tenantId),
            eq(mmReactions.postId, postRow.id),
            eq(mmReactions.userId, targetUserId),
            eq(mmReactions.emojiName, req.params.emojiName)
          )
        );

      if (existing) {
        await db.delete(mmReactions).where(eq(mmReactions.id, existing.id));

        if (req.params.emojiName === 'heart' && postRow.socialPostId && !postRow.rootId) {
          const [sp] = await db
            .select()
            .from(socialPosts)
            .where(and(eq(socialPosts.id, postRow.socialPostId), eq(socialPosts.tenantId, tenantId)));
          if (sp && sp.likedByUsers.includes(targetUserId)) {
            const nextLiked = sp.likedByUsers.filter((id) => id !== targetUserId);
            await db
              .update(socialPosts)
              .set({ likedByUsers: nextLiked, likesCount: nextLiked.length })
              .where(eq(socialPosts.id, sp.id));
            await db
              .update(mmPosts)
              .set({
                props: { ...(postRow.props || {}), likedByUsers: nextLiked, likesCount: nextLiked.length },
              })
              .where(eq(mmPosts.id, postRow.id));
          }
        }

        mattermostHub.broadcastEvent({
          event: 'reaction_removed',
          tenantId,
          channelId: postRow.channelId,
          allowedUserIds,
          data: { reaction: JSON.stringify(toMattermostReaction(existing)) },
        });
      }

      res.json({ status: 'OK' });
    })
  );

  // Full-text post search across accessible team channels
  router.post(
    '/teams/:teamId/posts/search',
    requireAuth,
    requirePermission('social:read'),
    asyncHandler('Ошибка поиска сообщений в чате', async (req, res) => {
      const data = parseBody(SearchMmPostsSchema, req, res, 'Введите поисковый запрос');
      if (!data) return;

      const tenantId = req.tenant!.id;
      const actorId = req.actor!.userId;
      const db = await getDb();

      const [allChannels, myMemberships] = await Promise.all([
        db
          .select()
          .from(mmChannels)
          .where(and(eq(mmChannels.tenantId, tenantId), eq(mmChannels.deleteAt, '0'))),
        db
          .select({ channelId: mmChannelMembers.channelId })
          .from(mmChannelMembers)
          .where(and(eq(mmChannelMembers.tenantId, tenantId), eq(mmChannelMembers.userId, actorId))),
      ]);

      const memberChannelIds = new Set(myMemberships.map((m) => m.channelId));
      const accessibleChannelIds = allChannels
        .filter((c) => c.type === 'O' || memberChannelIds.has(c.id))
        .map((c) => c.id);

      if (accessibleChannelIds.length === 0) {
        const empty: PostSearchResults = {
          order: [],
          posts: {},
          matches: {},
          next_post_id: '',
          prev_post_id: '',
          first_inaccessible_post_time: 0,
        };
        return res.json(empty);
      }

      const escapedTerms = data.terms.replace(/[%_]/g, '\\$&');
      const matchedRows = await db
        .select()
        .from(mmPosts)
        .where(
          and(
            eq(mmPosts.tenantId, tenantId),
            eq(mmPosts.deleteAt, '0'),
            inArray(mmPosts.channelId, accessibleChannelIds),
            ilike(mmPosts.message, `%${escapedTerms}%`)
          )
        )
        .orderBy(desc(mmPosts.createAt))
        .limit(50);

      const hydratedList = await hydrateMattermostPostList(matchedRows, tenantId);
      const matches: Record<string, string[]> = {};
      for (const id of hydratedList.order) {
        matches[id] = [data.terms];
      }

      const result: PostSearchResults = {
        ...hydratedList,
        matches,
      };
      res.json(result);
    })
  );

  return router;
}
