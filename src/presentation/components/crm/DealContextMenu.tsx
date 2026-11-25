import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Flag, Layers, UserCheck, X } from 'lucide-react';
import type { DealPriorityLevel } from '../../../application/voice/voiceNavigation.ts';
import type { DealItem, OwnerOption, StageItem } from '../../types.ts';

export function computeContextMenuPosition(
  clientX: number,
  clientY: number,
  menuWidth: number,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  padding = 10
): { left: number; top: number } {
  const maxLeft = Math.max(padding, viewportWidth - menuWidth - padding);
  const maxTop = Math.max(padding, viewportHeight - menuHeight - padding);

  const left = clientX + menuWidth + padding > viewportWidth
    ? Math.max(padding, Math.min(maxLeft, clientX - menuWidth))
    : Math.max(padding, Math.min(maxLeft, clientX));

  const top = clientY + menuHeight + padding > viewportHeight
    ? Math.max(padding, Math.min(maxTop, viewportHeight - menuHeight - padding))
    : Math.max(padding, Math.min(maxTop, clientY));

  return { left, top };
}

interface DealContextMenuProps {
  deal: DealItem;
  position: { x: number; y: number };
  stages: StageItem[];
  owners: OwnerOption[];
  canEdit: boolean;
  onSelectStage: (dealId: string, stageId: string) => void | Promise<void>;
  onSelectOwner: (dealId: string, ownerId: string) => void | Promise<void>;
  onSelectPriority?: (dealId: string, priority: DealPriorityLevel) => void | Promise<void>;
  onOpenDeal: (deal: DealItem) => void;
  onClose: () => void;
}

export const DealContextMenu: React.FC<DealContextMenuProps> = ({
  deal,
  position,
  stages,
  owners,
  canEdit,
  onSelectStage,
  onSelectOwner,
  onSelectPriority,
  onOpenDeal,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number }>(() =>
    computeContextMenuPosition(
      position.x,
      position.y,
      280,
      380,
      typeof window !== 'undefined' ? window.innerWidth : 1280,
      typeof window !== 'undefined' ? window.innerHeight : 800
    )
  );

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords(
      computeContextMenuPosition(
        position.x,
        position.y,
        rect.width || 280,
        rect.height || 380,
        window.innerWidth,
        window.innerHeight
      )
    );
  }, [position.x, position.y, stages.length, owners.length]);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    const handleDismissOnViewportChange = () => {
      onClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleDismissOnViewportChange, true);
    window.addEventListener('resize', handleDismissOnViewportChange);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleDismissOnViewportChange, true);
      window.removeEventListener('resize', handleDismissOnViewportChange);
    };
  }, [onClose]);

  const pipelineStages = stages.filter((s) => !deal.pipelineId || s.pipelineId === deal.pipelineId);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Контекстное меню сделки ${deal.title}`}
      style={{ left: `${coords.left}px`, top: `${coords.top}px` }}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-50 w-[280px] max-h-[82vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-900/5"
    >
      {/* Deal Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-slate-900">{deal.title}</div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 tabular-nums">
            {deal.budget.toLocaleString('ru-RU')} {deal.currency}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть контекстное меню"
          className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!canEdit && (
        <div className="border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
          Только просмотр: нет прав на изменение этой сделки
        </div>
      )}

      {/* Stage Switcher */}
      <div className="border-b border-slate-100 p-1.5">
        <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          <Layers className="h-3 w-3" />
          <span>Сменить этап</span>
        </div>
        <div className="space-y-0.5">
          {pipelineStages.map((stage) => {
            const isCurrent = stage.id === deal.stageId;
            return (
              <button
                key={stage.id}
                type="button"
                role="menuitemradio"
                aria-checked={isCurrent}
                disabled={!canEdit || isCurrent}
                onClick={() => {
                  onClose();
                  if (!isCurrent) {
                    void onSelectStage(deal.id, stage.id);
                  }
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                  isCurrent
                    ? 'bg-blue-50 font-semibold text-[#0077FF]'
                    : canEdit
                    ? 'text-slate-700 hover:bg-slate-100'
                    : 'cursor-not-allowed text-slate-400'
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="truncate">{stage.name}</span>
                </span>
                {isCurrent && <Check className="h-3.5 w-3.5 shrink-0 text-[#0077FF]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Owner Reassignment */}
      <div className="border-b border-slate-100 p-1.5">
        <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          <UserCheck className="h-3 w-3" />
          <span>Переназначить ответственного</span>
        </div>
        <div className="space-y-0.5">
          {owners.map((owner) => {
            const isCurrent = owner.id === deal.ownerId;
            return (
              <button
                key={owner.id}
                type="button"
                role="menuitemradio"
                aria-checked={isCurrent}
                disabled={!canEdit || isCurrent}
                onClick={() => {
                  onClose();
                  if (!isCurrent) {
                    void onSelectOwner(deal.id, owner.id);
                  }
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                  isCurrent
                    ? 'bg-blue-50 font-semibold text-[#0077FF]'
                    : canEdit
                    ? 'text-slate-700 hover:bg-slate-100'
                    : 'cursor-not-allowed text-slate-400'
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {owner.avatarUrl ? (
                    <img
                      src={owner.avatarUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-4 w-4 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[9px] font-semibold text-slate-700">
                      {owner.fullName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="truncate">{owner.fullName}</span>
                </span>
                {isCurrent && <Check className="h-3.5 w-3.5 shrink-0 text-[#0077FF]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Priority Switcher */}
      {onSelectPriority && (
        <div className="border-b border-slate-100 p-1.5">
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Flag className="h-3 w-3" />
            <span>Приоритет сделки</span>
          </div>
          <div className="grid grid-cols-3 gap-1 px-1 pb-0.5">
            {(['Высокий', 'Средний', 'Низкий'] as const).map((level) => {
              const isCurrent = deal.customFields?.priority === level;
              return (
                <button
                  key={level}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isCurrent}
                  disabled={!canEdit || isCurrent}
                  onClick={() => {
                    onClose();
                    if (!isCurrent) {
                      void onSelectPriority(deal.id, level);
                    }
                  }}
                  className={`rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors ${
                    isCurrent
                      ? 'bg-blue-50 font-semibold text-[#0077FF]'
                      : canEdit
                      ? 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                      : 'cursor-not-allowed text-slate-400'
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Open Card Action */}
      <div className="p-1.5">
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            onOpenDeal(deal);
          }}
          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
        >
          <span>Открыть карточку сделки</span>
          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
        </button>
      </div>
    </div>
  );
};
