import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileWarning,
  ListChecks,
  LogIn,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import type { SessionUser } from '../utils/identityApi';
import type { InquiryRecord } from './social/MyInquiriesSection';
import {
  buildApplicationProgressModel,
  type ApplicationProgressModel,
  type ApplicationStepVisualState,
} from '../utils/applicationProgress';
import { formatDate } from '../utils/format';

export interface ApplicationProgressIndicatorProps {
  user: SessionUser | null;
  inquiries: InquiryRecord[];
  inquiriesLoading?: boolean;
  overallChecklistPercent?: number;
  onRefreshInquiries?: () => void;
  onJumpToCalendar?: () => void;
  onJumpToInquiries?: () => void;
  onJumpToChecklist?: () => void;
  onFocusAuth?: () => void;
}

function getToneStyles(tone: ApplicationProgressModel['tone']): {
  barFillClass: string;
  statusBoxClass: string;
  statusTextClass: string;
  percentClass: string;
} {
  switch (tone) {
    case 'emerald':
      return {
        barFillClass: 'bg-emerald-600',
        statusBoxClass: 'bg-emerald-50/75 border-emerald-200',
        statusTextClass: 'text-emerald-800',
        percentClass: 'text-emerald-800',
      };
    case 'amber':
      return {
        barFillClass: 'bg-amber-600',
        statusBoxClass: 'bg-amber-50/80 border-amber-200',
        statusTextClass: 'text-amber-900',
        percentClass: 'text-amber-900',
      };
    case 'rose':
      return {
        barFillClass: 'bg-rose-600',
        statusBoxClass: 'bg-rose-50/80 border-rose-200',
        statusTextClass: 'text-rose-800',
        percentClass: 'text-rose-800',
      };
    case 'teal':
      return {
        barFillClass: 'bg-teal-700',
        statusBoxClass: 'bg-teal-50/75 border-teal-200',
        statusTextClass: 'text-teal-900',
        percentClass: 'text-teal-900',
      };
    case 'neutral':
    default:
      return {
        barFillClass: 'bg-slate-400',
        statusBoxClass: 'bg-slate-50 border-slate-200',
        statusTextClass: 'text-slate-800',
        percentClass: 'text-slate-900',
      };
  }
}

function renderStatusIcon(
  statusKey: ApplicationProgressModel['statusKey'],
  className = 'w-4 h-4 shrink-0'
) {
  switch (statusKey) {
    case 'approved':
    case 'certified':
      return <CheckCircle2 className={className} aria-hidden="true" />;
    case 'needs_documents':
      return <FileWarning className={className} aria-hidden="true" />;
    case 'rejected':
      return <XCircle className={className} aria-hidden="true" />;
    case 'in_review':
    case 'new':
    case 'no_inquiry':
    default:
      return <Clock className={className} aria-hidden="true" />;
  }
}

function getStepNodeClasses(state: ApplicationStepVisualState): string {
  switch (state) {
    case 'completed':
      return 'bg-emerald-600 border-emerald-600 text-white';
    case 'attention':
      return 'bg-amber-600 border-amber-600 text-white';
    case 'rejected':
      return 'bg-rose-600 border-rose-600 text-white';
    case 'current':
      return 'bg-teal-700 border-teal-700 text-white';
    case 'pending':
    default:
      return 'bg-white border-slate-300 text-slate-500';
  }
}

function getStepStateTextClass(state: ApplicationStepVisualState): string {
  switch (state) {
    case 'completed':
      return 'text-emerald-700';
    case 'attention':
      return 'text-amber-800';
    case 'rejected':
      return 'text-rose-700';
    case 'current':
      return 'text-teal-800';
    case 'pending':
    default:
      return 'text-slate-500';
  }
}

