import { z } from 'zod';
import {
  DomainInvariantError,
  ValueObject,
  type NexusModuleDescriptor,
} from '@nexus-core/ddd-kernel';

export const DirectusBiConfigSchema = z.object({
  syncIntervalSec: z.coerce
    .number()
    .int()
    .min(5, 'Интервал синхронизации должен быть >= 5 сек')
    .max(86400)
    .default(60),
  exposeGraphQL: z.boolean().default(true),
  directusUrl: z.string().url().optional(),
  endpointUrl: z.string().url().optional(),
});

export type DirectusBiConfig = z.infer<typeof DirectusBiConfigSchema>;

export const DirectusFieldMetadataSchema = z.object({
  field: z.string(),
  type: z.string(),
  interface: z.string(),
  required: z.boolean().default(false),
  readonly: z.boolean().default(false),
  hidden: z.boolean().default(false),
  note: z.string().default(''),
  special: z.array(z.string()).default([]),
});

export type DirectusFieldMetadata = z.infer<typeof DirectusFieldMetadataSchema>;

export const DirectusCollectionMetadataSchema = z.object({
  collection: z.string(),
  biCollection: z.string(),
  displayName: z.string(),
  boundedContext: z.string(),
  icon: z.string().default('database'),
  note: z.string().default(''),
  singleton: z.boolean().default(false),
  hidden: z.boolean().default(false),
  primaryKeyField: z.string().default('id'),
  recordsCount: z.number().int().nonnegative(),
  fieldsCount: z.number().int().nonnegative(),
  schemaValidatedBy: z.string(),
  source: z.enum(['directus-live', 'cms-pg-introspection']),
  fields: z.array(DirectusFieldMetadataSchema),
  sampleProjection: z.object({
    directusCollection: z.string(),
    projectedFieldsCount: z.number().int().nonnegative(),
    redactedFieldsCount: z.number().int().nonnegative(),
    dto: z.record(z.string(), z.unknown()),
  }),
  lastUpdatedAt: z.string(),
});

export type DirectusCollectionMetadata = z.infer<typeof DirectusCollectionMetadataSchema>;

export interface DirectusCmsBlockInput {
  id: string;
  slug: string;
  title: string;
  sectionType: string;
  body: string;
  ctaLabel: string;
  published: boolean;
  updatedAt: string | Date;
}

export interface DirectusNocobaseCollectionInput {
  key: string;
  title: string;
  description: string;
  defaultView: string;
  recordsCount: number;
  updatedAt?: string | Date;
  fields: Array<{
    key: string;
    label: string;
    type: string;
    required?: boolean;
    visibleInTable?: boolean;
    formulaExpression?: string;
    relationTarget?: string;
    options?: string[];
  }>;
}

export interface DirectusIntrospectionCollectionInput {
  collection: string;
  displayName: string;
  boundedContext: string;
  icon?: string;
  note?: string;
  recordsCount: number;
  schemaValidatedBy: string;
  fields: DirectusFieldMetadata[];
  sampleRecord?: Record<string, unknown>;
  lastUpdatedAt?: string;
}

export interface DirectusContentMetadataSnapshot {
  connectorPackage: string;
  connectorVersion: string;
  sourceMode: 'directus-live' | 'cms-pg-introspection';
  directusEndpoint: string;
  graphqlEndpoint: string | null;
  syncSchedule: {
    intervalSec: number;
    exposeGraphQL: boolean;
  };
  extractedAt: string;
  summary: {
    totalCollections: number;
    totalFields: number;
    totalRecords: number;
    cmsBlocksTotal: number;
    cmsBlocksPublished: number;
    cmsBlocksDraft: number;
    sectionBreakdown: Array<{ sectionType: string; count: number; publishedCount: number }>;
  };
  collections: DirectusCollectionMetadata[];
  contentItems: Array<{
    id: string;
    slug: string;
    title: string;
    sectionType: string;
    published: boolean;
    ctaLabel: string;
    bodyPreview: string;
    updatedAt: string;
    biCollection: string;
    dto: Record<string, unknown>;
  }>;
}

export class SyncSchedule extends ValueObject<{ intervalSec: number; graphqlEnabled: boolean }> {
  private constructor(intervalSec: number, graphqlEnabled: boolean) {
    super({ intervalSec, graphqlEnabled });
  }

  static create(intervalSec: number, graphqlEnabled: boolean): SyncSchedule {
    if (!Number.isFinite(intervalSec) || intervalSec < 5) {
      throw new DomainInvariantError(
        'Минимальный интервал синхронизации Directus BI — 5 секунд',
        'INVALID_SYNC_INTERVAL',
        'analytics'
      );
    }
    return new SyncSchedule(Math.round(intervalSec), graphqlEnabled);
  }

