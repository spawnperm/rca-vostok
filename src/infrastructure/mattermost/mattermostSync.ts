import crypto from 'crypto';
import type { ChannelMembership, ChannelType, ServerChannel } from '@mattermost/types/channels';
import type { PaginatedPostList, Post, PostList } from '@mattermost/types/posts';
import type { Reaction } from '@mattermost/types/reactions';
import type { Team } from '@mattermost/types/teams';
import type { UserProfile } from '@mattermost/types/users';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
  extractHashtags,
  NEWS_FEED_CHANNEL_NAME,
  TOWN_SQUARE_CHANNEL_NAME,
} from '../../domain/mattermost/schemas.ts';
import { getDb } from '../db/client.ts';
import {
  mmChannelMembers,
  mmChannels,
  mmPosts,
  mmReactions,
  mmTeams,
  socialComments,
  socialPosts,
  socialProfiles,
  tenants,
  users,
} from '../db/schema.ts';
import { mattermostHub } from './wsServer.ts';

type MmChannelRow = typeof mmChannels.$inferSelect;
type MmPostRow = typeof mmPosts.$inferSelect;
type MmReactionRow = typeof mmReactions.$inferSelect;
type MmTeamRow = typeof mmTeams.$inferSelect;
type MmChannelMemberRow = typeof mmChannelMembers.$inferSelect;

export function toMattermostTeam(row: MmTeamRow): Team {
  return {
    id: row.id,
    create_at: Number(row.createAt) || 0,
    update_at: Number(row.updateAt) || 0,
    delete_at: Number(row.deleteAt) || 0,
    display_name: row.displayName,
    name: row.name,
    description: row.description,
    email: `team@${row.name}.platform.local`,
    type: row.type === 'I' ? 'I' : 'O',
    company_name: row.displayName,
    allowed_domains: '',
    invite_id: `inv_${row.id}`,
    allow_open_invite: true,
    scheme_id: '',
    group_constrained: false,
  };
}

export function toMattermostChannel(row: MmChannelRow): ServerChannel {
  return {
    id: row.id,
    create_at: Number(row.createAt) || 0,
    update_at: Number(row.updateAt) || 0,
    delete_at: Number(row.deleteAt) || 0,
    team_id: row.teamId,
    type: row.type as ChannelType,
    display_name: row.displayName,
    name: row.name,
    header: row.header,
    purpose: row.purpose,
    last_post_at: Number(row.lastPostAt) || 0,
    last_root_post_at: Number(row.lastPostAt) || 0,
    creator_id: row.creatorId,
    scheme_id: '',
    group_constrained: false,
    props: row.props || {},
    total_msg_count: row.totalMsgCount,
    total_msg_count_root: row.totalMsgCountRoot,
  };
}

export function toMattermostChannelMember(row: MmChannelMemberRow): ChannelMembership {
  return {
    channel_id: row.channelId,
    user_id: row.userId,
    roles: row.roles,
    last_viewed_at: Number(row.lastViewedAt) || 0,
    msg_count: row.msgCount,
    msg_count_root: row.msgCountRoot,
    mention_count: row.mentionCount,
    mention_count_root: 0,
    urgent_mention_count: 0,
    notify_props: {
      desktop: (row.notifyProps?.desktop as 'default') || 'default',
      email: (row.notifyProps?.email as 'default') || 'default',
      mark_unread: (row.notifyProps?.mark_unread as 'all') || 'all',
      push: (row.notifyProps?.push as 'default') || 'default',
      ignore_channel_mentions: 'default',
    } as ChannelMembership['notify_props'],
    last_update_at: Number(row.lastUpdateAt) || 0,
    scheme_user: true,
    scheme_admin: row.roles.includes('channel_admin'),
  };
}

export function toMattermostReaction(row: MmReactionRow): Reaction {
  return {
    user_id: row.userId,
    post_id: row.postId,
    emoji_name: row.emojiName,
    create_at: Number(row.createAt) || 0,
  };
}

