import fs from 'fs';
import os from 'os';
import path from 'path';
import { count, desc, eq, sql } from 'drizzle-orm';
import { getDb, getDatabaseEngineInfo } from '../db/client.ts';
import { deals, natsEvents, tenants, users } from '../db/schema.ts';
import { getForgejoServerConfig, listForgejoInventory } from '../forgejo/forgejoService.ts';
import { natsBus } from '../nats/eventBus.ts';
import { getGarageS3Config, listGarageInventory } from '../storage/garageS3Service.ts';

export type ServiceConnectionStatus = 'connected' | 'degraded' | 'disconnected';

export interface CpuTelemetry {
  usagePercent: number;
  cores: number;
  model: string;
  loadAvg: [number, number, number];
  processUserMs: number;
  processSystemMs: number;
}

export interface RamTelemetry {
  usagePercent: number;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  processRssBytes: number;
  processHeapUsedBytes: number;
  processHeapTotalBytes: number;
}

export interface HddTelemetry {
  usagePercent: number;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  mountPath: string;
  appDataBytes: number;
}

export interface NetTelemetry {
  rxBytesPerSec: number;
  txBytesPerSec: number;
  totalRxBytes: number;
  totalTxBytes: number;
  rxPackets: number;
  txPackets: number;
  activeInterfaces: string[];
}

export interface ServiceHealthItem {
  id: 'postgresql' | 'nats' | 'forgejo' | 'garage_s3';
  name: string;
  role: string;
  status: ServiceConnectionStatus;
  latencyMs: number;
  endpoint: string;
  mode: string;
  metrics: Array<{ label: string; value: string }>;
  lastError?: string;
}

export interface SystemHealthSnapshot {
  collectedAt: string;
  overallStatus: ServiceConnectionStatus;
  resources: {
    cpu: CpuTelemetry;
    ram: RamTelemetry;
    hdd: HddTelemetry;
    net: NetTelemetry;
  };
  services: ServiceHealthItem[];
  runtime: {
    hostname: string;
    platform: string;
    nodeVersion: string;
    uptimeSeconds: number;
    osUptimeSeconds: number;
    pid: number;
  };
}

interface CpuTickSample {
  idle: number;
  total: number;
}

interface NetSample {
  timestampMs: number;
  rxBytes: number;
  txBytes: number;
}

let prevCpuTicks: CpuTickSample | null = null;
let prevNetSample: NetSample | null = null;

function readCpuTicks(): CpuTickSample {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const core of cpus) {
    idle += core.times.idle;
    total +=
      core.times.user +
      core.times.nice +
      core.times.sys +
      core.times.idle +
      core.times.irq;
  }
  return { idle, total };
}

async function sampleCpuUsage(): Promise<CpuTelemetry> {
  const cpus = os.cpus();
  const cores = cpus.length || 1;
  const model = cpus[0]?.model?.trim() || 'Virtual CPU';
  const load = os.loadavg();
  const loadAvg: [number, number, number] = [
    Number((load[0] ?? 0).toFixed(2)),
    Number((load[1] ?? 0).toFixed(2)),
    Number((load[2] ?? 0).toFixed(2)),
  ];

  if (!prevCpuTicks) {
    prevCpuTicks = readCpuTicks();
    await new Promise((resolve) => setTimeout(resolve, 40));
  }

  const current = readCpuTicks();
  const idleDelta = Math.max(0, current.idle - prevCpuTicks.idle);
  const totalDelta = Math.max(0, current.total - prevCpuTicks.total);
  prevCpuTicks = current;

  const usagePercent =
    totalDelta > 0
      ? Number((((totalDelta - idleDelta) / totalDelta) * 100).toFixed(1))
      : Number(Math.min(100, (loadAvg[0] / cores) * 100).toFixed(1));

  const procCpu = process.cpuUsage();

  return {
    usagePercent: Math.min(100, Math.max(0, usagePercent)),
    cores,
    model,
    loadAvg,
    processUserMs: Math.round(procCpu.user / 1000),
    processSystemMs: Math.round(procCpu.system / 1000),
  };
}

