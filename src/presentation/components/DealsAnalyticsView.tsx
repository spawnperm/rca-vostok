import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, BarChart3, CheckCircle2, ShieldAlert, TrendingUp, Trophy } from 'lucide-react';
import { formatCurrencyRub } from '../../shared/formatters.ts';
import type { DealItem, StageItem } from '../types.ts';

export interface FunnelStageMetric {
  stageId: string;
  name: string;
  color: string;
  sortOrder: number;
  isWon: boolean;
  isLost: boolean;
  currentCount: number;
  currentBudget: number;
  reachedCount: number;
  reachedBudget: number;
  stepConversionPct: number;
  cumulativeConversionPct: number;
  avgWinProbability: number;
}

export interface OwnerConversionMetric {
  ownerId: string;
  ownerName: string;
  dealsCount: number;
  activeCount: number;
  wonCount: number;
  lostCount: number;
  totalBudget: number;
  wonBudget: number;
  activeBudget: number;
  conversionPct: number;
}

export interface RiskDistributionMetric {
  name: string;
  count: number;
  budget: number;
  color: string;
}

export interface DealsFunnelMetrics {
  funnelStages: FunnelStageMetric[];
  lostStage: FunnelStageMetric | null;
  totalDeals: number;
  activeDealsCount: number;
  activeBudget: number;
  wonDealsCount: number;
  wonBudget: number;
  lostDealsCount: number;
  lostBudget: number;
  avgDealBudget: number;
  winRatePct: number;
  overallFunnelConversionPct: number;
  weightedForecastBudget: number;
  ownerBreakdown: OwnerConversionMetric[];
  riskBreakdown: RiskDistributionMetric[];
}

