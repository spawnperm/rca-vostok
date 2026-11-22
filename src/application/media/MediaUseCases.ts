import crypto from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { Album, MediaAsset } from '../../domain/media/MediaLibrary.ts';
import type { MediaRepository, ObjectStorage } from '../../domain/media/MediaRepository.ts';
import { PERMISSIONS } from '../../domain/identity/Rbac.ts';
import { NotFoundError, ValidationError, type DomainEventBus } from '../../domain/shared/DomainError.ts';
import type { User } from '../../domain/identity/User.ts';
import { parseOrThrow } from '../social/SocialUseCases.ts';

export const createAlbumSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(600).optional(),
  visibility: z.enum(['public', 'private']).optional(),
});

export const uploadMetaSchema = z.object({
  albumId: z.string().max(64).optional().nullable(),
  title: z.string().max(160).optional(),
  description: z.string().max(600).optional(),
  mimeType: z.string().min(3).max(100),
  sizeBytes: z.coerce.number().int().positive(),
  durationSec: z.coerce.number().positive().optional(),
  width: z.coerce.number().int().positive().optional(),
  height: z.coerce.number().int().positive().optional(),
});

export class CreateAlbumUseCase {

  private readonly media: MediaRepository;
  private readonly eventBus: DomainEventBus;

  constructor(media: MediaRepository, eventBus: DomainEventBus) {
    this.media = media;
    this.eventBus = eventBus;
  }

  async execute(actor: User, rawInput: unknown): Promise<ReturnType<Album['toDTO']>> {
    actor.assertCan(PERMISSIONS.CREATE_ALBUM);
    const input = parseOrThrow(createAlbumSchema, rawInput);

    const album = Album.create({
      ownerId: actor.id,
      ownerName: actor.fullName.value,
      title: input.title,
      description: input.description,
      visibility: input.visibility,
    });

    await this.media.saveAlbum(album);

    this.eventBus.publish({
      eventName: 'media.album_created',
      occurredAt: album.createdAt,
      boundedContext: 'identity',
      payload: { albumId: album.id, ownerId: actor.id },
    });

    return album.toDTO(0);
  }
}

export class ListAlbumsUseCase {
  private readonly media: MediaRepository;

  constructor(media: MediaRepository) {
    this.media = media;
  }

