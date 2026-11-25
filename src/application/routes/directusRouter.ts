import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import {
  directusBiConnectorModule,
  extractDirectusContentMetadata,
  projectDirectusContentRows,
  type DirectusBiConfig,
  type DirectusIntrospectionCollectionInput,
} from '@nexus-plugins/directus-bi-connector';
import { getDb, getDatabaseEngineInfo } from '../../infrastructure/db/client.ts';
import {
  cmsBlocks,
  companies,
  contacts,
  deals,
  nocobaseCollections,
  nocobaseRecords,
  plugins,
  roles,
  socialPosts,
  tenantPlugins,
} from '../../infrastructure/db/schema.ts';
import { natsBus } from '../../infrastructure/nats/eventBus.ts';
import { requireAnyPermission, requireAuth } from '../middleware/tenantAndAuth.ts';
import type { PortalRequest } from '../middleware/tenantAndAuth.ts';
import { asyncHandler } from './routeHelpers.ts';

async function loadConnectorState(tenantId: string) {
  const db = await getDb();
  const [pluginRow] = await db
    .select()
    .from(plugins)
    .where(eq(plugins.npmPackageName, '@nexus-plugins/directus-bi-connector'))
    .limit(1);

  let pluginInstalled = false;
  let pluginEnabled = false;
  let pluginConfig: Partial<DirectusBiConfig> = {
    ...directusBiConnectorModule.defaultConfig,
  };

  if (pluginRow) {
    const [tp] = await db
      .select()
      .from(tenantPlugins)
      .where(and(eq(tenantPlugins.tenantId, tenantId), eq(tenantPlugins.pluginId, pluginRow.id)))
      .limit(1);
    if (tp) {
      pluginInstalled = true;
      pluginEnabled = tp.enabled;
      pluginConfig = {
        ...pluginConfig,
        ...(tp.config as Partial<DirectusBiConfig>),
      };
    }
  }

  if (process.env.DIRECTUS_URL) {
    pluginConfig.directusUrl = pluginConfig.directusUrl || process.env.DIRECTUS_URL;
  }

  return { pluginInstalled, pluginEnabled, pluginConfig };
}

