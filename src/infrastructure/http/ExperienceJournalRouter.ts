import express from 'express';
import {
  GetExperienceJournalUseCase,
  LogExpeditionUseCase,
  RemoveExpeditionUseCase,
  ResetExperienceJournalUseCase,
} from '../../application/experience/ExperienceJournalUseCases.ts';
import type {
  DfoJournalRegionId,
  ExpeditionComplexity,
  GeoEndpoint,
} from '../../domain/experience/ExperienceEntry.ts';
import { DomainError, NotFoundError, ValidationError } from '../../domain/shared/DomainError.ts';
import { requireAuth } from './AuthMiddleware.ts';
import { appLogger } from '../logging/Logger.ts';

export interface ExperienceJournalRouterDeps {
  getJournalUseCase: GetExperienceJournalUseCase;
  logExpeditionUseCase: LogExpeditionUseCase;
  removeExpeditionUseCase: RemoveExpeditionUseCase;
  resetJournalUseCase: ResetExperienceJournalUseCase;
}

const log = appLogger.child('experience-journal');

function handleRouterError(err: unknown, res: express.Response): void {
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
  log.error('Unhandled experience-journal error', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
}

export function createExperienceJournalRouter(
  deps: ExperienceJournalRouterDeps
): express.Router {
  const router = express.Router();

  router.get('/api/account/experience-journal', requireAuth(), async (req, res) => {
    try {
      const projection = await deps.getJournalUseCase.execute({
        ownerId: req.authUser!.id,
        preferredRegionName: req.authUser!.region,
      });
      res.setHeader('Cache-Control', 'no-store');
      res.json(projection);
    } catch (err) {
      handleRouterError(err, res);
    }
  });

  router.post('/api/account/experience-journal', requireAuth(), async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const result = await deps.logExpeditionUseCase.execute({
        ownerId: req.authUser!.id,
        preferredRegionName: req.authUser!.region,
        input: {
          date: typeof body.date === 'string' ? body.date : '',
          routeTitle: typeof body.routeTitle === 'string' ? body.routeTitle : '',
          regionId: (typeof body.regionId === 'string'
            ? body.regionId
            : 'primorye') as DfoJournalRegionId,
          complexity: (typeof body.complexity === 'string'
            ? body.complexity
            : '1 КС') as ExpeditionComplexity,
          participantsCount:
            typeof body.participantsCount === 'number' ||
            typeof body.participantsCount === 'string'
              ? body.participantsCount
              : '',
          distanceKm:
            typeof body.distanceKm === 'number' ||
            typeof body.distanceKm === 'string' ||
            body.distanceKm === null
              ? body.distanceKm
              : undefined,
          notes: typeof body.notes === 'string' ? body.notes : '',
          startPoint:
            body.startPoint && typeof body.startPoint === 'object'
              ? (body.startPoint as GeoEndpoint)
              : undefined,
          finishPoint:
            body.finishPoint && typeof body.finishPoint === 'object'
              ? (body.finishPoint as GeoEndpoint)
              : undefined,
        },
      });
      res.status(201).json(result);
    } catch (err) {
      handleRouterError(err, res);
    }
  });

  router.delete(
    '/api/account/experience-journal/:entryId',
    requireAuth(),
    async (req, res) => {
      try {
        const projection = await deps.removeExpeditionUseCase.execute({
          ownerId: req.authUser!.id,
          entryId: req.params.entryId,
          preferredRegionName: req.authUser!.region,
        });
        res.json(projection);
      } catch (err) {
        handleRouterError(err, res);
      }
    }
  );

  router.post('/api/account/experience-journal/reset', requireAuth(), async (req, res) => {
    try {
      const projection = await deps.resetJournalUseCase.execute({
        ownerId: req.authUser!.id,
        preferredRegionName: req.authUser!.region,
      });
      res.json(projection);
    } catch (err) {
      handleRouterError(err, res);
    }
  });

  return router;
}
