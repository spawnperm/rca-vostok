import {
  ATTESTATION_FAQ,
  GLOSSARY_TERMS,
  type FaqItem,
  type GlossaryTerm,
} from '../data/researchData.ts';

export type KnowledgeSearchScope = 'all' | 'faq' | 'materials' | 'glossary';
export type FaqCategoryFilter = 'all' | FaqItem['category'];
export type FaqTopicFilter = 'all' | 'attestation' | 'requirements' | 'documents';

export interface MethodologicalMaterial {
  id: string;
  code: string;
  categoryLabel: string;
  title: string;
  summary: string;
  normRef: string;
  readingTime: string;
  keyPoints: string[];
  tags: string[];
  relatedFaqIds: string[];
  actionLabel: string;
  actionType: 'checklist' | 'consultant' | 'tab';
  targetTab?: 'overview' | 'calculator' | 'dissertation' | 'presentations';
}

export interface EnrichedFaqItem extends FaqItem {
  topicGroup: Exclude<FaqTopicFilter, 'all'>;
  topicGroupLabel: string;
  quickHighlight: string;
  tags: string[];
  relatedMaterialIds: string[];
}

export interface AccountKnowledgeSearchResult {
  faqItems: EnrichedFaqItem[];
  materials: MethodologicalMaterial[];
  glossaryItems: GlossaryTerm[];
  totalCount: number;
  activeTokens: string[];
}

