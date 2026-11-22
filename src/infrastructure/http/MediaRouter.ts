import express from 'express';
import { PERMISSIONS } from '../../domain/identity/Rbac.ts';
import type { ObjectStorage } from '../../domain/media/MediaRepository.ts';
import { requireAuth, requirePermission } from './AuthMiddleware.ts';
import { sendDomainError } from './SocialRouter.ts';
import type {
  CreateAlbumUseCase,
  DeleteAlbumUseCase,
  DeleteAssetUseCase,
  ListAlbumsUseCase,
  ListAssetsUseCase,
  RegisterAssetUseCase,
} from '../../application/media/MediaUseCases.ts';

export interface MediaRouterDeps {
  createAlbum: CreateAlbumUseCase;
  listAlbums: ListAlbumsUseCase;
  listAssets: ListAssetsUseCase;
  registerAsset: RegisterAssetUseCase;
  deleteAsset: DeleteAssetUseCase;
  deleteAlbum: DeleteAlbumUseCase;
  findAsset: { execute(assetId: string): Promise<{ id: string; objectKey: string; albumId: string | null; mimeType: string; title: string } | null> };
  findAlbum: { execute(albumId: string): Promise<{ visibility: 'public' | 'private'; ownerId: string } | null> };
  storage: ObjectStorage | null;
}

/**
 * Parses a multipart/octet-stream body into a Buffer.
 *
 * The project avoids adding multer: uploads here are single-file and the raw
 * body is already bounded by express.raw(). Multipart support is intentionally
 * minimal — the client sends the file as a raw body with metadata in query
 * parameters, which keeps the server dependency-free and the contract explicit.
 */
