import { z } from 'zod';

export function extractZodFieldErrors<T extends string>(
  schema: z.ZodTypeAny,
  input: unknown,
  allowedFields: readonly T[]
): { success: true; data: any; fieldErrors: Partial<Record<T, string>> } | { success: false; fieldErrors: Partial<Record<T, string>>; message: string } {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return { success: true, data: parsed.data, fieldErrors: {} };
  }
  const fieldErrors: Partial<Record<T, string>> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && allowedFields.includes(key as T) && !fieldErrors[key as T]) {
      fieldErrors[key as T] = issue.message;
    }
  }
  return {
    success: false,
    fieldErrors,
    message: parsed.error.issues[0]?.message || 'Проверьте корректность заполнения полей',
  };
}

export const CreateDealSchema = z.object({
  title: z.string().trim().min(2, 'Название сделки обязательно').max(140),
  budget: z.coerce.number().min(0).max(1000000000).default(0),
  currency: z.enum(['RUB', 'USD', 'EUR']).default('RUB'),
  pipelineId: z.string().min(1),
  stageId: z.string().min(1),
  contactId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(32)).max(10).default([]),
  customFields: z.record(z.string(), z.string()).optional(),
});

export const MoveDealStageSchema = z.object({
  stageId: z.string().min(1),
  lossReason: z.string().trim().max(200).optional(),
});

export const UpdateDealSchema = z.object({
  title: z.string().trim().min(2, 'Название сделки должно содержать минимум 2 символа').max(140).optional(),
  budget: z.coerce.number().min(0).max(1000000000).optional(),
  currency: z.enum(['RUB', 'USD', 'EUR']).optional(),
  stageId: z.string().min(1).optional(),
  ownerId: z.string().min(1).optional(),
  contactId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  lossReason: z.string().trim().max(200).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(10).optional(),
  customFields: z.record(z.string(), z.string()).optional(),
});

export const CreatePipelineSchema = z.object({
  name: z.string().trim().min(2, 'Название воронки обязательно').max(80),
});

export const AddTimelineNoteSchema = z.object({
  type: z.enum(['note', 'call', 'email', 'dify_insight']).default('note'),
  body: z.string().trim().min(1, 'Текст комментария не может быть пустым').max(4000),
});

const CustomFieldsRecordSchema = z
  .record(
    z.string(),
    z.union([z.string().max(2000), z.number(), z.boolean(), z.array(z.string().max(100)), z.null()])
  )
  .default({});

export const CreateContactSchema = z.object({
  fullName: z.string().trim().min(2, 'Имя контакта обязательно').max(120),
  phone: z.string().trim().max(40).default(''),
  email: z.string().trim().email('Некорректный email').or(z.literal('')).default(''),
  position: z.string().trim().max(80).default(''),
  companyId: z.string().optional().nullable(),
  companyName: z.string().trim().max(120).default(''),
  tags: z.array(z.string().trim().min(1)).max(12).default([]),
  customFields: CustomFieldsRecordSchema,
});

export const UpdateContactSchema = CreateContactSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'Не переданы поля для обновления контакта' }
);

export const CreateCompanySchema = z.object({
  name: z.string().trim().min(2, 'Название компании обязательно').max(120),
  industry: z.string().trim().max(100).default(''),
  website: z.string().trim().max(160).default(''),
  phone: z.string().trim().max(40).default(''),
  customFields: CustomFieldsRecordSchema,
});

export const UpdateCompanySchema = CreateCompanySchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'Не переданы поля для обновления компании' }
);

export const CreateTaskSchema = z.object({
  title: z.string().trim().min(2, 'Описание задачи обязательно').max(200),
  dealId: z.string().optional().nullable(),
  assigneeId: z.string().optional(),
  taskType: z.enum(['call', 'meeting', 'followup', 'dify_ai']).default('followup'),
  dueAt: z.string().min(1),
  reminderAt: z.string().min(1).nullable().optional(),
  durationMinutes: z.coerce.number().int().min(15).max(720).optional(),
});

