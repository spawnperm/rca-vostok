import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Database,
  FileSpreadsheet,
  Plus,
  Radio,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { formatNatsNotification } from '../../application/nats/natsClient.ts';
import { refineClient } from '../../application/refine/client.ts';
import { useVoiceSectionAction } from '../../application/voice/voiceActionBus.ts';
import type { AuthenticatedActor, TenantContext } from '../../domain/shared/types.ts';
import { formatCurrencyRub, getErrorMessage } from '../../shared/formatters.ts';
import { DashboardWidgetsBoard } from '../components/DashboardWidgetsBoard.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import { StatCard } from '../components/ui/StatCard.tsx';
import type { DealItem, PortalSectionId, StageItem, TaskItem } from '../types.ts';

interface NatsEvent {
  id: string;
  tenantId: string;
  subject: string;
  actorId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface CmsBlock {
  id: string;
  title: string;
  sectionType: string;
  body: string;
  ctaLabel: string;
  published: boolean;
}

interface DashboardViewProps {
  actor: AuthenticatedActor;
  tenant: TenantContext;
  onNavigate: (tab: PortalSectionId) => void;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  actor,
  tenant,
  onNavigate,
  onNotify,
}) => {
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [stages, setStages] = useState<StageItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [events, setEvents] = useState<NatsEvent[]>([]);
  const [blocks, setBlocks] = useState<CmsBlock[]>([]);
  const [pluginsCount, setPluginsCount] = useState(0);
  const [pinnedCollections, setPinnedCollections] = useState<
    Array<{ key: string; title: string; recordsCount: number; defaultView: string }>
  >([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [loading, setLoading] = useState(true);

  const canReadDeals = refineClient.can(actor, 'deals:read');
  const canWriteDeals = refineClient.can(actor, 'deals:write');
  const canReadTasks = refineClient.can(actor, 'tasks:read');
  const canToggleTasks = refineClient.can(actor, 'tasks:write');
  const canReadPlugins = refineClient.can(actor, 'plugins:read');
  const canReadCollections = refineClient.can(actor, 'collections:read') || canReadDeals;
  const canReadWorkflows =
    refineClient.can(actor, 'workflows:read') ||
    refineClient.can(actor, 'harness:execute') ||
    canReadDeals;
  const canEditCms =
    refineClient.can(actor, 'cms:edit') || refineClient.can(actor, 'tenants:admin');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [dealsRes, tasksRes, natsRes, cmsRes, mktRes, colRes, aprRes] = await Promise.allSettled([
        canReadDeals
          ? refineClient.request<{ deals: DealItem[]; stages: StageItem[] }>('/api/crm/deals')
          : Promise.resolve({ deals: [] as DealItem[], stages: [] as StageItem[] }),
        canReadTasks
          ? refineClient.request<{ tasks: TaskItem[] }>('/api/crm/tasks')
          : Promise.resolve({ tasks: [] as TaskItem[] }),
        refineClient.request<{ events: NatsEvent[] }>('/api/nats/events'),
        refineClient.request<{ blocks: CmsBlock[] }>('/api/cms/blocks'),
        canReadPlugins
          ? refineClient.request<{ plugins: Array<{ installed: boolean; enabled: boolean }> }>(
              '/api/marketplace/plugins'
            )
          : Promise.resolve({ plugins: [] as Array<{ installed: boolean; enabled: boolean }> }),
        canReadCollections
          ? refineClient.request<{
              collections: Array<{
                key: string;
                title: string;
                recordsCount: number;
                defaultView: string;
                pinnedToDashboard: boolean;
              }>;
            }>('/api/nocobase/collections')
          : Promise.resolve({
              collections: [] as Array<{
                key: string;
                title: string;
                recordsCount: number;
                defaultView: string;
                pinnedToDashboard: boolean;
              }>,
            }),
        canReadWorkflows
          ? refineClient.request<{ approvals: Array<{ status: string }> }>('/api/nocobase/approvals')
          : Promise.resolve({ approvals: [] as Array<{ status: string }> }),
      ]);

      if (dealsRes.status === 'fulfilled') {
        setDeals(dealsRes.value.deals || []);
        setStages(dealsRes.value.stages || []);
      }
      if (tasksRes.status === 'fulfilled') {
        setTasks(tasksRes.value.tasks || []);
      }
      if (natsRes.status === 'fulfilled') {
        setEvents((natsRes.value.events || []).slice(0, 8));
      }
      if (cmsRes.status === 'fulfilled') {
        setBlocks((cmsRes.value.blocks || []).filter((b) => b.published));
      }
      if (mktRes.status === 'fulfilled') {
        setPluginsCount((mktRes.value.plugins || []).filter((p) => p.installed && p.enabled).length);
      }
      if (colRes.status === 'fulfilled') {
        setPinnedCollections((colRes.value.collections || []).filter((c) => c.pinnedToDashboard));
      }
      if (aprRes.status === 'fulfilled') {
        setPendingApprovals((aprRes.value.approvals || []).filter((a) => a.status === 'pending').length);
      }
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка загрузки рабочего стола'), 'err');
    } finally {
      setLoading(false);
    }
  }, [
    canReadDeals,
    canReadTasks,
    canReadPlugins,
    canReadCollections,
    canReadWorkflows,
    onNotify,
  ]);

  useEffect(() => {
    void loadDashboard();
  }, [tenant.id, actor.userId, loadDashboard]);

  useVoiceSectionAction('dashboard', (actionId) => {
    if (actionId === 'dashboard.refresh') {
      void loadDashboard();
      return true;
    }
    return false;
  });

  const handleQuickToggleTask = async (taskId: string) => {
    if (!canToggleTasks) {
      onNotify('Нет прав для изменения задачи', 'err');
      return;
    }
    try {
      await refineClient.request(`/api/crm/tasks/${taskId}/toggle`, { method: 'PATCH' });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t)));
      onNotify('Статус задачи обновлён');
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Нет прав для изменения задачи'), 'err');
    }
  };

  const wonStageIds = new Set(stages.filter((s) => s.isWon).map((s) => s.id));
  const lostStageIds = new Set(stages.filter((s) => s.isLost).map((s) => s.id));

  const wonDeals = deals.filter((d) => wonStageIds.has(d.stageId));
  const activeDeals = deals.filter((d) => !wonStageIds.has(d.stageId) && !lostStageIds.has(d.stageId));

  const activeBudget = activeDeals.reduce((sum, d) => sum + d.budget, 0);
  const wonBudget = wonDeals.reduce((sum, d) => sum + d.budget, 0);
  const avgActiveCheck =
    activeDeals.length > 0 ? Math.round(activeBudget / activeDeals.length) : 0;
  const weightedForecast = Math.round(
    activeDeals.reduce((sum, d) => {
      const prob = d.harnessAnalysis?.winProbability ?? 40;
      return sum + (d.budget * prob) / 100;
    }, 0)
  );
  const conversionPct = deals.length > 0 ? Math.round((wonDeals.length / deals.length) * 100) : 0;

  const nowMs = Date.now();
  const openTasks = tasks.filter((t) => !t.completed);
  const overdueTasks = openTasks.filter((t) => new Date(t.dueAt).getTime() < nowMs);

  const stageBreakdown = stages
    .filter((s) => !s.isLost)
    .map((st) => {
      const stDeals = deals.filter((d) => d.stageId === st.id);
      const stBudget = stDeals.reduce((acc, d) => acc + d.budget, 0);
      return { stage: st, count: stDeals.length, budget: stBudget };
    });
  const maxStageBudget = Math.max(1, ...stageBreakdown.map((s) => s.budget));

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Добро пожаловать, ${actor.fullName.split(' ')[0]}`}
        subtitle={`Тенант ${tenant.name} (${tenant.subdomain}.platform.local)${
          canReadPlugins ? ` · Активных плагинов: ${pluginsCount}` : ''
        }`}
        actions={
          <>
            <button
              type="button"
              onClick={() => void loadDashboard()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </button>
            {canWriteDeals && (
              <button
                type="button"
                onClick={() => onNavigate('deals')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                К сделкам
              </button>
            )}
            {(canReadDeals || refineClient.can(actor, 'docs:read')) && (
              <button
                type="button"
                onClick={() => onNavigate('office')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500" />
                Офис и S3
              </button>
            )}
          </>
        }
      />

      {/* Executive KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Активная воронка"
          value={formatCurrencyRub(activeBudget)}
          hint={`${activeDeals.length} в работе · ср. чек ${formatCurrencyRub(avgActiveCheck)}`}
          tone="accent"
          icon={<Briefcase className="h-4 w-4" />}
        />
        <StatCard
          label="Прогноз закрытия (Harness)"
          value={formatCurrencyRub(weightedForecast)}
          hint="Взвешено по AI-вероятности"
          icon={<Sparkles className="h-4 w-4" />}
        />
        <StatCard
          label="Успешно реализовано"
          value={formatCurrencyRub(wonBudget)}
          hint={`Выиграно: ${wonDeals.length} · Конверсия ${conversionPct}%`}
          tone="positive"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Открытые задачи"
          value={openTasks.length}
          hint={overdueTasks.length > 0 ? `Просрочено: ${overdueTasks.length}` : 'Все задачи в графике'}
          tone={overdueTasks.length > 0 ? 'danger' : 'default'}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Customizable Drag & Drop Widgets Board (dnd-kit) */}
      <DashboardWidgetsBoard
        tenantId={tenant.id}
        userId={actor.userId}
        deals={deals}
        stages={stages}
        tasks={tasks}
        events={events}
        onToggleTask={handleQuickToggleTask}
        onNavigate={onNavigate}
        onNotify={onNotify}
      />

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Pipeline Funnel Breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Распределение воронки по этапам</h3>
              <p className="text-xs text-slate-500">Объём бюджета и количество сделок на каждом этапе</p>
            </div>
            {canReadDeals && (
              <button
                type="button"
                onClick={() => onNavigate('deals')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#0077FF] hover:underline whitespace-nowrap"
              >
                К воронке <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {loading && stages.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">Загрузка этапов...</div>
            ) : stageBreakdown.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                {canReadDeals
                  ? 'Этапы воронки пока не настроены'
                  : 'Нет доступа к просмотру воронки сделок'}
              </div>
            ) : (
              stageBreakdown.map(({ stage, count, budget }) => {
                const widthPct = Math.max(4, Math.round((budget / maxStageBudget) * 100));
                return (
                  <div key={stage.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-medium text-slate-800">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </span>
                      <span className="text-slate-600 tabular-nums">
                        {count} · <strong className="text-slate-900">{formatCurrencyRub(budget)}</strong>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${budget === 0 ? 2 : widthPct}%`,
                          backgroundColor: stage.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Focus Tasks Queue */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Ближайшие задачи</h3>
              <p className="text-xs text-slate-500">Контроль дедлайнов по активным сделкам</p>
            </div>
            {canReadTasks && (
              <button
                type="button"
                onClick={() => onNavigate('tasks')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#0077FF] hover:underline whitespace-nowrap"
              >
                Все задачи <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="mt-3 divide-y divide-slate-100">
            {openTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                {canReadTasks ? 'Все задачи выполнены' : 'Нет доступных задач'}
              </div>
            ) : (
              openTasks.slice(0, 5).map((task) => {
                const isOverdue = new Date(task.dueAt).getTime() < nowMs;
                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-2.5 py-2.5 first:pt-1 last:pb-1"
                  >
                    <button
                      type="button"
                      disabled={!canToggleTasks}
                      onClick={() => void handleQuickToggleTask(task.id)}
                      aria-label="Отметить задачу выполненной"
                      className="mt-0.5 text-slate-300 hover:text-emerald-600 disabled:opacity-40"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => canReadTasks && onNavigate('tasks')}
                        className="block w-full truncate text-left text-xs font-medium text-slate-900 hover:text-[#0077FF]"
                      >
                        {task.title}
                      </button>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className={`tabular-nums ${isOverdue ? 'font-semibold text-red-600' : ''}`}>
                          {new Date(task.dueAt).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {task.dealTitle && (
                          <>
                            <span>·</span>
                            <span className="truncate">{task.dealTitle}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: TinaCMS Playbooks & NATS Live Feed */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">Регламенты и объявления (TinaCMS)</h3>
            {canEditCms && (
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="text-xs font-medium text-[#0077FF] hover:underline whitespace-nowrap"
              >
                Редактор CMS
              </button>
            )}
          </div>
          <div className="mt-2 divide-y divide-slate-100">
            {blocks.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">Опубликованных блоков пока нет</div>
            ) : (
              blocks.slice(0, 3).map((blk) => (
                <div key={blk.id} className="py-3 first:pt-1 last:pb-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">{blk.title}</span>
                    <span className="font-mono text-[10px] uppercase text-slate-400">{blk.sectionType}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{blk.body}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">Последние события NATS JetStream</h3>
            </div>
            {canReadWorkflows && (
              <button
                type="button"
                onClick={() => onNavigate('workflows')}
                className="text-xs font-medium text-[#0077FF] hover:underline whitespace-nowrap"
              >
                Открыть поток
              </button>
            )}
          </div>
          <div className="mt-2 divide-y divide-slate-100">
            {events.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">Событий ещё нет</div>
            ) : (
              events.map((ev) => {
                const formatted = formatNatsNotification(ev);
                return (
                  <div key={ev.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Activity className="h-3.5 w-3.5 shrink-0 text-[#0077FF]" />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-900">{formatted.title}</div>
                        <div className="truncate font-mono text-[11px] text-slate-400">
                          {formatted.detail || ev.subject}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400 tabular-nums">
                      {new Date(ev.createdAt).toLocaleTimeString('ru-RU')}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* NocoBase Pinned Collections & Approvals Row */}
      {(pinnedCollections.length > 0 || pendingApprovals > 0) && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Коллекции данных и согласования (NocoBase)
              </h3>
              <p className="text-xs text-slate-500">
                Закреплённые таблицы, формульные вычисления и очередь согласований
              </p>
            </div>
            <div className="flex items-center gap-3">
              {canReadWorkflows && (
                <button
                  type="button"
                  onClick={() => onNavigate('workflows')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0077FF] hover:underline whitespace-nowrap"
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  Согласования ({pendingApprovals})
                </button>
              )}
              {canReadCollections && (
                <button
                  type="button"
                  onClick={() => onNavigate('collections')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#0077FF] hover:underline whitespace-nowrap"
                >
                  Все коллекции <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pinnedCollections.map((col) => (
              <button
                key={col.key}
                type="button"
                onClick={() => onNavigate('collections')}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-[#0077FF]/60 hover:bg-blue-50/20"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                    <Database className="h-3.5 w-3.5 text-[#0077FF]" />
                    <span className="truncate">{col.title}</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                    {col.key} · {col.defaultView}
                  </div>
                </div>
                <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                  {col.recordsCount}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
