export type ExamTopicId = 'all' | 'law' | 'passport' | 'field_wfa' | 'oopt_water';

export interface ExamTopicDefinition {
  id: ExamTopicId;
  label: string;
}

export interface ExamQuestionOption {
  id: string;
  label: string;
  text: string;
}

export interface ExamSimQuestion {
  id: string;
  topicId: Exclude<ExamTopicId, 'all'>;
  topicLabel: string;
  difficulty: string;
  question: string;
  options: readonly ExamQuestionOption[];
  correctOptionId: string;
  feedbackCorrect: string;
  feedbackIncorrect: string;
  legalRef: string;
}

export interface EvaluatedExamAnswer {
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean;
  correctOption: ExamQuestionOption;
  selectedOption: ExamQuestionOption;
  feedbackHeading: string;
  explanation: string;
  legalRef: string;
}

export interface TopicBreakdownItem {
  topicId: Exclude<ExamTopicId, 'all'>;
  topicLabel: string;
  total: number;
  answered: number;
  correct: number;
}

export interface ExamSessionSummary {
  total: number;
  answered: number;
  correct: number;
  incorrect: number;
  scorePct: number;
  passed: boolean;
  wrongQuestionIds: string[];
  byTopic: TopicBreakdownItem[];
}

export const EXAM_PASSING_THRESHOLD_PCT = 75;

export const EXAM_TOPICS: readonly ExamTopicDefinition[] = [
  { id: 'all', label: 'Все темы' },
  { id: 'law', label: 'Законодательство (132-ФЗ / 1003)' },
  { id: 'passport', label: 'Паспорт маршрута (ПП № 760)' },
  { id: 'field_wfa', label: 'Полевая практика и WFA' },
  { id: 'oopt_water', label: 'Вода, ООПТ и специфика ДФО' },
];