  async execute(
    actor: User | null,
    rawQuery: unknown
  ): Promise<{ albums: ReturnType<Album['toDTO']>[]; total: number }> {
    const query = parseOrThrow(
      z.object({
        ownerId: z.string().max(64).optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      rawQuery ?? {}
    );

    const { albums, total } = await this.media.listAlbums({
      ownerId: query.ownerId,
      viewerId: actor?.id ?? null,
      limit: query.limit,
      offset: query.offset,
    });

    const withCounts = await Promise.all(
      albums.map(async (a) => a.toDTO(await this.media.countAssetsInAlbum(a.id)))
    );

    return { albums: withCounts, total };
  }
}

export class ListAssetsUseCase {
  private readonly media: MediaRepository;

  constructor(media: MediaRepository) {
    this.media = media;
  }

  async execute(rawQuery: unknown): Promise<{
    assets: ReturnType<MediaAsset['toDTO']>[];
    total: number;
  }> {
    const query = parseOrThrow(
      z.object({
        albumId: z.string().max(64).optional(),
        ownerId: z.string().max(64).optional(),
        kind: z.enum(['image', 'video', 'audio']).optional(),
        limit: z.coerce.number().int().min(1).max(60).default(24),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      rawQuery ?? {}
    );

    const { assets, total } = await this.media.listAssets(query);
    return { assets: assets.map((a) => a.toDTO()), total };
  }
}

/**
 * Registers an uploaded object.
 *
 * The bytes are uploaded first (multipart, handled by the router) and this use
 * case persists metadata only. The object key is generated server-side from a
 * random id so client-supplied paths can never escape the bucket prefix.
 */
export class RegisterAssetUseCase {

  private readonly media: MediaRepository;
  private readonly storage: ObjectStorage | null;
  private readonly eventBus: DomainEventBus;

  constructor(media: MediaRepository, storage: ObjectStorage | null, eventBus: DomainEventBus) {
    this.media = media;
    this.storage = storage;
    this.eventBus = eventBus;
  }

  /** Builds a safe, collision-resistant key: media/<kind>/<yyyymm>/<hash>.<ext> */
  buildObjectKey(mimeType: string): string {
    const ext = RegisterAssetUseCase.extensionFor(mimeType);
    const now = new Date();
    const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const hash = crypto.randomBytes(16).toString('hex');
    const kind = mimeType.split('/')[0];
    return path.posix.join('media', kind, ym, `${hash}.${ext}`);
  }

  private static extensionFor(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/avif': 'avif',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/ogg': 'ogv',
      'video/quicktime': 'mov',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'audio/webm': 'weba',
    };
    return map[mimeType] ?? 'bin';
  }

  async execute(
    actor: User,
    rawMeta: unknown,
    bytes: Buffer
  ): Promise<ReturnType<MediaAsset['toDTO']> & { url: string }> {
    actor.assertCan(PERMISSIONS.UPLOAD_MEDIA);
    const meta = parseOrThrow(uploadMetaSchema, rawMeta);

    if (bytes.length === 0) {
      throw new ValidationError('Файл пуст.');
    }
    if (bytes.length !== meta.sizeBytes) {
      throw new ValidationError('Размер загруженного файла не совпадает с заявленным.');
    }

    // Album ownership is checked before a file is attached to it.
    if (meta.albumId) {
      const album = await this.media.findAlbum(meta.albumId);
      if (!album) throw new NotFoundError('Альбом не найден.');
      album.assertOwnedBy(actor.id);
    }

    const objectKey = this.buildObjectKey(meta.mimeType);

    // Domain validation runs before the bytes are stored: an invalid upload
    // must not leave orphaned objects in the bucket.
    const asset = MediaAsset.create({
      albumId: meta.albumId,
      ownerId: actor.id,
      ownerName: actor.fullName.value,
      title: meta.title,
      description: meta.description,
      objectKey,
      mimeType: meta.mimeType,
      sizeBytes: meta.sizeBytes,
      durationSec: meta.durationSec,
      width: meta.width,
      height: meta.height,
    });

    if (this.storage) {
      // Bytes are uploaded, but the client-facing URL is the app's own proxy
      // route (/media/<assetId>): Garage requires signed S3 requests, so the
      // raw object key is not directly fetchable by a browser.
      await this.storage.put(objectKey, bytes, asset.mimeType);
    }

    await this.media.saveAsset(asset);

    if (asset.albumId) {
      const album = await this.media.findAlbum(asset.albumId);
      // First asset becomes the album cover automatically.
      if (album && !album.coverAssetId) {
        await this.media.setCover(album.id, asset.id);
      }
    }

    this.eventBus.publish({
      eventName: 'media.asset_uploaded',
      occurredAt: asset.createdAt,
      boundedContext: 'identity',
      payload: { assetId: asset.id, ownerId: actor.id, kind: asset.kind },
    });

    return { ...asset.toDTO(), url: `/media/${asset.id}` };
  }
}

export class DeleteAssetUseCase {

  private readonly media: MediaRepository;
  private readonly storage: ObjectStorage | null;

  constructor(media: MediaRepository, storage: ObjectStorage | null) {
    this.media = media;
    this.storage = storage;
  }

  async execute(actor: User, assetId: string): Promise<{ ok: true }> {
    const asset = await this.media.findAsset(assetId);
    if (!asset) throw new NotFoundError('Файл не найден.');

    // Owners delete their own files; moderators delete anything.
    if (asset.ownerId !== actor.id) {
      actor.assertCan(PERMISSIONS.MODERATE_MEDIA);
    }

    if (this.storage) {
      await this.storage.delete(asset.objectKey);
    }
    await this.media.deleteAsset(assetId);
    return { ok: true };
  }
}

export class DeleteAlbumUseCase {
  private readonly media: MediaRepository;

  constructor(media: MediaRepository) {
    this.media = media;
  }

  async execute(actor: User, albumId: string): Promise<{ ok: true }> {
    const album = await this.media.findAlbum(albumId);
    if (!album) throw new NotFoundError('Альбом не найден.');

    if (album.ownerId !== actor.id) {
      actor.assertCan(PERMISSIONS.MODERATE_MEDIA);
    }

    await this.media.deleteAlbum(albumId);
    return { ok: true };
  }
}

/** Looks up an asset for the media-streaming route. */
export class FindAssetUseCase {
  private readonly media: MediaRepository;

  constructor(media: MediaRepository) {
    this.media = media;
  }

  async execute(assetId: string): Promise<{
    id: string;
    objectKey: string;
    albumId: string | null;
    mimeType: string;
    title: string;
  } | null> {
    const asset = await this.media.findAsset(assetId);
    if (!asset) return null;
    return {
      id: asset.id,
      objectKey: asset.objectKey,
      albumId: asset.albumId,
      mimeType: asset.mimeType,
      title: asset.title,
    };
  }
}

/** Looks up an album's access rules for the media-streaming route. */
export class FindAlbumAccessUseCase {
  private readonly media: MediaRepository;

  constructor(media: MediaRepository) {
    this.media = media;
  }

  async execute(albumId: string): Promise<{
    visibility: 'public' | 'private';
    ownerId: string;
  } | null> {
    const album = await this.media.findAlbum(albumId);
    if (!album) return null;
    return { visibility: album.visibility, ownerId: album.ownerId };
  }
}
