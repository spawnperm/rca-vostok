import crypto from 'crypto';
import { and, eq } from 'drizzle-orm';
import {
  buildN8nFromLegacyWorkflow,
  extractConditionFromN8nIfNode,
  isN8nTriggerType,
  mapN8nNodeToLegacyAction,
  type N8nNode,
  type N8nWorkflowDefinition,
} from '../../domain/n8n/workflowDefinition.ts';
import type {
  WorkflowCondition,
  WorkflowNodeDef,
  WorkflowTriggerType,
} from '../../domain/nocobase/entities.ts';
import { getDb } from '../db/client.ts';
import {
  nocobaseApprovals,
  nocobaseRecords,
  nocobaseWorkflowExecutions,
  nocobaseWorkflows,
  tasks,
  timelineEvents,
} from '../db/schema.ts';
import { analyzeDealFromContactHistory } from '../harness/deepseekHarness.ts';
import { natsBus } from '../nats/eventBus.ts';

export interface WorkflowTriggerContext {
  tenantId: string;
  tenantSubdomain: string;
  actorId: string;
  triggerType: WorkflowTriggerType;
  collectionKey?: string;
  bypassIfBranching?: boolean;
  deal?: {
    id: string;
    title: string;
    budget: number;
    ownerId: string;
    stageId: string;
    stageName?: string;
    stageIsWon?: boolean;
  };
  record?: {
    id: string;
    collectionKey: string;
    data: Record<string, unknown>;
  };
  task?: {
    id: string;
    title: string;
    dealId?: string | null;
    assigneeId: string;
  };
}

function resolvePayloadMap(ctx: WorkflowTriggerContext): Record<string, unknown> {
  const map: Record<string, unknown> = {
    triggerType: ctx.triggerType,
    collectionKey: ctx.collectionKey || ctx.record?.collectionKey || '',
  };
  if (ctx.deal) {
    map.dealId = ctx.deal.id;
    map.title = ctx.deal.title;
    map.budget = ctx.deal.budget;
    map.stageId = ctx.deal.stageId;
    map.stageName = ctx.deal.stageName || '';
    map.stageIsWon = Boolean(ctx.deal.stageIsWon);
  }
  if (ctx.record) {
    Object.assign(map, ctx.record.data);
    map.recordId = ctx.record.id;
  }
  if (ctx.task) {
    map.taskId = ctx.task.id;
    map.title = ctx.task.title;
    if (ctx.task.dealId) map.dealId = ctx.task.dealId;
  }
  return map;
}

function interpolateTemplate(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_m, key: string) => {
    const val = vars[key];
    return val === undefined || val === null ? '' : String(val);
  });
}

export function evaluateWorkflowCondition(
  condition: WorkflowCondition | null | undefined,
  vars: Record<string, unknown>
): boolean {
  if (!condition || !condition.field) return true;
  const raw = vars[condition.field];
  const strActual = raw === undefined || raw === null ? '' : String(raw);
  const strExpected = condition.value ?? '';

  switch (condition.operator) {
    case 'eq':
      return strActual.toLowerCase() === strExpected.toLowerCase();
    case 'neq':
      return strActual.toLowerCase() !== strExpected.toLowerCase();
    case 'gt': {
      const a = Number(raw);
      const b = Number(strExpected);
      return Number.isFinite(a) && Number.isFinite(b) && a > b;
    }
    case 'gte': {
      const a = Number(raw);
      const b = Number(strExpected);
      return Number.isFinite(a) && Number.isFinite(b) && a >= b;
    }
    case 'lt': {
      const a = Number(raw);
      const b = Number(strExpected);
      return Number.isFinite(a) && Number.isFinite(b) && a < b;
    }
    case 'contains':
      return strActual.toLowerCase().includes(strExpected.toLowerCase());
    default:
      return false;
  }
}

