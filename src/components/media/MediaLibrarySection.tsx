import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Film, Image as ImageIcon, Music, Plus, Trash2, Upload, X } from 'lucide-react';
import {
  SocialApiError,
  mediaApi,
  type MediaAlbum,
  type MediaAssetData,
} from '../../utils/socialApi';
import { MediaPlayer } from './MediaPlayer';
import { PhotoViewer } from './PhotoViewer';

const ACCEPTED = 'image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/ogg,audio/wav';

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
          <span className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-slate-500">
            <KindIcon kind={asset.kind} />
            <span className="text-[11px] px-2 text-center line-clamp-2">{asset.title}</span>
          </span>
        )}
      </button>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
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
  currentUserId,
}: {
  canUpload: boolean;
  currentUserId: string | null;
}) {
  const [albums, setAlbums] = useState<MediaAlbum[]>([]);
  const [activeAlbum, setActiveAlbum] = useState<MediaAlbum | null>(null);
  const [assets, setAssets] = useState<MediaAssetData[]>([]);
  const [playerAsset, setPlayerAsset] = useState<MediaAssetData | null>(null);
  /** Photo currently open in the viewer (images never go to MediaPlayer). */
  const [viewerPhoto, setViewerPhoto] = useState<MediaAssetData | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Images open in the photo viewer, everything else in the media player.
  const imageAssets = useMemo(
    () =>
      assets
        .filter((a) => a.kind === 'image' && a.url)
        .map((a) => ({ id: a.id, url: a.url as string, title: a.title })),
    [assets]
  );

  /** Single entry point from a tile: route by asset kind. */
  const openAsset = useCallback((asset: MediaAssetData) => {
    if (asset.kind === 'image') {
      setViewerPhoto(asset);
    } else {
      setPlayerAsset(asset);
    }
  }, []);
  const [creating, setCreating] = useState<boolean>(false);
  const [albumTitle, setAlbumTitle] = useState<string>('');

  const loadAlbums = useCallback(async () => {
    try {
      const res = await mediaApi.albums();
      setAlbums(res.albums);
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось загрузить альбомы.');
    }
  }, []);

  const loadAssets = useCallback(async (album: MediaAlbum | null) => {
    try {
      const res = await mediaApi.assets(album ? { albumId: album.id } : {});
      setAssets(res.assets);
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось загрузить файлы.');
    }
  }, []);

  useEffect(() => {
    void loadAlbums();
  }, [loadAlbums]);

  useEffect(() => {
    void loadAssets(activeAlbum);
  }, [activeAlbum, loadAssets]);

  const createAlbum = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (albumTitle.trim().length < 2) return;
    try {
      const album = await mediaApi.createAlbum({ title: albumTitle.trim() });
      setAlbums((prev) => [album, ...prev]);
      setAlbumTitle('');
      setCreating(false);
      setActiveAlbum(album);
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось создать альбом.');
    }
  };

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const asset = await mediaApi.upload(file, {
        albumId: activeAlbum?.id,
        title: file.name,
      });
      setAssets((prev) => [asset, ...prev]);
      await loadAlbums();
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось загрузить файл.');
    } finally {
      setBusy(false);
    }
  };

  const removeAsset = async (asset: MediaAssetData) => {
    try {
      await mediaApi.deleteAsset(asset.id);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      await loadAlbums();
    } catch (err) {
      setError(err instanceof SocialApiError ? err.message : 'Не удалось удалить файл.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-wrap gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveAlbum(null)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border whitespace-nowrap cursor-pointer ${
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
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border whitespace-nowrap cursor-pointer ${
                activeAlbum?.id === album.id
                  ? 'bg-teal-50 border-teal-300 text-teal-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {album.title}
              <span className="ml-1.5 text-[10px] text-slate-400 tabular-nums">
                {album.assetCount}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {canUpload && (
            <>
              <button
                type="button"
                onClick={() => setCreating((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Альбом
              </button>

              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer">
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                {busy ? 'Загрузка…' : 'Загрузить'}
                <input
                  type="file"
                  accept={ACCEPTED}
                  onChange={upload}
                  disabled={busy}
                  className="hidden"
                />
              </label>
            </>
          )}
        </div>
      </div>

      {creating && (
        <form onSubmit={createAlbum} className="flex gap-2">
          <input
            autoFocus
            value={albumTitle}
            onChange={(e) => setAlbumTitle(e.target.value)}
            placeholder="Название альбома"
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
          />
          <button
            type="submit"
            className="px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            Создать
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {assets.length === 0 ? (
        <div className="text-center py-14 text-slate-500 space-y-2">
          <ImageIcon className="w-8 h-8 mx-auto text-slate-300" aria-hidden="true" />
          <p className="text-sm">
            {activeAlbum ? 'В альбоме пока нет файлов.' : 'Медиатека пуста.'}
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
              canDelete={Boolean(currentUserId) && asset.ownerId === currentUserId}
            />
          ))}
        </div>
      )}

      {/* Photographs get their own viewer: feeding an image URL to <audio> or
          <video> yields a control bar that can never play, which is what
          happened before. Video and audio keep the transport controls. */}
      {viewerPhoto && (
        <PhotoViewer
          photos={imageAssets}
          startIndex={imageAssets.findIndex((p) => p.id === viewerPhoto.id)}
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
            />
          </div>
        </div>
      )}
    </div>
  );
}
