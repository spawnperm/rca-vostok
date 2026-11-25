import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Check,
  Edit3,
  Heart,
  Link2,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Send,
  Share2,
  Trash2,
  Users,
  Vote,
  X,
} from 'lucide-react';
import { refineClient } from '../../application/refine/client.ts';
import { useVoiceSectionAction } from '../../application/voice/voiceActionBus.ts';
import type { AuthenticatedActor } from '../../domain/shared/types.ts';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Modal } from '../components/ui/Modal.tsx';

export interface SocialCabinetData {
  profile: {
    userId: string;
    fullName: string;
    handle: string;
    headline: string;
    department: string;
    city: string;
    coverUrl: string;
    avatarUrl: string;
    roleName: string;
    statusText: string;
    bio: string;
    skills: string[];
    friendsCount: number;
    followersCount: number;
  };
  posts: Array<{
    id: string;
    authorId: string;
    authorName: string;
    authorAvatar: string;
    content: string;
    attachmentType: string;
    attachmentData: Record<string, unknown>;
    likesCount: number;
    likedByMe: boolean;
    repostsCount: number;
    createdAt: string;
    comments: Array<{
      id: string;
      authorName: string;
      authorAvatar: string;
      body: string;
      createdAt: string;
    }>;
  }>;
  groups: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    membersCount: number;
    isJoined: boolean;
  }>;
  teamMembers: Array<{
    userId: string;
    fullName: string;
    avatarUrl: string;
    headline: string;
    department: string;
    city: string;
    statusText?: string;
    skills?: string[];
    isOnline: boolean;
  }>;
  attachableDeals: Array<{
    id: string;
    title: string;
    budget: number;
    currency: string;
  }>;
}

interface PluginStatusItem {
  npmPackageName: string;
  installed: boolean;
  enabled: boolean;
}

interface SocialProfileViewProps {
  actor: AuthenticatedActor;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
  onOpenDeals?: () => void;
  onOpenChat?: (target?: { channelName?: string; directUserId?: string }) => void;
}

