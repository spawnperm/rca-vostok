export type CompetencyDomainId = 'npa' | 'safety';
export type QuizIntervalDays = 14 | 30 | 60;
export type PeriodicityUrgency = 'due_first' | 'overdue' | 'due_soon' | 'up_to_date';

export interface CompetencyQuestion {
  id: string;
  domain: CompetencyDomainId;
  domainLabel: string;
  reference: string;
  question: string;
  options: { id: string; text: string }[];
  correctId: string;
  explanation: string;
}

export interface CompetencyQuizAttempt {
  id: string;
  completedAt: string; // ISO string
  totalQuestions: number;
  correctCount: number;
  scorePercent: number;
  npaPercent: number;
  safetyPercent: number;
  intervalDays: QuizIntervalDays;
  questionIds: string[];
  wrongQuestionIds: string[];
}

export interface StoredCompetencyQuizState {
  intervalDays: QuizIntervalDays;
  lastCompletedAt: string | null;
  attempts: CompetencyQuizAttempt[];
  activeQuestionIds: string[];
  activeAnswers: Record<string, string>;
}

export interface PeriodicityEvaluation {
  urgency: PeriodicityUrgency;
  statusLabel: string;
  headline: string;
  nextDueIso: string | null;
  nextDueFormatted: string | null;
  daysRemaining: number | null;
  lastScorePercent: number | null;
  lastNpaPercent: number | null;
  lastSafetyPercent: number | null;
  attemptsCount: number;
}

