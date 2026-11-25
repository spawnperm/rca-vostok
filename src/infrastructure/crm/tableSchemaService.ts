import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import {
  buildDefaultCrmSchema,
  type CrmEntityTableSchema,
  type CrmEntityType,
  type CrmFieldDefinition,
  type CrmFieldSection,
  type CrmFieldType,
  type CrmTableViewConfig,
  slugifyCrmFieldKey,
} from '../../domain/crm/tableSchema.ts';
import { getDb } from '../db/client.ts';
import { crmTableSchemas } from '../db/schema.ts';

function baseSchemaRowId(tenantId: string, entityType: CrmEntityType): string {
  return `${tenantId}:${entityType}`;
}

function userViewRowId(tenantId: string, entityType: CrmEntityType, userId: string): string {
  return `${tenantId}:${entityType}:view:${userId}`;
}

function normalizeViewConfig(
  rawView: Partial<CrmTableViewConfig> | undefined,
  fields: CrmFieldDefinition[],
  fallback: CrmTableViewConfig
): CrmTableViewConfig {
  const validKeys = new Set(fields.map((f) => f.key));
  const rawOrder = Array.isArray(rawView?.columnOrder) ? rawView.columnOrder : fallback.columnOrder;
  const dedupedOrder: string[] = [];
  for (const key of rawOrder) {
    if (validKeys.has(key) && !dedupedOrder.includes(key)) {
      dedupedOrder.push(key);
    }
  }
  for (const f of fields) {
    if (!dedupedOrder.includes(f.key)) {
      dedupedOrder.push(f.key);
    }
  }

  const rawVisible = Array.isArray(rawView?.visibleColumns)
    ? rawView.visibleColumns
    : fallback.visibleColumns;
  const visibleColumns = rawVisible.filter((k, idx) => validKeys.has(k) && rawVisible.indexOf(k) === idx);

  return {
    visibleColumns: visibleColumns.length > 0 ? visibleColumns : fallback.visibleColumns.filter((k) => validKeys.has(k)),
    columnOrder: dedupedOrder,
    density:
      rawView?.density === 'compact' || rawView?.density === 'comfortable'
        ? rawView.density
        : 'normal',
    showBorders: rawView?.showBorders !== undefined ? Boolean(rawView.showBorders) : fallback.showBorders,
    showSubtitles: rawView?.showSubtitles !== undefined ? Boolean(rawView.showSubtitles) : fallback.showSubtitles,
    wrapText: rawView?.wrapText !== undefined ? Boolean(rawView.wrapText) : fallback.wrapText,
  };
}

async function getBaseSchemaRow(tenantId: string, entityType: CrmEntityType): Promise<CrmEntityTableSchema> {
  const db = await getDb();
  const rowId = baseSchemaRowId(tenantId, entityType);
  const [existing] = await db
    .select()
    .from(crmTableSchemas)
    .where(eq(crmTableSchemas.id, rowId));

  const defaults = buildDefaultCrmSchema(entityType);

  if (!existing) {
    await db.insert(crmTableSchemas).values({
      id: rowId,
      tenantId,
      entityType,
      sections: defaults.sections as unknown as Array<Record<string, unknown>>,
      fields: defaults.fields as unknown as Array<Record<string, unknown>>,
      viewConfig: defaults.viewConfig as unknown as Record<string, unknown>,
    });
    return defaults;
  }

  const sections = (existing.sections as unknown as CrmFieldSection[]) || defaults.sections;
  const fields = (existing.fields as unknown as CrmFieldDefinition[]) || defaults.fields;
  const viewConfig = normalizeViewConfig(
    existing.viewConfig as unknown as Partial<CrmTableViewConfig>,
    fields,
    defaults.viewConfig
  );

  return {
    entityType,
    sections: [...sections].sort((a, b) => a.sortOrder - b.sortOrder),
    fields: [...fields].sort((a, b) => a.sortOrder - b.sortOrder),
    viewConfig,
  };
}

export async function getCrmEntitySchema(
  tenantId: string,
  entityType: CrmEntityType,
  userId?: string
): Promise<CrmEntityTableSchema> {
  const base = await getBaseSchemaRow(tenantId, entityType);
  if (!userId) return base;

  const db = await getDb();
  const [userRow] = await db
    .select()
    .from(crmTableSchemas)
    .where(eq(crmTableSchemas.id, userViewRowId(tenantId, entityType, userId)));

  if (!userRow) return base;

  const mergedView = normalizeViewConfig(
    userRow.viewConfig as unknown as Partial<CrmTableViewConfig>,
    base.fields,
    base.viewConfig
  );
  return { ...base, viewConfig: mergedView };
}

