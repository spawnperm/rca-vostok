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
import type { ObjectStorage } from '../../domain/media/MediaRepository.ts';
import { PERMISSIONS } from '../../domain/identity/Rbac.ts';
import type {
  ReadinessSurveyRecord,
  ReadinessSurveyStats,
} from '../persistence/JsonFileReadinessSurveyRepository.ts';
import type { CourseSatisfactionRecord } from '../persistence/JsonFileSatisfactionSurveyRepository.ts';
import type { CourseSatisfactionSurveyStats } from '../../utils/courseSatisfactionSurvey.ts';
import type {
  EmploymentSurveyRepository,
  StoredEmploymentSurveyRecord,
} from '../persistence/JsonFileEmploymentSurveyRepository.ts';
import { appLogger } from '../logging/Logger.ts';
import { requireAuth } from './AuthMiddleware.ts';
import { sendDomainError } from './ErrorHandler.ts';

export interface ReadinessSurveyRepoPort {
  getStats(): Promise<ReadinessSurveyStats> | ReadinessSurveyStats;
  submit(rawInput: Record<string, unknown>):
    | Promise<{ record: ReadinessSurveyRecord; stats: ReadinessSurveyStats }>
    | { record: ReadinessSurveyRecord; stats: ReadinessSurveyStats };
}

export interface SatisfactionSurveyRepoPort {
  getStats(): Promise<CourseSatisfactionSurveyStats> | CourseSatisfactionSurveyStats;
  submit(rawInput: Record<string, unknown>):
    | Promise<{ record: CourseSatisfactionRecord; stats: CourseSatisfactionSurveyStats }>
    | { record: CourseSatisfactionRecord; stats: CourseSatisfactionSurveyStats };
}

export interface CertificationRouterDeps {
  submitInquiry: SubmitInquiryUseCase;
  getInquiryStats: GetInquiryStatsUseCase;
  submitFeedback: SubmitFeedbackUseCase;
  getFeedbackStats: GetFeedbackStatsUseCase;
  getCenterReviewsStats: GetCenterReviewsStatsUseCase;
  listCenterReviews: ListCenterReviewsUseCase;
  getGuideLeaderboard: GetGuideLeaderboardUseCase;
  syncMyGuideLeaderboard: SyncMyGuideLeaderboardUseCase;
  readinessSurveyRepo: ReadinessSurveyRepoPort;
  satisfactionSurveyRepo: SatisfactionSurveyRepoPort;
  employmentSurveyRepo: EmploymentSurveyRepository;
  objectStorage: ObjectStorage;
  persistenceAdapter: string;
  storageProvider: string;
  eventBus: DomainEventBus;
  inquiryRateLimit: express.RequestHandler;
  feedbackRateLimit: express.RequestHandler;
  surveyRateLimit: express.RequestHandler;
}

const certLog = appLogger.child('certification-router');
const EMPLOYMENT_SNAPSHOT_KEY = 'surveys/employment-reattestation/latest-snapshot.json';

function sanitizePublicEmploymentRecord(record: StoredEmploymentSurveyRecord) {
  return {
    id: record.id,
    respondentName: record.respondentName,
    region: record.region,
    discipline: record.discipline,
    complexityLevel: record.complexityLevel,
    employmentStatus: record.employmentStatus,
    workloadRange: record.workloadRange,
    tourDaysPerSeason: record.tourDaysPerSeason,
    groupsPerMonth: record.groupsPerMonth,
    hasActiveCertificate: record.hasActiveCertificate,
    reattestationUrgency: record.reattestationUrgency,
    preferredFormat: record.preferredFormat,
    neededTopics: record.neededTopics,
    needsEmployerSubsidy: record.needsEmployerSubsidy,
    priorityLevel: record.priorityLevel,
    comment: record.comment,
    submittedAt: record.submittedAt,
    archiveObjectKey: record.archiveObjectKey ?? '',
    canDelete: Boolean(record.ownerUserId),
  };
}