export function toMattermostPost(row: MmPostRow, reactions: Reaction[] = []): Post {
  return {
    id: row.id,
    create_at: Number(row.createAt) || 0,
    update_at: Number(row.updateAt) || 0,
    edit_at: Number(row.editAt) || 0,
    delete_at: Number(row.deleteAt) || 0,
    is_pinned: row.isPinned,
    user_id: row.userId,
    channel_id: row.channelId,
    root_id: row.rootId,
    original_id: row.originalId,
    message: row.message,
    type: row.type as Post['type'],
    props: {
      ...(row.props || {}),
      ...(row.socialPostId ? { socialPostId: row.socialPostId } : {}),
    },
    hashtags: row.hashtags,
    pending_post_id: '',
    reply_count: row.replyCount,
    last_reply_at: Number(row.updateAt) || 0,
    metadata: {
      embeds: [],
      emojis: [],
      files: [],
      images: {},
      reactions,
    },
  };
}

export function toMattermostUserProfile(
  u: {
    id: string;
    email: string;
    fullName: string;
    roleId: string;
    avatarUrl: string;
    isActive: boolean;
  },
  profile?: {
    handle?: string;
    headline?: string;
    department?: string;
  }
): UserProfile {
  const nameParts = u.fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || u.fullName;
  const lastName = nameParts.slice(1).join(' ');
  const username = profile?.handle || u.email.split('@')[0] || u.id;
  return {
    id: u.id,
    create_at: 1700000000000,
    update_at: 1700000000000,
    delete_at: u.isActive ? 0 : 1700000000000,
    username,
    password: '',
    auth_data: '',
    auth_service: '',
    email: u.email,
    nickname: profile?.department || '',
    first_name: firstName,
    last_name: lastName,
    position: profile?.headline || '',
    roles: u.roleId.includes('superadmin') ? 'system_admin system_user' : 'system_user',
    locale: 'ru',
    timezone: {
      automaticTimezone: 'Europe/Moscow',
      manualTimezone: 'Europe/Moscow',
      useAutomaticTimezone: 'true',
    },
    props: {
      avatarUrl: u.avatarUrl,
      fullName: u.fullName,
    },
    notify_props: {
      channel: 'true',
      comments: 'any',
      desktop: 'all',
      desktop_sound: 'true',
      calls_desktop_sound: 'true',
      mark_unread: 'all',
      email: 'true',
      first_name: 'true',
      mention_keys: username,
      highlight_keys: '',
      push: 'all',
      push_status: 'online',
    },
    last_password_update: 1700000000000,
    last_picture_update: 1700000000000,
    failed_attempts: 0,
    mfa_active: false,
    last_activity_at: Date.now(),
    is_bot: false,
    bot_description: '',
    terms_of_service_id: '',
    terms_of_service_create_at: 0,
    remote_id: '',
  };
}

export async function getNewsFeedChannel(tenantId: string): Promise<MmChannelRow | null> {
  const db = await getDb();
  const [channel] = await db
    .select()
    .from(mmChannels)
    .where(and(eq(mmChannels.tenantId, tenantId), eq(mmChannels.name, NEWS_FEED_CHANNEL_NAME)));
  return channel || null;
}

