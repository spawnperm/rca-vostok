import React, { useMemo, useState } from 'react';
import { AlertCircle, Calendar, ChartGantt, Cpu } from 'lucide-react';
import type { DealHarnessAnalysis, DealItem, StageItem } from '../types.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DealGanttSchedule {
  dealId: string;
  startMs: number;
  endMs: number;
  milestoneMs: number | null;
  progressPct: number;
  durationDays: number;
}

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function computeDealGanttSchedule(
  deal: DealItem,
  stage: StageItem | undefined,
  totalStages: number,
  analysis: DealHarnessAnalysis | null,
  referenceNowMs = Date.now()
): DealGanttSchedule {
  const createdMs = deal.createdAt ? new Date(deal.createdAt).getTime() : referenceNowMs;
  const updatedMs = deal.updatedAt ? new Date(deal.updatedAt).getTime() : referenceNowMs;
  const sortOrder = Math.max(1, stage?.sortOrder ?? 1);
  const safeTotalStages = Math.max(sortOrder, totalStages || 5);

  const createdDay = startOfUtcDay(Number.isFinite(createdMs) ? createdMs : referenceNowMs);
  const updatedDay = startOfUtcDay(Number.isFinite(updatedMs) ? updatedMs : referenceNowMs);

  // When createdAt and updatedAt fall on the same day (e.g. fresh seed), project elapsed days back by stage progression
  const startMs =
    updatedDay - createdDay < DAY_MS
      ? createdDay - (sortOrder - 1) * 3 * DAY_MS
      : createdDay;

  const harnessDueMs = analysis?.nextStep?.suggestedDueAt
    ? new Date(analysis.nextStep.suggestedDueAt).getTime()
    : NaN;
  const taskDueMs = deal.nextTaskDueAt ? new Date(deal.nextTaskDueAt).getTime() : NaN;

  const validMilestones = [harnessDueMs, taskDueMs].filter((v) => Number.isFinite(v));
  const milestoneMs = validMilestones.length > 0 ? Math.min(...validMilestones) : null;

  const remainingStages = Math.max(1, safeTotalStages - sortOrder + 1);
  const projectedCloseMs =
    stage?.isWon || stage?.isLost
      ? Math.max(startMs + 4 * DAY_MS, updatedDay + DAY_MS)
      : Math.max(
          startMs + (sortOrder + remainingStages) * 2 * DAY_MS,
          ...(validMilestones.length > 0 ? validMilestones.map((m) => startOfUtcDay(m) + 2 * DAY_MS) : [])
        );

  const endMs = Math.max(startMs + 3 * DAY_MS, projectedCloseMs);
  const durationDays = Math.max(1, Math.round((endMs - startMs) / DAY_MS));

  const progressPct =
    stage?.isWon || stage?.isLost
      ? 100
      : analysis
      ? Math.min(98, Math.max(8, analysis.winProbability))
      : Math.min(95, Math.max(12, Math.round((sortOrder / safeTotalStages) * 100)));

  return {
    dealId: deal.id,
    startMs,
    endMs,
    milestoneMs,
    progressPct,
    durationDays,
  };
}

interface DealsGanttViewProps {
  deals: DealItem[];
  stages: StageItem[];
  getDealAnalysis: (deal: DealItem) => DealHarnessAnalysis | null;
  onOpenDeal: (deal: DealItem) => void;
  onDealContextMenu?: (e: React.MouseEvent<HTMLDivElement>, deal: DealItem) => void;
}

