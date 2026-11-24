import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Camera,
  Check,
  ExternalLink,
  ImagePlus,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Upload,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  SocialApiError,
  mediaApi,
  socialApi,
  type ActivityItem,
  type MediaAssetData,
  type SocialProfileData,
} from '../../utils/socialApi';
import { buildRegionSelectOptions } from '../../data/dfoRegions';
import { GENERATED_GUIDE_AVATAR_PRESETS } from '../UserProfileCard';
import { FeedSection } from './FeedSection';
import { ChatSection } from './ChatSection';
import { MediaLibrarySection } from '../media/MediaLibrarySection';

export type SocialTab = 'feed' | 'chat' | 'media' | 'about';

const TABS: { id: SocialTab; label: string }[] = [
  { id: 'feed', label: 'Лента, блог и CMS' },
  { id: 'chat', label: 'Чат' },
  { id: 'media', label: 'Медиатека' },
  { id: 'about', label: 'О себе и контакты' },
];

/** Title-cased role label used on the profile header. */
const ROLE_LABEL: Record<string, string> = {
  candidate: 'Соискатель',
  instructor: 'Инструктор-проводник',
  curator: 'Куратор РЦА',
  admin: 'Администратор',
};

const COVER_PRESETS: readonly { id: string; title: string; url: string }[] = [
  {
    id: 'ridge',
    title: 'Сихотэ-Алинь · хребет',
    url: '/src/assets/images/primorye_expedition_hero_1795470723261.jpg',
  },
  {
    id: 'expedition',
    title: 'Горный переход ДФО',
    url: '/src/assets/images/primorye_ridge_expedition_1795333557369.jpg',
  },
  {
    id: 'rafting',
    title: 'Таёжный сплав',
    url: '/src/assets/images/river_rafting_taiga_1795333557039.jpg',
  },
  {
    id: 'trail',
    title: 'Оценка безопасности тропы',
    url: '/src/assets/images/trail_safety_assessment_1795333557526.jpg',
  },
];

const SUGGESTED_SKILLS: readonly string[] = [
  'Пеший туризм',
  'Водный туризм',
  'Горный туризм',
  'Первая помощь (WFA)',
  'Ски-тур',
  'Альпинизм',
  'ООПТ и экомаршруты',
  'Радиосвязь и навигация',
];

async function compressSocialImageToDataUrl(
  file: File,
  options: { width: number; height: number; maxLen: number }
): Promise<string> {
  if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
    throw new Error('Поддерживаются только изображения JPEG, PNG или WebP.');
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Не удалось прочитать выбранное изображение.'));
      el.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = options.width;
    canvas.height = options.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Браузер не поддерживает обработку изображений.');
    }

    const scale = Math.max(options.width / img.width, options.height / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (options.width - dw) / 2, (options.height - dh) / 2, dw, dh);

    const high = canvas.toDataURL('image/jpeg', 0.85);
    if (high.length <= options.maxLen) return high;
    const medium = canvas.toDataURL('image/jpeg', 0.7);
    if (medium.length <= options.maxLen) return medium;
    return canvas.toDataURL('image/jpeg', 0.55);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function formatWebsiteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
}

function formatSocialLinkLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, '');
    const path = parsed.pathname.replace(/\/$/, '');
    return path && path !== '/' ? `${host}${path}` : host;
  } catch {
    return url;
  }
}

function toTelegramHref(handle: string): string {
  const clean = handle.trim().replace(/^@/, '');
  return `https://t.me/${encodeURIComponent(clean)}`;
}

