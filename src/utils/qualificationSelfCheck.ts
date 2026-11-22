export type QualificationTrackId = 'hiking' | 'water' | 'expedition';

export type QualificationAnswerLevel = 'confirmed' | 'in_progress' | 'missing';

export type SelfCheckDomainId = 'documents' | 'experience' | 'safety' | 'methodology';

export interface QualificationQuestion {
  id: string;
  orderLabel: string;
  domain: SelfCheckDomainId;
  domainLabel: string;
  title: string;
  requirementHint: string;
  recommendedQuery: string;
  trackNote: Record<QualificationTrackId, string>;
}

export interface PieSliceItem {
  id: string;
  name: string;
  value: number;
  percent: number;
  color: string;
  unitLabel: string;
}

export interface DomainEvaluation {
  id: SelfCheckDomainId;
  label: string;
  earned: number;
  max: number;
  percent: number;
  color: string;
}

export interface SelfCheckRecommendation {
  questionId: string;
  title: string;
  domainLabel: string;
  severity: 'critical' | 'moderate';
  actionHint: string;
  knowledgeQuery: string;
}

export type SelfCheckVerdictTier =
  | 'incomplete'
  | 'ready'
  | 'contour_a'
  | 'training_needed';

export interface SelfCheckEvaluation {
  track: QualificationTrackId;
  answeredCount: number;
  totalQuestions: number;
  isComplete: boolean;
  earnedPoints: number;
  maxPoints: number;
  readinessPercent: number;
  confirmedCount: number;
  partialCount: number;
  missingCount: number;
  unansweredCount: number;
  statusPieData: PieSliceItem[];
  domainBreakdown: DomainEvaluation[];
  domainPieData: PieSliceItem[];
  verdictTier: SelfCheckVerdictTier;
  verdictBadge: string;
  verdictTitle: string;
  verdictSummary: string;
  recommendedContour: string;
  recommendations: SelfCheckRecommendation[];
}

export const QUALIFICATION_TRACKS: readonly {
  id: QualificationTrackId;
  label: string;
  shortLabel: string;
  hint: string;
}[] = [
  {
    id: 'hiking',
    label: 'Пешеходный туризм',
    shortLabel: 'Пешеходный',
    hint: 'Экотропы ООПТ, таёжные и горно-пешеходные маршруты 1–4 КС',
  },
  {
    id: 'water',
    label: 'Водный туризм и сплавы',
    shortLabel: 'Водный',
    hint: 'Сплавы на реках ДФО, морской каякинг, спасработы на воде (1–4 КС)',
  },
  {
    id: 'expedition',
    label: 'Горный / экспедиционный',
    shortLabel: 'Горный / экспед.',
    hint: 'Автономные маршруты 2–4 КС, малые группы 4–6 чел., Камчатка и Север',
  },
];

export const ANSWER_LEVEL_OPTIONS: readonly {
  id: QualificationAnswerLevel;
  label: string;
  points: number;
}[] = [
  { id: 'confirmed', label: 'Соответствую', points: 2 },
  { id: 'in_progress', label: 'Частично', points: 1 },
  { id: 'missing', label: 'Требуется', points: 0 },
];

export const DOMAIN_META: Record<
  SelfCheckDomainId,
  { label: string; color: string }
> = {
  documents: { label: 'Документы и допуск', color: '#0f766e' },
  experience: { label: 'Опыт и топография', color: '#0284c7' },
  safety: { label: 'Первая помощь и ДФО', color: '#d97706' },
  methodology: { label: 'Паспорт и управление', color: '#334155' },
};