function sampleRamUsage(): RamTelemetry {
  let totalBytes = os.totalmem();
  let freeBytes = os.freemem();

  try {
    if (fs.existsSync('/proc/meminfo')) {
      const raw = fs.readFileSync('/proc/meminfo', 'utf8');
      const totalMatch = raw.match(/^MemTotal:\s+(\d+)\s+kB/m);
      const availMatch = raw.match(/^MemAvailable:\s+(\d+)\s+kB/m);
      if (totalMatch && availMatch) {
        totalBytes = Number(totalMatch[1]) * 1024;
        freeBytes = Number(availMatch[1]) * 1024;
      }
    }
  } catch {
    // Fallback to os.totalmem / os.freemem
  }

  const usedBytes = Math.max(0, totalBytes - freeBytes);
  const usagePercent =
    totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(1)) : 0;
  const mem = process.memoryUsage();

  return {
    usagePercent: Math.min(100, Math.max(0, usagePercent)),
    totalBytes,
    usedBytes,
    freeBytes,
    processRssBytes: mem.rss,
    processHeapUsedBytes: mem.heapUsed,
    processHeapTotalBytes: mem.heapTotal,
  };
}

function getDirSizeBytes(dirPath: string, depth = 0): number {
  if (depth > 4 || !fs.existsSync(dirPath)) return 0;
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isFile()) {
        total += fs.statSync(full).size;
      } else if (entry.isDirectory()) {
        total += getDirSizeBytes(full, depth + 1);
      }
    }
  } catch {
    return total;
  }
  return total;
}

function sampleHddUsage(): HddTelemetry {
  const mountPath = process.cwd();
  const dataDir = path.resolve(mountPath, 'data');
  const appDataBytes = getDirSizeBytes(dataDir);

  try {
    const stat = fs.statfsSync(mountPath);
    const bsize = Number(stat.bsize) || 4096;
    const totalBytes = Number(stat.blocks) * bsize;
    const freeBytes = Number(stat.bavail) * bsize;
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const usagePercent =
      totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(1)) : 0;

    return {
      usagePercent: Math.min(100, Math.max(0, usagePercent)),
      totalBytes,
      usedBytes,
      freeBytes,
      mountPath,
      appDataBytes,
    };
  } catch {
    return {
      usagePercent: 0,
      totalBytes: 0,
      usedBytes: appDataBytes,
      freeBytes: 0,
      mountPath,
      appDataBytes,
    };
  }
}

function sampleNetUsage(): NetTelemetry {
  const ifaces = os.networkInterfaces();
  const activeInterfaces = Object.entries(ifaces)
    .filter(([, addrs]) => Boolean(addrs?.some((a) => !a.internal)))
    .map(([name]) => name);

  let totalRxBytes = 0;
  let totalTxBytes = 0;
  let rxPackets = 0;
  let txPackets = 0;

  try {
    if (fs.existsSync('/proc/net/dev')) {
      const content = fs.readFileSync('/proc/net/dev', 'utf8');
      const lines = content.split('\n').slice(2);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx === -1) continue;
        const ifaceName = trimmed.slice(0, colonIdx).trim();
        if (ifaceName === 'lo') continue;
        const cols = trimmed
          .slice(colonIdx + 1)
          .trim()
          .split(/\s+/)
          .map((n) => Number(n) || 0);
        if (cols.length >= 10) {
          totalRxBytes += cols[0];
          rxPackets += cols[1];
          totalTxBytes += cols[8];
          txPackets += cols[9];
        }
      }
    }
  } catch {
    // Non-Linux or restricted procfs fallback
  }

  const nowMs = Date.now();
  let rxBytesPerSec = 0;
  let txBytesPerSec = 0;

  if (prevNetSample) {
    const dtSec = Math.max(0.1, (nowMs - prevNetSample.timestampMs) / 1000);
    rxBytesPerSec = Math.max(
      0,
      Math.round((totalRxBytes - prevNetSample.rxBytes) / dtSec)
    );
    txBytesPerSec = Math.max(
      0,
      Math.round((totalTxBytes - prevNetSample.txBytes) / dtSec)
    );
  }

  prevNetSample = {
    timestampMs: nowMs,
    rxBytes: totalRxBytes,
    txBytes: totalTxBytes,
  };

  return {
    rxBytesPerSec,
    txBytesPerSec,
    totalRxBytes,
    totalTxBytes,
    rxPackets,
    txPackets,
    activeInterfaces: activeInterfaces.length ? activeInterfaces : ['lo'],
  };
}

