import { z } from 'zod';
import {
  WORKFLOW_NODE_TYPES,
  WORKFLOW_TRIGGERS,
  type WorkflowCondition,
  type WorkflowNodeDef,
  type WorkflowNodeType,
  type WorkflowTriggerType,
} from '../nocobase/entities.ts';

export const N8N_NODE_TYPE_CATALOG = [
  // Triggers
  'n8n-nodes-crm.dealCreatedTrigger',
  'n8n-nodes-crm.dealStageChangedTrigger',
  'n8n-nodes-crm.taskCompletedTrigger',
  'n8n-nodes-nocobase.recordCreatedTrigger',
  'n8n-nodes-base.manualTrigger',
  'n8n-nodes-base.webhook',
  // Flow Control / Transform
  'n8n-nodes-base.if',
  'n8n-nodes-base.set',
  // Actions
  'n8n-nodes-crm.createTask',
  'n8n-nodes-crm.timelineNote',
  'n8n-nodes-nocobase.createApproval',
  'n8n-nodes-nocobase.updateRecord',
  'n8n-nodes-nats.publish',
  'n8n-nodes-deepseek.harnessAnalyze',
] as const;

export type N8nNodeType = (typeof N8N_NODE_TYPE_CATALOG)[number] | string;

export const N8nConnectionTargetSchema = z.object({
  node: z.string().trim().min(1).max(120),
  type: z.literal('main').default('main'),
  index: z.number().int().min(0).max(10).default(0),
});

export type N8nConnectionTarget = z.infer<typeof N8nConnectionTargetSchema>;

export const N8nNodeSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(120),
  typeVersion: z.number().min(1).max(20).default(1),
  position: z.tuple([z.number(), z.number()]).default([240, 240]),
  parameters: z.record(z.string(), z.unknown()).default({}),
  disabled: z.boolean().optional(),
  notes: z.string().max(400).optional(),
});

export type N8nNode = z.infer<typeof N8nNodeSchema>;

export type N8nConnections = Record<
  string,
  {
    main?: Array<Array<N8nConnectionTarget>>;
  }
>;

export const N8nConnectionsSchema: z.ZodType<N8nConnections> = z.record(
  z.string(),
  z.object({
    main: z.array(z.array(N8nConnectionTargetSchema)).optional(),
  })
);

export const N8nWorkflowDefinitionSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, 'Укажите название n8n-процесса').max(120),
  active: z.boolean().default(true),
  nodes: z
    .array(N8nNodeSchema)
    .min(1, 'n8n-схема должна содержать хотя бы 1 узел')
    .max(40, 'Превышен лимит узлов в одном n8n-процессе (макс. 40)'),
  connections: N8nConnectionsSchema.default({}),
  settings: z
    .object({
      executionOrder: z.string().default('v1'),
      timezone: z.string().optional(),
    })
    .default({ executionOrder: 'v1' }),
  tags: z.array(z.union([z.string(), z.object({ id: z.string().optional(), name: z.string() })])).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type N8nWorkflowDefinition = z.infer<typeof N8nWorkflowDefinitionSchema>;

const TRIGGER_TO_N8N_TYPE: Record<WorkflowTriggerType, string> = {
  'deal.created': 'n8n-nodes-crm.dealCreatedTrigger',
  'deal.stage_changed': 'n8n-nodes-crm.dealStageChangedTrigger',
  'task.completed': 'n8n-nodes-crm.taskCompletedTrigger',
  'record.created': 'n8n-nodes-nocobase.recordCreatedTrigger',
  manual: 'n8n-nodes-base.manualTrigger',
};

const TRIGGER_TO_NODE_NAME: Record<WorkflowTriggerType, string> = {
  'deal.created': 'CRM: Создание сделки',
  'deal.stage_changed': 'CRM: Смена этапа сделки',
  'task.completed': 'CRM: Завершение задачи',
  'record.created': 'NocoBase: Новая запись',
  manual: 'Manual Trigger',
};

const ACTION_TO_N8N_TYPE: Record<WorkflowNodeType, string> = {
  create_task: 'n8n-nodes-crm.createTask',
  timeline_note: 'n8n-nodes-crm.timelineNote',
  create_approval: 'n8n-nodes-nocobase.createApproval',
  nats_publish: 'n8n-nodes-nats.publish',
  harness_analyze: 'n8n-nodes-deepseek.harnessAnalyze',
  update_record: 'n8n-nodes-nocobase.updateRecord',
};