export const METHODOLOGICAL_MATERIALS: readonly MethodologicalMaterial[] = [
  {
    id: 'method-npa-1893',
    code: 'МЕТОД-01',
    categoryLabel: 'Нормативная база РФ',
    title: 'Памятка по ПП РФ № 1003 и № 1893: правила допуска, реестр и сроки',
    summary:
      'Разбор обязательных требований к инструкторам-проводникам после 1 марта и 1 октября 2026 года, порядок проверки записи в Едином федеральном реестре Минэкономразвития и продление 5-летнего удостоверения.',
    normRef: 'ФЗ № 132-ФЗ · ПП РФ № 1003 (ред. № 1893)',
    readingTime: '6 мин',
    keyPoints: [
      'Сопровождение групп на маршрутах повышенного риска допускается только при действующей записи в Едином федеральном реестре и наличии нагрудной карточки-бейджа.',
      'Срок действия аттестации — 5 лет; запись действует на всей территории РФ независимо от региона сдачи экзамена.',
      'Проверка заявки занимает 1–3 рабочих дня, экзаменационная сессия длится 2–3 дня, выгрузка сведений и выпуск бейджа — до 10 рабочих дней.',
    ],
    tags: ['ПП № 1893', 'ПП № 1003', 'реестр', 'бейдж', '5 лет', 'сроки'],
    relatedFaqIds: ['faq-1', 'faq-6', 'faq-12', 'faq-15'],
    actionLabel: 'Уточнить у онлайн-консультанта',
    actionType: 'consultant',
  },
  {
    id: 'method-route-passport',
    code: 'МЕТОД-02',
    categoryLabel: 'Методика экзамена ВВГУ',
    title: 'Методика разработки и защиты паспорта туристского маршрута (форма № 760)',
    summary:
      'Пошаговое руководство для второго этапа аттестации в ВВГУ: структура нитки маршрута, нормирование таймингов, оценка рисков, расчёт рекреационной ёмкости и аварийные точки эвакуации.',
    normRef: 'Постановление Правительства РФ № 760 · Этап 02',
    readingTime: '9 мин',
    keyPoints: [
      'Обязательные разделы паспорта: картографическая нитка, график прохождения с темпом группы, контрольные точки связи и запасные выходы при ЧС.',
      'Для маршрутов Приморья и ДФО требуется указать паводковые сценарии, расчёт допустимой нагрузки и порядок согласования с администрацией ООПТ.',
      'На очной защите в ВВГУ комиссия проверяет умение аргументировать решения при смене погоды и травме участника.',
    ],
    tags: ['паспорт маршрута', '760', 'ООПТ', 'защита', 'тайминги', 'ЧС'],
    relatedFaqIds: ['faq-3', 'faq-7', 'faq-14'],
    actionLabel: 'Открыть чек-лист документов',
    actionType: 'checklist',
  },
  {
    id: 'method-contour-a',
    code: 'МЕТОД-03',
    categoryLabel: 'Зачёт походного стажа',
    title: 'Регламент Контура А: верификация практического опыта без записей МКК',
    summary:
      'Инструкция для действующих гидов с многолетней практикой: какие документы заменяют классические маршрутные книжки, как проходит модульное обучение без отрыва от сезона и снижается риск несдачи.',
    normRef: 'Двухконтурная модель ВВГУ / ФСТР · Контур А',
    readingTime: '5 мин',
    keyPoints: [
      'К рассмотрению принимаются справки ФСТР, договоры с туроператорами, подтверждённые коммерческие выходы, GPS-треки маршрутов и рекомендации профильных организаций ДФО.',
      'Модульный формат Контура А позволяет зачесть подтверждённую практику и сфокусироваться на правовом блоке, первой помощи и паспорте маршрута.',
      'Исключает дублирующее обучение: учебные зачёты ВВГУ синхронизированы с экзаменационными билетами РЦА.',
    ],
    tags: ['Контур А', 'МКК', 'походный стаж', 'треки', 'туроператор', 'опыт'],
    relatedFaqIds: ['faq-4', 'faq-10', 'faq-13'],
    actionLabel: 'Перейти к чек-листу Контура А',
    actionType: 'checklist',
  },
  {
    id: 'method-dpo-programs',
    code: 'МЕТОД-04',
    categoryLabel: 'Программы ДПО и субсидии',
    title: 'Конспект программ ДПО ВВГУ: пешеходный (250 ч), водный (27 200 ₽) и компенсация 70%',
    summary:
      'Сводный справочник по длительности модулей, договорным местам на водный туризм, проектируемому автотреку и механизму возмещения затрат юридическим лицам и ИП Приморского края.',
    normRef: 'ФЗ № 273-ФЗ · Лицензия ДПО ВВГУ',
    readingTime: '7 мин',
    keyPoints: [
      'Пешеходный туризм: базовая профессиональная переподготовка ≈ 250 часов с подготовкой к защите маршрута.',
      'Водный туризм и сплавы: открыто 10 договорных мест на поток стоимостью 27 200 ₽/год (гидрология, переправы, спасработы).',
      'Организации и ИП Приморского края могут компенсировать до 70% расходов через региональные программы субсидирования туризма.',
    ],
    tags: ['ВВГУ', 'ДПО', '250 часов', '27 200', 'водный', 'субсидия 70%'],
    relatedFaqIds: ['faq-5', 'faq-8', 'faq-13'],
    actionLabel: 'Рассчитать бюджет в калькуляторе',
    actionType: 'tab',
    targetTab: 'calculator',
  },
  {
    id: 'method-dfo-wfa-safety',
    code: 'МЕТОД-05',
    categoryLabel: 'Специфика и полигоны ДФО',
    title: 'Полевой практикум: Wilderness First Aid, Garmin inReach и безопасность на ООПТ',
    summary:
      'Методические требования к третьему этапу экзамена на полигонах Шкотовского района и реках края: алгоритмы автономной помощи, спутниковая связь и встреча с крупными хищниками.',
    normRef: 'Регламент полигонов ДФО · WFA / ООПТ',
    readingTime: '8 мин',
    keyPoints: [
      'Wilderness First Aid (WFA): стабилизация пострадавшего при переохлаждении, травмах конечностей и длительном ожидании эвакуации.',
      'Спутниковый трекинг: передача координат SOS через Garmin inReach, ведение контрольных выходов на связь с МЧС.',
      'Профилактика и алгоритм действий группы при встрече с амурским тигром и бурым медведем на маршрутах Сихотэ-Алиня и нацпарка «Бикин».',
    ],
    tags: ['WFA', 'Garmin inReach', 'ООПТ', 'Шкотовский', 'хищники', 'полигон'],
    relatedFaqIds: ['faq-3', 'faq-7'],
    actionLabel: 'Задать вопрос по полевому этапу',
    actionType: 'consultant',
  },
  {
    id: 'method-retake-dossier',
    code: 'МЕТОД-06',
    categoryLabel: 'Досье и пересдача',
    title: 'Состав пакета документов соискателя и порядок раздельной пересдачи этапов',
    summary:
      'Контрольная инструкция по формированию личного дела в РЦА «Русский Восток» (паспорт, СНИЛС, медзаключение, согласие ПДн) и правила повторной сдачи при незачёте теории или поля.',
    normRef: 'ФЗ № 152-ФЗ · Регламент комиссии РЦА',
    readingTime: '4 мин',
    keyPoints: [
      'Базовое досье: заявление, паспорт РФ, СНИЛС, диплом об образовании / ДПО ВВГУ, медсправка об отсутствии противопоказаний, стаж 1–4 КС, согласие на обработку ПДн.',
      'Комиссия фиксирует результаты теоретического теста в ВВГУ и полевого этапа раздельно.',
      'При зачёте теории пересдавать требуется только полевой блок на ближайшей выездной сессии в Шкотовском районе.',
    ],
    tags: ['документы', 'СНИЛС', 'медсправка', 'пересдача', 'ПДн', 'пакет'],
    relatedFaqIds: ['faq-9', 'faq-11', 'faq-14'],
    actionLabel: 'Проверить свой чек-лист',
    actionType: 'checklist',
  },
  {
    id: 'method-vac-presentations',
    code: 'МЕТОД-07',
    categoryLabel: 'Научная и аналитическая база',
    title: 'Методология оценки кадрового дефицита ДФО и презентационные материалы ВАК 5.2.3',
    summary:
      'Обобщённые расчётные формулы потребности в гидах Приморского края (1 200–2 390 чел. при 122 в реестре), сравнение с международным стандартом IFMGA и раздаточные материалы.',
    normRef: 'ВАК 5.2.3 · Прогноз 2026–2030 гг.',
    readingTime: '10 мин',
    keyPoints: [
      'Сравнительный анализ кадрового разрыва Приморья, Хабаровского края и Камчатки на фоне турпотока 4,07 млн поездок.',
      'Готовые слайд-модули (18 слайдов для совета ВАК и 10 слайдов для Минтуризма) доступны в разделе презентаций платформы.',
    ],
    tags: ['ВАК 5.2.3', 'IFMGA', 'презентации', 'дефицит', 'методология'],
    relatedFaqIds: ['faq-2', 'faq-8'],
    actionLabel: 'Открыть раздел «Диссертация»',
    actionType: 'tab',
    targetTab: 'dissertation',
  },
];

