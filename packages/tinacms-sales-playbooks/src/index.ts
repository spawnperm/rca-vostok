import { z } from 'zod';
import { Money, type NexusModuleDescriptor } from '@nexus-core/ddd-kernel';

export const TinaPlaybooksConfigSchema = z.object({
  playbookCollection: z.string().trim().min(1, 'Укажите коллекцию TinaCMS').default('sales_playbooks'),
});

export type TinaPlaybooksConfig = z.infer<typeof TinaPlaybooksConfigSchema>;

export interface PlaybookMatchInput {
  stageName: string;
  budget: number;
  isEnterprise?: boolean;
}

export function matchSalesPlaybook(input: PlaybookMatchInput, config: TinaPlaybooksConfig) {
  const money = Money.create(input.budget, 'RUB');
  const stageLower = input.stageName.toLowerCase();
  let playbookSlug = 'discovery-qualification';
  let checklist = ['Проверить BANT/MEDDIC критерии', 'Зафиксировать дату следующего контакта'];

  if (stageLower.includes('переговор') || stageLower.includes('кп') || money.amount >= 1_000_000) {
    playbookSlug = 'enterprise-closing-sla';
    checklist = [
      'Согласовать юридическую редакцию договора и SLA 99.9%',
      'Подготовить расчёт экономического эффекта для ЛПР',
      'Запустить согласование в NocoBase Approvals',
    ];
  } else if (stageLower.includes('успешно')) {
    playbookSlug = 'customer-onboarding-handover';
    checklist = ['Передать карточку в Customer Success', 'Создать репозиторий внедрения в Forgejo'];
  }

  return {
    collection: config.playbookCollection,
    playbookSlug,
    budgetTier: money.amount >= 1_000_000 ? 'Enterprise' : 'Mid-Market',
    checklist,
  };
}

export const tinacmsSalesPlaybooksModule: NexusModuleDescriptor<TinaPlaybooksConfig> = {
  packageName: '@nexus-plugins/tinacms-sales-playbooks',
  version: '1.3.0',
  title: 'TinaCMS Sales Playbooks',
  category: 'CRM Automation',
  slot: 'crm_deal_sidebar',
  boundedContext: 'cms',
  contextMapping: 'Customer-Supplier',
  aggregates: ['SalesPlaybookBlock'],
  valueObjects: ['Money'],
  publishedEvents: ['cms.<tenant>.playbook.matched'],
  subscribedSubjects: ['crm.*.deal.moved'],
  permissionsRequired: ['deals:read', 'cms:edit'],
  configSchema: TinaPlaybooksConfigSchema,
  defaultConfig: {
    playbookCollection: 'sales_playbooks',
  },
  runDomainPreview: (config, input) =>
    matchSalesPlaybook(
      {
        stageName: String(input?.stageName || 'Переговоры'),
        budget: Number(input?.budget ?? 1500000),
      },
      config
    ),
};