async function executeActionStep(params: {
  step: WorkflowNodeDef;
  nodeTypeLabel: string;
  workflowRow: typeof nocobaseWorkflows.$inferSelect;
  ctx: WorkflowTriggerContext;
  vars: Record<string, unknown>;
}): Promise<{ nodeTitle: string; nodeType: string; status: 'ok' | 'skipped'; detail: string }> {
  const { step, nodeTypeLabel, workflowRow, ctx, vars } = params;
  const db = await getDb();
  const cfg = step.config || {};

  if (step.type === 'create_task') {
    const rawTitle = cfg.taskTitle || 'Задача процесса: {{title}}';
    const title = interpolateTemplate(rawTitle, vars) || `Задача по процессу «${workflowRow.name}»`;
    const dueHours = Math.max(1, Number(cfg.dueHours || '24') || 24);
    const taskType = ['call', 'meeting', 'followup', 'dify_ai'].includes(cfg.taskType || '')
      ? cfg.taskType
      : 'followup';
    const assigneeId = ctx.deal?.ownerId || ctx.task?.assigneeId || ctx.actorId;
    await db.insert(tasks).values({
      id: `tsk_${crypto.randomUUID().slice(0, 8)}`,
      tenantId: ctx.tenantId,
      dealId: ctx.deal?.id || ctx.task?.dealId || null,
      assigneeId,
      taskType,
      title,
      dueAt: new Date(Date.now() + dueHours * 3600_000),
      completed: false,
    });
    return {
      nodeTitle: step.title,
      nodeType: nodeTypeLabel,
      status: 'ok',
      detail: `Создана задача: ${title}`,
    };
  }

  if (step.type === 'timeline_note') {
    const dealId = ctx.deal?.id || ctx.task?.dealId;
    if (!dealId) {
      return {
        nodeTitle: step.title,
        nodeType: nodeTypeLabel,
        status: 'skipped',
        detail: 'Нет связанной сделки',
      };
    }
    const body = interpolateTemplate(cfg.body || 'Выполнен шаг процесса «{{triggerType}}»', vars);
    await db.insert(timelineEvents).values({
      id: `tle_${crypto.randomUUID().slice(0, 8)}`,
      tenantId: ctx.tenantId,
      dealId,
      authorId: ctx.actorId,
      type: 'workflow',
      body,
      metadata: { workflowId: workflowRow.id, workflowName: workflowRow.name, engine: 'n8n' },
    });
    return {
      nodeTitle: step.title,
      nodeType: nodeTypeLabel,
      status: 'ok',
      detail: 'Добавлена запись в таймлайн сделки',
    };
  }

  if (step.type === 'create_approval') {
    const entityType = ctx.deal ? 'deal' : ctx.record ? 'collection_record' : 'general';
    const entityId = ctx.deal?.id || ctx.record?.id || null;
    const entityLabel =
      ctx.deal?.title ||
      String(vars.title || vars.subject || vars.partner_name || workflowRow.name);
    const amount = Number(ctx.deal?.budget ?? vars.amount ?? vars.revenue ?? 0) || 0;
    const approverRoleCode = cfg.approverRoleCode || 'sales_head';
    const comment = interpolateTemplate(
      cfg.comment || `Автоматический запрос процесса «${workflowRow.name}»`,
      vars
    );
    await db.insert(nocobaseApprovals).values({
      id: `nb_apr_${crypto.randomUUID().slice(0, 8)}`,
      tenantId: ctx.tenantId,
      title: `Согласование: ${entityLabel}`,
      entityType,
      entityId,
      entityLabel,
      amount: Math.max(0, Math.round(amount)),
      requesterId: ctx.actorId,
      approverRoleCode,
      status: 'pending',
      comment,
    });
    return {
      nodeTitle: step.title,
      nodeType: nodeTypeLabel,
      status: 'ok',
      detail: `Создан запрос согласования для роли ${approverRoleCode}`,
    };
  }

  if (step.type === 'harness_analyze') {
    if (!ctx.deal?.id) {
      return {
        nodeTitle: step.title,
        nodeType: nodeTypeLabel,
        status: 'skipped',
        detail: 'Нет dealId для Harness',
      };
    }
    await analyzeDealFromContactHistory({
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      dealId: ctx.deal.id,
      trigger: 'nocobase_workflow',
    });
    return {
      nodeTitle: step.title,
      nodeType: nodeTypeLabel,
      status: 'ok',
      detail: 'DeepSeek-Harness обновил прогноз',
    };
  }

  if (step.type === 'update_record') {
    if (!ctx.record?.id || !cfg.field) {
      return {
        nodeTitle: step.title,
        nodeType: nodeTypeLabel,
        status: 'skipped',
        detail: 'Нет целевой записи или поля',
      };
    }
    const nextData = { ...ctx.record.data, [cfg.field]: cfg.value ?? '' };
    await db
      .update(nocobaseRecords)
      .set({ data: nextData, updatedAt: new Date() })
      .where(and(eq(nocobaseRecords.id, ctx.record.id), eq(nocobaseRecords.tenantId, ctx.tenantId)));
    return {
      nodeTitle: step.title,
      nodeType: nodeTypeLabel,
      status: 'ok',
      detail: `Поле ${cfg.field} обновлено на ${cfg.value ?? ''}`,
    };
  }

  // nats_publish default
  const subject = interpolateTemplate(
    cfg.subject || `workflows.${ctx.tenantSubdomain}.executed`,
    vars
  );
  await natsBus.publish(ctx.tenantId, subject, ctx.actorId, {
    workflowId: workflowRow.id,
    workflowName: workflowRow.name,
    triggerType: ctx.triggerType,
    dealId: ctx.deal?.id,
    recordId: ctx.record?.id,
  });
  return {
    nodeTitle: step.title,
    nodeType: nodeTypeLabel,
    status: 'ok',
    detail: `Событие ${subject}`,
  };
}

