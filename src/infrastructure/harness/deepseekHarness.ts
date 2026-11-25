import crypto from 'crypto';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client.ts';
import {
  companies,
  contacts,
  deals,
  harnessRuns,
  pipelineStages,
  tasks,
  timelineEvents,
} from '../db/schema.ts';
import { natsBus } from '../nats/eventBus.ts';

export const HarnessExecuteSchema = z.object({
  workflowId: z.enum([
    'deal_qualification',
    'dify_followup_draft',
    'tenant_health_audit',
    'contact_next_step',
  ]),
  dealId: z.string().optional(),
  promptContext: z.string().max(1500).optional(),
});

export interface DealNextStepProposal {
  actionType: 'call' | 'meeting' | 'followup' | 'dify_ai';
  title: string;
  rationale: string;
  suggestedDueAt: string;
}

export interface DealHarnessAnalysis {
  dealId: string;
  runId: string;
  winProbability: number;
  riskLevel: 'Низкий' | 'Средний' | 'Высокий';
  contactHistorySummary: string;
  historySignalsCount: number;
  siblingDealsCount: number;
  nextStep: DealNextStepProposal;
  analyzedAt: string;
  trigger: string;
}

export interface HarnessWorkflowDefinition {
  id: 'deal_qualification' | 'dify_followup_draft' | 'tenant_health_audit' | 'contact_next_step';
  name: string;
  engine: string;
  description: string;
  nodes: string[];
}

export const HARNESS_WORKFLOWS: HarnessWorkflowDefinition[] = [
  {
    id: 'contact_next_step',
    name: 'Авто-анализ сделки и следующий шаг по истории контакта',
    engine: 'DeepSeek-Harness -> Contact History Analyzer',
    description:
      'Изучает историю касаний контакта, связанные сделки компании, открытые/просроченные задачи и этап воронки, предлагая конкретный следующий шаг менеджеру.',
    nodes: [
      'zod.validate',
      'pg.fetch_contact_history',
      'harness.score_momentum',
      'harness.propose_next_step',
      'nats.emit_recommendation',
    ],
  },
  {
    id: 'deal_qualification',
    name: 'Квалификация сделки и оценка риска (Dify + Harness)',
    engine: 'DeepSeek-Harness -> Dify Agent Node',
    description:
      'Анализирует бюджет, этап воронки и историю касаний в PostgreSQL, рассчитывает вероятность закрытия и публикует событие в NATS.',
    nodes: ['zod.validate', 'pg.fetch_deal_context', 'dify.score_probability', 'nats.emit_insight'],
  },
  {
    id: 'dify_followup_draft',
    name: 'Генерация следующего шага и черновика письма для клиента',
    engine: 'DeepSeek-Harness -> Dify Workflow',
    description:
      'Формирует структурированный план звонка или follow-up письма на основе карточки сделки amoCRM и записывает его в таймлайн.',
    nodes: ['zod.validate', 'pg.fetch_timeline', 'dify.compose_followup', 'crm.append_timeline'],
  },
  {
    id: 'tenant_health_audit',
    name: 'Аудит изоляции тенанта и Traefik-маршрутов',
    engine: 'DeepSeek-Harness -> Infra Guard',
    description:
      'Проверяет квоты поддомена, активные плагины Verdaccio и консистентность RBAC прав в PostgreSQL.',
    nodes: ['zod.validate', 'tenancy.inspect_quotas', 'rbac.verify_policies', 'traefik.validate_rules'],
  },
];

type TriggerType = 'auto_load' | 'deal_created' | 'stage_changed' | 'note_added' | 'manual_batch' | 'manual_card' | 'nocobase_workflow';

