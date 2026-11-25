import crypto from 'crypto';
import { EventEmitter } from 'events';
import { and, count, desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client.ts';
import { natsEvents } from '../db/schema.ts';
import { incrementNatsMetric } from '../telemetry/prometheusMetrics.ts';

export interface NatsMessage {
  id: string;
  tenantId: string;
  subject: string;
  actorId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type NatsQueueStatus = 'queued' | 'processing' | 'acked' | 'failed';

export type NatsStreamName =
  | 'CRM_EVENTS'
  | 'NOCOBASE_WORKFLOWS'
  | 'HARNESS_AI'
  | 'SOCIAL_FEED'
  | 'MARKETPLACE'
  | 'OFFICE_S3'
  | 'PLATFORM_IAM';

export interface NatsQueueItem {
  id: string;
  seq: number;
  tenantId: string;
  stream: NatsStreamName;
  subject: string;
  actorId: string;
  payload: Record<string, unknown>;
  status: NatsQueueStatus;
  consumerGroup: string;
  sseSubscribers: number;
  attempts: number;
  processingMs: number;
  detail: string;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
}

export interface NatsConsumerSummary {
  id: string;
  name: string;
  filterSubject: string;
  description: string;
  status: 'active' | 'processing' | 'idle';
  deliveredCount: number;
  pendingCount: number;
  failedCount: number;
  avgLatencyMs: number;
  lastSubject: string | null;
  lastActivityAt: string | null;
}

export interface NatsQueueSnapshot {
  streamName: string;
  endpoint: string;
  mode: string;
  collectedAt: string;
  stats: {
    totalPersisted: number;
    bufferSize: number;
    queuedCount: number;
    processingCount: number;
    ackedCount: number;
    failedCount: number;
    avgProcessingMs: number;
    sseSubscribers: number;
  };
  consumers: NatsConsumerSummary[];
  messages: NatsQueueItem[];
}

export interface PublishOptions {
  simulateError?: boolean;
  attempts?: number;
  consumerGroup?: string;
}

const MAX_TENANT_QUEUE_ITEMS = 80;

function resolveStreamAndConsumer(subject: string): {
  stream: NatsStreamName;
  consumerGroup: string;
} {
  if (subject.startsWith('nocobase.') || subject.startsWith('workflows.')) {
    return { stream: 'NOCOBASE_WORKFLOWS', consumerGroup: 'nocobase-workflow-worker' };
  }
  if (subject.startsWith('harness.')) {
    return { stream: 'HARNESS_AI', consumerGroup: 'deepseek-harness-worker' };
  }
  if (subject.startsWith('crm.')) {
    return { stream: 'CRM_EVENTS', consumerGroup: 'crm-pipeline-consumer' };
  }
  if (subject.startsWith('social.')) {
    return { stream: 'SOCIAL_FEED', consumerGroup: 'social-feed-fanout' };
  }
  if (subject.startsWith('marketplace.') || subject.startsWith('verdaccio.')) {
    return { stream: 'MARKETPLACE', consumerGroup: 'marketplace-health-worker' };
  }
  if (subject.startsWith('office.') || subject.startsWith('garage.') || subject.startsWith('forgejo.')) {
    return { stream: 'OFFICE_S3', consumerGroup: 'office-s3-sync' };
  }
  return { stream: 'PLATFORM_IAM', consumerGroup: 'platform-audit-sink' };
}

class NatsJetStreamBus extends EventEmitter {
  private tenantQueues = new Map<string, NatsQueueItem[]>();
  private tenantSeq = new Map<string, number>();

  private nextSeq(tenantId: string): number {
    const next = (this.tenantSeq.get(tenantId) || 0) + 1;
    this.tenantSeq.set(tenantId, next);
    return next;
  }

  private upsertQueueItem(item: NatsQueueItem) {
    const list = this.tenantQueues.get(item.tenantId) || [];
    const idx = list.findIndex((existing) => existing.id === item.id);
    if (idx >= 0) {
      list[idx] = { ...item };
    } else {
      list.unshift({ ...item });
      if (list.length > MAX_TENANT_QUEUE_ITEMS) {
        list.length = MAX_TENANT_QUEUE_ITEMS;
      }
    }
    this.tenantQueues.set(item.tenantId, list);
  }

  private emitQueueUpdate(item: NatsQueueItem) {
    const snapshotItem = { ...item };
    this.upsertQueueItem(snapshotItem);
    this.emit(`queue:tenant:${item.tenantId}`, snapshotItem);
  }

  async publish(
    tenantId: string,
    subject: string,
    actorId: string,
    payload: Record<string, unknown>,
    options: PublishOptions = {}
  ): Promise<NatsMessage> {
    const startedPerf = performance.now();
    const id = `evt_${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date();
    const createdAtIso = now.toISOString();
    const { stream, consumerGroup: defaultConsumer } = resolveStreamAndConsumer(subject);
    const consumerGroup = options.consumerGroup || defaultConsumer;
    const seq = this.nextSeq(tenantId);
    const attempts = Math.max(1, options.attempts || 1);
    const sseSubscribers = this.listenerCount(`tenant:${tenantId}`);

    const queueItem: NatsQueueItem = {
      id,
      seq,
      tenantId,
      stream,
      subject,
      actorId,
      payload,
      status: 'queued',
      consumerGroup,
      sseSubscribers,
      attempts,
      processingMs: 0,
      detail: `Поставлено в очередь ${stream} (#${seq})`,
      createdAt: createdAtIso,
      updatedAt: createdAtIso,
      processedAt: null,
    };

    // 1. Enqueue
    this.emitQueueUpdate(queueItem);

    // 2. Processing
    queueItem.status = 'processing';
    queueItem.updatedAt = new Date().toISOString();
    queueItem.detail = `Обработка консьюмером ${consumerGroup}...`;
    this.emitQueueUpdate(queueItem);

    try {
      const db = await getDb();
      await db.insert(natsEvents).values({
        id,
        tenantId,
        subject,
        actorId,
        payload,
        createdAt: now,
      });

      if (options.simulateError || payload.simulateError === true) {
        throw new Error(`Сбой консьюмера ${consumerGroup}: превышен таймаут подтверждения ACK`);
      }

      const msg: NatsMessage = {
        id,
        tenantId,
        subject,
        actorId,
        payload,
        createdAt: createdAtIso,
      };

      this.emit('message', msg);
      this.emit(`tenant:${tenantId}`, msg);
      incrementNatsMetric();

      const elapsedMs = Math.max(1, Math.round(performance.now() - startedPerf));
      const finishedIso = new Date().toISOString();
      const activeListeners = this.listenerCount(`tenant:${tenantId}`);

      queueItem.status = 'acked';
      queueItem.sseSubscribers = activeListeners;
      queueItem.processingMs = elapsedMs;
      queueItem.updatedAt = finishedIso;
      queueItem.processedAt = finishedIso;
      queueItem.detail = `ACK · PostgreSQL + SSE (${activeListeners} подп.) за ${elapsedMs} мс`;
      this.emitQueueUpdate(queueItem);

      return msg;
    } catch (err: unknown) {
      const elapsedMs = Math.max(1, Math.round(performance.now() - startedPerf));
      const failedIso = new Date().toISOString();
      const errMessage = err instanceof Error ? err.message : 'Ошибка обработки сообщения NATS';

      queueItem.status = 'failed';
      queueItem.processingMs = elapsedMs;
      queueItem.updatedAt = failedIso;
      queueItem.processedAt = failedIso;
      queueItem.detail = errMessage;
      this.emitQueueUpdate(queueItem);

      if (options.simulateError || payload.simulateError === true) {
        return {
          id,
          tenantId,
          subject,
          actorId,
          payload,
          createdAt: createdAtIso,
        };
      }
      throw err;
    }
  }

  async replayMessage(
    tenantId: string,
    messageId: string,
    actorId: string
  ): Promise<NatsQueueItem | null> {
    const liveList = this.tenantQueues.get(tenantId) || [];
    const liveMatch = liveList.find((m) => m.id === messageId);

    let sourceSubject = liveMatch?.subject;
    let sourcePayload = liveMatch?.payload;
    const prevAttempts = liveMatch?.attempts || 1;

    if (!sourceSubject) {
      const db = await getDb();
      const [row] = await db
        .select()
        .from(natsEvents)
        .where(and(eq(natsEvents.id, messageId), eq(natsEvents.tenantId, tenantId)));
      if (!row) return null;
      sourceSubject = row.subject;
      sourcePayload = row.payload;
    }

    const cleanPayload: Record<string, unknown> = { ...(sourcePayload || {}) };
    delete cleanPayload.simulateError;
    cleanPayload.replayedFrom = messageId;
    cleanPayload.replayAttempt = prevAttempts + 1;

    const published = await this.publish(tenantId, sourceSubject, actorId, cleanPayload, {
      attempts: prevAttempts + 1,
    });

    const updatedList = this.tenantQueues.get(tenantId) || [];
    return updatedList.find((m) => m.id === published.id) || null;
  }

  async listRecent(tenantId: string, limit = 40): Promise<NatsMessage[]> {
    const db = await getDb();
    const rows = await db
      .select()
      .from(natsEvents)
      .where(eq(natsEvents.tenantId, tenantId))
      .orderBy(desc(natsEvents.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      subject: row.subject,
      actorId: row.actorId,
      payload: row.payload,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async getQueueSnapshot(tenantId: string, subdomain = 'tenant'): Promise<NatsQueueSnapshot> {
    const db = await getDb();
    const [[totalRow], recentDbRows] = await Promise.all([
      db.select({ total: count() }).from(natsEvents).where(eq(natsEvents.tenantId, tenantId)),
      this.listRecent(tenantId, 50),
    ]);

    const liveItems = this.tenantQueues.get(tenantId) || [];
    const liveById = new Map(liveItems.map((item) => [item.id, item]));

    // Hydrate historical PG events that predate the current process memory buffer
    const merged: NatsQueueItem[] = [...liveItems];
    const totalPersisted = Number(totalRow?.total ?? recentDbRows.length);
    let fallbackSeq = Math.max(1, totalPersisted);

    for (const row of recentDbRows) {
      if (!liveById.has(row.id)) {
        const { stream, consumerGroup } = resolveStreamAndConsumer(row.subject);
        merged.push({
          id: row.id,
          seq: fallbackSeq--,
          tenantId: row.tenantId,
          stream,
          subject: row.subject,
          actorId: row.actorId,
          payload: row.payload,
          status: 'acked',
          consumerGroup,
          sseSubscribers: this.listenerCount(`tenant:${tenantId}`),
          attempts: 1,
          processingMs: 2,
          detail: 'ACK · сохранено в PostgreSQL (nats_events)',
          createdAt: row.createdAt,
          updatedAt: row.createdAt,
          processedAt: row.createdAt,
        });
      }
    }

    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const messages = merged.slice(0, 50);

    const queuedCount = messages.filter((m) => m.status === 'queued').length;
    const processingCount = messages.filter((m) => m.status === 'processing').length;
    const ackedCount = messages.filter((m) => m.status === 'acked').length;
    const failedCount = messages.filter((m) => m.status === 'failed').length;
    const measured = messages.filter((m) => m.processingMs > 0);
    const avgProcessingMs = measured.length
      ? Math.round(measured.reduce((acc, m) => acc + m.processingMs, 0) / measured.length)
      : 0;

    const sseSubscribers = this.listenerCount(`tenant:${tenantId}`);

    const buildConsumer = (
      id: string,
      name: string,
      filterSubject: string,
      description: string,
      matcher: (item: NatsQueueItem) => boolean
    ): NatsConsumerSummary => {
      const matched = messages.filter(matcher);
      const pending = matched.filter((m) => m.status === 'queued' || m.status === 'processing').length;
      const failed = matched.filter((m) => m.status === 'failed').length;
      const delivered = matched.filter((m) => m.status === 'acked').length;
      const latencies = matched.filter((m) => m.processingMs > 0);
      const avgLatencyMs = latencies.length
        ? Math.round(latencies.reduce((sum, m) => sum + m.processingMs, 0) / latencies.length)
        : 0;
      const latest = matched[0] || null;
      const status: NatsConsumerSummary['status'] =
        pending > 0 ? 'processing' : delivered > 0 || sseSubscribers > 0 ? 'active' : 'idle';

      return {
        id,
        name,
        filterSubject,
        description,
        status,
        deliveredCount: delivered,
        pendingCount: pending,
        failedCount: failed,
        avgLatencyMs,
        lastSubject: latest?.subject || null,
        lastActivityAt: latest?.createdAt || null,
      };
    };

    const consumers: NatsConsumerSummary[] = [
      buildConsumer(
        'pg-event-store',
        'PostgreSQL Event Sink',
        '>',
        'Гарантированная запись всех событий в nats_events',
        () => true
      ),
      buildConsumer(
        'sse-live-fanout',
        'SSE Live Fanout',
        `tenant.${subdomain}.>`,
        `Потоковая доставка клиентам (${sseSubscribers} активн. SSE)`,
        () => true
      ),
      buildConsumer(
        'nocobase-workflow-worker',
        'NocoBase Workflow Worker',
        'nocobase.*, workflows.*, crm.*.deal.*',
        'Триггеры сценариев, условий и согласований',
        (m) =>
          m.stream === 'NOCOBASE_WORKFLOWS' ||
          m.subject.startsWith('crm.')
      ),
      buildConsumer(
        'deepseek-harness-worker',
        'DeepSeek-Harness Worker',
        'harness.>, crm.*.deal.*',
        'AI-скоринг и анализ сделок в реальном времени',
        (m) => m.stream === 'HARNESS_AI' || m.subject.includes('.deal.')
      ),
      buildConsumer(
        'platform-ops-worker',
        'Platform Ops & Storage',
        'marketplace.*, office.*, garage.*, forgejo.*, iam.*',
        'Маркет плагинов, S3, Forgejo и RBAC аудит',
        (m) =>
          m.stream === 'MARKETPLACE' ||
          m.stream === 'OFFICE_S3' ||
          m.stream === 'PLATFORM_IAM' ||
          m.stream === 'SOCIAL_FEED'
      ),
    ];

    return {
      streamName: 'NEXUS_JETSTREAM',
      endpoint: process.env.NATS_URL || 'nats://jetstream.platform.local:4222',
      mode: process.env.NATS_URL ? 'External NATS JetStream' : 'In-Process JetStream + PG Log',
      collectedAt: new Date().toISOString(),
      stats: {
        totalPersisted,
        bufferSize: messages.length,
        queuedCount,
        processingCount,
        ackedCount,
        failedCount,
        avgProcessingMs,
        sseSubscribers,
      },
      consumers,
      messages,
    };
  }

  getSubscriberCount(): number {
    return this.eventNames()
      .filter((name) => String(name).startsWith('tenant:'))
      .reduce((acc, name) => acc + this.listenerCount(name), 0);
  }
}

export const natsBus = new NatsJetStreamBus();
