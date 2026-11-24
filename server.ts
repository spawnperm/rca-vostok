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
  GetGuideLeaderboardUseCase,
  SyncMyGuideLeaderboardUseCase,
} from './src/application/certification/GetGuideLeaderboardUseCase.ts';
import type { GuideLeaderboardRepository } from './src/domain/certification/GuideLeaderboard.ts';
import {
  GetCenterReviewsStatsUseCase,
  GetFeedbackStatsUseCase,
  ListCenterReviewsUseCase,
  SubmitFeedbackUseCase,
} from './src/application/feedback/FeedbackUseCases.ts';
import { GetSystemHealthUseCase } from './src/application/system/HealthCheckUseCase.ts';
import { HousekeepingJob } from './src/application/system/HousekeepingJob.ts';
import { MetricsCollector } from './src/infrastructure/http/Metrics.ts';
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
import {
  LocalObjectStorage,
  createObjectStorageFromEnv,
} from './src/infrastructure/storage/GarageObjectStorage.ts';
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
import { createSystemRouter } from './src/infrastructure/http/SystemRouter.ts';
import { createAnalyticsRouter } from './src/infrastructure/http/AnalyticsRouter.ts';
import { createCertificationRouter } from './src/infrastructure/http/CertificationRouter.ts';
import { createPlatformUtilityRouter } from './src/infrastructure/http/PlatformUtilityRouter.ts';
import {
  createCookieCsrfMiddleware,
  createSecurityHeadersMiddleware,
} from './src/infrastructure/http/SecurityMiddleware.ts';
import { mountApiDocs } from './src/infrastructure/http/OpenApi.ts';
import { JsonFileAnalyticsRepository } from './src/infrastructure/persistence/JsonFileAnalyticsRepository.ts';
import { JsonFileFeedbackRepository } from './src/infrastructure/persistence/JsonFileFeedbackRepository.ts';
import { JsonFileInquiryRepository } from './src/infrastructure/persistence/JsonFileInquiryRepository.ts';
import { JsonFileGuideLeaderboardRepository } from './src/infrastructure/persistence/JsonFileGuideLeaderboardRepository.ts';
import { JsonFileReadinessSurveyRepository } from './src/infrastructure/persistence/JsonFileReadinessSurveyRepository.ts';
import { JsonFileSatisfactionSurveyRepository } from './src/infrastructure/persistence/JsonFileSatisfactionSurveyRepository.ts';
import { JsonFileSocialRepository } from './src/infrastructure/persistence/JsonFileSocialRepository.ts';
import { JsonFileChatRepository } from './src/infrastructure/persistence/JsonFileChatRepository.ts';
import { JsonFileMediaRepository } from './src/infrastructure/persistence/JsonFileMediaRepository.ts';
import { JsonFileEmploymentSurveyRepository } from './src/infrastructure/persistence/JsonFileEmploymentSurveyRepository.ts';
import type { EmploymentSurveyRepository } from './src/infrastructure/persistence/JsonFileEmploymentSurveyRepository.ts';
import {
  MIGRATION_STEP_COUNT,
  createPool,
  readAppliedMigrations,
  runMigrations,
} from './src/infrastructure/persistence/pg/PostgresPool.ts';
import { PostgresAnalyticsRepository } from './src/infrastructure/persistence/pg/PostgresAnalyticsRepository.ts';
import { PostgresFeedbackRepository } from './src/infrastructure/persistence/pg/PostgresFeedbackRepository.ts';
import { PostgresInquiryRepository } from './src/infrastructure/persistence/pg/PostgresInquiryRepository.ts';
import { PostgresGuideLeaderboardRepository } from './src/infrastructure/persistence/pg/PostgresGuideLeaderboardRepository.ts';
import { PostgresReadinessSurveyRepository } from './src/infrastructure/persistence/pg/PostgresReadinessSurveyRepository.ts';
import { PostgresSatisfactionSurveyRepository } from './src/infrastructure/persistence/pg/PostgresSatisfactionSurveyRepository.ts';
import { PostgresEmploymentSurveyRepository } from './src/infrastructure/persistence/pg/PostgresEmploymentSurveyRepository.ts';
import { PostgresExperienceJournalRepository } from './src/infrastructure/persistence/pg/PostgresExperienceJournalRepository.ts';
import { PostgresUserRepository } from './src/infrastructure/persistence/pg/PostgresUserRepository.ts';
import { PostgresSessionRepository } from './src/infrastructure/persistence/pg/PostgresSessionRepository.ts';
import {
  JsonFilePasswordResetRepository,
  JsonFileSessionRepository,
  JsonFileUserRepository,
} from './src/infrastructure/persistence/JsonFileIdentityRepositories.ts';
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
  ClaimAdminAccessUseCase,
  GetAdminBootstrapStatusUseCase,
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
import { createLinkedAccountsRouter } from './src/infrastructure/http/LinkedAccountsRouter.ts';
import { SocialOAuthService } from './src/infrastructure/oauth/SocialOAuthProviders.ts';
import { JsonFileLinkedAccountsRepository } from './src/infrastructure/persistence/JsonFileLinkedAccountsRepository.ts';
import { PostgresLinkedAccountsRepository } from './src/infrastructure/persistence/pg/PostgresLinkedAccountsRepository.ts';
import type { LinkedAccountsRepository } from './src/domain/identity/LinkedAccounts.ts';
import { createAuthMiddleware } from './src/infrastructure/http/AuthMiddleware.ts';
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
import type { PasswordResetRepository } from './src/domain/identity/PasswordReset.ts';
import {
  LoggingMailer,
  createMailerFromEnv,
} from './src/infrastructure/mail/Mailer.ts';
import { appLogger } from './src/infrastructure/logging/Logger.ts';
import { createRequestLoggerMiddleware } from './src/infrastructure/http/RequestLogger.ts';
import { GitSyncAuthService } from './src/infrastructure/git/GitSyncAuth.ts';
import { GitSyncService } from './src/infrastructure/git/GitSyncService.ts';
import { createGitRouter } from './src/infrastructure/http/GitRouter.ts';
import {
  GetExperienceJournalUseCase,
  LogExpeditionUseCase,
  RemoveExpeditionUseCase,
  ResetExperienceJournalUseCase,
} from './src/application/experience/ExperienceJournalUseCases.ts';
import { JsonFileExperienceJournalRepository } from './src/infrastructure/persistence/JsonFileExperienceJournalRepository.ts';
import { createExperienceJournalRouter } from './src/infrastructure/http/ExperienceJournalRouter.ts';
import type { LmsProgressRepository } from './src/domain/lms/LmsProgress.ts';
import { JsonFileLmsProgressRepository } from './src/infrastructure/persistence/JsonFileLmsProgressRepository.ts';
import { PostgresLmsProgressRepository } from './src/infrastructure/persistence/pg/PostgresLmsProgressRepository.ts';
import {
  GetLmsProgressUseCase,
  UpdateLmsProgressUseCase,
} from './src/application/lms/LmsProgressUseCases.ts';
import { createLmsProgressRouter } from './src/infrastructure/http/LmsProgressRouter.ts';
import {
  GetLiveInstructorMarketStatsUseCase,
  LiveMarketEventBuffer,
} from './src/application/market/LiveInstructorMarketStats.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const serverLog = appLogger.child('server');

