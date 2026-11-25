import type { DealItem, OwnerOption, StageItem } from '../../presentation/types.ts';

export interface DealScoreFactor {
  label: string;
  delta: number;
}

export interface DealScoreSummary {
  score: number;
  label: 'Горячая' | 'Тёплая' | 'Умеренная' | 'Холодная';
  textClass: string;
  indicatorColor: string;
  factors: DealScoreFactor[];
}

export interface OwnerWorkloadCandidate {
  ownerId: string;
  fullName: string;
  activeDealsCount: number;
  activeBudgetTotal: number;
  continuityMatches: number;
  score: number;
}

export interface DealAutoAssignRecommendation {
  ownerId: string;
  ownerName: string;
  activeDealsBefore: number;
  activeDealsAfter: number;
  score: number;
  reason: string;
  ranking: OwnerWorkloadCandidate[];
}

const PRIORITY_DELTAS: Record<string, { label: string; delta: number }> = {
  Высокий: { label: 'Высокий приоритет', delta: 16 },
  Средний: { label: 'Средний приоритет', delta: 8 },
  Низкий: { label: 'Низкий приоритет', delta: 2 },
};

/**
 * Computes a deterministic 0–100 readiness & temperature score for a CRM deal
 * inspired by lead-scoring pipelines (stage progression, budget, priority,
 * client linkage, task health, and inactivity decay).
 */
export function computeDealScore(
  deal: Pick<
    DealItem,
    | 'budget'
    | 'contactId'
    | 'companyId'
    | 'openTasksCount'
    | 'hasOverdueTask'
    | 'customFields'
    | 'updatedAt'
    | 'tags'
    | 'harnessAnalysis'
  >,
  stage?: Pick<StageItem, 'sortOrder' | 'isWon' | 'isLost'> | null,
  referenceDate: Date = new Date()
): DealScoreSummary {
  const factors: DealScoreFactor[] = [];
  let raw = 25;
  factors.push({ label: 'Базовый скор воронки', delta: 25 });

  // 1. Stage progression
  if (stage?.isWon) {
    raw += 35;
    factors.push({ label: 'Сделка на финальном этапе оплаты', delta: 35 });
  } else if (stage?.isLost) {
    raw -= 25;
    factors.push({ label: 'Сделка закрыта в отказ', delta: -25 });
  } else if (stage && stage.sortOrder >= 2) {
    const stageBoost = Math.min(24, (stage.sortOrder - 1) * 7);
    raw += stageBoost;
    factors.push({ label: `Продвижение по воронке (этап ${stage.sortOrder})`, delta: stageBoost });
  }

  // 2. Budget tier
  if (deal.budget >= 1_000_000) {
    raw += 16;
    factors.push({ label: 'Крупный чек (≥ 1 млн ₽)', delta: 16 });
  } else if (deal.budget >= 350_000) {
    raw += 10;
    factors.push({ label: 'Целевой бюджет (≥ 350 тыс. ₽)', delta: 10 });
  } else if (deal.budget > 0) {
    raw += 4;
    factors.push({ label: 'Подтверждённый бюджет', delta: 4 });
  }

  // 3. Priority attribute
  const priority = String(deal.customFields?.priority || '').trim();
  const priorityInfo = PRIORITY_DELTAS[priority];
  if (priorityInfo) {
    raw += priorityInfo.delta;
    factors.push({ label: priorityInfo.label, delta: priorityInfo.delta });
  }

  // 4. Client & company completeness
  if (deal.contactId && deal.companyId) {
    raw += 10;
    factors.push({ label: 'Привязаны контакт и компания', delta: 10 });
  } else if (deal.contactId || deal.companyId) {
    raw += 5;
    factors.push({ label: 'Привязан профиль клиента', delta: 5 });
  }

  // 5. Task discipline & SLA
  if (deal.hasOverdueTask) {
    raw -= 14;
    factors.push({ label: 'Есть просроченная задача SLA', delta: -14 });
  } else if ((deal.openTasksCount ?? 0) > 0) {
    raw += 7;
    factors.push({ label: 'Запланирован следующий шаг', delta: 7 });
  }

  // 6. AI Harness win probability nudge
  if (typeof deal.harnessAnalysis?.winProbability === 'number') {
    const delta = Math.round((deal.harnessAnalysis.winProbability - 50) / 5);
    if (delta !== 0) {
      raw += delta;
      factors.push({ label: `AI-прогноз (${deal.harnessAnalysis.winProbability}%)`, delta });
    }
  }

  // 7. Inactivity penalty (>= 7 days without updates on open deal)
  if (!stage?.isWon && !stage?.isLost && deal.updatedAt) {
    const updatedMs = new Date(deal.updatedAt).getTime();
    if (!Number.isNaN(updatedMs)) {
      const inactiveDays = Math.floor((referenceDate.getTime() - updatedMs) / 86_400_000);
      if (inactiveDays >= 7) {
        const penalty = -Math.min(15, Math.floor(inactiveDays / 7) * 5);
        raw += penalty;
        factors.push({ label: `Нет активности ${inactiveDays} дн.`, delta: penalty });
      }
    }
  }

  const score = Math.max(0, Math.min(100, Math.round(raw)));

  if (score >= 80) {
    return {
      score,
      label: 'Горячая',
      textClass: 'text-emerald-700',
      indicatorColor: '#16A34A',
      factors,
    };
  }
  if (score >= 55) {
    return {
      score,
      label: 'Тёплая',
      textClass: 'text-blue-700',
      indicatorColor: '#0077FF',
      factors,
    };
  }
  if (score >= 30) {
    return {
      score,
      label: 'Умеренная',
      textClass: 'text-amber-700',
      indicatorColor: '#D97706',
      factors,
    };
  }
  return {
    score,
    label: 'Холодная',
    textClass: 'text-slate-600',
    indicatorColor: '#64748B',
    factors,
  };
}

