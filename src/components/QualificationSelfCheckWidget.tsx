import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Headset,
  PieChart as PieChartIcon,
  RotateCcw,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { SessionUser } from '../utils/identityApi';
import {
  ANSWER_LEVEL_OPTIONS,
  QUALIFICATION_TRACKS,
  SELF_CHECK_QUESTIONS,
  createEmptySelfCheckState,
  evaluateSelfCheck,
  readStoredSelfCheck,
  writeStoredSelfCheck,
  type PieSliceItem,
  type QualificationAnswerLevel,
  type QualificationTrackId,
  type StoredSelfCheckState,
} from '../utils/qualificationSelfCheck';
import { tracker } from '../utils/tracker';

type PieViewMode = 'status' | 'domains';
type QuestionFilterMode = 'all' | 'unanswered' | 'gaps';

interface QualificationSelfCheckWidgetProps {
  user: SessionUser;
  onJumpToChecklist?: () => void;
  onJumpToKnowledgeBase?: (query?: string) => void;
  onJumpToConsultant?: () => void;
  onChange?: () => void;
}

function SelfCheckPieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: PieSliceItem }[];
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-md px-3.5 py-2.5 text-xs space-y-1">
      <div className="flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-xs shrink-0"
          style={{ backgroundColor: item.color }}
          aria-hidden="true"
        />
        <span className="font-semibold text-slate-900">{item.name}</span>
      </div>
      <p className="font-mono text-slate-700 tabular-nums">
        {item.value} {item.unitLabel} · {item.percent}%
      </p>
    </div>
  );
}

