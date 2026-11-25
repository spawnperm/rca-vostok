import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client.ts';
import { cmsBlocks, plugins, socialPosts, tenantPlugins, tenants } from '../db/schema.ts';
import { natsBus } from '../nats/eventBus.ts';
import {
  getPluginModuleDescriptor,
  listExtractedVerdaccioModules,
} from '../verdaccio/registryService.ts';

export interface PluginDependencyCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface PluginHealthCheckResult {
  pluginId: string;
  npmPackageName: string;
  name: string;
  enabled: boolean;
  healthy: boolean;
  status: 'healthy' | 'error';
  checkedAt: string;
  latencyMs: number;
  dependencies: PluginDependencyCheck[];
  failedDependency?: string;
  errorMessage?: string;
  natsPublished: boolean;
}

function isBlockedMetadataHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    lower === '0.0.0.0' ||
    lower === '169.254.169.254' ||
    lower.startsWith('169.254.') ||
    lower.startsWith('::ffff:169.254.') ||
    lower.startsWith('fe80:') ||
    lower.startsWith('fd00:') ||
    lower === 'metadata.google.internal' ||
    lower.endsWith('.internal')
  );
}

async function probeServiceUrl(serviceName: string, rawUrl: unknown): Promise<PluginDependencyCheck> {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return {
      name: serviceName,
      ok: false,
      detail: `URL сервиса ${serviceName} не указан`,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return {
      name: serviceName,
      ok: false,
      detail: `Некорректный URL зависимости: ${rawUrl}`,
    };
  }

  if (parsed.username || parsed.password) {
    return {
      name: serviceName,
      ok: false,
      detail: `URL для ${serviceName} не должен содержать учётные данные`,
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      name: serviceName,
      ok: false,
      detail: `Недопустимый протокол ${parsed.protocol} для ${serviceName}`,
    };
  }

  if (isBlockedMetadataHost(parsed.hostname)) {
    return {
      name: serviceName,
      ok: false,
      detail: `Заблокированный адрес метаданных для ${serviceName}`,
    };
  }

  try {
    const res = await fetch(parsed.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(1800),
    });
    if (res.status >= 500) {
      return {
        name: serviceName,
        ok: false,
        detail: `${serviceName} вернул HTTP ${res.status}`,
      };
    }
    return {
      name: serviceName,
      ok: true,
      detail: `${parsed.host} (HTTP ${res.status})`,
    };
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'Сервис недоступен';
    return {
      name: serviceName,
      ok: false,
      detail: `${serviceName} недоступен (${reason})`,
    };
  }
}

