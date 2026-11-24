import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Link2,
  MapPin,
  Save,
  Sparkles,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import {
  SocialApiError,
  mediaApi,
  socialApi,
  type ActivityItem,
  type SocialProfileData,
} from '../../utils/socialApi';
import { FeedSection } from './FeedSection';
import { ChatSection } from './ChatSection';
import { MediaLibrarySection } from '../media/MediaLibrarySection';

export type SocialTab = 'feed' | 'chat' | 'media' | 'about';

const TABS: { id: SocialTab; label: string }[] = [
  { id: 'feed', label: 'Лента, блог и CMS' },
  { id: 'chat', label: 'Чат' },
  { id: 'media', label: 'Медиатека' },
  { id: 'about', label: 'О себе' },
];

/** Title-cased role label used on the profile header. */
const ROLE_LABEL: Record<string, string> = {
  candidate: 'Соискатель',
  instructor: 'Инструктор-проводник',
  curator: 'Куратор РЦА',
  admin: 'Администратор',
};

export function SocialProfileSection({
  userId,
  currentUserId,
  userAvatarUrl,
  permissions,
  initialTab = 'feed',
}: {
  userId: string;
  currentUserId: string | null;
  userAvatarUrl?: string | null;
  permissions: string[];
  initialTab?: SocialTab;
}) {
  const [viewedUserId, setViewedUserId] = useState<string>(userId);
  const [profile, setProfile] = useState<SocialProfileData | null>(null);
  const [albumCount, setAlbumCount] = useState<number>(0);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [tab, setTab] = useState<SocialTab>(initialTab);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<boolean>(false);

  useEffect(() => {
    setViewedUserId(userId);
  }, [userId]);

  useEffect(() => {
    setAvatarError(false);
  }, [userAvatarUrl, viewedUserId]);

  const isOwn = viewedUserId === currentUserId;
  const can = (permission: string) => permissions.includes(permission);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, albumsRes] = await Promise.all([
        socialApi.profile(viewedUserId),
        mediaApi.albums({ ownerId: viewedUserId }).catch(() => ({ albums: [], total: 0 })),
      ]);
      setProfile(data);
      setAlbumCount(albumsRes.total);
      if (isOwn) {
        const res = await socialApi.activity(12);
        setActivity(res.activity);
      } else {
        setActivity([]);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось загрузить профиль.');
    } finally {
      setLoading(false);
    }
  }, [viewedUserId, isOwn]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshCounts = useCallback(async () => {
    try {
      const [data, albumsRes] = await Promise.all([
        socialApi.profile(viewedUserId),
        mediaApi.albums({ ownerId: viewedUserId }).catch(() => ({ albums: [], total: 0 })),
      ]);
      setProfile(data);
      setAlbumCount(albumsRes.total);
      if (isOwn) {
        const res = await socialApi.activity(12);
        setActivity(res.activity);
      }
    } catch {
      // Keep UI responsive if background count refresh fails.
    }
  }, [viewedUserId, isOwn]);

  const openAuthorProfile = (authorId: string) => {
    setViewedUserId(authorId);
    setTab('feed');
  };

  const follow = async () => {
    if (!profile) return;
    try {
      const res = await socialApi.follow(profile.userId, !profile.isFollowedByMe);
      setProfile({
        ...profile,
        isFollowedByMe: res.following,
        followerCount: res.followerCount,
      });
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось изменить подписку.');
    }
  };

  if (loading && !profile) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl p-8">
        <p className="text-sm text-slate-500">Загружаем профиль…</p>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl p-8">
        <p className="text-sm text-red-700">{error || 'Профиль недоступен.'}</p>
      </section>
    );
  }

  const showPhotoAvatar = Boolean(isOwn && userAvatarUrl && !avatarError);

  return (
    <div className="space-y-5">
      {!isOwn && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-700">
            Просмотр профиля участника: <span className="font-bold text-slate-900">{profile.displayName}</span>
          </p>
          <button
            type="button"
            onClick={() => setViewedUserId(userId)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:text-teal-950 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Вернуться в свой профиль
          </button>
        </div>
      )}

      {/* Profile header */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-teal-700 to-slate-700" aria-hidden="true" />
        <div className="px-6 pb-5">
          <div className="flex flex-wrap items-end justify-between gap-4 -mt-10">
            <div className="flex items-end gap-4">
              {showPhotoAvatar ? (
                <img
                  src={userAvatarUrl!}
                  alt={`Аватар ${profile.displayName}`}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="w-20 h-20 rounded-xl object-cover bg-white border-4 border-white shadow shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-white border-4 border-white shadow flex items-center justify-center text-2xl font-bold text-teal-700 shrink-0">
                  {profile.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="pb-1 space-y-1">
                <h2 className="text-lg font-bold text-slate-900">{profile.displayName}</h2>
                <p className="text-sm text-slate-600">
                  {profile.headline || ROLE_LABEL[profile.role] || profile.role}
                </p>
              </div>
            </div>

            {!isOwn && currentUserId && (
              <button
                type="button"
                onClick={follow}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  profile.isFollowedByMe
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {profile.isFollowedByMe ? (
                  <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                {profile.isFollowedByMe ? 'Вы подписаны' : 'Подписаться'}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-xs text-slate-600">
            {profile.region && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                {profile.region}
              </span>
            )}
            {profile.organisation && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                {profile.organisation}
              </span>
            )}
            {profile.websiteUrl && (
              <a
                href={profile.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-teal-700 hover:text-teal-900"
              >
                <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                сайт
              </a>
            )}
          </div>

          <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-slate-100">
            {[
              { label: 'публикаций', value: profile.postCount },
              { label: 'альбомов', value: albumCount },
              { label: 'подписчиков', value: profile.followerCount },
              { label: 'подписок', value: profile.followingCount },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-lg font-bold text-slate-900 tabular-nums">{stat.value}</p>
                <p className="text-[11px] text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === t.id
                ? 'text-teal-800 border-teal-700'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {tab === 'feed' && (
        <FeedSection
          canInteract={Boolean(currentUserId)}
          canPublishNews={can('social:moderate')}
          currentUserId={currentUserId}
          authorFilterUserId={!isOwn ? viewedUserId : undefined}
          onSelectAuthor={openAuthorProfile}
          onContentMutated={() => void refreshCounts()}
        />
      )}

      {tab === 'chat' && (
        <ChatSection
          canUseChat={can('chat:use')}
          canCreateChannel={can('chat:create_channel')}
          currentUserId={currentUserId}
          canModerate={can('chat:moderate')}
          onSelectAuthor={openAuthorProfile}
        />
      )}

      {tab === 'media' && (
        <MediaLibrarySection
          canUpload={can('media:upload')}
          canCreateAlbum={can('media:create_album')}
          canModerate={can('media:moderate')}
          currentUserId={currentUserId}
          ownerFilterUserId={!isOwn ? viewedUserId : undefined}
          onChanged={() => void refreshCounts()}
        />
      )}

      {tab === 'about' && (
        <AboutPanel
          profile={profile}
          activity={activity}
          canEdit={isOwn && can('profile:edit_own')}
          onSaved={setProfile}
          onError={setError}
        />
      )}
    </div>
  );
}

function AboutPanel({
  profile,
  activity,
  canEdit,
  onSaved,
  onError,
}: {
  profile: SocialProfileData;
  activity: ActivityItem[];
  canEdit: boolean;
  onSaved: (profile: SocialProfileData) => void;
  onError: (message: string) => void;
}) {
  const [headline, setHeadline] = useState<string>(profile.headline);
  const [bio, setBio] = useState<string>(profile.bio);
  const [websiteUrl, setWebsiteUrl] = useState<string>(profile.websiteUrl);
  const [skills, setSkills] = useState<string>(profile.skills.join(', '));
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    setHeadline(profile.headline);
    setBio(profile.bio);
    setWebsiteUrl(profile.websiteUrl);
    setSkills(profile.skills.join(', '));
  }, [profile]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await socialApi.updateProfile({
        headline,
        bio,
        websiteUrl,
        skills: skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      onSaved(updated);
    } catch (err) {
      onError(err instanceof SocialApiError ? err.message : 'Не удалось сохранить профиль.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-5">
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900">Профиль сообщества</h3>

          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="sp-headline" className="block text-xs font-medium text-slate-700">
                Короткая подпись
              </label>
              <input
                id="sp-headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                disabled={!canEdit}
                placeholder="Инструктор-проводник · водный туризм"
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none disabled:bg-slate-50"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sp-bio" className="block text-xs font-medium text-slate-700">
                О себе
              </label>
              <textarea
                id="sp-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                disabled={!canEdit}
                rows={5}
                placeholder="Опыт, маршруты, специализация…"
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none disabled:bg-slate-50 resize-y"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="sp-site" className="block text-xs font-medium text-slate-700">
                  Сайт
                </label>
                <input
                  id="sp-site"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  disabled={!canEdit}
                  placeholder="https://"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none disabled:bg-slate-50"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="sp-skills" className="block text-xs font-medium text-slate-700">
                  Навыки (через запятую)
                </label>
                <input
                  id="sp-skills"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  disabled={!canEdit}
                  placeholder="водный туризм, WFA"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none disabled:bg-slate-50"
                />
              </div>
            </div>

            {canEdit && (
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                {saving ? 'Сохраняем…' : 'Сохранить'}
              </button>
            )}
          </form>
        </section>

        {profile.skills.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h3 className="text-base font-bold text-slate-900 inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-700" aria-hidden="true" />
              Навыки и специализация
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 text-xs rounded-md"
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 h-fit">
        <h3 className="text-base font-bold text-slate-900">Активность</h3>
        {activity.length === 0 ? (
          <p className="text-sm text-slate-500">Пока нет событий.</p>
        ) : (
          <ul className="space-y-3">
            {activity.map((item) => (
              <li key={item.id} className="text-sm text-slate-700">
                <p>{item.summary}</p>
                <p className="text-[11px] text-slate-400">
                  {new Date(item.createdAt).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
