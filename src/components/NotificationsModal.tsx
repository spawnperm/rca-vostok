import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellRing,
  Briefcase,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  RefreshCw,
  Send,
  SlidersHorizontal,
  X,
  XCircle,
} from 'lucide-react';
import { identityApi, type SessionUser } from '../utils/identityApi';
import type { InquiryRecord } from './social/MyInquiriesSection';
import { readStoredRoadmapPrefs } from '../utils/personalRoadmap';
import {
  buildDocumentStatusNotifications,
  type DocumentStatusTone,
} from '../utils/documentStatusNotifications';
import {
  getBrowserPushPermissionStatus,
  matchPersonalizedPushAlerts,
  readNotificationSubscriptionPrefs,
  requestBrowserPushPermission,
  saveNotificationSubscriptionPrefs,
  sendBrowserPushNotification,
  SUBSCRIPTION_ATTESTATION_CATEGORIES,
  SUBSCRIPTION_DFO_REGIONS,
  type BrowserPushPermissionStatus,
  type NotificationSubscriptionPrefs,
  type PersonalizedPushAlertItem,
} from '../utils/notificationSubscriptions';
import type { SiteTabId } from '../utils/seo';
import { tracker } from '../utils/tracker';

interface NotificationsModalProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: SiteTabId) => void;
}

type ModalTab = 'documents' | 'feed' | 'subscriptions';