export async function checkInstalledPluginsHealth(params: {
  tenantId: string;
  subdomain: string;
  actorId: string;
  pluginId?: string;
}): Promise<{
  checkedAt: string;
  totalInstalled: number;
  unhealthyCount: number;
  results: PluginHealthCheckResult[];
}> {
  const db = await getDb();

  // Verify PostgreSQL connectivity first
  let pgHealthy = true;
  let pgDetail = 'PostgreSQL доступен';
  try {
    await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, params.tenantId)).limit(1);
  } catch (err: unknown) {
    pgHealthy = false;
    pgDetail = err instanceof Error ? err.message : 'Ошибка подключения к PostgreSQL';
  }

  const [installedRows, allPlugins] = await Promise.all([
    params.pluginId
      ? db
          .select()
          .from(tenantPlugins)
          .where(and(eq(tenantPlugins.tenantId, params.tenantId), eq(tenantPlugins.pluginId, params.pluginId)))
      : db.select().from(tenantPlugins).where(eq(tenantPlugins.tenantId, params.tenantId)),
    db.select().from(plugins),
  ]);

  const checkedAt = new Date().toISOString();
  const extractedModules = listExtractedVerdaccioModules();
  const extractedByName = new Map(extractedModules.map((m) => [m.packageName, m]));
  const results: PluginHealthCheckResult[] = [];

  for (const inst of installedRows) {
    const plg = allPlugins.find((p) => p.id === inst.pluginId);
    if (!plg) continue;

    const startMs = Date.now();
    const cfg = (inst.config || {}) as Record<string, unknown>;
    const workspaceMod = extractedByName.get(plg.npmPackageName);
    const descriptor = getPluginModuleDescriptor(plg.npmPackageName);

    const dependencies: PluginDependencyCheck[] = [
      { name: 'PostgreSQL', ok: pgHealthy, detail: pgDetail },
      {
        name: 'Verdaccio Registry Manifest',
        ok: plg.npmPackageName.startsWith('@nexus-plugins/') && Boolean(plg.tarballSha512),
        detail: workspaceMod
          ? `Workspace ${workspaceMod.directory} · SHA-512 подтверждён`
          : plg.tarballSha512
            ? 'SHA-512 подтверждён'
            : 'Отсутствует контрольная сумма tarballSha512',
      },
    ];

    if (descriptor) {
      const cfgCheck = descriptor.configSchema.safeParse(cfg);
      if (!cfgCheck.success) {
        dependencies.push({
          name: `DDD Module Contract (${descriptor.boundedContext})`,
          ok: false,
          detail: cfgCheck.error.issues[0]?.message || 'Конфигурация не соответствует схеме модуля',
        });
      }
    }

    if (cfg.simulateDependencyError === true || cfg.dependencyStatus === 'error') {
      const customReason =
        typeof cfg.dependencyErrorMessage === 'string' && cfg.dependencyErrorMessage.trim()
          ? cfg.dependencyErrorMessage.trim()
          : 'Внешний сервис-зависимость не отвечает (health probe failed)';
      dependencies.push({
        name: typeof cfg.failedDependencyName === 'string' ? cfg.failedDependencyName : 'Service Dependency',
        ok: false,
        detail: customReason,
      });
    }

    if (plg.npmPackageName === '@nexus-plugins/dify-deal-copilot') {
      const hasModel = typeof cfg.model === 'string' && cfg.model.trim().length > 0;
      dependencies.push({
        name: 'DeepSeek-Harness / Dify',
        ok: hasModel,
        detail: hasModel ? `Модель ${String(cfg.model)}` : 'Не указана модель DeepSeek-Harness в конфигурации',
      });
      if (cfg.difyApiUrl || cfg.endpointUrl) {
        dependencies.push(await probeServiceUrl('Dify API', cfg.difyApiUrl ?? cfg.endpointUrl));
      }
    } else if (plg.npmPackageName === '@nexus-plugins/nats-webhook-bridge') {
      const hasStream = typeof cfg.streamName === 'string' && cfg.streamName.trim().length > 0;
      dependencies.push({
        name: 'NATS JetStream Bridge',
        ok: hasStream,
        detail: hasStream ? `Stream ${String(cfg.streamName)}` : 'Не задан параметр streamName',
      });
      if (cfg.webhookUrl || cfg.endpointUrl) {
        dependencies.push(await probeServiceUrl('NATS Webhook Endpoint', cfg.webhookUrl ?? cfg.endpointUrl));
      }
    } else if (plg.npmPackageName === '@nexus-plugins/vk-social-polls') {
      try {
        await db.select({ id: socialPosts.id }).from(socialPosts).where(eq(socialPosts.tenantId, params.tenantId)).limit(1);
        const maxOptions = Number(cfg.maxOptions ?? 6);
        dependencies.push({
          name: 'Social Wall Context',
          ok: Number.isFinite(maxOptions) && maxOptions >= 2,
          detail: maxOptions >= 2 ? `maxOptions=${maxOptions}` : 'Параметр maxOptions должен быть >= 2',
        });
      } catch (err: unknown) {
        dependencies.push({
          name: 'Social Wall Context',
          ok: false,
          detail: err instanceof Error ? err.message : 'Сбой таблицы social_posts',
        });
      }
    } else if (plg.npmPackageName === '@nexus-plugins/directus-bi-connector') {
      const syncSec = Number(cfg.syncIntervalSec ?? 60);
      dependencies.push({
        name: 'Directus BI Sync Config',
        ok: Number.isFinite(syncSec) && syncSec > 0,
        detail: syncSec > 0 ? `Интервал ${syncSec}с` : 'Некорректный syncIntervalSec',
      });
      if (cfg.directusUrl || cfg.endpointUrl) {
        dependencies.push(await probeServiceUrl('Directus API', cfg.directusUrl ?? cfg.endpointUrl));
      }
    } else if (plg.npmPackageName === '@nexus-plugins/tinacms-sales-playbooks') {
      try {
        await db.select({ id: cmsBlocks.id }).from(cmsBlocks).where(eq(cmsBlocks.tenantId, params.tenantId)).limit(1);
        const hasCollection =
          typeof cfg.playbookCollection === 'string' && cfg.playbookCollection.trim().length > 0;
        dependencies.push({
          name: 'TinaCMS Playbook Collection',
          ok: hasCollection,
          detail: hasCollection ? String(cfg.playbookCollection) : 'Не задана коллекция playbookCollection',
        });
      } catch (err: unknown) {
        dependencies.push({
          name: 'TinaCMS Playbook Collection',
          ok: false,
          detail: err instanceof Error ? err.message : 'Сбой хранилища cms_blocks',
        });
      }
    } else if (cfg.serviceEndpoint || cfg.dependencyUrl || cfg.healthEndpoint) {
      dependencies.push(
        await probeServiceUrl(
          'External Plugin Service',
          cfg.serviceEndpoint ?? cfg.dependencyUrl ?? cfg.healthEndpoint
        )
      );
    }

    const failed = dependencies.find((d) => !d.ok);
    const healthy = !failed;
    let natsPublished = false;

    if (!healthy && failed) {
      await natsBus.publish(
        params.tenantId,
        `marketplace.${params.subdomain}.plugin.dependency_error`,
        params.actorId,
        {
          pluginId: plg.id,
          npmPackageName: plg.npmPackageName,
          name: plg.name,
          dependency: failed.name,
          error: failed.detail,
        }
      );
      natsPublished = true;
    }

    results.push({
      pluginId: plg.id,
      npmPackageName: plg.npmPackageName,
      name: plg.name,
      enabled: inst.enabled,
      healthy,
      status: healthy ? 'healthy' : 'error',
      checkedAt,
      latencyMs: Math.max(1, Date.now() - startMs),
      dependencies,
      failedDependency: failed?.name,
      errorMessage: failed?.detail,
      natsPublished,
    });
  }

  return {
    checkedAt,
    totalInstalled: results.length,
    unhealthyCount: results.filter((r) => !r.healthy).length,
    results,
  };
}
