import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Download,
  LayoutGrid,
  Plus,
  Sparkles,
  Trash2,
  Workflow,
} from 'lucide-react';
import { refineClient } from '../../application/refine/client.ts';
import {
  isN8nTriggerType,
  N8N_NODE_TEMPLATES,
  N8N_PRESET_TEMPLATES,
  N8nWorkflowDefinitionSchema,
  type N8nConnections,
  type N8nNode,
  type N8nWorkflowDefinition,
} from '../../domain/n8n/workflowDefinition.ts';
import { N8nWorkflowCanvas } from './N8nWorkflowCanvas.tsx';
import { Modal } from './ui/Modal.tsx';

interface N8nWorkflowEditorModalProps {
  open: boolean;
  initialWorkflow: {
    id?: string;
    name: string;
    description: string;
    enabled: boolean;
    n8nDefinition: N8nWorkflowDefinition;
  } | null;
  onClose: () => void;
  onSave: (payload: { workflowId?: string; n8nDefinition: N8nWorkflowDefinition }) => Promise<void>;
}

const DEFAULT_N8N_WORKFLOW: N8nWorkflowDefinition = {
  name: 'Новый n8n-процесс автоматизации',
  active: true,
  nodes: [
    {
      id: 'n8n_trigger_1',
      name: 'CRM: Создание сделки',
      type: 'n8n-nodes-crm.dealCreatedTrigger',
      typeVersion: 1,
      position: [40, 120],
      parameters: { event: 'deal.created' },
    },
    {
      id: 'n8n_if_1',
      name: 'IF: Бюджет >= 500 000',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [310, 120],
      parameters: {
        field: 'budget',
        operator: 'gte',
        value: '500000',
        conditions: {
          combinator: 'and',
          conditions: [
            {
              leftValue: '={{ $json.budget }}',
              rightValue: '500000',
              operator: { type: 'number', operation: 'largerEqual' },
            },
          ],
        },
      },
    },
    {
      id: 'n8n_task_1',
      name: 'CRM: Проверить условия сделки',
      type: 'n8n-nodes-crm.createTask',
      typeVersion: 1,
      position: [600, 40],
      parameters: {
        taskTitle: 'Проверить условия сделки: {{title}}',
        taskType: 'followup',
        dueHours: '24',
      },
    },
    {
      id: 'n8n_nats_1',
      name: 'NATS: Событие процесса',
      type: 'n8n-nodes-nats.publish',
      typeVersion: 1,
      position: [600, 200],
      parameters: { subject: 'workflows.n8n.deal_checked' },
    },
  ],
  connections: {
    'CRM: Создание сделки': {
      main: [[{ node: 'IF: Бюджет >= 500 000', type: 'main', index: 0 }]],
    },
    'IF: Бюджет >= 500 000': {
      main: [
        [{ node: 'CRM: Проверить условия сделки', type: 'main', index: 0 }],
        [{ node: 'NATS: Событие процесса', type: 'main', index: 0 }],
      ],
    },
  },
  settings: { executionOrder: 'v1', timezone: 'Europe/Moscow' },
  meta: {
    engine: 'NexusHarness-n8n',
    description: 'Событийный процесс автоматизации на базе схемы n8n',
  },
};