function formatSessionShortRu(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * «Индикатор прогресса прохождения аттестации» — отображает текущий статус
 * заявки пользователя и этап её прохождения в разделе «Личный кабинет».
 */
export const ApplicationProgressIndicator: React.FC<ApplicationProgressIndicatorProps> = ({
  user,
  inquiries,
  inquiriesLoading = false,
  overallChecklistPercent = 0,
  onRefreshInquiries,
  onJumpToCalendar,
  onJumpToInquiries,
  onJumpToChecklist,
  onFocusAuth,
}) => {
  const [selectedInquiryId, setSelectedInquiryId] = useState<string>('');

  const activeInquiry = useMemo(() => {
    if (!user || inquiries.length === 0) return null;
    if (selectedInquiryId) {
      const matched = inquiries.find((item) => item.id === selectedInquiryId);
      if (matched) return matched;
    }
    return inquiries[0];
  }, [user, inquiries, selectedInquiryId]);

  const model = useMemo(
    () =>
      buildApplicationProgressModel({
        userRole: user?.role ?? null,
        activeInquiry,
        overallChecklistPercent,
      }),
    [user?.role, activeInquiry, overallChecklistPercent]
  );

  const toneStyles = getToneStyles(model.tone);

  if (user && inquiriesLoading && inquiries.length === 0) {
    return (
      <section
        id="application-progress-indicator"
        aria-label="Загрузка прогресса по заявке"
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 scroll-mt-24"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2 w-2/3">
            <div className="h-3 w-44 bg-slate-100 rounded animate-pulse" aria-hidden="true" />
            <div className="h-5 w-72 bg-slate-100 rounded animate-pulse" aria-hidden="true" />
          </div>
          <div className="h-7 w-16 bg-slate-100 rounded animate-pulse" aria-hidden="true" />
        </div>
        <div className="h-3 w-full bg-slate-100 rounded-full animate-pulse" aria-hidden="true" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((slot) => (
            <div
              key={slot}
              className="h-20 bg-slate-50 border border-slate-200 rounded-lg animate-pulse"
              aria-hidden="true"
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      id="application-progress-indicator"
      aria-labelledby="application-progress-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 scroll-mt-24"
    >
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <FileCheck2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Статус заявки и прохождение аттестации</span>
          </p>
          <h3
            id="application-progress-heading"
            className="text-lg sm:text-xl font-bold text-slate-900"
          >
            Прогресс прохождения аттестации
          </h3>
          {activeInquiry ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
              <span className="font-mono text-slate-800 font-semibold tabular-nums">
                Заявка № {activeInquiry.id.slice(-8)}
              </span>
              <span aria-hidden="true">·</span>
              <span>от {formatDate(activeInquiry.createdAt)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-slate-800">{activeInquiry.track}</span>
              {activeInquiry.sessionDate && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-teal-800 tabular-nums">
                    Сессия {formatSessionShortRu(activeInquiry.sessionDate)}
                  </span>
                </>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-600">
              {user
                ? 'Текущий статус отслеживается автоматически после подачи заявки в РЦА.'
                : 'Войдите в личный кабинет, чтобы отслеживать живой статус вашей заявки.'}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {user && inquiries.length > 1 && (
            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              <span className="whitespace-nowrap">Заявка:</span>
              <select
                value={activeInquiry?.id ?? ''}
                onChange={(e) => setSelectedInquiryId(e.target.value)}
                aria-label="Выбор заявки для отображения прогресса"
                className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-teal-700"
              >
                {inquiries.map((inq) => (
                  <option key={inq.id} value={inq.id}>
                    № {inq.id.slice(-8)} · {inq.track}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="text-right">
            <p
              className={`text-2xl font-bold font-mono tabular-nums leading-none ${toneStyles.percentClass}`}
            >
              {user ? `${model.progressPercent}%` : '—'}
            </p>
            <p className="text-[11px] font-mono text-slate-500 tabular-nums mt-1">
              {user
                ? `${model.completedStepsCount} из ${model.totalStepsCount} этапов`
                : 'Требуется вход'}
            </p>
          </div>

          {user && onRefreshInquiries && (
            <button
              type="button"
              onClick={onRefreshInquiries}
              disabled={inquiriesLoading}
              title="Обновить статус заявки"
              aria-label="Обновить статус заявки"
              className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <RefreshCw
                className={`w-4 h-4 ${inquiriesLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </div>

      {/* Linear Progress Bar */}
      <div className="space-y-2">
        <div
          role="progressbar"
          aria-label="Прогресс прохождения аттестации по статусу заявки"
          aria-valuenow={user ? model.progressPercent : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          className="relative h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200"
        >
          <div
            className={`h-full transition-all duration-200 ${
              user ? toneStyles.barFillClass : 'bg-slate-300'
            }`}
            style={{ width: `${user ? model.progressPercent : 0}%` }}
          />
          <span
            aria-hidden="true"
            className="absolute left-1/4 top-0 bottom-0 w-px bg-white/80"
          />
          <span
            aria-hidden="true"
            className="absolute left-2/4 top-0 bottom-0 w-px bg-white/80"
          />
          <span
            aria-hidden="true"
            className="absolute left-3/4 top-0 bottom-0 w-px bg-white/80"
          />
        </div>
      </div>

      {/* 4-Step Application Pipeline */}
      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {model.steps.map((step) => {
          const isAttention = step.state === 'attention';
          const isRejected = step.state === 'rejected';
          const isCompleted = step.state === 'completed';
          const isCurrent = step.state === 'current';

          return (
            <li
              key={step.id}
              className={`rounded-lg border p-3.5 space-y-2 transition-colors ${
                isCompleted
                  ? 'bg-emerald-50/35 border-emerald-200'
                  : isAttention
                  ? 'bg-amber-50/55 border-amber-300'
                  : isRejected
                  ? 'bg-rose-50/55 border-rose-300'
                  : isCurrent && user
                  ? 'bg-teal-50/55 border-teal-300'
                  : 'bg-slate-50/60 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`w-6 h-6 rounded-full border text-[11px] font-mono font-bold flex items-center justify-center shrink-0 ${getStepNodeClasses(
                    user ? step.state : 'pending'
                  )}`}
                >
                  {user && isCompleted ? (
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : user && isAttention ? (
                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : user && isRejected ? (
                    <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    step.stepNumber
                  )}
                </span>

                <span
                  className={`text-[11px] font-semibold whitespace-nowrap ${
                    user ? getStepStateTextClass(step.state) : 'text-slate-500'
                  }`}
                >
                  {user ? step.stateLabel : 'После входа'}
                </span>
              </div>

              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                  {step.title}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                  {step.subtitle}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Current Application Status Callout & Actions */}
      <div
        role="status"
        className={`rounded-xl border px-4 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
          user ? toneStyles.statusBoxClass : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <span
            className={`mt-0.5 ${
              user ? toneStyles.statusTextClass : 'text-slate-700'
            }`}
          >
            {renderStatusIcon(user ? model.statusKey : 'no_inquiry')}
          </span>
          <div className="space-y-1 min-w-0">
            <p
              className={`text-xs sm:text-sm font-bold ${
                user ? toneStyles.statusTextClass : 'text-slate-900'
              }`}
            >
              {user
                ? `Текущий статус заявки: ${model.statusLabel}`
                : 'Войдите в кабинет для отслеживания статуса заявки'}
            </p>
            <p className="text-xs text-slate-700 leading-relaxed">
              {user
                ? model.statusSummary
                : 'После авторизации здесь отобразится актуальный статус вашей заявки в РЦА, прогресс проверки документов и следующий шаг к экзамену.'}
            </p>
            {user && (
              <p className="text-[11px] text-slate-600">{model.nextStepHint}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!user && onFocusAuth && (
            <button
              type="button"
              onClick={onFocusAuth}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Войти в кабинет</span>
            </button>
          )}

          {user &&
            (model.statusKey === 'no_inquiry' || model.statusKey === 'rejected') &&
            onJumpToCalendar && (
              <button
                type="button"
                onClick={onJumpToCalendar}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {model.statusKey === 'rejected'
                    ? 'Подать новую заявку'
                    : 'Выбрать сессию и подать заявку'}
                </span>
              </button>
            )}

          {user && onJumpToChecklist && (
            <button
              type="button"
              onClick={onJumpToChecklist}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <ListChecks className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>Чек-лист этапов</span>
            </button>
          )}

          {user && inquiries.length > 0 && onJumpToInquiries && (
            <button
              type="button"
              onClick={onJumpToInquiries}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <span>Мои заявки</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
