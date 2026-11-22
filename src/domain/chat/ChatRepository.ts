import type { Channel, ChatMessage } from './Chat.ts';
import type { MessageDTO } from './Chat.ts';

export interface ChannelMemberDTO {
  userId: string;
  displayName: string;
  lastReadAt: string | null;
}

export interface ChatRepository {
  saveChannel(channel: Channel): Promise<void>;
  findChannel(id: string): Promise<Channel | null>;
  findChannelBySlug(slug: string): Promise<Channel | null>;
  listChannelsForUser(userId: string): Promise<Channel[]>;
  listPublicChannels(): Promise<Channel[]>;

  addMember(channelId: string, userId: string, displayName: string): Promise<void>;
  removeMember(channelId: string, userId: string): Promise<void>;
  isMember(channelId: string, userId: string): Promise<boolean>;
  listMembers(channelId: string): Promise<ChannelMemberDTO[]>;
  countMembers(channelId: string): Promise<number>;
  markRead(channelId: string, userId: string, at: string): Promise<void>;

  saveMessage(message: ChatMessage): Promise<void>;
  findMessage(id: string): Promise<ChatMessage | null>;
  listMessages(
    channelId: string,
    options: { limit: number; before?: string; rootId?: string | null }
  ): Promise<ChatMessage[]>;
  countReplies(rootId: string): Promise<number>;
  deleteMessage(id: string): Promise<void>;

  toggleReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<{ active: boolean }>;
  listReactions(
    messageIds: string[],
    viewerId: string
  ): Promise<Record<string, { emoji: string; count: number; mine: boolean }[]>>;

  /** Number of messages created after the member's lastReadAt. */
  countUnread(channelId: string, userId: string): Promise<number>;
}

/** Convenience alias used by the router when serialising messages. */
export type ChatMessageList = MessageDTO[];
