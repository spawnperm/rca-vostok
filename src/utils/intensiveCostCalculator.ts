export type IntensiveComplexityId = 'ks1' | 'ks2' | 'ks3' | 'ks4';

export interface ComplexityTariff {
  id: IntensiveComplexityId;
  shortLabel: string;
  title: string;
  scopeDescription: string;
  baseAttestationFee: number;
  dailyIntensiveRate: number;
  recommendedDays: number;
  fieldGearCost: number;
}

export interface IntensiveCostInput {
  complexityId: IntensiveComplexityId;
  intensiveDays: number;
  includeFieldGear: boolean;
  applyTrainingSubsidy: boolean;
}

export interface IntensiveCostBreakdownItem {
  id: string;
  label: string;
  detail: string;
  amount: number;
  category: 'attestation' | 'training' | 'gear' | 'discount';
}

export interface IntensiveCostResult {
  tariff: ComplexityTariff;
  intensiveDays: number;
  attestationFee: number;
  nkTaxDuty: number;
  grossTrainingCost: number;
  multiDayDiscount: number;
  subsidyReduction: number;
  netTrainingCost: number;
  fieldGearCost: number;
  totalCost: number;
  costPerDayEquivalent: number;
  isBelowRecommendedDays: boolean;
  attestationSharePct: number;
  trainingSharePct: number;
  gearSharePct: number;
  breakdown: IntensiveCostBreakdownItem[];
}

export const COMPLEXITY_TARIFFS: readonly ComplexityTariff[] = [
  {
    id: 'ks1',
    shortLabel: '1 КС',
    title: '1 категория сложности (базовая)',
    scopeDescription: 'Экотропы ООПТ, несложные пешие походы и базовые водные прогулки.',
    baseAttestationFee: 12000,
    dailyIntensiveRate: 3200,
    recommendedDays: 2,
    fieldGearCost: 2500,
  },
  {
    id: 'ks2',
    shortLabel: '2 КС',
    title: '2 категория сложности (средняя)',
    scopeDescription: 'Горно-таёжные переходы, таёжные сплавы до 2 к.с. с организацией переправ.',
    baseAttestationFee: 15000,
    dailyIntensiveRate: 3800,
    recommendedDays: 4,
    fieldGearCost: 3500,
  },
  {
    id: 'ks3',
    shortLabel: '3 КС',
    title: '3 категория сложности (повышенная)',
    scopeDescription: 'Технические маршруты, порожистые реки и высокогорные участки с ПСР.',
    baseAttestationFee: 19800,
    dailyIntensiveRate: 4600,
    recommendedDays: 6,
    fieldGearCost: 4800,
  },
  {
    id: 'ks4',
    shortLabel: '4 КС',
    title: '4 категория сложности (высшая)',
    scopeDescription: 'Автономные экспедиции ДФО (Камчатка, Курилы, Север) в малых группах.',
    baseAttestationFee: 25000,
    dailyIntensiveRate: 5500,
    recommendedDays: 8,
    fieldGearCost: 6200,
  },
];

export const INTENSIVE_MIN_DAYS = 1;
export const INTENSIVE_MAX_DAYS = 14;

export function calculateIntensiveCost(input: IntensiveCostInput): IntensiveCostResult {
  const tariff =
    COMPLEXITY_TARIFFS.find((t) => t.id === input.complexityId) ?? COMPLEXITY_TARIFFS[1];

  const days = Math.max(
    INTENSIVE_MIN_DAYS,
    Math.min(INTENSIVE_MAX_DAYS, Math.round(Number(input.intensiveDays) || 1))
  );

  const attestationFee = tariff.baseAttestationFee;
  const nkTaxDuty = 0;

  const grossTrainingCost = tariff.dailyIntensiveRate * days;
  // 10% package discount for extended intensive preparation (>= 7 days)
  const multiDayDiscount = days >= 7 ? Math.round(grossTrainingCost * 0.1) : 0;
  const trainingAfterPackage = grossTrainingCost - multiDayDiscount;

  // Regional DPO / tuition support up to 50% on intensive training component
  const subsidyReduction = input.applyTrainingSubsidy
    ? Math.round(trainingAfterPackage * 0.5)
    : 0;
  const netTrainingCost = Math.max(0, trainingAfterPackage - subsidyReduction);

  const fieldGearCost = input.includeFieldGear ? tariff.fieldGearCost : 0;
  const totalCost = attestationFee + netTrainingCost + fieldGearCost;
  const costPerDayEquivalent = Math.round(totalCost / days);

  const safeTotal = Math.max(totalCost, 1);
  const attestationSharePct = Math.round((attestationFee / safeTotal) * 100);
  const gearSharePct = Math.round((fieldGearCost / safeTotal) * 100);
  const trainingSharePct = Math.max(0, 100 - attestationSharePct - gearSharePct);

  const breakdown: IntensiveCostBreakdownItem[] = [
    {
      id: 'attestation',
      label: `Аттестационный сбор РЦА / ФСТР (${tariff.shortLabel})`,
      detail: 'Ориентир по методике ПП РФ № 891 (теоретический и полевой этапы)',
      amount: attestationFee,
      category: 'attestation',
    },
    {
      id: 'training',
      label: `Очно-полевой интенсив подготовки (${days} дн. × ${tariff.dailyIntensiveRate.toLocaleString('ru-RU')} ₽)`,
      detail: 'Лекции ДПО, разбор паспорта № 760, практика WFA и ПСР',
      amount: grossTrainingCost,
      category: 'training',
    },
  ];

  if (multiDayDiscount > 0) {
    breakdown.push({
      id: 'package-discount',
      label: 'Скидка длительного интенсива (от 7 дней, −10%)',
      detail: 'Пакетное снижение стоимости дня при комплексной программе',
      amount: -multiDayDiscount,
      category: 'discount',
    });
  }

  if (subsidyReduction > 0) {
    breakdown.push({
      id: 'subsidy',
      label: 'Региональная субсидия на обучение ДПО (−50%)',
      detail: 'Оценочная компенсация затрат на переподготовку (для резидентов Приморья)',
      amount: -subsidyReduction,
      category: 'discount',
    });
  }

  if (fieldGearCost > 0) {
    breakdown.push({
      id: 'gear',
      label: 'Аренда полигонного и страховочного снаряжения',
      detail: `Комплект по нормативу ${tariff.shortLabel} на время сборов`,
      amount: fieldGearCost,
      category: 'gear',
    });
  }

  return {
    tariff,
    intensiveDays: days,
    attestationFee,
    nkTaxDuty,
    grossTrainingCost,
    multiDayDiscount,
    subsidyReduction,
    netTrainingCost,
    fieldGearCost,
    totalCost,
    costPerDayEquivalent,
    isBelowRecommendedDays: days < tariff.recommendedDays,
    attestationSharePct,
    trainingSharePct,
    gearSharePct,
    breakdown,
  };
}
