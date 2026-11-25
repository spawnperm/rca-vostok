import crypto from 'crypto';
import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { PluginPackageAggregate } from '../../domain/marketplace/aggregate.ts';
import {
  InstallPluginSchema,
  PublishVerdaccioPluginSchema,
  TogglePluginSchema,
  UpdatePluginConfigSchema,
} from '../../domain/marketplace/plugin.ts';
import { DomainInvariantError } from '../../domain/shared/ddd.ts';
import { getDb } from '../../infrastructure/db/client.ts';
import { plugins, tenantPlugins } from '../../infrastructure/db/schema.ts';
import { checkInstalledPluginsHealth } from '../../infrastructure/marketplace/pluginHealthService.ts';
import { natsBus } from '../../infrastructure/nats/eventBus.ts';
import {
  buildModuleTarball,
  buildVerdaccioPackument,
  executeModuleDomainPreview,
  getPluginModuleDescriptor,
  listExtractedVerdaccioModules,
  probeLiveVerdaccioRegistry,
} from '../../infrastructure/verdaccio/registryService.ts';
import { requireAuth, requirePermission } from '../middleware/tenantAndAuth.ts';
import { asyncHandler, parseBody } from './routeHelpers.ts';

export function createMarketplaceRouter(): Router {
  const router = Router();

  router.get(
    '/marketplace/plugins',
    requireAuth,
    requirePermission('plugins:read'),
    asyncHandler('Ошибка загрузки Маркета плагинов', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [allPlugins, installedRows, registryProbe] = await Promise.all([
        db.select().from(plugins).orderBy(desc(plugins.downloads)),
        db.select().from(tenantPlugins).where(eq(tenantPlugins.tenantId, tenantId)),
        probeLiveVerdaccioRegistry(),
      ]);

      const workspaceModules = listExtractedVerdaccioModules();
      const workspaceByName = new Map(workspaceModules.map((m) => [m.packageName, m]));

      const catalog = allPlugins.map((plg) => {
        const inst = installedRows.find((i) => i.pluginId === plg.id);
        const ws = workspaceByName.get(plg.npmPackageName);
        const descMod = getPluginModuleDescriptor(plg.npmPackageName);
        return {
          ...plg,
          tarballSha512: ws?.tarballSha512 || plg.tarballSha512,
          installed: Boolean(inst),
          enabled: inst ? inst.enabled : false,
          tenantConfig: inst ? inst.config : plg.defaultConfig,
          installationId: inst?.id || null,
          dddModule: ws
            ? {
                extracted: true,
                directory: ws.directory,
                boundedContext: ws.boundedContext,
                contextMapping: ws.contextMapping,
                aggregates: ws.aggregates,
                valueObjects: ws.valueObjects,
                publishedEvents: ws.publishedEvents,
                subscribedSubjects: ws.subscribedSubjects,
                tarballUrl: ws.tarballUrl,
                tarballBytes: ws.tarballBytes,
                filesCount: ws.files.length,
                executable: Boolean(descMod),
              }
            : null,
        };
      });

      res.json({
        verdaccioEndpoint: registryProbe.endpoint,
        registryMode: registryProbe.mode,
        liveVerdaccioReachable: registryProbe.liveReachable,
        extractedModulesCount: workspaceModules.length,
        plugins: catalog,
      });
    })
  );

  router.get(
    '/marketplace/verdaccio/modules',
    requireAuth,
    requirePermission('plugins:read'),
    asyncHandler('Ошибка загрузки DDD-модулей Verdaccio', async (_req, res) => {
      const [modules, registryProbe] = await Promise.all([
        Promise.resolve(listExtractedVerdaccioModules()),
        probeLiveVerdaccioRegistry(),
      ]);
      res.json({
        verdaccioEndpoint: registryProbe.endpoint,
        registryMode: registryProbe.mode,
        liveVerdaccioReachable: registryProbe.liveReachable,
        scopes: ['@nexus-core/*', '@nexus-plugins/*'],
        modules,
      });
    })
  );

  router.get(
    '/marketplace/verdaccio/registry/:scope/:pkg',
    requireAuth,
    requirePermission('plugins:read'),
    asyncHandler('Ошибка чтения Packument из реестра Verdaccio', async (req, res) => {
      const packageName = `${req.params.scope}/${req.params.pkg}`;
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const packument = buildVerdaccioPackument(packageName, baseUrl);
      if (!packument) {
        return res.status(404).json({ error: `Пакет ${packageName} не найден в workspace Verdaccio` });
      }
      res.json(packument);
    })
  );

  router.get(
    '/marketplace/verdaccio/tarball/:scope/:pkg/:filename',
    requireAuth,
    requirePermission('plugins:read'),
    asyncHandler('Ошибка сборки архива .tgz из модуля', async (req, res) => {
      const packageName = `${req.params.scope}/${req.params.pkg}`;
      const tarball = buildModuleTarball(packageName);
      if (!tarball) {
        return res.status(404).json({ error: `Tarball для ${packageName} не найден` });
      }
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Disposition', `attachment; filename="${tarball.filename}"`);
      res.setHeader('X-Verdaccio-Integrity', tarball.sha512);
      res.send(tarball.buffer);
    })
  );

  router.post(
    '/marketplace/modules/:slug/verify',
    requireAuth,
    requirePermission('plugins:read'),
    asyncHandler('Ошибка выполнения проверки DDD-модуля', async (req, res) => {
      const slug = req.params.slug;
      const packageName = slug.startsWith('@') ? slug : `@nexus-plugins/${slug}`;

      const db = await getDb();
      const [plg] = await db.select().from(plugins).where(eq(plugins.npmPackageName, packageName));
      let tenantConfig: Record<string, unknown> = {};
      if (plg) {
        const [inst] = await db
          .select()
          .from(tenantPlugins)
          .where(and(eq(tenantPlugins.tenantId, req.tenant!.id), eq(tenantPlugins.pluginId, plg.id)));
        tenantConfig = (inst?.config || plg.defaultConfig || {}) as Record<string, unknown>;
      }

      const body = (req.body || {}) as { config?: Record<string, unknown>; input?: Record<string, unknown> };
      const execution = executeModuleDomainPreview(
        packageName,
        { ...tenantConfig, ...(body.config || {}) },
        body.input
      );
      if (!execution.ok) {
        return res.status(400).json({ error: execution.error });
      }

      await natsBus.publish(
        req.tenant!.id,
        `marketplace.${req.tenant!.subdomain}.module.verified`,
        req.actor!.userId,
        {
          npmPackageName: execution.packageName,
          boundedContext: execution.boundedContext,
          contextMapping: execution.contextMapping,
        }
      );

      res.json(execution);
    })
  );

  router.post(
    '/marketplace/plugins/install',
    requireAuth,
    requirePermission('plugins:manage'),
    asyncHandler('Ошибка установки плагина', async (req, res) => {
      const data = parseBody(InstallPluginSchema, req, res, 'Не указан pluginId');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [plg] = await db.select().from(plugins).where(eq(plugins.id, data.pluginId));
      if (!plg) return res.status(404).json({ error: 'Пакет плагина не найден в Verdaccio' });

      const [existing] = await db
        .select()
        .from(tenantPlugins)
        .where(and(eq(tenantPlugins.tenantId, tenantId), eq(tenantPlugins.pluginId, plg.id)));

      if (existing) {
        const [updated] = await db
          .update(tenantPlugins)
          .set({ enabled: true })
          .where(eq(tenantPlugins.id, existing.id))
          .returning();
        return res.json({ installation: updated });
      }

      const [inst] = await db
        .insert(tenantPlugins)
        .values({
          id: `tp_${crypto.randomUUID().slice(0, 10)}`,
          tenantId,
          pluginId: plg.id,
          enabled: true,
          config: plg.defaultConfig,
          installedBy: req.actor!.userId,
        })
        .returning();

      await db
        .update(plugins)
        .set({ downloads: plg.downloads + 1 })
        .where(eq(plugins.id, plg.id));

      await natsBus.publish(tenantId, `marketplace.${req.tenant!.subdomain}.plugin.installed`, req.actor!.userId, {
        npmPackageName: plg.npmPackageName,
        version: plg.version,
      });

      res.status(201).json({ installation: inst });
    })
  );

  router.delete(
    '/marketplace/plugins/:id',
    requireAuth,
    requirePermission('plugins:manage'),
    asyncHandler('Ошибка удаления плагина из тенанта', async (req, res) => {
      const db = await getDb();
      const tenantId = req.tenant!.id;
      const deleted = await db
        .delete(tenantPlugins)
        .where(and(eq(tenantPlugins.tenantId, tenantId), eq(tenantPlugins.pluginId, req.params.id)))
        .returning();
      if (!deleted.length) return res.status(404).json({ error: 'Плагин не установлен в данном тенанте' });

      await natsBus.publish(tenantId, `marketplace.${req.tenant!.subdomain}.plugin.uninstalled`, req.actor!.userId, {
        pluginId: req.params.id,
      });
      res.json({ deleted: true });
    })
  );

  router.patch(
    '/marketplace/plugins/:id/toggle',
    requireAuth,
    requirePermission('plugins:manage'),
    asyncHandler('Ошибка переключения плагина', async (req, res) => {
      const data = parseBody(TogglePluginSchema, req, res, 'Некорректный статус плагина');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [existing] = await db
        .select()
        .from(tenantPlugins)
        .where(and(eq(tenantPlugins.tenantId, tenantId), eq(tenantPlugins.pluginId, req.params.id)));
      if (!existing) return res.status(404).json({ error: 'Плагин не установлен для этого тенанта' });

      const [updated] = await db
        .update(tenantPlugins)
        .set({ enabled: data.enabled })
        .where(eq(tenantPlugins.id, existing.id))
        .returning();

      await natsBus.publish(tenantId, `marketplace.${req.tenant!.subdomain}.plugin.toggled`, req.actor!.userId, {
        pluginId: req.params.id,
        enabled: data.enabled,
      });

      res.json({ installation: updated });
    })
  );

  router.patch(
    '/marketplace/plugins/:id/config',
    requireAuth,
    requirePermission('plugins:manage'),
    asyncHandler('Ошибка сохранения конфигурации плагина', async (req, res) => {
      const data = parseBody(UpdatePluginConfigSchema, req, res, 'Некорректная конфигурация JSON');
      if (!data) return;

      const db = await getDb();
      const tenantId = req.tenant!.id;
      const [updated] = await db
        .update(tenantPlugins)
        .set({ config: data.config })
        .where(and(eq(tenantPlugins.tenantId, tenantId), eq(tenantPlugins.pluginId, req.params.id)))
        .returning();

      if (!updated) return res.status(404).json({ error: 'Установка плагина не найдена' });
      res.json({ installation: updated });
    })
  );

  router.post(
    '/marketplace/plugins/health-check',
    requireAuth,
    requirePermission('plugins:read'),
    asyncHandler('Ошибка проверки зависимостей плагинов', async (req, res) => {
      const schema = z.object({ pluginId: z.string().trim().min(1).optional() }).optional();
      const data = parseBody(schema, req, res, 'Некорректные параметры проверки плагинов');
      if (data === null && req.body !== undefined && Object.keys(req.body || {}).length > 0) return;

      const report = await checkInstalledPluginsHealth({
        tenantId: req.tenant!.id,
        subdomain: req.tenant!.subdomain,
        actorId: req.actor!.userId,
        pluginId: data?.pluginId,
      });
      res.json(report);
    })
  );

  router.post(
    '/marketplace/verdaccio/publish',
    requireAuth,
    requirePermission('plugins:manage'),
    asyncHandler('Пакет с таким именем уже существует или ошибка Verdaccio', async (req, res) => {
      const data = parseBody(PublishVerdaccioPluginSchema, req, res, 'Ошибка манифеста Verdaccio');
      if (!data) return;

      const db = await getDb();
      const [existing] = await db
        .select({ id: plugins.id })
        .from(plugins)
        .where(eq(plugins.npmPackageName, data.npmPackageName));
      if (existing) {
        return res.status(409).json({ error: `Пакет ${data.npmPackageName} уже опубликован в Verdaccio` });
      }

      const verdaccioBase = process.env.VERDACCIO_URL || 'http://localhost:4873';
      const id = `plg_${crypto.randomUUID().slice(0, 8)}`;
      const sha = `sha512-${crypto
        .createHash('sha512')
        .update(data.npmPackageName + data.version)
        .digest('base64')}`;

      let agg: PluginPackageAggregate;
      try {
        agg = PluginPackageAggregate.publishNew({
          id,
          npmPackageName: data.npmPackageName,
          version: data.version,
          title: data.name,
          category: data.category,
          author: data.author,
          description: data.description,
          slot: data.slot,
          registryUrl: verdaccioBase,
          tarballSha512: sha,
          tenantId: req.tenant!.id,
          actorId: req.actor!.userId,
        });
      } catch (err: unknown) {
        if (err instanceof DomainInvariantError) {
          return res.status(400).json({ error: err.message, code: err.code });
        }
        throw err;
      }

      const [created] = await db
        .insert(plugins)
        .values({
          ...agg.persistenceRecord,
          downloads: 1,
        })
        .returning();

      for (const evt of agg.pullDomainEvents()) {
        await natsBus.publish(req.tenant!.id, evt.subject, req.actor!.userId, evt.payload);
      }

      res.status(201).json({ plugin: created });
    })
  );

  return router;
}