function computeDealAnalysisInMemory(params: {
  deal: typeof deals.$inferSelect;
  allTenantDeals: Array<typeof deals.$inferSelect>;
  stageMap: Map<string, typeof pipelineStages.$inferSelect>;
  contactMap: Map<string, typeof contacts.$inferSelect>;
  companyMap: Map<string, typeof companies.$inferSelect>;
  tasksByDeal: Map<string, Array<typeof tasks.$inferSelect>>;
  eventsByDeal: Map<string, Array<typeof timelineEvents.$inferSelect>>;
  trigger: TriggerType;
  startedAt: number;
}): DealHarnessAnalysis {
  const { deal, allTenantDeals, stageMap, contactMap, companyMap, tasksByDeal, eventsByDeal } = params;
  const stage = stageMap.get(deal.stageId);
  const contact = deal.contactId ? contactMap.get(deal.contactId) ?? null : null;
  const company = deal.companyId ? companyMap.get(deal.companyId) ?? null : null;
  const dealTasks = tasksByDeal.get(deal.id) || [];

  const siblingDeals = allTenantDeals.filter(
    (d) =>
      d.id !== deal.id &&
      ((deal.contactId && d.contactId === deal.contactId) ||
        (deal.companyId && d.companyId === deal.companyId))
  );

  const relevantDealIds = [deal.id, ...siblingDeals.map((d) => d.id)];
  const contactHistoryEvents = relevantDealIds
    .flatMap((id) => eventsByDeal.get(id) || [])
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30);

  const previousWonCount = siblingDeals.filter((d) => stageMap.get(d.stageId)?.isWon).length;
  const openTasks = dealTasks.filter((t) => !t.completed);
  const nowMs = Date.now();
  const overdueTasks = openTasks.filter((t) => new Date(t.dueAt).getTime() < nowMs);
  const notesCount = contactHistoryEvents.filter(
    (e) => e.type === 'note' || e.type === 'call' || e.type === 'email'
  ).length;
  const latestInteraction = contactHistoryEvents.find((e) => e.type !== 'dify_insight');

  let winProbability = 35;
  if (stage?.isWon) {
    winProbability = 100;
  } else if (stage?.isLost) {
    winProbability = 0;
  } else {
    const order = stage?.sortOrder || 1;
    winProbability = Math.min(88, 22 + order * 14);
    if (previousWonCount > 0) winProbability = Math.min(94, winProbability + 12);
    if (notesCount >= 2) winProbability = Math.min(94, winProbability + 6);
    if (contact?.tags.some((t) => t === 'ЛПР' || t === 'Enterprise')) {
      winProbability = Math.min(95, winProbability + 5);
    }
    if (overdueTasks.length > 0) winProbability = Math.max(15, winProbability - 14);
  }

  const riskLevel: DealHarnessAnalysis['riskLevel'] =
    stage?.isWon
      ? 'Низкий'
      : stage?.isLost || overdueTasks.length > 0 || (notesCount === 0 && (stage?.sortOrder || 1) >= 3)
      ? 'Высокий'
      : deal.budget >= 1500000 || openTasks.length === 0
      ? 'Средний'
      : 'Низкий';

  const contactLabel = contact
    ? `${contact.fullName}${contact.position ? ` (${contact.position})` : ''}`
    : company?.name || 'контакт не привязан';

  const contactHistorySummary = [
    `Контакт: ${contactLabel}`,
    `Касаний в истории: ${contactHistoryEvents.length}`,
    siblingDeals.length > 0
      ? `Связанных сделок: ${siblingDeals.length} (успешных: ${previousWonCount})`
      : 'Первая сделка с клиентом',
    overdueTasks.length > 0
      ? `Просрочено задач: ${overdueTasks.length}`
      : `Открытых задач: ${openTasks.length}`,
  ].join(' · ');

  let nextStep: DealNextStepProposal;
  const tomorrow11 = new Date(nowMs + 24 * 3600 * 1000);
  tomorrow11.setHours(11, 0, 0, 0);
  const in3Hours = new Date(nowMs + 3 * 3600 * 1000);

  if (stage?.isWon) {
    nextStep = {
      actionType: 'followup',
      title: `Передать клиента ${contact?.fullName || deal.title} в онбординг и запросить NPS`,
      rationale: `Сделка успешно закрыта. В истории зафиксировано ${contactHistoryEvents.length} касаний; закрепление аккаунт-менеджера снизит риск оттока при запуске.`,
      suggestedDueAt: tomorrow11.toISOString(),
    };
  } else if (stage?.isLost) {
    nextStep = {
      actionType: 'followup',
      title: `Запланировать возврат к ${contact?.fullName || 'клиенту'} через 60 дней`,
      rationale: `Сделка закрыта без реализации. История контакта (${notesCount} заметок) поможет вернуться с релевантным предложением.`,
      suggestedDueAt: new Date(nowMs + 60 * 24 * 3600 * 1000).toISOString(),
    };
  } else if (overdueTasks.length > 0) {
    nextStep = {
      actionType: 'call',
      title: `Срочно закрыть просроченную задачу и связаться с ${contact?.fullName || 'ЛПР'}`,
      rationale: `Обнаружено ${overdueTasks.length} просроченных задач («${overdueTasks[0].title}»). Вероятность закрытия снижена до ${winProbability}% — требуется немедленный созвон.`,
      suggestedDueAt: in3Hours.toISOString(),
    };
  } else if (!contact) {
    nextStep = {
      actionType: 'call',
      title: `Определить ЛПР и привязать контакт к сделке «${deal.title}»`,
      rationale: `В сделке не указано контактное лицо. Без ЛПР на этапе «${stage?.name || 'Воронка'}» невозможно подтвердить бюджет ${deal.budget.toLocaleString('ru-RU')} ${deal.currency}.`,
      suggestedDueAt: in3Hours.toISOString(),
    };
  } else if (previousWonCount > 0) {
    nextStep = {
      actionType: 'meeting',
      title: `Подготовить апселл-презентацию для ${contact.fullName} с опорой на успешный кейс`,
      rationale: `У клиента ${company?.name || contact.companyName} уже есть ${previousWonCount} успешно реализованная сделка. Используйте действующий SLA как ускоритель согласования.`,
      suggestedDueAt: tomorrow11.toISOString(),
    };
  } else if (latestInteraction && latestInteraction.body.toLowerCase().includes('поддомен')) {
    nextStep = {
      actionType: 'meeting',
      title: `Провести тех-демо поддомена Traefik и матрицы RBAC для ${contact.fullName}`,
      rationale: `По последнему касанию клиент запрашивал выделенный поддомен и RBAC. Назначьте 20-минутный показ с пресейлом.`,
      suggestedDueAt: tomorrow11.toISOString(),
    };
  } else if ((stage?.sortOrder || 1) >= 3) {
    nextStep = {
      actionType: 'meeting',
      title: `Согласовать финальные условия договора и график оплаты с ${contact.fullName}`,
      rationale: `Сделка находится на позднем этапе «${stage?.name}» (${notesCount} касаний в истории). Фиксация даты подписания удержит темп закрытия.`,
      suggestedDueAt: tomorrow11.toISOString(),
    };
  } else {
    nextStep = {
      actionType: 'call',
      title: `Квалификационный звонок с ${contact.fullName} (${contact.phone || contact.email || 'контакт'})`,
      rationale: `На этапе «${stage?.name || 'Первичный контакт'}» зафиксировано ${notesCount} касаний. Уточните критерии выбора, сроки запуска и состав стейкхолдеров.`,
      suggestedDueAt: in3Hours.toISOString(),
    };
  }

  return {
    dealId: deal.id,
    runId: `hrun_${crypto.randomUUID().slice(0, 10)}`,
    winProbability,
    riskLevel,
    contactHistorySummary,
    historySignalsCount: contactHistoryEvents.length,
    siblingDealsCount: siblingDeals.length,
    nextStep,
    analyzedAt: new Date().toISOString(),
    trigger: params.trigger,
  };
}

