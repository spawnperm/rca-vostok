import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import type { NexusModuleDescriptor } from '@nexus-core/ddd-kernel';
import { difyDealCopilotModule } from '@nexus-plugins/dify-deal-copilot';
import { directusBiConnectorModule } from '@nexus-plugins/directus-bi-connector';
import { natsWebhookBridgeModule } from '@nexus-plugins/nats-webhook-bridge';
import { tinacmsSalesPlaybooksModule } from '@nexus-plugins/tinacms-sales-playbooks';
import { vkSocialPollsModule } from '@nexus-plugins/vk-social-polls';

export interface ExtractedVerdaccioModuleInfo {
  packageName: string;
  scope: string;
  slug: string;
  directory: string;
  version: string;
  title: string;
  description: string;
  category: string;
  slot: string | null;
  boundedContext: string;
  contextMapping: string;
  role: 'shared-kernel' | 'plugin-module';
  aggregates: string[];
  valueObjects: string[];
  publishedEvents: string[];
  subscribedSubjects: string[];
  permissionsRequired: string[];
  tarballFilename: string;
  tarballUrl: string;
  tarballSha512: string;
  shasum: string;
  tarballBytes: number;
  files: string[];
  sourceCodePreview: string;
}

const PLUGIN_DESCRIPTORS: Array<NexusModuleDescriptor<any>> = [
  difyDealCopilotModule,
  natsWebhookBridgeModule,
  vkSocialPollsModule,
  directusBiConnectorModule,
  tinacmsSalesPlaybooksModule,
];

const DESCRIPTOR_BY_NAME = new Map<string, NexusModuleDescriptor<any>>(
  PLUGIN_DESCRIPTORS.map((d) => [d.packageName, d])
);

const PACKAGES_DIR = path.resolve(process.cwd(), 'packages');

/**
 * Builds a deterministic POSIX ustar .tar buffer from file entries and compresses it with gzip (.tgz).
 * Allows serving real, valid npm/Verdaccio package tarballs directly from extracted /packages/* sources.
 */
function buildPosixTarGzip(
  packageRootPrefix: string,
  entries: Array<{ relativePath: string; content: Buffer }>
): Buffer {
  const blocks: Buffer[] = [];

  for (const entry of entries) {
    const fullName = `${packageRootPrefix}/${entry.relativePath}`.slice(0, 99);
    const header = Buffer.alloc(512, 0);
    header.write(fullName, 0, 'utf8');
    header.write('0000644\0', 100, 'ascii'); // mode
    header.write('0000000\0', 108, 'ascii'); // uid
    header.write('0000000\0', 116, 'ascii'); // gid
    header.write(`${entry.content.length.toString(8).padStart(11, '0')}\0`, 124, 'ascii'); // size
    header.write(`${Math.floor(1735689600).toString(8).padStart(11, '0')}\0`, 136, 'ascii'); // deterministic mtime
    header.write('        ', 148, 'ascii'); // checksum placeholder
    header.write('0', 156, 'ascii'); // regular file typeflag
    header.write('ustar\0', 257, 'ascii');
    header.write('00', 263, 'ascii');

    let chksum = 0;
    for (let i = 0; i < 512; i += 1) chksum += header[i];
    header.write(`${chksum.toString(8).padStart(6, '0')}\0 `, 148, 'ascii');

    blocks.push(header);
    if (entry.content.length > 0) {
      blocks.push(entry.content);
      const remainder = entry.content.length % 512;
      if (remainder !== 0) {
        blocks.push(Buffer.alloc(512 - remainder, 0));
      }
    }
  }

  // Two zero blocks mark end of archive
  blocks.push(Buffer.alloc(1024, 0));
  return zlib.gzipSync(Buffer.concat(blocks), { level: 6 });
}