export const EXAM_SIM_QUESTIONS: readonly ExamSimQuestion[] = [
  {
    id: 'sim-law-registry',
    topicId: 'law',
    topicLabel: 'Законодательство (132-ФЗ / 1003)',
    difficulty: 'Базовый · 1–4 КС',
    question:
      'Какое условие является обязательным для законного сопровождения туристов на категорированном маршруте с 1 октября 2026 года?',
    options: [
      {
        id: 'a',
        label: 'А',
        text: 'Наличие удостоверения о повышении квалификации без внесения сведений в федеральный реестр',
      },
      {
        id: 'b',
        label: 'Б',
        text: 'Действующая запись в Едином федеральном реестре инструкторов-проводников и наличие нагрудной карточки (бейджа)',
      },
      {
        id: 'c',
        label: 'В',
        text: 'Членский билет региональной туристической ассоциации и справка от туроператора',
      },
      {
        id: 'd',
        label: 'Г',
        text: 'Уведомление местной администрации о составе туристической группы за 1 день до выхода',
      },
    ],
    correctOptionId: 'b',
    feedbackCorrect:
      'Верно: после окончания переходного периода работа на маршрутах повышенной опасности разрешена только при активной записи в Едином реестре Минэкономразвития РФ и с нагрудной карточкой.',
    feedbackIncorrect:
      'Неверно: диплома или письма туроператора недостаточно. По ст. 4.4 ФЗ № 132-ФЗ (в ред. ПП РФ № 1893) проводник обязан числиться в Едином федеральном реестре и иметь нагрудную карточку.',
    legalRef: 'ФЗ № 132-ФЗ ст. 4.4 · ПП РФ № 1003 (ред. № 1893)',
  },
  {
    id: 'sim-law-validity',
    topicId: 'law',
    topicLabel: 'Законодательство (132-ФЗ / 1003)',
    difficulty: 'Базовый · 1–4 КС',
    question:
      'На какой срок выдаётся аттестат инструктора-проводника после успешной сдачи теории и полевого полигона в РЦА?',
    options: [
      { id: 'a', label: 'А', text: 'На 2 года, с обязательной пересдачей полигона каждый сезон' },
      { id: 'b', label: 'Б', text: 'На 3 года до окончания действия договора с туроператором' },
      { id: 'c', label: 'В', text: 'На 5 лет, с последующим плановым подтверждением соответствия' },
      { id: 'd', label: 'Г', text: 'Бессрочно при наличии профиля «пешеходный + водный»' },
    ],
    correctOptionId: 'c',
    feedbackCorrect:
      'Верно: аттестация и реестровая запись действуют 5 лет, после чего проводится плановое подтверждение квалификации.',
    feedbackIncorrect:
      'Неверно: по действующим правилам аттестация инструктора-проводника действует 5 лет, а не 2–3 года и не бессрочно.',
    legalRef: 'ПП РФ № 1003 · Регламент ФСТР и РЦА',
  },
  {
    id: 'sim-passport-760',
    topicId: 'passport',
    topicLabel: 'Паспорт маршрута (ПП № 760)',
    difficulty: '1–4 КС',
    question:
      'Какие разделы обязательно проверяет комиссия ВВГУ при защите паспорта туристского маршрута по форме 760?',
    options: [
      {
        id: 'a',
        label: 'А',
        text: 'Только трек GPX и коммерческую стоимость участия на одного туриста',
      },
      {
        id: 'b',
        label: 'Б',
        text: 'Нитку и хронометраж, оценку рисков, схему связи, контрольные точки, запасные выходы и план эвакуации',
      },
      {
        id: 'c',
        label: 'В',
        text: 'Список рекламных площадок и договор с транспортной компанией',
      },
      {
        id: 'd',
        label: 'Г',
        text: 'Отзывы предыдущих участников и меню походного питания',
      },
    ],
    correctOptionId: 'b',
    feedbackCorrect:
      'Верно: паспорт маршрута (ПП № 760) должен содержать техническое описание, матрицу рисков, расчёт темпа и пропускной способности, схему связи, запасные сходы и порядок ПСР.',
    feedbackIncorrect:
      'Неверно: комиссия оценивает прежде всего безопасность и нормирование маршрута — нитку, тайминги, оценку опасностей, контрольные точки, связь и запасные варианты выхода при ЧС.',
    legalRef: 'Постановление Правительства РФ № 760',
  },
  {
    id: 'sim-passport-mchs',
    topicId: 'passport',
    topicLabel: 'Паспорт маршрута (ПП № 760)',
    difficulty: '1–4 КС',
    question:
      'За сколько дней до выхода группы на маршрут повышенной опасности инструктор-проводник обязан уведомить территориальный орган МЧС России?',
    options: [
      { id: 'a', label: 'А', text: 'Не позднее чем за 10 рабочих дней до начала путешествия' },
      { id: 'b', label: 'Б', text: 'Уведомление в МЧС подаётся только после возвращения группы' },
      { id: 'c', label: 'В', text: 'За 2 часа до выхода на маршрут, прямо на стартовой точке' },
      { id: 'd', label: 'Г', text: 'Только если маршрут превышает 100 км протяжённости' },
    ],
    correctOptionId: 'a',
    feedbackCorrect:
      'Верно: согласно регламенту информирования МЧС РФ, заявка с составом группы, ниткой и контрольными сроками подаётся не позднее чем за 10 рабочих дней до выхода.',
    feedbackIncorrect:
      'Неверно: подача уведомления за 2 часа или только по длинным трекам нарушает регламент безопасности — регистрация группы в МЧС выполняется не позднее чем за 10 рабочих дней до старта.',
    legalRef: 'Приказ МЧС России № 42 · Программа РЦА',
  },
  {
    id: 'sim-wfa-hypothermia',
    topicId: 'field_wfa',
    topicLabel: 'Полевая практика и WFA',
    difficulty: '2–4 КС',
    question:
      'На Шкотовском полигоне отрабатывается помощь туристу с признаками умеренной гипотермии (дрожь, заторможенность, мокрая одежда) в автономных условиях. Какой шаг первоочередной?',
    options: [
      {
        id: 'a',
        label: 'А',
        text: 'Растереть конечности снегом или спиртом и заставить участника бежать для согрева',
      },
      {
        id: 'b',
        label: 'Б',
        text: 'Защитить от ветра и осадков, заменить мокрую одежду на сухую, укрыть в теплоизоляционный кокон и дать тёплое сладкое питьё при сохранном глотании',
      },
      {
        id: 'c',
        label: 'В',
        text: 'Дать жаропонижающее средство и оставить отдыхать прямо на открытом привале',
      },
      {
        id: 'd',
        label: 'Г',
        text: 'Немедленно погрузить руки и стопы пострадавшего в кипяток',
      },
    ],
    correctOptionId: 'b',
    feedbackCorrect:
      'Верно: протокол Wilderness First Aid (WFA) требует прекратить теплопотерю (ветрозащита, сухая одежда, изоляция от грунта) и безопасно восполнить энергию тёплым сладким питьём, если пострадавший в сознании.',
    feedbackIncorrect:
      'Неверно: растирание, алкоголь, резкий перегрев или интенсивная нагрузка опасны при гипотермии (риск «холодового сброса» и обморожения). По стандарту WFA сначала изолируют от холода и меняют мокрую одежду на сухую.',
    legalRef: 'Стандарт Wilderness First Aid (WFA) · Полевой блок РЦА',
  },
  {
    id: 'sim-wfa-beacon',
    topicId: 'field_wfa',
    topicLabel: 'Полевая практика и WFA',
    difficulty: '2–4 КС',
    question:
      'Что необходимо сделать инструктору-проводнику в зоне без сотовой связи при получении участником тяжёлой травмы, исключающей самостоятельное передвижение?',
    options: [
      {
        id: 'a',
        label: 'А',
        text: 'Разделить группу по одному человеку и отправить всех искать сотовый сигнал',
      },
      {
        id: 'b',
        label: 'Б',
        text: 'Стабилизировать состояние по протоколу WFA, передать точные координаты, характер травмы и состояние пострадавшего по спутниковому трекеру (Garmin inReach) в МЧС/координатору и подготовить площадку укрытия',
      },
      {
        id: 'c',
        label: 'В',
        text: 'Оставить пострадавшего на тропе с рюкзаком и продолжить маршрут с остальной группой',
      },
      {
        id: 'd',
        label: 'Г',
        text: 'Немедленно начать спуск пострадавшего по курумнику на руках без иммобилизации',
      },
    ],
    correctOptionId: 'b',
    feedbackCorrect:
      'Верно: в автономных условиях ДФО сначала обеспечивают стабилизацию и теплоизоляцию (WFA), передают точные координаты и статус по спутниковой связи, не допуская хаотичного разделения группы.',
    feedbackIncorrect:
      'Неверно: оставлять пострадавшего одного или перемещать без иммобилизации критически опасно. Алгоритм РЦА: стабилизация WFA, передача координат через спутниковый коммуникатор и организация безопасного бивуака.',
    legalRef: 'Методика ПСР ФСТР · Стандарт Шкотовского полигона',
  },
  {
    id: 'sim-oopt-predator',
    topicId: 'oopt_water',
    topicLabel: 'Вода, ООПТ и специфика ДФО',
    difficulty: '1–3 КС · ООПТ',
    question:
      'При ведении группы по таёжному маршруту Приморья или нацпарка «Бикин» на тропе обнаружены свежие следы или признаки присутствия крупного хищника (амурский тигр, бурый медведь). Ваши действия?',
    options: [
      {
        id: 'a',
        label: 'А',
        text: 'Подойти ближе с группой, чтобы сделать фото, и разложить остатки еды на тропе',
      },
      {
        id: 'b',
        label: 'Б',
        text: 'Собрать группу компактно вместе, не убегать, подать спокойный звуковой сигнал, контролировать дистанцию/фальшфейер наготове, безопасно обойти участок или развернуть группу и зафиксировать точку для инспекции ООПТ',
      },
      {
        id: 'c',
        label: 'В',
        text: 'Ускорить шаг и разрешить отстающим туристам идти с разрывом в 200 метров',
      },
      {
        id: 'd',
        label: 'Г',
        text: 'Отпугнуть животное броском камней и громким преследованием по кустам',
      },
    ],
    correctOptionId: 'b',
    feedbackCorrect:
      'Верно: региональный протокол ООПТ ДФО требует консолидировать группу, исключить панику и бегство, держать средства отпугивания (фальшфейер/перцовый спрей) под рукой и уведомить администрацию ООПТ.',
    feedbackIncorrect:
      'Неверно: растягивание группы, приближение для съёмки или преследование провоцируют нападение. Группа должна идти плотным строем под контролем проводника и при необходимости безопасно уйти с участка.',
    legalRef: 'Регламент ООПТ ДФО и Центра «Амурский тигр»',
  },
  {
    id: 'sim-water-crossing',
    topicId: 'oopt_water',
    topicLabel: 'Вода, ООПТ и специфика ДФО',
    difficulty: '1–4 КС · Вода',
    question:
      'Какие требования предъявляются при организации брода через горную реку или проведении водного сплава на Дальнем Востоке?',
    options: [
      {
        id: 'a',
        label: 'А',
        text: 'Переправа допускается с застёгнутым поясным ремнём рюкзака и без спасжилетов при глубине до колена',
      },
      {
        id: 'b',
        label: 'Б',
        text: 'Обязательна разведка створа, расстёгнутый пояс и грудная стяжка рюкзака при броде, организация страховки («морковка»/перила), а на сплаве — спасжилет, каска и соблюдение нормы группы на проводника',
      },
      {
        id: 'c',
        label: 'В',
        text: 'На одного инструктора-проводника допускается одновременный выход группы из 35 человек на пороги 3 КС',
      },
      {
        id: 'd',
        label: 'Г',
        text: 'Страховка выставляется только при пересечении рек выше 5 категории сложности',
      },
    ],
    correctOptionId: 'b',
    feedbackCorrect:
      'Верно: расстёгнутый пояс рюкзака исключает удержание под водой при падении, а на воде обязательны спасжилеты, каски, страховка и соблюдение предельной численности группы на проводника.',
    feedbackIncorrect:
      'Неверно: застёгнутый пояс рюкзака на броде или выход без страховки и спасжилета грубо нарушают технику безопасности ФСТР. Обязательны разведка створа, расстёгнутые ремни, страховка и соблюдение норм численности.',
    legalRef: 'ПП РФ № 1893 · Правила ФСТР по водному и пешеходному туризму',
  },
];

