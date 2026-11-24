import React, { useState } from 'react';
import { BookOpenCheck, Compass, Scale } from 'lucide-react';
import { PreparationExamSimulator } from './landing/PreparationExamSimulator';
import { InstructorLevelMiniQuiz } from './InstructorLevelMiniQuiz';
import { RegulatoryKnowledgeMiniTest } from './RegulatoryKnowledgeMiniTest';
import { tracker } from '../utils/tracker';

type AssessmentModeId = 'exam' | 'level' | 'regulatory';

const ASSESSMENT_MODES: {
  id: AssessmentModeId;
  label: string;
  subtitle: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'exam',
    label: 'Тренажёр экзамена ФСТР',
    subtitle: 'Тренировочные билеты с разбором ошибок, фильтрацией по темам и порогом сдачи 75%',
    Icon: BookOpenCheck,
  },
  {
    id: 'level',
    label: 'Определение категории (1–4 КС)',
    subtitle: 'Экспресс-подбор подходящей категории сложности и контура аттестации по опыту',
    Icon: Compass,
  },
  {
    id: 'regulatory',
    label: 'Тест по НПА (ПП № 1003 / 1893)',
    subtitle: 'Проверка знания требований законодательства, паспортизации (ПП № 760) и сроков',
    Icon: Scale,
  },
];

export interface TrainingAndAssessmentHubProps {
  onApplyForSession?: (regionName: string, trackName: string) => void;
  onContactCurator?: (sourceLabel: string) => void;
}

export const TrainingAndAssessmentHub: React.FC<TrainingAndAssessmentHubProps> = ({
  onApplyForSession,
  onContactCurator,
}) => {
  const [mode, setMode] = useState<AssessmentModeId>('exam');
  const activeMeta = ASSESSMENT_MODES.find((m) => m.id === mode) ?? ASSESSMENT_MODES[0];

  const handleApplyFallback = (regionName: string, trackName: string) => {
    if (onApplyForSession) {
      onApplyForSession(regionName, trackName);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'overview');
    window.history.pushState({ tab: 'overview' }, '', url.toString());
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleCuratorFallback = (sourceLabel: string) => {
    if (onContactCurator) {
      onContactCurator(sourceLabel);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'faq');
    window.history.pushState({ tab: 'faq' }, '', url.toString());
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <section aria-labelledby="training-assessment-hub-heading" className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Интерактивная подготовка
            </p>
            <h3
              id="training-assessment-hub-heading"
              className="text-lg font-bold text-slate-900"
            >
              Тренажёр экзамена и диагностика уровня проводника
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">{activeMeta.subtitle}</p>
          </div>

          <div
            role="tablist"
            aria-label="Режимы тестирования и диагностики"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start lg:self-auto"
          >
            {ASSESSMENT_MODES.map(({ id, label, Icon }) => {
              const active = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setMode(id);
                    tracker.trackCustomInteraction(`Тренажёр подготовки · ${label}`, 'learning');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {mode === 'exam' && <PreparationExamSimulator />}
      {mode === 'level' && (
        <InstructorLevelMiniQuiz
          onApplyForSession={handleApplyFallback}
          onContactCurator={handleCuratorFallback}
        />
      )}
      {mode === 'regulatory' && (
        <RegulatoryKnowledgeMiniTest
          onApplyForSession={() => handleApplyFallback('Приморский край', 'Пешеходный туризм')}
          onContactCurator={handleCuratorFallback}
        />
      )}
    </section>
  );
};
