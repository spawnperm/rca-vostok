import { z } from 'zod';

export const COLLECTION_FIELD_TYPES = [
  'string',
  'text',
  'number',
  'currency',
  'boolean',
  'date',
  'select',
  'relation',
  'formula',
] as const;

export type CollectionFieldType = (typeof COLLECTION_FIELD_TYPES)[number];

export const CollectionFieldSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(48)
    .regex(/^[a-z][a-z0-9_]*$/, 'Ключ поля должен начинаться с латинской буквы и содержать [a-z0-9_]'),
  label: z.string().trim().min(1, 'Укажите название поля').max(80),
  type: z.enum(COLLECTION_FIELD_TYPES),
  required: z.boolean().default(false),
  visibleInTable: z.boolean().default(true),
  options: z.array(z.string().trim().min(1).max(60)).optional(),
  relationTarget: z.enum(['deals', 'contacts', 'companies']).optional(),
  formulaExpression: z.string().trim().max(200).optional(),
});

export type CollectionFieldDef = z.infer<typeof CollectionFieldSchema>;

export const CollectionViewModeSchema = z.enum(['table', 'kanban', 'calendar']);
export type CollectionViewMode = z.infer<typeof CollectionViewModeSchema>;

export const CreateCollectionSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/, 'Ключ коллекции должен состоять из латиницы, цифр и _'),
  title: z.string().trim().min(2, 'Введите название коллекции').max(80),
  description: z.string().trim().max(280).default(''),
  defaultView: CollectionViewModeSchema.default('table'),
  kanbanGroupBy: z.string().trim().max(48).optional(),
  calendarDateField: z.string().trim().max(48).optional(),
  pinnedToDashboard: z.boolean().default(false),
  fields: z.array(CollectionFieldSchema).min(1, 'Добавьте хотя бы одно поле'),
});

export const UpdateCollectionSchema = z.object({
  title: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(280).optional(),
  defaultView: CollectionViewModeSchema.optional(),
  kanbanGroupBy: z.string().trim().max(48).nullable().optional(),
  calendarDateField: z.string().trim().max(48).nullable().optional(),
  pinnedToDashboard: z.boolean().optional(),
  fields: z.array(CollectionFieldSchema).min(1).optional(),
});

export const UpsertCollectionRecordSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

export const WORKFLOW_TRIGGERS = [
  'deal.created',
  'deal.stage_changed',
  'task.completed',
  'record.created',
  'manual',
] as const;

export type WorkflowTriggerType = (typeof WORKFLOW_TRIGGERS)[number];

export const WORKFLOW_NODE_TYPES = [
  'create_task',
  'timeline_note',
  'create_approval',
  'nats_publish',
  'harness_analyze',
  'update_record',
] as const;

export type WorkflowNodeType = (typeof WORKFLOW_NODE_TYPES)[number];

export const WorkflowConditionSchema = z.object({
  field: z.string().trim().min(1).max(60),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'contains']),
  value: z.string().trim().max(120),
});

export type WorkflowCondition = z.infer<typeof WorkflowConditionSchema>;

export const WorkflowNodeSchema = z.object({
  id: z.string().trim().min(1),
  type: z.enum(WORKFLOW_NODE_TYPES),
  title: z.string().trim().min(1).max(120),
  config: z.record(z.string(), z.string()).default({}),
});

export type WorkflowNodeDef = z.infer<typeof WorkflowNodeSchema>;

export const CreateWorkflowSchema = z.object({
  name: z.string().trim().min(2, 'Укажите название процесса').max(120),
  description: z.string().trim().max(300).default(''),
  triggerType: z.enum(WORKFLOW_TRIGGERS),
  triggerConfig: z.record(z.string(), z.string()).default({}),
  condition: WorkflowConditionSchema.nullable().default(null),
  nodes: z.array(WorkflowNodeSchema).min(1, 'Добавьте хотя бы один узел действия').max(10),
  enabled: z.boolean().default(true),
});

