import express from 'express';
import { PERMISSIONS } from '../../domain/identity/Rbac.ts';
import type {
  CollectBehaviorUseCase,
  GetAnalyticsSummaryUseCase,
  GetSessionDetailsUseCase,
  ResetAnalyticsUseCase,
} from '../../application/analytics/AnalyticsUseCases.ts';
import { appLogger } from '../logging/Logger.ts';
import { requireAuth, requirePermission } from './AuthMiddleware.ts';
import { sendDomainError } from './ErrorHandler.ts';

export interface AnalyticsRouterDeps {
  collectBehavior: CollectBehaviorUseCase;
  getSummary: GetAnalyticsSummaryUseCase;
  getSessionDetails: GetSessionDetailsUseCase;
  resetAnalytics: ResetAnalyticsUseCase;
  analyticsRateLimit: express.RequestHandler;
}

const analyticsLog = appLogger.child('analytics-router');

export function createAnalyticsRouter(deps: AnalyticsRouterDeps): express.Router {
  const router = express.Router();

  router.post('/api/analytics/collect', deps.analyticsRateLimit, async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const result = await deps.collectBehavior.execute({
        sessionId: body.sessionId,
        visitorId: body.visitorId,
        viewport: body.viewport,
        referrer: body.referrer,
        utmSource: body.utmSource,
        events: body.events,
        userAgent: req.get('user-agent') || '',
      });
      res.json(result);
    } catch (err) {
      sendDomainError(err, res, analyticsLog, 'Failed to collect analytics');
    }
  });

  router.get('/api/analytics/summary', async (_req, res) => {
    try {
      res.json(await deps.getSummary.execute());
    } catch (err) {
      sendDomainError(err, res, analyticsLog, 'Failed to load analytics summary');
    }
  });

  router.get('/api/analytics/sessions/:sessionId', async (req, res) => {
    try {
      res.json(await deps.getSessionDetails.execute(req.params.sessionId));
    } catch (err) {
      sendDomainError(err, res, analyticsLog, 'Failed to load analytics session');
    }
  });

  // Destructive reset is restricted to authenticated users with analytics:view permission.
  router.delete(
    '/api/analytics/reset',
    requireAuth(),
    requirePermission(PERMISSIONS.VIEW_ANALYTICS),
    async (_req, res) => {
      try {
        res.json(await deps.resetAnalytics.execute());
      } catch (err) {
        sendDomainError(err, res, analyticsLog, 'Failed to reset analytics');
      }
    }
  );

  return router;
}
