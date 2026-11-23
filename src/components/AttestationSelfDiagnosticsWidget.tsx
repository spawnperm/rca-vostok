import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Compass,
  FileText,
  GraduationCap,
  Headset,
  HeartPulse,
  Lock,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { SessionUser } from '../utils/identityApi';
import {
  DIAGNOSTIC_QUESTIONS,
  DIAGNOSTIC_SECTIONS,
  createEmptyDiagnosticsState,
  evaluateAttestationDiagnostics,
  readStoredDiagnosticsState,
  writeStoredDiagnosticsState,
  type DiagnosticOptionId,
  type DiagnosticSectionId,
  type DiagnosticSectionResult,
  type DiagnosticSectionStatus,
  type StoredDiagnosticsState,
} from '../utils/attestationSelfDiagnostics';
import {
  DEMO_CERTIFICATE_THRESHOLD_PERCENT,
  isEligibleForDemoCertificate,
} from '../utils/demoCertificateCanvas';
import { DemoCertificateModal } from './DemoCertificateModal';
import { tracker } from '../utils/tracker';

interface AttestationSelfDiagnosticsWidgetProps {
  user: SessionUser | null;
  onJumpToKnowledgeBase?: (query?: string) => void;
  onJumpToConsultant?: (prompt?: string) => void;
  onJumpToSelfCheck?: () => void;
  onJumpToCalendar?: () => void;
}

const OPTION_LETTERS: Record<DiagnosticOptionId, string> = {
  a: 'А',
  b: 'Б',
  c: 'В',
  d: 'Г',
};

const RESULTS_STEP = DIAGNOSTIC_SECTIONS.length + 1;

function SectionIcon({
  sectionId,
  className = 'w-4 h-4',
}: {
  sectionId: DiagnosticSectionId;
  className?: string;
}) {
  switch (sectionId) {
    case 'regulation':
      return <FileText className={className} aria-hidden="true" />;
    case 'routing':
      return <Compass className={className} aria-hidden="true" />;
    case 'first_aid':
      return <HeartPulse className={className} aria-hidden="true" />;
    case 'field_dfo':
      return <ShieldCheck className={className} aria-hidden="true" />;
  }
}

function StatusIcon({
  status,
  className = 'w-4 h-4',
}: {
  status: DiagnosticSectionStatus;
  className?: string;
}) {
  switch (status) {
    case 'strong':
      return <CheckCircle2 className={className} aria-hidden="true" />;
    case 'moderate':
      return <AlertTriangle className={className} aria-hidden="true" />;
    case 'gap':
      return <ShieldAlert className={className} aria-hidden="true" />;
  }
}

function getStatusStyles(status: DiagnosticSectionStatus): {
  text: string;
  bar: string;
  surface: string;
  border: string;
} {
  switch (status) {
    case 'strong':
      return {
        text: 'text-emerald-800',
        bar: 'bg-emerald-600',
        surface: 'bg-emerald-50/70',
        border: 'border-emerald-200',
      };
    case 'moderate':
      return {
        text: 'text-amber-800',
        bar: 'bg-amber-500',
        surface: 'bg-amber-50/70',
        border: 'border-amber-200',
      };
    case 'gap':
      return {
        text: 'text-rose-800',
        bar: 'bg-rose-600',
        surface: 'bg-rose-50/70',
        border: 'border-rose-200',
      };
  }
}

export const AttestationSelfDiagnosticsWidget: React.FC<
  AttestationSelfDiagnosticsWidgetProps
