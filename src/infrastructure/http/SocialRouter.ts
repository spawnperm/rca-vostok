import express from 'express';
import { DomainError, NotFoundError, ValidationError } from '../../domain/shared/DomainError.ts';
import { PERMISSIONS } from '../../domain/identity/Rbac.ts';
import { requireAuth, requirePermission } from './AuthMiddleware.ts';
import type {
  AddCommentUseCase,
  CreatePostUseCase,
  DeletePostUseCase,
  FollowUserUseCase,
  GetPostUseCase,
  GetSocialProfileUseCase,
  ListActivityUseCase,
  ListFeedUseCase,
  ToggleLikeUseCase,
  UpdatePostUseCase,
  UpdateSocialProfileUseCase,
} from '../../application/social/SocialUseCases.ts';

export interface SocialRouterDeps {
  getProfile: GetSocialProfileUseCase;
  updateProfile: UpdateSocialProfileUseCase;
  createPost: CreatePostUseCase;
  updatePost: UpdatePostUseCase;
  deletePost: DeletePostUseCase;
  listFeed: ListFeedUseCase;
  getPost: GetPostUseCase;
  addComment: AddCommentUseCase;
  toggleLike: ToggleLikeUseCase;
  followUser: FollowUserUseCase;
  listActivity: ListActivityUseCase;
}

export function sendDomainError(err: unknown, res: express.Response): void {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof DomainError) {
    const status = err.code === 'FORBIDDEN' ? 403 : 422;
    res.status(status).json({ error: err.message, code: err.code });
    return;
  }
  console.error('[http] unexpected error', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
}

/**
 * Community feed, blog and social profile API.
 *
 * Reads are public (so the blog is indexable); every mutation requires the
 * matching RBAC permission.
 */
export function createSocialRouter(deps: SocialRouterDeps): express.Router {
  const router = express.Router();

  // ── Feed and blog ─────────────────────────────────────────────────────────
  /** Public feed. Drafts are only visible to their own author. */
  router.get('/api/social/feed', async (req, res) => {
    try {
      res.json(await deps.listFeed.execute(req.query, req.authUser ?? null));
    } catch (err) {
      sendDomainError(err, res);
    }
  });

  router.post(
    '/api/social/posts',
    requireAuth(),
    requirePermission(PERMISSIONS.PUBLISH_POST),
    async (req, res) => {
      try {
        res.status(201).json(await deps.createPost.execute(req.authUser!, req.body));
      } catch (err) {
        sendDomainError(err, res);
      }
    }
  );

  router.get('/api/social/posts/:postId', async (req, res) => {
    try {
      res.json(await deps.getPost.execute(req.params.postId));
    } catch (err) {
      sendDomainError(err, res);
    }
  });

  router.patch(
    '/api/social/posts/:postId',
    requireAuth(),
    async (req, res) => {
      try {
        res.json(await deps.updatePost.execute(req.authUser!, req.params.postId, req.body));
      } catch (err) {
        sendDomainError(err, res);
      }
    }
  );

  router.delete(
    '/api/social/posts/:postId',
    requireAuth(),
    async (req, res) => {
      try {
        res.json(await deps.deletePost.execute(req.authUser!, req.params.postId));
      } catch (err) {
        sendDomainError(err, res);
      }
    }
  );

  // ── Comments and reactions ────────────────────────────────────────────────
  router.post(
    '/api/social/posts/:postId/comments',
    requireAuth(),
    requirePermission(PERMISSIONS.COMMENT),
    async (req, res) => {
      try {
        res
          .status(201)
          .json(await deps.addComment.execute(req.authUser!, req.params.postId, req.body));
      } catch (err) {
        sendDomainError(err, res);
      }
    }
  );

  router.post(
    '/api/social/posts/:postId/like',
    requireAuth(),
    requirePermission(PERMISSIONS.REACT),
    async (req, res) => {
      try {
        res.json(await deps.toggleLike.execute(req.authUser!, req.params.postId));
      } catch (err) {
        sendDomainError(err, res);
      }
    }
  );

  // ── Profiles and the follow graph ─────────────────────────────────────────
  router.get('/api/social/profiles/:userId', async (req, res) => {
    try {
      res.json(await deps.getProfile.execute(req.authUser ?? null, req.params.userId));
    } catch (err) {
      sendDomainError(err, res);
    }
  });

  router.patch(
    '/api/social/profile',
    requireAuth(),
    requirePermission(PERMISSIONS.EDIT_OWN_PROFILE),
    async (req, res) => {
      try {
        res.json(await deps.updateProfile.execute(req.authUser!, req.body));
      } catch (err) {
        sendDomainError(err, res);
      }
    }
  );

  router.post(
    '/api/social/profiles/:userId/follow',
    requireAuth(),
    requirePermission(PERMISSIONS.FOLLOW),
    async (req, res) => {
      try {
        const follow = (req.body ?? {}).follow !== false;
        res.json(await deps.followUser.execute(req.authUser!, req.params.userId, follow));
      } catch (err) {
        sendDomainError(err, res);
      }
    }
  );

  router.get('/api/social/activity', requireAuth(), async (req, res) => {
    try {
      const limit = Number(req.query.limit ?? 20);
      res.json({ activity: await deps.listActivity.execute(req.authUser!, limit) });
    } catch (err) {
      sendDomainError(err, res);
    }
  });

  return router;
}
