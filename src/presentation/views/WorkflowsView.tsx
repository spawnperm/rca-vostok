import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ClipboardCheck,
  Download,
  History,
  Pause,
  Pencil,
  Play,
  Plus,
  Radio,
  Trash2,
  Workflow,
  XCircle,
} from 'lucide-react';
import { refineClient } from '../../application/refine/client.ts';
import { useNatsQueue } from '../../application/nats/useNatsQueue.ts';
import { useVoiceSectionAction } from '../../application/voice/voiceActionBus.ts';
import { formatDateTimeRu, getErrorMessage } from '../../shared/formatters.ts';
import {
  buildN8nFromLegacyWorkflow,
  type N8nWorkflowDefinition,
} from '../../domain/n8n/workflowDefinition.ts';
import type {
  WorkflowCondition,
  WorkflowNodeDef,
  WorkflowTriggerType,
} from '../../domain/nocobase/entities.ts';
import type { AuthenticatedActor } from '../../domain/shared/types.ts';
import { N8nWorkflowCanvas } from '../components/N8nWorkflowCanvas.tsx';
import { N8nWorkflowEditorModal } from '../components/N8nWorkflowEditorModal.tsx';
import { NatsQueueVisualizer } from '../components/NatsQueueVisualizer.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import type { DealItem } from '../types.ts';

interface WorkflowRow {
  id: string;
  name: string;
  description: string;
  triggerType: WorkflowTriggerType;
  triggerConfig: Record<string, string>;
  condition: WorkflowCondition | null;
  nodes: WorkflowNodeDef[];
  n8nDefinition?: N8nWorkflowDefinition;
  enabled: boolean;
  runsCount: number;
  lastRunAt: string | null;
}

interface WorkflowExecutionRow {
  id: string;
  workflowId: string;
  workflowName: string;
  triggerType: string;
  status: string;
  contextSummary: string;
  stepsLog: Array<{ nodeTitle: string; nodeType?: string; status: string; detail: string }>;
  durationMs: number;
  createdAt: string;
}

interface ApprovalRow {
  id: string;
  title: string;
  entityType: 'deal' | 'collection_record' | 'general';
  entityId: string | null;
  entityLabel: string;
  amount: number;
  requesterId: string;
  requesterName: string;
  requesterAvatar: string;
  approverRoleCode: string;
  status: 'pending' | 'approved' | 'rejected';
  comment: string;
  decisionNote: string;
  decidedByName: string | null;
  decidedAt: string | null;
  createdAt: string;
}

interface WorkflowsViewProps {
  actor: AuthenticatedActor;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
}

type WorkflowsTab = 'workflows' | 'approvals' | 'nats' | 'logs';

const TRIGGER_LABELS: Record<WorkflowTriggerType, string> = {
  'deal.created': 'Создание сделки (CRM)',
  'deal.stage_changed': 'Смена этапа сделки (CRM)',
  'task.completed': 'Завершение задачи (CRM)',
  'record.created': 'Новая запись в коллекции',
  manual: 'Ручной запуск',
};