export async function ensureTenantMattermostSetup(
  tenantId: string,
  subdomainOverride?: string,
  tenantNameOverride?: string
): Promise<{ team: MmTeamRow; newsFeedChannel: MmChannelRow }> {
  const db = await getDb();

  let [team] = await db.select().from(mmTeams).where(eq(mmTeams.tenantId, tenantId));
  let subdomain = subdomainOverride;
  let tenantName = tenantNameOverride;

  if (!subdomain || !tenantName) {
    const [tnt] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    subdomain = subdomain || tnt?.subdomain || 'acme';
    tenantName = tenantName || tnt?.name || 'Workspace';
  }

  const nowStr = String(Date.now());
  const tenantUsers = await db.select().from(users).where(eq(users.tenantId, tenantId));
  const creatorId = tenantUsers[0]?.id || 'system';

  if (!team) {
    [team] = await db
      .insert(mmTeams)
      .values({
        id: `mmt_${subdomain}`,
        tenantId,
        name: subdomain,
        displayName: tenantName,
        description: `Рабочее пространство Mattermost для ${tenantName}`,
        type: 'O',
        createAt: nowStr,
        updateAt: nowStr,
        deleteAt: '0',
      })
      .returning();
  }

  const existingChannels = await db
    .select()
    .from(mmChannels)
    .where(eq(mmChannels.tenantId, tenantId));

  const starterDefs = [
    {
      id: `mmc_${subdomain}_news_feed`,
      name: NEWS_FEED_CHANNEL_NAME,
      displayName: 'Новостная лента',
      type: 'O',
      header: 'Единая новостная лента социальной сети внутри Mattermost · посты, сделки amoCRM и опросы',
      purpose: 'Лента новостей, релизов, сделок и голосований команды',
      props: { is_news_feed: true, badge: 'Соцсеть' },
    },
    {
      id: `mmc_${subdomain}_town_square`,
      name: TOWN_SQUARE_CHANNEL_NAME,
      displayName: 'Общий чат',
      type: 'O',
      header: 'Общекомандный канал Mattermost (Town Square) для оперативных обсуждений',
      purpose: 'Ежедневная коммуникация всей команды',
      props: { is_default: true },
    },
    {
      id: `mmc_${subdomain}_deals_room`,
      name: 'deals-room',
      displayName: 'Сделки и воронка',
      type: 'O',
      header: 'Оперативный разбор сделок amoCRM и скоринга DeepSeek-Harness',
      purpose: 'Пресейл, обсуждение КП и согласование условий',
      props: { module: 'crm' },
    },
    {
      id: `mmc_${subdomain}_workflows_ops`,
      name: 'workflows-ops',
      displayName: 'Процессы n8n и NATS',
      type: 'P',
      header: 'Закрытый канал уведомлений автоматизации n8n и брокера NATS JetStream',
      purpose: 'Алерты и согласования процессов автоматизации',
      props: { module: 'workflows' },
    },
  ];

  for (const def of starterDefs) {
    const found = existingChannels.find((c) => c.name === def.name);
    if (!found) {
      await db.insert(mmChannels).values({
        id: def.id,
        tenantId,
        teamId: team.id,
        type: def.type,
        name: def.name,
        displayName: def.displayName,
        header: def.header,
        purpose: def.purpose,
        creatorId,
        totalMsgCount: 0,
        totalMsgCountRoot: 0,
        lastPostAt: nowStr,
        props: def.props,
        createAt: nowStr,
        updateAt: nowStr,
        deleteAt: '0',
      });
    }
  }

  const allChannels = await db
    .select()
    .from(mmChannels)
    .where(eq(mmChannels.tenantId, tenantId));

  // Ensure every active tenant user has memberships for O/P starter channels
  const existingMembers = await db
    .select()
    .from(mmChannelMembers)
    .where(eq(mmChannelMembers.tenantId, tenantId));

  const memberSet = new Set(existingMembers.map((m) => `${m.channelId}:${m.userId}`));
  const missingMembers: Array<typeof mmChannelMembers.$inferInsert> = [];

  for (const ch of allChannels) {
    if (ch.type === 'D' || ch.type === 'G') continue;
    for (const u of tenantUsers) {
      const key = `${ch.id}:${u.id}`;
      if (!memberSet.has(key)) {
        memberSet.add(key);
        missingMembers.push({
          id: `mmcm_${crypto.randomUUID().slice(0, 10)}`,
          tenantId,
          channelId: ch.id,
          userId: u.id,
          roles: u.id === ch.creatorId ? 'channel_user channel_admin' : 'channel_user',
          lastViewedAt: nowStr,
          msgCount: ch.totalMsgCount,
          msgCountRoot: ch.totalMsgCountRoot,
          mentionCount: 0,
          notifyProps: { desktop: 'default', email: 'default', mark_unread: 'all', push: 'default' },
          lastUpdateAt: nowStr,
        });
      }
    }
  }
  if (missingMembers.length > 0) {
    await db.insert(mmChannelMembers).values(missingMembers);
  }

  const newsFeedChannel = allChannels.find((c) => c.name === NEWS_FEED_CHANNEL_NAME)!;

  // Backfill any social_posts that are not yet mirrored in #news-feed
  const [tenantPosts, tenantComments, existingFeedPosts] = await Promise.all([
    db.select().from(socialPosts).where(eq(socialPosts.tenantId, tenantId)).orderBy(asc(socialPosts.createdAt)),
    db.select().from(socialComments).where(eq(socialComments.tenantId, tenantId)).orderBy(asc(socialComments.createdAt)),
    db
      .select()
      .from(mmPosts)
      .where(and(eq(mmPosts.tenantId, tenantId), eq(mmPosts.channelId, newsFeedChannel.id))),
  ]);

  const syncedSocialIds = new Set(existingFeedPosts.map((p) => p.socialPostId || p.id));

  for (const sp of tenantPosts) {
    if (syncedSocialIds.has(sp.id)) continue;
    const postComments = tenantComments.filter((c) => c.postId === sp.id);
    const createdMs = String(sp.createdAt.getTime());
    await db.insert(mmPosts).values({
      id: sp.id,
      tenantId,
      channelId: newsFeedChannel.id,
      userId: sp.authorId,
      rootId: '',
      originalId: '',
      message: sp.content,
      type: '',
      props: {
        socialPostId: sp.id,
        attachmentType: sp.attachmentType,
        attachmentData: sp.attachmentData,
        likesCount: sp.likesCount,
        likedByUsers: sp.likedByUsers,
        repostsCount: sp.repostsCount,
      },
      hashtags: extractHashtags(sp.content),
      isPinned: false,
      replyCount: postComments.length,
      socialPostId: sp.id,
      createAt: createdMs,
      updateAt: createdMs,
      editAt: '0',
      deleteAt: '0',
    });

    for (const userId of sp.likedByUsers || []) {
      await db.insert(mmReactions).values({
        id: `mmr_${crypto.randomUUID().slice(0, 10)}`,
        tenantId,
        userId,
        postId: sp.id,
        emojiName: 'heart',
        createAt: createdMs,
      });
    }

    for (const cmt of postComments) {
      if (syncedSocialIds.has(cmt.id)) continue;
      const cmtMs = String(cmt.createdAt.getTime());
      await db.insert(mmPosts).values({
        id: cmt.id,
        tenantId,
        channelId: newsFeedChannel.id,
        userId: cmt.authorId,
        rootId: sp.id,
        originalId: '',
        message: cmt.body,
        type: '',
        props: { socialCommentId: cmt.id, socialPostId: sp.id },
        hashtags: extractHashtags(cmt.body),
        isPinned: false,
        replyCount: 0,
        socialPostId: sp.id,
        createAt: cmtMs,
        updateAt: cmtMs,
        editAt: '0',
        deleteAt: '0',
      });
    }
  }

  return { team, newsFeedChannel };
}

