import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client.ts';
import { garageBuckets, garageObjects } from '../db/schema.ts';

declare global {
  var _garageMemObjects: Map<string, Buffer> | undefined;
}

function getMemoryStore(): Map<string, Buffer> {
  if (!global._garageMemObjects) {
    global._garageMemObjects = new Map();
  }
  return global._garageMemObjects;
}

function isMemoryMode(): boolean {
  return process.env.PGDATA_DIR === 'memory://';
}

function validateEndpointUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'http://s3.platform.local:3900';
    }
    const host = parsed.hostname.toLowerCase();
    if (host === '169.254.169.254' || host === 'metadata.google.internal' || host === '0.0.0.0') {
      return 'http://s3.platform.local:3900';
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return 'http://s3.platform.local:3900';
  }
}

let cachedS3Client: { key: string; client: S3Client } | null = null;

export function getGarageS3Client(): S3Client | null {
  const accessKeyId = process.env.GARAGE_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.GARAGE_S3_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) {
    return null;
  }
  const endpoint = validateEndpointUrl(process.env.GARAGE_S3_ENDPOINT || 'http://s3.platform.local:3900');
  const region = process.env.GARAGE_S3_REGION || 'garage-eu-1';
  const cacheKey = `${endpoint}|${region}|${accessKeyId}`;
  if (cachedS3Client && cachedS3Client.key === cacheKey) {
    return cachedS3Client.client;
  }
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
  cachedS3Client = { key: cacheKey, client };
  return client;
}

function resolveObjectDiskPath(tenantSubdomain: string, bucketName: string, objectKey: string): string {
  const safeSub = tenantSubdomain.replace(/[^a-z0-9_-]/gi, '_');
  const safeBucket = bucketName.replace(/[^a-z0-9_.-]/gi, '_');
  if (!safeSub || !safeBucket) {
    throw new Error('Некорректный идентификатор бакета или тенанта');
  }

  const rawSegments = objectKey.replace(/\\/g, '/').split('/').filter(Boolean);
  if (
    rawSegments.length === 0 ||
    rawSegments.some((seg) => seg === '.' || seg === '..' || /[\x00-\x1f]/.test(seg))
  ) {
    throw new Error('Недопустимый ключ объекта S3');
  }

  const baseDir = path.resolve(process.env.GARAGE_DATA_DIR || path.resolve(process.cwd(), 'data', 'garage-s3'));
  const bucketRoot = path.resolve(baseDir, safeSub, safeBucket);
  const targetPath = path.resolve(bucketRoot, ...rawSegments);

  if (!targetPath.startsWith(bucketRoot + path.sep)) {
    throw new Error('Нарушение изоляции пути хранилища Garage S3');
  }
  return targetPath;
}

export function getGarageS3Config() {
  const endpoint = validateEndpointUrl(process.env.GARAGE_S3_ENDPOINT || 'http://s3.platform.local:3900');
  const region = process.env.GARAGE_S3_REGION || 'garage-eu-1';
  const externalConnected = Boolean(getGarageS3Client());
  return {
    endpoint,
    region,
    s3Sdk: '@aws-sdk/client-s3',
    externalS3Connected: externalConnected,
    mode: externalConnected
      ? 'garage-s3-remote'
      : isMemoryMode()
      ? 's3-in-memory'
      : 's3-local-volume',
  };
}

export function inferContentTypeFromKey(objectKey: string, provided?: string): string {
  const cleanProvided = provided?.trim();
  if (cleanProvided && cleanProvided !== 'application/octet-stream') {
    return cleanProvided;
  }
  const ext = path.extname(objectKey).toLowerCase();
  const map: Record<string, string> = {
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
    '.md': 'text/markdown; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.yaml': 'text/yaml; charset=utf-8',
    '.yml': 'text/yaml; charset=utf-8',
    '.xml': 'application/xml',
    '.sql': 'text/plain; charset=utf-8',
    '.log': 'text/plain; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.ts': 'text/plain; charset=utf-8',
    '.zip': 'application/zip',
  };
  return map[ext] || cleanProvided || 'application/octet-stream';
}