const CABINET_EXTRA_FAQS: readonly FaqItem[] = [
  {
    id: 'faq-13',
    category: 'training',
    categoryLabel: 'Квалификационные требования',
    question:
      'Какие квалификационные требования по образованию, здоровью и стажу предъявляются к соискателю?',
    answer:
      'Кандидат должен быть совершеннолетним гражданином РФ, иметь среднее профессиональное или высшее образование (либо пройти программу переподготовки ДПО, например в ВВГУ ≈ 250 часов), медицинское заключение об отсутствии противопоказаний к активным маршрутам и подтверждённый опыт прохождения/руководства маршрутами от 1 до 4 категории сложности в зависимости от заявляемого трека.',
  },
  {
    id: 'faq-14',
    category: 'procedure',
    categoryLabel: 'Подача документов',
    question:
      'Как подать документы в РЦА и что делать, если комиссия выявила замечания в паспорте маршрута?',
    answer:
      'Заявка подаётся онлайн через форму записи или в личном кабинете с приложением скан-копий (паспорт, СНИЛС, диплом/удостоверение ДПО, медсправка, подтверждение стажа и проект паспорта маршрута по форме ПП № 760). Секретариат проверяет комплект за 1–3 рабочих дня; при замечаниях заявка не аннулируется — вы получаете перечень правок в разделе «Мои заявки» и можете дослать исправленные материалы до начала ближайшей сессии.',
  },
  {
    id: 'faq-15',
    category: 'procedure',
    categoryLabel: 'Аттестация',
    question:
      'Как продлить аттестацию через 5 лет или добавить новую категорию сложности маршрута?',
    answer:
      'За 60 дней до окончания 5-летнего срока действия записи в Едином федеральном реестре необходимо подать заявление на подтверждение квалификации и обновить медицинское заключение. Чтобы повысить категорию сложности (например, с 2 КС на 3 КС) или открыть второй вид туризма (водный после пешеходного), повторно проходить общий правовой блок не требуется — защищается новый паспорт маршрута и профильная практика.',
  },
];

const TOPIC_GROUP_LABELS: Record<Exclude<FaqTopicFilter, 'all'>, string> = {
  attestation: 'Аттестация',
  requirements: 'Квалификационные требования',
  documents: 'Подача документов',
};

const FAQ_ENRICHMENT: Record<
  string,
  {
    topicGroup: Exclude<FaqTopicFilter, 'all'>;
    quickHighlight: string;
    tags: string[];
    relatedMaterialIds: string[];
  }
