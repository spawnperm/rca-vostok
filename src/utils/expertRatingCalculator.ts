export type ExpertCourseId =
  | 'dpo_vvsu'
  | 'wfa_first_aid'
  | 'fstr_rescue'
  | 'dfo_predator';

export interface ExpertCourseOption {
  id: ExpertCourseId;
  title: string;
  provider: string;
  hoursLabel: string;
  points: number;
  description: string;
}

export const EXPERT_COURSES: readonly ExpertCourseOption[] = [
  {
    id: 'dpo_vvsu',
    title: 'ДПО ВВГУ «Инструктор-проводник»',
    provider: 'ИТКИ ВВГУ · г. Владивосток',
    hoursLabel: '250 ч',
    points: 13,
    description:
      'Базовая профессиональная переподготовка, правовой блок ФЗ № 132-ФЗ и защита паспорта маршрута.',
  },
  {
    id: 'wfa_first_aid',
    title: 'Первая помощь в автономных условиях (WFA)',
    provider: 'Медицинский модуль РЦА',
    hoursLabel: '36 ч',
    points: 9,
    description:
      'Оказание помощи при травмах, переохлаждении, укусах и транспортировка пострадавшего до приезда ПСР.',
  },
  {
    id: 'fstr_rescue',
    title: 'Спасработы, переправы и топография ФСТР',
    provider: 'Полигон Шкотовского района',
    hoursLabel: '48 ч',
    points: 8,
    description:
      'Наведение навесных переправ, работа со страховочными системами и ориентирование в таёжном рельефе.',
  },
  {
    id: 'dfo_predator',
    title: 'Протокол безопасности ДФО (ООПТ и хищники)',
    provider: 'Методический стандарт РЦА «Русский Восток»',
    hoursLabel: '16 ч',
    points: 5,
    description:
      'Правила поведения при встрече с бурым/гималайским медведем и амурским тигром, спутниковая связь в ООПТ.',
  },
];

export interface ExpertRatingInput {
  experienceYears: number;
  ledGroupsCount: number;
  completedCourses: ExpertCourseId[];
  hikes1Ks: number;
  hikes2Ks: number;
  hikes3Ks: number;
  hikes4Ks: number;
}

export interface QualificationLevel {
  level: number;
  code: string;
  title: string;
  shortTitle: string;
  minScore: number;
  maxScore: number;
  summary: string;
}

export const QUALIFICATION_LEVELS: readonly QualificationLevel[] = [
  {
    level: 1,
    code: 'Уровень 1',
    title: 'Стажёр активного туризма',
    shortTitle: 'Стажёр',
    minScore: 0,
    maxScore: 24,
    summary:
      'Начальный этап подготовки: рекомендуется обучение по ДПО ВВГУ и набор подтверждённого опыта на маршрутах 1 КС.',
  },
  {
    level: 2,
    code: 'Уровень 2',
    title: 'Проводник базовых маршрутов (1–2 КС)',
    shortTitle: 'Проводник 1–2 КС',
    minScore: 25,
    maxScore: 49,
    summary:
      'Достаточная база для первичной аттестации по массовым пешим и экологическим маршрутам Приморья и ООПТ.',
  },
  {
    level: 3,
    code: 'Уровень 3',
    title: 'Аттестованный инструктор ДФО (Контур А)',
    shortTitle: 'Инструктор ДФО',
    minScore: 50,
    maxScore: 74,
    summary:
      'Уверенный профиль практика: возможен зачёт подтверждённого стажа по Контуру А и допуск к маршрутам 2–3 КС.',
  },
  {
    level: 4,
    code: 'Уровень 4',
    title: 'Старший гид-эксперт экспедиций (3–4 КС)',
    shortTitle: 'Гид-эксперт 3–4 КС',
    minScore: 75,
    maxScore: 89,
    summary:
      'Высокая квалификация для руководства автономными группами на Камчатке, Сахалине, в Якутии и сложных полигонах ДФО.',
  },
  {
    level: 5,
    code: 'Уровень 5',
    title: 'Эксперт-наставник и кандидат в комиссию РЦА',
    shortTitle: 'Эксперт-наставник',
    minScore: 90,
    maxScore: 100,
    summary:
      'Высший квалификационный уровень: право наставничества, методического аудита паспортов маршрутов и работы в комиссии.',
  },
];