function getStatusIcon(tone: DocumentStatusTone, isExam: boolean) {
  if (isExam && tone === 'success') {
    return <CalendarCheck2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />;
  }
  switch (tone) {
    case 'success':
      return <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />;
    case 'danger':
      return <XCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" aria-hidden="true" />;
    case 'info':
      return <Clock className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />;
  }
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  open,
  onClose,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('documents');
  const [loading, setLoading] = useState<boolean>(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [examDateIso, setExamDateIso] = useState<string | undefined>(undefined);

  const [subPrefs, setSubPrefs] = useState<NotificationSubscriptionPrefs>(() =>
    readNotificationSubscriptionPrefs()
  );
  const [pushPermission, setPushPermission] = useState<BrowserPushPermissionStatus>(() =>
    getBrowserPushPermissionStatus()
  );
  const [pushNotice, setPushNotice] = useState<string | null>(null);
  const modalPanelRef = useRef<HTMLDivElement | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const session = await identityApi.session();
      if (!session.authenticated || !session.user) {
        setUser(null);
        setInquiries([]);
        setExamDateIso(undefined);
        setSubPrefs(readNotificationSubscriptionPrefs());
        return;
      }

      setUser(session.user);
      setSubPrefs(readNotificationSubscriptionPrefs(session.user.id, session.user.region));
      const prefs = readStoredRoadmapPrefs(session.user.id);
      setExamDateIso(prefs.examDateIso);

      if (session.user.permissions.includes('inquiries:view_own')) {
        const res = await fetch('/api/account/inquiries', {
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
            'X-Requested-With': 'fetch',
          },
        });
        if (res.ok) {
          const data = (await res.json()) as { inquiries?: InquiryRecord[] };
          setInquiries(data.inquiries ?? []);
        } else {
          setInquiries([]);
        }
      } else {
        setInquiries([]);
      }
    } catch {
      setUser(null);
      setInquiries([]);
      setExamDateIso(undefined);
      setSubPrefs(readNotificationSubscriptionPrefs());
    } finally {
      setPushPermission(getBrowserPushPermissionStatus());
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setPushNotice(null);
    void loadData();
  }, [open, loadData]);

  useEffect(() => {
    if (!open) return;
    const previousFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const firstFocusable = modalPanelRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'Tab' && modalPanelRef.current) {
        const focusable = Array.from(
          modalPanelRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocused?.focus?.();
    };
  }, [open, onClose]);

  const notifications = useMemo(
    () => buildDocumentStatusNotifications({ user, inquiries, examDateIso }),
    [user, inquiries, examDateIso]
  );

  const matchedAlerts = useMemo(() => matchPersonalizedPushAlerts(subPrefs), [subPrefs]);

  if (!open) return null;

  const updatePrefs = (updater: (prev: NotificationSubscriptionPrefs) => NotificationSubscriptionPrefs) => {
    setSubPrefs((prev) => {
      const next = saveNotificationSubscriptionPrefs(updater(prev), user?.id);
      return next;
    });
  };

  const toggleRegion = (regionId: string) => {
    setPushNotice(null);
    updatePrefs((prev) => {
      const exists = prev.regions.includes(regionId);
      const regions = exists
        ? prev.regions.filter((id) => id !== regionId)
        : [...prev.regions, regionId];
      return { ...prev, regions };
    });
    tracker.trackCustomInteraction('Уведомления · подписка на регион ДФО', regionId);
  };

  const toggleCategory = (categoryId: string) => {
    setPushNotice(null);
    updatePrefs((prev) => {
      const exists = prev.categories.includes(categoryId);
      const categories = exists
        ? prev.categories.filter((id) => id !== categoryId)
        : [...prev.categories, categoryId];
      return { ...prev, categories };
    });
    tracker.trackCustomInteraction('Уведомления · подписка на категорию', categoryId);
  };

  const handleTogglePushChannel = async () => {
    if (subPrefs.pushEnabled) {
      updatePrefs((prev) => ({ ...prev, pushEnabled: false }));
      setPushNotice('Push-уведомления приостановлены. Параметры регионов и категорий сохранены.');
      tracker.trackCustomInteraction('Уведомления · отключение push-подписки', 'header_modal');
      return;
    }

    const perm = await requestBrowserPushPermission();
    setPushPermission(perm);

    updatePrefs((prev) => ({ ...prev, pushEnabled: true }));

    if (perm === 'granted') {
      const topAlert = matchedAlerts[0];
      if (topAlert) {
        const res = sendBrowserPushNotification(topAlert);
        setPushNotice(
          `Подписка на push-уведомления активирована (${subPrefs.regions.length} рег., ${subPrefs.categories.length} катег.). ${res.message}`
        );
      } else {
        setPushNotice('Push-уведомления в браузере разрешены и активированы.');
      }
    } else if (perm === 'denied') {
      setPushNotice(
        'Подписка сохранена в ленте кабинета. Чтобы получать системные push-баннеры, разрешите уведомления для сайта в настройках браузера.'
      );
    } else {
      setPushNotice(
        'Персональная подписка активирована. События по выбранным регионам ДФО и категориям собраны во вкладке «Персональные push».'
      );
    }

    tracker.trackCustomInteraction(
      'Уведомления · активация push-подписки',
      `${subPrefs.regions.length}_regions_${subPrefs.categories.length}_cats`
    );
  };

  const handleSendTestPush = (alertItem?: PersonalizedPushAlertItem) => {
    const target = alertItem ?? matchedAlerts[0];
    if (!target) {
      setPushNotice('Выберите хотя бы один регион ДФО и категорию аттестации для проверки уведомлений.');
      return;
    }
    const res = sendBrowserPushNotification(target);
    setPushNotice(res.message);
    tracker.trackCustomInteraction('Уведомления · отправка push-превью', target.id);
  };

  const handleSelectAllRegions = () => {
    setPushNotice(null);
    updatePrefs((prev) => ({
      ...prev,
      regions: SUBSCRIPTION_DFO_REGIONS.map((r) => r.id),
    }));
  };

  const handleGoToAccount = () => {
    onClose();
    onNavigate('account');
    tracker.trackCustomInteraction('Переход в кабинет из окна уведомлений', 'header');
  };

  const handleOpenAlertTarget = (item: PersonalizedPushAlertItem) => {
    onClose();
    onNavigate(item.kind === 'commission' ? 'certification' : 'market');
    tracker.trackCustomInteraction(`Уведомления · переход по алерту: ${item.kindLabel}`, item.id);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="header-notifications-modal-title"
      className="fixed inset-0 z-50 flex items-start justify-center pt-14 px-4 pb-6 bg-slate-900/50 backdrop-blur-xs"
    >
      {/* Backdrop click target */}
      <button
        type="button"
        aria-label="Закрыть уведомления"
        onClick={onClose}
        className="fixed inset-0 cursor-default"
      />

      <div
        ref={modalPanelRef}
        className="relative z-10 bg-white border border-slate-200 rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Bell className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <h2
                  id="header-notifications-modal-title"
                  className="text-sm font-bold text-slate-900 truncate"
                >
                  Уведомления и персональные подписки
                </h2>
                <p className="text-xs text-slate-500 truncate">
                  {user
                    ? `${user.fullName} · ${user.region}`
                    : 'Статусы заявок, вакансии ДФО и расписание комиссий'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                aria-label="Обновить уведомления"
                title="Обновить уведомления"
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? 'animate-spin text-teal-700' : ''}`}
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть окно уведомлений"
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Segmented Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              role="tablist"
              aria-label="Разделы уведомлений"
              className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              <button
                id="notif-tab-documents"
                type="button"
                role="tab"
                aria-selected={activeTab === 'documents'}
                aria-controls="notif-panel-documents"
                onClick={() => setActiveTab('documents')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'documents'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Документы ({notifications.length})
              </button>
              <button
                id="notif-tab-feed"
                type="button"
                role="tab"
                aria-selected={activeTab === 'feed'}
                aria-controls="notif-panel-feed"
                onClick={() => setActiveTab('feed')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'feed'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Вакансии и комиссии ({matchedAlerts.length})
              </button>
              <button
                id="notif-tab-subscriptions"
                type="button"
                role="tab"
                aria-selected={activeTab === 'subscriptions'}
                aria-controls="notif-panel-subscriptions"
                onClick={() => setActiveTab('subscriptions')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'subscriptions'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Настройка push</span>
              </button>
            </div>

            <span className="text-[11px] text-slate-500 font-mono tabular-nums">
              {subPrefs.pushEnabled ? 'Push включён' : 'Push выключен'} · {subPrefs.regions.length} рег. ·{' '}
              {subPrefs.categories.length} катег.
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {pushNotice && (
            <p
              role="status"
              className="text-xs text-teal-900 bg-teal-50 border border-teal-200 rounded-lg px-3.5 py-2.5 leading-relaxed font-medium"
            >
              {pushNotice}
            </p>
          )}

          {activeTab === 'documents' && (
            <div id="notif-panel-documents" role="tabpanel" aria-labelledby="notif-tab-documents">
              {loading ? (
                <div role="status" className="space-y-3 py-2">
                  {[0, 1, 2].map((idx) => (
                    <div key={idx} className="space-y-2 py-2 border-b border-slate-100 last:border-b-0">
                      <div className="h-3.5 w-1/3 bg-slate-100 rounded" />
                      <div className="h-4 w-3/4 bg-slate-100 rounded" />
                      <div className="h-3 w-full bg-slate-100 rounded" />
                    </div>
                  ))}
                  <p className="text-xs text-slate-500">Загружаем статусы документов…</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {notifications.map((item) => {
                    const isExam = item.id.includes('exam');
                    return (
                      <li key={item.id} className="py-3.5 first:pt-1 last:pb-1">
                        <div className="flex items-start gap-3">
                          {getStatusIcon(item.tone, isExam)}
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="font-medium text-teal-800">{item.statusLabel}</span>
                              <span className="font-mono text-slate-500 tabular-nums">
                                {item.dateLabel}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-slate-900 leading-snug">
                              {item.title}
                            </p>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'feed' && (
            <div
              id="notif-panel-feed"
              role="tabpanel"
              aria-labelledby="notif-tab-feed"
              className="space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs">
                <span className="text-slate-600">
                  Подборка по подписке:{' '}
                  <strong className="text-slate-900 font-semibold">
                    {subPrefs.regions.length > 0
                      ? `${subPrefs.regions.length} рег. ДФО`
                      : 'регионы не выбраны'}
                  </strong>{' '}
                  ·{' '}
                  <strong className="text-slate-900 font-semibold">
                    {subPrefs.categories.length > 0
                      ? `${subPrefs.categories.length} катег.`
                      : 'категории не выбраны'}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('subscriptions')}
                  className="text-teal-700 hover:text-teal-900 font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Изменить подписки
                </button>
              </div>

              {matchedAlerts.length === 0 ? (
                <div className="border border-slate-200 rounded-xl p-6 text-center space-y-3">
                  <p className="text-sm font-semibold text-slate-900">
                    По текущим фильтрам подписки новых уведомлений нет
                  </p>
                  <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                    Выберите интересующие субъекты ДФО, категории сложности или включите получение
                    вакансий и дат комиссий во вкладке «Настройка push».
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('subscriptions')}
                    className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Настроить регионы и категории
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {matchedAlerts.map((item) => (
                    <li key={item.id} className="py-3.5 first:pt-1 last:pb-1 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          {item.kind === 'vacancy' ? (
                            <Briefcase className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                          ) : (
                            <CalendarDays
                              className="w-3.5 h-3.5 text-amber-700 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          <span
                            className={`font-semibold ${
                              item.kind === 'vacancy' ? 'text-teal-800' : 'text-amber-800'
                            }`}
                          >
                            {item.kindLabel}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-slate-700">{item.regionName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-500">{item.categoryLabel}</span>
                        </div>
                        <span className="font-mono text-slate-500 tabular-nums">
                          {item.dateOrDeadline}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-slate-900 leading-snug">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed">{item.summary}</p>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                        <span className="text-slate-500 font-mono tabular-nums">
                          {item.organization} · {item.compensationOrSeats}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSendTestPush(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Send className="w-3 h-3" aria-hidden="true" />
                            <span>Push-тест</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenAlertTarget(item)}
                            className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <span>
                              {item.kind === 'commission' ? 'В календарь' : 'К рынку ДФО'}
                            </span>
                            <ArrowRight className="w-3 h-3" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'subscriptions' && (
            <div
              id="notif-panel-subscriptions"
              role="tabpanel"
              aria-labelledby="notif-tab-subscriptions"
              className="space-y-5"
            >
              {/* Browser Push Activation Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Персональные push-уведомления
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Мгновенные оповещения о новых вакансиях туроператоров и открытии дат комиссий РЦА.
                    Статус браузера:{' '}
                    <span className="font-mono font-semibold text-slate-800">
                      {pushPermission === 'granted'
                        ? 'разрешены'
                        : pushPermission === 'denied'
                        ? 'заблокированы в браузере'
                        : pushPermission === 'unsupported'
                        ? 'встроенная лента'
                        : 'ожидает разрешения'}
                    </span>
                    .
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleTogglePushChannel()}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      subPrefs.pushEnabled
                        ? 'bg-slate-900 hover:bg-slate-800 text-white'
                        : 'bg-teal-700 hover:bg-teal-800 text-white'
                    }`}
                  >
                    {subPrefs.pushEnabled ? 'Приостановить push' : 'Включить push-уведомления'}
                  </button>

                  {subPrefs.pushEnabled && matchedAlerts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSendTestPush()}
                      className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Проверить push
                    </button>
                  )}
                </div>
              </div>

              {/* Event types */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Типы событий для рассылки
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-start gap-2.5 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={subPrefs.notifyVacancies}
                      onChange={(e) => {
                        setPushNotice(null);
                        updatePrefs((prev) => ({ ...prev, notifyVacancies: e.target.checked }));
                      }}
                      className="mt-0.5 accent-teal-700 cursor-pointer"
                    />
                    <span className="text-xs space-y-0.5">
                      <span className="block font-semibold text-slate-900">
                        Новые вакансии в ДФО
                      </span>
                      <span className="block text-slate-500">
                        Предложения туроператоров, нацпарков ООПТ и сезонных экспедиций
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={subPrefs.notifyCommissions}
                      onChange={(e) => {
                        setPushNotice(null);
                        updatePrefs((prev) => ({ ...prev, notifyCommissions: e.target.checked }));
                      }}
                      className="mt-0.5 accent-teal-700 cursor-pointer"
                    />
                    <span className="text-xs space-y-0.5">
                      <span className="block font-semibold text-slate-900">
                        Даты аттестационных комиссий
                      </span>
                      <span className="block text-slate-500">
                        Открытие записи на очные сессии ВВГУ и выездные комиссии РЦА
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              {/* DFO Regions Subscription */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Регионы ДФО ({subPrefs.regions.length}/{SUBSCRIPTION_DFO_REGIONS.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleSelectAllRegions}
                    className="text-xs font-medium text-teal-700 hover:text-teal-900 cursor-pointer"
                  >
                    Выбрать весь ДФО
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {SUBSCRIPTION_DFO_REGIONS.map((reg) => {
                    const active = subPrefs.regions.includes(reg.id);
                    return (
                      <button
                        key={reg.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleRegion(reg.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-teal-700 border-teal-700 text-white font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-teal-600'
                        }`}
                      >
                        {active && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                        <span>{reg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Attestation Categories Subscription */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Категории аттестации ({subPrefs.categories.length}/
                  {SUBSCRIPTION_ATTESTATION_CATEGORIES.length})
                </h4>

                <div className="flex flex-wrap gap-2">
                  {SUBSCRIPTION_ATTESTATION_CATEGORIES.map((cat) => {
                    const active = subPrefs.categories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleCategory(cat.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-slate-900 border-slate-900 text-white font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-500'
                        }`}
                      >
                        {active && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-600">
                  Подобрано событий по вашим фильтрам:{' '}
                  <strong className="font-mono text-slate-900 tabular-nums">
                    {matchedAlerts.length}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('feed')}
                  className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:text-teal-900 cursor-pointer"
                >
                  <span>Открыть подборку</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleGoToAccount}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900 cursor-pointer"
          >
            <span>{user ? 'Перейти в личный кабинет' : 'Войти для просмотра своих заявок'}</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