export function SocialProfileSection({
  userId,
  currentUserId,
  userAvatarUrl,
  userEmail,
  permissions,
  initialTab = 'feed',
  onProfileSynced,
}: {
  userId: string;
  currentUserId: string | null;
  userAvatarUrl?: string | null;
  userEmail?: string;
  permissions: string[];
  initialTab?: SocialTab;
  onProfileSynced?: (profile: SocialProfileData) => void;
}) {
  const [viewedUserId, setViewedUserId] = useState<string>(userId);
  const [profile, setProfile] = useState<SocialProfileData | null>(null);
  const [albumCount, setAlbumCount] = useState<number>(0);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [tab, setTab] = useState<SocialTab>(initialTab);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<boolean>(false);
  const [coverError, setCoverError] = useState<boolean>(false);
  const [studioMode, setStudioMode] = useState<'none' | 'avatar' | 'cover'>('none');
  const [mediaBusy, setMediaBusy] = useState<boolean>(false);
  const [libraryImages, setLibraryImages] = useState<MediaAssetData[]>([]);
  const [libraryLoaded, setLibraryLoaded] = useState<boolean>(false);
  const aboutEditorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setViewedUserId(userId);
  }, [userId]);

  useEffect(() => {
    setAvatarError(false);
    setCoverError(false);
    setStudioMode('none');
  }, [userAvatarUrl, viewedUserId]);

  const isOwn = viewedUserId === currentUserId;
  const can = (permission: string) => permissions.includes(permission);
  const canEdit = isOwn && can('profile:edit_own');

  const showTransientNotice = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => {
      setNotice((current) => (current === text ? null : current));
    }, 4000);
  }, []);

  const applySavedProfile = useCallback(
    (updated: SocialProfileData, message?: string) => {
      setProfile(updated);
      setAvatarError(false);
      setCoverError(false);
      setError(null);
      if (isOwn && onProfileSynced) {
        onProfileSynced(updated);
      }
      if (message) {
        showTransientNotice(message);
      }
    },
    [isOwn, onProfileSynced, showTransientNotice]
  );

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

  const openStudio = async (mode: 'avatar' | 'cover') => {
    const next = studioMode === mode ? 'none' : mode;
    setStudioMode(next);
    if (next !== 'none' && currentUserId && !libraryLoaded) {
      try {
        const res = await mediaApi.assets({ ownerId: currentUserId, kind: 'image' });
        setLibraryImages(res.assets);
        setLibraryLoaded(true);
      } catch {
        setLibraryLoaded(true);
      }
    }
  };

  const openProfileEditor = (focusFieldId?: string) => {
    setStudioMode('none');
    setTab('about');
    window.setTimeout(() => {
      if (focusFieldId) {
        const el = document.getElementById(focusFieldId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
          return;
        }
      }
      aboutEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const saveQuickMedia = async (
    payload: {
      avatarUrl?: string;
      coverUrl?: string;
      avatarAssetId?: string | null;
      coverAssetId?: string | null;
    },
    message: string
  ) => {
    setMediaBusy(true);
    setError(null);
    try {
      const updated = await socialApi.updateProfile(payload);
      applySavedProfile(updated, message);
      setStudioMode('none');
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось обновить оформление профиля.');
    } finally {
      setMediaBusy(false);
    }
  };

  const handleUploadMediaFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
    kind: 'avatar' | 'cover'
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setMediaBusy(true);
    setError(null);
    try {
      if (kind === 'avatar') {
        const dataUrl = await compressSocialImageToDataUrl(file, {
          width: 256,
          height: 256,
          maxLen: 175_000,
        });
        const updated = await socialApi.updateProfile({ avatarUrl: dataUrl });
        applySavedProfile(updated, 'Фотография аватара обновлена.');
      } else {
        const dataUrl = await compressSocialImageToDataUrl(file, {
          width: 1280,
          height: 420,
          maxLen: 310_000,
        });
        const updated = await socialApi.updateProfile({ coverUrl: dataUrl });
        applySavedProfile(updated, 'Обложка профиля обновлена.');
      }
      setStudioMode('none');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось загрузить и сохранить изображение.'
      );
    } finally {
      setMediaBusy(false);
    }
  };

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

  const completion = useMemo(() => {
    if (!profile) return { filled: 0, total: 5, percent: 0, missing: [] as { label: string; action: () => void }[] };
    const effectiveAvatar =
      profile.avatarUrl ||
      (profile.avatarAssetId ? `/media/${profile.avatarAssetId}` : '') ||
      (isOwn ? userAvatarUrl || '' : '');
    const effectiveCover =
      profile.coverUrl || (profile.coverAssetId ? `/media/${profile.coverAssetId}` : '');
    const hasContacts = Boolean(
      profile.phone || profile.telegram || profile.publicEmail || profile.vkUrl || profile.websiteUrl
    );
    const hasBio = Boolean(profile.headline.trim() || profile.bio.trim());
    const hasSkills = profile.skills.length > 0;

    const checks = [
      { ok: Boolean(effectiveCover), label: 'Обложка', action: () => void openStudio('cover') },
      { ok: Boolean(effectiveAvatar), label: 'Аватар', action: () => void openStudio('avatar') },
      { ok: hasContacts, label: 'Контакты', action: () => openProfileEditor('sp-phone') },
      { ok: hasBio, label: 'О себе', action: () => openProfileEditor('sp-headline') },
      { ok: hasSkills, label: 'Навыки', action: () => openProfileEditor('sp-skill-input') },
    ];
    const filled = checks.filter((c) => c.ok).length;
    return {
      filled,
      total: checks.length,
      percent: Math.round((filled / checks.length) * 100),
      missing: checks.filter((c) => !c.ok),
    };
  }, [profile, isOwn, userAvatarUrl]);

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

  const resolvedAvatarUrl =
    profile.avatarUrl ||
    (profile.avatarAssetId ? `/media/${profile.avatarAssetId}` : '') ||
    (isOwn ? userAvatarUrl || '' : '');
  const resolvedCoverUrl =
    profile.coverUrl || (profile.coverAssetId ? `/media/${profile.coverAssetId}` : '');

  const showPhotoAvatar = Boolean(resolvedAvatarUrl && !avatarError);
  const showPhotoCover = Boolean(resolvedCoverUrl && !coverError);
  const hasAnyContact = Boolean(
    profile.phone || profile.telegram || profile.publicEmail || profile.vkUrl || profile.websiteUrl
  );

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

      {/* Profile header with editable cover, avatar, contacts & profile controls */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="relative h-40 sm:h-48 bg-gradient-to-br from-slate-900 via-teal-900 to-slate-800">
          {showPhotoCover ? (
            <img
              src={resolvedCoverUrl}
              alt={`Обложка профиля ${profile.displayName}`}
              referrerPolicy="no-referrer"
              onError={() => setCoverError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <svg
              className="w-full h-full opacity-20"
              viewBox="0 0 1200 240"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M0 185 Q 240 120 480 165 T 960 135 T 1200 170 L 1200 240 L 0 240 Z"
                fill="currentColor"
                className="text-teal-300"
              />
              <path
                d="M0 205 Q 310 155 610 190 T 1200 160"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-white"
              />
            </svg>
          )}
          <div
            className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/20 to-transparent pointer-events-none"
            aria-hidden="true"
          />

          {canEdit && (
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void openStudio('cover')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-950/75 hover:bg-slate-950/90 border border-white/25 rounded-lg backdrop-blur-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                {studioMode === 'cover' ? 'Скрыть редактор обложки' : 'Изменить обложку'}
              </button>
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 min-w-0">
              <div className="relative shrink-0 w-24 h-24 sm:w-28 sm:h-28">
                {showPhotoAvatar ? (
                  <img
                    src={resolvedAvatarUrl}
                    alt={`Аватар ${profile.displayName}`}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    className="w-full h-full rounded-2xl object-cover bg-white border-4 border-white shadow-sm"
                  />
                ) : (
                  <div className="w-full h-full rounded-2xl bg-slate-100 border-4 border-white shadow-sm flex items-center justify-center text-3xl font-bold text-teal-800">
                    {profile.displayName.slice(0, 1).toUpperCase()}
                  </div>
                )}

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void openStudio('avatar')}
                    aria-label="Изменить аватар профиля"
                    title="Изменить аватар"
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-slate-900 text-white border-2 border-white flex items-center justify-center hover:bg-teal-800 transition-colors shadow-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  >
                    <Camera className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="pt-1 sm:pb-1 space-y-1 min-w-0">
                <h2 className="text-xl font-bold text-slate-900 truncate">{profile.displayName}</h2>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-slate-600">
                  <span className="font-medium text-teal-800">
                    {ROLE_LABEL[profile.role] || profile.role}
                  </span>
                  {profile.headline && (
                    <>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="text-slate-700">{profile.headline}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => void openStudio('avatar')}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      studioMode === 'avatar'
                        ? 'bg-teal-50 border-teal-300 text-teal-800'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                    Аватар
                  </button>
                  <button
                    type="button"
                    onClick={() => openProfileEditor('sp-display-name')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    Редактировать профиль
                  </button>
                </>
              )}

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
          </div>

          {/* Inline Avatar Studio */}
          {canEdit && studioMode === 'avatar' && (
            <MediaStudioPanel
              kind="avatar"
              currentUrl={resolvedAvatarUrl}
              busy={mediaBusy}
              libraryImages={libraryImages}
              onUpload={(e) => void handleUploadMediaFile(e, 'avatar')}
              onSelectUrl={(url) =>
                void saveQuickMedia({ avatarUrl: url, avatarAssetId: null }, 'Аватар профиля обновлён.')
              }
              onReset={() =>
                void saveQuickMedia({ avatarUrl: '', avatarAssetId: null }, 'Аватар сброшен на инициалы.')
              }
              onClose={() => setStudioMode('none')}
            />
          )}

          {/* Inline Cover Studio */}
          {canEdit && studioMode === 'cover' && (
            <MediaStudioPanel
              kind="cover"
              currentUrl={resolvedCoverUrl}
              busy={mediaBusy}
              libraryImages={libraryImages}
              onUpload={(e) => void handleUploadMediaFile(e, 'cover')}
              onSelectUrl={(url) =>
                void saveQuickMedia({ coverUrl: url, coverAssetId: null }, 'Обложка профиля обновлена.')
              }
              onReset={() =>
                void saveQuickMedia({ coverUrl: '', coverAssetId: null }, 'Обложка сброшена к стандартной.')
              }
              onClose={() => setStudioMode('none')}
            />
          )}

          {/* Region, organisation & public contacts strip */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5 text-xs text-slate-600">
            {profile.region && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                {profile.region}
              </span>
            )}
            {profile.organisation && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                {profile.organisation}
              </span>
            )}
            {profile.phone && (
              <a
                href={`tel:${profile.phone.replace(/[^\d+]/g, '')}`}
                className="inline-flex items-center gap-1.5 text-slate-700 hover:text-teal-800"
              >
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                {profile.phone}
              </a>
            )}
            {profile.telegram && (
              <a
                href={toTelegramHref(profile.telegram)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-teal-800 hover:text-teal-950"
              >
                <MessageCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {profile.telegram}
              </a>
            )}
            {profile.publicEmail && (
              <a
                href={`mailto:${profile.publicEmail}`}
                className="inline-flex items-center gap-1.5 text-teal-800 hover:text-teal-950"
              >
                <Mail className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {profile.publicEmail}
              </a>
            )}
            {profile.vkUrl && (
              <a
                href={profile.vkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-teal-800 hover:text-teal-950"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {formatSocialLinkLabel(profile.vkUrl)}
              </a>
            )}
            {profile.websiteUrl && (
              <a
                href={profile.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-teal-800 hover:text-teal-950"
              >
                <Link2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {formatWebsiteLabel(profile.websiteUrl)}
              </a>
            )}
            {canEdit && !hasAnyContact && (
              <button
                type="button"
                onClick={() => openProfileEditor('sp-phone')}
                className="inline-flex items-center gap-1 text-teal-800 font-medium hover:text-teal-950 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Добавить контакты и ссылки
              </button>
            )}
          </div>

          {profile.skills.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-slate-600">
              <span className="font-medium text-slate-500">Компетенции:</span>
              <span>{profile.skills.join(' · ')}</span>
            </div>
          )}

          {/* Stats & completeness row */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-5 pt-4 border-t border-slate-100">
            <div className="flex flex-wrap gap-6">
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

            {canEdit && completion.missing.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="tabular-nums font-medium text-slate-700">
                  Заполненность: {completion.filled}/{completion.total}
                </span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                {completion.missing.slice(0, 3).map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    className="text-teal-800 hover:text-teal-950 font-medium whitespace-nowrap cursor-pointer"
                  >
                    + {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {notice && (
        <p
          role="status"
          className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 flex items-center gap-2"
        >
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

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
          onChanged={() => {
            setLibraryLoaded(false);
            void refreshCounts();
          }}
        />
      )}

      {tab === 'about' && (
        <div ref={aboutEditorRef}>
          <AboutAndContactsPanel
            profile={profile}
            activity={activity}
            canEdit={canEdit}
            accountEmail={isOwn ? userEmail : undefined}
            onSaved={(updated) => applySavedProfile(updated, 'Профиль и контакты сохранены.')}
            onError={setError}
          />
        </div>
      )}
    </div>
  );
}

function MediaStudioPanel({
  kind,
  currentUrl,
  busy,
  libraryImages,
  onUpload,
  onSelectUrl,
  onReset,
  onClose,
}: {
  kind: 'avatar' | 'cover';
  currentUrl: string;
  busy: boolean;
  libraryImages: MediaAssetData[];
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectUrl: (url: string) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const presets =
    kind === 'avatar'
      ? GENERATED_GUIDE_AVATAR_PRESETS.map((p) => ({ id: p.id, title: p.title, url: p.url }))
      : COVER_PRESETS.map((p) => ({ id: p.id, title: p.title, url: p.url }));

  return (
    <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            {kind === 'avatar' ? 'Редактирование аватара' : 'Редактирование обложки профиля'}
          </h3>
          <p className="text-xs text-slate-500">
            {kind === 'avatar'
              ? 'Загрузите своё фото, выберите изображение из Медиатеки или встроенный портрет проводника.'
              : 'Загрузите широкоформатное фото (16:9), выберите кадр из Медиатеки или экспедиционную обложку.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onUpload}
            className="hidden"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            {busy ? 'Сохраняем…' : 'Загрузить файл'}
          </button>

          {currentUrl && (
            <button
              type="button"
              disabled={busy}
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Сбросить
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть панель"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/70 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-700">Готовые варианты РЦА</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {presets.map((preset) => {
            const active = currentUrl === preset.url;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={busy}
                onClick={() => onSelectUrl(preset.url)}
                className={`group text-left rounded-lg overflow-hidden border transition-colors cursor-pointer ${
                  active
                    ? 'border-teal-700 ring-2 ring-teal-600/25 bg-white'
                    : 'border-slate-200 bg-white hover:border-slate-400'
                }`}
              >
                <div className={kind === 'avatar' ? 'aspect-square bg-slate-100' : 'aspect-video bg-slate-100'}>
                  <img
                    src={preset.url}
                    alt={preset.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="px-2 py-1.5 text-[11px] font-medium text-slate-700 truncate">
                  {preset.title}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {libraryImages.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-700">Из вашей Медиатеки</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {libraryImages.slice(0, 12).map((asset) => {
              const url = asset.url || `/media/${asset.id}`;
              const active = currentUrl === url;
              return (
                <button
                  key={asset.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onSelectUrl(url)}
                  title={asset.title}
                  className={`rounded-lg overflow-hidden border transition-colors cursor-pointer ${
                    active ? 'border-teal-700 ring-2 ring-teal-600/25' : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <div className={kind === 'avatar' ? 'aspect-square bg-slate-100' : 'aspect-video bg-slate-100'}>
                    <img
                      src={url}
                      alt={asset.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AboutAndContactsPanel({
  profile,
  activity,
  canEdit,
  accountEmail,
  onSaved,
  onError,
}: {
  profile: SocialProfileData;
  activity: ActivityItem[];
  canEdit: boolean;
  accountEmail?: string;
  onSaved: (profile: SocialProfileData) => void;
  onError: (message: string | null) => void;
}) {
  const [displayName, setDisplayName] = useState<string>(profile.displayName);
  const [headline, setHeadline] = useState<string>(profile.headline);
  const [region, setRegion] = useState<string>(profile.region);
  const [organisation, setOrganisation] = useState<string>(profile.organisation);
  const [bio, setBio] = useState<string>(profile.bio);
  const [phone, setPhone] = useState<string>(profile.phone);
  const [telegram, setTelegram] = useState<string>(profile.telegram);
  const [publicEmail, setPublicEmail] = useState<string>(profile.publicEmail);
  const [vkUrl, setVkUrl] = useState<string>(profile.vkUrl);
  const [websiteUrl, setWebsiteUrl] = useState<string>(profile.websiteUrl);
  const [skillsList, setSkillsList] = useState<string[]>(profile.skills);
  const [skillDraft, setSkillDraft] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const regionOptions = useMemo(() => buildRegionSelectOptions(region), [region]);

  const resetDrafts = useCallback(() => {
    setDisplayName(profile.displayName);
    setHeadline(profile.headline);
    setRegion(profile.region);
    setOrganisation(profile.organisation);
    setBio(profile.bio);
    setPhone(profile.phone);
    setTelegram(profile.telegram);
    setPublicEmail(profile.publicEmail);
    setVkUrl(profile.vkUrl);
    setWebsiteUrl(profile.websiteUrl);
    setSkillsList(profile.skills);
    setSkillDraft('');
    onError(null);
  }, [profile, onError]);

  useEffect(() => {
    resetDrafts();
  }, [resetDrafts]);

  const addSkill = (raw: string) => {
    const clean = raw.trim().slice(0, 40);
    if (!clean) return;
    if (skillsList.length >= 12) return;
    if (skillsList.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setSkillDraft('');
      return;
    }
    setSkillsList((prev) => [...prev, clean]);
    setSkillDraft('');
  };

  const removeSkill = (skill: string) => {
    setSkillsList((prev) => prev.filter((s) => s !== skill));
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onError(null);
    const trimmedName = displayName.trim();
    if (trimmedName.length < 2) {
      onError('Имя профиля должно содержать не менее 2 символов.');
      return;
    }
    setSaving(true);
    try {
      const updated = await socialApi.updateProfile({
        displayName: trimmedName,
        headline: headline.trim(),
        region: region.trim(),
        organisation: organisation.trim(),
        bio: bio.trim(),
        phone: phone.trim(),
        telegram: telegram.trim(),
        publicEmail: publicEmail.trim(),
        vkUrl: vkUrl.trim(),
        websiteUrl: websiteUrl.trim(),
        skills: skillsList,
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
        {canEdit ? (
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Редактирование профиля и контактов</h3>
              <p className="text-xs text-slate-600">
                Основные данные синхронизируются с учётной карточкой проводника и отображаются в вашей ленте и публикациях.
              </p>
            </div>

            <form onSubmit={save} className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-slate-500">Основные поля профиля</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="sp-display-name" className="block text-xs font-medium text-slate-700">
                      ФИО / имя в сообществе
                    </label>
                    <input
                      id="sp-display-name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={120}
                      placeholder="Смирнов Александр Анатольевич"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="sp-headline" className="block text-xs font-medium text-slate-700">
                      Статус / специализация
                    </label>
                    <input
                      id="sp-headline"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      maxLength={140}
                      placeholder="Инструктор-проводник · водный туризм"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="sp-region" className="block text-xs font-medium text-slate-700">
                      Регион ДФО
                    </label>
                    <select
                      id="sp-region"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
                    >
                      {regionOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="sp-organisation" className="block text-xs font-medium text-slate-700">
                      Организация / турклуб
                    </label>
                    <input
                      id="sp-organisation"
                      value={organisation}
                      onChange={(e) => setOrganisation(e.target.value)}
                      maxLength={160}
                      placeholder="Клуб туристов «Восток», ИП или ООПТ"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="sp-bio" className="block text-xs font-medium text-slate-700">
                      О себе, маршрутах и опыте
                    </label>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {bio.length} / 1200
                    </span>
                  </div>
                  <textarea
                    id="sp-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={1200}
                    rows={4}
                    placeholder="Районы походов, категории сложности, сертификация и открытость к совместным экспедициям…"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none resize-y"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="sp-skill-input" className="block text-xs font-medium text-slate-700">
                      Навыки и компетенции
                    </label>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {skillsList.length} / 12
                    </span>
                  </div>

                  {skillsList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {skillsList.map((skill) => (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => removeSkill(skill)}
                          title="Удалить навык"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-red-50 hover:text-red-800 border border-slate-200 text-slate-800 text-xs rounded-md transition-colors cursor-pointer"
                        >
                          <span>{skill}</span>
                          <X className="w-3 h-3" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      id="sp-skill-input"
                      value={skillDraft}
                      onChange={(e) => setSkillDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addSkill(skillDraft);
                        }
                      }}
                      disabled={skillsList.length >= 12}
                      placeholder="Например: Первая помощь (WFA)"
                      className="flex-1 min-w-0 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none disabled:bg-slate-50"
                    />
                    <button
                      type="button"
                      disabled={skillsList.length >= 12 || !skillDraft.trim()}
                      onClick={() => addSkill(skillDraft)}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      Добавить
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span>Быстрый выбор:</span>
                    {SUGGESTED_SKILLS.filter(
                      (s) => !skillsList.some((curr) => curr.toLowerCase() === s.toLowerCase())
                    )
                      .slice(0, 5)
                      .map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => addSkill(s)}
                          className="text-teal-800 hover:text-teal-950 font-medium cursor-pointer"
                        >
                          + {s}
                        </button>
                      ))}
                  </div>
                </div>
              </div>

              <div className="pt-5 border-t border-slate-200 space-y-4">
                <h4 className="text-xs font-semibold text-slate-500">Контакты и внешние ссылки</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="sp-phone" className="block text-xs font-medium text-slate-700">
                      Телефон для связи
                    </label>
                    <input
                      id="sp-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+7 914 000-00-00"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="sp-telegram" className="block text-xs font-medium text-slate-700">
                      Telegram
                    </label>
                    <input
                      id="sp-telegram"
                      value={telegram}
                      onChange={(e) => setTelegram(e.target.value)}
                      placeholder="@username или t.me/username"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="sp-public-email" className="block text-xs font-medium text-slate-700">
                        Публичная эл. почта
                      </label>
                      {accountEmail && publicEmail !== accountEmail && (
                        <button
                          type="button"
                          onClick={() => setPublicEmail(accountEmail)}
                          className="text-[11px] font-medium text-teal-800 hover:text-teal-950 cursor-pointer"
                        >
                          Подставить из аккаунта
                        </button>
                      )}
                    </div>
                    <input
                      id="sp-public-email"
                      type="email"
                      value={publicEmail}
                      onChange={(e) => setPublicEmail(e.target.value)}
                      placeholder="guide@example.ru"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="sp-vk" className="block text-xs font-medium text-slate-700">
                      ВКонтакте / Max / профиль соцсети
                    </label>
                    <input
                      id="sp-vk"
                      value={vkUrl}
                      onChange={(e) => setVkUrl(e.target.value)}
                      placeholder="https://vk.com/username"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label htmlFor="sp-site" className="block text-xs font-medium text-slate-700">
                      Личный сайт или страница турклуба
                    </label>
                    <input
                      id="sp-site"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://example.ru"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Save className="w-4 h-4" aria-hidden="true" />
                  {saving ? 'Сохраняем…' : 'Сохранить изменения'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={resetDrafts}
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Сбросить
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <h3 className="text-base font-bold text-slate-900">О себе</h3>
            {profile.bio ? (
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{profile.bio}</p>
            ) : (
              <p className="text-sm text-slate-500">Участник пока не добавил подробное описание.</p>
            )}

            {profile.skills.length > 0 && (
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <h4 className="text-xs font-semibold text-slate-500">Навыки и специализация</h4>
                <p className="text-sm text-slate-700">{profile.skills.join(' · ')}</p>
              </div>
            )}
          </section>
        )}
      </div>

      <div className="space-y-5">
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h3 className="text-base font-bold text-slate-900">Контактная карточка</h3>
          <dl className="space-y-2.5 text-sm">
            <div>
              <dt className="text-[11px] text-slate-500">Регион</dt>
              <dd className="text-slate-900">{profile.region || 'Не указан'}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-500">Организация</dt>
              <dd className="text-slate-900">{profile.organisation || 'Не указана'}</dd>
            </div>
            {profile.phone && (
              <div>
                <dt className="text-[11px] text-slate-500">Телефон</dt>
                <dd>
                  <a href={`tel:${profile.phone.replace(/[^\d+]/g, '')}`} className="text-teal-800 hover:underline">
                    {profile.phone}
                  </a>
                </dd>
              </div>
            )}
            {profile.telegram && (
              <div>
                <dt className="text-[11px] text-slate-500">Telegram</dt>
                <dd>
                  <a
                    href={toTelegramHref(profile.telegram)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-800 hover:underline"
                  >
                    {profile.telegram}
                  </a>
                </dd>
              </div>
            )}
            {profile.publicEmail && (
              <div>
                <dt className="text-[11px] text-slate-500">Эл. почта</dt>
                <dd>
                  <a href={`mailto:${profile.publicEmail}`} className="text-teal-800 hover:underline break-all">
                    {profile.publicEmail}
                  </a>
                </dd>
              </div>
            )}
            {profile.vkUrl && (
              <div>
                <dt className="text-[11px] text-slate-500">Соцсеть</dt>
                <dd>
                  <a
                    href={profile.vkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-800 hover:underline break-all"
                  >
                    {formatSocialLinkLabel(profile.vkUrl)}
                  </a>
                </dd>
              </div>
            )}
            {profile.websiteUrl && (
              <div>
                <dt className="text-[11px] text-slate-500">Сайт</dt>
                <dd>
                  <a
                    href={profile.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-800 hover:underline break-all"
                  >
                    {formatWebsiteLabel(profile.websiteUrl)}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 h-fit">
          <h3 className="text-base font-bold text-slate-900">Активность</h3>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-500">Пока нет событий.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((item) => (
                <li key={item.id} className="text-sm text-slate-700">
                  <p>{item.summary}</p>
                  <p className="text-[11px] text-slate-400 tabular-nums">
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
    </div>
  );
}