export const QualificationSelfCheckWidget: React.FC<QualificationSelfCheckWidgetProps> = ({
  user,
  onJumpToChecklist,
  onJumpToKnowledgeBase,
  onJumpToConsultant,
  onChange,
}) => {
  const [state, setState] = useState<StoredSelfCheckState>(() =>
    readStoredSelfCheck(user.id)
  );
  const [pieMode, setPieMode] = useState<PieViewMode>('status');
  const [questionFilter, setQuestionFilter] = useState<QuestionFilterMode>('all');

  useEffect(() => {
    setState(readStoredSelfCheck(user.id));
  }, [user.id]);

  const evaluation = useMemo(
    () => evaluateSelfCheck(state.answers, state.track),
    [state.answers, state.track]
  );

  const activeTrackInfo =
    QUALIFICATION_TRACKS.find((t) => t.id === state.track) ?? QUALIFICATION_TRACKS[0];

  const visibleQuestions = useMemo(() => {
    if (questionFilter === 'unanswered') {
      return SELF_CHECK_QUESTIONS.filter((q) => !state.answers[q.id]);
    }
    if (questionFilter === 'gaps') {
      return SELF_CHECK_QUESTIONS.filter((q) => {
        const val = state.answers[q.id];
        return val === 'in_progress' || val === 'missing';
      });
    }
    return SELF_CHECK_QUESTIONS;
  }, [questionFilter, state.answers]);

  const updateState = (next: StoredSelfCheckState) => {
    setState(next);
    writeStoredSelfCheck(user.id, next);
    onChange?.();
  };

  const handleTrackChange = (track: QualificationTrackId) => {
    const next: StoredSelfCheckState = {
      ...state,
      track,
      updatedAt: new Date().toISOString(),
    };
    updateState(next);
    const trackMeta = QUALIFICATION_TRACKS.find((t) => t.id === track);
    tracker.trackCustomInteraction(
      `Анкета-самопроверка · профиль: ${trackMeta?.label ?? track}`,
      'account'
    );
  };

  const handleSelectAnswer = (questionId: string, level: QualificationAnswerLevel) => {
    const nextAnswers = {
      ...state.answers,
      [questionId]: level,
    };
    const next: StoredSelfCheckState = {
      ...state,
      answers: nextAnswers,
      updatedAt: new Date().toISOString(),
    };
    updateState(next);
    const nextEval = evaluateSelfCheck(nextAnswers, state.track);
    tracker.trackCustomInteraction(
      `Анкета-самопроверка: ${questionId}`,
      `${level} (${nextEval.readinessPercent}%)`
    );
  };

  const handleReset = () => {
    const next = createEmptySelfCheckState(state.track);
    updateState(next);
    setQuestionFilter('all');
    tracker.trackCustomInteraction('Анкета-самопроверка: сброс ответов', 'account');
  };

  const activePieSlices =
    pieMode === 'status' ? evaluation.statusPieData : evaluation.domainPieData;

  const hasDomainChartData = evaluation.domainPieData.length > 0;
  const showEmptyChartState =
    evaluation.answeredCount === 0 || (pieMode === 'domains' && !hasDomainChartData);

  const completionPct = Math.round(
    (evaluation.answeredCount / evaluation.totalQuestions) * 100
  );

  const verdictSurfaceClass =
    evaluation.verdictTier === 'ready'
      ? 'border-teal-300 bg-teal-50/60'
      : evaluation.verdictTier === 'contour_a'
      ? 'border-amber-300 bg-amber-50/60'
      : evaluation.verdictTier === 'training_needed'
      ? 'border-red-300 bg-red-50/50'
      : 'border-slate-200 bg-white';

  const topGapQuery = evaluation.recommendations[0]?.knowledgeQuery;

  return (
    <section
      id="qualification-self-check"
      aria-labelledby="qualification-self-check-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 scroll-mt-24"
    >
      {/* Header & Track Selector */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 font-medium text-teal-700">
              <PieChartIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Предварительная оценка квалификации · ФЗ № 132-ФЗ</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {evaluation.answeredCount} / {evaluation.totalQuestions} критериев
            </span>
          </div>
          <h3 id="qualification-self-check-heading" className="text-lg font-bold text-slate-900">
            Анкета-самопроверка
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Пройдите предварительный тест на соответствие базовым требованиям квалификации
            инструктора-проводника — итоговый профиль готовности отображается на круговой диаграмме.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            role="tablist"
            aria-label="Направление квалификации для самопроверки"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {QUALIFICATION_TRACKS.map((track) => {
              const isSelected = state.track === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleTrackChange(track.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {track.shortLabel}
                </button>
              );
            })}
          </div>

          {evaluation.answeredCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Сбросить</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Strip & Filter */}
      <div className="space-y-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-600">
            Профиль: <strong className="font-semibold text-slate-800">{activeTrackInfo.label}</strong>{' '}
            <span className="text-slate-400" aria-hidden="true">
              ·
            </span>{' '}
            <span className="text-slate-500">{activeTrackInfo.hint}</span>
          </span>
          <span className="font-mono font-semibold text-teal-800 tabular-nums shrink-0">
            Индекс готовности: {evaluation.readinessPercent}% ({evaluation.earnedPoints}/
            {evaluation.maxPoints} б.)
          </span>
        </div>

        <div
          role="progressbar"
          aria-label="Заполненность анкеты-самопроверки"
          aria-valuenow={completionPct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-teal-700 transition-transform duration-200 origin-left"
            style={{ transform: `scaleX(${Math.max(completionPct / 100, 0)})` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: `Все критерии (${SELF_CHECK_QUESTIONS.length})` },
                {
                  id: 'unanswered',
                  label: `Без ответа (${evaluation.unansweredCount})`,
                },
                {
                  id: 'gaps',
                  label: `Зоны роста (${evaluation.partialCount + evaluation.missingCount})`,
                },
              ] as const
            ).map((tab) => {
              const active = questionFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setQuestionFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <span className="text-xs text-slate-500">
            Прогресс сохраняется автоматически для вашей учётной записи
          </span>
        </div>
      </div>

      {/* Main 2-Column Interactive Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Qualification Questionnaire */}
        <div className="xl:col-span-7">
          {visibleQuestions.length === 0 ? (
            <div className="border border-slate-200 rounded-lg p-6 text-center space-y-3 bg-slate-50">
              <p className="text-sm font-medium text-slate-800">
                {questionFilter === 'unanswered'
                  ? 'Вы ответили на все 8 критериев анкеты.'
                  : 'Зон роста пока не выявлено — все отмеченные пункты подтверждены.'}
              </p>
              <button
                type="button"
                onClick={() => setQuestionFilter('all')}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Показать все критерии
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white overflow-hidden">
              {visibleQuestions.map((q) => {
                const chosen = state.answers[q.id];
                return (
                  <div key={q.id} className="p-4 space-y-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="font-mono font-semibold text-teal-800 tabular-nums">
                          {q.orderLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-slate-700">{q.domainLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{q.requirementHint}</span>
                      </div>

                      <p className="text-sm font-semibold text-slate-900 leading-snug">
                        {q.title}
                      </p>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {q.trackNote[state.track]}
                      </p>
                    </div>

                    <div
                      role="group"
                      aria-label={`Самооценка по пункту: ${q.title}`}
                      className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                    >
                      {ANSWER_LEVEL_OPTIONS.map((opt) => {
                        const isSelected = chosen === opt.id;
                        let buttonStyle =
                          'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900';

                        if (isSelected) {
                          if (opt.id === 'confirmed') {
                            buttonStyle =
                              'bg-teal-700 border-teal-700 text-white font-semibold';
                          } else if (opt.id === 'in_progress') {
                            buttonStyle =
                              'bg-amber-600 border-amber-600 text-white font-semibold';
                          } else {
                            buttonStyle =
                              'bg-red-700 border-red-700 text-white font-semibold';
                          }
                        }

                        return (
                          <button
                            key={opt.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => handleSelectAnswer(q.id, opt.id)}
                            className={`px-3 py-2 text-xs rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${buttonStyle}`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 5 Cols: Pie Chart Results & Verdict */}
        <div className="xl:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-5">
          {/* Pie Mode Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Результаты самопроверки</h4>
              <p className="text-xs text-slate-500">Круговая диаграмма соответствия</p>
            </div>

            <div
              role="tablist"
              aria-label="Режим круговой диаграммы"
              className="inline-flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg"
            >
              {(
                [
                  { id: 'status', label: 'По статусу' },
                  { id: 'domains', label: 'По блокам' },
                ] as const
              ).map((mode) => {
                const active = pieMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setPieMode(mode.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Donut / Pie Chart Area */}
          {showEmptyChartState ? (
            <div className="bg-white border border-slate-200 rounded-lg p-6 text-center space-y-2">
              <PieChartIcon
                className="w-8 h-8 text-slate-300 mx-auto"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-slate-800">
                Диаграмма сформируется после первого ответа
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                {evaluation.answeredCount === 0
                  ? 'Отметьте статус хотя бы по одному из 8 критериев слева, чтобы увидеть структуру соответствия.'
                  : 'Отметьте хотя бы один критерий как «Соответствую» или «Частично», чтобы сравнить баллы по блокам квалификации.'}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
              <div className="relative h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={activePieSlices}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={88}
                      paddingAngle={2}
                      stroke="#ffffff"
                      strokeWidth={2}
                    >
                      {activePieSlices.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<SelfCheckPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Centered Donut Metric */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
                >
                  <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {evaluation.readinessPercent}%
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
                    {evaluation.earnedPoints} / {evaluation.maxPoints} б.
                  </span>
                </div>
              </div>

              {/* Explicit Legend Table */}
              <div className="divide-y divide-slate-100 border-t border-slate-200 pt-2 text-xs">
                {activePieSlices.map((slice) => (
                  <div
                    key={slice.id}
                    className="py-1.5 flex items-center justify-between gap-3"
                  >
                    <span className="inline-flex items-center gap-2 text-slate-700 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: slice.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{slice.name}</span>
                    </span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                      {slice.value} {slice.unitLabel} ({slice.percent}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Domain Progress Mini-Matrix */}
          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Срез по 4 блокам требований
            </p>
            <div className="space-y-2">
              {evaluation.domainBreakdown.map((dom) => (
                <div key={dom.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{dom.label}</span>
                    <span className="font-mono text-slate-900 tabular-nums">
                      {dom.earned}/{dom.max} б. ({dom.percent}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-transform duration-200 origin-left"
                      style={{
                        backgroundColor: dom.color,
                        transform: `scaleX(${Math.max(dom.percent / 100, 0)})`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Verdict & Recommendations */}
          <div className={`border rounded-lg p-4 space-y-3 ${verdictSurfaceClass}`}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                {evaluation.verdictTier === 'ready' ? (
                  <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                )}
                <span>{evaluation.verdictBadge}</span>
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900 leading-snug">
                {evaluation.verdictTitle}
              </p>
              <p className="text-xs text-slate-700 leading-relaxed">
                {evaluation.verdictSummary}
              </p>
            </div>

            <p className="text-xs text-slate-800 pt-2 border-t border-slate-200/80">
              <span className="text-slate-500">Рекомендуемый контур: </span>
              <span className="font-semibold">{evaluation.recommendedContour}</span>
            </p>

            {evaluation.recommendations.length > 0 && (
              <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Приоритетные пункты к закрытию ({evaluation.recommendations.length})
                </p>
                <ul className="space-y-1 text-xs text-slate-700">
                  {evaluation.recommendations.slice(0, 3).map((rec) => (
                    <li key={rec.questionId} className="flex items-start gap-1.5">
                      <span
                        className={`font-mono font-semibold shrink-0 ${
                          rec.severity === 'critical' ? 'text-red-700' : 'text-amber-700'
                        }`}
                      >
                        {rec.severity === 'critical' ? '!' : '·'}
                      </span>
                      <span className="leading-snug">{rec.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next-step Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {onJumpToChecklist && (
                <button
                  type="button"
                  onClick={onJumpToChecklist}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ClipboardCheck className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>Чек-лист документов</span>
                </button>
              )}

              {onJumpToKnowledgeBase && (
                <button
                  type="button"
                  onClick={() => onJumpToKnowledgeBase(topGapQuery)}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>{topGapQuery ? 'Материалы по пробелу' : 'База знаний и FAQ'}</span>
                </button>
              )}

              {onJumpToConsultant && (
                <button
                  type="button"
                  onClick={onJumpToConsultant}
                  className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Headset className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
                  <span>Консультант РЦА</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
