import React, { useEffect, useMemo, useState } from 'react';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  GripVertical,
  LayoutGrid,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { DealItem, PortalSectionId, StageItem, TaskItem } from '../types.ts';

export type DashboardWidgetType = 'daily_activity' | 'quick_deals' | 'task_stats';

export interface DashboardNatsEvent {
  id: string;
  subject: string;
  actorId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface WidgetDefinition {
  id: DashboardWidgetType;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const WIDGET_CATALOG: WidgetDefinition[] = [
  {
    id: 'daily_activity',
    title: 'Активность за день',
    description: 'События NATS, касания и динамика потоков за 24 часа',
    icon: <Activity className="h-4 w-4 text-[#0077FF]" />,
  },
  {
    id: 'quick_deals',
    title: 'Быстрый доступ к сделкам',
    description: 'Приоритетные сделки воронки, бюджет и AI-шанс закрытия',
    icon: <Briefcase className="h-4 w-4 text-emerald-600" />,
  },
  {
    id: 'task_stats',
    title: 'Статистика задач',
    description: 'Выполнение, просрочки и распределение задач по типам',
    icon: <BarChart3 className="h-4 w-4 text-amber-600" />,
  },
];

const DEFAULT_ACTIVE_WIDGETS: DashboardWidgetType[] = ['daily_activity', 'quick_deals'];

function isWidgetType(val: unknown): val is DashboardWidgetType {
  return val === 'daily_activity' || val === 'quick_deals' || val === 'task_stats';
}

function loadSavedWidgets(storageKey: string): DashboardWidgetType[] {
  if (typeof window === 'undefined') return DEFAULT_ACTIVE_WIDGETS;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_ACTIVE_WIDGETS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_ACTIVE_WIDGETS;
    const unique: DashboardWidgetType[] = [];
    for (const item of parsed) {
      if (isWidgetType(item) && !unique.includes(item)) {
        unique.push(item);
      }
    }
    return unique;
  } catch {
    return DEFAULT_ACTIVE_WIDGETS;
  }
}

interface PaletteWidgetChipProps {
  def: WidgetDefinition;
  isPlaced: boolean;
  onQuickAdd: (id: DashboardWidgetType) => void;
}

const PaletteWidgetChip: React.FC<PaletteWidgetChipProps> = ({ def, isPlaced, onQuickAdd }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette:${def.id}`,
    data: { source: 'palette', widgetType: def.id },
    disabled: isPlaced,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isPlaced ? {} : { ...attributes, ...listeners })}
      className={`flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors ${
        isPlaced
          ? 'border-slate-200 bg-slate-50/70 opacity-75'
          : isDragging
          ? 'border-[#0077FF] bg-blue-50/70 opacity-50 shadow-sm cursor-grabbing'
          : 'border-slate-200 bg-white hover:border-[#0077FF]/60 cursor-grab active:cursor-grabbing'
      }`}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100">
          {def.icon}
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-slate-900">{def.title}</div>
          <div className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{def.description}</div>
        </div>
      </div>

      {isPlaced ? (
        <span className="shrink-0 pt-1 text-[11px] font-medium text-emerald-700 whitespace-nowrap">
          На доске
        </span>
      ) : (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onQuickAdd(def.id)}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-[#0077FF] hover:border-[#0077FF] hover:bg-blue-50 whitespace-nowrap"
        >
          <Plus className="h-3 w-3" />
          Добавить
        </button>
      )}
    </div>
  );
};

interface SortableWidgetCardProps {
  def: WidgetDefinition;
  onRemove: (id: DashboardWidgetType) => void;
  children: React.ReactNode;
}

const SortableWidgetCard: React.FC<SortableWidgetCardProps> = ({ def, onRemove, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: def.id,
    data: { source: 'board', widgetType: def.id },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={`flex flex-col rounded-xl border bg-white p-5 transition-shadow ${
        isDragging
          ? 'z-20 border-[#0077FF] opacity-60 shadow-md'
          : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Перетащить виджет «${def.title}»`}
            className="touch-none shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-[#0077FF]"
            title="Перетащите для изменения порядка"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-slate-900">{def.title}</h4>
            <p className="truncate text-[11px] text-slate-500">{def.description}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onRemove(def.id)}
          aria-label={`Убрать виджет «${def.title}»`}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          title="Убрать виджет с рабочего стола"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3.5 flex flex-1 flex-col justify-between">{children}</div>
    </section>
  );
};

interface WidgetDropSlotProps {
  isPaletteDragging: boolean;
  fullWidth?: boolean;
}

const WidgetDropSlot: React.FC<WidgetDropSlotProps> = ({ isPaletteDragging, fullWidth }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'dashboard-widget-drop-slot',
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[220px] flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
        fullWidth ? 'col-span-full' : ''
      } ${
        isOver
          ? 'border-[#0077FF] bg-blue-50/70 text-[#0077FF]'
          : isPaletteDragging
          ? 'border-[#0077FF]/60 bg-blue-50/30 text-slate-700'
          : 'border-slate-200 bg-slate-50/60 text-slate-500'
      }`}
    >
      <LayoutGrid className="mb-2 h-5 w-5 text-slate-400" />
      <div className="text-xs font-semibold text-slate-800">
        {isOver ? 'Отпустите, чтобы добавить виджет' : 'Зона добавления виджета'}
      </div>
      <p className="mt-1 max-w-xs text-[11px] text-slate-500">
        Перетащите «Активность за день», «Быстрый доступ к сделкам» или «Статистика задач» из палитры выше.
      </p>
    </div>
  );
};

