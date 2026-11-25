import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client.ts';
import { deals, tasks, tenants, users } from '../db/schema.ts';
import { natsBus, type NatsMessage } from '../nats/eventBus.ts';

const UPCOMING_REMINDER_WINDOW_MS = 15 * 60 * 1000;
const OVERDUE_GRACE_MS = 5 * 60 * 1000;

export interface TaskDeadlineCheckResult {
  checkedCount: number;
  remindersPublished: number;
  deadlinesPublished: number;
  events: NatsMessage[];
}

let checkInFlight = false;

export async function checkTaskDeadlinesAndReminders(options?: {
  tenantId?: string;
  now?: Date;
  onlyWhenSubscribed?: boolean;
}): Promise<TaskDeadlineCheckResult> {
  if (checkInFlight) {
    return { checkedCount: 0, remindersPublished: 0, deadlinesPublished: 0, events: [] };
  }
  checkInFlight = true;

  try {
    const db = await getDb();
    const now = options?.now ?? new Date();
    const nowMs = now.getTime();

    const taskConditions = [eq(tasks.completed, false)];
    if (options?.tenantId) {
      taskConditions.push(eq(tasks.tenantId, options.tenantId));
    }

    const [openTasks, tenantRows, dealRows, userRows] = await Promise.all([
      db.select().from(tasks).where(and(...taskConditions)),
      db.select({ id: tenants.id, subdomain: tenants.subdomain }).from(tenants),
      db.select({ id: deals.id, title: deals.title }).from(deals),
      db.select({ id: users.id, fullName: users.fullName }).from(users),
    ]);

    const subdomainByTenant = new Map(tenantRows.map((t) => [t.id, t.subdomain]));
    const dealTitleById = new Map(dealRows.map((d) => [d.id, d.title]));
    const userNameById = new Map(userRows.map((u) => [u.id, u.fullName]));

    const events: NatsMessage[] = [];
    let remindersPublished = 0;
    let deadlinesPublished = 0;

    for (const task of openTasks) {
      if (options?.onlyWhenSubscribed && natsBus.listenerCount(`tenant:${task.tenantId}`) === 0) {
        continue;
      }

      const subdomain = subdomainByTenant.get(task.tenantId) || 'acme';
      const dealTitle = task.dealId ? dealTitleById.get(task.dealId) || null : null;
      const assigneeName = userNameById.get(task.assigneeId) || 'Исполнитель';
      const dueMs = task.dueAt.getTime();
      const reminderMs = task.reminderAt ? task.reminderAt.getTime() : null;

      // 1. Deadline reached / overdue alert
      if (!task.deadlineNotifiedAt && dueMs <= nowMs) {
        const overdueMs = nowMs - dueMs;
        const isOverdue = overdueMs > OVERDUE_GRACE_MS;
        const subject = isOverdue
          ? `crm.${subdomain}.task.deadline_overdue`
          : `crm.${subdomain}.task.deadline_due`;

        const msg = await natsBus.publish(
          task.tenantId,
          subject,
          'system_scheduler',
          {
            taskId: task.id,
            title: task.title,
            taskType: task.taskType,
            dealId: task.dealId,
            dealTitle,
            assigneeId: task.assigneeId,
            assigneeName,
            dueAt: task.dueAt.toISOString(),
            overdueMinutes: Math.max(0, Math.round(overdueMs / 60000)),
          }
        );

        await db
          .update(tasks)
          .set({
            deadlineNotifiedAt: now,
            reminderNotifiedAt: task.reminderNotifiedAt ?? now,
          })
          .where(and(eq(tasks.id, task.id), eq(tasks.tenantId, task.tenantId)));

        deadlinesPublished += 1;
        events.push(msg);
        continue;
      }

      // 2. Upcoming reminder alert (explicit reminderAt or 15-min pre-deadline window)
      if (!task.reminderNotifiedAt && dueMs > nowMs) {
        const explicitReminderDue = reminderMs !== null && reminderMs <= nowMs;
        const implicitUpcomingDue =
          reminderMs === null && dueMs - nowMs <= UPCOMING_REMINDER_WINDOW_MS;

        if (explicitReminderDue || implicitUpcomingDue) {
          const minutesLeft = Math.max(1, Math.ceil((dueMs - nowMs) / 60000));
          const msg = await natsBus.publish(
            task.tenantId,
            `crm.${subdomain}.task.reminder`,
            'system_scheduler',
            {
              taskId: task.id,
              title: task.title,
              taskType: task.taskType,
              dealId: task.dealId,
              dealTitle,
              assigneeId: task.assigneeId,
              assigneeName,
              dueAt: task.dueAt.toISOString(),
              reminderAt: task.reminderAt ? task.reminderAt.toISOString() : null,
              minutesLeft,
            }
          );

          await db
            .update(tasks)
            .set({ reminderNotifiedAt: now })
            .where(and(eq(tasks.id, task.id), eq(tasks.tenantId, task.tenantId)));

          remindersPublished += 1;
          events.push(msg);
        }
      }
    }

    return {
      checkedCount: openTasks.length,
      remindersPublished,
      deadlinesPublished,
      events,
    };
  } finally {
    checkInFlight = false;
  }
}

