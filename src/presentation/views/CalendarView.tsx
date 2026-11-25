import React, { useCallback, useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import interactionPlugin from '@fullcalendar/react/interaction';
import ruLocale from '@fullcalendar/react/locales/ru';
import classicThemePlugin from '@fullcalendar/react/themes/classic';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Handshake,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  buildCalendarEvents,
  CALENDAR_TASK_TYPE_LABELS,
  type CalendarDealItem,
  type CalendarEventSource,
  computeRescheduledTaskPayload,
  type CrmCalendarEventRecord,
  filterCalendarEvents,
  toLocalDateTimeInputValue,
} from '../../application/crm/calendarSync.ts';
import { natsClient } from '../../application/nats/natsClient.ts';
import { refineClient } from '../../application/refine/client.ts';
import { useVoiceSectionAction } from '../../application/voice/voiceActionBus.ts';
import type { AuthenticatedActor } from '../../domain/shared/types.ts';
import { VoiceSearchInput } from '../components/crm/VoiceSearchInput.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import type { OwnerOption, TaskItem } from '../types.ts';

interface CalendarViewProps {
  actor: AuthenticatedActor;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
  onOpenDeals?: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ actor, onNotify, onOpenDeals }) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [deals, setDeals] = useState<CalendarDealItem[]>([]);
  const [assignees, setAssignees] = useState<OwnerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [sourceFilter, setSourceFilter] = useState<'all' | CalendarEventSource>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [showCompleted, setShowCompleted] = useState(true);
  const [search, setSearch] = useState('');

  // Create / Edit modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [cTitle, setCTitle] = useState('');
  const [cTaskType, setCTaskType] = useState<'meeting' | 'call' | 'followup' | 'dify_ai'>('meeting');
  const [cDealId, setCDealId] = useState('');
  const [cAssigneeId, setCAssigneeId] = useState('');
  const [cDue, setCDue] = useState(() =>
    toLocalDateTimeInputValue(new Date(Date.now() + 3600 * 1000).toISOString())
  );
  const [cDuration, setCDuration] = useState('60');
  const [cReminderMinutes, setCReminderMinutes] = useState<'none' | '0' | '15' | '60'>('15');

  // Event Inspector modal state
  const [selectedEvent, setSelectedEvent] = useState<CrmCalendarEventRecord | null>(null);
  const [editDue, setEditDue] = useState('');
  const [editDuration, setEditDuration] = useState('60');
  const [editTitle, setEditTitle] = useState('');
  const [savingEvent, setSavingEvent] = useState(false);

  const canWrite = refineClient.can(actor, 'tasks:write');

  const loadCalendarData = useCallback(
    async (silent = false) => {
      if (silent) {
        setSyncing(true);
      } else {
        setLoading(true);
      }
      try {
        const data = await refineClient.request<{
          tasks: TaskItem[];
          deals: CalendarDealItem[];
          assignees: OwnerOption[];
        }>('/api/crm/calendar');
        setTasks(data.tasks || []);
        setDeals(data.deals || []);
        setAssignees(data.assignees || []);
      } catch (err: unknown) {
        onNotify(err instanceof Error ? err.message : 'Ошибка загрузки календаря CRM', 'err');
      } finally {
        setLoading(false);
        setSyncing(false);
      }
    },
    [onNotify]
  );

  useEffect(() => {
    void loadCalendarData(false);
  }, [loadCalendarData]);

  useEffect(() => {
    const unsubscribe = natsClient.subscribe('crm.*.task.*', () => {
      void loadCalendarData(true);
    });
    return () => unsubscribe();
  }, [loadCalendarData]);

  const allEvents = useMemo(
    () =>
      buildCalendarEvents({
        tasks,
        deals,
        includeHarnessSuggestions: true,
        canEdit: canWrite,
      }),
    [tasks, deals, canWrite]
  );

  const visibleEvents = useMemo(
    () =>
      filterCalendarEvents(allEvents, {
        sourceFilter,
        assigneeFilter,
        showCompleted,
        search,
      }),
    [allEvents, sourceFilter, assigneeFilter, showCompleted, search]
  );

  const summary = useMemo(() => {
    const dealMeetings = allEvents.filter((e) => e.source === 'deal_meeting' && !e.completed).length;
    const regularTasks = allEvents.filter((e) => e.source === 'task' && !e.completed).length;
    const proposed = allEvents.filter((e) => e.source === 'harness_suggestion').length;
    const overdue = allEvents.filter((e) => e.overdue).length;
    return { dealMeetings, regularTasks, proposed, overdue };
  }, [allEvents]);

  const fcEvents = useMemo(
    () =>
      visibleEvents.map((ev) => ({
        id: ev.id,
        title: ev.dealTitle ? `${ev.title} — ${ev.dealTitle}` : ev.title,
        start: ev.start,
        end: ev.end,
        editable: ev.editable,
        backgroundColor: ev.backgroundColor,
        borderColor: ev.borderColor,
        textColor: ev.textColor,
        extendedProps: {
          calendarRecord: ev,
        },
      })),
    [visibleEvents]
  );

  const openCreateModalForSlot = (startIso: string, durationMinutes = 60) => {
    if (!canWrite) return;
    setCTitle('');
    setCTaskType(deals.length > 0 ? 'meeting' : 'followup');
    setCDealId(deals[0]?.id || '');
    setCAssigneeId(assignees[0]?.id || actor.userId);
    setCDue(toLocalDateTimeInputValue(startIso));
    setCDuration(String(durationMinutes));
    setCreateModalOpen(true);
  };

  useVoiceSectionAction('calendar', (actionId) => {
    switch (actionId) {
      case 'calendar.create_event':
        if (!canWrite) return false;
        openCreateModalForSlot(new Date(Date.now() + 3600 * 1000).toISOString(), 60);
        return true;
      case 'calendar.filter_meetings':
        setSourceFilter('deal_meeting');
        return true;
      case 'calendar.filter_all':
        setSourceFilter('all');
        setAssigneeFilter('all');
        setShowCompleted(true);
        return true;
      case 'calendar.refresh':
        void loadCalendarData(true);
        return true;
      default:
        return false;
    }
  });

  const handleCreateCalendarEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cTitle.trim()) return;
    try {
      const dueDate = new Date(cDue);
      const reminderAt =
        cReminderMinutes === 'none' || Number.isNaN(dueDate.getTime())
          ? null
          : new Date(dueDate.getTime() - Number(cReminderMinutes) * 60000).toISOString();
      await refineClient.request('/api/crm/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: cTitle.trim(),
          taskType: cTaskType,
          dealId: cDealId || null,
          assigneeId: cAssigneeId || actor.userId,
          dueAt: dueDate.toISOString(),
          reminderAt,
          durationMinutes: Number(cDuration) || 60,
        }),
      });
      setCreateModalOpen(false);
      onNotify(
        cTaskType === 'meeting'
          ? 'Встреча запланирована и синхронизирована со сделкой'
          : 'Задача добавлена в календарь CRM'
      );
      await loadCalendarData(true);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Не удалось создать событие', 'err');
    }
  };

  const handleEventDropOrResize = async (info: {
    event: {
      start: Date | null;
      end: Date | null;
      extendedProps: Record<string, unknown>;
    };
    revert: () => void;
  }) => {
    const rec = info.event.extendedProps.calendarRecord as CrmCalendarEventRecord | undefined;
    if (!rec || !info.event.start || !canWrite) {
      info.revert();
      return;
    }

    const { dueAt, durationMinutes } = computeRescheduledTaskPayload(
      info.event.start,
      info.event.end,
      rec.durationMinutes
    );

    if (rec.source === 'harness_suggestion') {
      try {
        await refineClient.request('/api/crm/tasks', {
          method: 'POST',
          body: JSON.stringify({
            title: rec.title.replace(/^План:\s*/u, ''),
            taskType: 'meeting',
            dealId: rec.dealId,
            assigneeId: rec.assigneeId || actor.userId,
            dueAt,
            durationMinutes,
          }),
        });
        onNotify(`Встреча по сделке зафиксирована на ${new Date(dueAt).toLocaleString('ru-RU')}`);
        await loadCalendarData(true);
      } catch (err: unknown) {
        info.revert();
        onNotify(err instanceof Error ? err.message : 'Ошибка планирования встречи', 'err');
      }
      return;
    }

    const prevTasks = tasks;
    setTasks((curr) =>
      curr.map((t) => (t.id === rec.sourceId ? { ...t, dueAt, durationMinutes } : t))
    );

    try {
      await refineClient.request(`/api/crm/tasks/${rec.sourceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ dueAt, durationMinutes }),
      });
      onNotify(`Срок перенесён на ${new Date(dueAt).toLocaleString('ru-RU')}`);
    } catch (err: unknown) {
      setTasks(prevTasks);
      info.revert();
      onNotify(err instanceof Error ? err.message : 'Не удалось перенести срок', 'err');
    }
  };

  const handleOpenInspector = (rec: CrmCalendarEventRecord) => {
    setSelectedEvent(rec);
    setEditTitle(rec.title.replace(/^План:\s*/u, ''));
    setEditDue(toLocalDateTimeInputValue(rec.start));
    setEditDuration(String(rec.durationMinutes));
  };

  const handleSaveInspectorChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !canWrite) return;
    setSavingEvent(true);
    try {
      const dueAt = new Date(editDue).toISOString();
      const durationMinutes = Number(editDuration) || 60;

      if (selectedEvent.source === 'harness_suggestion') {
        await refineClient.request('/api/crm/tasks', {
          method: 'POST',
          body: JSON.stringify({
            title: editTitle.trim(),
            taskType: 'meeting',
            dealId: selectedEvent.dealId,
            assigneeId: selectedEvent.assigneeId || actor.userId,
            dueAt,
            durationMinutes,
          }),
        });
        onNotify('Рекомендованная встреча добавлена в расписание');
      } else {
        await refineClient.request(`/api/crm/tasks/${selectedEvent.sourceId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: editTitle.trim(),
            dueAt,
            durationMinutes,
          }),
        });
        onNotify('Событие обновлено');
      }
      setSelectedEvent(null);
      await loadCalendarData(true);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка сохранения события', 'err');
    } finally {
      setSavingEvent(false);
    }
  };

  const handleToggleCompleted = async (rec: CrmCalendarEventRecord) => {
    if (!canWrite || rec.source === 'harness_suggestion') return;
    try {
      await refineClient.request(`/api/crm/tasks/${rec.sourceId}/toggle`, { method: 'PATCH' });
      onNotify(rec.completed ? 'Возвращено в работу' : 'Отмечено выполненным');
      setSelectedEvent(null);
      await loadCalendarData(true);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка обновления статуса', 'err');
    }
  };

  const handleDeleteEvent = async (rec: CrmCalendarEventRecord) => {
    if (!canWrite || rec.source === 'harness_suggestion') return;
    try {
      await refineClient.deleteOne('crm/tasks', rec.sourceId);
      onNotify('Событие удалено из календаря');
      setSelectedEvent(null);
      await loadCalendarData(true);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка удаления события', 'err');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Календарь встреч и задач CRM"
        subtitle={`Встречи по сделкам: ${summary.dealMeetings} · Задачи CRM: ${summary.regularTasks} · Просрочено: ${summary.overdue}${
          summary.proposed > 0 ? ` · Рекомендации Harness: ${summary.proposed}` : ''
        }`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadCalendarData(true)}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${syncing ? 'animate-spin' : ''}`} />
              Синхронизировать
            </button>
            {canWrite && (
              <button
                type="button"
                onClick={() =>
                  openCreateModalForSlot(new Date(Date.now() + 3600 * 1000).toISOString(), 60)
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Встреча / задача
              </button>
            )}
          </div>
        }
      />

      {/* Filter & Legend Toolbar */}
      <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(
              [
                ['all', 'Все события'],
                ['deal_meeting', 'Встречи по сделкам'],
                ['task', 'Задачи CRM'],
                ['harness_suggestion', 'Рекомендации Harness'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSourceFilter(id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 ${
                  sourceFilter === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
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
              placeholder="Поиск встречи, сделки или контакта..."
              ariaLabel="Поиск событий календаря"
              voiceHint="Назовите встречу, задачу или сделку"
              onNotify={onNotify}
              className="min-w-[240px] sm:min-w-[270px]"
            />

            <select
              aria-label="Фильтр по ответственному"
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0077FF]"
            >
              <option value="all">Все сотрудники</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </select>

            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#0077FF]"
              />
              Выполненные
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#0077FF]" aria-hidden="true" />
              Встреча сделки
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#0284C7]" aria-hidden="true" />
              Звонок
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#334155]" aria-hidden="true" />
              Задача / Follow-up
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#DC2626]" aria-hidden="true" />
              Просрочено
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#D97706]" aria-hidden="true" />
              План Harness
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#16A34A]" aria-hidden="true" />
              Выполнено
            </span>
          </div>
          <span>
            {canWrite
              ? 'Перетаскивайте события между слотами для переноса срока или тяните край для изменения длительности'
              : 'Режим просмотра'}
          </span>
        </div>
      </div>

      {/* FullCalendar Interactive Workspace */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {loading ? (
          <div className="h-[620px] animate-pulse rounded-lg bg-slate-50" />
        ) : (
          <div className="fc-nexus-wrapper text-xs">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, classicThemePlugin]}
              locales={[ruLocale]}
              locale="ru"
              initialView="timeGridWeek"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'timeGridDay,timeGridWeek,dayGridMonth',
              }}
              firstDay={1}
              nowIndicator={true}
              allDaySlot={false}
              slotMinTime="08:00:00"
              slotMaxTime="21:00:00"
              slotDuration="00:30:00"
              height={640}
              expandRows={true}
              editable={canWrite}
              eventStartEditable={canWrite}
              eventDurationEditable={canWrite}
              selectable={canWrite}
              selectMirror={true}
              dayMaxEvents={3}
              events={fcEvents}
              eventDrop={(info) => void handleEventDropOrResize(info)}
              eventResize={(info) => void handleEventDropOrResize(info)}
              select={(selectInfo) => {
                const diffMin = Math.max(
                  30,
                  Math.round((selectInfo.end.getTime() - selectInfo.start.getTime()) / 60000)
                );
                openCreateModalForSlot(selectInfo.start.toISOString(), diffMin);
              }}
              dateClick={(dateInfo) => {
                openCreateModalForSlot(dateInfo.date.toISOString(), 60);
              }}
              eventClick={(clickInfo) => {
                const rec = clickInfo.event.extendedProps.calendarRecord as
                  | CrmCalendarEventRecord
                  | undefined;
                if (rec) handleOpenInspector(rec);
              }}
            />
          </div>
        )}
      </div>

      {/* Create Meeting / Task Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Запланировать встречу или задачу"
        subtitle="Автоматически синхронизируется с разделом «Задачи» и карточкой сделки"
      >
        <form onSubmit={handleCreateCalendarEntry} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Название *</label>
            <input
              type="text"
              required
              value={cTitle}
              onChange={(e) => setCTitle(e.target.value)}
              placeholder="Например: Встреча с ЛПР по условиям контракта"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Тип активности</label>
              <select
                value={cTaskType}
                onChange={(e) => setCTaskType(e.target.value as typeof cTaskType)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
              >
                <option value="meeting">Встреча по сделке</option>
                <option value="call">Звонок</option>
                <option value="followup">Задача / Follow-up</option>
                <option value="dify_ai">Dify AI действие</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Длительность (мин)</label>
              <select
                value={cDuration}
                onChange={(e) => setCDuration(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs tabular-nums outline-none focus:border-[#0077FF]"
              >
                <option value="15">15 минут</option>
                <option value="30">30 минут</option>
                <option value="45">45 минут</option>
                <option value="60">1 час</option>
                <option value="90">1.5 часа</option>
                <option value="120">2 часа</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Дата и время начала</label>
              <input
                type="datetime-local"
                required
                value={cDue}
                onChange={(e) => setCDue(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs tabular-nums outline-none focus:border-[#0077FF]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Ответственный</label>
              <select
                value={cAssigneeId}
                onChange={(e) => setCAssigneeId(e.target.value)}
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Связанная сделка</label>
              <select
                value={cDealId}
                onChange={(e) => setCDealId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
              >
                <option value="">Без привязки к сделке (личная/общая задача)</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                    {d.companyName ? ` · ${d.companyName}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Напоминание NATS</label>
              <select
                value={cReminderMinutes}
                onChange={(e) =>
                  setCReminderMinutes(e.target.value as 'none' | '0' | '15' | '60')
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
              >
                <option value="15">За 15 минут</option>
                <option value="60">За 1 час</option>
                <option value="0">В момент начала</option>
                <option value="none">Авто (за 15 мин)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Добавить в календарь
            </button>
          </div>
        </form>
      </Modal>

      {/* Event Inspector & Reschedule Modal */}
      <Modal
        open={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        title={
          selectedEvent?.source === 'harness_suggestion'
            ? 'Рекомендованная встреча DeepSeek-Harness'
            : selectedEvent?.source === 'deal_meeting'
              ? 'Встреча по сделке CRM'
              : 'Задача CRM'
        }
        subtitle={
          selectedEvent
            ? `${CALENDAR_TASK_TYPE_LABELS[selectedEvent.taskType] || selectedEvent.taskType} · ${selectedEvent.assigneeName}`
            : undefined
        }
      >
        {selectedEvent && (
          <form onSubmit={handleSaveInspectorChanges} className="space-y-4">
            <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 text-slate-600">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                  {selectedEvent.source === 'harness_suggestion' ? (
                    <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  ) : selectedEvent.source === 'deal_meeting' ? (
                    <Handshake className="h-3.5 w-3.5 text-[#0077FF]" />
                  ) : (
                    <CalendarDays className="h-3.5 w-3.5 text-slate-600" />
                  )}
                  {selectedEvent.dealTitle || 'Общая задача без сделки'}
                </span>
                {selectedEvent.dealTitle && onOpenDeals && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEvent(null);
                      onOpenDeals();
                    }}
                    className="inline-flex items-center gap-1 font-medium text-[#0077FF] hover:underline"
                  >
                    К сделкам
                    <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </div>
              {(selectedEvent.contactName || selectedEvent.companyName) && (
                <div className="text-[11px] text-slate-500">
                  {[selectedEvent.contactName, selectedEvent.companyName].filter(Boolean).join(' · ')}
                </div>
              )}
              {selectedEvent.rationale && (
                <div className="text-[11px] text-amber-800">{selectedEvent.rationale}</div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">Название события</label>
              <input
                type="text"
                required
                disabled={!canWrite}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF] disabled:bg-slate-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">Дата и время</label>
                <input
                  type="datetime-local"
                  required
                  disabled={!canWrite}
                  value={editDue}
                  onChange={(e) => setEditDue(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs tabular-nums outline-none focus:border-[#0077FF] disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Длительность (мин)
                </label>
                <div className="relative mt-1">
                  <Clock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    min={15}
                    max={720}
                    step={15}
                    disabled={!canWrite}
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-xs tabular-nums outline-none focus:border-[#0077FF] disabled:bg-slate-50"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2">
                {canWrite && selectedEvent.source !== 'harness_suggestion' && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleToggleCompleted(selectedEvent)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                        selectedEvent.completed
                          ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {selectedEvent.completed ? 'В работу' : 'Выполнено'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteEvent(selectedEvent)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      title="Удалить событие"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  Закрыть
                </button>
                {canWrite && (
                  <button
                    type="submit"
                    disabled={savingEvent}
                    className="rounded-lg bg-[#0077FF] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingEvent
                      ? 'Сохранение...'
                      : selectedEvent.source === 'harness_suggestion'
                        ? 'Запланировать встречу'
                        : 'Сохранить срок'}
                  </button>
                )}
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