interface DashboardWidgetsBoardProps {
  tenantId: string;
  userId: string;
  deals: DealItem[];
  stages: StageItem[];
  tasks: TaskItem[];
  events: DashboardNatsEvent[];
  onToggleTask: (taskId: string) => Promise<void>;
  onNavigate: (tab: PortalSectionId) => void;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
}

export const DashboardWidgetsBoard: React.FC<DashboardWidgetsBoardProps> = ({
  tenantId,
  userId,
  deals,
  stages,
  tasks,
  events,
  onToggleTask,
  onNavigate,
  onNotify,
}) => {
  const storageKey = `nexus:dashboard:widgets:v1:${tenantId}:${userId}`;
  const [activeWidgets, setActiveWidgets] = useState<DashboardWidgetType[]>(() =>
    loadSavedWidgets(storageKey)
  );
  const [showPalette, setShowPalette] = useState(true);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dealsSortMode, setDealsSortMode] = useState<'budget' | 'probability'>('budget');

  useEffect(() => {
    setActiveWidgets(loadSavedWidgets(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(activeWidgets));
    } catch {
      // Ignore storage quota issues
    }
  }, [storageKey, activeWidgets]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { setNodeRef: setBoardDropRef, isOver: isBoardOver } = useDroppable({
    id: 'dashboard-widget-board',
  });

  const addWidget = (widgetType: DashboardWidgetType, insertAtIndex?: number) => {
    setActiveWidgets((prev) => {
      if (prev.includes(widgetType)) return prev;
      if (insertAtIndex !== undefined && insertAtIndex >= 0 && insertAtIndex <= prev.length) {
        const next = [...prev];
        next.splice(insertAtIndex, 0, widgetType);
        return next;
      }
      return [...prev, widgetType];
    });
    const def = WIDGET_CATALOG.find((w) => w.id === widgetType);
    if (def) {
      onNotify(`Виджет «${def.title}» добавлен на рабочий стол`);
    }
  };

  const removeWidget = (widgetType: DashboardWidgetType) => {
    setActiveWidgets((prev) => prev.filter((id) => id !== widgetType));
  };

  const resetWidgets = () => {
    setActiveWidgets(DEFAULT_ACTIVE_WIDGETS);
    onNotify('Набор виджетов сброшен по умолчанию');
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    if (activeIdStr.startsWith('palette:')) {
      const widgetType = activeIdStr.replace('palette:', '');
      if (!isWidgetType(widgetType)) return;
      const targetIdx = isWidgetType(overIdStr) ? activeWidgets.indexOf(overIdStr) : undefined;
      addWidget(widgetType, targetIdx !== undefined && targetIdx >= 0 ? targetIdx : undefined);
      return;
    }

    if (isWidgetType(activeIdStr) && isWidgetType(overIdStr) && activeIdStr !== overIdStr) {
      setActiveWidgets((prev) => {
        const oldIdx = prev.indexOf(activeIdStr);
        const newIdx = prev.indexOf(overIdStr);
        if (oldIdx === -1 || newIdx === -1) return prev;
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  const isPaletteDragging = Boolean(activeDragId && activeDragId.startsWith('palette:'));

  const draggedDef = useMemo(() => {
    if (!activeDragId) return null;
    const rawId = activeDragId.startsWith('palette:')
      ? activeDragId.replace('palette:', '')
      : activeDragId;
    return WIDGET_CATALOG.find((w) => w.id === rawId) || null;
  }, [activeDragId]);

  // Derived real data for the 3 widgets
  const nowMs = Date.now();
  const dayAgoMs = nowMs - 24 * 60 * 60 * 1000;
  const recentEvents = useMemo(
    () => events.filter((e) => new Date(e.createdAt).getTime() >= dayAgoMs),
    [events, dayAgoMs]
  );

  const activityStreams = useMemo(() => {
    const src = recentEvents.length > 0 ? recentEvents : events;
    const crmCount = src.filter((e) => e.subject.startsWith('crm.')).length;
    const workflowCount = src.filter(
      (e) => e.subject.startsWith('nocobase.') || e.subject.startsWith('harness.') || e.subject.startsWith('n8n.')
    ).length;
    const docsCount = src.filter(
      (e) => e.subject.startsWith('office.') || e.subject.startsWith('garage.') || e.subject.startsWith('forgejo.')
    ).length;
    const otherCount = Math.max(0, src.length - crmCount - workflowCount - docsCount);
    const total = Math.max(1, src.length);
    return {
      totalEvents: src.length,
      items: [
        { label: 'Сделки и CRM', count: crmCount, pct: Math.round((crmCount / total) * 100), color: '#0077FF' },
        { label: 'Процессы и AI', count: workflowCount, pct: Math.round((workflowCount / total) * 100), color: '#16A34A' },
        { label: 'Документы и S3', count: docsCount, pct: Math.round((docsCount / total) * 100), color: '#D97706' },
        { label: 'Чат и портал', count: otherCount, pct: Math.round((otherCount / total) * 100), color: '#64748B' },
      ],
    };
  }, [recentEvents, events]);

  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const openDealsSorted = useMemo(() => {
    const active = deals.filter((d) => {
      const st = stageById.get(d.stageId);
      return !st?.isWon && !st?.isLost;
    });
    const list = active.length > 0 ? active : deals;
    return [...list]
      .sort((a, b) => {
        if (dealsSortMode === 'probability') {
          return (b.harnessAnalysis?.winProbability ?? 0) - (a.harnessAnalysis?.winProbability ?? 0);
        }
        return b.budget - a.budget;
      })
      .slice(0, 5);
  }, [deals, stageById, dealsSortMode]);

  const taskAnalytics = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const open = tasks.filter((t) => !t.completed);
    const overdue = open.filter((t) => new Date(t.dueAt).getTime() < nowMs);
    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    const typeLabels: Record<string, string> = {
      call: 'Звонок',
      meeting: 'Встреча',
      followup: 'Follow-up',
      proposal: 'КП / Расчёт',
      approval: 'Согласование',
    };

    const byTypeMap = new Map<string, number>();
    for (const t of tasks) {
      byTypeMap.set(t.taskType, (byTypeMap.get(t.taskType) || 0) + 1);
    }
    const byType = Array.from(byTypeMap.entries())
      .map(([type, count]) => ({
        type,
        label: typeLabels[type] || type,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    return {
      total,
      completed,
      openCount: open.length,
      overdueCount: overdue.length,
      completionPct,
      byType,
      nextOpenTask: overdue[0] || open[0] || null,
    };
  }, [tasks, nowMs]);

  const renderWidgetContent = (widgetId: DashboardWidgetType) => {
    if (widgetId === 'daily_activity') {
      const displayEvents = (recentEvents.length > 0 ? recentEvents : events).slice(0, 4);
      return (
        <div className="space-y-3.5">
          <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-3 text-xs">
            <div>
              <div className="text-[11px] text-slate-500">Событий 24ч</div>
              <div className="mt-0.5 font-mono text-base font-bold text-slate-900 tabular-nums">
                {activityStreams.totalEvents}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Сделок</div>
              <div className="mt-0.5 font-mono text-base font-bold text-slate-900 tabular-nums">
                {deals.length}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Открытых задач</div>
              <div className="mt-0.5 font-mono text-base font-bold text-slate-900 tabular-nums">
                {taskAnalytics.openCount}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {activityStreams.items.map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">{item.label}</span>
                  <span className="font-mono font-medium text-slate-800 tabular-nums">
                    {item.count} ({item.pct}%)
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${item.count === 0 ? 0 : Math.max(6, item.pct)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-2.5">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="font-medium text-slate-500">Последние события</span>
              <button
                type="button"
                onClick={() => onNavigate('devtools')}
                className="inline-flex items-center gap-0.5 font-medium text-[#0077FF] hover:underline whitespace-nowrap"
              >
                Поток <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
            {displayEvents.length === 0 ? (
              <div className="py-2 text-xs text-slate-400">Активности пока не зафиксировано</div>
            ) : (
              <div className="space-y-1.5">
                {displayEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate font-mono text-slate-700">{ev.subject}</span>
                    <span className="shrink-0 font-mono text-slate-400 tabular-nums">
                      {new Date(ev.createdAt).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (widgetId === 'quick_deals') {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setDealsSortMode('budget')}
                className={`rounded-md px-2 py-1 font-medium whitespace-nowrap ${
                  dealsSortMode === 'budget' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                По бюджету
              </button>
              <button
                type="button"
                onClick={() => setDealsSortMode('probability')}
                className={`rounded-md px-2 py-1 font-medium whitespace-nowrap ${
                  dealsSortMode === 'probability' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                По шансу AI
              </button>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('deals')}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0077FF] hover:underline whitespace-nowrap"
            >
              Все сделки <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>

          {openDealsSorted.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">Нет активных сделок</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {openDealsSorted.map((deal) => {
                const st = stageById.get(deal.stageId);
                return (
                  <button
                    key={deal.id}
                    type="button"
                    onClick={() => onNavigate('deals')}
                    className="flex w-full items-center justify-between gap-3 py-2 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-slate-900">{deal.title}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: st?.color || '#64748B' }}
                        />
                        <span className="truncate">{st?.name || 'Этап'}</span>
                        {deal.harnessAnalysis && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-[#0077FF] tabular-nums">
                              {deal.harnessAnalysis.winProbability}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-xs font-semibold text-slate-900 tabular-nums">
                      {deal.budget.toLocaleString('ru-RU')} ₽
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // task_stats
    return (
      <div className="space-y-3.5">
        <div className="space-y-1.5 border-b border-slate-100 pb-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">Выполнение плана</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {taskAnalytics.completed} / {taskAnalytics.total} ({taskAnalytics.completionPct}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${taskAnalytics.completionPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 tabular-nums">
            <span>В работе: {taskAnalytics.openCount}</span>
            <span className={taskAnalytics.overdueCount > 0 ? 'font-semibold text-red-600' : ''}>
              Просрочено: {taskAnalytics.overdueCount}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {taskAnalytics.byType.length === 0 ? (
            <div className="py-3 text-center text-xs text-slate-400">Задачи ещё не созданы</div>
          ) : (
            taskAnalytics.byType.map((row) => (
              <div key={row.type} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-700">{row.label}</span>
                  <span className="font-mono text-slate-600 tabular-nums">
                    {row.count} ({row.pct}%)
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{ width: `${Math.max(8, row.pct)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-slate-100 pt-2.5">
          {taskAnalytics.nextOpenTask ? (
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => void onToggleTask(taskAnalytics.nextOpenTask!.id)}
                className="inline-flex min-w-0 items-center gap-1.5 text-left text-slate-700 hover:text-emerald-700"
                title="Быстро завершить задачу"
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate font-medium">{taskAnalytics.nextOpenTask.title}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('tasks')}
                className="shrink-0 font-medium text-[#0077FF] hover:underline whitespace-nowrap"
              >
                Все →
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0077FF] hover:underline whitespace-nowrap"
            >
              Перейти к задачам <ArrowUpRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Настраиваемые виджеты рабочего стола
            </h3>
            <p className="text-xs text-slate-500">
              Перетащите виджет из палитры на доску или меняйте порядок карточек · Активно {activeWidgets.length} из {WIDGET_CATALOG.length}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPalette((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
              {showPalette ? 'Скрыть палитру' : 'Добавить виджеты'}
            </button>
            <button
              type="button"
              onClick={resetWidgets}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
              Сбросить
            </button>
          </div>
        </div>

        {/* Draggable Widget Palette */}
        {showPalette && (
          <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 md:grid-cols-3">
            {WIDGET_CATALOG.map((def) => (
              <PaletteWidgetChip
                key={def.id}
                def={def}
                isPlaced={activeWidgets.includes(def.id)}
                onQuickAdd={(id) => addWidget(id)}
              />
            ))}
          </div>
        )}

        {/* Sortable Widget Board Dropzone */}
        <div
          ref={setBoardDropRef}
          className={`rounded-xl border p-3 transition-colors ${
            isBoardOver && isPaletteDragging
              ? 'border-[#0077FF] bg-blue-50/40'
              : 'border-slate-100 bg-[#F8FAFC]'
          }`}
        >
          <SortableContext items={activeWidgets} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {activeWidgets.map((widgetId) => {
                const def = WIDGET_CATALOG.find((w) => w.id === widgetId);
                if (!def) return null;
                return (
                  <SortableWidgetCard
                    key={widgetId}
                    def={def}
                    onRemove={removeWidget}
                  >
                    {renderWidgetContent(widgetId)}
                  </SortableWidgetCard>
                );
              })}

              {activeWidgets.length < WIDGET_CATALOG.length && (
                <WidgetDropSlot
                  isPaletteDragging={isPaletteDragging}
                  fullWidth={activeWidgets.length === 0}
                />
              )}
            </div>
          </SortableContext>
        </div>
      </div>

      <DragOverlay>
        {draggedDef ? (
          <div className="w-72 rounded-xl border border-[#0077FF] bg-white p-4 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
              {draggedDef.icon}
              <span>{draggedDef.title}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{draggedDef.description}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
