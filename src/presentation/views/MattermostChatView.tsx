import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Client4, WebSocketClient, type WebSocketMessage } from '@mattermost/client';
import type { ChannelMembership, ServerChannel } from '@mattermost/types/channels';
import type { Post } from '@mattermost/types/posts';
import type { Reaction } from '@mattermost/types/reactions';
import type { Team } from '@mattermost/types/teams';
import type { UserProfile } from '@mattermost/types/users';
import {
  Briefcase,
  Check,
  Edit3,
  Hash,
  Heart,
  Link2,
  Lock,
  MessageCircle,
  MessageSquare,
  Newspaper,
  Pin,
  Plus,
  Radio,
  Search,
  Send,
  Share2,
  SmilePlus,
  Trash2,
  UserCircle2,
  Vote,
  X,
} from 'lucide-react';
import { refineClient } from '../../application/refine/client.ts';
import { useVoiceSectionAction } from '../../application/voice/voiceActionBus.ts';
import {
  getEmojiSymbol,
  MM_QUICK_EMOJIS,
  NEWS_FEED_CHANNEL_NAME,
} from '../../domain/mattermost/schemas.ts';
import type { AuthenticatedActor, TenantContext } from '../../domain/shared/types.ts';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Modal } from '../components/ui/Modal.tsx';

interface AttachableDeal {
  id: string;
  title: string;
  budget: number;
  currency: string;
}

interface MattermostChatViewProps {
  actor: AuthenticatedActor;
  tenant: TenantContext;
  initialChannelName?: string | null;
  initialDirectUserId?: string | null;
  onClearInitialTarget?: () => void;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
  onOpenDeals?: () => void;
  onOpenProfile?: () => void;
}

