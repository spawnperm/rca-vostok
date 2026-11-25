import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { CreateCompanySchema, CreateContactSchema, CreateDealSchema } from '../../domain/crm/entities.ts';
import type { CrmEntityTableSchema, CrmEntityType, CrmFieldDefinition } from '../../domain/crm/tableSchema.ts';
import { getDb } from '../db/client.ts';
import { companies, contacts, deals, pipelineStages, pipelines, timelineEvents, users } from '../db/schema.ts';
import { getLatestDealAnalyses } from '../harness/deepseekHarness.ts';
import { natsBus } from '../nats/eventBus.ts';
import {
  buildCsvBuffer,
  buildXlsxBuffer,
  parseSpreadsheetBase64,
  type SpreadsheetColumn,
  type SpreadsheetFormat,
} from './spreadsheetCodec.ts';
import { getCrmEntitySchema } from './tableSchemaService.ts';

export interface ImportTargetField {
  key: string;
  label: string;
  required: boolean;
  isCustom: boolean;
  type: string;
}

export interface ImportPreviewResponse {
  dryRun: true;
  format: SpreadsheetFormat;
  headers: string[];
  totalRows: number;
  previewRows: Record<string, string>[];
  availableFields: ImportTargetField[];
  suggestedMapping: Record<string, string>;
}

export interface ImportCommitResponse {
  dryRun: false;
  format: SpreadsheetFormat;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  errors: Array<{ row: number; reason: string }>;
}

export const CrmImportContactsPayloadSchema = z.object({
  entityType: z.enum(['contacts', 'companies']),
  fileName: z.string().trim().min(1).max(200),
  format: z.enum(['csv', 'xlsx']).optional(),
  contentBase64: z.string().min(4).max(7_500_000),
  dryRun: z.boolean().default(false),
  mapping: z.record(z.string(), z.string()).optional(),
});

export const CrmImportDealsPayloadSchema = z.object({
  pipelineId: z.string().trim().min(1),
  fileName: z.string().trim().min(1).max(200),
  format: z.enum(['csv', 'xlsx']).optional(),
  contentBase64: z.string().min(4).max(7_500_000),
  dryRun: z.boolean().default(false),
  mapping: z.record(z.string(), z.string()).optional(),
});

const SYSTEM_CONTACT_EXPORT_COLUMNS = new Set([
  'fullName',
  'position',
  'companyName',
  'phone',
  'email',
  'tags',
  'dealsSummary',
]);

const SYSTEM_COMPANY_EXPORT_COLUMNS = new Set([
  'name',
  'industry',
  'website',
  'phone',
  'dealsSummary',
]);

