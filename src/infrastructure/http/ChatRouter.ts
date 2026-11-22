import express from 'express';
import { PERMISSIONS } from '../../domain/identity/Rbac.ts';
import { requireAuth, requirePermission } from './AuthMiddleware.ts';
import { sendDomainError } from './SocialRouter.ts';
import type {
  CreateChannelUseCase,
  DeleteMessageUseCase,
  EditMessageUseCase,
  JoinChannelUseCase,
  ListChannelsUseCase,
  ListMessagesUseCase,
  SendMessageUseCase,
  ToggleReactionUseCase,
} from '../../application/chat/ChatUseCases.ts';
import { SUPPORTED_REACTIONS } from '../../domain/chat/Chat.ts';

export interface ChatRouterDeps {
  createChannel: CreateChannelUseCase;
  listChannels: ListChannelsUseCase;
  joinChannel: JoinChannelUseCase;
  listMessages: ListMessagesUseCase;
  sendMessage: SendMessageUseCase;
  editMessage: EditMessageUseCase;
  deleteMessage: DeleteMessageUseCase;
  toggleReaction: ToggleReactionUseCase;
}

/**
 * Channel-based chat API modelled on Mattermost's object set.
 *
 * Transport is HTTP polling rather than WebSocket: the server is a single
 * 2-vCPU instance, and polling with a short interval keeps the deployment
 * simple (no sticky sessions, no extra broker) while remaining responsive.
 * The client polls `/messages` with `?since` semantics via `before`-less calls.
 */
export function createChatRouter(deps: ChatRouterDeps): express.Router {
  const router = express.Router();

  router.get('/api/chat/channels', requireAuth(), requirePermission(PERMISSIONS.USE_CHAT), async (req, res) => {
    try {
      res.json(await deps.listChannels.execute(req.authUser!));
    } catch (err) {
      sendDomainError(err, res);
    }
  });

  router.post(
    '/api/chat/channels',
    requireAuth(),
    requirePermission(PERMISSIONS.CREATE_CHANNEL),
    async (req, res) => {
      try {
        res.status(201).json(await deps.createChannel.execute(req.authUser!, req.body));
      } catch (err) {
        sendDomainError(err, res);
      }
    }
  );

  router.post(
    '/api/chat/channels/:channelId/join',
    requireAuth(),
    requirePermission(PERMISSIONS.USE_CHAT),
    async (req, res) => {
      try {
        res.json(await deps.joinChannel.execute(req.authUser!, req.params.channelId));
      } catch (err) {
        sendDomainError(err, res);
      }
    }
  );

  /** Timeline of a channel, or a thread when `threadRootId` is supplied. */
  router.get(
    '/api/chat/channels/:channelId/messages',
    requireAuth(),
    requirePermission(PERMISSIONS.USE_CHAT),
    async (req, res) => {
      try {
        const rootParam = req.query.threadRootId;
        res.json(
          await deps.listMessages.execute(req.authUser!, req.params.channelId, {
            limit: req.query.limit ? Number(req.query.limit) : undefined,
            before: typeof req.query.before === 'string' ? req.query.before : undefined,
            threadRootId: typeof rootParam === 'string' ? rootParam : undefined,
          })
        );
      } catch (err) {
        sendDomainError(err, res);
      }
    }
  );

  router.post(
    '/api/chat/channels/:channelId/messages',
    requireAuth(),
    requirePermission(PERMISSIONS.USE_CHAT),
    async (req, res) => {
      try {
        res
          .status(201)
          .json(
            await deps.sendMessage.execute(req.authUser!, req.params.channelId, req.body)
          );
      } catch (err) {
        sendDomainError(err, res);
      }
    }
  );

  router.patch(
    '/api/chat/messages/:messageId',
    requireAuth(),
    requirePermission(PERMISSIONS.USE_CHAT),
    async (req, res) => {
      try {
        res.json(
          await deps.editMessage.execute(req.authUser!, req.params.messageId, req.body)
        );
      } catch (err) {
        sendDomainError(err, res);
      }
    }
  );

  router.delete(
    '/api/chat/messages/:messageId',
    requireAuth(),
    requirePermission(PERMISSIONS.USE_CHAT),
    async (req, res) => {
      try {
        res.json(await deps.deleteMessage.execute(req.authUser!, req.params.messageId));
      } catch (err) {
        sendDomainError(err, res);
      }
    }
  );

  router.post(
    '/api/chat/messages/:messageId/reactions',
    requireAuth(),
    requirePermission(PERMISSIONS.REACT),
    async (req, res) => {
      try {
        res.json(
          await deps.toggleReaction.execute(
            req.authUser!,
            req.params.messageId,
            (req.body ?? {}).emoji
          )
        );
      } catch (err) {
        sendDomainError(err, res);
      }
    }
  );

  /** Palette advertised to the client so both sides agree on valid reactions. */
  router.get('/api/chat/reactions', (_req, res) => {
    res.json({ emoji: SUPPORTED_REACTIONS });
  });

  return router;
}
