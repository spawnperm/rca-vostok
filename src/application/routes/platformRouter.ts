import crypto from 'crypto';
import { Router } from 'express';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { CreateCmsBlockSchema, UpdateCmsBlockSchema } from '../../domain/cms/entities.ts';
import {
  ALL_PERMISSIONS,
  AssignUserRoleSchema,
  CreateRoleSchema,
  PermissionMetadata,
  PolicyEvaluator,
  ROLE_MASKABLE_FIELDS,
  ToggleUserStatusSchema,
  UpdateRoleAclSchema,
  UpdateRolePermissionsSchema,
} from '../../domain/iam/rbac.ts';
import { getDb } from '../../infrastructure/db/client.ts';
import {
  cmsBlocks,
  companies,
  contacts,
  deals,
  officeDocuments,
  pipelineStages,
  rolePermissions,
  roles,
  tasks,
  users,
} from '../../infrastructure/db/schema.ts';
import {
  commitAndPushToMain,
  getGitWorkspaceStatus,
  GitCommitPushSchema,
} from '../../infrastructure/git/PlatformGitSync.ts';
import {
  executeHarnessWorkflow,
  HARNESS_WORKFLOWS,
  HarnessExecuteSchema,
  listHarnessRuns,
} from '../../infrastructure/harness/deepseekHarness.ts';
import { checkTaskDeadlinesAndReminders } from '../../infrastructure/crm/taskDeadlineMonitor.ts';
import { natsBus, type NatsMessage, type NatsQueueItem } from '../../infrastructure/nats/eventBus.ts';
import { createAdrRecord, CreateAdrSchema, listAdrs } from '../../infrastructure/telemetry/adrService.ts';
import {
  buildPrometheusSnapshot,
  isMetricsAuthorized,
  renderPrometheusText,
} from '../../infrastructure/telemetry/prometheusMetrics.ts';
import { collectSystemHealthSnapshot } from '../../infrastructure/telemetry/systemHealthService.ts';
import { createRateLimitMiddleware, sanitizePublicUser } from '../middleware/security.ts';
import { requireAnyPermission, requireAuth, requirePermission } from '../middleware/tenantAndAuth.ts';
import type { PortalRequest } from '../middleware/tenantAndAuth.ts';
import {
  type GlobalSearchDocument,
  type GlobalSearchEntityType,
  rankSearchDocuments,
} from '../search/globalSearch.ts';
import { asyncHandler, parseBody } from './routeHelpers.ts';

const PublishNatsEventSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, 'Укажите subject длиной от 3 символов')
    .max(120)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Subject может содержать только латинские буквы, цифры, ., _ и -'),
  payload: z.record(z.string(), z.unknown()).default({}),
  simulateError: z.boolean().optional().default(false),
});

