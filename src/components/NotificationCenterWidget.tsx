import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  Clock,
  FileWarning,
  Info,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import type { SessionUser } from '../utils/identityApi';
import { tracker } from '../utils/tracker';
import type { InquiryRecord } from './social/MyInquiriesSection';
import { REGIONAL_SESSIONS_TIMELINE } from './RegionalSessionsTimeline';

type NotificationCategory = 'all' | 'status' | 'event';
type NotificationTone = 'info' | 'warning' | 'success' | 'danger';

interface SystemNotification {
  id: string;
  category: 'status' | 'event';
  categoryLabel: string;
  tone: NotificationTone;
  title: string;
  message: string;
  timestampLabel: string;
  metaLine: string;
  sortWeight: number;
  actionLabel?: string;
}

const READ_STORAGE_PREFIX = 'rca_notifications_read_v1:';
const SNAPSHOT_STORAGE_PREFIX = 'rca_inquiry_status_snapshot_v1:';

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const INQUIRY_STATUS_LABELS: Record<InquiryRecord['status'], string> = {
  new: 'Новая',
  in_review: 'На рассмотрении',
  needs_documents: 'Требуются документы',
  approved: 'Одобрена',
  rejected: 'Отклонена',
};

function readStringArray(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeStringArray(key: string, values: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // ignore storage errors
  }
}

function readStatusSnapshot(userId: string): Record<string, InquiryRecord['status']> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(`${SNAPSHOT_STORAGE_PREFIX}${userId}`);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, InquiryRecord['status']>;
  } catch {
    return {};
  }
}

