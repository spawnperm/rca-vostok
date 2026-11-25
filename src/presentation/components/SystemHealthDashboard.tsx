import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  GitBranch,
  HardDrive,
  MemoryStick,
  Network,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react';
import { refineClient } from '../../application/refine/client.ts';
import type { TenantContext } from '../../domain/shared/types.ts';
import { formatBytes } from '../../shared/formatters.ts';

type ServiceConnectionStatus = 'connected' | 'degraded' | 'disconnected';

interface SystemHealthSnapshot {
  collectedAt: string;
  overallStatus: ServiceConnectionStatus;
  resources: {
    cpu: {
      usagePercent: number;
      cores: number;
      model: string;
      loadAvg: [number, number, number];
      processUserMs: number;
      processSystemMs: number;
    };
    ram: {
      usagePercent: number;
      totalBytes: number;
      usedBytes: number;
      freeBytes: number;
      processRssBytes: number;
      processHeapUsedBytes: number;
      processHeapTotalBytes: number;
    };
    hdd: {
      usagePercent: number;
      totalBytes: number;
      usedBytes: number;
      freeBytes: number;
      mountPath: string;
      appDataBytes: number;
    };
    net: {
      rxBytesPerSec: number;
      txBytesPerSec: number;
      totalRxBytes: number;
      totalTxBytes: number;
      rxPackets: number;
      txPackets: number;
      activeInterfaces: string[];
    };
  };
  services: Array<{
    id: 'postgresql' | 'nats' | 'forgejo' | 'garage_s3';
    name: string;
    role: string;
    status: ServiceConnectionStatus;
    latencyMs: number;
    endpoint: string;
    mode: string;
    metrics: Array<{ label: string; value: string }>;
    lastError?: string;
  }>;
  runtime: {
    hostname: string;
    platform: string;
    nodeVersion: string;
    uptimeSeconds: number;
    osUptimeSeconds: number;
    pid: number;
  };
}

interface ResourceHistorySample {
  timestamp: string;
  cpu: number;
  ram: number;
  hdd: number;
  netKb: number;
}

interface SystemHealthDashboardProps {
  activeTenant: TenantContext;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
}

const MAX_HISTORY_POINTS = 30;

function formatRate(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return '0 KB/s';
  if (bytesPerSec < 1024) return `${bytesPerSec} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
}

function formatUptime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (days > 0) return `${days}д ${hours}ч ${mins}м`;
  if (hours > 0) return `${hours}ч ${mins}м ${secs}с`;
  return `${mins}м ${secs}с`;
}

function getUsageBarColor(percent: number): string {
  if (percent >= 90) return 'bg-red-600';
  if (percent >= 75) return 'bg-amber-600';
  return 'bg-[#0077FF]';
}

function getUsageTextColor(percent: number): string {
  if (percent >= 90) return 'text-red-700';
  if (percent >= 75) return 'text-amber-700';
  return 'text-slate-900';
}

function getStatusMeta(status: ServiceConnectionStatus) {
  if (status === 'connected') {
    return {
      label: 'Подключено',
      textClass: 'text-emerald-700',
      Icon: CheckCircle2,
    };
  }
  if (status === 'degraded') {
    return {
      label: 'Деградация',
      textClass: 'text-amber-700',
      Icon: AlertTriangle,
    };
  }
  return {
    label: 'Отключено',
    textClass: 'text-red-700',
    Icon: XCircle,
  };
}

function getServiceIcon(id: SystemHealthSnapshot['services'][number]['id']) {
  switch (id) {
    case 'postgresql':
      return Database;
    case 'nats':
      return Radio;
    case 'forgejo':
      return GitBranch;
    case 'garage_s3':
      return HardDrive;
  }
}

interface SparklineProps {
  values: number[];
  maxVal?: number;
  stroke: string;
  fill: string;
  label: string;
}

const TelemetrySparkline: React.FC<SparklineProps> = ({
  values,
  maxVal,
  stroke,
  fill,
  label,
}) => {
  const width = 240;
  const height = 44;
  const padY = 4;

  const points = useMemo(() => {
    const series = values.length > 0 ? values : [0];
    const effectiveMax = maxVal ?? Math.max(10, ...series) * 1.15;
    const stepX = series.length > 1 ? width / (series.length - 1) : width;

    return series.map((val, idx) => {
      const x = series.length > 1 ? idx * stepX : width;
      const ratio = Math.min(1, Math.max(0, val / (effectiveMax || 1)));
      const y = height - padY - ratio * (height - padY * 2);
      return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
    });
  }, [values, maxVal]);

  const linePath = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
    .join(' ');
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`
      : '';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-11 w-full overflow-visible"
      role="img"
      aria-label={label}
    >
      <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#E2E8F0" strokeDasharray="2 3" strokeWidth="1" />
      <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke="#E2E8F0" strokeWidth="1" />
      {points.length > 1 && <path d={areaPath} fill={fill} />}
      {points.length > 1 ? (
        <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <line x1="0" y1={points[0]?.y ?? height - 4} x2={width} y2={points[0]?.y ?? height - 4} stroke={stroke} strokeWidth="1.75" />
      )}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="2.5"
          fill={stroke}
        />
      )}
    </svg>
  );
};