export function computeDealsFunnelMetrics(
  deals: DealItem[],
  stages: StageItem[]
): DealsFunnelMetrics {
  const sortedStages = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
  const progressiveStages = sortedStages.filter((s) => !s.isLost);
  const lostStageDef = sortedStages.find((s) => s.isLost) || null;
  const stageById = new Map(sortedStages.map((s) => [s.id, s]));

  const progressiveOrderList = progressiveStages.map((s) => s.sortOrder);
  const maxProgressiveOrder =
    progressiveOrderList.length > 0 ? Math.max(...progressiveOrderList) : 1;

  const wonDeals = deals.filter((d) => stageById.get(d.stageId)?.isWon);
  const lostDeals = deals.filter((d) => stageById.get(d.stageId)?.isLost);
  const activeDeals = deals.filter((d) => {
    const st = stageById.get(d.stageId);
    return !st?.isWon && !st?.isLost;
  });

  const activeBudget = activeDeals.reduce((sum, d) => sum + d.budget, 0);
  const wonBudget = wonDeals.reduce((sum, d) => sum + d.budget, 0);
  const lostBudget = lostDeals.reduce((sum, d) => sum + d.budget, 0);
  const totalBudget = deals.reduce((sum, d) => sum + d.budget, 0);
  const avgDealBudget = deals.length > 0 ? Math.round(totalBudget / deals.length) : 0;

  // Deals that entered the pipeline and are tracked on progressive stages (lost deals entered at stage 1)
  const totalEnteredCount = deals.length;

  const funnelStages: FunnelStageMetric[] = progressiveStages.map((st, idx) => {
    const inStage = deals.filter((d) => d.stageId === st.id);
    const currentCount = inStage.length;
    const currentBudget = inStage.reduce((s, d) => s + d.budget, 0);

    // Cumulative deals that reached at least this stage (lost deals dropped before reaching later stages;
    // at stage 0, all deals including lost ones entered the funnel)
    const reachedDeals = deals.filter((d) => {
      const dealStage = stageById.get(d.stageId);
      if (!dealStage) return idx === 0;
      if (dealStage.isLost) return idx === 0;
      if (dealStage.isWon) return true;
      return dealStage.sortOrder >= st.sortOrder;
    });

    const reachedCount = reachedDeals.length;
    const reachedBudget = reachedDeals.reduce((s, d) => s + d.budget, 0);

    const avgWinProbability =
      inStage.length > 0
        ? Math.round(
            inStage.reduce((sum, d) => {
              if (st.isWon) return sum + 100;
              if (d.harnessAnalysis) return sum + d.harnessAnalysis.winProbability;
              const heuristic = Math.round((st.sortOrder / Math.max(1, maxProgressiveOrder)) * 85);
              return sum + heuristic;
            }, 0) / inStage.length
          )
        : st.isWon
          ? 100
          : Math.round((st.sortOrder / Math.max(1, maxProgressiveOrder)) * 85);

    return {
      stageId: st.id,
      name: st.name,
      color: st.color,
      sortOrder: st.sortOrder,
      isWon: st.isWon,
      isLost: st.isLost,
      currentCount,
      currentBudget,
      reachedCount,
      reachedBudget,
      stepConversionPct: 100,
      cumulativeConversionPct:
        totalEnteredCount > 0 ? Math.round((reachedCount / totalEnteredCount) * 100) : 0,
      avgWinProbability,
    };
  });

  for (let i = 0; i < funnelStages.length; i += 1) {
    if (i === 0) {
      funnelStages[i].stepConversionPct = funnelStages[i].reachedCount > 0 ? 100 : 0;
    } else {
      const prev = funnelStages[i - 1].reachedCount;
      funnelStages[i].stepConversionPct =
        prev > 0 ? Math.round((funnelStages[i].reachedCount / prev) * 100) : 0;
    }
  }

  const lostStage: FunnelStageMetric | null = lostStageDef
    ? {
        stageId: lostStageDef.id,
        name: lostStageDef.name,
        color: lostStageDef.color,
        sortOrder: lostStageDef.sortOrder,
        isWon: false,
        isLost: true,
        currentCount: lostDeals.length,
        currentBudget: lostBudget,
        reachedCount: lostDeals.length,
        reachedBudget: lostBudget,
        stepConversionPct:
          totalEnteredCount > 0 ? Math.round((lostDeals.length / totalEnteredCount) * 100) : 0,
        cumulativeConversionPct:
          totalEnteredCount > 0 ? Math.round((lostDeals.length / totalEnteredCount) * 100) : 0,
        avgWinProbability: 0,
      }
    : null;

  const closedCount = wonDeals.length + lostDeals.length;
  const winRatePct =
    closedCount > 0
      ? Math.round((wonDeals.length / closedCount) * 100)
      : deals.length > 0
        ? Math.round((wonDeals.length / deals.length) * 100)
        : 0;

  const overallFunnelConversionPct =
    totalEnteredCount > 0 ? Math.round((wonDeals.length / totalEnteredCount) * 100) : 0;

  const weightedActive = activeDeals.reduce((sum, d) => {
    const st = stageById.get(d.stageId);
    const prob =
      d.harnessAnalysis?.winProbability ??
      Math.round(((st?.sortOrder ?? 1) / Math.max(1, maxProgressiveOrder)) * 75);
    return sum + (d.budget * prob) / 100;
  }, 0);
  const weightedForecastBudget = Math.round(wonBudget + weightedActive);

  // Owner conversion breakdown
  const ownerMap = new Map<string, OwnerConversionMetric>();
  for (const deal of deals) {
    const st = stageById.get(deal.stageId);
    const existing = ownerMap.get(deal.ownerId) || {
      ownerId: deal.ownerId,
      ownerName: deal.ownerName || 'Без менеджера',
      dealsCount: 0,
      activeCount: 0,
      wonCount: 0,
      lostCount: 0,
      totalBudget: 0,
      wonBudget: 0,
      activeBudget: 0,
      conversionPct: 0,
    };
    existing.dealsCount += 1;
    existing.totalBudget += deal.budget;
    if (st?.isWon) {
      existing.wonCount += 1;
      existing.wonBudget += deal.budget;
    } else if (st?.isLost) {
      existing.lostCount += 1;
    } else {
      existing.activeCount += 1;
      existing.activeBudget += deal.budget;
    }
    ownerMap.set(deal.ownerId, existing);
  }

  const ownerBreakdown = Array.from(ownerMap.values())
    .map((o) => ({
      ...o,
      conversionPct: o.dealsCount > 0 ? Math.round((o.wonCount / o.dealsCount) * 100) : 0,
    }))
    .sort((a, b) => b.totalBudget - a.totalBudget);

  // Risk distribution
  const riskBuckets: Array<{ key: 'Низкий' | 'Средний' | 'Высокий' | 'Без оценки'; color: string }> = [
    { key: 'Низкий', color: '#16A34A' },
    { key: 'Средний', color: '#F59E0B' },
    { key: 'Высокий', color: '#DC2626' },
    { key: 'Без оценки', color: '#94A3B8' },
  ];

  const riskBreakdown: RiskDistributionMetric[] = riskBuckets
    .map((bucket) => {
      const matched = deals.filter((d) => {
        const level = d.harnessAnalysis?.riskLevel || 'Без оценки';
        return level === bucket.key;
      });
      return {
        name: bucket.key,
        count: matched.length,
        budget: matched.reduce((s, d) => s + d.budget, 0),
        color: bucket.color,
      };
    })
    .filter((b) => b.count > 0);

  return {
    funnelStages,
    lostStage,
    totalDeals: deals.length,
    activeDealsCount: activeDeals.length,
    activeBudget,
    wonDealsCount: wonDeals.length,
    wonBudget,
    lostDealsCount: lostDeals.length,
    lostBudget,
    avgDealBudget,
    winRatePct,
    overallFunnelConversionPct,
    weightedForecastBudget,
    ownerBreakdown,
    riskBreakdown,
  };
}