const N8N_OP_MAP: Record<WorkflowCondition['operator'], string> = {
  eq: 'equals',
  neq: 'notEquals',
  gt: 'larger',
  gte: 'largerEqual',
  lt: 'smaller',
  contains: 'contains',
};

const REVERSE_OP_MAP: Record<string, WorkflowCondition['operator']> = {
  equals: 'eq',
  equal: 'eq',
  eq: 'eq',
  notEquals: 'neq',
  neq: 'neq',
  larger: 'gt',
  gt: 'gt',
  largerEqual: 'gte',
  gte: 'gte',
  smaller: 'lt',
  lt: 'lt',
  contains: 'contains',
};

export function isN8nTriggerType(nodeType: string): boolean {
  const low = nodeType.toLowerCase();
  return low.includes('trigger') || low === 'n8n-nodes-base.webhook';
}

export function mapN8nTriggerToRuntime(
  node: N8nNode | undefined
): { triggerType: WorkflowTriggerType; triggerConfig: Record<string, string> } {
  if (!node) return { triggerType: 'manual', triggerConfig: {} };
  const params = (node.parameters || {}) as Record<string, unknown>;
  const triggerConfig: Record<string, string> = {};
  if (typeof params.collectionKey === 'string' && params.collectionKey.trim()) {
    triggerConfig.collectionKey = params.collectionKey.trim();
  }

  switch (node.type) {
    case 'n8n-nodes-crm.dealCreatedTrigger':
      return { triggerType: 'deal.created', triggerConfig };
    case 'n8n-nodes-crm.dealStageChangedTrigger':
      return { triggerType: 'deal.stage_changed', triggerConfig };
    case 'n8n-nodes-crm.taskCompletedTrigger':
      return { triggerType: 'task.completed', triggerConfig };
    case 'n8n-nodes-nocobase.recordCreatedTrigger':
      return { triggerType: 'record.created', triggerConfig };
    default: {
      const eventParam = typeof params.event === 'string' ? params.event : '';
      if (WORKFLOW_TRIGGERS.includes(eventParam as WorkflowTriggerType)) {
        return { triggerType: eventParam as WorkflowTriggerType, triggerConfig };
      }
      return { triggerType: 'manual', triggerConfig };
    }
  }
}

export function extractConditionFromN8nIfNode(node: N8nNode | undefined): WorkflowCondition | null {
  if (!node || node.type !== 'n8n-nodes-base.if') return null;
  const params = (node.parameters || {}) as Record<string, unknown>;

  // Direct simplified parameters support
  if (typeof params.field === 'string' && params.field.trim()) {
    const op = REVERSE_OP_MAP[String(params.operator || 'eq')] || 'eq';
    return {
      field: params.field.trim().slice(0, 60),
      operator: op,
      value: String(params.value ?? '').slice(0, 120),
    };
  }

  // Standard n8n v2 conditions structure: { conditions: { conditions: [{ leftValue, rightValue, operator: { operation } }] } }
  const condBlock = params.conditions as
    | { conditions?: Array<{ leftValue?: unknown; rightValue?: unknown; operator?: { operation?: string } }> }
    | undefined;
  const first = condBlock?.conditions?.[0];
  if (first) {
    const rawLeft = String(first.leftValue ?? '');
    const fieldMatch = /\{\{\s*(?:\$json\.)?([a-zA-Z0-9_]+)\s*\}\}/.exec(rawLeft);
    const field = (fieldMatch ? fieldMatch[1] : rawLeft.replace(/^\$json\./, '')).trim().slice(0, 60);
    if (field) {
      const op = REVERSE_OP_MAP[String(first.operator?.operation || 'equals')] || 'eq';
      return {
        field,
        operator: op,
        value: String(first.rightValue ?? '').slice(0, 120),
      };
    }
  }

  return null;
}

export function mapN8nNodeToLegacyAction(node: N8nNode): WorkflowNodeDef | null {
  const params = (node.parameters || {}) as Record<string, unknown>;
  const strParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && typeof v !== 'object') {
      strParams[k] = String(v);
    }
  }

  const map: Record<string, WorkflowNodeType> = {
    'n8n-nodes-crm.createTask': 'create_task',
    'n8n-nodes-crm.timelineNote': 'timeline_note',
    'n8n-nodes-nocobase.createApproval': 'create_approval',
    'n8n-nodes-nocobase.updateRecord': 'update_record',
    'n8n-nodes-nats.publish': 'nats_publish',
    'n8n-nodes-deepseek.harnessAnalyze': 'harness_analyze',
  };

  const mapped = map[node.type];
  if (mapped && WORKFLOW_NODE_TYPES.includes(mapped)) {
    return {
      id: node.id,
      type: mapped,
      title: node.name,
      config: strParams,
    };
  }
  return null;
}

