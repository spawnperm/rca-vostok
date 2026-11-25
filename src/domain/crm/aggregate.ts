import {
  AggregateRoot,
  DomainInvariantError,
  Money,
  type CurrencyCode,
} from '../shared/ddd.ts';

export interface DealAggregateProps {
  tenantId: string;
  subdomain: string;
  pipelineId: string;
  stageId: string;
  title: string;
  budget: Money;
  contactId: string | null;
  companyId: string | null;
  ownerId: string;
  lossReason: string | null;
  tags: string[];
  customFields: Record<string, string>;
}

export interface StageDescriptor {
  id: string;
  pipelineId: string;
  name: string;
  isWon: boolean;
  isLost: boolean;
}

export class DealAggregate extends AggregateRoot<DealAggregateProps> {
  private constructor(id: string, props: DealAggregateProps) {
    super(id, props);
  }

  static createNew(params: {
    id: string;
    tenantId: string;
    subdomain: string;
    pipelineId: string;
    stage: StageDescriptor;
    title: string;
    budget: number;
    currency: CurrencyCode;
    contactId?: string | null;
    companyId?: string | null;
    ownerId: string;
    tags?: string[];
    customFields?: Record<string, string>;
  }): DealAggregate {
    const trimmedTitle = params.title.trim();
    if (trimmedTitle.length < 2) {
      throw new DomainInvariantError(
        'Название сделки должно содержать минимум 2 символа',
        'INVALID_DEAL_TITLE',
        'crm'
      );
    }
    if (params.stage.pipelineId !== params.pipelineId) {
      throw new DomainInvariantError(
        'Указанный этап не принадлежит выбранной воронке продаж',
        'STAGE_PIPELINE_MISMATCH',
        'crm'
      );
    }

    const money = Money.create(params.budget, params.currency);
    const deal = new DealAggregate(params.id, {
      tenantId: params.tenantId,
      subdomain: params.subdomain,
      pipelineId: params.pipelineId,
      stageId: params.stage.id,
      title: trimmedTitle,
      budget: money,
      contactId: params.contactId ?? null,
      companyId: params.companyId ?? null,
      ownerId: params.ownerId,
      lossReason: null,
      tags: params.tags ? [...params.tags] : [],
      customFields: params.customFields ? { ...params.customFields } : {},
    });

    deal.addDomainEvent({
      eventName: 'DealCreated',
      subject: `crm.${params.subdomain}.deal.created`,
      aggregateType: 'DealAggregate',
      boundedContext: 'crm',
      tenantId: params.tenantId,
      actorId: params.ownerId,
      payload: {
        dealId: deal.id,
        title: deal.props.title,
        budget: money.amount,
        currency: money.currency,
        stageId: params.stage.id,
      },
    });

    return deal;
  }

  static rehydrate(params: {
    id: string;
    tenantId: string;
    subdomain: string;
    pipelineId: string;
    stageId: string;
    title: string;
    budget: number;
    currency: CurrencyCode;
    contactId: string | null;
    companyId: string | null;
    ownerId: string;
    lossReason: string | null;
    tags: string[];
    customFields: Record<string, string>;
  }): DealAggregate {
    return new DealAggregate(params.id, {
      tenantId: params.tenantId,
      subdomain: params.subdomain,
      pipelineId: params.pipelineId,
      stageId: params.stageId,
      title: params.title,
      budget: Money.create(params.budget, params.currency),
      contactId: params.contactId,
      companyId: params.companyId,
      ownerId: params.ownerId,
      lossReason: params.lossReason,
      tags: [...params.tags],
      customFields: { ...params.customFields },
    });
  }

  moveToStage(targetStage: StageDescriptor, actorId: string, lossReason?: string) {
    if (targetStage.pipelineId !== this.props.pipelineId) {
      throw new DomainInvariantError(
        'Нельзя перевести сделку на этап из другой воронки',
        'CROSS_PIPELINE_MOVE',
        'crm'
      );
    }

    const previousStageId = this.props.stageId;
    this.props.stageId = targetStage.id;

    if (targetStage.isLost) {
      this.props.lossReason = (lossReason && lossReason.trim()) || this.props.lossReason || 'Причина не указана';
    } else if (targetStage.isWon) {
      this.props.lossReason = null;
    } else if (lossReason !== undefined) {
      this.props.lossReason = lossReason.trim() || null;
    }

    this.addDomainEvent({
      eventName: 'DealMovedToStage',
      subject: `crm.${this.props.subdomain}.deal.moved`,
      aggregateType: 'DealAggregate',
      boundedContext: 'crm',
      tenantId: this.props.tenantId,
      actorId,
      payload: {
        dealId: this.id,
        title: this.props.title,
        fromStageId: previousStageId,
        stageId: targetStage.id,
        stageName: targetStage.name,
        isWon: targetStage.isWon,
        isLost: targetStage.isLost,
      },
    });
  }

  get state() {
    return {
      id: this.id,
      tenantId: this.props.tenantId,
      pipelineId: this.props.pipelineId,
      stageId: this.props.stageId,
      title: this.props.title,
      budget: this.props.budget.amount,
      currency: this.props.budget.currency,
      contactId: this.props.contactId,
      companyId: this.props.companyId,
      ownerId: this.props.ownerId,
      lossReason: this.props.lossReason,
      tags: [...this.props.tags],
      customFields: { ...this.props.customFields },
    };
  }
}
