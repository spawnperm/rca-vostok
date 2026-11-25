import crypto from 'crypto';
import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import {
  buildDefaultContentForKind,
  CommitOfficeToForgejoSchema,
  CreateForgejoRepoSchema,
  CreateGarageBucketSchema,
  CreateOfficeDocumentSchema,
  GARAGE_MAX_UPLOAD_BYTES,
  normalizeS3Prefix,
  type OfficeDocKind,
  UpdateOfficeDocumentSchema,
  UploadGarageObjectSchema,
  UploadOfficeDocumentSchema,
} from '../../domain/office/entities.ts';
import { getDb } from '../../infrastructure/db/client.ts';
import { deals, forgejoRepos, garageBuckets, garageObjects, officeDocuments } from '../../infrastructure/db/schema.ts';
import {
  createForgejoRepository,
  listForgejoInventory,
  recordForgejoCommit,
} from '../../infrastructure/forgejo/forgejoService.ts';
import { natsBus } from '../../infrastructure/nats/eventBus.ts';
import {
  decodeUploadedOfficeFile,
  encodeOfficeDocumentToBuffer,
  OFFICE_MIME_TYPES,
} from '../../infrastructure/office/ooxmlCodec.ts';
import {
  createGarageBucket,
  deleteGarageObject,
  getGarageObjectBuffer,
  inferContentTypeFromKey,
  listBucketObjects,
  listGarageInventory,
  putGarageObject,
} from '../../infrastructure/storage/garageS3Service.ts';
import { requireAuth, requirePermission } from '../middleware/tenantAndAuth.ts';
import { asyncHandler, parseBody } from './routeHelpers.ts';

