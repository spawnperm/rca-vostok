import type { Album, MediaAsset } from './MediaLibrary.ts';

export interface MediaRepository {
  saveAlbum(album: Album): Promise<void>;
  findAlbum(id: string): Promise<Album | null>;
  listAlbums(options: {
    ownerId?: string;
    viewerId: string | null;
    limit: number;
    offset: number;
  }): Promise<{ albums: Album[]; total: number }>;
  deleteAlbum(id: string): Promise<void>;
  countAssetsInAlbum(albumId: string): Promise<number>;
  countAlbumsByOwner(ownerId: string): Promise<number>;
  setCover(albumId: string, assetId: string): Promise<void>;

  saveAsset(asset: MediaAsset): Promise<void>;
  findAsset(id: string): Promise<MediaAsset | null>;
  listAssets(options: {
    albumId?: string;
    ownerId?: string;
    kind?: 'image' | 'video' | 'audio';
    limit: number;
    offset: number;
  }): Promise<{ assets: MediaAsset[]; total: number }>;
  deleteAsset(id: string): Promise<void>;
  countAssetsByOwner(ownerId: string): Promise<number>;
}

/**
 * Object storage port for media bytes.
 *
 * The domain never sees file handles: it hands over a key and the adapter
 * (Garage S3 in production) owns transport concerns.
 */
export interface ObjectStorage {
  /** Uploads bytes and returns the public URL for the stored object. */
  put(key: string, body: Buffer, contentType: string): Promise<{ url: string }>;
  delete(key: string): Promise<void>;
  /** Presigned or direct URL for reading an object. */
  publicUrl(key: string): string;
  /**
   * Streams an object back through the app.
   *
   * Garage's S3 API requires signed requests, so uploaded media cannot be
   * fetched by a browser directly. The app proxies the bytes instead, which
   * also lets it enforce album visibility before serving a private file.
   */
  get(key: string): Promise<{ body: Buffer; contentType: string } | null>;
}
