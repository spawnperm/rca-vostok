import fs from 'fs';
import { Channel, ChatMessage } from '../../domain/chat/Chat.ts';
import type {
  ChannelMemberDTO,
  ChatRepository,
} from '../../domain/chat/ChatRepository.ts';
import { atomicWriteJson, ensureDirectory, resolveConfinedPath } from './PathConfinement.ts';

interface StoredChannel {
  id: string;
  slug: string;
  displayName: string;
  purpose: string;
  type: 'public' | 'private';
  createdBy: string;
  createdAt: string;
}

interface StoredMember {
  channelId: string;
  userId: string;
  displayName: string;
  joinedAt: string;
  lastReadAt: string | null;
}

interface StoredMessage {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  body: string;
  rootId: string | null;
  createdAt: string;
  editedAt: string | null;
  removed: boolean;
}

interface StoredReaction {
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

interface ChatStore {
  channels: StoredChannel[];
  members: StoredMember[];
  messages: StoredMessage[];
  reactions: StoredReaction[];
}

function defaultSeedStore(): ChatStore {
  const createdAt = new Date().toISOString();
  return {
    channels: [
      {
        id: 'chn-general-dfo',
        slug: 'obshchiy-kanal-dfo',
        displayName: 'Общий канал ДФО',
        purpose: 'Знакомство участников, новости регионов и обмен опытом проводников.',
        type: 'public',
        createdBy: 'system',
        createdAt,
      },
      {
        id: 'chn-routes-safety',
        slug: 'marshruty-i-bezopasnost',
        displayName: 'Маршруты и безопасность',
        purpose: 'Обсуждение ниток маршрутов, снежной и паводковой обстановки, КС.',
        type: 'public',
        createdBy: 'system',
        createdAt,
      },
      {
        id: 'chn-attestation-npa',
        slug: 'attestaciya-i-npa',
        displayName: 'Аттестация и НПА',
        purpose: 'Вопросы подготовки к аттестации по ПП № 1003 (ред. № 1893).',
        type: 'public',
        createdBy: 'system',
        createdAt,
      },
    ],
    members: [],
    messages: [],
    reactions: [],
  };
}

function toChannel(row: StoredChannel): Channel {
  return Channel.rehydrate({
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    purpose: row.purpose,
    type: row.type,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  });
}

function toMessage(row: StoredMessage): ChatMessage {
  return ChatMessage.rehydrate({
    id: row.id,
    channelId: row.channelId,
    authorId: row.authorId,
    authorName: row.authorName,
    body: row.body,
    rootId: row.rootId,
    createdAt: row.createdAt,
    editedAt: row.editedAt,
    removed: row.removed,
  });
}

/**
 * JSON-file adapter for channels, members, messages, threads and reactions.
 * Seeds default public channels on first use so candidates and instructors can
 * chat immediately without PostgreSQL.
 */
export class JsonFileChatRepository implements ChatRepository {
  private readonly dataDir: string;
  private readonly fileName: string;
  private readonly tempFileName: string;

  constructor(dataDir: string, fileName = 'chat.json') {
    this.dataDir = dataDir;
    this.fileName = fileName;
    this.tempFileName = `${fileName}.tmp`;
  }

  private readStore(): ChatStore {
    ensureDirectory(this.dataDir);
    const targetPath = resolveConfinedPath(this.dataDir, this.fileName);
    if (!fs.existsSync(targetPath)) {
      const seeded = defaultSeedStore();
      this.writeStore(seeded);
      return seeded;
    }
    try {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ChatStore> | null;
      if (!parsed || typeof parsed !== 'object') {
        return defaultSeedStore();
      }
      return {
        channels: Array.isArray(parsed.channels) ? parsed.channels : [],
        members: Array.isArray(parsed.members) ? parsed.members : [],
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        reactions: Array.isArray(parsed.reactions) ? parsed.reactions : [],
      };
    } catch {
      return defaultSeedStore();
    }
  }

  private writeStore(store: ChatStore): void {
    atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, store);
  }

  async saveChannel(channel: Channel): Promise<void> {
    const store = this.readStore();
    const idx = store.channels.findIndex((c) => c.id === channel.id);
    const record: StoredChannel = {
      id: channel.id,
      slug: channel.slug,
      displayName: channel.displayName,
      purpose: channel.purpose,
      type: channel.type,
      createdBy: channel.createdBy,
      createdAt: channel.createdAt,
    };
    if (idx >= 0) {
      store.channels[idx] = {
        ...store.channels[idx],
        displayName: channel.displayName,
        purpose: channel.purpose,
      };
    } else {
      store.channels.push(record);
    }
    this.writeStore(store);
  }

  async findChannel(id: string): Promise<Channel | null> {
    const store = this.readStore();
    const row = store.channels.find((c) => c.id === id);
    return row ? toChannel(row) : null;
  }

  async findChannelBySlug(slug: string): Promise<Channel | null> {
    const store = this.readStore();
    const row = store.channels.find((c) => c.slug === slug);
    return row ? toChannel(row) : null;
  }

  async listChannelsForUser(userId: string): Promise<Channel[]> {
    const store = this.readStore();
    const myChannelIds = new Set(
      store.members.filter((m) => m.userId === userId).map((m) => m.channelId)
    );
    return store.channels
      .filter((c) => myChannelIds.has(c.id))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(toChannel);
  }

  async listPublicChannels(): Promise<Channel[]> {
    const store = this.readStore();
    return store.channels
      .filter((c) => c.type === 'public')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(toChannel);
  }

