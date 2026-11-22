import type pg from 'pg';
import { Channel, ChatMessage } from '../../../domain/chat/Chat.ts';
import type {
  ChannelMemberDTO,
  ChatRepository,
} from '../../../domain/chat/ChatRepository.ts';

interface ChannelRow {
  id: string;
  slug: string;
  display_name: string;
  purpose: string;
  type: string;
  created_by: string;
  created_at: Date;
}

interface MessageRow {
  id: string;
  channel_id: string;
  author_id: string;
  author_name: string;
  body: string;
  root_id: string | null;
  created_at: Date;
  edited_at: Date | null;
  removed: boolean;
}

function toChannel(row: ChannelRow): Channel {
  return Channel.rehydrate({
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    purpose: row.purpose,
    type: row.type,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
  });
}

function toMessage(row: MessageRow): ChatMessage {
  return ChatMessage.rehydrate({
    id: row.id,
    channelId: row.channel_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    rootId: row.root_id,
    createdAt: row.created_at.toISOString(),
    editedAt: row.edited_at ? row.edited_at.toISOString() : null,
    removed: row.removed,
  });
}

/** PostgreSQL adapter for channels, messages, threads and reactions. */
export class PostgresChatRepository implements ChatRepository {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async saveChannel(channel: Channel): Promise<void> {
    await this.pool.query(
      `INSERT INTO chat_channels (id, slug, display_name, purpose, type, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         purpose = EXCLUDED.purpose`,
      [
        channel.id,
        channel.slug,
        channel.displayName,
        channel.purpose,
        channel.type,
        channel.createdBy,
        channel.createdAt,
      ]
    );
  }

  async findChannel(id: string): Promise<Channel | null> {
    const res = await this.pool.query<ChannelRow>('SELECT * FROM chat_channels WHERE id = $1', [
      id,
    ]);
    return res.rows.length > 0 ? toChannel(res.rows[0]) : null;
  }

  async findChannelBySlug(slug: string): Promise<Channel | null> {
    const res = await this.pool.query<ChannelRow>(
      'SELECT * FROM chat_channels WHERE slug = $1',
      [slug]
    );
    return res.rows.length > 0 ? toChannel(res.rows[0]) : null;
  }

  async listChannelsForUser(userId: string): Promise<Channel[]> {
    const res = await this.pool.query<ChannelRow>(
      `SELECT c.* FROM chat_channels c
         JOIN chat_members m ON m.channel_id = c.id
        WHERE m.user_id = $1
        ORDER BY c.created_at ASC`,
      [userId]
    );
    return res.rows.map(toChannel);
  }

  async listPublicChannels(): Promise<Channel[]> {
    const res = await this.pool.query<ChannelRow>(
      `SELECT * FROM chat_channels WHERE type = 'public' ORDER BY created_at ASC`
    );
    return res.rows.map(toChannel);
  }

