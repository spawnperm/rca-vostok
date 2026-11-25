import type { DealItem, TaskItem } from '../../presentation/types.ts';

export type CalendarEventSource = 'deal_meeting' | 'task' | 'harness_suggestion';

export interface CalendarDealItem extends DealItem {
  stageName?: string;
  isWon?: boolean;
  isLost?: boolean;
}

export interface CrmCalendarEventRecord {
  id: string;
  sourceId: string;
  source: CalendarEventSource;
  title: string;
  start: string;
  end: string;
  durationMinutes: number;
  taskType: string;
  completed: boolean;
  overdue: boolean;
  editable: boolean;
  dealId: string | null;
  dealTitle: string | null;
  contactName: string | null;
  companyName: string | null;
  assigneeId: string;
  assigneeName: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  rationale?: string;
}

export const CALENDAR_TASK_TYPE_LABELS: Record<string, string> = {
  meeting: 'Встреча',
  call: 'Звонок',
  followup: 'Follow-up',
  dify_ai: 'Dify AI',
};

export function getDefaultDurationMinutes(taskType: string): number {
  return taskType === 'meeting' ? 60 : 30;
}

export function clampDurationMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 60;
  return Math.max(15, Math.min(720, Math.round(minutes)));
}

export function computeRescheduledTaskPayload(
  startDate: Date,
  endDate: Date | null,
  fallbackDurationMinutes = 60
): { dueAt: string; durationMinutes: number } {
  const startMs = startDate.getTime();
  let durationMinutes = fallbackDurationMinutes;
  if (endDate) {
    const diffMinutes = Math.round((endDate.getTime() - startMs) / 60000);
    if (diffMinutes >= 15) {
      durationMinutes = clampDurationMinutes(diffMinutes);
    }
  }
  return {
    dueAt: new Date(startMs).toISOString(),
    durationMinutes: clampDurationMinutes(durationMinutes),
  };
}

function resolveEventColors(params: {
  source: CalendarEventSource;
  taskType: string;
  completed: boolean;
  overdue: boolean;
}): { backgroundColor: string; borderColor: string; textColor: string } {
  if (params.source === 'harness_suggestion') {
    return {
      backgroundColor: '#FEF3C7',
      borderColor: '#D97706',
      textColor: '#92400E',
    };
  }
  if (params.completed) {
    return {
      backgroundColor: '#DCFCE7',
      borderColor: '#16A34A',
      textColor: '#166534',
    };
  }
  if (params.overdue) {
    return {
      backgroundColor: '#FEE2E2',
      borderColor: '#DC2626',
      textColor: '#991B1B',
    };
  }
  if (params.source === 'deal_meeting' || params.taskType === 'meeting') {
    return {
      backgroundColor: '#0077FF',
      borderColor: '#005EC9',
      textColor: '#FFFFFF',
    };
  }
  if (params.taskType === 'call') {
    return {
      backgroundColor: '#0284C7',
      borderColor: '#0369A1',
      textColor: '#FFFFFF',
    };
  }
  if (params.taskType === 'dify_ai') {
    return {
      backgroundColor: '#7C3AED',
      borderColor: '#6D28D9',
      textColor: '#FFFFFF',
    };
  }
  return {
    backgroundColor: '#334155',
    borderColor: '#1E293B',
    textColor: '#FFFFFF',
  };
}