async function probePostgresql(tenantId: string): Promise<ServiceHealthItem> {
  const started = performance.now();
  const dbInfo = getDatabaseEngineInfo();
  try {
    const db = await getDb();
    await db.execute(sql`SELECT 1`);
    const [[tenantCountRow], [dealCountRow], [userCountRow]] = await Promise.all([
      db.select({ total: count() }).from(tenants),
      db.select({ total: count() }).from(deals).where(eq(deals.tenantId, tenantId)),
      db.select({ total: count() }).from(users).where(eq(users.tenantId, tenantId)),
    ]);
    const latencyMs = Math.max(1, Math.round(performance.now() - started));
    const status: ServiceConnectionStatus = latencyMs > 500 ? 'degraded' : 'connected';

    return {
      id: 'postgresql',
      name: 'PostgreSQL',
      role: 'Основная реляционная БД и мультитенантность',
      status,
      latencyMs,
      endpoint: dbInfo.persistence,
      mode: dbInfo.engine,
      metrics: [
        { label: 'Тенантов', value: String(tenantCountRow?.total ?? 0) },
        { label: 'Сделок (тенант)', value: String(dealCountRow?.total ?? 0) },
        { label: 'Аккаунтов', value: String(userCountRow?.total ?? 0) },
      ],
    };
  } catch (err: unknown) {
    return {
      id: 'postgresql',
      name: 'PostgreSQL',
      role: 'Основная реляционная БД и мультитенантность',
      status: 'disconnected',
      latencyMs: Math.round(performance.now() - started),
      endpoint: dbInfo.persistence,
      mode: dbInfo.engine,
      metrics: [],
      lastError: err instanceof Error ? err.message : 'Ошибка подключения к PostgreSQL',
    };
  }
}

async function probeNats(tenantId: string): Promise<ServiceHealthItem> {
  const started = performance.now();
  const endpoint = process.env.NATS_URL || 'nats://jetstream.platform.local:4222';
  const mode = process.env.NATS_URL ? 'External NATS JetStream' : 'In-Process JetStream + PG Log';

  try {
    const db = await getDb();
    const [[eventsCountRow], [latestEvent]] = await Promise.all([
      db
        .select({ total: count() })
        .from(natsEvents)
        .where(eq(natsEvents.tenantId, tenantId)),
      db
        .select({ subject: natsEvents.subject, createdAt: natsEvents.createdAt })
        .from(natsEvents)
        .where(eq(natsEvents.tenantId, tenantId))
        .orderBy(desc(natsEvents.createdAt))
        .limit(1),
    ]);

    const tenantListeners = natsBus.listenerCount(`tenant:${tenantId}`);
    const totalStreams = natsBus
      .eventNames()
      .filter((name) => String(name).startsWith('tenant:'))
      .reduce((acc, name) => acc + natsBus.listenerCount(name), 0);

    const latencyMs = Math.max(1, Math.round(performance.now() - started));

    return {
      id: 'nats',
      name: 'NATS JetStream',
      role: 'Шина доменных событий и SSE-потоки',
      status: latencyMs > 400 ? 'degraded' : 'connected',
      latencyMs,
      endpoint,
      mode,
      metrics: [
        { label: 'Событий (тенант)', value: String(eventsCountRow?.total ?? 0) },
        { label: 'SSE подписчиков', value: `${tenantListeners} / ${totalStreams}` },
        { label: 'Последний subject', value: latestEvent?.subject || 'нет событий' },
      ],
    };
  } catch (err: unknown) {
    return {
      id: 'nats',
      name: 'NATS JetStream',
      role: 'Шина доменных событий и SSE-потоки',
      status: 'disconnected',
      latencyMs: Math.round(performance.now() - started),
      endpoint,
      mode,
      metrics: [],
      lastError: err instanceof Error ? err.message : 'Ошибка проверки шины NATS',
    };
  }
}

