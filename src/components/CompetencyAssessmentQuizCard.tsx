import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  History,
  RotateCcw,
  Scale,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { SessionUser } from '../utils/identityApi';
import {
  COMPETENCY_QUESTIONS,
  buildShortCompetencyQuiz,
  evaluatePeriodicityStatus,
  gradeCompetencyAttempt,
  readStoredCompetencyQuizState,
  writeStoredCompetencyQuizState,
  type CompetencyQuestion,
  type PeriodicityUrgency,
  type QuizIntervalDays,
  type StoredCompetencyQuizState,
} from '../utils/competencyQuiz';
import { tracker } from '../utils/tracker';

interface CompetencyAssessmentQuizCardProps {
  user: SessionUser;
  onJumpToKnowledgeBase?: (query?: string) => void;
  onUpdated?: () => void;
}

function getUrgencyBadgeStyles(urgency: PeriodicityUrgency): {
  surface: string;
  text: string;
  Icon: React.ComponentType<{ className?: string }>;
} {
  switch (urgency) {
    case 'overdue':
      return {
        surface: 'bg-rose-50 border-rose-200',
        text: 'text-rose-800',
        Icon: AlertTriangle,
      };
    case 'due_first':
    case 'due_soon':
      return {
        surface: 'bg-amber-50 border-amber-200',
        text: 'text-amber-900',
        Icon: BellRing,
      };
    case 'up_to_date':
    default:
      return {
        surface: 'bg-emerald-50 border-emerald-200',
        text: 'text-emerald-800',
        Icon: CheckCircle2,
      };
  }
}

export const CompetencyPeriodicBanner: React.FC<{
  user: SessionUser;
  revision?: number;
  onStartQuiz: () => void;
}> = ({ user, revision = 0, onStartQuiz }) => {
  const evaluation = useMemo(() => {
    void revision;
    const state = readStoredCompetencyQuizState(user.id);
    return evaluatePeriodicityStatus(state);
  }, [user.id, revision]);

  if (evaluation.urgency === 'up_to_date') {
    return null;
  }

  const style = getUrgencyBadgeStyles(evaluation.urgency);
  const Icon = style.Icon;

  return (
    <div
      role="region"
      aria-label="Периодическая проверка профессиональных компетенций"
      className={`border rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${style.surface}`}
    >
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
          <Icon className={`w-4 h-4 ${style.text}`} aria-hidden="true" />
        </span>
        <div className="space-y-0.5">
          <p className={`text-xs font-semibold ${style.text}`}>
            Опросник для оценки профессиональных компетенций · {evaluation.statusLabel}
          </p>
          <p className="text-xs sm:text-sm font-medium text-slate-900">{evaluation.headline}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onStartQuiz}
        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <span>Пройти короткий тест</span>
        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
};