export function createMediaRouter(deps: MediaRouterDeps): express.Router {
  const router = express.Router();

  // 300 MB ceiling matches the largest allowed video; the domain re-checks the
  // per-kind limit, so this is only a transport guard.
  const rawBody = express.raw({ type: '*/*', limit: '300mb' });

  router.get('/api/media/albums', async (req, res) => {
    try {
      res.json(await deps.listAlbums.execute(req.authUser ?? null, req.query));
    } catch (err) {
      sendDomainError(err, res);
    }
  });

  router.post(
    '/api/media/albums',
    requireAuth(),
    requirePermission(PERMISSIONS.CREATE_ALBUM),
    async (req, res) => {
      try {
        res.status(201).json(await deps.createAlbum.execute(req.authUser!, req.body));
      } catch (err) {
        sendDomainError(err, res);
      }
    }
  );

  router.delete(
    '/api/media/albums/:albumId',
    requireAuth(),
    async (req, res) => {
      try {
        res.json(await deps.deleteAlbum.execute(req.authUser!, req.params.albumId));
      } catch (err) {
        sendDomainError(err, res);
      }
    }
  );

  router.get('/api/media/assets', async (req, res) => {
    try {
      res.json(await deps.listAssets.execute(req.query));
    } catch (err) {
      sendDomainError(err, res);
    }
  });

  /**
   * Uploads one file.
   *
   * Metadata travels in query parameters (`mimeType`, `sizeBytes`, `title`, …)
   * and the body is the raw file. This avoids a multipart parser while still
   * letting the domain validate type and size before anything is stored.
   */
  router.post(
    '/api/media/assets',
    requireAuth(),
    requirePermission(PERMISSIONS.UPLOAD_MEDIA),
    rawBody,
    async (req, res) => {
      try {
        const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        const meta = {
          albumId: typeof req.query.albumId === 'string' ? req.query.albumId : undefined,
          title: typeof req.query.title === 'string' ? req.query.title : undefined,
          description:
            typeof req.query.description === 'string' ? req.query.description : undefined,
          mimeType: typeof req.query.mimeType === 'string' ? req.query.mimeType : '',
          sizeBytes: req.query.sizeBytes,
          durationSec: req.query.durationSec,
          width: req.query.width,
          height: req.query.height,
        };

        res.status(201).json(await deps.registerAsset.execute(req.authUser!, meta, bytes));
      } catch (err) {
        sendDomainError(err, res);
      }
    }
  );

  router.delete(
    '/api/media/assets/:assetId',
    requireAuth(),
    async (req, res) => {
      try {
        res.json(await deps.deleteAsset.execute(req.authUser!, req.params.assetId));
      } catch (err) {
        sendDomainError(err, res);
      }
    }
  );

  /**
   * Serves an uploaded object.
   *
   * Garage requires signed S3 requests, so files cannot be linked directly.
   * The app proxies the bytes and enforces album visibility first: a private
   * album's files are only served to their owner.
   */
  router.get('/media/:assetId', async (req, res) => {
    try {
      const asset = await deps.findAsset.execute(req.params.assetId);
      if (!asset) {
        res.status(404).json({ error: 'Файл не найден.' });
        return;
      }

      if (asset.albumId) {
        const album = await deps.findAlbum.execute(asset.albumId);
        if (album && album.visibility === 'private' && album.ownerId !== req.authUser?.id) {
          res.status(403).json({ error: 'Файл доступен только владельцу.' });
          return;
        }
      }

      if (!deps.storage) {
        res.status(503).json({ error: 'Хранилище медиа не настроено.' });
        return;
      }

      // Streaming, not buffering: a 300 MB video would otherwise have to fit in
      // the process heap on a 3.8 GB host. The stream is piped straight to the
      // response and `destroy()`ed if the client disconnects early.
      const object = await deps.storage.getStream(asset.objectKey);
      if (!object) {
        res.status(404).json({ error: 'Файл отсутствует в хранилище.' });
        return;
      }

      const contentType = object.contentType || asset.mimeType;
      const total = object.sizeBytes;

      // Content-addressed keys never change, so caching is safe and long.
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Advertise range support so video and audio can seek instead of
      // downloading the whole file first.
      res.setHeader('Accept-Ranges', 'bytes');

      const range = req.headers.range;
      if (range && typeof total === 'number' && total > 0) {
        const parsed = parseByteRange(range, total);
        if (!parsed) {
          res.status(416).setHeader('Content-Range', `bytes */${total}`);
          res.end();
          return;
        }
        const { start, end } = parsed;
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Content-Length', String(end - start + 1));

        // S3 cannot seek, so a ranged read discards the leading bytes. This is
        // acceptable for the current volumes; a presigned URL would avoid it.
        let skipped = 0;
        const slice = end - start + 1;
        let sent = 0;
        object.stream.on('data', (chunk: Buffer) => {
          if (skipped < start) {
            const drop = Math.min(chunk.length, start - skipped);
            skipped += drop;
            const rest = chunk.subarray(drop);
            if (rest.length === 0) return;
            const take = rest.subarray(0, slice - sent);
            sent += take.length;
            res.write(take);
            if (sent >= slice) res.end();
            return;
          }
          const take = chunk.subarray(0, slice - sent);
          sent += take.length;
          res.write(take);
          if (sent >= slice) res.end();
        });
        object.stream.on('end', () => res.end());
        object.stream.on('error', () => res.end());

        res.on('close', () => {
          const destroyable = object.stream as unknown as { destroy?: () => void };
          destroyable.destroy?.();
        });
        return;
      }

      if (typeof total === 'number' && total > 0) {
        res.setHeader('Content-Length', String(total));
      }

      // Abort the upstream stream when the client goes away, rather than
      // draining an S3 response into a closed socket.
      res.on('close', () => {
        const destroyable = object.stream as unknown as { destroy?: () => void };
        destroyable.destroy?.();
      });

      object.stream.pipe(res);
    } catch (err) {
      sendDomainError(err, res);
    }
  });

  return router;
}

/**
 * Parses a single `bytes=start-end` range.
 *
 * Returns null for anything malformed or unsatisfiable, which the caller turns
 * into a 416. Multi-range requests are not supported: browsers only use them
 * for exotic media and the complexity is not worth it here.
 */
export function parseByteRange(
  header: string,
  total: number
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return null;

  let start: number;
  let end: number;

  if (rawStart === '') {
    // Suffix range: last N bytes.
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? total - 1 : Number(rawEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  }

  if (start < 0 || end < start || start >= total) return null;
  return { start, end: Math.min(end, total - 1) };
}