function autoLayoutN8nNodes(def: N8nWorkflowDefinition): N8nWorkflowDefinition {
  const nodes = def.nodes || [];
  if (nodes.length === 0) return def;
  const byName = new Map(nodes.map((n) => [n.name, n]));
  const trigger = nodes.find((n) => isN8nTriggerType(n.type)) || nodes[0];

  const depth = new Map<string, number>([[trigger.name, 0]]);
  const lane = new Map<string, number>([[trigger.name, 0]]);
  const queue: string[] = [trigger.name];
  const visited = new Set<string>([trigger.name]);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const d = depth.get(cur) || 0;
    const baseLane = lane.get(cur) || 0;
    const mainPorts = def.connections?.[cur]?.main || [];
    mainPorts.forEach((targets, portIdx) => {
      (targets || []).forEach((t, idx) => {
        if (!byName.has(t.node) || visited.has(t.node)) return;
        visited.add(t.node);
        depth.set(t.node, d + 1);
        lane.set(t.node, baseLane + portIdx + idx);
        queue.push(t.node);
      });
    });
  }

  let orphanIdx = 0;
  const colCounts = new Map<number, number>();
  const laidOut = nodes.map((n) => {
    const col = depth.has(n.name) ? depth.get(n.name)! : 1 + (orphanIdx++ % 2);
    const row = colCounts.get(col) || 0;
    colCounts.set(col, row + 1);
    const yLane = lane.has(n.name) ? lane.get(n.name)! : row;
    return {
      ...n,
      position: [40 + col * 270, 40 + Math.max(row, yLane) * 124] as [number, number],
    };
  });

  return { ...def, nodes: laidOut };
}

