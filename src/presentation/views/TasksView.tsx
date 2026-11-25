import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, Calendar, CalendarDays, CheckCircle2, Edit3, Plus, Trash2 } from 'lucide-react';
import { toLocalDateTimeInputValue } from '../../application/crm/calendarSync.ts';
import { natsClient } from '../../application/nats/natsClient.ts';
import { refineClient } from '../../application/refine/client.ts';
import { useVoiceSectionAction } from '../../application/voice/voiceActionBus.ts';
import type { AuthenticatedActor } from '../../domain/shared/types.ts';
import { formatDateTimeRu, getErrorMessage, UNIFIED_TASK_TYPE_LABELS } from '../../shared/formatters.ts';
import { VoiceSearchInput } from '../components/crm/VoiceSearchInput.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import type { OwnerOption, TaskItem } from '../types.ts';

interface TasksViewProps {
  actor: AuthenticatedActor;
  onNotify: (msg: string, tone?: 'ok' | 'err' | 'info' | 'warn') => void;
  onOpenCalendar?: () => void;
}

const EDITABLE_TASK_TYPES = ['call', 'meeting', 'followup', 'dify_ai'] as const;

export const TasksView: React.FC<TasksViewProps> = ({ actor, onNotify, onOpenCalendar }) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [dealOptions, setDealOptions] = useState<Array<{ id: string; title: string }>>([]);
  const [assignees, setAssignees] = useState<OwnerOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusTab, setStatusTab] = useState<'all' | 'open' | 'overdue' | 'completed'>('open');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'due_asc' | 'due_desc'>('due_asc');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [tTitle, setTTitle] = useState('');
  const [tType, setTType] = useState<(typeof EDITABLE_TASK_TYPES)[number]>('call');
  const [tDealId, setTDealId] = useState('');
  const [tAssigneeId, setTAssigneeId] = useState('');
  const [tDue, setTDue] = useState(() =>
    toLocalDateTimeInputValue(new Date(Date.now() + 86400000).toISOString())
  );
  const [tReminderPreset, setTReminderPreset] = useState<'none' | 'at_due' | '15m' | '60m' | 'custom'>('15m');
  const [tReminderCustom, setTReminderCustom] = useState('');
  const [checkingDeadlines, setCheckingDeadlines] = useState(false);
  const [remindingTaskId, setRemindingTaskId] = useState<string | null>(null);

  const canWrite = refineClient.can(actor, 'tasks:write');

  const loadTasks = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await refineClient.request<{
          tasks: TaskItem[];
          deals: Array<{ id: string; title: string }>;
          assignees: OwnerOption[];
        }>('/api/crm/tasks');
        setTasks(data.tasks);
        setDealOptions(data.deals || []);
        setAssignees(data.assignees || []);
      } catch (err: unknown) {
        onNotify(getErrorMessage(err, 'Ошибка загрузки задач'), 'err');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [onNotify]
  );

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    const unsubscribe = natsClient.subscribe('crm.*.task.*', () => {
      void loadTasks(true);
    });
    return () => unsubscribe();
  }, [loadTasks]);

  const openTaskModal = (task?: TaskItem) => {
    setEditingTask(task || null);
    setTTitle(task?.title || '');
    setTType(
      EDITABLE_TASK_TYPES.includes(task?.taskType as (typeof EDITABLE_TASK_TYPES)[number])
        ? (task?.taskType as (typeof EDITABLE_TASK_TYPES)[number])
        : 'call'
    );
    setTDealId(task?.dealId || '');
    setTAssigneeId(task?.assigneeId || actor.userId);
    const dueIso = task ? task.dueAt : new Date(Date.now() + 86400000).toISOString();
    setTDue(toLocalDateTimeInputValue(dueIso));

    if (task?.reminderAt) {
      const diffMin = Math.round(
        (new Date(task.dueAt).getTime() - new Date(task.reminderAt).getTime()) / 60000
      );
      if (Math.abs(diffMin) <= 1) {
        setTReminderPreset('at_due');
      } else if (Math.abs(diffMin - 15) <= 1) {
        setTReminderPreset('15m');
      } else if (Math.abs(diffMin - 60) <= 1) {
        setTReminderPreset('60m');
      } else {
        setTReminderPreset('custom');
      }
      setTReminderCustom(toLocalDateTimeInputValue(task.reminderAt));
    } else {
      setTReminderPreset(task ? 'none' : '15m');
      setTReminderCustom(toLocalDateTimeInputValue(dueIso));
    }
    setModalOpen(true);
  };

  useVoiceSectionAction('tasks', (actionId) => {
    switch (actionId) {
      case 'tasks.create_task':
        if (!canWrite) return false;
        openTaskModal();
        return true;
      case 'tasks.filter_open':
        setStatusTab('open');
        return true;
      case 'tasks.filter_overdue':
        setStatusTab('overdue');
        return true;
      case 'tasks.filter_completed':
        setStatusTab('completed');
        return true;
      case 'tasks.filter_all':
        setStatusTab('all');
        return true;
      case 'tasks.refresh':
        void loadTasks();
        return true;
      default:
        return false;
    }
  });

  const computeReminderIso = (): string | null => {
    const dueMs = new Date(tDue).getTime();
    if (!Number.isFinite(dueMs)) return null;
    if (tReminderPreset === 'none') return null;
    if (tReminderPreset === 'at_due') return new Date(dueMs).toISOString();
    if (tReminderPreset === '15m') return new Date(dueMs - 15 * 60000).toISOString();
    if (tReminderPreset === '60m') return new Date(dueMs - 60 * 60000).toISOString();
    if (tReminderPreset === 'custom' && tReminderCustom) {
      const customMs = new Date(tReminderCustom).getTime();
      return Number.isFinite(customMs) ? new Date(customMs).toISOString() : null;
    }
    return null;
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        title: tTitle,
        taskType: tType,
        dealId: tDealId || null,
        assigneeId: tAssigneeId || actor.userId,
        dueAt: new Date(tDue).toISOString(),
        reminderAt: computeReminderIso(),
      };
      if (editingTask) {
        await refineClient.update('crm/tasks', editingTask.id, payload);
        onNotify('Задача обновлена');
      } else {
        await refineClient.create('crm/tasks', payload);
        onNotify('Задача создана');
      }
      setModalOpen(false);
      await loadTasks();
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка сохранения задачи'), 'err');
    }
  };

  const handleCheckDeadlinesNats = async () => {
    setCheckingDeadlines(true);
    try {
      const res = await refineClient.request<{
        checkedCount: number;
        remindersPublished: number;
        deadlinesPublished: number;
      }>('/api/crm/tasks/check-deadlines', { method: 'POST' });
      const totalPushed = res.remindersPublished + res.deadlinesPublished;
      if (totalPushed === 0) {
        onNotify('Новых сработавших дедлайнов и напоминаний нет', 'info');
      }
      await loadTasks(true);
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка проверки дедлайнов NATS'), 'err');
    } finally {
      setCheckingDeadlines(false);
    }
  };

  const handleSendManualReminder = async (task: TaskItem) => {
    if (!canWrite) return;
    setRemindingTaskId(task.id);
    try {
      await refineClient.request(`/api/crm/tasks/${task.id}/remind`, { method: 'POST' });
      await loadTasks(true);
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Не удалось отправить напоминание в NATS'), 'err');
    } finally {
      setRemindingTaskId(null);
    }
  };

  const handleToggleTask = async (id: string) => {
    try {
      await refineClient.request(`/api/crm/tasks/${id}/toggle`, { method: 'PATCH' });
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Нет прав для изменения задачи'), 'err');
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await refineClient.deleteOne('crm/tasks', id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      onNotify('Задача удалена');
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка удаления задачи'), 'err');
    }
  };

  const nowMs = Date.now();
  const counts = useMemo(() => {
    const open = tasks.filter((t) => !t.completed);
    const overdue = open.filter((t) => new Date(t.dueAt).getTime() < nowMs);
    const completed = tasks.filter((t) => t.completed);
    return { all: tasks.length, open: open.length, overdue: overdue.length, completed: completed.length };
  }, [tasks, nowMs]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = tasks.filter((t) => {
      const isOverdue = !t.completed && new Date(t.dueAt).getTime() < nowMs;
      if (statusTab === 'open' && t.completed) return false;
      if (statusTab === 'overdue' && !isOverdue) return false;
      if (statusTab === 'completed' && !t.completed) return false;
      if (typeFilter !== 'all' && t.taskType !== typeFilter) return false;
      if (assigneeFilter !== 'all' && t.assigneeId !== assigneeFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.dealTitle || '').toLowerCase().includes(q) ||
        t.assigneeName.toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => {
      const ta = new Date(a.dueAt).getTime();
      const tb = new Date(b.dueAt).getTime();
      return sortOrder === 'due_asc' ? ta - tb : tb - ta;
    });
  }, [tasks, statusTab, typeFilter, assigneeFilter, sortOrder, search, nowMs]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Задачи и планер CRM"
        subtitle={`Открытых: ${counts.open} · Просроченных: ${counts.overdue} · Выполнено: ${counts.completed}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={checkingDeadlines}
              onClick={() => void handleCheckDeadlinesNats()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 whitespace-nowrap"
              title="Проверить дедлайны и отправить NATS push-уведомления"
            >
              <BellRing className="h-3.5 w-3.5 text-amber-600" />
              {checkingDeadlines ? 'Проверка...' : 'Дедлайны NATS'}
            </button>
            {onOpenCalendar && (
              <button
                type="button"
                onClick={onOpenCalendar}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <CalendarDays className="h-3.5 w-3.5 text-[#0077FF]" />
                Календарь
              </button>
            )}
            {canWrite && (
              <button
                type="button"
                onClick={() => openTaskModal()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                Новая задача
              </button>
            )}
          </div>
        }
      />

      {/* Status Tabs + Search/Type/Assignee Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              ['open', `Открытые (${counts.open})`],
              ['overdue', `Просроченные (${counts.overdue})`],
              ['completed', `Выполненные (${counts.completed})`],
              ['all', `Все (${counts.all})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatusTab(id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                statusTab === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <VoiceSearchInput
            value={search}
            onChange={setSearch}
            placeholder="Поиск задачи или сделки..."
            ariaLabel="Поиск задач CRM"
            voiceHint="Назовите задачу, сделку или менеджера"
            onNotify={onNotify}
            className="min-w-[220px] sm:min-w-[240px]"
          />
          <select
            aria-label="Фильтр по типу задачи"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0077FF]"
          >
            <option value="all">Все типы</option>
            {EDITABLE_TASK_TYPES.map((k) => (
              <option key={k} value={k}>
                {UNIFIED_TASK_TYPE_LABELS[k]}
              </option>
            ))}
          </select>
          <select
            aria-label="Фильтр по исполнителю"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0077FF]"
          >
            <option value="all">Все исполнители</option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
          <select
            aria-label="Сортировка по сроку"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'due_asc' | 'due_desc')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0077FF]"
          >
            <option value="due_asc">Ближайшие сроки</option>
            <option value="due_desc">Поздние сроки</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-5 w-5" />}
          title="Задач в этой категории нет"
          description="Создайте задачу или переключите фильтр статуса."
        />
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {filteredTasks.map((t) => {
            const isOverdue = !t.completed && new Date(t.dueAt).getTime() < nowMs;
            return (
              <div
                key={t.id}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50/70"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <button
                    type="button"
                    disabled={!canWrite}
                    onClick={() => void handleToggleTask(t.id)}
                    aria-label={t.completed ? 'Вернуть задачу в работу' : 'Завершить задачу'}
                    className={`mt-0.5 transition-colors ${
                      t.completed ? 'text-emerald-600' : 'text-slate-300 hover:text-[#0077FF]'
                    }`}
                  >
                    <CheckCircle2 className="h-5 w-5" />
                  </button>
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-medium ${
                        t.completed ? 'text-slate-400 line-through' : 'text-slate-900'
                      }`}
                    >
                      {t.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">
                        {UNIFIED_TASK_TYPE_LABELS[t.taskType] || t.taskType}
                      </span>
                      <span>·</span>
                      <span>{t.assigneeName}</span>
                      {t.dealTitle && (
                        <>
                          <span>·</span>
                          <span className="text-[#0077FF]">{t.dealTitle}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <div
                      className={`text-xs tabular-nums ${
                        isOverdue ? 'font-semibold text-red-600' : 'text-slate-500'
                      }`}
                    >
                      {formatDateTimeRu(t.dueAt)}
                      {isOverdue && ' · Просрочено'}
                    </div>
                    {!t.completed && t.reminderAt && (
                      <div className="mt-0.5 text-[11px] text-amber-700 tabular-nums">
                        Напоминание: {formatDateTimeRu(t.reminderAt)}
                        {t.reminderNotifiedAt ? ' · отправлено' : ''}
                      </div>
                    )}
                  </div>
                  {canWrite && (
                    <div className="flex items-center gap-1">
                      {!t.completed && (
                        <button
                          type="button"
                          disabled={remindingTaskId === t.id}
                          onClick={() => void handleSendManualReminder(t)}
                          aria-label="Отправить напоминание в NATS"
                          title="Отправить напоминание в NATS (Toast)"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"
                        >
                          <Bell className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openTaskModal(t)}
                        aria-label="Редактировать задачу"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteTask(t.id)}
                        aria-label="Удалить задачу"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTask ? 'Редактировать задачу' : 'Новая задача CRM'}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSaveTask} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Описание задачи *</label>
            <input
              type="text"
              required
              value={tTitle}
              onChange={(e) => setTTitle(e.target.value)}
              placeholder="Позвонить ЛПР, согласовать SLA..."
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Тип</label>
              <select
                value={tType}
                onChange={(e) => setTType(e.target.value as typeof tType)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
              >
                {EDITABLE_TASK_TYPES.map((k) => (
                  <option key={k} value={k}>
                    {UNIFIED_TASK_TYPE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Исполнитель</label>
              <select
                value={tAssigneeId}
                onChange={(e) => setTAssigneeId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
              >
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Связанная сделка</label>
            <select
              value={tDealId}
              onChange={(e) => setTDealId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
            >
              <option value="">Без привязки к сделке</option>
              {dealOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Срок выполнения</label>
            <input
              type="datetime-local"
              value={tDue}
              onChange={(e) => setTDue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none focus:border-[#0077FF]"
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Напоминание (NATS Push)</label>
              <select
                value={tReminderPreset}
                onChange={(e) =>
                  setTReminderPreset(e.target.value as 'none' | 'at_due' | '15m' | '60m' | 'custom')
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
              >
                <option value="none">Авто (за 15 мин до срока)</option>
                <option value="15m">За 15 минут</option>
                <option value="60m">За 1 час</option>
                <option value="at_due">В момент дедлайна</option>
                <option value="custom">Указать точное время</option>
              </select>
            </div>
            {tReminderPreset === 'custom' && (
              <div>
                <label className="block text-xs font-medium text-slate-700">Время напоминания</label>
                <input
                  type="datetime-local"
                  value={tReminderCustom}
                  onChange={(e) => setTReminderCustom(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs tabular-nums outline-none focus:border-[#0077FF]"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Сохранить
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
