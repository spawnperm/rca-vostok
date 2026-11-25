export interface NatsClientMessage {
  id: string;
  tenantId: string;
  subject: string;
  actorId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type NatsConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

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

export type NatsEventHandler = (msg: NatsClientMessage) => void;
export type NatsQueueHandler = (item: NatsQueueItem) => void;

interface Subscription {
  id: number;
  pattern: string;
  handler: NatsEventHandler;
}

/**
 * Matches NATS-style wildcard subjects:
 * - `*` matches a single token
 * - `>` matches one or more trailing tokens
 */
export function matchNatsSubject(pattern: string, subject: string): boolean {
  if (pattern === '>' || pattern === subject) return true;
  const patternTokens = pattern.split('.');
  const subjectTokens = subject.split('.');

  for (let i = 0; i < patternTokens.length; i++) {
    const token = patternTokens[i];
    if (token === '>') {
      return i <= subjectTokens.length - 1;
    }
    if (i >= subjectTokens.length) return false;
    if (token !== '*' && token !== subjectTokens[i]) {
      return false;
    }
  }

  return patternTokens.length === subjectTokens.length;
}

export interface FormattedNatsNotification {
  title: string;
  detail: string;
  subject: string;
  tone: 'ok' | 'info' | 'warn' | 'err';
  refreshScope: 'crm' | 'social' | 'marketplace' | 'none';
}

export function isTaskDeadlineOrReminderSubject(subject: string): boolean {
  return (
    matchNatsSubject('crm.*.task.reminder', subject) ||
    matchNatsSubject('crm.*.task.deadline_due', subject) ||
    matchNatsSubject('crm.*.task.deadline_overdue', subject)
  );
}

export function formatNatsNotification(msg: NatsClientMessage): FormattedNatsNotification {
  const { subject, payload } = msg;
  const str = (key: string) => (typeof payload[key] === 'string' ? (payload[key] as string) : '');
  const num = (key: string) => (typeof payload[key] === 'number' ? (payload[key] as number) : null);

  if (matchNatsSubject('crm.*.deal.created', subject)) {
    const budget = num('budget');
    return {
      title: 'Новая сделка',
      detail: `${str('title') || str('dealId')}${budget !== null ? ` · ${budget.toLocaleString('ru-RU')}` : ''}`,
      subject,
      tone: 'ok',
      refreshScope: 'crm',
    };
  }

  if (matchNatsSubject('crm.*.deal.updated', subject)) {
    const ownerName = str('ownerName');
    return {
      title: ownerName ? 'Ответственный по сделке изменён' : 'Сделка обновлена',
      detail: [str('title') || str('dealId'), ownerName].filter(Boolean).join(' · '),
      subject,
      tone: 'info',
      refreshScope: 'crm',
    };
  }

  if (matchNatsSubject('crm.*.deal.moved', subject)) {
    const dealLabel = str('title') || str('dealId');
    return {
      title: 'Этап сделки изменён',
      detail: `${dealLabel} → ${str('stageName') || str('stageId')}`,
      subject,
      tone: 'info',
      refreshScope: 'crm',
    };
  }

  if (matchNatsSubject('crm.*.deal.deleted', subject)) {
    return {
      title: 'Сделка удалена',
      detail: str('title') || str('dealId'),
      subject,
      tone: 'warn',
      refreshScope: 'crm',
    };
  }

  if (matchNatsSubject('crm.*.timeline.message', subject)) {
    const author = str('authorName');
    const dealTitle = str('dealTitle');
    const preview = str('preview');
    return {
      title: 'Новое сообщение по сделке',
      detail: [author, dealTitle, preview].filter(Boolean).join(' · '),
      subject,
      tone: 'info',
      refreshScope: 'crm',
    };
  }

  if (matchNatsSubject('crm.*.email.sent', subject)) {
    const toEmail = str('toEmail');
    const mailSubject = str('subject');
    return {
      title: 'Email отправлен клиенту',
      detail: [toEmail, mailSubject].filter(Boolean).join(' · '),
      subject,
      tone: 'ok',
      refreshScope: 'crm',
    };
  }

  if (matchNatsSubject('crm.*.email_template.created', subject)) {
    return {
      title: 'Создан шаблон Email',
      detail: str('name') || str('templateId'),
      subject,
      tone: 'ok',
      refreshScope: 'crm',
    };
  }

  if (matchNatsSubject('crm.*.email_template.updated', subject)) {
    return {
      title: 'Шаблон Email обновлён',
      detail: str('name') || str('templateId'),
      subject,
      tone: 'info',
      refreshScope: 'crm',
    };
  }

  if (matchNatsSubject('crm.*.email_template.deleted', subject)) {
    return {
      title: 'Шаблон Email удалён',
      detail: str('name') || str('templateId'),
      subject,
      tone: 'warn',
      refreshScope: 'crm',
    };
  }

  if (matchNatsSubject('crm.*.task.created_from_harness', subject)) {
    return {
      title: 'Задача от DeepSeek-Harness',
      detail: str('title') || str('taskId'),
      subject,
      tone: 'ok',
      refreshScope: 'crm',
    };
  }

  if (matchNatsSubject('crm.*.task.created', subject)) {
    const typeLabel = str('taskType') === 'meeting' ? 'Встреча' : 'Задача';
    const dealTitle = str('dealTitle');
    return {
      title: `${typeLabel} в календаре CRM`,
      detail: [str('title'), dealTitle].filter(Boolean).join(' · ') || str('taskId'),
      subject,
      tone: 'ok',
      refreshScope: 'crm',
    };
  }

  if (matchNatsSubject('crm.*.task.rescheduled', subject)) {
    const dueIso = str('dueAt');
    const dueFormatted = dueIso ? new Date(dueIso).toLocaleString('ru-RU') : '';
    return {
      title: 'Срок перенесён в календаре',
      detail: [str('title'), dueFormatted].filter(Boolean).join(' · ') || str('taskId'),
      subject,
      tone: 'info',
      refreshScope: 'crm',
    };
  }

  if (matchNatsSubject('crm.*.task.reminder', subject)) {
    const typeLabel = str('taskType') === 'meeting' ? 'встрече' : 'задаче';
    const minutesLeft = num('minutesLeft');
    const dueIso = str('dueAt');
    const dueFormatted = dueIso
      ? new Date(dueIso).toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
    const timeHint =
      minutesLeft !== null && minutesLeft > 0 ? `через ${minutesLeft} мин (${dueFormatted})` : dueFormatted;
    return {
      title: `Напоминание о ${typeLabel}`,
      detail:
        [str('title'), timeHint, str('dealTitle'), str('assigneeName')].filter(Boolean).join(' · ') ||
        str('taskId'),
      subject,
      tone: 'warn',
      refreshScope: 'crm',
    };
  }

  if (matchNatsSubject('crm.*.task.deadline_due', subject)) {
    const typeLabel = str('taskType') === 'meeting' ? 'Время встречи наступило' : 'Наступил дедлайн задачи';
    const dueIso = str('dueAt');
    const dueFormatted = dueIso
      ? new Date(dueIso).toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
    return {
      title: typeLabel,
      detail:
        [str('title'), dueFormatted, str('dealTitle'), str('assigneeName')].filter(Boolean).join(' · ') ||
        str('taskId'),
      subject,
      tone: 'warn',
      refreshScope: 'crm',
    };
  }

  if (matchNatsSubject('crm.*.task.deadline_overdue', subject)) {
    const overdueMinutes = num('overdueMinutes');
    const overdueText =
      overdueMinutes !== null && overdueMinutes > 0
        ? overdueMinutes >= 60
          ? `просрочено на ${Math.round(overdueMinutes / 60)} ч`
          : `просрочено на ${overdueMinutes} мин`
        : 'просрочено';
    return {
      title: 'Просрочен дедлайн задачи',
      detail:
        [str('title'), overdueText, str('dealTitle'), str('assigneeName')].filter(Boolean).join(' · ') ||
        str('taskId'),
      subject,
      tone: 'err',
      refreshScope: 'crm',
    };
  }

  if (matchNatsSubject('crm.*.contact.created', subject)) {
    return {
      title: 'Новый контакт',
      detail: str('fullName') || str('contactId'),
      subject,
      tone: 'ok',
      refreshScope: 'crm',
    };
  }

  if (matchNatsSubject('social.*.post.created', subject)) {
    const author = str('authorName');
    const preview = str('preview');
    return {
      title: 'Новая публикация в ленте',
      detail: [author, preview].filter(Boolean).join(': ') || str('postId'),
      subject,
      tone: 'info',
      refreshScope: 'social',
    };
  }

  if (matchNatsSubject('social.*.comment.created', subject)) {
    const author = str('authorName');
    const preview = str('preview');
    return {
      title: 'Новое сообщение в обсуждении',
      detail: [author, preview].filter(Boolean).join(': ') || str('commentId'),
      subject,
      tone: 'info',
      refreshScope: 'social',
    };
  }

  if (matchNatsSubject('mattermost.*.post.created', subject)) {
    const author = str('authorName');
    const channel = str('channelName');
    const preview = str('preview');
    return {
      title: channel ? `Чат #${channel}` : 'Новое сообщение в чате',
      detail: [author, preview].filter(Boolean).join(': ') || str('postId'),
      subject,
      tone: 'info',
      refreshScope: 'social',
    };
  }

  if (matchNatsSubject('harness.deal.analyzed', subject)) {
    const prob = num('winProbability');
    const nextTitle = str('nextStepTitle');
    return {
      title: 'Анализ DeepSeek-Harness',
      detail: [prob !== null ? `Вероятность ${prob}%` : '', nextTitle].filter(Boolean).join(' · '),
      subject,
      tone: 'info',
      refreshScope: 'crm',
    };
  }

  if (matchNatsSubject('harness.workflow.*.completed', subject)) {
    return {
      title: 'Сценарий DeepSeek-Harness',
      detail: str('workflowName') || subject,
      subject,
      tone: 'ok',
      refreshScope: 'none',
    };
  }

  if (matchNatsSubject('marketplace.*.plugin.dependency_error', subject)) {
    const pkg = str('name') || str('npmPackageName') || str('pluginId');
    const dep = str('dependency');
    const errText = str('error');
    return {
      title: 'Сбой зависимости плагина',
      detail: [pkg, dep, errText].filter(Boolean).join(' · '),
      subject,
      tone: 'err',
      refreshScope: 'none',
    };
  }

  if (matchNatsSubject('marketplace.*.plugin.*', subject)) {
    return {
      title: 'Обновление Маркета плагинов',
      detail: str('name') || str('pluginId') || subject,
      subject,
      tone: 'info',
      refreshScope: 'marketplace',
    };
  }

  if (matchNatsSubject('tenancy.subdomain.*', subject)) {
    return {
      title: 'Обновление тенанта',
      detail: str('subdomain') || subject,
      subject,
      tone: 'info',
      refreshScope: 'none',
    };
  }

  if (matchNatsSubject('iam.rbac.role.updated', subject)) {
    return {
      title: 'Матрица прав RBAC изменена',
      detail: str('roleName') || str('roleId') || subject,
      subject,
      tone: 'warn',
      refreshScope: 'none',
    };
  }

  if (matchNatsSubject('devops.git.pushed', subject)) {
    return {
      title: 'Коммит отправлен в GitHub',
      detail: `${str('repository')} · ${str('branch')} (${str('commitSha')})`,
      subject,
      tone: 'ok',
      refreshScope: 'none',
    };
  }

  if (matchNatsSubject('office.*.document.saved', subject)) {
    const kind = str('kind').toUpperCase();
    return {
      title: 'Документ Univer сохранён в Garage S3',
      detail: [str('title'), kind ? `.${kind.toLowerCase()}` : ''].filter(Boolean).join(' · '),
      subject,
      tone: 'ok',
      refreshScope: 'crm',
    };
  }

  if (matchNatsSubject('forgejo.*.repo.*', subject)) {
    return {
      title: 'Обновление репозитория Forgejo',
      detail: [str('fullName'), str('commitSha'), str('message')].filter(Boolean).join(' · '),
      subject,
      tone: 'info',
      refreshScope: 'none',
    };
  }

  if (matchNatsSubject('garage.*.bucket.created', subject)) {
    return {
      title: 'Создан бакет Garage S3',
      detail: str('bucketName') || subject,
      subject,
      tone: 'ok',
      refreshScope: 'none',
    };
  }

  if (matchNatsSubject('nocobase.*.workflow.completed', subject)) {
    const dur = num('durationMs');
    return {
      title: 'Выполнен процесс NocoBase',
      detail: [str('workflowName') || subject, dur !== null ? `${dur} мс` : ''].filter(Boolean).join(' · '),
      subject,
      tone: 'ok',
      refreshScope: 'none',
    };
  }

  if (matchNatsSubject('nocobase.*.approval.requested', subject)) {
    return {
      title: 'Новый запрос согласования',
      detail: str('title') || str('approvalId') || subject,
      subject,
      tone: 'info',
      refreshScope: 'none',
    };
  }

  if (matchNatsSubject('nocobase.*.approval.*', subject)) {
    const decision = str('decision');
    return {
      title: decision === 'approved' ? 'Запрос согласован' : 'Согласование обновлено',
      detail: str('title') || str('approvalId') || subject,
      subject,
      tone: decision === 'rejected' ? 'warn' : 'ok',
      refreshScope: 'none',
    };
  }

  if (matchNatsSubject('nocobase.*.collection.created', subject)) {
    return {
      title: 'Создана коллекция NocoBase',
      detail: str('title') || str('key') || subject,
      subject,
      tone: 'ok',
      refreshScope: 'none',
    };
  }

  if (matchNatsSubject('workflows.*.executed', subject)) {
    return {
      title: 'Событие процесса NocoBase',
      detail: str('workflowName') || subject,
      subject,
      tone: 'ok',
      refreshScope: 'none',
    };
  }

  return {
    title: 'Событие NATS',
    detail: subject,
    subject,
    tone: 'info',
    refreshScope: 'none',
  };
}

export class NatsRealtimeClient {
  private subscriptions: Subscription[] = [];
  private nextSubId = 1;
  private abortController: AbortController | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;
  private activeSessionKey: string | null = null;
  private seenIds = new Set<string>();
  private seenOrder: string[] = [];
  private statusListeners = new Set<(state: NatsConnectionState) => void>();
  private queueListeners = new Set<NatsQueueHandler>();
  private connectionState: NatsConnectionState = 'disconnected';

  getState(): NatsConnectionState {
    return this.connectionState;
  }

  onStateChange(listener: (state: NatsConnectionState) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  subscribeQueue(handler: NatsQueueHandler): () => void {
    this.queueListeners.add(handler);
    return () => {
      this.queueListeners.delete(handler);
    };
  }

  private setState(next: NatsConnectionState) {
    if (this.connectionState === next) return;
    this.connectionState = next;
    for (const listener of this.statusListeners) {
      listener(next);
    }
  }

  subscribe(pattern: string, handler: NatsEventHandler): () => void {
    const id = this.nextSubId++;
    this.subscriptions.push({ id, pattern, handler });
    return () => {
      this.subscriptions = this.subscriptions.filter((sub) => sub.id !== id);
    };
  }

  private dispatchQueueItem(item: NatsQueueItem) {
    if (!item || !item.id) return;
    for (const listener of this.queueListeners) {
      try {
        listener(item);
      } catch (err) {
        console.error('NATS queue listener error:', err);
      }
    }
  }

  private dispatchMessage(msg: NatsClientMessage) {
    if (!msg || !msg.id) return;
    if (this.seenIds.has(msg.id)) return;

    this.seenIds.add(msg.id);
    this.seenOrder.push(msg.id);
    if (this.seenOrder.length > 500) {
      const oldest = this.seenOrder.shift();
      if (oldest) this.seenIds.delete(oldest);
    }

    for (const sub of this.subscriptions) {
      if (matchNatsSubject(sub.pattern, msg.subject)) {
        try {
          sub.handler(msg);
        } catch (err) {
          console.error('NATS subscriber error:', err);
        }
      }
    }
  }

  connect(token: string, subdomain: string) {
    const sessionKey = `${subdomain}:${token}`;
    if (this.activeSessionKey === sessionKey && this.abortController) {
      return;
    }
    this.disconnect();
    this.activeSessionKey = sessionKey;
    this.retryAttempt = 0;
    void this.openStream(token, subdomain, sessionKey);
  }

  disconnect() {
    this.activeSessionKey = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.setState('disconnected');
  }

  private scheduleReconnect(token: string, subdomain: string, sessionKey: string) {
    if (this.activeSessionKey !== sessionKey) return;
    this.setState('reconnecting');
    const delayMs = Math.min(15000, 1000 * Math.pow(2, this.retryAttempt));
    this.retryAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      if (this.activeSessionKey === sessionKey) {
        void this.openStream(token, subdomain, sessionKey);
      }
    }, delayMs);
  }

  private async openStream(token: string, subdomain: string, sessionKey: string) {
    if (this.activeSessionKey !== sessionKey) return;

    const controller = new AbortController();
    this.abortController = controller;
    this.setState(this.retryAttempt > 0 ? 'reconnecting' : 'connecting');

    try {
      const response = await fetch('/api/nats/stream', {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Subdomain': subdomain,
        },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        if (response.status === 401 || response.status === 403) {
          this.disconnect();
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      this.retryAttempt = 0;
      this.setState('connected');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (this.activeSessionKey !== sessionKey) return;

        buffer += decoder.decode(value, { stream: true });
        let boundaryIdx = buffer.indexOf('\n\n');
        while (boundaryIdx !== -1) {
          const frame = buffer.slice(0, boundaryIdx);
          buffer = buffer.slice(boundaryIdx + 2);
          this.processSseFrame(frame);
          boundaryIdx = buffer.indexOf('\n\n');
        }
      }

      if (this.activeSessionKey === sessionKey) {
        this.scheduleReconnect(token, subdomain, sessionKey);
      }
    } catch (err: unknown) {
      if (controller.signal.aborted || this.activeSessionKey !== sessionKey) {
        return;
      }
      console.warn('NATS stream connection interrupted, reconnecting...', err);
      this.scheduleReconnect(token, subdomain, sessionKey);
    }
  }

  private processSseFrame(frame: string) {
    if (!frame.trim()) return;
    let eventName = 'message';
    const dataLines: string[] = [];

    for (const rawLine of frame.split('\n')) {
      const line = rawLine.replace(/\r$/, '');
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (dataLines.length === 0) return;

    if (eventName === 'nats') {
      try {
        const parsed = JSON.parse(dataLines.join('\n')) as NatsClientMessage;
        this.dispatchMessage(parsed);
      } catch {
        // Ignore malformed SSE data chunks
      }
      return;
    }

    if (eventName === 'nats_queue') {
      try {
        const parsed = JSON.parse(dataLines.join('\n')) as NatsQueueItem;
        this.dispatchQueueItem(parsed);
      } catch {
        // Ignore malformed SSE queue chunks
      }
    }
  }
}

export function applyLiveQueueItem(
  prev: NatsQueueSnapshot | null,
  item: NatsQueueItem
): NatsQueueSnapshot | null {
  if (!prev) return prev;
  const existingIdx = prev.messages.findIndex((m) => m.id === item.id);
  const nextMessages =
    existingIdx >= 0
      ? prev.messages.map((m, idx) => (idx === existingIdx ? item : m))
      : [item, ...prev.messages].slice(0, 50);

  const isBrandNew = existingIdx < 0;
  const queuedCount = nextMessages.filter((m) => m.status === 'queued').length;
  const processingCount = nextMessages.filter((m) => m.status === 'processing').length;
  const ackedCount = nextMessages.filter((m) => m.status === 'acked').length;
  const failedCount = nextMessages.filter((m) => m.status === 'failed').length;
  const measured = nextMessages.filter((m) => m.processingMs > 0);
  const avgProcessingMs = measured.length
    ? Math.round(measured.reduce((acc, m) => acc + m.processingMs, 0) / measured.length)
    : prev.stats.avgProcessingMs;

  const updatedConsumers = prev.consumers.map((consumer) => {
    const matches =
      consumer.id === 'pg-event-store' ||
      consumer.id === 'sse-live-fanout' ||
      (consumer.id === 'nocobase-workflow-worker' &&
        (item.stream === 'NOCOBASE_WORKFLOWS' || item.subject.startsWith('crm.'))) ||
      (consumer.id === 'deepseek-harness-worker' &&
        (item.stream === 'HARNESS_AI' || item.subject.includes('.deal.'))) ||
      (consumer.id === 'platform-ops-worker' &&
        (item.stream === 'MARKETPLACE' ||
          item.stream === 'OFFICE_S3' ||
          item.stream === 'PLATFORM_IAM' ||
          item.stream === 'SOCIAL_FEED'));

    if (!matches) return consumer;

    const isPending = item.status === 'queued' || item.status === 'processing';
    return {
      ...consumer,
      status: isPending ? ('processing' as const) : ('active' as const),
      deliveredCount:
        item.status === 'acked' && isBrandNew
          ? consumer.deliveredCount + 1
          : item.status === 'acked' && existingIdx >= 0 && prev.messages[existingIdx].status !== 'acked'
          ? consumer.deliveredCount + 1
          : consumer.deliveredCount,
      failedCount:
        item.status === 'failed' &&
        (isBrandNew || prev.messages[existingIdx]?.status !== 'failed')
          ? consumer.failedCount + 1
          : consumer.failedCount,
      pendingCount: isPending ? Math.max(1, consumer.pendingCount) : 0,
      avgLatencyMs: item.processingMs > 0 ? item.processingMs : consumer.avgLatencyMs,
      lastSubject: item.subject,
      lastActivityAt: item.updatedAt,
    };
  });

  return {
    ...prev,
    collectedAt: item.updatedAt,
    stats: {
      totalPersisted: isBrandNew ? prev.stats.totalPersisted + 1 : prev.stats.totalPersisted,
      bufferSize: nextMessages.length,
      queuedCount,
      processingCount,
      ackedCount,
      failedCount,
      avgProcessingMs,
      sseSubscribers: Math.max(prev.stats.sseSubscribers, item.sseSubscribers),
    },
    consumers: updatedConsumers,
    messages: nextMessages,
  };
}

export const natsClient = new NatsRealtimeClient();
