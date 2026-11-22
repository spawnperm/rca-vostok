import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ObjectStorage } from '../../domain/media/MediaRepository.ts';

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Base URL used to build public links (edge proxy or bucket domain). */
  publicBaseUrl: string;
}

/**
 * Garage-backed object storage.
 *
 * Garage speaks the S3 API, so the official AWS SDK works unchanged. Path-style
 * addressing is required because Garage does not host per-bucket DNS.
 */
export class GarageObjectStorage implements ObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(config: S3Config) {
    this.bucket = config.bucket;
    this.publicBaseUrl = config.publicBaseUrl.replace(/\/+$/, '');
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<{ url: string }> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Media is immutable once uploaded (content-addressed keys).
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
    return { url: this.publicUrl(key) };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /**
   * Reads an object for proxying.
   *
   * Returns null when the key is absent rather than throwing, so a missing file
   * becomes a clean 404 instead of a 500.
   */
  async get(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
      );
      if (!result.Body) return null;

      const bytes = await result.Body.transformToByteArray();
      return {
        body: Buffer.from(bytes),
        contentType: result.ContentType || 'application/octet-stream',
      };
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name === 'NoSuchKey' || name === 'NotFound') return null;
      throw err;
    }
  }


  /**
   * Opens the S3 object body as a stream.
   *
   * The AWS SDK returns a Node Readable in `Body`, so the bytes are piped to the
   * client without ever being materialised in memory — a 300 MB video would
   * otherwise have to fit in the process heap.
   */
  async getStream(
    key: string
  ): Promise<{ stream: NodeJS.ReadableStream; contentType: string; sizeBytes?: number } | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
      );
      const body = result.Body as unknown as NodeJS.ReadableStream | undefined;
      if (!body) return null;

      return {
        stream: body,
        contentType: result.ContentType || 'application/octet-stream',
        sizeBytes: result.ContentLength,
      };
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name === 'NoSuchKey' || name === 'NotFound') return null;
      throw err;
    }
  }

  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key.replace(/^\/+/, '')}`;
  }
}

/** Reads S3 settings from the environment; returns null when unconfigured. */
export function createObjectStorageFromEnv(): ObjectStorage | null {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new GarageObjectStorage({
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: process.env.S3_REGION || 'garage',
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || '/media',
  });
}

/**
 * Local-disk fallback used when S3 is not configured (development and tests).
 * Files are written under the app data directory and served by the app.
 */
export class LocalObjectStorage implements ObjectStorage {
  private readonly baseDir: string;
  private readonly publicPrefix: string;

  constructor(baseDir: string, publicPrefix = '/media') {
    this.baseDir = baseDir;
    this.publicPrefix = publicPrefix;
  }

  async put(key: string, body: Buffer, _contentType: string): Promise<{ url: string }> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const target = path.join(this.baseDir, key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
    return { url: this.publicUrl(key) };
  }

  async delete(key: string): Promise<void> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    await fs.rm(path.join(this.baseDir, key), { force: true });
  }

  async get(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const ext = path.extname(key).toLowerCase();
    const types: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.avif': 'image/avif',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
      '.wav': 'audio/wav',
    };
    try {
      const body = await fs.readFile(path.join(this.baseDir, key));
      return { body, contentType: types[ext] ?? 'application/octet-stream' };
    } catch {
      return null;
    }
  }


  async getStream(
    key: string
  ): Promise<{ stream: NodeJS.ReadableStream; contentType: string; sizeBytes?: number } | null> {
    const fs = await import('node:fs');
    const fsp = await import('node:fs/promises');
    const path = await import('node:path');

    const target = path.join(this.baseDir, key);
    try {
      const stat = await fsp.stat(target);
      const types: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.avif': 'image/avif',
        '.gif': 'image/gif',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.mp3': 'audio/mpeg',
        '.ogg': 'audio/ogg',
        '.wav': 'audio/wav',
      };
      return {
        stream: fs.createReadStream(target),
        contentType: types[path.extname(key).toLowerCase()] ?? 'application/octet-stream',
        sizeBytes: stat.size,
      };
    } catch {
      return null;
    }
  }

  publicUrl(key: string): string {
    return `${this.publicPrefix}/${key.replace(/^\/+/, '')}`;
  }
}
