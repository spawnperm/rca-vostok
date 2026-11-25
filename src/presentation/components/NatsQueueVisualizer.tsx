import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  Loader2,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Server,
} from 'lucide-react';
import {
  formatNatsNotification,
  type NatsConnectionState,
  type NatsQueueItem,
  type NatsQueueSnapshot,
  type NatsQueueStatus,
  type NatsStreamName,
} from '../../application/nats/natsClient.ts';
import { refineClient } from '../../application/refine/client.ts';
import type { AuthenticatedActor } from '../../domain/shared/types.ts';
import { Modal } from './ui/Modal.tsx';

interface NatsQueueVisualizerProps {
  actor: AuthenticatedActor;
  mode: 'compact' | 'full';
  snapshot: NatsQueueSnapshot | null;
  connectionState: NatsConnectionState;
  loading: boolean;
  livePaused: boolean;
  lastPulseAt: number;
  onTogglePause: () => void;
  onRefresh: () => Promise<void>;
  onPublishEvent: (params: {
    subject: string;
    payload: Record<string, unknown>;
    simulateError: boolean;
  }) => Promise<void>;
  onReplayMessage: (id: string) => Promise<void>;
  onOpenFull?: () => void;
}

const STREAM_LABELS: Record<NatsStreamName, string> = {
  NOCOBASE_WORKFLOWS: 'NocoBase Workflows',
  CRM_EVENTS: 'CRM События',
  HARNESS_AI: 'DeepSeek-Harness',
  SOCIAL_FEED: 'Соцсеть и лента',
  MARKETPLACE: 'Маркет плагинов',
  OFFICE_S3: 'Univer S3 & Forgejo',
  PLATFORM_IAM: 'Платформа и RBAC',
};

function getConnectionMeta(state: NatsConnectionState) {
  switch (state) {
    case 'connected':
      return {
        label: 'SSE подключено',
        dotClass: 'bg-emerald-500',
        textClass: 'text-emerald-700',
        bgClass: 'border-emerald-200 bg-emerald-50/70',
      };
    case 'connecting':
    case 'reconnecting':
      return {
        label: state === 'connecting' ? 'Подключение...' : 'Переподключение...',
        dotClass: 'bg-amber-500 animate-pulse',
        textClass: 'text-amber-700',
        bgClass: 'border-amber-200 bg-amber-50/70',
      };
    default:
      return {
        label: 'Отключено',
        dotClass: 'bg-slate-400',
        textClass: 'text-slate-600',
        bgClass: 'border-slate-200 bg-slate-50',
      };
  }
}

function getStatusBadge(status: NatsQueueStatus) {
  switch (status) {
    case 'queued':
      return {
        label: 'В очереди',
        className: 'border-slate-200 bg-slate-100 text-slate-700',
        Icon: Clock,
      };
    case 'processing':
      return {
        label: 'Обработка',
        className: 'border-amber-200 bg-amber-50 text-amber-800',
        Icon: Loader2,
      };
    case 'acked':
      return {
        label: 'ACK',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        Icon: CheckCircle2,
      };
    case 'failed':
      return {
        label: 'Ошибка',
        className: 'border-red-200 bg-red-50 text-red-700',
        Icon: AlertTriangle,
      };
  }
}

