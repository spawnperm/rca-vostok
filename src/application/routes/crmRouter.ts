import crypto from 'crypto';
import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  AddTimelineNoteSchema,
  CreateCompanySchema,
  CreateContactSchema,
  CreateDealSchema,
  CreateEmailTemplateSchema,
  CreatePipelineSchema,
  CreateTaskSchema,
  MoveDealStageSchema,
  SendDealEmailSchema,
  UpdateCompanySchema,
  UpdateContactSchema,
  UpdateDealSchema,
  UpdateEmailTemplateSchema,
  UpdateTaskSchema,
} from '../../domain/crm/entities.ts';
import { DealAggregate } from '../../domain/crm/aggregate.ts';
import { recommendDealOwner } from '../../domain/crm/dealIntelligence.ts';
import { DomainInvariantError } from '../../domain/shared/ddd.ts';
import {
  CreateCrmFieldSchema,
  CreateCrmSectionSchema,
  CrmEntityTypeSchema,
  UpdateCrmFieldSchema,
  UpdateCrmSectionSchema,
  UpdateCrmTableViewSchema,
} from '../../domain/crm/tableSchema.ts';
import {
  CrmImportContactsPayloadSchema,
  CrmImportDealsPayloadSchema,
  exportContactsOrCompanies,
  exportDeals,
  importContactsOrCompanies,
  importDeals,
} from '../../infrastructure/crm/importExportService.ts';
import {
  addCrmField,
  addCrmSection,
  deleteCrmField,
  deleteCrmSection,
  getCrmEntitySchema,
  resetCrmTableViewConfig,
  saveCrmTableViewConfig,
  updateCrmField,
  updateCrmSection,
} from '../../infrastructure/crm/tableSchemaService.ts';
import { getDb } from '../../infrastructure/db/client.ts';
import {
  companies,
  contacts,
  deals,
  emailTemplates,
  pipelineStages,
  pipelines,
  tasks,
  timelineEvents,
  users,
} from '../../infrastructure/db/schema.ts';
import {
  analyzeDealFromContactHistory,
  analyzeTenantDealsBatch,
  getLatestDealAnalyses,
} from '../../infrastructure/harness/deepseekHarness.ts';
import {
  checkTaskDeadlinesAndReminders,
  sendManualTaskReminder,
} from '../../infrastructure/crm/taskDeadlineMonitor.ts';
import { natsBus } from '../../infrastructure/nats/eventBus.ts';
import { triggerNocobaseWorkflows } from '../../infrastructure/nocobase/workflowEngine.ts';
import { requireAuth, requirePermission } from '../middleware/tenantAndAuth.ts';
import { asyncHandler, parseBody } from './routeHelpers.ts';

