import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  MapPin,
  MessageSquare,
} from 'lucide-react';
import { ATTESTATION_ROADMAP_STEPS } from '../data/researchData';
import { tracker } from '../utils/tracker';

interface OverviewAttestationStatusBarProps {
  onApplyForSession: (regionName: string, trackName: string) => void;
  onContactCurator: (sourceLabel: string) => void;
}

export const OverviewAttestationStatusBar: React.FC<OverviewAttestationStatusBarProps> = ({
  onApplyForSession,
  onContactCurator,
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(1);
  const steps = ATTESTATION_ROADMAP_STEPS;
  const activeStep = steps[activeIndex] ?? steps[0];
  const progressPercent = Math.round(((activeIndex + 1) / steps.length) * 100);

  const selectStep = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, steps.length - 1));
    setActiveIndex(clamped);
    const chosen = steps[clamped];
    if (chosen) {
      tracker.trackCustomInteraction(
        `Статус-бар этапов аттестации: ${chosen.stepNumber} ${chosen.shortTitle}`
      );
    }
  };

  return (
    <section
      id="overview-attestation-status-bar"
      aria-labelledby="overview-status-bar-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Интерактивный навигатор по процедуре аттестации</span>
          </p>
          <h2 id="overview-status-bar-heading" className="text-xl font-bold text-slate-900">
            Этапы прохождения аттестации инструктора-проводника
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Нажмите на любой этап прогресс-бара, чтобы посмотреть сроки, площадку проведения и
            итоговый документ шага.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-1.5 rounded-lg tabular-nums">
            Этап {activeIndex + 1} из {steps.length} · {progressPercent}%
          </span>
          <button
            type="button"
            disabled={activeIndex === 0}
            onClick={() => selectStep(activeIndex - 1)}
            aria-label="Предыдущий этап аттестации"
            className="p-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={activeIndex === steps.length - 1}
            onClick={() => selectStep(activeIndex + 1)}
            aria-label="Следующий этап аттестации"
            className="p-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Linear Progress Bar + Interactive Step Nodes */}
      <div className="space-y-3">
        <div
          role="progressbar"
          aria-label="Прогресс по этапам аттестации инструкторов-проводников"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/80"
        >
          <div
            className="h-full bg-teal-700 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {steps.map((step, idx) => {
            const isActive = idx === activeIndex;
            const isCompleted = idx < activeIndex;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => selectStep(idx)}
                aria-current={isActive ? 'step' : undefined}
                className={`text-left p-3.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                  isActive
                    ? 'bg-teal-50/70 border-teal-600 shadow-xs'
                    : isCompleted
                    ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-mono font-bold tabular-nums ${
                      isActive
                        ? 'text-teal-800'
                        : isCompleted
                        ? 'text-emerald-700'
                        : 'text-slate-500'
                    }`}
                  >
                    {step.stepNumber}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
                  ) : isActive ? (
                    <span className="text-[10px] font-semibold text-teal-800">Текущий</span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Далее</span>
                  )}
                </div>

                <div className="space-y-1">
                  <p
                    className={`text-xs font-bold leading-snug ${
                      isActive ? 'text-slate-900' : 'text-slate-800'
                    }`}
                  >
                    {step.shortTitle}
                  </p>
                  <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                    {step.duration}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Stage Explanation Band */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span className="font-mono font-bold text-teal-800">
              Этап {activeStep.stepNumber}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
              <Clock className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              {activeStep.duration}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              {activeStep.location}
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
            {activeStep.title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{activeStep.summary}</p>

          <div className="pt-1 text-xs text-teal-900 bg-teal-50/80 border border-teal-200/80 rounded-lg px-3.5 py-2.5">
            <span className="font-semibold">Совет куратора:</span> {activeStep.curatorTip}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-4 sm:p-5 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Результат этапа
          </p>
          <p className="text-xs font-semibold text-slate-900 leading-relaxed">
            {activeStep.outputArtifact}
          </p>

          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onApplyForSession('Приморский край', 'Пешеходный туризм')}
              className="px-3.5 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <span>Подать заявку на этап</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onContactCurator(`Статус-бар этапов · ${activeStep.shortTitle}`)}
              className="px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>Вопрос куратору</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
