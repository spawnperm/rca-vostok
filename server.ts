import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CollectBehaviorUseCase,
  GetAnalyticsSummaryUseCase,
  GetSessionDetailsUseCase,
  ResetAnalyticsUseCase,
} from './src/application/analytics/AnalyticsUseCases.ts';
import {
  GetInquiryStatsUseCase,
  SubmitInquiryUseCase,
} from './src/application/certification/InquiryUseCases.ts';
import { GetSystemHealthUseCase } from './src/application/system/HealthCheckUseCase.ts';
import { DomainError, NotFoundError, ValidationError } from './src/domain/shared/DomainError.ts';
import { InMemoryDomainEventBus } from './src/infrastructure/events/InMemoryDomainEventBus.ts';
import { JsonFileAnalyticsRepository } from './src/infrastructure/persistence/JsonFileAnalyticsRepository.ts';
import { JsonFileInquiryRepository } from './src/infrastructure/persistence/JsonFileInquiryRepository.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const DATA_DIR = path.resolve(__dirname, 'data');

function getBaseUrl(req: express.Request): string {
  const envUrl = process.env.APP_URL;
  if (envUrl && envUrl !== 'MY_APP_URL' && /^https?:\/\//.test(envUrl)) {
    return envUrl.replace(/\/+$/, '');
  }
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : req.protocol;
  const host = req.get('host') || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function handleDomainError(err: unknown, res: express.Response): void {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof DomainError) {
    res.status(422).json({ error: err.message, code: err.code });
    return;
  }
  console.error('[HTTP Adapter Error]', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(express.json({ limit: '256kb' }));

  // Contour 3: Security headers middleware
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Composition Root: Infrastructure Adapters + Domain Event Bus + Use Cases
  const eventBus = new InMemoryDomainEventBus();
  const analyticsRepo = new JsonFileAnalyticsRepository(DATA_DIR);
  const inquiryRepo = new JsonFileInquiryRepository(DATA_DIR);

  // Contour 7: Observability subscriber (logs structured metadata without PII)
  eventBus.subscribe('certification.inquiry_submitted', (event) => {
    console.info(
      JSON.stringify({
        level: 'info',
        event: event.eventName,
        boundedContext: event.boundedContext,
        occurredAt: event.occurredAt,
        payload: event.payload,
      })
    );
  });

  const collectBehaviorUseCase = new CollectBehaviorUseCase(analyticsRepo, eventBus);
  const getAnalyticsSummaryUseCase = new GetAnalyticsSummaryUseCase(analyticsRepo);
  const getSessionDetailsUseCase = new GetSessionDetailsUseCase(analyticsRepo);
  const resetAnalyticsUseCase = new ResetAnalyticsUseCase(analyticsRepo);
  const submitInquiryUseCase = new SubmitInquiryUseCase(inquiryRepo, eventBus);
  const getInquiryStatsUseCase = new GetInquiryStatsUseCase(inquiryRepo);
  const getSystemHealthUseCase = new GetSystemHealthUseCase(inquiryRepo, analyticsRepo);

  // Dynamic robots.txt
  app.get('/robots.txt', (req, res) => {
    const baseUrl = getBaseUrl(req);
    res.type('text/plain; charset=utf-8');
    res.send(
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        `Sitemap: ${baseUrl}/sitemap.xml`,
      ].join('\n')
    );
  });

  // Dynamic sitemap.xml
  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = getBaseUrl(req);
    const today = new Date().toISOString().split('T')[0];
    const sections = [
      { slug: '', priority: '1.0', changefreq: 'weekly' },
      { slug: '?tab=calculator', priority: '0.9', changefreq: 'monthly' },
      { slug: '?tab=market', priority: '0.9', changefreq: 'monthly' },
      { slug: '?tab=dissertation', priority: '0.8', changefreq: 'monthly' },
      { slug: '?tab=presentations', priority: '0.8', changefreq: 'monthly' },
      { slug: '?tab=analytics', priority: '0.6', changefreq: 'daily' },
    ];
    const urlsXml = sections
      .map(
        (s) => `  <url>
    <loc>${baseUrl}/${s.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${s.changefreq}</changefreq>
    <priority>${s.priority}</priority>
  </url>`
      )
      .join('\n');

    res.type('application/xml; charset=utf-8');
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>`
    );
  });

  // Contour 7: System Health & DDD Bounded Context status
  app.get('/api/health', (_req, res) => {
    try {
      res.json(getSystemHealthUseCase.execute());
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  // Bounded Context: Analytics
  app.post('/api/analytics/collect', (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const result = collectBehaviorUseCase.execute({
        sessionId: body?.sessionId,
        visitorId: body?.visitorId,
        viewport: body?.viewport,
        referrer: body?.referrer,
        utmSource: body?.utmSource,
        events: body?.events,
        userAgent: req.get('user-agent') || '',
      });
      res.json(result);
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  app.get('/api/analytics/summary', (_req, res) => {
    try {
      res.json(getAnalyticsSummaryUseCase.execute());
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  app.get('/api/analytics/sessions/:sessionId', (req, res) => {
    try {
      res.json(getSessionDetailsUseCase.execute(req.params.sessionId));
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  app.delete('/api/analytics/reset', (_req, res) => {
    try {
      res.json(resetAnalyticsUseCase.execute());
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  // Server-side SEO endpoints check
  app.get('/api/seo/server-status', (req, res) => {
    const baseUrl = getBaseUrl(req);
    res.json({
      baseUrl,
      robotsUrl: `${baseUrl}/robots.txt`,
      sitemapUrl: `${baseUrl}/sitemap.xml`,
      robotsConfigured: true,
      sitemapConfigured: true,
      indexedRoutes: 6,
    });
  });

  // Bounded Context: Certification Inquiries
  app.get('/api/inquiries/stats', (_req, res) => {
    try {
      res.json(getInquiryStatsUseCase.execute());
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  app.post('/api/inquiries', (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const result = submitInquiryUseCase.execute({
        fullName: body.fullName,
        email: body.email,
        contactChannel: body.contactChannel,
        region: body.region,
        track: body.track,
        experienceNote: body.experienceNote,
        consentAccepted: body.consentAccepted,
      });
      res.status(201).json(result);
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