export const COMPETENCY_QUESTIONS: readonly CompetencyQuestion[] = [
  // ── Блок 1: Нормативная база (НПА) ──────────────────────────────────────
  {
    id: 'comp-npa-1',
    domain: 'npa',
    domainLabel: 'Нормативная база (НПА)',
    reference: 'ФЗ № 132-ФЗ · ПП РФ № 1003 (ред. № 1893)',
    question:
      'Каков срок действия записи об аттестации инструктора-проводника в Едином федеральном реестре (ЕФРТА)?',
    options: [
      { id: 'a', text: '3 года с правом продления на 1 год без экзамена' },
      { id: 'b', text: '5 лет с момента принятия решения аттестационной комиссией' },
      { id: 'c', text: 'Бессрочно при наличии диплома ДПО ВВГУ' },
    ],
    correctId: 'b',
    explanation:
      'Согласно ФЗ № 132-ФЗ и ПП РФ № 1003 (ред. № 1893) аттестация действует 5 лет, после чего проводится очередное подтверждение квалификации.',
  },
  {
    id: 'comp-npa-2',
    domain: 'npa',
    domainLabel: 'Нормативная база (НПА)',
    reference: 'Приказ МЧС России № 42 · Регистрация групп',
    question:
      'Не позднее какого срока до выхода на активный маршрут инструктор-проводник обязан уведомить территориальный орган МЧС России?',
    options: [
      { id: 'a', text: 'Не позднее чем за 10 рабочих дней до начала маршрута' },
      { id: 'b', text: 'В день выхода на старт маршрута по телефону ЕДДС' },
      { id: 'c', text: 'Только для водных сплавов 4–5 КС за 24 часа до старта' },
    ],
    correctId: 'a',
    explanation:
      'По регламенту информирования МЧС туристские группы и организаторы подают уведомление не позднее чем за 10 рабочих дней до выхода с указанием нитки, состава и КСР.',
  },
  {
    id: 'comp-npa-3',
    domain: 'npa',
    domainLabel: 'Нормативная база (НПА)',
    reference: 'ПП РФ № 760 · Паспорт маршрута',
    question:
      'Какие сведения в обязательном порядке включаются в паспорт туристского маршрута по форме ПП РФ № 760?',
    options: [
      { id: 'a', text: 'Только трек в формате GPX и перечень сувенирных точек' },
      {
        id: 'b',
        text: 'Оценка рисков, меры безопасности, расчёт пропускной способности, точки связи и пути эвакуации',
      },
      { id: 'c', text: 'Прейскурант туроператора и договор аренды транспорта' },
    ],
    correctId: 'b',
    explanation:
      'Постановление № 760 требует комплексного описания рисков, контрольных точек связи, допустимой нагрузки (ёмкости) и аварийных выходов для экстренной эвакуации.',
  },
  {
    id: 'comp-npa-4',
    domain: 'npa',
    domainLabel: 'Нормативная база (НПА)',
    reference: 'ФЗ № 132-ФЗ · ООПТ',
    question:
      'Что обязан иметь при себе инструктор-проводник при сопровождении группы по территории национального парка или заповедника (ООПТ)?',
    options: [
      {
        id: 'a',
        text: 'Нагрудную карточку-бейдж с QR-кодом реестра ЕФРТА и согласование/разрешение ООПТ',
      },
      { id: 'b', text: 'Достаточно устного подтверждения от туроператора' },
      { id: 'c', text: 'Только копию диплома о среднем профессиональном образовании' },
    ],
    correctId: 'a',
    explanation:
      'Инспекторы ООПТ и страховщики проверяют нагрудную карточку установленного образца, подтверждающую действующую запись в ЕФРТА, а также пропуск/согласование режима ООПТ.',
  },
  {
    id: 'comp-npa-5',
    domain: 'npa',
    domainLabel: 'Нормативная база (НПА)',
    reference: 'ПП РФ № 1003 · Раздельная сдача этапов',
    question:
      'Как учитываются результаты аттестации, если соискатель успешно сдал теоретическое тестирование, но не прошёл полевой этап на полигоне?',
    options: [
      { id: 'a', text: 'Все результаты аннулируются, требуется повторный курс ДПО 250 ч' },
      {
        id: 'b',
        text: 'Положительный результат теории сохраняется — повторно пересдаётся только практический этап',
      },
      { id: 'c', text: 'Свидетельство выдаётся условно с ограничением на 6 месяцев' },
    ],
    correctId: 'b',
    explanation:
      'Правила аттестации (ПП РФ № 1003) разделяют фиксацию теоретического и практического блоков: сданная теория не сгорает при пересдаче полевых испытаний.',
  },
  {
    id: 'comp-npa-6',
    domain: 'npa',
    domainLabel: 'Нормативная база (НПА)',
    reference: 'ФЗ № 132-ФЗ · Разграничение видов деятельности',
    question:
      'В чём ключевое правовое отличие инструктора-проводника от экскурсовода (гида)?',
    options: [
      {
        id: 'a',
        text: 'Инструктор-проводник аттестуется для сопровождения и обеспечения безопасности на маршрутах с особыми условиями и рисками (активный туризм)',
      },
      { id: 'b', text: 'Экскурсовод работает только с иностранными туристами, а проводник — только с детьми' },
      { id: 'c', text: 'Правовых различий нет, документы полностью взаимозаменяемы' },
    ],
    correctId: 'a',
    explanation:
      'Экскурсовод проводит ознакомительные экскурсии без категорийных препятствий, тогда как инструктор-проводник несёт ответственность за безопасность группы на спецучастках и маршрутах активного туризма.',
  },

  // ── Блок 2: Техника безопасности ───────────────────────────────────────
  {
    id: 'comp-safety-1',
    domain: 'safety',
    domainLabel: 'Техника безопасности',
    reference: 'WFA · Автономная первая помощь',
    question:
      'У участника группы в дождливую ветреную погоду появились выраженный озноб, невнятная речь и нарушение координации (умеренная гипотермия). Каков приоритетный алгоритм действий?',
    options: [
      { id: 'a', text: 'Растереть конечности снегом/спиртом и заставить быстро бежать к перевалу' },
      {
        id: 'b',
        text: 'Прекратить движение, изолировать от ветра и мокрой земли, переодеть в сухое и согревать туловище тёплым питьём (без алкоголя)',
      },
      { id: 'c', text: 'Погрузить конечности в горячую воду выше 50 °C без снятия мокрой одежды' },
    ],
    correctId: 'b',
    explanation:
      'По протоколу WFA при гипотермии необходимо немедленно остановить теплопотерю (ветрозащита, смена мокрой одежды, теплоизоляционный коврик) и плавно согревать корпус; растирания и активная нагрузка опасны.',
  },
  {
    id: 'comp-safety-2',
    domain: 'safety',
    domainLabel: 'Техника безопасности',
    reference: 'Техника ФСТР · Переправы вброд',
    question:
      'При подходе к горной реке после ночного ливня уровень воды резко поднялся, вода мутная и несёт камни. Как должен поступить руководитель группы?',
    options: [
      { id: 'a', text: 'Форсировать реку «стенкой» на самом быстром перекате для экономии времени' },
      {
        id: 'b',
        text: 'Отказаться от брода в опасном створе, организовать наблюдение за спадом воды, искать безопасный обход/мост или выходить на аварийный вариант маршрута',
      },
      { id: 'c', text: 'Переправляться с застёгнутым поясным ремнём рюкзака без страховки' },
    ],
    correctId: 'b',
    explanation:
      'Паводковый поток с мутной водой и влекомыми камнями критически опасен. При переправах поясной и грудной ремни рюкзака всегда расстёгиваются, а при паводке группа выжидает спад или уходит на запасной маршрут.',
  },
  {
    id: 'comp-safety-3',
    domain: 'safety',
    domainLabel: 'Техника безопасности',
    reference: 'Тактика ФСТР · Контрольный срок и ЧС',
    question:
      'На маршруте ухудшилась погода и один из туристов получил травму голеностопа, не позволяющую продолжать подъём. Что должен сделать проводник относительно контрольного срока (КСР)?',
    options: [
      {
        id: 'a',
        text: 'Оказать ПП, перевести группу на заранее спланированный аварийный выход, при наличии связи уведомить МЧС/координатора о сходе и соблюсти/обновить КСР',
      },
      { id: 'b', text: 'Отправить травмированного участника вниз одного, а с группой продолжить маршрут' },
      { id: 'c', text: 'Никого не уведомлять до истечения контрольного срока' },
    ],
    correctId: 'a',
    explanation:
      'Разделение группы с оставлением пострадавшего без сопровождения недопустимо. Проводник переводит группу на аварийный выход и своевременно передаёт обновлённые данные координатору и МЧС.',
  },
  {
    id: 'comp-safety-4',
    domain: 'safety',
    domainLabel: 'Техника безопасности',
    reference: 'Бивуак и ООПТ ДФО · Безопасная стоянка',
    question:
      'Какое место КАТЕГОРИЧЕСКИ запрещено выбирать для организации ночного бивуака в горах и долинах рек Дальнего Востока?',
    options: [
      { id: 'a', text: 'Ровную террасу выше уровня паводка в 50 м от русла' },
      {
        id: 'b',
        text: 'Сухие русла, низкие галечные косы в пойме реки, зоны под осыпными кулуарами и участки под сухостоем',
      },
      { id: 'c', text: 'Специально оборудованную площадку лесничества/ООПТ' },
    ],
    correctId: 'b',
    explanation:
      'Ночные паводки в Приморье и на Сахалине затапливают галечные косы и сухие русла за десятки минут, а сухостой и кулуары создают угрозу падения деревьев и камней.',
  },
  {
    id: 'comp-safety-5',
    domain: 'safety',
    domainLabel: 'Техника безопасности',
    reference: 'Регламент ДФО · Дикие животные',
    question:
      'Какая мера профилактики конфликта с бурым медведем на таёжных маршрутах ДФО является обязательной на стоянке?',
    options: [
      {
        id: 'a',
        text: 'Хранение продуктов и мусора в герметичной упаковке вдали от палаток (подвес/медвежий контейнер), запрет пищевых отходов в лагере и наличие средств отпугивания (фальшфейер/перцовый спрей)',
      },
      { id: 'b', text: 'Размещение остатков ужина прямо в тамбуре палатки для защиты от влаги' },
      { id: 'c', text: 'Одиночный обход кустарников в сумерках без звукового обозначения' },
    ],
    correctId: 'a',
    explanation:
      'Пищевой запах привлекает хищников в лагерь. Изоляция продуктов, чистота бивуака и групповое передвижение со звуковым обозначением (особенно у шумных рек) — базовый стандарт безопасности на ДФО.',
  },
  {
    id: 'comp-safety-6',
    domain: 'safety',
    domainLabel: 'Техника безопасности',
    reference: 'ПСР и спутниковая связь · Garmin inReach / Иридиум',
    question:
      'Какую информацию обязательно передать в первом сообщении при активации SOS на спутниковом трекере или по радиосвязи в ПСО?',
    options: [
      { id: 'a', text: 'Только сообщение «нужна помощь» без координат и состояния пострадавшего' },
      {
        id: 'b',
        text: 'Точные координаты (WGS-84), характер травмы/состояние пострадавшего, численность группы, погоду, наличие снаряжения и видимость площадки для эвакуации',
      },
      { id: 'c', text: 'Отключить трекер сразу после нажатия SOS для экономии батареи' },
    ],
    correctId: 'b',
    explanation:
      'Детальная сводка (координаты, состояние, метеоусловия и рельеф) позволяет спасателям сразу выбрать состав группы ПСР или вертолётную эвакуацию, а трекер должен оставаться на приёме для подтверждения.',
  },
];

