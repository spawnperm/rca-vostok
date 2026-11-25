import { z } from 'zod';

export const NEWS_FEED_CHANNEL_NAME = 'news-feed';
export const TOWN_SQUARE_CHANNEL_NAME = 'town-square';

export const MM_QUICK_EMOJIS = [
  { name: 'thumbsup', symbol: '👍', label: 'Нравится' },
  { name: 'heart', symbol: '❤️', label: 'Супер' },
  { name: 'rocket', symbol: '🚀', label: 'В работу' },
  { name: 'eyes', symbol: '👀', label: 'Смотрю' },
  { name: 'tada', symbol: '🎉', label: 'Победа' },
  { name: 'fire', symbol: '🔥', label: 'Важно' },
] as const;

export function getEmojiSymbol(emojiName: string): string {
  const found = MM_QUICK_EMOJIS.find((e) => e.name === emojiName);
  if (found) return found.symbol;
  if (emojiName === '+1') return '👍';
  return emojiName;
}

export function getDirectChannelName(userA: string, userB: string): string {
  return [userA, userB].sort().join('__');
}

export function extractHashtags(message: string): string {
  const matches = message.match(/#[a-zA-Zа-яА-ЯёЁ0-9_-]{2,40}/g);
  return matches ? Array.from(new Set(matches)).join(' ') : '';
}

export const CreateMmChannelSchema = z.object({
  team_id: z.string().min(1),
  name: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_-]+$/i, 'Имя канала должно состоять из латиницы, цифр, - и _'),
  display_name: z.string().trim().min(2).max(64),
  type: z.enum(['O', 'P']).default('O'),
  header: z.string().trim().max(500).optional().default(''),
  purpose: z.string().trim().max(250).optional().default(''),
});

export const DirectMmChannelSchema = z
  .array(z.string().min(1))
  .min(2)
  .max(2);

export const CreateMmPostSchema = z.object({
  channel_id: z.string().min(1),
  message: z.string().trim().min(1, 'Введите текст сообщения').max(6000),
  root_id: z.string().optional().default(''),
  pending_post_id: z.string().optional().default(''),
  type: z.string().optional().default(''),
  props: z.record(z.string(), z.unknown()).optional().default({}),
});

export const PatchMmPostSchema = z.object({
  id: z.string().optional(),
  message: z.string().trim().min(1).max(6000).optional(),
  is_pinned: z.boolean().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
});

export const CreateMmReactionSchema = z.object({
  user_id: z.string().min(1).optional(),
  post_id: z.string().min(1),
  emoji_name: z.string().trim().min(1).max(64),
});

export const SearchMmPostsSchema = z.object({
  terms: z.string().trim().min(1).max(200),
  is_or_search: z.boolean().optional().default(false),
});

export const ViewChannelSchema = z.object({
  channel_id: z.string().min(1),
  prev_channel_id: z.string().optional(),
});

export const UserStatusesByIdsSchema = z.array(z.string().min(1)).max(200);
