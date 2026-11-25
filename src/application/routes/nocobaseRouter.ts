import crypto from 'crypto';
import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import {
  buildN8nFromLegacyWorkflow,
  compileN8nToRuntime,
  N8nWorkflowDefinitionSchema,
  type N8nWorkflowDefinition,
} from '../../domain/n8n/workflowDefinition.ts';
import {
  applyFormulaFields,
  CollectionFieldSchema,
  type CollectionFieldDef,
  CreateApprovalSchema,
  CreateCollectionSchema,
  CreateWorkflowSchema,
  DecideApprovalSchema,
  TriggerWorkflowSchema,
  UpdateCollectionSchema,
  UpdateWorkflowSchema,
  UpsertCollectionRecordSchema,
  type WorkflowCondition,
  type WorkflowNodeDef,
  type WorkflowTriggerType,
} from '../../domain/nocobase/entities.ts';
import { getDb } from '../../infrastructure/db/client.ts';
import {
  companies,
  contacts,
  deals,
  nocobaseApprovals,
  nocobaseCollections,
  nocobaseRecords,
  nocobaseWorkflowExecutions,
  nocobaseWorkflows,
  timelineEvents,
  users,
} from '../../infrastructure/db/schema.ts';
import { natsBus } from '../../infrastructure/nats/eventBus.ts';
import {
  runSingleWorkflow,
  triggerNocobaseWorkflows,
} from '../../infrastructure/nocobase/workflowEngine.ts';
import { sanitizeCsvCell } from '../../shared/formatters.ts';
import { requireAnyPermission, requireAuth, requirePermission } from '../middleware/tenantAndAuth.ts';
import { asyncHandler, parseBody } from './routeHelpers.ts';

