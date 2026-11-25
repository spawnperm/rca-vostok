import express from 'express';
import { buildRobotsTxt, generateSitemap } from '../../utils/sitemapGenerator.ts';
import type { GetSystemHealthUseCase } from '../../application/system/HealthCheckUseCase.ts';
import { appLogger } from '../logging/Logger.ts';
import { sendDomainError } from './ErrorHandler.ts';
import type { MetricsCollector } from './Metrics.ts';

export interface SystemRouterDeps {
  getSystemHealth: GetSystemHealthUseCase;
  metrics: MetricsCollector;
  getBaseUrl: (req: express.Request) => string;
}

const systemLog = appLogger.child('system-router');

export function createSystemRouter(deps: SystemRouterDeps): express.Router {
  const router = express.Router();

  router.get('/robots.txt', (req, res) => {
    const baseUrl = deps.getBaseUrl(req);
    res.type('text/plain; charset=utf-8');
    res.send(buildRobotsTxt(baseUrl));
  });

  router.get('/sitemap.xml', (req, res) => {
    const { xml } = generateSitemap({ baseUrl: deps.getBaseUrl(req) });
    res.type('application/xml; charset=utf-8');
    res.send(xml);
  });

  router.get('/api/seo/server-status', (req, res) => {
    const { baseUrl, entries, sectionCount, subSectionCount } = generateSitemap({
      baseUrl: deps.getBaseUrl(req),
    });
    res.json({
      baseUrl,
      robotsUrl: `${baseUrl}/robots.txt`,
      sitemapUrl: `${baseUrl}/sitemap.xml`,
      robotsConfigured: true,
      sitemapConfigured: true,
      indexedRoutes: entries.length,
      indexedSections: sectionCount,
      indexedSubSections: subSectionCount,
    });
  });

  // Liveness probe: answers immediately without touching DB or disk.
  router.get('/api/health/live', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      status: 'alive',
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness probe: fails with 503 whenever critical persistence or migrations fail.
  //
  // Registered under two paths because the two upstream conventions differ:
  // this project uses /api/health/ready, while mvr exposes /api/ready. Both
  // answer identically so either can be pointed at by an orchestrator.
  const readinessHandler = async (_req: express.Request, res: express.Response) => {
    try {
      const health = await deps.getSystemHealth.execute();
      res.setHeader('Cache-Control', 'no-store');
      res.status(health.status === 'unhealthy' ? 503 : 200).json({
        ready: health.status !== 'unhealthy',
        status: health.status,
        persistence: health.persistence,
        dependencies: health.dependencies,
        timestamp: health.timestamp,
      });
    } catch (err) {
      sendDomainError(err, res, systemLog, 'Readiness check failed');
    }
  };

  router.get('/api/health/ready', readinessHandler);
  router.get('/api/ready', readinessHandler);

  router.get('/api/health', async (_req, res) => {
    try {
      const health = await deps.getSystemHealth.execute();
      res.setHeader('Cache-Control', 'no-store');
      res.status(health.status === 'unhealthy' ? 503 : 200).json(health);
    } catch (err) {
      sendDomainError(err, res, systemLog, 'Health check failed');
    }
  });

  // In-process request metrics: JSON by default, Prometheus exposition when requested.
  router.get('/api/metrics', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const format = typeof req.query.format === 'string' ? req.query.format.toLowerCase() : '';
    const accept = (req.get('accept') || '').toLowerCase();
    if (format === 'prometheus' || accept.includes('text/plain; version=0.0.4')) {
      res.type('text/plain; version=0.0.4; charset=utf-8').send(deps.metrics.toPrometheus());
      return;
    }
    res.json(deps.metrics.snapshot());
  });

  return router;
}
