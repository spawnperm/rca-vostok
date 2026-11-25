import { z } from 'zod';
import {
  DomainInvariantError,
  Money,
  ValueObject,
  type CurrencyCode,
  type NexusModuleDescriptor,
} from '@nexus-core/ddd-kernel';

export const DifyCopilotConfigSchema = z.object({
  autoScoreOnStageChange: z.boolean().default(true),
  difyAppMode: z.enum(['agent-chat', 'workflow', 'completion']).default('agent-chat'),
  model: z.string().trim().min(1, 'Укажите модель Dify / DeepSeek-Harness').default('deepseek-harness-v3'),
  difyApiUrl: z.string().url().optional(),
  endpointUrl: z.string().url().optional(),
});

export type DifyCopilotConfig = z.infer<typeof DifyCopilotConfigSchema>;

export class WinProbability extends ValueObject<{ percent: number }> {
  private constructor(percent: number) {
    super({ percent });
  }

  static create(raw: number): WinProbability {
    if (!Number.isFinite(raw)) {
      throw new DomainInvariantError('Вероятность закрытия должна быть числом', 'INVALID_WIN_PROBABILITY', 'crm');
    }
    const clamped = Math.max(5, Math.min(99, Math.round(raw)));
    return new WinProbability(clamped);
  }

  get percent(): number {
    return this.props.percent;
  }

  get riskTier(): 'Низкий' | 'Средний' | 'Высокий' {
    if (this.props.percent >= 68) return 'Низкий';
    if (this.props.percent >= 42) return 'Средний';
    return 'Высокий';
  }
}

export interface DealCopilotInput {
  dealTitle: string;
  budget: number;
  currency?: CurrencyCode;
  stageSortOrder: number;
  totalStages: number;
  historySignalsCount: number;
  isWon?: boolean;
  isLost?: boolean;
}

export function evaluateDealCopilot(input: DealCopilotInput, config: DifyCopilotConfig) {
  const money = Money.create(input.budget, input.currency || 'RUB');
  if (input.isWon) {
    return {
      model: config.model,
      mode: config.difyAppMode,
      budgetFormatted: money.formatRu(),
      winProbability: 99,
      riskLevel: 'Низкий' as const,
      recommendedAction: 'Передать контракт в сопровождение и зафиксировать акт',
    };
  }
  if (input.isLost) {
    return {
      model: config.model,
      mode: config.difyAppMode,
      budgetFormatted: money.formatRu(),
      winProbability: 5,
      riskLevel: 'Высокий' as const,
      recommendedAction: 'Запланировать реактивацию через 60 дней',
    };
  }

  const stageRatio = Math.max(1, input.stageSortOrder) / Math.max(1, input.totalStages);
  const historyBoost = Math.min(22, input.historySignalsCount * 4);
  const budgetBonus = money.amount >= 1_000_000 ? 6 : 2;
  const prob = WinProbability.create(20 + stageRatio * 55 + historyBoost + budgetBonus);

  return {
    model: config.model,
    mode: config.difyAppMode,
    budgetFormatted: money.formatRu(),
    winProbability: prob.percent,
    riskLevel: prob.riskTier,
    recommendedAction:
      prob.riskTier === 'Высокий'
        ? 'Назначить звонок квалификации и зафиксировать ЛПР'
        : 'Отправить КП с расчётом ROI и согласовать встречу',
  };
}

export const difyDealCopilotModule: NexusModuleDescriptor<DifyCopilotConfig> = {
  packageName: '@nexus-plugins/dify-deal-copilot',
  version: '1.4.2',
  title: 'Dify Deal Copilot',
  category: 'AI & Harness',
  slot: 'crm_deal_sidebar',
  boundedContext: 'crm',
  contextMapping: 'Customer-Supplier',
  aggregates: ['DealScoringAssessment'],
  valueObjects: ['WinProbability', 'Money'],
  publishedEvents: ['crm.<tenant>.deal.scored'],
  subscribedSubjects: ['crm.*.deal.created', 'crm.*.deal.moved', 'crm.*.timeline.message'],
  permissionsRequired: ['deals:read', 'harness:execute'],
  configSchema: DifyCopilotConfigSchema,
  defaultConfig: {
    autoScoreOnStageChange: true,
    difyAppMode: 'agent-chat',
    model: 'deepseek-harness-v3',
  },
  runDomainPreview: (config, input) =>
    evaluateDealCopilot(
      {
        dealTitle: String(input?.dealTitle || 'Enterprise CRM Pilot'),
        budget: Number(input?.budget ?? 1250000),
        stageSortOrder: Number(input?.stageSortOrder ?? 3),
        totalStages: Number(input?.totalStages ?? 5),
        historySignalsCount: Number(input?.historySignalsCount ?? 4),
      },
      config
    ),
};