function writeStatusSnapshot(userId: string, snapshot: Record<string, InquiryRecord['status']>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${SNAPSHOT_STORAGE_PREFIX}${userId}`, JSON.stringify(snapshot));
  } catch {
    // ignore storage errors
  }
}

function mapUserRegionToTimelineId(region: string): string {
  if (region.includes('Приморск')) return 'primorye';
  if (region.includes('Хабаровск')) return 'khabarovsk';
  if (region.includes('Камчат')) return 'kamchatka';
  if (region.includes('Сахалин')) return 'sakhalin';
  if (region.includes('Якут') || region.includes('Амур')) return 'yakutia-amur';
  if (region.includes('Магадан') || region.includes('Чукот')) return 'magadan-chukotka';
  return 'primorye';
}

function formatDateRu(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getDaysUntil(isoDate: string): number {
  const target = new Date(`${isoDate}T00:00:00Z`).getTime();
  const today = new Date(`${getTodayIso()}T00:00:00Z`).getTime();
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function getToneMeta(tone: NotificationTone): {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  labelColor: string;
} {
  switch (tone) {
    case 'success':
      return {
        icon: CheckCircle2,
        iconColor: 'text-emerald-700',
        labelColor: 'text-emerald-800',
      };
    case 'warning':
      return {
        icon: FileWarning,
        iconColor: 'text-amber-700',
        labelColor: 'text-amber-800',
      };
    case 'danger':
      return {
        icon: XCircle,
        iconColor: 'text-red-700',
        labelColor: 'text-red-800',
      };
    default:
      return {
        icon: Info,
        iconColor: 'text-teal-700',
        labelColor: 'text-teal-800',
      };
  }
}

interface NotificationCenterWidgetProps {
  user: SessionUser;
  inquiries: InquiryRecord[];
  inquiriesLoading?: boolean;
  onRefreshInquiries?: () => void;
  onOpenOverview?: () => void;
}

export const NotificationCenterWidget: React.FC<NotificationCenterWidgetProps> = ({
  user,
  inquiries,
  inquiriesLoading = false,
  onRefreshInquiries,
  onOpenOverview,
}) => {
  const [filter, setFilter] = useState<NotificationCategory>('all');
  const [readIds, setReadIds] = useState<string[]>(() =>
    readStringArray(`${READ_STORAGE_PREFIX}${user.id}`)
  );
  const [previousSnapshot, setPreviousSnapshot] = useState<Record<string, InquiryRecord['status']>>(
    () => readStatusSnapshot(user.id)
  );

  useEffect(() => {
    setReadIds(readStringArray(`${READ_STORAGE_PREFIX}${user.id}`));
    setPreviousSnapshot(readStatusSnapshot(user.id));
  }, [user.id]);

  // Persist new inquiry status snapshot whenever inquiries change, preserving transition detection for this render
  useEffect(() => {
    if (inquiries.length === 0) return;
    const nextSnapshot: Record<string, InquiryRecord['status']> = {};
    for (const inq of inquiries) {
      nextSnapshot[inq.id] = inq.status;
    }
    writeStatusSnapshot(user.id, nextSnapshot);
  }, [user.id, inquiries]);

  // Listen for server-side inquiry status changes via existing SSE stream
  useEffect(() => {
    if (!onRefreshInquiries || typeof EventSource === 'undefined') return;
    let isFirstMessage = true;
    const source = new EventSource('/api/inquiries/stats/stream');
    source.onmessage = () => {
      if (isFirstMessage) {
        isFirstMessage = false;
        return;
      }
      onRefreshInquiries();
    };
    return () => {
      source.close();
    };
  }, [onRefreshInquiries]);

  const notifications = useMemo<SystemNotification[]>(() => {
    const list: SystemNotification[] = [];
    const userTimelineRegion = mapUserRegionToTimelineId(user.region);

    // 1. Inquiry status notifications from real user inquiries
    inquiries.forEach((inq, idx) => {
      const prevStatus = previousSnapshot[inq.id];
      const statusChanged = Boolean(prevStatus && prevStatus !== inq.status);
      const statusLabel = INQUIRY_STATUS_LABELS[inq.status];

      let tone: NotificationTone = 'info';
      let title = `Заявка «${inq.track}» зарегистрирована`;
      let message =
        'Заявка принята в очередь РЦА «Русский Восток». Куратор проверит анкету и свяжется для сверки комплекта документов.';

      if (inq.status === 'in_review') {
        tone = 'warning';
        title = statusChanged
          ? `Статус заявки изменён: «На рассмотрении»`
          : `Заявка «${inq.track}» на рассмотрении комиссии`;
        message = statusChanged
          ? `Статус переведён с «${INQUIRY_STATUS_LABELS[prevStatus!]}» на «На рассмотрении». Подготовьте медсправку и паспорт маршрута (ПП № 760).`
          : 'Приёмная комиссия проверяет подтверждение походного стажа и медицинский допуск к аттестационной сессии.';
      } else if (inq.status === 'needs_documents') {
        tone = 'warning';
        title = `Требуются документы по заявке «${inq.track}»`;
        message =
          inq.statusComment?.trim() ||
          'Комиссия запросила дополнительные сведения: приложите подтверждение походного стажа, медсправку или паспорт маршрута (ПП № 760).';
      } else if (inq.status === 'approved') {
        tone = 'success';
        title = statusChanged
          ? `Заявка одобрена: открыт допуск к аттестации`
          : `Заявка «${inq.track}» одобрена РЦА`;
        message = statusChanged
          ? `Статус обновлён с «${INQUIRY_STATUS_LABELS[prevStatus!]}» на «Одобрена». Вы включены в ближайший поток подготовки и экзамена.`
          : 'Пакет документов согласован. Доступен выбор ближайшей экзаменационной сессии в вашем регионе ДФО.';
      } else if (inq.status === 'rejected') {
        tone = 'danger';
        title = `Требуется корректировка заявки «${inq.track}»`;
        message =
          'Заявка отклонена по текущему комплекту сведений. Уточните стаж или категорию маршрута и направьте обновлённую заявку.';
      }

      list.push({
        id: `inq-${inq.id}-${inq.status}`,
        category: 'status',
        categoryLabel: `Статус: ${statusLabel}`,
        tone,
        title,
        message,
        timestampLabel: formatDateRu(inq.createdAt),
        metaLine: `${inq.region} · ${inq.track}`,
        sortWeight: 100 - idx,
        actionLabel: inq.status === 'rejected' && onOpenOverview ? 'Подать повторно' : undefined,
      });
    });

    // Role / empty-inquiry system notices
    if (user.role === 'instructor') {
      list.push({
        id: `role-instructor-${user.id}`,
        category: 'status',
        categoryLabel: 'Статус реестра',
        tone: 'success',
        title: 'Подтверждён статус действующего инструктора-проводника',
        message:
          'Ваша учётная запись имеет действующие права аттестованного проводника. Отслеживайте сроки плановой переаттестации (раз в 5 лет).',
        timestampLabel: 'Активно',
        metaLine: `${user.region} · Реестровый статус`,
        sortWeight: 90,
      });
    } else if (inquiries.length === 0) {
      list.push({
        id: `no-inquiry-reminder-${user.id}`,
        category: 'status',
        categoryLabel: 'Статус соискателя',
        tone: 'info',
        title: 'Заявка на аттестацию ещё не подана',
        message:
          'Для участия в ближайшей экзаменационной сессии ДФО заполните форму заявки в разделе «Обзор центра» и укажите ваш туристский профиль.',
        timestampLabel: 'Системное сообщение',
        metaLine: `${user.region} · Ожидает подачи`,
        sortWeight: 85,
        actionLabel: onOpenOverview ? 'Перейти к подаче заявки' : undefined,
      });
    }

    // 2. Upcoming attestation sessions & deadlines from shared schedule
    const upcomingEvents = REGIONAL_SESSIONS_TIMELINE.filter((ev) => {
      const days = getDaysUntil(ev.isoTargetDate);
      return days >= 0;
    })
      .sort((a, b) => {
        const aMatchesRegion = a.regionId === userTimelineRegion ? 0 : 1;
        const bMatchesRegion = b.regionId === userTimelineRegion ? 0 : 1;
        if (aMatchesRegion !== bMatchesRegion) return aMatchesRegion - bMatchesRegion;
        return a.isoTargetDate.localeCompare(b.isoTargetDate);
      })
      .slice(0, 4);

    upcomingEvents.forEach((ev, idx) => {
      const daysLeft = getDaysUntil(ev.isoTargetDate);
      const isUserRegion = ev.regionId === userTimelineRegion;
      const isUrgent = daysLeft <= 30;

      list.push({
        id: `event-${ev.id}`,
        category: 'event',
        categoryLabel: isUserRegion ? `${ev.kindLabel} · Ваш регион` : ev.kindLabel,
        tone: ev.kind === 'deadline' && isUrgent ? 'warning' : 'info',
        title: ev.title,
        message: `${ev.submissionDeadline}. Площадка: ${ev.venue}.`,
        timestampLabel: `Через ${daysLeft} дн.`,
        metaLine: `${ev.shortDate} · ${ev.regionLabel}`,
        sortWeight: (isUserRegion ? 70 : 40) - idx,
        actionLabel: onOpenOverview ? 'Календарь сессий' : undefined,
      });
    });

    return list.sort((a, b) => b.sortWeight - a.sortWeight);
  }, [inquiries, onOpenOverview, previousSnapshot, user.id, user.region, user.role]);

  const readSet = useMemo(() => new Set(readIds), [readIds]);

  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications;
    return notifications.filter((n) => n.category === filter);
  }, [filter, notifications]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readSet.has(n.id)).length,
    [notifications, readSet]
  );

  const statusCount = useMemo(
    () => notifications.filter((n) => n.category === 'status').length,
    [notifications]
  );

  const eventsCount = useMemo(
    () => notifications.filter((n) => n.category === 'event').length,
    [notifications]
  );

  const markAsRead = (id: string) => {
    if (readSet.has(id)) return;
    const next = [...readIds, id];
    setReadIds(next);
    writeStringArray(`${READ_STORAGE_PREFIX}${user.id}`, next);
  };

  const toggleRead = (id: string) => {
    const next = readSet.has(id)
      ? readIds.filter((item) => item !== id)
      : [...readIds, id];
    setReadIds(next);
    writeStringArray(`${READ_STORAGE_PREFIX}${user.id}`, next);
  };

  const markAllRead = () => {
    const allIds = Array.from(new Set([...readIds, ...notifications.map((n) => n.id)]));
    setReadIds(allIds);
    writeStringArray(`${READ_STORAGE_PREFIX}${user.id}`, allIds);
    tracker.trackCustomInteraction('Уведомления кабинета: прочитать все', 'account');
  };

  return (
    <section
      aria-labelledby="notification-center-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
            <h3 id="notification-center-heading" className="text-base font-bold text-slate-900">
              Центр уведомлений
            </h3>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {unreadCount > 0 ? `· ${unreadCount} непрочитано` : '· все прочитаны'}
            </span>
          </div>
          <p className="text-sm text-slate-600">
            Системные сообщения об изменении статуса ваших заявок и ближайшие аттестационные
            мероприятия в регионе ({user.region}).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <CheckCheck className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>Прочитать все</span>
            </button>
          )}
          {onRefreshInquiries && (
            <button
              type="button"
              onClick={onRefreshInquiries}
              disabled={inquiriesLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${inquiriesLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Проверить</span>
            </button>
          )}
        </div>
      </div>

      {/* Segmented Category Filter */}
      <div
        role="tablist"
        aria-label="Фильтр уведомлений"
        className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
      >
        {(
          [
            { id: 'all', label: `Все (${notifications.length})` },
            { id: 'status', label: `Статусы заявок (${statusCount})` },
            { id: 'event', label: `Мероприятия (${eventsCount})` },
          ] as { id: NotificationCategory; label: string }[]
        ).map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setFilter(tab.id);
                tracker.trackCustomInteraction(`Уведомления: фильтр ${tab.id}`, 'account');
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                active
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Notification List */}
      {filteredNotifications.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
          В выбранной категории нет системных сообщений.
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 border-t border-slate-200">
          {filteredNotifications.map((item) => {
            const isRead = readSet.has(item.id);
            const toneMeta = getToneMeta(item.tone);
            const Icon = item.category === 'event' ? CalendarClock : toneMeta.icon;

            return (
              <li
                key={item.id}
                className={`py-4 transition-colors ${isRead ? 'opacity-75' : 'bg-slate-50/50 -mx-3 px-3 rounded-lg'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="mt-0.5 shrink-0">
                      <Icon
                        className={`w-4 h-4 ${
                          item.category === 'event' ? 'text-teal-700' : toneMeta.iconColor
                        }`}
                        aria-hidden="true"
                      />
                    </span>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span className={`font-semibold ${toneMeta.labelColor}`}>
                          {item.categoryLabel}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="text-slate-500 font-mono tabular-nums">
                          {item.timestampLabel}
                        </span>
                        {!isRead && (
                          <>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className="font-semibold text-teal-700">Новое</span>
                          </>
                        )}
                      </div>

                      <p className="text-sm font-semibold text-slate-900 leading-snug">
                        {item.title}
                      </p>

                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {item.message}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-slate-500">{item.metaLine}</span>

                        <div className="flex items-center gap-3">
                          {item.actionLabel && onOpenOverview && (
                            <button
                              type="button"
                              onClick={() => {
                                markAsRead(item.id);
                                onOpenOverview();
                              }}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <span>{item.actionLabel}</span>
                              <ArrowRight className="w-3 h-3" aria-hidden="true" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => toggleRead(item.id)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {isRead ? (
                              <>
                                <Clock className="w-3 h-3" aria-hidden="true" />
                                <span>Отметить новым</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-teal-700" aria-hidden="true" />
                                <span>Прочитано</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
