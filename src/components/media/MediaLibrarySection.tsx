import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Film,
  Image as ImageIcon,
  Lock,
  Music,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  SocialApiError,
  mediaApi,
  type MediaAlbum,
  type MediaAssetData,
} from '../../utils/socialApi';
import { MediaPlayer } from './MediaPlayer';
import { PhotoViewer } from './PhotoViewer';

const ACCEPTED =
  'image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm,video/ogg,video/quicktime,audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm';

type KindFilter = 'all' | 'image' | 'video' | 'audio';

function KindIcon({ kind }: { kind: MediaAssetData['kind'] }) {
  if (kind === 'video') return <Film className="w-3.5 h-3.5" aria-hidden="true" />;
  if (kind === 'audio') return <Music className="w-3.5 h-3.5" aria-hidden="true" />;
  return <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />;
}

/** Thumbnail or a proportional placeholder for non-image assets. */
function AssetTile({
  asset,
  onOpen,
  onDelete,
  canDelete,
}: {
  asset: MediaAssetData;
  onOpen: (asset: MediaAssetData) => void;
  onDelete: (asset: MediaAssetData) => void;
  canDelete: boolean;
}) {
  return (
    <div className="group relative bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
      <button
        type="button"
        onClick={() => onOpen(asset)}
        className="block w-full aspect-video cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
        aria-label={`Открыть: ${asset.title}`}
      >
        {asset.kind === 'image' && asset.url ? (
          <img
            src={asset.url}
            alt={asset.title}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-slate-600">
            <KindIcon kind={asset.kind} />
            <span className="text-[11px] px-2 text-center line-clamp-2">{asset.title}</span>
          </span>
        )}
      </button>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 py-1.5 pointer-events-none">
        <p className="text-[11px] text-white truncate">{asset.title}</p>
      </div>

      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete(asset)}
          aria-label={`Удалить ${asset.title}`}
          className="absolute top-1.5 right-1.5 p-1 bg-white/90 rounded hover:bg-red-50 text-slate-600 hover:text-red-700 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function MediaLibrarySection({
  canUpload,
  canCreateAlbum = canUpload,
  canModerate = false,
  currentUserId,
  ownerFilterUserId,
  onChanged,
}: {
  canUpload: boolean;
  canCreateAlbum?: boolean;
  canModerate?: boolean;
  currentUserId: string | null;
  ownerFilterUserId?: string;
  onChanged?: () => void;
}) {
  const [albums, setAlbums] = useState<MediaAlbum[]>([]);
  const [activeAlbum, setActiveAlbum] = useState<MediaAlbum | null>(null);
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [assets, setAssets] = useState<MediaAssetData[]>([]);
  const [playerAsset, setPlayerAsset] = useState<MediaAssetData | null>(null);
  /** Photo currently open in the viewer (images never go to MediaPlayer). */
  const [viewerPhoto, setViewerPhoto] = useState<MediaAssetData | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState<boolean>(false);
  const [albumTitle, setAlbumTitle] = useState<string>('');
  const [albumVisibility, setAlbumVisibility] = useState<'public' | 'private'>('public');

  const imageAssets = useMemo(
    () =>
      assets
        .filter((a) => a.kind === 'image' && a.url)
        .map((a) => ({ id: a.id, url: a.url as string, title: a.title })),
    [assets]
  );

  const playableAssets = useMemo(
    () => assets.filter((a) => a.kind !== 'image' && Boolean(a.url)),
    [assets]
  );

  const openAsset = useCallback((asset: MediaAssetData) => {
    if (asset.kind === 'image') {
      setViewerPhoto(asset);
    } else {
      setPlayerAsset(asset);
    }
  }, []);

  const loadAlbums = useCallback(async () => {
    try {
      const res = await mediaApi.albums(
        ownerFilterUserId ? { ownerId: ownerFilterUserId } : {}
      );
      setAlbums(res.albums);
      setActiveAlbum((curr) =>
        curr ? (res.albums.find((a) => a.id === curr.id) ?? null) : null
      );
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось загрузить альбомы.');
    }
  }, [ownerFilterUserId]);

  const loadAssets = useCallback(
    async (album: MediaAlbum | null, kind: KindFilter) => {
      try {
        const res = await mediaApi.assets({
          albumId: album?.id,
          ownerId: !album && ownerFilterUserId ? ownerFilterUserId : undefined,
          kind: kind === 'all' ? undefined : kind,
        });
        setAssets(res.assets);
      } catch (err) {
        setError(err instanceof SocialApiError ? err.message : 'Не удалось загрузить файлы.');
      }
    },
    [ownerFilterUserId]
  );

  useEffect(() => {
    setActiveAlbum(null);
    void loadAlbums();
  }, [loadAlbums]);

  useEffect(() => {
    void loadAssets(activeAlbum, kindFilter);
  }, [activeAlbum, kindFilter, loadAssets]);

  const createAlbum = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (albumTitle.trim().length < 2) return;
    setError(null);
    try {
      const album = await mediaApi.createAlbum({
        title: albumTitle.trim(),
        visibility: albumVisibility,
      });
      setAlbums((prev) => [album, ...prev]);
      setAlbumTitle('');
      setAlbumVisibility('public');
      setCreating(false);
      setActiveAlbum(album);
      onChanged?.();
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось создать альбом.');
    }
  };

  const removeAlbum = async (album: MediaAlbum) => {
    setError(null);
    try {
      await mediaApi.deleteAlbum(album.id);
      setAlbums((prev) => prev.filter((a) => a.id !== album.id));
      if (activeAlbum?.id === album.id) {
        setActiveAlbum(null);
      }
      await loadAssets(activeAlbum?.id === album.id ? null : activeAlbum, kindFilter);
      onChanged?.();
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось удалить альбом.');
    }
  };

  const isViewingForeignAlbum = Boolean(
    activeAlbum && currentUserId && activeAlbum.ownerId !== currentUserId
  );

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      // Foreign public albums are read-only for non-owners; upload into personal pool.
      const targetAlbumId = isViewingForeignAlbum ? undefined : activeAlbum?.id;
      const asset = await mediaApi.upload(file, {
        albumId: targetAlbumId,
        title: file.name,
      });
      if (isViewingForeignAlbum) {
        setActiveAlbum(null);
      }
      setAssets((prev) => [asset, ...prev]);
      await loadAlbums();
      onChanged?.();
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось загрузить файл.');
    } finally {
      setBusy(false);
    }
  };

  const removeAsset = async (asset: MediaAssetData) => {
    setError(null);
    try {
      await mediaApi.deleteAsset(asset.id);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      await loadAlbums();
      onChanged?.();
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось удалить файл.');
    }
  };

  const activePlayIndex = playerAsset
    ? playableAssets.findIndex((a) => a.id === playerAsset.id)
    : -1;

  const canDeleteActiveAlbum = Boolean(
    activeAlbum &&
      currentUserId &&
      (activeAlbum.ownerId === currentUserId || canModerate)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveAlbum(null)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border whitespace-nowrap shrink-0 cursor-pointer ${
              activeAlbum === null
                ? 'bg-teal-50 border-teal-300 text-teal-800'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Все файлы
          </button>
          {albums.map((album) => (
            <button
              key={album.id}
              type="button"
              onClick={() => setActiveAlbum(album)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border whitespace-nowrap shrink-0 cursor-pointer ${
                activeAlbum?.id === album.id
                  ? 'bg-teal-50 border-teal-300 text-teal-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {album.visibility === 'private' && (
                <Lock className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
              )}
              <span>{album.title}</span>
              <span className="text-[10px] text-slate-400 tabular-nums">{album.assetCount}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canDeleteActiveAlbum && activeAlbum && (
            <button
              type="button"
              onClick={() => void removeAlbum(activeAlbum)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-red-200 text-red-700 rounded-lg hover:bg-red-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Удалить альбом</span>
            </button>
          )}

          {canCreateAlbum && (
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Альбом</span>
            </button>
          )}

          {canUpload && (
            <label
              title={
                isViewingForeignAlbum
                  ? 'Файл будет загружен в раздел «Все файлы», так как это альбом другого участника'
                  : 'Загрузить фото, видео или аудио'
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{busy ? 'Загрузка…' : 'Загрузить'}</span>
              <input
                type="file"
                accept={ACCEPTED}
                onChange={upload}
                disabled={busy}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* Media kind filter */}
      <div
        role="tablist"
        aria-label="Фильтр медиафайлов по типу"
        className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
      >
        {(
          [
            { id: 'all', label: 'Все типы' },
            { id: 'image', label: 'Фото' },
            { id: 'video', label: 'Видео' },
            { id: 'audio', label: 'Аудио' },
          ] as const
        ).map((item) => {
          const active = kindFilter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setKindFilter(item.id)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {creating && (
        <form
          onSubmit={createAlbum}
          className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-2"
        >
          <input
            autoFocus
            value={albumTitle}
            onChange={(e) => setAlbumTitle(e.target.value)}
            placeholder="Название альбома (от 2 символов)"
            className="flex-1 min-w-[200px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
          />
          <select
            value={albumVisibility}
            onChange={(e) => setAlbumVisibility(e.target.value as 'public' | 'private')}
            aria-label="Видимость альбома"
            className="px-2.5 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
          >
            <option value="public">Публичный альбом</option>
            <option value="private">Личный (только я)</option>
          </select>
          <button
            type="submit"
            disabled={albumTitle.trim().length < 2}
            className="px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Создать
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setAlbumTitle('');
            }}
            className="px-3 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Отмена
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {assets.length === 0 ? (
        <div className="text-center py-14 text-slate-500 space-y-2 border border-dashed border-slate-200 rounded-xl">
          <ImageIcon className="w-8 h-8 mx-auto text-slate-300" aria-hidden="true" />
          <p className="text-sm">
            {activeAlbum ? `В альбоме «${activeAlbum.title}» пока нет файлов.` : 'Медиатека пуста.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {assets.map((asset) => (
            <AssetTile
              key={asset.id}
              asset={asset}
              onOpen={openAsset}
              onDelete={removeAsset}
              canDelete={
                Boolean(currentUserId) &&
                (asset.ownerId === currentUserId || canModerate)
              }
            />
          ))}
        </div>
      )}

      {viewerPhoto && (
        <PhotoViewer
          photos={imageAssets}
          startIndex={Math.max(
            0,
            imageAssets.findIndex((p) => p.id === viewerPhoto.id)
          )}
          onClose={() => setViewerPhoto(null)}
        />
      )}

      {playerAsset && playerAsset.kind !== 'image' && (
        <div className="fixed inset-0 z-40 bg-slate-900/80 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-white truncate">{playerAsset.title}</p>
              <button
                type="button"
                onClick={() => setPlayerAsset(null)}
                aria-label="Закрыть проигрыватель"
                className="p-1.5 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <MediaPlayer
              src={playerAsset.url || ''}
              kind={playerAsset.kind === 'video' ? 'video' : 'audio'}
              title={playerAsset.title}
              onPrev={
                activePlayIndex > 0
                  ? () => setPlayerAsset(playableAssets[activePlayIndex - 1])
                  : undefined
              }
              onNext={
                activePlayIndex >= 0 && activePlayIndex < playableAssets.length - 1
                  ? () => setPlayerAsset(playableAssets[activePlayIndex + 1])
                  : undefined
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
