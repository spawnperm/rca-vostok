import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  Clock,
  LogIn,
  Save,
  ShieldAlert,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import {
  addCalendarDaysIso,
  evaluateAttestationExpiry,
  formatIsoDateRu,
  pickRecommendedReattestationSession,
  REATTESTATION_WARNING_MONTHS,
} from '../domain/certification/AttestationExpiryMonitor';
import { getInPersonExamSchedule } from '../utils/attestationCalendarBooking';
import { ApiError, identityApi, type SessionUser } from '../utils/identityApi';
import { tracker } from '../utils/tracker';
import type { InquiryRecord } from './social/MyInquiriesSection';

interface AttestationExpiryMonitorWidgetProps {
  user: SessionUser | null;
  inquiries?: InquiryRecord[];
  onUserUpdated?: (user: SessionUser) => void;
  onBookReattestation?: (params: {
    recommendedSessionDate?: string;
    note: string;
  }) => void;
  onJumpToProfile?: () => void;
  onFocusAuth?: () => void;
}

const GUEST_PREVIEW_STORAGE_KEY = 'rca-guest-attestation-expiry-preview';

function getDefaultTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const AttestationExpiryMonitorWidget: React.FC<
  AttestationExpiryMonitorWidgetProps
> = ({
  user,
  inquiries = [],
  onUserUpdated,
  onBookReattestation,
  onJumpToProfile,
  onFocusAuth,
}) => {
  const [guestPreviewDate, setGuestPreviewDate] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return window.localStorage.getItem(GUEST_PREVIEW_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  const [draftDate, setDraftDate] = useState<string>(user?.attestationExpiresAt ?? '');
  const [editingDate, setEditingDate] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    setDraftDate(user?.attestationExpiresAt ?? '');
    setSaveError(null);
    setSaveSuccess(null);
    setEditingDate(false);
  }, [user?.id, user?.attestationExpiresAt]);

  const effectiveExpiresAtIso = user
    ? (user.attestationExpiresAt ?? null)
    : guestPreviewDate || null;

  const evaluation = useMemo(
    () =>
      evaluateAttestationExpiry({
        expiresAtIso: effectiveExpiresAtIso,
        inquiries,
      }),
    [effectiveExpiresAtIso, inquiries]
  );

  const recommendedSession = useMemo(() => {
    const sessions = getInPersonExamSchedule();
    return pickRecommendedReattestationSession(sessions, evaluation.expiresAtIso);
  }, [evaluation.expiresAtIso]);

  const canEditOwnProfile = Boolean(user?.permissions?.includes('profile:edit_own'));

  const handleSaveExpiryToProfile = async (targetIso: string | null) => {
    if (!user) {
      const next = targetIso ?? '';
      setGuestPreviewDate(next);
      try {
        if (next) {
          window.localStorage.setItem(GUEST_PREVIEW_STORAGE_KEY, next);
        } else {
          window.localStorage.removeItem(GUEST_PREVIEW_STORAGE_KEY);
        }
      } catch {
        // ignore storage restrictions
      }
      setEditingDate(false);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const updated = await identityApi.updateProfile({
        attestationExpiresAt: targetIso || null,
      });
      onUserUpdated?.(updated);
      setEditingDate(false);
      setSaveSuccess(
        updated.attestationExpiresAt
          ? `Дата окончания аттестации (${formatIsoDateRu(updated.attestationExpiresAt)}) сохранена в профиле.`
          : 'Дата окончания аттестации очищена в профиле.'
      );
      tracker.trackCustomInteraction(
        'Монитор аттестации · Обновлена дата в профиле',
        updated.attestationExpiresAt ?? 'cleared'
      );
    } catch (err) {
      setSaveError(
        err instanceof ApiError ? err.message : 'Не удалось сохранить дату аттестации в профиль.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerReattestation = () => {
    const expiryLabel = evaluation.expiresAtFormatted ?? 'не указана';
    const note =
      evaluation.status === 'expired'
        ? `Срочная переаттестация инструктора-проводника (предыдущая аттестация истекла ${expiryLabel}).`
        : `Плановая переаттестация инструктора-проводника (срок действующей аттестации до ${expiryLabel}).`;

    tracker.trackCustomInteraction(
      'Монитор аттестации · Кнопка Записаться на переаттестацию',
      evaluation.status
    );

    if (onBookReattestation) {
      onBookReattestation({
        recommendedSessionDate: recommendedSession?.start,
        note,
      });
    } else if (onFocusAuth) {
      onFocusAuth();
    }
  };

  const containerStyle =
    evaluation.status === 'expired'
      ? 'bg-rose-50/70 border-rose-300'
      : evaluation.status === 'expiring_soon'
        ? 'bg-amber-50/80 border-amber-300'
        : evaluation.status === 'active'
          ? 'bg-emerald-50/50 border-emerald-200'
          : 'bg-white border-slate-200';

  const badgeStyle =
    evaluation.status === 'expired'
      ? 'bg-rose-100 text-rose-900 border-rose-300'
      : evaluation.status === 'expiring_soon'
        ? 'bg-amber-100 text-amber-900 border-amber-300'
        : evaluation.status === 'active'
          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
          : 'bg-slate-100 text-slate-700 border-slate-200';

  const progressRatio = useMemo(() => {
    if (evaluation.daysRemaining === null) return 0;
    if (evaluation.daysRemaining <= 0) return 100;
    // Highlight 90-day (3-month) warning window at the right edge of timeline bar
    const windowDays = REATTESTATION_WARNING_MONTHS * 30;
    const capped = Math.min(evaluation.daysRemaining, 365);
    if (capped <= windowDays) {
      return Math.min(98, Math.round(100 - (capped / windowDays) * 35));
    }
    return Math.max(12, Math.round(65 - ((capped - windowDays) / (365 - windowDays)) * 53));
  }, [evaluation.daysRemaining]);

  return (
    <section
      id="attestation-expiry-monitor"
      aria-labelledby="attestation-expiry-monitor-heading"
      className={`border rounded-xl p-5 sm:p-6 space-y-4 scroll-mt-24 transition-colors ${containerStyle}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-teal-800 inline-flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Монитор срока аттестации · контроль за 3 месяца</span>
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-[11px] font-semibold ${badgeStyle}`}
            >
              {evaluation.status === 'expired' ? (
                <ShieldAlert className="w-3 h-3 shrink-0" aria-hidden="true" />
              ) : evaluation.status === 'expiring_soon' ? (
                <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
              ) : evaluation.status === 'active' ? (
                <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
              ) : (
                <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
              )}
              <span>{evaluation.badgeLabel}</span>
            </span>
          </div>

          <h3
            id="attestation-expiry-monitor-heading"
            className="text-base sm:text-lg font-bold text-slate-900"
          >
            {evaluation.headline}
          </h3>

          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            {evaluation.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {evaluation.showReattestationWarning && (
            <button
              type="button"
              onClick={handleTriggerReattestation}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 ${
                evaluation.status === 'expired'
                  ? 'bg-rose-700 hover:bg-rose-800 text-white focus-visible:outline-rose-700'
                  : 'bg-amber-700 hover:bg-amber-800 text-white focus-visible:outline-amber-700'
              }`}
            >
              <CalendarCheck2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Записаться на переаттестацию</span>
            </button>
          )}

          {evaluation.status === 'active' && (
            <button
              type="button"
              onClick={handleTriggerReattestation}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-emerald-300 text-emerald-900 text-xs font-semibold rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer"
            >
              <CalendarCheck2 className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
              <span>Записаться на переаттестацию</span>
            </button>
          )}

          {(canEditOwnProfile || !user) && (
            <button
              type="button"
              onClick={() => setEditingDate((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <UserCog className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>
                {editingDate
                  ? 'Скрыть настройку'
                  : evaluation.expiresAtIso
                    ? 'Изменить дату'
                    : 'Указать дату в профиле'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Mandatory 3-month alert strip when expiring soon or expired */}
      {evaluation.showReattestationWarning && (
        <div
          role="alert"
          className={`rounded-lg border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
            evaluation.status === 'expired'
              ? 'bg-rose-100/90 border-rose-300 text-rose-950'
              : 'bg-amber-100/80 border-amber-300 text-amber-950'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                evaluation.status === 'expired' ? 'text-rose-700' : 'text-amber-700'
              }`}
              aria-hidden="true"
            />
            <div className="space-y-0.5">
              <p className="font-semibold">
                {evaluation.status === 'expired'
                  ? 'Требуется переаттестация: срок действия свидетельства истёк.'
                  : `Предупреждение за 3 месяца: окно переаттестации открыто с ${evaluation.warningStartsAtFormatted}.`}
              </p>
              <p className="opacity-90">
                {evaluation.hasScheduledReattestation && evaluation.scheduledSessionDate
                  ? `В календаре уже зафиксирована заявка на сессию ${formatIsoDateRu(evaluation.scheduledSessionDate)}.`
                  : recommendedSession
                    ? `Рекомендуемая ближайшая экзаменационная сессия: ${recommendedSession.rangeLabel} (${recommendedSession.venue}).`
                    : 'Выберите доступный экзаменационный поток в календаре аттестаций.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTriggerReattestation}
            className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg font-semibold shrink-0 transition-colors cursor-pointer ${
              evaluation.status === 'expired'
                ? 'bg-rose-700 hover:bg-rose-800 text-white'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            <CalendarCheck2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Записаться на переаттестацию</span>
          </button>
        </div>
      )}

      {/* Key dates summary strip when a date is configured */}
      {evaluation.expiresAtIso && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-white/90 border border-slate-200 rounded-lg px-3.5 py-2.5">
            <p className="text-[11px] text-slate-500">Дата истечения из профиля</p>
            <p className="font-bold text-slate-900 tabular-nums mt-0.5">
              {evaluation.expiresAtFormatted}
            </p>
          </div>
          <div className="bg-white/90 border border-slate-200 rounded-lg px-3.5 py-2.5">
            <p className="text-[11px] text-slate-500">Порог уведомления (−3 месяца)</p>
            <p className="font-bold text-slate-900 tabular-nums mt-0.5">
              {evaluation.warningStartsAtFormatted}
            </p>
          </div>
          <div className="bg-white/90 border border-slate-200 rounded-lg px-3.5 py-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Запас срока действия</span>
              <span className="font-semibold text-slate-800 tabular-nums">
                {evaluation.daysRemaining !== null && evaluation.daysRemaining >= 0
                  ? `${evaluation.daysRemaining} дн.`
                  : `просрочено ${Math.abs(evaluation.daysRemaining ?? 0)} дн.`}
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  evaluation.status === 'expired'
                    ? 'bg-rose-600'
                    : evaluation.status === 'expiring_soon'
                      ? 'bg-amber-600'
                      : 'bg-emerald-600'
                }`}
                style={{ width: `${progressRatio}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Inline editor / setup panel */}
      {(editingDate || evaluation.status === 'not_configured') && (
        <div className="bg-slate-50/90 border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            <label className="block space-y-1 flex-1 max-w-xs">
              <span className="text-xs font-medium text-slate-700">
                {user
                  ? 'Дата окончания аттестации в профиле'
                  : 'Тестовая дата окончания аттестации (предпросмотр)'}
              </span>
              <input
                type="date"
                aria-label="Дата окончания аттестации в профиле"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveExpiryToProfile(draftDate || null)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-60"
              >
                <Save className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
                <span>
                  {saving
                    ? 'Сохраняем…'
                    : user
                      ? 'Сохранить дату в профиль'
                      : 'Применить дату'}
                </span>
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  const sampleSoon = addCalendarDaysIso(getDefaultTodayIso(), 45);
                  setDraftDate(sampleSoon);
                  void handleSaveExpiryToProfile(sampleSoon);
                }}
                className="px-2.5 py-2 bg-white border border-amber-300 text-amber-900 text-[11px] font-medium rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
              >
                Через 45 дней (&lt; 3 мес.)
              </button>

              {onJumpToProfile && user && (
                <button
                  type="button"
                  onClick={onJumpToProfile}
                  className="px-2.5 py-2 bg-white border border-slate-300 text-slate-700 text-[11px] font-medium rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Открыть профиль
                </button>
              )}

              {!user && onFocusAuth && (
                <button
                  type="button"
                  onClick={onFocusAuth}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Войти в профиль</span>
                </button>
              )}
            </div>
          </div>

          {saveError && (
            <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
              {saveError}
            </p>
          )}
          {saveSuccess && (
            <p className="text-xs text-teal-900 bg-teal-50 border border-teal-200 rounded-md px-3 py-1.5 inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>{saveSuccess}</span>
            </p>
          )}
        </div>
      )}
    </section>
  );
};