  async addMember(channelId: string, userId: string, displayName: string): Promise<void> {
    const store = this.readStore();
    const exists = store.members.some(
      (m) => m.channelId === channelId && m.userId === userId
    );
    if (!exists) {
      store.members.push({
        channelId,
        userId,
        displayName,
        joinedAt: new Date().toISOString(),
        lastReadAt: null,
      });
      this.writeStore(store);
    }
  }

  async removeMember(channelId: string, userId: string): Promise<void> {
    const store = this.readStore();
    const next = store.members.filter(
      (m) => !(m.channelId === channelId && m.userId === userId)
    );
    if (next.length !== store.members.length) {
      store.members = next;
      this.writeStore(store);
    }
  }

  async isMember(channelId: string, userId: string): Promise<boolean> {
    const store = this.readStore();
    return store.members.some((m) => m.channelId === channelId && m.userId === userId);
  }

  async listMembers(channelId: string): Promise<ChannelMemberDTO[]> {
    const store = this.readStore();
    return store.members
      .filter((m) => m.channelId === channelId)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
      .map((m) => ({
        userId: m.userId,
        displayName: m.displayName,
        lastReadAt: m.lastReadAt,
      }));
  }

  async countMembers(channelId: string): Promise<number> {
    const store = this.readStore();
    return store.members.filter((m) => m.channelId === channelId).length;
  }

  async markRead(channelId: string, userId: string, at: string): Promise<void> {
    const store = this.readStore();
    const member = store.members.find(
      (m) => m.channelId === channelId && m.userId === userId
    );
    if (member) {
      member.lastReadAt = at;
      this.writeStore(store);
    }
  }

  async saveMessage(message: ChatMessage): Promise<void> {
    const store = this.readStore();
    const record: StoredMessage = {
      id: message.id,
      channelId: message.channelId,
      authorId: message.authorId,
      authorName: message.authorName,
      body: message.body,
      rootId: message.rootId,
      createdAt: message.createdAt,
      editedAt: message.editedAt,
      removed: message.removed,
    };
    const idx = store.messages.findIndex((m) => m.id === message.id);
    if (idx >= 0) {
      store.messages[idx] = record;
    } else {
      store.messages.push(record);
    }
    this.writeStore(store);
  }

  async findMessage(id: string): Promise<ChatMessage | null> {
    const store = this.readStore();
    const row = store.messages.find((m) => m.id === id);
    return row ? toMessage(row) : null;
  }

  async listMessages(
    channelId: string,
    options: { limit: number; before?: string; rootId?: string | null }
  ): Promise<ChatMessage[]> {
    const store = this.readStore();
    const filtered = store.messages
      .filter((m) => {
        if (m.channelId !== channelId) return false;
        if (options.rootId === null) {
          if (m.rootId !== null) return false;
        } else if (options.rootId) {
          if (m.rootId !== options.rootId) return false;
        }
        if (options.before && !(m.createdAt < options.before)) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, options.limit)
      .reverse();

    return filtered.map(toMessage);
  }

  async countReplies(rootId: string): Promise<number> {
    const store = this.readStore();
    return store.messages.filter((m) => m.rootId === rootId && !m.removed).length;
  }

  async deleteMessage(id: string): Promise<void> {
    const store = this.readStore();
    const msg = store.messages.find((m) => m.id === id);
    if (msg) {
      msg.removed = true;
      msg.body = '';
      this.writeStore(store);
    }
  }

  async toggleReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<{ active: boolean }> {
    const store = this.readStore();
    const idx = store.reactions.findIndex(
      (r) => r.messageId === messageId && r.userId === userId && r.emoji === emoji
    );
    if (idx >= 0) {
      store.reactions.splice(idx, 1);
      this.writeStore(store);
      return { active: false };
    }
    store.reactions.push({
      messageId,
      userId,
      emoji,
      createdAt: new Date().toISOString(),
    });
    this.writeStore(store);
    return { active: true };
  }

  async listReactions(
    messageIds: string[],
    viewerId: string
  ): Promise<Record<string, { emoji: string; count: number; mine: boolean }[]>> {
    if (messageIds.length === 0) return {};
    const store = this.readStore();
    const targetIds = new Set(messageIds);
    const map = new Map<string, Map<string, { count: number; mine: boolean }>>();

    for (const r of store.reactions) {
      if (!targetIds.has(r.messageId)) continue;
      let byEmoji = map.get(r.messageId);
      if (!byEmoji) {
        byEmoji = new Map();
        map.set(r.messageId, byEmoji);
      }
      const entry = byEmoji.get(r.emoji) ?? { count: 0, mine: false };
      entry.count += 1;
      if (r.userId === viewerId) entry.mine = true;
      byEmoji.set(r.emoji, entry);
    }

    const result: Record<string, { emoji: string; count: number; mine: boolean }[]> = {};
    for (const [msgId, byEmoji] of map.entries()) {
      result[msgId] = [...byEmoji.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([emoji, stats]) => ({ emoji, count: stats.count, mine: stats.mine }));
    }
    return result;
  }

  async countUnread(channelId: string, userId: string): Promise<number> {
    const store = this.readStore();
    const member = store.members.find(
      (m) => m.channelId === channelId && m.userId === userId
    );
    if (!member) return 0;

    return store.messages.filter(
      (m) =>
        m.channelId === channelId &&
        !m.removed &&
        m.authorId !== userId &&
        (!member.lastReadAt || m.createdAt > member.lastReadAt)
    ).length;
  }
}
