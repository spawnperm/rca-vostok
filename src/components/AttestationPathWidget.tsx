import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpenCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Compass,
  FileBadge2,
  FileText,
  LogIn,
  RotateCcw,
} from 'lucide-react';
import type { SessionUser } from '../utils/identityApi';
import { tracker } from '../utils/tracker';
import {
  buildAttestationPathViewModel,
  buildPreviewAttestationSummary,
  formatDaysRu,
  type AttestationPathActionKind,
  type AttestationPathStageId,
  type AttestationSummaryInput,
  type DeadlineUrgency,
  type PreparationContourPath,
} from '../utils/attestationPath';
import type { InquiryRecord } from './social/MyInquiriesSection';

interface AttestationPathWidgetProps {
  user: SessionUser | null;
  summary?: AttestationSummaryInput | null;
  inquiries?: InquiryRecord[];
  examDateIso?: string;
  contour?: PreparationContourPath;
  onSelectStageInChecklist?: (stageId: AttestationPathStageId) => void;
  onOpenApplication?: () => void;
  onJumpToRoadmap?: () => void;
  onJumpToPassport?: () => void;
  onFocusAuth?: () => void;
}

const STAGE_ICONS: Record<
  AttestationPathStageId,
  React.ComponentType<{ className?: string }>
> = {
  application: FileText,
  training: BookOpenCheck,
  exam: Compass,
  certificate: Award,
};

function getUrgencyStyles(urgency: DeadlineUrgency): {
  bannerClass: string;
  iconBoxClass: string;
  countdownTextClass: string;
  tagTextClass: string;
  stepTextClass: string;
} {
  switch (urgency) {
    case 'overdue':
      return {
        bannerClass: 'bg-rose-50/90 border-rose-300',
        iconBoxClass: 'bg-rose-100 border-rose-200 text-rose-700',
        countdownTextClass: 'text-rose-800',
        tagTextClass: 'text-rose-700',
        stepTextClass: 'text-rose-700 font-semibold',
      };
    case 'urgent':
      return {
        bannerClass: 'bg-amber-50/90 border-amber-300',
        iconBoxClass: 'bg-amber-100 border-amber-200 text-amber-800',
        countdownTextClass: 'text-amber-900',
        tagTextClass: 'text-amber-800',
        stepTextClass: 'text-amber-800 font-semibold',
      };
    case 'soon':
      return {
        bannerClass: 'bg-amber-50/45 border-amber-200',
        iconBoxClass: 'bg-amber-100/70 border-amber-200 text-amber-800',
        countdownTextClass: 'text-amber-900',
        tagTextClass: 'text-amber-800',
        stepTextClass: 'text-amber-800 font-medium',
      };
    case 'completed':
      return {
        bannerClass: 'bg-emerald-50/60 border-emerald-200',
        iconBoxClass: 'bg-emerald-100 border-emerald-200 text-emerald-700',
        countdownTextClass: 'text-emerald-800',
        tagTextClass: 'text-emerald-700',
        stepTextClass: 'text-emerald-700 font-medium',
      };
    case 'on_track':
    default:
      return {
        bannerClass: 'bg-teal-50/45 border-teal-200',
        iconBoxClass: 'bg-teal-100/70 border-teal-200 text-teal-800',
        countdownTextClass: 'text-teal-900',
        tagTextClass: 'text-teal-800',
        stepTextClass: 'text-slate-600',
      };
  }
}

function getStepCardClass(
  isCurrent: boolean,
  isCompleted: boolean,
  urgency: DeadlineUrgency
): string {
  if (isCompleted) {
    return 'bg-emerald-50/35 border-emerald-200 group-hover:border-emerald-300';
  }
  if (urgency === 'overdue') {
    return isCurrent
      ? 'bg-rose-50/85 border-rose-500'
      : 'bg-rose-50/60 border-rose-300 group-hover:border-rose-400';
  }
  if (urgency === 'urgent') {
    return isCurrent
      ? 'bg-amber-50/85 border-amber-500'
      : 'bg-amber-50/55 border-amber-300 group-hover:border-amber-400';
  }
  if (urgency === 'soon') {
    return isCurrent
      ? 'bg-amber-50/60 border-amber-400'
      : 'bg-amber-50/30 border-amber-200 group-hover:border-amber-300';
  }
  if (isCurrent) {
    return 'bg-teal-50/70 border-teal-600';
  }
  return 'bg-slate-50/60 border-slate-200 group-hover:border-slate-300';
}