function normalizeMatchToken(str: string): string {
  return str
    .toLowerCase()
    .replace(/[«»"'()[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitTagsOrList(raw: string): string[] {
  return raw
    .split(/[;,|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function coerceCustomFieldValue(field: CrmFieldDefinition, raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  if (field.type === 'number' || field.type === 'currency') {
    const cleaned = trimmed.replace(/\s+/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : trimmed;
  }

  if (field.type === 'checkbox') {
    const low = trimmed.toLowerCase();
    return low === 'true' || low === '1' || low === 'да' || low === 'yes' || low === '+';
  }

  if (field.type === 'multiselect') {
    return splitTagsOrList(trimmed);
  }

  return trimmed;
}

function formatFieldForExport(val: unknown): string | number | boolean {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return Number.isFinite(val) ? val : '';
  if (typeof val === 'boolean') return val ? 'Да' : 'Нет';
  if (Array.isArray(val)) return val.map(String).filter(Boolean).join(', ');
  return String(val);
}

function getContactImportFields(schema: CrmEntityTableSchema): ImportTargetField[] {
  const system: ImportTargetField[] = [
    { key: 'fullName', label: 'ФИО / Имя контакта', required: true, isCustom: false, type: 'text' },
    { key: 'phone', label: 'Телефон', required: false, isCustom: false, type: 'phone' },
    { key: 'email', label: 'Email', required: false, isCustom: false, type: 'email' },
    { key: 'position', label: 'Должность', required: false, isCustom: false, type: 'text' },
    { key: 'companyName', label: 'Компания', required: false, isCustom: false, type: 'text' },
    { key: 'tags', label: 'Теги', required: false, isCustom: false, type: 'multiselect' },
  ];
  const custom = schema.fields
    .filter((f) => !SYSTEM_CONTACT_EXPORT_COLUMNS.has(f.key) && !f.readOnly)
    .map((f) => ({
      key: `custom:${f.key}`,
      label: f.label,
      required: f.required,
      isCustom: true,
      type: f.type,
    }));
  return [...system, ...custom];
}

function getCompanyImportFields(schema: CrmEntityTableSchema): ImportTargetField[] {
  const system: ImportTargetField[] = [
    { key: 'name', label: 'Название компании', required: true, isCustom: false, type: 'text' },
    { key: 'industry', label: 'Отрасль', required: false, isCustom: false, type: 'text' },
    { key: 'website', label: 'Сайт', required: false, isCustom: false, type: 'url' },
    { key: 'phone', label: 'Телефон', required: false, isCustom: false, type: 'phone' },
  ];
  const custom = schema.fields
    .filter((f) => !SYSTEM_COMPANY_EXPORT_COLUMNS.has(f.key) && !f.readOnly)
    .map((f) => ({
      key: `custom:${f.key}`,
      label: f.label,
      required: f.required,
      isCustom: true,
      type: f.type,
    }));
  return [...system, ...custom];
}

function getDealImportFields(): ImportTargetField[] {
  return [
    { key: 'title', label: 'Название сделки', required: true, isCustom: false, type: 'text' },
    { key: 'budget', label: 'Бюджет', required: false, isCustom: false, type: 'currency' },
    { key: 'currency', label: 'Валюта (RUB/USD/EUR)', required: false, isCustom: false, type: 'select' },
    { key: 'stageName', label: 'Этап воронки', required: false, isCustom: false, type: 'text' },
    { key: 'contactName', label: 'Контакт (ФИО или Email)', required: false, isCustom: false, type: 'text' },
    { key: 'companyName', label: 'Компания', required: false, isCustom: false, type: 'text' },
    { key: 'tags', label: 'Теги', required: false, isCustom: false, type: 'multiselect' },
  ];
}

const CONTACT_HEADER_ALIASES: Record<string, string[]> = {
  fullName: ['фио', 'имя', 'контакт', 'fullname', 'full_name', 'name', 'клиент'],
  phone: ['телефон', 'тел', 'phone', 'mobile', 'моб'],
  email: ['email', 'e-mail', 'почта', 'эл. почта'],
  position: ['должность', 'роль', 'position', 'title', 'job'],
  companyName: ['компания', 'организация', 'company', 'companyname', 'company_name'],
  tags: ['теги', 'метки', 'tags', 'labels'],
};

const COMPANY_HEADER_ALIASES: Record<string, string[]> = {
  name: ['название компании', 'название', 'компания', 'организация', 'name', 'company'],
  industry: ['отрасль', 'сфера', 'индустрия', 'industry', 'sector'],
  website: ['сайт', 'веб-сайт', 'url', 'website', 'site'],
  phone: ['телефон', 'тел', 'phone'],
};

const DEAL_HEADER_ALIASES: Record<string, string[]> = {
  title: ['название сделки', 'сделка', 'название', 'title', 'deal', 'name'],
  budget: ['бюджет', 'сумма', 'стоимость', 'budget', 'amount', 'value'],
  currency: ['валюта', 'currency'],
  stageName: ['этап воронки', 'этап', 'стадия', 'stage', 'stagename', 'status'],
  contactName: ['контакт', 'клиент', 'фио', 'contact', 'contactname', 'contact email'],
  companyName: ['компания', 'организация', 'company', 'companyname'],
  tags: ['теги', 'метки', 'tags'],
};

function buildSuggestedMapping(
  headers: string[],
  fields: ImportTargetField[],
  aliases: Record<string, string[]>
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedTargets = new Set<string>();

  for (const header of headers) {
    const token = normalizeMatchToken(header);
    if (!token) continue;

    // 1. Exact label or key match
    let matched = fields.find((f) => {
      if (usedTargets.has(f.key)) return false;
      const cleanKey = f.key.replace(/^custom:/, '').toLowerCase();
      return normalizeMatchToken(f.label) === token || cleanKey === token;
    });

    // 2. Alias match
    if (!matched) {
      for (const f of fields) {
        if (usedTargets.has(f.key)) continue;
        const list = aliases[f.key] || [];
        if (list.some((alias) => token === alias || token.includes(alias))) {
          matched = f;
          break;
        }
      }
    }

    if (matched) {
      mapping[header] = matched.key;
      usedTargets.add(matched.key);
    }
  }

  return mapping;
}

export async function exportContactsOrCompanies(params: {
  tenantId: string;
  userId: string;
  entityType: CrmEntityType;
  format: SpreadsheetFormat;
  hiddenFields: string[];
  query?: string;
  templateOnly?: boolean;
}): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
  const db = await getDb();
  const hidden = new Set(params.hiddenFields);
  const schema = await getCrmEntitySchema(params.tenantId, params.entityType, params.userId);
  const q = (params.query || '').trim().toLowerCase();

  if (params.entityType === 'contacts') {
    const customFields = schema.fields.filter((f) => !SYSTEM_CONTACT_EXPORT_COLUMNS.has(f.key));
    const columns: SpreadsheetColumn[] = [
      { key: 'fullName', label: 'ФИО / Имя контакта' },
      { key: 'position', label: 'Должность' },
      { key: 'companyName', label: 'Компания' },
      { key: 'phone', label: 'Телефон' },
      { key: 'email', label: 'Email' },
      { key: 'tags', label: 'Теги' },
      ...customFields.map((f) => ({ key: `custom:${f.key}`, label: f.label })),
    ];

    if (!params.templateOnly) {
      columns.push({ key: 'dealsCount', label: 'Кол-во сделок' });
      columns.push({ key: 'dealsBudget', label: 'Бюджет сделок' });
      columns.push({ key: 'createdAt', label: 'Дата создания' });
    }

    let exportRows: Array<Record<string, unknown>>;
    if (params.templateOnly) {
      const sample: Record<string, unknown> = {
        fullName: 'Иван Петров',
        position: 'Коммерческий директор',
        companyName: 'ООО «Вектор»',
        phone: '+7 999 123-45-67',
        email: 'ivan.petrov@vector.ru',
        tags: 'Enterprise, CRM',
      };
      customFields.forEach((f) => {
        sample[`custom:${f.key}`] = f.options?.[0] || '';
      });
      exportRows = [sample];
    } else {
      const [contactRows, dealRows] = await Promise.all([
        db.select().from(contacts).where(eq(contacts.tenantId, params.tenantId)),
        db
          .select({ contactId: deals.contactId, budget: deals.budget })
          .from(deals)
          .where(eq(deals.tenantId, params.tenantId)),
      ]);

      const filtered = q
        ? contactRows.filter((c) => {
            const customValues = Object.values(c.customFields || {}).map(String).join(' ');
            return (
              c.fullName.toLowerCase().includes(q) ||
              c.email.toLowerCase().includes(q) ||
              c.phone.toLowerCase().includes(q) ||
              c.companyName.toLowerCase().includes(q) ||
              customValues.toLowerCase().includes(q)
            );
          })
        : contactRows;

      exportRows = filtered.map((c) => {
        const linked = dealRows.filter((d) => d.contactId === c.id);
        const row: Record<string, unknown> = {
          fullName: c.fullName,
          position: c.position,
          companyName: c.companyName,
          phone: hidden.has('phone') ? '' : c.phone,
          email: hidden.has('email') ? '' : c.email,
          tags: (c.tags || []).join(', '),
          dealsCount: linked.length,
          dealsBudget: hidden.has('budget') ? 0 : linked.reduce((s, d) => s + d.budget, 0),
          createdAt: new Date(c.createdAt).toISOString().slice(0, 10),
        };
        for (const f of customFields) {
          row[`custom:${f.key}`] = formatFieldForExport((c.customFields || {})[f.key]);
        }
        return row;
      });
    }

    const prefix = params.templateOnly ? 'contacts-template' : 'contacts-export';
    const fileName = `${prefix}.${params.format}`;
    const buffer =
      params.format === 'xlsx'
        ? await buildXlsxBuffer('Контакты CRM', columns, exportRows)
        : buildCsvBuffer(columns, exportRows);

    return {
      buffer,
      fileName,
      contentType:
        params.format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv; charset=utf-8',
    };
  }

  // Companies export
  const customFields = schema.fields.filter((f) => !SYSTEM_COMPANY_EXPORT_COLUMNS.has(f.key));
  const columns: SpreadsheetColumn[] = [
    { key: 'name', label: 'Название компании' },
    { key: 'industry', label: 'Отрасль' },
    { key: 'website', label: 'Сайт' },
    { key: 'phone', label: 'Телефон' },
    ...customFields.map((f) => ({ key: `custom:${f.key}`, label: f.label })),
  ];

  if (!params.templateOnly) {
    columns.push({ key: 'dealsCount', label: 'Кол-во сделок' });
    columns.push({ key: 'dealsBudget', label: 'Бюджет сделок' });
    columns.push({ key: 'createdAt', label: 'Дата создания' });
  }

  let exportRows: Array<Record<string, unknown>>;
  if (params.templateOnly) {
    const sample: Record<string, unknown> = {
      name: 'ООО «Вектор»',
      industry: 'Финтех и IT',
      website: 'https://vector.ru',
      phone: '+7 495 555-01-99',
    };
    customFields.forEach((f) => {
      sample[`custom:${f.key}`] = f.options?.[0] || '';
    });
    exportRows = [sample];
  } else {
    const [companyRows, dealRows] = await Promise.all([
      db.select().from(companies).where(eq(companies.tenantId, params.tenantId)),
      db
        .select({ companyId: deals.companyId, budget: deals.budget })
        .from(deals)
        .where(eq(deals.tenantId, params.tenantId)),
    ]);

    const filtered = q
      ? companyRows.filter((cmp) => {
          const customValues = Object.values(cmp.customFields || {}).map(String).join(' ');
          return (
            cmp.name.toLowerCase().includes(q) ||
            cmp.industry.toLowerCase().includes(q) ||
            cmp.website.toLowerCase().includes(q) ||
            customValues.toLowerCase().includes(q)
          );
        })
      : companyRows;

    exportRows = filtered.map((cmp) => {
      const linked = dealRows.filter((d) => d.companyId === cmp.id);
      const row: Record<string, unknown> = {
        name: cmp.name,
        industry: cmp.industry,
        website: cmp.website,
        phone: hidden.has('phone') ? '' : cmp.phone,
        dealsCount: linked.length,
        dealsBudget: hidden.has('budget') ? 0 : linked.reduce((s, d) => s + d.budget, 0),
        createdAt: new Date(cmp.createdAt).toISOString().slice(0, 10),
      };
      for (const f of customFields) {
        row[`custom:${f.key}`] = formatFieldForExport((cmp.customFields || {})[f.key]);
      }
      return row;
    });
  }

  const prefix = params.templateOnly ? 'companies-template' : 'companies-export';
  const fileName = `${prefix}.${params.format}`;
  const buffer =
    params.format === 'xlsx'
      ? await buildXlsxBuffer('Компании CRM', columns, exportRows)
      : buildCsvBuffer(columns, exportRows);

  return {
    buffer,
    fileName,
    contentType:
      params.format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv; charset=utf-8',
  };
}

export async function importContactsOrCompanies(params: {
  tenantId: string;
  tenantSubdomain: string;
  actorId: string;
  payload: z.infer<typeof CrmImportContactsPayloadSchema>;
}): Promise<ImportPreviewResponse | ImportCommitResponse> {
  const { tenantId, tenantSubdomain, actorId, payload } = params;
  const parsed = await parseSpreadsheetBase64(payload.fileName, payload.contentBase64, payload.format);
  const schema = await getCrmEntitySchema(tenantId, payload.entityType, actorId);
  const availableFields =
    payload.entityType === 'contacts'
      ? getContactImportFields(schema)
      : getCompanyImportFields(schema);
  const aliases =
    payload.entityType === 'contacts' ? CONTACT_HEADER_ALIASES : COMPANY_HEADER_ALIASES;
  const mapping =
    payload.mapping && Object.keys(payload.mapping).length > 0
      ? payload.mapping
      : buildSuggestedMapping(parsed.headers, availableFields, aliases);

  if (payload.dryRun) {
    return {
      dryRun: true,
      format: parsed.format,
      headers: parsed.headers,
      totalRows: parsed.rows.length,
      previewRows: parsed.rows.slice(0, 5),
      availableFields,
      suggestedMapping: mapping,
    };
  }

  const db = await getDb();
  const fieldDefMap = new Map(schema.fields.map((f) => [f.key, f]));
  const errors: Array<{ row: number; reason: string }> = [];
  let importedCount = 0;

  if (payload.entityType === 'contacts') {
    const existingCompanies = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.tenantId, tenantId));
    const companyByName = new Map(
      existingCompanies.map((c) => [c.name.trim().toLowerCase(), c])
    );

    const rowsToInsert: Array<typeof contacts.$inferInsert> = [];

    for (let i = 0; i < parsed.rows.length; i++) {
      const sourceRow = parsed.rows[i];
      const rowNum = i + 2;

      const rawInput: Record<string, unknown> = {
        fullName: '',
        phone: '',
        email: '',
        position: '',
        companyName: '',
        tags: [] as string[],
        customFields: {} as Record<string, unknown>,
      };

      for (const [header, targetKey] of Object.entries(mapping)) {
        if (!targetKey || targetKey === '__skip__') continue;
        const val = (sourceRow[header] ?? '').trim();
        if (!val) continue;

        if (targetKey.startsWith('custom:')) {
          const customKey = targetKey.slice('custom:'.length);
          const def = fieldDefMap.get(customKey);
          const customBag = rawInput.customFields as Record<string, unknown>;
          customBag[customKey] = def ? coerceCustomFieldValue(def, val) : val;
        } else if (targetKey === 'tags') {
          rawInput.tags = splitTagsOrList(val);
        } else {
          rawInput[targetKey] = val;
        }
      }

      const validated = CreateContactSchema.safeParse(rawInput);
      if (!validated.success) {
        errors.push({
          row: rowNum,
          reason: validated.error.issues[0]?.message || 'Некорректные данные контакта',
        });
        continue;
      }

      const matchedCompany = validated.data.companyName
        ? companyByName.get(validated.data.companyName.trim().toLowerCase())
        : undefined;

      rowsToInsert.push({
        id: `cnt_${crypto.randomUUID().slice(0, 10)}`,
        tenantId,
        fullName: validated.data.fullName,
        phone: validated.data.phone,
        email: validated.data.email,
        position: validated.data.position,
        companyId: matchedCompany?.id || null,
        companyName: matchedCompany?.name || validated.data.companyName,
        tags: validated.data.tags,
        customFields: validated.data.customFields || {},
      });
    }

    if (rowsToInsert.length > 0) {
      await db.insert(contacts).values(rowsToInsert);
      importedCount = rowsToInsert.length;
      await natsBus.publish(tenantId, `crm.${tenantSubdomain}.contacts.imported`, actorId, {
        importedCount,
        skippedCount: errors.length,
        fileName: payload.fileName,
      });
    }
  } else {
    const rowsToInsert: Array<typeof companies.$inferInsert> = [];

    for (let i = 0; i < parsed.rows.length; i++) {
      const sourceRow = parsed.rows[i];
      const rowNum = i + 2;

      const rawInput: Record<string, unknown> = {
        name: '',
        industry: '',
        website: '',
        phone: '',
        customFields: {} as Record<string, unknown>,
      };

      for (const [header, targetKey] of Object.entries(mapping)) {
        if (!targetKey || targetKey === '__skip__') continue;
        const val = (sourceRow[header] ?? '').trim();
        if (!val) continue;

        if (targetKey.startsWith('custom:')) {
          const customKey = targetKey.slice('custom:'.length);
          const def = fieldDefMap.get(customKey);
          const customBag = rawInput.customFields as Record<string, unknown>;
          customBag[customKey] = def ? coerceCustomFieldValue(def, val) : val;
        } else {
          rawInput[targetKey] = val;
        }
      }

      const validated = CreateCompanySchema.safeParse(rawInput);
      if (!validated.success) {
        errors.push({
          row: rowNum,
          reason: validated.error.issues[0]?.message || 'Некорректные данные компании',
        });
        continue;
      }

      rowsToInsert.push({
        id: `cmp_${crypto.randomUUID().slice(0, 10)}`,
        tenantId,
        name: validated.data.name,
        industry: validated.data.industry,
        website: validated.data.website,
        phone: validated.data.phone,
        customFields: validated.data.customFields || {},
      });
    }

    if (rowsToInsert.length > 0) {
      await db.insert(companies).values(rowsToInsert);
      importedCount = rowsToInsert.length;
      await natsBus.publish(tenantId, `crm.${tenantSubdomain}.companies.imported`, actorId, {
        importedCount,
        skippedCount: errors.length,
        fileName: payload.fileName,
      });
    }
  }

  return {
    dryRun: false,
    format: parsed.format,
    totalRows: parsed.rows.length,
    importedCount,
    skippedCount: errors.length,
    errors: errors.slice(0, 50),
  };
}

export async function exportDeals(params: {
  tenantId: string;
  userId: string;
  dataScope: 'all' | 'own';
  hiddenFields: string[];
  format: SpreadsheetFormat;
  pipelineId?: string;
  ownerId?: string;
  riskLevel?: string;
  query?: string;
  templateOnly?: boolean;
}): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
  const hidden = new Set(params.hiddenFields);

  const columns: SpreadsheetColumn[] = [
    { key: 'title', label: 'Название сделки' },
    { key: 'budget', label: 'Бюджет' },
    { key: 'currency', label: 'Валюта' },
    { key: 'stageName', label: 'Этап воронки' },
    { key: 'contactName', label: 'Контакт' },
    { key: 'companyName', label: 'Компания' },
    { key: 'tags', label: 'Теги' },
  ];

  if (!params.templateOnly) {
    columns.unshift({ key: 'id', label: 'ID сделки' });
    columns.splice(2, 0, { key: 'pipelineName', label: 'Воронка' });
    columns.push({ key: 'contactPhone', label: 'Телефон контакта' });
    columns.push({ key: 'contactEmail', label: 'Email контакта' });
    columns.push({ key: 'ownerName', label: 'Ответственный' });
    columns.push({ key: 'riskLevel', label: 'Риск Harness' });
    columns.push({ key: 'lossReason', label: 'Причина проигрыша' });
    columns.push({ key: 'createdAt', label: 'Дата создания' });
  }

  let exportRows: Array<Record<string, unknown>>;

  if (params.templateOnly) {
    exportRows = [
      {
        title: 'Внедрение корпоративного CRM-контура',
        budget: 450000,
        currency: 'RUB',
        stageName: 'Квалификация',
        contactName: 'Иван Петров',
        companyName: 'ООО «Вектор»',
        tags: 'Enterprise, B2B',
      },
    ];
  } else {
    const db = await getDb();
    const [pipRows, stageRows, dealRows, contactRows, companyRows, userRows] = await Promise.all([
      db.select().from(pipelines).where(eq(pipelines.tenantId, params.tenantId)),
      db.select().from(pipelineStages).where(eq(pipelineStages.tenantId, params.tenantId)),
      db.select().from(deals).where(eq(deals.tenantId, params.tenantId)),
      db.select().from(contacts).where(eq(contacts.tenantId, params.tenantId)),
      db.select().from(companies).where(eq(companies.tenantId, params.tenantId)),
      db
        .select({ id: users.id, fullName: users.fullName })
        .from(users)
        .where(eq(users.tenantId, params.tenantId)),
    ]);

    const analyses = await getLatestDealAnalyses(
      params.tenantId,
      dealRows.map((d) => d.id)
    );

    const pipMap = new Map(pipRows.map((p) => [p.id, p.name]));
    const stageMap = new Map(stageRows.map((s) => [s.id, s.name]));
    const contactMap = new Map(contactRows.map((c) => [c.id, c]));
    const companyMap = new Map(companyRows.map((c) => [c.id, c]));
    const userMap = new Map(userRows.map((u) => [u.id, u.fullName]));

    const q = (params.query || '').trim().toLowerCase();
    const filtered = dealRows.filter((d) => {
      if (params.dataScope === 'own' && d.ownerId !== params.userId) return false;
      if (params.pipelineId && d.pipelineId !== params.pipelineId) return false;
      if (params.ownerId && params.ownerId !== 'all' && d.ownerId !== params.ownerId) return false;
      if (
        params.riskLevel &&
        params.riskLevel !== 'all' &&
        analyses[d.id]?.riskLevel !== params.riskLevel
      ) {
        return false;
      }
      if (!q) return true;
      const contact = d.contactId ? contactMap.get(d.contactId) : undefined;
      const company = d.companyId ? companyMap.get(d.companyId) : undefined;
      return (
        d.title.toLowerCase().includes(q) ||
        (contact?.fullName || '').toLowerCase().includes(q) ||
        (company?.name || contact?.companyName || '').toLowerCase().includes(q)
      );
    });

    exportRows = filtered.map((d) => {
      const contact = d.contactId ? contactMap.get(d.contactId) : undefined;
      const company = d.companyId ? companyMap.get(d.companyId) : undefined;
      return {
        id: d.id,
        title: d.title,
        pipelineName: pipMap.get(d.pipelineId) || '',
        budget: hidden.has('budget') ? 0 : d.budget,
        currency: d.currency,
        stageName: stageMap.get(d.stageId) || '',
        contactName: contact?.fullName || '',
        companyName: company?.name || contact?.companyName || '',
        tags: (d.tags || []).join(', '),
        contactPhone: hidden.has('phone') ? '' : contact?.phone || '',
        contactEmail: hidden.has('email') ? '' : contact?.email || '',
        ownerName: userMap.get(d.ownerId) || 'Менеджер',
        riskLevel: analyses[d.id]?.riskLevel || '',
        lossReason: hidden.has('lossReason') ? '' : d.lossReason || '',
        createdAt: new Date(d.createdAt).toISOString().slice(0, 10),
      };
    });
  }

  const prefix = params.templateOnly ? 'deals-template' : 'deals-export';
  const fileName = `${prefix}.${params.format}`;
  const buffer =
    params.format === 'xlsx'
      ? await buildXlsxBuffer('Сделки CRM', columns, exportRows)
      : buildCsvBuffer(columns, exportRows);

  return {
    buffer,
    fileName,
    contentType:
      params.format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv; charset=utf-8',
  };
}

export async function importDeals(params: {
  tenantId: string;
  tenantSubdomain: string;
  actorId: string;
  payload: z.infer<typeof CrmImportDealsPayloadSchema>;
}): Promise<ImportPreviewResponse | ImportCommitResponse> {
  const { tenantId, tenantSubdomain, actorId, payload } = params;
  const db = await getDb();

  const tenantPipelines = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.tenantId, tenantId));
  const pipeline = tenantPipelines.find((p) => p.id === payload.pipelineId);
  if (!pipeline) {
    throw new Error('Выбранная воронка продаж не найдена в текущем тенанте');
  }

  const parsed = await parseSpreadsheetBase64(payload.fileName, payload.contentBase64, payload.format);
  const availableFields = getDealImportFields();
  const mapping =
    payload.mapping && Object.keys(payload.mapping).length > 0
      ? payload.mapping
      : buildSuggestedMapping(parsed.headers, availableFields, DEAL_HEADER_ALIASES);

  if (payload.dryRun) {
    return {
      dryRun: true,
      format: parsed.format,
      headers: parsed.headers,
      totalRows: parsed.rows.length,
      previewRows: parsed.rows.slice(0, 5),
      availableFields,
      suggestedMapping: mapping,
    };
  }

  const [stageRows, contactRows, companyRows] = await Promise.all([
    db.select().from(pipelineStages).where(eq(pipelineStages.tenantId, tenantId)),
    db.select().from(contacts).where(eq(contacts.tenantId, tenantId)),
    db.select().from(companies).where(eq(companies.tenantId, tenantId)),
  ]);

  const pipelineStagesList = stageRows
    .filter((s) => s.pipelineId === pipeline.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (pipelineStagesList.length === 0) {
    throw new Error('В выбранной воронке отсутствуют этапы');
  }
  const defaultStage =
    pipelineStagesList.find((s) => !s.isWon && !s.isLost) || pipelineStagesList[0];

  const stageByName = new Map(
    pipelineStagesList.map((s) => [s.name.trim().toLowerCase(), s])
  );
  const contactByKey = new Map<string, string>();
  for (const c of contactRows) {
    if (c.fullName.trim()) contactByKey.set(c.fullName.trim().toLowerCase(), c.id);
    if (c.email.trim()) contactByKey.set(c.email.trim().toLowerCase(), c.id);
  }
  const companyByName = new Map(
    companyRows.map((cmp) => [cmp.name.trim().toLowerCase(), cmp.id])
  );

  const errors: Array<{ row: number; reason: string }> = [];
  const dealInserts: Array<typeof deals.$inferInsert> = [];
  const timelineInserts: Array<typeof timelineEvents.$inferInsert> = [];

  for (let i = 0; i < parsed.rows.length; i++) {
    const sourceRow = parsed.rows[i];
    const rowNum = i + 2;

    let title = '';
    let budgetRaw: string | number = 0;
    let currencyRaw = 'RUB';
    let stageName = '';
    let contactLookup = '';
    let companyLookup = '';
    let tags: string[] = [];

    for (const [header, targetKey] of Object.entries(mapping)) {
      if (!targetKey || targetKey === '__skip__') continue;
      const val = (sourceRow[header] ?? '').trim();
      if (!val) continue;

      if (targetKey === 'title') title = val;
      else if (targetKey === 'budget') {
        const cleaned = val.replace(/\s+/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
        budgetRaw = cleaned === '' ? 0 : Number(cleaned);
      } else if (targetKey === 'currency') {
        const upper = val.toUpperCase();
        currencyRaw = upper === 'USD' || upper === 'EUR' ? upper : 'RUB';
      } else if (targetKey === 'stageName') {
        stageName = val;
      } else if (targetKey === 'contactName') {
        contactLookup = val;
      } else if (targetKey === 'companyName') {
        companyLookup = val;
      } else if (targetKey === 'tags') {
        tags = splitTagsOrList(val);
      }
    }

    const matchedStage = stageName
      ? stageByName.get(stageName.trim().toLowerCase()) || defaultStage
      : defaultStage;
    const contactId = contactLookup
      ? contactByKey.get(contactLookup.trim().toLowerCase()) || null
      : null;
    const companyId = companyLookup
      ? companyByName.get(companyLookup.trim().toLowerCase()) || null
      : null;

    const validated = CreateDealSchema.safeParse({
      title,
      budget: Number.isFinite(Number(budgetRaw)) ? Number(budgetRaw) : 0,
      currency: currencyRaw,
      pipelineId: pipeline.id,
      stageId: matchedStage.id,
      contactId,
      companyId,
      tags,
    });

    if (!validated.success) {
      errors.push({
        row: rowNum,
        reason: validated.error.issues[0]?.message || 'Некорректные данные сделки',
      });
      continue;
    }

    const dealId = `deal_${crypto.randomUUID().slice(0, 10)}`;
    dealInserts.push({
      id: dealId,
      tenantId,
      pipelineId: validated.data.pipelineId,
      stageId: validated.data.stageId,
      title: validated.data.title,
      budget: validated.data.budget,
      currency: validated.data.currency,
      contactId: validated.data.contactId || null,
      companyId: validated.data.companyId || null,
      ownerId: actorId,
      tags: validated.data.tags,
      customFields: { Источник: `Импорт (${payload.fileName})` },
    });

    timelineInserts.push({
      id: `tl_${crypto.randomUUID().slice(0, 10)}`,
      tenantId,
      dealId,
      authorId: actorId,
      type: 'note',
      body: `Сделка импортирована из файла «${payload.fileName}» (${validated.data.budget.toLocaleString('ru-RU')} ${validated.data.currency})`,
      metadata: {},
    });
  }

  let importedCount = 0;
  if (dealInserts.length > 0) {
    await db.insert(deals).values(dealInserts);
    await db.insert(timelineEvents).values(timelineInserts);
    importedCount = dealInserts.length;

    await natsBus.publish(tenantId, `crm.${tenantSubdomain}.deals.imported`, actorId, {
      pipelineId: pipeline.id,
      importedCount,
      skippedCount: errors.length,
      fileName: payload.fileName,
    });
  }

  return {
    dryRun: false,
    format: parsed.format,
    totalRows: parsed.rows.length,
    importedCount,
    skippedCount: errors.length,
    errors: errors.slice(0, 50),
  };
}
