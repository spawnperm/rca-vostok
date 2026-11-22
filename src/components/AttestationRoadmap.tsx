import React, { useState } from 'react';
import {
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  FileText,
  Layers,
  MessageSquare,
} from 'lucide-react';
import { ATTESTATION_ROADMAP_STEPS } from '../data/researchData';
import { tracker } from '../utils/tracker';

interface AttestationRoadmapProps {
  onContactCurator: (sourceLabel: string) => void;
}

const STEP_ICONS = [FileText, Layers, BookOpenCheck, Compass, BadgeCheck] as const;

export const AttestationRoadmap: React.FC<AttestationRoadmapProps> = ({ onContactCurator }) => {
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const activeStep = ATTESTATION_ROADMAP_STEPS[activeIndex] ?? ATTESTATION_ROADMAP_STEPS[0];

  const handleSelectStep = (idx: number) => {
    const normalized = Math.max(0, Math.min(idx, ATTESTATION_ROADMAP_STEPS.length - 1));
    setActiveIndex(normalized);
    const chosen = ATTESTATION_ROADMAP_STEPS[normalized];
    if (chosen) {
      tracker.trackCustomInteraction(
        `Дорожная карта: Шаг ${chosen.stepNumber}`,
        chosen.shortTitle
      );
    }
  };

  return (
    <section
      aria-labelledby="candidate-roadmap-heading"
      className="bg-white border border-slate-200 rounded-xl p-8 space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <p className="text-xs font-medium text-teal-700">
            Путь соискателя · От заявки до удостоверения проводника
          </p>
          <h2 id="candidate-roadmap-heading" className="text-xl font-bold text-slate-900">
            Дорожная карта аттестации
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Пошаговый маршрут прохождения государственной аттестации в РЦА «Русский Восток» на
            базе ВВГУ — от первичной подачи документов до получения нагрудной карточки-бейджа и
            включения в Единый федеральный реестр.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono text-slate-500 tabular-nums mr-1">
            Шаг {activeStep.stepNumber} / 0{ATTESTATION_ROADMAP_STEPS.length}
          </span>
          <button
            type="button"
            disabled={activeIndex === 0}
            onClick={() => handleSelectStep(activeIndex - 1)}
            aria-label="Предыдущий шаг дорожной карты"
            className="p-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={activeIndex === ATTESTATION_ROADMAP_STEPS.length - 1}
            onClick={() => handleSelectStep(activeIndex + 1)}
            aria-label="Следующий шаг дорожной карты"
            className="p-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Visual 5-Step Flow Ribbon */}
      <div className="overflow-x-auto pb-2 -mx-2 px-2">
        <div className="min-w-[760px] relative pt-2">
          {/* Connector rail */}
          <div
            aria-hidden="true"
            className="absolute left-[10%] right-[10%] top-[30px] h-0.5 bg-slate-200"
          >
            <div
              className="h-full w-full bg-teal-700 origin-left transition-transform duration-200"
              style={{
                transform: `scaleX(${
                  activeIndex / Math.max(ATTESTATION_ROADMAP_STEPS.length - 1, 1)
                })`,
              }}
            />
          </div>

          <ol className="grid grid-cols-5 gap-3 relative">
            {ATTESTATION_ROADMAP_STEPS.map((step, idx) => {
              const Icon = STEP_ICONS[idx] ?? FileText;
              const isSelected = idx === activeIndex;
              const isCompleted = idx < activeIndex;
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectStep(idx)}
                    aria-current={isSelected ? 'step' : undefined}
                    className="w-full text-center flex flex-col items-center gap-2.5 px-2 py-1 rounded-lg group cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  >
                    <span
                      className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isSelected
                          ? 'bg-teal-700 border-teal-700 text-white'
                          : isCompleted
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-white border-slate-300 text-slate-600 group-hover:border-teal-700 group-hover:text-teal-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </span>

                    <div className="space-y-0.5">
                      <p
                        className={`text-xs font-mono font-semibold tabular-nums ${
                          isSelected ? 'text-teal-800' : 'text-slate-900'
                        }`}
                      >
                        {step.stepNumber}. {step.shortTitle}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                        {step.duration}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* Selected Step Detail Inspector */}
      <div className="pt-6 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-mono font-semibold text-teal-800 tabular-nums">
              Этап {activeStep.stepNumber}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-700">{activeStep.duration}</span>
            <span aria-hidden="true">·</span>
            <span>{activeStep.location}</span>
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
            {activeStep.title}
          </h3>

          <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">{activeStep.summary}</p>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-500">Итоговый результат этапа</p>
            <p className="text-xs sm:text-sm font-medium text-slate-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{activeStep.outputArtifact}</span>
            </p>
          </div>
        </div>

        <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4">
          <p className="text-xs font-semibold text-slate-700">Чек-лист действий кандидата</p>
          <ul className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
            {activeStep.candidateActions.map((act, aIdx) => (
              <li key={act} className="flex items-start gap-2.5">
                <span className="font-mono font-semibold text-teal-700 tabular-nums shrink-0">
                  0{aIdx + 1}.
                </span>
                <span>{act}</span>
              </li>
            ))}
          </ul>

          <div className="pt-3 border-t border-slate-200 space-y-3">
            <p className="text-[11px] text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-800">Рекомендация куратора:</span>{' '}
              {activeStep.curatorTip}
            </p>
            <button
              type="button"
              onClick={() => onContactCurator(`Дорожная карта · Шаг ${activeStep.stepNumber}`)}
              className="px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <MessageSquare className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>Уточнить шаг у куратора</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
