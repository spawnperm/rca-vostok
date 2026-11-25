import { Router } from 'express';
import { count, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { buildTraefikHostRule, CreateTenantSchema, UpdateTenantSchema } from '../../domain/tenancy/tenant.ts';
import { getDb, getDatabaseEngineInfo } from '../../infrastructure/db/client.ts';
import {
  pipelineStages,
  pipelines,
  rolePermissions,
  roles,
  socialGroups,
  tenants,
  users,
} from '../../infrastructure/db/schema.ts';
import { verifyPasswordHash } from '../../infrastructure/db/seed.ts';
import { mattermostHub } from '../../infrastructure/mattermost/wsServer.ts';
import { natsBus } from '../../infrastructure/nats/eventBus.ts';
import { buildOpenApiSpec } from '../../infrastructure/openapi/spec.ts';
import { generateTraefikDynamicConfig } from '../../infrastructure/traefik/routerGenerator.ts';
import { formatPrometheusMetrics, getHttpMetricsSnapshot } from '../middleware/observability.ts';
import { createRateLimitMiddleware } from '../middleware/security.ts';
import { requireAuth, requirePermission, signSessionToken } from '../middleware/tenantAndAuth.ts';
import type { PortalRequest } from '../middleware/tenantAndAuth.ts';
import { asyncHandler, parseBody } from './routeHelpers.ts';

export function createHealthAndMetricsRouter(): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    const started = performance.now();
    const dbInfo = getDatabaseEngineInfo();
    try {
      const db = await getDb();
      await db.execute(sql`SELECT 1`);
      const latencyMs = Math.max(1, Math.round(performance.now() - started));
      res.json({
        ok: true,
        status: 'ok',
        uptimeSeconds: Math.floor(process.uptime()),
        database: { ...dbInfo, ok: true, latencyMs },
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const latencyMs = Math.max(1, Math.round(performance.now() - started));
      res.status(503).json({
        ok: false,
        status: 'degraded',
        uptimeSeconds: Math.floor(process.uptime()),
        database: {
          ...dbInfo,
          ok: false,
          latencyMs,
          error: err instanceof Error ? err.message : 'Database probe failed',
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  router.get('/ready', async (_req, res) => {
    try {
      const db = await getDb();
      const [tenantCountRow] = await db.select({ total: count() }).from(tenants);
      const totalTenants = Number(tenantCountRow?.total ?? 0);
      if (totalTenants === 0) {
        return res.status(503).json({
          ready: false,
          reason: 'База данных ещё не инициализирована сидом тенантов',
          timestamp: new Date().toISOString(),
        });
      }
      res.json({
        ready: true,
        tenantsCount: totalTenants,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      res.status(503).json({
        ready: false,
        reason: err instanceof Error ? err.message : 'Readiness probe failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  router.get('/metrics', (req, res) => {
    const extras = {
      wsConnections: mattermostHub.getClientCount(),
      sseSubscribers: natsBus.getSubscriberCount(),
    };
    const wantsJson =
      req.query.format === 'json' ||
      (typeof req.headers.accept === 'string' && req.headers.accept.includes('application/json'));
    if (wantsJson) {
      return res.json(getHttpMetricsSnapshot(extras));
    }
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(formatPrometheusMetrics(extras));
  });

  router.get('/openapi.json', (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.json(buildOpenApiSpec(baseUrl));
  });

  return router;
}

export function createAuthAndTenancyRouter(): Router {
  const router = Router();

  const authRateLimiter = createRateLimitMiddleware({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
    maxRequests: Number(process.env.RATE_LIMIT_AUTH_MAX || 120),
    keyPrefix: 'auth_login',
    message: 'Превышен лимит попыток входа. Повторите через минуту.',
  });

  router.get(
    '/auth/demo-accounts',
    asyncHandler('Не удалось загрузить учетные записи', async (req, res) => {
      const db = await getDb();
      const [allUsers, allRoles, allTenants] = await Promise.all([
        db
          .select({
            id: users.id,
            email: users.email,
            fullName: users.fullName,
            roleId: users.roleId,
            avatarUrl: users.avatarUrl,
            tenantId: users.tenantId,
          })
          .from(users)
          .where(eq(users.isActive, true)),
        db.select().from(roles),
        db.select().from(tenants),
      ]);

      const accounts = allUsers.map((u) => {
        const role = allRoles.find((r) => r.id === u.roleId);
        const tenant = allTenants.find((t) => t.id === u.tenantId);
        return {
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          avatarUrl: u.avatarUrl,
          roleName: role?.name || 'User',
          roleCode: role?.code || 'user',
          tenantId: u.tenantId,
          tenantSubdomain: tenant?.subdomain || 'acme',
        };
      });
      res.json({ accounts, activeTenant: req.tenant });
    })
  );

  router.post(
    '/auth/login',
    authRateLimiter,
    asyncHandler('Ошибка аутентификации', async (req, res) => {
      const schema = z
        .object({
          userId: z.string().min(1).optional(),
          email: z.string().email().optional(),
          password: z.string().optional(),
        })
        .refine((d) => Boolean(d.userId || d.email), { message: 'Укажите userId или email' });
      const data = parseBody(schema, req, res, 'Некорректные данные входа');
      if (!data) return;

      const db = await getDb();
      let userRow;
      if (data.userId) {
        const rows = await db.select().from(users).where(eq(users.id, data.userId));
        userRow = rows[0];
      } else if (data.email) {
        if (!data.password) {
          return res.status(400).json({ error: 'Для входа по email требуется пароль' });
        }
        const rows = await db.select().from(users).where(eq(users.email, data.email));
        userRow = rows[0];
        if (userRow && !verifyPasswordHash(data.password, userRow.passwordHash)) {
          return res.status(401).json({ error: 'Неверный email или пароль' });
        }
      }

      if (!userRow || !userRow.isActive) {
        return res.status(401).json({ error: 'Пользователь не найден или деактивирован' });
      }

      const [roleRow] = await db.select().from(roles).where(eq(roles.id, userRow.roleId));
      const permRows = roleRow
        ? await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, roleRow.id))
        : [];
      const token = signSessionToken(userRow.id, userRow.tenantId);

      res.json({
        token,
        actor: {
          userId: userRow.id,
          email: userRow.email,
          fullName: userRow.fullName,
          tenantId: userRow.tenantId,
          roleId: roleRow?.id || userRow.roleId,
          roleName: roleRow?.name || 'User',
          permissions: permRows.map((p) => p.permission),
          dataScope: roleRow?.dataScope === 'own' ? 'own' : 'all',
          hiddenFields: Array.isArray(roleRow?.hiddenFields) ? roleRow.hiddenFields : [],
          avatarUrl: userRow.avatarUrl,
        },
      });
    })
  );

  router.get('/auth/me', requireAuth, (req: PortalRequest, res) => {
    res.json({ actor: req.actor, tenant: req.tenant });
  });

  router.get(
    '/tenancy/tenants',
    requireAuth,
    requirePermission('tenants:admin'),
    asyncHandler('Ошибка загрузки списка тенантов', async (_req, res) => {
      const db = await getDb();
      const all = await db.select().from(tenants).orderBy(tenants.createdAt);
      res.json({ tenants: all });
    })
  );

  router.post(
    '/tenancy/tenants',
    requireAuth,
    requirePermission('tenants:admin'),
    asyncHandler('Поддомен уже занят или ошибка создания тенанта', async (req, res) => {
      const data = parseBody(CreateTenantSchema, req, res, 'Некорректные данные тенанта');
      if (!data) return;

      const db = await getDb();
      const [existing] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.subdomain, data.subdomain));
      if (existing) {
        return res.status(409).json({ error: `Поддомен ${data.subdomain} уже занят` });
      }

      const tenantId = `tnt_${data.subdomain}`;
      const [created] = await db
        .insert(tenants)
        .values({
          id: tenantId,
          name: data.name,
          subdomain: data.subdomain,
          plan: data.plan,
          status: 'active',
          maxUsers: data.maxUsers,
          maxDeals: data.maxDeals,
          traefikRule: buildTraefikHostRule(data.subdomain),
        })
        .returning();

      const pipId = `pip_${data.subdomain}_main`;
      await db.insert(pipelines).values({
        id: pipId,
        tenantId,
        name: 'Основная воронка',
        isDefault: true,
      });

      const stages = [
        { key: 'unsorted', name: 'Неразобранное', color: '#64748B', sortOrder: 1, isWon: false, isLost: false },
        { key: 'contact', name: 'Первичный контакт', color: '#3B82F6', sortOrder: 2, isWon: false, isLost: false },
        { key: 'negotiation', name: 'Переговоры', color: '#8B5CF6', sortOrder: 3, isWon: false, isLost: false },
        { key: 'won', name: 'Успешно реализовано', color: '#16A34A', sortOrder: 4, isWon: true, isLost: false },
        { key: 'lost', name: 'Закрыто и не реализовано', color: '#DC2626', sortOrder: 5, isWon: false, isLost: true },
      ];
      await db.insert(pipelineStages).values(
        stages.map((st) => ({
          id: `stg_${tenantId}_${st.key}`,
          tenantId,
          pipelineId: pipId,
          name: st.name,
          color: st.color,
          sortOrder: st.sortOrder,
          isWon: st.isWon,
          isLost: st.isLost,
        }))
      );

      await db.insert(socialGroups).values({
        id: `grp_${data.subdomain}_hq`,
        tenantId,
        name: `Портал команды ${data.name}`,
        description: `Стартовое сообщество поддомена ${data.subdomain}.platform.local`,
        category: 'Портал',
        membersCount: 1,
        isJoined: true,
      });

      await natsBus.publish(req.tenant!.id, 'tenancy.subdomain.provisioned', req.actor!.userId, {
        tenantId,
        subdomain: data.subdomain,
        traefikRule: created.traefikRule,
      });

      res.status(201).json({ tenant: created });
    })
  );

  router.patch(
    '/tenancy/tenants/:id',
    requireAuth,
    requirePermission('tenants:admin'),
    asyncHandler('Ошибка обновления тенанта', async (req, res) => {
      const data = parseBody(UpdateTenantSchema, req, res, 'Некорректные параметры тенанта');
      if (!data) return;

      const db = await getDb();
      const [updated] = await db.update(tenants).set(data).where(eq(tenants.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ error: 'Тенант не найден' });

      await natsBus.publish(req.tenant!.id, 'tenancy.subdomain.updated', req.actor!.userId, {
        tenantId: updated.id,
        status: updated.status,
      });

      res.json({ tenant: updated });
    })
  );

  router.get(
    '/tenancy/traefik-config',
    requireAuth,
    requirePermission('tenants:admin'),
    asyncHandler('Ошибка генерации конфигурации Traefik', async (_req, res) => {
      const config = await generateTraefikDynamicConfig();
      res.json(config);
    })
  );

  return router;
}