export function createOfficeRouter(): Router {
  const router = Router();

  router.get(
    '/office/workspace',
    requireAuth,
    requirePermission('deals:read'),
    asyncHandler('Ошибка загрузки контура Forgejo / Garage S3 / Univer', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const dealIdFilter = typeof req.query.dealId === 'string' ? req.query.dealId.trim() : '';

      const [garage, forgejo, docs] = await Promise.all([
        listGarageInventory(tenantId),
        listForgejoInventory(tenantId),
        dealIdFilter
          ? db
              .select()
              .from(officeDocuments)
              .where(and(eq(officeDocuments.tenantId, tenantId), eq(officeDocuments.dealId, dealIdFilter)))
              .orderBy(desc(officeDocuments.updatedAt))
          : db
              .select()
              .from(officeDocuments)
              .where(eq(officeDocuments.tenantId, tenantId))
              .orderBy(desc(officeDocuments.updatedAt)),
      ]);

      res.json({ garage, forgejo, documents: docs });
    })
  );

  router.post(
    '/office/garage/buckets',
    requireAuth,
    requirePermission('deals:write'),
    asyncHandler('Ошибка создания бакета Garage S3', async (req, res) => {
      const data = parseBody(CreateGarageBucketSchema, req, res, 'Неверное имя бакета S3');
      if (!data) return;

      const tenantId = req.tenant!.id;
      try {
        const bucket = await createGarageBucket({
          tenantId,
          name: data.name,
          visibility: data.visibility,
          quotaMb: data.quotaMb,
        });

        await natsBus.publish(tenantId, `garage.${req.tenant!.subdomain}.bucket.created`, req.actor!.userId, {
          bucketName: bucket.name,
        });

        res.status(201).json({ bucket });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Ошибка создания бакета Garage S3';
        res.status(409).json({ error: msg });
      }
    })
  );

  router.get(
    '/office/garage/buckets/:bucketName/objects',
    requireAuth,
    requirePermission('deals:read'),
    asyncHandler('Ошибка получения списка объектов бакета Garage S3', async (req, res) => {
      const prefix = typeof req.query.prefix === 'string' ? req.query.prefix : undefined;
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const result = await listBucketObjects({
        tenantId: req.tenant!.id,
        bucketName: req.params.bucketName,
        prefix,
        q,
      });
      if (!result) {
        return res.status(404).json({ error: 'Бакет Garage S3 не найден в контуре текущего тенанта' });
      }
      res.json(result);
    })
  );

  router.post(
    '/office/garage/objects/upload',
    requireAuth,
    requirePermission('deals:write'),
    asyncHandler('Ошибка загрузки файла в Garage S3', async (req, res) => {
      const data = parseBody(UploadGarageObjectSchema, req, res, 'Некорректные параметры загрузки в Garage S3');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const subdomain = req.tenant!.subdomain;

      const [bucket] = await db
        .select()
        .from(garageBuckets)
        .where(and(eq(garageBuckets.tenantId, tenantId), eq(garageBuckets.name, data.bucketName)));
      if (!bucket) {
        return res.status(404).json({ error: 'Бакет не найден или не принадлежит текущему тенанту' });
      }

      const rawBase64 = data.base64Content.includes(',') ? data.base64Content.split(',')[1] : data.base64Content;
      const buffer = Buffer.from(rawBase64, 'base64');
      if (buffer.length === 0) {
        return res.status(400).json({ error: 'Загруженный файл пуст' });
      }
      if (buffer.length > GARAGE_MAX_UPLOAD_BYTES) {
        return res.status(413).json({ error: 'Размер файла превышает лимит 15 МБ' });
      }

      const cleanPrefix = normalizeS3Prefix(data.prefix);
      const safeFileName = data.fileName.trim().replace(/[/\\]/g, '_');
      const objectKey = cleanPrefix ? `${cleanPrefix}/${safeFileName}` : safeFileName;
      const contentType = inferContentTypeFromKey(objectKey, data.contentType);

      const s3Object = await putGarageObject({
        tenantId,
        tenantSubdomain: subdomain,
        bucketName: bucket.name,
        objectKey,
        contentType,
        buffer,
        linkedEntityType: 'garage_file',
        linkedEntityId: null,
        actorId: req.actor!.userId,
        requireExistingBucket: true,
      });

      await natsBus.publish(tenantId, `garage.${subdomain}.object.uploaded`, req.actor!.userId, {
        objectId: s3Object.id,
        bucketName: bucket.name,
        objectKey: s3Object.objectKey,
        sizeBytes: s3Object.sizeBytes,
        contentType: s3Object.contentType,
        versionNumber: s3Object.versionNumber,
      });

      res.status(201).json({ object: s3Object });
    })
  );

  const SAFE_INLINE_MIMES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
  ]);

  router.get(
    '/office/garage/objects/:id/download',
    requireAuth,
    requirePermission('deals:read'),
    asyncHandler('Ошибка скачивания объекта Garage S3', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [obj] = await db
        .select()
        .from(garageObjects)
        .where(and(eq(garageObjects.id, req.params.id), eq(garageObjects.tenantId, tenantId)));
      if (!obj) return res.status(404).json({ error: 'Объект Garage S3 не найден' });

      const [bucket] = await db
        .select()
        .from(garageBuckets)
        .where(and(eq(garageBuckets.tenantId, tenantId), eq(garageBuckets.name, obj.bucketName)));
      if (!bucket) return res.status(404).json({ error: 'Бакет объекта не принадлежит текущему тенанту' });

      const buf = await getGarageObjectBuffer(req.tenant!.subdomain, obj.bucketName, obj.objectKey);
      if (!buf) return res.status(404).json({ error: 'Файл объекта отсутствует в хранилище' });

      const fileName = obj.objectKey.split('/').pop() || 'object.bin';
      const baseMime = obj.contentType.split(';')[0].trim().toLowerCase();
      const wantsInline = req.query.disposition === 'inline';
      const allowInline = wantsInline && SAFE_INLINE_MIMES.has(baseMime);

      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Type', obj.contentType);
      if (allowInline) {
        res.setHeader('Content-Security-Policy', 'sandbox');
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      } else {
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      }
      res.send(buf);
    })
  );

  router.get(
    '/office/garage/objects/:id/preview',
    requireAuth,
    requirePermission('deals:read'),
    asyncHandler('Ошибка предпросмотра объекта Garage S3', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [obj] = await db
        .select()
        .from(garageObjects)
        .where(and(eq(garageObjects.id, req.params.id), eq(garageObjects.tenantId, tenantId)));
      if (!obj) return res.status(404).json({ error: 'Объект Garage S3 не найден' });

      const [bucket] = await db
        .select()
        .from(garageBuckets)
        .where(and(eq(garageBuckets.tenantId, tenantId), eq(garageBuckets.name, obj.bucketName)));
      if (!bucket) return res.status(404).json({ error: 'Бакет объекта не принадлежит текущему тенанту' });

      const buf = await getGarageObjectBuffer(req.tenant!.subdomain, obj.bucketName, obj.objectKey);
      if (!buf) return res.status(404).json({ error: 'Файл объекта отсутствует в хранилище' });

      const baseMime = obj.contentType.split(';')[0].trim().toLowerCase();
      const ext = (obj.objectKey.split('.').pop() || '').toLowerCase();

      const imageMimes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/x-icon']);
      const textExtensions = new Set([
        'txt', 'md', 'json', 'csv', 'yaml', 'yml', 'xml', 'sql', 'ts', 'tsx', 'js', 'jsx',
        'css', 'html', 'svg', 'log', 'env', 'ini', 'sh', 'conf', 'toml',
      ]);
      const ooxmlExtensions = new Set(['xlsx', 'docx', 'pptx']);

      let mode: 'image' | 'pdf' | 'text' | 'ooxml' | 'binary' = 'binary';
      let textContent: string | null = null;
      let truncated = false;
      let lineCount = 0;

      if (imageMimes.has(baseMime)) {
        mode = 'image';
      } else if (baseMime === 'application/pdf' || ext === 'pdf') {
        mode = 'pdf';
      } else if (
        baseMime.startsWith('text/') ||
        baseMime === 'application/json' ||
        baseMime === 'application/xml' ||
        baseMime === 'application/javascript' ||
        baseMime === 'application/typescript' ||
        baseMime === 'image/svg+xml' ||
        textExtensions.has(ext)
      ) {
        mode = 'text';
        const MAX_TEXT_PREVIEW = 512 * 1024;
        truncated = buf.length > MAX_TEXT_PREVIEW;
        const slice = truncated ? buf.subarray(0, MAX_TEXT_PREVIEW) : buf;
        textContent = slice.toString('utf8');
        lineCount = textContent.length === 0 ? 0 : textContent.split(/\r?\n/).length;
      } else if (
        ooxmlExtensions.has(ext) ||
        obj.linkedEntityType === 'office_document'
      ) {
        mode = 'ooxml';
      }

      res.json({
        object: obj,
        preview: {
          mode,
          textContent,
          truncated,
          lineCount,
          linkedDocumentId: obj.linkedEntityType === 'office_document' ? obj.linkedEntityId : null,
          downloadPath: `/api/office/garage/objects/${obj.id}/download`,
          inlinePath: `/api/office/garage/objects/${obj.id}/download?disposition=inline`,
        },
      });
    })
  );

  router.delete(
    '/office/garage/objects/:id',
    requireAuth,
    requirePermission('deals:write'),
    asyncHandler('Ошибка удаления объекта Garage S3', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [obj] = await db
        .select()
        .from(garageObjects)
        .where(and(eq(garageObjects.id, req.params.id), eq(garageObjects.tenantId, tenantId)));
      if (!obj) return res.status(404).json({ error: 'Объект Garage S3 не найден' });

      await deleteGarageObject(tenantId, req.tenant!.subdomain, obj.bucketName, obj.objectKey);
      await natsBus.publish(tenantId, `garage.${req.tenant!.subdomain}.object.deleted`, req.actor!.userId, {
        objectId: obj.id,
        bucketName: obj.bucketName,
        objectKey: obj.objectKey,
      });
      res.json({ deleted: true });
    })
  );

  router.post(
    '/office/forgejo/repos',
    requireAuth,
    requirePermission('deals:write'),
    asyncHandler('Ошибка создания репозитория Forgejo', async (req, res) => {
      const data = parseBody(CreateForgejoRepoSchema, req, res, 'Некорректные данные репозитория');
      if (!data) return;

      try {
        const repo = await createForgejoRepository({
          tenantId: req.tenant!.id,
          tenantSubdomain: req.tenant!.subdomain,
          actorId: req.actor!.userId,
          name: data.name,
          description: data.description,
          visibility: data.visibility,
        });
        res.status(201).json({ repo });
      } catch (err: unknown) {
        res.status(409).json({ error: err instanceof Error ? err.message : 'Ошибка создания репозитория Forgejo' });
      }
    })
  );

  router.post(
    '/office/documents',
    requireAuth,
    requirePermission('deals:write'),
    asyncHandler('Ошибка создания документа Univer', async (req, res) => {
      const data = parseBody(CreateOfficeDocumentSchema, req, res, 'Некорректные данные документа');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const subdomain = req.tenant!.subdomain;

      if (data.dealId) {
        const [deal] = await db
          .select({ id: deals.id })
          .from(deals)
          .where(and(eq(deals.id, data.dealId), eq(deals.tenantId, tenantId)));
        if (!deal) return res.status(400).json({ error: 'Указанная сделка не найдена в тенанте' });
      }

      if (data.forgejoRepoId) {
        const [repo] = await db
          .select({ id: forgejoRepos.id })
          .from(forgejoRepos)
          .where(and(eq(forgejoRepos.id, data.forgejoRepoId), eq(forgejoRepos.tenantId, tenantId)));
        if (!repo) return res.status(400).json({ error: 'Указанный репозиторий Forgejo не найден в тенанте' });
      }

      const kind = data.kind;
      const docId = `odoc_${crypto.randomUUID().slice(0, 10)}`;
      const content = data.content || buildDefaultContentForKind(kind, data.title);
      const bucketName = data.bucketName || `nexus-${subdomain}-docs`;
      const slug =
        data.title
          .toLowerCase()
          .replace(/[^a-z0-9а-яё]+/gi, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 40) || docId;
      const objectKey = `univer/${slug}-${docId.slice(-6)}.${kind}`;

      const buffer = await encodeOfficeDocumentToBuffer(kind, data.title, content);
      const s3Object = await putGarageObject({
        tenantId,
        tenantSubdomain: subdomain,
        bucketName,
        objectKey,
        contentType: OFFICE_MIME_TYPES[kind],
        buffer,
        linkedEntityType: 'office_document',
        linkedEntityId: docId,
        actorId: req.actor!.userId,
      });

      let repoId = data.forgejoRepoId || null;
      if (!repoId) {
        const [defaultRepo] = await db
          .select()
          .from(forgejoRepos)
          .where(eq(forgejoRepos.tenantId, tenantId))
          .limit(1);
        repoId = defaultRepo?.id || null;
      }

      let commitSha: string | null = null;
      if (repoId) {
        const commitRes = await recordForgejoCommit({
          tenantId,
          tenantSubdomain: subdomain,
          repoId,
          message: `docs(${kind}): create ${data.title}`,
          actorId: req.actor!.userId,
          authorName: req.actor!.fullName,
          authorEmail: req.actor!.email,
          s3ObjectKey: `${bucketName}/${objectKey}`,
          documentId: docId,
        });
        commitSha = commitRes.commit.commitSha;
      }

      const [doc] = await db
        .insert(officeDocuments)
        .values({
          id: docId,
          tenantId,
          title: data.title,
          kind,
          dealId: data.dealId || null,
          bucketName,
          objectKey,
          forgejoRepoId: repoId,
          latestCommitSha: commitSha,
          sizeBytes: buffer.length,
          content: content as unknown as Record<string, unknown>,
          updatedBy: req.actor!.userId,
        })
        .returning();

      await natsBus.publish(tenantId, `office.${subdomain}.document.saved`, req.actor!.userId, {
        documentId: doc.id,
        title: doc.title,
        kind: doc.kind,
        bucketName,
        objectKey,
        commitSha,
      });

      res.status(201).json({ document: doc, s3Object });
    })
  );

  router.post(
    '/office/documents/upload',
    requireAuth,
    requirePermission('deals:write'),
    asyncHandler('Не удалось разобрать офисный файл (.xlsx / .docx / .pptx)', async (req, res) => {
      const data = parseBody(UploadOfficeDocumentSchema, req, res, 'Некорректный файл документа');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const subdomain = req.tenant!.subdomain;
      const rawBase64 = data.base64Content.includes(',') ? data.base64Content.split(',')[1] : data.base64Content;
      const buffer = Buffer.from(rawBase64, 'base64');
      if (buffer.length === 0) {
        return res.status(400).json({ error: 'Загруженный файл пуст' });
      }

      if (data.dealId) {
        const [deal] = await db
          .select({ id: deals.id })
          .from(deals)
          .where(and(eq(deals.id, data.dealId), eq(deals.tenantId, tenantId)));
        if (!deal) return res.status(400).json({ error: 'Указанная сделка не найдена в тенанте' });
      }

      const decoded = await decodeUploadedOfficeFile(data.fileName, buffer);
      const docId = `odoc_${crypto.randomUUID().slice(0, 10)}`;
      const bucketName = `nexus-${subdomain}-docs`;
      const safeFile = data.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const objectKey = `uploads/${docId.slice(-6)}-${safeFile}`;

      const s3Object = await putGarageObject({
        tenantId,
        tenantSubdomain: subdomain,
        bucketName,
        objectKey,
        contentType: OFFICE_MIME_TYPES[decoded.kind],
        buffer,
        linkedEntityType: 'office_document',
        linkedEntityId: docId,
        actorId: req.actor!.userId,
      });

      const [defaultRepo] = await db
        .select()
        .from(forgejoRepos)
        .where(eq(forgejoRepos.tenantId, tenantId))
        .limit(1);

      let commitSha: string | null = null;
      if (defaultRepo) {
        const commitRes = await recordForgejoCommit({
          tenantId,
          tenantSubdomain: subdomain,
          repoId: defaultRepo.id,
          message: `import(${decoded.kind}): upload ${data.fileName} to Garage S3`,
          actorId: req.actor!.userId,
          authorName: req.actor!.fullName,
          authorEmail: req.actor!.email,
          s3ObjectKey: `${bucketName}/${objectKey}`,
          documentId: docId,
        });
        commitSha = commitRes.commit.commitSha;
      }

      const [doc] = await db
        .insert(officeDocuments)
        .values({
          id: docId,
          tenantId,
          title: decoded.title,
          kind: decoded.kind,
          dealId: data.dealId || null,
          bucketName,
          objectKey,
          forgejoRepoId: defaultRepo?.id || null,
          latestCommitSha: commitSha,
          sizeBytes: buffer.length,
          content: decoded.content as unknown as Record<string, unknown>,
          updatedBy: req.actor!.userId,
        })
        .returning();

      await natsBus.publish(tenantId, `office.${subdomain}.document.saved`, req.actor!.userId, {
        documentId: doc.id,
        title: doc.title,
        kind: doc.kind,
        imported: true,
      });

      res.status(201).json({ document: doc, s3Object });
    })
  );

  router.put(
    '/office/documents/:id',
    requireAuth,
    requirePermission('deals:write'),
    asyncHandler('Ошибка сохранения документа в Garage S3', async (req, res) => {
      const data = parseBody(UpdateOfficeDocumentSchema, req, res, 'Некорректное содержимое документа');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const subdomain = req.tenant!.subdomain;
      const [existing] = await db
        .select()
        .from(officeDocuments)
        .where(and(eq(officeDocuments.id, req.params.id), eq(officeDocuments.tenantId, tenantId)));
      if (!existing) return res.status(404).json({ error: 'Документ Univer не найден' });

      const kind = existing.kind as OfficeDocKind;
      if (data.content.type !== kind) {
        return res.status(400).json({ error: 'Тип контента не соответствует формату документа' });
      }

      if (data.dealId) {
        const [deal] = await db
          .select({ id: deals.id })
          .from(deals)
          .where(and(eq(deals.id, data.dealId), eq(deals.tenantId, tenantId)));
        if (!deal) return res.status(400).json({ error: 'Указанная сделка не найдена в тенанте' });
      }

      if (data.forgejoRepoId) {
        const [repo] = await db
          .select({ id: forgejoRepos.id })
          .from(forgejoRepos)
          .where(and(eq(forgejoRepos.id, data.forgejoRepoId), eq(forgejoRepos.tenantId, tenantId)));
        if (!repo) return res.status(400).json({ error: 'Указанный репозиторий Forgejo не найден в тенанте' });
      }

      const nextTitle = data.title || existing.title;
      const buffer = await encodeOfficeDocumentToBuffer(kind, nextTitle, data.content);

      const s3Object = await putGarageObject({
        tenantId,
        tenantSubdomain: subdomain,
        bucketName: existing.bucketName,
        objectKey: existing.objectKey,
        contentType: OFFICE_MIME_TYPES[kind],
        buffer,
        linkedEntityType: 'office_document',
        linkedEntityId: existing.id,
        actorId: req.actor!.userId,
      });

      let latestCommitSha = existing.latestCommitSha;
      const targetRepoId = data.forgejoRepoId ?? existing.forgejoRepoId;
      if (data.commitMessage?.trim() && targetRepoId) {
        const commitRes = await recordForgejoCommit({
          tenantId,
          tenantSubdomain: subdomain,
          repoId: targetRepoId,
          message: data.commitMessage.trim(),
          actorId: req.actor!.userId,
          authorName: req.actor!.fullName,
          authorEmail: req.actor!.email,
          s3ObjectKey: `${existing.bucketName}/${existing.objectKey}`,
          documentId: existing.id,
        });
        latestCommitSha = commitRes.commit.commitSha;
      }

      const [updated] = await db
        .update(officeDocuments)
        .set({
          title: nextTitle,
          dealId: data.dealId !== undefined ? data.dealId : existing.dealId,
          forgejoRepoId: targetRepoId,
          latestCommitSha,
          sizeBytes: buffer.length,
          content: data.content as unknown as Record<string, unknown>,
          updatedBy: req.actor!.userId,
          updatedAt: new Date(),
        })
        .where(and(eq(officeDocuments.id, existing.id), eq(officeDocuments.tenantId, tenantId)))
        .returning();

      await natsBus.publish(tenantId, `office.${subdomain}.document.saved`, req.actor!.userId, {
        documentId: updated.id,
        title: updated.title,
        kind: updated.kind,
        sizeBytes: updated.sizeBytes,
        versionNumber: s3Object.versionNumber,
      });

      res.json({ document: updated, s3Object });
    })
  );

  router.post(
    '/office/documents/:id/commit',
    requireAuth,
    requirePermission('deals:write'),
    asyncHandler('Ошибка коммита в Forgejo', async (req, res) => {
      const data = parseBody(CommitOfficeToForgejoSchema, req, res, 'Неверные параметры коммита');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [doc] = await db
        .select()
        .from(officeDocuments)
        .where(and(eq(officeDocuments.id, req.params.id), eq(officeDocuments.tenantId, tenantId)));
      if (!doc) return res.status(404).json({ error: 'Документ Univer не найден' });

      try {
        const { repo, commit } = await recordForgejoCommit({
          tenantId,
          tenantSubdomain: req.tenant!.subdomain,
          repoId: data.repoId,
          branch: data.branch,
          message: data.message,
          actorId: req.actor!.userId,
          authorName: req.actor!.fullName,
          authorEmail: req.actor!.email,
          s3ObjectKey: `${doc.bucketName}/${doc.objectKey}`,
          documentId: doc.id,
        });

        const [updated] = await db
          .update(officeDocuments)
          .set({
            forgejoRepoId: repo.id,
            latestCommitSha: commit.commitSha,
            updatedAt: new Date(),
          })
          .where(and(eq(officeDocuments.id, doc.id), eq(officeDocuments.tenantId, tenantId)))
          .returning();

        res.status(201).json({ document: updated, commit, repo });
      } catch (err: unknown) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка коммита в Forgejo' });
      }
    })
  );

  router.get(
    '/office/documents/:id/download',
    requireAuth,
    requirePermission('deals:read'),
    asyncHandler('Ошибка скачивания документа', async (req, res) => {
      const db = await getDb();
      const [doc] = await db
        .select()
        .from(officeDocuments)
        .where(and(eq(officeDocuments.id, req.params.id), eq(officeDocuments.tenantId, req.tenant!.id)));
      if (!doc) return res.status(404).json({ error: 'Документ Univer не найден' });

      const kind = doc.kind as OfficeDocKind;
      let buffer = await getGarageObjectBuffer(req.tenant!.subdomain, doc.bucketName, doc.objectKey);
      if (!buffer) {
        buffer = await encodeOfficeDocumentToBuffer(
          kind,
          doc.title,
          doc.content as unknown as Parameters<typeof encodeOfficeDocumentToBuffer>[2]
        );
      }

      const safeName = `${doc.title.replace(/[/\\?%*:|"<>]/g, '_')}.${kind}`;
      res.setHeader('Content-Type', OFFICE_MIME_TYPES[kind]);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`);
      res.send(buffer);
    })
  );

  router.delete(
    '/office/documents/:id',
    requireAuth,
    requirePermission('deals:write'),
    asyncHandler('Ошибка удаления документа', async (req, res) => {
      const db = await getDb();
      const [deleted] = await db
        .delete(officeDocuments)
        .where(and(eq(officeDocuments.id, req.params.id), eq(officeDocuments.tenantId, req.tenant!.id)))
        .returning();
      if (!deleted) return res.status(404).json({ error: 'Документ не найден' });

      await deleteGarageObject(
        req.tenant!.id,
        req.tenant!.subdomain,
        deleted.bucketName,
        deleted.objectKey
      );
      res.json({ deleted: true });
    })
  );

  return router;
}