  get intervalSec(): number {
    return this.props.intervalSec;
  }

  get graphqlEnabled(): boolean {
    return this.props.graphqlEnabled;
  }
}

export function translateInternalRecordToBiDto(
  collection: string,
  record: Record<string, unknown>,
  hiddenFields: string[] = ['passwordHash', 'phone', 'email']
) {
  const hiddenSet = new Set(hiddenFields);
  const projected: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (hiddenSet.has(k)) {
      projected[k] = '[REDACTED_ACL]';
    } else {
      projected[k] = v;
    }
  }
  return {
    directusCollection: `bi_${collection}`,
    projectedFieldsCount: Object.keys(projected).length,
    redactedFieldsCount: Object.keys(record).filter((k) => hiddenSet.has(k)).length,
    dto: projected,
  };
}

export function mapNocobaseTypeToDirectusMeta(field: {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  formulaExpression?: string;
  relationTarget?: string;
  options?: string[];
}, hiddenSet: Set<string>): DirectusFieldMetadata {
  const typeMap: Record<string, { type: string; iface: string }> = {
    string: { type: 'string', iface: 'input' },
    text: { type: 'text', iface: 'textarea' },
    number: { type: 'float', iface: 'numeric' },
    currency: { type: 'float', iface: 'numeric' },
    boolean: { type: 'boolean', iface: 'boolean' },
    date: { type: 'timestamp', iface: 'datetime' },
    select: { type: 'string', iface: 'select-dropdown' },
    relation: { type: 'string', iface: 'many-to-one' },
    formula: { type: 'float', iface: 'numeric' },
  };
  const mapped = typeMap[field.type] || { type: 'string', iface: 'input' };
  const noteParts = [field.label];
  if (field.type === 'formula' && field.formulaExpression) {
    noteParts.push(`Формула: ${field.formulaExpression}`);
  }
  if (field.type === 'relation' && field.relationTarget) {
    noteParts.push(`Связь: ${field.relationTarget}`);
  }
  if (field.type === 'select' && field.options?.length) {
    noteParts.push(`Опции: ${field.options.join(', ')}`);
  }

  return {
    field: field.key,
    type: mapped.type,
    interface: mapped.iface,
    required: Boolean(field.required),
    readonly: field.type === 'formula',
    hidden: hiddenSet.has(field.key),
    note: noteParts.join(' · '),
    special: field.type === 'formula' ? ['computed'] : [],
  };
}

export interface RawDirectusCollectionApi {
  collection: string;
  meta?: {
    icon?: string | null;
    note?: string | null;
    singleton?: boolean;
    hidden?: boolean;
    display_template?: string | null;
  } | null;
  schema?: {
    name?: string;
  } | null;
}

export interface RawDirectusFieldApi {
  collection: string;
  field: string;
  type?: string;
  meta?: {
    interface?: string | null;
    required?: boolean;
    readonly?: boolean;
    hidden?: boolean;
    note?: string | null;
    special?: string[] | null;
  } | null;
}

export function mapDirectusRawCollectionToMetadata(
  raw: RawDirectusCollectionApi,
  rawFields: RawDirectusFieldApi[],
  hiddenFields: string[] = ['passwordHash', 'phone', 'email'],
  recordsCount = 0
): DirectusCollectionMetadata {
  const hiddenSet = new Set(hiddenFields);
  const fields: DirectusFieldMetadata[] = rawFields
    .filter((f) => f.collection === raw.collection)
    .map((f) => ({
      field: f.field,
      type: f.type || 'string',
      interface: f.meta?.interface || 'input',
      required: Boolean(f.meta?.required),
      readonly: Boolean(f.meta?.readonly),
      hidden: Boolean(f.meta?.hidden) || hiddenSet.has(f.field),
      note: f.meta?.note || '',
      special: Array.isArray(f.meta?.special) ? f.meta!.special! : [],
    }));

  const sampleInput: Record<string, unknown> = {};
  for (const field of fields.slice(0, 8)) {
    sampleInput[field.field] =
      field.type === 'boolean'
        ? true
        : field.type === 'integer' || field.type === 'float'
        ? 0
        : `<${field.field}>`;
  }

  return {
    collection: raw.collection,
    biCollection: `bi_${raw.collection}`,
    displayName: raw.meta?.display_template || raw.collection,
    boundedContext: 'Directus Live CMS',
    icon: raw.meta?.icon || 'database',
    note: raw.meta?.note || 'Живая коллекция из внешнего Directus CMS API',
    singleton: Boolean(raw.meta?.singleton),
    hidden: Boolean(raw.meta?.hidden),
    primaryKeyField: fields[0]?.field || 'id',
    recordsCount,
    fieldsCount: fields.length,
    schemaValidatedBy: 'Directus /collections + /fields',
    source: 'directus-live',
    fields,
    sampleProjection: translateInternalRecordToBiDto(raw.collection, sampleInput, hiddenFields),
    lastUpdatedAt: new Date().toISOString(),
  };
}

function isAllowedDirectusProbeUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    // Block cloud metadata & link-local addresses against SSRF
    if (
      host === '169.254.169.254' ||
      host === 'metadata.google.internal' ||
      host.startsWith('169.254.') ||
      host === '0.0.0.0'
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export interface ExtractDirectusMetadataParams {
  config?: Partial<DirectusBiConfig>;
  directusToken?: string;
  hiddenFields?: string[];
  cmsBlocks?: DirectusCmsBlockInput[];
  nocobaseCollections?: DirectusNocobaseCollectionInput[];
  coreCollections?: DirectusIntrospectionCollectionInput[];
  fetchImpl?: typeof fetch;
  enableLiveProbe?: boolean;
}

export async function extractDirectusContentMetadata(
  params: ExtractDirectusMetadataParams
): Promise<DirectusContentMetadataSnapshot> {
  const parsedCfg = DirectusBiConfigSchema.parse(params.config || {});
  const schedule = SyncSchedule.create(parsedCfg.syncIntervalSec, parsedCfg.exposeGraphQL);
  const hiddenFields = [...new Set(['passwordHash', 'phone', 'email', ...(params.hiddenFields || [])])];
  const hiddenSet = new Set(hiddenFields);
  const directusEndpoint = (
    parsedCfg.directusUrl ||
    parsedCfg.endpointUrl ||
    'http://localhost:8055'
  ).replace(/\/+$/, '');

  const cmsBlocksList = params.cmsBlocks || [];
  const extractedAt = new Date().toISOString();

  let sourceMode: 'directus-live' | 'cms-pg-introspection' = 'cms-pg-introspection';
  let liveCollections: DirectusCollectionMetadata[] = [];

  if (
    params.enableLiveProbe &&
    parsedCfg.directusUrl &&
    isAllowedDirectusProbeUrl(directusEndpoint)
  ) {
    const fetcher = params.fetchImpl || fetch;
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (params.directusToken) {
        headers.Authorization = `Bearer ${params.directusToken}`;
      }
      const [colRes, fldRes] = await Promise.all([
        fetcher(`${directusEndpoint}/collections`, {
          headers,
          signal: AbortSignal.timeout(1200),
        }),
        fetcher(`${directusEndpoint}/fields`, {
          headers,
          signal: AbortSignal.timeout(1200),
        }),
      ]);
      if (colRes.ok) {
        const colJson = (await colRes.json()) as { data?: RawDirectusCollectionApi[] };
        const fldJson = fldRes.ok
          ? ((await fldRes.json()) as { data?: RawDirectusFieldApi[] })
          : { data: [] };
        const userCollections = (colJson.data || []).filter(
          (c) => !c.collection.startsWith('directus_')
        );
        if (userCollections.length > 0) {
          sourceMode = 'directus-live';
          liveCollections = userCollections.map((raw) =>
            mapDirectusRawCollectionToMetadata(raw, fldJson.data || [], hiddenFields)
          );
        }
      }
    } catch {
      // External Directus is optional; transparently fall back to local CMS/PG introspection
    }
  }

  const cmsCollectionMeta: DirectusCollectionMetadata = {
    collection: 'cms_blocks',
    biCollection: 'bi_cms_blocks',
    displayName: 'Directus / TinaCMS Контентные блоки',
    boundedContext: 'Content Management (CMS)',
    icon: 'file-text',
    note: 'Редакторские блоки портала, плейбуки продаж, объявления и сценарии онбординга',
    singleton: false,
    hidden: false,
    primaryKeyField: 'id',
    recordsCount: cmsBlocksList.length,
    fieldsCount: 8,
    schemaValidatedBy: 'Zod + Directus BI ACL',
    source: 'cms-pg-introspection',
    fields: [
      { field: 'id', type: 'string', interface: 'input', required: true, readonly: true, hidden: false, note: 'Первичный ключ блока', special: ['uuid'] },
      { field: 'slug', type: 'string', interface: 'input', required: true, readonly: false, hidden: false, note: 'URL-слаг контента', special: [] },
      { field: 'title', type: 'string', interface: 'input', required: true, readonly: false, hidden: false, note: 'Заголовок блока', special: [] },
      { field: 'sectionType', type: 'string', interface: 'select-dropdown', required: true, readonly: false, hidden: false, note: 'Тип секции (hero, playbook, onboarding, announcement, release, faq)', special: [] },
      { field: 'body', type: 'text', interface: 'textarea', required: true, readonly: false, hidden: false, note: 'Markdown / текст контента', special: [] },
      { field: 'ctaLabel', type: 'string', interface: 'input', required: false, readonly: false, hidden: false, note: 'Подпись кнопки действия', special: [] },
      { field: 'published', type: 'boolean', interface: 'boolean', required: true, readonly: false, hidden: false, note: 'Статус публикации на портале', special: [] },
      { field: 'updatedAt', type: 'timestamp', interface: 'datetime', required: true, readonly: true, hidden: false, note: 'Дата последнего обновления', special: ['date-updated'] },
    ],
    sampleProjection: translateInternalRecordToBiDto(
      'cms_blocks',
      cmsBlocksList[0]
        ? {
            id: cmsBlocksList[0].id,
            slug: cmsBlocksList[0].slug,
            title: cmsBlocksList[0].title,
            sectionType: cmsBlocksList[0].sectionType,
            ctaLabel: cmsBlocksList[0].ctaLabel,
            published: cmsBlocksList[0].published,
          }
        : { id: 'cms_sample', slug: 'enterprise-playbook', title: 'Enterprise Playbook', sectionType: 'playbook', published: true },
      hiddenFields
    ),
    lastUpdatedAt:
      cmsBlocksList[0]?.updatedAt instanceof Date
        ? cmsBlocksList[0].updatedAt.toISOString()
        : String(cmsBlocksList[0]?.updatedAt || extractedAt),
  };

  const nocobaseMetas: DirectusCollectionMetadata[] = (params.nocobaseCollections || []).map((col) => {
    const mappedFields = col.fields.map((f) => mapNocobaseTypeToDirectusMeta(f, hiddenSet));
    const sampleData: Record<string, unknown> = { collection: col.key };
    for (const f of col.fields.slice(0, 6)) {
      sampleData[f.key] =
        f.type === 'number' || f.type === 'currency' || f.type === 'formula'
          ? 0
          : f.type === 'boolean'
          ? true
          : f.label;
    }
    return {
      collection: `nb_${col.key}`,
      biCollection: `bi_nb_${col.key}`,
      displayName: col.title,
      boundedContext: 'NocoBase No-Code',
      icon: 'database',
      note: col.description || `Коллекция NocoBase (${col.defaultView})`,
      singleton: false,
      hidden: false,
      primaryKeyField: 'id',
      recordsCount: col.recordsCount,
      fieldsCount: mappedFields.length,
      schemaValidatedBy: 'NocoBase Schema + Directus BI ACL',
      source: 'cms-pg-introspection',
      fields: mappedFields,
      sampleProjection: translateInternalRecordToBiDto(`nb_${col.key}`, sampleData, hiddenFields),
      lastUpdatedAt:
        col.updatedAt instanceof Date
          ? col.updatedAt.toISOString()
          : String(col.updatedAt || extractedAt),
    };
  });

  const coreMetas: DirectusCollectionMetadata[] = (params.coreCollections || []).map((core) => ({
    collection: core.collection,
    biCollection: `bi_${core.collection}`,
    displayName: core.displayName,
    boundedContext: core.boundedContext,
    icon: core.icon || 'layers',
    note: core.note || '',
    singleton: false,
    hidden: false,
    primaryKeyField: 'id',
    recordsCount: core.recordsCount,
    fieldsCount: core.fields.length,
    schemaValidatedBy: core.schemaValidatedBy,
    source: 'cms-pg-introspection',
    fields: core.fields.map((f) => ({
      ...f,
      hidden: f.hidden || hiddenSet.has(f.field),
    })),
    sampleProjection: translateInternalRecordToBiDto(
      core.collection,
      core.sampleRecord || { id: `${core.collection}_sample` },
      hiddenFields
    ),
    lastUpdatedAt: core.lastUpdatedAt || extractedAt,
  }));

  const collections =
    sourceMode === 'directus-live'
      ? [...liveCollections, cmsCollectionMeta, ...nocobaseMetas, ...coreMetas]
      : [cmsCollectionMeta, ...nocobaseMetas, ...coreMetas];

  const sectionCounts = new Map<string, { count: number; publishedCount: number }>();
  for (const blk of cmsBlocksList) {
    const cur = sectionCounts.get(blk.sectionType) || { count: 0, publishedCount: 0 };
    cur.count += 1;
    if (blk.published) cur.publishedCount += 1;
    sectionCounts.set(blk.sectionType, cur);
  }

  const contentItems = cmsBlocksList.map((blk) => {
    const updatedIso =
      blk.updatedAt instanceof Date ? blk.updatedAt.toISOString() : String(blk.updatedAt);
    const projected = translateInternalRecordToBiDto(
      'cms_blocks',
      {
        id: blk.id,
        slug: blk.slug,
        title: blk.title,
        sectionType: blk.sectionType,
        ctaLabel: blk.ctaLabel,
        published: blk.published,
        updatedAt: updatedIso,
      },
      hiddenFields
    );
    return {
      id: blk.id,
      slug: blk.slug,
      title: blk.title,
      sectionType: blk.sectionType,
      published: blk.published,
      ctaLabel: blk.ctaLabel,
      bodyPreview: blk.body.length > 160 ? `${blk.body.slice(0, 157)}...` : blk.body,
      updatedAt: updatedIso,
      biCollection: projected.directusCollection,
      dto: projected.dto,
    };
  });

  const cmsBlocksPublished = cmsBlocksList.filter((b) => b.published).length;

  return {
    connectorPackage: '@nexus-plugins/directus-bi-connector',
    connectorVersion: '1.0.8',
    sourceMode,
    directusEndpoint,
    graphqlEndpoint: schedule.graphqlEnabled ? `${directusEndpoint}/graphql` : null,
    syncSchedule: {
      intervalSec: schedule.intervalSec,
      exposeGraphQL: schedule.graphqlEnabled,
    },
    extractedAt,
    summary: {
      totalCollections: collections.length,
      totalFields: collections.reduce((acc, c) => acc + c.fieldsCount, 0),
      totalRecords: collections.reduce((acc, c) => acc + c.recordsCount, 0),
      cmsBlocksTotal: cmsBlocksList.length,
      cmsBlocksPublished,
      cmsBlocksDraft: cmsBlocksList.length - cmsBlocksPublished,
      sectionBreakdown: [...sectionCounts.entries()].map(([sectionType, stats]) => ({
        sectionType,
        count: stats.count,
        publishedCount: stats.publishedCount,
      })),
    },
    collections,
    contentItems,
  };
}