export const CompetencyAssessmentQuizCard: React.FC<CompetencyAssessmentQuizCardProps> = ({
  user,
  onJumpToKnowledgeBase,
  onUpdated,
}) => {
  const [state, setState] = useState<StoredCompetencyQuizState>(() =>
    readStoredCompetencyQuizState(user.id)
  );
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  useEffect(() => {
    setState(readStoredCompetencyQuizState(user.id));
    setCurrentIdx(0);
  }, [user.id]);

  const persist = (next: StoredCompetencyQuizState) => {
    setState(next);
    writeStoredCompetencyQuizState(user.id, next);
    onUpdated?.();
  };

  const questions: CompetencyQuestion[] = useMemo(() => {
    const byId = new Map(COMPETENCY_QUESTIONS.map((q) => [q.id, q]));
    const resolved = state.activeQuestionIds
      .map((id) => byId.get(id))
      .filter((q): q is CompetencyQuestion => Boolean(q));
    return resolved.length > 0 ? resolved : buildShortCompetencyQuiz(state.attempts[0]);
  }, [state.activeQuestionIds, state.attempts]);

  const activeQuestion = questions[currentIdx] ?? questions[0];
  const answeredCount = questions.filter((q) => Boolean(state.activeAnswers[q.id])).length;
  const allAnswered = answeredCount === questions.length;
  const evaluation = useMemo(() => evaluatePeriodicityStatus(state), [state]);
  const urgencyBadge = getUrgencyBadgeStyles(evaluation.urgency);
  const UrgencyIcon = urgencyBadge.Icon;

  const chosenOptionId = state.activeAnswers[activeQuestion.id];
  const isAnswered = Boolean(chosenOptionId);
  const isCorrect = chosenOptionId === activeQuestion.correctId;

  const currentCorrectCount = useMemo(
    () => questions.filter((q) => state.activeAnswers[q.id] === q.correctId).length,
    [questions, state.activeAnswers]
  );

  const handleIntervalChange = (intervalDays: QuizIntervalDays) => {
    const next: StoredCompetencyQuizState = {
      ...state,
      intervalDays,
    };
    persist(next);
    tracker.trackCustomInteraction(
      `Опросник компетенций · интервал ${intervalDays} дн.`,
      'account'
    );
  };

  const handleChooseOption = (optionId: string) => {
    if (isAnswered) return;
    const nextAnswers = {
      ...state.activeAnswers,
      [activeQuestion.id]: optionId,
    };
    const allDoneNow = questions.every((q) => Boolean(nextAnswers[q.id]));

    if (allDoneNow) {
      const attempt = gradeCompetencyAttempt(questions, nextAnswers, state.intervalDays);
      const next: StoredCompetencyQuizState = {
        ...state,
        activeAnswers: nextAnswers,
        lastCompletedAt: attempt.completedAt,
        attempts: [attempt, ...state.attempts].slice(0, 12),
      };
      persist(next);
      tracker.trackCustomInteraction(
        `Опросник компетенций · завершён (${attempt.scorePercent}%)`,
        'account'
      );
    } else {
      persist({
        ...state,
        activeAnswers: nextAnswers,
      });
    }
  };

  const handleStartNewRound = () => {
    const nextQuestions = buildShortCompetencyQuiz(state.attempts[0] ?? null);
    persist({
      ...state,
      activeQuestionIds: nextQuestions.map((q) => q.id),
      activeAnswers: {},
    });
    setCurrentIdx(0);
    tracker.trackCustomInteraction('Опросник компетенций · новый короткий тест', 'account');
  };

  return (
    <section
      id="competency-assessment-quiz"
      aria-labelledby="competency-assessment-quiz-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 scroll-mt-24"
    >
      {/* Header + Periodicity Selector */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 font-semibold text-teal-700">
              <ClipboardCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Периодическая проверка · НПА и техника безопасности</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className={`inline-flex items-center gap-1 font-semibold ${urgencyBadge.text}`}>
              <UrgencyIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{evaluation.statusLabel}</span>
            </span>
          </div>

          <h3
            id="competency-assessment-quiz-heading"
            className="text-lg font-bold text-slate-900"
          >
            Опросник для оценки профессиональных компетенций
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {evaluation.headline}
          </p>
        </div>

        <div className="space-y-1.5 shrink-0">
          <p className="text-[11px] font-medium text-slate-500 lg:text-right">
            Периодичность напоминаний
          </p>
          <div
            role="group"
            aria-label="Периодичность прохождения опросника"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {([14, 30, 60] as const).map((days) => {
              const active = state.intervalDays === days;
              return (
                <button
                  key={days}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleIntervalChange(days)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Раз в {days} дн.
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Metrics Strip */}
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          <dt className="text-[11px] font-medium text-slate-500">Последний результат</dt>
          <dd className="mt-0.5 text-base font-bold font-mono text-slate-900 tabular-nums">
            {evaluation.lastScorePercent !== null ? `${evaluation.lastScorePercent}%` : 'Не пройден'}
          </dd>
          <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
            Пройдено попыток: {evaluation.attemptsCount}
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          <dt className="text-[11px] font-medium text-slate-500">Нормативная база (НПА)</dt>
          <dd className="mt-0.5 text-base font-bold font-mono text-teal-800 tabular-nums">
            {evaluation.lastNpaPercent !== null ? `${evaluation.lastNpaPercent}%` : '—'}
          </dd>
          <p className="mt-0.5 text-[11px] text-slate-500">132-ФЗ · ПП № 1003/1893/760</p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          <dt className="text-[11px] font-medium text-slate-500">Техника безопасности</dt>
          <dd className="mt-0.5 text-base font-bold font-mono text-teal-800 tabular-nums">
            {evaluation.lastSafetyPercent !== null ? `${evaluation.lastSafetyPercent}%` : '—'}
          </dd>
          <p className="mt-0.5 text-[11px] text-slate-500">WFA · Переправы · ПСР</p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          <dt className="text-[11px] font-medium text-slate-500">Следующая проверка</dt>
          <dd className="mt-0.5 text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
            <span className="truncate">{evaluation.nextDueFormatted ?? 'Сегодня'}</span>
          </dd>
          <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
            Интервал: каждые {state.intervalDays} дн.
          </p>
        </div>
      </dl>

      {/* Interactive Short Test Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
            {activeQuestion.domain === 'npa' ? (
              <Scale className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
            )}
            <span>{activeQuestion.domainLabel}</span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="font-mono text-slate-500">{activeQuestion.reference}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {questions.map((q, idx) => {
              const ans = state.activeAnswers[q.id];
              const qCorrect = ans && ans === q.correctId;
              const qWrong = ans && ans !== q.correctId;
              const active = idx === currentIdx;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIdx(idx)}
                  aria-label={`Вопрос ${idx + 1}`}
                  className={`w-7 h-7 rounded-md text-xs font-mono font-semibold transition-colors cursor-pointer tabular-nums ${
                    active
                      ? 'bg-slate-900 text-white'
                      : qCorrect
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : qWrong
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
          {currentIdx + 1}. {activeQuestion.question}
        </h4>

        <div className="space-y-2">
          {activeQuestion.options.map((opt) => {
            const isSelected = chosenOptionId === opt.id;
            const isRightOption = opt.id === activeQuestion.correctId;

            let optionClass =
              'bg-white border-slate-200 hover:border-teal-400 text-slate-800 cursor-pointer';
            if (isAnswered) {
              if (isRightOption) {
                optionClass = 'bg-emerald-50 border-emerald-400 text-emerald-950 cursor-default';
              } else if (isSelected && !isRightOption) {
                optionClass = 'bg-rose-50 border-rose-400 text-rose-950 cursor-default';
              } else {
                optionClass = 'bg-white border-slate-200 text-slate-500 opacity-75 cursor-default';
              }
            }

            return (
              <button
                key={opt.id}
                type="button"
                disabled={isAnswered}
                onClick={() => handleChooseOption(opt.id)}
                className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-lg border text-xs sm:text-sm transition-colors ${optionClass}`}
              >
                <span className="font-mono font-bold uppercase shrink-0 mt-0.5">
                  {opt.id}.
                </span>
                <span className="flex-1 leading-relaxed">{opt.text}</span>
                {isAnswered && isRightOption && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                )}
                {isAnswered && isSelected && !isRightOption && (
                  <XCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div
            className={`rounded-lg border p-3.5 text-xs leading-relaxed ${
              isCorrect
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : 'bg-amber-50/70 border-amber-200 text-amber-950'
            }`}
          >
            <p className="font-semibold mb-1">
              {isCorrect ? 'Верно.' : 'Требуется повторение.'}{' '}
              <span className="font-normal">{activeQuestion.explanation}</span>
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-xs font-mono text-slate-500 tabular-nums">
            Отвечено: {answeredCount} / {questions.length} · Верно сейчас: {currentCorrectCount}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentIdx < questions.length - 1 && (
              <button
                type="button"
                onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:border-teal-500 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <span>Следующий вопрос</span>
                <ArrowRight className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              </button>
            )}

            {allAnswered && (
              <button
                type="button"
                onClick={handleStartNewRound}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Пройти новый набор (6 вопросов)</span>
              </button>
            )}

            {onJumpToKnowledgeBase && (
              <button
                type="button"
                onClick={() =>
                  onJumpToKnowledgeBase(
                    activeQuestion.domain === 'npa' ? '1003' : 'первая помощь'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-800 hover:text-teal-950 cursor-pointer"
              >
                <span>Открыть в базе знаний</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Attempt History */}
      {state.attempts.length > 0 && (
        <div className="pt-1 border-t border-slate-100 space-y-3">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            aria-expanded={showHistory}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>
              {showHistory
                ? 'Скрыть журнал периодических проверок'
                : `Журнал проверок (${state.attempts.length})`}
            </span>
          </button>

          {showHistory && (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th scope="col" className="text-left font-semibold px-4 py-2.5">
                      Дата прохождения
                    </th>
                    <th scope="col" className="text-right font-semibold px-4 py-2.5">
                      Итог
                    </th>
                    <th scope="col" className="text-right font-semibold px-4 py-2.5">
                      НПА
                    </th>
                    <th scope="col" className="text-right font-semibold px-4 py-2.5">
                      Безопасность
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.attempts.map((att) => (
                    <tr key={att.id} className="bg-white">
                      <td className="px-4 py-2 text-slate-700 font-mono tabular-nums">
                        {att.completedAt.slice(0, 10)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {att.correctCount}/{att.totalQuestions} ({att.scorePercent}%)
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-teal-800 tabular-nums">
                        {att.npaPercent}%
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-teal-800 tabular-nums">
                        {att.safetyPercent}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