function makeUniqueNodeName(desired: string, used: Set<string>): string {
  const base = desired.trim() || 'Node';
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let idx = 2;
  while (used.has(`${base} ${idx}`)) idx++;
  const next = `${base} ${idx}`;
  used.add(next);
  return next;
}

export function buildN8nFromLegacyWorkflow(wf: {
  id?: string;
  name: string;
  description?: string;
  triggerType: WorkflowTriggerType;
  triggerConfig?: Record<string, string>;
  condition?: WorkflowCondition | null;
  nodes: WorkflowNodeDef[];
  enabled?: boolean;
}): N8nWorkflowDefinition {
  const usedNames = new Set<string>();
  const n8nNodes: N8nNode[] = [];
  const connections: N8nConnections = {};

  const triggerName = makeUniqueNodeName(TRIGGER_TO_NODE_NAME[wf.triggerType] || 'Trigger', usedNames);
  const triggerNode: N8nNode = {
    id: 'n8n_trigger_1',
    name: triggerName,
    type: TRIGGER_TO_N8N_TYPE[wf.triggerType] || 'n8n-nodes-base.manualTrigger',
    typeVersion: 1,
    position: [120, 220],
    parameters: {
      event: wf.triggerType,
      ...(wf.triggerConfig || {}),
    },
  };
  n8nNodes.push(triggerNode);

  let prevNodeName = triggerName;
  let xCursor = 400;

  if (wf.condition && wf.condition.field) {
    const ifName = makeUniqueNodeName(
      `IF: ${wf.condition.field} ${wf.condition.operator} ${wf.condition.value}`,
      usedNames
    );
    const ifNode: N8nNode = {
      id: 'n8n_if_1',
      name: ifName,
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [xCursor, 220],
      parameters: {
        field: wf.condition.field,
        operator: wf.condition.operator,
        value: wf.condition.value,
        conditions: {
          combinator: 'and',
          conditions: [
            {
              leftValue: `={{ $json.${wf.condition.field} }}`,
              rightValue: wf.condition.value,
              operator: {
                type: ['gt', 'gte', 'lt'].includes(wf.condition.operator) ? 'number' : 'string',
                operation: N8N_OP_MAP[wf.condition.operator] || 'equals',
              },
            },
          ],
        },
      },
    };
    n8nNodes.push(ifNode);
    connections[prevNodeName] = {
      main: [[{ node: ifName, type: 'main', index: 0 }]],
    };
    prevNodeName = ifName;
    xCursor += 280;
  }

  wf.nodes.forEach((step, idx) => {
    const nodeName = makeUniqueNodeName(step.title || `Step ${idx + 1}`, usedNames);
    const n8nNode: N8nNode = {
      id: step.id || `n8n_node_${idx + 1}`,
      name: nodeName,
      type: ACTION_TO_N8N_TYPE[step.type] || 'n8n-nodes-crm.createTask',
      typeVersion: 1,
      position: [xCursor, 220],
      parameters: { ...(step.config || {}) },
    };
    n8nNodes.push(n8nNode);
    connections[prevNodeName] = {
      main: [[{ node: nodeName, type: 'main', index: 0 }]],
    };
    prevNodeName = nodeName;
    xCursor += 280;
  });

  return {
    ...(wf.id ? { id: wf.id } : {}),
    name: wf.name,
    active: wf.enabled ?? true,
    nodes: n8nNodes,
    connections,
    settings: { executionOrder: 'v1', timezone: 'Europe/Moscow' },
    meta: {
      engine: 'NexusHarness-n8n',
      description: wf.description || '',
    },
  };
}