export const SELF_CHECK_QUESTIONS: readonly QualificationQuestion[] = [
  {
    id: 'sc-identity-education',
    orderLabel: '01',
    domain: 'documents',
    domainLabel: 'Документы и допуск',
    title: 'Совершеннолетие, базовые документы (паспорт, СНИЛС) и образование / ДПО',
    requirementHint: 'ПП РФ № 1003 (ред. № 1893) · ФЗ № 273-ФЗ',
    recommendedQuery: 'документы',
    trackNote: {
      hiking: 'Необходим диплом об образовании либо диплом переподготовки ДПО ВВГУ (≈ 250 ч).',
      water: 'Требуется базовый пакет документов и профильное образование или ДПО по водному туризму ВВГУ.',
      expedition: 'Обязательны паспорт, СНИЛС и документ о профобразовании или ДПО.',
    },
  },
  {
    id: 'sc-medical-clearance',
    orderLabel: '02',
    domain: 'documents',
    domainLabel: 'Документы и допуск',
    title: 'Действующее медицинское заключение об отсутствии противопоказаний',
    requirementHint: 'Обязательный допуск к полевому этапу',
    recommendedQuery: 'медсправка',
    trackNote: {
      hiking: 'Справка-допуск к длительным пешим и горно-таёжным нагрузкам.',
      water: 'Медзаключение с допуском к работе в холодной воде и спасательным работам.',
      expedition: 'Медсправка для автономных маршрутов, высокогорья и экстремальных температур.',
    },
  },
  {
    id: 'sc-hiking-experience',
    orderLabel: '03',
    domain: 'experience',
    domainLabel: 'Опыт и топография',
    title: 'Подтверждённый опыт маршрутов по заявленной категории сложности (1–4 КС)',
    requirementHint: 'Маршрутные книжки, справки ФСТР или договоры туроператора (Контур А)',
    recommendedQuery: 'Контур А',
    trackNote: {
      hiking: 'Засчитываются книжки МКК, справки ФСТР или коммерческие треки/договоры через Контур А.',
      water: 'Подтверждение участия или руководства сплавами по порожистым рекам заявленной КС.',
      expedition: 'Документированный ценз многодневных автономных маршрутов и восхождений.',
    },
  },
  {
    id: 'sc-topography-navigation',
    orderLabel: '04',
    domain: 'experience',
    domainLabel: 'Опыт и топография',
    title: 'Ориентирование на местности, работа с топокартами, компасом и GPS-треками',
    requirementHint: 'Теория ВВГУ + практический полигон Шкотовского района',
    recommendedQuery: 'Шкотовский',
    trackNote: {
      hiking: 'Чтение рельефа, движение по азимуту в тайге и при ограниченной видимости.',
      water: 'Чтение лоции реки, привязка препятствий к карте и контроль точек схода.',
      expedition: 'Автономная навигация в бездорожье, расчёт перепадов высот и резервных ниток.',
    },
  },
  {
    id: 'sc-wilderness-first-aid',
    orderLabel: '05',
    domain: 'safety',
    domainLabel: 'Первая помощь и ДФО',
    title: 'Навыки расширенной первой помощи в автономии (Wilderness First Aid)',
    requirementHint: 'Стандарт WFA · Стабилизация пострадавшего до эвакуации',
    recommendedQuery: 'WFA и ООПТ',
    trackNote: {
      hiking: 'Иммобилизация травм, помощь при переохлаждении, укусах клещей и тепловом ударе.',
      water: 'Реанимация при утоплении, вывод из острой гипотермии и транспортировка с воды.',
      expedition: 'Протокол WFA при длительном ожидании ПСР, работа с групповой аптечкой.',
    },
  },
  {
    id: 'sc-dfo-comms-predators',
    orderLabel: '06',
    domain: 'safety',
    domainLabel: 'Первая помощь и ДФО',
    title: 'Работа со спутниковыми трекерами (Garmin inReach) и правила безопасности ДФО',
    requirementHint: 'Специфика ООПТ · Встреча с амурским тигром и бурым медведем',
    recommendedQuery: 'WFA и ООПТ',
    trackNote: {
      hiking: 'Подача сигнала SOS в МЧС без сотовой сети и алгоритмы поведения в ареале хищников.',
      water: 'Спутниковая связь на таёжных реках и выбор безопасных стоянок в поймах.',
      expedition: 'Регламент контрольных выходов на связь, радиообмен и меры охраны лагеря.',
    },
  },
  {
    id: 'sc-route-passport',
    orderLabel: '07',
    domain: 'methodology',
    domainLabel: 'Паспорт и управление',
    title: 'Умение подготовить и защитить паспорт туристского маршрута (форма № 760)',
    requirementHint: 'Обязательная часть этапа 02 в ВВГУ · ПП РФ № 760',
    recommendedQuery: 'паспорт маршрута',
    trackNote: {
      hiking: 'Расчёт темпа группы, оценка рисков, рекреационной нагрузки и согласование с ООПТ.',
      water: 'Лоция, график сплава, оценка паводковых уровней и аварийные выходы.',
      expedition: 'Детальный график автономии, запасные варианты маршрута и план ПСР.',
    },
  },
  {
    id: 'sc-group-rescue-management',
    orderLabel: '08',
    domain: 'methodology',
    domainLabel: 'Паспорт и управление',
    title: 'Управление группой в стрессовых ситуациях, переправы и основы ПСР',
    requirementHint: 'Полевые испытания РЦА · Снаряжение и страховка группы',
    recommendedQuery: 'пересдача',
    trackNote: {
      hiking: 'Организация навесных и бродных переправ, психология группы и снятие усталости.',
      water: 'Работа со спасконцом («морковкой»), страховка экипажей и спасработы на течении.',
      expedition: 'Руководство малой группой в ЧС, организация бивака и спасработ до прихода МЧС.',
    },
  },
];

