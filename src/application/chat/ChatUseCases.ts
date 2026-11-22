import { z } from 'zod';
import { Channel, ChatMessage, assertReactionEmoji } from '../../domain/chat/Chat.ts';
import type { ChatRepository } from '../../domain/chat/ChatRepository.ts';
import { PERMISSIONS } from '../../domain/identity/Rbac.ts';
import { NotFoundError, ValidationError, type DomainEventBus } from '../../domain/shared/DomainError.ts';
import type { User } from '../../domain/identity/User.ts';
import { parseOrThrow } from '../social/SocialUseCases.ts';

export const createChannelSchema = z.object({
  displayName: z.string().min(2).max(80),
  purpose: z.string().max(280).optional(),
  type: z.enum(['public', 'private']).optional(),
});

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(4000),
  rootId: z.string().max(64).optional().nullable(),
});

/**
 * Channel operations.
 *
 * Access rule: public channels are readable by any authenticated user, private
 * channels only by members. Writes always require membership.
 */
export class CreateChannelUseCase {
  private readonly chat: ChatRepository;

  constructor(chat: ChatRepository) {
    this.chat = chat;
  }

  async execute(actor: User, rawInput: unknown): Promise<ReturnType<Channel['toDTO']>> {
    actor.assertCan(PERMISSIONS.CREATE_CHANNEL);
    const input = parseOrThrow(createChannelSchema, rawInput);

    const channel = Channel.create({
      displayName: input.displayName,
      purpose: input.purpose,
      type: input.type,
      createdBy: actor.id,
    });

    // Slugs are unique; suffix on collision rather than failing the request.
    const existing = await this.chat.findChannelBySlug(channel.slug);
    const finalChannel = existing
      ? Channel.rehydrate({
          ...channel,
          slug: `${channel.slug}-${Date.now().toString(36).slice(-4)}`,
        } as never)
      : channel;

    await this.chat.saveChannel(finalChannel);
    await this.chat.addMember(finalChannel.id, actor.id, actor.fullName.value);

    return finalChannel.toDTO(1);
  }
}

export class ListChannelsUseCase {
  private readonly chat: ChatRepository;

  constructor(chat: ChatRepository) {
    this.chat = chat;
  }

  async execute(actor: User): Promise<{ channels: ReturnType<Channel['toDTO']>[] }> {
    actor.assertCan(PERMISSIONS.USE_CHAT);

    const mine = await this.chat.listChannelsForUser(actor.id);
    const publicOnes = await this.chat.listPublicChannels();

    // Union: my channels + public ones I have not joined yet.
    const byId = new Map<string, Channel>();
    for (const c of [...mine, ...publicOnes]) {
      byId.set(c.id, c);
    }

    const channels = await Promise.all(
      [...byId.values()].map(async (c) => {
        const [memberCount, unread] = await Promise.all([
          this.chat.countMembers(c.id),
          this.chat.countUnread(c.id, actor.id),
        ]);
        return { ...c.toDTO(memberCount), unreadCount: unread };
      })
    );

    return { channels };
  }
}

export class JoinChannelUseCase {
  private readonly chat: ChatRepository;

  constructor(chat: ChatRepository) {
    this.chat = chat;
  }

  async execute(actor: User, channelId: string): Promise<{ ok: true }> {
    actor.assertCan(PERMISSIONS.USE_CHAT);

    const channel = await this.chat.findChannel(channelId);
    if (!channel) throw new NotFoundError('Канал не найден.');

    // Private channels cannot be self-joined.
    if (channel.type === 'private') {
      throw new ValidationError('Приватный канал доступен только по приглашению.');
    }

    await this.chat.addMember(channelId, actor.id, actor.fullName.value);
    return { ok: true };
  }
}

export class ListMessagesUseCase {
  private readonly chat: ChatRepository;

  constructor(chat: ChatRepository) {
    this.chat = chat;
  }