export const NatsQueueVisualizer: React.FC<NatsQueueVisualizerProps> = ({
  actor,
  mode,
  snapshot,
  connectionState,
  loading,
  livePaused,
  lastPulseAt,
  onTogglePause,
  onRefresh,
  onPublishEvent,
  onReplayMessage,
  onOpenFull,
}) => {
  const canPublish =
    refineClient.can(actor, 'workflows:manage') || refineClient.can(actor, 'harness:execute');

  const [statusFilter, setStatusFilter] = useState<'all' | 'inflight' | 'acked' | 'failed'>('all');
  const [streamFilter, setStreamFilter] = useState<'all' | NatsStreamName>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);

  // Publish modal state
  const [publishOpen, setPublishOpen] = useState(false);
  const [pubSubject, setPubSubject] = useState('nocobase.acme.workflow.ping');
  const [pubPayloadText, setPubPayloadText] = useState(
    '{\n  "workflowName": "Проверка очереди NATS",\n  "priority": "high"\n}'
  );
  const [pubSimulateError, setPubSimulateError] = useState(false);
  const [pubError, setPubError] = useState('');
  const [publishing, setPublishing] = useState(false);

  const connMeta = getConnectionMeta(connectionState);
  const messages = useMemo(() => snapshot?.messages ?? [], [snapshot]);
  const stats = snapshot?.stats ?? {
    totalPersisted: 0,
    bufferSize: 0,
    queuedCount: 0,
    processingCount: 0,
    ackedCount: 0,
    failedCount: 0,
    avgProcessingMs: 0,
    sseSubscribers: 0,
  };

  const inFlightCount = stats.queuedCount + stats.processingCount;
  const isRecentlyActive = lastPulseAt > 0 && Date.now() - lastPulseAt < 3500;

  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return messages.filter((item) => {
      if (statusFilter === 'inflight' && item.status !== 'queued' && item.status !== 'processing') {
        return false;
      }
      if (statusFilter === 'acked' && item.status !== 'acked') {
        return false;
      }
      if (statusFilter === 'failed' && item.status !== 'failed') {
        return false;
      }
      if (streamFilter !== 'all' && item.stream !== streamFilter) {
        return false;
      }
      if (q) {
        const haystack = `${item.subject} ${item.consumerGroup} ${item.detail} ${JSON.stringify(
          item.payload
        )}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [messages, statusFilter, streamFilter, searchQuery]);

  const pulseTimeline = useMemo(() => {
    // Chronological order (oldest -> newest) for left-to-right throughput strip
    return [...messages.slice(0, 28)].reverse();
  }, [messages]);

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPubError('');
    let parsedPayload: Record<string, unknown> = {};
    try {
      const raw = JSON.parse(pubPayloadText || '{}');
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        setPubError('Payload должен быть JSON-объектом');
        return;
      }
      parsedPayload = raw as Record<string, unknown>;
    } catch {
      setPubError('Некорректный JSON в поле Payload');
      return;
    }

    setPublishing(true);
    try {
      await onPublishEvent({
        subject: pubSubject.trim(),
        payload: parsedPayload,
        simulateError: pubSimulateError,
      });
      setPublishOpen(false);
    } catch (err: unknown) {
      setPubError(err instanceof Error ? err.message : 'Ошибка публикации');
    } finally {
      setPublishing(false);
    }
  };

  const handleReplay = async (id: string) => {
    setReplayingId(id);
    try {
      await onReplayMessage(id);
    } finally {
      setReplayingId(null);
    }
  };

  // ==========================================
  // COMPACT STRIP MODE (inside Workflows / Approvals tabs)
  // ==========================================
  if (mode === 'compact') {
    const latestThree = messages.slice(0, 3);
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${connMeta.dotClass}`} />
              <span className="text-xs font-semibold text-slate-900">
                Очередь NATS JetStream
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {snapshot?.streamName || 'NEXUS_JETSTREAM'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] tabular-nums">
              <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">
                В обработке: <strong>{inFlightCount}</strong>
              </span>
              <span className="rounded border border-emerald-200 bg-emerald-50/70 px-2 py-0.5 text-emerald-800">
                ACK: <strong>{stats.ackedCount}</strong>
              </span>
              {stats.failedCount > 0 && (
                <span className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-red-700">
                  Ошибки: <strong>{stats.failedCount}</strong>
                </span>
              )}
              <span className="text-slate-500">
                Сред. {stats.avgProcessingMs} мс · SSE: {stats.sseSubscribers}
              </span>
            </div>
          </div>

          {onOpenFull && (
            <button
              type="button"
              onClick={onOpenFull}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-[#0077FF] hover:text-[#0077FF] whitespace-nowrap"
            >
              <Radio className="h-3.5 w-3.5 text-[#0077FF]" />
              Визуализатор очереди
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>

        {latestThree.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
            <span className="text-[11px] font-medium text-slate-400">Live-активность:</span>
            {latestThree.map((item) => {
              const badge = getStatusBadge(item.status);
              const StatusIcon = badge.Icon;
              return (
                <div
                  key={item.id}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50/70 px-2 py-1 text-[11px]"
                >
                  <StatusIcon
                    className={`h-3 w-3 shrink-0 ${
                      item.status === 'acked'
                        ? 'text-emerald-600'
                        : item.status === 'failed'
                        ? 'text-red-600'
                        : item.status === 'processing'
                        ? 'animate-spin text-amber-600'
                        : 'text-slate-500'
                    }`}
                  />
                  <span className="font-mono text-slate-800 truncate max-w-[200px]">
                    {item.subject}
                  </span>
                  <span className="text-slate-400 tabular-nums">{item.processingMs} мс</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // FULL VISUALIZER MODE (Очередь NATS tab)
  // ==========================================
  return (
    <div className="space-y-4">
      {/* Top Pipeline & Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Визуализатор очереди и обработки NATS JetStream
              </h3>
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${connMeta.bgClass} ${connMeta.textClass}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${connMeta.dotClass}`} />
                {connMeta.label}
              </span>
              {isRecentlyActive && !livePaused && (
                <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#0077FF]">
                  <Activity className="h-3 w-3" /> Поток активен
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Поток <span className="font-mono text-slate-700">{snapshot?.streamName || 'NEXUS_JETSTREAM'}</span> ·{' '}
              <span className="font-mono text-slate-600">{snapshot?.endpoint || 'nats://jetstream.platform.local:4222'}</span> ·{' '}
              {snapshot?.mode || 'In-Process JetStream + PG Log'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onTogglePause}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                livePaused
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {livePaused ? (
                <>
                  <Play className="h-3.5 w-3.5" /> Возобновить Live
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5" /> Пауза Live
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Обновить
            </button>
            {canPublish && (
              <button
                type="button"
                onClick={() => {
                  setPubError('');
                  setPublishOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
              >
                <Send className="h-3.5 w-3.5" /> Отправить событие
              </button>
            )}
          </div>
        </div>

        {/* 4-Stage Pipeline Flow Diagram */}
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-11 lg:items-center">
          {/* Stage 1: Producers */}
          <div
            className={`lg:col-span-2 rounded-xl border p-3.5 transition-colors ${
              isRecentlyActive ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-slate-50/60'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>1. Источники</span>
              <Layers className="h-3.5 w-3.5 text-[#0077FF]" />
            </div>
            <div className="mt-1.5 text-xl font-bold text-slate-900 tabular-nums">
              {stats.totalPersisted}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              CRM · NocoBase · Harness
            </div>
          </div>

          <div className="hidden lg:flex lg:col-span-1 justify-center text-slate-300">
            <ArrowRight className={`h-5 w-5 ${isRecentlyActive ? 'text-[#0077FF]' : ''}`} />
          </div>

          {/* Stage 2: JetStream Queue */}
          <div
            className={`lg:col-span-2 rounded-xl border p-3.5 ${
              stats.queuedCount > 0
                ? 'border-amber-300 bg-amber-50/60'
                : 'border-slate-200 bg-slate-50/60'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>2. Очередь</span>
              <Clock className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div className="mt-1.5 text-xl font-bold text-slate-900 tabular-nums">
              {stats.queuedCount}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
              Буфер: {stats.bufferSize} / 80
            </div>
          </div>

          <div className="hidden lg:flex lg:col-span-1 justify-center text-slate-300">
            <ArrowRight className={`h-5 w-5 ${stats.processingCount > 0 ? 'text-amber-500' : ''}`} />
          </div>

          {/* Stage 3: Consumers Processing */}
          <div
            className={`lg:col-span-2 rounded-xl border p-3.5 ${
              stats.processingCount > 0
                ? 'border-amber-300 bg-amber-50/60'
                : 'border-slate-200 bg-slate-50/60'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>3. Обработка</span>
              <Server className="h-3.5 w-3.5 text-slate-600" />
            </div>
            <div className="mt-1.5 text-xl font-bold text-slate-900 tabular-nums">
              {stats.processingCount}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
              Сред. время: {stats.avgProcessingMs} мс
            </div>
          </div>

          <div className="hidden lg:flex lg:col-span-1 justify-center text-slate-300">
            <ArrowRight className={`h-5 w-5 ${isRecentlyActive ? 'text-emerald-500' : ''}`} />
          </div>

          {/* Stage 4: Delivered / Failed */}
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>4. Статус ACK</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2 tabular-nums">
              <span className="text-xl font-bold text-emerald-700">{stats.ackedCount}</span>
              {stats.failedCount > 0 && (
                <span className="text-xs font-semibold text-red-600">
                  / {stats.failedCount} сбой
                </span>
              )}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
              SSE подписчиков: {stats.sseSubscribers}
            </div>
          </div>
        </div>

        {/* Real-Time Pulse Strip */}
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>
              Лента импульсов обработки (последние {pulseTimeline.length} событий — нажмите на блок для просмотра)
            </span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-xs bg-emerald-500" /> ACK
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-xs bg-amber-500" /> Очередь/Обработка
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-xs bg-red-500" /> Ошибка
              </span>
            </div>
          </div>
          <div className="mt-2 flex h-7 items-end gap-1">
            {pulseTimeline.length === 0 ? (
              <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-slate-200 text-[11px] text-slate-400">
                Нет событий в буфере
              </div>
            ) : (
              pulseTimeline.map((item) => {
                const barColor =
                  item.status === 'failed'
                    ? 'bg-red-500 hover:bg-red-600'
                    : item.status === 'processing' || item.status === 'queued'
                    ? 'bg-amber-400 hover:bg-amber-500'
                    : 'bg-emerald-500 hover:bg-emerald-600';
                const heightPercent = Math.min(100, Math.max(32, 28 + item.processingMs * 6));
                const isSelected = expandedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setExpandedId(isSelected ? null : item.id)}
                    title={`#${item.seq} ${item.subject} (${item.status}, ${item.processingMs} мс)`}
                    style={{ height: `${heightPercent}%` }}
                    className={`flex-1 min-w-[8px] max-w-[26px] rounded-xs transition-all ${barColor} ${
                      isSelected ? 'ring-2 ring-[#0077FF] ring-offset-1' : ''
                    }`}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Consumers Grid */}
      {snapshot?.consumers && snapshot.consumers.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {snapshot.consumers.map((consumer) => {
            const statusTone =
              consumer.status === 'processing'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : consumer.status === 'active'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-100 text-slate-600';
            const statusLabel =
              consumer.status === 'processing'
                ? 'Обработка'
                : consumer.status === 'active'
                ? 'Активен'
                : 'Ожидание';

            return (
              <div key={consumer.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-900 leading-snug">
                    {consumer.name}
                  </div>
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${statusTone}`}
                  >
                    {statusLabel}
                  </span>
                </div>
                <div className="mt-1 truncate font-mono text-[11px] text-[#0077FF]">
                  {consumer.filterSubject}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                  {consumer.description}
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-600 tabular-nums">
                  <span>
                    ACK: <strong className="text-slate-900">{consumer.deliveredCount}</strong>
                  </span>
                  {consumer.failedCount > 0 ? (
                    <span className="text-red-600 font-semibold">
                      Сбои: {consumer.failedCount}
                    </span>
                  ) : (
                    <span>{consumer.avgLatencyMs} мс</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter Toolbar & Message Queue Stream */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  ['all', `Все (${messages.length})`],
                  ['inflight', `В работе (${inFlightCount})`],
                  ['acked', `ACK (${stats.ackedCount})`],
                  ['failed', `Ошибки (${stats.failedCount})`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStatusFilter(id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                    statusFilter === id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <select
              value={streamFilter}
              onChange={(e) => setStreamFilter(e.target.value as 'all' | NatsStreamName)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 outline-none"
            >
              <option value="all">Все потоки</option>
              {Object.entries(STREAM_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по subject, воркеру, payload..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:border-[#0077FF] focus:bg-white"
            />
          </div>
        </div>

        {filteredMessages.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Нет сообщений NATS, соответствующих выбранным фильтрам
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredMessages.map((item: NatsQueueItem) => {
              const badge = getStatusBadge(item.status);
              const StatusIcon = badge.Icon;
              const formatted = formatNatsNotification({
                id: item.id,
                tenantId: item.tenantId,
                subject: item.subject,
                actorId: item.actorId,
                payload: item.payload,
                createdAt: item.createdAt,
              });
              const isExpanded = expandedId === item.id;

              return (
                <div key={item.id} className="px-4 py-3 hover:bg-slate-50/70">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium ${badge.className}`}
                        >
                          <StatusIcon
                            className={`h-3 w-3 ${
                              item.status === 'processing' ? 'animate-spin' : ''
                            }`}
                          />
                          {badge.label}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                          #{item.seq}
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-[#0077FF]">
                          {item.subject}
                        </span>
                        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                          {item.stream}
                        </span>
                        {item.attempts > 1 && (
                          <span className="font-mono text-[10px] text-amber-700">
                            Попытка #{item.attempts}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span className="font-semibold text-slate-900">{formatted.title}</span>
                        {formatted.detail && (
                          <span className="text-slate-600">{formatted.detail}</span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        <span>
                          Воркер: <span className="font-mono text-slate-700">{item.consumerGroup}</span>
                        </span>
                        <span className="tabular-nums">Обработка: {item.processingMs} мс</span>
                        <span className="tabular-nums">SSE: {item.sseSubscribers}</span>
                        <span className="text-slate-400">{item.detail}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                        {new Date(item.createdAt).toLocaleTimeString('ru-RU')}
                      </span>

                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Payload
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>

                      {canPublish && (
                        <button
                          type="button"
                          onClick={() => void handleReplay(item.id)}
                          disabled={replayingId === item.id}
                          title="Повторно отправить сообщение в очередь NATS"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-[#0077FF] hover:text-[#0077FF] disabled:opacity-50"
                        >
                          <RotateCcw
                            className={`h-3 w-3 ${replayingId === item.id ? 'animate-spin' : ''}`}
                          />
                          Повторить
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] text-slate-100 overflow-x-auto">
                      <div className="mb-1.5 flex items-center justify-between text-[10px] text-slate-400">
                        <span>ID: {item.id} · Actor: {item.actorId}</span>
                        <span>
                          Processed: {item.processedAt ? new Date(item.processedAt).toLocaleTimeString('ru-RU') : 'pending'}
                        </span>
                      </div>
                      <pre className="whitespace-pre-wrap break-all">
                        {JSON.stringify(item.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Publish Custom / Test NATS Event Modal */}
      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="Публикация события в очередь NATS JetStream"
      >
        <form onSubmit={handlePublishSubmit} className="space-y-3">
          <div>
            <div className="mb-1.5 text-[11px] font-medium text-slate-500">Быстрые шаблоны:</div>
            <div className="flex flex-wrap gap-1.5">
              {[
                {
                  label: 'NocoBase Workflow',
                  subject: 'nocobase.acme.workflow.completed',
                  payload: { workflowName: 'Контроль SLA сделки', durationMs: 14, stepsCount: 3 },
                  err: false,
                },
                {
                  label: 'CRM Событие',
                  subject: 'crm.acme.deal.updated',
                  payload: { dealId: 'dl_demo', title: 'Корпоративный контракт', budget: 950000 },
                  err: false,
                },
                {
                  label: 'DeepSeek-Harness',
                  subject: 'harness.deal.analyzed',
                  payload: { winProbability: 82, nextStepTitle: 'Согласовать договор' },
                  err: false,
                },
                {
                  label: 'Тест сбоя (DLQ)',
                  subject: 'nocobase.acme.workflow.failed',
                  payload: { workflowName: 'Синхронизация ERP', reason: 'timeout' },
                  err: true,
                },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setPubSubject(preset.subject);
                    setPubPayloadText(JSON.stringify(preset.payload, null, 2));
                    setPubSimulateError(preset.err);
                  }}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-[#0077FF] hover:text-[#0077FF]"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Subject (тема NATS)</label>
            <input
              required
              value={pubSubject}
              onChange={(e) => setPubSubject(e.target.value)}
              placeholder="nocobase.acme.workflow.ping"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-[#0077FF]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Payload (JSON)</label>
            <textarea
              rows={5}
              value={pubPayloadText}
              onChange={(e) => setPubPayloadText(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-[#0077FF]"
            />
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={pubSimulateError}
              onChange={(e) => setPubSimulateError(e.target.checked)}
              className="h-4 w-4 accent-red-600"
            />
            Смоделировать ошибку консьюмера (проверка статуса «Ошибка» и повторной отправки)
          </label>

          {pubError && <div className="text-xs text-red-600">{pubError}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPublishOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={publishing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {publishing ? 'Отправка...' : 'Опубликовать в NATS'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
