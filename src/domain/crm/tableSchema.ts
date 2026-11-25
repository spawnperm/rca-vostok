import { z } from 'zod';

export const CrmEntityTypeSchema = z.enum(['contacts', 'companies']);
export type CrmEntityType = z.infer<typeof CrmEntityTypeSchema>;

export const CRM_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'currency',
  'phone',
  'email',
  'url',
  'date',
  'checkbox',
  'select',
  'multiselect',
] as const;

export const CrmFieldTypeSchema = z.enum(CRM_FIELD_TYPES);
export type CrmFieldType = z.infer<typeof CrmFieldTypeSchema>;

export const CRM_FIELD_TYPE_LABELS: Record<CrmFieldType, string> = {
  text: 'Текст',
  textarea: 'Текстовая область',
  number: 'Число',
  currency: 'Деньги / Бюджет (₽)',
  phone: 'Телефон',
  email: 'Email',
  url: 'Ссылка (URL)',
  date: 'Дата',
  checkbox: 'Флаг (Да / Нет)',
  select: 'Список',
  multiselect: 'Мультисписок',
};

export interface CrmFieldSection {
  id: string;
  title: string;
  sortOrder: number;
  isSystem: boolean;
}

export interface CrmFieldDefinition {
  key: string;
  label: string;
  type: CrmFieldType;
  sectionId: string;
  sortOrder: number;
  required: boolean;
  isSystem: boolean;
  readOnly?: boolean;
  options?: string[];
  placeholder?: string;
}

export interface CrmTableViewConfig {
  visibleColumns: string[];
  columnOrder: string[];
  density: 'compact' | 'normal' | 'comfortable';
  showBorders: boolean;
  showSubtitles: boolean;
  wrapText: boolean;
}

export interface CrmEntityTableSchema {
  entityType: CrmEntityType;
  sections: CrmFieldSection[];
  fields: CrmFieldDefinition[];
  viewConfig: CrmTableViewConfig;
}

export const CreateCrmSectionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Название раздела должно содержать минимум 2 символа')
    .max(64, 'Название раздела не должно превышать 64 символа'),
});

export const UpdateCrmSectionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Название раздела должно содержать минимум 2 символа')
    .max(64)
    .optional(),
  sortOrder: z.number().int().min(0).max(500).optional(),
});

export const CreateCrmFieldSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Укажите название поля')
    .max(64, 'Название поля не должно превышать 64 символа'),
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{1,48}$/, 'Ключ поля должен состоять из латинских букв, цифр и _')
    .optional(),
  type: CrmFieldTypeSchema,
  sectionId: z.string().trim().min(1, 'Выберите раздел'),
  required: z.boolean().default(false),
  visibleInTable: z.boolean().default(true),
  options: z.array(z.string().trim().min(1).max(64)).max(30).default([]),
  placeholder: z.string().trim().max(120).optional().default(''),
});

export const UpdateCrmFieldSchema = z.object({
  label: z.string().trim().min(1).max(64).optional(),
  type: CrmFieldTypeSchema.optional(),
  sectionId: z.string().trim().min(1).optional(),
  required: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(500).optional(),
  options: z.array(z.string().trim().min(1).max(64)).max(30).optional(),
  placeholder: z.string().trim().max(120).optional(),
});

export const UpdateCrmTableViewSchema = z.object({
  visibleColumns: z.array(z.string().trim().min(1).max(64)).min(1, 'Выберите хотя бы одну колонку').max(60),
  columnOrder: z.array(z.string().trim().min(1).max(64)).min(1).max(60),
  density: z.enum(['compact', 'normal', 'comfortable']).default('normal'),
  showBorders: z.boolean().default(true),
  showSubtitles: z.boolean().default(true),
  wrapText: z.boolean().default(false),
});

const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export function slugifyCrmFieldKey(label: string): string {
  const lower = label.trim().toLowerCase();
  let transliterated = '';
  for (const ch of lower) {
    if (ch in CYRILLIC_MAP) {
      transliterated += CYRILLIC_MAP[ch];
    } else if (/[a-z0-9]/.test(ch)) {
      transliterated += ch;
    } else {
      transliterated += '_';
    }
  }
  const cleaned = transliterated.replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 36);
  return `cf_${cleaned || 'field'}`;
}