export interface CreateAppOptions {
  dataDir?: string;
  isProd?: boolean;
  registerVite?: boolean;
  startHousekeeping?: boolean;
  port?: number;
}

export interface AppRuntime {
  app: express.Express;
  metrics: MetricsCollector;
  adapterName: string;
  isAiStudioPreview: boolean;
  natsConnected: boolean;
  close: () => Promise<void>;
}

function resolveTrustProxySetting(): boolean | number | string {
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined || raw.trim() === '') return true;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : raw.trim();
}

function makeBaseUrlResolver(port: number): (req: express.Request) => string {
  return (req: express.Request): string => {
    const envUrl = process.env.APP_URL;
    if (envUrl && envUrl !== 'MY_APP_URL' && /^https?:\/\//.test(envUrl)) {
      return envUrl.replace(/\/+$/, '');
    }
    const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : req.protocol;
    const host = req.get('host') || `localhost:${port}`;
    return `${proto}://${host}`;
  };
}

/**
 * Composition Root for the Express + DDD backend.
 * Can be mounted directly on a port via `startServer()` or imported in HTTP tests
 * with `registerVite: false` and an isolated temporary `dataDir`.
 */
export async function createApp(options: CreateAppOptions = {}): Promise<AppRuntime> {
  const isProd = options.isProd ?? process.env.NODE_ENV === 'production';
  const dataDir = options.dataDir ?? path.resolve(__dirname, 'data');
  const port = options.port ?? DEFAULT_PORT;
  const registerVite = options.registerVite ?? !isProd;
  const startHousekeeping = options.startHousekeeping ?? true;
  const getBaseUrl = makeBaseUrlResolver(port);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', resolveTrustProxySetting());
  app.use(express.json({ limit: '256kb' }));
  app.use(
    (
      err: { status?: number; type?: string },
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
        res.status(400).json({ error: 'Некорректный JSON в теле запроса.', code: 'INVALID_JSON' });
        return;
      }
      next(err);
    }
  );
  app.use(createRequestLoggerMiddleware(appLogger));

  const isAiStudioPreview =
    !isProd ||
    process.env.DISABLE_HMR === 'true' ||
    Boolean(process.env.K_SERVICE) ||
    (process.env.APP_URL ?? '').includes('.run.app');

  app.use(createSecurityHeadersMiddleware({ isProd, isAiStudioPreview }));
  app.use(createCookieCsrfMiddleware());

  // Request metrics: counts, error rate and rolling latency percentiles, exposed at /api/metrics.
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
  const natsBus = await createNatsBusFromEnv();
  const eventBus: DomainEventBus = natsBus ?? new InMemoryDomainEventBus();

  const pool = createPool();
  let analyticsRepo: AnalyticsRepository;
  let inquiryRepo: InquiryRepository;
  let feedbackRepo: FeedbackRepository;
  let guideLeaderboardRepo: GuideLeaderboardRepository;
  let adapterName: string;

  const persistenceLog = appLogger.child('persistence');
  const eventsLog = appLogger.child('events');

  if (pool) {
    await runMigrations(pool);
    analyticsRepo = new PostgresAnalyticsRepository(pool);
    inquiryRepo = new PostgresInquiryRepository(pool);
    feedbackRepo = new PostgresFeedbackRepository(pool);
    guideLeaderboardRepo = new PostgresGuideLeaderboardRepository(pool);
    adapterName = 'postgresql';
    persistenceLog.info('Using PostgreSQL persistence adapter');
  } else {
    analyticsRepo = new JsonFileAnalyticsRepository(dataDir);
    inquiryRepo = new JsonFileInquiryRepository(dataDir);
    feedbackRepo = new JsonFileFeedbackRepository(dataDir);
    guideLeaderboardRepo = new JsonFileGuideLeaderboardRepository(dataDir);
    adapterName = 'json-file';
    persistenceLog.info('No database configured, using JSON file adapter', { dataDir });
  }

  const readinessSurveyRepo = pool
    ? new PostgresReadinessSurveyRepository(pool)
    : new JsonFileReadinessSurveyRepository(dataDir);
  const satisfactionSurveyRepo = pool
    ? new PostgresSatisfactionSurveyRepository(pool)
    : new JsonFileSatisfactionSurveyRepository(dataDir);
  const employmentSurveyRepo: EmploymentSurveyRepository = pool
    ? new PostgresEmploymentSurveyRepository(pool)
    : new JsonFileEmploymentSurveyRepository(dataDir);
  const experienceJournalRepo = pool
    ? new PostgresExperienceJournalRepository(pool)
    : new JsonFileExperienceJournalRepository(dataDir);

  const userRepo: UserRepository = pool
    ? new PostgresUserRepository(pool)
    : new JsonFileUserRepository(dataDir);
  const sessionRepo: SessionRepository = pool
    ? new PostgresSessionRepository(pool)
    : new JsonFileSessionRepository(dataDir);
  const linkedAccountsRepo: LinkedAccountsRepository = pool
    ? new PostgresLinkedAccountsRepository(pool)
    : new JsonFileLinkedAccountsRepository(dataDir);
  const socialOAuthService = new SocialOAuthService();
  const passwordHasher = new ScryptPasswordHasher();
  const sessionTokens = new Sha256SessionTokenService();

  // Observability domain event subscribers (logs structured metadata without PII)
  for (const eventName of [
    'certification.inquiry_submitted',
    'platform.feedback_submitted',
    'experience.expedition_logged',
    'experience.expedition_removed',
  ]) {
    eventBus.subscribe(eventName, (event) => {
      eventsLog.info('Domain event published', {
        event: event.eventName,
        boundedContext: event.boundedContext,
        occurredAt: event.occurredAt,
        payload: event.payload,
      });
    });
  }

  const collectBehaviorUseCase = new CollectBehaviorUseCase(analyticsRepo, eventBus);
  const getAnalyticsSummaryUseCase = new GetAnalyticsSummaryUseCase(analyticsRepo);
  const getSessionDetailsUseCase = new GetSessionDetailsUseCase(analyticsRepo);
  const resetAnalyticsUseCase = new ResetAnalyticsUseCase(analyticsRepo);
  const submitInquiryUseCase = new SubmitInquiryUseCase(inquiryRepo, eventBus);
  const getInquiryStatsUseCase = new GetInquiryStatsUseCase(inquiryRepo);
  const submitFeedbackUseCase = new SubmitFeedbackUseCase(feedbackRepo, eventBus);
  const getFeedbackStatsUseCase = new GetFeedbackStatsUseCase(feedbackRepo);
  const getCenterReviewsStatsUseCase = new GetCenterReviewsStatsUseCase(feedbackRepo);
  const listCenterReviewsUseCase = new ListCenterReviewsUseCase(feedbackRepo);
  const getGuideLeaderboardUseCase = new GetGuideLeaderboardUseCase(
    guideLeaderboardRepo,
    adapterName
  );
  const syncMyGuideLeaderboardUseCase = new SyncMyGuideLeaderboardUseCase(guideLeaderboardRepo);
  const getExperienceJournalUseCase = new GetExperienceJournalUseCase(experienceJournalRepo);
  const logExpeditionUseCase = new LogExpeditionUseCase(experienceJournalRepo, eventBus);
  const removeExpeditionUseCase = new RemoveExpeditionUseCase(experienceJournalRepo, eventBus);
  const resetExperienceJournalUseCase = new ResetExperienceJournalUseCase(
    experienceJournalRepo,
    eventBus
  );

  const liveMarketEventBuffer = new LiveMarketEventBuffer(8);
  const getLiveMarketStatsUseCase = new GetLiveInstructorMarketStatsUseCase(
    inquiryRepo,
    guideLeaderboardRepo,
    readinessSurveyRepo,
    liveMarketEventBuffer,
    adapterName
  );
  const marketStreamListeners = new Set<() => void>();
  liveMarketEventBuffer.attach(eventBus, () => {
    for (const listener of marketStreamListeners) {
      listener();
    }
  });

  const s3Storage = createObjectStorageFromEnv();
  const objectStorage = s3Storage ?? new LocalObjectStorage(path.join(dataDir, 'media-objects'));
  const storageProvider = s3Storage ? 'garage-s3' : 'local-disk';
  appLogger.child('storage').info('Object storage configured', {
    provider: storageProvider,
  });

  const getSystemHealthUseCase = new GetSystemHealthUseCase(
    inquiryRepo,
    analyticsRepo,
    adapterName,
    {
      checkDatabase: pool
        ? async () => {
            const res = await pool.query('SELECT 1 AS ok');
            return res.rows[0]?.ok === 1;
          }
        : undefined,
      checkEventBus: async () => {
        if (!natsBus) return true;
        return natsBus.isConnected();
      },
      checkMigrations: pool
        ? async () => {
            const applied = await readAppliedMigrations(pool);
            return applied.length >= MIGRATION_STEP_COUNT;
          }
        : undefined,
      checkStorage: async () =>
        objectStorage.checkHealth ? objectStorage.checkHealth() : true,
    },
    storageProvider
  );

  // Identity bounded context (personal cabinet + RBAC)
  const resolveSessionUseCase = new ResolveSessionUseCase(userRepo, sessionRepo, sessionTokens);
  app.use(createAuthMiddleware(resolveSessionUseCase));

  const rateLimiter = new RateLimiter(DEFAULT_LOGIN_RULES);
  const registerRateLimit = createRateLimit(rateLimiter, 'register-ip');
  const inquiryRateLimit = createRateLimit(rateLimiter, 'inquiry-ip');
  const feedbackRateLimit = createRateLimit(rateLimiter, 'feedback-ip');
  const analyticsRateLimit = createRateLimit(rateLimiter, 'analytics-ip');
  const assistantRateLimit = createRateLimit(rateLimiter, 'assistant-ip');
  const surveyRateLimit = createRateLimit(rateLimiter, 'survey-ip');
  const loginRateLimit = createLoginRateLimit({
    limiter: rateLimiter,
    perIpRule: 'login-ip',
    perAccountRule: 'login-account',
  });

  const mailer = createMailerFromEnv() ?? new LoggingMailer();
  appLogger.child('mail').info('Mail transport configured', {
    transport: mailer.delivers ? 'SMTP' : 'logging',
  });

  const resetTokenRepo: PasswordResetRepository = pool
    ? new PostgresPasswordResetRepository(pool)
    : new JsonFilePasswordResetRepository(dataDir);

  const forgotPassword = new ForgotPasswordUseCase(
    userRepo,
    resetTokenRepo,
    mailer,
    eventBus,
    process.env.APP_URL ?? `http://localhost:${port}`
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
      registerUser: new RegisterUserUseCase(userRepo, passwordHasher, eventBus),
      login: new LoginUseCase(userRepo, sessionRepo, passwordHasher, sessionTokens, eventBus),
      logout: new LogoutUseCase(sessionRepo, sessionTokens),
      getProfile: new GetProfileUseCase(),
      updateProfile: new UpdateProfileUseCase(userRepo, eventBus),
      changePassword: new ChangePasswordUseCase(userRepo, passwordHasher, sessionRepo),
      listUsers: new ListUsersUseCase(userRepo),
      assignRole: new AssignRoleUseCase(userRepo, eventBus),
      setUserActive: new SetUserActiveUseCase(userRepo),
      getAdminBootstrap: new GetAdminBootstrapStatusUseCase(userRepo),
      claimAdmin: new ClaimAdminAccessUseCase(userRepo, eventBus),
      registerRateLimit,
      loginRateLimit,
      forgotPassword,
      resetPassword,
      forgotRateLimit: createLoginRateLimit({
        limiter: rateLimiter,
        perIpRule: 'forgot-ip',
        perAccountRule: 'forgot-account',
      }),
    })
  );

  // Social, chat and media bounded contexts
  const socialRepo: SocialRepository = pool
    ? new PostgresSocialRepository(pool)
    : new JsonFileSocialRepository(dataDir);
  const chatRepo: ChatRepository = pool
    ? new PostgresChatRepository(pool)
    : new JsonFileChatRepository(dataDir);
  const mediaRepo: MediaRepository = pool
    ? new PostgresMediaRepository(pool)
    : new JsonFileMediaRepository(dataDir);
  // objectStorage initialized earlier for both media and survey archiving

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

  app.use(
    createLinkedAccountsRouter({
      linkedAccountsRepo,
      userRepo,
      oauthService: socialOAuthService,
      getBaseUrl,
      socialRepo,
    })
  );

  app.use(
    createExperienceJournalRouter({
      getJournalUseCase: getExperienceJournalUseCase,
      logExpeditionUseCase,
      removeExpeditionUseCase,
      resetJournalUseCase: resetExperienceJournalUseCase,
    })
  );

  const lmsProgressRepo: LmsProgressRepository = pool
    ? new PostgresLmsProgressRepository(pool)
    : new JsonFileLmsProgressRepository(dataDir);
  app.use(
    createLmsProgressRouter({
      getLmsProgress: new GetLmsProgressUseCase(lmsProgressRepo),
      updateLmsProgress: new UpdateLmsProgressUseCase(lmsProgressRepo, eventBus),
    })
  );

  const gitAuth = new GitSyncAuthService();
  const gitSync = new GitSyncService(__dirname);
  app.use(
    createGitRouter({
      gitAuth,
      gitSync,
      unlockRateLimit: createRateLimit(rateLimiter, 'git-unlock-ip'),
      pushRateLimit: createRateLimit(rateLimiter, 'git-push-ip'),
    })
  );

  mountApiDocs(app);

  app.use(
    createSystemRouter({
      getSystemHealth: getSystemHealthUseCase,
      metrics,
      getBaseUrl,
    })
  );

  app.use(
    createAnalyticsRouter({
      collectBehavior: collectBehaviorUseCase,
      getSummary: getAnalyticsSummaryUseCase,
      getSessionDetails: getSessionDetailsUseCase,
      resetAnalytics: resetAnalyticsUseCase,
      analyticsRateLimit,
    })
  );

  app.use(
    createCertificationRouter({
      submitInquiry: submitInquiryUseCase,
      getInquiryStats: getInquiryStatsUseCase,
      submitFeedback: submitFeedbackUseCase,
      getFeedbackStats: getFeedbackStatsUseCase,
      getCenterReviewsStats: getCenterReviewsStatsUseCase,
      listCenterReviews: listCenterReviewsUseCase,
      getGuideLeaderboard: getGuideLeaderboardUseCase,
      syncMyGuideLeaderboard: syncMyGuideLeaderboardUseCase,
      readinessSurveyRepo,
      satisfactionSurveyRepo,
      employmentSurveyRepo,
      objectStorage,
      persistenceAdapter: adapterName,
      storageProvider,
      eventBus,
      inquiryRateLimit,
      feedbackRateLimit,
      surveyRateLimit,
    })
  );

  app.use(
    createPlatformUtilityRouter({
      getLiveMarketStats: getLiveMarketStatsUseCase,
      marketStreamListeners,
      assistantRateLimit,
    })
  );

  // Unknown API endpoints always return JSON 404 rather than HTML SPA fallback.
  app.use('/api', (_req, res) => {
    res.status(404).json({
      error: 'Запрошенный метод API не найден.',
      code: 'NOT_FOUND',
    });
  });

  if (registerVite) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (isProd) {
    const distDir = path.resolve(__dirname, 'dist');

    app.use(
      '/assets',
      express.static(path.resolve(distDir, 'assets'), {
        immutable: true,
        maxAge: '1y',
        fallthrough: false,
      })
    );

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

    app.use(/^\/(assets|src)\//, (_req, res) => {
      res.status(404).type('text/plain').send('Asset not found');
    });

    app.use(
      express.static(distDir, {
        maxAge: '1h',
        setHeaders(res, filePath) {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  const housekeeping = startHousekeeping
    ? new HousekeepingJob({
        sessions: sessionRepo,
        resetTokens: resetTokenRepo,
        logger: appLogger.child('housekeeping'),
      })
    : null;

  const close = async (): Promise<void> => {
    housekeeping?.stop();
    if (pool) {
      await pool.end();
    }
    await appLogger.flush();
  };

  return {
    app,
    metrics,
    adapterName,
    isAiStudioPreview,
    natsConnected: Boolean(natsBus),
    close,
  };
}

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const runtime = await createApp({ isProd });

  const server = runtime.app.listen(DEFAULT_PORT, '0.0.0.0', () => {
    serverLog.info('Server listening', {
      url: `http://0.0.0.0:${DEFAULT_PORT}`,
      env: isProd ? 'production' : 'development',
      logLevel: appLogger.level,
      logFile: appLogger.getLogFilePath(),
    });
    serverLog.debug('Runtime configuration snapshot', {
      adapter: runtime.adapterName,
      natsConnected: runtime.natsConnected,
      aiStudioPreview: runtime.isAiStudioPreview,
    });
  });

  const shutdown = (signal: string) => {
    serverLog.info('Shutdown signal received', { signal });
    server.close(() => {
      void (async () => {
        try {
          await runtime.close();
        } catch (err) {
          serverLog.error('Cleanup failed during shutdown', err);
        }
        process.exit(0);
      })();
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

const isEntrypoint =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === __filename;

if (isEntrypoint) {
  startServer().catch(async (err) => {
    serverLog.error('Failed to start server', err);
    await appLogger.flush();
    process.exit(1);
  });
}