export async function hydrateMattermostPostList(
  rows: MmPostRow[],
  tenantId: string
): Promise<PaginatedPostList> {
  const db = await getDb();
  const postIds = rows.map((r) => r.id);
  const reactionRows =
    postIds.length > 0
      ? await db
          .select()
          .from(mmReactions)
          .where(and(eq(mmReactions.tenantId, tenantId), inArray(mmReactions.postId, postIds)))
      : [];

  const reactionsByPost = new Map<string, Reaction[]>();
  for (const r of reactionRows) {
    const arr = reactionsByPost.get(r.postId) || [];
    arr.push(toMattermostReaction(r));
    reactionsByPost.set(r.postId, arr);
  }

  const order: string[] = [];
  const posts: Record<string, Post> = {};
  for (const row of rows) {
    if (row.deleteAt && row.deleteAt !== '0') continue;
    order.push(row.id);
    posts[row.id] = toMattermostPost(row, reactionsByPost.get(row.id) || []);
  }

  return {
    order,
    posts,
    next_post_id: '',
    prev_post_id: '',
    has_next: false,
    first_inaccessible_post_time: 0,
  };
}

export async function hydrateMattermostSinglePost(row: MmPostRow, tenantId: string): Promise<Post> {
  const db = await getDb();
  const reactionRows = await db
    .select()
    .from(mmReactions)
    .where(and(eq(mmReactions.tenantId, tenantId), eq(mmReactions.postId, row.id)));
  return toMattermostPost(row, reactionRows.map(toMattermostReaction));
}

