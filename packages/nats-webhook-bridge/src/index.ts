import { z } from 'zod';
import {
  DomainInvariantError,
  ValueObject,
  type NexusModuleDescriptor,
} from '@nexus-core/ddd-kernel';

export const NatsWebhookConfigSchema = z.object({
  streamName: z.string().trim().min(2, 'Укажите streamName NATS JetStream').default('NEXUS_CRM_EVENTS'),
  subjectPrefix: z.string().trim().min(2, 'Укажите префикс subject').default('crm.acme'),
  retryCount: z.coerce.number().int().min(0).max(10).default(3),
  webhookUrl: z.string().url().optional(),
  endpointUrl: z.string().url().optional(),
});

export type NatsWebhookConfig = z.infer<typeof NatsWebhookConfigSchema>;

export class WebhookRetryPolicy extends ValueObject<{ maxRetries: number; baseDelayMs: number }> {
  private constructor(maxRetries: number, baseDelayMs: number) {
    super({ maxRetries, baseDelayMs });
  }

  static create(maxRetries: number, baseDelayMs = 250): WebhookRetryPolicy {
    if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 10) {
      throw new DomainInvariantError(
        'Количество повторов webhook должно быть целым от 0 до 10',
        'INVALID_RETRY_POLICY',
        'integration'
      );
    }
    return new WebhookRetryPolicy(maxRetries, Math.max(50, baseDelayMs));
  }

  backoffMs(attempt: number): number {
    const exp = Math.max(0, Math.min(attempt - 1, this.props.maxRetries));
    return this.props.baseDelayMs * Math.pow(2, exp);
  }
}

export function matchWildcardSubject(pattern: string, subject: string): boolean {
  if (pattern === '>') return true;
  const p = pattern.split('.');
  const s = subject.split('.');
  for (let i = 0; i < p.length; i += 1) {
    if (p[i] === '>') return true;
    if (i >= s.length) return false;
    if (p[i] !== '*' && p[i] !== s[i]) return false;
  }
  return p.length === s.length;
}

export function buildWebhookDeliveryPlan(
  subject: string,
  payload: Record<string, unknown>,
  config: NatsWebhookConfig
) {
  const policy = WebhookRetryPolicy.create(config.retryCount);
  const filterPattern = `${config.subjectPrefix}.>`;
  const matches = matchWildcardSubject(filterPattern, subject);
  return {
    streamName: config.streamName,
    filterPattern,
    subject,
    matched: matches,
    retryDelaysMs: Array.from({ length: config.retryCount }, (_, idx) => policy.backoffMs(idx + 1)),
    envelope: {
      specVersion: '1.0',
      source: `nats://${config.streamName}`,
      subject,
      data: payload,
    },
  };
}

export const natsWebhookBridgeModule: NexusModuleDescriptor<NatsWebhookConfig> = {
  packageName: '@nexus-plugins/nats-webhook-bridge',
  version: '2.1.0',
  title: 'NATS JetStream Webhook Bridge',
  category: 'CRM Automation',
  slot: 'crm_toolbar',
  boundedContext: 'integration',
  contextMapping: 'Published Language',
  aggregates: ['WebhookSubscription'],
  valueObjects: ['WebhookRetryPolicy'],
  publishedEvents: ['integration.<tenant>.webhook.dispatched'],
  subscribedSubjects: ['crm.*.deal.*', 'crm.*.email.sent'],
  permissionsRequired: ['deals:write'],
  configSchema: NatsWebhookConfigSchema,
  defaultConfig: {
    streamName: 'NEXUS_CRM_EVENTS',
    subjectPrefix: 'crm.acme',
    retryCount: 3,
  },
  runDomainPreview: (config, input) =>
    buildWebhookDeliveryPlan(
      String(input?.subject || `${config.subjectPrefix}.deal.moved`),
      (input?.payload as Record<string, unknown>) || { dealId: 'dl_demo', stage: 'Переговоры' },
      config
    ),
};