export type SelfCheckAnswers = Partial<Record<string, QualificationAnswerLevel>>;

export interface StoredSelfCheckState {
  track: QualificationTrackId;
  answers: SelfCheckAnswers;
  updatedAt: string | null;
}

const STORAGE_KEY_PREFIX = 'rca_vostok_self_check_';

function isValidLevel(value: unknown): value is QualificationAnswerLevel {
  return value === 'confirmed' || value === 'in_progress' || value === 'missing';
}

function isValidTrack(value: unknown): value is QualificationTrackId {
  return value === 'hiking' || value === 'water' || value === 'expedition';
}

export function createEmptySelfCheckState(
  track: QualificationTrackId = 'hiking'
): StoredSelfCheckState {
  return { track, answers: {}, updatedAt: null };
}

export function sanitizeSelfCheckAnswers(raw: unknown): SelfCheckAnswers {
  if (!raw || typeof raw !== 'object') return {};
  const validIds = new Set(SELF_CHECK_QUESTIONS.map((q) => q.id));
  const result: SelfCheckAnswers = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (validIds.has(key) && isValidLevel(val)) {
      result[key] = val;
    }
  }
  return result;
}

export function readStoredSelfCheck(userId: string): StoredSelfCheckState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createEmptySelfCheckState();
  }
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (!raw) return createEmptySelfCheckState();
    const parsed = JSON.parse(raw) as Partial<StoredSelfCheckState>;
    return {
      track: isValidTrack(parsed.track) ? parsed.track : 'hiking',
      answers: sanitizeSelfCheckAnswers(parsed.answers),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    };
  } catch {
    return createEmptySelfCheckState();
  }
}