export async function createGarageBucket(params: {
  tenantId: string;
  name: string;
  visibility?: 'private' | 'tenant-read';
  quotaMb?: number;
}) {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(garageBuckets)
    .where(and(eq(garageBuckets.tenantId, params.tenantId), eq(garageBuckets.name, params.name)));
  if (existing) {
    throw new Error(`Бакет ${params.name} уже существует`);
  }

  const s3 = getGarageS3Client();
  if (s3) {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: params.name }));
    } catch {
      await s3.send(new CreateBucketCommand({ Bucket: params.name }));
    }
  }

  const cfg = getGarageS3Config();
  const [bucket] = await db
    .insert(garageBuckets)
    .values({
      id: `bkt_${crypto.randomUUID().slice(0, 10)}`,
      tenantId: params.tenantId,
      name: params.name,
      region: cfg.region,
      visibility: params.visibility || 'private',
      quotaMb: params.quotaMb || 5120,
      endpoint: cfg.endpoint,
    })
    .returning();

  return bucket;
}

export async function putGarageObject(params: {
  tenantId: string;
  tenantSubdomain: string;
  bucketName: string;
  objectKey: string;
  contentType: string;
  buffer: Buffer;
  linkedEntityType?: string;
  linkedEntityId?: string | null;
  actorId: string;
  requireExistingBucket?: boolean;
}) {
  const db = await getDb();
  const cfg = getGarageS3Config();

  let [bucket] = await db
    .select()
    .from(garageBuckets)
    .where(and(eq(garageBuckets.tenantId, params.tenantId), eq(garageBuckets.name, params.bucketName)));

  if (!bucket) {
    if (params.requireExistingBucket) {
      throw new Error(`Бакет ${params.bucketName} не найден в контуре текущего тенанта`);
    }
    bucket = await createGarageBucket({
      tenantId: params.tenantId,
      name: params.bucketName,
      visibility: 'private',
      quotaMb: 5120,
    });
  }

  const cleanContentType = inferContentTypeFromKey(params.objectKey, params.contentType);
  const etag = crypto.createHash('sha256').update(params.buffer).digest('hex').slice(0, 32);
  const storeKey = `${params.tenantSubdomain}/${params.bucketName}/${params.objectKey}`;

  // Direct S3Client PutObject when external Garage credentials are configured
  const s3 = getGarageS3Client();
  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: params.bucketName,
        Key: params.objectKey,
        Body: params.buffer,
        ContentType: cleanContentType,
      })
    );
  }

  if (isMemoryMode()) {
    getMemoryStore().set(storeKey, params.buffer);
  } else {
    const filePath = resolveObjectDiskPath(params.tenantSubdomain, params.bucketName, params.objectKey);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, params.buffer);
  }

  const [existingObj] = await db
    .select()
    .from(garageObjects)
    .where(
      and(
        eq(garageObjects.tenantId, params.tenantId),
        eq(garageObjects.bucketName, params.bucketName),
        eq(garageObjects.objectKey, params.objectKey)
      )
    );

  if (existingObj) {
    const [updated] = await db
      .update(garageObjects)
      .set({
        contentType: cleanContentType,
        sizeBytes: params.buffer.length,
        etag,
        versionNumber: existingObj.versionNumber + 1,
        linkedEntityType: params.linkedEntityType || existingObj.linkedEntityType,
        linkedEntityId: params.linkedEntityId ?? existingObj.linkedEntityId,
        createdBy: params.actorId,
        updatedAt: new Date(),
      })
      .where(eq(garageObjects.id, existingObj.id))
      .returning();
    return updated;
  }

  const [inserted] = await db
    .insert(garageObjects)
    .values({
      id: `obj_${crypto.randomUUID().slice(0, 10)}`,
      tenantId: params.tenantId,
      bucketId: bucket.id,
      bucketName: bucket.name,
      objectKey: params.objectKey,
      contentType: cleanContentType,
      sizeBytes: params.buffer.length,
      etag,
      versionNumber: 1,
      linkedEntityType: params.linkedEntityType || 'office_document',
      linkedEntityId: params.linkedEntityId ?? null,
      createdBy: params.actorId,
    })
    .returning();

  return inserted;
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  const readable = body as AsyncIterable<Uint8Array | string>;
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function getGarageObjectBuffer(
  tenantSubdomain: string,
  bucketName: string,
  objectKey: string
): Promise<Buffer | null> {
  const s3 = getGarageS3Client();
  if (s3) {
    try {
      const resp = await s3.send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
        })
      );
      if (resp.Body) {
        return await streamToBuffer(resp.Body);
      }
    } catch {
      // Fallback to local volume cache if remote object not synced yet
    }
  }

  const storeKey = `${tenantSubdomain}/${bucketName}/${objectKey}`;
  if (isMemoryMode()) {
    return getMemoryStore().get(storeKey) || null;
  }
  const filePath = resolveObjectDiskPath(tenantSubdomain, bucketName, objectKey);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

