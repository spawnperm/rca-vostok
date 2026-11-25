import React from 'react';
import { AlertCircle, CheckCircle2, GripVertical, Sparkles } from 'lucide-react';
import type { DealHarnessAnalysis } from '../../types.ts';

export interface DealCardProps {
  title: string;
  budget: number;
  currency?: string;
  companyName?: string | null;
  contactName?: string | null;
  ownerName?: string;
  openTasksCount?: number;
  hasOverdueTask?: boolean;
  tags?: string[];
  priority?: string;
  dealScore?: { score: number; label: string; textClass: string };
  selected?: boolean;
  harnessAnalysis?: DealHarnessAnalysis | null;
  draggable?: boolean;
  onDragStart?: () => void;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const DealCard: React.FC<DealCardProps> = ({
  title,
  budget,
  currency = 'RUB',
  companyName,
  contactName,
  ownerName,
  openTasksCount = 0,
  hasOverdueTask = false,
  tags = [],
  priority,
  dealScore,
  selected = false,
  harnessAnalysis,
  draggable = false,
  onDragStart,
  onClick,
  onContextMenu,
}) => {
  const prob = harnessAnalysis?.winProbability;
  const riskColor =
    harnessAnalysis?.riskLevel === 'Высокий'
      ? 'text-red-600'
      : harnessAnalysis?.riskLevel === 'Средний'
      ? 'text-amber-600'
      : 'text-emerald-700';

  const priorityColor =
    priority === 'Высокий'
      ? 'text-red-600'
      : priority === 'Средний'
      ? 'text-amber-600'
      : priority === 'Низкий'
      ? 'text-slate-500'
      : '';

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`group cursor-pointer rounded-lg border bg-white p-3 transition-colors hover:border-[#0077FF] ${
        selected ? 'border-[#0077FF] ring-1 ring-[#0077FF]/25' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-medium leading-snug text-slate-900 group-hover:text-[#0077FF]">
          {title}
        </span>
        {draggable && <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />}
      </div>

      {(priority || dealScore) && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
          {priority && <span className={priorityColor}>Приоритет: {priority}</span>}
          {priority && dealScore && (
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
          )}
          {dealScore && (
            <span className={`tabular-nums ${dealScore.textClass}`}>
              Скор {dealScore.score}/100 ({dealScore.label})
            </span>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-900 tabular-nums">
          {budget.toLocaleString('ru-RU')} {currency}
        </span>
        {hasOverdueTask ? (
          <span className="inline-flex items-center gap-1 font-medium text-red-600">
            <AlertCircle className="h-3 w-3" />
            Просрочена
          </span>
        ) : openTasksCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Задач: {openTasksCount}
          </span>
        ) : (
          <span className="text-slate-400">Без задачи</span>
        )}
      </div>

      {(companyName || contactName) && (
        <div className="mt-1.5 truncate text-[11px] text-slate-500">
          {[companyName, contactName].filter(Boolean).join(' · ')}
        </div>
      )}

      {harnessAnalysis && (
        <div className="mt-2 border-t border-slate-100 pt-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
              <Sparkles className="h-3 w-3 text-[#0077FF]" />
              Шанс <span className="tabular-nums font-semibold">{prob}%</span>
            </span>
            <span className={`font-medium ${riskColor}`}>Риск: {harnessAnalysis.riskLevel}</span>
          </div>
          <div className="mt-1 truncate text-[11px] text-slate-600">
            {harnessAnalysis.nextStep.title}
          </div>
        </div>
      )}

      {(tags.length > 0 || ownerName) && (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-1.5 text-[11px] text-slate-400">
          <span className="truncate">{tags.slice(0, 2).join(' · ')}</span>
          {ownerName && <span className="shrink-0 truncate">{ownerName}</span>}
        </div>
      )}
    </div>
  );
};
