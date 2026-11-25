import { z } from 'zod';
import {
  AggregateRoot,
  DomainInvariantError,
  type NexusModuleDescriptor,
} from '@nexus-core/ddd-kernel';

export const VkSocialPollsConfigSchema = z.object({
  allowAnonymousVotes: z.boolean().default(false),
  maxOptions: z.coerce.number().int().min(2, 'Минимум 2 варианта ответа').max(12).default(6),
});

export type VkSocialPollsConfig = z.infer<typeof VkSocialPollsConfigSchema>;

export interface SocialPollProps {
  tenantId: string;
  question: string;
  options: string[];
  votes: Record<string, number>;
  maxOptions: number;
}

export class SocialPollAggregate extends AggregateRoot<SocialPollProps> {
  private constructor(id: string, props: SocialPollProps) {
    super(id, props);
  }

  static create(params: {
    id: string;
    tenantId: string;
    question: string;
    options: string[];
    votes?: Record<string, number>;
    maxOptions?: number;
  }): SocialPollAggregate {
    const maxOptions = params.maxOptions ?? 6;
    const cleanOptions = params.options.map((o) => o.trim()).filter(Boolean);
    if (!params.question.trim()) {
      throw new DomainInvariantError('Вопрос опроса обязателен', 'EMPTY_POLL_QUESTION', 'social');
    }
    if (cleanOptions.length < 2) {
      throw new DomainInvariantError('Опрос должен содержать минимум 2 варианта', 'TOO_FEW_POLL_OPTIONS', 'social');
    }
    if (cleanOptions.length > maxOptions) {
      throw new DomainInvariantError(
        `Превышено максимальное число вариантов (${maxOptions})`,
        'TOO_MANY_POLL_OPTIONS',
        'social'
      );
    }

    const agg = new SocialPollAggregate(params.id, {
      tenantId: params.tenantId,
      question: params.question.trim(),
      options: cleanOptions,
      votes: { ...(params.votes || {}) },
      maxOptions,
    });
    return agg;
  }

  castVote(actorId: string, optionIndex: number, subdomain = 'acme') {
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= this.props.options.length) {
      throw new DomainInvariantError('Недопустимый индекс варианта опроса', 'INVALID_POLL_OPTION', 'social');
    }
    this.props.votes = {
      ...this.props.votes,
      [actorId]: optionIndex,
    };
    this.addDomainEvent({
      eventName: 'PollVoted',
      subject: `social.${subdomain}.poll.voted`,
      aggregateType: 'SocialPollAggregate',
      boundedContext: 'social',
      tenantId: this.props.tenantId,
      actorId,
      payload: {
        pollId: this.id,
        optionIndex,
        optionLabel: this.props.options[optionIndex],
      },
    });
  }

  tally() {
    const entries = Object.values(this.props.votes);
    const totalVotes = entries.length;
    return {
      question: this.props.question,
      totalVotes,
      options: this.props.options.map((label, index) => {
        const count = entries.filter((v) => v === index).length;
        return {
          index,
          label,
          count,
          percent: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
        };
      }),
    };
  }
}

export const vkSocialPollsModule: NexusModuleDescriptor<VkSocialPollsConfig> = {
  packageName: '@nexus-plugins/vk-social-polls',
  version: '1.1.5',
  title: 'Социальные опросы для стены',
  category: 'Social Widgets',
  slot: 'social_composer',
  boundedContext: 'social',
  contextMapping: 'Customer-Supplier',
  aggregates: ['SocialPollAggregate'],
  valueObjects: ['PollOptionSet'],
  publishedEvents: ['social.<tenant>.poll.voted'],
  subscribedSubjects: ['social.*.post.created'],
  permissionsRequired: ['social:post'],
  configSchema: VkSocialPollsConfigSchema,
  defaultConfig: {
    allowAnonymousVotes: false,
    maxOptions: 6,
  },
  runDomainPreview: (config, input) => {
    const poll = SocialPollAggregate.create({
      id: 'poll_preview',
      tenantId: String(input?.tenantId || 'tnt_acme'),
      question: String(input?.question || 'Какой модуль развиваем следующим?'),
      options: ['BI-витрины Directus', 'Голосовой AI-ассистент', 'SLA-мониторинг'],
      maxOptions: config.maxOptions,
    });
    poll.castVote('usr_preview_1', 0);
    poll.castVote('usr_preview_2', 0);
    poll.castVote('usr_preview_3', 2);
    return poll.tally();
  },
};