export async function syncSocialPostToMattermost(
  sp: typeof socialPosts.$inferSelect,
  tenantId: string
): Promise<Post> {
  const db = await getDb();
  const { newsFeedChannel } = await ensureTenantMattermostSetup(tenantId);
  const ts = String(sp.createdAt ? sp.createdAt.getTime() : Date.now());

  const [existing] = await db
    .select()
    .from(mmPosts)
    .where(and(eq(mmPosts.tenantId, tenantId), eq(mmPosts.id, sp.id)));

  const propsPayload: Record<string, unknown> = {
    socialPostId: sp.id,
    attachmentType: sp.attachmentType,
    attachmentData: sp.attachmentData,
    likesCount: sp.likesCount,
    likedByUsers: sp.likedByUsers,
    repostsCount: sp.repostsCount,
  };

  let row: MmPostRow;
  if (existing) {
    const [updated] = await db
      .update(mmPosts)
      .set({
        message: sp.content,
        props: { ...(existing.props || {}), ...propsPayload },
        updateAt: String(Date.now()),
      })
      .where(eq(mmPosts.id, existing.id))
      .returning();
    row = updated;
    const mmPost = await hydrateMattermostSinglePost(row, tenantId);
    mattermostHub.broadcastEvent({
      event: 'post_edited',
      tenantId,
      channelId: newsFeedChannel.id,
      data: { post: JSON.stringify(mmPost) },
    });
    return mmPost;
  } else {
    const [inserted] = await db
      .insert(mmPosts)
      .values({
        id: sp.id,
        tenantId,
        channelId: newsFeedChannel.id,
        userId: sp.authorId,
        rootId: '',
        originalId: '',
        message: sp.content,
        type: '',
        props: propsPayload,
        hashtags: extractHashtags(sp.content),
        isPinned: false,
        replyCount: 0,
        socialPostId: sp.id,
        createAt: ts,
        updateAt: ts,
        editAt: '0',
        deleteAt: '0',
      })
      .returning();
    row = inserted;

    await db
      .update(mmChannels)
      .set({
        lastPostAt: ts,
        updateAt: ts,
        totalMsgCount: newsFeedChannel.totalMsgCount + 1,
        totalMsgCountRoot: newsFeedChannel.totalMsgCountRoot + 1,
      })
      .where(eq(mmChannels.id, newsFeedChannel.id));

    const mmPost = await hydrateMattermostSinglePost(row, tenantId);
    mattermostHub.broadcastEvent({
      event: 'posted',
      tenantId,
      channelId: newsFeedChannel.id,
      teamId: newsFeedChannel.teamId,
      data: {
        channel_display_name: newsFeedChannel.displayName,
        channel_name: newsFeedChannel.name,
        channel_type: newsFeedChannel.type,
        post: JSON.stringify(mmPost),
        sender_name: '',
        team_id: newsFeedChannel.teamId,
      },
    });
    return mmPost;
  }
}

export async function syncSocialCommentToMattermost(
  cmt: typeof socialComments.$inferSelect,
  tenantId: string
): Promise<Post | null> {
  const db = await getDb();
  const { newsFeedChannel } = await ensureTenantMattermostSetup(tenantId);
  const [rootRow] = await db
    .select()
    .from(mmPosts)
    .where(and(eq(mmPosts.tenantId, tenantId), eq(mmPosts.id, cmt.postId)));
  if (!rootRow) return null;

  const ts = String(cmt.createdAt ? cmt.createdAt.getTime() : Date.now());
  const [inserted] = await db
    .insert(mmPosts)
    .values({
      id: cmt.id,
      tenantId,
      channelId: rootRow.channelId,
      userId: cmt.authorId,
      rootId: rootRow.id,
      originalId: '',
      message: cmt.body,
      type: '',
      props: { socialCommentId: cmt.id, socialPostId: cmt.postId },
      hashtags: extractHashtags(cmt.body),
      isPinned: false,
      replyCount: 0,
      socialPostId: cmt.postId,
      createAt: ts,
      updateAt: ts,
      editAt: '0',
      deleteAt: '0',
    })
    .returning();

  await db
    .update(mmPosts)
    .set({ replyCount: rootRow.replyCount + 1, updateAt: ts })
    .where(eq(mmPosts.id, rootRow.id));

  await db
    .update(mmChannels)
    .set({
      lastPostAt: ts,
      updateAt: ts,
      totalMsgCount: newsFeedChannel.totalMsgCount + 1,
    })
    .where(eq(mmChannels.id, rootRow.channelId));

  const mmPost = await hydrateMattermostSinglePost(inserted, tenantId);
  mattermostHub.broadcastEvent({
    event: 'posted',
    tenantId,
    channelId: rootRow.channelId,
    teamId: newsFeedChannel.teamId,
    data: {
      channel_display_name: newsFeedChannel.displayName,
      channel_name: newsFeedChannel.name,
      channel_type: newsFeedChannel.type,
      post: JSON.stringify(mmPost),
      sender_name: '',
      team_id: newsFeedChannel.teamId,
    },
  });
  return mmPost;
}