export const N8nWorkflowEditorModal: React.FC<N8nWorkflowEditorModalProps> = ({
  open,
  initialWorkflow,
  onClose,
  onSave,
}) => {
  const [editorMode, setEditorMode] = useState<'canvas' | 'json'>('canvas');
  const [draft, setDraft] = useState<N8nWorkflowDefinition>(DEFAULT_N8N_WORKFLOW);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const base = initialWorkflow?.n8nDefinition
      ? structuredClone(initialWorkflow.n8nDefinition)
      : structuredClone(DEFAULT_N8N_WORKFLOW);
    if (initialWorkflow) {
      base.name = initialWorkflow.name;
      base.active = initialWorkflow.enabled;
      base.meta = {
        ...(base.meta || {}),
        engine: 'NexusHarness-n8n',
        description: initialWorkflow.description || (base.meta?.description as string) || '',
      };
    }
    setDraft(base);
    setSelectedNodeId(base.nodes[0]?.id || '');
    setJsonText(JSON.stringify(base, null, 2));
    setJsonError('');
    setEditorMode('canvas');
  }, [open, initialWorkflow]);

  const selectedNode = useMemo(
    () => draft.nodes.find((n) => n.id === selectedNodeId) || draft.nodes[0] || null,
    [draft.nodes, selectedNodeId]
  );

  const syncJsonFromDraft = (next: N8nWorkflowDefinition) => {
    setDraft(next);
    setJsonText(JSON.stringify(next, null, 2));
    setJsonError('');
  };

  const handleRenameNode = (node: N8nNode, nextNameRaw: string) => {
    const oldName = node.name;
    const nextName = nextNameRaw;
    const nextNodes = draft.nodes.map((n) => (n.id === node.id ? { ...n, name: nextName } : n));
    const nextConnections: N8nConnections = {};
    for (const [src, block] of Object.entries(draft.connections || {})) {
      const mappedSrc = src === oldName ? nextName : src;
      nextConnections[mappedSrc] = {
        main: (block.main || []).map((targets) =>
          targets.map((t) => (t.node === oldName ? { ...t, node: nextName } : t))
        ),
      };
    }
    syncJsonFromDraft({ ...draft, nodes: nextNodes, connections: nextConnections });
  };

  const handleUpdateNode = (nodeId: string, updater: (n: N8nNode) => N8nNode) => {
    const nextNodes = draft.nodes.map((n) => (n.id === nodeId ? updater(n) : n));
    syncJsonFromDraft({ ...draft, nodes: nextNodes });
  };

  const handleUpdateIfParam = (
    node: N8nNode,
    patch: Partial<{ field: string; operator: string; value: string }>
  ) => {
    const p = (node.parameters || {}) as Record<string, unknown>;
    const field = patch.field ?? String(p.field || 'budget');
    const operator = patch.operator ?? String(p.operator || 'gte');
    const value = patch.value ?? String(p.value ?? '');
    const opMap: Record<string, string> = {
      eq: 'equals',
      neq: 'notEquals',
      gt: 'larger',
      gte: 'largerEqual',
      lt: 'smaller',
      contains: 'contains',
    };

    handleUpdateNode(node.id, (cur) => ({
      ...cur,
      parameters: {
        ...cur.parameters,
        field,
        operator,
        value,
        conditions: {
          combinator: 'and',
          conditions: [
            {
              leftValue: `={{ $json.${field} }}`,
              rightValue: value,
              operator: {
                type: ['gt', 'gte', 'lt'].includes(operator) ? 'number' : 'string',
                operation: opMap[operator] || 'equals',
              },
            },
          ],
        },
      },
    }));
  };

  const handleSetBranchTarget = (sourceNode: N8nNode, portIndex: number, targetNodeName: string) => {
    const existingMain = [...(draft.connections?.[sourceNode.name]?.main || [])];
    while (existingMain.length <= portIndex) existingMain.push([]);
    existingMain[portIndex] = targetNodeName
      ? [{ node: targetNodeName, type: 'main', index: 0 }]
      : [];

    const nextConnections: N8nConnections = {
      ...(draft.connections || {}),
      [sourceNode.name]: { main: existingMain },
    };
    syncJsonFromDraft({ ...draft, connections: nextConnections });
  };

  const handleAddNodeFromPalette = (templateIdx: number) => {
    const tpl = N8N_NODE_TEMPLATES[templateIdx];
    if (!tpl) return;
    const usedNames = new Set(draft.nodes.map((n) => n.name));
    let name = tpl.defaultName;
    let counter = 2;
    while (usedNames.has(name)) {
      name = `${tpl.defaultName} ${counter++}`;
    }

    const lastNode = draft.nodes[draft.nodes.length - 1];
    const nextPos: [number, number] = lastNode
      ? [lastNode.position[0] + 270, lastNode.position[1]]
      : [80, 120];

    const newNode: N8nNode = {
      id: `n8n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      name,
      type: tpl.type,
      typeVersion: tpl.type === 'n8n-nodes-base.if' ? 2 : 1,
      position: nextPos,
      parameters: structuredClone(tpl.defaultParameters),
    };

    const nextConnections: N8nConnections = { ...(draft.connections || {}) };
    if (lastNode && !nextConnections[lastNode.name]?.main?.[0]?.length) {
      nextConnections[lastNode.name] = {
        main: [[{ node: newNode.name, type: 'main', index: 0 }]],
      };
    }

    syncJsonFromDraft({
      ...draft,
      nodes: [...draft.nodes, newNode],
      connections: nextConnections,
    });
    setSelectedNodeId(newNode.id);
  };

  const handleDeleteNode = (node: N8nNode) => {
    if (draft.nodes.length <= 1) return;
    const nextNodes = draft.nodes.filter((n) => n.id !== node.id);
    const nextConnections: N8nConnections = {};
    for (const [src, block] of Object.entries(draft.connections || {})) {
      if (src === node.name) continue;
      nextConnections[src] = {
        main: (block.main || []).map((targets) => targets.filter((t) => t.node !== node.name)),
      };
    }
    syncJsonFromDraft({ ...draft, nodes: nextNodes, connections: nextConnections });
    setSelectedNodeId(nextNodes[0]?.id || '');
  };

  const handleApplyJson = (): N8nWorkflowDefinition | null => {
    try {
      const parsedRaw = JSON.parse(jsonText);
      const parsed = N8nWorkflowDefinitionSchema.safeParse(parsedRaw);
      if (!parsed.success) {
        setJsonError(parsed.error.issues[0]?.message || 'Некорректная n8n-схема');
        return null;
      }
      setDraft(parsed.data);
      setSelectedNodeId(parsed.data.nodes[0]?.id || '');
      setJsonError('');
      return parsed.data;
    } catch {
      setJsonError('Синтаксическая ошибка JSON');
      return null;
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalDef = draft;
    if (editorMode === 'json') {
      const validated = handleApplyJson();
      if (!validated) return;
      finalDef = validated;
    } else {
      const checked = N8nWorkflowDefinitionSchema.safeParse(draft);
      if (!checked.success) {
        setJsonError(checked.error.issues[0]?.message || 'Проверьте узлы n8n-схемы');
        return;
      }
      finalDef = checked.data;
    }

    setSaving(true);
    try {
      await onSave({
        workflowId: initialWorkflow?.id,
        n8nDefinition: finalDef,
      });
      onClose();
    } catch (err: unknown) {
      setJsonError(err instanceof Error ? err.message : 'Ошибка сохранения n8n-процесса');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(draft, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard denial
    }
  };

  const handleDownloadJson = () => {
    refineClient.downloadJson(
      draft,
      `${(draft.name || 'workflow').toLowerCase().replace(/[^a-z0-9а-яё_-]+/gi, '-')}.n8n.json`
    );
  };

  const description = typeof draft.meta?.description === 'string' ? draft.meta.description : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialWorkflow?.id ? `Конструктор n8n: ${initialWorkflow.name}` : 'Новый процесс n8n'}
      maxWidthClass="max-w-6xl"
    >
      <form onSubmit={handleSave} className="space-y-4">
        {/* Top Metadata & Mode Switch */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-slate-700">Название процесса (n8n)</label>
            <input
              required
              value={draft.name}
              onChange={(e) => syncJsonFromDraft({ ...draft, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
            />
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-slate-700">Описание сценария</label>
            <input
              value={description}
              onChange={(e) =>
                syncJsonFromDraft({
                  ...draft,
                  meta: { ...(draft.meta || {}), engine: 'NexusHarness-n8n', description: e.target.value },
                })
              }
              placeholder="Назначение n8n-графа"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
            />
          </div>
          <div className="md:col-span-4 flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => syncJsonFromDraft({ ...draft, active: e.target.checked })}
                className="h-4 w-4 accent-[#0077FF]"
              />
              Активен
            </label>

            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  if (editorMode === 'json') handleApplyJson();
                  setEditorMode('canvas');
                }}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${
                  editorMode === 'canvas'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Workflow className="h-3.5 w-3.5" /> Граф узлов
              </button>
              <button
                type="button"
                onClick={() => {
                  setJsonText(JSON.stringify(draft, null, 2));
                  setEditorMode('json');
                }}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${
                  editorMode === 'json'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" /> n8n JSON
              </button>
            </div>
          </div>
        </div>

        {/* Starter Presets */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 font-medium text-slate-600">
              <Sparkles className="h-3.5 w-3.5 text-[#0077FF]" /> Шаблоны n8n:
            </span>
            {N8N_PRESET_TEMPLATES.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => {
                  const cloned = structuredClone(preset.workflow);
                  syncJsonFromDraft(cloned);
                  setSelectedNodeId(cloned.nodes[0]?.id || '');
                }}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-[#0077FF] hover:text-[#0077FF]"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => syncJsonFromDraft(autoLayoutN8nNodes(draft))}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              <LayoutGrid className="h-3 w-3" /> Выровнять узлы
            </button>
            <button
              type="button"
              onClick={() => void handleCopyJson()}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Скопировано' : 'Копировать JSON'}
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              <Download className="h-3 w-3" /> .n8n.json
            </button>
          </div>
        </div>

        {/* CANVAS EDITOR MODE */}
        {editorMode === 'canvas' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Left: Canvas + Node Palette */}
            <div className="space-y-3 lg:col-span-8">
              <N8nWorkflowCanvas
                definition={draft}
                selectedNodeId={selectedNode?.id || null}
                onSelectNode={(id) => setSelectedNodeId(id)}
              />

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Добавить узел n8n в схему
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {N8N_NODE_TEMPLATES.map((tpl, idx) => (
                    <button
                      key={tpl.type}
                      type="button"
                      onClick={() => handleAddNodeFromPalette(idx)}
                      title={tpl.description}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:border-[#0077FF] hover:text-[#0077FF]"
                    >
                      <Plus className="h-3 w-3 text-[#0077FF]" />
                      {tpl.defaultName}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Selected Node Inspector */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-4 space-y-3">
              {selectedNode ? (
                <>
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="min-w-0">
                      <div className="font-mono text-[10px] text-[#0077FF] truncate">
                        {selectedNode.type}
                      </div>
                      <h4 className="text-xs font-semibold text-slate-900">Инспектор узла n8n</h4>
                    </div>
                    {draft.nodes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteNode(selectedNode)}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:border-red-200 hover:text-red-600"
                        title="Удалить узел"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700">Название узла</label>
                    <input
                      value={selectedNode.name}
                      onChange={(e) => handleRenameNode(selectedNode, e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-[#0077FF]"
                    />
                  </div>

                  {/* Node-type specific parameters */}
                  {isN8nTriggerType(selectedNode.type) && (
                    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700">
                          Тип триггера n8n
                        </label>
                        <select
                          value={selectedNode.type}
                          onChange={(e) => {
                            const nextType = e.target.value;
                            const eventMap: Record<string, string> = {
                              'n8n-nodes-crm.dealCreatedTrigger': 'deal.created',
                              'n8n-nodes-crm.dealStageChangedTrigger': 'deal.stage_changed',
                              'n8n-nodes-crm.taskCompletedTrigger': 'task.completed',
                              'n8n-nodes-nocobase.recordCreatedTrigger': 'record.created',
                              'n8n-nodes-base.manualTrigger': 'manual',
                              'n8n-nodes-base.webhook': 'manual',
                            };
                            handleUpdateNode(selectedNode.id, (cur) => ({
                              ...cur,
                              type: nextType,
                              parameters: {
                                ...cur.parameters,
                                event: eventMap[nextType] || 'manual',
                              },
                            }));
                          }}
                          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs"
                        >
                          <option value="n8n-nodes-crm.dealCreatedTrigger">CRM: Создание сделки</option>
                          <option value="n8n-nodes-crm.dealStageChangedTrigger">CRM: Смена этапа</option>
                          <option value="n8n-nodes-crm.taskCompletedTrigger">CRM: Завершение задачи</option>
                          <option value="n8n-nodes-nocobase.recordCreatedTrigger">NocoBase: Новая запись</option>
                          <option value="n8n-nodes-base.manualTrigger">Manual Trigger</option>
                          <option value="n8n-nodes-base.webhook">Webhook Trigger</option>
                        </select>
                      </div>
                      {selectedNode.type === 'n8n-nodes-nocobase.recordCreatedTrigger' && (
                        <div>
                          <label className="block text-[11px] font-medium text-slate-700">
                            Ключ коллекции (collectionKey)
                          </label>
                          <input
                            value={String(selectedNode.parameters?.collectionKey || '')}
                            onChange={(e) =>
                              handleUpdateNode(selectedNode.id, (cur) => ({
                                ...cur,
                                parameters: { ...cur.parameters, collectionKey: e.target.value },
                              }))
                            }
                            placeholder="tickets"
                            className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {selectedNode.type === 'n8n-nodes-base.if' && (
                    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-2.5">
                      <div className="text-[11px] font-semibold text-amber-900">
                        Условие ветвления n8n IF
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <input
                          value={String(selectedNode.parameters?.field || 'budget')}
                          onChange={(e) => handleUpdateIfParam(selectedNode, { field: e.target.value })}
                          placeholder="budget"
                          className="rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs"
                        />
                        <select
                          value={String(selectedNode.parameters?.operator || 'gte')}
                          onChange={(e) => handleUpdateIfParam(selectedNode, { operator: e.target.value })}
                          className="rounded border border-slate-200 bg-white px-1.5 py-1 font-mono text-xs"
                        >
                          <option value="gte">&gt;=</option>
                          <option value="gt">&gt;</option>
                          <option value="eq">=</option>
                          <option value="neq">!=</option>
                          <option value="lt">&lt;</option>
                          <option value="contains">содержит</option>
                        </select>
                        <input
                          value={String(selectedNode.parameters?.value ?? '')}
                          onChange={(e) => handleUpdateIfParam(selectedNode, { value: e.target.value })}
                          placeholder="1000000"
                          className="rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'n8n-nodes-crm.createTask' && (
                    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700">Заголовок задачи</label>
                        <input
                          value={String(selectedNode.parameters?.taskTitle || '')}
                          onChange={(e) =>
                            handleUpdateNode(selectedNode.id, (cur) => ({
                              ...cur,
                              parameters: { ...cur.parameters, taskTitle: e.target.value },
                            }))
                          }
                          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-700">Тип</label>
                          <select
                            value={String(selectedNode.parameters?.taskType || 'followup')}
                            onChange={(e) =>
                              handleUpdateNode(selectedNode.id, (cur) => ({
                                ...cur,
                                parameters: { ...cur.parameters, taskType: e.target.value },
                              }))
                            }
                            className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                          >
                            <option value="followup">Follow-up</option>
                            <option value="call">Звонок</option>
                            <option value="meeting">Встреча</option>
                            <option value="dify_ai">Dify AI</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-700">Срок (ч)</label>
                          <input
                            type="number"
                            min={1}
                            value={String(selectedNode.parameters?.dueHours || '24')}
                            onChange={(e) =>
                              handleUpdateNode(selectedNode.id, (cur) => ({
                                ...cur,
                                parameters: { ...cur.parameters, dueHours: e.target.value },
                              }))
                            }
                            className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'n8n-nodes-nocobase.createApproval' && (
                    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700">
                          Согласующая роль
                        </label>
                        <select
                          value={String(selectedNode.parameters?.approverRoleCode || 'sales_head')}
                          onChange={(e) =>
                            handleUpdateNode(selectedNode.id, (cur) => ({
                              ...cur,
                              parameters: { ...cur.parameters, approverRoleCode: e.target.value },
                            }))
                          }
                          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                        >
                          <option value="sales_head">РОП (sales_head)</option>
                          <option value="portal_superadmin">SuperAdmin (portal_superadmin)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700">Комментарий</label>
                        <input
                          value={String(selectedNode.parameters?.comment || '')}
                          onChange={(e) =>
                            handleUpdateNode(selectedNode.id, (cur) => ({
                              ...cur,
                              parameters: { ...cur.parameters, comment: e.target.value },
                            }))
                          }
                          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'n8n-nodes-nats.publish' && (
                    <div className="space-y-1.5 rounded-lg border border-emerald-200 bg-emerald-50/40 p-2.5">
                      <label className="block text-[11px] font-medium text-slate-700">
                        NATS Subject
                      </label>
                      <input
                        value={String(selectedNode.parameters?.subject || '')}
                        onChange={(e) =>
                          handleUpdateNode(selectedNode.id, (cur) => ({
                            ...cur,
                            parameters: { ...cur.parameters, subject: e.target.value },
                          }))
                        }
                        placeholder="workflows.n8n.executed"
                        className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs"
                      />
                    </div>
                  )}

                  {selectedNode.type === 'n8n-nodes-crm.timelineNote' && (
                    <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <label className="block text-[11px] font-medium text-slate-700">
                        Текст заметки в таймлайн
                      </label>
                      <textarea
                        rows={2}
                        value={String(selectedNode.parameters?.body || '')}
                        onChange={(e) =>
                          handleUpdateNode(selectedNode.id, (cur) => ({
                            ...cur,
                            parameters: { ...cur.parameters, body: e.target.value },
                          }))
                        }
                        className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                      />
                    </div>
                  )}

                  {selectedNode.type === 'n8n-nodes-nocobase.updateRecord' && (
                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700">Поле</label>
                        <input
                          value={String(selectedNode.parameters?.field || '')}
                          onChange={(e) =>
                            handleUpdateNode(selectedNode.id, (cur) => ({
                              ...cur,
                              parameters: { ...cur.parameters, field: e.target.value },
                            }))
                          }
                          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700">Значение</label>
                        <input
                          value={String(selectedNode.parameters?.value ?? '')}
                          onChange={(e) =>
                            handleUpdateNode(selectedNode.id, (cur) => ({
                              ...cur,
                              parameters: { ...cur.parameters, value: e.target.value },
                            }))
                          }
                          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* Connections Editor */}
                  <div className="space-y-2 border-t border-slate-100 pt-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Связи (Connections)
                    </div>
                    {selectedNode.type === 'n8n-nodes-base.if' ? (
                      <>
                        <div>
                          <label className="block text-[11px] font-medium text-emerald-700">
                            Ветка TRUE (main[0])
                          </label>
                          <select
                            value={draft.connections?.[selectedNode.name]?.main?.[0]?.[0]?.node || ''}
                            onChange={(e) =>
                              handleSetBranchTarget(selectedNode, 0, e.target.value)
                            }
                            className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs"
                          >
                            <option value="">— Конец ветки —</option>
                            {draft.nodes
                              .filter((n) => n.id !== selectedNode.id)
                              .map((n) => (
                                <option key={n.id} value={n.name}>
                                  {n.name}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-amber-700">
                            Ветка FALSE (main[1])
                          </label>
                          <select
                            value={draft.connections?.[selectedNode.name]?.main?.[1]?.[0]?.node || ''}
                            onChange={(e) =>
                              handleSetBranchTarget(selectedNode, 1, e.target.value)
                            }
                            className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs"
                          >
                            <option value="">— Пропустить при False —</option>
                            {draft.nodes
                              .filter((n) => n.id !== selectedNode.id)
                              .map((n) => (
                                <option key={n.id} value={n.name}>
                                  {n.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      </>
                    ) : (
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700">
                          Следующий узел (main[0])
                        </label>
                        <select
                          value={draft.connections?.[selectedNode.name]?.main?.[0]?.[0]?.node || ''}
                          onChange={(e) => handleSetBranchTarget(selectedNode, 0, e.target.value)}
                          className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs"
                        >
                          <option value="">— Конец цепочки —</option>
                          {draft.nodes
                            .filter((n) => n.id !== selectedNode.id)
                            .map((n) => (
                              <option key={n.id} value={n.name}>
                                {n.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    <label className="flex items-center gap-2 pt-1 text-[11px] text-slate-600">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedNode.disabled)}
                        onChange={(e) =>
                          handleUpdateNode(selectedNode.id, (cur) => ({
                            ...cur,
                            disabled: e.target.checked,
                          }))
                        }
                        className="h-3.5 w-3.5 accent-slate-600"
                      />
                      Отключить узел (disabled)
                    </label>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  Выберите узел на графе для редактирования
                </div>
              )}
            </div>
          </div>
        )}

        {/* RAW n8n JSON MODE */}
        {editorMode === 'json' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Стандартная схема n8n (`nodes`, `connections`, `settings`, `active`). Можно вставить JSON из n8n.
              </span>
              <button
                type="button"
                onClick={() => handleApplyJson()}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-[#0077FF] hover:text-[#0077FF]"
              >
                Проверить и применить JSON
              </button>
            </div>
            <textarea
              rows={16}
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setJsonError('');
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-900 p-3.5 font-mono text-xs text-slate-100 outline-none focus:border-[#0077FF]"
            />
          </div>
        )}

        {jsonError && <div className="text-xs font-medium text-red-600">{jsonError}</div>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить n8n-процесс'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
