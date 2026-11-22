import { InvariantViolationError, ValidationError } from '../shared/DomainError.ts';
import { SanitizedText } from '../shared/ValueObjects.ts';

/**
 * Media library: albums owned by users, holding uploaded assets.
 *
 * Asset bytes live in Garage S3; this context stores only metadata and the
 * object key, so the database stays small and the CDN/edge can serve files.
 */

export const MEDIA_KINDS = ['image', 'video', 'audio'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export interface AlbumDTO {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  description: string;
  visibility: 'public' | 'private';
  coverAssetId: string | null;
  assetCount: number;
  createdAt: string;
  updatedAt: string;
}

export class Album {
  readonly id: string;
  readonly ownerId: string;
  readonly ownerName: string;
  readonly title: string;
  readonly description: string;
  readonly visibility: 'public' | 'private';
  readonly coverAssetId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(props: {
    id: string;
    ownerId: string;
    ownerName: string;
    title: string;
    description: string;
    visibility: 'public' | 'private';
    coverAssetId: string | null;
    createdAt: string;
    updatedAt: string;
  }) {
    this.id = props.id;
    this.ownerId = props.ownerId;
    this.ownerName = props.ownerName;
    this.title = props.title;
    this.description = props.description;
    this.visibility = props.visibility;
    this.coverAssetId = props.coverAssetId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input: {
    ownerId: string;
    ownerName: string;
    title: unknown;
    description?: unknown;
    visibility?: unknown;
  }): Album {
    const title = SanitizedText.create(input.title, {
      fieldLabel: 'Название альбома',
      minLen: 2,
      maxLen: 120,
    });

    const now = new Date().toISOString();
    return new Album({
      id: `alb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ownerId: input.ownerId,
      ownerName: SanitizedText.sanitizeRaw(input.ownerName, 120) || 'Участник',
      title: title.value,
      description: SanitizedText.sanitizeRaw(input.description, 600),
      visibility: input.visibility === 'private' ? 'private' : 'public',
      coverAssetId: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(props: {
    id: string;
    ownerId: string;
    ownerName: string;
    title: string;
    description: string;
    visibility: string;
    coverAssetId: string | null;
    createdAt: string;
    updatedAt: string;
  }): Album {
    return new Album({
      id: props.id,
      ownerId: props.ownerId,
      ownerName: props.ownerName,
      title: props.title,
      description: props.description,
      visibility: props.visibility === 'private' ? 'private' : 'public',
      coverAssetId: props.coverAssetId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  assertAccessibleBy(userId: string | null): void {
    if (this.visibility === 'private' && this.ownerId !== userId) {
      throw new InvariantViolationError('Альбом доступен только владельцу.', 'FORBIDDEN');
    }
  }

  assertOwnedBy(userId: string): void {
    if (this.ownerId !== userId) {
      throw new InvariantViolationError(
        'Изменять альбом может только владелец.',
        'FORBIDDEN'
      );
    }
  }

  toDTO(assetCount = 0): AlbumDTO {
    return {
      id: this.id,
      ownerId: this.ownerId,
      ownerName: this.ownerName,
      title: this.title,
      description: this.description,
      visibility: this.visibility,
      coverAssetId: this.coverAssetId,
      assetCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export interface MediaAssetDTO {
  id: string;
  albumId: string | null;
  ownerId: string;
  ownerName: string;
  kind: MediaKind;
  title: string;
  description: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
}

/** Upload constraints are domain rules, not handler details. */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

const MIME_ALLOWLIST: Record<MediaKind, RegExp> = {
  image: /^image\/(jpeg|png|webp|avif|gif)$/,
  video: /^video\/(mp4|webm|ogg|quicktime)$/,
  audio: /^audio\/(mpeg|mp4|ogg|wav|webm)$/,
};

export class MediaAsset {
  readonly id: string;
  readonly albumId: string | null;
  readonly ownerId: string;
  readonly ownerName: string;
  readonly kind: MediaKind;
  readonly title: string;
  readonly description: string;
  readonly objectKey: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly durationSec: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly createdAt: string;

  private constructor(props: {
    id: string;
    albumId: string | null;
    ownerId: string;
    ownerName: string;
    kind: MediaKind;
    title: string;
    description: string;
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
    durationSec: number | null;
    width: number | null;
    height: number | null;
    createdAt: string;
  }) {
    this.id = props.id;
    this.albumId = props.albumId;
    this.ownerId = props.ownerId;
    this.ownerName = props.ownerName;
    this.kind = props.kind;
    this.title = props.title;
    this.description = props.description;
    this.objectKey = props.objectKey;
    this.mimeType = props.mimeType;
    this.sizeBytes = props.sizeBytes;
    this.durationSec = props.durationSec;
    this.width = props.width;
    this.height = props.height;
    this.createdAt = props.createdAt;
  }

  static create(input: {
    albumId?: unknown;
    ownerId: string;
    ownerName: string;
    title?: unknown;
    description?: unknown;
    objectKey: string;
    mimeType: unknown;
    sizeBytes: unknown;
    durationSec?: unknown;
    width?: unknown;
    height?: unknown;
  }): MediaAsset {
    const mimeType = SanitizedText.sanitizeRaw(input.mimeType, 100).toLowerCase();
    const kind = MediaAsset.kindForMime(mimeType);
    if (!kind) {
      throw new ValidationError(
        'Поддерживаются изображения (JPEG, PNG, WebP, AVIF, GIF), видео (MP4, WebM, MOV) и аудио.'
      );
    }

    if (!MIME_ALLOWLIST[kind].test(mimeType)) {
      throw new ValidationError(`Тип файла «${mimeType}» не поддерживается.`);
    }

    const sizeBytes = typeof input.sizeBytes === 'number' ? input.sizeBytes : Number.NaN;
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      throw new ValidationError('Размер файла некорректен.');
    }

    const limit =
      kind === 'image' ? MAX_IMAGE_BYTES : kind === 'video' ? MAX_VIDEO_BYTES : MAX_AUDIO_BYTES;
    if (sizeBytes > limit) {
      throw new ValidationError(
        `Файл слишком большой: максимум ${Math.round(limit / (1024 * 1024))} МБ для формата ${kind}.`
      );
    }

    return new MediaAsset({
      id: `ast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      albumId: SanitizedText.sanitizeRaw(input.albumId, 64) || null,
      ownerId: input.ownerId,
      ownerName: SanitizedText.sanitizeRaw(input.ownerName, 120) || 'Участник',
      kind,
      title: SanitizedText.sanitizeRaw(input.title, 160) || 'Без названия',
      description: SanitizedText.sanitizeRaw(input.description, 600),
      objectKey: input.objectKey,
      mimeType,
      sizeBytes,
      durationSec: MediaAsset.optionalPositive(input.durationSec),
      width: MediaAsset.optionalPositive(input.width),
      height: MediaAsset.optionalPositive(input.height),
      createdAt: new Date().toISOString(),
    });
  }

  private static optionalPositive(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Math.round(value)
      : null;
  }

  private static kindForMime(mime: string): MediaKind | null {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    return null;
  }

  static rehydrate(props: {
    id: string;
    albumId: string | null;
    ownerId: string;
    ownerName: string;
    kind: string;
    title: string;
    description: string;
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
    durationSec: number | null;
    width: number | null;
    height: number | null;
    createdAt: string;
  }): MediaAsset {
    return new MediaAsset({
      ...props,
      kind:
        props.kind === 'video' || props.kind === 'audio'
          ? (props.kind as MediaKind)
          : 'image',
    });
  }

  assertOwnedBy(userId: string): void {
    if (this.ownerId !== userId) {
      throw new InvariantViolationError('Удалить файл может только владелец.', 'FORBIDDEN');
    }
  }

  toDTO(): MediaAssetDTO {
    return {
      id: this.id,
      albumId: this.albumId,
      ownerId: this.ownerId,
      ownerName: this.ownerName,
      kind: this.kind,
      title: this.title,
      description: this.description,
      objectKey: this.objectKey,
      mimeType: this.mimeType,
      sizeBytes: this.sizeBytes,
      durationSec: this.durationSec,
      width: this.width,
      height: this.height,
      createdAt: this.createdAt,
    };
  }
}