export const UpdateWorkflowSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(300).optional(),
  triggerType: z.enum(WORKFLOW_TRIGGERS).optional(),
  triggerConfig: z.record(z.string(), z.string()).optional(),
  condition: WorkflowConditionSchema.nullable().optional(),
  nodes: z.array(WorkflowNodeSchema).min(1).max(10).optional(),
  enabled: z.boolean().optional(),
});

export const TriggerWorkflowSchema = z.object({
  dealId: z.string().optional(),
  recordId: z.string().optional(),
  collectionKey: z.string().optional(),
});

export const CreateApprovalSchema = z.object({
  title: z.string().trim().min(3, 'Укажите тему согласования').max(140),
  entityType: z.enum(['deal', 'collection_record', 'general']).default('general'),
  entityId: z.string().nullable().optional(),
  entityLabel: z.string().trim().max(140).default(''),
  amount: z.number().min(0).max(1_000_000_000).default(0),
  approverRoleCode: z.string().trim().min(2).max(40).default('sales_head'),
  comment: z.string().trim().max(600).default(''),
});

export const DecideApprovalSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  decisionNote: z.string().trim().max(600).default(''),
});

/**
 * Safe deterministic arithmetic formula evaluator for NocoBase formula fields.
 * Supports `{fieldKey}`, numbers, `+`, `-`, `*`, `/`, parentheses.
 * Never uses `eval` or dynamic code execution.
 */
export function evaluateRecordFormula(
  expression: string,
  recordData: Record<string, unknown>
): number | null {
  if (!expression || !expression.trim()) return null;

  const substituted = expression.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
    const raw = recordData[key];
    const num = typeof raw === 'number' ? raw : Number(String(raw ?? '0').replace(',', '.'));
    return Number.isFinite(num) ? String(num) : '0';
  });

  // Tokenize numbers, operators, and parentheses strictly
  const tokens: string[] = [];
  let i = 0;
  while (i < substituted.length) {
    const ch = substituted[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if ('+-*/()'.includes(ch)) {
      // Handle unary minus at start or after operator/'('
      if (
        ch === '-' &&
        (tokens.length === 0 || ['+', '-', '*', '/', '('].includes(tokens[tokens.length - 1]))
      ) {
        let numStr = '-';
        i += 1;
        while (i < substituted.length && /[0-9.]/.test(substituted[i])) {
          numStr += substituted[i];
          i += 1;
        }
        if (numStr === '-') {
          tokens.push('-1', '*');
        } else {
          tokens.push(numStr);
        }
        continue;
      }
      tokens.push(ch);
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      while (i < substituted.length && /[0-9.]/.test(substituted[i])) {
        numStr += substituted[i];
        i += 1;
      }
      tokens.push(numStr);
      continue;
    }
    return null;
  }

  if (tokens.length === 0) return null;

  let pos = 0;
  function parseExpression(): number | null {
    let left = parseTerm();
    if (left === null) return null;
    while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++];
      const right = parseTerm();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number | null {
    let left = parseFactor();
    if (left === null) return null;
    while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
      const op = tokens[pos++];
      const right = parseFactor();
      if (right === null) return null;
      if (op === '/') {
        if (right === 0) return 0;
        left = left / right;
      } else {
        left = left * right;
      }
    }
    return left;
  }

  function parseFactor(): number | null {
    if (pos >= tokens.length) return null;
    const tok = tokens[pos++];
    if (tok === '(') {
      const val = parseExpression();
      if (val === null || tokens[pos] !== ')') return null;
      pos += 1;
      return val;
    }
    const parsed = Number(tok);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const result = parseExpression();
  if (result === null || pos !== tokens.length || !Number.isFinite(result)) {
    return null;
  }
  return Math.round(result * 100) / 100;
}

export function applyFormulaFields(
  fields: CollectionFieldDef[],
  rawData: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...rawData };
  for (const field of fields) {
    if (field.type === 'formula' && field.formulaExpression) {
      const computed = evaluateRecordFormula(field.formulaExpression, result);
      if (computed !== null) {
        result[field.key] = computed;
      }
    }
  }
  return result;
}
