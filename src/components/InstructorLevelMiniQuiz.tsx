import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Compass,
  MessageSquare,
  RotateCcw,
} from 'lucide-react';
import {
  INSTRUCTOR_LEVEL_QUESTIONS,
  evaluateInstructorLevel,
} from '../utils/instructorLevelQuiz';
import { tracker } from '../utils/tracker';

interface InstructorLevelMiniQuizProps {
  onApplyForSession: (regionName: string, trackName: string) => void;
  onContactCurator: (sourceLabel: string) => void;
}

export const InstructorLevelMiniQuiz: React.FC<InstructorLevelMiniQuizProps> = ({
  onApplyForSession,
  onContactCurator,
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const result = useMemo(() => evaluateInstructorLevel(answers), [answers]);
  const progressPct = Math.round((result.answeredCount / result.totalQuestions) * 100);

  const handleSelect = (questionId: string, optionId: string, topic: string) => {
    const next = { ...answers, [questionId]: optionId };
    setAnswers(next);
    const evaluated = evaluateInstructorLevel(next);
    if (evaluated.isComplete) {
      tracker.trackCustomInteraction(
        `Мини-тест уровня подготовки завершён: ${evaluated.recommendedCategory}`,
        `${evaluated.totalPoints}/${evaluated.maxPoints}`
      );
    } else {
      tracker.trackCustomInteraction(`Мини-тест уровня: ${topic}`);
    }
  };

  const resetQuiz = () => {
    setAnswers({});
    tracker.trackCustomInteraction('Мини-тест уровня подготовки сброшен');
  };

  const tierColors =
    result.tier === 'advanced'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
      : result.tier === 'intermediate'
      ? 'bg-teal-50 border-teal-200 text-teal-950'
      : 'bg-amber-50 border-amber-200 text-amber-950';

  return (
    <section
      id="overview-level-quiz"
      aria-labelledby="overview-level-quiz-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Подбор категории сложности и трека обучения</span>
          </p>
          <h2 id="overview-level-quiz-heading" className="text-xl font-bold text-slate-900">
            Мини-тест на определение уровня подготовки инструктора
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Ответьте на 5 коротких вопросов — система подскажет оптимальную категорию аттестации
            (1 КС, 1–2 КС или 3–4 КС) и подходящий образовательный контур в ВВГУ.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg tabular-nums">
            Ответов: {result.answeredCount} / {result.totalQuestions}
          </span>
          {result.answeredCount > 0 && (
            <button
              type="button"
              onClick={resetQuiz}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Сбросить</span>
            </button>
          )}
        </div>
      </div>

      {/* Linear Progress */}
      <div
        role="progressbar"
        aria-label="Прогресс мини-теста уровня подготовки"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"
      >
        <div
          className="h-full bg-teal-700 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: 5 Questions */}
        <div className="lg:col-span-7 space-y-4">
          {INSTRUCTOR_LEVEL_QUESTIONS.map((q, qIdx) => {
            const selected = answers[q.id];
            return (
              <fieldset
                key={q.id}
                className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3"
              >
                <legend className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug px-1">
                  <span className="font-mono text-teal-800 mr-1.5">0{qIdx + 1}.</span>
                  {q.prompt}
                </legend>
                <div className="grid grid-cols-1 gap-2">
                  {q.options.map((opt) => {
                    const isChecked = selected === opt.id;
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-teal-50 border-teal-500 text-teal-950 font-medium'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={opt.id}
                          checked={isChecked}
                          onChange={() => handleSelect(q.id, opt.id, q.topic)}
                          className="mt-0.5 accent-teal-700 shrink-0 cursor-pointer"
                        />
                        <span className="leading-snug">{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>

        {/* Right: Real-time Category Recommendation */}
        <aside className="lg:col-span-5 lg:sticky lg:top-6 space-y-4">
          <div className={`border rounded-xl p-5 sm:p-6 space-y-4 ${tierColors}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {result.isComplete ? 'Итоговая рекомендация' : 'Предварительный расчёт'}
                </span>
              </span>
              <span className="text-xs font-mono font-bold tabular-nums">
                {result.totalPoints} / {result.maxPoints} б.
              </span>
            </div>

            {result.answeredCount === 0 ? (
              <div className="space-y-2 py-2">
                <h3 className="text-base font-bold text-slate-900">
                  Выберите ответы слева
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Оценка категории сложности и подходящего образовательного контура обновляется в
                  реальном времени по мере заполнения вопросов.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium opacity-80">Уровень подготовки</p>
                  <h3 className="text-lg font-bold leading-snug">{result.levelLabel}</h3>
                </div>

                <div className="bg-white/90 border border-slate-200/90 rounded-lg p-3.5 space-y-2 text-xs">
                  <div>
                    <p className="text-[11px] text-slate-500">Целевая категория аттестации</p>
                    <p className="font-bold text-slate-900 mt-0.5">
                      {result.recommendedCategory}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[11px] text-slate-500">Рекомендуемый контур ВВГУ / РЦА</p>
                    <p className="font-semibold text-teal-800 mt-0.5">
                      {result.recommendedContour}
                    </p>
                  </div>
                </div>

                <p className="text-xs leading-relaxed opacity-90">{result.summary}</p>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                    Следующие шаги
                  </p>
                  <ul className="space-y-1.5 text-xs">
                    {result.nextSteps.map((step) => (
                      <li key={step} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
                        <span className="leading-snug">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => onApplyForSession('Приморский край', result.recommendedTrack)}
                    className="w-full px-4 py-2.5 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Подать заявку по категории</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onContactCurator(
                        `Мини-тест уровня: ${result.recommendedCategory} (${result.totalPoints}/${result.maxPoints})`
                      )
                    }
                    className="w-full px-4 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                    <span>Уточнить допуск у куратора</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
};