export async function sendManualTaskReminder(params: {
  tenantId: string;
  subdomain: string;
  taskId: string;
  actorId: string;
}): Promise<{ message: NatsMessage; task: typeof tasks.$inferSelect } | null> {
  const db = await getDb();
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, params.taskId), eq(tasks.tenantId, params.tenantId)));
  if (!task) return null;

  const [dealRows, userRows] = await Promise.all([
    task.dealId
      ? db
          .select({ id: deals.id, title: deals.title })
          .from(deals)
          .where(and(eq(deals.id, task.dealId), eq(deals.tenantId, params.tenantId)))
      : Promise.resolve([]),
    db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(and(eq(users.id, task.assigneeId), eq(users.tenantId, params.tenantId))),
  ]);

  const now = new Date();
  const diffMs = task.dueAt.getTime() - now.getTime();
  const isOverdue = !task.completed && diffMs < 0;
  const subject = isOverdue
    ? `crm.${params.subdomain}.task.deadline_overdue`
    : `crm.${params.subdomain}.task.reminder`;

  const message = await natsBus.publish(params.tenantId, subject, params.actorId, {
    taskId: task.id,
    title: task.title,
    taskType: task.taskType,
    dealId: task.dealId,
    dealTitle: dealRows[0]?.title || null,
    assigneeId: task.assigneeId,
    assigneeName: userRows[0]?.fullName || 'Исполнитель',
    dueAt: task.dueAt.toISOString(),
    reminderAt: task.reminderAt ? task.reminderAt.toISOString() : now.toISOString(),
    minutesLeft: diffMs > 0 ? Math.max(1, Math.ceil(diffMs / 60000)) : 0,
    overdueMinutes: diffMs < 0 ? Math.max(1, Math.round(Math.abs(diffMs) / 60000)) : 0,
    manual: true,
  });

  const [updated] = await db
    .update(tasks)
    .set({
      reminderNotifiedAt: now,
      ...(isOverdue ? { deadlineNotifiedAt: now } : {}),
    })
    .where(and(eq(tasks.id, task.id), eq(tasks.tenantId, params.tenantId)))
    .returning();

  return { message, task: updated || task };
}

export function startTaskDeadlineMonitor(intervalMs = 15000): { stop: () => void } {
  const timer = setInterval(() => {
    void checkTaskDeadlinesAndReminders({ onlyWhenSubscribed: true }).catch((err) => {
      console.error('Task deadline NATS monitor error:', err);
    });
  }, intervalMs);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  return {
    stop: () => clearInterval(timer),
  };
}
