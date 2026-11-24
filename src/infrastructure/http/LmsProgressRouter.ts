import express from 'express';
import { PERMISSIONS } from '../../domain/identity/Rbac.ts';
import { requireAuth, requirePermission } from './AuthMiddleware.ts';
import { sendDomainError } from './SocialRouter.ts';
import type {
  GetLmsProgressUseCase,
  UpdateLmsProgressUseCase,
} from '../../application/lms/LmsProgressUseCases.ts';

export interface LmsProgressRouterDeps {
  getLmsProgress: GetLmsProgressUseCase;
  updateLmsProgress: UpdateLmsProgressUseCase;
}

export function createLmsProgressRouter(deps: LmsProgressRouterDeps): express.Router {
  const router = express.Router();

  router.get(
    '/api/account/lms-progress',
    requireAuth(),
    requirePermission(PERMISSIONS.VIEW_OWN_PROFILE),
    async (req, res) => {
      try {
        res.setHeader('Cache-Control', 'no-store');
        res.json(await deps.getLmsProgress.execute(req.authUser!));
      } catch (err) {
        sendDomainError(err, res);
      }
    }
  );

  router.patch(
    '/api/account/lms-progress',
    requireAuth(),
    requirePermission(PERMISSIONS.EDIT_OWN_PROFILE),
    async (req, res) => {
      try {
        const progress = await deps.updateLmsProgress.execute(req.authUser!, req.body);
        res.json({ ok: true, progress });
      } catch (err) {
        sendDomainError(err, res);
      }
    }
  );

  return router;
}
