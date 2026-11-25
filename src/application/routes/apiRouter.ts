import { Router } from 'express';
import { requestObservabilityMiddleware } from '../middleware/observability.ts';
import { securityHeadersMiddleware } from '../middleware/security.ts';
import { resolveTenant } from '../middleware/tenantAndAuth.ts';
import { createAuthAndTenancyRouter, createHealthAndMetricsRouter } from './authRouter.ts';
import { createCrmRouter } from './crmRouter.ts';
import { createDirectusRouter } from './directusRouter.ts';
import { createMarketplaceRouter } from './marketplaceRouter.ts';
import { createMattermostRouter } from './mattermostRouter.ts';
import { createNocobaseRouter } from './nocobaseRouter.ts';
import { createOfficeRouter } from './officeRouter.ts';
import { createPlatformRouter } from './platformRouter.ts';
import { apiErrorHandler, apiNotFoundHandler } from './routeHelpers.ts';
import { createSocialRouter } from './socialRouter.ts';

export function createApiRouter(): Router {
  const router = Router();
  router.use(requestObservabilityMiddleware);
  router.use(securityHeadersMiddleware);

  // Liveness, readiness & Prometheus metrics must remain accessible even if tenant DB resolution is degraded
  router.use(createHealthAndMetricsRouter());

  router.use(resolveTenant);

  router.use(createAuthAndTenancyRouter());
  router.use(createCrmRouter());
  router.use(createSocialRouter());
  router.use(createOfficeRouter());
  router.use(createMarketplaceRouter());
  router.use(createNocobaseRouter());
  router.use(createDirectusRouter());
  router.use(createPlatformRouter());
  router.use('/v4', createMattermostRouter());

  router.use(apiNotFoundHandler);
  router.use(apiErrorHandler);

  return router;
}