export function compileN8nToRuntime(n8nInput: N8nWorkflowDefinition): {
  name: string;
  description: string;
  triggerType: WorkflowTriggerType;
  triggerConfig: Record<string, string>;
  condition: WorkflowCondition | null;
  nodes: WorkflowNodeDef[];
  enabled: boolean;
  n8nDefinition: N8nWorkflowDefinition;
} {
  const triggerNode =
    n8nInput.nodes.find((n) => isN8nTriggerType(n.type)) || n8nInput.nodes[0];
  const { triggerType, triggerConfig } = mapN8nTriggerToRuntime(triggerNode);

  const ifNode = n8nInput.nodes.find((n) => n.type === 'n8n-nodes-base.if');
  const condition = extractConditionFromN8nIfNode(ifNode);

  const actionNodes: WorkflowNodeDef[] = [];
  for (const node of n8nInput.nodes) {
    if (node.id === triggerNode?.id || node.type === 'n8n-nodes-base.if') continue;
    const mapped = mapN8nNodeToLegacyAction(node);
    if (mapped) {
      actionNodes.push(mapped);
    }
  }

  // Ensure at least one runtime node exists for Zod / legacy compatibility
  if (actionNodes.length === 0) {
    actionNodes.push({
      id: 'n8n_fallback_nats',
      type: 'nats_publish',
      title: 'Уведомление выполнения n8n-сценария',
      config: { subject: 'workflows.n8n.executed' },
    });
  }

  const description =
    typeof n8nInput.meta?.description === 'string' ? n8nInput.meta.description : '';

  return {
    name: n8nInput.name,
    description,
    triggerType,
    triggerConfig,
    condition,
    nodes: actionNodes.slice(0, 10),
    enabled: n8nInput.active,
    n8nDefinition: n8nInput,
  };
}

export function getN8nNodeDisplayMeta(type: string): {
  category: 'trigger' | 'logic' | 'crm' | 'platform';
  shortLabel: string;
  accentHex: string;
} {
  if (isN8nTriggerType(type)) {
    return { category: 'trigger', shortLabel: 'Триггер', accentHex: '#0077FF' };
  }
  if (type === 'n8n-nodes-base.if') {
    return { category: 'logic', shortLabel: 'Условие IF', accentHex: '#D97706' };
  }
  if (type === 'n8n-nodes-base.set') {
    return { category: 'logic', shortLabel: 'Edit Fields', accentHex: '#7C3AED' };
  }
  if (type.startsWith('n8n-nodes-crm.')) {
    return { category: 'crm', shortLabel: 'amoCRM', accentHex: '#0284C7' };
  }
  if (type === 'n8n-nodes-deepseek.harnessAnalyze') {
    return { category: 'platform', shortLabel: 'DeepSeek AI', accentHex: '#4F46E5' };
  }
  if (type === 'n8n-nodes-nats.publish') {
    return { category: 'platform', shortLabel: 'NATS', accentHex: '#059669' };
  }
  return { category: 'platform', shortLabel: 'NocoBase', accentHex: '#334155' };
}

export const N8N_NODE_TEMPLATES: Array<{
  type: string;
  defaultName: string;
  category: 'trigger' | 'logic' | 'crm' | 'platform';
  description: string;
  defaultParameters: Record<string, unknown>;
}> = [
  {
    type: 'n8n-nodes-base.if',
    defaultName: 'IF: Проверка бюджета',
    category: 'logic',
    description: 'Ветвление True (main[0]) / False (main[1]) по полю сделки или записи',
    defaultParameters: {
      field: 'budget',
      operator: 'gte',
      value: '500000',
    },
  },
  {
    type: 'n8n-nodes-base.set',
    defaultName: 'Set: Обогатить контекст',
    category: 'logic',
    description: 'Задаёт переменные контекста для следующих шагов {{var}}',
    defaultParameters: {
      priority: 'Enterprise',
      slaHours: '12',
    },
  },
  {
    type: 'n8n-nodes-crm.createTask',
    defaultName: 'CRM: Создать задачу',
    category: 'crm',
    description: 'Ставит задачу ответственному по сделке в amoCRM',
    defaultParameters: {
      taskTitle: 'Связаться с клиентом: {{title}}',
      taskType: 'followup',
      dueHours: '24',
    },
  },
  {
    type: 'n8n-nodes-nocobase.createApproval',
    defaultName: 'Запрос согласования',
    category: 'platform',
    description: 'Отправляет заявку в Центр согласований выбранной роли',
    defaultParameters: {
      approverRoleCode: 'sales_head',
      comment: 'Требуется согласование условий по {{title}}',
    },
  },
  {
    type: 'n8n-nodes-crm.timelineNote',
    defaultName: 'CRM: Заметка в таймлайн',
    category: 'crm',
    description: 'Фиксирует событие в ленте карточки сделки',
    defaultParameters: {
      body: 'n8n Workflow выполнен для {{title}}',
    },
  },
  {
    type: 'n8n-nodes-deepseek.harnessAnalyze',
    defaultName: 'DeepSeek-Harness: AI-анализ',
    category: 'platform',
    description: 'Пересчитывает вероятность и риск сделки в DeepSeek-Harness',
    defaultParameters: {},
  },
  {
    type: 'n8n-nodes-nats.publish',
    defaultName: 'NATS: Опубликовать событие',
    category: 'platform',
    description: 'Публикует событие в реальном времени в NATS JetStream',
    defaultParameters: {
      subject: 'workflows.n8n.executed',
    },
  },
  {
    type: 'n8n-nodes-nocobase.updateRecord',
    defaultName: 'NocoBase: Обновить запись',
    category: 'platform',
    description: 'Меняет значение поля записи в коллекции NocoBase',
    defaultParameters: {
      field: 'status',
      value: 'В работе',
    },
  },
];