export function sanitizeExternalHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return null;
  }
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function buildDefaultCrmSchema(entityType: CrmEntityType): CrmEntityTableSchema {
  if (entityType === 'contacts') {
    return {
      entityType: 'contacts',
      sections: [
        { id: 'sec_cnt_main', title: 'Основное', sortOrder: 1, isSystem: true },
        { id: 'sec_cnt_comm', title: 'Контакты и связь', sortOrder: 2, isSystem: true },
        { id: 'sec_cnt_extra', title: 'Дополнительно', sortOrder: 3, isSystem: false },
      ],
      fields: [
        { key: 'fullName', label: 'ФИО', type: 'text', sectionId: 'sec_cnt_main', sortOrder: 1, required: true, isSystem: true },
        { key: 'position', label: 'Должность', type: 'text', sectionId: 'sec_cnt_main', sortOrder: 2, required: false, isSystem: true },
        { key: 'companyName', label: 'Компания', type: 'text', sectionId: 'sec_cnt_main', sortOrder: 3, required: false, isSystem: true },
        { key: 'tags', label: 'Теги', type: 'multiselect', sectionId: 'sec_cnt_main', sortOrder: 4, required: false, isSystem: true, options: ['CRM', 'Enterprise', 'VIP', 'Партнёр', 'Лид'] },
        { key: 'cf_lpr', label: 'ЛПР', type: 'checkbox', sectionId: 'sec_cnt_main', sortOrder: 5, required: false, isSystem: false },
        { key: 'phone', label: 'Телефон', type: 'phone', sectionId: 'sec_cnt_comm', sortOrder: 6, required: false, isSystem: true },
        { key: 'email', label: 'Email', type: 'email', sectionId: 'sec_cnt_comm', sortOrder: 7, required: false, isSystem: true },
        { key: 'cf_telegram', label: 'Telegram', type: 'text', sectionId: 'sec_cnt_comm', sortOrder: 8, required: false, isSystem: false, placeholder: '@username' },
        { key: 'dealsSummary', label: 'Сделки / LTV', type: 'currency', sectionId: 'sec_cnt_extra', sortOrder: 9, required: false, isSystem: true, readOnly: true },
        { key: 'cf_source', label: 'Источник лида', type: 'select', sectionId: 'sec_cnt_extra', sortOrder: 10, required: false, isSystem: false, options: ['Сайт / Форма', 'Холодный звонок', 'Рекомендация', 'Конференция', 'Входящий запрос'] },
      ],
      viewConfig: {
        visibleColumns: ['fullName', 'companyName', 'phone', 'email', 'dealsSummary', 'cf_source', 'cf_lpr'],
        columnOrder: ['fullName', 'companyName', 'phone', 'email', 'dealsSummary', 'cf_source', 'cf_lpr', 'position', 'tags', 'cf_telegram'],
        density: 'normal',
        showBorders: true,
        showSubtitles: true,
        wrapText: false,
      },
    };
  }

  return {
    entityType: 'companies',
    sections: [
      { id: 'sec_cmp_main', title: 'Основное', sortOrder: 1, isSystem: true },
      { id: 'sec_cmp_requisites', title: 'Реквизиты и ЭДО', sortOrder: 2, isSystem: false },
    ],
    fields: [
      { key: 'name', label: 'Название компании', type: 'text', sectionId: 'sec_cmp_main', sortOrder: 1, required: true, isSystem: true },
      { key: 'industry', label: 'Отрасль', type: 'text', sectionId: 'sec_cmp_main', sortOrder: 2, required: false, isSystem: true },
      { key: 'phone', label: 'Телефон', type: 'phone', sectionId: 'sec_cmp_main', sortOrder: 3, required: false, isSystem: true },
      { key: 'website', label: 'Сайт', type: 'url', sectionId: 'sec_cmp_main', sortOrder: 4, required: false, isSystem: true },
      { key: 'dealsSummary', label: 'Сделки / Оборот', type: 'currency', sectionId: 'sec_cmp_main', sortOrder: 5, required: false, isSystem: true, readOnly: true },
      { key: 'cf_tier', label: 'Сегмент клиента', type: 'select', sectionId: 'sec_cmp_main', sortOrder: 6, required: false, isSystem: false, options: ['Enterprise', 'Mid-Market', 'SMB', 'Партнёр'] },
      { key: 'cf_inn', label: 'ИНН', type: 'text', sectionId: 'sec_cmp_requisites', sortOrder: 7, required: false, isSystem: false, placeholder: '7707083893' },
      { key: 'cf_kpp', label: 'КПП', type: 'text', sectionId: 'sec_cmp_requisites', sortOrder: 8, required: false, isSystem: false, placeholder: '773601001' },
      { key: 'cf_edo', label: 'Подключён к ЭДО', type: 'checkbox', sectionId: 'sec_cmp_requisites', sortOrder: 9, required: false, isSystem: false },
    ],
    viewConfig: {
      visibleColumns: ['name', 'industry', 'phone', 'website', 'dealsSummary', 'cf_tier', 'cf_inn'],
      columnOrder: ['name', 'industry', 'phone', 'website', 'dealsSummary', 'cf_tier', 'cf_inn', 'cf_edo', 'cf_kpp'],
      density: 'normal',
      showBorders: true,
      showSubtitles: true,
      wrapText: false,
    },
  };
}
