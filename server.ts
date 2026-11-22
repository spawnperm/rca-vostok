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
  ListAllInquiriesUseCase,
  ListMyInquiriesUseCase,
  SubmitInquiryUseCase,
  UpdateInquiryStatusUseCase,
} from './src/application/certification/InquiryUseCases.ts';
import {
  GetCenterReviewsStatsUseCase,
  GetFeedbackStatsUseCase,
  SubmitFeedbackUseCase,
} from './src/application/feedback/FeedbackUseCases.ts';
import { GetSystemHealthUseCase } from './src/application/system/HealthCheckUseCase.ts';
import { HousekeepingJob } from './src/application/system/HousekeepingJob.ts';
import { MetricsCollector } from './src/infrastructure/http/Metrics.ts';
import { DomainError, NotFoundError, ValidationError } from './src/domain/shared/DomainError.ts';
import type { AnalyticsRepository } from './src/domain/analytics/AnalyticsRepository.ts';
import type { FeedbackRepository } from './src/domain/feedback/FeedbackRepository.ts';
import type { InquiryRepository } from './src/domain/certification/InquiryRepository.ts';
import { InMemoryDomainEventBus } from './src/infrastructure/events/InMemoryDomainEventBus.ts';
import { createNatsBusFromEnv } from './src/infrastructure/events/NatsDomainEventBus.ts';
import type { DomainEventBus } from './src/domain/shared/DomainError.ts';
import type { SocialRepository } from './src/domain/social/SocialRepository.ts';
import type { ChatRepository } from './src/domain/chat/ChatRepository.ts';
import type { MediaRepository } from './src/domain/media/MediaRepository.ts';
import { PostgresSocialRepository } from './src/infrastructure/persistence/pg/PostgresSocialRepository.ts';
import { PostgresChatRepository } from './src/infrastructure/persistence/pg/PostgresChatRepository.ts';
import { PostgresMediaRepository } from './src/infrastructure/persistence/pg/PostgresMediaRepository.ts';
import { createObjectStorageFromEnv } from './src/infrastructure/storage/GarageObjectStorage.ts';
import {
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
} from './src/application/social/SocialUseCases.ts';
import {
  CreateChannelUseCase,
  DeleteMessageUseCase,
  EditMessageUseCase,
  JoinChannelUseCase,
  ListChannelsUseCase,
  ListMessagesUseCase,
  SendMessageUseCase,
  ToggleReactionUseCase,
} from './src/application/chat/ChatUseCases.ts';
import {
  CreateAlbumUseCase,
  DeleteAlbumUseCase,
  DeleteAssetUseCase,
  FindAlbumAccessUseCase,
  FindAssetUseCase,
  ListAlbumsUseCase,
  ListAssetsUseCase,
  RegisterAssetUseCase,
} from './src/application/media/MediaUseCases.ts';
import { createSocialRouter } from './src/infrastructure/http/SocialRouter.ts';
import { createChatRouter } from './src/infrastructure/http/ChatRouter.ts';
import { createMediaRouter } from './src/infrastructure/http/MediaRouter.ts';
import { mountApiDocs } from './src/infrastructure/http/OpenApi.ts';
import { JsonFileAnalyticsRepository } from './src/infrastructure/persistence/JsonFileAnalyticsRepository.ts';
import { JsonFileFeedbackRepository } from './src/infrastructure/persistence/JsonFileFeedbackRepository.ts';
import { JsonFileInquiryRepository } from './src/infrastructure/persistence/JsonFileInquiryRepository.ts';
import {
  MIGRATION_STEP_COUNT,
  createPool,
  readAppliedMigrations,
  runMigrations,
} from './src/infrastructure/persistence/pg/PostgresPool.ts';
import { PostgresAnalyticsRepository } from './src/infrastructure/persistence/pg/PostgresAnalyticsRepository.ts';
import { PostgresFeedbackRepository } from './src/infrastructure/persistence/pg/PostgresFeedbackRepository.ts';
import { PostgresInquiryRepository } from './src/infrastructure/persistence/pg/PostgresInquiryRepository.ts';
import { PostgresUserRepository } from './src/infrastructure/persistence/pg/PostgresUserRepository.ts';
import { PostgresSessionRepository } from './src/infrastructure/persistence/pg/PostgresSessionRepository.ts';
import {
  InMemorySessionRepository,
  InMemoryUserRepository,
} from './src/infrastructure/persistence/InMemoryIdentityRepositories.ts';
import type {
  SessionRepository,
  UserRepository,
} from './src/domain/identity/IdentityRepositories.ts';
import {
  ScryptPasswordHasher,
  Sha256SessionTokenService,
} from './src/infrastructure/security/ScryptPasswordHasher.ts';
import {
  AssignRoleUseCase,
  ChangePasswordUseCase,
  GetProfileUseCase,
  ListUsersUseCase,
  LoginUseCase,
  LogoutUseCase,
  RegisterUserUseCase,
  ResolveSessionUseCase,
  SetUserActiveUseCase,
  UpdateProfileUseCase,
} from './src/application/identity/IdentityUseCases.ts';
import { createIdentityRouter } from './src/infrastructure/http/IdentityRouter.ts';
import {
  createAuthMiddleware,
  requireAuth,
  requirePermission,
} from './src/infrastructure/http/AuthMiddleware.ts';
import { PERMISSIONS } from './src/domain/identity/Rbac.ts';
import {
  DEFAULT_LOGIN_RULES,
  RateLimiter,
  createLoginRateLimit,
  createRateLimit,
} from './src/infrastructure/http/RateLimiter.ts';
import {
  ForgotPasswordUseCase,
  ResetPasswordUseCase,
} from './src/application/identity/PasswordResetUseCases.ts';
import { PostgresPasswordResetRepository } from './src/infrastructure/persistence/pg/PostgresPasswordResetRepository.ts';
import { InMemoryPasswordResetRepository } from './src/infrastructure/persistence/pg/PostgresPasswordResetRepository.ts';
import type { PasswordResetRepository } from './src/domain/identity/PasswordReset.ts';
import {
  LoggingMailer,
  createMailerFromEnv,
} from './src/infrastructure/mail/Mailer.ts';
import { appLogger } from './src/infrastructure/logging/Logger.ts';
import { createRequestLoggerMiddleware } from './src/infrastructure/http/RequestLogger.ts';
import { getFarEastHubsWeather } from './src/utils/hubsWeather.ts';
import {
  AssistantServiceError,
  generateRcaAssistantReply,
} from './src/infrastructure/ai/RcaAssistantService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
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