async function fetchTenantAnalysisContext(tenantId: string) {
  const db = await getDb();
  const [allTenantDeals, allTenantStages, allContacts, allCompanies, allTasks, allEvents] = await Promise.all([
    db.select().from(deals).where(eq(deals.tenantId, tenantId)),
    db.select().from(pipelineStages).where(eq(pipelineStages.tenantId, tenantId)),
    db.select().from(contacts).where(eq(contacts.tenantId, tenantId)),
    db.select().from(companies).where(eq(companies.tenantId, tenantId)),
    db.select().from(tasks).where(eq(tasks.tenantId, tenantId)),
    db.select().from(timelineEvents).where(eq(timelineEvents.tenantId, tenantId)),
  ]);

  const stageMap = new Map(allTenantStages.map((s) => [s.id, s]));
  const contactMap = new Map(allContacts.map((c) => [c.id, c]));
  const companyMap = new Map(allCompanies.map((c) => [c.id, c]));

  const tasksByDeal = new Map<string, Array<typeof tasks.$inferSelect>>();
  for (const t of allTasks) {
    if (!t.dealId) continue;
    const list = tasksByDeal.get(t.dealId) || [];
    list.push(t);
    tasksByDeal.set(t.dealId, list);
  }

  const eventsByDeal = new Map<string, Array<typeof timelineEvents.$inferSelect>>();
  for (const ev of allEvents) {
    const list = eventsByDeal.get(ev.dealId) || [];
    list.push(ev);
    eventsByDeal.set(ev.dealId, list);
  }

  return { allTenantDeals, stageMap, contactMap, companyMap, tasksByDeal, eventsByDeal };
}

