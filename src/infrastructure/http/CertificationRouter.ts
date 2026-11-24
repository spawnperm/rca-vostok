import express from 'express';
import type { DomainEventBus } from '../../domain/shared/DomainError.ts';
import type {
  GetInquiryStatsUseCase,
  SubmitInquiryUseCase,
} from '../../application/certification/InquiryUseCases.ts';
import type {
  GetGuideLeaderboardUseCase,
  SyncMyGuideLeaderboardUseCase,
} from '../../application/certification/GetGuideLeaderboardUseCase.ts';
import type {
  GetCenterReviewsStatsUseCase,
  GetFeedbackStatsUseCase,
  ListCenterReviewsUseCase,
  SubmitFeedbackUseCase,
} from '../../application/feedback/FeedbackUseCases.ts';
import type { JsonFileReadinessSurveyRepository } from '../persistence/JsonFileReadinessSurveyRepository.ts';
import type { JsonFileSatisfactionSurveyRepository } from '../persistence/JsonFileSatisfactionSurveyRepository.ts';
import { appLogger } from '../logging/Logger.ts';
import { requireAuth } from './AuthMiddleware.ts';
import { sendDomainError } from './ErrorHandler.ts';

export interface CertificationRouterDeps {
  submitInquiry: SubmitInquiryUseCase;
  getInquiryStats: GetInquiryStatsUseCase;
  submitFeedback: SubmitFeedbackUseCase;
  getFeedbackStats: GetFeedbackStatsUseCase;
  getCenterReviewsStats: GetCenterReviewsStatsUseCase;
  listCenterReviews: ListCenterReviewsUseCase;
  getGuideLeaderboard: GetGuideLeaderboardUseCase;
  syncMyGuideLeaderboard: SyncMyGuideLeaderboardUseCase;
  readinessSurveyRepo: JsonFileReadinessSurveyRepository;
  satisfactionSurveyRepo: JsonFileSatisfactionSurveyRepository;
  eventBus: DomainEventBus;
  inquiryRateLimit: express.RequestHandler;
  feedbackRateLimit: express.RequestHandler;
  surveyRateLimit: express.RequestHandler;
}

const certLog = appLogger.child('certification-router');