export interface ExpertRatingResult {
  totalScore: number;
  experiencePoints: number;
  maxExperiencePoints: number;
  coursesPoints: number;
  maxCoursesPoints: number;
  complexityPoints: number;
  maxComplexityPoints: number;
  currentLevel: QualificationLevel;
  nextLevel: QualificationLevel | null;
  levelProgressPercent: number;
  pointsToNextLevel: number;
  highestComplexityLabel: string;
}

export interface ExpertAdviceItem {
  id: string;
  title: string;
  priorityLabel: 'Высокий приоритет' | 'Рекомендуется' | 'Точка роста';
  potentialGainLabel: string;
  expertName: string;
  expertRole: string;
  summary: string;
  actionSteps: string[];
  normRef: string;
}

export const EXPERT_RATING_PRESETS: readonly {
  id: string;
  label: string;
  description: string;
  input: ExpertRatingInput;
}[] = [
  {
    id: 'starter',
    label: 'Начинающий гид',
    description: '1 год стажа, старт подготовки к 1 КС',
    input: {
      experienceYears: 1,
      ledGroupsCount: 3,
      completedCourses: ['dfo_predator'],
      hikes1Ks: 2,
      hikes2Ks: 0,
      hikes3Ks: 0,
      hikes4Ks: 0,
    },
  },
  {
    id: 'practitioner',
    label: 'Практик ДФО (2–3 КС)',
    description: '5 лет стажа, маршруты 2–3 КС и WFA',
    input: {
      experienceYears: 5,
      ledGroupsCount: 18,
      completedCourses: ['dpo_vvsu', 'wfa_first_aid'],
      hikes1Ks: 4,
      hikes2Ks: 3,
      hikes3Ks: 1,
      hikes4Ks: 0,
    },
  },
  {
    id: 'senior',
    label: 'Экспедиционный лидер',
    description: '10+ лет стажа, полный комплект курсов и 4 КС',
    input: {
      experienceYears: 11,
      ledGroupsCount: 42,
      completedCourses: ['dpo_vvsu', 'wfa_first_aid', 'fstr_rescue', 'dfo_predator'],
      hikes1Ks: 6,
      hikes2Ks: 5,
      hikes3Ks: 4,
      hikes4Ks: 2,
    },
  },
];

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function sanitizeExpertRatingInput(raw: ExpertRatingInput): ExpertRatingInput {
  const validCourseIds = new Set(EXPERT_COURSES.map((c) => c.id));
  const uniqueCourses = Array.from(new Set(raw.completedCourses)).filter((id) =>
    validCourseIds.has(id)
  );

  return {
    experienceYears: clampInt(raw.experienceYears, 0, 20),
    ledGroupsCount: clampInt(raw.ledGroupsCount, 0, 60),
    completedCourses: uniqueCourses,
    hikes1Ks: clampInt(raw.hikes1Ks, 0, 15),
    hikes2Ks: clampInt(raw.hikes2Ks, 0, 12),
    hikes3Ks: clampInt(raw.hikes3Ks, 0, 10),
    hikes4Ks: clampInt(raw.hikes4Ks, 0, 6),
  };
}