export const MattermostChatView: React.FC<MattermostChatViewProps> = ({
  actor,
  tenant,
  initialChannelName,
  initialDirectUserId,
  onClearInitialTarget,
  onNotify,
  onOpenDeals,
  onOpenProfile,
}) => {
  const client4 = useMemo(() => {
    const c = new Client4();
    c.setUrl('');
    c.setToken(refineClient.getToken() || '');
    c.setHeader('X-Tenant-Subdomain', tenant.subdomain);
    return c;
  }, [tenant.subdomain, actor.userId]);

  const wsClientRef = useRef<WebSocketClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  const [wsConnected, setWsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<Team | null>(null);
  const [channels, setChannels] = useState<ServerChannel[]>([]);
  const [channelMembers, setChannelMembers] = useState<Record<string, ChannelMembership>>({});
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});
  const [statusesMap, setStatusesMap] = useState<Record<string, string>>({});
  const [attachableDeals, setAttachableDeals] = useState<AttachableDeal[]>([]);

  const [activeChannelId, setActiveChannelId] = useState<string>('');
  const [postsById, setPostsById] = useState<Record<string, Post>>({});
  const [channelOrder, setChannelOrder] = useState<string[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Thread Drawer
  const [threadRootId, setThreadRootId] = useState<string | null>(null);
  const [threadPosts, setThreadPosts] = useState<Post[]>([]);
  const [threadReplyText, setThreadReplyText] = useState('');

  // Composer state
  const [composerText, setComposerText] = useState('');
  const [sending, setSending] = useState(false);
  const [attachedDealId, setAttachedDealId] = useState('');
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>([
    'Согласовано в работу',
    'Нужно обсудить на синке',
  ]);

  // News feed channel filters & inline edit
  const [feedFilter, setFeedFilter] = useState<'all' | 'deal' | 'poll'>('all');
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostText, setEditPostText] = useState('');
  const [emojiMenuPostId, setEmojiMenuPostId] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Post[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Typing indicators: channelId -> Map<userId, expiryMs>
  const [typingByChannel, setTypingByChannel] = useState<Record<string, Record<string, number>>>({});

  // Create Channel Modal
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelSlug, setNewChannelSlug] = useState('');
  const [newChannelType, setNewChannelType] = useState<'O' | 'P'>('O');
  const [newChannelPurpose, setNewChannelPurpose] = useState('');

  const canPost = refineClient.can(actor, 'social:post');
  const canModerate = refineClient.can(actor, 'social:moderate');

  useVoiceSectionAction('chat', (actionId) => {
    switch (actionId) {
      case 'chat.create_channel':
        if (!canPost) return false;
        setCreateChannelOpen(true);
        return true;
      case 'chat.refresh':
        void bootstrapMattermost();
        return true;
      default:
        return false;
    }
  });

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) || null,
    [channels, activeChannelId]
  );
  const isNewsFeedChannel = activeChannel?.name === NEWS_FEED_CHANNEL_NAME;

  const getUserDisplayName = useCallback(
    (userId: string) => {
      const u = usersMap[userId];
      if (!u) return 'Участник команды';
      return (
        u.props?.fullName ||
        [u.first_name, u.last_name].filter(Boolean).join(' ') ||
        u.username
      );
    },
    [usersMap]
  );

  const getUserAvatar = useCallback(
    (userId: string) => usersMap[userId]?.props?.avatarUrl || '',
    [usersMap]
  );

  const loadChannelPosts = useCallback(
    async (channelId: string) => {
      if (!channelId) return;
      setLoadingPosts(true);
      try {
        const list = await client4.getPosts(channelId);
        setPostsById((prev) => ({ ...prev, ...list.posts }));
        setChannelOrder(list.order);
        void client4.viewMyChannel(channelId).catch(() => {});
      } catch (err: unknown) {
        const msg = err instanceof Error && err.message ? err.message : 'Ошибка загрузки сообщений канала';
        onNotify(msg, 'err');
      } finally {
        setLoadingPosts(false);
      }
    },
    [client4, onNotify]
  );

  const loadThread = useCallback(
    async (rootId: string) => {
      try {
        const list = await client4.getPostThread(rootId);
        const ordered = [...list.order]
          .map((id) => list.posts[id])
          .filter((p): p is Post => Boolean(p))
          .sort((a, b) => a.create_at - b.create_at);
        setThreadPosts(ordered);
        setPostsById((prev) => ({ ...prev, ...list.posts }));
      } catch (err: unknown) {
        onNotify(err instanceof Error ? err.message : 'Ошибка загрузки треда', 'err');
      }
    },
    [client4, onNotify]
  );

  const bootstrapMattermost = useCallback(async () => {
    setLoading(true);
    try {
      const [myTeams, cabRes] = await Promise.all([
        client4.getMyTeams(),
        refineClient
          .request<{ attachableDeals: AttachableDeal[] }>('/api/social/cabinet')
          .catch(() => ({ attachableDeals: [] })),
      ]);

      setAttachableDeals(cabRes.attachableDeals || []);
      const primaryTeam = myTeams[0] || null;
      setTeam(primaryTeam);
      if (!primaryTeam) {
        setLoading(false);
        return;
      }

      const [myChannels, myMembers, teamUsers] = await Promise.all([
        client4.getMyChannels(primaryTeam.id),
        client4.getAllChannelsMembers(actor.userId),
        client4.getProfilesInTeam(primaryTeam.id),
      ]);

      setChannels(myChannels);
      const memberRecord: Record<string, ChannelMembership> = {};
      for (const m of myMembers) {
        memberRecord[m.channel_id] = m;
      }
      setChannelMembers(memberRecord);

      const uMap: Record<string, UserProfile> = {};
      for (const u of teamUsers) {
        uMap[u.id] = u;
      }
      setUsersMap(uMap);

      if (teamUsers.length > 0) {
        const statuses = await client4.getStatusesByIds(teamUsers.map((u) => u.id));
        const sMap: Record<string, string> = {};
        for (const s of statuses) {
          sMap[s.user_id] = s.status;
        }
        setStatusesMap(sMap);
      }

      // Resolve initial target channel (direct user, channel name, or default #news-feed)
      let targetChannelId = '';
      if (initialDirectUserId && initialDirectUserId !== actor.userId && canPost) {
        const dmChannel = await client4.createDirectChannel([actor.userId, initialDirectUserId]);
        setChannels((prev) =>
          prev.some((c) => c.id === dmChannel.id) ? prev : [...prev, dmChannel]
        );
        targetChannelId = dmChannel.id;
        onClearInitialTarget?.();
      } else if (initialChannelName) {
        const byName = myChannels.find((c) => c.name === initialChannelName);
        if (byName) targetChannelId = byName.id;
        onClearInitialTarget?.();
      }

      if (!targetChannelId) {
        const feedCh = myChannels.find((c) => c.name === NEWS_FEED_CHANNEL_NAME);
        targetChannelId = feedCh?.id || myChannels[0]?.id || '';
      }

      setActiveChannelId(targetChannelId);
      if (targetChannelId) {
        await loadChannelPosts(targetChannelId);
      }
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка инициализации Mattermost', 'err');
    } finally {
      setLoading(false);
    }
  }, [
    actor.userId,
    canPost,
    client4,
    initialChannelName,
    initialDirectUserId,
    loadChannelPosts,
    onClearInitialTarget,
    onNotify,
  ]);

  useEffect(() => {
    void bootstrapMattermost();
  }, [bootstrapMattermost]);

  const activeChannelIdRef = useRef(activeChannelId);
  const threadRootIdRef = useRef(threadRootId);
  const usersMapRef = useRef(usersMap);

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
  }, [activeChannelId]);

  useEffect(() => {
    threadRootIdRef.current = threadRootId;
  }, [threadRootId]);

  useEffect(() => {
    usersMapRef.current = usersMap;
  }, [usersMap]);

  // Connect official @mattermost/client WebSocketClient to /api/v4/websocket/:subdomain
  useEffect(() => {
    const token = refineClient.getToken();
    if (!token || !team) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v4/websocket/${encodeURIComponent(
      tenant.subdomain
    )}`;

    const wsClient = new WebSocketClient({
      clientPingInterval: 25000,
    });
    wsClientRef.current = wsClient;

    const syncPresenceAndStatuses = () => {
      if (activeChannelIdRef.current) {
        wsClient.updateActiveChannel(activeChannelIdRef.current);
      }
      const userIds = Object.keys(usersMapRef.current);
      if (userIds.length > 0) {
        wsClient.getStatusesByIds(userIds);
      }
    };

    const handleClose = () => {
      setWsConnected(false);
    };

    const handleMessage = (msg: WebSocketMessage) => {
      const msgData = (msg.data && typeof msg.data === 'object'
        ? msg.data
        : {}) as Record<string, unknown>;

      if (msg.event === 'hello') {
        setWsConnected(true);
        syncPresenceAndStatuses();
        return;
      }

      if (msg.event === 'status_change') {
        const uid = String(msgData.user_id || '');
        const status = String(msgData.status || 'offline');
        if (uid) {
          setStatusesMap((prev) => ({ ...prev, [uid]: status }));
        }
        return;
      }

      if (msg.event === 'typing') {
        const chId = String(msg.broadcast?.channel_id || '');
        const uid = String(msgData.user_id || '');
        if (chId && uid && uid !== actor.userId) {
          setTypingByChannel((prev) => ({
            ...prev,
            [chId]: { ...(prev[chId] || {}), [uid]: Date.now() + 3500 },
          }));
        }
        return;
      }

      if (msg.event === 'posted' && typeof msgData.post === 'string') {
        try {
          const post = JSON.parse(msgData.post) as Post;
          const currentChannelId = activeChannelIdRef.current;
          const currentThreadRootId = threadRootIdRef.current;

          let isNewPost = true;
          setPostsById((prev) => {
            isNewPost = !prev[post.id];
            const next = { ...prev, [post.id]: post };
            if (isNewPost && post.root_id && next[post.root_id]) {
              next[post.root_id] = {
                ...next[post.root_id],
                reply_count: (next[post.root_id].reply_count || 0) + 1,
              };
            }
            return next;
          });

          if (post.channel_id === currentChannelId) {
            setChannelOrder((prev) => (prev.includes(post.id) ? prev : [post.id, ...prev]));
            void client4.viewMyChannel(currentChannelId).catch(() => {});
          }

          if (currentThreadRootId && (post.root_id === currentThreadRootId || post.id === currentThreadRootId)) {
            setThreadPosts((prev) =>
              prev.some((p) => p.id === post.id)
                ? prev.map((p) => (p.id === post.id ? post : p))
                : [...prev, post]
            );
          }

          setChannels((prev) =>
            prev.map((c) =>
              c.id === post.channel_id
                ? {
                    ...c,
                    last_post_at: post.create_at,
                    total_msg_count: isNewPost ? (c.total_msg_count || 0) + 1 : c.total_msg_count,
                  }
                : c
            )
          );
        } catch {
          // Ignore malformed frame
        }
        return;
      }

      if (msg.event === 'post_edited' && typeof msgData.post === 'string') {
        try {
          const post = JSON.parse(msgData.post) as Post;
          setPostsById((prev) => ({ ...prev, [post.id]: post }));
          setThreadPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
        } catch {
          // Ignore
        }
        return;
      }

      if (msg.event === 'post_deleted' && typeof msgData.post === 'string') {
        try {
          const post = JSON.parse(msgData.post) as Post;
          setPostsById((prev) => {
            const next = { ...prev };
            delete next[post.id];
            return next;
          });
          setChannelOrder((prev) => prev.filter((id) => id !== post.id));
          setThreadPosts((prev) => prev.filter((p) => p.id !== post.id));
          if (threadRootIdRef.current === post.id) setThreadRootId(null);
        } catch {
          // Ignore
        }
        return;
      }

      if (msg.event === 'reaction_added' && typeof msgData.reaction === 'string') {
        try {
          const r = JSON.parse(msgData.reaction) as Reaction;
          setPostsById((prev) => {
            const target = prev[r.post_id];
            if (!target) return prev;
            const currentReactions = target.metadata?.reactions || [];
            if (
              currentReactions.some(
                (item) => item.user_id === r.user_id && item.emoji_name === r.emoji_name
              )
            ) {
              return prev;
            }
            return {
              ...prev,
              [r.post_id]: {
                ...target,
                metadata: {
                  ...target.metadata,
                  reactions: [...currentReactions, r],
                },
              },
            };
          });
        } catch {
          // Ignore
        }
        return;
      }

      if (msg.event === 'reaction_removed' && typeof msgData.reaction === 'string') {
        try {
          const r = JSON.parse(msgData.reaction) as Reaction;
          setPostsById((prev) => {
            const target = prev[r.post_id];
            if (!target) return prev;
            const currentReactions = target.metadata?.reactions || [];
            return {
              ...prev,
              [r.post_id]: {
                ...target,
                metadata: {
                  ...target.metadata,
                  reactions: currentReactions.filter(
                    (item) => !(item.user_id === r.user_id && item.emoji_name === r.emoji_name)
                  ),
                },
              },
            };
          });
        } catch {
          // Ignore
        }
        return;
      }

      if (msg.event === 'channel_created' || msg.event === 'direct_added') {
        void client4.getMyChannels(team.id).then(setChannels).catch(() => {});
      }
    };

    wsClient.addCloseListener(handleClose);
    wsClient.addMessageListener(handleMessage);
    wsClient.initialize(wsUrl, token);

    return () => {
      wsClient.removeCloseListener(handleClose);
      wsClient.removeMessageListener(handleMessage);
      wsClient.close();
      wsClientRef.current = null;
      setWsConnected(false);
    };
  }, [actor.userId, client4, team, tenant.subdomain]);

  // Periodically clear expired typing indicators
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setTypingByChannel((prev) => {
        let changed = false;
        const next: Record<string, Record<string, number>> = {};
        for (const [chId, map] of Object.entries(prev)) {
          const filtered: Record<string, number> = {};
          for (const [uid, exp] of Object.entries(map)) {
            if (exp > now) filtered[uid] = exp;
            else changed = true;
          }
          if (Object.keys(filtered).length > 0) next[chId] = filtered;
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleSelectChannel = async (channelId: string) => {
    setActiveChannelId(channelId);
    setThreadRootId(null);
    setSearchResults(null);
    setFeedFilter('all');
    wsClientRef.current?.updateActiveChannel(channelId);
    await loadChannelPosts(channelId);
  };

  const handleOpenDirectMessage = async (peerId: string) => {
    if (peerId === actor.userId || !canPost) return;
    try {
      const dm = await client4.createDirectChannel([actor.userId, peerId]);
      setChannels((prev) => (prev.some((c) => c.id === dm.id) ? prev : [...prev, dm]));
      await handleSelectChannel(dm.id);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка открытия личного чата', 'err');
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team) return;
    const slug = (newChannelSlug || newChannelName)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (slug.length < 2) {
      onNotify('Укажите латинский идентификатор канала (минимум 2 символа)', 'err');
      return;
    }

    try {
      const created = await client4.createChannel({
        team_id: team.id,
        name: slug,
        display_name: newChannelName.trim(),
        type: newChannelType,
        purpose: newChannelPurpose.trim(),
        header: newChannelPurpose.trim(),
      });
      setChannels((prev) => [...prev, created]);
      setCreateChannelOpen(false);
      setNewChannelName('');
      setNewChannelSlug('');
      setNewChannelPurpose('');
      await handleSelectChannel(created.id);
      onNotify(`Канал #${created.display_name} создан`);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка создания канала', 'err');
    }
  };

  const handleComposerChange = (val: string) => {
    setComposerText(val);
    if (activeChannelId && val.trim() && Date.now() - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = Date.now();
      wsClientRef.current?.userTyping(activeChannelId, '');
    }
  };

  const handleSendPost = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeChannel || !composerText.trim() || !canPost || sending) return;

    const props: Record<string, unknown> = {};
    if (isNewsFeedChannel && attachedDealId) {
      const deal = attachableDeals.find((d) => d.id === attachedDealId);
      if (deal) {
        props.attachmentType = 'deal';
        props.attachmentData = {
          dealId: deal.id,
          dealTitle: deal.title,
          budget: deal.budget,
          currency: deal.currency,
        };
      }
    } else if (isNewsFeedChannel && showPollBuilder && pollQuestion.trim()) {
      const cleanOpts = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (cleanOpts.length < 2) {
        onNotify('Добавьте минимум 2 варианта ответа для опроса', 'err');
        return;
      }
      props.attachmentType = 'poll';
      props.attachmentData = {
        question: pollQuestion.trim(),
        options: cleanOpts,
        votes: {},
      };
    }

    setSending(true);
    try {
      const created = await client4.createPost({
        channel_id: activeChannel.id,
        message: composerText.trim(),
        props,
      });
      setPostsById((prev) => ({ ...prev, [created.id]: created }));
      setChannelOrder((prev) => (prev.includes(created.id) ? prev : [created.id, ...prev]));
      setComposerText('');
      setAttachedDealId('');
      setShowPollBuilder(false);
      setPollQuestion('');
      setPollOptions(['Согласовано в работу', 'Нужно обсудить на синке']);
      window.setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка отправки сообщения', 'err');
    } finally {
      setSending(false);
    }
  };

  const handleSendThreadReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChannel || !threadRootId || !threadReplyText.trim() || !canPost) return;
    try {
      const reply = await client4.createPost({
        channel_id: activeChannel.id,
        root_id: threadRootId,
        message: threadReplyText.trim(),
      });
      setThreadPosts((prev) => (prev.some((p) => p.id === reply.id) ? prev : [...prev, reply]));
      setPostsById((prev) => {
        const root = prev[threadRootId];
        return {
          ...prev,
          [reply.id]: reply,
          ...(root
            ? { [threadRootId]: { ...root, reply_count: (root.reply_count || 0) + 1 } }
            : {}),
        };
      });
      setThreadReplyText('');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка ответа в тред', 'err');
    }
  };

  const handleToggleReaction = async (post: Post, emojiName: string) => {
    const reactions = post.metadata?.reactions || [];
    const mine = reactions.some((r) => r.user_id === actor.userId && r.emoji_name === emojiName);
    setEmojiMenuPostId(null);
    try {
      if (mine) {
        await client4.removeReaction(actor.userId, post.id, emojiName);
        setPostsById((prev) => ({
          ...prev,
          [post.id]: {
            ...post,
            metadata: {
              ...post.metadata,
              reactions: reactions.filter(
                (r) => !(r.user_id === actor.userId && r.emoji_name === emojiName)
              ),
            },
          },
        }));
      } else {
        const added = await client4.addReaction(actor.userId, post.id, emojiName);
        setPostsById((prev) => ({
          ...prev,
          [post.id]: {
            ...post,
            metadata: {
              ...post.metadata,
              reactions: [...reactions, added],
            },
          },
        }));
      }
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка реакции', 'err');
    }
  };

  const handleSaveEdit = async (postId: string) => {
    if (!editPostText.trim()) return;
    try {
      const updated = await client4.patchPost({ id: postId, message: editPostText.trim() });
      setPostsById((prev) => ({ ...prev, [postId]: updated }));
      setThreadPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
      setEditingPostId(null);
      setEditPostText('');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка редактирования', 'err');
    }
  };

  const handleTogglePin = async (post: Post) => {
    try {
      if (post.is_pinned) {
        await client4.unpinPost(post.id);
      } else {
        await client4.pinPost(post.id);
      }
      setPostsById((prev) => ({
        ...prev,
        [post.id]: { ...post, is_pinned: !post.is_pinned },
      }));
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка закрепления', 'err');
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await client4.deletePost(postId);
      setPostsById((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      setChannelOrder((prev) => prev.filter((id) => id !== postId));
      setThreadPosts((prev) => prev.filter((p) => p.id !== postId));
      if (threadRootId === postId) setThreadRootId(null);
      onNotify('Сообщение удалено');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка удаления сообщения', 'err');
    }
  };

  const handleVoteSocialPoll = async (socialPostId: string, optionIndex: number) => {
    try {
      await refineClient.request(`/api/social/posts/${socialPostId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ optionIndex }),
      });
      if (activeChannelId) {
        await loadChannelPosts(activeChannelId);
      }
      onNotify('Голос учтён в опросе');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка голосования', 'err');
    }
  };

  const handleRepostSocial = async (socialPostId: string) => {
    try {
      await refineClient.request(`/api/social/posts/${socialPostId}/repost`, { method: 'POST' });
      if (activeChannelId) {
        await loadChannelPosts(activeChannelId);
      }
      onNotify('Публикация отмечена как репост');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка репоста', 'err');
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team) return;
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await client4.searchPosts(team.id, searchQuery.trim(), false);
      setSearchResults(res.order.map((id) => res.posts[id]).filter(Boolean));
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка поиска сообщений', 'err');
    } finally {
      setSearching(false);
    }
  };

  const newsFeedChannel = useMemo(
    () => channels.find((c) => c.name === NEWS_FEED_CHANNEL_NAME) || null,
    [channels]
  );
  const publicAndPrivateChannels = useMemo(
    () => channels.filter((c) => c.type !== 'D' && c.name !== NEWS_FEED_CHANNEL_NAME),
    [channels]
  );
  const directChannels = useMemo(
    () => channels.filter((c) => c.type === 'D'),
    [channels]
  );
  const teammates = useMemo(
    () => Object.values(usersMap).filter((u) => u.id !== actor.userId),
    [usersMap, actor.userId]
  );

  // Build visible root posts in active channel
  const channelRootPosts = useMemo(() => {
    const rawPosts = channelOrder
      .map((id) => postsById[id])
      .filter((p): p is Post => Boolean(p) && p.delete_at === 0 && !p.root_id);

    const filtered = rawPosts.filter((p) => {
      if (!isNewsFeedChannel || feedFilter === 'all') return true;
      return String(p.props?.attachmentType || 'none') === feedFilter;
    });

    // News feed reads top-down (newest first) or chronological for chat rooms
    if (isNewsFeedChannel) {
      return [...filtered].sort((a, b) => b.create_at - a.create_at);
    }
    return [...filtered].sort((a, b) => a.create_at - b.create_at);
  }, [channelOrder, postsById, isNewsFeedChannel, feedFilter]);

  const activeTypingNames = useMemo(() => {
    const map = typingByChannel[activeChannelId] || {};
    return Object.keys(map)
      .filter((uid) => map[uid] > Date.now())
      .map((uid) => getUserDisplayName(uid));
  }, [typingByChannel, activeChannelId, getUserDisplayName]);

  const renderChannelLabel = (ch: ServerChannel) => {
    if (ch.type === 'D') {
      const peerId = ch.teammate_id || ch.name.split('__').find((p) => p !== actor.userId) || '';
      return getUserDisplayName(peerId);
    }
    return ch.display_name;
  };

  const renderSocialAttachments = (post: Post) => {
    const attType = String(post.props?.attachmentType || 'none');
    const attData = (
      post.props?.attachmentData && typeof post.props.attachmentData === 'object'
        ? post.props.attachmentData
        : {}
    ) as Record<string, unknown>;
    const socialPostId = String(post.props?.socialPostId || post.id);

    if (attType === 'deal') {
      return (
        <div className="mt-2.5 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Briefcase className="h-4 w-4 shrink-0 text-[#0077FF]" />
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-slate-900">
                {String(attData.dealTitle || 'Сделка amoCRM')}
              </div>
              <div className="text-[11px] text-slate-500">Карточка сделки из воронки</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xs font-semibold text-slate-900 tabular-nums">
              {Number(attData.budget || 0).toLocaleString('ru-RU')} ₽
            </span>
            {onOpenDeals && (
              <button
                type="button"
                onClick={onOpenDeals}
                className="text-xs font-medium text-[#0077FF] hover:underline whitespace-nowrap"
              >
                В воронку →
              </button>
            )}
          </div>
        </div>
      );
    }

    if (attType === 'doc') {
      return (
        <div className="mt-2.5 flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <Link2 className="h-4 w-4 shrink-0 text-slate-600" />
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-slate-900">
              {String(attData.title || 'Документ')}
            </div>
            <div className="truncate text-[11px] text-slate-500">
              {String(attData.subtitle || '')}
            </div>
          </div>
        </div>
      );
    }

    if (attType === 'poll') {
      const pollOpts = Array.isArray(attData.options) ? (attData.options as string[]) : [];
      const votesRecord =
        attData.votes && typeof attData.votes === 'object'
          ? (attData.votes as Record<string, number>)
          : {};
      const myVote = votesRecord[actor.userId];
      const totalVotes = Object.keys(votesRecord).length;

      return (
        <div className="mt-2.5 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-900">
            <span>Опрос: {String(attData.question || '')}</span>
            <span className="text-[11px] font-normal text-slate-500 tabular-nums">
              Голосов: {totalVotes}
            </span>
          </div>
          <div className="mt-2 space-y-1.5">
            {pollOpts.map((opt, idx) => {
              const count = Object.values(votesRecord).filter((v) => v === idx).length;
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              const chosen = myVote === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => void handleVoteSocialPoll(socialPostId, idx)}
                  className={`relative w-full overflow-hidden rounded-md border px-3 py-1.5 text-left text-xs transition-colors ${
                    chosen
                      ? 'border-[#0077FF] bg-white font-medium text-slate-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-blue-100/75 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5">
                      {chosen && <Check className="h-3.5 w-3.5 text-[#0077FF]" />}
                      {opt}
                    </span>
                    <span className="font-mono text-[11px] text-slate-600 tabular-nums">
                      {pct}% ({count})
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return null;
  };

  if (loading && !team) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-20 text-center text-sm text-slate-500">
        Подключение встроенного чата Mattermost и ленты новостей...
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-116px)] min-h-[580px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      {/* LEFT MATTERMOST CHANNEL & DM SIDEBAR */}
      <aside className="flex w-[268px] shrink-0 flex-col border-r border-slate-800 bg-[#182232] text-slate-300">
        {/* Team Header & WS Live Status */}
        <div className="border-b border-white/10 px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white">
                {team?.display_name || tenant.name}
              </div>
              <div className="text-[11px] text-slate-400">Mattermost Server v11 · {tenant.subdomain}</div>
            </div>
            <span
              title={wsConnected ? 'WebSocket v4 подключён' : 'Переподключение WebSocket'}
              className="inline-flex items-center gap-1 rounded-md bg-white/8 px-2 py-0.5 text-[10px] font-medium text-slate-200"
            >
              <Radio className={`h-3 w-3 ${wsConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
              {wsConnected ? 'Live' : 'Sync'}
            </span>
          </div>

          <form onSubmit={handleSearch} className="relative mt-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!e.target.value.trim()) setSearchResults(null);
              }}
              placeholder="Поиск по сообщениям..."
              className="w-full rounded-lg border border-white/10 bg-white/8 py-1.5 pl-8 pr-7 text-xs text-white placeholder:text-slate-400 outline-none focus:border-[#0077FF] focus:bg-white/12"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults(null);
                }}
                aria-label="Сбросить поиск"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-2.5 py-3">
          {/* Pinned Integrated Social Network News Feed Channel */}
          {newsFeedChannel && (
            <div>
              <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Лента соцсети
              </div>
              <button
                type="button"
                onClick={() => void handleSelectChannel(newsFeedChannel.id)}
                className={`mt-1.5 flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                  activeChannelId === newsFeedChannel.id
                    ? 'bg-[#0077FF] text-white'
                    : 'bg-white/6 text-slate-100 hover:bg-white/12'
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Newspaper className="h-4 w-4 shrink-0" />
                  <span className="truncate">{newsFeedChannel.display_name}</span>
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                    activeChannelId === newsFeedChannel.id
                      ? 'bg-white/20 text-white'
                      : 'bg-[#0077FF]/25 text-sky-300'
                  }`}
                >
                  {newsFeedChannel.total_msg_count_root || newsFeedChannel.total_msg_count}
                </span>
              </button>
            </div>
          )}

          {/* Public & Private Channels */}
          <div>
            <div className="flex items-center justify-between px-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Каналы ({publicAndPrivateChannels.length})
              </span>
              {canPost && (
                <button
                  type="button"
                  onClick={() => setCreateChannelOpen(true)}
                  title="Создать канал Mattermost"
                  aria-label="Создать канал"
                  className="rounded p-0.5 text-slate-400 hover:bg-white/10 hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="mt-1 space-y-0.5">
              {publicAndPrivateChannels.map((ch) => {
                const isActive = activeChannelId === ch.id;
                const membership = channelMembers[ch.id];
                const hasUnread =
                  !isActive &&
                  ch.last_post_at > (membership?.last_viewed_at || 0) &&
                  (ch.total_msg_count || 0) > (membership?.msg_count || 0);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => void handleSelectChannel(ch.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                      isActive
                        ? 'bg-[#0077FF] font-semibold text-white'
                        : hasUnread
                        ? 'font-semibold text-white hover:bg-white/8'
                        : 'text-slate-300 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {ch.type === 'P' ? (
                        <Lock className="h-3.5 w-3.5 shrink-0 opacity-80" />
                      ) : (
                        <Hash className="h-3.5 w-3.5 shrink-0 opacity-80" />
                      )}
                      <span className="truncate">{ch.display_name}</span>
                    </span>
                    {hasUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Direct Messages */}
          <div>
            <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Личные сообщения ({teammates.length})
            </div>
            <div className="mt-1 space-y-0.5">
              {teammates.map((u) => {
                const existingDm = directChannels.find(
                  (c) =>
                    c.teammate_id === u.id ||
                    c.name.split('__').includes(u.id)
                );
                const isActive = Boolean(existingDm && activeChannelId === existingDm.id);
                const isOnline = statusesMap[u.id] === 'online';
                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={!canPost && !existingDm}
                    onClick={() =>
                      existingDm
                        ? void handleSelectChannel(existingDm.id)
                        : void handleOpenDirectMessage(u.id)
                    }
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors disabled:opacity-50 ${
                      isActive
                        ? 'bg-[#0077FF] font-semibold text-white'
                        : 'text-slate-300 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="relative shrink-0">
                        {u.props?.avatarUrl ? (
                          <img
                            src={u.props.avatarUrl}
                            alt={getUserDisplayName(u.id)}
                            referrerPolicy="no-referrer"
                            className="h-5 w-5 rounded-full object-cover"
                          />
                        ) : (
                          <UserCircle2 className="h-5 w-5" />
                        )}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[#182232] ${
                            isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                          }`}
                        />
                      </span>
                      <span className="truncate">{getUserDisplayName(u.id)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      {/* CENTER STREAM: CHANNEL / INTEGRATED SOCIAL NEWS FEED */}
      <section className="flex min-w-0 flex-1 flex-col bg-[#F8FAFC]">
        {/* Channel Top Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {isNewsFeedChannel ? (
                <Newspaper className="h-4 w-4 shrink-0 text-[#0077FF]" />
              ) : activeChannel?.type === 'P' ? (
                <Lock className="h-4 w-4 shrink-0 text-slate-600" />
              ) : activeChannel?.type === 'D' ? (
                <MessageSquare className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <Hash className="h-4 w-4 shrink-0 text-slate-600" />
              )}
              <h1 className="truncate text-sm font-bold text-slate-900">
                {activeChannel ? renderChannelLabel(activeChannel) : 'Выберите канал'}
              </h1>
              {isNewsFeedChannel && (
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#0077FF]">
                  Единая лента соцсети
                </span>
              )}
            </div>
            {activeChannel?.header && (
              <p className="mt-0.5 truncate text-xs text-slate-500">{activeChannel.header}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isNewsFeedChannel && onOpenProfile && (
              <button
                type="button"
                onClick={onOpenProfile}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <UserCircle2 className="h-3.5 w-3.5 text-slate-500" /> Мой профиль
              </button>
            )}
            <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
              {Object.keys(usersMap).length} уч.
            </span>
          </div>
        </header>

        {/* Optional News Feed Filter Strip inside #news-feed */}
        {isNewsFeedChannel && !searchResults && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-5 py-2">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
              {(
                [
                  ['all', 'Все новости'],
                  ['deal', 'Со сделками amoCRM'],
                  ['poll', 'Опросы команды'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFeedFilter(key)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    feedFilter === key
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-500">
              Синхронизировано с разделом «Сообщество и профиль»
            </span>
          </div>
        )}

        {/* Search Results Overlay OR Live Stream */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {searchResults ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs text-blue-900">
                <span>
                  {searching
                    ? 'Поиск по базе сообщений...'
                    : `Найдено сообщений по запросу «${searchQuery}»: ${searchResults.length}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchResults(null);
                    setSearchQuery('');
                  }}
                  className="font-medium text-[#0077FF] hover:underline"
                >
                  Вернуться в канал
                </button>
              </div>
              {searchResults.length === 0 ? (
                <EmptyState
                  title="Ничего не найдено"
                  description="Попробуйте другое слово или фразу."
                />
              ) : (
                searchResults.map((p) => {
                  const ch = channels.find((c) => c.id === p.channel_id);
                  return (
                    <div
                      key={p.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-800">
                          {getUserDisplayName(p.user_id)} · #{ch ? renderChannelLabel(ch) : 'канал'}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleSelectChannel(p.channel_id)}
                          className="font-medium text-[#0077FF] hover:underline"
                        >
                          Перейти в канал →
                        </button>
                      </div>
                      <p className="mt-1.5 text-sm text-slate-800">{p.message}</p>
                    </div>
                  );
                })
              )}
            </div>
          ) : loadingPosts ? (
            <div className="py-12 text-center text-xs text-slate-500">Загрузка сообщений...</div>
          ) : channelRootPosts.length === 0 ? (
            <EmptyState
              title="Сообщений пока нет"
              description={
                isNewsFeedChannel
                  ? 'Опубликуйте первую новость, сделку amoCRM или опрос в ленте команды.'
                  : 'Начните обсуждение в этом канале Mattermost.'
              }
            />
          ) : (
            <div className="space-y-3">
              {channelRootPosts.map((post) => {
                const authorName = getUserDisplayName(post.user_id);
                const authorAvatar = getUserAvatar(post.user_id);
                const reactions = post.metadata?.reactions || [];
                const groupedReactions = reactions.reduce<
                  Record<string, { count: number; mine: boolean }>
                >((acc, r) => {
                  const cur = acc[r.emoji_name] || { count: 0, mine: false };
                  cur.count += 1;
                  if (r.user_id === actor.userId) cur.mine = true;
                  acc[r.emoji_name] = cur;
                  return acc;
                }, {});
                const canModify =
                  canPost && (post.user_id === actor.userId || canModerate);
                const isSocialRoot = isNewsFeedChannel || Boolean(post.props?.socialPostId);
                const socialPostId = String(post.props?.socialPostId || post.id);
                const heartCount = groupedReactions.heart?.count || 0;
                const heartMine = Boolean(groupedReactions.heart?.mine);

                return (
                  <article
                    key={post.id}
                    className={`rounded-xl border bg-white p-4 transition-colors ${
                      post.is_pinned ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {authorAvatar ? (
                          <img
                            src={authorAvatar}
                            alt={authorName}
                            referrerPolicy="no-referrer"
                            className="h-9 w-9 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                            {authorName.slice(0, 1)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {authorName}
                            </span>
                            {usersMap[post.user_id]?.position && (
                              <span className="text-[11px] text-slate-400">
                                {usersMap[post.user_id].position}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400 tabular-nums">
                              {new Date(post.create_at).toLocaleString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {post.edit_at > 0 && (
                              <span className="text-[11px] text-slate-400">(изменено)</span>
                            )}
                            {post.is_pinned && (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                                <Pin className="h-2.5 w-2.5" /> Закреплено
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quick post toolbar */}
                      <div className="relative flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setEmojiMenuPostId((cur) => (cur === post.id ? null : post.id))
                          }
                          title="Добавить реакцию"
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <SmilePlus className="h-3.5 w-3.5" />
                        </button>
                        {canPost && (
                          <button
                            type="button"
                            onClick={() => void handleTogglePin(post)}
                            title={post.is_pinned ? 'Открепить' : 'Закрепить'}
                            className={`rounded p-1 hover:bg-slate-100 ${
                              post.is_pinned ? 'text-amber-600' : 'text-slate-400 hover:text-slate-700'
                            }`}
                          >
                            <Pin className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canModify && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPostId(post.id);
                                setEditPostText(post.message);
                              }}
                              title="Редактировать"
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeletePost(post.id)}
                              title="Удалить"
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}

                        {emojiMenuPostId === post.id && (
                          <div className="absolute right-0 top-7 z-20 flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                            {MM_QUICK_EMOJIS.map((em) => (
                              <button
                                key={em.name}
                                type="button"
                                onClick={() => void handleToggleReaction(post, em.name)}
                                title={em.label}
                                className="rounded px-1.5 py-1 text-sm hover:bg-slate-100"
                              >
                                {em.symbol}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Message Body or Inline Edit */}
                    {editingPostId === post.id ? (
                      <div className="mt-2.5 space-y-2 pl-12">
                        <textarea
                          rows={2}
                          value={editPostText}
                          onChange={(e) => setEditPostText(e.target.value)}
                          className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingPostId(null)}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600"
                          >
                            Отмена
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSaveEdit(post.id)}
                            className="rounded-lg bg-[#0077FF] px-3 py-1 text-xs font-medium text-white"
                          >
                            Сохранить
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pl-12">
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-800">
                          {post.message}
                        </p>

                        {renderSocialAttachments(post)}

                        {/* Reactions + Thread & Social Footer */}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isSocialRoot && (
                              <button
                                type="button"
                                onClick={() => void handleToggleReaction(post, 'heart')}
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${
                                  heartMine
                                    ? 'border-red-200 bg-red-50 text-red-600'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <Heart className={`h-3.5 w-3.5 ${heartMine ? 'fill-red-600' : ''}`} />
                                <span className="tabular-nums">{heartCount}</span>
                              </button>
                            )}

                            {Object.entries(groupedReactions)
                              .filter(([emojiName]) => !(isSocialRoot && emojiName === 'heart'))
                              .map(([emojiName, info]) => (
                                <button
                                  key={emojiName}
                                  type="button"
                                  onClick={() => void handleToggleReaction(post, emojiName)}
                                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors ${
                                    info.mine
                                      ? 'border-blue-300 bg-blue-50 font-medium text-[#0077FF]'
                                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  <span>{getEmojiSymbol(emojiName)}</span>
                                  <span className="tabular-nums">{info.count}</span>
                                </button>
                              ))}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            {isSocialRoot && (
                              <button
                                type="button"
                                disabled={!canPost}
                                onClick={() => void handleRepostSocial(socialPostId)}
                                className="inline-flex items-center gap-1 hover:text-slate-900 disabled:opacity-50"
                                title="Поделиться публикацией"
                              >
                                <Share2 className="h-3.5 w-3.5" />
                                <span className="tabular-nums">
                                  {Number(post.props?.repostsCount || 0)}
                                </span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setThreadRootId(post.id);
                                void loadThread(post.id);
                              }}
                              className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-[#0077FF]"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              {post.reply_count > 0
                                ? `Ответов: ${post.reply_count}`
                                : 'Ответить в тред'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Mattermost Composer */}
        <footer className="border-t border-slate-200 bg-white px-5 py-3">
          {activeTypingNames.length > 0 && (
            <div className="mb-1.5 text-[11px] font-medium text-slate-500">
              {activeTypingNames.join(', ')} печатает...
            </div>
          )}

          {isNewsFeedChannel && showPollBuilder && (
            <div className="mb-3 space-y-2 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
              <div className="flex items-center justify-between text-xs font-semibold text-blue-950">
                <span>Опрос для новостной ленты</span>
                <button
                  type="button"
                  onClick={() => setShowPollBuilder(false)}
                  className="text-slate-500 hover:text-slate-800"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="Вопрос голосования..."
                className="w-full rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-xs outline-none"
              />
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {pollOptions.map((opt, idx) => (
                  <input
                    key={idx}
                    type="text"
                    value={opt}
                    onChange={(e) =>
                      setPollOptions((prev) =>
                        prev.map((item, i) => (i === idx ? e.target.value : item))
                      )
                    }
                    placeholder={`Вариант ${idx + 1}`}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs outline-none"
                  />
                ))}
              </div>
            </div>
          )}

          <form onSubmit={(e) => void handleSendPost(e)} className="space-y-2">
            <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 focus-within:border-[#0077FF] focus-within:bg-white">
              <textarea
                rows={2}
                value={composerText}
                disabled={!canPost || !activeChannel}
                onChange={(e) => handleComposerChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendPost();
                  }
                }}
                placeholder={
                  !canPost
                    ? 'Режим только для чтения (нет права social:post)'
                    : isNewsFeedChannel
                    ? 'Опубликовать новость в #новостная-лента (видно в ленте соцсети и в чате)...'
                    : `Написать в #${activeChannel ? renderChannelLabel(activeChannel) : 'канал'}...`
                }
                className="max-h-32 flex-1 resize-none bg-transparent px-1.5 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={!canPost || !composerText.trim() || sending}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isNewsFeedChannel ? 'Опубликовать' : 'Отправить'}</span>
              </button>
            </div>

            {isNewsFeedChannel && canPost && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={attachedDealId}
                  onChange={(e) => {
                    setAttachedDealId(e.target.value);
                    if (e.target.value) setShowPollBuilder(false);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 outline-none"
                >
                  <option value="">Прикрепить сделку amoCRM...</option>
                  {attachableDeals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.budget.toLocaleString('ru-RU')} ₽)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setShowPollBuilder((v) => !v);
                    setAttachedDealId('');
                  }}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs ${
                    showPollBuilder
                      ? 'border-blue-300 bg-blue-50 text-[#0077FF]'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Vote className="h-3.5 w-3.5 text-[#0077FF]" /> Опрос
                </button>
                <span className="text-[11px] text-slate-400">
                  Enter — отправить, Shift+Enter — перенос строки
                </span>
              </div>
            )}
          </form>
        </footer>
      </section>

      {/* RIGHT THREAD DRAWER */}
      {threadRootId && postsById[threadRootId] && (
        <aside className="flex w-[340px] shrink-0 flex-col border-l border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Тред обсуждения</h2>
              <p className="text-[11px] text-slate-500">
                #{activeChannel ? renderChannelLabel(activeChannel) : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setThreadRootId(null)}
              aria-label="Закрыть тред"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {threadPosts.map((tp, idx) => {
              const isRoot = idx === 0 || tp.id === threadRootId;
              const name = getUserDisplayName(tp.user_id);
              const avatar = getUserAvatar(tp.user_id);
              return (
                <div
                  key={tp.id}
                  className={
                    isRoot
                      ? 'rounded-xl border border-slate-200 bg-slate-50 p-3'
                      : 'flex items-start gap-2.5 text-xs'
                  }
                >
                  <div className="flex items-start gap-2.5">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={name}
                        referrerPolicy="no-referrer"
                        className="h-7 w-7 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-700">
                        {name.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-900">{name}</span>
                        <span className="text-[10px] text-slate-400 tabular-nums">
                          {new Date(tp.create_at).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-800">
                        {tp.message}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {canPost && (
            <form onSubmit={handleSendThreadReply} className="border-t border-slate-200 p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={threadReplyText}
                  onChange={(e) => setThreadReplyText(e.target.value)}
                  placeholder="Ответить в тред..."
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-[#0077FF] focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={!threadReplyText.trim()}
                  className="rounded-lg bg-[#0077FF] px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          )}
        </aside>
      )}

      {/* CREATE CHANNEL MODAL */}
      <Modal
        open={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
        title="Создать канал Mattermost"
        subtitle="Публичные каналы доступны всей команде тенанта"
      >
        <form onSubmit={handleCreateChannel} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Название канала</label>
            <input
              required
              minLength={2}
              value={newChannelName}
              onChange={(e) => {
                setNewChannelName(e.target.value);
                if (!newChannelSlug) {
                  setNewChannelSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_-]+/g, '-')
                      .replace(/^-+|-+$/g, '')
                  );
                }
              }}
              placeholder="Маркетинг и лиды"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              URL-идентификатор (латиница, - и _)
            </label>
            <input
              required
              minLength={2}
              value={newChannelSlug}
              onChange={(e) => setNewChannelSlug(e.target.value)}
              placeholder="marketing-leads"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Тип канала</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNewChannelType('O')}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                  newChannelType === 'O'
                    ? 'border-[#0077FF] bg-blue-50 text-[#0077FF]'
                    : 'border-slate-200 text-slate-700'
                }`}
              >
                <Hash className="h-3.5 w-3.5" /> Публичный
              </button>
              <button
                type="button"
                onClick={() => setNewChannelType('P')}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                  newChannelType === 'P'
                    ? 'border-[#0077FF] bg-blue-50 text-[#0077FF]'
                    : 'border-slate-200 text-slate-700'
                }`}
              >
                <Lock className="h-3.5 w-3.5" /> Приватный
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Назначение канала</label>
            <input
              value={newChannelPurpose}
              onChange={(e) => setNewChannelPurpose(e.target.value)}
              placeholder="Обсуждение рекламных кампаний и входящих заявок"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateChannelOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Создать канал
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