export function createCertificationRouter(deps: CertificationRouterDeps): express.Router {
  const router = express.Router();

  router.get('/api/inquiries/stats', async (_req, res) => {
    try {
      res.json(await deps.getInquiryStats.execute());
    } catch (err) {
      sendDomainError(err, res, certLog, 'Failed to read inquiry stats');
    }
  });

  router.get('/api/inquiries/stats/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const pushStats = async () => {
      try {
        const stats = await deps.getInquiryStats.execute();
        res.write(`data: ${JSON.stringify(stats)}\n\n`);
      } catch {
        // Ignore transient write errors on closing stream
      }
    };

    await pushStats();

    const unsubSubmitted = deps.eventBus.subscribe('certification.inquiry_submitted', () => {
      void pushStats();
    });
    const unsubStatus = deps.eventBus.subscribe('certification.inquiry_status_changed', () => {
      void pushStats();
    });

    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        // Closed socket triggers cleanup
      }
    }, 25_000);

    req.on('close', () => {
      clearInterval(keepAlive);
      unsubSubmitted();
      unsubStatus();
      res.end();
    });
  });

  router.post('/api/inquiries', deps.inquiryRateLimit, async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const result = await deps.submitInquiry.execute(
        {
          fullName: body.fullName,
          email: body.email,
          contactChannel: body.contactChannel,
          region: body.region,
          track: body.track,
          experienceNote: body.experienceNote,
          sessionDate: body.sessionDate,
          consentAccepted: body.consentAccepted,
        },
        req.authUser ? { id: req.authUser.id } : null
      );
      res.status(201).json(result);
    } catch (err) {
      sendDomainError(err, res, certLog, 'Failed to submit inquiry');
    }
  });

  router.get('/api/feedback/stats', async (_req, res) => {
    try {
      res.json(await deps.getFeedbackStats.execute());
    } catch (err) {
      sendDomainError(err, res, certLog, 'Failed to get feedback stats');
    }
  });

  router.get('/api/feedback/reviews-summary', async (_req, res) => {
    try {
      res.json(await deps.getCenterReviewsStats.execute());
    } catch (err) {
      sendDomainError(err, res, certLog, 'Failed to get reviews summary');
    }
  });

  router.get('/api/feedback/reviews', async (req, res) => {
    try {
      res.json(
        await deps.listCenterReviews.execute({
          track: req.query.track,
          minRating: req.query.minRating,
          limit: req.query.limit,
        })
      );
    } catch (err) {
      sendDomainError(err, res, certLog, 'Failed to list reviews');
    }
  });

  router.post('/api/feedback', deps.feedbackRateLimit, async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const result = await deps.submitFeedback.execute({
        senderName: body.senderName,
        email: body.email,
        feedbackType: body.feedbackType,
        platformModule: body.platformModule,
        subject: body.subject,
        message: body.message,
      });
      res.status(201).json(result);
    } catch (err) {
      sendDomainError(err, res, certLog, 'Failed to submit feedback');
    }
  });

  router.get('/api/guides/leaderboard', async (req, res) => {
    try {
      const result = await deps.getGuideLeaderboard.execute({
        sortBy: req.query.sortBy,
        region: req.query.region,
        track: req.query.track,
        search: req.query.search,
        limit: req.query.limit,
      });
      res.json(result);
    } catch (err) {
      sendDomainError(err, res, certLog, 'Failed to read guide leaderboard');
    }
  });

  router.post('/api/account/leaderboard-sync', requireAuth(), async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const record = await deps.syncMyGuideLeaderboard.execute({
        userId: req.authUser!.id,
        fullName: req.authUser!.fullName.value,
        region: req.authUser!.region,
        organisation: req.authUser!.organisation,
        certifiedRoutesCount: body.certifiedRoutesCount,
        experienceYears: body.experienceYears,
        track: body.track,
        maxComplexity: body.maxComplexity,
      });
      res.json({ ok: true, record });
      deps.eventBus.publish({
        eventName: 'market.leaderboard_synced',
        occurredAt: new Date().toISOString(),
        boundedContext: 'certification',
        payload: {
          region: record.region,
          track: record.track,
        },
      });
    } catch (err) {
      sendDomainError(err, res, certLog, 'Failed to sync leaderboard record');
    }
  });

  router.get('/api/readiness-survey/stats', (_req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(deps.readinessSurveyRepo.getStats());
    } catch (err) {
      sendDomainError(err, res, certLog, 'Failed to read readiness survey stats');
    }
  });

  router.post('/api/readiness-survey', deps.surveyRateLimit, (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const { record, stats } = deps.readinessSurveyRepo.submit(body);
      deps.eventBus.publish({
        eventName: 'market.readiness_survey_submitted',
        occurredAt: record.createdAt,
        boundedContext: 'research',
        payload: {
          region: record.region,
          readinessPct: record.readinessPct,
        },
      });
      res.status(201).json({
        ok: true,
        id: record.id,
        readinessPct: record.readinessPct,
        stats,
      });
    } catch (err) {
      sendDomainError(err, res, certLog, 'Failed to submit readiness survey');
    }
  });

  router.get('/api/course-satisfaction/stats', (_req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(deps.satisfactionSurveyRepo.getStats());
    } catch (err) {
      sendDomainError(err, res, certLog, 'Failed to read course satisfaction stats');
    }
  });

  router.post('/api/course-satisfaction', deps.surveyRateLimit, (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const { record, stats } = deps.satisfactionSurveyRepo.submit(body);
      res.status(201).json({
        ok: true,
        id: record.id,
        overallScore: record.overallScore,
        stats,
      });
    } catch (err) {
      sendDomainError(err, res, certLog, 'Failed to submit course satisfaction survey');
    }
  });

  return router;
}
