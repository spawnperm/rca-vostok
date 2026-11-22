import type pg from 'pg';
import { Album, MediaAsset } from '../../../domain/media/MediaLibrary.ts';
import type { MediaRepository } from '../../../domain/media/MediaRepository.ts';

interface AlbumRow {
  id: string;
  owner_id: string;
  owner_name: string;
  title: string;
  description: string;
  visibility: string;
  cover_asset_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface AssetRow {
  id: string;
  album_id: string | null;
  owner_id: string;
  owner_name: string;
  kind: string;
  title: string;
  description: string;
  object_key: string;
  mime_type: string;
  size_bytes: string | number;
  duration_sec: number | null;
  width: number | null;
  height: number | null;
  created_at: Date;
}

function toAlbum(row: AlbumRow): Album {
  return Album.rehydrate({
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    coverAssetId: row.cover_asset_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  });
}

function toAsset(row: AssetRow): MediaAsset {
  return MediaAsset.rehydrate({
    id: row.id,
    albumId: row.album_id,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    kind: row.kind,
    title: row.title,
    description: row.description,
    objectKey: row.object_key,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    durationSec: row.duration_sec,
    width: row.width,
    height: row.height,
    createdAt: row.created_at.toISOString(),
  });
}

/** PostgreSQL adapter for media albums and asset metadata. */
export class PostgresMediaRepository implements MediaRepository {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async saveAlbum(album: Album): Promise<void> {
    await this.pool.query(
      `INSERT INTO media_albums (
         id, owner_id, owner_name, title, description, visibility,
         cover_asset_id, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         visibility = EXCLUDED.visibility,
         cover_asset_id = EXCLUDED.cover_asset_id,
         updated_at = EXCLUDED.updated_at`,
      [
        album.id,
        album.ownerId,
        album.ownerName,
        album.title,
        album.description,
        album.visibility,
        album.coverAssetId,
        album.createdAt,
        album.updatedAt,
      ]
    );
  }

  async findAlbum(id: string): Promise<Album | null> {
    const res = await this.pool.query<AlbumRow>('SELECT * FROM media_albums WHERE id = $1', [id]);
    return res.rows.length > 0 ? toAlbum(res.rows[0]) : null;
  }

  async listAlbums(options: {
    ownerId?: string;
    viewerId: string | null;
    limit: number;
    offset: number;
  }): Promise<{ albums: Album[]; total: number }> {
    const params: unknown[] = [];
    const where: string[] = [];

    // Private albums are only visible to their owner.
    params.push(options.viewerId);
    where.push(`(visibility = 'public' OR owner_id = $1)`);

    if (options.ownerId) {
      params.push(options.ownerId);
      where.push(`owner_id = $${params.length}`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const countRes = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM media_albums ${whereSql}`,
      params
    );

    params.push(options.limit, options.offset);
    const rows = await this.pool.query<AlbumRow>(
      `SELECT * FROM media_albums ${whereSql}
        ORDER BY updated_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return { albums: rows.rows.map(toAlbum), total: Number(countRes.rows[0]?.count ?? 0) };
  }

  async deleteAlbum(id: string): Promise<void> {
    await this.pool.query('DELETE FROM media_albums WHERE id = $1', [id]);
  }

  async countAssetsInAlbum(albumId: string): Promise<number> {
    const res = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM media_assets WHERE album_id = $1',
      [albumId]
    );
    return Number(res.rows[0]?.count ?? 0);
  }

  async countAlbumsByOwner(ownerId: string): Promise<number> {
    const res = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM media_albums WHERE owner_id = $1',
      [ownerId]
    );
    return Number(res.rows[0]?.count ?? 0);
  }

  async setCover(albumId: string, assetId: string): Promise<void> {
    await this.pool.query(
      'UPDATE media_albums SET cover_asset_id = $2, updated_at = $3 WHERE id = $1',
      [albumId, assetId, new Date().toISOString()]
    );
  }

  async saveAsset(asset: MediaAsset): Promise<void> {
    await this.pool.query(
      `INSERT INTO media_assets (
         id, album_id, owner_id, owner_name, kind, title, description, object_key,
         mime_type, size_bytes, duration_sec, width, height, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO NOTHING`,
      [
        asset.id,
        asset.albumId,
        asset.ownerId,
        asset.ownerName,
        asset.kind,
        asset.title,
        asset.description,
        asset.objectKey,
        asset.mimeType,
        asset.sizeBytes,
        asset.durationSec,
        asset.width,
        asset.height,
        asset.createdAt,
      ]
    );
  }

  async findAsset(id: string): Promise<MediaAsset | null> {
    const res = await this.pool.query<AssetRow>('SELECT * FROM media_assets WHERE id = $1', [id]);
    return res.rows.length > 0 ? toAsset(res.rows[0]) : null;
  }

  async listAssets(options: {
    albumId?: string;
    ownerId?: string;
    kind?: 'image' | 'video' | 'audio';
    limit: number;
    offset: number;
  }): Promise<{ assets: MediaAsset[]; total: number }> {
    const params: unknown[] = [];
    const where: string[] = [];

    if (options.albumId) {
      params.push(options.albumId);
      where.push(`album_id = $${params.length}`);
    }
    if (options.ownerId) {
      params.push(options.ownerId);
      where.push(`owner_id = $${params.length}`);
    }
    if (options.kind) {
      params.push(options.kind);
      where.push(`kind = $${params.length}`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const countRes = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM media_assets ${whereSql}`,
      params
    );

    params.push(options.limit, options.offset);
    const rows = await this.pool.query<AssetRow>(
      `SELECT * FROM media_assets ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return { assets: rows.rows.map(toAsset), total: Number(countRes.rows[0]?.count ?? 0) };
  }

  async deleteAsset(id: string): Promise<void> {
    await this.pool.query('DELETE FROM media_assets WHERE id = $1', [id]);
  }

  async countAssetsByOwner(ownerId: string): Promise<number> {
    const res = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM media_assets WHERE owner_id = $1',
      [ownerId]
    );
    return Number(res.rows[0]?.count ?? 0);
  }
}
