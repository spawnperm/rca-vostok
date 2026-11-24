import { DFO_SURVEY_REGIONS } from '../data/dfoRegions.ts';

export const EMPLOYMENT_STATUS_OPTIONS = [
  'Штатный инструктор туроператора',
  'ИП или самозанятый (прямые заказы)',
  'Сезонный договор (летний / зимний сезон)',
  'Общественный гид / руководитель турклуба',
  'Временный перерыв / поиск занятости в ДФО',
] as const;

export const SEASONAL_WORKLOAD_OPTIONS = [
  'До 30 дней в сезон (эпизодические выходы)',
  '31–75 дней в сезон (частичная занятость)',
  '76–120 дней в сезон (полный сезон)',
  'Более 120 дней в сезон (круглогодичная загрузка)',
] as const;

export const SURVEY_DISCIPLINES = [
  'Пешеходный туризм',
  'Водный туризм и сплавы',
  'Горный / экспедиционный туризм',
  'Автомобильный туризм',
  'Комбинированные маршруты (ООПТ)',
] as const;

export const SURVEY_COMPLEXITY_LEVELS = ['1–2 КС', '3 КС', '4+ КС'] as const;

export const REATTESTATION_URGENCY_OPTIONS = [
  'Срочно (срок истекает менее чем через 3 мес. или истёк)',
  'Планово в ближайшие 3–12 месяцев (2027 г.)',
  'Повышение категории сложности (1–2 КС → 3–4 КС)',
  'Первичная аттестация без действующего удостоверения',
  'Переаттестация пока не требуется (запас > 1 года)',
] as const;

export const PREFERRED_REATTESTATION_FORMATS = [
  'Выездная комиссия в своём субъекте ДФО',
  'Очно во Владивостоке (кампус ВВГУ и полигон)',
  'Гибрид: онлайн-теория + зачёт на ближайшем полигоне',
] as const;

export interface ReattestationTopicOption {
  id: string;
  label: string;
}

export const REATTESTATION_NEED_TOPICS: readonly ReattestationTopicOption[] = [
  {
    id: 'npa_760',
    label: 'Паспорта маршрутов (ПП № 760) и регламент уведомлений МЧС',
  },
  {
    id: 'wfa_first_aid',
    label: 'Первая помощь в природных условиях (WFA) и состав аптечки',
  },
  {
    id: 'field_rescue',
    label: 'Полевые ПСР, переправы, страховка и спасработы с группой',
  },
  {
    id: 'contour_a_docs',
    label: 'Подготовка документов стажа для зачёта по Контуру А',
  },
  {
    id: 'new_discipline',
    label: 'Открытие дополнительного вида туризма (водный / горный)',
  },
  {
    id: 'vvgu_dpo',
    label: 'Экспресс-модуль переподготовки ДПО ВВГУ перед комиссией',
  },
];

export type ReattestationPriority = 'high' | 'medium' | 'low';

export interface GuideEmploymentSurveyInput {
  respondentName: string;
  region: string;
  discipline: string;
  complexityLevel: string;
  employmentStatus: string;
  workloadRange: string;
  tourDaysPerSeason: number;
  groupsPerMonth: number;
  hasActiveCertificate: boolean;
  reattestationUrgency: string;
  preferredFormat: string;
  neededTopics: string[];
  needsEmployerSubsidy: boolean;
  comment: string;
}

export interface GuideEmploymentSurveyEntry extends GuideEmploymentSurveyInput {
  id: string;
  priorityLevel: ReattestationPriority;
  submittedAt: string;
}

export interface BreakdownStat {
  label: string;
  count: number;
  pct: number;
}

export interface TopicBreakdownStat {
  id: string;
  label: string;
  count: number;
  pct: number;
}

export interface GuideEmploymentSurveySummary {
  totalResponses: number;
  urgentReattestationCount: number;
  needsReattestationCount: number;
  needsReattestationPct: number;
  avgTourDaysPerSeason: number;
  avgGroupsPerMonth: number;
  certifiedSharePct: number;
  subsidyRequestedCount: number;
  byEmployment: BreakdownStat[];
  byUrgency: BreakdownStat[];
  topNeededTopics: TopicBreakdownStat[];
}

export const DEFAULT_SURVEY_FORM_STATE: GuideEmploymentSurveyInput = {
  respondentName: '',
  region: DFO_SURVEY_REGIONS[0],
  discipline: SURVEY_DISCIPLINES[0],
  complexityLevel: SURVEY_COMPLEXITY_LEVELS[0],
  employmentStatus: EMPLOYMENT_STATUS_OPTIONS[0],
  workloadRange: SEASONAL_WORKLOAD_OPTIONS[1],
  tourDaysPerSeason: 65,
  groupsPerMonth: 4,
  hasActiveCertificate: true,
  reattestationUrgency: REATTESTATION_URGENCY_OPTIONS[1],
  preferredFormat: PREFERRED_REATTESTATION_FORMATS[0],
  neededTopics: ['npa_760', 'wfa_first_aid'],
  needsEmployerSubsidy: false,
  comment: '',
};

export function computeReattestationPriority(
  input: Pick<GuideEmploymentSurveyInput, 'reattestationUrgency' | 'hasActiveCertificate'>
): ReattestationPriority {
  const urgency = input.reattestationUrgency;
  if (
    !input.hasActiveCertificate ||
    urgency === REATTESTATION_URGENCY_OPTIONS[0] ||
    urgency === REATTESTATION_URGENCY_OPTIONS[3]
  ) {
    return 'high';
  }
  if (
    urgency === REATTESTATION_URGENCY_OPTIONS[1] ||
    urgency === REATTESTATION_URGENCY_OPTIONS[2]
  ) {
    return 'medium';
  }
  return 'low';
}