export function calculateExpertRating(rawInput: ExpertRatingInput): ExpertRatingResult {
  const input = sanitizeExpertRatingInput(rawInput);

  // 1. Experience score (max 30 points): up to 20 pts from years + up to 10 pts from led groups
  const yearsScore = Math.min(20, input.experienceYears * 1.5);
  const groupsScore = Math.min(10, input.ledGroupsCount * 0.25);
  const experiencePoints = Math.min(30, Math.round(yearsScore + groupsScore));

  // 2. Completed accredited courses score (max 35 points)
  const selectedCourseSet = new Set(input.completedCourses);
  const coursesPoints = Math.min(
    35,
    EXPERT_COURSES.reduce(
      (sum, course) => (selectedCourseSet.has(course.id) ? sum + course.points : sum),
      0
    )
  );

  // 3. Hike complexity categories score (max 35 points)
  const rawComplexity =
    input.hikes1Ks * 1.5 +
    input.hikes2Ks * 3 +
    input.hikes3Ks * 5.5 +
    input.hikes4Ks * 8;
  const complexityPoints = Math.min(35, Math.round(rawComplexity));

  const totalScore = Math.min(100, experiencePoints + coursesPoints + complexityPoints);

  const currentIdx = QUALIFICATION_LEVELS.findIndex(
    (lvl) => totalScore >= lvl.minScore && totalScore <= lvl.maxScore
  );
  const resolvedIdx = currentIdx === -1 ? QUALIFICATION_LEVELS.length - 1 : currentIdx;
  const currentLevel = QUALIFICATION_LEVELS[resolvedIdx];
  const nextLevel =
    resolvedIdx < QUALIFICATION_LEVELS.length - 1
      ? QUALIFICATION_LEVELS[resolvedIdx + 1]
      : null;

  let levelProgressPercent = 100;
  let pointsToNextLevel = 0;

  if (nextLevel) {
    const span = Math.max(1, nextLevel.minScore - currentLevel.minScore);
    const gainedInLevel = Math.max(0, totalScore - currentLevel.minScore);
    levelProgressPercent = Math.min(99, Math.max(0, Math.round((gainedInLevel / span) * 100)));
    pointsToNextLevel = Math.max(1, nextLevel.minScore - totalScore);
  }

  let highestComplexityLabel = 'Без категорированных походов';
  if (input.hikes4Ks > 0) highestComplexityLabel = '4 КС (экспедиционный)';
  else if (input.hikes3Ks > 0) highestComplexityLabel = '3 КС (повышенная автономность)';
  else if (input.hikes2Ks > 0) highestComplexityLabel = '2 КС (базовый категорированный)';
  else if (input.hikes1Ks > 0) highestComplexityLabel = '1 КС (начальный туристский)';

  return {
    totalScore,
    experiencePoints,
    maxExperiencePoints: 30,
    coursesPoints,
    maxCoursesPoints: 35,
    complexityPoints,
    maxComplexityPoints: 35,
    currentLevel,
    nextLevel,
    levelProgressPercent,
    pointsToNextLevel,
    highestComplexityLabel,
  };
}