export function writeStoredSelfCheck(userId: string, state: StoredSelfCheckState): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function evaluateSelfCheck(
  answers: SelfCheckAnswers,
  track: QualificationTrackId = 'hiking'
): SelfCheckEvaluation {
  const totalQuestions = SELF_CHECK_QUESTIONS.length;
  const maxPoints = totalQuestions * 2;

  let confirmedCount = 0;
  let partialCount = 0;
  let missingCount = 0;
  let unansweredCount = 0;
  let earnedPoints = 0;

  const domainAccum: Record<SelfCheckDomainId, { earned: number; max: number }> = {
    documents: { earned: 0, max: 0 },
    experience: { earned: 0, max: 0 },
    safety: { earned: 0, max: 0 },
    methodology: { earned: 0, max: 0 },
  };

  const recommendations: SelfCheckRecommendation[] = [];

  for (const q of SELF_CHECK_QUESTIONS) {
    domainAccum[q.domain].max += 2;
    const ans = answers[q.id];
    if (!ans) {
      unansweredCount += 1;
      continue;
    }
    if (ans === 'confirmed') {
      confirmedCount += 1;
      earnedPoints += 2;
      domainAccum[q.domain].earned += 2;
    } else if (ans === 'in_progress') {
      partialCount += 1;
      earnedPoints += 1;
      domainAccum[q.domain].earned += 1;
      recommendations.push({
        questionId: q.id,
        title: q.title,
        domainLabel: q.domainLabel,
        severity: 'moderate',
        actionHint: q.trackNote[track],
        knowledgeQuery: q.recommendedQuery,
      });
    } else {
      missingCount += 1;
      recommendations.push({
        questionId: q.id,
        title: q.title,
        domainLabel: q.domainLabel,
        severity: 'critical',
        actionHint: q.trackNote[track],
        knowledgeQuery: q.recommendedQuery,
      });
    }
  }

  // Sort critical gaps before moderate ones
  recommendations.sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === 'critical' ? -1 : 1;
  });

  const answeredCount = totalQuestions - unansweredCount;
  const isComplete = answeredCount === totalQuestions;
  const readinessPercent = Math.round((earnedPoints / maxPoints) * 100);

  const rawStatusSlices: { id: string; name: string; value: number; color: string }[] = [
    { id: 'confirmed', name: 'Соответствует', value: confirmedCount, color: '#0f766e' },
    { id: 'in_progress', name: 'Частично / в работе', value: partialCount, color: '#d97706' },
    { id: 'missing', name: 'Требует подготовки', value: missingCount, color: '#dc2626' },
    { id: 'unanswered', name: 'Без ответа', value: unansweredCount, color: '#cbd5e1' },
  ];

  const statusPieData: PieSliceItem[] = rawStatusSlices
    .filter((s) => s.value > 0)
    .map((s) => ({
      ...s,
      percent: Math.round((s.value / totalQuestions) * 100),
      unitLabel: 'крит.',
    }));

  const domainOrder: SelfCheckDomainId[] = ['documents', 'experience', 'safety', 'methodology'];
  const domainBreakdown: DomainEvaluation[] = domainOrder.map((domainId) => {
    const { earned, max } = domainAccum[domainId];
    return {
      id: domainId,
      label: DOMAIN_META[domainId].label,
      earned,
      max,
      percent: max > 0 ? Math.round((earned / max) * 100) : 0,
      color: DOMAIN_META[domainId].color,
    };
  });

  const domainPieData: PieSliceItem[] = domainBreakdown
    .filter((d) => d.earned > 0)
    .map((d) => ({
      id: d.id,
      name: d.label,
      value: d.earned,
      percent: earnedPoints > 0 ? Math.round((d.earned / earnedPoints) * 100) : 0,
      color: d.color,
      unitLabel: 'бал.',
    }));

  // Verdict logic
  let verdictTier: SelfCheckVerdictTier;
  let verdictBadge: string;
  let verdictTitle: string;
  let verdictSummary: string;
  let recommendedContour: string;

  if (answeredCount === 0) {
    verdictTier = 'incomplete';
    verdictBadge = 'Ожидает заполнения';
    verdictTitle = 'Отметьте соответствие по 8 критериям квалификации';
    verdictSummary =
      'Выберите статус по каждому пункту слева. Круговая диаграмма и персональная рекомендация по контуру подготовки обновятся автоматически.';
    recommendedContour = 'Не определён';
  } else if (!isComplete) {
    verdictTier = 'incomplete';
    verdictBadge = `Предварительно · ${answeredCount}/${totalQuestions}`;
    verdictTitle = `Промежуточный индекс готовности: ${readinessPercent}%`;
    verdictSummary = `Заполнено ${answeredCount} из ${totalQuestions} пунктов. Ответьте на оставшиеся ${unansweredCount} вопроса(ов), чтобы зафиксировать итоговый вердикт комиссии и персональный план действий.`;
    recommendedContour =
      readinessPercent >= 50 ? 'Предварительно: Контур А / прямая подача' : 'Предварительно: ДПО ВВГУ';
  } else if (readinessPercent >= 80 && missingCount === 0) {
    verdictTier = 'ready';
    verdictBadge = `Высокое соответствие · ${readinessPercent}%`;
    verdictTitle = 'Базовые требования подтверждены — можно выходить на экзамен РЦА';
    verdictSummary =
      'У вас сформированы документы, подтверждён походный ценз и профильные компетенции безопасности ДФО. Рекомендуется проверка комплекта в чек-листе и запись на ближайшую сессию.';
    recommendedContour = 'Прямая аттестация РЦА / Контур А (без повторного обучения)';
  } else if (readinessPercent >= 50 && missingCount <= 2) {
    verdictTier = 'contour_a';
    verdictBadge = `Рекомендован Контур А · ${readinessPercent}%`;
    verdictTitle = 'Достаточная база — требуется точечное закрытие 1–2 блоков';
    verdictSummary =
      'Практическая основа присутствует, но отдельные документы, паспорт маршрута (форма № 760) или блок WFA требуют доработки. Оптимальный путь — модульный Контур А на базе ВВГУ.';
    recommendedContour = 'Контур А ВВГУ (зачёт стажа + добор недостающих модулей)';
  } else {
    verdictTier = 'training_needed';
    verdictBadge = `Требуется подготовка · ${readinessPercent}%`;
    verdictTitle = 'Рекомендована профильная переподготовка ДПО ВВГУ перед экзаменом';
    verdictSummary =
      'Выявлены существенные пробелы по документам, опыту или автономной безопасности. Прохождение программы переподготовки ВВГУ (пешеходный ≈ 250 ч или водный трек) закроет все экзаменационные блоки.';
    recommendedContour = 'Контур Б: полная переподготовка ДПО ВВГУ (до 70% субсидии для ЮЛ/ИП)';
  }

  return {
    track,
    answeredCount,
    totalQuestions,
    isComplete,
    earnedPoints,
    maxPoints,
    readinessPercent,
    confirmedCount,
    partialCount,
    missingCount,
    unansweredCount,
    statusPieData,
    domainBreakdown,
    domainPieData,
    verdictTier,
    verdictBadge,
    verdictTitle,
    verdictSummary,
    recommendedContour,
    recommendations,
  };
}