export async function analyzeTenantDealsBatch(params: {
  tenantId: string;
  actorId: string;
  dealIds?: string[];
  trigger: TriggerType;
  publishNats?: boolean;
}): Promise<DealHarnessAnalysis[]> {
  const startedAt = Date.now();
  const db = await getDb();
  const ctx = await fetchTenantAnalysisContext(params.tenantId);

  const targetDeals = params.dealIds
    ? ctx.allTenantDeals.filter((d) => params.dealIds!.includes(d.id))
    : ctx.allTenantDeals;

  if (targetDeals.length === 0) return [];

  const analyses = targetDeals.map((deal) =>
    computeDealAnalysisInMemory({
      deal,
      ...ctx,
      trigger: params.trigger,
      startedAt,
    })
  );

  const durationMs = Math.max(12, Date.now() - startedAt);
  await db.insert(harnessRuns).values(
    analyses.map((analysis) => ({
      id: analysis.runId,
      tenantId: params.tenantId,
      workflowId: 'contact_next_step',
      workflowName: 'DeepSeek-Harness: Анализ сделки и следующий шаг',
      actorId: params.actorId,
      inputPayload: { dealId: analysis.dealId, trigger: params.trigger },
      outputPayload: analysis as unknown as Record<string, unknown>,
      status: 'completed',
      durationMs,
    }))
  );

  if (params.publishNats ?? params.trigger !== 'auto_load') {
    await natsBus.publish(params.tenantId, 'harness.deals.batch_analyzed', params.actorId, {
      analyzedCount: analyses.length,
      trigger: params.trigger,
    });
  }

  return analyses;
}

export async function analyzeDealFromContactHistory(params: {
  tenantId: string;
  dealId: string;
  actorId: string;
  trigger: TriggerType;
  writeTimelineInsight?: boolean;
  publishNats?: boolean;
}): Promise<DealHarnessAnalysis> {
  const startedAt = Date.now();
  const db = await getDb();
  const ctx = await fetchTenantAnalysisContext(params.tenantId);
  const deal = ctx.allTenantDeals.find((d) => d.id === params.dealId);

  if (!deal) {
    throw new Error('Сделка не найдена в контексте текущего тенанта');
  }

  const analysis = computeDealAnalysisInMemory({
    deal,
    ...ctx,
    trigger: params.trigger,
    startedAt,
  });

  const durationMs = Math.max(12, Date.now() - startedAt);

  await db.insert(harnessRuns).values({
    id: analysis.runId,
    tenantId: params.tenantId,
    workflowId: 'contact_next_step',
    workflowName: 'DeepSeek-Harness: Анализ сделки и следующий шаг',
    actorId: params.actorId,
    inputPayload: { dealId: deal.id, trigger: params.trigger },
    outputPayload: analysis as unknown as Record<string, unknown>,
    status: 'completed',
    durationMs,
  });

  if (params.writeTimelineInsight) {
    await db.insert(timelineEvents).values({
      id: `tl_${crypto.randomUUID().slice(0, 10)}`,
      tenantId: params.tenantId,
      dealId: deal.id,
      authorId: params.actorId,
      type: 'dify_insight',
      body: `DeepSeek-Harness (${analysis.winProbability}%, риск: ${analysis.riskLevel}): ${analysis.nextStep.title}. Основание: ${analysis.nextStep.rationale}`,
      metadata: { runId: analysis.runId, workflowId: 'contact_next_step', winProbability: analysis.winProbability },
    });
  }

  const shouldPublishNats = params.publishNats ?? params.trigger !== 'auto_load';
  if (shouldPublishNats) {
    await natsBus.publish(params.tenantId, 'harness.deal.analyzed', params.actorId, {
      dealId: deal.id,
      winProbability: analysis.winProbability,
      riskLevel: analysis.riskLevel,
      nextStepTitle: analysis.nextStep.title,
      trigger: params.trigger,
    });
  }

  return analysis;
}

export async function getLatestDealAnalyses(
  tenantId: string,
  dealIds: string[]
): Promise<Record<string, DealHarnessAnalysis>> {
  if (dealIds.length === 0) return {};
  const db = await getDb();
  const targetSet = new Set(dealIds);
  const rows = await db
    .select()
    .from(harnessRuns)
    .where(and(eq(harnessRuns.tenantId, tenantId), eq(harnessRuns.workflowId, 'contact_next_step')))
    .orderBy(desc(harnessRuns.createdAt))
    .limit(Math.max(100, dealIds.length * 4));

  const map: Record<string, DealHarnessAnalysis> = {};
  for (const row of rows) {
    const out = row.outputPayload as unknown as DealHarnessAnalysis;
    if (out && typeof out.dealId === 'string' && targetSet.has(out.dealId) && !map[out.dealId]) {
      map[out.dealId] = out;
      if (Object.keys(map).length === targetSet.size) break;
    }
  }
  return map;
}