  async execute(
    actor: User,
    channelId: string,
    options: { limit?: number; before?: string; threadRootId?: string | null }
  ): Promise<{
    messages: ReturnType<ChatMessage['toDTO']>[];
    members: unknown;
  }> {
    actor.assertCan(PERMISSIONS.USE_CHAT);

    const channel = await this.chat.findChannel(channelId);
    if (!channel) throw new NotFoundError('Канал не найден.');

    const isMember = await this.chat.isMember(channelId, actor.id);
    if (channel.type === 'private' && !isMember) {
      throw new ValidationError('Нет доступа к приватному каналу.', 'FORBIDDEN');
    }

    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const messages = await this.chat.listMessages(channelId, {
      limit,
      before: options.before,
      rootId: options.threadRootId === undefined ? null : options.threadRootId,
    });

    const ids = messages.map((m) => m.id);
    const reactions = await this.chat.listReactions(ids, actor.id);

    const withCounts = await Promise.all(
      messages.map(async (m) =>
        m.toDTO(await this.chat.countReplies(m.id), reactions[m.id] ?? [])
      )
    );

    // Reading the channel clears the unread badge.
    await this.chat.markRead(channelId, actor.id, new Date().toISOString());

    return {
      messages: withCounts,
      members: await this.chat.listMembers(channelId),
    };
  }
}

export class SendMessageUseCase {

  private readonly chat: ChatRepository;
  private readonly eventBus: DomainEventBus;

  constructor(chat: ChatRepository, eventBus: DomainEventBus) {
    this.chat = chat;
    this.eventBus = eventBus;
  }

  async execute(
    actor: User,
    channelId: string,
    rawInput: unknown
  ): Promise<ReturnType<ChatMessage['toDTO']>> {
    actor.assertCan(PERMISSIONS.USE_CHAT);

    const channel = await this.chat.findChannel(channelId);
    if (!channel) throw new NotFoundError('Канал не найден.');

    if (!(await this.chat.isMember(channelId, actor.id))) {
      throw new ValidationError(
        'Сначала присоединитесь к каналу.',
        'NOT_A_MEMBER'
      );
    }

    const input = parseOrThrow(sendMessageSchema, rawInput);

    // A reply must point at an existing top-level message in this channel.
    if (input.rootId) {
      const root = await this.chat.findMessage(input.rootId);
      if (!root || root.channelId !== channelId) {
        throw new ValidationError('Ответ адресован несуществующему сообщению.');
      }
    }

    const message = ChatMessage.create({
      channelId,
      authorId: actor.id,
      authorName: actor.fullName.value,
      body: input.body,
      rootId: input.rootId,
    });

    await this.chat.saveMessage(message);

    this.eventBus.publish({
      eventName: 'chat.message_sent',
      occurredAt: message.createdAt,
      boundedContext: 'identity',
      payload: {
        channelId,
        messageId: message.id,
        authorId: actor.id,
        isReply: Boolean(message.rootId),
      },
    });

    return message.toDTO();
  }
}

export class EditMessageUseCase {
  private readonly chat: ChatRepository;

  constructor(chat: ChatRepository) {
    this.chat = chat;
  }

  async execute(
    actor: User,
    messageId: string,
    rawInput: unknown
  ): Promise<ReturnType<ChatMessage['toDTO']>> {
    const message = await this.chat.findMessage(messageId);
    if (!message) throw new NotFoundError('Сообщение не найдено.');

    const input = parseOrThrow(z.object({ body: z.string().min(1).max(4000) }), rawInput);
    const updated = message.edit(actor.id, input.body);
    await this.chat.saveMessage(updated);
    return updated.toDTO();
  }
}

export class DeleteMessageUseCase {
  private readonly chat: ChatRepository;

  constructor(chat: ChatRepository) {
    this.chat = chat;
  }

  async execute(actor: User, messageId: string): Promise<{ ok: true }> {
    const message = await this.chat.findMessage(messageId);
    if (!message) throw new NotFoundError('Сообщение не найдено.');

    const canModerate = actor.can(PERMISSIONS.MODERATE_CHAT);
    const removed = message.remove(actor.id, canModerate);
    await this.chat.saveMessage(removed);
    return { ok: true };
  }
}

export class ToggleReactionUseCase {
  private readonly chat: ChatRepository;

  constructor(chat: ChatRepository) {
    this.chat = chat;
  }

  async execute(
    actor: User,
    messageId: string,
    emojiRaw: unknown
  ): Promise<{ emoji: string; active: boolean }> {
    actor.assertCan(PERMISSIONS.REACT);
    const emoji = assertReactionEmoji(emojiRaw);

    const message = await this.chat.findMessage(messageId);
    if (!message) throw new NotFoundError('Сообщение не найдено.');

    const { active } = await this.chat.toggleReaction(messageId, actor.id, emoji);
    return { emoji, active };
  }
}
