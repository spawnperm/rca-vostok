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
export interface ObjectStoragePutOptions {
  cacheControl?: string;
}

export interface ObjectStorage {
  /** Uploads bytes and returns the public URL for the stored object. */
  put(
    key: string,
    body: Buffer,
    contentType: string,
    options?: ObjectStoragePutOptions
  ): Promise<{ url: string }>;
  delete(key: string): Promise<void>;
  /** Presigned or direct URL for reading an object. */
  publicUrl(key: string): string;
  /** Checks connectivity/availability of the underlying bucket or storage root. */
  checkHealth?(): Promise<boolean>;
  /**
   * Streams an object back through the app.
   *
   * Garage's S3 API requires signed requests, so uploaded media cannot be
   * fetched by a browser directly. The app proxies the bytes instead, which
   * also lets it enforce album visibility before serving a private file.
   *
   * Prefer `getStream` for large files: this variant materialises the whole
   * object in memory and is only suitable for small ones.
   */
  get(key: string): Promise<{ body: Buffer; contentType: string } | null>;

  /**
   * Opens an object as a readable stream plus its size.
   *
   * A 300 MB video buffered in memory would exhaust the 3.8 GB host, so the
   * serving route uses this and pipes the bytes straight to the response.
   * Returns null when the key does not exist.
   */
  getStream(
    key: string
  ): Promise<{ stream: NodeJS.ReadableStream; contentType: string; sizeBytes?: number } | null>;
}