export const UpdateTaskSchema = z
  .object({
    title: z.string().trim().min(2, 'Описание задачи обязательно').max(200).optional(),
    dealId: z.string().nullable().optional(),
    assigneeId: z.string().min(1).optional(),
    taskType: z.enum(['call', 'meeting', 'followup', 'dify_ai']).optional(),
    dueAt: z.string().min(1).optional(),
    reminderAt: z.string().min(1).nullable().optional(),
    durationMinutes: z.coerce.number().int().min(15).max(720).optional(),
    completed: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Не переданы поля для обновления задачи' });

export const EmailTemplateCategorySchema = z.enum([
  'welcome',
  'proposal',
  'followup',
  'contract',
  'reactivation',
]);

export type EmailTemplateCategory = z.infer<typeof EmailTemplateCategorySchema>;

export const EMAIL_TEMPLATE_CATEGORY_LABELS: Record<EmailTemplateCategory, string> = {
  welcome: 'Знакомство',
  proposal: 'Коммерческое предложение',
  followup: 'Follow-up',
  contract: 'Договор и SLA',
  reactivation: 'Реактивация',
};

export const EMAIL_TEMPLATE_VARIABLES: Array<{ key: string; label: string }> = [
  { key: '{{contactName}}', label: 'Имя контакта' },
  { key: '{{companyName}}', label: 'Компания' },
  { key: '{{dealTitle}}', label: 'Название сделки' },
  { key: '{{budget}}', label: 'Бюджет' },
  { key: '{{ownerName}}', label: 'Менеджер' },
  { key: '{{stageName}}', label: 'Этап воронки' },
];

export const CreateEmailTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Название шаблона должно содержать минимум 2 символа')
    .max(100, 'Название шаблона не должно превышать 100 символов'),
  category: EmailTemplateCategorySchema.default('followup'),
  subject: z
    .string()
    .trim()
    .min(2, 'Тема письма должна содержать минимум 2 символа')
    .max(180, 'Тема письма не должна превышать 180 символов'),
  body: z
    .string()
    .trim()
    .min(5, 'Текст шаблона должен содержать минимум 5 символов')
    .max(5000, 'Текст шаблона не должен превышать 5000 символов'),
});

export const UpdateEmailTemplateSchema = z
  .object({
    name: CreateEmailTemplateSchema.shape.name.optional(),
    category: EmailTemplateCategorySchema.optional(),
    subject: CreateEmailTemplateSchema.shape.subject.optional(),
    body: CreateEmailTemplateSchema.shape.body.optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.category !== undefined ||
      data.subject !== undefined ||
      data.body !== undefined,
    { message: 'Не переданы поля для обновления шаблона' }
  );

export type EmailTemplateFieldErrors = Partial<Record<'name' | 'category' | 'subject' | 'body', string>>;

export function validateEmailTemplateFields(input: {
  name: string;
  category: string;
  subject: string;
  body: string;
}):
  | { success: true; data: z.infer<typeof CreateEmailTemplateSchema>; fieldErrors: EmailTemplateFieldErrors }
  | { success: false; fieldErrors: EmailTemplateFieldErrors; message: string } {
  return extractZodFieldErrors(CreateEmailTemplateSchema, input, ['name', 'category', 'subject', 'body']);
}

export const SendDealEmailSchema = z.object({
  toEmail: z.string().trim().email('Укажите корректный email получателя'),
  subject: z.string().trim().min(2, 'Укажите тему письма (минимум 2 символа)').max(200),
  body: z.string().trim().min(2, 'Текст письма должен содержать минимум 2 символа').max(8000),
  templateId: z.string().optional().nullable(),
});

export interface DealEmailContext {
  contactName?: string | null;
  companyName?: string | null;
  dealTitle?: string;
  budget?: string;
  ownerName?: string;
  stageName?: string;
}

export function buildDealEmailContext(
  deal: {
    title: string;
    budget: number;
    currency: string;
    stageId: string;
    contactName?: string | null;
    companyName?: string | null;
    ownerName?: string;
  },
  stages: Array<{ id: string; name: string }>
): DealEmailContext {
  const stageName = stages.find((s) => s.id === deal.stageId)?.name || 'Текущий этап';
  return {
    contactName: deal.contactName || 'коллега',
    companyName: deal.companyName || 'ваша компания',
    dealTitle: deal.title,
    budget: `${deal.budget.toLocaleString('ru-RU')} ${deal.currency}`,
    ownerName: deal.ownerName || 'Менеджер CRM',
    stageName,
  };
}

export function renderEmailTemplate(templateText: string, context: DealEmailContext): string {
  const replacements: Record<string, string> = {
    contactName: context.contactName || 'коллега',
    companyName: context.companyName || 'ваша компания',
    dealTitle: context.dealTitle || 'проект',
    budget: context.budget || 'по согласованию',
    ownerName: context.ownerName || 'Менеджер CRM',
    stageName: context.stageName || 'текущий этап',
  };

  return templateText.replace(/\{\{(\w+)\}\}/g, (full, key: string) =>
    key in replacements ? replacements[key] : full
  );
}