export async function deleteGarageObject(
  tenantId: string,
  tenantSubdomain: string,
  bucketName: string,
  objectKey: string
) {
  const db = await getDb();

  const s3 = getGarageS3Client();
  if (s3) {
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
        })
      );
    } catch {
      // Proceed with local/catalog cleanup
    }
  }

  const storeKey = `${tenantSubdomain}/${bucketName}/${objectKey}`;
  if (isMemoryMode()) {
    getMemoryStore().delete(storeKey);
  } else {
    const filePath = resolveObjectDiskPath(tenantSubdomain, bucketName, objectKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  await db
    .delete(garageObjects)
    .where(
      and(
        eq(garageObjects.tenantId, tenantId),
        eq(garageObjects.bucketName, bucketName),
        eq(garageObjects.objectKey, objectKey)
      )
    );
}

export async function listBucketObjects(params: {
  tenantId: string;
  bucketName: string;
  prefix?: string;
  q?: string;
}) {
  const db = await getDb();
  const [bucket] = await db
    .select()
    .from(garageBuckets)
    .where(and(eq(garageBuckets.tenantId, params.tenantId), eq(garageBuckets.name, params.bucketName)));
  if (!bucket) return null;

  const s3 = getGarageS3Client();
  if (s3) {
    try {
      const s3List = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket.name,
          Prefix: params.prefix || undefined,
          MaxKeys: 500,
        })
      );
      if (s3List.Contents && s3List.Contents.length > 0) {
        const existingRows = await db
          .select({ objectKey: garageObjects.objectKey })
          .from(garageObjects)
          .where(and(eq(garageObjects.tenantId, params.tenantId), eq(garageObjects.bucketName, bucket.name)));
        const existingKeys = new Set(existingRows.map((r) => r.objectKey));

        for (const item of s3List.Contents) {
          if (!item.Key || item.Key.endsWith('/') || existingKeys.has(item.Key)) continue;
          await db.insert(garageObjects).values({
            id: `obj_${crypto.randomUUID().slice(0, 10)}`,
            tenantId: params.tenantId,
            bucketId: bucket.id,
            bucketName: bucket.name,
            objectKey: item.Key,
            contentType: inferContentTypeFromKey(item.Key),
            sizeBytes: item.Size ?? 0,
            etag: (item.ETag || '').replace(/"/g, '') || crypto.randomUUID().replace(/-/g, '').slice(0, 32),
            versionNumber: 1,
            linkedEntityType: 'garage_s3_sync',
            linkedEntityId: null,
            createdBy: 'garage-s3-sync',
          });
        }
      }
    } catch {
      // Keep DB catalog if external S3 server is temporarily unreachable
    }
  }

  const allObjects = await db
    .select()
    .from(garageObjects)
    .where(and(eq(garageObjects.tenantId, params.tenantId), eq(garageObjects.bucketName, bucket.name)))
    .orderBy(desc(garageObjects.updatedAt));

  const prefixNorm = params.prefix ? params.prefix.replace(/^\/+/, '') : '';
  const qNorm = params.q?.trim().toLowerCase() || '';

  const filtered = allObjects.filter((obj) => {
    if (prefixNorm && !obj.objectKey.startsWith(prefixNorm)) return false;
    if (qNorm && !obj.objectKey.toLowerCase().includes(qNorm) && !obj.contentType.toLowerCase().includes(qNorm)) {
      return false;
    }
    return true;
  });

  return {
    cluster: getGarageS3Config(),
    bucket,
    objects: filtered,
  };
}

export async function listGarageInventory(tenantId: string) {
  const db = await getDb();
  const [buckets, objects] = await Promise.all([
    db
      .select()
      .from(garageBuckets)
      .where(eq(garageBuckets.tenantId, tenantId))
      .orderBy(desc(garageBuckets.createdAt)),
    db
      .select()
      .from(garageObjects)
      .where(eq(garageObjects.tenantId, tenantId))
      .orderBy(desc(garageObjects.updatedAt)),
  ]);

  const bucketStats = new Map<string, { objectCount: number; usedBytes: number }>();
  for (const obj of objects) {
    const prev = bucketStats.get(obj.bucketName) || { objectCount: 0, usedBytes: 0 };
    prev.objectCount += 1;
    prev.usedBytes += obj.sizeBytes;
    bucketStats.set(obj.bucketName, prev);
  }

  return {
    cluster: getGarageS3Config(),
    buckets: buckets.map((b) => ({
      ...b,
      objectCount: bucketStats.get(b.name)?.objectCount ?? 0,
      usedBytes: bucketStats.get(b.name)?.usedBytes ?? 0,
    })),
    objects,
  };
}
