export type GuideEntryLevelId = 'novice' | 'experienced' | 'specialist';
export type GuideDisciplineId = 'hiking' | 'water' | 'expedition';
export type GuideComplexityId = '1_ks' | '2_ks' | '3_ks' | '4_ks';

export type RoadmapNodeId =
  | 'start_profile'
  | 'track_dpo'
  | 'track_stazh'
  | 'mod_npa_safety'
  | 'mod_field_practice'
  | 'mod_route_passport'
  | 'dossier_gate'
  | 'exam_theory'
  | 'exam_field'
  | 'certified_efrta';

export type GraphNodeVisualState = 'completed' | 'active' | 'upcoming' | 'optional';

export interface GuideEntryLevelMeta {
  id: GuideEntryLevelId;
  label: string;
  shortLabel: string;
  contourCode: string;
  contourTitle: string;
  description: string;
}

export interface GuideDisciplineMeta {
  id: GuideDisciplineId;
  label: string;
  shortLabel: string;
  fieldFocus: string;
  extraDays: number;
  extraHours: number;
}

export interface GuideComplexityMeta {
  id: GuideComplexityId;
  code: string;
  label: string;
  hoursMultiplier: number;
  daysMultiplier: number;
  routeExample: string;
}

export interface RoadmapChecklistTask {
  id: string;
  label: string;
  hint: string;
}

export interface RoadmapNodeActionLink {
  kind: 'exam' | 'library' | 'certification';
  label: string;
}

export interface RoadmapGraphNode {
  id: RoadmapNodeId;
  code: string;
  tier: number;
  x: number;
  y: number;
  width: number;
  height: number;
  titleLines: [string, string];
  shortTitle: string;
  fullTitle: string;
  roleTag: string;
  durationDays: number;
  studyHours: number;
  summary: string;
  deliverable: string;
  prerequisites: RoadmapNodeId[];
  nextNodes: RoadmapNodeId[];
  tasks: RoadmapChecklistTask[];
  includedInTrack: boolean;
  trackRelationLabel: string;
  state: GraphNodeVisualState;
  stateLabel: string;
  completedTasksCount: number;
  actionLink?: RoadmapNodeActionLink;
}

export interface RoadmapGraphEdge {
  id: string;
  from: RoadmapNodeId;
  to: RoadmapNodeId;
  pathD: string;
  activeInTrack: boolean;
  traversed: boolean;
  label?: string;
}

export interface GuideLearningRoadmapInput {
  entryLevel: GuideEntryLevelId;
  discipline: GuideDisciplineId;
  complexity: GuideComplexityId;
  completedNodeIds?: ReadonlySet<RoadmapNodeId> | readonly RoadmapNodeId[];
  completedTaskIds?: ReadonlySet<string> | readonly string[];
  selectedNodeId?: RoadmapNodeId | null;
}

export interface GuideLearningRoadmapGraphModel {
  input: {
    entryLevel: GuideEntryLevelId;
    discipline: GuideDisciplineId;
    complexity: GuideComplexityId;
  };
  levelMeta: GuideEntryLevelMeta;
  disciplineMeta: GuideDisciplineMeta;
  complexityMeta: GuideComplexityMeta;
  nodes: RoadmapGraphNode[];
  edges: RoadmapGraphEdge[];
  orderedTrackNodeIds: RoadmapNodeId[];
  activeNodeId: RoadmapNodeId;
  selectedNodeId: RoadmapNodeId;
  totalTrackNodes: number;
  completedTrackNodes: number;
  progressPercent: number;
  totalHours: number;
  totalDays: number;
  estimatedWeeks: number;
  canvasWidth: number;
  canvasHeight: number;
}

export const GRAPH_CANVAS_WIDTH = 1180;
export const GRAPH_CANVAS_HEIGHT = 460;
const NODE_WIDTH = 160;
const NODE_HEIGHT = 86;