const serverLog = appLogger.child('server');

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
  serverLog.error('Unhandled HTTP adapter error', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(express.json({ limit: '256kb' }));
  app.use(createRequestLoggerMiddleware(appLogger));

  // Security headers.
  //
  // CSP notes: the SPA ships one hashed bundle, so `script-src 'self'` is
  // enough — no inline scripts are used in the built output. `style-src` needs
  // 'unsafe-inline' because React sets inline styles (widths of progress bars,
  // SVG transforms) and the Tailwind runtime injects a style element; tightening
  // this would require nonces for every server-rendered page and is tracked as
  // a follow-up rather than pretended to be solved.
  //
  // The API documentation page (/api/docs) loads Scalar from a CDN, so its CSP
  // is relaxed inline; everything else gets the strict policy.
  const isAiStudioPreview =
    !IS_PROD ||
    process.env.DISABLE_HMR === 'true' ||
    Boolean(process.env.K_SERVICE) ||
    (process.env.APP_URL ?? '').includes('.run.app');

  const scriptSrc = !IS_PROD ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'";
  const frameAncestors = isAiStudioPreview
    ? "frame-ancestors 'self' https://aistudio.google.com https://*.google.com https://*.googleusercontent.com"
    : "frame-ancestors 'none'";

  const API_DOCS_CSP =
    "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: https:; " +
    "connect-src 'self' https:; object-src 'none'; base-uri 'none'; form-action 'self'";

  const APP_CSP =
    `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ` +
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://*.tile.opentopomap.org; media-src 'self' blob:; font-src 'self' data: https://fonts.gstatic.com; " +
    `connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; ${frameAncestors}`;

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (!isAiStudioPreview) {
      res.setHeader('X-Frame-Options', 'DENY');
    }
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader(
      'Content-Security-Policy',
      req.path.startsWith('/api/docs') ? API_DOCS_CSP : APP_CSP
    );

    // HSTS only makes sense over TLS; sending it on plain HTTP would poison
    // the browser for a deployment that cannot serve HTTPS yet.
    const isHttps =
      req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (isHttps) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Request metrics: counts, error rate and latency percentiles, exposed at
  // /api/metrics. Collected in-process — the deployment has no Prometheus.
  const metrics = new MetricsCollector();
  app.use((req, res, next) => {
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      metrics.record(req.method, req.path, res.statusCode, ms);
    });
    next();
  });

  // Composition Root: Infrastructure Adapters + Domain Event Bus + Use Cases
  // NATS is optional: when the broker is configured and reachable, domain
  // events also fan out across processes; otherwise the in-memory bus is used.
  const natsBus = await createNatsBusFromEnv();
  const eventBus: DomainEventBus = natsBus ?? new InMemoryDomainEventBus();

  // Persistence adapter selection: PostgreSQL in production/containers, JSON
  // files for local development when no database is configured.
  const pool = createPool();
  let analyticsRepo: AnalyticsRepository;
  let inquiryRepo: InquiryRepository;
  let feedbackRepo: FeedbackRepository;
  let adapterName: string;

  const persistenceLog = appLogger.child('persistence');
  const eventsLog = appLogger.child('events');

  if (pool) {
    await runMigrations(pool);
    analyticsRepo = new PostgresAnalyticsRepository(pool);
    inquiryRepo = new PostgresInquiryRepository(pool);
    feedbackRepo = new PostgresFeedbackRepository(pool);
    adapterName = 'postgresql';
    persistenceLog.info('Using PostgreSQL persistence adapter');
  } else {
    analyticsRepo = new JsonFileAnalyticsRepository(DATA_DIR);
    inquiryRepo = new JsonFileInquiryRepository(DATA_DIR);
    feedbackRepo = new JsonFileFeedbackRepository(DATA_DIR);
    adapterName = 'json-file';
    persistenceLog.info('No database configured, using JSON file adapter', { dataDir: DATA_DIR });
  }

  // Identity bounded context: PostgreSQL in production, in-memory for local dev.
  const userRepo: UserRepository = pool
    ? new PostgresUserRepository(pool)
    : new InMemoryUserRepository();
  const sessionRepo: SessionRepository = pool
    ? new PostgresSessionRepository(pool)
    : new InMemorySessionRepository();
  const passwordHasher = new ScryptPasswordHasher();
  const sessionTokens = new Sha256SessionTokenService();

  // Contour 7: Observability subscriber (logs structured metadata without PII)
  eventBus.subscribe('certification.inquiry_submitted', (event) => {
    eventsLog.info('Domain event published', {
      event: event.eventName,
      boundedContext: event.boundedContext,
      occurredAt: event.occurredAt,
      payload: event.payload,
    });
  });

  eventBus.subscribe('platform.feedback_submitted', (event) => {
    eventsLog.info('Domain event published', {
      event: event.eventName,
      boundedContext: event.boundedContext,
      occurredAt: event.occurredAt,
      payload: event.payload,
    });
  });

  const collectBehaviorUseCase = new CollectBehaviorUseCase(analyticsRepo, eventBus);
  const getAnalyticsSummaryUseCase = new GetAnalyticsSummaryUseCase(analyticsRepo);
  const getSessionDetailsUseCase = new GetSessionDetailsUseCase(analyticsRepo);
  const resetAnalyticsUseCase = new ResetAnalyticsUseCase(analyticsRepo);
  const submitInquiryUseCase = new SubmitInquiryUseCase(inquiryRepo, eventBus);
  const getInquiryStatsUseCase = new GetInquiryStatsUseCase(inquiryRepo);
  const submitFeedbackUseCase = new SubmitFeedbackUseCase(feedbackRepo, eventBus);
  const getFeedbackStatsUseCase = new GetFeedbackStatsUseCase(feedbackRepo);
  const getCenterReviewsStatsUseCase = new GetCenterReviewsStatsUseCase(feedbackRepo);
  const getSystemHealthUseCase = new GetSystemHealthUseCase(
    inquiryRepo,
    analyticsRepo,
    adapterName,
    {
      // A real round-trip, not just "is the pool object present": SELECT 1
      // fails when the server is down or the connection is broken.
      checkDatabase: pool
        ? async () => {
            const res = await pool.query('SELECT 1 AS ok');
            return res.rows[0]?.ok === 1;
          }
        : undefined,
      checkEventBus: async () => {
        // NATS is optional; when it is not in use this reports true because the
        // in-memory bus is fully functional.
        if (!natsBus) return true;
        return natsBus.isConnected();
      },
      checkMigrations: pool
        ? async () => {
            const applied = await readAppliedMigrations(pool);
            // All known steps must be recorded; a shorter list means the
            // container is running a build whose migrations did not run.
            return applied.length >= MIGRATION_STEP_COUNT;
          }
        : undefined,
    }
  );

  // ── Identity bounded context (personal cabinet + RBAC) ────────────────────
  const resolveSessionUseCase = new ResolveSessionUseCase(userRepo, sessionRepo, sessionTokens);
  app.use(createAuthMiddleware(resolveSessionUseCase));

  // One limiter instance for every protected endpoint. Sharing it is fine:
  // rules are namespaced by name, so counters never collide.
  const rateLimiter = new RateLimiter(DEFAULT_LOGIN_RULES);
  const loginLimiter = rateLimiter;

  // Public write endpoints accept anonymous traffic, so each needs its own
  // ceiling. Without these a single client could fill the database.
  const inquiryRateLimit = createRateLimit(rateLimiter, 'inquiry-ip');
  const feedbackRateLimit = createRateLimit(rateLimiter, 'feedback-ip');
  const analyticsRateLimit = createRateLimit(rateLimiter, 'analytics-ip');
  const assistantRateLimit = createRateLimit(rateLimiter, 'assistant-ip');
  const loginRateLimit = createLoginRateLimit({
    limiter: loginLimiter,
    perIpRule: 'login-ip',
    perAccountRule: 'login-account',
  });

  // Password reset: mailer falls back to a logging transport when SMTP is not
  // configured, so the endpoint still works locally and reports delivery status.
  const mailer = createMailerFromEnv() ?? new LoggingMailer();
  appLogger.child('mail').info('Mail transport configured', {
    transport: mailer.delivers ? 'SMTP' : 'logging',
  });

  const resetTokenRepo: PasswordResetRepository = pool
    ? new PostgresPasswordResetRepository(pool)
    : new InMemoryPasswordResetRepository();

  const forgotPassword = new ForgotPasswordUseCase(
    userRepo,
    resetTokenRepo,
    mailer,
    eventBus,
    process.env.APP_URL ?? 'http://localhost:3000'
  );
  const resetPassword = new ResetPasswordUseCase(
    userRepo,
    resetTokenRepo,
    sessionRepo,
    passwordHasher,
    eventBus
  );

  app.use(
    createIdentityRouter({
      registerUser: new RegisterUserUseCase(userRepo, passwordHasher, eventBus),      login: new LoginUseCase(userRepo, sessionRepo, passwordHasher, sessionTokens, eventBus),
      logout: new LogoutUseCase(sessionRepo, sessionTokens),
      getProfile: new GetProfileUseCase(),
      updateProfile: new UpdateProfileUseCase(userRepo, eventBus),
      changePassword: new ChangePasswordUseCase(userRepo, passwordHasher, sessionRepo),
      listUsers: new ListUsersUseCase(userRepo),
      assignRole: new AssignRoleUseCase(userRepo, eventBus),
      setUserActive: new SetUserActiveUseCase(userRepo),
      loginRateLimit,
      forgotPassword,
      resetPassword,
      // Email flooding guard: five requests per address per hour.
      forgotRateLimit: createLoginRateLimit({
        limiter: loginLimiter,
        perIpRule: 'forgot-ip',
        perAccountRule: 'forgot-account',
      }),
    })
  );

  // ── Social, chat and media bounded contexts ───────────────────────────────
  // These require PostgreSQL (they rely on relational joins and arrays). When
  // no database is configured the routers are not mounted, so local dev of the
  // cabinet still works without them.
  if (pool) {
    const socialRepo: SocialRepository = new PostgresSocialRepository(pool);
    const chatRepo: ChatRepository = new PostgresChatRepository(pool);
    const mediaRepo: MediaRepository = new PostgresMediaRepository(pool);
    const objectStorage = createObjectStorageFromEnv();
    appLogger.child('storage').info('Media object storage configured', {
      provider: objectStorage ? 'S3/Garage' : 'disabled',
    });

    app.use(
      createSocialRouter({
        getProfile: new GetSocialProfileUseCase(socialRepo, userRepo),
        updateProfile: new UpdateSocialProfileUseCase(socialRepo, userRepo, eventBus),
        createPost: new CreatePostUseCase(socialRepo, eventBus),
        updatePost: new UpdatePostUseCase(socialRepo),
        deletePost: new DeletePostUseCase(socialRepo),
        listFeed: new ListFeedUseCase(socialRepo),
        getPost: new GetPostUseCase(socialRepo),
        addComment: new AddCommentUseCase(socialRepo, eventBus),
        toggleLike: new ToggleLikeUseCase(socialRepo, eventBus),
        followUser: new FollowUserUseCase(socialRepo),
        listActivity: new ListActivityUseCase(socialRepo),
        listMyInquiries: new ListMyInquiriesUseCase(inquiryRepo),
        listAllInquiries: new ListAllInquiriesUseCase(inquiryRepo),
        updateInquiryStatus: new UpdateInquiryStatusUseCase(inquiryRepo, eventBus),
      })
    );

    app.use(
      createChatRouter({
        createChannel: new CreateChannelUseCase(chatRepo),
        listChannels: new ListChannelsUseCase(chatRepo),
        joinChannel: new JoinChannelUseCase(chatRepo),
        listMessages: new ListMessagesUseCase(chatRepo),
        sendMessage: new SendMessageUseCase(chatRepo, eventBus),
        editMessage: new EditMessageUseCase(chatRepo),
        deleteMessage: new DeleteMessageUseCase(chatRepo),
        toggleReaction: new ToggleReactionUseCase(chatRepo),
      })
    );

    app.use(
      createMediaRouter({
        createAlbum: new CreateAlbumUseCase(mediaRepo, eventBus),
        listAlbums: new ListAlbumsUseCase(mediaRepo),
        listAssets: new ListAssetsUseCase(mediaRepo),
        registerAsset: new RegisterAssetUseCase(mediaRepo, objectStorage, eventBus),
        deleteAsset: new DeleteAssetUseCase(mediaRepo, objectStorage),
        deleteAlbum: new DeleteAlbumUseCase(mediaRepo),
        findAsset: new FindAssetUseCase(mediaRepo),
        findAlbum: new FindAlbumAccessUseCase(mediaRepo),
        storage: objectStorage,
      })
    );
  } else {
    // Fallback mode without PostgreSQL: inquiry cabinet endpoints remain fully
    // functional via JsonFileInquiryRepository, and public/cabinet social,
    // chat, and media reads return clean empty JSON payloads instead of 404s.
    const listMyInquiries = new ListMyInquiriesUseCase(inquiryRepo);
    const listAllInquiries = new ListAllInquiriesUseCase(inquiryRepo);
    const updateInquiryStatus = new UpdateInquiryStatusUseCase(inquiryRepo, eventBus);

    app.get(
      '/api/account/inquiries',
      requireAuth(),
      requirePermission(PERMISSIONS.VIEW_OWN_INQUIRIES),
      async (req, res) => {
        try {
          res.json({ inquiries: await listMyInquiries.execute(req.authUser!) });
        } catch (err) {
          handleDomainError(err, res);
        }
      }
    );

    app.get(
      '/api/admin/inquiries',
      requireAuth(),
      requirePermission(PERMISSIONS.VIEW_ALL_INQUIRIES),
      async (req, res) => {
        try {
          res.json({ inquiries: await listAllInquiries.execute(req.authUser!) });
        } catch (err) {
          handleDomainError(err, res);
        }
      }
    );

    app.patch(
      '/api/admin/inquiries/:inquiryId',
      requireAuth(),
      requirePermission(PERMISSIONS.VIEW_ALL_INQUIRIES),
      async (req, res) => {
        try {
          const body = (req.body || {}) as Record<string, unknown>;
          res.json(
            await updateInquiryStatus.execute(req.authUser!, {
              inquiryId: req.params.inquiryId,
              status: body.status,
            })
          );
        } catch (err) {
          handleDomainError(err, res);
        }
      }
    );

    app.get('/api/social/feed', (_req, res) => {
      res.json({ posts: [], total: 0 });
    });

    app.get('/api/social/profiles/:userId', async (req, res) => {
      try {
        const target = await userRepo.findById(req.params.userId);
        if (!target) {
          res.status(404).json({ error: 'Профиль пользователя не найден.', code: 'NOT_FOUND' });
          return;
        }
        res.json({
          userId: target.id,
          displayName: target.fullName,
          headline: '',
          bio: '',
          region: target.region,
          organisation: target.organisation,
          role: target.role,
          websiteUrl: '',
          coverAssetId: null,
          avatarAssetId: null,
          skills: [],
          followerCount: 0,
          followingCount: 0,
          postCount: 0,
          albumCount: 0,
          isFollowedByMe: false,
          createdAt: target.createdAt,
          updatedAt: target.createdAt,
        });
      } catch (err) {
        handleDomainError(err, res);
      }
    });

    app.get('/api/social/activity', requireAuth(), (_req, res) => {
      res.json({ activity: [] });
    });

    app.get('/api/chat/channels', (_req, res) => {
      res.json({ channels: [] });
    });

    app.get('/api/chat/reactions', (_req, res) => {
      res.json({ emoji: ['👍', '❤️', '🔥', '👏', '⛰️'] });
    });

    app.get('/api/media/albums', (_req, res) => {
      res.json({ albums: [], total: 0 });
    });

    app.get('/api/media/assets', (_req, res) => {
      res.json({ assets: [], total: 0 });
    });

    app.use(['/api/social', '/api/chat', '/api/media'], (_req, res) => {
      res.status(503).json({
        error: 'Модули публикаций, чата и медиатеки требуют подключения PostgreSQL.',
        code: 'DB_REQUIRED',
      });
    });
  }

  // Far East tourism hubs current weather (Open-Meteo with seasonal fallback)
  app.get('/api/weather/hubs', async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === '1';
      res.json(await getFarEastHubsWeather(forceRefresh));
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  // Personal Cabinet AI Support Assistant (Gemini, server-side API key)
  app.post('/api/assistant/chat', assistantRateLimit, async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const result = await generateRcaAssistantReply({
        messages: body.messages,
        context:
          body.context && typeof body.context === 'object'
            ? body.context
            : req.authUser
              ? { region: req.authUser.region }
              : undefined,
      });
      res.json(result);
    } catch (err) {
      if (err instanceof AssistantServiceError) {
        res.status(err.statusCode).json({ error: err.message, code: err.code });
        return;
      }
      handleDomainError(err, res);
    }
  });

  // Interactive API documentation (Scalar) + raw OpenAPI document.
  mountApiDocs(app);

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
  app.get('/api/health', async (_req, res) => {
    try {
      const health = await getSystemHealthUseCase.execute();
      // 503 when the database is unreachable so load balancers and the compose
      // healthcheck actually notice; degraded dependencies keep 200 because the
      // service still serves traffic.
      res.status(health.status === 'unhealthy' ? 503 : 200).json(health);
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  // In-process request metrics. Deliberately not rate-limited or authenticated
  // beyond the edge: it carries no personal data, only aggregate counts.
  app.get('/api/metrics', (_req, res) => {
    res.json(metrics.snapshot());
  });

  // Bounded Context: Analytics
  app.post('/api/analytics/collect', analyticsRateLimit, async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const result = await collectBehaviorUseCase.execute({
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

  app.get('/api/analytics/summary', async (_req, res) => {
    try {
      res.json(await getAnalyticsSummaryUseCase.execute());
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  app.get('/api/analytics/sessions/:sessionId', async (req, res) => {
    try {
      res.json(await getSessionDetailsUseCase.execute(req.params.sessionId));
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  app.delete('/api/analytics/reset', async (_req, res) => {
    try {
      res.json(await resetAnalyticsUseCase.execute());
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
  app.get('/api/inquiries/stats', async (_req, res) => {
    try {
      res.json(await getInquiryStatsUseCase.execute());
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  app.get('/api/inquiries/stats/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const pushStats = async () => {
      try {
        const stats = await getInquiryStatsUseCase.execute();
        res.write(`data: ${JSON.stringify(stats)}\n\n`);
      } catch {
        // Ignore transient write errors on closing stream
      }
    };

    await pushStats();

    const unsubSubmitted = eventBus.subscribe('certification.inquiry_submitted', () => {
      void pushStats();
    });
    const unsubStatus = eventBus.subscribe('certification.inquiry_status_changed', () => {
      void pushStats();
    });

    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        // Closed socket will trigger cleanup
      }
    }, 25_000);

    req.on('close', () => {
      clearInterval(keepAlive);
      unsubSubmitted();
      unsubStatus();
      res.end();
    });
  });

  app.post('/api/inquiries', inquiryRateLimit, async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const result = await submitInquiryUseCase.execute(
        {
          fullName: body.fullName,
          email: body.email,
          contactChannel: body.contactChannel,
          region: body.region,
          track: body.track,
          experienceNote: body.experienceNote,
          consentAccepted: body.consentAccepted,
        },
        // Ownership comes from the session, never from the request body.
        req.authUser ? { id: req.authUser.id } : null
      );
      res.status(201).json(result);
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  // Bounded Context: Platform Feedback
  app.get('/api/feedback/stats', async (_req, res) => {
    try {
      res.json(await getFeedbackStatsUseCase.execute());
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  app.get('/api/feedback/reviews-summary', async (_req, res) => {
    try {
      res.json(await getCenterReviewsStatsUseCase.execute());
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  app.post('/api/feedback', feedbackRateLimit, async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const result = await submitFeedbackUseCase.execute({
        senderName: body.senderName,
        email: body.email,
        feedbackType: body.feedbackType,
        platformModule: body.platformModule,
        subject: body.subject,
        message: body.message,
      });
      res.status(201).json(result);
    } catch (err) {
      handleDomainError(err, res);
    }
  });

  if (!IS_PROD) {
    app.use('/api', (_req, res) => {
      res.status(404).json({
        error: 'Запрошенный метод API не найден.',
        code: 'NOT_FOUND',
      });
    });
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');

    // Unknown API routes must answer as JSON 404, not fall through to the SPA
    // shell. Without this the catch-all below returned index.html with status
    // 200 for any typo like /api/metrics, so clients silently received HTML
    // where they expected JSON and error handling never triggered.
    app.use('/api', (_req, res) => {
      res.status(404).json({
        error: 'Запрошенный метод API не найден.',
        code: 'NOT_FOUND',
      });
    });

    // Missing build assets must 404, never fall through to the SPA shell.
    //
    // Vite emits content-hashed filenames, so after every deploy the old
    // /assets/index-<hash>.js no longer exists. A browser that still has the
    // previous index.html (a tab left open across a release) requests the old
    // chunk; the catch-all below used to answer 200 with index.html, and the
    // browser then tried to execute HTML as JavaScript. The module failed to
    // load and ErrorBoundary rendered "Не удалось отобразить текущий блок" —
    // a crash that looks like a broken feature but is a stale-tab problem.
    //
    // Answering 404 lets the client detect the miss and reload into the new
    // build instead of showing an error.
    app.use(
      '/assets',
      express.static(path.resolve(distDir, 'assets'), {
        // Hashed names never change content, so they can be cached forever.
        immutable: true,
        maxAge: '1y',
        fallthrough: false,
      })
    );

    // `fallthrough: false` raises an error for a missing file, which Express
    // would render as its default HTML page. Answer plainly instead: the
    // response is consumed by a script loader, not a reader.
    app.use(
      '/assets',
      (
        err: { status?: number; statusCode?: number },
        _req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => {
        const status = err?.status ?? err?.statusCode ?? 404;
        if (status === 404) {
          res.status(404).type('text/plain').send('Asset not found');
          return;
        }
        next(err);
      }
    );

    // Any other hashed asset request that reached this point is missing too.
    app.use(/^\/(assets|src)\//, (_req, res) => {
      res.status(404).type('text/plain').send('Asset not found');
    });

    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    serverLog.info('Server listening', {
      url: `http://0.0.0.0:${PORT}`,
      env: IS_PROD ? 'production' : 'development',
      logLevel: appLogger.level,
      logFile: appLogger.getLogFilePath(),
    });
    serverLog.debug('Runtime configuration snapshot', {
      adapter: adapterName,
      natsConnected: Boolean(natsBus),
      aiStudioPreview: isAiStudioPreview,
    });
  });

  // Periodic cleanup of expired sessions and stale reset tokens. These tables
  // grow forever without it — `purgeExpired` existed on the repository but was
  // never called until now.
  const housekeeping = new HousekeepingJob({
    sessions: sessionRepo,
    resetTokens: resetTokenRepo,
    logger: appLogger.child('housekeeping'),
  });

  // Graceful shutdown so container restarts drain cleanly and the pool closes.
  const shutdown = (signal: string) => {
    serverLog.info('Shutdown signal received', { signal });
    housekeeping.stop();
    server.close(() => {
      void (async () => {
        try {
          if (pool) {
            await pool.end();
          }
        } catch (err) {
          serverLog.error('PostgreSQL pool close failed during shutdown', err);
        }
        await appLogger.flush();
        process.exit(0);
      })();
    });
    // Do not hang forever on stuck connections.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch(async (err) => {
  serverLog.error('Failed to start server', err);
  await appLogger.flush();
  process.exit(1);
});
