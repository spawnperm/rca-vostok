import React, { useState } from 'react';
import { ArrowRight, BookOpenCheck, Compass, Scale } from 'lucide-react';
import { PreparationExamSimulator } from './landing/PreparationExamSimulator';
import { InstructorLevelMiniQuiz } from './InstructorLevelMiniQuiz';
import { RegulatoryKnowledgeMiniTest } from './RegulatoryKnowledgeMiniTest';
import { buildRouteUrl, type NavigateOptions, type SiteTabId } from '../utils/seo';
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
  onNavigateTab?: (tab: SiteTabId, options?: NavigateOptions) => void;
}

export const TrainingAndAssessmentHub: React.FC<TrainingAndAssessmentHubProps> = ({
  onApplyForSession,
  onContactCurator,
  onNavigateTab,
}) => {
  const [mode, setMode] = useState<AssessmentModeId>('exam');
  const activeMeta = ASSESSMENT_MODES.find((m) => m.id === mode) ?? ASSESSMENT_MODES[0];

  const handleApplyFallback = (regionName: string, trackName: string) => {
    if (onApplyForSession) {
      onApplyForSession(regionName, trackName);
      return;
    }
    if (onNavigateTab) {
      onNavigateTab('overview', { subTab: 'summary', anchor: 'inquiry-section' });
      return;
    }
    const nextUrl = buildRouteUrl(window.location.pathname, 'overview', 'summary');
    window.history.pushState({ tab: 'overview', subTab: 'summary' }, '', nextUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleCuratorFallback = (sourceLabel: string) => {
    if (onContactCurator) {
      onContactCurator(sourceLabel);
      return;
    }
    if (onNavigateTab) {
      onNavigateTab('contacts', { subTab: 'contacts' });
      return;
    }
    const nextUrl = buildRouteUrl(window.location.pathname, 'contacts', 'contacts');
    window.history.pushState({ tab: 'contacts', subTab: 'contacts' }, '', nextUrl);
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

      {onNavigateTab && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            После тренировки билетов выберите дату очной сессии в календаре ДФО или зафиксируйте
            индивидуальный план обучения в личном кабинете.
          </p>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab('certification', { subTab: 'registry' })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-teal-500 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>График и реестр аттестаций</span>
              <ArrowRight className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('account', { subTab: 'preparation' })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Личный кабинет и план</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