async function buildSnapshotForRequest(req: PortalRequest) {
  const db = await getDb();
  const tenantId = req.tenant!.id;
  const hiddenFields = req.actor?.hiddenFields || [];
  const isOwnScope = req.actor?.dataScope === 'own';

  const [
    connectorState,
    cmsRows,
    nbCols,
    nbRecs,
    dealRows,
    contactRows,
    companyRows,
    postRows,
    pluginRows,
    roleRows,
  ] = await Promise.all([
    loadConnectorState(tenantId),
    db.select().from(cmsBlocks).where(eq(cmsBlocks.tenantId, tenantId)).orderBy(desc(cmsBlocks.updatedAt)),
    db.select().from(nocobaseCollections).where(eq(nocobaseCollections.tenantId, tenantId)),
    db.select().from(nocobaseRecords).where(eq(nocobaseRecords.tenantId, tenantId)),
    db.select().from(deals).where(eq(deals.tenantId, tenantId)),
    db.select().from(contacts).where(eq(contacts.tenantId, tenantId)),
    db.select().from(companies).where(eq(companies.tenantId, tenantId)),
    db.select().from(socialPosts).where(eq(socialPosts.tenantId, tenantId)),
    db.select().from(plugins),
    db.select().from(roles).where(eq(roles.tenantId, tenantId)),
  ]);

  const scopedDeals = isOwnScope
    ? dealRows.filter((d) => d.ownerId === req.actor!.userId)
    : dealRows;
  const scopedNbRecs = isOwnScope
    ? nbRecs.filter((r) => r.createdBy === req.actor!.userId)
    : nbRecs;

  const coreCollections: DirectusIntrospectionCollectionInput[] = [
    {
      collection: 'deals',
      displayName: 'Сделки CRM (amoCRM)',
      boundedContext: 'CRM (amoCRM)',
      icon: 'briefcase',
      note: 'Воронки, бюджеты, этапы и владельцы сделок',
      recordsCount: scopedDeals.length,
      schemaValidatedBy: 'Zod + Drizzle PG',
      sampleRecord: scopedDeals[0]
        ? {
            id: scopedDeals[0].id,
            title: scopedDeals[0].title,
            budget: scopedDeals[0].budget,
            currency: scopedDeals[0].currency,
            stageId: scopedDeals[0].stageId,
          }
        : undefined,
      fields: [
        { field: 'id', type: 'string', interface: 'input', required: true, readonly: true, hidden: false, note: 'ID сделки', special: ['uuid'] },
        { field: 'title', type: 'string', interface: 'input', required: true, readonly: false, hidden: false, note: 'Название сделки', special: [] },
        { field: 'budget', type: 'integer', interface: 'numeric', required: true, readonly: false, hidden: hiddenFields.includes('budget'), note: 'Бюджет сделки', special: [] },
        { field: 'currency', type: 'string', interface: 'select-dropdown', required: true, readonly: false, hidden: false, note: 'Валюта (RUB/USD/EUR)', special: [] },
        { field: 'stageId', type: 'string', interface: 'many-to-one', required: true, readonly: false, hidden: false, note: 'Этап воронки', special: [] },
      ],
    },
    {
      collection: 'contacts',
      displayName: 'Контакты (amoCRM)',
      boundedContext: 'CRM (amoCRM)',
      icon: 'users',
      note: 'Контактные лица клиентов с маскированием PII в BI',
      recordsCount: contactRows.length,
      schemaValidatedBy: 'Zod + Drizzle PG',
      sampleRecord: contactRows[0]
        ? {
            id: contactRows[0].id,
            fullName: contactRows[0].fullName,
            position: contactRows[0].position,
            companyName: contactRows[0].companyName,
            phone: contactRows[0].phone,
            email: contactRows[0].email,
          }
        : undefined,
      fields: [
        { field: 'id', type: 'string', interface: 'input', required: true, readonly: true, hidden: false, note: 'ID контакта', special: ['uuid'] },
        { field: 'fullName', type: 'string', interface: 'input', required: true, readonly: false, hidden: false, note: 'ФИО контакта', special: [] },
        { field: 'position', type: 'string', interface: 'input', required: false, readonly: false, hidden: false, note: 'Должность', special: [] },
        { field: 'companyName', type: 'string', interface: 'input', required: false, readonly: false, hidden: false, note: 'Компания', special: [] },
        { field: 'phone', type: 'string', interface: 'input', required: false, readonly: false, hidden: true, note: 'Телефон (маскируется ACL)', special: ['conceal'] },
        { field: 'email', type: 'string', interface: 'input', required: false, readonly: false, hidden: true, note: 'Email (маскируется ACL)', special: ['conceal'] },
      ],
    },
    {
      collection: 'companies',
      displayName: 'Компании (amoCRM)',
      boundedContext: 'CRM (amoCRM)',
      icon: 'building',
      note: 'Юридические лица и контрагенты тенанта',
      recordsCount: companyRows.length,
      schemaValidatedBy: 'Zod + Drizzle PG',
      sampleRecord: companyRows[0]
        ? {
            id: companyRows[0].id,
            name: companyRows[0].name,
            industry: companyRows[0].industry,
            phone: companyRows[0].phone,
          }
        : undefined,
      fields: [
        { field: 'id', type: 'string', interface: 'input', required: true, readonly: true, hidden: false, note: 'ID компании', special: ['uuid'] },
        { field: 'name', type: 'string', interface: 'input', required: true, readonly: false, hidden: false, note: 'Название компании', special: [] },
        { field: 'industry', type: 'string', interface: 'input', required: false, readonly: false, hidden: false, note: 'Отрасль', special: [] },
        { field: 'phone', type: 'string', interface: 'input', required: false, readonly: false, hidden: true, note: 'Телефон (маскируется ACL)', special: ['conceal'] },
      ],
    },
    {
      collection: 'social_posts',
      displayName: 'Лента и опросы сообщества',
      boundedContext: 'Social (BuddyBoss/VK)',
      icon: 'message-square',
      note: 'Публикации, новости и опросы портала',
      recordsCount: postRows.length,
      schemaValidatedBy: 'Zod + Drizzle PG',
      sampleRecord: postRows[0]
        ? {
            id: postRows[0].id,
            attachmentType: postRows[0].attachmentType,
            likesCount: postRows[0].likesCount,
            repostsCount: postRows[0].repostsCount,
          }
        : undefined,
      fields: [
        { field: 'id', type: 'string', interface: 'input', required: true, readonly: true, hidden: false, note: 'ID поста', special: ['uuid'] },
        { field: 'content', type: 'text', interface: 'textarea', required: true, readonly: false, hidden: false, note: 'Текст публикации', special: [] },
        { field: 'attachmentType', type: 'string', interface: 'select-dropdown', required: true, readonly: false, hidden: false, note: 'Тип вложения', special: [] },
        { field: 'likesCount', type: 'integer', interface: 'numeric', required: false, readonly: false, hidden: false, note: 'Количество лайков', special: [] },
      ],
    },
    {
      collection: 'plugins',
      displayName: 'Пакеты Verdaccio Registry',
      boundedContext: 'Marketplace (Verdaccio)',
      icon: 'package',
      note: 'Выделенные DDD-модули @nexus-plugins/*',
      recordsCount: pluginRows.length,
      schemaValidatedBy: 'Zod + Drizzle PG',
      sampleRecord: pluginRows[0]
        ? {
            id: pluginRows[0].id,
            npmPackageName: pluginRows[0].npmPackageName,
            version: pluginRows[0].version,
            downloads: pluginRows[0].downloads,
          }
        : undefined,
      fields: [
        { field: 'id', type: 'string', interface: 'input', required: true, readonly: true, hidden: false, note: 'ID плагина', special: ['uuid'] },
        { field: 'npmPackageName', type: 'string', interface: 'input', required: true, readonly: false, hidden: false, note: 'Имя npm-пакета', special: [] },
        { field: 'version', type: 'string', interface: 'input', required: true, readonly: false, hidden: false, note: 'SemVer версия', special: [] },
        { field: 'downloads', type: 'integer', interface: 'numeric', required: false, readonly: false, hidden: false, note: 'Скачивания в реестре', special: [] },
      ],
    },
    {
      collection: 'roles',
      displayName: 'Роли и политики RBAC',
      boundedContext: 'IAM (RBAC)',
      icon: 'shield',
      note: 'Матрица ролей и Data Scope ACL',
      recordsCount: roleRows.length,
      schemaValidatedBy: 'Zod + Drizzle PG',
      sampleRecord: roleRows[0]
        ? {
            id: roleRows[0].id,
            code: roleRows[0].code,
            name: roleRows[0].name,
            dataScope: roleRows[0].dataScope,
          }
        : undefined,
      fields: [
        { field: 'id', type: 'string', interface: 'input', required: true, readonly: true, hidden: false, note: 'ID роли', special: ['uuid'] },
        { field: 'code', type: 'string', interface: 'input', required: true, readonly: false, hidden: false, note: 'Код роли', special: [] },
        { field: 'name', type: 'string', interface: 'input', required: true, readonly: false, hidden: false, note: 'Отображаемое имя', special: [] },
        { field: 'dataScope', type: 'string', interface: 'select-dropdown', required: true, readonly: false, hidden: false, note: 'Область видимости (all/own)', special: [] },
      ],
    },
  ];

  const snapshot = await extractDirectusContentMetadata({
    config: connectorState.pluginConfig,
    directusToken: process.env.DIRECTUS_TOKEN,
    hiddenFields,
    enableLiveProbe: Boolean(process.env.DIRECTUS_URL && connectorState.pluginEnabled),
    cmsBlocks: cmsRows,
    nocobaseCollections: nbCols.map((c) => ({
      key: c.key,
      title: c.title,
      description: c.description,
      defaultView: c.defaultView,
      updatedAt: c.updatedAt,
      fields: (c.fields || []) as Array<{
        key: string;
        label: string;
        type: string;
        required?: boolean;
        visibleInTable?: boolean;
        formulaExpression?: string;
        relationTarget?: string;
        options?: string[];
      }>,
      recordsCount: scopedNbRecs.filter((r) => r.collectionKey === c.key).length,
    })),
    coreCollections,
  });

  return {
    snapshot,
    pluginInstalled: connectorState.pluginInstalled,
    pluginEnabled: connectorState.pluginEnabled,
  };
}

