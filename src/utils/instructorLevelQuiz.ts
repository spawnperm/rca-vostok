export type InstructorPrepTier = 'starter' | 'intermediate' | 'advanced';

export interface LevelQuizOption {
  id: string;
  label: string;
  points: number;
}

export interface LevelQuizQuestion {
  id: string;
  topic: string;
  prompt: string;
  options: readonly LevelQuizOption[];
}

export interface InstructorLevelRecommendation {
  totalPoints: number;
  maxPoints: number;
  answeredCount: number;
  totalQuestions: number;
  isComplete: boolean;
  tier: InstructorPrepTier;
  levelLabel: string;
  recommendedCategory: string;
  recommendedContour: string;
  recommendedTrack: string;
  summary: string;
  nextSteps: readonly string[];
}

export const INSTRUCTOR_LEVEL_QUESTIONS: readonly LevelQuizQuestion[] = [
  {
    id: 'lvl-exp',
    topic: 'Стаж ведения групп',
    prompt: 'Каков ваш практический опыт руководства туристскими группами на природных маршрутах?',
    options: [
      { id: 'a', label: 'Начинаю карьеру проводника (опыт до 1 года или участие туристом)', points: 1 },
      { id: 'b', label: 'Веду маршруты выходного дня и простые походы 1–3 года', points: 2 },
      { id: 'c', label: 'Системный опыт руководства сложными маршрутами более 3 лет', points: 3 },
    ],
  },
  {
    id: 'lvl-complexity',
    topic: 'Категория маршрутов',
    prompt: 'Какая максимальная сложность маршрутов преобладает в вашей практике или планах?',
    options: [
      { id: 'a', label: 'Экотропы, обзорные треки без категорирования и походы 1 КС', points: 1 },
      { id: 'b', label: 'Маршруты 1–2 категории сложности (горно-таёжные или водные)', points: 2 },
      { id: 'c', label: 'Автономные и экспедиционные маршруты 3–4 категории сложности', points: 3 },
    ],
  },
  {
    id: 'lvl-docs',
    topic: 'Подтверждение опыта и ДПО',
    prompt: 'Какие документы об образовании и туристском стаже у вас есть на руках?',
    options: [
      { id: 'a', label: 'Официальных маршрутных книжек и профильного ДПО пока нет', points: 1 },
      { id: 'b', label: 'Есть договоры с туроператором или отдельные справки о походах', points: 2 },
      { id: 'c', label: 'Есть маршрутные книжки / справки ФСТР или диплом ДПО', points: 3 },
    ],
  },
  {
    id: 'lvl-safety',
    topic: 'Первая помощь и ПСР',
    prompt: 'Как вы оцениваете свою подготовку по первой помощи (WFA) и спасработам?',
    options: [
      { id: 'a', label: 'Знаю базовую бытовую аптечку, требуется практика WFA и переправ', points: 1 },
      { id: 'b', label: 'Проходил базовый курс первой помощи, умею работать со страховкой', points: 2 },
      { id: 'c', label: 'Имею подготовку WFA/ПСР и опыт организации спасработ на рельефе/воде', points: 3 },
    ],
  },
  {
    id: 'lvl-passport',
    topic: 'Паспорт маршрута и НПА',
    prompt: 'Работали ли вы с паспортом маршрута (ПП РФ № 760) и уведомлениями МЧС / ООПТ?',
    options: [
      { id: 'a', label: 'Нет, с формой паспорта маршрута и регламентом ООПТ пока не знаком', points: 1 },
      { id: 'b', label: 'Регистрировал группы в МЧС, паспорт маршрута изучаю сейчас', points: 2 },
      { id: 'c', label: 'Регулярно оформляю паспорта маршрутов № 760 и разрешения ООПТ', points: 3 },
    ],
  },
];