export const SystemHealthDashboard: React.FC<SystemHealthDashboardProps> = ({
  activeTenant,
  onNotify,
}) => {
  const [snapshot, setSnapshot] = useState<SystemHealthSnapshot | null>(null);
  const [history, setHistory] = useState<ResourceHistorySample[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [intervalMs, setIntervalMs] = useState<1000 | 2000 | 5000>(2000);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchTelemetry = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      try {
        const data = await refineClient.request<SystemHealthSnapshot>('/api/system/health');
        if (!isMountedRef.current) return;
        setSnapshot(data);
        setError(null);
        setHistory((prev) => {
          const nextPoint: ResourceHistorySample = {
            timestamp: data.collectedAt,
            cpu: data.resources.cpu.usagePercent,
            ram: data.resources.ram.usagePercent,
            hdd: data.resources.hdd.usagePercent,
            netKb: Number(
              ((data.resources.net.rxBytesPerSec + data.resources.net.txBytesPerSec) / 1024).toFixed(1)
            ),
          };
          const updated = [...prev, nextPoint];
          return updated.length > MAX_HISTORY_POINTS
            ? updated.slice(updated.length - MAX_HISTORY_POINTS)
            : updated;
        });
        if (manual) {
          onNotify('Телеметрия ресурсов и подключений обновлена');
        }
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        const msg = err instanceof Error ? err.message : 'Ошибка получения телеметрии';
        setError(msg);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [onNotify]
  );

  // Reset history slightly on tenant switch so tenant-scoped counters update immediately
  useEffect(() => {
    void fetchTelemetry(false);
  }, [activeTenant.id, fetchTelemetry]);

  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => {
      void fetchTelemetry(false);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isLive, intervalMs, fetchTelemetry]);

  const cpuSeries = useMemo(() => history.map((h) => h.cpu), [history]);
  const ramSeries = useMemo(() => history.map((h) => h.ram), [history]);
  const hddSeries = useMemo(() => history.map((h) => h.hdd), [history]);
  const netSeries = useMemo(() => history.map((h) => h.netKb), [history]);

  if (loading && !snapshot) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Загрузка телеметрии системы">
        <div className="h-14 animate-pulse rounded-xl border border-slate-200 bg-white" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  const overallMeta = snapshot ? getStatusMeta(snapshot.overallStatus) : null;
  const OverallIcon = overallMeta?.Icon ?? Activity;

  return (
    <div className="space-y-5">
      {/* Control & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              SystemHealthDashboard — Мониторинг узла и сервисов
            </h3>
            {overallMeta && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${overallMeta.textClass}`}>
                <OverallIcon className="h-3.5 w-3.5" />
                {overallMeta.label === 'Подключено' ? 'Все сервисы в норме' : overallMeta.label}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Тенант: {activeTenant.subdomain}.platform.local</span>
            <span aria-hidden="true">·</span>
            <span>{isLive ? `Автообновление каждые ${intervalMs / 1000}с` : 'Поток на паузе'}</span>
            {snapshot && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Срез: {new Date(snapshot.collectedAt).toLocaleTimeString('ru-RU')}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Интервал опроса">
            {([1000, 2000, 5000] as const).map((ms) => (
              <button
                key={ms}
                type="button"
                onClick={() => setIntervalMs(ms)}
                className={`rounded-md px-2.5 py-1 text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
                  intervalMs === ms
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {ms / 1000}с
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsLive((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            {isLive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isLive ? 'Пауза' : 'Продолжить'}
          </button>

          <button
            type="button"
            onClick={() => void fetchTelemetry(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Проверить сейчас
          </button>
        </div>
      </div>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-700" />
            <span>Не удалось получить актуальную телеметрию: {error}</span>
          </div>
          <button
            type="button"
            onClick={() => void fetchTelemetry(true)}
            className="rounded-lg border border-red-300 bg-white px-3 py-1 font-medium text-red-700 hover:bg-red-100 whitespace-nowrap shrink-0"
          >
            Повторить
          </button>
        </div>
      )}

      {/* 4 Real-Time Resource Panels: CPU, RAM, HDD, NET */}
      {snapshot && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {/* CPU */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                    <Cpu className="h-3.5 w-3.5 text-slate-500" />
                    Процессор (CPU)
                  </span>
                  <span className="font-mono tabular-nums">{snapshot.resources.cpu.cores} ядер</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span
                    className={`font-mono text-2xl font-semibold tabular-nums ${getUsageTextColor(
                      snapshot.resources.cpu.usagePercent
                    )}`}
                  >
                    {snapshot.resources.cpu.usagePercent.toFixed(1)}%
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    LA {snapshot.resources.cpu.loadAvg.join(' / ')}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full transition-all duration-200 ${getUsageBarColor(
                      snapshot.resources.cpu.usagePercent
                    )}`}
                    style={{ width: `${Math.min(100, snapshot.resources.cpu.usagePercent)}%` }}
                  />
                </div>
              </div>
              <div className="mt-3">
                <TelemetrySparkline
                  values={cpuSeries}
                  maxVal={100}
                  stroke="#0077FF"
                  fill="rgba(0, 119, 255, 0.10)"
                  label="График загрузки CPU за последние 30 измерений"
                />
                <div className="mt-1 truncate text-[11px] text-slate-500" title={snapshot.resources.cpu.model}>
                  {snapshot.resources.cpu.model}
                </div>
              </div>
            </div>

            {/* RAM */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                    <MemoryStick className="h-3.5 w-3.5 text-slate-500" />
                    Оперативная память (RAM)
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatBytes(snapshot.resources.ram.totalBytes)}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span
                    className={`font-mono text-2xl font-semibold tabular-nums ${getUsageTextColor(
                      snapshot.resources.ram.usagePercent
                    )}`}
                  >
                    {snapshot.resources.ram.usagePercent.toFixed(1)}%
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    {formatBytes(snapshot.resources.ram.usedBytes)} занято
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full transition-all duration-200 ${getUsageBarColor(
                      snapshot.resources.ram.usagePercent
                    )}`}
                    style={{ width: `${Math.min(100, snapshot.resources.ram.usagePercent)}%` }}
                  />
                </div>
              </div>
              <div className="mt-3">
                <TelemetrySparkline
                  values={ramSeries}
                  maxVal={100}
                  stroke="#0F766E"
                  fill="rgba(15, 118, 110, 0.10)"
                  label="График использования RAM за последние 30 измерений"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                  <span>Свободно: {formatBytes(snapshot.resources.ram.freeBytes)}</span>
                  <span>RSS: {formatBytes(snapshot.resources.ram.processRssBytes)}</span>
                </div>
              </div>
            </div>

            {/* HDD */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                    <HardDrive className="h-3.5 w-3.5 text-slate-500" />
                    Диск (HDD / NVMe)
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatBytes(snapshot.resources.hdd.totalBytes)}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span
                    className={`font-mono text-2xl font-semibold tabular-nums ${getUsageTextColor(
                      snapshot.resources.hdd.usagePercent
                    )}`}
                  >
                    {snapshot.resources.hdd.usagePercent.toFixed(1)}%
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    {formatBytes(snapshot.resources.hdd.freeBytes)} свободно
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full transition-all duration-200 ${getUsageBarColor(
                      snapshot.resources.hdd.usagePercent
                    )}`}
                    style={{ width: `${Math.min(100, snapshot.resources.hdd.usagePercent)}%` }}
                  />
                </div>
              </div>
              <div className="mt-3">
                <TelemetrySparkline
                  values={hddSeries}
                  maxVal={100}
                  stroke="#475569"
                  fill="rgba(71, 85, 105, 0.10)"
                  label="График заполнения диска"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                  <span>./data: {formatBytes(snapshot.resources.hdd.appDataBytes)}</span>
                  <span className="truncate max-w-[120px]" title={snapshot.resources.hdd.mountPath}>
                    {snapshot.resources.hdd.mountPath}
                  </span>
                </div>
              </div>
            </div>

            {/* NET */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                    <Network className="h-3.5 w-3.5 text-slate-500" />
                    Сеть (NET I/O)
                  </span>
                  <span className="font-mono truncate max-w-[110px]">
                    {snapshot.resources.net.activeInterfaces.join(', ')}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-xl font-semibold text-slate-900 tabular-nums">
                    {formatRate(
                      snapshot.resources.net.rxBytesPerSec +
                        snapshot.resources.net.txBytesPerSec
                    )}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    RX {formatRate(snapshot.resources.net.rxBytesPerSec)} · TX{' '}
                    {formatRate(snapshot.resources.net.txBytesPerSec)}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" title="Входящий трафик (RX)">
                    <div
                      className="h-full bg-[#0077FF] transition-all duration-200"
                      style={{
                        width: `${Math.min(
                          100,
                          snapshot.resources.net.rxBytesPerSec > 0
                            ? Math.max(12, Math.log10(snapshot.resources.net.rxBytesPerSec + 1) * 14)
                            : 4
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" title="Исходящий трафик (TX)">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-200"
                      style={{
                        width: `${Math.min(
                          100,
                          snapshot.resources.net.txBytesPerSec > 0
                            ? Math.max(12, Math.log10(snapshot.resources.net.txBytesPerSec + 1) * 14)
                            : 4
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <TelemetrySparkline
                  values={netSeries}
                  stroke="#0284C7"
                  fill="rgba(2, 132, 199, 0.12)"
                  label="График сетевого трафика KB/s"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                  <span>Всего RX: {formatBytes(snapshot.resources.net.totalRxBytes)}</span>
                  <span>TX: {formatBytes(snapshot.resources.net.totalTxBytes)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Service Connections Status Table / Matrix */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Состояние подключений к инфраструктурным сервисам
                </h4>
                <p className="text-xs text-slate-500">
                  Прямая проверка доступности и задержки отклика PostgreSQL, NATS, Forgejo и Garage S3
                </p>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {snapshot.services.filter((s) => s.status === 'connected').length} /{' '}
                {snapshot.services.length} активны
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {snapshot.services.map((svc) => {
                const statusMeta = getStatusMeta(svc.status);
                const StatusIcon = statusMeta.Icon;
                const ServiceIcon = getServiceIcon(svc.id);

                return (
                  <div
                    key={svc.id}
                    className="grid grid-cols-1 items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50 lg:grid-cols-12"
                  >
                    <div className="flex items-start gap-3 lg:col-span-4">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
                        <ServiceIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{svc.name}</span>
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${statusMeta.textClass}`}
                          >
                            <StatusIcon className="h-3.5 w-3.5" />
                            {statusMeta.label}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">{svc.role}</div>
                      </div>
                    </div>

                    <div className="lg:col-span-3">
                      <div className="truncate font-mono text-xs text-slate-800" title={svc.endpoint}>
                        {svc.endpoint}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-500" title={svc.mode}>
                        {svc.mode}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-1 lg:col-span-4">
                      {svc.metrics.map((m) => (
                        <div key={m.label} className="text-xs">
                          <span className="text-slate-500">{m.label}: </span>
                          <span className="font-mono font-medium text-slate-900 tabular-nums">
                            {m.value}
                          </span>
                        </div>
                      ))}
                      {svc.lastError && (
                        <div className="text-xs text-red-700">Ошибка: {svc.lastError}</div>
                      )}
                    </div>

                    <div className="text-left lg:col-span-1 lg:text-right">
                      <div className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                        {svc.latencyMs} ms
                      </div>
                      <div className="text-[11px] text-slate-400">отклик</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Host & Node.js Runtime Summary Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3">
              <Server className="h-4 w-4 text-slate-500" />
              <h4 className="text-sm font-semibold text-slate-900">Среда выполнения и процесс сервера</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Узел (Host)</th>
                    <th className="px-5 py-2.5 font-medium">Платформа</th>
                    <th className="px-5 py-2.5 font-medium">Node.js / PID</th>
                    <th className="px-5 py-2.5 font-medium">Аптайм процесса / ОС</th>
                    <th className="px-5 py-2.5 text-right font-medium">Heap Used / Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-slate-700">
                    <td className="px-5 py-3 font-mono font-medium text-slate-900">
                      {snapshot.runtime.hostname}
                    </td>
                    <td className="px-5 py-3 font-mono">{snapshot.runtime.platform}</td>
                    <td className="px-5 py-3 font-mono tabular-nums">
                      {snapshot.runtime.nodeVersion} · PID {snapshot.runtime.pid}
                    </td>
                    <td className="px-5 py-3 font-mono tabular-nums">
                      {formatUptime(snapshot.runtime.uptimeSeconds)} /{' '}
                      {formatUptime(snapshot.runtime.osUptimeSeconds)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-medium text-slate-900 tabular-nums">
                      {formatBytes(snapshot.resources.ram.processHeapUsedBytes)} /{' '}
                      {formatBytes(snapshot.resources.ram.processHeapTotalBytes)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