export function filterExamQuestionsByTopic(
  questions: readonly ExamSimQuestion[],
  topicId: ExamTopicId
): ExamSimQuestion[] {
  if (topicId === 'all') {
    return [...questions];
  }
  return questions.filter((q) => q.topicId === topicId);
}

export function evaluateExamAnswer(
  question: ExamSimQuestion,
  selectedOptionId: string
): EvaluatedExamAnswer {
  const correctOption =
    question.options.find((o) => o.id === question.correctOptionId) ?? question.options[0];
  const selectedOption =
    question.options.find((o) => o.id === selectedOptionId) ?? question.options[0];
  const isCorrect = selectedOptionId === question.correctOptionId;

  return {
    questionId: question.id,
    selectedOptionId,
    isCorrect,
    correctOption,
    selectedOption,
    feedbackHeading: isCorrect
      ? 'Правильный ответ'
      : `Ошибка · верный вариант ${correctOption.label}`,
    explanation: isCorrect ? question.feedbackCorrect : question.feedbackIncorrect,
    legalRef: question.legalRef,
  };
}

export function summarizeExamSession(
  questions: readonly ExamSimQuestion[],
  answers: Record<string, string>
): ExamSessionSummary {
  const total = questions.length;
  let answered = 0;
  let correct = 0;
  const wrongQuestionIds: string[] = [];

  const topicMap: Record<
    Exclude<ExamTopicId, 'all'>,
    TopicBreakdownItem
  > = {
    law: {
      topicId: 'law',
      topicLabel: 'Законодательство (132-ФЗ / 1003)',
      total: 0,
      answered: 0,
      correct: 0,
    },
    passport: {
      topicId: 'passport',
      topicLabel: 'Паспорт маршрута (ПП № 760)',
      total: 0,
      answered: 0,
      correct: 0,
    },
    field_wfa: {
      topicId: 'field_wfa',
      topicLabel: 'Полевая практика и WFA',
      total: 0,
      answered: 0,
      correct: 0,
    },
    oopt_water: {
      topicId: 'oopt_water',
      topicLabel: 'Вода, ООПТ и специфика ДФО',
      total: 0,
      answered: 0,
      correct: 0,
    },
  };

  for (const question of questions) {
    const bucket = topicMap[question.topicId];
    bucket.total += 1;

    const picked = answers[question.id];
    if (picked) {
      answered += 1;
      bucket.answered += 1;
      if (picked === question.correctOptionId) {
        correct += 1;
        bucket.correct += 1;
      } else {
        wrongQuestionIds.push(question.id);
      }
    }
  }

  const incorrect = answered - correct;
  const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;

  return {
    total,
    answered,
    correct,
    incorrect,
    scorePct,
    passed: scorePct >= EXAM_PASSING_THRESHOLD_PCT && answered === total,
    wrongQuestionIds,
    byTopic: Object.values(topicMap).filter((item) => item.total > 0),
  };
}

export function getRemainingWrongQuestions(
  questions: readonly ExamSimQuestion[],
  wrongQuestionIds: readonly string[]
): ExamSimQuestion[] {
  const wrongSet = new Set(wrongQuestionIds);
  return questions.filter((q) => wrongSet.has(q.id));
}