export function getPriorityLabel(priority: ReattestationPriority): string {
  switch (priority) {
    case 'high':
      return 'Высокий приоритет (требуется сессия)';
    case 'medium':
      return 'Плановая переаттестация / повышение КС';
    case 'low':
      return 'Запас срока > 1 года';
  }
}

export function validateGuideEmploymentInput(
  input: GuideEmploymentSurveyInput
): { ok: true } | { ok: false; error: string } {
  if (!input.region.trim()) {
    return { ok: false, error: 'Выберите регион работы в ДФО.' };
  }
  if (!input.employmentStatus.trim()) {
    return { ok: false, error: 'Укажите текущий формат занятости.' };
  }
  if (
    !Number.isFinite(input.tourDaysPerSeason) ||
    input.tourDaysPerSeason < 0 ||
    input.tourDaysPerSeason > 365
  ) {
    return {
      ok: false,
      error: 'Укажите корректное количество дней на маршрутах в сезон (от 0 до 365).',
    };
  }
  if (
    !Number.isFinite(input.groupsPerMonth) ||
    input.groupsPerMonth < 0 ||
    input.groupsPerMonth > 60
  ) {
    return {
      ok: false,
      error: 'Укажите корректное число групп в месяц (от 0 до 60).',
    };
  }
  const priority = computeReattestationPriority(input);
  if (priority !== 'low' && input.neededTopics.length === 0) {
    return {
      ok: false,
      error: 'Отметьте хотя бы один необходимый модуль подготовки для переаттестации.',
    };
  }
  return { ok: true };
}

export function createSurveyEntry(
  input: GuideEmploymentSurveyInput,
  sequenceNumber = 1,
  now = new Date()
): GuideEmploymentSurveyEntry {
  const cleanedName = input.respondentName.trim();
  const cleanedComment = input.comment.trim();
  const allowedTopics = new Set(REATTESTATION_NEED_TOPICS.map((t) => t.id));
  const sanitizedTopics = Array.from(
    new Set(input.neededTopics.filter((id) => allowedTopics.has(id)))
  );
  const tourDays = Math.round(Math.max(0, Math.min(365, input.tourDaysPerSeason)));
  const groups = Math.round(Math.max(0, Math.min(60, input.groupsPerMonth)));

  const normalized: GuideEmploymentSurveyInput = {
    ...input,
    respondentName: cleanedName,
    tourDaysPerSeason: tourDays,
    groupsPerMonth: groups,
    neededTopics: sanitizedTopics,
    comment: cleanedComment,
  };

  return {
    ...normalized,
    id: `EMP-${String(sequenceNumber).padStart(3, '0')}-${now.getTime().toString(36).toUpperCase().slice(-4)}`,
    priorityLevel: computeReattestationPriority(normalized),
    submittedAt: now.toISOString(),
  };
}

export function aggregateEmploymentSurvey(
  entries: readonly GuideEmploymentSurveyEntry[]
): GuideEmploymentSurveySummary {
  const total = entries.length;
  if (total === 0) {
    return {
      totalResponses: 0,
      urgentReattestationCount: 0,
      needsReattestationCount: 0,
      needsReattestationPct: 0,
      avgTourDaysPerSeason: 0,
      avgGroupsPerMonth: 0,
      certifiedSharePct: 0,
      subsidyRequestedCount: 0,
      byEmployment: [],
      byUrgency: [],
      topNeededTopics: [],
    };
  }

  let urgentCount = 0;
  let needsCount = 0;
  let certifiedCount = 0;
  let subsidyCount = 0;
  let sumTourDays = 0;
  let sumGroups = 0;

  const employmentCounts = new Map<string, number>();
  const urgencyCounts = new Map<string, number>();
  const topicCounts = new Map<string, number>();

  for (const entry of entries) {
    if (entry.priorityLevel === 'high') urgentCount += 1;
    if (entry.priorityLevel !== 'low') needsCount += 1;
    if (entry.hasActiveCertificate) certifiedCount += 1;
    if (entry.needsEmployerSubsidy) subsidyCount += 1;
    sumTourDays += entry.tourDaysPerSeason;
    sumGroups += entry.groupsPerMonth;

    employmentCounts.set(
      entry.employmentStatus,
      (employmentCounts.get(entry.employmentStatus) ?? 0) + 1
    );
    urgencyCounts.set(
      entry.reattestationUrgency,
      (urgencyCounts.get(entry.reattestationUrgency) ?? 0) + 1
    );
    for (const topicId of entry.neededTopics) {
      topicCounts.set(topicId, (topicCounts.get(topicId) ?? 0) + 1);
    }
  }

  const toBreakdown = (map: Map<string, number>): BreakdownStat[] =>
    Array.from(map.entries())
      .map(([label, count]) => ({
        label,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ru'));

  const topicLookup = new Map(REATTESTATION_NEED_TOPICS.map((t) => [t.id, t.label]));
  const topNeededTopics: TopicBreakdownStat[] = Array.from(topicCounts.entries())
    .map(([id, count]) => ({
      id,
      label: topicLookup.get(id) ?? id,
      count,
      pct: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ru'));

  return {
    totalResponses: total,
    urgentReattestationCount: urgentCount,
    needsReattestationCount: needsCount,
    needsReattestationPct: Math.round((needsCount / total) * 100),
    avgTourDaysPerSeason: Math.round(sumTourDays / total),
    avgGroupsPerMonth: Math.round((sumGroups / total) * 10) / 10,
    certifiedSharePct: Math.round((certifiedCount / total) * 100),
    subsidyRequestedCount: subsidyCount,
    byEmployment: toBreakdown(employmentCounts),
    byUrgency: toBreakdown(urgencyCounts),
    topNeededTopics,
  };
}