> = {
  'faq-1': {
    topicGroup: 'attestation',
    quickHighlight: 'Обязательно с 1 марта / 1 октября 2026 г. (ПП № 1003 и № 1893)',
    tags: ['ПП № 1893', 'ПП № 1003', 'сроки', 'реестр', 'аттестация'],
    relatedMaterialIds: ['method-npa-1893'],
  },
  'faq-2': {
    topicGroup: 'attestation',
    quickHighlight: 'Владивосток, ВВГУ + ФСТР · председатель Г. Гомилевская, рук. Г. Саранча',
    tags: ['ВВГУ', 'комиссия', 'Владивосток', 'ФСТР', 'аттестация'],
    relatedMaterialIds: ['method-npa-1893', 'method-vac-presentations'],
  },
  'faq-3': {
    topicGroup: 'attestation',
    quickHighlight: '4 шага: заявка → теория/паспорт в ВВГУ → полигон (Шкотовский р-н) → бейдж',
    tags: ['этапы', 'паспорт маршрута', 'Шкотовский', 'экзамен', 'аттестация'],
    relatedMaterialIds: ['method-route-passport', 'method-dfo-wfa-safety'],
  },
  'faq-4': {
    topicGroup: 'requirements',
    quickHighlight: 'Опытным гидам — Контур А: зачёт подтверждённого стажа без дублирования',
    tags: ['Контур А', 'опыт', 'переподготовка', 'квалификация'],
    relatedMaterialIds: ['method-contour-a'],
  },
  'faq-5': {
    topicGroup: 'requirements',
    quickHighlight: 'Пешеходный ≈ 250 ч · Водный 27 200 ₽/год · субсидия ДФО до 70%',
    tags: ['стоимость', '27 200 ₽', '250 часов', 'субсидия', 'ДПО'],
    relatedMaterialIds: ['method-dpo-programs'],
  },
  'faq-6': {
    topicGroup: 'attestation',
    quickHighlight: 'Срок действия 5 лет · действует по всей территории России',
    tags: ['5 лет', 'реестр', 'регионы РФ', 'аттестация'],
    relatedMaterialIds: ['method-npa-1893'],
  },
  'faq-7': {
    topicGroup: 'requirements',
    quickHighlight: 'Wilderness First Aid · Garmin inReach · ПСР и безопасность от хищников на ООПТ',
    tags: ['WFA', 'Garmin inReach', 'ООПТ', 'ДФО', 'требования'],
    relatedMaterialIds: ['method-dfo-wfa-safety', 'method-route-passport'],
  },
  'faq-8': {
    topicGroup: 'requirements',
    quickHighlight: 'Работают пешеходный и водный треки; проектируется автотуризм',
    tags: ['направления', 'водный', 'пешеходный', 'автотрек', 'квалификация'],
    relatedMaterialIds: ['method-dpo-programs', 'method-vac-presentations'],
  },
  'faq-9': {
    topicGroup: 'documents',
    quickHighlight: 'Паспорт, СНИЛС, образование/ДПО, медсправка, стаж, согласие ПДн',
    tags: ['документы', 'подача документов', 'пакет', 'СНИЛС', 'медсправка'],
    relatedMaterialIds: ['method-retake-dossier'],
  },
  'faq-10': {
    topicGroup: 'documents',
    quickHighlight: 'Допускаются договоры с туроператорами, GPS-треки и рекомендации через Контур А',
    tags: ['МКК', 'Контур А', 'стаж', 'треки', 'подача документов'],
    relatedMaterialIds: ['method-contour-a'],
  },
  'faq-11': {
    topicGroup: 'attestation',
    quickHighlight: 'Теория засчитывается отдельно — пересдаётся только не сданный блок',
    tags: ['пересдача', 'теория', 'поле', 'экзамен'],
    relatedMaterialIds: ['method-retake-dossier'],
  },
  'faq-12': {
    topicGroup: 'documents',
    quickHighlight: 'Проверка 1–3 дня · экзамен 2–3 дня · запись и бейдж до 10 рабочих дней',
    tags: ['сроки', 'бейдж', 'регистрация', 'подача документов'],
    relatedMaterialIds: ['method-npa-1893', 'method-retake-dossier'],
  },
  'faq-13': {
    topicGroup: 'requirements',
    quickHighlight: 'Образование/ДПО ВВГУ 250 ч · медзаключение · стаж по маршрутам 1–4 КС',
    tags: ['квалификационные требования', 'квалификация', 'образование', 'стаж', '1-4 КС'],
    relatedMaterialIds: ['method-contour-a', 'method-dpo-programs'],
  },
  'faq-14': {
    topicGroup: 'documents',
    quickHighlight: 'Подача онлайн · проверка 1–3 дня · замечания исправляются без повторной оплаты',
    tags: ['подача документов', 'онлайн', 'замечания', 'паспорт маршрута', '760'],
    relatedMaterialIds: ['method-retake-dossier', 'method-route-passport'],
  },
  'faq-15': {
    topicGroup: 'attestation',
    quickHighlight: 'Заявление за 60 дней до окончания 5-летнего срока · зачёт общей теории',
    tags: ['продление', '5 лет', 'повышение КС', 'аттестация'],
    relatedMaterialIds: ['method-npa-1893'],
  },
};