export const N8N_PRESET_TEMPLATES: Array<{
  key: string;
  label: string;
  description: string;
  workflow: N8nWorkflowDefinition;
}> = [
  {
    key: 'deal_branching',
    label: 'IF-ветвление сделки (VIP ≥ 1M / Стандарт)',
    description: 'True ветка запускает согласование РОП + DeepSeek AI, False ветка ставит стандартную задачу',
    workflow: {
      name: 'n8n Маршрутизация новых сделок (IF True/False)',
      active: true,
      nodes: [
        {
          id: 'n1',
          name: 'CRM: Создание сделки',
          type: 'n8n-nodes-crm.dealCreatedTrigger',
          typeVersion: 1,
          position: [80, 220],
          parameters: { event: 'deal.created' },
        },
        {
          id: 'n2',
          name: 'IF: Бюджет ≥ 1 000 000',
          type: 'n8n-nodes-base.if',
          typeVersion: 2,
          position: [360, 220],
          parameters: {
            field: 'budget',
            operator: 'gte',
            value: '1000000',
            conditions: {
              combinator: 'and',
              conditions: [
                {
                  leftValue: '={{ $json.budget }}',
                  rightValue: '1000000',
                  operator: { type: 'number', operation: 'largerEqual' },
                },
              ],
            },
          },
        },
        {
          id: 'n3',
          name: 'Согласование РОП (Enterprise)',
          type: 'n8n-nodes-nocobase.createApproval',
          typeVersion: 1,
          position: [680, 110],
          parameters: {
            approverRoleCode: 'sales_head',
            comment: 'Enterprise-сделка {{title}} на {{budget}} требует одобрения РОП',
          },
        },
        {
          id: 'n4',
          name: 'DeepSeek AI-скоринг',
          type: 'n8n-nodes-deepseek.harnessAnalyze',
          typeVersion: 1,
          position: [980, 110],
          parameters: {},
        },
        {
          id: 'n5',
          name: 'Задача: Первичный звонок',
          type: 'n8n-nodes-crm.createTask',
          typeVersion: 1,
          position: [680, 330],
          parameters: {
            taskTitle: 'Стандартная квалификация: {{title}}',
            taskType: 'call',
            dueHours: '4',
          },
        },
        {
          id: 'n6',
          name: 'NATS: Событие маршрутизации',
          type: 'n8n-nodes-nats.publish',
          typeVersion: 1,
          position: [980, 330],
          parameters: {
            subject: 'workflows.n8n.deal_routed',
          },
        },
      ],
      connections: {
        'CRM: Создание сделки': {
          main: [[{ node: 'IF: Бюджет ≥ 1 000 000', type: 'main', index: 0 }]],
        },
        'IF: Бюджет ≥ 1 000 000': {
          main: [
            [{ node: 'Согласование РОП (Enterprise)', type: 'main', index: 0 }],
            [{ node: 'Задача: Первичный звонок', type: 'main', index: 0 }],
          ],
        },
        'Согласование РОП (Enterprise)': {
          main: [[{ node: 'DeepSeek AI-скоринг', type: 'main', index: 0 }]],
        },
        'Задача: Первичный звонок': {
          main: [[{ node: 'NATS: Событие маршрутизации', type: 'main', index: 0 }]],
        },
      },
      settings: { executionOrder: 'v1', timezone: 'Europe/Moscow' },
      meta: {
        engine: 'NexusHarness-n8n',
        description: 'Полноценное True/False ветвление в стиле n8n для маршрутизации входящих сделок',
      },
    },
  },
];