export const GUIDE_ENTRY_LEVELS: readonly GuideEntryLevelMeta[] = [
  {
    id: 'novice',
    label: 'Новичок (с нуля)',
    shortLabel: 'Новичок',
    contourCode: 'Контур Б',
    contourTitle: 'Контур Б · ДПО ВВГУ 250 ч',
    description:
      'Полный образовательный маршрут через профессиональную переподготовку ВВГУ, базовую практику, WFA и очный полигон.',
  },
  {
    id: 'experienced',
    label: 'Опытный турист (1–2 КС)',
    shortLabel: 'Опытный турист',
    contourCode: 'Комби-трек',
    contourTitle: 'Комбинированный трек · ДПО + зачёт стажа МКК',
    description:
      'Сочетает подтверждение походов 1–2 КС через МКК и целевые модули ДПО по ПП № 1893, паспортизации и первой помощи.',
  },
  {
    id: 'specialist',
    label: 'Действующий гид (3+ КС)',
    shortLabel: 'Специалист',
    contourCode: 'Контур А',
    contourTitle: 'Контур А · Верификация стажа и аттестация',
    description:
      'Ускоренный трек без полного 250-часового курса ДПО: зачёт руководства походами, обновление НПА, защита паспорта и экзамен.',
  },
] as const;

export const GUIDE_DISCIPLINES: readonly GuideDisciplineMeta[] = [
  {
    id: 'hiking',
    label: 'Пешеходный и горный туризм',
    shortLabel: 'Пешеходный / горный',
    fieldFocus: 'ориентирование, работа на склоне, переправа маятником и поиск пострадавшего',
    extraDays: 0,
    extraHours: 0,
  },
  {
    id: 'water',
    label: 'Водный туризм и сплавы',
    shortLabel: 'Водный / сплавы',
    fieldFocus: 'чтение порогов, спасработы «морковкой» и постановка кильнутого судна',
    extraDays: 4,
    extraHours: 14,
  },
  {
    id: 'expedition',
    label: 'Экспедиционный и ООПТ ДФО',
    shortLabel: 'Экспедиции / ООПТ',
    fieldFocus: 'режим кордонов ООПТ, спутниковая связь InReach/Иридиум и эвакуация в автономии',
    extraDays: 6,
    extraHours: 20,
  },
] as const;

export const GUIDE_COMPLEXITIES: readonly GuideComplexityMeta[] = [
  {
    id: '1_ks',
    code: '1 КС',
    label: '1 КС · Базовый',
    hoursMultiplier: 0.9,
    daysMultiplier: 0.85,
    routeExample: 'Ливадийский хребет, о. Путятина, экотропы Приморья',
  },
  {
    id: '2_ks',
    code: '2 КС',
    label: '2 КС · Средний',
    hoursMultiplier: 1.0,
    daysMultiplier: 1.0,
    routeExample: 'Пик Снежный, р. Шкотовка, Авачинский перевал (1А–1Б)',
  },
  {
    id: '3_ks',
    code: '3 КС',
    label: '3 КС · Повышенный',
    hoursMultiplier: 1.15,
    daysMultiplier: 1.2,
    routeExample: 'Верховья р. Бикин, вулканы Камчатки (2А), сплавы Сахалина',
  },
  {
    id: '4_ks',
    code: '4 КС',
    label: '4 КС · Экспедиционный',
    hoursMultiplier: 1.3,
    daysMultiplier: 1.4,
    routeExample: 'Сихотэ-Алинь (4 КС), Курильская гряда, ледники Ключевской группы',
  },
] as const;

interface NodeLayoutSpec {
  id: RoadmapNodeId;
  code: string;
  tier: number;
  x: number;
  y: number;
  prerequisites: RoadmapNodeId[];
  nextNodes: RoadmapNodeId[];
}

const NODE_LAYOUTS: readonly NodeLayoutSpec[] = [
  {
    id: 'start_profile',
    code: '01',
    tier: 1,
    x: 16,
    y: 187,
    prerequisites: [],
    nextNodes: ['track_dpo', 'track_stazh'],
  },
  {
    id: 'track_dpo',
    code: '02А',
    tier: 2,
    x: 214,
    y: 74,
    prerequisites: ['start_profile'],
    nextNodes: ['mod_npa_safety', 'mod_field_practice', 'mod_route_passport'],
  },
  {
    id: 'track_stazh',
    code: '02Б',
    tier: 2,
    x: 214,
    y: 300,
    prerequisites: ['start_profile'],
    nextNodes: ['mod_npa_safety', 'mod_field_practice', 'mod_route_passport'],
  },
  {
    id: 'mod_npa_safety',
    code: '03',
    tier: 3,
    x: 412,
    y: 32,
    prerequisites: ['track_dpo', 'track_stazh'],
    nextNodes: ['dossier_gate'],
  },
  {
    id: 'mod_field_practice',
    code: '04',
    tier: 3,
    x: 412,
    y: 187,
    prerequisites: ['track_dpo', 'track_stazh'],
    nextNodes: ['dossier_gate'],
  },
  {
    id: 'mod_route_passport',
    code: '05',
    tier: 3,
    x: 412,
    y: 342,
    prerequisites: ['track_dpo', 'track_stazh'],
    nextNodes: ['dossier_gate'],
  },
  {
    id: 'dossier_gate',
    code: '06',
    tier: 4,
    x: 610,
    y: 187,
    prerequisites: ['mod_npa_safety', 'mod_field_practice', 'mod_route_passport'],
    nextNodes: ['exam_theory', 'exam_field'],
  },
  {
    id: 'exam_theory',
    code: '07А',
    tier: 5,
    x: 808,
    y: 74,
    prerequisites: ['dossier_gate'],
    nextNodes: ['certified_efrta'],
  },
  {
    id: 'exam_field',
    code: '07Б',
    tier: 5,
    x: 808,
    y: 300,
    prerequisites: ['dossier_gate'],
    nextNodes: ['certified_efrta'],
  },
  {
    id: 'certified_efrta',
    code: '08',
    tier: 6,
    x: 1004,
    y: 187,
    prerequisites: ['exam_theory', 'exam_field'],
    nextNodes: [],
  },
] as const;