  async addMember(channelId: string, userId: string, displayName: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO chat_members (channel_id, user_id, display_name, joined_at)
       VALUES ($1,$2,$3,$4) ON CONFLICT (channel_id, user_id) DO NOTHING`,
      [channelId, userId, displayName, new Date().toISOString()]
    );
  }

  async removeMember(channelId: string, userId: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM chat_members WHERE channel_id = $1 AND user_id = $2',
      [channelId, userId]
    );
  }

  async isMember(channelId: string, userId: string): Promise<boolean> {
    const res = await this.pool.query(
      'SELECT 1 FROM chat_members WHERE channel_id = $1 AND user_id = $2',
      [channelId, userId]
    );
    return res.rows.length > 0;
  }

  async listMembers(channelId: string): Promise<ChannelMemberDTO[]> {
    const res = await this.pool.query<{
      user_id: string;
      display_name: string;
      last_read_at: Date | null;
    }>(
      `SELECT user_id, display_name, last_read_at
         FROM chat_members WHERE channel_id = $1 ORDER BY joined_at ASC`,
      [channelId]
    );
    return res.rows.map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
      lastReadAt: row.last_read_at ? row.last_read_at.toISOString() : null,
    }));
  }

  async countMembers(channelId: string): Promise<number> {
    const res = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM chat_members WHERE channel_id = $1',
      [channelId]
    );
    return Number(res.rows[0]?.count ?? 0);
  }

  async markRead(channelId: string, userId: string, at: string): Promise<void> {
    await this.pool.query(
      'UPDATE chat_members SET last_read_at = $3 WHERE channel_id = $1 AND user_id = $2',
      [channelId, userId, at]
    );
  }

  async saveMessage(message: ChatMessage): Promise<void> {
    await this.pool.query(
      `INSERT INTO chat_messages (
         id, channel_id, author_id, author_name, body, root_id, created_at, edited_at, removed
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET
         body = EXCLUDED.body,
         edited_at = EXCLUDED.edited_at,
         removed = EXCLUDED.removed`,
      [
        message.id,
        message.channelId,
        message.authorId,
        message.authorName,
        message.body,
        message.rootId,
        message.createdAt,
        message.editedAt,
        message.removed,
      ]
    );
  }

  async findMessage(id: string): Promise<ChatMessage | null> {
    const res = await this.pool.query<MessageRow>('SELECT * FROM chat_messages WHERE id = $1', [
      id,
    ]);
    return res.rows.length > 0 ? toMessage(res.rows[0]) : null;
  }

  async listMessages(
    channelId: string,
    options: { limit: number; before?: string; rootId?: string | null }
  ): Promise<ChatMessage[]> {
    const params: unknown[] = [channelId];
    const where: string[] = ['channel_id = $1'];

    if (options.rootId === null) {
      // Top-level timeline: thread replies are excluded.
      where.push('root_id IS NULL');
    } else if (options.rootId) {
      params.push(options.rootId);
      where.push(`root_id = $${params.length}`);
    }

    if (options.before) {
      params.push(options.before);
      where.push(`created_at < $${params.length}`);
    }

    params.push(options.limit);
    const res = await this.pool.query<MessageRow>(
      `SELECT * FROM chat_messages
        WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${params.length}`,
      params
    );

    // Query runs newest-first for the LIMIT; the UI wants chronological order.
    return res.rows.map(toMessage).reverse();
  }

  async countReplies(rootId: string): Promise<number> {
    const res = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM chat_messages WHERE root_id = $1 AND removed = FALSE',
      [rootId]
    );
    return Number(res.rows[0]?.count ?? 0);
  }

  async deleteMessage(id: string): Promise<void> {
    await this.pool.query('UPDATE chat_messages SET removed = TRUE, body = $2 WHERE id = $1', [
      id,
      '',
    ]);
  }

  async toggleReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<{ active: boolean }> {
    const del = await this.pool.query(
      'DELETE FROM chat_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [messageId, userId, emoji]
    );

    if ((del.rowCount ?? 0) > 0) {
      return { active: false };
    }

    await this.pool.query(
      `INSERT INTO chat_reactions (message_id, user_id, emoji, created_at)
       VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [messageId, userId, emoji, new Date().toISOString()]
    );
    return { active: true };
  }

  async listReactions(
    messageIds: string[],
    viewerId: string
  ): Promise<Record<string, { emoji: string; count: number; mine: boolean }[]>> {
    if (messageIds.length === 0) return {};

    const res = await this.pool.query<{
      message_id: string;
      emoji: string;
      count: string;
      mine: boolean;
    }>(
      `SELECT message_id, emoji, COUNT(*)::text AS count,
              BOOL_OR(user_id = $2) AS mine
         FROM chat_reactions
        WHERE message_id = ANY($1::text[])
        GROUP BY message_id, emoji
        ORDER BY emoji`,
      [messageIds, viewerId]
    );

    const grouped: Record<string, { emoji: string; count: number; mine: boolean }[]> = {};
    for (const row of res.rows) {
      (grouped[row.message_id] ??= []).push({
        emoji: row.emoji,
        count: Number(row.count),
        mine: row.mine,
      });
    }
    return grouped;
  }

  async countUnread(channelId: string, userId: string): Promise<number> {
    const res = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM chat_messages msg
         JOIN chat_members mem ON mem.channel_id = msg.channel_id AND mem.user_id = $2
        WHERE msg.channel_id = $1
          AND msg.removed = FALSE
          AND msg.author_id <> $2
          AND (mem.last_read_at IS NULL OR msg.created_at > mem.last_read_at)`,
      [channelId, userId]
    );
    return Number(res.rows[0]?.count ?? 0);
  }
}