export function buildCalendarEvents(params: {
  tasks: TaskItem[];
  deals: CalendarDealItem[];
  includeHarnessSuggestions?: boolean;
  canEdit?: boolean;
  nowMs?: number;
}): CrmCalendarEventRecord[] {
  const {
    tasks,
    deals,
    includeHarnessSuggestions = true,
    canEdit = true,
    nowMs = Date.now(),
  } = params;

  const dealById = new Map<string, CalendarDealItem>();
  for (const deal of deals) {
    dealById.set(deal.id, deal);
  }

  const events: CrmCalendarEventRecord[] = [];
  const dealsWithOpenMeetings = new Set<string>();

  for (const task of tasks) {
    const startMs = new Date(task.dueAt).getTime();
    if (!Number.isFinite(startMs)) continue;

    const durationMinutes = clampDurationMinutes(
      task.durationMinutes ?? getDefaultDurationMinutes(task.taskType)
    );
    const endMs = startMs + durationMinutes * 60_000;
    const linkedDeal = task.dealId ? dealById.get(task.dealId) : undefined;
    const isDealMeeting = Boolean(task.dealId && task.taskType === 'meeting');
    const source: CalendarEventSource = isDealMeeting ? 'deal_meeting' : 'task';
    const overdue = !task.completed && startMs < nowMs;

    if (isDealMeeting && task.dealId && !task.completed) {
      dealsWithOpenMeetings.add(task.dealId);
    }

    const colors = resolveEventColors({
      source,
      taskType: task.taskType,
      completed: task.completed,
      overdue,
    });

    events.push({
      id: `task:${task.id}`,
      sourceId: task.id,
      source,
      title: task.title,
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
      durationMinutes,
      taskType: task.taskType,
      completed: task.completed,
      overdue,
      editable: canEdit,
      dealId: task.dealId,
      dealTitle: task.dealTitle ?? linkedDeal?.title ?? null,
      contactName: linkedDeal?.contactName ?? null,
      companyName: linkedDeal?.companyName ?? null,
      assigneeId: task.assigneeId,
      assigneeName: task.assigneeName,
      ...colors,
    });
  }

  if (includeHarnessSuggestions) {
    for (const deal of deals) {
      if (deal.isWon || deal.isLost) continue;
      const nextStep = deal.harnessAnalysis?.nextStep;
      if (!nextStep || nextStep.actionType !== 'meeting') continue;
      if (dealsWithOpenMeetings.has(deal.id)) continue;

      const startMs = new Date(nextStep.suggestedDueAt).getTime();
      if (!Number.isFinite(startMs)) continue;
      const durationMinutes = 60;
      const endMs = startMs + durationMinutes * 60_000;
      const colors = resolveEventColors({
        source: 'harness_suggestion',
        taskType: 'meeting',
        completed: false,
        overdue: false,
      });

      events.push({
        id: `harness:${deal.id}`,
        sourceId: deal.id,
        source: 'harness_suggestion',
        title: `План: ${nextStep.title}`,
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
        durationMinutes,
        taskType: 'meeting',
        completed: false,
        overdue: false,
        editable: canEdit,
        dealId: deal.id,
        dealTitle: deal.title,
        contactName: deal.contactName ?? null,
        companyName: deal.companyName ?? null,
        assigneeId: deal.ownerId,
        assigneeName: deal.ownerName,
        rationale: nextStep.rationale,
        ...colors,
      });
    }
  }

  return events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

export function filterCalendarEvents(
  events: CrmCalendarEventRecord[],
  filters: {
    sourceFilter: 'all' | CalendarEventSource;
    assigneeFilter: string;
    showCompleted: boolean;
    search: string;
  }
): CrmCalendarEventRecord[] {
  const q = filters.search.trim().toLowerCase();
  return events.filter((ev) => {
    if (filters.sourceFilter !== 'all' && ev.source !== filters.sourceFilter) return false;
    if (filters.assigneeFilter !== 'all' && ev.assigneeId !== filters.assigneeFilter) return false;
    if (!filters.showCompleted && ev.completed) return false;
    if (!q) return true;
    return (
      ev.title.toLowerCase().includes(q) ||
      (ev.dealTitle || '').toLowerCase().includes(q) ||
      (ev.contactName || '').toLowerCase().includes(q) ||
      (ev.companyName || '').toLowerCase().includes(q) ||
      ev.assigneeName.toLowerCase().includes(q)
    );
  });
}

export function toLocalDateTimeInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
