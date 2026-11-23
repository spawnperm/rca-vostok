import React, { useEffect, useState } from 'react';
import { ChevronDown, Lightbulb, CheckCircle2 } from 'lucide-react';
import type {
  ExpertAdviceItem,
  ExpertRatingResult,
} from '../utils/expertRatingCalculator';
import { tracker } from '../utils/tracker';

interface ExpertRatingTipsPanelProps {
  rating: ExpertRatingResult;
  tips: ExpertAdviceItem[];
}

export const ExpertRatingTipsPanel: React.FC<ExpertRatingTipsPanelProps> = ({
  rating,
  tips,
}) => {
  const [expandedIds, setExpandedIds] = useState<string[]>(() =>
    tips[0] ? [tips[0].id] : []
  );

  // Keep the highest-priority recommendation expanded when tier shifts
  useEffect(() => {
    const firstId = tips[0]?.id;
    if (!firstId) return;
    setExpandedIds((prev) => {
      const validPrev = prev.filter((id) => tips.some((t) => t.id === id));
      return validPrev.includes(firstId) ? validPrev : [firstId, ...validPrev];
    });
  }, [rating.currentLevel.level, tips]);

  const toggleTip = (tip: ExpertAdviceItem) => {
    setExpandedIds((prev) => {
      const isOpen = prev.includes(tip.id);
      if (!isOpen) {
        tracker.trackCustomInteraction(
          `Совет эксперта раскрыт: ${tip.title.slice(0, 50)}`,
          `${rating.totalScore} б.`
        );
      }
      return isOpen ? prev.filter((id) => id !== tip.id) : [...prev, tip.id];
    });
  };

  const allExpanded = tips.length > 0 && tips.every((t) => expandedIds.includes(t.id));

  const handleToggleAll = () => {
    if (allExpanded) {
      setExpandedIds([]);
    } else {
      setExpandedIds(tips.map((t) => t.id));
    }
  };

  return (
    <div className="border-t border-slate-200 pt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 font-medium text-teal-700">
              <Lightbulb className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Персональные рекомендации экспертов комиссии</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {rating.totalScore} / 100 б. ({rating.currentLevel.shortTitle})
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900">
            Выпадающие советы экспертов по повышению рейтинга
          </h3>
        </div>

        {tips.length > 1 && (
          <button
            type="button"
            onClick={handleToggleAll}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {allExpanded ? 'Свернуть все' : 'Развернуть все'}
          </button>
        )}
      </div>

      <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white overflow-hidden">
        {tips.map((tip, index) => {
          const isOpen = expandedIds.includes(tip.id);
          const panelId = `expert-tip-panel-${tip.id}`;
          const priorityTextClass =
            tip.priorityLabel === 'Высокий приоритет'
              ? 'text-teal-800 font-semibold'
              : tip.priorityLabel === 'Рекомендуется'
              ? 'text-amber-700 font-semibold'
              : 'text-slate-600 font-medium';

          return (
            <div key={tip.id} className="bg-white">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggleTip(tip)}
                className="w-full px-5 py-4 text-left flex items-start justify-between gap-4 hover:bg-slate-50 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-700"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono text-slate-400 tabular-nums">
                      0{index + 1}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className={priorityTextClass}>{tip.priorityLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-slate-700 tabular-nums">
                      {tip.potentialGainLabel}
                    </span>
                  </div>
                  <p className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">
                    {tip.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {tip.expertName} · {tip.expertRole}
                  </p>
                </div>

                <ChevronDown
                  className={`w-4 h-4 text-slate-500 shrink-0 mt-1 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-teal-700' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {isOpen && (
                <div
                  id={panelId}
                  className="px-5 pb-5 pt-1 bg-slate-50/70 border-t border-slate-100 space-y-3"
                >
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    {tip.summary}
                  </p>

                  <ul className="space-y-2">
                    {tip.actionSteps.map((step) => (
                      <li
                        key={step}
                        className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed"
                      >
                        <CheckCircle2
                          className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>

                  <p className="text-[11px] font-mono text-slate-500 pt-1">
                    Основание: {tip.normRef}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