export const WorkflowsView: React.FC<WorkflowsViewProps> = ({ actor, onNotify }) => {
  const canManageWorkflows = refineClient.can(actor, 'workflows:manage');
  const canDecideApprovals =
    refineClient.can(actor, 'workflows:manage') ||
    refineClient.can(actor, 'deals:write') ||
    refineClient.can(actor, 'tenants:admin');

  const [tab, setTab] = useState<WorkflowsTab>('workflows');
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecutionRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [selectedDealId, setSelectedDealId] = useState('');
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // n8n Workflow Studio Modal
  const [n8nEditorOpen, setN8nEditorOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<{
    id?: string;
    name: string;
    description: string;
    enabled: boolean;
    n8nDefinition: N8nWorkflowDefinition;
  } | null>(null);

  // Create Approval Modal
  const [aprModalOpen, setAprModalOpen] = useState(false);
  const [aprTitle, setAprTitle] = useState('');
  const [aprDealId, setAprDealId] = useState('');
  const [aprAmount, setAprAmount] = useState('250000');
  const [aprRole, setAprRole] = useState('sales_head');
  const [aprComment, setAprComment] = useState('');

  // Decide Approval Modal
  const [decideTarget, setDecideTarget] = useState<ApprovalRow | null>(null);
  const [decideAction, setDecideAction] = useState<'approved' | 'rejected'>('approved');
  const [decideNote, setDecideNote] = useState('');

  // Shared NATS Queue state
  const {
    snapshot: natsSnapshot,
    loading: natsLoading,
    connectionState: natsConnectionState,
    livePaused: natsLivePaused,
    lastPulseAt: natsLastPulseAt,
    refresh: loadNatsQueue,
    togglePause: toggleNatsPause,
    publishEvent: handlePublishNatsEvent,
    replayMessage: handleReplayNatsMessage,
  } = useNatsQueue(actor.tenantId, onNotify);

  const canReadDeals = refineClient.can(actor, 'deals:read');

  const loadAll = useCallback(async () => {
    try {
      const [wfRes, aprRes, dealsRes] = await Promise.all([
        refineClient.request<{ workflows: WorkflowRow[]; executions: WorkflowExecutionRow[] }>(
          '/api/nocobase/workflows'
        ),
        refineClient.request<{ approvals: ApprovalRow[] }>('/api/nocobase/approvals'),
        canReadDeals
          ? refineClient.request<{ deals: DealItem[] }>('/api/crm/deals')
          : Promise.resolve({ deals: [] }),
      ]);
      setWorkflows(wfRes.workflows);
      setExecutions(wfRes.executions);
      setApprovals(aprRes.approvals);
      const nextDeals = dealsRes.deals || [];
      setDeals(nextDeals);
      if (nextDeals.length > 0) {
        const firstId = nextDeals[0].id;
        setSelectedDealId((prev) => (prev && nextDeals.some((d) => d.id === prev) ? prev : firstId));
        setAprDealId((prev) => (prev && nextDeals.some((d) => d.id === prev) ? prev : firstId));
      }
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка загрузки процессов'), 'err');
    }
  }, [canReadDeals, onNotify]);

  useEffect(() => {
    void loadAll();
  }, [actor.tenantId, loadAll]);

  const handleToggleWorkflow = async (wf: WorkflowRow) => {
    try {
      await refineClient.request(`/api/nocobase/workflows/${wf.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !wf.enabled }),
      });
      await loadAll();
      onNotify(wf.enabled ? 'Процесс поставлен на паузу' : 'Процесс активирован');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка переключения процесса', 'err');
    }
  };

  const handleRunWorkflow = async (wf: WorkflowRow) => {
    try {
      const res = await refineClient.request<{ executed: boolean; reason?: string }>(
        `/api/nocobase/workflows/${wf.id}/trigger`,
        {
          method: 'POST',
          body: JSON.stringify({ dealId: selectedDealId || undefined }),
        }
      );
      await loadAll();
      if (res.executed) {
        onNotify(`Процесс «${wf.name}» выполнен`);
      } else {
        onNotify(res.reason || 'Условие ветвления не сработало', 'err');
      }
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка запуска процесса', 'err');
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    try {
      await refineClient.request(`/api/nocobase/workflows/${id}`, { method: 'DELETE' });
      await loadAll();
      onNotify('Процесс удалён');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка удаления процесса', 'err');
    }
  };

  const resolveN8nDefinition = useCallback((wf: WorkflowRow): N8nWorkflowDefinition => {
    if (wf.n8nDefinition) return wf.n8nDefinition;
    return buildN8nFromLegacyWorkflow({
      name: wf.name,
      description: wf.description,
      triggerType: wf.triggerType,
      triggerConfig: wf.triggerConfig,
      condition: wf.condition,
      nodes: wf.nodes,
      enabled: wf.enabled,
    });
  }, []);

  const handleOpenCreateN8n = () => {
    setEditingWorkflow(null);
    setN8nEditorOpen(true);
  };

  useVoiceSectionAction('workflows', (actionId) => {
    switch (actionId) {
      case 'workflows.create_workflow':
        if (!canManageWorkflows) return false;
        setTab('workflows');
        handleOpenCreateN8n();
        return true;
      case 'workflows.create_approval':
        if (!canDecideApprovals) return false;
        setTab('approvals');
        setAprModalOpen(true);
        return true;
      case 'workflows.tab_workflows':
        setTab('workflows');
        return true;
      case 'workflows.tab_approvals':
        setTab('approvals');
        return true;
      case 'workflows.tab_nats':
        setTab('nats');
        return true;
      case 'workflows.refresh':
        void loadAll();
        void loadNatsQueue();
        return true;
      default:
        return false;
    }
  });

  const handleOpenEditN8n = (wf: WorkflowRow) => {
    setEditingWorkflow({
      id: wf.id,
      name: wf.name,
      description: wf.description,
      enabled: wf.enabled,
      n8nDefinition: resolveN8nDefinition(wf),
    });
    setN8nEditorOpen(true);
  };

  const handleExportN8nJson = async (wf: WorkflowRow) => {
    try {
      const n8nJson = await refineClient.request<N8nWorkflowDefinition>(
        `/api/nocobase/workflows/${wf.id}/n8n.json`
      );
      refineClient.downloadJson(
        n8nJson,
        `${wf.name.toLowerCase().replace(/[^a-z0-9а-яё_-]+/gi, '-')}.n8n.json`
      );
      onNotify(`Схема ${wf.name} экспортирована в .n8n.json`);
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка экспорта n8n JSON'), 'err');
    }
  };

  const handleSaveN8nWorkflow = async (payload: {
    workflowId?: string;
    n8nDefinition: N8nWorkflowDefinition;
  }) => {
    if (payload.workflowId) {
      await refineClient.request(`/api/nocobase/workflows/${payload.workflowId}`, {
        method: 'PATCH',
        body: JSON.stringify({ n8nDefinition: payload.n8nDefinition }),
      });
      await loadAll();
      onNotify(`n8n-процесс «${payload.n8nDefinition.name}» обновлён`);
    } else {
      await refineClient.request('/api/nocobase/workflows', {
        method: 'POST',
        body: JSON.stringify({ n8nDefinition: payload.n8nDefinition }),
      });
      await loadAll();
      onNotify(`Новый n8n-процесс «${payload.n8nDefinition.name}» создан`);
    }
  };

  const handleCreateApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    const linkedDeal = deals.find((d) => d.id === aprDealId);
    try {
      await refineClient.request('/api/nocobase/approvals', {
        method: 'POST',
        body: JSON.stringify({
          title: aprTitle,
          entityType: linkedDeal ? 'deal' : 'general',
          entityId: linkedDeal ? linkedDeal.id : null,
          entityLabel: linkedDeal ? linkedDeal.title : 'Общий запрос',
          amount: Number(aprAmount) || 0,
          approverRoleCode: aprRole,
          comment: aprComment,
        }),
      });
      setAprModalOpen(false);
      setAprTitle('');
      setAprComment('');
      await loadAll();
      onNotify('Запрос на согласование отправлен');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка создания согласования', 'err');
    }
  };

  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decideTarget) return;
    try {
      await refineClient.request(`/api/nocobase/approvals/${decideTarget.id}/decide`, {
        method: 'PATCH',
        body: JSON.stringify({ decision: decideAction, decisionNote: decideNote }),
      });
      setDecideTarget(null);
      setDecideNote('');
      await loadAll();
      onNotify(decideAction === 'approved' ? 'Запрос согласован' : 'Запрос отклонён');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка принятия решения', 'err');
    }
  };

  const pendingApprovalsCount = useMemo(
    () => approvals.filter((a) => a.status === 'pending').length,
    [approvals]
  );

  const filteredApprovals = useMemo(() => {
    if (approvalFilter === 'all') return approvals;
    return approvals.filter((a) => a.status === approvalFilter);
  }, [approvals, approvalFilter]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Процессы и согласования (n8n Workflows)"
        subtitle="Описание и исполнение процессов в формате n8n: визуальный граф узлов, IF True/False ветвления, NATS JetStream и центр согласований"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  ['workflows', `Процессы (${workflows.length})`, <Workflow key="w" className="h-3.5 w-3.5" />],
                  [
                    'approvals',
                    `Согласования (${pendingApprovalsCount})`,
                    <ClipboardCheck key="a" className="h-3.5 w-3.5" />,
                  ],
                  [
                    'nats',
                    `Очередь NATS (${natsSnapshot?.stats.bufferSize ?? 0})`,
                    <Radio key="n" className="h-3.5 w-3.5" />,
                  ],
                  ['logs', `Журнал (${executions.length})`, <History key="l" className="h-3.5 w-3.5" />],
                ] as const
              ).map(([id, label, icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    tab === id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>

            {tab === 'workflows' && canManageWorkflows && (
              <button
                type="button"
                onClick={handleOpenCreateN8n}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" /> Новый процесс n8n
              </button>
            )}
            {tab === 'approvals' && (
              <button
                type="button"
                onClick={() => setAprModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" /> Запросить согласование
              </button>
            )}
          </div>
        }
      />

      {/* Live NATS Queue Compact Strip on Workflows / Approvals / Logs */}
      {tab !== 'nats' && (
        <NatsQueueVisualizer
          actor={actor}
          mode="compact"
          snapshot={natsSnapshot}
          connectionState={natsConnectionState}
          loading={natsLoading}
          livePaused={natsLivePaused}
          lastPulseAt={natsLastPulseAt}
          onTogglePause={toggleNatsPause}
          onRefresh={loadNatsQueue}
          onPublishEvent={handlePublishNatsEvent}
          onReplayMessage={handleReplayNatsMessage}
          onOpenFull={() => setTab('nats')}
        />
      )}

      {/* TAB 1: WORKFLOWS */}
      {tab === 'workflows' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs">
            <span className="text-slate-600">
              Сделка для тестового запуска сценария (проверка условий и узлов):
            </span>
            <select
              value={selectedDealId}
              onChange={(e) => setSelectedDealId(e.target.value)}
              className="max-w-xs rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 outline-none"
            >
              <option value="">Без привязки к сделке</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.budget.toLocaleString('ru-RU')} ₽)
                </option>
              ))}
            </select>
          </div>

          {workflows.length === 0 ? (
            <EmptyState
              icon={<Workflow className="h-8 w-8" />}
              title="Нет настроенных процессов"
              description="Создайте первый триггерный процесс автоматизации для сделок или коллекций."
            />
          ) : (
            <div className="space-y-3">
              {workflows.map((wf) => {
                const n8nDef = resolveN8nDefinition(wf);
                return (
                  <div key={wf.id} className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono text-[11px] font-semibold text-[#0077FF]">
                            n8n · {n8nDef.nodes.length} узл.
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-semibold text-slate-700">
                            {TRIGGER_LABELS[wf.triggerType]}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-medium ${
                              wf.enabled ? 'text-emerald-700' : 'text-slate-400'
                            }`}
                          >
                            {wf.enabled ? 'Активен' : 'На паузе'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">Запусков: {wf.runsCount}</span>
                        </div>
                        <h3 className="mt-1 text-sm font-semibold text-slate-900">{wf.name}</h3>
                        {wf.description && (
                          <p className="mt-0.5 text-xs text-slate-600">{wf.description}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleRunWorkflow(wf)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
                        >
                          <Play className="h-3.5 w-3.5" /> Тест
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleExportN8nJson(wf)}
                          title="Скачать стандартный файл n8n JSON"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <Download className="h-3.5 w-3.5" /> .n8n.json
                        </button>
                        {canManageWorkflows && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditN8n(wf)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-[#0077FF] hover:text-[#0077FF] whitespace-nowrap"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Редактор n8n
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleWorkflow(wf)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                            >
                              {wf.enabled ? (
                                <>
                                  <Pause className="h-3.5 w-3.5" /> Пауза
                                </>
                              ) : (
                                <>
                                  <Play className="h-3.5 w-3.5" /> Вкл
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteWorkflow(wf.id)}
                              title="Удалить процесс"
                              className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:border-red-200 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Visual n8n Node Graph */}
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <N8nWorkflowCanvas
                        definition={n8nDef}
                        compact
                        onSelectNode={canManageWorkflows ? () => handleOpenEditN8n(wf) : undefined}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: APPROVALS CENTER */}
      {tab === 'approvals' && (
        <div className="space-y-4">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit">
            {(
              [
                ['all', 'Все'],
                ['pending', 'Ожидают решения'],
                ['approved', 'Согласовано'],
                ['rejected', 'Отклонено'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setApprovalFilter(id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                  approvalFilter === id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filteredApprovals.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="h-8 w-8" />}
              title="Нет согласований"
              description="Запросы на согласование появляются автоматически из процессов или при ручной отправке."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="divide-y divide-slate-100">
                {filteredApprovals.map((apr) => {
                  const statusText =
                    apr.status === 'pending'
                      ? 'Ожидает согласования'
                      : apr.status === 'approved'
                      ? 'Согласовано'
                      : 'Отклонено';
                  const statusTone =
                    apr.status === 'pending'
                      ? 'text-amber-700'
                      : apr.status === 'approved'
                      ? 'text-emerald-700'
                      : 'text-red-600';

                  return (
                    <div
                      key={apr.id}
                      className="flex flex-wrap items-start justify-between gap-4 p-4 hover:bg-slate-50/70"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className={`font-semibold ${statusTone}`}>{statusText}</span>
                          <span aria-hidden="true">·</span>
                          <span>Инициатор: {apr.requesterName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">Роль: {apr.approverRoleCode}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{formatDateTimeRu(apr.createdAt)}</span>
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{apr.title}</div>
                        <div className="mt-0.5 text-xs text-slate-600">{apr.comment}</div>
                        {apr.decisionNote && (
                          <div className="mt-1.5 text-xs text-slate-700">
                            Решение ({apr.decidedByName}): <span className="font-medium">{apr.decisionNote}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {apr.amount > 0 && (
                          <div className="text-right font-mono text-sm font-bold text-slate-900 tabular-nums">
                            {apr.amount.toLocaleString('ru-RU')} ₽
                          </div>
                        )}

                        {apr.status === 'pending' && canDecideApprovals && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setDecideTarget(apr);
                                setDecideAction('approved');
                                setDecideNote('');
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 whitespace-nowrap"
                            >
                              <Check className="h-3.5 w-3.5" /> Согласовать
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDecideTarget(apr);
                                setDecideAction('rejected');
                                setDecideNote('');
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 whitespace-nowrap"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Отклонить
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: NATS QUEUE VISUALIZER */}
      {tab === 'nats' && (
        <NatsQueueVisualizer
          actor={actor}
          mode="full"
          snapshot={natsSnapshot}
          connectionState={natsConnectionState}
          loading={natsLoading}
          livePaused={natsLivePaused}
          lastPulseAt={natsLastPulseAt}
          onTogglePause={toggleNatsPause}
          onRefresh={loadNatsQueue}
          onPublishEvent={handlePublishNatsEvent}
          onReplayMessage={handleReplayNatsMessage}
        />
      )}

      {/* TAB 4: EXECUTION LOGS */}
      {tab === 'logs' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-slate-900">
              Журнал выполнений n8n Workflows ({executions.length})
            </h3>
          </div>
          {executions.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Процессы ещё не запускались
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {executions.map((ex) => (
                <div key={ex.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>{ex.workflowName}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 tabular-nums">
                      <span>{ex.triggerType}</span>
                      <span>·</span>
                      <span className="text-emerald-700">{ex.durationMs} мс</span>
                      <span>·</span>
                      <span>{new Date(ex.createdAt).toLocaleTimeString('ru-RU')}</span>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-slate-600">{ex.contextSummary}</div>
                  <div className="mt-2.5 grid grid-cols-1 gap-2 border-t border-slate-100 pt-2.5 sm:grid-cols-3">
                    {ex.stepsLog.map((st, idx) => (
                      <div key={idx} className="border-l-2 border-slate-200 pl-2.5 text-[11px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-slate-900">{st.nodeTitle}</span>
                          {st.nodeType && (
                            <span className="shrink-0 font-mono text-[10px] text-slate-400">
                              {st.nodeType.replace('n8n-nodes-', '')}
                            </span>
                          )}
                        </div>
                        <div className="truncate text-slate-500">{st.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* n8n Workflow Studio Modal */}
      <N8nWorkflowEditorModal
        open={n8nEditorOpen}
        initialWorkflow={editingWorkflow}
        onClose={() => {
          setN8nEditorOpen(false);
          setEditingWorkflow(null);
        }}
        onSave={handleSaveN8nWorkflow}
      />

      {/* Create Approval Modal */}
      <Modal
        open={aprModalOpen}
        onClose={() => setAprModalOpen(false)}
        title="Новый запрос на согласование"
      >
        <form onSubmit={handleCreateApproval} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Тема согласования</label>
            <input
              required
              value={aprTitle}
              onChange={(e) => setAprTitle(e.target.value)}
              placeholder="Скидка 12% по годовому контракту"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Связанная сделка</label>
            <select
              value={aprDealId}
              onChange={(e) => setAprDealId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
            >
              <option value="">Без привязки</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Сумма ₽</label>
              <input
                type="number"
                min={0}
                value={aprAmount}
                onChange={(e) => setAprAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Согласующая роль</label>
              <select
                value={aprRole}
                onChange={(e) => setAprRole(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
              >
                <option value="sales_head">РОП (sales_head)</option>
                <option value="portal_superadmin">SuperAdmin (portal_superadmin)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Обоснование</label>
            <textarea
              rows={3}
              value={aprComment}
              onChange={(e) => setAprComment(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAprModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Отправить
            </button>
          </div>
        </form>
      </Modal>

      {/* Decide Approval Modal */}
      <Modal
        open={Boolean(decideTarget)}
        onClose={() => setDecideTarget(null)}
        title={decideAction === 'approved' ? 'Согласовать запрос' : 'Отклонить запрос'}
      >
        <form onSubmit={handleSubmitDecision} className="space-y-3">
          <div className="text-xs font-semibold text-slate-900">{decideTarget?.title}</div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Комментарий к решению
            </label>
            <textarea
              rows={3}
              value={decideNote}
              onChange={(e) => setDecideNote(e.target.value)}
              placeholder="Укажите комментарий или условия согласования..."
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDecideTarget(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              className={`rounded-lg px-4 py-2 text-xs font-medium text-white ${
                decideAction === 'approved'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {decideAction === 'approved' ? 'Подтвердить согласование' : 'Отклонить'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