export function createCrmRouter(): Router {
  const router = Router();

  // Pipelines
  router.get(
    '/crm/pipelines',
    requireAuth,
    requirePermission('deals:read'),
    asyncHandler('Ошибка загрузки воронок', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [pipRows, stageRows] = await Promise.all([
        db.select().from(pipelines).where(eq(pipelines.tenantId, tenantId)),
        db.select().from(pipelineStages).where(eq(pipelineStages.tenantId, tenantId)),
      ]);
      res.json({
        pipelines: pipRows,
        stages: [...stageRows].sort((a, b) => a.sortOrder - b.sortOrder),
      });
    })
  );

  router.post(
    '/crm/pipelines',
    requireAuth,
    requirePermission('deals:write'),
    asyncHandler('Не удалось создать воронку', async (req, res) => {
      const data = parseBody(CreatePipelineSchema, req, res);
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const pipId = `pip_${req.tenant!.subdomain}_${crypto.randomUUID().slice(0, 6)}`;

      const [pipeline] = await db
        .insert(pipelines)
        .values({ id: pipId, tenantId, name: data.name, isDefault: false })
        .returning();

      const stageTemplates = [
        { key: 'new', name: 'Новый лид', color: '#64748B', sortOrder: 1, isWon: false, isLost: false },
        { key: 'qual', name: 'Квалификация', color: '#3B82F6', sortOrder: 2, isWon: false, isLost: false },
        { key: 'offer', name: 'Коммерческое предложение', color: '#8B5CF6', sortOrder: 3, isWon: false, isLost: false },
        { key: 'won', name: 'Успешно реализовано', color: '#16A34A', sortOrder: 4, isWon: true, isLost: false },
        { key: 'lost', name: 'Закрыто и не реализовано', color: '#DC2626', sortOrder: 5, isWon: false, isLost: true },
      ];
      const createdStages = await db
        .insert(pipelineStages)
        .values(
          stageTemplates.map((st) => ({
            id: `stg_${pipId}_${st.key}`,
            tenantId,
            pipelineId: pipId,
            name: st.name,
            color: st.color,
            sortOrder: st.sortOrder,
            isWon: st.isWon,
            isLost: st.isLost,
          }))
        )
        .returning();

      res.status(201).json({ pipeline, stages: createdStages });
    })
  );

  // Deals list + batch cached analysis
  router.get(
    '/crm/deals',
    requireAuth,
    requirePermission('deals:read'),
    asyncHandler('Ошибка загрузки сделок', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [pipRows, stageRows, dealRows, contactRows, companyRows, userRows, taskRows] = await Promise.all([
        db.select().from(pipelines).where(eq(pipelines.tenantId, tenantId)),
        db.select().from(pipelineStages).where(eq(pipelineStages.tenantId, tenantId)),
        db.select().from(deals).where(eq(deals.tenantId, tenantId)).orderBy(desc(deals.updatedAt)),
        db.select().from(contacts).where(eq(contacts.tenantId, tenantId)),
        db.select().from(companies).where(eq(companies.tenantId, tenantId)),
        db
          .select({ id: users.id, fullName: users.fullName, avatarUrl: users.avatarUrl })
          .from(users)
          .where(eq(users.tenantId, tenantId)),
        db.select().from(tasks).where(eq(tasks.tenantId, tenantId)),
      ]);

      const sortedStages = [...stageRows].sort((a, b) => a.sortOrder - b.sortOrder);
      const dealIds = dealRows.map((d) => d.id);
      const cachedAnalyses = await getLatestDealAnalyses(tenantId, dealIds);

      const missingDealIds = dealIds.filter((id) => !cachedAnalyses[id]);
      if (missingDealIds.length > 0) {
        const computed = await analyzeTenantDealsBatch({
          tenantId,
          actorId: req.actor!.userId,
          dealIds: missingDealIds,
          trigger: 'auto_load',
          publishNats: false,
        });
        for (const a of computed) {
          cachedAnalyses[a.dealId] = a;
        }
      }

      const scopedDeals =
        req.actor?.dataScope === 'own'
          ? dealRows.filter((d) => d.ownerId === req.actor!.userId)
          : dealRows;
      const hiddenFields = new Set(req.actor?.hiddenFields || []);

      const nowMs = Date.now();
      const enrichedDeals = scopedDeals.map((d) => {
        const contact = contactRows.find((c) => c.id === d.contactId);
        const company = companyRows.find((c) => c.id === d.companyId);
        const owner = userRows.find((u) => u.id === d.ownerId);
        const openTasks = taskRows.filter((t) => t.dealId === d.id && !t.completed);
        const dueTimestamps = openTasks
          .map((t) => new Date(t.dueAt).getTime())
          .filter((ms) => Number.isFinite(ms));
        return {
          ...d,
          budget: hiddenFields.has('budget') ? 0 : d.budget,
          lossReason: hiddenFields.has('lossReason') ? null : d.lossReason,
          contactName: contact?.fullName || null,
          contactPhone: hiddenFields.has('phone') ? null : contact?.phone || null,
          contactEmail: hiddenFields.has('email') ? null : contact?.email || null,
          companyName: company?.name || contact?.companyName || null,
          ownerName: owner?.fullName || 'Менеджер',
          ownerAvatar: owner?.avatarUrl || '',
          openTasksCount: openTasks.length,
          hasOverdueTask: openTasks.some((t) => new Date(t.dueAt).getTime() < nowMs),
          nextTaskDueAt: dueTimestamps.length > 0 ? new Date(Math.min(...dueTimestamps)).toISOString() : null,
          harnessAnalysis: cachedAnalyses[d.id] || null,
        };
      });

      res.json({
        pipelines: pipRows,
        stages: sortedStages,
        deals: enrichedDeals,
        contacts: contactRows,
        companies: companyRows,
        owners: userRows,
      });
    })
  );

  router.post(
    '/crm/deals',
    requireAuth,
    requirePermission('deals:write'),
    asyncHandler('Не удалось создать сделку', async (req, res) => {
      const data = parseBody(CreateDealSchema, req, res, 'Ошибка валидации сделки');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;

      const [stage] = await db
        .select()
        .from(pipelineStages)
        .where(
          and(
            eq(pipelineStages.id, data.stageId),
            eq(pipelineStages.pipelineId, data.pipelineId),
            eq(pipelineStages.tenantId, tenantId)
          )
        );
      if (!stage) {
        return res.status(400).json({ error: 'Указанный этап не принадлежит воронке тенанта' });
      }

      if (data.contactId) {
        const [cnt] = await db
          .select({ id: contacts.id })
          .from(contacts)
          .where(and(eq(contacts.id, data.contactId), eq(contacts.tenantId, tenantId)));
        if (!cnt) return res.status(400).json({ error: 'Контакт не найден в текущем тенанте' });
      }

      if (data.companyId) {
        const [cmp] = await db
          .select({ id: companies.id })
          .from(companies)
          .where(and(eq(companies.id, data.companyId), eq(companies.tenantId, tenantId)));
        if (!cmp) return res.status(400).json({ error: 'Компания не найдена в текущем тенанте' });
      }

      const dealId = `deal_${crypto.randomUUID().slice(0, 10)}`;
      let dealAggregate: DealAggregate;
      try {
        dealAggregate = DealAggregate.createNew({
          id: dealId,
          tenantId,
          subdomain: req.tenant!.subdomain,
          pipelineId: data.pipelineId,
          stage: {
            id: stage.id,
            pipelineId: stage.pipelineId,
            name: stage.name,
            isWon: stage.isWon,
            isLost: stage.isLost,
          },
          title: data.title,
          budget: data.budget,
          currency: data.currency,
          contactId: data.contactId || null,
          companyId: data.companyId || null,
          ownerId: req.actor!.userId,
          tags: data.tags,
          customFields: data.customFields || { Источник: 'amoCRM Ручной ввод' },
        });
      } catch (err: unknown) {
        if (err instanceof DomainInvariantError) {
          return res.status(400).json({ error: err.message, code: err.code });
        }
        throw err;
      }

      const [created] = await db
        .insert(deals)
        .values(dealAggregate.state)
        .returning();

      await db.insert(timelineEvents).values({
        id: `tl_${crypto.randomUUID().slice(0, 10)}`,
        tenantId,
        dealId,
        authorId: req.actor!.userId,
        type: 'note',
        body: `Сделка создана на сумму ${data.budget.toLocaleString('ru-RU')} ${data.currency}`,
        metadata: {},
      });

      for (const domainEvt of dealAggregate.pullDomainEvents()) {
        await natsBus.publish(tenantId, domainEvt.subject, req.actor!.userId, domainEvt.payload);
      }

      const harnessAnalysis = await analyzeDealFromContactHistory({
        tenantId,
        dealId,
        actorId: req.actor!.userId,
        trigger: 'deal_created',
        writeTimelineInsight: true,
      });

      const workflowExecutions = await triggerNocobaseWorkflows({
        tenantId,
        tenantSubdomain: req.tenant!.subdomain,
        actorId: req.actor!.userId,
        triggerType: 'deal.created',
        deal: {
          id: created.id,
          title: created.title,
          budget: created.budget,
          ownerId: created.ownerId,
          stageId: created.stageId,
          stageName: stage.name,
          stageIsWon: stage.isWon,
        },
      });

      res.status(201).json({
        deal: created,
        harnessAnalysis,
        triggeredWorkflows: workflowExecutions.length,
      });
    })
  );

  // Deals Export & Import (CSV / Excel .xlsx)
  router.get(
    '/crm/deals/export',
    requireAuth,
    requirePermission('deals:read'),
    asyncHandler('Ошибка экспорта сделок', async (req, res) => {
      const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
      const pipelineId = typeof req.query.pipelineId === 'string' ? req.query.pipelineId : undefined;
      const ownerId = typeof req.query.ownerId === 'string' ? req.query.ownerId : undefined;
      const riskLevel = typeof req.query.riskLevel === 'string' ? req.query.riskLevel : undefined;
      const query = typeof req.query.q === 'string' ? req.query.q : undefined;
      const templateOnly = req.query.template === '1' || req.query.template === 'true';

      const result = await exportDeals({
        tenantId: req.tenant!.id,
        userId: req.actor!.userId,
        dataScope: req.actor?.dataScope || 'all',
        hiddenFields: req.actor?.hiddenFields || [],
        format,
        pipelineId,
        ownerId,
        riskLevel,
        query,
        templateOnly,
      });

      res.setHeader('Content-Type', result.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`
      );
      res.send(result.buffer);
    })
  );

  router.post(
    '/crm/deals/import',
    requireAuth,
    requirePermission('deals:write'),
    asyncHandler('Ошибка импорта сделок', async (req, res) => {
      const data = parseBody(CrmImportDealsPayloadSchema, req, res, 'Некорректные параметры импорта сделок');
      if (!data) return;

      try {
        const result = await importDeals({
          tenantId: req.tenant!.id,
          tenantSubdomain: req.tenant!.subdomain,
          actorId: req.actor!.userId,
          payload: data,
        });
        res.status(data.dryRun ? 200 : 201).json(result);
      } catch (err: unknown) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка разбора файла сделок' });
      }
    })
  );

  router.patch(
    '/crm/deals/:id',
    requireAuth,
    requirePermission('deals:write'),
    asyncHandler('Ошибка обновления сделки', async (req, res) => {
      const data = parseBody(UpdateDealSchema, req, res, 'Некорректные поля сделки');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [existing] = await db
        .select()
        .from(deals)
        .where(and(eq(deals.id, req.params.id), eq(deals.tenantId, tenantId)));

      if (!existing) return res.status(404).json({ error: 'Сделка не найдена' });
      if (req.actor?.dataScope === 'own' && existing.ownerId !== req.actor.userId) {
        return res.status(403).json({ error: 'ACL Data Scope (own): нельзя изменять чужую сделку' });
      }

      let nextStageName: string | null = null;
      if (data.stageId && data.stageId !== existing.stageId) {
        const [stage] = await db
          .select()
          .from(pipelineStages)
          .where(and(eq(pipelineStages.id, data.stageId), eq(pipelineStages.tenantId, tenantId)));
        if (!stage) return res.status(400).json({ error: 'Этап воронки не найден в тенанте' });
        nextStageName = stage.name;
      }

      if (data.contactId) {
        const [cnt] = await db
          .select({ id: contacts.id })
          .from(contacts)
          .where(and(eq(contacts.id, data.contactId), eq(contacts.tenantId, tenantId)));
        if (!cnt) return res.status(400).json({ error: 'Контакт не найден в тенанте' });
      }

      if (data.companyId) {
        const [cmp] = await db
          .select({ id: companies.id })
          .from(companies)
          .where(and(eq(companies.id, data.companyId), eq(companies.tenantId, tenantId)));
        if (!cmp) return res.status(400).json({ error: 'Компания не найдена в тенанте' });
      }

      let nextOwnerName: string | null = null;
      if (data.ownerId) {
        const [owner] = await db
          .select({ id: users.id, fullName: users.fullName })
          .from(users)
          .where(and(eq(users.id, data.ownerId), eq(users.tenantId, tenantId)));
        if (!owner) return res.status(400).json({ error: 'Ответственный не найден в тенанте' });
        if (data.ownerId !== existing.ownerId) {
          nextOwnerName = owner.fullName;
        }
      }

      const prevPriority =
        existing.customFields && typeof existing.customFields === 'object'
          ? (existing.customFields as Record<string, unknown>).priority
          : undefined;
      const nextPriority =
        data.customFields && typeof data.customFields === 'object'
          ? data.customFields.priority
          : undefined;
      const priorityChanged =
        typeof nextPriority === 'string' && nextPriority.length > 0 && nextPriority !== prevPriority;

      const [updated] = await db
        .update(deals)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(deals.id, req.params.id), eq(deals.tenantId, tenantId)))
        .returning();

      if (nextStageName) {
        await db.insert(timelineEvents).values({
          id: `tl_${crypto.randomUUID().slice(0, 10)}`,
          tenantId,
          dealId: updated.id,
          authorId: req.actor!.userId,
          type: 'stage_change',
          body: `Этап изменен на «${nextStageName}»`,
          metadata: { stageId: updated.stageId, stageName: nextStageName },
        });
      }

      if (nextOwnerName) {
        await db.insert(timelineEvents).values({
          id: `tl_${crypto.randomUUID().slice(0, 10)}`,
          tenantId,
          dealId: updated.id,
          authorId: req.actor!.userId,
          type: 'note',
          body: `Ответственный по сделке переназначен: «${nextOwnerName}»`,
          metadata: { ownerId: updated.ownerId, ownerName: nextOwnerName },
        });
      }

      if (priorityChanged) {
        await db.insert(timelineEvents).values({
          id: `tl_${crypto.randomUUID().slice(0, 10)}`,
          tenantId,
          dealId: updated.id,
          authorId: req.actor!.userId,
          type: 'note',
          body: `Приоритет сделки изменён: «${nextPriority}»`,
          metadata: { priority: nextPriority },
        });
      }

      await natsBus.publish(tenantId, `crm.${req.tenant!.subdomain}.deal.updated`, req.actor!.userId, {
        dealId: updated.id,
        title: updated.title,
        budget: updated.budget,
        ownerId: updated.ownerId,
        ...(nextOwnerName ? { ownerName: nextOwnerName } : {}),
        ...(priorityChanged ? { priority: nextPriority } : {}),
      });

      res.json({ deal: updated });
    })
  );

  router.post(
    '/crm/deals/:id/auto-assign',
    requireAuth,
    requirePermission('deals:write'),
    asyncHandler('Не удалось выполнить авто-назначение менеджера', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [deal] = await db
        .select()
        .from(deals)
        .where(and(eq(deals.id, req.params.id), eq(deals.tenantId, tenantId)));
      if (!deal) return res.status(404).json({ error: 'Сделка не найдена' });
      if (req.actor?.dataScope === 'own' && deal.ownerId !== req.actor.userId) {
        return res.status(403).json({ error: 'ACL Data Scope (own): нельзя переназначать чужую сделку' });
      }

      const [tenantUsers, tenantDeals, stageRows] = await Promise.all([
        db.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.isActive, true))),
        db.select().from(deals).where(eq(deals.tenantId, tenantId)),
        db.select().from(pipelineStages).where(eq(pipelineStages.tenantId, tenantId)),
      ]);

      const closedStageIds = new Set(
        stageRows.filter((s) => s.isWon || s.isLost).map((s) => s.id)
      );

      const recommendation = recommendDealOwner(
        {
          id: deal.id,
          ownerId: deal.ownerId,
          companyId: deal.companyId,
          contactId: deal.contactId,
          budget: deal.budget,
        },
        tenantUsers.map((u) => ({ id: u.id, fullName: u.fullName })),
        tenantDeals.map((d) => ({
          id: d.id,
          ownerId: d.ownerId,
          companyId: d.companyId,
          contactId: d.contactId,
          budget: d.budget,
          isClosed: closedStageIds.has(d.stageId),
        }))
      );

      if (!recommendation) {
        return res.status(400).json({ error: 'В тенанте нет активных менеджеров для назначения' });
      }

      const [updated] = await db
        .update(deals)
        .set({ ownerId: recommendation.ownerId, updatedAt: new Date() })
        .where(and(eq(deals.id, deal.id), eq(deals.tenantId, tenantId)))
        .returning();

      await db.insert(timelineEvents).values({
        id: `tl_${crypto.randomUUID().slice(0, 10)}`,
        tenantId,
        dealId: updated.id,
        authorId: req.actor!.userId,
        type: 'note',
        body: `Назначен ответственный ${recommendation.ownerName} · ${recommendation.reason}`,
        metadata: {
          ownerId: recommendation.ownerId,
          ownerName: recommendation.ownerName,
          autoAssigned: true,
        },
      });

      await natsBus.publish(tenantId, `crm.${req.tenant!.subdomain}.deal.updated`, req.actor!.userId, {
        dealId: updated.id,
        title: updated.title,
        ownerId: updated.ownerId,
        ownerName: recommendation.ownerName,
        autoAssigned: true,
      });

      res.json({
        deal: updated,
        recommendation,
      });
    })
  );

  router.patch(
    '/crm/deals/:id/stage',
    requireAuth,
    requirePermission('deals:write'),
    asyncHandler('Ошибка смены этапа сделки', async (req, res) => {
      const data = parseBody(MoveDealStageSchema, req, res, 'Неверный этап воронки');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [deal] = await db
        .select()
        .from(deals)
        .where(and(eq(deals.id, req.params.id), eq(deals.tenantId, tenantId)));
      if (!deal) return res.status(404).json({ error: 'Сделка не найдена' });
      if (req.actor?.dataScope === 'own' && deal.ownerId !== req.actor.userId) {
        return res.status(403).json({ error: 'ACL Data Scope (own): нельзя менять этап чужой сделки' });
      }

      const [stage] = await db
        .select()
        .from(pipelineStages)
        .where(and(eq(pipelineStages.id, data.stageId), eq(pipelineStages.tenantId, tenantId)));
      if (!stage) return res.status(404).json({ error: 'Этап воронки не найден' });

      const dealAggregate = DealAggregate.rehydrate({
        id: deal.id,
        tenantId,
        subdomain: req.tenant!.subdomain,
        pipelineId: deal.pipelineId,
        stageId: deal.stageId,
        title: deal.title,
        budget: deal.budget,
        currency: (deal.currency as 'RUB' | 'USD' | 'EUR') || 'RUB',
        contactId: deal.contactId,
        companyId: deal.companyId,
        ownerId: deal.ownerId,
        lossReason: deal.lossReason,
        tags: (deal.tags as string[]) || [],
        customFields: (deal.customFields as Record<string, string>) || {},
      });

      try {
        dealAggregate.moveToStage(
          {
            id: stage.id,
            pipelineId: stage.pipelineId,
            name: stage.name,
            isWon: stage.isWon,
            isLost: stage.isLost,
          },
          req.actor!.userId,
          data.lossReason
        );
      } catch (err: unknown) {
        if (err instanceof DomainInvariantError) {
          return res.status(400).json({ error: err.message, code: err.code });
        }
        throw err;
      }

      const [updated] = await db
        .update(deals)
        .set({
          stageId: dealAggregate.state.stageId,
          lossReason: dealAggregate.state.lossReason,
          updatedAt: new Date(),
        })
        .where(and(eq(deals.id, deal.id), eq(deals.tenantId, tenantId)))
        .returning();

      await db.insert(timelineEvents).values({
        id: `tl_${crypto.randomUUID().slice(0, 10)}`,
        tenantId,
        dealId: deal.id,
        authorId: req.actor!.userId,
        type: 'stage_change',
        body: `Этап изменен на «${stage.name}»`,
        metadata: { stageId: stage.id, stageName: stage.name },
      });

      for (const domainEvt of dealAggregate.pullDomainEvents()) {
        await natsBus.publish(tenantId, domainEvt.subject, req.actor!.userId, domainEvt.payload);
      }

      const harnessAnalysis = await analyzeDealFromContactHistory({
        tenantId,
        dealId: deal.id,
        actorId: req.actor!.userId,
        trigger: 'stage_changed',
        writeTimelineInsight: false,
      });

      const workflowExecutions = await triggerNocobaseWorkflows({
        tenantId,
        tenantSubdomain: req.tenant!.subdomain,
        actorId: req.actor!.userId,
        triggerType: 'deal.stage_changed',
        deal: {
          id: updated.id,
          title: updated.title,
          budget: updated.budget,
          ownerId: updated.ownerId,
          stageId: stage.id,
          stageName: stage.name,
          stageIsWon: stage.isWon,
        },
      });

      res.json({
        deal: updated,
        stage,
        harnessAnalysis,
        triggeredWorkflows: workflowExecutions.length,
      });
    })
  );

  router.delete(
    '/crm/deals/:id',
    requireAuth,
    requirePermission('deals:delete'),
    asyncHandler('Ошибка удаления сделки', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [existing] = await db
        .select()
        .from(deals)
        .where(and(eq(deals.id, req.params.id), eq(deals.tenantId, tenantId)));
      if (!existing) return res.status(404).json({ error: 'Сделка не найдена' });
      if (req.actor?.dataScope === 'own' && existing.ownerId !== req.actor.userId) {
        return res.status(403).json({ error: 'ACL Data Scope (own): нельзя удалять чужую сделку' });
      }

      const deleted = await db
        .delete(deals)
        .where(and(eq(deals.id, req.params.id), eq(deals.tenantId, tenantId)))
        .returning();

      if (!deleted.length) return res.status(404).json({ error: 'Сделка не найдена' });

      await natsBus.publish(tenantId, `crm.${req.tenant!.subdomain}.deal.deleted`, req.actor!.userId, {
        dealId: req.params.id,
        title: deleted[0].title,
      });

      res.json({ deleted: true });
    })
  );

  // Deal Timeline & Email
  router.get(
    '/crm/deals/:id/timeline',
    requireAuth,
    requirePermission('deals:read'),
    asyncHandler('Ошибка загрузки таймлайна', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [dealRow] = await db
        .select({ id: deals.id, ownerId: deals.ownerId })
        .from(deals)
        .where(and(eq(deals.id, req.params.id), eq(deals.tenantId, tenantId)));
      if (!dealRow) {
        return res.status(404).json({ error: 'Сделка не найдена' });
      }
      if (req.actor?.dataScope === 'own' && dealRow.ownerId !== req.actor.userId) {
        return res.status(403).json({ error: 'ACL Data Scope (own): нет доступа к таймлайну чужой сделки' });
      }

      const [rows, userRows] = await Promise.all([
        db
          .select()
          .from(timelineEvents)
          .where(and(eq(timelineEvents.dealId, req.params.id), eq(timelineEvents.tenantId, tenantId)))
          .orderBy(desc(timelineEvents.createdAt)),
        db
          .select({ id: users.id, fullName: users.fullName, avatarUrl: users.avatarUrl })
          .from(users)
          .where(eq(users.tenantId, tenantId)),
      ]);

      const events = rows.map((r) => {
        const author = userRows.find((u) => u.id === r.authorId);
        return {
          ...r,
          authorName: author?.fullName || 'Система',
          authorAvatar: author?.avatarUrl || '',
        };
      });
      res.json({ events });
    })
  );

  router.post(
    '/crm/deals/:id/timeline',
    requireAuth,
    requirePermission('deals:write'),
    asyncHandler('Ошибка добавления записи в таймлайн', async (req, res) => {
      const data = parseBody(AddTimelineNoteSchema, req, res, 'Ошибка валидации примечания');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [deal] = await db
        .select()
        .from(deals)
        .where(and(eq(deals.id, req.params.id), eq(deals.tenantId, tenantId)));
      if (!deal) return res.status(404).json({ error: 'Сделка не найдена' });
      if (req.actor?.dataScope === 'own' && deal.ownerId !== req.actor.userId) {
        return res.status(403).json({ error: 'ACL Data Scope (own): нельзя изменять чужую сделку' });
      }

      const [event] = await db
        .insert(timelineEvents)
        .values({
          id: `tl_${crypto.randomUUID().slice(0, 10)}`,
          tenantId,
          dealId: deal.id,
          authorId: req.actor!.userId,
          type: data.type,
          body: data.body,
          metadata: {},
        })
        .returning();

      await natsBus.publish(tenantId, `crm.${req.tenant!.subdomain}.timeline.message`, req.actor!.userId, {
        dealId: deal.id,
        dealTitle: deal.title,
        noteType: data.type,
        authorName: req.actor!.fullName,
        preview: data.body.slice(0, 80),
      });

      const harnessAnalysis = await analyzeDealFromContactHistory({
        tenantId,
        dealId: deal.id,
        actorId: req.actor!.userId,
        trigger: 'note_added',
        writeTimelineInsight: false,
      });

      res.status(201).json({ event, harnessAnalysis });
    })
  );

  // Email Templates
  router.get(
    '/crm/email-templates',
    requireAuth,
    requirePermission('deals:read'),
    asyncHandler('Ошибка загрузки шаблонов email-рассылок', async (req, res) => {
      const db = await getDb();
      const rows = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.tenantId, req.tenant!.id))
        .orderBy(desc(emailTemplates.createdAt));
      res.json({ templates: rows });
    })
  );

  router.post(
    '/crm/email-templates',
    requireAuth,
    requirePermission('deals:write'),
    asyncHandler('Ошибка создания шаблона рассылки', async (req, res) => {
      const data = parseBody(CreateEmailTemplateSchema, req, res, 'Некорректные данные шаблона');
      if (!data) return;

      const db = await getDb();
      const [template] = await db
        .insert(emailTemplates)
        .values({
          id: `etpl_${crypto.randomUUID().slice(0, 10)}`,
          tenantId: req.tenant!.id,
          name: data.name,
          category: data.category,
          subject: data.subject,
          body: data.body,
          createdBy: req.actor!.userId,
        })
        .returning();

      await natsBus.publish(
        req.tenant!.id,
        `crm.${req.tenant!.subdomain}.email_template.created`,
        req.actor!.userId,
        { templateId: template.id, name: template.name }
      );

      res.status(201).json({ template });
    })
  );

  router.patch(
    '/crm/email-templates/:id',
    requireAuth,
    requirePermission('deals:write'),
    asyncHandler('Ошибка обновления шаблона рассылки', async (req, res) => {
      const data = parseBody(UpdateEmailTemplateSchema, req, res, 'Некорректные данные шаблона');
      if (!data) return;

      const db = await getDb();
      const updates: Partial<typeof emailTemplates.$inferInsert> = {};
      if (data.name !== undefined) updates.name = data.name;
      if (data.category !== undefined) updates.category = data.category;
      if (data.subject !== undefined) updates.subject = data.subject;
      if (data.body !== undefined) updates.body = data.body;

      const [updated] = await db
        .update(emailTemplates)
        .set(updates)
        .where(and(eq(emailTemplates.id, req.params.id), eq(emailTemplates.tenantId, req.tenant!.id)))
        .returning();

      if (!updated) return res.status(404).json({ error: 'Шаблон рассылки не найден' });

      await natsBus.publish(
        req.tenant!.id,
        `crm.${req.tenant!.subdomain}.email_template.updated`,
        req.actor!.userId,
        { templateId: updated.id, name: updated.name }
      );

      res.json({ template: updated });
    })
  );

  router.delete(
    '/crm/email-templates/:id',
    requireAuth,
    requirePermission('deals:write'),
    asyncHandler('Ошибка удаления шаблона', async (req, res) => {
      const db = await getDb();
      const deleted = await db
        .delete(emailTemplates)
        .where(and(eq(emailTemplates.id, req.params.id), eq(emailTemplates.tenantId, req.tenant!.id)))
        .returning();
      if (!deleted.length) return res.status(404).json({ error: 'Шаблон не найден' });

      await natsBus.publish(
        req.tenant!.id,
        `crm.${req.tenant!.subdomain}.email_template.deleted`,
        req.actor!.userId,
        { templateId: deleted[0].id, name: deleted[0].name }
      );

      res.json({ deleted: true });
    })
  );

  router.post(
    '/crm/deals/:id/send-email',
    requireAuth,
    requirePermission('deals:write'),
    asyncHandler('Ошибка отправки письма клиенту', async (req, res) => {
      const data = parseBody(SendDealEmailSchema, req, res, 'Некорректные данные письма');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [deal] = await db
        .select()
        .from(deals)
        .where(and(eq(deals.id, req.params.id), eq(deals.tenantId, tenantId)));
      if (!deal) return res.status(404).json({ error: 'Сделка не найдена' });

      const [event] = await db
        .insert(timelineEvents)
        .values({
          id: `tl_${crypto.randomUUID().slice(0, 10)}`,
          tenantId,
          dealId: deal.id,
          authorId: req.actor!.userId,
          type: 'email',
          body: `Кому: ${data.toEmail} · Тема: ${data.subject}\n\n${data.body}`,
          metadata: {
            toEmail: data.toEmail,
            subject: data.subject,
            templateId: data.templateId || null,
          },
        })
        .returning();

      await natsBus.publish(tenantId, `crm.${req.tenant!.subdomain}.email.sent`, req.actor!.userId, {
        dealId: deal.id,
        dealTitle: deal.title,
        toEmail: data.toEmail,
        subject: data.subject,
        templateId: data.templateId || null,
        authorName: req.actor!.fullName,
      });

      const harnessAnalysis = await analyzeDealFromContactHistory({
        tenantId,
        dealId: deal.id,
        actorId: req.actor!.userId,
        trigger: 'note_added',
        writeTimelineInsight: false,
      });

      res.status(201).json({ event, harnessAnalysis });
    })
  );

  // Harness Deal Analysis
  router.post(
    '/crm/deals/analyze',
    requireAuth,
    requirePermission('harness:execute'),
    asyncHandler('Ошибка анализа сделки в DeepSeek-Harness', async (req, res) => {
      const schema = z.object({
        dealId: z.string().trim().min(1, 'Укажите ID сделки'),
        trigger: z
          .enum(['auto_load', 'deal_created', 'stage_changed', 'note_added', 'manual_batch', 'manual_card'])
          .default('manual_card'),
      });
      const data = parseBody(schema, req, res, 'Некорректные параметры анализа');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [deal] = await db
        .select()
        .from(deals)
        .where(and(eq(deals.id, data.dealId), eq(deals.tenantId, tenantId)));
      if (!deal) return res.status(404).json({ error: 'Сделка не найдена' });

      const analysis = await analyzeDealFromContactHistory({
        tenantId,
        dealId: deal.id,
        actorId: req.actor!.userId,
        trigger: data.trigger,
        writeTimelineInsight: false,
      });

      res.json({ analysis, nextStep: analysis.nextStep });
    })
  );

  router.post(
    '/crm/deals/analyze-all',
    requireAuth,
    requirePermission('harness:execute'),
    asyncHandler('Ошибка пакетного анализа сделок в DeepSeek-Harness', async (req, res) => {
      const analyses = await analyzeTenantDealsBatch({
        tenantId: req.tenant!.id,
        actorId: req.actor!.userId,
        trigger: 'manual_batch',
        publishNats: true,
      });
      res.json({ count: analyses.length, analyses });
    })
  );

  router.post(
    '/crm/deals/:id/apply-next-step',
    requireAuth,
    requirePermission('tasks:write'),
    asyncHandler('Не удалось создать задачу из рекомендации Harness', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [deal] = await db
        .select()
        .from(deals)
        .where(and(eq(deals.id, req.params.id), eq(deals.tenantId, tenantId)));
      if (!deal) return res.status(404).json({ error: 'Сделка не найдена' });

      const cached = await getLatestDealAnalyses(tenantId, [deal.id]);
      const analysis =
        cached[deal.id] ||
        (await analyzeDealFromContactHistory({
          tenantId,
          dealId: deal.id,
          actorId: req.actor!.userId,
          trigger: 'manual_card',
          writeTimelineInsight: false,
        }));

      const [createdTask] = await db
        .insert(tasks)
        .values({
          id: `tsk_${crypto.randomUUID().slice(0, 10)}`,
          tenantId,
          dealId: deal.id,
          assigneeId: req.actor!.userId,
          taskType: analysis.nextStep.actionType,
          title: analysis.nextStep.title,
          dueAt: new Date(analysis.nextStep.suggestedDueAt),
          completed: false,
        })
        .returning();

      await db.insert(timelineEvents).values({
        id: `tl_${crypto.randomUUID().slice(0, 10)}`,
        tenantId,
        dealId: deal.id,
        authorId: req.actor!.userId,
        type: 'task',
        body: `Принят следующий шаг DeepSeek-Harness: создана задача «${analysis.nextStep.title}»`,
        metadata: { taskId: createdTask.id, runId: analysis.runId },
      });

      await natsBus.publish(
        tenantId,
        `crm.${req.tenant!.subdomain}.task.created_from_harness`,
        req.actor!.userId,
        { dealId: deal.id, taskId: createdTask.id, title: createdTask.title }
      );

      res.status(201).json({ task: createdTask, analysis });
    })
  );

  // Contacts & Companies CRUD + Table Schema & View Editor
  router.get(
    '/crm/contacts',
    requireAuth,
    requirePermission('contacts:read'),
    asyncHandler('Ошибка загрузки контактов', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const userId = req.actor!.userId;
      const hiddenFields = new Set(req.actor?.hiddenFields || []);

      const [contactRows, companyRows, dealRows, contactsSchema, companiesSchema] = await Promise.all([
        db.select().from(contacts).where(eq(contacts.tenantId, tenantId)).orderBy(desc(contacts.createdAt)),
        db.select().from(companies).where(eq(companies.tenantId, tenantId)).orderBy(desc(companies.createdAt)),
        db
          .select({ id: deals.id, contactId: deals.contactId, companyId: deals.companyId, budget: deals.budget })
          .from(deals)
          .where(eq(deals.tenantId, tenantId)),
        getCrmEntitySchema(tenantId, 'contacts', userId),
        getCrmEntitySchema(tenantId, 'companies', userId),
      ]);

      res.json({
        contacts: contactRows.map((c) => {
          const linked = dealRows.filter((d) => d.contactId === c.id);
          return {
            ...c,
            phone: hiddenFields.has('phone') ? '' : c.phone,
            email: hiddenFields.has('email') ? '' : c.email,
            dealsCount: linked.length,
            dealsBudget: hiddenFields.has('budget') ? 0 : linked.reduce((s, d) => s + d.budget, 0),
          };
        }),
        companies: companyRows.map((cmp) => {
          const linked = dealRows.filter((d) => d.companyId === cmp.id);
          return {
            ...cmp,
            phone: hiddenFields.has('phone') ? '' : cmp.phone,
            dealsCount: linked.length,
            dealsBudget: hiddenFields.has('budget') ? 0 : linked.reduce((s, d) => s + d.budget, 0),
          };
        }),
        schemas: {
          contacts: contactsSchema,
          companies: companiesSchema,
        },
      });
    })
  );

  // Contacts & Companies Export / Import (CSV / Excel .xlsx)
  router.get(
    '/crm/contacts/export',
    requireAuth,
    requirePermission('contacts:read'),
    asyncHandler('Ошибка экспорта справочника CRM', async (req, res) => {
      const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
      const entityType = req.query.entity === 'companies' ? 'companies' : 'contacts';
      const query = typeof req.query.q === 'string' ? req.query.q : undefined;
      const templateOnly = req.query.template === '1' || req.query.template === 'true';

      const result = await exportContactsOrCompanies({
        tenantId: req.tenant!.id,
        userId: req.actor!.userId,
        entityType,
        format,
        hiddenFields: req.actor?.hiddenFields || [],
        query,
        templateOnly,
      });

      res.setHeader('Content-Type', result.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`
      );
      res.send(result.buffer);
    })
  );

  router.post(
    '/crm/contacts/import',
    requireAuth,
    requirePermission('contacts:write'),
    asyncHandler('Ошибка импорта контактов или компаний', async (req, res) => {
      const data = parseBody(CrmImportContactsPayloadSchema, req, res, 'Некорректные параметры импорта');
      if (!data) return;

      try {
        const result = await importContactsOrCompanies({
          tenantId: req.tenant!.id,
          tenantSubdomain: req.tenant!.subdomain,
          actorId: req.actor!.userId,
          payload: data,
        });
        res.status(data.dryRun ? 200 : 201).json(result);
      } catch (err: unknown) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка разбора файла импорта' });
      }
    })
  );

  router.get(
    '/crm/directory-schemas',
    requireAuth,
    requirePermission('contacts:read'),
    asyncHandler('Ошибка загрузки конфигурации таблиц', async (req, res) => {
      const tenantId = req.tenant!.id;
      const userId = req.actor!.userId;
      const [contactsSchema, companiesSchema] = await Promise.all([
        getCrmEntitySchema(tenantId, 'contacts', userId),
        getCrmEntitySchema(tenantId, 'companies', userId),
      ]);
      res.json({ contacts: contactsSchema, companies: companiesSchema });
    })
  );

  router.post(
    '/crm/directory-schemas/:entityType/sections',
    requireAuth,
    requirePermission('contacts:write'),
    asyncHandler('Ошибка создания раздела таблицы', async (req, res) => {
      const entityParsed = CrmEntityTypeSchema.safeParse(req.params.entityType);
      if (!entityParsed.success) return res.status(400).json({ error: 'Некорректный тип таблицы' });
      const data = parseBody(CreateCrmSectionSchema, req, res);
      if (!data) return;
      const schema = await addCrmSection(req.tenant!.id, entityParsed.data, data.title, req.actor!.userId);
      res.status(201).json({ schema });
    })
  );

  router.patch(
    '/crm/directory-schemas/:entityType/sections/:sectionId',
    requireAuth,
    requirePermission('contacts:write'),
    asyncHandler('Ошибка обновления раздела таблицы', async (req, res) => {
      const entityParsed = CrmEntityTypeSchema.safeParse(req.params.entityType);
      if (!entityParsed.success) return res.status(400).json({ error: 'Некорректный тип таблицы' });
      const data = parseBody(UpdateCrmSectionSchema, req, res);
      if (!data) return;
      try {
        const schema = await updateCrmSection(
          req.tenant!.id,
          entityParsed.data,
          req.params.sectionId,
          data,
          req.actor!.userId
        );
        res.json({ schema });
      } catch (err: unknown) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка обновления раздела' });
      }
    })
  );

  router.delete(
    '/crm/directory-schemas/:entityType/sections/:sectionId',
    requireAuth,
    requirePermission('contacts:write'),
    asyncHandler('Ошибка удаления раздела таблицы', async (req, res) => {
      const entityParsed = CrmEntityTypeSchema.safeParse(req.params.entityType);
      if (!entityParsed.success) return res.status(400).json({ error: 'Некорректный тип таблицы' });
      try {
        const schema = await deleteCrmSection(
          req.tenant!.id,
          entityParsed.data,
          req.params.sectionId,
          req.actor!.userId
        );
        res.json({ schema });
      } catch (err: unknown) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка удаления раздела' });
      }
    })
  );

  router.post(
    '/crm/directory-schemas/:entityType/fields',
    requireAuth,
    requirePermission('contacts:write'),
    asyncHandler('Ошибка добавления поля таблицы', async (req, res) => {
      const entityParsed = CrmEntityTypeSchema.safeParse(req.params.entityType);
      if (!entityParsed.success) return res.status(400).json({ error: 'Некорректный тип таблицы' });
      const data = parseBody(CreateCrmFieldSchema, req, res);
      if (!data) return;
      try {
        const result = await addCrmField(req.tenant!.id, entityParsed.data, data, req.actor!.userId);
        res.status(201).json(result);
      } catch (err: unknown) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка добавления поля' });
      }
    })
  );

  router.patch(
    '/crm/directory-schemas/:entityType/fields/:fieldKey',
    requireAuth,
    requirePermission('contacts:write'),
    asyncHandler('Ошибка обновления поля таблицы', async (req, res) => {
      const entityParsed = CrmEntityTypeSchema.safeParse(req.params.entityType);
      if (!entityParsed.success) return res.status(400).json({ error: 'Некорректный тип таблицы' });
      const data = parseBody(UpdateCrmFieldSchema, req, res);
      if (!data) return;
      try {
        const schema = await updateCrmField(
          req.tenant!.id,
          entityParsed.data,
          req.params.fieldKey,
          data,
          req.actor!.userId
        );
        res.json({ schema });
      } catch (err: unknown) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка обновления поля' });
      }
    })
  );

  router.delete(
    '/crm/directory-schemas/:entityType/fields/:fieldKey',
    requireAuth,
    requirePermission('contacts:write'),
    asyncHandler('Ошибка удаления поля таблицы', async (req, res) => {
      const entityParsed = CrmEntityTypeSchema.safeParse(req.params.entityType);
      if (!entityParsed.success) return res.status(400).json({ error: 'Некорректный тип таблицы' });
      try {
        const schema = await deleteCrmField(
          req.tenant!.id,
          entityParsed.data,
          req.params.fieldKey,
          req.actor!.userId
        );
        res.json({ schema });
      } catch (err: unknown) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка удаления поля' });
      }
    })
  );

  router.put(
    '/crm/directory-schemas/:entityType/view',
    requireAuth,
    requirePermission('contacts:read'),
    asyncHandler('Ошибка сохранения вида таблицы', async (req, res) => {
      const entityParsed = CrmEntityTypeSchema.safeParse(req.params.entityType);
      if (!entityParsed.success) return res.status(400).json({ error: 'Некорректный тип таблицы' });
      const data = parseBody(UpdateCrmTableViewSchema, req, res);
      if (!data) return;
      const schema = await saveCrmTableViewConfig(
        req.tenant!.id,
        entityParsed.data,
        req.actor!.userId,
        data
      );
      res.json({ schema });
    })
  );

  router.post(
    '/crm/directory-schemas/:entityType/view/reset',
    requireAuth,
    requirePermission('contacts:read'),
    asyncHandler('Ошибка сброса вида таблицы', async (req, res) => {
      const entityParsed = CrmEntityTypeSchema.safeParse(req.params.entityType);
      if (!entityParsed.success) return res.status(400).json({ error: 'Некорректный тип таблицы' });
      const schema = await resetCrmTableViewConfig(
        req.tenant!.id,
        entityParsed.data,
        req.actor!.userId
      );
      res.json({ schema });
    })
  );

  router.post(
    '/crm/contacts',
    requireAuth,
    requirePermission('contacts:write'),
    asyncHandler('Не удалось создать контакт', async (req, res) => {
      const data = parseBody(CreateContactSchema, req, res, 'Некорректные данные контакта');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      let resolvedCompanyName = data.companyName;
      if (data.companyId) {
        const [cmp] = await db
          .select()
          .from(companies)
          .where(and(eq(companies.id, data.companyId), eq(companies.tenantId, tenantId)));
        if (!cmp) return res.status(400).json({ error: 'Компания не найдена в тенанте' });
        if (!resolvedCompanyName) resolvedCompanyName = cmp.name;
      }

      const [contact] = await db
        .insert(contacts)
        .values({
          id: `cnt_${crypto.randomUUID().slice(0, 10)}`,
          tenantId,
          fullName: data.fullName,
          phone: data.phone,
          email: data.email,
          position: data.position,
          companyId: data.companyId || null,
          companyName: resolvedCompanyName,
          tags: data.tags,
          customFields: data.customFields || {},
        })
        .returning();

      await natsBus.publish(tenantId, `crm.${req.tenant!.subdomain}.contact.created`, req.actor!.userId, {
        contactId: contact.id,
        fullName: contact.fullName,
      });

      res.status(201).json({ contact });
    })
  );

  router.patch(
    '/crm/contacts/:id',
    requireAuth,
    requirePermission('contacts:write'),
    asyncHandler('Ошибка обновления контакта', async (req, res) => {
      const data = parseBody(UpdateContactSchema, req, res, 'Некорректные данные контакта');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [existing] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, req.params.id), eq(contacts.tenantId, tenantId)));
      if (!existing) return res.status(404).json({ error: 'Контакт не найден' });

      const mergedCustom =
        data.customFields !== undefined
          ? { ...(existing.customFields || {}), ...data.customFields }
          : existing.customFields;

      const [updated] = await db
        .update(contacts)
        .set({ ...data, customFields: mergedCustom })
        .where(and(eq(contacts.id, req.params.id), eq(contacts.tenantId, tenantId)))
        .returning();

      res.json({ contact: updated });
    })
  );

  router.delete(
    '/crm/contacts/:id',
    requireAuth,
    requirePermission('contacts:write'),
    asyncHandler('Ошибка удаления контакта', async (req, res) => {
      const db = await getDb();
      const deleted = await db
        .delete(contacts)
        .where(and(eq(contacts.id, req.params.id), eq(contacts.tenantId, req.tenant!.id)))
        .returning();
      if (!deleted.length) return res.status(404).json({ error: 'Контакт не найден' });
      res.json({ deleted: true });
    })
  );

  router.post(
    '/crm/companies',
    requireAuth,
    requirePermission('contacts:write'),
    asyncHandler('Не удалось создать компанию', async (req, res) => {
      const data = parseBody(CreateCompanySchema, req, res);
      if (!data) return;

      const db = await getDb();
      const [company] = await db
        .insert(companies)
        .values({
          id: `cmp_${crypto.randomUUID().slice(0, 10)}`,
          tenantId: req.tenant!.id,
          name: data.name,
          industry: data.industry,
          website: data.website,
          phone: data.phone,
          customFields: data.customFields || {},
        })
        .returning();

      res.status(201).json({ company });
    })
  );

  router.patch(
    '/crm/companies/:id',
    requireAuth,
    requirePermission('contacts:write'),
    asyncHandler('Ошибка обновления компании', async (req, res) => {
      const data = parseBody(UpdateCompanySchema, req, res);
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [existing] = await db
        .select()
        .from(companies)
        .where(and(eq(companies.id, req.params.id), eq(companies.tenantId, tenantId)));
      if (!existing) return res.status(404).json({ error: 'Компания не найдена' });

      const mergedCustom =
        data.customFields !== undefined
          ? { ...(existing.customFields || {}), ...data.customFields }
          : existing.customFields;

      const [updated] = await db
        .update(companies)
        .set({ ...data, customFields: mergedCustom })
        .where(and(eq(companies.id, req.params.id), eq(companies.tenantId, tenantId)))
        .returning();
      res.json({ company: updated });
    })
  );

  router.delete(
    '/crm/companies/:id',
    requireAuth,
    requirePermission('contacts:write'),
    asyncHandler('Ошибка удаления компании', async (req, res) => {
      const db = await getDb();
      const deleted = await db
        .delete(companies)
        .where(and(eq(companies.id, req.params.id), eq(companies.tenantId, req.tenant!.id)))
        .returning();
      if (!deleted.length) return res.status(404).json({ error: 'Компания не найдена' });
      res.json({ deleted: true });
    })
  );

  // Unified CRM Calendar (synchronizes deal meetings, tasks, and Harness suggested slots)
  router.get(
    '/crm/calendar',
    requireAuth,
    requirePermission('tasks:read'),
    asyncHandler('Ошибка загрузки календаря CRM', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [taskRows, dealRows, stageRows, contactRows, companyRows, userRows] = await Promise.all([
        db.select().from(tasks).where(eq(tasks.tenantId, tenantId)).orderBy(tasks.dueAt),
        db.select().from(deals).where(eq(deals.tenantId, tenantId)),
        db.select().from(pipelineStages).where(eq(pipelineStages.tenantId, tenantId)),
        db.select().from(contacts).where(eq(contacts.tenantId, tenantId)),
        db.select().from(companies).where(eq(companies.tenantId, tenantId)),
        db
          .select({ id: users.id, fullName: users.fullName, avatarUrl: users.avatarUrl })
          .from(users)
          .where(eq(users.tenantId, tenantId)),
      ]);

      const scopedTasks =
        req.actor?.dataScope === 'own'
          ? taskRows.filter((t) => t.assigneeId === req.actor!.userId)
          : taskRows;

      const scopedDeals =
        req.actor?.dataScope === 'own'
          ? dealRows.filter((d) => d.ownerId === req.actor!.userId)
          : dealRows;

      const analysesMap = await getLatestDealAnalyses(
        tenantId,
        scopedDeals.map((d) => d.id)
      );

      const enrichedTasks = scopedTasks.map((t) => {
        const linkedDeal = dealRows.find((d) => d.id === t.dealId);
        const assignee = userRows.find((u) => u.id === t.assigneeId);
        return {
          ...t,
          durationMinutes: t.durationMinutes ?? (t.taskType === 'meeting' ? 60 : 30),
          dealTitle: linkedDeal?.title || null,
          assigneeName: assignee?.fullName || 'Исполнитель',
          assigneeAvatar: assignee?.avatarUrl || '',
        };
      });

      const hiddenFields = new Set(req.actor?.hiddenFields || []);
      const enrichedDeals = scopedDeals.map((d) => {
        const stage = stageRows.find((s) => s.id === d.stageId);
        const contact = contactRows.find((c) => c.id === d.contactId);
        const company = companyRows.find((c) => c.id === d.companyId);
        const owner = userRows.find((u) => u.id === d.ownerId);
        const openTasks = taskRows.filter((t) => t.dealId === d.id && !t.completed);
        return {
          id: d.id,
          pipelineId: d.pipelineId,
          stageId: d.stageId,
          stageName: stage?.name || '',
          isWon: stage?.isWon ?? false,
          isLost: stage?.isLost ?? false,
          title: d.title,
          budget: hiddenFields.has('budget') ? 0 : d.budget,
          currency: d.currency,
          contactId: d.contactId,
          companyId: d.companyId,
          ownerId: d.ownerId,
          tags: d.tags,
          customFields: d.customFields,
          contactName: contact?.fullName || null,
          contactPhone: hiddenFields.has('phone') ? null : contact?.phone || null,
          companyName: company?.name || null,
          ownerName: owner?.fullName || 'Менеджер',
          ownerAvatar: owner?.avatarUrl || '',
          openTasksCount: openTasks.length,
          hasOverdueTask: openTasks.some((t) => new Date(t.dueAt).getTime() < Date.now()),
          nextTaskDueAt: openTasks[0]?.dueAt ? new Date(openTasks[0].dueAt).toISOString() : null,
          harnessAnalysis: analysesMap[d.id] || null,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        };
      });

      res.json({
        tasks: enrichedTasks,
        deals: enrichedDeals,
        assignees: userRows,
      });
    })
  );

  // Tasks CRUD
  router.get(
    '/crm/tasks',
    requireAuth,
    requirePermission('tasks:read'),
    asyncHandler('Ошибка загрузки задач', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [taskRows, dealRows, userRows] = await Promise.all([
        db.select().from(tasks).where(eq(tasks.tenantId, tenantId)).orderBy(tasks.dueAt),
        db.select({ id: deals.id, title: deals.title }).from(deals).where(eq(deals.tenantId, tenantId)),
        db
          .select({ id: users.id, fullName: users.fullName, avatarUrl: users.avatarUrl })
          .from(users)
          .where(eq(users.tenantId, tenantId)),
      ]);

      const scopedTasks =
        req.actor?.dataScope === 'own'
          ? taskRows.filter((t) => t.assigneeId === req.actor!.userId)
          : taskRows;

      const enriched = scopedTasks.map((t) => ({
        ...t,
        durationMinutes: t.durationMinutes ?? (t.taskType === 'meeting' ? 60 : 30),
        dealTitle: dealRows.find((d) => d.id === t.dealId)?.title || null,
        assigneeName: userRows.find((u) => u.id === t.assigneeId)?.fullName || 'Исполнитель',
        assigneeAvatar: userRows.find((u) => u.id === t.assigneeId)?.avatarUrl || '',
      }));

      res.json({ tasks: enriched, deals: dealRows, assignees: userRows });
    })
  );

  router.post(
    '/crm/tasks',
    requireAuth,
    requirePermission('tasks:write'),
    asyncHandler('Не удалось создать задачу', async (req, res) => {
      const data = parseBody(CreateTaskSchema, req, res, 'Некорректные данные задачи');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      let dealTitle: string | null = null;
      if (data.dealId) {
        const [deal] = await db
          .select({ id: deals.id, title: deals.title })
          .from(deals)
          .where(and(eq(deals.id, data.dealId), eq(deals.tenantId, tenantId)));
        if (!deal) return res.status(400).json({ error: 'Сделка не найдена в тенанте' });
        dealTitle = deal.title;
      }

      const dueDate = new Date(data.dueAt);
      if (Number.isNaN(dueDate.getTime())) {
        return res.status(400).json({ error: 'Некорректная дата срока выполнения' });
      }
      const reminderDate = data.reminderAt ? new Date(data.reminderAt) : null;
      if (reminderDate && Number.isNaN(reminderDate.getTime())) {
        return res.status(400).json({ error: 'Некорректная дата напоминания' });
      }

      const defaultDuration = data.taskType === 'meeting' ? 60 : 30;
      const [task] = await db
        .insert(tasks)
        .values({
          id: `tsk_${crypto.randomUUID().slice(0, 10)}`,
          tenantId,
          dealId: data.dealId || null,
          assigneeId: data.assigneeId || req.actor!.userId,
          taskType: data.taskType,
          title: data.title,
          dueAt: dueDate,
          reminderAt: reminderDate,
          durationMinutes: data.durationMinutes ?? defaultDuration,
          completed: false,
        })
        .returning();

      if (data.dealId && data.taskType === 'meeting') {
        await db.insert(timelineEvents).values({
          id: `tl_${crypto.randomUUID().slice(0, 10)}`,
          tenantId,
          dealId: data.dealId,
          authorId: req.actor!.userId,
          type: 'task',
          body: `Назначена встреча по сделке: «${data.title}» (${dueDate.toLocaleString('ru-RU')})`,
          metadata: { taskId: task.id, taskType: 'meeting' },
        });
      }

      await natsBus.publish(tenantId, `crm.${req.tenant!.subdomain}.task.created`, req.actor!.userId, {
        taskId: task.id,
        dealId: task.dealId,
        dealTitle,
        taskType: task.taskType,
        title: task.title,
        dueAt: task.dueAt,
        reminderAt: task.reminderAt,
      });

      if (
        (reminderDate && reminderDate.getTime() <= Date.now()) ||
        dueDate.getTime() <= Date.now()
      ) {
        await checkTaskDeadlinesAndReminders({ tenantId });
      }

      res.status(201).json({ task });
    })
  );

  router.post(
    '/crm/tasks/check-deadlines',
    requireAuth,
    requirePermission('tasks:read'),
    asyncHandler('Ошибка проверки дедлайнов задач', async (req, res) => {
      const result = await checkTaskDeadlinesAndReminders({ tenantId: req.tenant!.id });
      res.json(result);
    })
  );

  router.post(
    '/crm/tasks/:id/remind',
    requireAuth,
    requirePermission('tasks:write'),
    asyncHandler('Ошибка отправки напоминания в NATS', async (req, res) => {
      const result = await sendManualTaskReminder({
        tenantId: req.tenant!.id,
        subdomain: req.tenant!.subdomain,
        taskId: req.params.id,
        actorId: req.actor!.userId,
      });
      if (!result) return res.status(404).json({ error: 'Задача не найдена' });
      res.json({ sent: true, message: result.message, task: result.task });
    })
  );

  router.patch(
    '/crm/tasks/:id',
    requireAuth,
    requirePermission('tasks:write'),
    asyncHandler('Ошибка обновления задачи', async (req, res) => {
      const data = parseBody(UpdateTaskSchema, req, res);
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const updates: Partial<typeof tasks.$inferInsert> = {};
      if (data.title !== undefined) updates.title = data.title;
      if (data.dealId !== undefined) updates.dealId = data.dealId;
      if (data.assigneeId !== undefined) updates.assigneeId = data.assigneeId;
      if (data.taskType !== undefined) updates.taskType = data.taskType;
      if (data.dueAt !== undefined) {
        const parsedDue = new Date(data.dueAt);
        if (Number.isNaN(parsedDue.getTime())) {
          return res.status(400).json({ error: 'Некорректная дата срока выполнения' });
        }
        updates.dueAt = parsedDue;
        updates.deadlineNotifiedAt = null;
        updates.reminderNotifiedAt = null;
      }
      if (data.reminderAt !== undefined) {
        if (data.reminderAt === null) {
          updates.reminderAt = null;
          updates.reminderNotifiedAt = null;
        } else {
          const parsedRem = new Date(data.reminderAt);
          if (Number.isNaN(parsedRem.getTime())) {
            return res.status(400).json({ error: 'Некорректная дата напоминания' });
          }
          updates.reminderAt = parsedRem;
          updates.reminderNotifiedAt = null;
        }
      }
      if (data.durationMinutes !== undefined) updates.durationMinutes = data.durationMinutes;
      if (data.completed !== undefined) updates.completed = data.completed;

      const [updated] = await db
        .update(tasks)
        .set(updates)
        .where(and(eq(tasks.id, req.params.id), eq(tasks.tenantId, tenantId)))
        .returning();

      if (!updated) return res.status(404).json({ error: 'Задача не найдена' });

      if (data.dueAt !== undefined || data.durationMinutes !== undefined) {
        await natsBus.publish(
          tenantId,
          `crm.${req.tenant!.subdomain}.task.rescheduled`,
          req.actor!.userId,
          {
            taskId: updated.id,
            dealId: updated.dealId,
            title: updated.title,
            dueAt: updated.dueAt,
            durationMinutes: updated.durationMinutes,
          }
        );
      }

      if (!updated.completed && (data.reminderAt !== undefined || data.dueAt !== undefined)) {
        await checkTaskDeadlinesAndReminders({ tenantId });
      }

      res.json({ task: updated });
    })
  );

  router.patch(
    '/crm/tasks/:id/toggle',
    requireAuth,
    requirePermission('tasks:write'),
    asyncHandler('Ошибка обновления задачи', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [existing] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, req.params.id), eq(tasks.tenantId, tenantId)));
      if (!existing) return res.status(404).json({ error: 'Задача не найдена' });

      const [updated] = await db
        .update(tasks)
        .set({ completed: !existing.completed })
        .where(and(eq(tasks.id, existing.id), eq(tasks.tenantId, tenantId)))
        .returning();

      if (updated.completed) {
        await triggerNocobaseWorkflows({
          tenantId,
          tenantSubdomain: req.tenant!.subdomain,
          actorId: req.actor!.userId,
          triggerType: 'task.completed',
          task: {
            id: updated.id,
            title: updated.title,
            dealId: updated.dealId,
            assigneeId: updated.assigneeId,
          },
        });
      }

      res.json({ task: updated });
    })
  );

  router.delete(
    '/crm/tasks/:id',
    requireAuth,
    requirePermission('tasks:write'),
    asyncHandler('Ошибка удаления задачи', async (req, res) => {
      const db = await getDb();
      const deleted = await db
        .delete(tasks)
        .where(and(eq(tasks.id, req.params.id), eq(tasks.tenantId, req.tenant!.id)))
        .returning();
      if (!deleted.length) return res.status(404).json({ error: 'Задача не найдена' });
      res.json({ deleted: true });
    })
  );

  return router;
}