export const DealsGanttView: React.FC<DealsGanttViewProps> = ({
  deals,
  stages,
  getDealAnalysis,
  onOpenDeal,
  onDealContextMenu,
}) => {
  const [scale, setScale] = useState<'days' | 'weeks'>('days');

  const stageById = useMemo(() => {
    const map: Record<string, StageItem> = {};
    for (const st of stages) map[st.id] = st;
    return map;
  }, [stages]);

  const todayDayMs = useMemo(() => startOfUtcDay(Date.now()), []);

  const rows = useMemo(() => {
    return deals.map((deal) => {
      const stage = stageById[deal.stageId];
      const analysis = getDealAnalysis(deal);
      const schedule = computeDealGanttSchedule(deal, stage, stages.length, analysis, todayDayMs);
      return { deal, stage, analysis, schedule };
    });
  }, [deals, stageById, stages.length, getDealAnalysis, todayDayMs]);

  const { windowStartMs, days } = useMemo(() => {
    if (rows.length === 0) {
      const start = todayDayMs - 5 * DAY_MS;
      const list = Array.from({ length: 18 }, (_, i) => start + i * DAY_MS);
      return { windowStartMs: start, days: list };
    }

    let minStart = todayDayMs - 3 * DAY_MS;
    let maxEnd = todayDayMs + 10 * DAY_MS;
    for (const r of rows) {
      if (r.schedule.startMs < minStart) minStart = r.schedule.startMs;
      if (r.schedule.endMs > maxEnd) maxEnd = r.schedule.endMs;
      if (r.schedule.milestoneMs && r.schedule.milestoneMs > maxEnd) {
        maxEnd = startOfUtcDay(r.schedule.milestoneMs) + 2 * DAY_MS;
      }
    }

    const paddedStart = startOfUtcDay(minStart) - 2 * DAY_MS;
    const paddedEnd = startOfUtcDay(maxEnd) + 3 * DAY_MS;
    const totalDays = Math.min(90, Math.max(16, Math.ceil((paddedEnd - paddedStart) / DAY_MS) + 1));

    return {
      windowStartMs: paddedStart,
      days: Array.from({ length: totalDays }, (_, i) => paddedStart + i * DAY_MS),
    };
  }, [rows, todayDayMs]);

  const dayWidthPx = scale === 'days' ? 44 : 24;
  const timelineWidthPx = days.length * dayWidthPx;
  const todayOffsetPx = ((todayDayMs - windowStartMs) / DAY_MS) * dayWidthPx;

  if (deals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center text-sm text-slate-500">
        Сделки не найдены. Измените фильтр поиска или создайте новую сделку.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Gantt Sub-Toolbar & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
            <ChartGantt className="h-3.5 w-3.5 text-[#0077FF]" />
            График воронки (Диаграмма Ганта)
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#0077FF]" />
            Заливка полосы — вероятность DeepSeek-Harness
          </span>
          <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="inline-block h-2 w-2 rotate-45 bg-slate-900" />
            Веха следующего шага
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-0.5">
          <button
            type="button"
            onClick={() => setScale('days')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
              scale === 'days' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Дни
          </button>
          <button
            type="button"
            onClick={() => setScale('weeks')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
              scale === 'weeks' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Недели
          </button>
        </div>
      </div>

      {/* Scrollable Split-Pane Gantt Grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full align-top">
          {/* Header Row */}
          <div className="flex border-b border-slate-200 bg-white">
            <div className="sticky left-0 z-20 flex w-[280px] shrink-0 items-center justify-between border-r border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600">
              <span>Сделка и этап</span>
              <span>Бюджет</span>
            </div>

            <div className="relative flex" style={{ width: `${timelineWidthPx}px` }}>
              {days.map((dayMs, idx) => {
                const date = new Date(dayMs);
                const isToday = dayMs === todayDayMs;
                const dayOfWeek = date.getUTCDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const showLabel = scale === 'days' || idx % 3 === 0 || isToday;

                return (
                  <div
                    key={dayMs}
                    style={{ width: `${dayWidthPx}px` }}
                    className={`shrink-0 border-r border-slate-100 py-2 text-center text-[10px] tabular-nums ${
                      isToday
                        ? 'bg-blue-50 font-semibold text-[#0077FF]'
                        : isWeekend
                        ? 'bg-slate-50/80 text-slate-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {showLabel ? (
                      <>
                        <div>{date.getUTCDate()}</div>
                        <div className="text-[9px] uppercase">
                          {date.toLocaleDateString('ru-RU', { month: 'short', timeZone: 'UTC' }).replace('.', '')}
                        </div>
                      </>
                    ) : (
                      <div className="text-slate-300">·</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deal Rows */}
          <div className="divide-y divide-slate-100">
            {rows.map(({ deal, stage, analysis, schedule }) => {
              const barColor = stage?.color || '#0077FF';
              const leftPx = Math.max(0, ((schedule.startMs - windowStartMs) / DAY_MS) * dayWidthPx);
              const widthPx = Math.max(dayWidthPx * 1.5, schedule.durationDays * dayWidthPx);
              const milestoneLeftPx =
                schedule.milestoneMs !== null
                  ? ((startOfUtcDay(schedule.milestoneMs) - windowStartMs) / DAY_MS) * dayWidthPx +
                    dayWidthPx * 0.5
                  : null;

              const startLabel = new Date(schedule.startMs).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC',
              });
              const endLabel = new Date(schedule.endMs).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC',
              });

              return (
                <div
                  key={deal.id}
                  onClick={() => onOpenDeal(deal)}
                  onContextMenu={(e) => onDealContextMenu?.(e, deal)}
                  className="group flex cursor-pointer hover:bg-slate-50/80"
                >
                  {/* Sticky Left Deal Summary Cell */}
                  <div className="sticky left-0 z-10 flex w-[280px] shrink-0 items-center justify-between gap-3 border-r border-slate-200 bg-white px-4 py-3 group-hover:bg-slate-50">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: barColor }}
                        />
                        <span className="truncate text-xs font-semibold text-slate-900">
                          {deal.title}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="truncate">{stage?.name || 'Этап'}</span>
                        <span>·</span>
                        <span className="shrink-0">{deal.ownerName.split(' ')[0]}</span>
                        {deal.hasOverdueTask && (
                          <AlertCircle className="h-3 w-3 shrink-0 text-red-600" aria-label="Просрочена задача" />
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs font-semibold text-slate-800 tabular-nums">
                        {deal.budget.toLocaleString('ru-RU')} ₽
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-400 tabular-nums">
                        {schedule.durationDays} дн.
                      </div>
                    </div>
                  </div>

                  {/* Right Timeline Bar Cell */}
                  <div
                    className="relative flex items-center"
                    style={{ width: `${timelineWidthPx}px`, height: '56px' }}
                  >
                    {/* Day Grid Columns */}
                    <div className="pointer-events-none absolute inset-0 flex">
                      {days.map((dayMs) => {
                        const dayOfWeek = new Date(dayMs).getUTCDay();
                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                        return (
                          <div
                            key={dayMs}
                            style={{ width: `${dayWidthPx}px` }}
                            className={`h-full shrink-0 border-r border-slate-100 ${
                              isWeekend ? 'bg-slate-50/50' : ''
                            }`}
                          />
                        );
                      })}
                    </div>

                    {/* Today Marker Line */}
                    {todayOffsetPx >= 0 && todayOffsetPx <= timelineWidthPx && (
                      <div
                        className="pointer-events-none absolute top-0 bottom-0 z-10 w-px border-l border-dashed border-blue-500/80"
                        style={{ left: `${todayOffsetPx + dayWidthPx / 2}px` }}
                      />
                    )}

                    {/* Gantt Deal Bar */}
                    <div
                      title={`${deal.title} (${startLabel} — ${endLabel}) · ${
                        analysis ? `Harness: ${analysis.winProbability}% · ${analysis.nextStep.title}` : stage?.name || ''
                      }`}
                      style={{
                        left: `${leftPx}px`,
                        width: `${widthPx}px`,
                        backgroundColor: `${barColor}24`,
                        borderColor: `${barColor}66`,
                      }}
                      className="relative z-10 flex h-7 items-center overflow-hidden rounded-md border px-2 transition-shadow group-hover:shadow-sm"
                    >
                      {/* Completion / Win Probability Fill */}
                      <div
                        style={{
                          width: `${schedule.progressPct}%`,
                          backgroundColor: barColor,
                        }}
                        className="absolute inset-y-0 left-0 opacity-85"
                      />

                      <div className="relative z-10 flex w-full items-center justify-between gap-2 text-[11px] font-medium">
                        <span className="inline-flex items-center gap-1 truncate rounded bg-white/90 px-1.5 py-0.5 text-slate-900 shadow-xs">
                          <Cpu className="h-3 w-3 shrink-0 text-[#0077FF]" />
                          <span className="tabular-nums font-semibold">{schedule.progressPct}%</span>
                          <span className="truncate max-w-[180px] text-slate-700">
                            · {analysis ? analysis.nextStep.title : `${startLabel} – ${endLabel}`}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Next-Step Target Date Milestone Diamond */}
                    {milestoneLeftPx !== null &&
                      milestoneLeftPx >= 0 &&
                      milestoneLeftPx <= timelineWidthPx && (
                        <div
                          title={
                            analysis
                              ? `Веха следующего шага: ${analysis.nextStep.title} (${new Date(
                                  schedule.milestoneMs!
                                ).toLocaleDateString('ru-RU')})`
                              : `Срок задачи: ${new Date(schedule.milestoneMs!).toLocaleDateString('ru-RU')}`
                          }
                          style={{ left: `${milestoneLeftPx - 5}px` }}
                          className="pointer-events-none absolute z-20 h-2.5 w-2.5 rotate-45 border border-white bg-slate-900 shadow-xs"
                        />
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          Нажмите на любую полосу сделки, чтобы открыть карточку amoCRM и историю контактов
        </span>
        <span className="tabular-nums">Всего сделок на графике: {deals.length}</span>
      </div>
    </div>
  );
};