export function createCertificationRouter(deps: CertificationRouterDeps): express.Router {
  const router = express.Router();

  const syncEmploymentSnapshotToStorage = async (
    summary: Awaited<ReturnType<EmploymentSurveyRepository['getSummary']>>,
    records: StoredEmploymentSurveyRecord[]
  ) => {
    const payload = {
      exportedAt: new Date().toISOString(),
      persistenceAdapter: deps.persistenceAdapter,
      storageProvider: deps.storageProvider,
      summary,
      responses: records.map(sanitizePublicEmploymentRecord),
    };
    await deps.objectStorage.put(
      EMPLOYMENT_SNAPSHOT_KEY,
      Buffer.from(JSON.stringify(payload, null, 2), 'utf-8'),
      'application/json; charset=utf-8',
      { cacheControl: 'no-store' }
    );
  };

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

  router.get('/api/readiness-survey/stats', async (_req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await Promise.resolve(deps.readinessSurveyRepo.getStats()));
    } catch (err) {
      sendDomainError(err, res, certLog, 'Failed to read readiness survey stats');
    }
  });

  router.post('/api/readiness-survey', deps.surveyRateLimit, async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const { record, stats } = await Promise.resolve(deps.readinessSurveyRepo.submit(body));
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

  router.get('/api/course-satisfaction/stats', async (_req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await Promise.resolve(deps.satisfactionSurveyRepo.getStats()));
    } catch (err) {
      sendDomainError(err, res, certLog, 'Failed to read course satisfaction stats');
    }
  });

  router.post('/api/course-satisfaction', deps.surveyRateLimit, async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const { record, stats } = await Promise.resolve(deps.satisfactionSurveyRepo.submit(body));
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

  // Guide employment & re-attestation survey (PostgreSQL + Garage S3 snapshot)
  router.get('/api/employment-survey', async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const [summary, records] = await Promise.all([
        deps.employmentSurveyRepo.getSummary(),
        deps.employmentSurveyRepo.listAll(100),
      ]);
      const viewerId = req.authUser?.id ?? null;
      const canModerate = Boolean(
        req.authUser?.can(PERMISSIONS.MODERATE_CONTENT)
      );
      res.json({
        summary,
        responses: records.map((item) => ({
          ...sanitizePublicEmploymentRecord(item),
          canDelete: Boolean(canModerate || (viewerId && item.ownerUserId === viewerId)),
        })),
        persistenceAdapter: deps.persistenceAdapter,
        storageProvider: deps.storageProvider,
        archiveKey: EMPLOYMENT_SNAPSHOT_KEY,
      });
    } catch (err) {
      sendDomainError(err, res, certLog, 'Failed to read employment survey data');
    }
  });

  router.post('/api/employment-survey', deps.surveyRateLimit, async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const ownerUserId = req.authUser?.id ?? null;
      const { record, summary, allRecords } = await deps.employmentSurveyRepo.submit(body, {
        ownerUserId,
      });

      const archiveKey = `surveys/employment-reattestation/entries/${record.id}.json`;
      try {
        await deps.objectStorage.put(
          archiveKey,
          Buffer.from(JSON.stringify(sanitizePublicEmploymentRecord(record), null, 2), 'utf-8'),
          'application/json; charset=utf-8'
        );
        await deps.employmentSurveyRepo.updateArchiveKey(record.id, archiveKey);
        record.archiveObjectKey = archiveKey;
        await syncEmploymentSnapshotToStorage(summary, allRecords);
      } catch (storageErr) {
        certLog.error('Failed to archive employment survey to object storage', {
          error: storageErr,
          recordId: record.id,
          storageProvider: deps.storageProvider,
        });
      }

      res.status(201).json({
        ok: true,
        entry: {
          ...sanitizePublicEmploymentRecord(record),
          canDelete: Boolean(
            req.authUser?.can(PERMISSIONS.MODERATE_CONTENT) ||
              (ownerUserId && record.ownerUserId === ownerUserId)
          ),
        },
        summary,
        archiveKey: record.archiveObjectKey || archiveKey,
        persistenceAdapter: deps.persistenceAdapter,
        storageProvider: deps.storageProvider,
      });
    } catch (err) {
      sendDomainError(err, res, certLog, 'Failed to submit employment survey');
    }
  });

  router.get('/api/employment-survey/archive', async (_req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      let object = await deps.objectStorage.get(EMPLOYMENT_SNAPSHOT_KEY);
      if (!object) {
        const [summary, records] = await Promise.all([
          deps.employmentSurveyRepo.getSummary(),
          deps.employmentSurveyRepo.listAll(200),
        ]);
        await syncEmploymentSnapshotToStorage(summary, records);
        object = await deps.objectStorage.get(EMPLOYMENT_SNAPSHOT_KEY);
      }
      if (!object) {
        res.status(404).json({ error: 'Снимок опроса пока недоступен.' });
        return;
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="rca-employment-reattestation-snapshot.json"'
      );
      res.send(object.body);
    } catch (err) {
      sendDomainError(err, res, certLog, 'Failed to download employment survey archive');
    }
  });

  router.delete('/api/employment-survey/:id', requireAuth(), async (req, res) => {
    try {
      const existing = await deps.employmentSurveyRepo.findById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Анкета не найдена.' });
        return;
      }
      const canModerate = req.authUser!.can(PERMISSIONS.MODERATE_CONTENT);
      const isOwner = Boolean(existing.ownerUserId && existing.ownerUserId === req.authUser!.id);
      if (!canModerate && !isOwner) {
        res.status(403).json({ error: 'Недостаточно прав для удаления этой анкеты.' });
        return;
      }

      await deps.employmentSurveyRepo.deleteById(existing.id);
      if (existing.archiveObjectKey) {
        await deps.objectStorage.delete(existing.archiveObjectKey).catch(() => {});
      }

      const [summary, records] = await Promise.all([
        deps.employmentSurveyRepo.getSummary(),
        deps.employmentSurveyRepo.listAll(200),
      ]);
      await syncEmploymentSnapshotToStorage(summary, records).catch(() => {});

      res.json({ ok: true, summary });
    } catch (err) {
      sendDomainError(err, res, certLog, 'Failed to delete employment survey');
    }
  });

  return router;
}