export function createPlatformRouter(): Router {
  const router = Router();
  const harnessRateLimiter = createRateLimitMiddleware({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
    maxRequests: 60,
    keyPrefix: 'harness_exec',
    message: 'Превышен лимит запусков DeepSeek-Harness. Подождите минуту.',
  });
  const gitPushRateLimiter = createRateLimitMiddleware({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
    maxRequests: 20,
    keyPrefix: 'git_push',
    message: 'Превышен лимит операций отправки в GitHub. Подождите минуту.',
  });

  // RBAC Matrix & IAM
  router.get(
    '/rbac/matrix',
    requireAuth,
    requireAnyPermission(['rbac:manage', 'tenants:admin', 'docs:read']),
    asyncHandler('Ошибка загрузки RBAC матрицы', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [roleRows, userRows] = await Promise.all([
        db.select().from(roles).where(eq(roles.tenantId, tenantId)),
        db
          .select({
            id: users.id,
            email: users.email,
            fullName: users.fullName,
            roleId: users.roleId,
            avatarUrl: users.avatarUrl,
            isActive: users.isActive,
          })
          .from(users)
          .where(eq(users.tenantId, tenantId)),
      ]);

      const roleIds = roleRows.map((r) => r.id);
      const permRows = roleIds.length
        ? await db.select().from(rolePermissions).where(inArray(rolePermissions.roleId, roleIds))
        : [];

      const enrichedRoles = roleRows.map((r) => ({
        ...r,
        permissions: permRows.filter((p) => p.roleId === r.id).map((p) => p.permission),
      }));

      res.json({
        allPermissions: ALL_PERMISSIONS.map((code) => ({ code, ...PermissionMetadata[code] })),
        maskableFields: ROLE_MASKABLE_FIELDS,
        roles: enrichedRoles,
        users: userRows,
      });
    })
  );

  router.post(
    '/rbac/roles',
    requireAuth,
    requirePermission('rbac:manage'),
    asyncHandler('Не удалось создать роль', async (req, res) => {
      const data = parseBody(CreateRoleSchema, req, res, 'Ошибка валидации роли');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const roleId = `role_${req.tenant!.subdomain}_${data.code}_${crypto.randomUUID().slice(0, 4)}`;

      const [role] = await db
        .insert(roles)
        .values({
          id: roleId,
          tenantId,
          code: data.code,
          name: data.name,
          description: data.description,
          isSystem: false,
        })
        .returning();

      await db.insert(rolePermissions).values(
        data.permissions.map((perm) => ({
          id: `rp_${roleId}_${perm}`,
          roleId,
          permission: perm,
        }))
      );

      res.status(201).json({ role: { ...role, permissions: data.permissions } });
    })
  );

  router.put(
    '/rbac/roles/:id/permissions',
    requireAuth,
    requirePermission('rbac:manage'),
    asyncHandler('Ошибка обновления прав роли', async (req, res) => {
      const data = parseBody(UpdateRolePermissionsSchema, req, res, 'Некорректный список разрешений');
      if (!data) return;

      const db = await getDb();
      const [role] = await db
        .select()
        .from(roles)
        .where(and(eq(roles.id, req.params.id), eq(roles.tenantId, req.tenant!.id)));
      if (!role) return res.status(404).json({ error: 'Роль не найдена' });

      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
      if (data.permissions.length > 0) {
        await db.insert(rolePermissions).values(
          data.permissions.map((perm) => ({
            id: `rp_${role.id}_${perm}`,
            roleId: role.id,
            permission: perm,
          }))
        );
      }

      await natsBus.publish(req.tenant!.id, 'iam.rbac.role.updated', req.actor!.userId, {
        roleId: role.id,
        permissionsCount: data.permissions.length,
      });

      res.json({ roleId: role.id, permissions: data.permissions });
    })
  );

  router.patch(
    '/rbac/roles/:id/acl',
    requireAuth,
    requirePermission('rbac:manage'),
    asyncHandler('Ошибка обновления ACL роли', async (req, res) => {
      const data = parseBody(UpdateRoleAclSchema, req, res, 'Некорректные параметры ACL');
      if (!data) return;

      const db = await getDb();
      const [updated] = await db
        .update(roles)
        .set({
          dataScope: data.dataScope,
          hiddenFields: data.hiddenFields,
        })
        .where(and(eq(roles.id, req.params.id), eq(roles.tenantId, req.tenant!.id)))
        .returning();

      if (!updated) return res.status(404).json({ error: 'Роль не найдена' });
      await natsBus.publish(req.tenant!.id, 'iam.rbac.acl.updated', req.actor!.userId, {
        roleId: updated.id,
        dataScope: updated.dataScope,
        hiddenFields: updated.hiddenFields,
      });
      res.json({ role: updated });
    })
  );

  router.delete(
    '/rbac/roles/:id',
    requireAuth,
    requirePermission('rbac:manage'),
    asyncHandler('Ошибка удаления роли', async (req, res) => {
      const db = await getDb();
      const [role] = await db
        .select()
        .from(roles)
        .where(and(eq(roles.id, req.params.id), eq(roles.tenantId, req.tenant!.id)));
      if (!role) return res.status(404).json({ error: 'Роль не найдена' });
      if (role.isSystem) return res.status(400).json({ error: 'Системные роли нельзя удалять' });

      const assignedUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.roleId, role.id), eq(users.tenantId, req.tenant!.id)));
      if (assignedUsers.length > 0) {
        return res.status(409).json({ error: 'Сначала переведите пользователей с этой роли на другую' });
      }

      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
      await db.delete(roles).where(eq(roles.id, role.id));
      res.json({ deleted: true });
    })
  );

  router.patch(
    '/rbac/users/assign',
    requireAuth,
    requirePermission('rbac:manage'),
    asyncHandler('Ошибка назначения роли', async (req, res) => {
      const data = parseBody(AssignUserRoleSchema, req, res, 'Укажите userId и roleId');
      if (!data) return;

      const db = await getDb();
      const [role] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.id, data.roleId), eq(roles.tenantId, req.tenant!.id)));
      if (!role) return res.status(400).json({ error: 'Роль не найдена в текущем тенанте' });

      const [updated] = await db
        .update(users)
        .set({ roleId: data.roleId })
        .where(and(eq(users.id, data.userId), eq(users.tenantId, req.tenant!.id)))
        .returning();

      if (!updated) return res.status(404).json({ error: 'Пользователь не найден' });
      res.json({ user: sanitizePublicUser(updated) });
    })
  );

  router.patch(
    '/rbac/users/:id/status',
    requireAuth,
    requirePermission('rbac:manage'),
    asyncHandler('Ошибка изменения статуса пользователя', async (req, res) => {
      const data = parseBody(ToggleUserStatusSchema, req, res);
      if (!data) return;

      if (req.params.id === req.actor!.userId && !data.isActive) {
        return res.status(400).json({ error: 'Нельзя деактивировать собственную активную сессию' });
      }

      const db = await getDb();
      const [updated] = await db
        .update(users)
        .set({ isActive: data.isActive })
        .where(and(eq(users.id, req.params.id), eq(users.tenantId, req.tenant!.id)))
        .returning();
      if (!updated) return res.status(404).json({ error: 'Пользователь не найден' });
      res.json({ user: sanitizePublicUser(updated) });
    })
  );

  // Harness, Dify & NATS
  router.get(
    '/harness/workflows',
    requireAuth,
    requireAnyPermission(['harness:execute', 'deals:read']),
    asyncHandler('Ошибка загрузки DeepSeek-Harness workflows', async (req, res) => {
      const runs = await listHarnessRuns(req.tenant!.id);
      res.json({ workflows: HARNESS_WORKFLOWS, runs });
    })
  );

  router.post(
    '/harness/execute',
    harnessRateLimiter,
    requireAuth,
    requirePermission('harness:execute'),
    asyncHandler('Ошибка выполнения сценария Harness', async (req, res) => {
      const data = parseBody(HarnessExecuteSchema, req, res, 'Некорректные параметры запуска');
      if (!data) return;

      try {
        const result = await executeHarnessWorkflow({
          tenantId: req.tenant!.id,
          actorId: req.actor!.userId,
          input: data,
        });
        res.json({ run: result });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Ошибка выполнения сценария Harness';
        res.status(400).json({ error: msg });
      }
    })
  );

  router.get(
    '/nats/events',
    requireAuth,
    requireAnyPermission(['deals:read', 'docs:read', 'harness:execute', 'workflows:read']),
    asyncHandler('Ошибка чтения ленты NATS', async (req, res) => {
      const events = await natsBus.listRecent(req.tenant!.id, 50);
      res.json({ events });
    })
  );

  router.get(
    '/nats/queue',
    requireAuth,
    requireAnyPermission(['workflows:read', 'harness:execute', 'deals:read', 'docs:read']),
    asyncHandler('Ошибка загрузки очереди NATS JetStream', async (req, res) => {
      const snapshot = await natsBus.getQueueSnapshot(req.tenant!.id, req.tenant!.subdomain);
      res.json(snapshot);
    })
  );

  router.post(
    '/nats/publish',
    requireAuth,
    requireAnyPermission(['workflows:manage', 'harness:execute']),
    asyncHandler('Ошибка публикации сообщения в NATS', async (req, res) => {
      const data = parseBody(PublishNatsEventSchema, req, res, 'Некорректные параметры NATS события');
      if (!data) return;

      const tenantId = req.tenant!.id;
      const published = await natsBus.publish(
        tenantId,
        data.subject,
        req.actor!.userId,
        {
          ...data.payload,
          publishedBy: req.actor!.fullName,
          source: 'workflows_nats_visualizer',
        },
        { simulateError: data.simulateError }
      );
      const snapshot = await natsBus.getQueueSnapshot(tenantId, req.tenant!.subdomain);
      const item = snapshot.messages.find((m) => m.id === published.id) || null;
      res.status(201).json({ item, snapshot });
    })
  );

  router.post(
    '/nats/queue/:id/replay',
    requireAuth,
    requireAnyPermission(['workflows:manage', 'harness:execute']),
    asyncHandler('Ошибка повторной отправки сообщения NATS', async (req, res) => {
      const tenantId = req.tenant!.id;
      const replayed = await natsBus.replayMessage(tenantId, req.params.id, req.actor!.userId);
      if (!replayed) {
        return res.status(404).json({ error: 'Сообщение NATS не найдено в текущем тенанте' });
      }
      const snapshot = await natsBus.getQueueSnapshot(tenantId, req.tenant!.subdomain);
      res.status(201).json({ item: replayed, snapshot });
    })
  );

  router.get('/nats/stream', requireAuth, (req: PortalRequest, res) => {
    const tenantId = req.tenant!.id;
    const subdomain = req.tenant!.subdomain;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    res.write(
      `event: connected\ndata: ${JSON.stringify({ tenantId, subdomain, connectedAt: new Date().toISOString() })}\n\n`
    );

    const onMessage = (msg: NatsMessage) => {
      if (res.writableEnded) return;
      res.write(`id: ${msg.id}\nevent: nats\ndata: ${JSON.stringify(msg)}\n\n`);
    };

    const onQueueUpdate = (item: NatsQueueItem) => {
      if (res.writableEnded) return;
      res.write(`id: ${item.id}\nevent: nats_queue\ndata: ${JSON.stringify(item)}\n\n`);
    };

    const channel = `tenant:${tenantId}`;
    const queueChannel = `queue:tenant:${tenantId}`;
    natsBus.on(channel, onMessage);
    natsBus.on(queueChannel, onQueueUpdate);

    const keepAliveTimer = setInterval(() => {
      if (!res.writableEnded) {
        res.write(`: keepalive\n\n`);
      }
    }, 25000);

    const initialDeadlineTimer = setTimeout(() => {
      if (!res.writableEnded) {
        void checkTaskDeadlinesAndReminders({ tenantId }).catch(() => {});
      }
    }, 350);

    req.on('close', () => {
      clearTimeout(initialDeadlineTimer);
      clearInterval(keepAliveTimer);
      natsBus.off(channel, onMessage);
      natsBus.off(queueChannel, onQueueUpdate);
      if (!res.writableEnded) {
        res.end();
      }
    });
  });

  // TinaCMS & Directus
  router.get(
    '/cms/blocks',
    requireAuth,
    requireAnyPermission(['cms:edit', 'deals:read', 'docs:read']),
    asyncHandler('Ошибка загрузки TinaCMS блоков', async (req, res) => {
      const db = await getDb();
      const blocks = await db.select().from(cmsBlocks).where(eq(cmsBlocks.tenantId, req.tenant!.id));
      res.json({ blocks });
    })
  );

  router.post(
    '/cms/blocks',
    requireAuth,
    requirePermission('cms:edit'),
    asyncHandler('Ошибка сохранения TinaCMS блока', async (req, res) => {
      const data = parseBody(CreateCmsBlockSchema, req, res, 'Заполните заголовок и текст блока');
      if (!data) return;

      const db = await getDb();
      const autoSlug =
        data.slug ||
        `${data.sectionType}-${crypto.randomUUID().slice(0, 6)}`;
      const [block] = await db
        .insert(cmsBlocks)
        .values({
          id: `cms_${crypto.randomUUID().slice(0, 8)}`,
          tenantId: req.tenant!.id,
          slug: autoSlug,
          title: data.title,
          sectionType: data.sectionType,
          body: data.body,
          ctaLabel: data.ctaLabel,
          published: data.published,
        })
        .returning();
      res.status(201).json({ block });
    })
  );

  router.patch(
    '/cms/blocks/:id',
    requireAuth,
    requirePermission('cms:edit'),
    asyncHandler('Ошибка обновления TinaCMS блока', async (req, res) => {
      const data = parseBody(UpdateCmsBlockSchema, req, res);
      if (!data) return;

      const db = await getDb();
      const [updated] = await db
        .update(cmsBlocks)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(cmsBlocks.id, req.params.id), eq(cmsBlocks.tenantId, req.tenant!.id)))
        .returning();
      if (!updated) return res.status(404).json({ error: 'CMS блок не найден' });
      res.json({ block: updated });
    })
  );

  router.delete(
    '/cms/blocks/:id',
    requireAuth,
    requirePermission('cms:edit'),
    asyncHandler('Ошибка удаления TinaCMS блока', async (req, res) => {
      const db = await getDb();
      const deleted = await db
        .delete(cmsBlocks)
        .where(and(eq(cmsBlocks.id, req.params.id), eq(cmsBlocks.tenantId, req.tenant!.id)))
        .returning();
      if (!deleted.length) return res.status(404).json({ error: 'CMS блок не найден' });
      res.json({ deleted: true });
    })
  );

  // Git Sync
  router.get(
    '/git/status',
    requireAuth,
    requirePermission('tenants:admin'),
    async (_req, res) => {
      try {
        const status = await getGitWorkspaceStatus();
        res.json(status);
      } catch (err: unknown) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Ошибка чтения git status' });
      }
    }
  );

  router.post(
    '/git/commit-push',
    gitPushRateLimiter,
    requireAuth,
    requirePermission('tenants:admin'),
    async (req: PortalRequest, res) => {
      const data = parseBody(GitCommitPushSchema, req, res, 'Некорректные параметры коммита');
      if (!data) return;

      try {
        const result = await commitAndPushToMain({
          tenantId: req.tenant!.id,
          actorId: req.actor!.userId,
          actorName: req.actor!.fullName,
          actorEmail: req.actor!.email,
          commitMessage: data.commitMessage,
          pat: data.pat,
        });
        res.json(result);
      } catch (err: unknown) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Не удалось отправить изменения в main' });
      }
    }
  );

  // System Health & Resource Telemetry
  router.get(
    '/system/health',
    requireAuth,
    requireAnyPermission(['tenants:admin', 'rbac:manage', 'cms:edit', 'docs:read']),
    asyncHandler('Ошибка сбора телеметрии системы', async (req, res) => {
      const snapshot = await collectSystemHealthSnapshot(req.tenant!.id);
      res.json(snapshot);
    })
  );

  // Prometheus OpenMetrics 0.0.4, JSON & Status
  router.get('/metrics/openmetrics', (req, res) => {
    if (!isMetricsAuthorized(req)) {
      res.status(401).json({ error: 'Для доступа к /api/metrics/openmetrics требуется валидный токен' });
      return;
    }
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(renderPrometheusText());
  });

  router.get('/metrics/json', (req, res) => {
    if (!isMetricsAuthorized(req)) {
      res.status(401).json({ error: 'Для доступа к /api/metrics/json требуется валидный токен' });
      return;
    }
    res.json({
      metrics: buildPrometheusSnapshot(),
      collectedAt: new Date().toISOString(),
    });
  });

  router.get('/metrics/status', (_req, res) => {
    const metrics = buildPrometheusSnapshot();
    res.json({
      status: 'ok',
      requiresToken: Boolean(process.env.METRICS_TOKEN?.trim()),
      metricsCount: metrics.length,
      timestamp: new Date().toISOString(),
    });
  });

  // Architecture Decision Records (ADR) Registry
  router.get(
    '/adrs',
    requireAuth,
    requireAnyPermission(['docs:read', 'tenants:admin', 'rbac:manage']),
    asyncHandler('Ошибка загрузки реестра ADR', async (_req, res) => {
      res.json({ adrs: listAdrs() });
    })
  );

  router.post(
    '/adrs',
    requireAuth,
    requirePermission('tenants:admin'),
    asyncHandler('Не удалось создать запись ADR', async (req, res) => {
      const data = parseBody(CreateAdrSchema, req, res, 'Некорректные данные ADR');
      if (!data) return;
      try {
        const adr = createAdrRecord(data);
        await natsBus.publish(req.tenant!.id, `platform.${req.tenant!.subdomain}.adr.created`, req.actor!.userId, {
          number: adr.number,
          title: adr.title,
          version: adr.version,
        });
        res.status(201).json({ adr });
      } catch (err: unknown) {
        res.status(409).json({ error: err instanceof Error ? err.message : 'Конфликт номера ADR' });
      }
    })
  );

  // Global Cross-Entity Portal Search (Ctrl+K)
  router.get(
    '/search',
    requireAuth,
    asyncHandler('Ошибка глобального поиска по порталу', async (req, res) => {
      const query = String(req.query.q || '').trim();
      const rawType = String(req.query.type || 'all').trim();
      const validTypes: GlobalSearchEntityType[] = [
        'all',
        'deal',
        'contact',
        'company',
        'task',
        'document',
        'cms',
        'adr',
      ];
      const filterType = (validTypes.includes(rawType as GlobalSearchEntityType)
        ? rawType
        : 'all') as GlobalSearchEntityType;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const actor = req.actor!;
      const hiddenFields = new Set(actor.hiddenFields || []);
      const canDeals = PolicyEvaluator.hasPermission(actor.permissions, 'deals:read');
      const canContacts = PolicyEvaluator.hasPermission(actor.permissions, 'contacts:read');
      const canTasks = PolicyEvaluator.hasPermission(actor.permissions, 'tasks:read');
      const canOffice = PolicyEvaluator.hasPermission(actor.permissions, 'docs:read');
      const canCms = PolicyEvaluator.hasAnyPermission(actor.permissions, [
        'cms:edit',
        'deals:read',
        'docs:read',
      ]);
      const canDocs = PolicyEvaluator.hasAnyPermission(actor.permissions, [
        'docs:read',
        'tenants:admin',
        'rbac:manage',
      ]);

      const [
        dealRows,
        stageRows,
        userRows,
        contactRows,
        companyRows,
        taskRows,
        docRows,
        cmsRows,
      ] = await Promise.all([
        canDeals ? db.select().from(deals).where(eq(deals.tenantId, tenantId)) : Promise.resolve([]),
        canDeals
          ? db.select().from(pipelineStages).where(eq(pipelineStages.tenantId, tenantId))
          : Promise.resolve([]),
        db.select().from(users).where(eq(users.tenantId, tenantId)),
        canContacts
          ? db.select().from(contacts).where(eq(contacts.tenantId, tenantId))
          : Promise.resolve([]),
        canContacts
          ? db.select().from(companies).where(eq(companies.tenantId, tenantId))
          : Promise.resolve([]),
        canTasks ? db.select().from(tasks).where(eq(tasks.tenantId, tenantId)) : Promise.resolve([]),
        canOffice
          ? db.select().from(officeDocuments).where(eq(officeDocuments.tenantId, tenantId))
          : Promise.resolve([]),
        canCms ? db.select().from(cmsBlocks).where(eq(cmsBlocks.tenantId, tenantId)) : Promise.resolve([]),
      ]);

      const stageById = new Map(stageRows.map((s) => [s.id, s]));
      const userById = new Map(userRows.map((u) => [u.id, u.fullName]));
      const indexDocs: GlobalSearchDocument[] = [];

      for (const deal of dealRows) {
        if (actor.dataScope === 'own' && deal.ownerId !== actor.userId) continue;
        const stageName = stageById.get(deal.stageId)?.name || 'Воронка';
        const ownerName = userById.get(deal.ownerId) || 'Менеджер';
        const priority = String((deal.customFields as Record<string, string>)?.priority || '');
        const budgetText = hiddenFields.has('budget')
          ? 'Скрыто ACL'
          : `${deal.budget.toLocaleString('ru-RU')} ${deal.currency}`;

        indexDocs.push({
          id: deal.id,
          type: 'deal',
          title: deal.title,
          subtitle: `${stageName} · ${ownerName}`,
          badge: priority ? `Сделка · ${priority}` : 'Сделка',
          snippet: `Бюджет: ${budgetText}${deal.tags?.length ? ` · Теги: ${(deal.tags as string[]).join(', ')}` : ''}`,
          targetSection: 'deals',
          keywords: [
            deal.id,
            stageName,
            ownerName,
            priority,
            ...((deal.tags as string[]) || []),
          ],
          rawText: `${deal.title} ${stageName} ${ownerName} ${budgetText} ${priority} ${((deal.tags as string[]) || []).join(' ')}`,
          priorityWeight: 5,
          meta: { entityId: deal.id, stageName, budget: hiddenFields.has('budget') ? null : deal.budget },
        });
      }

      for (const contact of contactRows) {
        const phoneMasked = hiddenFields.has('phone') ? '*** (скрыто ACL)' : contact.phone;
        const emailMasked = hiddenFields.has('email') ? '*** (скрыто ACL)' : contact.email;
        const companyMasked = hiddenFields.has('companyName')
          ? '***'
          : contact.companyName || 'Частный клиент';

        indexDocs.push({
          id: contact.id,
          type: 'contact',
          title: contact.fullName,
          subtitle: `${contact.position || 'Контакт'} · ${companyMasked}`,
          badge: 'Контакт',
          snippet: `Тел: ${phoneMasked} · Email: ${emailMasked}`,
          targetSection: 'contacts',
          keywords: [
            contact.id,
            hiddenFields.has('phone') ? '' : contact.phone,
            hiddenFields.has('email') ? '' : contact.email,
            hiddenFields.has('companyName') ? '' : contact.companyName || '',
            ...((contact.tags as string[]) || []),
          ].filter(Boolean),
          rawText: `${contact.fullName} ${contact.position} ${companyMasked} ${hiddenFields.has('phone') ? '' : contact.phone} ${hiddenFields.has('email') ? '' : contact.email}`,
          priorityWeight: 4,
          meta: { entityId: contact.id },
        });
      }

      for (const company of companyRows) {
        const companyTitle = hiddenFields.has('companyName') ? `Компания #${company.id.slice(-4)}` : company.name;
        const companyPhone = hiddenFields.has('phone') ? '***' : company.phone;
        indexDocs.push({
          id: company.id,
          type: 'company',
          title: companyTitle,
          subtitle: company.industry || 'B2B контрагент',
          badge: 'Компания',
          snippet: `Сайт: ${company.website || '—'} · Тел: ${companyPhone}`,
          targetSection: 'contacts',
          keywords: [company.id, companyTitle, company.industry || '', company.website || ''].filter(Boolean),
          rawText: `${companyTitle} ${company.industry} ${company.website} ${companyPhone}`,
          priorityWeight: 3,
          meta: { entityId: company.id },
        });
      }

      for (const task of taskRows) {
        if (actor.dataScope === 'own' && task.assigneeId !== actor.userId) continue;
        const assigneeName = userById.get(task.assigneeId) || 'Исполнитель';
        indexDocs.push({
          id: task.id,
          type: 'task',
          title: task.title,
          subtitle: `${assigneeName} · ${task.completed ? 'Выполнена' : 'В работе'}`,
          badge: task.completed ? 'Задача · Готово' : 'Задача',
          snippet: `Тип: ${task.taskType} · Срок: ${new Date(task.dueAt).toLocaleDateString('ru-RU')}`,
          targetSection: 'tasks',
          keywords: [task.id, task.taskType, assigneeName],
          rawText: `${task.title} ${task.taskType} ${assigneeName} ${task.completed ? 'выполнена' : 'открыта'}`,
          priorityWeight: task.completed ? 1 : 4,
          meta: { entityId: task.id },
        });
      }

      for (const doc of docRows) {
        const docSummary = `${doc.bucketName}/${doc.objectKey} · ${Math.max(1, Math.round(doc.sizeBytes / 1024))} КБ${doc.latestCommitSha ? ` · ${doc.latestCommitSha.slice(0, 7)}` : ''}`;
        indexDocs.push({
          id: doc.id,
          type: 'document',
          title: doc.title,
          subtitle: `Univer ${doc.kind.toUpperCase()} · S3 + Git`,
          badge: doc.kind.toUpperCase(),
          snippet: docSummary,
          targetSection: 'office',
          keywords: [doc.id, doc.kind, doc.title, doc.objectKey],
          rawText: `${doc.title} ${doc.kind} ${docSummary}`,
          priorityWeight: 3,
          meta: { entityId: doc.id, kind: doc.kind },
        });
      }

      for (const block of cmsRows) {
        indexDocs.push({
          id: block.id,
          type: 'cms',
          title: block.title,
          subtitle: `Directus / TinaCMS · ${block.sectionType}`,
          badge: block.published ? 'CMS Опубликован' : 'CMS Черновик',
          snippet: block.body.slice(0, 120),
          targetSection: 'collections',
          keywords: [block.id, block.slug, block.sectionType],
          rawText: `${block.title} ${block.slug} ${block.sectionType} ${block.body}`,
          priorityWeight: 2,
          meta: { entityId: block.id },
        });
      }

      if (canDocs) {
        for (const adr of listAdrs()) {
          indexDocs.push({
            id: adr.id,
            type: 'adr',
            title: `ADR-${adr.number}: ${adr.title}`,
            subtitle: `${adr.status} · v${adr.version} · ${adr.date}`,
            badge: `ADR-${adr.number}`,
            snippet: adr.decision.slice(0, 120),
            targetSection: 'devtools',
            keywords: [adr.number, `adr-${adr.number}`, adr.version, adr.status, adr.deciders],
            rawText: `ADR-${adr.number} ${adr.title} ${adr.context} ${adr.decision} ${adr.consequences}`,
            priorityWeight: 2,
            meta: { entityId: adr.id },
          });
        }
      }

      const results = rankSearchDocuments(indexDocs, query, filterType, 30);
      res.json({
        query,
        filterType,
        totalIndexed: indexDocs.length,
        results,
      });
    })
  );

  return router;
}