const EDGE_DEFINITIONS: readonly { from: RoadmapNodeId; to: RoadmapNodeId; label?: string }[] = [
  { from: 'start_profile', to: 'track_dpo', label: 'ДПО' },
  { from: 'start_profile', to: 'track_stazh', label: 'Стаж' },
  { from: 'track_dpo', to: 'mod_npa_safety' },
  { from: 'track_dpo', to: 'mod_field_practice' },
  { from: 'track_dpo', to: 'mod_route_passport' },
  { from: 'track_stazh', to: 'mod_npa_safety' },
  { from: 'track_stazh', to: 'mod_field_practice' },
  { from: 'track_stazh', to: 'mod_route_passport' },
  { from: 'mod_npa_safety', to: 'dossier_gate' },
  { from: 'mod_field_practice', to: 'dossier_gate' },
  { from: 'mod_route_passport', to: 'dossier_gate' },
  { from: 'dossier_gate', to: 'exam_theory', label: 'Теория' },
  { from: 'dossier_gate', to: 'exam_field', label: 'Полигон' },
  { from: 'exam_theory', to: 'certified_efrta' },
  { from: 'exam_field', to: 'certified_efrta' },
] as const;

export function getOrderedTrackNodeIds(entryLevel: GuideEntryLevelId): RoadmapNodeId[] {
  switch (entryLevel) {
    case 'novice':
      return [
        'start_profile',
        'track_dpo',
        'mod_npa_safety',
        'mod_field_practice',
        'mod_route_passport',
        'dossier_gate',
        'exam_theory',
        'exam_field',
        'certified_efrta',
      ];
    case 'experienced':
      return [
        'start_profile',
        'track_dpo',
        'track_stazh',
        'mod_npa_safety',
        'mod_field_practice',
        'mod_route_passport',
        'dossier_gate',
        'exam_theory',
        'exam_field',
        'certified_efrta',
      ];
    case 'specialist':
      return [
        'start_profile',
        'track_stazh',
        'mod_npa_safety',
        'mod_field_practice',
        'mod_route_passport',
        'dossier_gate',
        'exam_theory',
        'exam_field',
        'certified_efrta',
      ];
  }
}