export function evaluateInstructorLevel(
  answers: Readonly<Record<string, string>>
): InstructorLevelRecommendation {
  let totalPoints = 0;
  let answeredCount = 0;

  for (const question of INSTRUCTOR_LEVEL_QUESTIONS) {
    const selectedId = answers[question.id];
    const opt = question.options.find((o) => o.id === selectedId);
    if (opt) {
      totalPoints += opt.points;
      answeredCount += 1;
    }
  }

  const totalQuestions = INSTRUCTOR_LEVEL_QUESTIONS.length;
  const maxPoints = totalQuestions * 3;
  const isComplete = answeredCount === totalQuestions;

  // Normalize score when partially answered so preview stays meaningful,
  // while final verdict reflects total points.
  const effectiveRatio = answeredCount > 0 ? totalPoints / (answeredCount * 3) : 0;

  if (totalPoints >= 13 || (answeredCount >= 3 && effectiveRatio >= 0.85)) {
    return {
      totalPoints,
      maxPoints,
      answeredCount,
      totalQuestions,
      isComplete,
      tier: 'advanced',
      levelLabel: 'Продвинутый / Экспедиционный уровень',
      recommendedCategory: '3–4 категория сложности (повышенный допуск)',
      recommendedContour: 'Контур А (зачёт подтверждённого стажа без полного курса ДПО)',
      recommendedTrack: 'Переаттестация действующего гида',
      summary:
        'Ваш опыт и документальная база позволяют претендовать на аттестацию по маршрутам 3–4 КС в ускоренном порядке через верификацию стажа и защиту сложного паспорта маршрута.',
      nextSteps: [
        'Подготовьте маршрутные книжки, справки ФСТР или договоры туроператора для зачёта стажа.',
        'Оформите паспорт эталонного маршрута 3–4 КС с аварийными выходами и точками связи.',
        'Выберите ближайшую полевую сессию в Шкотовском районе или на реках Приморья.',
      ],
    };
  }

  if (totalPoints >= 9 || (answeredCount >= 3 && effectiveRatio >= 0.58)) {
    return {
      totalPoints,
      maxPoints,
      answeredCount,
      totalQuestions,
      isComplete,
      tier: 'intermediate',
      levelLabel: 'Базовый практик (уверенный уровень)',
      recommendedCategory: '1–2 категория сложности (базовый коммерческий допуск)',
      recommendedContour: 'Контур А (при наличии справок) или интенсив ВВГУ',
      recommendedTrack: 'Пешеходный туризм',
      summary:
        'Оптимальная целевая категория на старте — 1–2 КС. Она закрывает до 80% коммерческих туров ДФО и позволяет легально водить группы после сдачи теории и полевого экзамена.',
      nextSteps: [
        'Проверьте комплектность документов для зачёта стажа или запишитесь на интенсив по ПП № 760.',
        'Отработайте на практике протокол Wilderness First Aid (WFA) и организацию переправы.',
        'Подайте заявку на ближайшую сессию РЦА «Русский Восток» для включения в ЕФРТА.',
      ],
    };
  }

  return {
    totalPoints,
    maxPoints,
    answeredCount,
    totalQuestions,
    isComplete,
    tier: 'starter',
    levelLabel: 'Начальный уровень подготовки',
    recommendedCategory: '1 категория сложности (маршруты начального уровня)',
    recommendedContour: 'Контур Б (программа ДПО ВВГУ ≈ 250 ч + итоговая аттестация)',
    recommendedTrack: 'Пешеходный туризм',
    summary:
      'Целесообразно начать с 1 категории сложности через программу ДПО в ВВГУ: вы системно освоите паспортизацию маршрута, первую помощь и полевую тактику перед экзаменом.',
    nextSteps: [
      'Запишитесь на программу ДПО ВВГУ (для туроператоров Приморья действует субсидия до 70%).',
      'Изучите базу знаний РЦА по оформлению медсправки-допуска и паспорта маршрута № 760.',
      'Пройдите тренировочные билеты самодиагностики перед выходом на полигон.',
    ],
  };
}