export async function runSingleWorkflow(
  workflowRow: typeof nocobaseWorkflows.$inferSelect,
  ctx: WorkflowTriggerContext
): Promise<typeof nocobaseWorkflowExecutions.$inferSelect | null> {
  const db = await getDb();
  const vars = resolvePayloadMap(ctx);
  const startedAt = Date.now();

  const storedN8n = workflowRow.n8nDefinition as N8nWorkflowDefinition | null;
  const n8nDef: N8nWorkflowDefinition =
    storedN8n && Array.isArray(storedN8n.nodes) && storedN8n.nodes.length > 0
      ? storedN8n
      : buildN8nFromLegacyWorkflow({
          id: workflowRow.id,
          name: workflowRow.name,
          description: workflowRow.description,
          triggerType: workflowRow.triggerType as WorkflowTriggerType,
          triggerConfig: (workflowRow.triggerConfig || {}) as Record<string, string>,
          condition: (workflowRow.condition || null) as WorkflowCondition | null,
          nodes: (workflowRow.nodes || []) as unknown as WorkflowNodeDef[],
          enabled: workflowRow.enabled,
        });

  const nodeByName = new Map<string, N8nNode>(n8nDef.nodes.map((n) => [n.name, n]));
  const triggerNode = n8nDef.nodes.find((n) => isN8nTriggerType(n.type)) || n8nDef.nodes[0];
  if (!triggerNode) return null;

  const stepsLog: Array<{ nodeTitle: string; nodeType?: string; status: 'ok' | 'skipped'; detail: string }> = [
    {
      nodeTitle: triggerNode.name,
      nodeType: triggerNode.type,
      status: 'ok',
      detail: `Триггер n8n (${ctx.triggerType})`,
    },
  ];

  // Traverse n8n directed graph via BFS with cycle protection
  const queue: string[] = [];
  const startOutputs = n8nDef.connections?.[triggerNode.name]?.main?.[0] || [];
  for (const edge of startOutputs) {
    queue.push(edge.node);
  }

  const visited = new Set<string>([triggerNode.name]);
  let executedActionOrSet = false;
  let guard = 0;

  while (queue.length > 0 && guard < 50) {
    guard++;
    const currentName = queue.shift()!;
    if (visited.has(currentName)) continue;
    visited.add(currentName);

    const node = nodeByName.get(currentName);
    if (!node || node.disabled) continue;

    if (node.type === 'n8n-nodes-base.if') {
      const cond = extractConditionFromN8nIfNode(node) || ((workflowRow.condition || null) as WorkflowCondition | null);
      const passed = ctx.bypassIfBranching ? true : evaluateWorkflowCondition(cond, vars);
      const mainPorts = n8nDef.connections?.[node.name]?.main || [];
      const trueTargets = mainPorts[0] || [];
      const falseTargets = mainPorts[1] || [];

      if (!passed && falseTargets.length === 0 && !ctx.bypassIfBranching) {
        // Automatic condition not met and no False branch defined -> skip execution cleanly
        return null;
      }

      const branchTargets = passed ? trueTargets : falseTargets;
      stepsLog.push({
        nodeTitle: node.name,
        nodeType: node.type,
        status: 'ok',
        detail: passed
          ? `Ветка TRUE (${cond ? `${cond.field} ${cond.operator} ${cond.value}` : 'ok'})`
          : `Ветка FALSE (${cond ? `${cond.field} ${cond.operator} ${cond.value}` : 'false'})`,
      });
      for (const edge of branchTargets) {
        queue.push(edge.node);
      }
      continue;
    }

    if (node.type === 'n8n-nodes-base.set') {
      const params = (node.parameters || {}) as Record<string, unknown>;
      const assigned: string[] = [];
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && typeof v !== 'object') {
          vars[k] = interpolateTemplate(String(v), vars);
          assigned.push(`${k}=${vars[k]}`);
        }
      }
      executedActionOrSet = true;
      stepsLog.push({
        nodeTitle: node.name,
        nodeType: node.type,
        status: 'ok',
        detail: assigned.length > 0 ? `Переменные: ${assigned.join(', ')}` : 'Контекст обновлён',
      });
      const nextEdges = n8nDef.connections?.[node.name]?.main?.[0] || [];
      for (const edge of nextEdges) queue.push(edge.node);
      continue;
    }

    const legacyStep = mapN8nNodeToLegacyAction(node);
    if (legacyStep) {
      executedActionOrSet = true;
      const stepRes = await executeActionStep({
        step: legacyStep,
        nodeTypeLabel: node.type,
        workflowRow,
        ctx,
        vars,
      });
      stepsLog.push(stepRes);
    } else {
      stepsLog.push({
        nodeTitle: node.name,
        nodeType: node.type,
        status: 'skipped',
        detail: `Узел ${node.type} зафиксирован на схеме n8n`,
      });
    }

    const nextEdges = n8nDef.connections?.[node.name]?.main?.[0] || [];
    for (const edge of nextEdges) {
      queue.push(edge.node);
    }
  }

  if (!executedActionOrSet && stepsLog.length <= 1) {
    return null;
  }

  const durationMs = Math.max(1, Date.now() - startedAt);
  const contextSummary = ctx.deal
    ? `Сделка: ${ctx.deal.title} (${ctx.deal.budget.toLocaleString('ru-RU')} ₽)`
    : ctx.record
    ? `Коллекция ${ctx.record.collectionKey}: ${String(vars.title || vars.subject || vars.partner_name || ctx.record.id)}`
    : ctx.task
    ? `Задача: ${ctx.task.title}`
    : `Ручной запуск n8n (${ctx.triggerType})`;

  const [execution] = await db
    .insert(nocobaseWorkflowExecutions)
    .values({
      id: `nb_exec_${crypto.randomUUID().slice(0, 8)}`,
      tenantId: ctx.tenantId,
      workflowId: workflowRow.id,
      workflowName: workflowRow.name,
      triggerType: ctx.triggerType,
      status: 'completed',
      contextSummary,
      stepsLog,
      durationMs,
    })
    .returning();

  await db
    .update(nocobaseWorkflows)
    .set({
      runsCount: workflowRow.runsCount + 1,
      lastRunAt: new Date(),
    })
    .where(eq(nocobaseWorkflows.id, workflowRow.id));

  await natsBus.publish(
    ctx.tenantId,
    `nocobase.${ctx.tenantSubdomain}.workflow.completed`,
    ctx.actorId,
    {
      executionId: execution.id,
      workflowId: workflowRow.id,
      workflowName: workflowRow.name,
      triggerType: ctx.triggerType,
      durationMs,
      stepsCount: stepsLog.length,
    },
    { consumerGroup: 'nocobase-workflow-worker' }
  );

  return execution;
}

export async function triggerNocobaseWorkflows(
  ctx: WorkflowTriggerContext
): Promise<Array<typeof nocobaseWorkflowExecutions.$inferSelect>> {
  const db = await getDb();
  const candidates = await db
    .select()
    .from(nocobaseWorkflows)
    .where(
      and(
        eq(nocobaseWorkflows.tenantId, ctx.tenantId),
        eq(nocobaseWorkflows.triggerType, ctx.triggerType),
        eq(nocobaseWorkflows.enabled, true)
      )
    );

  const executions: Array<typeof nocobaseWorkflowExecutions.$inferSelect> = [];
  for (const wf of candidates) {
    const tCfg = (wf.triggerConfig || {}) as Record<string, string>;
    if (
      ctx.triggerType === 'record.created' &&
      tCfg.collectionKey &&
      tCfg.collectionKey !== ctx.collectionKey
    ) {
      continue;
    }
    const exec = await runSingleWorkflow(wf, ctx);
    if (exec) executions.push(exec);
  }
  return executions;
}
