import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  headline: z.string().trim().max(140).optional(),
  department: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  statusText: z.string().trim().max(160).optional(),
  bio: z.string().trim().max(800).optional(),
  skills: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
});

export const CreateWallPostSchema = z.object({
  content: z.string().trim().min(1, 'Напишите сообщение на стену').max(4000),
  attachmentType: z.enum(['none', 'deal', 'poll', 'doc']).default('none'),
  attachmentData: z.record(z.string(), z.unknown()).optional().default({}),
});

export const CreatePostCommentSchema = z.object({
  body: z.string().trim().min(1, 'Комментарий не может быть пустым').max(1500),
});

export const VotePollSchema = z.object({
  optionIndex: z.coerce.number().int().min(0).max(12),
});

export const CreateSocialGroupSchema = z.object({
  name: z.string().trim().min(2, 'Укажите название сообщества').max(80),
  description: z.string().trim().min(5, 'Добавьте описание сообщества').max(400),
  category: z.string().trim().min(2, 'Укажите категорию').max(40),
});