export function buildDynamicExpertTips(
  rawInput: ExpertRatingInput,
  result: ExpertRatingResult
): ExpertAdviceItem[] {
  const input = sanitizeExpertRatingInput(rawInput);
  const selectedCourses = new Set(input.completedCourses);
  const tips: ExpertAdviceItem[] = [];

  // 1. Tier-specific strategic advice tailored to current Expert Rating
  if (result.totalScore < 25) {
    tips.push({
      id: 'tier-foundation',
      title: 'Сформируйте базовый профиль для допуска к аттестации 1 КС',
      priorityLabel: 'Высокий приоритет',
      potentialGainLabel: result.nextLevel
        ? `До уровня «${result.nextLevel.shortTitle}» осталось ${result.pointsToNextLevel} б.`
        : 'Старт карьеры',
      expertName: 'Галина Гомилевская',
      expertRole: 'Председатель аттестационной комиссии · директор ИТКИ ВВГУ',
      summary:
        'При текущем рейтинге ниже 25 баллов оптимальный путь — закрыть теоретический фундамент через ДПО ВВГУ и зафиксировать первые 2–3 маршрута 1 КС в маршрутных книжках.',
      actionSteps: [
        'Запишитесь на поток ДПО ВВГУ (250 ч, 27 200 ₽) — он даёт +13 баллов и снимает риск отказа по отсутствию профильного образования.',
        'Оформите документальное подтверждение выходов: маршрутные листы клуба или справки туроператора.',
        'Подготовьте черновик паспорта маршрута 1 КС с контрольными точками связи и схемой эвакуации.',
      ],
      normRef: 'ФЗ № 132-ФЗ · Программа ВВГУ 250 ч',
    });
  } else if (result.totalScore < 50) {
    tips.push({
      id: 'tier-basic-to-contour-a',
      title: 'Подготовьте переход от базового допуска к Контуру А (50+ баллов)',
      priorityLabel: 'Высокий приоритет',
      potentialGainLabel: `До уровня «${result.nextLevel?.shortTitle ?? 'Инструктор ДФО'}» +${result.pointsToNextLevel} б.`,
      expertName: 'Григорий Саранча',
      expertRole: 'Руководитель РЦА «Русский Восток»',
      summary:
        'Вы уже готовы к первичной аттестации на базовые маршруты 1–2 КС. Чтобы перейти в категорию уверенного практика ДФО, укрепите походный ценз и закройте недостающие практические курсы.',
      actionSteps: [
        'Доведите число подтверждённых выходов в качестве руководителя группы минимум до 10–12 маршрутов.',
        'Запланируйте участие или руководство в 1–2 походах 2 КС в Шкотовском или Партизанском районах Приморья.',
        'Пройдите сверку документов на зачёт опыта по Контуру А через куратора центра перед ближайшей сессией.',
      ],
      normRef: 'ПП РФ № 1003 · Регламент Контура А',
    });
  } else if (result.totalScore < 75) {
    tips.push({
      id: 'tier-contour-a-to-expedition',
      title: 'Масштабируйте квалификацию до старшего гида-эксперта (3–4 КС)',
      priorityLabel: 'Высокий приоритет',
      potentialGainLabel: `До уровня «${result.nextLevel?.shortTitle ?? 'Гид-эксперт'}» +${result.pointsToNextLevel} б.`,
      expertName: 'Сергей Ковалёв',
      expertRole: 'Старший экзаменатор полевого полигона ДФО',
      summary:
        'Ваш рейтинг соответствует уверенному аттестованному инструктору. Следующий качественный скачок — подтверждённые маршруты 3 КС и углублённая подготовка по спасработам.',
      actionSteps: [
        'Включите в портфолио не менее 2 походов 3 КС с ночёвками в автономных условиях и переправами.',
        'Подтвердите навыки ПСР и наведения переправ на полигоне ФСТР (даёт устойчивый запас на полевом экзамене).',
        'Расширьте пакет паспортов маршрутов на межрегиональные локации ДФО (Хабаровский край, Сахалин, Камчатка).',
      ],
      normRef: 'Методика ФСТР · Полигон Шкотовского района',
    });
  } else if (result.totalScore < 90) {
    tips.push({
      id: 'tier-senior-to-mentor',
      title: 'Закройте финальные баллы до статуса эксперта-наставника (90+ баллов)',
      priorityLabel: 'Рекомендуется',
      potentialGainLabel: `До высшей ступени осталось ${result.pointsToNextLevel} б.`,
      expertName: 'Григорий Саранча',
      expertRole: 'Руководитель РЦА «Русский Восток»',
      summary:
        'Вы входите в верхний эшелон проводников ДФО. Для перехода к уровню наставника РЦА критически важны сложные экспедиции 4 КС и полный комплект специализированных модулей.',
      actionSteps: [
        'Зафиксируйте руководство экспедиционными маршрутами 3–4 КС и подготовьте разбор рисков для стажёров ВВГУ.',
        'Убедитесь, что все 4 профильных курса (ДПО, WFA, ФСТР ПСР, протокол ДФО) имеют актуальные удостоверения.',
        'Подайте заявку на участие в методических разборах паспортов маршрутов при комиссии ВВГУ.',
      ],
      normRef: 'Стандарт РЦА «Русский Восток» · Наставничество',
    });
  } else {
    tips.push({
      id: 'tier-master-commission',
      title: 'Максимальный рейтинг достигнут: траектория эксперта комиссии РЦА',
      priorityLabel: 'Точка роста',
      potentialGainLabel: '100% пути пройдено',
      expertName: 'Галина Гомилевская',
      expertRole: 'Председатель аттестационной комиссии ВВГУ',
      summary:
        'Ваш профиль полностью закрывает требования к старшему инструктору-методисту ДФО. Вы можете выступать наставником потоков ВВГУ и участвовать в выездных приёмных комиссиях.',
      actionSteps: [
        'Поддерживайте актуальность медицинской справки и 5-летнего цикла подтверждения записи в Едином реестре.',
        'Подключитесь к стажировке выпускников ДПО ВВГУ на полевых полигонах Приморья и Камчатки.',
        'Синхронизируйте показатели в Личном кабинете с рейтингом аттестованных проводников ДФО.',
      ],
      normRef: 'ПП РФ № 1003 · Реестр Минэкономразвития РФ',
    });
  }

  // 2. Course-specific gap advice (dynamically added for missing courses)
  if (!selectedCourses.has('dpo_vvsu')) {
    tips.push({
      id: 'gap-dpo-vvsu',
      title: 'Пройдите профильную программу ДПО ВВГУ (250 ч)',
      priorityLabel: result.totalScore < 50 ? 'Высокий приоритет' : 'Рекомендуется',
      potentialGainLabel: '+13 баллов к рейтингу',
      expertName: 'Елена Морозова',
      expertRole: 'Методист ДПО ИТКИ ВВГУ',
      summary:
        'Отсутствие профильного образования — главная причина задержек при проверке документов. Модуль ДПО ВВГУ закрывает нормативную базу и даёт максимальную прибавку за один курс.',
      actionSteps: [
        'Выберите удобный поток в календаре ВВГУ (стоимость 27 200 ₽, возможна частичная субсидия при целевом наборе).',
        'При наличии высшего/среднего профобразования и подтверждённого стажа уточните у куратора возможность ускоренного зачёта по Контуру А.',
      ],
      normRef: 'Профстандарт инструктора-проводника · ВВГУ',
    });
  }

  if (!selectedCourses.has('wfa_first_aid')) {
    tips.push({
      id: 'gap-wfa',
      title: 'Подтвердите курс автономной первой помощи (Wilderness First Aid)',
      priorityLabel: 'Высокий приоритет',
      potentialGainLabel: '+9 баллов к рейтингу',
      expertName: 'Антон Белов',
      expertRole: 'Инструктор-медик полевого этапа РЦА',
      summary:
        'На практическом испытании в Приморье комиссия проверяет действия при травмах вдали от дорог, когда время прибытия скорой превышает 2–4 часа.',
      actionSteps: [
        'Пройдите 36-часовой практикум WFA с отработкой иммобилизации, остановки кровотечений и профилактики гипотермии.',
        'Соберите групповую аптечку по чек-листу РЦА и потренируйте алгоритм вызова МЧС / ПСР.',
      ],
      normRef: 'Стандарт WFA · Полевой блок РЦА',
    });
  }

  if (!selectedCourses.has('fstr_rescue')) {
    tips.push({
      id: 'gap-rescue',
      title: 'Отработайте спасработы и переправы по методике ФСТР',
      priorityLabel: 'Рекомендуется',
      potentialGainLabel: '+8 баллов к рейтингу',
      expertName: 'Сергей Ковалёв',
      expertRole: 'Старший экзаменатор полевого полигона ДФО',
      summary:
        'Даже опытные гиды теряют баллы на полигоне из-за ошибок в узлах, блокировке страховочных систем и организации навесной переправы через горный поток.',
      actionSteps: [
        'Посетите 2–3 тренировочных выезда на скальный/речной полигон Шкотовского района перед аттестационной сессией.',
        'Проверьте личное сертифицированное снаряжение (верёвки, карабины, жумары) на соответствие ГОСТ/UIAA.',
      ],
      normRef: 'Методика ФСТР · Техника горно-водных переправ',
    });
  }

  if (!selectedCourses.has('dfo_predator')) {
    tips.push({
      id: 'gap-dfo-predator',
      title: 'Изучите региональный протокол ДФО (крупный хищник и ООПТ)',
      priorityLabel: 'Точка роста',
      potentialGainLabel: '+5 баллов к рейтингу',
      expertName: 'Григорий Саранча',
      expertRole: 'Руководитель РЦА «Русский Восток»',
      summary:
        'Дальневосточные маршруты требуют знания правил работы в ареале амурского тигра, бурого медведя и режима особо охраняемых природных территорий.',
      actionSteps: [
        'Пройдите 16-часовой инструктаж по предотвращению конфликтов с крупными хищниками и применению фальшфейеров/спреев.',
        'Включите контакты дирекций ООПТ («Земля леопарда», «Бикин», Лазовский заповедник) в паспорт маршрута.',
      ],
      normRef: 'Региональный стандарт РЦА · Безопасность ООПТ ДФО',
    });
  }

  // 3. Experience & Complexity category balancing advice
  if (input.hikes2Ks === 0 && input.hikes3Ks === 0 && input.hikes4Ks === 0) {
    tips.push({
      id: 'gap-complexity-2ks',
      title: 'Повысьте категорию сложности походов до 2 КС',
      priorityLabel: 'Рекомендуется',
      potentialGainLabel: '+3 б. за каждый поход 2 КС',
      expertName: 'Сергей Ковалёв',
      expertRole: 'Старший экзаменатор полевого полигона ДФО',
      summary:
        'Походы 1 КС дают базовый минимум, но для уверенного роста рейтинга и расширения допуска важно пройти и задокументировать маршруты 2 КС.',
      actionSteps: [
        'Спланируйте 2–3 категорированных похода 2 КС (Ливадийский хребет, Сихотэ-Алинь, сплавы по р. Кема или Анюй).',
        'Фиксируйте каждый выход в маршрутной книжке через региональную федерацию спортивного туризма.',
      ],
      normRef: 'Единая всероссийская спортивная классификация маршрутов',
    });
  } else if (result.complexityPoints < 22 && input.hikes3Ks < 2) {
    tips.push({
      id: 'gap-complexity-3ks',
      title: 'Добавьте маршруты 3 КС для выхода в верхнюю категорию',
      priorityLabel: 'Точка роста',
      potentialGainLabel: '+5.5 б. за каждый поход 3 КС',
      expertName: 'Григорий Саранча',
      expertRole: 'Руководитель РЦА «Русский Восток»',
      summary:
        'Категорийные походы 3 КС дают почти вдвое больше рейтингового веса, чем 2 КС, и открывают допуск к сложным межрегиональным программам ДФО.',
      actionSteps: [
        'Заявите маршрут 3 КС в МКК Приморского края до начала летнего сезона.',
        'Отработайте план аварийного выхода с маршрута и резервные каналы спутниковой связи.',
      ],
      normRef: 'ЕВСК · Походы 3–4 категории сложности',
    });
  }

  if (input.ledGroupsCount < 10 && result.experiencePoints < 22) {
    tips.push({
      id: 'gap-led-groups',
      title: 'Систематизируйте подтверждение проведённых групп',
      priorityLabel: 'Точка роста',
      potentialGainLabel: 'До +10 б. за руководство группами',
      expertName: 'Елена Морозова',
      expertRole: 'Методист ДПО ИТКИ ВВГУ',
      summary:
        'Многие гиды фактически водят по 15–20 групп в год, но не собирают подтверждающие договоры ГПХ или журналы выходов, теряя баллы при экспертизе.',
      actionSteps: [
        'Соберите акты выполненных услуг от туроператоров и отметки о регистрации групп в МЧС за последние 3–5 лет.',
        'Загрузите сводный реестр маршрутов в личный профиль для быстрой проверки комиссией.',
      ],
      normRef: 'ПП РФ № 1003 · Подтверждение практического стажа',
    });
  }

  return tips;
}
