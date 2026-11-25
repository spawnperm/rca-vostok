import { z } from 'zod';

export const CmsSectionTypeSchema = z.enum([
  'hero',
  'announcement',
  'playbook',
  'onboarding',
  'release',
  'faq',
]);

export const CreateCmsBlockSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, 'Slug минимум 2 символа')
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Допустимы строчные латинские буквы, цифры и дефис')
    .optional(),
  title: z.string().trim().min(2, 'Укажите заголовок').max(140),
  sectionType: CmsSectionTypeSchema.default('announcement'),
  body: z.string().trim().min(5, 'Укажите текст блока').max(5000),
  ctaLabel: z.string().trim().min(1).max(60).default('Подробнее'),
  published: z.boolean().default(true),
});

export const UpdateCmsBlockSchema = CreateCmsBlockSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'Не переданы поля для обновления блока' }
);
