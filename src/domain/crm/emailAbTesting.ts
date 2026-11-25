export interface EmailAbVariant {
  id: 'A' | 'B' | string;
  name: string;
  subject: string;
  preheader: string;
  body: string;
  ctaText: string;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  repliedCount: number;
  convertedCount: number;
  revenue: number;
}

export interface EmailAbExperiment {
  id: string;
  title: string;
  description: string;
  category: 'followup' | 'proposal' | 'contract' | 'onboarding' | 'reactivation';
  status: 'running' | 'completed' | 'draft';
  startDate: string;
  trafficSplit: string;
  primaryMetric: 'open_rate' | 'ctr' | 'conversion_rate';
  statisticalConfidence: number;
  appliedVariantId?: string;
  variants: [EmailAbVariant, EmailAbVariant];
}

export function calculateOpenRate(variant: EmailAbVariant): number {
  if (!variant.deliveredCount || variant.deliveredCount <= 0) return 0;
  return Number(((variant.openedCount / variant.deliveredCount) * 100).toFixed(1));
}

export function calculateCtr(variant: EmailAbVariant): number {
  if (!variant.openedCount || variant.openedCount <= 0) return 0;
  return Number(((variant.clickedCount / variant.openedCount) * 100).toFixed(1));
}

export function calculateConversionRate(variant: EmailAbVariant): number {
  if (!variant.deliveredCount || variant.deliveredCount <= 0) return 0;
  return Number(((variant.convertedCount / variant.deliveredCount) * 100).toFixed(1));
}

export function calculateLift(baseline: number, challenger: number): number {
  if (!baseline || baseline === 0) return 0;
  return Number((((challenger - baseline) / baseline) * 100).toFixed(1));
}

export function getExperimentWinner(experiment: EmailAbExperiment): {
  winner: EmailAbVariant;
  baseline: EmailAbVariant;
  metricLiftPct: number;
} {
  const [a, b] = experiment.variants;
  const scoreFor = (v: EmailAbVariant) => {
    if (experiment.primaryMetric === 'open_rate') return calculateOpenRate(v);
    if (experiment.primaryMetric === 'ctr') return calculateCtr(v);
    return calculateConversionRate(v);
  };
  const scoreA = scoreFor(a);
  const scoreB = scoreFor(b);
  if (scoreB >= scoreA) {
    return {
      winner: b,
      baseline: a,
      metricLiftPct: calculateLift(scoreA, scoreB),
    };
  }
  return {
    winner: a,
    baseline: b,
    metricLiftPct: calculateLift(scoreB, scoreA),
  };
}

export const INITIAL_EMAIL_AB_EXPERIMENTS: EmailAbExperiment[] = [
  {
    id: 'exp_proposal_roi',
    title: 'КП по сделке: Расчёт ROI за 90 дней vs Стандартная смета',
    description:
      'Сравнение коммерческого предложения с акцентом на окупаемость внедрения и классической спецификации модулей.',
    category: 'proposal',
    status: 'completed',
    startDate: '2026-11-01',
    trafficSplit: '50% / 50%',
    primaryMetric: 'conversion_rate',
    statisticalConfidence: 97.6,
    appliedVariantId: 'B',
    variants: [
      {
        id: 'A',
        name: 'Вариант A: Спецификация и бюджет',
        subject: 'Коммерческое предложение по сделке «{{dealTitle}}»',
        preheader: 'Детальная спецификация и стоимость лицензий для {{companyName}}',
        body: 'Здравствуйте, {{contactName}}!\n\nНаправляем коммерческое предложение по проекту «{{dealTitle}}» на сумму {{budget}}.\nБудем рады ответить на вопросы.\n\nС уважением, {{ownerName}}',
        ctaText: 'Открыть смету',
        sentCount: 640,
        deliveredCount: 632,
        openedCount: 284,
        clickedCount: 98,
        repliedCount: 34,
        convertedCount: 41,
        revenue: 16400000,
      },
      {
        id: 'B',
        name: 'Вариант B: Расчёт ROI + пилот 14 дней',
        subject: '{{companyName}}: расчёт окупаемости «{{dealTitle}}» за 90 дней',
        preheader: 'Готовый сценарий пилотного запуска без остановки текущих процессов',
        body: 'Здравствуйте, {{contactName}}!\n\nПодготовили для {{companyName}} расчёт окупаемости проекта «{{dealTitle}}» ({{budget}}) и план пилотного запуска за 14 дней.\nТекущий этап в CRM: {{stageName}}.\n\nС уважением, {{ownerName}}',
        ctaText: 'Согласовать пилот',
        sentCount: 640,
        deliveredCount: 634,
        openedCount: 392,
        clickedCount: 184,
        repliedCount: 72,
        convertedCount: 74,
        revenue: 29600000,
      },
    ],
  },
  {
    id: 'exp_followup_sla',
    title: 'Follow-up после демо: 3 вывода звонка vs Общее напоминание',
    description:
      'Проверка отклика ЛПР на структурированное резюме демонстрации с привязкой к следующему этапу.',
    category: 'followup',
    status: 'running',
    startDate: '2026-11-15',
    trafficSplit: '50% / 50%',
    primaryMetric: 'ctr',
    statisticalConfidence: 91.4,
    variants: [
      {
        id: 'A',
        name: 'Вариант A: Классический follow-up',
        subject: 'Итоги встречи по проекту «{{dealTitle}}»',
        preheader: 'Будем рады вернуться к обсуждению на этой неделе',
        body: 'Здравствуйте, {{contactName}}!\n\nСпасибо за встречу по проекту «{{dealTitle}}». Подскажите, когда удобно обсудить следующие шаги?\n\nС уважением, {{ownerName}}',
        ctaText: 'Выбрать время звонка',
        sentCount: 380,
        deliveredCount: 376,
        openedCount: 172,
        clickedCount: 54,
        repliedCount: 23,
        convertedCount: 28,
        revenue: 8400000,
      },
      {
        id: 'B',
        name: 'Вариант B: План внедрения + чек-лист СБ',
        subject: '3 шага к запуску «{{dealTitle}}» для {{companyName}}',
        preheader: 'Готовый чек-лист безопасности и график подключения команды',
        body: 'Здравствуйте, {{contactName}}!\n\nСобрали ключевые договорённости по «{{dealTitle}}» и приложили чек-лист ИБ для быстрого согласования бюджета {{budget}}.\n\nС уважением, {{ownerName}}',
        ctaText: 'Согласовать график',
        sentCount: 380,
        deliveredCount: 378,
        openedCount: 238,
        clickedCount: 112,
        repliedCount: 49,
        convertedCount: 52,
        revenue: 15600000,
      },
    ],
  },
];