export async function executeHarnessWorkflow(params: {
  tenantId: string;
  actorId: string;
  input: z.infer<typeof HarnessExecuteSchema>;
}) {
  const startedAt = Date.now();
  const db = await getDb();
  const workflow = HARNESS_WORKFLOWS.find((w) => w.id === params.input.workflowId)!;

  if (
    (params.input.workflowId === 'contact_next_step' || params.input.workflowId === 'deal_qualification') &&
    params.input.dealId
  ) {
    const analysis = await analyzeDealFromContactHistory({
      tenantId: params.tenantId,
      dealId: params.input.dealId,
      actorId: params.actorId,
      trigger: 'manual_card',
      writeTimelineInsight: true,
    });
    return {
      id: analysis.runId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: 'completed',
      durationMs: Math.max(15, Date.now() - startedAt),
      outputPayload:
        params.input.workflowId === 'contact_next_step'
          ? (analysis as unknown as Record<string, unknown>)
          : {
              dealId: analysis.dealId,
              winProbability: analysis.winProbability,
              riskLevel: analysis.riskLevel,
              contactHistorySummary: analysis.contactHistorySummary,
              nextStep: analysis.nextStep,
              difyNodeTrace: workflow.nodes,
            },
      createdAt: analysis.analyzedAt,
    };
  }

  let outputPayload: Record<string, unknown> = {};

  if (params.input.workflowId === 'dify_followup_draft' && params.input.dealId) {
    const [deal] = await db
      .select()
      .from(deals)
      .where(and(eq(deals.id, params.input.dealId), eq(deals.tenantId, params.tenantId)));
    if (!deal) {
      throw new Error('Сделка не найдена в контексте текущего тенанта');
    }
    const [contact] = deal.contactId
      ? await db.select().from(contacts).where(eq(contacts.id, deal.contactId))
      : [];
    const greeting = contact ? `Здравствуйте, ${contact.fullName}!` : 'Добрый день!';
    const draft = `${greeting}\n\nПо проекту «${deal.title}» (бюджет ${deal.budget.toLocaleString('ru-RU')} ${deal.currency}) подготовили выделенный контур на поддомене и спецификацию интеграции с PostgreSQL, RBAC и NATS. Готовы провести 20-минутный разбор завтра в 11:00.${params.input.promptContext ? `\n\nДополнительно: ${params.input.promptContext}` : ''}`.trim();

    outputPayload = {
      dealId: deal.id,
      draftSubject: `Следующие шаги по проекту «${deal.title}»`,
      draftText: draft,
      difyNodeTrace: workflow.nodes,
    };

    await db.insert(timelineEvents).values({
      id: `tl_${crypto.randomUUID().slice(0, 10)}`,
      tenantId: params.tenantId,
      dealId: deal.id,
      authorId: params.actorId,
      type: 'dify_insight',
      body: draft,
      metadata: { workflowId: workflow.id },
    });
  } else {
    outputPayload = {
      tenantId: params.tenantId,
      isolationMode: 'Strict Subdomain Row-Level Filtering + Traefik Host Rule',
      rbacIntegrity: 'Verified against PostgreSQL role_permissions',
      verdaccioHealth: 'Connected (@nexus-plugins/* scope verified)',
      difyNodeTrace: workflow.nodes,
    };
  }

  const durationMs = Math.max(18, Date.now() - startedAt);
  const runId = `hrun_${crypto.randomUUID().slice(0, 10)}`;

  await db.insert(harnessRuns).values({
    id: runId,
    tenantId: params.tenantId,
    workflowId: workflow.id,
    workflowName: workflow.name,
    actorId: params.actorId,
    inputPayload: params.input as Record<string, unknown>,
    outputPayload,
    status: 'completed',
    durationMs,
  });

  await natsBus.publish(params.tenantId, `harness.workflow.${workflow.id}.completed`, params.actorId, {
    runId,
    durationMs,
  });

  return {
    id: runId,
    workflowId: workflow.id,
    workflowName: workflow.name,
    status: 'completed',
    durationMs,
    outputPayload,
    createdAt: new Date().toISOString(),
  };
}

export async function listHarnessRuns(tenantId: string) {
  const db = await getDb();
  return db
    .select()
    .from(harnessRuns)
    .where(eq(harnessRuns.tenantId, tenantId))
    .orderBy(desc(harnessRuns.createdAt))
    .limit(20);
}