export const ENRICHED_ATTESTATION_FAQ: readonly EnrichedFaqItem[] = [
  ...ATTESTATION_FAQ,
  ...CABINET_EXTRA_FAQS,
].map((item) => {
  const meta = FAQ_ENRICHMENT[item.id] ?? {
    topicGroup: 'attestation' as const,
    quickHighlight: item.categoryLabel,
    tags: [],
    relatedMaterialIds: [],
  };
  return {
    ...item,
    topicGroup: meta.topicGroup,
    topicGroupLabel: TOPIC_GROUP_LABELS[meta.topicGroup],
    quickHighlight: meta.quickHighlight,
    tags: meta.tags,
    relatedMaterialIds: meta.relatedMaterialIds,
  };
});

export const KNOWLEDGE_QUICK_QUERIES: readonly string[] = [
  'подача документов',
  'квалификация',
  'Контур А',
  'паспорт маршрута',
  'ПП № 1893',
  '27 200 ₽',
  'пересдача',
];

function tokenizeQuery(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function scoreMatch(tokens: string[], primaryText: string, secondaryText: string): number {
  if (tokens.length === 0) return 1;
  const primary = primaryText.toLowerCase();
  const combined = `${primary} ${secondaryText.toLowerCase()}`;
  for (const token of tokens) {
    if (!combined.includes(token)) {
      return 0;
    }
  }
  let score = 1;
  for (const token of tokens) {
    if (primary.includes(token)) score += 3;
  }
  return score;
}

export function searchAccountKnowledgeBase(options: {
  query?: string;
  scope?: KnowledgeSearchScope;
  faqCategory?: FaqCategoryFilter;
  faqTopic?: FaqTopicFilter;
}): AccountKnowledgeSearchResult {
  const scope = options.scope ?? 'all';
  const faqCategory = options.faqCategory ?? 'all';
  const faqTopic = options.faqTopic ?? 'all';
  const activeTokens = tokenizeQuery(options.query ?? '');

  const faqItems: EnrichedFaqItem[] =
    scope === 'all' || scope === 'faq'
      ? ENRICHED_ATTESTATION_FAQ.map((item) => {
          if (faqCategory !== 'all' && item.category !== faqCategory) {
            return null;
          }
          if (faqTopic !== 'all' && item.topicGroup !== faqTopic) {
            return null;
          }
          const score = scoreMatch(
            activeTokens,
            `${item.question} ${item.quickHighlight} ${item.topicGroupLabel} ${item.tags.join(' ')}`,
            `${item.answer} ${item.categoryLabel}`
          );
          return score > 0 ? { item, score } : null;
        })
          .filter((entry): entry is { item: EnrichedFaqItem; score: number } => entry !== null)
          .sort((a, b) => b.score - a.score)
          .map((entry) => entry.item)
      : [];

  const materials: MethodologicalMaterial[] =
    scope === 'all' || scope === 'materials'
      ? METHODOLOGICAL_MATERIALS.map((mat) => {
          const score = scoreMatch(
            activeTokens,
            `${mat.title} ${mat.code} ${mat.normRef} ${mat.tags.join(' ')}`,
            `${mat.summary} ${mat.categoryLabel} ${mat.keyPoints.join(' ')}`
          );
          return score > 0 ? { item: mat, score } : null;
        })
          .filter(
            (entry): entry is { item: MethodologicalMaterial; score: number } => entry !== null
          )
          .sort((a, b) => b.score - a.score)
          .map((entry) => entry.item)
      : [];

  const glossaryItems: GlossaryTerm[] =
    scope === 'all' || scope === 'glossary'
      ? GLOSSARY_TERMS.map((term) => {
          const score = scoreMatch(
            activeTokens,
            `${term.term} ${term.shortTag}`,
            `${term.definition} ${term.contextNote} ${term.categoryLabel}`
          );
          return score > 0 ? { item: term, score } : null;
        })
          .filter((entry): entry is { item: GlossaryTerm; score: number } => entry !== null)
          .sort((a, b) => b.score - a.score)
          .map((entry) => entry.item)
      : [];

  return {
    faqItems,
    materials,
    glossaryItems,
    totalCount: faqItems.length + materials.length + glossaryItems.length,
    activeTokens,
  };
}

export function getMaterialById(id: string): MethodologicalMaterial | undefined {
  return METHODOLOGICAL_MATERIALS.find((m) => m.id === id);
}
