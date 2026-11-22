import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  RefreshCw,
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
import type { SiteTabId } from '../utils/seo';
import { tracker } from '../utils/tracker';

interface NotificationsModalProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: SiteTabId) => void;
}

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
  const [loading, setLoading] = useState<boolean>(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [examDateIso, setExamDateIso] = useState<string | undefined>(undefined);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const session = await identityApi.session();
      if (!session.authenticated || !session.user) {
        setUser(null);
        setInquiries([]);
        setExamDateIso(undefined);
        return;
      }

      setUser(session.user);
      const prefs = readStoredRoadmapPrefs(session.user.id);
      setExamDateIso(prefs.examDateIso);

      if (session.user.permissions.includes('inquiries:view_own')) {
        const res = await fetch('/api/account/inquiries', {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadData();
  }, [open, loadData]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const notifications = useMemo(
    () => buildDocumentStatusNotifications({ user, inquiries, examDateIso }),
    [user, inquiries, examDateIso]
  );

  if (!open) return null;

  const handleGoToAccount = () => {
    onClose();
    onNavigate('account');
    tracker.trackCustomInteraction('Переход в кабинет из окна уведомлений', 'header');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="header-notifications-modal-title"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 pb-6 bg-slate-900/50 backdrop-blur-xs"
    >
      {/* Backdrop click target */}
      <button
        type="button"
        aria-label="Закрыть уведомления"
        onClick={onClose}
        className="fixed inset-0 cursor-default"
      />

      <div className="relative z-10 bg-white border border-slate-200 rounded-xl shadow-xl max-w-lg w-full max-h-[82vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Bell className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h2
                id="header-notifications-modal-title"
                className="text-sm font-bold text-slate-900 truncate"
              >
                Уведомления о документах на аттестацию
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {user
                  ? `${user.fullName} · ${user.region}`
                  : 'Общие статусы приёма заявок и графика сессий'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              aria-label="Обновить статусы"
              title="Обновить статусы"
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
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