async function persistBaseSchema(tenantId: string, schema: CrmEntityTableSchema) {
  const db = await getDb();
  const rowId = baseSchemaRowId(tenantId, schema.entityType);
  await db
    .update(crmTableSchemas)
    .set({
      sections: schema.sections as unknown as Array<Record<string, unknown>>,
      fields: schema.fields as unknown as Array<Record<string, unknown>>,
      viewConfig: schema.viewConfig as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(crmTableSchemas.id, rowId));
}

export async function addCrmSection(
  tenantId: string,
  entityType: CrmEntityType,
  title: string,
  userId?: string
): Promise<CrmEntityTableSchema> {
  const base = await getBaseSchemaRow(tenantId, entityType);
  const maxOrder = base.sections.reduce((m, s) => Math.max(m, s.sortOrder), 0);
  const newSection: CrmFieldSection = {
    id: `sec_${crypto.randomUUID().slice(0, 8)}`,
    title,
    sortOrder: maxOrder + 1,
    isSystem: false,
  };
  base.sections.push(newSection);
  await persistBaseSchema(tenantId, base);
  return getCrmEntitySchema(tenantId, entityType, userId);
}

export async function updateCrmSection(
  tenantId: string,
  entityType: CrmEntityType,
  sectionId: string,
  patch: { title?: string; sortOrder?: number },
  userId?: string
): Promise<CrmEntityTableSchema> {
  const base = await getBaseSchemaRow(tenantId, entityType);
  const target = base.sections.find((s) => s.id === sectionId);
  if (!target) {
    throw new Error('Раздел не найден');
  }
  if (patch.title !== undefined) target.title = patch.title;
  if (patch.sortOrder !== undefined) target.sortOrder = patch.sortOrder;
  base.sections.sort((a, b) => a.sortOrder - b.sortOrder);
  await persistBaseSchema(tenantId, base);
  return getCrmEntitySchema(tenantId, entityType, userId);
}

export async function deleteCrmSection(
  tenantId: string,
  entityType: CrmEntityType,
  sectionId: string,
  userId?: string
): Promise<CrmEntityTableSchema> {
  const base = await getBaseSchemaRow(tenantId, entityType);
  const target = base.sections.find((s) => s.id === sectionId);
  if (!target) throw new Error('Раздел не найден');
  if (target.isSystem) throw new Error('Системный раздел нельзя удалить');

  const fallbackSection = base.sections.find((s) => s.id !== sectionId && s.isSystem) || base.sections[0];
  if (!fallbackSection || fallbackSection.id === sectionId) {
    throw new Error('В таблице должен остаться хотя бы один раздел');
  }

  for (const field of base.fields) {
    if (field.sectionId === sectionId) {
      field.sectionId = fallbackSection.id;
    }
  }
  base.sections = base.sections.filter((s) => s.id !== sectionId);
  await persistBaseSchema(tenantId, base);
  return getCrmEntitySchema(tenantId, entityType, userId);
}

export async function addCrmField(
  tenantId: string,
  entityType: CrmEntityType,
  input: {
    label: string;
    key?: string;
    type: CrmFieldType;
    sectionId: string;
    required: boolean;
    visibleInTable: boolean;
    options: string[];
    placeholder?: string;
  },
  userId?: string
): Promise<{ schema: CrmEntityTableSchema; field: CrmFieldDefinition }> {
  const base = await getBaseSchemaRow(tenantId, entityType);
  const sectionExists = base.sections.some((s) => s.id === input.sectionId);
  if (!sectionExists) {
    throw new Error('Выбранный раздел не найден');
  }

  let candidateKey = input.key || slugifyCrmFieldKey(input.label);
  const existingKeys = new Set(base.fields.map((f) => f.key));
  while (existingKeys.has(candidateKey)) {
    candidateKey = `${candidateKey}_${crypto.randomUUID().slice(0, 3)}`;
  }

  const maxOrder = base.fields.reduce((m, f) => Math.max(m, f.sortOrder), 0);
  const newField: CrmFieldDefinition = {
    key: candidateKey,
    label: input.label,
    type: input.type,
    sectionId: input.sectionId,
    sortOrder: maxOrder + 1,
    required: input.required,
    isSystem: false,
    options: input.type === 'select' || input.type === 'multiselect' ? input.options : [],
    placeholder: input.placeholder || '',
  };

  base.fields.push(newField);
  base.viewConfig.columnOrder = [...base.viewConfig.columnOrder, newField.key];
  if (input.visibleInTable && !base.viewConfig.visibleColumns.includes(newField.key)) {
    base.viewConfig.visibleColumns = [...base.viewConfig.visibleColumns, newField.key];
  }

  await persistBaseSchema(tenantId, base);

  // If user has personal view override, append visible column for them too so they see their newly created field immediately
  if (userId) {
    const db = await getDb();
    const uRowId = userViewRowId(tenantId, entityType, userId);
    const [uRow] = await db.select().from(crmTableSchemas).where(eq(crmTableSchemas.id, uRowId));
    if (uRow) {
      const current = normalizeViewConfig(
        uRow.viewConfig as unknown as Partial<CrmTableViewConfig>,
        base.fields,
        base.viewConfig
      );
      if (input.visibleInTable && !current.visibleColumns.includes(newField.key)) {
        current.visibleColumns.push(newField.key);
      }
      await db
        .update(crmTableSchemas)
        .set({ viewConfig: current as unknown as Record<string, unknown>, updatedAt: new Date() })
        .where(eq(crmTableSchemas.id, uRowId));
    }
  }

  const schema = await getCrmEntitySchema(tenantId, entityType, userId);
  return { schema, field: newField };
}

export async function updateCrmField(
  tenantId: string,
  entityType: CrmEntityType,
  fieldKey: string,
  patch: {
    label?: string;
    type?: CrmFieldType;
    sectionId?: string;
    required?: boolean;
    sortOrder?: number;
    options?: string[];
    placeholder?: string;
  },
  userId?: string
): Promise<CrmEntityTableSchema> {
  const base = await getBaseSchemaRow(tenantId, entityType);
  const target = base.fields.find((f) => f.key === fieldKey);
  if (!target) throw new Error('Поле не найдено');

  if (patch.sectionId !== undefined) {
    if (!base.sections.some((s) => s.id === patch.sectionId)) {
      throw new Error('Раздел не найден');
    }
    target.sectionId = patch.sectionId;
  }
  if (patch.label !== undefined) target.label = patch.label;
  if (patch.type !== undefined && !target.isSystem) target.type = patch.type;
  if (patch.required !== undefined && !target.isSystem) target.required = patch.required;
  if (patch.sortOrder !== undefined) target.sortOrder = patch.sortOrder;
  if (patch.options !== undefined) target.options = patch.options;
  if (patch.placeholder !== undefined) target.placeholder = patch.placeholder;

  base.fields.sort((a, b) => a.sortOrder - b.sortOrder);
  await persistBaseSchema(tenantId, base);
  return getCrmEntitySchema(tenantId, entityType, userId);
}

export async function deleteCrmField(
  tenantId: string,
  entityType: CrmEntityType,
  fieldKey: string,
  userId?: string
): Promise<CrmEntityTableSchema> {
  const base = await getBaseSchemaRow(tenantId, entityType);
  const target = base.fields.find((f) => f.key === fieldKey);
  if (!target) throw new Error('Поле не найдено');
  if (target.isSystem) throw new Error('Системное поле нельзя удалить (можно скрыть в настройках таблицы)');

  base.fields = base.fields.filter((f) => f.key !== fieldKey);
  base.viewConfig.columnOrder = base.viewConfig.columnOrder.filter((k) => k !== fieldKey);
  base.viewConfig.visibleColumns = base.viewConfig.visibleColumns.filter((k) => k !== fieldKey);
  if (base.viewConfig.visibleColumns.length === 0 && base.fields.length > 0) {
    base.viewConfig.visibleColumns = [base.fields[0].key];
  }
  await persistBaseSchema(tenantId, base);
  return getCrmEntitySchema(tenantId, entityType, userId);
}

export async function saveCrmTableViewConfig(
  tenantId: string,
  entityType: CrmEntityType,
  userId: string,
  viewConfig: CrmTableViewConfig
): Promise<CrmEntityTableSchema> {
  const base = await getBaseSchemaRow(tenantId, entityType);
  const normalized = normalizeViewConfig(viewConfig, base.fields, base.viewConfig);
  const db = await getDb();
  const rowId = userViewRowId(tenantId, entityType, userId);

  const [existing] = await db.select().from(crmTableSchemas).where(eq(crmTableSchemas.id, rowId));
  if (existing) {
    await db
      .update(crmTableSchemas)
      .set({
        viewConfig: normalized as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(crmTableSchemas.id, rowId));
  } else {
    await db.insert(crmTableSchemas).values({
      id: rowId,
      tenantId,
      entityType: `${entityType}_view`,
      sections: [],
      fields: [],
      viewConfig: normalized as unknown as Record<string, unknown>,
    });
  }
  return { ...base, viewConfig: normalized };
}

export async function resetCrmTableViewConfig(
  tenantId: string,
  entityType: CrmEntityType,
  userId: string
): Promise<CrmEntityTableSchema> {
  const db = await getDb();
  await db.delete(crmTableSchemas).where(eq(crmTableSchemas.id, userViewRowId(tenantId, entityType, userId)));
  const defaults = buildDefaultCrmSchema(entityType);
  const base = await getBaseSchemaRow(tenantId, entityType);
  return {
    ...base,
    viewConfig: normalizeViewConfig(defaults.viewConfig, base.fields, defaults.viewConfig),
  };
}