export function projectDirectusContentRows(
  collection: string,
  rows: Array<Record<string, unknown>>,
  hiddenFields: string[] = ['passwordHash', 'phone', 'email']
) {
  const effectiveHidden = [...new Set(['passwordHash', 'phone', 'email', ...hiddenFields])];
  const projections = rows.map((row) =>
    translateInternalRecordToBiDto(collection, row, effectiveHidden)
  );
  return {
    collection,
    biCollection: `bi_${collection}`,
    totalRows: projections.length,
    hiddenFieldsApplied: effectiveHidden,
    redactedFieldsPerRow: projections[0]?.redactedFieldsCount || 0,
    items: projections.map((p) => p.dto),
  };
}

export const directusBiConnectorModule: NexusModuleDescriptor<DirectusBiConfig> = {
  packageName: '@nexus-plugins/directus-bi-connector',
  version: '1.0.8',
  title: 'Directus BI & Collection Sync',
  category: 'Integrations',
  slot: 'portal_module',
  boundedContext: 'analytics',
  contextMapping: 'Anti-Corruption Layer',
  aggregates: ['BiCollectionProjection'],
  valueObjects: ['SyncSchedule'],
  publishedEvents: ['analytics.<tenant>.bi_projection.synced'],
  subscribedSubjects: ['crm.*.deal.*', 'nocobase.*.record.*'],
  permissionsRequired: ['cms:edit'],
  configSchema: DirectusBiConfigSchema,
  defaultConfig: {
    syncIntervalSec: 60,
    exposeGraphQL: true,
  },
  runDomainPreview: (config, input) => {
    const schedule = SyncSchedule.create(config.syncIntervalSec, config.exposeGraphQL);
    const projection = translateInternalRecordToBiDto('crm_deals', {
      id: 'dl_demo_bi',
      title: String(input?.title || 'Enterprise Data Warehouse'),
      budget: Number(input?.budget ?? 1950000),
      currency: 'RUB',
      phone: '+7 999 000-11-22',
      email: 'vip@client.ru',
    });
    return {
      syncIntervalSec: schedule.intervalSec,
      exposeGraphQL: config.exposeGraphQL,
      ...projection,
    };
  },
};
