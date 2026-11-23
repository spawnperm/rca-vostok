import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  EXAM_PASSING_THRESHOLD_PCT,
  EXAM_SIM_QUESTIONS,
  EXAM_TOPICS,
  evaluateExamAnswer,
  filterExamQuestionsByTopic,
  getRemainingWrongQuestions,
  summarizeExamSession,
  type ExamSimQuestion,
  type ExamTopicId,
} from '../../utils/preparationExamSimulator';
import { tracker } from '../../utils/tracker';

export const PreparationExamSimulator: React.FC = () => {
  const [selectedTopic, setSelectedTopic] = useState<ExamTopicId>('all');
  const [retryIds, setRetryIds] = useState<string[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState<boolean>(false);

  const activeQuestions: ExamSimQuestion[] = useMemo(() => {
    const topicDeck = filterExamQuestionsByTopic(EXAM_SIM_QUESTIONS, selectedTopic);
    if (retryIds && retryIds.length > 0) {
      const subset = getRemainingWrongQuestions(topicDeck, retryIds);
      if (subset.length > 0) return subset;
    }
    return topicDeck;
  }, [selectedTopic, retryIds]);

  const safeIndex = Math.min(currentIndex, Math.max(activeQuestions.length - 1, 0));
  const currentQuestion = activeQuestions[safeIndex];

  const sessionSummary = useMemo(
    () => summarizeExamSession(activeQuestions, answers),
    [activeQuestions, answers]
  );

  const selectedOptionId = currentQuestion ? answers[currentQuestion.id] : undefined;
  const currentEvaluation = useMemo(() => {
    if (!currentQuestion || !selectedOptionId) return null;
    return evaluateExamAnswer(currentQuestion, selectedOptionId);
  }, [currentQuestion, selectedOptionId]);

  const handleSelectTopic = (topicId: ExamTopicId) => {
    setSelectedTopic(topicId);
    setRetryIds(null);
    setCurrentIndex(0);
    setAnswers({});
    setShowSummary(false);
    const label = EXAM_TOPICS.find((t) => t.id === topicId)?.label ?? topicId;
    tracker.trackCustomInteraction(`Тренажёр экзамена (Подготовка): тема ${label}`);
  };

  const handlePickOption = (optionId: string) => {
    if (!currentQuestion || answers[currentQuestion.id]) return;
    const evaluation = evaluateExamAnswer(currentQuestion, optionId);
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: optionId,
    }));
    tracker.trackCustomInteraction(
      `Тренажёр экзамена: ${currentQuestion.topicLabel}`,
      evaluation.isCorrect ? 'верно' : 'ошибка'
    );
  };

  const handleNextOrFinish = () => {
    if (safeIndex + 1 < activeQuestions.length) {
      setCurrentIndex(safeIndex + 1);
    } else {
      setShowSummary(true);
      tracker.trackCustomInteraction(
        'Тренажёр экзамена завершён',
        `${sessionSummary.correct}/${sessionSummary.total}`
      );
    }
  };

  const handleRestartAll = () => {
    setRetryIds(null);
    setAnswers({});
    setCurrentIndex(0);
    setShowSummary(false);
    tracker.trackCustomInteraction('Тренажёр экзамена: сброс');
  };

  const handleRetryWrong = () => {
    if (sessionSummary.wrongQuestionIds.length === 0) return;
    setRetryIds(sessionSummary.wrongQuestionIds);
    setAnswers({});
    setCurrentIndex(0);
    setShowSummary(false);
    tracker.trackCustomInteraction(
      'Тренажёр экзамена: работа над ошибками',
      `${sessionSummary.wrongQuestionIds.length} вопр.`
    );
  };

  const progressPct =
    activeQuestions.length > 0
      ? Math.round((sessionSummary.answered / activeQuestions.length) * 100)
      : 0;

  return (
    <div
      aria-labelledby="prep-exam-simulator-heading"
      className="bg-white border border-slate-200 rounded-xl p-5 sm:p-7 space-y-5"
    >
      {/* Header & Live Score */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-800">
            <BookOpenCheck className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Интерактивный тренажёр · Мгновенная проверка ответа</span>
          </div>
          <h3
            id="prep-exam-simulator-heading"
            className="text-lg sm:text-xl font-bold text-slate-900 text-balance"
          >
            Симулятор экзаменационных билетов РЦА «Русский Восток»
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Выберите вариант ответа на каждый вопрос и сразу получите разбор с опорой на нормы ФЗ №
            132-ФЗ, ПП РФ № 1003/1893, ПП РФ № 760 и протоколы полевых испытаний.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5">
          <div className="text-xs">
            <p className="text-slate-500">Точность</p>
            <p className="font-bold text-slate-900 tabular-nums">
              {sessionSummary.correct} из {sessionSummary.answered || 0} верных
            </p>
          </div>
          <div className="h-7 w-px bg-slate-200" aria-hidden="true" />
          <div className="text-xs">
            <p className="text-slate-500">Прогресс</p>
            <p className="font-mono font-bold text-teal-800 tabular-nums">
              {sessionSummary.answered}/{activeQuestions.length}
            </p>
          </div>
        </div>
      </div>

      {/* Topic Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Темы билетов">
          {EXAM_TOPICS.map((topic) => {
            const isSelected = selectedTopic === topic.id && !retryIds;
            return (
              <button
                key={topic.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleSelectTopic(topic.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {topic.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {retryIds && (
            <span className="text-xs font-semibold text-amber-800">
              Режим работы над ошибками
            </span>
          )}
          {sessionSummary.answered > 0 && (
            <button
              type="button"
              onClick={handleRestartAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Начать заново</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar & Question Stepper */}
      <div className="space-y-3">
        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-teal-700 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <nav aria-label="Навигация по экзаменационным вопросам" className="flex flex-wrap items-center gap-1.5">
          {activeQuestions.map((q, idx) => {
            const picked = answers[q.id];
            const isCurrent = !showSummary && idx === safeIndex;
            const isCorrect = picked ? picked === q.correctOptionId : null;

            let buttonStyle = 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50';
            if (isCurrent) {
              buttonStyle = 'bg-slate-900 border-slate-900 text-white';
            } else if (isCorrect === true) {
              buttonStyle = 'bg-teal-50 border-teal-300 text-teal-900';
            } else if (isCorrect === false) {
              buttonStyle = 'bg-red-50 border-red-300 text-red-900';
            }

            const statusText =
              isCorrect === true
                ? 'ответ верный'
                : isCorrect === false
                  ? 'ответ неверный'
                  : 'без ответа';

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => {
                  setShowSummary(false);
                  setCurrentIndex(idx);
                }}
                aria-label={`Вопрос ${idx + 1}: ${statusText}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={`w-8 h-8 rounded-lg border text-xs font-mono font-bold tabular-nums transition-colors cursor-pointer ${buttonStyle}`}
              >
                {idx + 1}
              </button>
            );
          })}

          {sessionSummary.answered === activeQuestions.length && activeQuestions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSummary(true)}
              className={`ml-auto px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                showSummary
                  ? 'bg-teal-700 border-teal-700 text-white'
                  : 'bg-teal-50 border-teal-300 text-teal-900 hover:bg-teal-100'
              }`}
            >
              Итог экзамена
            </button>
          )}
        </nav>
      </div>

      {/* Main Content: Either Summary Screen or Active Question + Instant Feedback */}
      {showSummary ? (
        <div className="border border-slate-200 rounded-xl bg-slate-50/70 p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-900">
                <Award
                  className={`w-4 h-4 ${
                    sessionSummary.passed ? 'text-teal-700' : 'text-amber-700'
                  }`}
                  aria-hidden="true"
                />
                <span>
                  {sessionSummary.passed
                    ? `Экзаменационный блок сдан (${sessionSummary.scorePct}% ≥ порога ${EXAM_PASSING_THRESHOLD_PCT}%)`
                    : `Результат ${sessionSummary.scorePct}% (для зачёта требуется ≥ ${EXAM_PASSING_THRESHOLD_PCT}%)`}
                </span>
              </div>
              <h4 className="text-lg font-bold text-slate-900">
                Правильных ответов: {sessionSummary.correct} из {sessionSummary.total}
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
                {sessionSummary.passed
                  ? 'Вы уверенно ориентируетесь в требованиях нормативных документов и полевой безопасности. Можно переходить к выбору очной сессии и площадки испытаний.'
                  : 'Рекомендуем закрепить ошибочные билеты в режиме работы над ошибками — каждое пояснение содержит точную ссылку на постановление или методику ФСТР.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {sessionSummary.wrongQuestionIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleRetryWrong}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  <span>Повторить ошибки ({sessionSummary.wrongQuestionIds.length})</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleRestartAll}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Пройти всё заново</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
            {sessionSummary.byTopic.map((item) => {
              const pct = item.total > 0 ? Math.round((item.correct / item.total) * 100) : 0;
              return (
                <div
                  key={item.topicId}
                  className="bg-white border border-slate-200 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-800">{item.topicLabel}</span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {item.correct}/{item.total} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full ${pct >= EXAM_PASSING_THRESHOLD_PCT ? 'bg-teal-700' : 'bg-amber-600'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : currentQuestion ? (
        <article className="border border-slate-200 rounded-xl bg-slate-50/50 p-5 sm:p-6 space-y-5">
          {/* Question metadata + stem */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-semibold text-slate-800 tabular-nums">
                Вопрос {safeIndex + 1} из {activeQuestions.length}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-teal-800">{currentQuestion.topicLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{currentQuestion.difficulty}</span>
            </div>
            <h4 className="text-base font-bold text-slate-900 leading-snug">
              {currentQuestion.question}
            </h4>
          </div>

          {/* Choices */}
          <div className="space-y-2.5" role="radiogroup" aria-label="Варианты ответа">
            {currentQuestion.options.map((option) => {
              const isPicked = selectedOptionId === option.id;
              const isCorrectOption = option.id === currentQuestion.correctOptionId;
              const isLocked = Boolean(selectedOptionId);

              let cardClasses =
                'bg-white border-slate-200 text-slate-800 hover:border-teal-600 hover:bg-teal-50/40';
              if (isLocked) {
                if (isCorrectOption) {
                  cardClasses = 'bg-teal-50/90 border-teal-600 text-teal-950 font-medium';
                } else if (isPicked && !isCorrectOption) {
                  cardClasses = 'bg-red-50/90 border-red-500 text-red-950';
                } else {
                  cardClasses = 'bg-white/70 border-slate-200 text-slate-500';
                }
              }

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={isLocked}
                  onClick={() => handlePickOption(option.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-xs sm:text-sm flex items-start gap-3 transition-colors ${
                    isLocked ? 'cursor-default' : 'cursor-pointer'
                  } ${cardClasses}`}
                >
                  <span
                    className={`w-6 h-6 rounded-md border text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                      isLocked && isCorrectOption
                        ? 'bg-teal-700 border-teal-700 text-white'
                        : isLocked && isPicked && !isCorrectOption
                          ? 'bg-red-700 border-red-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-700'
                    }`}
                  >
                    {option.label}
                  </span>

                  <span className="flex-1 leading-relaxed">{option.text}</span>

                  {isLocked && isCorrectOption && (
                    <CheckCircle2
                      className="w-4 h-4 text-teal-700 shrink-0 mt-1"
                      aria-label="Правильный вариант"
                    />
                  )}
                  {isLocked && isPicked && !isCorrectOption && (
                    <XCircle
                      className="w-4 h-4 text-red-700 shrink-0 mt-1"
                      aria-label="Неправильный выбор"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Instant Feedback Panel (shown immediately upon choosing an option) */}
          {currentEvaluation ? (
            <div
              role="status"
              aria-live="polite"
              className={`rounded-xl border p-4 space-y-3 ${
                currentEvaluation.isCorrect
                  ? 'bg-teal-50 border-teal-300 text-teal-950'
                  : 'bg-red-50 border-red-300 text-red-950'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold">
                  {currentEvaluation.isCorrect ? (
                    <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-700 shrink-0" aria-hidden="true" />
                  )}
                  <span>{currentEvaluation.feedbackHeading}</span>
                </div>
                <span className="text-[11px] font-mono text-slate-700">
                  {currentEvaluation.legalRef}
                </span>
              </div>

              <p className="text-xs sm:text-sm leading-relaxed text-slate-800">
                {currentEvaluation.explanation}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <span className="text-[11px] text-slate-600 tabular-nums">
                  Отвечено {sessionSummary.answered} из {activeQuestions.length}
                </span>
                <button
                  type="button"
                  onClick={handleNextOrFinish}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>
                    {safeIndex + 1 < activeQuestions.length
                      ? 'Следующий вопрос'
                      : 'Показать итог'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Выберите один из вариантов выше — система сразу покажет правильность ответа и ссылку на нормативный акт.
            </p>
          )}
        </article>
      ) : null}
    </div>
  );
};