/**
 * Selects the optimal CRM owner for a deal by balancing active workload,
 * pipeline budget concentration, and historical client/company continuity.
 */
export function recommendDealOwner(
  targetDeal: {
    id: string;
    ownerId?: string | null;
    companyId?: string | null;
    contactId?: string | null;
    budget?: number;
  },
  owners: Array<Pick<OwnerOption, 'id' | 'fullName'>>,
  tenantDeals: Array<{
    id: string;
    ownerId: string;
    companyId: string | null;
    contactId: string | null;
    budget: number;
    isClosed?: boolean;
  }>
): DealAutoAssignRecommendation | null {
  if (owners.length === 0) return null;

  const openDeals = tenantDeals.filter((d) => !d.isClosed && d.id !== targetDeal.id);
  const maxWorkload = Math.max(
    1,
    ...owners.map((o) => openDeals.filter((d) => d.ownerId === o.id).length)
  );
  const maxBudget = Math.max(
    1,
    ...owners.map((o) =>
      openDeals.filter((d) => d.ownerId === o.id).reduce((sum, d) => sum + (d.budget || 0), 0)
    )
  );

  const ranking: OwnerWorkloadCandidate[] = owners.map((owner) => {
    const ownerOpenDeals = openDeals.filter((d) => d.ownerId === owner.id);
    const activeDealsCount = ownerOpenDeals.length;
    const activeBudgetTotal = ownerOpenDeals.reduce((sum, d) => sum + (d.budget || 0), 0);

    const continuityMatches = tenantDeals.filter(
      (d) =>
        d.id !== targetDeal.id &&
        d.ownerId === owner.id &&
        ((targetDeal.companyId && d.companyId === targetDeal.companyId) ||
          (targetDeal.contactId && d.contactId === targetDeal.contactId))
    ).length;

    const workloadScore = Math.round((1 - activeDealsCount / (maxWorkload + 1)) * 55);
    const budgetBalanceScore = Math.round((1 - activeBudgetTotal / (maxBudget + 1)) * 20);
    const continuityBonus = Math.min(25, continuityMatches * 15);
    const sameOwnerPenalty = targetDeal.ownerId === owner.id && owners.length > 1 ? -8 : 0;

    const score = workloadScore + budgetBalanceScore + continuityBonus + sameOwnerPenalty;

    return {
      ownerId: owner.id,
      fullName: owner.fullName,
      activeDealsCount,
      activeBudgetTotal,
      continuityMatches,
      score,
    };
  });

  ranking.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.activeDealsCount !== b.activeDealsCount) {
      return a.activeDealsCount - b.activeDealsCount;
    }
    return a.activeBudgetTotal - b.activeBudgetTotal;
  });

  const winner = ranking[0];
  const reasonParts: string[] = [
    `активных сделок: ${winner.activeDealsCount}`,
    `индекс баланса: ${winner.score}`,
  ];
  if (winner.continuityMatches > 0) {
    reasonParts.unshift(`история по клиенту (${winner.continuityMatches})`);
  }

  return {
    ownerId: winner.ownerId,
    ownerName: winner.fullName,
    activeDealsBefore: winner.activeDealsCount,
    activeDealsAfter: winner.activeDealsCount + 1,
    score: winner.score,
    reason: `Авто-распределение (${reasonParts.join(' · ')})`,
    ranking,
  };
}
