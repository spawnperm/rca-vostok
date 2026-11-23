import React, { useMemo, useState } from 'react';
import { Award, Check, RotateCcw } from 'lucide-react';
import {
  EXPERT_COURSES,
  EXPERT_RATING_PRESETS,
  buildDynamicExpertTips,
  calculateExpertRating,
  type ExpertCourseId,
  type ExpertRatingInput,
} from '../utils/expertRatingCalculator';
import { ExpertRatingGauge } from './ExpertRatingGauge';
import { ExpertRatingTipsPanel } from './ExpertRatingTipsPanel';
import { tracker } from '../utils/tracker';

const DEFAULT_INPUT: ExpertRatingInput = EXPERT_RATING_PRESETS[1].input;

export const ExpertRatingCalculatorWidget: React.FC = () => {
  const [activePresetId, setActivePresetId] = useState<string>(
    EXPERT_RATING_PRESETS[1].id
  );
  const [input, setInput] = useState<ExpertRatingInput>(DEFAULT_INPUT);

  const rating = useMemo(() => calculateExpertRating(input), [input]);
  const dynamicTips = useMemo(
    () => buildDynamicExpertTips(input, rating),
    [input, rating]
  );

  const updateField = <K extends keyof ExpertRatingInput>(
    field: K,
    value: ExpertRatingInput[K]
  ) => {
    setActivePresetId('custom');
    setInput((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const toggleCourse = (courseId: ExpertCourseId) => {
    setActivePresetId('custom');
    setInput((prev) => {
      const exists = prev.completedCourses.includes(courseId);
      const nextCourses = exists
        ? prev.completedCourses.filter((id) => id !== courseId)
        : [...prev.completedCourses, courseId];
      tracker.trackCustomInteraction(
        `Калькулятор экспертного рейтинга: курс ${courseId}`,
        exists ? 'снят' : 'отмечен'
      );
      return {
        ...prev,
        completedCourses: nextCourses,
      };
    });
  };

  const applyPreset = (presetId: string) => {
    const found = EXPERT_RATING_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    setActivePresetId(found.id);
    setInput(found.input);
    tracker.trackCustomInteraction(
      `Калькулятор экспертного рейтинга: профиль ${found.label}`
    );
  };

  return (
    <section
      aria-labelledby="expert-rating-calculator-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header & Presets */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Оценка квалификации соискателя · 100-балльная шкала РЦА</span>
          </p>
          <h2
            id="expert-rating-calculator-heading"
            className="text-xl sm:text-2xl font-bold text-slate-900"
          >
            Калькулятор экспертного рейтинга
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Рассчитайте предполагаемый экспертный балл на основе полевого стажа,
            пройденных курсов подготовки и категорий сложности походов (1–4 КС), чтобы
            увидеть прогресс до следующего уровня и персональные советы комиссии.
          </p>
        </div>

        <button
          type="button"
          onClick={() => applyPreset(EXPERT_RATING_PRESETS[1].id)}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Сбросить профиль</span>
        </button>
      </div>

      {/* Quick Profile Presets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {EXPERT_RATING_PRESETS.map((preset) => {
          const isActive = activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className={`p-3.5 text-left rounded-lg border transition-colors cursor-pointer ${
                isActive
                  ? 'bg-teal-50/70 border-teal-700 text-slate-900'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <p className="text-xs font-semibold text-slate-900">{preset.label}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{preset.description}</p>
            </button>
          );
        })}
      </div>

      {/* Main Split: Inputs (7 cols) + Gauge Visualization (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Inputs */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Experience Inputs */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              1. Полевой опыт и руководство группами
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <label htmlFor="rating-exp-years" className="font-medium text-slate-700">
                    Стаж сопровождения
                  </label>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {input.experienceYears} лет
                  </span>
                </div>
                <input
                  id="rating-exp-years"
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={input.experienceYears}
                  onChange={(e) =>
                    updateField('experienceYears', Number(e.target.value))
                  }
                  className="w-full accent-teal-700 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                  <span>0 лет</span>
                  <span>20+ лет</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <label htmlFor="rating-led-groups" className="font-medium text-slate-700">
                    Проведённых групп
                  </label>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {input.ledGroupsCount} марш.
                  </span>
                </div>
                <input
                  id="rating-led-groups"
                  type="range"
                  min={0}
                  max={60}
                  step={1}
                  value={input.ledGroupsCount}
                  onChange={(e) =>
                    updateField('ledGroupsCount', Number(e.target.value))
                  }
                  className="w-full accent-teal-700 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                  <span>0</span>
                  <span>60+ групп</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Completed Courses */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                2. Пройденные курсы и модули подготовки
              </h3>
              <span className="text-xs font-mono text-teal-800 tabular-nums">
                {rating.coursesPoints} / {rating.maxCoursesPoints} б.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {EXPERT_COURSES.map((course) => {
                const checked = input.completedCourses.includes(course.id);
                return (
                  <button
                    key={course.id}
                    type="button"
                    aria-pressed={checked}
                    onClick={() => toggleCourse(course.id)}
                    className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer flex items-start gap-3 ${
                      checked
                        ? 'bg-teal-50/70 border-teal-700'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        checked
                          ? 'bg-teal-700 border-teal-700 text-white'
                          : 'bg-white border-slate-300'
                      }`}
                    >
                      {checked && <Check className="w-3 h-3" />}
                    </span>
                    <span className="space-y-1 min-w-0">
                      <span className="block text-xs font-semibold text-slate-900 leading-snug">
                        {course.title}
                      </span>
                      <span className="block text-[11px] text-slate-500 font-mono tabular-nums">
                        {course.hoursLabel} · +{course.points} б.
                      </span>
                      <span className="block text-[11px] text-slate-600 leading-relaxed">
                        {course.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Hike Complexity Categories */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                3. Подтверждённые походы по категориям сложности (К.С.)
              </h3>
              <span className="text-xs font-mono text-sky-800 tabular-nums">
                {rating.complexityPoints} / {rating.maxComplexityPoints} б.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  {
                    field: 'hikes1Ks',
                    id: 'hikes-1ks',
                    label: 'Походы 1 КС',
                    hint: '+1.5 б. за маршрут (макс. 15)',
                    max: 15,
                  },
                  {
                    field: 'hikes2Ks',
                    id: 'hikes-2ks',
                    label: 'Походы 2 КС',
                    hint: '+3 б. за маршрут (макс. 12)',
                    max: 12,
                  },
                  {
                    field: 'hikes3Ks',
                    id: 'hikes-3ks',
                    label: 'Походы 3 КС',
                    hint: '+5.5 б. за маршрут (макс. 10)',
                    max: 10,
                  },
                  {
                    field: 'hikes4Ks',
                    id: 'hikes-4ks',
                    label: 'Походы 4 КС (экспедиции)',
                    hint: '+8 б. за маршрут (макс. 6)',
                    max: 6,
                  },
                ] as const
              ).map((item) => {
                const count = input[item.field];
                return (
                  <div
                    key={item.field}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <label htmlFor={item.id} className="font-semibold text-slate-900">
                        {item.label}
                      </label>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {count}
                      </span>
                    </div>
                    <input
                      id={item.id}
                      type="range"
                      min={0}
                      max={item.max}
                      step={1}
                      value={count}
                      onChange={(e) =>
                        updateField(item.field, Number(e.target.value))
                      }
                      className="w-full accent-teal-700 cursor-pointer"
                    />
                    <p className="text-[11px] text-slate-500 font-mono">{item.hint}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Gauge Chart Visualization */}
        <div className="lg:col-span-5">
          <ExpertRatingGauge rating={rating} />
        </div>
      </div>

      {/* Dynamic Collapsible Expert Tips */}
      <ExpertRatingTipsPanel rating={rating} tips={dynamicTips} />
    </section>
  );
};