function collectPackageEntries(dirPath: string): Array<{ relativePath: string; content: Buffer }> {
  const collected: Array<{ relativePath: string; content: Buffer }> = [];
  const walk = (currentDir: string) => {
    const items = fs.readdirSync(currentDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const item of items) {
      if (item.name === 'node_modules' || item.name === 'dist') continue;
      const abs = path.join(currentDir, item.name);
      if (item.isDirectory()) {
        walk(abs);
      } else if (item.isFile()) {
        const rel = path.relative(dirPath, abs).replace(/\\/g, '/');
        collected.push({ relativePath: rel, content: fs.readFileSync(abs) });
      }
    }
  };
  walk(dirPath);
  return collected;
}

export function getPluginModuleDescriptor(npmPackageName: string): NexusModuleDescriptor<any> | null {
  return DESCRIPTOR_BY_NAME.get(npmPackageName) || null;
}

export function listExtractedVerdaccioModules(): ExtractedVerdaccioModuleInfo[] {
  if (!fs.existsSync(PACKAGES_DIR)) return [];
  const dirs = fs.readdirSync(PACKAGES_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  const results: ExtractedVerdaccioModuleInfo[] = [];

  for (const dir of dirs) {
    const absDir = path.join(PACKAGES_DIR, dir.name);
    const pkgJsonPath = path.join(absDir, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) continue;

    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as {
      name: string;
      version: string;
      description?: string;
      nexusModule?: {
        boundedContext?: string;
        contextMapping?: string;
        role?: 'shared-kernel' | 'plugin-module';
        slot?: string;
        aggregates?: string[];
        valueObjects?: string[];
        domainEvents?: string[];
        subscribedSubjects?: string[];
        permissionsRequired?: string[];
      };
    };

    const [scope = '@nexus-plugins', slug = dir.name] = pkg.name.split('/');
    const entries = collectPackageEntries(absDir);
    const tgz = buildPosixTarGzip('package', entries);
    const sha512 = `sha512-${crypto.createHash('sha512').update(tgz).digest('base64')}`;
    const shasum = crypto.createHash('sha1').update(tgz).digest('hex');
    const descriptor = getPluginModuleDescriptor(pkg.name);
    const indexPath = path.join(absDir, 'src/index.ts');
    const sourceCodePreview = fs.existsSync(indexPath)
      ? fs.readFileSync(indexPath, 'utf8').split('\n').slice(0, 32).join('\n')
      : '';

    const tarballFilename = `${slug}-${pkg.version}.tgz`;
    results.push({
      packageName: pkg.name,
      scope,
      slug,
      directory: `packages/${dir.name}`,
      version: pkg.version,
      title: descriptor?.title || pkg.name,
      description: pkg.description || '',
      category: descriptor?.category || 'DDD Shared Kernel',
      slot: pkg.nexusModule?.slot || descriptor?.slot || null,
      boundedContext: pkg.nexusModule?.boundedContext || descriptor?.boundedContext || 'shared-kernel',
      contextMapping: pkg.nexusModule?.contextMapping || descriptor?.contextMapping || 'Shared Kernel',
      role: pkg.nexusModule?.role || 'plugin-module',
      aggregates: pkg.nexusModule?.aggregates || descriptor?.aggregates || [],
      valueObjects: pkg.nexusModule?.valueObjects || descriptor?.valueObjects || [],
      publishedEvents: pkg.nexusModule?.domainEvents || descriptor?.publishedEvents || [],
      subscribedSubjects: pkg.nexusModule?.subscribedSubjects || descriptor?.subscribedSubjects || [],
      permissionsRequired: pkg.nexusModule?.permissionsRequired || descriptor?.permissionsRequired || [],
      tarballFilename,
      tarballUrl: `/api/marketplace/verdaccio/tarball/${scope}/${slug}/${tarballFilename}`,
      tarballSha512: sha512,
      shasum,
      tarballBytes: tgz.length,
      files: entries.map((e) => e.relativePath),
      sourceCodePreview,
    });
  }

  return results.sort((a, b) => a.packageName.localeCompare(b.packageName));
}

export function buildVerdaccioPackument(packageName: string, baseUrl: string) {
  const modules = listExtractedVerdaccioModules();
  const mod = modules.find((m) => m.packageName === packageName);
  if (!mod) return null;

  const absDir = path.resolve(process.cwd(), mod.directory);
  const pkgJson = JSON.parse(fs.readFileSync(path.join(absDir, 'package.json'), 'utf8'));
  const tarballEndpoint = `${baseUrl.replace(/\/+$/, '')}${mod.tarballUrl}`;

  return {
    _id: mod.packageName,
    name: mod.packageName,
    description: mod.description,
    'dist-tags': {
      latest: mod.version,
    },
    versions: {
      [mod.version]: {
        ...pkgJson,
        _id: `${mod.packageName}@${mod.version}`,
        dist: {
          integrity: mod.tarballSha512,
          shasum: mod.shasum,
          tarball: tarballEndpoint,
          fileCount: mod.files.length,
          unpackedSize: mod.files.reduce(
            (sum, f) => sum + fs.statSync(path.join(absDir, f)).size,
            0
          ),
        },
      },
    },
    _verdaccio: {
      scope: mod.scope,
      registryMode: process.env.VERDACCIO_URL ? 'verdaccio-upstream-ready' : 'embedded-workspace-registry',
      upstreamUrl: process.env.VERDACCIO_URL || 'http://localhost:4873',
      boundedContext: mod.boundedContext,
      contextMapping: mod.contextMapping,
    },
  };
}

export function buildModuleTarball(packageName: string): { filename: string; buffer: Buffer; sha512: string } | null {
  const modules = listExtractedVerdaccioModules();
  const mod = modules.find((m) => m.packageName === packageName);
  if (!mod) return null;
  const absDir = path.resolve(process.cwd(), mod.directory);
  const entries = collectPackageEntries(absDir);
  const buffer = buildPosixTarGzip('package', entries);
  return {
    filename: mod.tarballFilename,
    buffer,
    sha512: `sha512-${crypto.createHash('sha512').update(buffer).digest('base64')}`,
  };
}

export async function probeLiveVerdaccioRegistry(): Promise<{
  endpoint: string;
  liveReachable: boolean;
  mode: 'live_verdaccio' | 'embedded_workspace_registry';
}> {
  const endpoint = process.env.VERDACCIO_URL || 'http://localhost:4873';
  try {
    const res = await fetch(`${endpoint.replace(/\/+$/, '')}/-/ping`, {
      method: 'GET',
      signal: AbortSignal.timeout(500),
    });
    if (res.ok) {
      return { endpoint, liveReachable: true, mode: 'live_verdaccio' };
    }
  } catch {
    // Expected when external Verdaccio container is not started alongside standalone Node dev runtime
  }
  return { endpoint, liveReachable: false, mode: 'embedded_workspace_registry' };
}

export function executeModuleDomainPreview(
  packageName: string,
  rawConfig: Record<string, unknown>,
  input?: Record<string, unknown>
): {
  ok: true;
  packageName: string;
  boundedContext: string;
  contextMapping: string;
  validatedConfig: Record<string, unknown>;
  output: Record<string, unknown>;
} | { ok: false; error: string } {
  const descriptor = getPluginModuleDescriptor(packageName);
  if (!descriptor) {
    return { ok: false, error: `Модуль ${packageName} не зарегистрирован как исполняемый пакет DDD` };
  }
  const parsed = descriptor.configSchema.safeParse({
    ...descriptor.defaultConfig,
    ...(rawConfig || {}),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || 'Ошибка валидации конфигурации модуля',
    };
  }
  const output = descriptor.runDomainPreview(parsed.data, input);
  return {
    ok: true,
    packageName: descriptor.packageName,
    boundedContext: descriptor.boundedContext,
    contextMapping: descriptor.contextMapping,
    validatedConfig: parsed.data,
    output,
  };
}