export const SocialProfileView: React.FC<SocialProfileViewProps> = ({
  actor,
  onNotify,
  onOpenDeals,
  onOpenChat,
}) => {
  const [cabinet, setCabinet] = useState<SocialCabinetData | null>(null);
  const [plugins, setPlugins] = useState<PluginStatusItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'wall' | 'about' | 'team' | 'groups'>('wall');
  const [wallFilter, setWallFilter] = useState<'all' | 'deal' | 'poll'>('all');
  const [wallSearch, setWallSearch] = useState('');
  const [teamQuery, setTeamQuery] = useState('');
  const [teamDeptFilter, setTeamDeptFilter] = useState('all');
  const [groupQuery, setGroupQuery] = useState('');

  // Composer state
  const [postText, setPostText] = useState('');
  const [attachedDealId, setAttachedDealId] = useState('');
  const [showPollInput, setShowPollInput] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>([
    'Согласовано в работу',
    'Требует обсуждения на синке',
  ]);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Edit profile modal
  const [editingProfile, setEditingProfile] = useState(false);
  const [editHeadline, setEditHeadline] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editSkills, setEditSkills] = useState('');

  // Create group modal
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupCategory, setGroupCategory] = useState('Продажи');
  const [groupDesc, setGroupDesc] = useState('');

  // Team member inspector modal
  const [selectedMember, setSelectedMember] = useState<SocialCabinetData['teamMembers'][number] | null>(
    null
  );

  const loadCabinet = useCallback(async () => {
    setLoading(true);
    try {
      const [cabRes, plgRes] = await Promise.all([
        refineClient.request<SocialCabinetData>('/api/social/cabinet'),
        refineClient.can(actor, 'plugins:read')
          ? refineClient.request<{ plugins: PluginStatusItem[] }>('/api/marketplace/plugins')
          : Promise.resolve({ plugins: [] }),
      ]);
      setCabinet(cabRes);
      setPlugins(plgRes.plugins || []);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка загрузки ленты и профиля', 'err');
    } finally {
      setLoading(false);
    }
  }, [actor, onNotify]);

  useEffect(() => {
    void loadCabinet();
  }, [loadCabinet]);

  const canPost = refineClient.can(actor, 'social:post');
  const canModerate = refineClient.can(actor, 'social:moderate');

  useVoiceSectionAction('profile', (actionId) => {
    switch (actionId) {
      case 'profile.create_group':
        if (!canPost) return false;
        setActiveTab('groups');
        setGroupModalOpen(true);
        return true;
      case 'profile.tab_wall':
        setActiveTab('wall');
        return true;
      case 'profile.tab_about':
        setActiveTab('about');
        return true;
      case 'profile.tab_team':
        setActiveTab('team');
        return true;
      case 'profile.tab_groups':
        setActiveTab('groups');
        return true;
      case 'profile.refresh':
        void loadCabinet();
        return true;
      default:
        return false;
    }
  });
  const hasPollsPlugin = plugins.some(
    (p) => p.npmPackageName === '@nexus-plugins/vk-social-polls' && p.installed && p.enabled
  );

  const filteredPosts = useMemo(() => {
    if (!cabinet) return [];
    const q = wallSearch.trim().toLowerCase();
    return cabinet.posts.filter((p) => {
      if (wallFilter !== 'all' && p.attachmentType !== wallFilter) return false;
      if (!q) return true;
      return (
        p.content.toLowerCase().includes(q) ||
        p.authorName.toLowerCase().includes(q) ||
        String(p.attachmentData.dealTitle || '').toLowerCase().includes(q)
      );
    });
  }, [cabinet, wallFilter, wallSearch]);

  const teamDepartments = useMemo(() => {
    if (!cabinet) return [];
    return [...new Set(cabinet.teamMembers.map((m) => m.department).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'ru')
    );
  }, [cabinet]);

  const filteredTeam = useMemo(() => {
    if (!cabinet) return [];
    const q = teamQuery.trim().toLowerCase();
    return cabinet.teamMembers.filter((m) => {
      if (teamDeptFilter !== 'all' && m.department !== teamDeptFilter) return false;
      if (!q) return true;
      return (
        m.fullName.toLowerCase().includes(q) ||
        m.headline.toLowerCase().includes(q) ||
        m.department.toLowerCase().includes(q) ||
        m.city.toLowerCase().includes(q)
      );
    });
  }, [cabinet, teamQuery, teamDeptFilter]);

  const filteredGroups = useMemo(() => {
    if (!cabinet) return [];
    const q = groupQuery.trim().toLowerCase();
    if (!q) return cabinet.groups;
    return cabinet.groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q)
    );
  }, [cabinet, groupQuery]);

  if (loading && !cabinet) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
        Загрузка ленты и профиля команды...
      </div>
    );
  }

  if (!cabinet) {
    return (
      <EmptyState
        title="Профиль недоступен"
        description="Проверьте права доступа к модулю social:read."
      />
    );
  }

  const { profile, groups, teamMembers, attachableDeals } = cabinet;

  const openEditModal = () => {
    setEditHeadline(profile.headline);
    setEditDepartment(profile.department);
    setEditStatus(profile.statusText);
    setEditCity(profile.city);
    setEditBio(profile.bio);
    setEditSkills(profile.skills.join(', '));
    setEditingProfile(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await refineClient.request('/api/social/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          headline: editHeadline,
          department: editDepartment,
          statusText: editStatus,
          city: editCity,
          bio: editBio,
          skills: editSkills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      setEditingProfile(false);
      await loadCabinet();
      onNotify('Профиль кабинета обновлён');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка сохранения профиля', 'err');
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postText.trim()) return;

    let attachmentType: 'none' | 'deal' | 'poll' = 'none';
    let attachmentData: Record<string, unknown> = {};

    if (attachedDealId) {
      const deal = attachableDeals.find((d) => d.id === attachedDealId);
      if (deal) {
        attachmentType = 'deal';
        attachmentData = {
          dealId: deal.id,
          dealTitle: deal.title,
          budget: deal.budget,
          currency: deal.currency,
        };
      }
    } else if (showPollInput && pollQuestion.trim()) {
      const cleanOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (cleanOptions.length < 2) {
        onNotify('Добавьте минимум 2 варианта ответа для опроса', 'err');
        return;
      }
      attachmentType = 'poll';
      attachmentData = {
        question: pollQuestion.trim(),
        options: cleanOptions,
        votes: {},
      };
    }

    try {
      await refineClient.create('social/posts', {
        content: postText.trim(),
        attachmentType,
        attachmentData,
      });
      setPostText('');
      setAttachedDealId('');
      setPollQuestion('');
      setPollOptions(['Согласовано в работу', 'Требует обсуждения на синке']);
      setShowPollInput(false);
      await loadCabinet();
      onNotify('Запись опубликована на стене');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка публикации', 'err');
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await refineClient.deleteOne('social/posts', postId);
      await loadCabinet();
      onNotify('Публикация удалена');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка удаления публикации', 'err');
    }
  };

  const handleLike = async (postId: string) => {
    try {
      await refineClient.request(`/api/social/posts/${postId}/like`, { method: 'POST' });
      await loadCabinet();
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка лайка', 'err');
    }
  };

  const handleRepost = async (postId: string) => {
    try {
      await refineClient.request(`/api/social/posts/${postId}/repost`, { method: 'POST' });
      await loadCabinet();
      onNotify('Публикация отмечена как репост');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка репоста', 'err');
    }
  };

  const handleVotePoll = async (postId: string, optionIndex: number) => {
    try {
      await refineClient.request(`/api/social/posts/${postId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ optionIndex }),
      });
      await loadCabinet();
      onNotify('Голос учтён');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка голосования', 'err');
    }
  };

  const handleComment = async (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    const body = (commentInputs[postId] || '').trim();
    if (!body) return;
    try {
      await refineClient.request(`/api/social/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      await loadCabinet();
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка комментария', 'err');
    }
  };

  const handleToggleGroup = async (groupId: string) => {
    try {
      await refineClient.request(`/api/social/groups/${groupId}/toggle`, { method: 'POST' });
      await loadCabinet();
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка участия в группе', 'err');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await refineClient.create('social/groups', {
        name: groupName.trim(),
        category: groupCategory.trim(),
        description: groupDesc.trim(),
      });
      setGroupModalOpen(false);
      setGroupName('');
      setGroupDesc('');
      await loadCabinet();
      onNotify('Сообщество создано');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка создания группы', 'err');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Cover Header Card */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="relative h-44 w-full bg-slate-900">
          <img
            src={profile.coverUrl}
            alt="Обложка профиля"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
          <div className="absolute bottom-3.5 right-5 text-xs font-medium text-white/90">
            @{profile.handle} · {profile.department}
          </div>
        </div>

        <div className="relative px-6 pb-5">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-white bg-slate-200 shadow-sm">
                <img
                  src={profile.avatarUrl}
                  alt={profile.fullName}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="pt-10">
                <h1 className="text-xl font-bold text-slate-900">{profile.fullName}</h1>
                <p className="text-sm text-slate-600">
                  {profile.headline} · <span className="text-slate-500">{profile.roleName}</span>
                </p>
                {profile.statusText && (
                  <p className="mt-0.5 text-xs text-slate-500">{profile.statusText}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openEditModal}
                disabled={!canPost}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
              >
                <Edit3 className="h-3.5 w-3.5" /> Редактировать профиль
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  ['wall', 'Лента'],
                  ['about', 'Анкета'],
                  ['team', `Команда (${teamMembers.length})`],
                  ['groups', `Группы (${groups.length})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === key
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-500 tabular-nums">
              <span>{profile.friendsCount} коллег</span>
              <span aria-hidden="true">·</span>
              <span>{profile.followersCount} подписчиков</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {profile.city}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* WALL TAB */}
      {activeTab === 'wall' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            {onOpenChat && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3">
                <div className="flex items-center gap-2.5 text-xs text-blue-950">
                  <MessageCircle className="h-4 w-4 shrink-0 text-[#0077FF]" />
                  <span>
                    Новостная лента синхронизирована в реальном времени с каналом{' '}
                    <strong className="font-semibold">#Новостная лента</strong> в чате Mattermost.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChat({ channelName: 'news-feed' })}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#0077FF] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
                >
                  Открыть в чате →
                </button>
              </div>
            )}

            {/* Composer */}
            <form onSubmit={handleCreatePost} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <img
                  src={profile.avatarUrl}
                  alt={profile.fullName}
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                />
                <div className="flex-1">
                  <textarea
                    rows={2}
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    disabled={!canPost}
                    placeholder={
                      canPost
                        ? 'Что нового в проектах и воронке? Поделитесь с командой...'
                        : 'Нет прав на публикацию (social:post)'
                    }
                    className="w-full resize-none text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  />

                  {showPollInput && hasPollsPlugin && (
                    <div className="mt-2.5 rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs font-medium text-blue-900">
                        <span>Опрос команды (@nexus-plugins/vk-social-polls)</span>
                        <button
                          type="button"
                          onClick={() => setShowPollInput(false)}
                          className="text-slate-500 hover:text-slate-800"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={pollQuestion}
                        onChange={(e) => setPollQuestion(e.target.value)}
                        placeholder="Введите вопрос для голосования..."
                        className="w-full rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-xs outline-none"
                      />
                      <div className="space-y-1.5">
                        {pollOptions.map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) =>
                                setPollOptions((prev) =>
                                  prev.map((item, i) => (i === idx ? e.target.value : item))
                                )
                              }
                              placeholder={`Вариант ${idx + 1}`}
                              className="flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs outline-none"
                            />
                            {pollOptions.length > 2 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPollOptions((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="rounded p-1 text-slate-400 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        {pollOptions.length < 4 && (
                          <button
                            type="button"
                            onClick={() => setPollOptions((prev) => [...prev, ''])}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0077FF] hover:underline"
                          >
                            <Plus className="h-3 w-3" /> Добавить вариант
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={attachedDealId}
                        onChange={(e) => {
                          setAttachedDealId(e.target.value);
                          if (e.target.value) setShowPollInput(false);
                        }}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 outline-none"
                      >
                        <option value="">Прикрепить сделку amoCRM...</option>
                        {attachableDeals.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title} ({d.budget.toLocaleString('ru-RU')} ₽)
                          </option>
                        ))}
                      </select>

                      {hasPollsPlugin && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowPollInput((v) => !v);
                            setAttachedDealId('');
                          }}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs whitespace-nowrap ${
                            showPollInput
                              ? 'border-blue-300 bg-blue-50 text-blue-800'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Vote className="h-3.5 w-3.5 text-blue-600" /> Опрос
                        </button>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={!canPost || !postText.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      <Send className="h-3.5 w-3.5" /> Опубликовать
                    </button>
                  </div>
                </div>
              </div>
            </form>

            {/* Feed Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                {(
                  [
                    ['all', 'Все записи'],
                    ['deal', 'Со сделками'],
                    ['poll', 'Опросы'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setWallFilter(key)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      wallFilter === key
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={wallSearch}
                  onChange={(e) => setWallSearch(e.target.value)}
                  placeholder="Поиск по стене..."
                  className="w-52 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#0077FF] focus:bg-white"
                />
              </div>
            </div>

            {/* Wall Posts */}
            {filteredPosts.length === 0 ? (
              <EmptyState
                title="Записи не найдены"
                description="Попробуйте изменить фильтр или опубликуйте первую новость команды."
              />
            ) : (
              filteredPosts.map((post) => {
                const canDeletePost =
                  canPost && (post.authorId === actor.userId || canModerate);
                const pollOpts = Array.isArray(post.attachmentData.options)
                  ? (post.attachmentData.options as string[])
                  : [];
                const votesRecord =
                  post.attachmentData.votes && typeof post.attachmentData.votes === 'object'
                    ? (post.attachmentData.votes as Record<string, number>)
                    : {};
                const myVote = votesRecord[actor.userId];
                const totalVotes = Object.keys(votesRecord).length;

                return (
                  <article key={post.id} className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={post.authorAvatar}
                          alt={post.authorName}
                          referrerPolicy="no-referrer"
                          className="h-9 w-9 rounded-full object-cover"
                        />
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{post.authorName}</div>
                          <div className="text-xs text-slate-400 tabular-nums">
                            {new Date(post.createdAt).toLocaleString('ru-RU')}
                          </div>
                        </div>
                      </div>
                      {canDeletePost && (
                        <button
                          type="button"
                          onClick={() => void handleDeletePost(post.id)}
                          aria-label="Удалить запись"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-800">
                      {post.content}
                    </p>

                    {post.attachmentType === 'deal' && (
                      <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Briefcase className="h-4 w-4 shrink-0 text-[#0077FF]" />
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-slate-900">
                              {String(post.attachmentData.dealTitle || 'Сделка amoCRM')}
                            </div>
                            <div className="text-xs text-slate-500">Прикреплённая карточка сделки</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-semibold text-slate-900 tabular-nums">
                            {Number(post.attachmentData.budget || 0).toLocaleString('ru-RU')} ₽
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
                    )}

                    {post.attachmentType === 'doc' && (
                      <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                        <Link2 className="h-4 w-4 shrink-0 text-slate-600" />
                        <div>
                          <div className="text-xs font-semibold text-slate-900">
                            {String(post.attachmentData.title || 'Документ')}
                          </div>
                          <div className="text-xs text-slate-500">
                            {String(post.attachmentData.subtitle || '')}
                          </div>
                        </div>
                      </div>
                    )}

                    {post.attachmentType === 'poll' && (
                      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/35 p-3.5">
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-900">
                          <span>Опрос: {String(post.attachmentData.question || '')}</span>
                          <span className="text-[11px] font-normal text-slate-500 tabular-nums">
                            Голосов: {totalVotes}
                          </span>
                        </div>
                        <div className="mt-2.5 space-y-1.5">
                          {pollOpts.map((opt, idx) => {
                            const count = Object.values(votesRecord).filter((v) => v === idx).length;
                            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                            const chosen = myVote === idx;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => void handleVotePoll(post.id, idx)}
                                className={`relative w-full overflow-hidden rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                                  chosen
                                    ? 'border-[#0077FF] bg-white font-medium text-slate-900'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                }`}
                              >
                                <div
                                  className="absolute inset-y-0 left-0 bg-blue-100/70 transition-all"
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
                    )}

                    {/* Action Strip */}
                    <div className="mt-4 flex items-center gap-5 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      <button
                        type="button"
                        onClick={() => void handleLike(post.id)}
                        className={`inline-flex items-center gap-1.5 font-medium transition-colors ${
                          post.likedByMe ? 'text-red-600' : 'hover:text-slate-900'
                        }`}
                      >
                        <Heart className={`h-4 w-4 ${post.likedByMe ? 'fill-red-600' : ''}`} />
                        <span className="tabular-nums">{post.likesCount}</span>
                      </button>
                      <span className="inline-flex items-center gap-1.5">
                        <MessageCircle className="h-4 w-4" />
                        <span className="tabular-nums">{post.comments.length}</span>
                      </span>
                      <button
                        type="button"
                        disabled={!canPost}
                        onClick={() => void handleRepost(post.id)}
                        className="inline-flex items-center gap-1.5 hover:text-slate-900 disabled:opacity-50"
                        title="Поделиться записью"
                      >
                        <Share2 className="h-4 w-4" />
                        <span className="tabular-nums">{post.repostsCount}</span>
                      </button>
                    </div>

                    {/* Comments */}
                    {post.comments.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                        {post.comments.map((c) => (
                          <div key={c.id} className="flex items-start gap-2.5 text-xs">
                            <img
                              src={c.authorAvatar}
                              alt={c.authorName}
                              referrerPolicy="no-referrer"
                              className="h-7 w-7 shrink-0 rounded-full object-cover"
                            />
                            <div className="flex-1 rounded-lg bg-slate-50 px-3 py-2">
                              <span className="font-semibold text-slate-900">{c.authorName}</span>
                              <p className="mt-0.5 text-slate-700">{c.body}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {canPost && (
                      <form onSubmit={(e) => void handleComment(e, post.id)} className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={commentInputs[post.id] || ''}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          placeholder="Написать комментарий..."
                          className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:border-[#0077FF] focus:bg-white"
                        />
                        <button
                          type="submit"
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          Отправить
                        </button>
                      </form>
                    )}
                  </article>
                );
              })
            )}
          </div>

          {/* Right Info Sidebar */}
          <div className="space-y-4 lg:col-span-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">О сотруднике</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{profile.bio}</p>
              <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                Компетенции: {profile.skills.join(' · ')}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Команда</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('team')}
                  className="text-xs font-medium text-[#0077FF] hover:underline"
                >
                  Все
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {teamMembers.slice(0, 6).map((m) => (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => setSelectedMember(m)}
                    className="rounded-lg p-1 text-center hover:bg-slate-50"
                  >
                    <img
                      src={m.avatarUrl}
                      alt={m.fullName}
                      referrerPolicy="no-referrer"
                      className="mx-auto h-11 w-11 rounded-full object-cover"
                    />
                    <div className="mt-1 truncate text-[11px] font-medium text-slate-700">
                      {m.fullName.split(' ')[0]}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Группы и отделы</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('groups')}
                  className="text-xs font-medium text-[#0077FF] hover:underline"
                >
                  Каталог
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {groups.map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">{g.name}</div>
                      <div className="text-slate-500 tabular-nums">
                        {g.category} · {g.membersCount} уч.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleToggleGroup(g.id)}
                      className={`shrink-0 rounded-md px-2.5 py-1 font-medium whitespace-nowrap ${
                        g.isJoined
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-[#0077FF] text-white'
                      }`}
                    >
                      {g.isJoined ? 'В группе' : 'Вступить'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABOUT TAB */}
      {activeTab === 'about' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">Анкета профиля</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs text-slate-500">Должность</div>
              <div className="mt-0.5 font-medium text-slate-900">{profile.headline}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Подразделение</div>
              <div className="mt-0.5 font-medium text-slate-900">{profile.department}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Город</div>
              <div className="mt-0.5 font-medium text-slate-900">{profile.city}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Роль RBAC</div>
              <div className="mt-0.5 font-medium text-slate-900">{profile.roleName}</div>
            </div>
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="text-xs text-slate-500">О себе</div>
            <p className="mt-1 text-sm text-slate-700">{profile.bio}</p>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="text-xs text-slate-500">Навыки</div>
            <p className="mt-1 text-sm text-slate-700">{profile.skills.join(' · ')}</p>
          </div>
        </div>
      )}

      {/* TEAM TAB */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={teamQuery}
                onChange={(e) => setTeamQuery(e.target.value)}
                placeholder="Поиск сотрудника по имени, должности, городу..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#0077FF] focus:bg-white"
              />
            </div>
            {teamDepartments.length > 0 && (
              <select
                aria-label="Фильтр по отделу"
                value={teamDeptFilter}
                onChange={(e) => setTeamDeptFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0077FF]"
              >
                <option value="all">Все отделы</option>
                {teamDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            )}
          </div>

          {filteredTeam.length === 0 ? (
            <EmptyState
              title="Сотрудники не найдены"
              description="Измените строку поиска или выберите другой отдел."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTeam.map((m) => (
                <div
                  key={m.userId}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedMember(m)}
                    className="flex items-center gap-3.5 text-left"
                  >
                    <img
                      src={m.avatarUrl}
                      alt={m.fullName}
                      referrerPolicy="no-referrer"
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{m.fullName}</div>
                      <div className="truncate text-xs text-slate-600">{m.headline}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {m.department} · {m.city}
                      </div>
                    </div>
                  </button>
                  {onOpenChat && m.userId !== actor.userId && canPost && (
                    <button
                      type="button"
                      onClick={() => onOpenChat({ directUserId: m.userId })}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-[#0077FF]" /> Написать в чат (DM)
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* GROUPS TAB */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={groupQuery}
                onChange={(e) => setGroupQuery(e.target.value)}
                placeholder="Поиск по группам и отделам..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#0077FF] focus:bg-white"
              />
            </div>
            {canModerate && (
              <button
                type="button"
                onClick={() => setGroupModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" /> Создать группу
              </button>
            )}
          </div>

          {filteredGroups.length === 0 ? (
            <EmptyState
              title="Группы не найдены"
              description="Попробуйте изменить поисковый запрос или создайте новое сообщество."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {filteredGroups.map((g) => (
                <div
                  key={g.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{g.category}</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Users className="h-3.5 w-3.5" /> {g.membersCount}
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-slate-900">{g.name}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{g.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleToggleGroup(g.id)}
                    className={`mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium whitespace-nowrap ${
                      g.isJoined
                        ? 'border border-slate-200 bg-slate-50 text-slate-700'
                        : 'bg-[#0077FF] text-white hover:bg-blue-700'
                    }`}
                  >
                    {g.isJoined && <Check className="h-3.5 w-3.5" />}
                    {g.isJoined ? 'Вы участник' : 'Вступить в группу'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      <Modal
        open={editingProfile}
        onClose={() => setEditingProfile(false)}
        title="Редактировать профиль"
        subtitle={`@${profile.handle}`}
      >
        <form id="edit-profile-form" onSubmit={handleSaveProfile} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Должность / Заголовок</label>
            <input
              value={editHeadline}
              onChange={(e) => setEditHeadline(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Отдел</label>
              <input
                value={editDepartment}
                onChange={(e) => setEditDepartment(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Город</label>
              <input
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Статус</label>
            <input
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Компетенции (через запятую)</label>
            <input
              value={editSkills}
              onChange={(e) => setEditSkills(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">О себе</label>
            <textarea
              rows={3}
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingProfile(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Сохранить
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Group Modal */}
      <Modal
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        title="Новое корпоративное сообщество"
      >
        <form onSubmit={handleCreateGroup} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Название сообщества</label>
            <input
              required
              minLength={2}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enterprise Presale"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Категория</label>
            <input
              required
              value={groupCategory}
              onChange={(e) => setGroupCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Описание</label>
            <textarea
              rows={3}
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
              placeholder="Цели и регламент группы..."
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setGroupModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Создать группу
            </button>
          </div>
        </form>
      </Modal>

      {/* Team Member Inspector Modal */}
      <Modal
        open={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
        title={selectedMember?.fullName || ''}
        subtitle={selectedMember ? `${selectedMember.headline} · ${selectedMember.department}` : undefined}
      >
        {selectedMember && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <img
                src={selectedMember.avatarUrl}
                alt={selectedMember.fullName}
                referrerPolicy="no-referrer"
                className="h-16 w-16 rounded-full object-cover"
              />
              <div className="space-y-1 text-xs text-slate-600">
                <div className="font-medium text-slate-900">{selectedMember.statusText || 'В сети'}</div>
                <div className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {selectedMember.city}
                </div>
              </div>
            </div>
            {selectedMember.skills && selectedMember.skills.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <div className="text-xs font-medium text-slate-500">Компетенции</div>
                <div className="mt-1 text-xs text-slate-800">
                  {selectedMember.skills.join(' · ')}
                </div>
              </div>
            )}
            {onOpenChat && selectedMember.userId !== actor.userId && canPost && (
              <div className="flex justify-end border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    const uid = selectedMember.userId;
                    setSelectedMember(null);
                    onOpenChat({ directUserId: uid });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Написать в чат Mattermost
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
