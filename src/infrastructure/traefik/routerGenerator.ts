import { dump } from 'js-yaml';
import { getDb } from '../db/client.ts';
import { tenants } from '../db/schema.ts';

export async function generateTraefikDynamicConfig(baseDomain = process.env.BASE_DOMAIN || 'platform.local') {
  const db = await getDb();
  const allTenants = await db.select().from(tenants);

  const routers: Record<string, unknown> = {};
  const middlewares: Record<string, unknown> = {};

  for (const tenant of allTenants) {
    if (tenant.status !== 'active') continue;
    const routerKey = `tenant-${tenant.subdomain}`;
    const mwKey = `headers-${tenant.subdomain}`;

    middlewares[mwKey] = {
      headers: {
        customRequestHeaders: {
          'X-Tenant-Subdomain': tenant.subdomain,
          'X-Tenant-Id': tenant.id,
        },
      },
    };

    routers[routerKey] = {
      rule: `Host(\`${tenant.subdomain}.${baseDomain}\`)`,
      entryPoints: ['web', 'websecure'],
      middlewares: [mwKey],
      service: 'nexus-harness-app',
    };
  }

  const configObj = {
    http: {
      routers,
      middlewares,
      services: {
        'nexus-harness-app': {
          loadBalancer: {
            servers: [{ url: 'http://app:3000' }],
          },
        },
      },
    },
  };

  return {
    yaml: dump(configObj, { indent: 2 }),
    json: configObj,
    activeRoutersCount: Object.keys(routers).length,
  };
}