export function createDirectusRouter(): Router {
  const router = Router();

  // Backward-compatible summary list used by AdminView + enriched with connector metadata
  router.get(
    '/directus/collections',
    requireAuth,
    requireAnyPermission(['cms:edit', 'docs:read', 'tenants:admin', 'collections:read']),
    asyncHandler('Ошибка интроспекции Directus/PostgreSQL', async (req: PortalRequest, res) => {
      const { snapshot } = await buildSnapshotForRequest(req);
      res.json({
        directusEndpoint: snapshot.directusEndpoint,
        database: getDatabaseEngineInfo(),
        connectorPackage: snapshot.connectorPackage,
        connectorVersion: snapshot.connectorVersion,
        sourceMode: snapshot.sourceMode,
        summary: snapshot.summary,
        collections: snapshot.collections.map((c) => ({
          collection: c.collection,
          biCollection: c.biCollection,
          displayName: c.displayName,
          boundedContext: c.boundedContext,
          records: c.recordsCount,
          fieldsCount: c.fieldsCount,
          schemaValidatedBy: c.schemaValidatedBy,
          source: c.source,
        })),
      });
    })
  );

  // Full Directus CMS metadata & content extraction layer powered by @nexus-plugins/directus-bi-connector
  router.get(
    '/directus/metadata',
    requireAuth,
    requireAnyPermission(['collections:read', 'deals:read', 'cms:edit', 'docs:read', 'tenants:admin']),
    asyncHandler('Ошибка извлечения метаданных Directus CMS', async (req: PortalRequest, res) => {
      const { snapshot, pluginInstalled, pluginEnabled } = await buildSnapshotForRequest(req);
      res.json({
        ...snapshot,
        pluginInstalled,
        pluginEnabled,
        database: getDatabaseEngineInfo(),
      });
    })
  );

  // Per-collection BI-projected preview rows with RBAC Data Scope + ACL field redaction
  router.get(
    '/directus/metadata/:collection/preview',
    requireAuth,
    requireAnyPermission(['collections:read', 'deals:read', 'cms:edit', 'docs:read', 'tenants:admin']),
    asyncHandler('Ошибка BI-проекции коллекции Directus', async (req: PortalRequest, res) => {
      const collection = String(req.params.collection || '').trim();
      if (!/^[a-zA-Z0-9_-]{2,80}$/.test(collection)) {
        return res.status(400).json({ error: 'Некорректное имя коллекции Directus' });
      }

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const hiddenFields = req.actor?.hiddenFields || [];
      const isOwnScope = req.actor?.dataScope === 'own';

      let rows: Array<Record<string, unknown>> = [];

      if (collection === 'cms_blocks') {
        const blocks = await db
          .select()
          .from(cmsBlocks)
          .where(eq(cmsBlocks.tenantId, tenantId))
          .orderBy(desc(cmsBlocks.updatedAt))
          .limit(20);
        rows = blocks.map((b) => ({
          id: b.id,
          slug: b.slug,
          title: b.title,
          sectionType: b.sectionType,
          ctaLabel: b.ctaLabel,
          published: b.published,
          updatedAt: b.updatedAt.toISOString(),
        }));
      } else if (collection.startsWith('nb_')) {
        const nbKey = collection.slice(3);
        const recRows = await db
          .select()
          .from(nocobaseRecords)
          .where(
            and(
              eq(nocobaseRecords.tenantId, tenantId),
              eq(nocobaseRecords.collectionKey, nbKey)
            )
          )
          .limit(20);
        const scoped = isOwnScope
          ? recRows.filter((r) => r.createdBy === req.actor!.userId)
          : recRows;
        rows = scoped.map((r) => ({
          id: r.id,
          ...(r.data || {}),
          createdAt: r.createdAt.toISOString(),
        }));
      } else if (collection === 'deals') {
        const dealRows = await db.select().from(deals).where(eq(deals.tenantId, tenantId)).limit(20);
        const scoped = isOwnScope
          ? dealRows.filter((d) => d.ownerId === req.actor!.userId)
          : dealRows;
        rows = scoped.map((d) => ({
          id: d.id,
          title: d.title,
          budget: d.budget,
          currency: d.currency,
          stageId: d.stageId,
          updatedAt: d.updatedAt.toISOString(),
        }));
      } else if (collection === 'contacts') {
        const contactRows = await db
          .select()
          .from(contacts)
          .where(eq(contacts.tenantId, tenantId))
          .limit(20);
        rows = contactRows.map((c) => ({
          id: c.id,
          fullName: c.fullName,
          position: c.position,
          companyName: c.companyName,
          phone: c.phone,
          email: c.email,
        }));
      } else if (collection === 'companies') {
        const companyRows = await db
          .select()
          .from(companies)
          .where(eq(companies.tenantId, tenantId))
          .limit(20);
        rows = companyRows.map((c) => ({
          id: c.id,
          name: c.name,
          industry: c.industry,
          website: c.website,
          phone: c.phone,
        }));
      } else if (collection === 'social_posts') {
        const postRows = await db
          .select()
          .from(socialPosts)
          .where(eq(socialPosts.tenantId, tenantId))
          .limit(20);
        rows = postRows.map((p) => ({
          id: p.id,
          attachmentType: p.attachmentType,
          likesCount: p.likesCount,
          repostsCount: p.repostsCount,
          content: p.content.slice(0, 120),
        }));
      } else if (collection === 'plugins') {
        const pluginRows = await db.select().from(plugins).limit(20);
        rows = pluginRows.map((p) => ({
          id: p.id,
          npmPackageName: p.npmPackageName,
          version: p.version,
          category: p.category,
          downloads: p.downloads,
        }));
      } else if (collection === 'roles') {
        const roleRows = await db.select().from(roles).where(eq(roles.tenantId, tenantId)).limit(20);
        rows = roleRows.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          dataScope: r.dataScope,
          isSystem: r.isSystem,
        }));
      } else {
        return res.status(404).json({ error: `Коллекция «${collection}» не найдена в метаданных Directus` });
      }

      const preview = projectDirectusContentRows(collection, rows, hiddenFields);
      res.json(preview);
    })
  );

  // On-demand BI metadata projection sync & NATS domain event publish
  router.post(
    '/directus/sync',
    requireAuth,
    requireAnyPermission(['collections:manage', 'cms:edit', 'tenants:admin']),
    asyncHandler('Ошибка синхронизации метаданных Directus BI', async (req: PortalRequest, res) => {
      const { snapshot, pluginInstalled, pluginEnabled } = await buildSnapshotForRequest(req);
      await natsBus.publish(
        req.tenant!.id,
        `analytics.${req.tenant!.subdomain}.bi_projection.synced`,
        req.actor!.userId,
        {
          connectorPackage: snapshot.connectorPackage,
          sourceMode: snapshot.sourceMode,
          totalCollections: snapshot.summary.totalCollections,
          totalFields: snapshot.summary.totalFields,
          cmsBlocksTotal: snapshot.summary.cmsBlocksTotal,
        }
      );

      res.json({
        syncedAt: snapshot.extractedAt,
        pluginInstalled,
        pluginEnabled,
        snapshot,
      });
    })
  );

  return router;
}
