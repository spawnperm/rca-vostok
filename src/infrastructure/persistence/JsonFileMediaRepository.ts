import fs from 'fs';
import {
  Album,
  MediaAsset,
  type MediaAssetDTO,
} from '../../domain/media/MediaLibrary.ts';
import type { MediaRepository } from '../../domain/media/MediaRepository.ts';
import { atomicWriteJson, ensureDirectory, resolveConfinedPath } from './PathConfinement.ts';

interface StoredAlbum {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  description: string;
  visibility: 'public' | 'private';
  coverAssetId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MediaStore {
  albums: Record<string, StoredAlbum>;
  assets: Record<string, MediaAssetDTO>;
}

function emptyStore(): MediaStore {
  return { albums: {}, assets: {} };
}

function toAlbum(row: StoredAlbum): Album {
  return Album.rehydrate({
    id: row.id,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    coverAssetId: row.coverAssetId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toAsset(row: MediaAssetDTO): MediaAsset {
  return MediaAsset.rehydrate({
    id: row.id,
    albumId: row.albumId,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    kind: row.kind,
    title: row.title,
    description: row.description,
    objectKey: row.objectKey,
    mimeType: row.mimeType,
    sizeBytes: Number(row.sizeBytes),
    durationSec: row.durationSec,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt,
  });
}

/**
 * JSON-file adapter for media albums and uploaded asset metadata.
 */
export class JsonFileMediaRepository implements MediaRepository {
  private readonly dataDir: string;
  private readonly fileName: string;
  private readonly tempFileName: string;

  constructor(dataDir: string, fileName = 'media.json') {
    this.dataDir = dataDir;
    this.fileName = fileName;
    this.tempFileName = `${fileName}.tmp`;
  }

  private readStore(): MediaStore {
    ensureDirectory(this.dataDir);
    const targetPath = resolveConfinedPath(this.dataDir, this.fileName);
    if (!fs.existsSync(targetPath)) {
      return emptyStore();
    }
    try {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<MediaStore> | null;
      if (!parsed || typeof parsed !== 'object') {
        return emptyStore();
      }
      return {
        albums: parsed.albums && typeof parsed.albums === 'object' ? parsed.albums : {},
        assets: parsed.assets && typeof parsed.assets === 'object' ? parsed.assets : {},
      };
    } catch {
      return emptyStore();
    }
  }

  private writeStore(store: MediaStore): void {
    atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, store);
  }

  async saveAlbum(album: Album): Promise<void> {
    const store = this.readStore();
    store.albums[album.id] = {
      id: album.id,
      ownerId: album.ownerId,
      ownerName: album.ownerName,
      title: album.title,
      description: album.description,
      visibility: album.visibility,
      coverAssetId: album.coverAssetId,
      createdAt: album.createdAt,
      updatedAt: album.updatedAt,
    };
    this.writeStore(store);
  }

  async findAlbum(id: string): Promise<Album | null> {
    const store = this.readStore();
    const row = store.albums[id];
    return row ? toAlbum(row) : null;
  }

  async listAlbums(options: {
    ownerId?: string;
    viewerId: string | null;
    limit: number;
    offset: number;
  }): Promise<{ albums: Album[]; total: number }> {
    const store = this.readStore();
    const filtered = Object.values(store.albums)
      .filter((a) => {
        if (a.visibility !== 'public' && a.ownerId !== options.viewerId) {
          return false;
        }
        if (options.ownerId && a.ownerId !== options.ownerId) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return {
      albums: filtered.slice(options.offset, options.offset + options.limit).map(toAlbum),
      total: filtered.length,
    };
  }

  async deleteAlbum(id: string): Promise<void> {
    const store = this.readStore();
    if (!store.albums[id]) return;
    delete store.albums[id];
    for (const [assetId, asset] of Object.entries(store.assets)) {
      if (asset.albumId === id) {
        store.assets[assetId] = { ...asset, albumId: null };
      }
    }
    this.writeStore(store);
  }

  async countAssetsInAlbum(albumId: string): Promise<number> {
    const store = this.readStore();
    return Object.values(store.assets).filter((a) => a.albumId === albumId).length;
  }

  async countAlbumsByOwner(ownerId: string): Promise<number> {
    const store = this.readStore();
    return Object.values(store.albums).filter((a) => a.ownerId === ownerId).length;
  }

  async setCover(albumId: string, assetId: string): Promise<void> {
    const store = this.readStore();
    const album = store.albums[albumId];
    if (!album) return;
    store.albums[albumId] = {
      ...album,
      coverAssetId: assetId,
      updatedAt: new Date().toISOString(),
    };
    this.writeStore(store);
  }

  async saveAsset(asset: MediaAsset): Promise<void> {
    const store = this.readStore();
    if (!store.assets[asset.id]) {
      store.assets[asset.id] = asset.toDTO();
      this.writeStore(store);
    }
  }

  async findAsset(id: string): Promise<MediaAsset | null> {
    const store = this.readStore();
    const row = store.assets[id];
    return row ? toAsset(row) : null;
  }

  async listAssets(options: {
    albumId?: string;
    ownerId?: string;
    kind?: 'image' | 'video' | 'audio';
    limit: number;
    offset: number;
  }): Promise<{ assets: MediaAsset[]; total: number }> {
    const store = this.readStore();
    const filtered = Object.values(store.assets)
      .filter((a) => {
        if (options.albumId && a.albumId !== options.albumId) return false;
        if (options.ownerId && a.ownerId !== options.ownerId) return false;
        if (options.kind && a.kind !== options.kind) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      assets: filtered.slice(options.offset, options.offset + options.limit).map(toAsset),
      total: filtered.length,
    };
  }

  async deleteAsset(id: string): Promise<void> {
    const store = this.readStore();
    if (!store.assets[id]) return;
    delete store.assets[id];
    for (const [albumId, album] of Object.entries(store.albums)) {
      if (album.coverAssetId === id) {
        store.albums[albumId] = { ...album, coverAssetId: null };
      }
    }
    this.writeStore(store);
  }

  async countAssetsByOwner(ownerId: string): Promise<number> {
    const store = this.readStore();
    return Object.values(store.assets).filter((a) => a.ownerId === ownerId).length;
  }
}
