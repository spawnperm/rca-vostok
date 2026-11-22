import { InvariantViolationError, ValidationError } from '../shared/DomainError.ts';
import { SanitizedText } from '../shared/ValueObjects.ts';

/**
 * Chat model inspired by Mattermost's core objects:
 *
 *   Channel  — a named conversation (public / private / direct)
 *   Member   — a user's participation in a channel
 *   Message  — a message in a channel; `rootId` turns it into a thread reply
 *   Reaction — an emoji attached to a message by a user
 *
 * Deliberately no WebSocket transport here: the domain only models state.
 */

export const CHANNEL_TYPES = ['public', 'private'] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export interface ChannelDTO {
  id: string;
  slug: string;
  displayName: string;
  purpose: string;
  type: ChannelType;
  createdBy: string;
  createdAt: string;
  memberCount: number;
  unreadCount?: number;
}

export class Channel {
  readonly id: string;
  readonly slug: string;
  readonly displayName: string;
  readonly purpose: string;
  readonly type: ChannelType;
  readonly createdBy: string;
  readonly createdAt: string;

  private constructor(props: {
    id: string;
    slug: string;
    displayName: string;
    purpose: string;
    type: ChannelType;
    createdBy: string;
    createdAt: string;
  }) {
    this.id = props.id;
    this.slug = props.slug;
    this.displayName = props.displayName;
    this.purpose = props.purpose;
    this.type = props.type;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
  }

  static create(input: {
    displayName: unknown;
    purpose?: unknown;
    type?: unknown;
    createdBy: string;
  }): Channel {
    const displayName = SanitizedText.create(input.displayName, {
      fieldLabel: 'Название канала',
      minLen: 2,
      maxLen: 80,
    });

    const type: ChannelType =
      typeof input.type === 'string' && (CHANNEL_TYPES as readonly string[]).includes(input.type)
        ? (input.type as ChannelType)
        : 'public';

    return new Channel({
      id: `chn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      // Slug is derived and used for URLs; uniqueness is enforced in the repo.
      slug: Channel.slugify(displayName.value),
      displayName: displayName.value,
      purpose: SanitizedText.sanitizeRaw(input.purpose, 280),
      type,
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
    });
  }

  static slugify(name: string): string {
    const translit: Record<string, string> = {
      а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
      и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
      с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
      ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
    };
    const ascii = name
      .toLowerCase()
      .split('')
      .map((ch) => translit[ch] ?? ch)
      .join('')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    return ascii || `channel-${Date.now().toString(36)}`;
  }

  static rehydrate(props: {
    id: string;
    slug: string;
    displayName: string;
    purpose: string;
    type: string;
    createdBy: string;
    createdAt: string;
  }): Channel {
    return new Channel({
      id: props.id,
      slug: props.slug,
      displayName: props.displayName,
      purpose: props.purpose,
      type: props.type === 'private' ? 'private' : 'public',
      createdBy: props.createdBy,
      createdAt: props.createdAt,
    });
  }

  toDTO(memberCount = 0): ChannelDTO {
    return {
      id: this.id,
      slug: this.slug,
      displayName: this.displayName,
      purpose: this.purpose,
      type: this.type,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      memberCount,
    };
  }
}

export interface MessageDTO {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  body: string;
  rootId: string | null;
  replyCount: number;
  reactions: { emoji: string; count: number; mine: boolean }[];
  editedAt: string | null;
  createdAt: string;
}

export const MESSAGE_MAX_BODY = 4000;
const ALLOWED_REACTIONS = new Set([
  '👍', '❤️', '🔥', '🎉', '👏', '😀', '🤔', '🙏', '✅', '🏔️', '🌊', '🚵',
]);

export class ChatMessage {
  readonly id: string;
  readonly channelId: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly body: string;
  readonly rootId: string | null;
  readonly createdAt: string;
  readonly editedAt: string | null;
  readonly removed: boolean;

  private constructor(props: {
    id: string;
    channelId: string;
    authorId: string;
    authorName: string;
    body: string;
    rootId: string | null;
    createdAt: string;
    editedAt: string | null;
    removed: boolean;
  }) {
    this.id = props.id;
    this.channelId = props.channelId;
    this.authorId = props.authorId;
    this.authorName = props.authorName;
    this.body = props.body;
    this.rootId = props.rootId;
    this.createdAt = props.createdAt;
    this.editedAt = props.editedAt;
    this.removed = props.removed;
  }

  static create(input: {
    channelId: string;
    authorId: string;
    authorName: string;
    body: unknown;
    rootId?: unknown;
  }): ChatMessage {
    const body = SanitizedText.create(input.body, {
      fieldLabel: 'Сообщение',
      minLen: 1,
      maxLen: MESSAGE_MAX_BODY,
    });

    return new ChatMessage({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      channelId: input.channelId,
      authorId: input.authorId,
      authorName: SanitizedText.sanitizeRaw(input.authorName, 120) || 'Участник',
      body: body.value,
      rootId: SanitizedText.sanitizeRaw(input.rootId, 64) || null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      removed: false,
    });
  }

  static rehydrate(props: {
    id: string;
    channelId: string;
    authorId: string;
    authorName: string;
    body: string;
    rootId: string | null;
    createdAt: string;
    editedAt: string | null;
    removed: boolean;
  }): ChatMessage {
    return new ChatMessage(props);
  }

  /** Only the author may edit their own message. */
  edit(userId: string, body: unknown): ChatMessage {
    if (this.authorId !== userId) {
      throw new InvariantViolationError(
        'Редактировать сообщение может только автор.',
        'FORBIDDEN'
      );
    }
    if (this.removed) {
      throw new InvariantViolationError('Сообщение удалено.');
    }

    const next = SanitizedText.create(body, {
      fieldLabel: 'Сообщение',
      minLen: 1,
      maxLen: MESSAGE_MAX_BODY,
    });

    return new ChatMessage({
      id: this.id,
      channelId: this.channelId,
      authorId: this.authorId,
      authorName: this.authorName,
      body: next.value,
      rootId: this.rootId,
      createdAt: this.createdAt,
      editedAt: new Date().toISOString(),
      removed: false,
    });
  }

  /** Soft delete so threads do not lose their structure. */
  remove(userId: string, canModerate: boolean): ChatMessage {
    if (this.authorId !== userId && !canModerate) {
      throw new InvariantViolationError(
        'Удалить сообщение может автор или модератор.',
        'FORBIDDEN'
      );
    }
    return new ChatMessage({
      id: this.id,
      channelId: this.channelId,
      authorId: this.authorId,
      authorName: this.authorName,
      body: '',
      rootId: this.rootId,
      createdAt: this.createdAt,
      editedAt: this.editedAt,
      removed: true,
    });
  }

  toDTO(
    replyCount = 0,
    reactions: { emoji: string; count: number; mine: boolean }[] = []
  ): MessageDTO {
    return {
      id: this.id,
      channelId: this.channelId,
      authorId: this.authorId,
      authorName: this.authorName,
      body: this.removed ? '' : this.body,
      rootId: this.rootId,
      replyCount,
      reactions,
      editedAt: this.editedAt,
      createdAt: this.createdAt,
    };
  }
}

/** Validates an emoji against the supported reaction set. */
export function assertReactionEmoji(value: unknown): string {
  const emoji = SanitizedText.sanitizeRaw(value, 8);
  if (!ALLOWED_REACTIONS.has(emoji)) {
    throw new ValidationError('Эта реакция не поддерживается.');
  }
  return emoji;
}

export const SUPPORTED_REACTIONS: readonly string[] = [...ALLOWED_REACTIONS];
