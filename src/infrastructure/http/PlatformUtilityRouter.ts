import express from 'express';
import type { GetLiveInstructorMarketStatsUseCase } from '../../application/market/LiveInstructorMarketStats.ts';
import { getFarEastHubsWeather } from '../../utils/hubsWeather.ts';
import {
  AssistantServiceError,
  generateRcaAssistantReply,
} from '../ai/RcaAssistantService.ts';
import { appLogger } from '../logging/Logger.ts';
import { sendDomainError } from './ErrorHandler.ts';

export interface PlatformUtilityRouterDeps {
  getLiveMarketStats: GetLiveInstructorMarketStatsUseCase;
  marketStreamListeners: Set<() => void>;
  assistantRateLimit: express.RequestHandler;
}

const utilityLog = appLogger.child('utility-router');

export function createPlatformUtilityRouter(
  deps: PlatformUtilityRouterDeps
): express.Router {
  const router = express.Router();

  router.get('/api/weather/hubs', async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === '1';
      res.json(await getFarEastHubsWeather(forceRefresh));
    } catch (err) {
      sendDomainError(err, res, utilityLog, 'Failed to fetch Far East hubs weather');
    }
  });

  router.get('/api/maps/config', (_req, res) => {
    const apiKey = (
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      ''
    ).trim();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ apiKey });
  });

  router.post('/api/assistant/chat', deps.assistantRateLimit, async (req, res) => {
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
      sendDomainError(err, res, utilityLog, 'Failed to process AI assistant request');
    }
  });

  router.get('/api/market/live-stats', async (_req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await deps.getLiveMarketStats.execute());
    } catch (err) {
      sendDomainError(err, res, utilityLog, 'Failed to get live market stats');
    }
  });

  router.get('/api/market/live-stats/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let closed = false;
    const pushSnapshot = async () => {
      if (closed) return;
      try {
        const snapshot = await deps.getLiveMarketStats.execute();
        res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
      } catch {
        // Ignore transient write error while socket is closing
      }
    };

    await pushSnapshot();

    const onEvent = () => {
      void pushSnapshot();
    };
    deps.marketStreamListeners.add(onEvent);

    const periodicRefresh = setInterval(() => {
      void pushSnapshot();
    }, 15_000);

    const keepAlive = setInterval(() => {
      if (closed) return;
      try {
        res.write(': keepalive\n\n');
      } catch {
        // Ignore on closed socket
      }
    }, 25_000);

    req.on('close', () => {
      closed = true;
      deps.marketStreamListeners.delete(onEvent);
      clearInterval(periodicRefresh);
      clearInterval(keepAlive);
      res.end();
    });
  });

  return router;
}
