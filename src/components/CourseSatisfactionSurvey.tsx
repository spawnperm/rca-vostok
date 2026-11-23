import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, RotateCcw, Send, Star } from 'lucide-react';
import {
  SATISFACTION_CATEGORIES,
  SATISFACTION_CLARITY_OPTIONS,
  SATISFACTION_MODULES,
  SATISFACTION_PROGRAMS,
  computePersonalSatisfactionAvg,
  getSatisfactionVerdictLabel,
  type CourseSatisfactionSurveyStats,
} from '../utils/courseSatisfactionSurvey.ts';
import { tracker } from '../utils/tracker.ts';

function StarScaleInput({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <label htmlFor={id} className="text-xs font-semibold text-slate-900 leading-snug">
          {label}
        </label>
        <span className="font-mono text-xs font-bold text-teal-800 tabular-nums shrink-0">
          {value} / 5
        </span>
      </div>
      <div id={id} className="flex items-center gap-1.5" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((score) => {
          const active = score <= value;
          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(score)}
              aria-label={`${label}: ${score} из 5`}
              aria-pressed={value === score}
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                active
                  ? 'text-amber-500 hover:text-amber-600'
                  : 'text-slate-300 hover:text-slate-400'
              }`}
            >
              <Star
                className="w-5 h-5"
                fill={active ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500 leading-snug">{hint}</p>
    </div>
  );
}

export const CourseSatisfactionSurvey: React.FC = () => {
  const [courseProgram, setCourseProgram] = useState<string>(SATISFACTION_PROGRAMS[0]);
  const [complexityCategory, setComplexityCategory] = useState<string>(
    SATISFACTION_CATEGORIES[1]
  );
  const [preparationQuality, setPreparationQuality] = useState<number>(5);
  const [materialsQuality, setMaterialsQuality] = useState<number>(5);
  const [practiceUtility, setPracticeUtility] = useState<number>(5);
  const [materialsClarity, setMaterialsClarity] = useState<string>(
    SATISFACTION_CLARITY_OPTIONS[0]
  );
  const [mostUsefulModule, setMostUsefulModule] = useState<string>(
    SATISFACTION_MODULES[0]
  );
  const [npsRecommend, setNpsRecommend] = useState<number>(9);
  const [respondentName, setRespondentName] = useState<string>('');
  const [improvementSuggestion, setImprovementSuggestion] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{
    id: string;
    overallScore: number;
  } | null>(null);
  const [stats, setStats] = useState<CourseSatisfactionSurveyStats | null>(null);

  const loadStats = () => {
    fetch('/api/course-satisfaction/stats', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: CourseSatisfactionSurveyStats | null) => {
        if (data && typeof data.totalResponses === 'number') {
          setStats(data);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadStats();
  }, []);

  const personalAvg = useMemo(
    () =>
      computePersonalSatisfactionAvg(
        preparationQuality,
        materialsQuality,
        practiceUtility
      ),
    [preparationQuality, materialsQuality, practiceUtility]
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/course-satisfaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseProgram,
          complexityCategory,
          preparationQuality,
          materialsQuality,
          practiceUtility,
          materialsClarity,
          npsRecommend,
          mostUsefulModule,
          respondentName,
          improvementSuggestion,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        id?: string;
        overallScore?: number;
        stats?: CourseSatisfactionSurveyStats;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.id) {
        throw new Error(json.error || 'Не удалось сохранить анкету удовлетворённости.');
      }
      setSubmittedResult({
        id: json.id,
        overallScore: json.overallScore ?? personalAvg,
      });
      if (json.stats) {
        setStats(json.stats);
      } else {
        loadStats();
      }
      tracker.trackCustomInteraction(
        `Аттестация · Опросник удовлетворённости (${json.overallScore ?? personalAvg}/5)`,
        courseProgram
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ошибка при отправке оценки качества курса.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmittedResult(null);
    setError(null);
    setImprovementSuggestion('');
  };

  return (
    <section
      id="attestation-satisfaction-survey"
      aria-labelledby="satisfaction-survey-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Обратная связь после обучения и сессии</span>
          </p>
          <h3
            id="satisfaction-survey-heading"
            className="text-xl font-bold text-slate-900 text-balance"
          >
            Опросник удовлетворённости качеством подготовки и учебных материалов
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Оцените программы подготовки, методические пособия и разборы паспортов маршрутов
            РЦА «Русский Восток». Ваша оценка помогает обновлять билеты и практику к следующим
            сессиям аттестации.
          </p>
        </div>

        {/* Live Summary Strip */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 shrink-0">
          {stats && stats.totalResponses > 0 ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
              <div>
                <p className="text-[11px] text-slate-500">Общая оценка курса</p>
                <p className="font-mono text-sm font-bold text-teal-800 tabular-nums">
                  {stats.avgOverallScore.toFixed(1)} / 5
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Учебные материалы</p>
                <p className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                  {stats.avgMaterialsQuality.toFixed(1)} / 5
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Анкет собрано</p>
                <p className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                  {stats.totalResponses}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-600">
              <p className="font-semibold text-slate-800">Оценка выпускников потоков 2026–2027</p>
              <p className="text-[11px] text-slate-500">
                Результаты агрегируются в реальном времени после отправки анкеты
              </p>
            </div>
          )}
        </div>
      </div>

      {submittedResult ? (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1.5">
              <p className="inline-flex items-center gap-2 text-sm font-bold text-emerald-950">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                <span>Спасибо! Ваша оценка курса сохранена</span>
              </p>
              <p className="text-xs text-emerald-900 leading-relaxed">
                Итоговый индекс удовлетворённости по вашей анкете:{' '}
                <strong className="font-mono tabular-nums">
                  {submittedResult.overallScore.toFixed(1)} / 5
                </strong>{' '}
                ({getSatisfactionVerdictLabel(submittedResult.overallScore)}). Регистрационный код:{' '}
                <span className="font-mono">{submittedResult.id}</span>.
              </p>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-emerald-300 text-emerald-900 text-xs font-semibold rounded-lg hover:bg-emerald-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Заполнить ещё одну анкету</span>
            </button>
          </div>

          {stats && stats.totalResponses > 0 && (
            <div className="pt-3 border-t border-emerald-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs tabular-nums">
              <div className="bg-white/90 border border-emerald-200/70 rounded-lg p-3">
                <p className="text-[11px] text-slate-500">Качество подготовки</p>
                <p className="font-mono text-sm font-bold text-slate-900">
                  {stats.avgPreparationQuality.toFixed(1)} / 5
                </p>
              </div>
              <div className="bg-white/90 border border-emerald-200/70 rounded-lg p-3">
                <p className="text-[11px] text-slate-500">Учебные материалы</p>
                <p className="font-mono text-sm font-bold text-slate-900">
                  {stats.avgMaterialsQuality.toFixed(1)} / 5
                </p>
              </div>
              <div className="bg-white/90 border border-emerald-200/70 rounded-lg p-3">
                <p className="text-[11px] text-slate-500">Полезность практики</p>
                <p className="font-mono text-sm font-bold text-slate-900">
                  {stats.avgPracticeUtility.toFixed(1)} / 5
                </p>
              </div>
              <div className="bg-white/90 border border-emerald-200/70 rounded-lg p-3">
                <p className="text-[11px] text-slate-500">Рекомендуют коллегам</p>
                <p className="font-mono text-sm font-bold text-teal-800">
                  {stats.recommendSharePct}%
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Course Program & Complexity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="sat-program"
                className="block text-xs font-semibold text-slate-700"
              >
                Пройденная программа или трек подготовки
              </label>
              <select
                id="sat-program"
                value={courseProgram}
                onChange={(e) => setCourseProgram(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
              >
                {SATISFACTION_PROGRAMS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="sat-category"
                className="block text-xs font-semibold text-slate-700"
              >
                Категория сложности похода при аттестации
              </label>
              <select
                id="sat-category"
                value={complexityCategory}
                onChange={(e) => setComplexityCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
              >
                {SATISFACTION_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3 Quantitative Quality Scales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StarScaleInput
              id="sat-prep-score"
              label="Качество подготовки к аттестации"
              hint="Полнота разъяснений преподавателей и логика программы"
              value={preparationQuality}
              onChange={setPreparationQuality}
            />
            <StarScaleInput
              id="sat-materials-score"
              label="Учебные и методические материалы"
              hint="Пособия, шаблоны паспорта маршрута (ПП № 760) и тесты"
              value={materialsQuality}
              onChange={setMaterialsQuality}
            />
            <StarScaleInput
              id="sat-practice-score"
              label="Полезность практики и разборов"
              hint="Отработка первой помощи (WFA), переправ и ПСР"
              value={practiceUtility}
              onChange={setPracticeUtility}
            />
          </div>

          {/* Clarity + Most Useful Module */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 space-y-2">
              <span className="block text-xs font-semibold text-slate-700">
                Насколько понятны и достаточны учебные материалы?
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {SATISFACTION_CLARITY_OPTIONS.map((option) => {
                  const active = materialsClarity === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setMaterialsClarity(option)}
                      aria-pressed={active}
                      className={`text-left px-3 py-2.5 rounded-lg border text-xs leading-snug transition-colors cursor-pointer ${
                        active
                          ? 'bg-teal-50 border-teal-600 text-teal-950 font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-1.5">
              <label
                htmlFor="sat-module"
                className="block text-xs font-semibold text-slate-700"
              >
                Наиболее полезный модуль курса
              </label>
              <select
                id="sat-module"
                value={mostUsefulModule}
                onChange={(e) => setMostUsefulModule(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
              >
                {SATISFACTION_MODULES.map((mod) => (
                  <option key={mod} value={mod}>
                    {mod}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* NPS 0-10 Recommendation Scale */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                Насколько вероятно, что вы порекомендуете подготовку в РЦА «Русский Восток»
                коллегам? (0–10)
              </span>
              <span className="text-xs font-mono font-bold text-teal-800 tabular-nums">
                Выбрано: {npsRecommend} / 10
              </span>
            </div>
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Вероятность рекомендации курса от 0 до 10"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
                const selected = npsRecommend === score;
                return (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setNpsRecommend(score)}
                    aria-pressed={selected}
                    className={`w-9 h-9 rounded-lg border text-xs font-mono font-semibold tabular-nums transition-colors cursor-pointer ${
                      selected
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-teal-600'
                    }`}
                  >
                    {score}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Comment & Name */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-4 space-y-1.5">
              <label
                htmlFor="sat-name"
                className="block text-xs font-semibold text-slate-700"
              >
                Ваше имя (необязательно)
              </label>
              <input
                id="sat-name"
                type="text"
                value={respondentName}
                onChange={(e) => setRespondentName(e.target.value)}
                placeholder="Например, Алексей Смирнов"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
              />
            </div>

            <div className="md:col-span-8 space-y-1.5">
              <label
                htmlFor="sat-suggestion"
                className="block text-xs font-semibold text-slate-700"
              >
                Предложения по улучшению учебных материалов и практики
              </label>
              <textarea
                id="sat-suggestion"
                rows={2}
                value={improvementSuggestion}
                onChange={(e) => setImprovementSuggestion(e.target.value)}
                placeholder="Какие темы, шаблоны паспортов или практические разборы стоит расширить в следующих потоках?"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 resize-y"
              />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800"
            >
              {error}
            </div>
          )}

          {/* Footer Submit Row */}
          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-600">
              Средняя по текущей анкете:{' '}
              <strong className="font-mono font-bold text-slate-900 tabular-nums">
                {personalAvg.toFixed(1)} / 5
              </strong>{' '}
              · {getSatisfactionVerdictLabel(personalAvg)}
            </p>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{submitting ? 'Сохранение…' : 'Отправить оценку курса'}</span>
            </button>
          </div>
        </form>
      )}
    </section>
  );
};