export async function syncSocialLikeToMattermost(
  postId: string,
  userId: string,
  liked: boolean,
  tenantId: string
): Promise<void> {
  const db = await getDb();
  const [mmPostRow] = await db
    .select()
    .from(mmPosts)
    .where(and(eq(mmPosts.tenantId, tenantId), eq(mmPosts.id, postId)));
  if (!mmPostRow) return;

  const ts = String(Date.now());
  if (liked) {
    const [existingReaction] = await db
      .select()
      .from(mmReactions)
      .where(
        and(
          eq(mmReactions.tenantId, tenantId),
          eq(mmReactions.postId, postId),
          eq(mmReactions.userId, userId),
          eq(mmReactions.emojiName, 'heart')
        )
      );
    if (!existingReaction) {
      const [inserted] = await db
        .insert(mmReactions)
        .values({
          id: `mmr_${crypto.randomUUID().slice(0, 10)}`,
          tenantId,
          userId,
          postId,
          emojiName: 'heart',
          createAt: ts,
        })
        .returning();
      mattermostHub.broadcastEvent({
        event: 'reaction_added',
        tenantId,
        channelId: mmPostRow.channelId,
        data: { reaction: JSON.stringify(toMattermostReaction(inserted)) },
      });
    }
  } else {
    const [existingReaction] = await db
      .select()
      .from(mmReactions)
      .where(
        and(
          eq(mmReactions.tenantId, tenantId),
          eq(mmReactions.postId, postId),
          eq(mmReactions.userId, userId),
          eq(mmReactions.emojiName, 'heart')
        )
      );
    if (existingReaction) {
      await db.delete(mmReactions).where(eq(mmReactions.id, existingReaction.id));
      mattermostHub.broadcastEvent({
        event: 'reaction_removed',
        tenantId,
        channelId: mmPostRow.channelId,
        data: { reaction: JSON.stringify(toMattermostReaction(existingReaction)) },
      });
    }
  }
}

export async function syncSocialPostDeletionToMattermost(
  postId: string,
  tenantId: string
): Promise<void> {
  const db = await getDb();
  const [mmPostRow] = await db
    .select()
    .from(mmPosts)
    .where(and(eq(mmPosts.tenantId, tenantId), eq(mmPosts.id, postId)));
  if (!mmPostRow) return;

  const nowStr = String(Date.now());
  await db.update(mmPosts).set({ deleteAt: nowStr, updateAt: nowStr }).where(eq(mmPosts.id, postId));
  await db
    .update(mmPosts)
    .set({ deleteAt: nowStr, updateAt: nowStr })
    .where(and(eq(mmPosts.tenantId, tenantId), eq(mmPosts.rootId, postId)));

  const deletedPost = toMattermostPost({ ...mmPostRow, deleteAt: nowStr });
  mattermostHub.broadcastEvent({
    event: 'post_deleted',
    tenantId,
    channelId: mmPostRow.channelId,
    data: { post: JSON.stringify(deletedPost) },
  });
}

export async function getUserProfilesForTenant(tenantId: string): Promise<UserProfile[]> {
  const db = await getDb();
  const [userRows, profileRows] = await Promise.all([
    db.select().from(users).where(eq(users.tenantId, tenantId)),
    db.select().from(socialProfiles).where(eq(socialProfiles.tenantId, tenantId)),
  ]);
  const profileMap = new Map(profileRows.map((p) => [p.userId, p]));
  return userRows.map((u) => toMattermostUserProfile(u, profileMap.get(u.id)));
}

export async function listChannelPostsSorted(
  tenantId: string,
  channelId: string
): Promise<PaginatedPostList> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(mmPosts)
    .where(
      and(
        eq(mmPosts.tenantId, tenantId),
        eq(mmPosts.channelId, channelId),
        eq(mmPosts.deleteAt, '0')
      )
    )
    .orderBy(desc(mmPosts.createAt));

  return hydrateMattermostPostList(rows, tenantId);
}

export async function listThreadPosts(tenantId: string, rootId: string): Promise<PostList> {
  const db = await getDb();
  const [rootRows, replyRows] = await Promise.all([
    db
      .select()
      .from(mmPosts)
      .where(and(eq(mmPosts.tenantId, tenantId), eq(mmPosts.id, rootId), eq(mmPosts.deleteAt, '0'))),
    db
      .select()
      .from(mmPosts)
      .where(
        and(eq(mmPosts.tenantId, tenantId), eq(mmPosts.rootId, rootId), eq(mmPosts.deleteAt, '0'))
      )
      .orderBy(asc(mmPosts.createAt)),
  ]);
  return hydrateMattermostPostList([...rootRows, ...replyRows], tenantId);
}