export function createNocobaseRouter(): Router {
  const router = Router();

  // ==========================================
  // 1. COLLECTIONS & FIELD MODELER
  // ==========================================
  router.get(
    '/nocobase/collections',
    requireAuth,
    requireAnyPermission(['collections:read', 'deals:read']),
    asyncHandler('Ошибка загрузки коллекций NocoBase', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;

      const [collectionRows, recordRows, dealRows, contactRows, companyRows] = await Promise.all([
        db
          .select()
          .from(nocobaseCollections)
          .where(eq(nocobaseCollections.tenantId, tenantId))
          .orderBy(nocobaseCollections.createdAt),
        db
          .select({
            id: nocobaseRecords.id,
            collectionKey: nocobaseRecords.collectionKey,
            createdBy: nocobaseRecords.createdBy,
          })
          .from(nocobaseRecords)
          .where(eq(nocobaseRecords.tenantId, tenantId)),
        db
          .select({ id: deals.id, title: deals.title, ownerId: deals.ownerId })
          .from(deals)
          .where(eq(deals.tenantId, tenantId)),
        db
          .select({ id: contacts.id, fullName: contacts.fullName })
          .from(contacts)
          .where(eq(contacts.tenantId, tenantId)),
        db
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(eq(companies.tenantId, tenantId)),
      ]);

      const scopedRecords =
        req.actor?.dataScope === 'own'
          ? recordRows.filter((r) => r.createdBy === req.actor!.userId)
          : recordRows;

      const collections = collectionRows.map((c) => ({
        ...c,
        fields: (c.fields || []) as unknown as CollectionFieldDef[],
        recordsCount: scopedRecords.filter((r) => r.collectionKey === c.key).length,
      }));

      res.json({
        collections,
        relationOptions: {
          deals: dealRows.map((d) => ({ id: d.id, label: d.title })),
          contacts: contactRows.map((c) => ({ id: c.id, label: c.fullName })),
          companies: companyRows.map((c) => ({ id: c.id, label: c.name })),
        },
      });
    })
  );

  router.post(
    '/nocobase/collections',
    requireAuth,
    requirePermission('collections:manage'),
    asyncHandler('Не удалось создать коллекцию', async (req, res) => {
      const data = parseBody(CreateCollectionSchema, req, res, 'Проверьте поля коллекции');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [dup] = await db
        .select({ id: nocobaseCollections.id })
        .from(nocobaseCollections)
        .where(
          and(eq(nocobaseCollections.tenantId, tenantId), eq(nocobaseCollections.key, data.key))
        );
      if (dup) {
        return res.status(409).json({ error: `Коллекция с ключом «${data.key}» уже существует` });
      }

      const [created] = await db
        .insert(nocobaseCollections)
        .values({
          id: `nb_col_${req.tenant!.subdomain}_${data.key}_${crypto.randomUUID().slice(0, 4)}`,
          tenantId,
          key: data.key,
          title: data.title,
          description: data.description,
          defaultView: data.defaultView,
          kanbanGroupBy: data.kanbanGroupBy || null,
          calendarDateField: data.calendarDateField || null,
          pinnedToDashboard: data.pinnedToDashboard,
          fields: data.fields as unknown as Array<Record<string, unknown>>,
        })
        .returning();

      await natsBus.publish(tenantId, `nocobase.${req.tenant!.subdomain}.collection.created`, req.actor!.userId, {
        key: created.key,
        title: created.title,
      });

      res.status(201).json({ collection: { ...created, recordsCount: 0 } });
    })
  );

  router.patch(
    '/nocobase/collections/:key',
    requireAuth,
    requirePermission('collections:manage'),
    asyncHandler('Ошибка обновления коллекции', async (req, res) => {
      const data = parseBody(UpdateCollectionSchema, req, res, 'Некорректные настройки коллекции');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const updatePatch: Record<string, unknown> = { updatedAt: new Date() };
      if (data.title !== undefined) updatePatch.title = data.title;
      if (data.description !== undefined) updatePatch.description = data.description;
      if (data.defaultView !== undefined) updatePatch.defaultView = data.defaultView;
      if (data.kanbanGroupBy !== undefined) updatePatch.kanbanGroupBy = data.kanbanGroupBy;
      if (data.calendarDateField !== undefined) updatePatch.calendarDateField = data.calendarDateField;
      if (data.pinnedToDashboard !== undefined) updatePatch.pinnedToDashboard = data.pinnedToDashboard;
      if (data.fields !== undefined) updatePatch.fields = data.fields;

      const [updated] = await db
        .update(nocobaseCollections)
        .set(updatePatch)
        .where(
          and(
            eq(nocobaseCollections.tenantId, tenantId),
            eq(nocobaseCollections.key, req.params.key)
          )
        )
        .returning();

      if (!updated) return res.status(404).json({ error: 'Коллекция не найдена' });
      res.json({ collection: updated });
    })
  );

  router.post(
    '/nocobase/collections/:key/fields',
    requireAuth,
    requirePermission('collections:manage'),
    asyncHandler('Не удалось добавить поле', async (req, res) => {
      const field = parseBody(CollectionFieldSchema, req, res, 'Некорректные параметры поля');
      if (!field) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [col] = await db
        .select()
        .from(nocobaseCollections)
        .where(
          and(
            eq(nocobaseCollections.tenantId, tenantId),
            eq(nocobaseCollections.key, req.params.key)
          )
        );
      if (!col) return res.status(404).json({ error: 'Коллекция не найдена' });

      const currentFields = (col.fields || []) as unknown as CollectionFieldDef[];
      if (currentFields.some((f) => f.key === field.key)) {
        return res.status(409).json({ error: `Поле с ключом «${field.key}» уже существует` });
      }

      const nextFields = [...currentFields, field];
      const [updated] = await db
        .update(nocobaseCollections)
        .set({
          fields: nextFields as unknown as Array<Record<string, unknown>>,
          updatedAt: new Date(),
        })
        .where(eq(nocobaseCollections.id, col.id))
        .returning();

      res.status(201).json({ collection: updated });
    })
  );

  router.delete(
    '/nocobase/collections/:key/fields/:fieldKey',
    requireAuth,
    requirePermission('collections:manage'),
    asyncHandler('Ошибка удаления поля', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [col] = await db
        .select()
        .from(nocobaseCollections)
        .where(
          and(
            eq(nocobaseCollections.tenantId, tenantId),
            eq(nocobaseCollections.key, req.params.key)
          )
        );
      if (!col) return res.status(404).json({ error: 'Коллекция не найдена' });

      const currentFields = (col.fields || []) as unknown as CollectionFieldDef[];
      if (currentFields.length <= 1) {
        return res.status(400).json({ error: 'В коллекции должно оставаться хотя бы одно поле' });
      }
      const nextFields = currentFields.filter((f) => f.key !== req.params.fieldKey);
      const [updated] = await db
        .update(nocobaseCollections)
        .set({
          fields: nextFields as unknown as Array<Record<string, unknown>>,
          updatedAt: new Date(),
        })
        .where(eq(nocobaseCollections.id, col.id))
        .returning();

      res.json({ collection: updated });
    })
  );

  router.delete(
    '/nocobase/collections/:key',
    requireAuth,
    requirePermission('collections:manage'),
    asyncHandler('Ошибка удаления коллекции', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const deleted = await db
        .delete(nocobaseCollections)
        .where(
          and(
            eq(nocobaseCollections.tenantId, tenantId),
            eq(nocobaseCollections.key, req.params.key)
          )
        )
        .returning();
      if (!deleted.length) return res.status(404).json({ error: 'Коллекция не найдена' });

      await db
        .delete(nocobaseRecords)
        .where(
          and(
            eq(nocobaseRecords.tenantId, tenantId),
            eq(nocobaseRecords.collectionKey, req.params.key)
          )
        );
      res.json({ deleted: true });
    })
  );

  // ==========================================
  // 2. DYNAMIC COLLECTION RECORDS & CSV EXPORT
  // ==========================================
  router.get(
    '/nocobase/collections/:key/records',
    requireAuth,
    requireAnyPermission(['collections:read', 'deals:read']),
    asyncHandler('Ошибка чтения записей коллекции', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [col] = await db
        .select()
        .from(nocobaseCollections)
        .where(
          and(
            eq(nocobaseCollections.tenantId, tenantId),
            eq(nocobaseCollections.key, req.params.key)
          )
        );
      if (!col) return res.status(404).json({ error: 'Коллекция не найдена' });

      const [rawRecords, userRows] = await Promise.all([
        db
          .select()
          .from(nocobaseRecords)
          .where(
            and(
              eq(nocobaseRecords.tenantId, tenantId),
              eq(nocobaseRecords.collectionKey, req.params.key)
            )
          )
          .orderBy(desc(nocobaseRecords.updatedAt)),
        db.select({ id: users.id, fullName: users.fullName }).from(users).where(eq(users.tenantId, tenantId)),
      ]);

      const scoped =
        req.actor?.dataScope === 'own'
          ? rawRecords.filter((r) => r.createdBy === req.actor!.userId)
          : rawRecords;

      const fields = (col.fields || []) as unknown as CollectionFieldDef[];
      const userMap = new Map(userRows.map((u) => [u.id, u.fullName]));

      const records = scoped.map((rec) => ({
        ...rec,
        data: applyFormulaFields(fields, (rec.data || {}) as Record<string, unknown>),
        createdByName: userMap.get(rec.createdBy) || rec.createdBy,
      }));

      res.json({ collection: col, records });
    })
  );

  router.post(
    '/nocobase/collections/:key/records',
    requireAuth,
    requireAnyPermission(['collections:manage', 'deals:write']),
    asyncHandler('Не удалось создать запись', async (req, res) => {
      const payload = parseBody(UpsertCollectionRecordSchema, req, res);
      if (!payload) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [col] = await db
        .select()
        .from(nocobaseCollections)
        .where(
          and(
            eq(nocobaseCollections.tenantId, tenantId),
            eq(nocobaseCollections.key, req.params.key)
          )
        );
      if (!col) return res.status(404).json({ error: 'Коллекция не найдена' });

      const fields = (col.fields || []) as unknown as CollectionFieldDef[];
      for (const field of fields) {
        if (field.required && field.type !== 'formula') {
          const v = payload.data[field.key];
          if (v === undefined || v === null || String(v).trim() === '') {
            return res.status(400).json({ error: `Заполните обязательное поле «${field.label}»` });
          }
        }
      }

      const computedData = applyFormulaFields(fields, payload.data);
      const [created] = await db
        .insert(nocobaseRecords)
        .values({
          id: `nb_rec_${crypto.randomUUID().slice(0, 8)}`,
          tenantId,
          collectionKey: col.key,
          data: computedData,
          createdBy: req.actor!.userId,
        })
        .returning();

      await natsBus.publish(tenantId, `nocobase.${req.tenant!.subdomain}.${col.key}.created`, req.actor!.userId, {
        recordId: created.id,
        collectionKey: col.key,
      });

      const triggeredExecutions = await triggerNocobaseWorkflows({
        tenantId,
        tenantSubdomain: req.tenant!.subdomain,
        actorId: req.actor!.userId,
        triggerType: 'record.created',
        collectionKey: col.key,
        record: { id: created.id, collectionKey: col.key, data: computedData },
      });

      res.status(201).json({ record: created, triggeredWorkflows: triggeredExecutions.length });
    })
  );

  router.patch(
    '/nocobase/collections/:key/records/:id',
    requireAuth,
    requireAnyPermission(['collections:manage', 'deals:write']),
    asyncHandler('Ошибка обновления записи', async (req, res) => {
      const payload = parseBody(UpsertCollectionRecordSchema, req, res);
      if (!payload) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [col] = await db
        .select()
        .from(nocobaseCollections)
        .where(
          and(
            eq(nocobaseCollections.tenantId, tenantId),
            eq(nocobaseCollections.key, req.params.key)
          )
        );
      if (!col) return res.status(404).json({ error: 'Коллекция не найдена' });

      const [existing] = await db
        .select()
        .from(nocobaseRecords)
        .where(
          and(
            eq(nocobaseRecords.id, req.params.id),
            eq(nocobaseRecords.tenantId, tenantId),
            eq(nocobaseRecords.collectionKey, req.params.key)
          )
        );
      if (!existing) return res.status(404).json({ error: 'Запись не найдена' });
      if (req.actor?.dataScope === 'own' && existing.createdBy !== req.actor.userId) {
        return res.status(403).json({ error: 'ACL Data Scope (own): нельзя изменять чужую запись' });
      }

      const fields = (col.fields || []) as unknown as CollectionFieldDef[];
      const merged = applyFormulaFields(fields, {
        ...(existing.data as Record<string, unknown>),
        ...payload.data,
      });

      const [updated] = await db
        .update(nocobaseRecords)
        .set({ data: merged, updatedAt: new Date() })
        .where(eq(nocobaseRecords.id, existing.id))
        .returning();

      res.json({ record: updated });
    })
  );

  router.delete(
    '/nocobase/collections/:key/records/:id',
    requireAuth,
    requireAnyPermission(['collections:manage', 'deals:delete']),
    asyncHandler('Ошибка удаления записи', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [existing] = await db
        .select()
        .from(nocobaseRecords)
        .where(
          and(
            eq(nocobaseRecords.id, req.params.id),
            eq(nocobaseRecords.tenantId, tenantId),
            eq(nocobaseRecords.collectionKey, req.params.key)
          )
        );
      if (!existing) return res.status(404).json({ error: 'Запись не найдена' });
      if (req.actor?.dataScope === 'own' && existing.createdBy !== req.actor.userId) {
        return res.status(403).json({ error: 'ACL Data Scope (own): нельзя удалять чужую запись' });
      }

      await db.delete(nocobaseRecords).where(eq(nocobaseRecords.id, existing.id));
      res.json({ deleted: true });
    })
  );

  router.get(
    '/nocobase/collections/:key/export.csv',
    requireAuth,
    requireAnyPermission(['collections:read', 'deals:read']),
    asyncHandler('Ошибка экспорта CSV', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [col] = await db
        .select()
        .from(nocobaseCollections)
        .where(
          and(
            eq(nocobaseCollections.tenantId, tenantId),
            eq(nocobaseCollections.key, req.params.key)
          )
        );
      if (!col) return res.status(404).json({ error: 'Коллекция не найдена' });

      const rows = await db
        .select()
        .from(nocobaseRecords)
        .where(
          and(
            eq(nocobaseRecords.tenantId, tenantId),
            eq(nocobaseRecords.collectionKey, req.params.key)
          )
        )
        .orderBy(desc(nocobaseRecords.updatedAt));

      const scoped =
        req.actor?.dataScope === 'own'
          ? rows.filter((r) => r.createdBy === req.actor!.userId)
          : rows;

      const fields = (col.fields || []) as unknown as CollectionFieldDef[];
      const header = ['id', ...fields.map((f) => f.label), 'created_at'].map(sanitizeCsvCell).join(',');
      const lines = scoped.map((r) => {
        const computed = applyFormulaFields(fields, (r.data || {}) as Record<string, unknown>);
        return [
          r.id,
          ...fields.map((f) => computed[f.key] ?? ''),
          new Date(r.createdAt).toISOString(),
        ]
          .map(sanitizeCsvCell)
          .join(',');
      });

      const csvContent = `\uFEFF${[header, ...lines].join('\r\n')}`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${col.key}-export.csv"`);
      res.send(csvContent);
    })
  );

  // ==========================================
  // 3. EVENT-DRIVEN WORKFLOWS & EXECUTION LOGS
  // ==========================================
  router.get(
    '/nocobase/workflows',
    requireAuth,
    requireAnyPermission(['workflows:read', 'harness:execute', 'deals:read']),
    asyncHandler('Ошибка загрузки процессов n8n / NocoBase', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [rawWorkflows, executions] = await Promise.all([
        db
          .select()
          .from(nocobaseWorkflows)
          .where(eq(nocobaseWorkflows.tenantId, tenantId))
          .orderBy(desc(nocobaseWorkflows.createdAt)),
        db
          .select()
          .from(nocobaseWorkflowExecutions)
          .where(eq(nocobaseWorkflowExecutions.tenantId, tenantId))
          .orderBy(desc(nocobaseWorkflowExecutions.createdAt))
          .limit(30),
      ]);

      const workflows = rawWorkflows.map((wf) => {
        const existingN8n = wf.n8nDefinition as N8nWorkflowDefinition | null;
        const n8nDefinition =
          existingN8n && Array.isArray(existingN8n.nodes) && existingN8n.nodes.length > 0
            ? { ...existingN8n, active: wf.enabled, name: wf.name }
            : buildN8nFromLegacyWorkflow({
                id: wf.id,
                name: wf.name,
                description: wf.description,
                triggerType: wf.triggerType as WorkflowTriggerType,
                triggerConfig: (wf.triggerConfig || {}) as Record<string, string>,
                condition: (wf.condition || null) as WorkflowCondition | null,
                nodes: (wf.nodes || []) as unknown as WorkflowNodeDef[],
                enabled: wf.enabled,
              });
        return {
          ...wf,
          n8nDefinition,
        };
      });

      res.json({ workflows, executions });
    })
  );

  router.get(
    '/nocobase/workflows/:id/n8n.json',
    requireAuth,
    requireAnyPermission(['workflows:read', 'harness:execute', 'deals:read']),
    asyncHandler('Ошибка экспорта n8n JSON', async (req, res) => {
      const db = await getDb();
      const [wf] = await db
        .select()
        .from(nocobaseWorkflows)
        .where(
          and(eq(nocobaseWorkflows.id, req.params.id), eq(nocobaseWorkflows.tenantId, req.tenant!.id))
        );
      if (!wf) return res.status(404).json({ error: 'Процесс не найден' });

      const existingN8n = wf.n8nDefinition as N8nWorkflowDefinition | null;
      const n8nJson =
        existingN8n && Array.isArray(existingN8n.nodes) && existingN8n.nodes.length > 0
          ? { ...existingN8n, id: wf.id, active: wf.enabled, name: wf.name }
          : buildN8nFromLegacyWorkflow({
              id: wf.id,
              name: wf.name,
              description: wf.description,
              triggerType: wf.triggerType as WorkflowTriggerType,
              triggerConfig: (wf.triggerConfig || {}) as Record<string, string>,
              condition: (wf.condition || null) as WorkflowCondition | null,
              nodes: (wf.nodes || []) as unknown as WorkflowNodeDef[],
              enabled: wf.enabled,
            });

      if (req.query.download === '1') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${wf.id}.n8n.json"`);
      }
      res.json(n8nJson);
    })
  );

  router.post(
    '/nocobase/workflows',
    requireAuth,
    requirePermission('workflows:manage'),
    asyncHandler('Не удалось создать процесс', async (req, res) => {
      const rawBody = (req.body || {}) as Record<string, unknown>;
      const maybeN8nCandidate = rawBody.n8nDefinition
        ? rawBody.n8nDefinition
        : Array.isArray(rawBody.nodes) &&
          (typeof rawBody.connections === 'object' ||
            (rawBody.nodes[0] &&
              typeof (rawBody.nodes[0] as Record<string, unknown>).typeVersion !== 'undefined') ||
            (rawBody.nodes[0] &&
              String((rawBody.nodes[0] as Record<string, unknown>).type || '').startsWith('n8n-')))
        ? rawBody
        : null;

      let compiled: {
        name: string;
        description: string;
        triggerType: WorkflowTriggerType;
        triggerConfig: Record<string, string>;
        condition: WorkflowCondition | null;
        nodes: WorkflowNodeDef[];
        enabled: boolean;
        n8nDefinition: N8nWorkflowDefinition;
      };

      if (maybeN8nCandidate) {
        const parsedN8n = N8nWorkflowDefinitionSchema.safeParse(maybeN8nCandidate);
        if (!parsedN8n.success) {
          return res.status(400).json({
            error: parsedN8n.error.issues[0]?.message || 'Некорректная n8n-схема процесса',
            issues: parsedN8n.error.issues,
          });
        }
        compiled = compileN8nToRuntime(parsedN8n.data);
      } else {
        const data = parseBody(CreateWorkflowSchema, req, res, 'Проверьте параметры процесса');
        if (!data) return;
        compiled = {
          name: data.name,
          description: data.description,
          triggerType: data.triggerType,
          triggerConfig: data.triggerConfig,
          condition: data.condition,
          nodes: data.nodes,
          enabled: data.enabled,
          n8nDefinition: buildN8nFromLegacyWorkflow(data),
        };
      }

      const id = `nb_wf_${req.tenant!.subdomain}_${crypto.randomUUID().slice(0, 6)}`;
      const n8nWithId: N8nWorkflowDefinition = {
        ...compiled.n8nDefinition,
        id,
        active: compiled.enabled,
      };

      const db = await getDb();
      const [created] = await db
        .insert(nocobaseWorkflows)
        .values({
          id,
          tenantId: req.tenant!.id,
          name: compiled.name,
          description: compiled.description,
          triggerType: compiled.triggerType,
          triggerConfig: compiled.triggerConfig,
          condition: compiled.condition,
          nodes: compiled.nodes as unknown as Array<Record<string, unknown>>,
          n8nDefinition: n8nWithId as unknown as Record<string, unknown>,
          enabled: compiled.enabled,
          runsCount: 0,
        })
        .returning();

      await natsBus.publish(
        req.tenant!.id,
        `nocobase.${req.tenant!.subdomain}.workflow.created`,
        req.actor!.userId,
        {
          workflowId: created.id,
          workflowName: created.name,
          engine: 'n8n',
          nodesCount: n8nWithId.nodes.length,
        }
      );

      res.status(201).json({ workflow: { ...created, n8nDefinition: n8nWithId } });
    })
  );

  router.patch(
    '/nocobase/workflows/:id',
    requireAuth,
    requirePermission('workflows:manage'),
    asyncHandler('Ошибка обновления процесса', async (req, res) => {
      const db = await getDb();
      const [existing] = await db
        .select()
        .from(nocobaseWorkflows)
        .where(
          and(eq(nocobaseWorkflows.id, req.params.id), eq(nocobaseWorkflows.tenantId, req.tenant!.id))
        );
      if (!existing) return res.status(404).json({ error: 'Процесс не найден' });

      const rawBody = (req.body || {}) as Record<string, unknown>;
      const patch: Record<string, unknown> = {};

      if (rawBody.n8nDefinition && typeof rawBody.n8nDefinition === 'object') {
        const parsedN8n = N8nWorkflowDefinitionSchema.safeParse(rawBody.n8nDefinition);
        if (!parsedN8n.success) {
          return res.status(400).json({
            error: parsedN8n.error.issues[0]?.message || 'Некорректная n8n-схема процесса',
            issues: parsedN8n.error.issues,
          });
        }
        const compiled = compileN8nToRuntime(parsedN8n.data);
        patch.name = compiled.name;
        patch.description = compiled.description;
        patch.triggerType = compiled.triggerType;
        patch.triggerConfig = compiled.triggerConfig;
        patch.condition = compiled.condition;
        patch.nodes = compiled.nodes;
        patch.enabled = compiled.enabled;
        patch.n8nDefinition = {
          ...compiled.n8nDefinition,
          id: existing.id,
          active: compiled.enabled,
        };
      } else {
        const data = parseBody(UpdateWorkflowSchema, req, res);
        if (!data) return;

        if (data.name !== undefined) patch.name = data.name;
        if (data.description !== undefined) patch.description = data.description;
        if (data.triggerType !== undefined) patch.triggerType = data.triggerType;
        if (data.triggerConfig !== undefined) patch.triggerConfig = data.triggerConfig;
        if (data.condition !== undefined) patch.condition = data.condition;
        if (data.nodes !== undefined) patch.nodes = data.nodes;
        if (data.enabled !== undefined) patch.enabled = data.enabled;

        const existingN8n = existing.n8nDefinition as N8nWorkflowDefinition | null;
        const shouldRebuildN8n =
          !existingN8n ||
          data.triggerType !== undefined ||
          data.triggerConfig !== undefined ||
          data.condition !== undefined ||
          data.nodes !== undefined;

        if (shouldRebuildN8n) {
          patch.n8nDefinition = buildN8nFromLegacyWorkflow({
            id: existing.id,
            name: (patch.name as string | undefined) ?? existing.name,
            description: (patch.description as string | undefined) ?? existing.description,
            triggerType: ((patch.triggerType as WorkflowTriggerType | undefined) ??
              existing.triggerType) as WorkflowTriggerType,
            triggerConfig: ((patch.triggerConfig as Record<string, string> | undefined) ??
              existing.triggerConfig) as Record<string, string>,
            condition:
              patch.condition !== undefined
                ? (patch.condition as WorkflowCondition | null)
                : ((existing.condition || null) as WorkflowCondition | null),
            nodes: ((patch.nodes as WorkflowNodeDef[] | undefined) ??
              existing.nodes) as unknown as WorkflowNodeDef[],
            enabled: (patch.enabled as boolean | undefined) ?? existing.enabled,
          });
        } else if (existingN8n) {
          patch.n8nDefinition = {
            ...existingN8n,
            name: (patch.name as string | undefined) ?? existing.name,
            active: (patch.enabled as boolean | undefined) ?? existing.enabled,
          };
        }
      }

      const [updated] = await db
        .update(nocobaseWorkflows)
        .set(patch)
        .where(
          and(eq(nocobaseWorkflows.id, req.params.id), eq(nocobaseWorkflows.tenantId, req.tenant!.id))
        )
        .returning();
      if (!updated) return res.status(404).json({ error: 'Процесс не найден' });
      res.json({ workflow: updated });
    })
  );

  router.delete(
    '/nocobase/workflows/:id',
    requireAuth,
    requirePermission('workflows:manage'),
    asyncHandler('Ошибка удаления процесса', async (req, res) => {
      const db = await getDb();
      const deleted = await db
        .delete(nocobaseWorkflows)
        .where(
          and(eq(nocobaseWorkflows.id, req.params.id), eq(nocobaseWorkflows.tenantId, req.tenant!.id))
        )
        .returning();
      if (!deleted.length) return res.status(404).json({ error: 'Процесс не найден' });
      res.json({ deleted: true });
    })
  );

  router.post(
    '/nocobase/workflows/:id/trigger',
    requireAuth,
    requireAnyPermission(['workflows:manage', 'harness:execute']),
    asyncHandler('Ошибка запуска процесса', async (req, res) => {
      const payload = parseBody(TriggerWorkflowSchema, req, res);
      if (!payload) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [wf] = await db
        .select()
        .from(nocobaseWorkflows)
        .where(and(eq(nocobaseWorkflows.id, req.params.id), eq(nocobaseWorkflows.tenantId, tenantId)));
      if (!wf) return res.status(404).json({ error: 'Процесс не найден' });

      let dealCtx;
      if (payload.dealId) {
        const [d] = await db
          .select()
          .from(deals)
          .where(and(eq(deals.id, payload.dealId), eq(deals.tenantId, tenantId)));
        if (d) {
          dealCtx = {
            id: d.id,
            title: d.title,
            budget: d.budget,
            ownerId: d.ownerId,
            stageId: d.stageId,
            stageIsWon: true,
          };
        }
      }

      let recordCtx;
      if (payload.recordId) {
        const [r] = await db
          .select()
          .from(nocobaseRecords)
          .where(and(eq(nocobaseRecords.id, payload.recordId), eq(nocobaseRecords.tenantId, tenantId)));
        if (r) {
          recordCtx = { id: r.id, collectionKey: r.collectionKey, data: r.data };
        }
      }

      // Manual run bypasses condition if user clicks "Test Run" explicitly without context
      const bypassIfBranching = !dealCtx && !recordCtx;
      const effectiveWf = bypassIfBranching ? { ...wf, condition: null } : wf;

      const execution = await runSingleWorkflow(effectiveWf, {
        tenantId,
        tenantSubdomain: req.tenant!.subdomain,
        actorId: req.actor!.userId,
        triggerType: 'manual',
        bypassIfBranching,
        deal: dealCtx,
        record: recordCtx,
      });

      res.json({
        executed: Boolean(execution),
        execution,
        reason: execution ? undefined : 'Условие ветвления процесса не выполнено для выбранной записи',
      });
    })
  );

  // ==========================================
  // 4. APPROVALS CENTER
  // ==========================================
  router.get(
    '/nocobase/approvals',
    requireAuth,
    requireAnyPermission(['workflows:read', 'deals:read']),
    asyncHandler('Ошибка загрузки согласований', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [approvalRows, userRows] = await Promise.all([
        db
          .select()
          .from(nocobaseApprovals)
          .where(eq(nocobaseApprovals.tenantId, tenantId))
          .orderBy(desc(nocobaseApprovals.createdAt)),
        db
          .select({ id: users.id, fullName: users.fullName, avatarUrl: users.avatarUrl })
          .from(users)
          .where(eq(users.tenantId, tenantId)),
      ]);

      const userMap = new Map(userRows.map((u) => [u.id, u]));
      const approvals = approvalRows.map((a) => ({
        ...a,
        requesterName: userMap.get(a.requesterId)?.fullName || a.requesterId,
        requesterAvatar: userMap.get(a.requesterId)?.avatarUrl || '',
        decidedByName: a.decidedBy ? userMap.get(a.decidedBy)?.fullName || a.decidedBy : null,
      }));

      res.json({ approvals });
    })
  );

  router.post(
    '/nocobase/approvals',
    requireAuth,
    requireAnyPermission(['workflows:read', 'deals:write']),
    asyncHandler('Не удалось создать запрос согласования', async (req, res) => {
      const data = parseBody(CreateApprovalSchema, req, res);
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [created] = await db
        .insert(nocobaseApprovals)
        .values({
          id: `nb_apr_${crypto.randomUUID().slice(0, 8)}`,
          tenantId,
          title: data.title,
          entityType: data.entityType,
          entityId: data.entityId || null,
          entityLabel: data.entityLabel,
          amount: Math.round(data.amount),
          requesterId: req.actor!.userId,
          approverRoleCode: data.approverRoleCode,
          status: 'pending',
          comment: data.comment,
        })
        .returning();

      await natsBus.publish(tenantId, `nocobase.${req.tenant!.subdomain}.approval.requested`, req.actor!.userId, {
        approvalId: created.id,
        title: created.title,
        amount: created.amount,
      });

      res.status(201).json({ approval: created });
    })
  );

  router.patch(
    '/nocobase/approvals/:id/decide',
    requireAuth,
    requireAnyPermission(['workflows:manage', 'deals:write', 'tenants:admin']),
    asyncHandler('Ошибка решения по согласованию', async (req, res) => {
      const data = parseBody(DecideApprovalSchema, req, res);
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [existing] = await db
        .select()
        .from(nocobaseApprovals)
        .where(
          and(eq(nocobaseApprovals.id, req.params.id), eq(nocobaseApprovals.tenantId, tenantId))
        );
      if (!existing) return res.status(404).json({ error: 'Запрос согласования не найден' });

      const [updated] = await db
        .update(nocobaseApprovals)
        .set({
          status: data.decision,
          decisionNote: data.decisionNote,
          decidedBy: req.actor!.userId,
          decidedAt: new Date(),
        })
        .where(eq(nocobaseApprovals.id, existing.id))
        .returning();

      if (existing.entityType === 'deal' && existing.entityId) {
        const verdict = data.decision === 'approved' ? 'Согласовано' : 'Отклонено';
        await db.insert(timelineEvents).values({
          id: `tle_${crypto.randomUUID().slice(0, 8)}`,
          tenantId,
          dealId: existing.entityId,
          authorId: req.actor!.userId,
          type: 'approval',
          body: `${verdict}: ${existing.title}${data.decisionNote ? ` (${data.decisionNote})` : ''}`,
          metadata: { approvalId: existing.id, decision: data.decision },
        });
      }

      await natsBus.publish(tenantId, `nocobase.${req.tenant!.subdomain}.approval.${data.decision}`, req.actor!.userId, {
        approvalId: existing.id,
        title: existing.title,
        decision: data.decision,
      });

      res.json({ approval: updated });
    })
  );

  return router;
}