async function probeForgejo(tenantId: string): Promise<ServiceHealthItem> {
  const started = performance.now();
  const cfg = getForgejoServerConfig();

  try {
    const inv = await listForgejoInventory(tenantId);
    let remoteStatus: ServiceConnectionStatus = 'connected';
    let lastError: string | undefined;

    if (cfg.externalSyncEnabled && process.env.FORGEJO_BASE_URL) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1200);
      try {
        const probeUrl = new URL('/api/v1/version', process.env.FORGEJO_BASE_URL).toString();
        const res = await fetch(probeUrl, { signal: controller.signal });
        if (!res.ok) {
          remoteStatus = 'degraded';
          lastError = `HTTP ${res.status} от внешнего Forgejo`;
        }
      } catch (err: unknown) {
        remoteStatus = 'degraded';
        lastError = err instanceof Error ? err.message : 'Внешний Forgejo не отвечает';
      } finally {
        clearTimeout(timer);
      }
    }

    const latencyMs = Math.max(1, Math.round(performance.now() - started));

    return {
      id: 'forgejo',
      name: 'Forgejo Git',
      role: 'Репозитории документов, коммиты и Git LFS',
      status: remoteStatus,
      latencyMs,
      endpoint: cfg.baseUrl,
      mode: cfg.externalSyncEnabled ? 'External Forgejo API + PG Mirror' : 'Embedded PG Git Mirror + LFS',
      metrics: [
        { label: 'Репозиториев', value: String(inv.repos.length) },
        { label: 'Коммитов', value: String(inv.commits.length) },
        { label: 'LFS Backend', value: cfg.lfsStorage },
      ],
      ...(lastError ? { lastError } : {}),
    };
  } catch (err: unknown) {
    return {
      id: 'forgejo',
      name: 'Forgejo Git',
      role: 'Репозитории документов, коммиты и Git LFS',
      status: 'disconnected',
      latencyMs: Math.round(performance.now() - started),
      endpoint: cfg.baseUrl,
      mode: cfg.externalSyncEnabled ? 'External Forgejo API' : 'Embedded PG Git Mirror',
      metrics: [],
      lastError: err instanceof Error ? err.message : 'Ошибка подключения к Forgejo',
    };
  }
}

async function probeGarageS3(tenantId: string): Promise<ServiceHealthItem> {
  const started = performance.now();
  const cfg = getGarageS3Config();

  try {
    const inv = await listGarageInventory(tenantId);
    const totalBytes = inv.objects.reduce((sum, obj) => sum + (obj.sizeBytes || 0), 0);
    const totalQuotaMb = inv.buckets.reduce((sum, b) => sum + (b.quotaMb || 0), 0);
    const usedMb = (totalBytes / (1024 * 1024)).toFixed(2);

    let storageWritable = true;
    if (cfg.mode !== 'in-memory') {
      const baseDir = process.env.GARAGE_DATA_DIR || path.resolve(process.cwd(), 'data', 'garage-s3');
      fs.mkdirSync(baseDir, { recursive: true });
      fs.accessSync(baseDir, fs.constants.R_OK | fs.constants.W_OK);
    }

    const latencyMs = Math.max(1, Math.round(performance.now() - started));

    return {
      id: 'garage_s3',
      name: 'Garage S3',
      role: 'Объектное хранилище файлов и версий Office',
      status: storageWritable ? 'connected' : 'degraded',
      latencyMs,
      endpoint: cfg.endpoint,
      mode: `${cfg.mode} (${cfg.region})`,
      metrics: [
        { label: 'Бакетов', value: String(inv.buckets.length) },
        { label: 'Объектов', value: String(inv.objects.length) },
        { label: 'Занято / Квота', value: `${usedMb} / ${totalQuotaMb} MB` },
      ],
    };
  } catch (err: unknown) {
    return {
      id: 'garage_s3',
      name: 'Garage S3',
      role: 'Объектное хранилище файлов и версий Office',
      status: 'disconnected',
      latencyMs: Math.round(performance.now() - started),
      endpoint: cfg.endpoint,
      mode: `${cfg.mode} (${cfg.region})`,
      metrics: [],
      lastError: err instanceof Error ? err.message : 'Хранилище Garage S3 недоступно',
    };
  }
}

export async function collectSystemHealthSnapshot(tenantId: string): Promise<SystemHealthSnapshot> {
  const [cpu, postgresql, nats, forgejo, garageS3] = await Promise.all([
    sampleCpuUsage(),
    probePostgresql(tenantId),
    probeNats(tenantId),
    probeForgejo(tenantId),
    probeGarageS3(tenantId),
  ]);

  const ram = sampleRamUsage();
  const hdd = sampleHddUsage();
  const net = sampleNetUsage();
  const services = [postgresql, nats, forgejo, garageS3];

  const hasDisconnected = services.some((s) => s.status === 'disconnected');
  const hasDegraded = services.some((s) => s.status === 'degraded');
  const overallStatus: ServiceConnectionStatus = hasDisconnected
    ? 'disconnected'
    : hasDegraded || cpu.usagePercent > 90 || ram.usagePercent > 92 || hdd.usagePercent > 95
      ? 'degraded'
      : 'connected';

  return {
    collectedAt: new Date().toISOString(),
    overallStatus,
    resources: { cpu, ram, hdd, net },
    services,
    runtime: {
      hostname: os.hostname(),
      platform: `${os.platform()} ${os.release()} (${os.arch()})`,
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      osUptimeSeconds: Math.floor(os.uptime()),
      pid: process.pid,
    },
  };
}