function buildBezierEdgePath(fromNode: NodeLayoutSpec, toNode: NodeLayoutSpec): string {
  const startX = fromNode.x + NODE_WIDTH;
  const startY = fromNode.y + NODE_HEIGHT / 2;
  const endX = toNode.x;
  const endY = toNode.y + NODE_HEIGHT / 2;
  const dx = Math.max(24, (endX - startX) * 0.55);
  return `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;
}

function scaleRounded(base: number, multiplier: number, min: number): number {
  return Math.max(min, Math.round(base * multiplier));
}

function buildNodeContent(
  id: RoadmapNodeId,
  level: GuideEntryLevelMeta,
  discipline: GuideDisciplineMeta,
  complexity: GuideComplexityMeta
): {
  titleLines: [string, string];
  shortTitle: string;
  fullTitle: string;
  roleTag: string;
  durationDays: number;
  studyHours: number;
  summary: string;
  deliverable: string;
  tasks: RoadmapChecklistTask[];
  includedInTrack: boolean;
  trackRelationLabel: string;
  actionLink?: RoadmapNodeActionLink;
} {
  const isNovice = level.id === 'novice';
  const isSpecialist = level.id === 'specialist';
  const isExperienced = level.id === 'experienced';

  switch (id) {
    case 'start_profile':
      return {
        titleLines: ['Входная диагностика', 'и выбор трека'],
        shortTitle: 'Вход и диагностика',
        fullTitle: 'Входная диагностика, медосмотр и выбор трека',
        roleTag: 'Точка входа',
        durationDays: scaleRounded(3, complexity.daysMultiplier, 2),
        studyHours: 4,
        summary: `Определение исходного стажа под категорию ${complexity.code} (${discipline.shortLabel}), проверка базовых требований приказа Минздрава и выбор образовательного контура.`,
        deliverable: 'Профиль соискателя, медзаключение и зафиксированный маршрут подготовки',
        tasks: [
          {
            id: `${id}:1`,
            label: 'Определить целевую категорию и вид туризма',
            hint: `Выбрано: ${discipline.shortLabel} · ${complexity.code}`,
          },
          {
            id: `${id}:2`,
            label: 'Пройти медицинский осмотр без противопоказаний',
            hint: 'Справка для работы на активных маршрутах',
          },
          {
            id: `${id}:3`,
            label: 'Собрать СНИЛС, документ об образовании и фото 3×4',
            hint: 'Базовый комплект для регистрации в РЦА',
          },
        ],
        includedInTrack: true,
        trackRelationLabel: 'Старт для всех уровней',
      };

    case 'track_dpo':
      return {
        titleLines: [
          isExperienced ? 'Модульное ДПО ВВГУ' : 'Программа ДПО ВВГУ',
          isExperienced ? 'добор часов теории' : 'переподготовка 250 ч',
        ],
        shortTitle: isExperienced ? 'Модульное ДПО ВВГУ' : 'Курс ДПО ВВГУ (250 ч)',
        fullTitle: isExperienced
          ? 'Целевые модули ДПО ВВГУ (добор теории и педагогика группы)'
          : 'Профессиональная переподготовка в ДПО ВВГУ (Контур Б · 250 часов)',
        roleTag: 'Контур Б · Обучение',
        durationDays: isNovice
          ? scaleRounded(21, complexity.daysMultiplier, 14)
          : isExperienced
            ? scaleRounded(10, complexity.daysMultiplier, 7)
            : 0,
        studyHours: isNovice
          ? scaleRounded(140, complexity.hoursMultiplier, 110)
          : isExperienced
            ? scaleRounded(64, complexity.hoursMultiplier, 48)
            : 0,
        summary: isNovice
          ? 'Системная теоретическая подготовка с нуля на кафедре туризма и гостеприимства ВВГУ: основы рекреации, психология группы и методика сопровождения.'
          : isExperienced
            ? 'Сокращённый блок переподготовки для туристов с опытом 1–2 КС: закрытие пробелов по стандарту профессии и методике ведения групп.'
            : 'Полный курс ДПО не требуется при подтверждённом руководстве походами 3+ КС и профильном стаже.',
        deliverable: isSpecialist
          ? 'Ветка пропущена — зачтено по подтверждённому стажу (Контур А)'
          : 'Диплом/удостоверение ДПО ВВГУ и допуск к модульному зачёту',
        tasks: [
          {
            id: `${id}:1`,
            label: 'Записаться на поток ДПО ВВГУ (очно-дистанционный формат)',
            hint: 'Дистанционная теория доступна для всех субъектов ДФО',
          },
          {
            id: `${id}:2`,
            label: 'Пройти лекции по тактике ведения и педагогике группы',
            hint: 'Возрастные особенности, темп и распределение нагрузки',
          },
          {
            id: `${id}:3`,
            label: 'Сдать промежуточный модульный зачёт ВВГУ',
            hint: 'Необходим для допуска к следующему блоку',
          },
        ],
        includedInTrack: !isSpecialist,
        trackRelationLabel: isNovice
          ? 'Основная ветка новичка'
          : isExperienced
            ? 'Сокращённый блок ДПО'
            : 'Альтернатива (зачтено)',
        actionLink: {
          kind: 'library',
          label: 'Методические материалы и НПА',
        },
      };

    case 'track_stazh':
      return {
        titleLines: ['Верификация стажа', 'справки МКК и походы'],
        shortTitle: 'Зачёт стажа МКК',
        fullTitle: 'Верификация походного стажа и справок МКК (Контур А)',
        roleTag: 'Контур А · Опыт',
        durationDays: isNovice
          ? 0
          : scaleRounded(isSpecialist ? 6 : 7, complexity.daysMultiplier, 4),
        studyHours: isNovice ? 0 : scaleRounded(isSpecialist ? 18 : 22, complexity.hoursMultiplier, 12),
        summary: isNovice
          ? 'Ветка подтверждения походного опыта для кандидатов со справками МКК и маршрутными книжками (для новичка без стажа неактивна).'
          : `Аудит справок о зачтённых походах, маршрутных книжек, записей трудовой книжки и подтверждений руководства под категорию ${complexity.code}.`,
        deliverable: isNovice
          ? 'Ветка альтернативная — заменяется курсом ДПО ВВГУ'
          : `Верифицированное досье походного опыта под ${complexity.code}`,
        tasks: [
          {
            id: `${id}:1`,
            label: 'Собрать справки МКК / выписки о руководстве и участии',
            hint: 'Сверка категорийности и ниток маршрутов',
          },
          {
            id: `${id}:2`,
            label: 'Подготовить подтверждения стажа от турфирмы или ФСТР',
            hint: 'Договоры, маршрутные листы или трудовая книжка',
          },
          {
            id: `${id}:3`,
            label: 'Пройти предварительную проверку стажа куратором РЦА',
            hint: 'Исключает возврат заявки перед очной комиссией',
          },
        ],
        includedInTrack: !isNovice,
        trackRelationLabel: isNovice
          ? 'Для кандидатов со стажем'
          : isSpecialist
            ? 'Основная ветка специалиста'
            : 'Подтверждение опыта 1–2 КС',
      };

    case 'mod_npa_safety':
      return {
        titleLines: ['Право, НПА и WFA', '132-ФЗ · ПП № 1893'],
        shortTitle: 'НПА и первая помощь',
        fullTitle: 'Нормативная база (132-ФЗ, ПП № 1893) и первая помощь (WFA)',
        roleTag: 'Модуль теории',
        durationDays: scaleRounded(isSpecialist ? 5 : 9, complexity.daysMultiplier, 4) + Math.floor(discipline.extraDays / 3),
        studyHours:
          scaleRounded(isSpecialist ? 24 : 48, complexity.hoursMultiplier, 18) +
          Math.floor(discipline.extraHours / 3),
        summary:
          'Изучение актуальных требований 132-ФЗ, Постановлений Правительства № 1003 и № 1893, правил уведомления МЧС за 10 дней и отработка протоколов первой помощи в автономии (WFA).',
        deliverable: 'Пробный тест теории ≥ 85% и практический зачёт по оказанию первой помощи',
        tasks: [
          {
            id: `${id}:1`,
            label: 'Изучить 132-ФЗ, ПП № 1003, ПП № 1893 и сроки уведомления МЧС',
            hint: 'Включая правила работы на территориях ООПТ',
          },
          {
            id: `${id}:2`,
            label: 'Отработать протокол первой помощи в автономии (WFA)',
            hint: 'Гипотермия, травмы, иммобилизация, сортировка группы',
          },
          {
            id: `${id}:3`,
            label: 'Прорешать тренировочные билеты ФСТР на порог ≥ 85%',
            hint: 'Рекомендуется пройти минимум 2 полных прогона',
          },
        ],
        includedInTrack: true,
        trackRelationLabel: isSpecialist ? 'Обновление НПА + WFA' : 'Обязательный модуль',
        actionLink: {
          kind: 'exam',
          label: 'Открыть тренажёр ФСТР',
        },
      };

    case 'mod_field_practice':
      return {
        titleLines: ['Полевая практика', discipline.shortLabel],
        shortTitle: 'Полевая практика',
        fullTitle: `Полевая практика и спасработы (${discipline.shortLabel})`,
        roleTag: 'Полигон и техника',
        durationDays:
          scaleRounded(isSpecialist ? 5 : 10, complexity.daysMultiplier, 4) + discipline.extraDays,
        studyHours:
          scaleRounded(isSpecialist ? 28 : 54, complexity.hoursMultiplier, 20) + discipline.extraHours,
        summary: `Практическая подготовка на учебном полигоне и выездных сборах: ${discipline.fieldFocus}. Адаптация нормативов под сложность ${complexity.code}.`,
        deliverable: `Отработанные приёмы ПСР и полевой чек-лист (${complexity.code})`,
        tasks: [
          {
            id: `${id}:1`,
            label: `Отработать профильные приёмы: ${discipline.fieldFocus}`,
            hint: `Уровень сложности: ${complexity.code}`,
          },
          {
            id: `${id}:2`,
            label: 'Провести учебные спасработы и транспортировку пострадавшего',
            hint: 'Работа с верёвками, средствами связи и тактикой малой группы',
          },
          {
            id: `${id}:3`,
            label: 'Сформировать личный и групповой комплект снаряжения',
            hint: 'Контроль весовых и страховочных норм',
          },
        ],
        includedInTrack: true,
        trackRelationLabel: isSpecialist ? 'Отработка стандарта РЦА' : 'Очная полевая практика',
      };

    case 'mod_route_passport':
      return {
        titleLines: ['Паспорт маршрута', 'форма ПП № 760'],
        shortTitle: 'Паспорт № 760',
        fullTitle: `Разработка и расчёт паспорта маршрута (ПП № 760 · ${complexity.code})`,
        roleTag: 'Документация',
        durationDays:
          scaleRounded(isSpecialist ? 4 : 7, complexity.daysMultiplier, 3) + Math.ceil(discipline.extraDays / 3),
        studyHours: scaleRounded(isSpecialist ? 18 : 30, complexity.hoursMultiplier, 14),
        summary: `Подготовка эталонного паспорта туристского маршрута (пример для ДФО: ${complexity.routeExample}) с матрицей рисков, точками контроля и аварийными выходами при ЧС.`,
        deliverable: `Утверждённый к защите паспорт маршрута ${complexity.code} (форма ПП № 760)`,
        tasks: [
          {
            id: `${id}:1`,
            label: 'Оформить нитку маршрута, профиль высот и график прохождения КП',
            hint: `Ориентир ДФО: ${complexity.routeExample}`,
          },
          {
            id: `${id}:2`,
            label: 'Заполнить матрицу рисков, запасные выходы и план связи',
            hint: 'Координаты МЧС, кордонов ООПТ и контрольных сроков',
          },
          {
            id: `${id}:3`,
            label: 'Пройти предпроверку паспорта с куратором или методистом',
            hint: 'Исключает замечания при устной защите на экзамене',
          },
        ],
        includedInTrack: true,
        trackRelationLabel: 'Обязательно к защите',
        actionLink: {
          kind: 'library',
          label: 'Шаблоны и литература',
        },
      };

    case 'dossier_gate':
      return {
        titleLines: ['Подача досье', 'и допуск в РЦА'],
        shortTitle: 'Досье и допуск',
        fullTitle: 'Подача электронного досье и бронирование сессии РЦА',
        roleTag: 'Контрольная точка',
        durationDays: 4,
        studyHours: 6,
        summary:
          'Подача заявления через Госуслуги / портал ФСТР не позднее чем за 10 календарных дней до начала сессии, оплата госпошлины и подтверждение допуска комиссией РЦА «Русский Восток».',
        deliverable: 'Официальное уведомление о допуске и слот в графике комиссий',
        tasks: [
          {
            id: `${id}:1`,
            label: 'Загрузить заявление, медсправку, документы об обучении/стаже',
            hint: 'Подача минимум за 10 дней до выбранной даты экзамена',
          },
          {
            id: `${id}:2`,
            label: 'Оплатить государственную пошлину за внесение в реестр',
            hint: 'Реквизиты формируются при подаче заявления',
          },
          {
            id: `${id}:3`,
            label: 'Получить подтверждение допуска и памятку участника сессии',
            hint: 'Проверка места проведения (кампус ВВГУ и полигон)',
          },
        ],
        includedInTrack: true,
        trackRelationLabel: 'Обязательный шлюз',
        actionLink: {
          kind: 'certification',
          label: 'График сессий 2027',
        },
      };

    case 'exam_theory':
      return {
        titleLines: ['Очный экзамен', 'тест и паспорт № 760'],
        shortTitle: 'Теория и защита',
        fullTitle: 'Очное тестирование ФСТР и защита паспорта маршрута',
        roleTag: 'Экзамен · День 1',
        durationDays: 1,
        studyHours: 8,
        summary:
          'Компьютерное тестирование по экзаменационным билетам перед комиссией на базе кампуса ВВГУ (порог ≥ 75%) и устная защита паспорта маршрута № 760 с разбором нештатных сценариев.',
        deliverable: 'Зачёт по теоретическому модулю и утверждённая защита паспорта',
        tasks: [
          {
            id: `${id}:1`,
            label: 'Пройти очное тестирование по билетам (порог сдачи ≥ 75%)',
            hint: 'Вопросы по 132-ФЗ, ПП № 1893, тактике и первой помощи',
          },
          {
            id: `${id}:2`,
            label: 'Защитить паспорт маршрута перед экспертами комиссии',
            hint: 'Обоснование контрольных сроков, мер безопасности и эвакуации',
          },
        ],
        includedInTrack: true,
        trackRelationLabel: 'Обязательный этап экзамена',
        actionLink: {
          kind: 'exam',
          label: 'Потренировать билеты',
        },
      };

    case 'exam_field':
      return {
        titleLines: ['Полевой экзамен', 'полигон и ПСР'],
        shortTitle: 'Полевой зачёт',
        fullTitle: `Полевой практический экзамен (${discipline.shortLabel})`,
        roleTag: 'Экзамен · Дни 2–3',
        durationDays: 2,
        studyHours: 16,
        summary: `Выездная проверка практических компетенций на Шкотовском полигоне или региональной площадке ДФО: ${discipline.fieldFocus}, ориентирование и действия группы при ЧС.`,
        deliverable: 'Положительный оценочный лист полевых экспертов ФСТР',
        tasks: [
          {
            id: `${id}:1`,
            label: 'Продемонстрировать технические приёмы по профилю на полигоне',
            hint: `Категория ${complexity.code} · ${discipline.shortLabel}`,
          },
          {
            id: `${id}:2`,
            label: 'Выполнить вводную задачу по поиску и спасению пострадавшего',
            hint: 'Оценка лидерства, безопасности страховки и первой помощи',
          },
        ],
        includedInTrack: true,
        trackRelationLabel: 'Обязательный полевой этап',
        actionLink: {
          kind: 'certification',
          label: 'Площадки ДФО на карте',
        },
      };

    case 'certified_efrta':
      return {
        titleLines: ['Аттестованный гид', 'реестр ЕФРТА · 5 лет'],
        shortTitle: 'Реестр ЕФРТА',
        fullTitle: 'Утверждение протокола, внесение в ЕФРТА и выдача нагрудного бейджа',
        roleTag: 'Итог · Статус 5 лет',
        durationDays: 5,
        studyHours: 2,
        summary:
          'Подписание протокола аттестационной комиссии РЦА «Русский Восток», передача сведений в Единый федеральный реестр инструкторов-проводников (Минэкономразвития) и выдача нагрудной карточки.',
        deliverable: `Действующий статус инструктора-проводника (${complexity.code}) сроком на 5 лет`,
        tasks: [
          {
            id: `${id}:1`,
            label: 'Проверить публикацию записи в федеральном реестре ЕФРТА',
            hint: 'Уникальный реестровый номер действует 5 лет',
          },
          {
            id: `${id}:2`,
            label: 'Получить свидетельство об аттестации и нагрудный бейдж',
            hint: 'Даёт законное право сопровождать туристов на маршрутах',
          },
        ],
        includedInTrack: true,
        trackRelationLabel: 'Целевой результат',
        actionLink: {
          kind: 'certification',
          label: 'Открыть реестр ДФО',
        },
      };
  }
}

export function buildGuideLearningRoadmapGraph(
  rawInput: GuideLearningRoadmapInput
): GuideLearningRoadmapGraphModel {
  const levelMeta =
    GUIDE_ENTRY_LEVELS.find((item) => item.id === rawInput.entryLevel) ?? GUIDE_ENTRY_LEVELS[0];
  const disciplineMeta =
    GUIDE_DISCIPLINES.find((item) => item.id === rawInput.discipline) ?? GUIDE_DISCIPLINES[0];
  const complexityMeta =
    GUIDE_COMPLEXITIES.find((item) => item.id === rawInput.complexity) ?? GUIDE_COMPLEXITIES[1];

  const completedNodesSet = new Set<RoadmapNodeId>(rawInput.completedNodeIds ?? []);
  const completedTasksSet = new Set<string>(rawInput.completedTaskIds ?? []);
  const orderedTrackNodeIds = getOrderedTrackNodeIds(levelMeta.id);
  const trackSet = new Set<RoadmapNodeId>(orderedTrackNodeIds);

  const layoutMap = new Map<RoadmapNodeId, NodeLayoutSpec>(
    NODE_LAYOUTS.map((layout) => [layout.id, layout])
  );

  // Determine which track nodes are completed (either explicitly marked or all tasks completed)
  const rawNodesDraft = NODE_LAYOUTS.map((layout) => {
    const content = buildNodeContent(layout.id, levelMeta, disciplineMeta, complexityMeta);
    const completedTasksCount = content.tasks.filter((t) => completedTasksSet.has(t.id)).length;
    const isCompleted =
      content.includedInTrack &&
      (completedNodesSet.has(layout.id) ||
        (content.tasks.length > 0 && completedTasksCount === content.tasks.length));
    return { layout, content, completedTasksCount, isCompleted };
  });

  const resolvedCompletedSet = new Set<RoadmapNodeId>(
    rawNodesDraft.filter((item) => item.isCompleted).map((item) => item.layout.id)
  );

  const firstUncompletedId =
    orderedTrackNodeIds.find((nodeId) => !resolvedCompletedSet.has(nodeId)) ?? 'certified_efrta';

  const nodes: RoadmapGraphNode[] = rawNodesDraft.map(
    ({ layout, content, completedTasksCount, isCompleted }) => {
      let state: GraphNodeVisualState;
      let stateLabel: string;

      if (!content.includedInTrack) {
        state = 'optional';
        stateLabel = levelMeta.id === 'specialist' ? 'Зачтено' : 'Альтернатива';
      } else if (isCompleted) {
        state = 'completed';
        stateLabel = 'Пройден';
      } else if (layout.id === firstUncompletedId) {
        state = 'active';
        stateLabel = 'Текущий фокус';
      } else {
        state = 'upcoming';
        stateLabel = 'В маршруте';
      }

      return {
        id: layout.id,
        code: layout.code,
        tier: layout.tier,
        x: layout.x,
        y: layout.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        titleLines: content.titleLines,
        shortTitle: content.shortTitle,
        fullTitle: content.fullTitle,
        roleTag: content.roleTag,
        durationDays: content.durationDays,
        studyHours: content.studyHours,
        summary: content.summary,
        deliverable: content.deliverable,
        prerequisites: layout.prerequisites,
        nextNodes: layout.nextNodes,
        tasks: content.tasks,
        includedInTrack: content.includedInTrack,
        trackRelationLabel: content.trackRelationLabel,
        state,
        stateLabel,
        completedTasksCount,
        actionLink: content.actionLink,
      };
    }
  );

  const edges: RoadmapGraphEdge[] = EDGE_DEFINITIONS.map((edge) => {
    const fromSpec = layoutMap.get(edge.from)!;
    const toSpec = layoutMap.get(edge.to)!;
    const activeInTrack = trackSet.has(edge.from) && trackSet.has(edge.to);
    const traversed = activeInTrack && resolvedCompletedSet.has(edge.from);
    return {
      id: `${edge.from}->${edge.to}`,
      from: edge.from,
      to: edge.to,
      pathD: buildBezierEdgePath(fromSpec, toSpec),
      activeInTrack,
      traversed,
      label: edge.label,
    };
  });

  const trackNodes = nodes.filter((n) => n.includedInTrack);
  const totalTrackNodes = trackNodes.length;
  const completedTrackNodes = trackNodes.filter((n) => n.state === 'completed').length;
  const progressPercent =
    totalTrackNodes > 0 ? Math.round((completedTrackNodes / totalTrackNodes) * 100) : 0;

  const totalHours = trackNodes.reduce((sum, node) => sum + node.studyHours, 0);
  // Parallel modules in tier 3 (npa/field/passport) and tier 5 (exam_theory/exam_field) run concurrently within their tier.
  const tierMaxDays = new Map<number, number>();
  for (const node of trackNodes) {
    const prev = tierMaxDays.get(node.tier) ?? 0;
    if (node.durationDays > prev) {
      tierMaxDays.set(node.tier, node.durationDays);
    }
  }
  const totalDays = Array.from(tierMaxDays.values()).reduce((sum, d) => sum + d, 0);
  const estimatedWeeks = Number((totalDays / 7).toFixed(1));

  const selectedNodeId =
    rawInput.selectedNodeId && layoutMap.has(rawInput.selectedNodeId)
      ? rawInput.selectedNodeId
      : firstUncompletedId;

  return {
    input: {
      entryLevel: levelMeta.id,
      discipline: disciplineMeta.id,
      complexity: complexityMeta.id,
    },
    levelMeta,
    disciplineMeta,
    complexityMeta,
    nodes,
    edges,
    orderedTrackNodeIds,
    activeNodeId: firstUncompletedId,
    selectedNodeId,
    totalTrackNodes,
    completedTrackNodes,
    progressPercent,
    totalHours,
    totalDays,
    estimatedWeeks,
    canvasWidth: GRAPH_CANVAS_WIDTH,
    canvasHeight: GRAPH_CANVAS_HEIGHT,
  };
}