interface DealsAnalyticsViewProps {
  deals: DealItem[];
  stages: StageItem[];
  onSwitchToKanban?: () => void;
}

function formatCompactMillions(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }
  return String(value);
}

export const DealsAnalyticsView: React.FC<DealsAnalyticsViewProps> = ({
  deals,
  stages,
  onSwitchToKanban,
}) => {
  const [funnelMode, setFunnelMode] = useState<'cumulative' | 'current'>('cumulative');

  const metrics = useMemo(() => computeDealsFunnelMetrics(deals, stages), [deals, stages]);

  const funnelChartData = useMemo(
    () =>
      metrics.funnelStages.map((st) => ({
        name: st.name,
        value: funnelMode === 'cumulative' ? st.reachedCount : st.currentCount,
        budget: funnelMode === 'cumulative' ? st.reachedBudget : st.currentBudget,
        stepConversionPct: st.stepConversionPct,
        cumulativeConversionPct: st.cumulativeConversionPct,
        fill: st.color || '#0077FF',
      })),
    [metrics.funnelStages, funnelMode]
  );

  const stageComparisonData = useMemo(
    () =>
      metrics.funnelStages.map((st) => ({
        name: st.name.length > 16 ? `${st.name.slice(0, 15)}…` : st.name,
        fullName: st.name,
        budgetK: Math.round(st.currentBudget / 1000),
        currentBudget: st.currentBudget,
        currentCount: st.currentCount,
        reachedCount: st.reachedCount,
        stepConversionPct: st.stepConversionPct,
        cumulativeConversionPct: st.cumulativeConversionPct,
        color: st.color || '#0077FF',
      })),
    [metrics.funnelStages]
  );

  const ownerChartData = useMemo(
    () =>
      metrics.ownerBreakdown.map((o) => ({
        name: o.ownerName.split(' ')[0] || o.ownerName,
        fullName: o.ownerName,
        wonK: Math.round(o.wonBudget / 1000),
        activeK: Math.round(o.activeBudget / 1000),
        conversionPct: o.conversionPct,
        dealsCount: o.dealsCount,
        wonCount: o.wonCount,
      })),
    [metrics.ownerBreakdown]
  );

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Конверсия в победу (Win Rate)</span>
            <Trophy className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {metrics.winRatePct}%
            </span>
            <span className="text-xs text-slate-500">
              от входа: {metrics.overallFunnelConversionPct}%
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Выиграно {metrics.wonDealsCount} · Потеряно {metrics.lostDealsCount} · Всего{' '}
            {metrics.totalDeals}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Активная воронка</span>
            <BarChart3 className="h-4 w-4 text-[#0077FF]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {formatCurrencyRub(metrics.activeBudget)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {metrics.activeDealsCount} сделок в работе · Ср. чек{' '}
            {formatCurrencyRub(metrics.avgDealBudget)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Взвешенный прогноз (Harness)</span>
            <TrendingUp className="h-4 w-4 text-violet-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {formatCurrencyRub(metrics.weightedForecastBudget)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Выручка + активные сделки с учётом вероятности AI
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Реализовано vs Потери</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700 tabular-nums">
            {formatCurrencyRub(metrics.wonBudget)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Потеряно: {formatCurrencyRub(metrics.lostBudget)}
          </div>
        </div>
      </div>

      {/* Main Charts Row: Sales Funnel + Conversion & Budget by Stage */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* FunnelChart */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Воронка продаж (Recharts)</h3>
              <p className="text-[11px] text-slate-500">
                {funnelMode === 'cumulative'
                  ? 'Сколько сделок дошло до каждого этапа воронки'
                  : 'Текущее распределение активных и закрытых сделок'}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setFunnelMode('cumulative')}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  funnelMode === 'cumulative'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Накопительная
              </button>
              <button
                type="button"
                onClick={() => setFunnelMode('current')}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  funnelMode === 'current'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                По этапам
              </button>
            </div>
          </div>

          <div className="mt-3 h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const item = payload[0]?.payload as {
                      name: string;
                      value: number;
                      budget: number;
                      stepConversionPct: number;
                      cumulativeConversionPct: number;
                    };
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="mt-1 space-y-0.5 text-slate-600">
                          <div>
                            Сделок: <strong className="text-slate-900">{item.value}</strong>
                          </div>
                          <div>
                            Объём:{' '}
                            <strong className="text-slate-900">
                              {formatCurrencyRub(item.budget)}
                            </strong>
                          </div>
                          <div>
                            Шаг конверсии:{' '}
                            <strong className="text-[#0077FF]">{item.stepConversionPct}%</strong>
                          </div>
                          <div>
                            От входа:{' '}
                            <strong className="text-emerald-700">
                              {item.cumulativeConversionPct}%
                            </strong>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Funnel dataKey="value" data={funnelChartData} isAnimationActive={false}>
                  {funnelChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                  <LabelList
                    position="right"
                    fill="#334155"
                    stroke="none"
                    dataKey="name"
                    style={{ fontSize: 11, fontWeight: 500 }}
                  />
                  <LabelList
                    position="center"
                    fill="#FFFFFF"
                    stroke="none"
                    dataKey="value"
                    style={{ fontSize: 12, fontWeight: 700 }}
                  />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ComposedChart: Budget Bars + Step Conversion Line */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Бюджет и конверсия перехода между этапами
              </h3>
              <p className="text-[11px] text-slate-500">
                Столбцы — объём сделок на этапе (тыс. ₽) · Линия — конверсия перехода (%)
              </p>
            </div>
            {onSwitchToKanban && (
              <button
                type="button"
                onClick={onSwitchToKanban}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
              >
                Открыть канбан
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="mt-3 h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={stageComparisonData}
                margin={{ top: 10, right: 14, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  interval={0}
                  axisLine={{ stroke: '#CBD5E1' }}
                />
                <YAxis
                  yAxisId="budget"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  tickFormatter={(val: number) => formatCompactMillions(val * 1000)}
                  axisLine={{ stroke: '#CBD5E1' }}
                />
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#0077FF' }}
                  tickFormatter={(val: number) => `${val}%`}
                  axisLine={{ stroke: '#CBD5E1' }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const row = payload[0]?.payload as (typeof stageComparisonData)[number];
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                        <div className="font-semibold text-slate-900">{row.fullName}</div>
                        <div className="mt-1 space-y-0.5 text-slate-600">
                          <div>
                            Текущих сделок:{' '}
                            <strong className="text-slate-900">{row.currentCount}</strong> (дошло:{' '}
                            {row.reachedCount})
                          </div>
                          <div>
                            Бюджет этапа:{' '}
                            <strong className="text-slate-900">
                              {formatCurrencyRub(row.currentBudget)}
                            </strong>
                          </div>
                          <div>
                            Конверсия шага:{' '}
                            <strong className="text-[#0077FF]">{row.stepConversionPct}%</strong>
                          </div>
                          <div>
                            От входа в воронку:{' '}
                            <strong className="text-emerald-700">
                              {row.cumulativeConversionPct}%
                            </strong>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  yAxisId="budget"
                  dataKey="budgetK"
                  name="Бюджет этапа (тыс. ₽)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                >
                  {stageComparisonData.map((entry) => (
                    <Cell key={entry.fullName} fill={entry.color} fillOpacity={0.88} />
                  ))}
                </Bar>
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="stepConversionPct"
                  name="Конверсия перехода (%)"
                  stroke="#0077FF"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#0077FF', strokeWidth: 2, stroke: '#FFFFFF' }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Secondary Row: Owner Performance + Risk Distribution */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Owner Breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-7">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Эффективность менеджеров (выручка и активный портфель)
            </h3>
            <p className="text-[11px] text-slate-500">
              Сравнение выигранных сделок и текущего пайплайна в тыс. ₽
            </p>
          </div>

          {ownerChartData.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Недостаточно данных по менеджерам
            </div>
          ) : (
            <div className="mt-3 h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ownerChartData} margin={{ top: 8, right: 14, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#475569' }}
                    tickFormatter={(val: number) => formatCompactMillions(val * 1000)}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const row = payload[0]?.payload as (typeof ownerChartData)[number];
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                          <div className="font-semibold text-slate-900">{row.fullName}</div>
                          <div className="mt-1 space-y-0.5 text-slate-600">
                            <div>
                              Сделок: <strong>{row.dealsCount}</strong> (побед:{' '}
                              <strong className="text-emerald-700">{row.wonCount}</strong>)
                            </div>
                            <div>
                              Конверсия в победу:{' '}
                              <strong className="text-[#0077FF]">{row.conversionPct}%</strong>
                            </div>
                            <div>
                              Выиграно:{' '}
                              <strong className="text-emerald-700">
                                {formatCurrencyRub(row.wonK * 1000)}
                              </strong>
                            </div>
                            <div>
                              В работе:{' '}
                              <strong className="text-slate-900">
                                {formatCurrencyRub(row.activeK * 1000)}
                              </strong>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="wonK"
                    name="Выиграно (тыс. ₽)"
                    stackId="a"
                    fill="#16A34A"
                    radius={[0, 0, 0, 0]}
                    maxBarSize={42}
                  />
                  <Bar
                    dataKey="activeK"
                    name="В работе (тыс. ₽)"
                    stackId="a"
                    fill="#0077FF"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={42}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Risk Donut */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Профиль рисков DeepSeek-Harness
              </h3>
              <p className="text-[11px] text-slate-500">
                Распределение сделок по уровню риска закрытия
              </p>
            </div>
            <ShieldAlert className="h-4 w-4 text-slate-400" />
          </div>

          {metrics.riskBreakdown.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">Нет данных по рискам</div>
          ) : (
            <div className="mt-3 grid grid-cols-1 items-center gap-3 sm:grid-cols-2">
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const row = payload[0]?.payload as RiskDistributionMetric;
                        return (
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                            <div className="font-semibold text-slate-900">Риск: {row.name}</div>
                            <div className="mt-1 text-slate-600">
                              Сделок: <strong>{row.count}</strong> ·{' '}
                              <strong>{formatCurrencyRub(row.budget)}</strong>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Pie
                      data={metrics.riskBreakdown}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={3}
                    >
                      {metrics.riskBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {metrics.riskBreakdown.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate font-medium text-slate-800">{item.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-slate-900 tabular-nums">{item.count}</div>
                      <div className="text-[10px] text-slate-500 tabular-nums">
                        {formatCurrencyRub(item.budget)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stage-by-Stage Conversion Breakdown Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <h3 className="text-xs font-semibold text-slate-800">
            Детализация конверсий по этапам воронки
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-white text-[11px] font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Этап</th>
                <th className="px-4 py-2.5 text-right">На этапе</th>
                <th className="px-4 py-2.5 text-right">Дошло до этапа</th>
                <th className="px-4 py-2.5 text-right">Конверсия шага</th>
                <th className="px-4 py-2.5 text-right">От входа</th>
                <th className="px-4 py-2.5 text-right">Сумма на этапе</th>
                <th className="px-4 py-2.5 text-right">Ср. шанс AI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {metrics.funnelStages.map((st) => (
                <tr key={st.stageId} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: st.color }}
                      />
                      <span>{st.name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                    {st.currentCount}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                    {st.reachedCount}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[#0077FF]">
                    {st.stepConversionPct}%
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700 font-medium">
                    {st.cumulativeConversionPct}%
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">
                    {formatCurrencyRub(st.currentBudget)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                    {st.avgWinProbability}%
                  </td>
                </tr>
              ))}
              {metrics.lostStage && (
                <tr className="bg-red-50/40">
                  <td className="px-4 py-2.5 font-medium text-red-800">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: metrics.lostStage.color }}
                      />
                      <span>{metrics.lostStage.name} (Потери)</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-red-700">
                    {metrics.lostStage.currentCount}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-red-700">—</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-red-700">
                    {metrics.lostStage.stepConversionPct}%
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-red-700">
                    {metrics.lostStage.cumulativeConversionPct}%
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-red-800">
                    {formatCurrencyRub(metrics.lostStage.currentBudget)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-red-700">0%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