const STORAGE_PREFIX = 'rca-competency-quiz-v1:';

function getStorageKey(userId?: string | null): string {
  return `${STORAGE_PREFIX}${userId || 'guest'}`;
}

const MONTHS_GENITIVE_RU = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

function formatRuDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return `${date.getUTCDate()} ${MONTHS_GENITIVE_RU[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function addDaysIso(isoString: string, days: number): string {
  const date = new Date(isoString);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function buildShortCompetencyQuiz(
  previousAttempt?: CompetencyQuizAttempt | null
): CompetencyQuestion[] {
  const prevSeen = new Set(previousAttempt?.questionIds ?? []);
  const prevWrong = new Set(previousAttempt?.wrongQuestionIds ?? []);

  const pickForDomain = (domain: CompetencyDomainId, count: number): CompetencyQuestion[] => {
    const pool = COMPETENCY_QUESTIONS.filter((q) => q.domain === domain);
    // Prioritize: previously wrong -> unseen -> previously seen correctly
    const sorted = [...pool].sort((a, b) => {
      const scoreA = prevWrong.has(a.id) ? 0 : !prevSeen.has(a.id) ? 1 : 2;
      const scoreB = prevWrong.has(b.id) ? 0 : !prevSeen.has(b.id) ? 1 : 2;
      return scoreA - scoreB;
    });
    return sorted.slice(0, count);
  };

  const npa = pickForDomain('npa', 3);
  const safety = pickForDomain('safety', 3);
  return [...npa, ...safety];
}

export function createInitialCompetencyQuizState(): StoredCompetencyQuizState {
  const initialQuiz = buildShortCompetencyQuiz(null);
  return {
    intervalDays: 30,
    lastCompletedAt: null,
    attempts: [],
    activeQuestionIds: initialQuiz.map((q) => q.id),
    activeAnswers: {},
  };
}

export function readStoredCompetencyQuizState(
  userId?: string | null
): StoredCompetencyQuizState {
  if (typeof window === 'undefined') {
    return createInitialCompetencyQuizState();
  }
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return createInitialCompetencyQuizState();
    const parsed = JSON.parse(raw) as Partial<StoredCompetencyQuizState>;
    if (!parsed || typeof parsed !== 'object') {
      return createInitialCompetencyQuizState();
    }
    const intervalDays: QuizIntervalDays =
      parsed.intervalDays === 14 || parsed.intervalDays === 60 ? parsed.intervalDays : 30;
    const attempts = Array.isArray(parsed.attempts) ? parsed.attempts : [];
    const activeQuestionIds =
      Array.isArray(parsed.activeQuestionIds) && parsed.activeQuestionIds.length > 0
        ? parsed.activeQuestionIds
        : buildShortCompetencyQuiz(attempts[0]).map((q) => q.id);
    const activeAnswers =
      parsed.activeAnswers && typeof parsed.activeAnswers === 'object'
        ? parsed.activeAnswers
        : {};
    return {
      intervalDays,
      lastCompletedAt: typeof parsed.lastCompletedAt === 'string' ? parsed.lastCompletedAt : null,
      attempts,
      activeQuestionIds,
      activeAnswers,
    };
  } catch {
    return createInitialCompetencyQuizState();
  }
}

export const COMPETENCY_QUIZ_UPDATED_EVENT = 'rca-competency-quiz-updated';

export function writeStoredCompetencyQuizState(
  userId: string | null | undefined,
  state: StoredCompetencyQuizState
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
    window.dispatchEvent(
      new CustomEvent(COMPETENCY_QUIZ_UPDATED_EVENT, {
        detail: { userId: userId ?? null },
      })
    );
  } catch {
    // ignore storage errors
  }
}

export function evaluatePeriodicityStatus(
  state: StoredCompetencyQuizState,
  now = new Date()
): PeriodicityEvaluation {
  const latest = state.attempts[0] ?? null;

  if (!state.lastCompletedAt || !latest) {
    return {
      urgency: 'due_first',
      statusLabel: 'Ожидает проверки',
      headline: 'Пройдите короткий тест (6 вопросов по НПА и технике безопасности)',
      nextDueIso: null,
      nextDueFormatted: 'Сегодня',
      daysRemaining: 0,
      lastScorePercent: null,
      lastNpaPercent: null,
      lastSafetyPercent: null,
      attemptsCount: state.attempts.length,
    };
  }

  const nextDueIso = addDaysIso(state.lastCompletedAt, state.intervalDays);
  const diffMs = new Date(nextDueIso).getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / 86400000);
  const nextDueFormatted = formatRuDate(nextDueIso);

  if (daysRemaining <= 0) {
    const overdueDays = Math.abs(daysRemaining);
    return {
      urgency: 'overdue',
      statusLabel: 'Пора пройти тест',
      headline:
        overdueDays === 0
          ? 'Срок периодической проверки наступил сегодня'
          : `Плановая проверка просрочена на ${overdueDays} дн. — обновите зачёт по НПА и безопасности`,
      nextDueIso,
      nextDueFormatted,
      daysRemaining,
      lastScorePercent: latest.scorePercent,
      lastNpaPercent: latest.npaPercent,
      lastSafetyPercent: latest.safetyPercent,
      attemptsCount: state.attempts.length,
    };
  }

  if (daysRemaining <= 5) {
    return {
      urgency: 'due_soon',
      statusLabel: 'Скоро проверка',
      headline: `Следующее периодическое тестирование через ${daysRemaining} дн. (${nextDueFormatted})`,
      nextDueIso,
      nextDueFormatted,
      daysRemaining,
      lastScorePercent: latest.scorePercent,
      lastNpaPercent: latest.npaPercent,
      lastSafetyPercent: latest.safetyPercent,
      attemptsCount: state.attempts.length,
    };
  }

  return {
    urgency: 'up_to_date',
    statusLabel: 'Актуально',
    headline: `Компетенции подтверждены · следующая проверка ${nextDueFormatted} (через ${daysRemaining} дн.)`,
    nextDueIso,
    nextDueFormatted,
    daysRemaining,
    lastScorePercent: latest.scorePercent,
    lastNpaPercent: latest.npaPercent,
    lastSafetyPercent: latest.safetyPercent,
    attemptsCount: state.attempts.length,
  };
}

export function gradeCompetencyAttempt(
  questions: readonly CompetencyQuestion[],
  answers: Record<string, string>,
  intervalDays: QuizIntervalDays,
  completedAt = new Date().toISOString()
): CompetencyQuizAttempt {
  let correctCount = 0;
  let npaTotal = 0;
  let npaCorrect = 0;
  let safetyTotal = 0;
  let safetyCorrect = 0;
  const wrongQuestionIds: string[] = [];

  for (const q of questions) {
    const ok = answers[q.id] === q.correctId;
    if (ok) {
      correctCount += 1;
    } else {
      wrongQuestionIds.push(q.id);
    }
    if (q.domain === 'npa') {
      npaTotal += 1;
      if (ok) npaCorrect += 1;
    } else {
      safetyTotal += 1;
      if (ok) safetyCorrect += 1;
    }
  }

  const totalQuestions = Math.max(questions.length, 1);
  return {
    id: `attempt-${Date.now()}`,
    completedAt,
    totalQuestions: questions.length,
    correctCount,
    scorePercent: Math.round((correctCount / totalQuestions) * 100),
    npaPercent: npaTotal > 0 ? Math.round((npaCorrect / npaTotal) * 100) : 0,
    safetyPercent: safetyTotal > 0 ? Math.round((safetyCorrect / safetyTotal) * 100) : 0,
    intervalDays,
    questionIds: questions.map((q) => q.id),
    wrongQuestionIds,
  };
}