> = ({
  user,
  onJumpToKnowledgeBase,
  onJumpToConsultant,
  onJumpToSelfCheck,
  onJumpToCalendar,
}) => {
  const userId = user?.id ?? null;

  const [state, setState] = useState<StoredDiagnosticsState>(() =>
    readStoredDiagnosticsState(userId)
  );
  const [demoCertModalOpen, setDemoCertModalOpen] = useState<boolean>(false);

  useEffect(() => {
    setState(readStoredDiagnosticsState(userId));
  }, [userId]);

  const evaluation = useMemo(
    () => evaluateAttestationDiagnostics(state.answers),
    [state.answers]
  );

  const canGenerateDemoCertificate = isEligibleForDemoCertificate(evaluation);

  const persistState = (next: StoredDiagnosticsState) => {
    setState(next);
    writeStoredDiagnosticsState(userId, next);
  };

  const currentSectionMeta =
    state.activeStep >= 1 && state.activeStep <= DIAGNOSTIC_SECTIONS.length
      ? DIAGNOSTIC_SECTIONS[state.activeStep - 1]
      : null;

  const currentSectionQuestions = useMemo(() => {
    if (!currentSectionMeta) return [];
    return DIAGNOSTIC_QUESTIONS.filter((q) => q.sectionId === currentSectionMeta.id);
  }, [currentSectionMeta]);

  const currentSectionResult: DiagnosticSectionResult | null = currentSectionMeta
    ? evaluation.sections.find((s) => s.id === currentSectionMeta.id) ?? null
    : null;

  const isCurrentSectionChecked = currentSectionMeta
    ? Boolean(state.checkedSections[currentSectionMeta.id])
    : false;

  const handleSelectOption = (questionId: string, optionId: DiagnosticOptionId) => {
    if (!currentSectionMeta || isCurrentSectionChecked) return;
    const next: StoredDiagnosticsState = {
      ...state,
      answers: {
        ...state.answers,
        [questionId]: optionId,
      },
      updatedAt: new Date().toISOString(),
    };
    persistState(next);
  };

  const handleCheckCurrentSection = () => {
    if (!currentSectionMeta) return;
    const next: StoredDiagnosticsState = {
      ...state,
      checkedSections: {
        ...state.checkedSections,
        [currentSectionMeta.id]: true,
      },
      updatedAt: new Date().toISOString(),
    };
    persistState(next);
    tracker.trackCustomInteraction(
      `Самодиагностика · проверка раздела: ${currentSectionMeta.shortTitle}`,
      'account'
    );
  };

  const handleResetCurrentSection = () => {
    if (!currentSectionMeta) return;
    const nextAnswers = { ...state.answers };
    for (const q of currentSectionQuestions) {
      delete nextAnswers[q.id];
    }
    const nextChecked = { ...state.checkedSections };
    delete nextChecked[currentSectionMeta.id];
    persistState({
      ...state,
      answers: nextAnswers,
      checkedSections: nextChecked,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleGoToStep = (step: number) => {
    const clamped = Math.max(1, Math.min(RESULTS_STEP, step));
    const nextChecked = { ...state.checkedSections };
    // Auto-reveal explanation on sections where all 3 questions are answered when leaving forward.
    if (
      currentSectionMeta &&
      clamped > state.activeStep &&
      currentSectionResult &&
      currentSectionResult.answeredCount === currentSectionResult.totalCount
    ) {
      nextChecked[currentSectionMeta.id] = true;
    }
    persistState({
      ...state,
      checkedSections: nextChecked,
      activeStep: clamped,
      updatedAt: new Date().toISOString(),
    });
    if (clamped === RESULTS_STEP) {
      tracker.trackCustomInteraction(
        `Самодиагностика · итоги (${evaluation.overallPercent}%)`,
        'account'
      );
    }
  };

  const handleResetAll = () => {
    persistState(createEmptyDiagnosticsState());
    tracker.trackCustomInteraction('Самодиагностика · сброс опроса', 'account');
  };

  const tierSurface =
    evaluation.readinessTier === 'exam_ready'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
      : evaluation.readinessTier === 'targeted_prep'
        ? 'bg-amber-50 border-amber-200 text-amber-950'
        : evaluation.readinessTier === 'dpo_recommended'
          ? 'bg-rose-50 border-rose-200 text-rose-950'
          : 'bg-slate-50 border-slate-200 text-slate-900';

  const hasAnyProgress = evaluation.answeredCount > 0 || state.activeStep > 1;

  return (
    <section
      id="attestation-self-diagnostics"
      aria-labelledby="self-diagnostics-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-teal-700">
            <GraduationCap className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Пошаговый опрос знаний кандидата · 4 ключевых раздела</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">Шаг {state.activeStep} из {RESULTS_STEP}</span>
          </div>
          <h3 id="self-diagnostics-heading" className="text-lg font-bold text-slate-900">
            Самодиагностика готовности к аттестации
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Ответьте на 12 ситуационных вопросов по нормативной базе, паспорту маршрута № 760,
            первой помощи (WFA) и специфике ДФО. По итогам сформируем персональный план подготовки
            с ссылками на Базу знаний.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-right">
            <p className="text-[11px] font-medium text-slate-500">Прогресс опроса</p>
            <p className="text-sm font-bold text-slate-900 tabular-nums">
              {evaluation.answeredCount} / {evaluation.totalQuestions}
              {evaluation.answeredCount > 0 && (
                <span className="text-slate-500 font-semibold">
                  {' '}
                  · {evaluation.overallPercent}% верных
                </span>
              )}
            </p>
          </div>

          {hasAnyProgress && (
            <button
              type="button"
              onClick={handleResetAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Начать заново</span>
            </button>
          )}
        </div>
      </div>

      {/* Step-by-step progress bar */}
      <nav aria-label="Шаги самодиагностики">
        <ol className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {evaluation.sections.map((sec) => {
            const isActive = state.activeStep === sec.stepNumber;
            const isDone = sec.answeredCount === sec.totalCount;
            return (
              <li key={sec.id}>
                <button
                  type="button"
                  onClick={() => handleGoToStep(sec.stepNumber)}
                  aria-current={isActive ? 'step' : undefined}
                  className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                    isActive
                      ? 'bg-teal-700 border-teal-700 text-white'
                      : isDone
                        ? 'bg-teal-50/70 border-teal-200 text-slate-900 hover:bg-teal-100/70'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5 text-[11px] font-semibold">
                    <span className="tabular-nums opacity-90">Шаг {sec.stepNumber}</span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      {isDone && (
                        <CheckCircle2
                          className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-teal-700'}`}
                          aria-hidden="true"
                        />
                      )}
                      {sec.answeredCount}/{sec.totalCount}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold truncate">{sec.shortTitle}</p>
                </button>
              </li>
            );
          })}

          <li className="col-span-2 sm:col-span-1">
            <button
              type="button"
              onClick={() => handleGoToStep(RESULTS_STEP)}
              aria-current={state.activeStep === RESULTS_STEP ? 'step' : undefined}
              className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                state.activeStep === RESULTS_STEP
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : evaluation.isComplete
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 hover:bg-emerald-100'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5 text-[11px] font-semibold">
                <span className="tabular-nums opacity-90">Шаг {RESULTS_STEP}</span>
                <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </div>
              <p className="mt-1 text-xs font-semibold truncate">Итоги и план</p>
            </button>
          </li>
        </ol>
      </nav>

      {/* Active Section Step (Steps 1-4) */}
      {currentSectionMeta && currentSectionResult && (
        <div className="space-y-5">
          {/* Section Brief */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-teal-800">
                <SectionIcon sectionId={currentSectionMeta.id} className="w-4 h-4 shrink-0" />
                <span className="tabular-nums">
                  Раздел {currentSectionMeta.stepNumber} из {DIAGNOSTIC_SECTIONS.length}
                </span>
              </div>
              <h4 className="text-base font-bold text-slate-900">{currentSectionMeta.title}</h4>
              <p className="text-xs sm:text-sm text-slate-600">{currentSectionMeta.description}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isCurrentSectionChecked && (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold tabular-nums ${
                    getStatusStyles(currentSectionResult.status).surface
                  } ${getStatusStyles(currentSectionResult.status).border} ${
                    getStatusStyles(currentSectionResult.status).text
                  }`}
                >
                  <StatusIcon status={currentSectionResult.status} className="w-3.5 h-3.5" />
                  <span>
                    Верно {currentSectionResult.correctCount} из {currentSectionResult.totalCount} (
                    {currentSectionResult.scorePercent}%)
                  </span>
                </span>
              )}
              {!isCurrentSectionChecked && (
                <span className="text-xs font-semibold text-slate-600 tabular-nums">
                  Отвечено {currentSectionResult.answeredCount} из {currentSectionResult.totalCount}
                </span>
              )}
            </div>
          </div>

          {/* Questions in current step */}
          <div className="space-y-4">
            {currentSectionQuestions.map((question, qIndex) => {
              const selectedOpt = state.answers[question.id];
              const isCorrect = selectedOpt === question.correctOptionId;

              return (
                <article
                  key={question.id}
                  className="border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3.5 bg-white"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-500 tabular-nums">
                      Вопрос {qIndex + 1} из {currentSectionQuestions.length} ·{' '}
                      {question.legalOrMethodRef}
                    </span>

                    {isCurrentSectionChecked && (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          isCorrect ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {isCorrect ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>Верный ответ</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>
                              {selectedOpt ? 'Есть неточность' : 'Ответ не выбран'}
                            </span>
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  <p className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">
                    {question.prompt}
                  </p>

                  <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label={question.prompt}>
                    {question.options.map((opt) => {
                      const isSelected = selectedOpt === opt.id;
                      const isRightOption = opt.id === question.correctOptionId;

                      let optionClasses =
                        'border-slate-200 bg-white text-slate-800 hover:border-teal-300 hover:bg-slate-50';
                      if (isCurrentSectionChecked) {
                        if (isRightOption) {
                          optionClasses =
                            'border-emerald-400 bg-emerald-50/80 text-emerald-950 font-medium';
                        } else if (isSelected && !isRightOption) {
                          optionClasses = 'border-rose-300 bg-rose-50 text-rose-950';
                        } else {
                          optionClasses = 'border-slate-200 bg-slate-50/50 text-slate-500';
                        }
                      } else if (isSelected) {
                        optionClasses =
                          'border-teal-600 bg-teal-50/80 text-teal-950 ring-1 ring-teal-600';
                      }

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          disabled={isCurrentSectionChecked}
                          onClick={() => handleSelectOption(question.id, opt.id)}
                          className={`w-full text-left flex items-start gap-3 px-3.5 py-3 rounded-lg border text-sm transition-colors ${
                            isCurrentSectionChecked ? 'cursor-default' : 'cursor-pointer'
                          } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${optionClasses}`}
                        >
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold shrink-0 mt-0.5 border ${
                              isCurrentSectionChecked && isRightOption
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : isCurrentSectionChecked && isSelected && !isRightOption
                                  ? 'bg-rose-600 border-rose-600 text-white'
                                  : isSelected
                                    ? 'bg-teal-700 border-teal-700 text-white'
                                    : 'bg-slate-100 border-slate-300 text-slate-700'
                            }`}
                          >
                            {OPTION_LETTERS[opt.id]}
                          </span>
                          <span className="leading-snug flex-1">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {isCurrentSectionChecked && (
                    <div
                      className={`rounded-lg border px-3.5 py-2.5 text-xs space-y-1.5 ${
                        isCorrect
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <p className="leading-relaxed">
                        <span className="font-semibold">Пояснение:</span> {question.explanation}
                      </p>
                      {!isCorrect && onJumpToKnowledgeBase && (
                        <button
                          type="button"
                          onClick={() => onJumpToKnowledgeBase(question.kbQuery)}
                          className="inline-flex items-center gap-1.5 font-semibold text-teal-800 hover:text-teal-950 underline underline-offset-2 cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>Открыть материал в Базе знаний («{question.kbQuery}»)</span>
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* Step Footer Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={state.activeStep <= 1}
                onClick={() => handleGoToStep(state.activeStep - 1)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Назад</span>
              </button>

              {isCurrentSectionChecked ? (
                <button
                  type="button"
                  onClick={handleResetCurrentSection}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Пересдать раздел</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={currentSectionResult.answeredCount === 0}
                  onClick={handleCheckCurrentSection}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Проверить раздел</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {state.activeStep < DIAGNOSTIC_SECTIONS.length ? (
                <button
                  type="button"
                  onClick={() => handleGoToStep(state.activeStep + 1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <span>Следующий раздел</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleGoToStep(RESULTS_STEP)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
                  <span>Посмотреть итоги и рекомендации</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Overall Results & Recommendations */}
      {state.activeStep === RESULTS_STEP && (
        <div className="space-y-6">
          {/* Incomplete Alert */}
          {!evaluation.isComplete && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs sm:text-sm text-amber-950">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-semibold">
                    Осталось ответить на {evaluation.unansweredCount} из {evaluation.totalQuestions}{' '}
                    вопросов
                  </p>
                  <p className="text-amber-900 mt-0.5">
                    Неотвеченные вопросы учитываются как пробел при расчёте итогового балла. Завершите
                    оставшиеся разделы для точного прогноза.
                  </p>
                </div>
              </div>

              {evaluation.incompleteSectionIds[0] && (
                <button
                  type="button"
                  onClick={() => {
                    const sec = DIAGNOSTIC_SECTIONS.find(
                      (s) => s.id === evaluation.incompleteSectionIds[0]
                    );
                    if (sec) handleGoToStep(sec.stepNumber);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Перейти к незавершённому разделу</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          {/* Summary Verdict Card */}
          <div className={`border rounded-xl p-5 space-y-4 ${tierSurface}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  {evaluation.readinessTier === 'exam_ready' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  ) : evaluation.readinessTier === 'dpo_recommended' ? (
                    <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>{evaluation.verdictLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    Верных ответов: {evaluation.correctCount} из {evaluation.totalQuestions}
                  </span>
                </div>
                <h4 className="text-lg font-bold">{evaluation.verdictTitle}</h4>
                <p className="text-sm opacity-90 leading-relaxed max-w-3xl">
                  {evaluation.verdictSummary}
                </p>
              </div>

              <div className="bg-white/90 border border-black/10 rounded-xl px-5 py-3.5 text-center shrink-0 min-w-[140px]">
                <p className="text-[11px] font-medium text-slate-600">Индекс знаний</p>
                <p className="text-3xl font-bold text-slate-900 tabular-nums mt-0.5">
                  {evaluation.overallPercent}%
                </p>
                <p className="text-[11px] text-slate-600 inline-flex items-center gap-1 mt-1 tabular-nums">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  <span>
                    {evaluation.totalRecommendedHours > 0
                      ? `~${evaluation.totalRecommendedHours} ч подготовки`
                      : 'Повторение по желанию'}
                  </span>
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-black/10 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span>
                <span className="font-semibold">Рекомендуемая траектория:</span>{' '}
                {evaluation.recommendedContour}
              </span>

              {canGenerateDemoCertificate ? (
                <button
                  type="button"
                  onClick={() => {
                    setDemoCertModalOpen(true);
                    tracker.trackCustomInteraction(
                      `Демо-сертификат: открытие генератора (${evaluation.overallPercent}%)`,
                      'account'
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Сгенерировать демо-сертификат</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
                  <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    Демо-сертификат откроется после всех 12 вопросов с результатом выше{' '}
                    {DEMO_CERTIFICATE_THRESHOLD_PERCENT}%
                  </span>
                </span>
              )}
            </div>
          </div>

          {canGenerateDemoCertificate && (
            <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-teal-800 inline-flex items-center gap-1.5">
                  <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Порог {DEMO_CERTIFICATE_THRESHOLD_PERCENT}% успешно преодолён</span>
                </p>
                <p className="text-sm font-bold text-slate-900">
                  Доступен визуальный демо-сертификат готовности к аттестации
                </p>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Сформируйте именной макет с вашим результатом ({evaluation.overallPercent}%) и
                  разбивкой по 4 разделам в формате PNG для портфолио или самоподготовки.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDemoCertModalOpen(true);
                  tracker.trackCustomInteraction(
                    `Демо-сертификат: открытие генератора (${evaluation.overallPercent}%)`,
                    'account'
                  );
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                <Award className="w-4 h-4 text-teal-300 shrink-0" aria-hidden="true" />
                <span>Открыть демо-сертификат ({user?.fullName ? user.fullName.split(' ')[0] : 'PNG'})</span>
              </button>
            </div>
          )}

          {/* 4-Section Breakdown Grid */}
          <div className="space-y-2.5">
            <h4 className="text-sm font-bold text-slate-900">Результаты по ключевым разделам</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {evaluation.sections.map((sec) => {
                const st = getStatusStyles(sec.status);
                return (
                  <div
                    key={sec.id}
                    className={`border rounded-xl p-4 space-y-2.5 ${st.surface} ${st.border}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-xs font-semibold text-slate-600 tabular-nums">
                          Раздел {sec.stepNumber}
                        </p>
                        <h5 className="text-sm font-bold text-slate-900 leading-snug">
                          {sec.title}
                        </h5>
                      </div>
                      <span className={`text-xs font-bold tabular-nums shrink-0 ${st.text}`}>
                        {sec.correctCount}/{sec.totalCount} · {sec.scorePercent}%
                      </span>
                    </div>

                    <div
                      role="progressbar"
                      aria-label={`Уровень знаний: ${sec.title}`}
                      aria-valuenow={sec.scorePercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-2 w-full bg-white/80 rounded-full overflow-hidden border border-black/5"
                    >
                      <div
                        className={`h-full transition-all duration-200 ${st.bar}`}
                        style={{ width: `${sec.scorePercent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className={`inline-flex items-center gap-1 font-semibold ${st.text}`}>
                        <StatusIcon status={sec.status} className="w-3.5 h-3.5" />
                        <span>{sec.statusLabel}</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => handleGoToStep(sec.stepNumber)}
                        className="text-xs font-semibold text-slate-800 hover:text-teal-800 underline underline-offset-2 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        К вопросам раздела
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Personalized Preparation Plan */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-900">
                Персональные рекомендации по подготовке (приоритет от слабых тем)
              </h4>
              <span className="text-xs text-slate-500">
                Нажмите на кнопку Базы знаний или ИИ-консультанта для разбора темы
              </span>
            </div>

            <div className="space-y-3">
              {evaluation.priorityRecommendations.map((rec) => {
                const st = getStatusStyles(rec.status);
                const needsPrep = rec.status !== 'strong';
                return (
                  <article
                    key={rec.id}
                    className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-white space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={rec.status} className={`w-4 h-4 shrink-0 ${st.text}`} />
                        <h5 className="text-sm font-bold text-slate-900">
                          {rec.recommendationTitle}
                        </h5>
                      </div>

                      <span className={`text-xs font-semibold tabular-nums ${st.text}`}>
                        {rec.statusLabel} · {rec.scorePercent}%
                        {rec.recommendedStudyHours > 0
                          ? ` · ~${rec.recommendedStudyHours} ч`
                          : ''}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                      {rec.recommendationText}
                    </p>

                    {rec.missedQuestions.length > 0 && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                        <p className="text-xs font-semibold text-slate-800">
                          Темы, требующие внимания в этом разделе:
                        </p>
                        <ul className="space-y-1 text-xs text-slate-700">
                          {rec.missedQuestions.map((missed) => (
                            <li key={missed.questionId} className="flex items-start gap-2">
                              <span className="text-rose-600 font-bold" aria-hidden="true">
                                •
                              </span>
                              <span>
                                {missed.studyHint}{' '}
                                <span className="text-slate-500">({missed.legalOrMethodRef})</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {needsPrep && (
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {rec.studyActions.map((action, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2
                              className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {onJumpToKnowledgeBase && (
                        <button
                          type="button"
                          onClick={() => onJumpToKnowledgeBase(rec.kbQuery)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Материалы в Базе знаний</span>
                        </button>
                      )}

                      {onJumpToConsultant && needsPrep && (
                        <button
                          type="button"
                          onClick={() =>
                            onJumpToConsultant(
                              `По итогам самодиагностики у меня ${rec.scorePercent}% по разделу «${rec.title}». Подскажите, что повторить перед аттестацией в РЦА?`
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Headset className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                          <span>Разобрать с ИИ-консультантом</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Bottom Next Steps */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => handleGoToStep(DIAGNOSTIC_SECTIONS.length)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Вернуться к вопросам</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {onJumpToSelfCheck && (
                <button
                  type="button"
                  onClick={onJumpToSelfCheck}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ClipboardCheck className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>Проверить пакет документов</span>
                </button>
              )}

              {onJumpToCalendar && (
                <button
                  type="button"
                  onClick={onJumpToCalendar}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Выбрать дату аттестации</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <DemoCertificateModal
        isOpen={demoCertModalOpen}
        onClose={() => setDemoCertModalOpen(false)}
        user={user}
        evaluation={evaluation}
      />
    </section>
  );
};
