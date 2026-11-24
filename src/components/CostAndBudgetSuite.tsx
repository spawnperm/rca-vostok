import React, { useState } from 'react';
import { BarChart3, Calculator, Landmark } from 'lucide-react';
import { TrainingAndAttestationCostEstimator } from './TrainingAndAttestationCostEstimator';
import { StateDutyAttestationCalculator } from './StateDutyAttestationCalculator';
import { IntensiveAttestationCostModule } from './IntensiveAttestationCostModule';
import { TrainingCostByComplexityChart } from './TrainingCostByComplexityChart';
import { tracker } from '../utils/tracker';

type CostTabId = 'estimator' | 'duty_intensive' | 'complexity_chart';

const COST_TABS: {
  id: CostTabId;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'estimator',
    label: 'Смета ДПО и аттестации',
    description: 'Расчёт стоимости обучения в ВВГУ, экзамена и выездной комиссии по региону ДФО',
    Icon: Calculator,
  },
  {
    id: 'duty_intensive',
    label: 'Госпошлина (ПП № 891) и интенсив',
    description: 'Тарифы по ст. 333.33 НК РФ, постановление № 891 и выездной полевой интенсив',
    Icon: Landmark,
  },
  {
    id: 'complexity_chart',
    label: 'Сравнение по 1–4 КС',
    description: 'Структура затрат по категориям сложности и видам активного туризма',
    Icon: BarChart3,
  },
];

export const CostAndBudgetSuite: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CostTabId>('estimator');
  const activeMeta = COST_TABS.find((t) => t.id === activeTab) ?? COST_TABS[0];

  return (
    <section
      aria-labelledby="cost-budget-suite-heading"
      className="space-y-6"
    >
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Финансовый модуль РЦА
            </p>
            <h2
              id="cost-budget-suite-heading"
              className="text-xl font-bold text-slate-900"
            >
              Калькулятор затрат, госпошлины и интенсивов
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">{activeMeta.description}</p>
          </div>

          <div
            role="tablist"
            aria-label="Режимы расчёта стоимости"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start lg:self-auto"
          >
            {COST_TABS.map(({ id, label, Icon }) => {
              const isActive = id === activeTab;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setActiveTab(id);
                    tracker.trackCustomInteraction(`Калькулятор затрат · ${label}`, 'calculator');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
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

      {activeTab === 'estimator' && <TrainingAndAttestationCostEstimator />}

      {activeTab === 'duty_intensive' && (
        <div className="space-y-6">
          <StateDutyAttestationCalculator />
          <IntensiveAttestationCostModule />
        </div>
      )}

      {activeTab === 'complexity_chart' && <TrainingCostByComplexityChart />}
    </section>
  );
};