function getStepNodeClass(
  isCurrent: boolean,
  isCompleted: boolean,
  urgency: DeadlineUrgency
): string {
  if (isCompleted) {
    return 'bg-emerald-600 border-emerald-600 text-white';
  }
  if (urgency === 'overdue') {
    return isCurrent
      ? 'bg-rose-600 border-rose-600 text-white ring-4 ring-rose-100'
      : 'bg-rose-50 border-rose-400 text-rose-700';
  }
  if (urgency === 'urgent') {
    return isCurrent
      ? 'bg-amber-600 border-amber-600 text-white ring-4 ring-amber-100'
      : 'bg-amber-50 border-amber-400 text-amber-800';
  }
  if (isCurrent) {
    return urgency === 'soon'
      ? 'bg-amber-600 border-amber-600 text-white ring-4 ring-amber-100'
      : 'bg-teal-700 border-teal-700 text-white ring-4 ring-teal-100';
  }
  return 'bg-white border-slate-300 text-slate-500 group-hover:border-slate-400';
}

export const AttestationPathWidget: React.FC<AttestationPathWidgetProps> = ({
  user,
  summary = null,
  inquiries = [],
  examDateIso,
  contour = 'contour_b',
  onSelectStageInChecklist,
  onOpenApplication,
  onJumpToRoadmap,
  onJumpToPassport,
  onFocusAuth,
}) => {
  const isPreview = !user;

  const effectiveSummary = useMemo<AttestationSummaryInput>(
    () => summary ?? buildPreviewAttestationSummary(),
    [summary]
  );

  const pathModel = useMemo(
    () =>
      buildAttestationPathViewModel(effectiveSummary, isPreview ? [] : inquiries, {
        examDateIso,
        contour,
      }),
    [effectiveSummary, isPreview, inquiries, examDateIso, contour]
  );

  const [inspectedStageId, setInspectedStageId] = useState<AttestationPathStageId>(
    pathModel.currentStageId
  );
  const [userPinnedInspection, setUserPinnedInspection] = useState<boolean>(false);

  // Follow the live active stage automatically unless the user manually clicked another step.
  useEffect(() => {
    if (!userPinnedInspection) {
      setInspectedStageId(pathModel.currentStageId);
    }
  }, [pathModel.currentStageId, userPinnedInspection]);

  // Reset inspection pin when account switches.
  useEffect(() => {
    setUserPinnedInspection(false);
    setInspectedStageId(pathModel.currentStageId);
  }, [user?.id, pathModel.currentStageId]);

  const inspectedStep =
    pathModel.steps.find((s) => s.id === inspectedStageId) ??
    pathModel.steps[pathModel.currentStepIndex] ??
    pathModel.steps[0];

  const timerStyles = getUrgencyStyles(pathModel.nextStageTimer.urgency);
  const inspectedDeadlineStyles = getUrgencyStyles(inspectedStep.deadline.urgency);

  const handleInspectStep = (stageId: AttestationPathStageId) => {
    setInspectedStageId(stageId);
    setUserPinnedInspection(stageId !== pathModel.currentStageId);
    const matched = pathModel.steps.find((s) => s.id === stageId);
    if (matched) {
      tracker.trackCustomInteraction(
        `Путь аттестации · Просмотр этапа ${matched.stepNumber}`,
        matched.shortTitle
      );
    }
  };

  const handleTriggerAction = (kind: AttestationPathActionKind, stageId: AttestationPathStageId) => {
    if (isPreview) {
      onFocusAuth?.();
      return;
    }

    switch (kind) {
      case 'open_application':
        if (onOpenApplication) {
          onOpenApplication();
        } else {
          onSelectStageInChecklist?.(stageId);
        }
        break;
      case 'open_roadmap':
        if (onJumpToRoadmap) {
          onJumpToRoadmap();
        } else {
          onSelectStageInChecklist?.(stageId);
        }
        break;
      case 'open_passport':
        if (onJumpToPassport) {
          onJumpToPassport();
        } else {
          onSelectStageInChecklist?.(stageId);
        }
        break;
      case 'open_checklist':
      default:
        onSelectStageInChecklist?.(stageId);
        break;
    }
  };

  const renderPrimaryActionIcon = (kind: AttestationPathActionKind) => {
    if (isPreview) return <LogIn className="w-3.5 h-3.5" aria-hidden="true" />;
    if (kind === 'open_roadmap') {
      return <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />;
    }
    if (kind === 'open_passport') {
      return <FileBadge2 className="w-3.5 h-3.5" aria-hidden="true" />;
    }
    return <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />;
  };

  const renderUrgencyIcon = (urgency: DeadlineUrgency, className = 'w-4 h-4') => {
    if (urgency === 'overdue') {
      return <AlertTriangle className={className} aria-hidden="true" />;
    }
    if (urgency === 'completed') {
      return <CheckCircle2 className={className} aria-hidden="true" />;
    }
    return <Clock className={className} aria-hidden="true" />;
  };

  const { nextStageTimer } = pathModel;
  const contourLabel =
    nextStageTimer.contour === 'contour_b'
      ? 'Контур Б (ДПО ВВГУ)'
      : 'Контур А (Стаж без ДПО)';

  return (
    <section
      id="attestation-path-widget"
      aria-labelledby="attestation-path-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 scroll-mt-24"
    >
      {/* Top Heading + Status Summary */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-medium text-teal-700">
            {isPreview
              ? 'Ознакомительный маршрут · Авторизуйтесь для сохранения прогресса'
              : 'Визуальный трекер соискателя · РЦА «Русский Восток»'}
          </p>
          <h3
            id="attestation-path-heading"
            className="text-lg sm:text-xl font-bold text-slate-900"
          >
            Путь аттестации
          </h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
            <span
              className={`font-semibold ${
                pathModel.isAllCompleted ? 'text-emerald-700' : 'text-teal-800'
              }`}
            >
              {pathModel.headlineStatus}
            </span>
            {pathModel.latestInquirySummary && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Заявка: {pathModel.latestInquirySummary.statusLabel} (
                  {pathModel.latestInquirySummary.track})
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums leading-none">
              {pathModel.overallPercent}%
            </p>
            <p className="text-[11px] font-mono text-slate-500 tabular-nums mt-1">
              {pathModel.isAllCompleted
                ? `${pathModel.totalStages}/${pathModel.totalStages} этапов`
                : `Этап ${pathModel.currentStepIndex + 1} из ${pathModel.totalStages}`}{' '}
              · {pathModel.completedTasks}/{pathModel.totalTasks} шагов
            </p>
          </div>
        </div>
      </div>

      {/* Time-Until-Next-Stage Regulatory Countdown Strip */}
      <div
        role="status"
        aria-label="Индикатор времени до следующего этапа"
        className={`rounded-xl border px-4 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 ${timerStyles.bannerClass}`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <span
            className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${timerStyles.iconBoxClass}`}
          >
            {renderUrgencyIcon(nextStageTimer.urgency, 'w-4 h-4')}
          </span>
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="text-xs sm:text-sm font-bold text-slate-900">
                {nextStageTimer.targetTitle}
              </p>
              {nextStageTimer.urgency !== 'completed' && (
                <span className={`text-[11px] font-semibold ${timerStyles.tagTextClass}`}>
                  ·{' '}
                  {nextStageTimer.urgency === 'overdue'
                    ? 'Просроченный дедлайн'
                    : nextStageTimer.urgency === 'urgent'
                    ? 'Приближается дедлайн'
                    : nextStageTimer.urgency === 'soon'
                    ? 'Ближайший срок'
                    : 'В графике регламента'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-700 leading-snug">
              {nextStageTimer.regulationNote}
            </p>
            <p className="text-[11px] text-slate-500 font-mono tabular-nums">
              Сессия: {nextStageTimer.examDateFormatted} · {contourLabel}
              {nextStageTimer.overdueStepsCount > 0 &&
                ` · Просрочено этапов: ${nextStageTimer.overdueStepsCount}`}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 border-t md:border-t-0 border-slate-200/70 pt-2.5 md:pt-0">
          <div className="md:text-right">
            <p
              className={`text-sm sm:text-base font-bold font-mono tabular-nums ${timerStyles.countdownTextClass}`}
            >
              {nextStageTimer.countdownText}
            </p>
            <p className="text-[11px] font-mono text-slate-600 tabular-nums">
              {nextStageTimer.urgency === 'completed'
                ? `Протокол от ${nextStageTimer.targetDateFormatted}`
                : `Срок по регламенту: ${nextStageTimer.targetDateFormatted}`}
            </p>
          </div>

          {!isPreview && onJumpToRoadmap && (
            <button
              type="button"
              onClick={onJumpToRoadmap}
              className="px-2.5 py-1.5 bg-white/90 hover:bg-white border border-slate-300 text-slate-800 text-[11px] font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              Изменить сессию
            </button>
          )}
        </div>
      </div>

      {/* Desktop Connected Horizontal Stepper */}
      <div className="hidden md:block pt-1">
        <div className="relative">
          {/* Continuous connecting progress line behind node circles */}
          <div
            aria-hidden="true"
            className="absolute top-5 left-[12.5%] right-[12.5%] h-0.5 bg-slate-200 rounded-full"
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                pathModel.isAllCompleted
                  ? 'bg-emerald-600'
                  : nextStageTimer.urgency === 'overdue'
                  ? 'bg-rose-600'
                  : nextStageTimer.urgency === 'urgent'
                  ? 'bg-amber-600'
                  : 'bg-teal-700'
              }`}
              style={{ width: `${pathModel.trackProgressPercent}%` }}
            />
          </div>

          <ol className="grid grid-cols-4 gap-3 relative">
            {pathModel.steps.map((step) => {
              const Icon = STAGE_ICONS[step.id];
              const isInspected = step.id === inspectedStep.id;
              const stepDeadlineStyle = getUrgencyStyles(step.deadline.urgency);

              return (
                <li key={step.id} className="flex flex-col items-stretch">
                  <button
                    type="button"
                    onClick={() => handleInspectStep(step.id)}
                    aria-current={step.isCurrent ? 'step' : undefined}
                    aria-pressed={isInspected}
                    className="group text-left flex flex-col items-center cursor-pointer focus-visible:outline-none"
                  >
                    {/* Milestone Node */}
                    <span
                      className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center font-mono text-xs font-bold border-2 transition-all duration-200 ${getStepNodeClass(
                        step.isCurrent,
                        step.isCompleted,
                        step.deadline.urgency
                      )}`}
                    >
                      {step.isCompleted ? (
                        <Check className="w-5 h-5" aria-hidden="true" />
                      ) : (
                        <span>{step.stepNumber}</span>
                      )}
                    </span>

                    {/* Connected Step Card */}
                    <div
                      className={`mt-3 w-full rounded-xl border p-3.5 transition-colors flex flex-col justify-between gap-2.5 min-h-[146px] ${getStepCardClass(
                        step.isCurrent,
                        step.isCompleted,
                        step.deadline.urgency
                      )} ${isInspected ? 'ring-2 ring-slate-900/15' : ''}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[11px] font-semibold ${
                              step.isCompleted
                                ? 'text-emerald-700'
                                : step.deadline.urgency === 'overdue'
                                ? 'text-rose-700'
                                : step.deadline.urgency === 'urgent'
                                ? 'text-amber-800'
                                : step.isCurrent
                                ? 'text-teal-800'
                                : 'text-slate-500'
                            }`}
                          >
                            {step.stateLabel}
                          </span>
                          <Icon
                            className={`w-3.5 h-3.5 shrink-0 ${
                              step.isCompleted
                                ? 'text-emerald-700'
                                : step.deadline.urgency === 'overdue'
                                ? 'text-rose-600'
                                : step.deadline.urgency === 'urgent'
                                ? 'text-amber-700'
                                : step.isCurrent
                                ? 'text-teal-700'
                                : 'text-slate-400'
                            }`}
                            aria-hidden="true"
                          />
                        </div>

                        <p className="text-sm font-bold text-slate-900 leading-snug">
                          {step.title}
                        </p>

                        {/* Per-step deadline indicator */}
                        <div
                          className={`flex items-center gap-1.5 text-[11px] font-mono tabular-nums pt-0.5 ${stepDeadlineStyle.stepTextClass}`}
                        >
                          {renderUrgencyIcon(step.deadline.urgency, 'w-3 h-3 shrink-0')}
                          <span className="truncate">
                            {step.isCompleted
                              ? `Срок до ${step.deadline.deadlineShortFormatted}`
                              : step.deadline.urgency === 'overdue'
                              ? `−${formatDaysRu(Math.abs(step.deadline.daysRemaining))} · до ${step.deadline.deadlineShortFormatted}`
                              : step.deadline.daysRemaining === 0
                              ? `Сегодня · ${step.deadline.deadlineShortFormatted}`
                              : `${formatDaysRu(step.deadline.daysRemaining)} · до ${step.deadline.deadlineShortFormatted}`}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600">
                          <span>
                            {step.completedCount}/{step.totalCount} шагов
                          </span>
                          <span>{step.stagePercent}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/80 border border-slate-200/70 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-200 ${
                              step.isCompleted
                                ? 'bg-emerald-600'
                                : step.deadline.urgency === 'overdue'
                                ? 'bg-rose-600'
                                : step.deadline.urgency === 'urgent'
                                ? 'bg-amber-600'
                                : step.isCurrent
                                ? 'bg-teal-700'
                                : 'bg-slate-300'
                            }`}
                            style={{ width: `${step.stagePercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* Mobile Vertical Connected Stepper */}
      <ol className="md:hidden space-y-0">
        {pathModel.steps.map((step, idx) => {
          const isLast = idx === pathModel.steps.length - 1;
          const isInspected = step.id === inspectedStep.id;
          const stepDeadlineStyle = getUrgencyStyles(step.deadline.urgency);

          return (
            <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
              {/* Vertical Connector Column */}
              <div className="flex flex-col items-center shrink-0">
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold border-2 ${getStepNodeClass(
                    step.isCurrent,
                    step.isCompleted,
                    step.deadline.urgency
                  )}`}
                >
                  {step.isCompleted ? (
                    <Check className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    step.stepNumber
                  )}
                </span>
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={`w-0.5 flex-1 mt-1 rounded-full ${
                      step.isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>

              {/* Mobile Step Card */}
              <button
                type="button"
                onClick={() => handleInspectStep(step.id)}
                aria-current={step.isCurrent ? 'step' : undefined}
                aria-pressed={isInspected}
                className={`flex-1 text-left rounded-xl border p-3.5 transition-colors cursor-pointer ${getStepCardClass(
                  step.isCurrent,
                  step.isCompleted,
                  step.deadline.urgency
                )} ${isInspected ? 'ring-2 ring-slate-900/15' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[11px] font-semibold ${
                      step.isCompleted
                        ? 'text-emerald-700'
                        : step.deadline.urgency === 'overdue'
                        ? 'text-rose-700'
                        : step.deadline.urgency === 'urgent'
                        ? 'text-amber-800'
                        : step.isCurrent
                        ? 'text-teal-800'
                        : 'text-slate-500'
                    }`}
                  >
                    {step.stateLabel}
                  </span>
                  <span className="text-[11px] font-mono text-slate-600 tabular-nums">
                    {step.completedCount}/{step.totalCount}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{step.title}</p>
                <div
                  className={`flex items-center gap-1.5 text-[11px] font-mono tabular-nums mt-1 ${stepDeadlineStyle.stepTextClass}`}
                >
                  {renderUrgencyIcon(step.deadline.urgency, 'w-3 h-3 shrink-0')}
                  <span>
                    {step.deadline.countdownLabel} · до {step.deadline.deadlineShortFormatted}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Focused Stage Detail & Next Step Strip */}
      <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-semibold text-slate-800 tabular-nums">
                Этап {inspectedStep.stepNumber}
              </span>
              <span aria-hidden="true">·</span>
              <span
                className={`font-semibold ${
                  inspectedStep.isCompleted
                    ? 'text-emerald-700'
                    : inspectedStep.deadline.urgency === 'overdue'
                    ? 'text-rose-700'
                    : inspectedStep.deadline.urgency === 'urgent'
                    ? 'text-amber-800'
                    : inspectedStep.isCurrent
                    ? 'text-teal-800'
                    : 'text-slate-600'
                }`}
              >
                {inspectedStep.stateLabel}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{inspectedStep.durationHint}</span>
              <span aria-hidden="true">·</span>
              <span
                className={`font-mono tabular-nums inline-flex items-center gap-1 ${inspectedDeadlineStyles.stepTextClass}`}
              >
                {renderUrgencyIcon(inspectedStep.deadline.urgency, 'w-3.5 h-3.5')}
                <span>
                  {inspectedStep.deadline.countdownLabel} (до{' '}
                  {inspectedStep.deadline.deadlineFormatted})
                </span>
              </span>
            </div>
            <h4 className="text-base font-bold text-slate-900">{inspectedStep.title}</h4>
            <p className="text-xs text-slate-600 leading-relaxed">{inspectedStep.summary}</p>
          </div>

          {userPinnedInspection && inspectedStep.id !== pathModel.currentStageId && (
            <button
              type="button"
              onClick={() => {
                setUserPinnedInspection(false);
                setInspectedStageId(pathModel.currentStageId);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>К текущему этапу</span>
            </button>
          )}
        </div>

        {/* 3 Stage Sub-Steps */}
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {inspectedStep.tasks.map((task) => (
            <li
              key={task.id}
              className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs ${
                task.completed
                  ? 'bg-white border-emerald-200 text-slate-900'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              {task.completed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <Circle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium leading-snug">{task.label}</p>
                <p className="text-[11px] text-slate-500 leading-snug">{task.hint}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Next Step Recommendation + Contextual Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-200/80">
          <p className="text-xs text-slate-700 leading-relaxed">
            <span className="font-semibold text-slate-900">
              {inspectedStep.isCompleted ? 'Итог этапа: ' : 'Следующий шаг: '}
            </span>
            {isPreview
              ? 'Войдите или зарегистрируйтесь в личном кабинете, чтобы система отслеживала ваши заявки, дедлайны и чек-лист.'
              : inspectedStep.nextHint}
          </p>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isPreview &&
              onSelectStageInChecklist &&
              inspectedStep.primaryAction.kind !== 'open_checklist' && (
                <button
                  type="button"
                  onClick={() => onSelectStageInChecklist(inspectedStep.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <span>Отметить в чек-листе</span>
                </button>
              )}

            <button
              type="button"
              onClick={() =>
                handleTriggerAction(inspectedStep.primaryAction.kind, inspectedStep.id)
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <span>
                {isPreview ? 'Войти и начать путь' : inspectedStep.primaryAction.label}
              </span>
              {renderPrimaryActionIcon(inspectedStep.primaryAction.kind)}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
