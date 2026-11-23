export type DiagnosticSectionId = 'regulation' | 'routing' | 'first_aid' | 'field_dfo';

export type DiagnosticOptionId = 'a' | 'b' | 'c' | 'd';

export interface DiagnosticOption {
  id: DiagnosticOptionId;
  label: string;
}

export interface DiagnosticQuestion {
  id: string;
  sectionId: DiagnosticSectionId;
  prompt: string;
  options: readonly DiagnosticOption[];
  correctOptionId: DiagnosticOptionId;
  legalOrMethodRef: string;
  explanation: string;
  studyHint: string;
  kbQuery: string;
}

export interface DiagnosticSectionMeta {
  id: DiagnosticSectionId;
  stepNumber: number;
  title: string;
  shortTitle: string;
  description: string;
  kbQuery: string;
  estimatedGapHours: number;
  estimatedModerateHours: number;
  gapRecommendationTitle: string;
  gapRecommendationText: string;
  moderateRecommendationTitle: string;
  moderateRecommendationText: string;
  strongText: string;
  studyActions: readonly string[];
}

export type DiagnosticSectionStatus = 'strong' | 'moderate' | 'gap';

export type DiagnosticReadinessTier =
  | 'incomplete'
  | 'exam_ready'
  | 'targeted_prep'
  | 'dpo_recommended';

export interface MissedQuestionInsight {
  questionId: string;
  prompt: string;
  selectedOptionLabel: string | null;
  correctOptionLabel: string;
  studyHint: string;
  legalOrMethodRef: string;
  kbQuery: string;
}

export interface DiagnosticSectionResult {
  id: DiagnosticSectionId;
  stepNumber: number;
  title: string;
  shortTitle: string;
  description: string;
  answeredCount: number;
  totalCount: number;
  correctCount: number;
  scorePercent: number;
  status: DiagnosticSectionStatus;
  statusLabel: string;
  recommendationTitle: string;
  recommendationText: string;
  studyActions: readonly string[];
  recommendedStudyHours: number;
  kbQuery: string;
  missedQuestions: MissedQuestionInsight[];
}

export interface AttestationDiagnosticsEvaluation {
  sections: DiagnosticSectionResult[];
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  correctCount: number;
  overallPercent: number;
  isComplete: boolean;
  readinessTier: DiagnosticReadinessTier;
  verdictLabel: string;
  verdictTitle: string;
  verdictSummary: string;
  recommendedContour: string;
  totalRecommendedHours: number;
  priorityRecommendations: DiagnosticSectionResult[];
  incompleteSectionIds: DiagnosticSectionId[];
}

export interface StoredDiagnosticsState {
  answers: Partial<Record<string, DiagnosticOptionId>>;
  checkedSections: Partial<Record<DiagnosticSectionId, boolean>>;
  activeStep: number;
  updatedAt: string | null;
}

export const DIAGNOSTIC_SECTIONS: readonly DiagnosticSectionMeta[] = [
  {
    id: 'regulation',
    stepNumber: 1,
    title: 'Нормативная база и статус проводника',
    shortTitle: 'Нормативная база',
    description:
      'Полномочия центра аттестации, выбор контура (А или Б), порядок внесения в ЕФРТА и сроки действия аттестата.',
    kbQuery: '1893',
    estimatedGapHours: 4,
    estimatedModerateHours: 2,
    gapRecommendationTitle: 'Систематизировать нормативную базу (ФЗ № 132-ФЗ и ПП РФ № 1003)',
    gapRecommendationText:
      'Выявлены пробелы в правилах допуска к работе на маршруте, порядке внесения в ЕФРТА и разграничении Контура А и Контура Б. Без чёткого знания регламента высок риск отсева на теоретическом блоке.',
    moderateRecommendationTitle: 'Уточнить детали регламента и сроков аттестации',
    moderateRecommendationText:
      'Базовые нормы понятны, но стоит повторить исключения по Контуру А/Б, сроки подачи документов и правила подтверждения стажа.',
    strongText:
      'Уверенное владение нормативной базой аттестации, правилами ЕФРТА и требованиями Постановления № 1003.',
    studyActions: [
      'Сравните условия допуска по Контуру А (через ДПО) и Контуру Б (подтверждённый опыт) в калькуляторе и FAQ.',
      'Проверьте сроки рассмотрения заявок (15 рабочих дней) и период действия аттестата (5 лет).',
      'Изучите в глоссарии РЦА отличия госреестра ЕФРТА от реестра инструкторов-проводников ФСТР.',
    ],
  },
  {
    id: 'routing',
    stepNumber: 2,
    title: 'Паспортизация маршрута и режим ООПТ',
    shortTitle: 'Маршруты и ООПТ',
    description:
      'Оформление паспорта туристского маршрута (ПП РФ № 760), расчёт группы по КС, согласование с ООПТ и МЧС.',
    kbQuery: 'паспорт',
    estimatedGapHours: 5,
    estimatedModerateHours: 2,
    gapRecommendationTitle: 'Отработать паспортизацию маршрута и правила взаимодействия с ООПТ/МЧС',
    gapRecommendationText:
      'На практическом этапе аттестации кандидаты разбирают кейсы по Форме № 760, запасным выходам и уведомлению МЧС. Рекомендуем разобрать шаблон паспорта до экзамена.',
    moderateRecommendationTitle: 'Проверить расчёт нитки маршрута и нормы группы по КС',
    moderateRecommendationText:
      'Основы планирования маршрута усвоены, но допущены неточности в нормативах безопасности группы или порядке согласования на ООПТ.',
    strongText:
      'Отличная подготовка по структуре паспорта маршрута (ПП РФ № 760), режимам ООПТ и правилам уведомления МЧС.',
    studyActions: [
      'Разберите разделы Формы № 760: график движения, аварийные сходы, контрольные точки связи.',
      'Сверьте порядок подачи уведомления в территориальное подразделение МЧС (не позднее 10 рабочих дней до старта).',
      'Уточните требования администраций заповедников и нацпарков ДФО к пропуску и сопровождению групп.',
    ],
  },
  {
    id: 'first_aid',
    stepNumber: 3,
    title: 'Первая помощь (WFA) и спасработы (ПСР)',
    shortTitle: 'Первая помощь и ПСР',
    description:
      'Алгоритм осмотра пострадавшего в автономной среде, гипотермия, транспортная иммобилизация и техника спасработ.',
    kbQuery: 'аптечка',
    estimatedGapHours: 6,
    estimatedModerateHours: 3,
    gapRecommendationTitle: 'Пройти практику первой помощи в природной среде (WFA) и ПСР',
    gapRecommendationText:
      'Ошибки в блоке первой помощи и спасработ критичны на очном полевом экзамене. Необходимо отработать последовательность первичного осмотра, помощь при переохлаждении и организацию переправ.',
    moderateRecommendationTitle: 'Повторить протоколы ПСР и укомплектованность аптечки',
    moderateRecommendationText:
      'Общие принципы оказания помощи верны, но следует закрепить алгоритмы действий при сложных травмах и длительной транспортировке пострадавшего.',
    strongText:
      'Высокий уровень знаний протоколов первой помощи в автономной среде (WFA) и базовой техники ПСР.',
    studyActions: [
      'Повторите последовательность осмотра пострадавшего в автономных условиях и критерии срочной эвакуации.',
      'Сверьте перечень укладки групповой аптечки (перевязочные, шины, термоодеяло, антисептики без рецептурных препаратов без назначения).',
      'Отработайте на практике узлы, полиспаст и организацию перильной страховки на переправе.',
    ],
  },
  {
    id: 'field_dfo',
    stepNumber: 4,
    title: 'Сопровождение группы и специфика ДФО',
    shortTitle: 'Тактика и специфика ДФО',
    description:
      'Спутниковая связь, контрольные сроки, паводки и тайфуны Приморья/Сахалина, безопасность при встрече с хищниками.',
    kbQuery: 'МЧС',
    estimatedGapHours: 4,
    estimatedModerateHours: 2,
    gapRecommendationTitle: 'Изучить региональные риски ДФО и тактику управления группой в ЧС',
    gapRecommendationText:
      'Маршруты Дальнего Востока имеют выраженную специфику: быстрый подъём воды в реках, штормовые циклоны на побережье и местообитания бурого медведя и амурского тигра.',
    moderateRecommendationTitle: 'Дополнить знания по тактике на маршрутах ДФО',
    moderateRecommendationText:
      'Хорошая база управления группой, но стоит повторить алгоритмы поведения при встрече с крупным хищником и действия при резкой смене погоды.',
    strongText:
      'Уверенное знание тактики сопровождения группы и региональных природных рисков Дальнего Востока.',
    studyActions: [
      'Повторите правила организации сеансов связи, передачи координат и действий при невыходе на контрольную связь.',
      'Изучите памятки Минприроды и заповедников ДФО по профилактике конфликтов с бурым медведем и амурским тигром.',
      'Продумайте план действий при резком паводке или закрытии морской акватории из-за циклона.',
    ],
  },
];

export const DIAGNOSTIC_QUESTIONS: readonly DiagnosticQuestion[] = [
  // 1. Нормативная база и статус проводника
  {
    id: 'reg-efrta-registry',
    sectionId: 'regulation',
    prompt:
      'С какой даты в России вступила в силу обязательная аттестация инструкторов-проводников с внесением сведений в ЕФРТА по маршрутам, требующим сопровождения?',
    options: [
      { id: 'a', label: 'С 1 июля 2024 года (с переходным периодом для отдельных категорий до 2025–2026 гг.)' },
      { id: 'b', label: 'С 1 января 2020 года одновременно со всеми видами туризма' },
      { id: 'c', label: 'Аттестация остаётся исключительно добровольной на усмотрение туроператора' },
      { id: 'd', label: 'Только с 1 января 2028 года после запуска региональных реестров' },
    ],
    correctOptionId: 'a',
    legalOrMethodRef: 'ФЗ № 132-ФЗ · ПП РФ № 1003',
    explanation:
      'Обязательная аттестация введена с 1 июля 2024 года в рамках поправок к № 132-ФЗ; Правительство РФ уточнило переходные положения постановлениями № 1003 и № 1893.',
    studyHint: 'Повторите хронологию введения обязательной аттестации и требования к записи в ЕФРТА.',
    kbQuery: 'ЕФРТА',
  },
  {
    id: 'reg-contour-choice',
    sectionId: 'regulation',
    prompt:
      'Чем принципиально отличается «Контур Б» от «Контура А» при подаче документов на аттестацию в РЦА?',
    options: [
      { id: 'a', label: 'Контур Б предназначен только для морских судоводителей' },
      { id: 'b', label: 'По Контуру Б можно аттестоваться с подтверждённым профильным стажем/опытом без прохождения новой программы ДПО' },
      { id: 'c', label: 'По Контуру Б не требуется сдавать практический экзамен на маршруте' },
      { id: 'd', label: 'Контур А выдаёт аттестат бессрочно, а Контур Б — только на 1 сезон' },
    ],
    correctOptionId: 'b',
    legalOrMethodRef: 'ПП РФ № 1003 (ред. № 1893)',
    explanation:
      'Контур Б рассчитан на действующих проводников, имеющих подтверждённый документами опыт прохождения и руководства маршрутами, тогда как Контур А включает обязательное прохождение программы ДПО.',
    studyHint: 'Сравните требования Контура А и Контура Б к документам об опыте и образовании.',
    kbQuery: 'Контур',
  },
  {
    id: 'reg-badge-identification',
    sectionId: 'regulation',
    prompt:
      'Какое требование предъявляется к аттестованному инструктору-проводнику непосредственно во время ведения группы на маршруте?',
    options: [
      { id: 'a', label: 'Наличие бумажной выписки из ЕФРТА без нагрудной карточки допускается вместо бейджа' },
      { id: 'b', label: 'Проводник обязан иметь при себе нагрудную идентификационную карточку с QR-кодом из ЕФРТА' },
      { id: 'c', label: 'Нагрудная карточка хранится у туроператора в офисе и на маршрут не берётся' },
      { id: 'd', label: 'Идентификационная карточка нужна только при пересечении государственной границы' },
    ],
    correctOptionId: 'b',
    legalOrMethodRef: 'ст. 4.4 ФЗ № 132-ФЗ · Приказ Минэкономразвития',
    explanation:
      'Аттестованный проводник на маршруте обязан иметь нагрудную идентификационную карточку, позволяющую проверить его статус и категорию допуска в ЕФРТА.',
    studyHint: 'Уточните правила выдачи и использования нагрудной идентификационной карточки проводника.',
    kbQuery: 'нагрудная карточка',
  },

  // 2. Паспортизация маршрута и режим ООПТ
  {
    id: 'route-form-760',
    sectionId: 'routing',
    prompt:
      'Какой документ закрепляет ключевые параметры безопасности маршрута, нитку, график движения, опасные участки и точки аварийного выхода?',
    options: [
      { id: 'a', label: 'Справка-отчёт о спортивном походе образца прошлых лет' },
      { id: 'b', label: 'Паспорт туристского маршрута по форме ПП РФ № 760' },
      { id: 'c', label: 'Только чек об оплате входа в национальный парк' },
      { id: 'd', label: 'Устный инструктаж, зафиксированный в мессенджере группы' },
    ],
    correctOptionId: 'b',
    legalOrMethodRef: 'ПП РФ № 760',
    explanation:
      'Паспорт маршрута по ПП РФ № 760 содержит нитку, категорию сложности, расчёт времени, опасные участки, точки связи и запасные варианты выхода.',
    studyHint: 'Разберите обязательные разделы паспорта маршрута по форме ПП РФ № 760.',
    kbQuery: 'паспорт',
  },
  {
    id: 'route-mchs-deadline',
    sectionId: 'routing',
    prompt:
      'В какой срок до начала туристского маршрута, требующего сопровождения, необходимо направить уведомление в территориальный орган МЧС России?',
    options: [
      { id: 'a', label: 'Не позднее чем за 10 рабочих дней до начала путешествия' },
      { id: 'b', label: 'В течение 3 суток после возвращения группы с маршрута' },
      { id: 'c', label: 'Ровно за 2 часа до выхода, если на маршруте есть сотовая связь' },
      { id: 'd', label: 'Регистрация в МЧС обязательна только в зимний период' },
    ],
    correctOptionId: 'a',
    legalOrMethodRef: 'Порядок информирования территориальных органов МЧС России',
    explanation:
      'Уведомление направляется не позднее чем за 10 рабочих дней до выхода группы на маршрут, чтобы спасательные службы зафиксировали состав, нитку и контрольный срок.',
    studyHint: 'Закрепите регламент регистрации туристских групп в МЧС и контрольные сроки снятия с учёта.',
    kbQuery: 'МЧС',
  },
  {
    id: 'route-oopt-regime',
    sectionId: 'routing',
    prompt:
      'Если туристский маршрут проходит через территорию государственного природного заповедника или национального парка ДФО, какое действие обязательно перед выходом?',
    options: [
      { id: 'a', label: 'Достаточно устного разрешения инспектора на ближайшем кордоне в день выхода' },
      { id: 'b', label: 'Оформить официальное разрешение на посещение ООПТ с учётом установленной рекреационной ёмкости и режима зоны' },
      { id: 'c', label: 'Аттестованные проводники освобождены от пропусков и соблюдения границ зонирования' },
      { id: 'd', label: 'Согласование требуется только если в группе более 25 человек' },
    ],
    correctOptionId: 'b',
    legalOrMethodRef: 'ФЗ № 33-ФЗ «Об ООПТ»',
    explanation:
      'На территории ООПТ действуют строгие границы функциональных зон и лимиты антропогенной нагрузки — проход допускается только по разрешению администрации ООПТ и утверждённым тропам.',
    studyHint: 'Повторите требования ФЗ № 33-ФЗ о зонировании ООПТ и пропускном режиме.',
    kbQuery: 'ООПТ',
  },

  // 3. Первая помощь (WFA) и спасработы (ПСР)
  {
    id: 'aid-hypothermia',
    sectionId: 'first_aid',
    prompt:
      'У участника группы на ветреном перевале нарастает апатия, речь стала замедленной, мышечная дрожь прекратилась (признак прогрессирующей гипотермии). Какова правильная тактика?',
    options: [
      { id: 'a', label: 'Растереть конечности снегом или спиртом и дать горячий крепкий кофе' },
      { id: 'b', label: 'Заставить участника быстро бежать вверх по склону, чтобы согреться' },
      { id: 'c', label: 'Укрыть от ветра и влаги, сменить мокрую одежду на сухую, изолировать от грунта и аккуратно согревать корпус (пассивное и мягкое активное согревание туловища)' },
      { id: 'd', label: 'Сразу погрузить в максимально горячую воду и активно массировать руки и ноги' },
    ],
    correctOptionId: 'c',
    legalOrMethodRef: 'Протокол WFA · Помощь при переохлаждении',
    explanation:
      'При умеренной и тяжёлой гипотермии резкое согревание конечностей или интенсивная нагрузка вызывают приток холодной крови к сердцу (afterdrop). Изоляция от холода/влаги и бережное согревание корпуса — базовый стандарт.',
    studyHint: 'Повторите признаки стадий переохлаждения и запрещённые приёмы (растирания, алкоголь, резкая нагрузка).',
    kbQuery: 'первая помощь',
  },
  {
    id: 'aid-kit-rules',
    sectionId: 'first_aid',
    prompt:
      'Какой принцип действует для групповой аптечки инструктора-проводника при оказании первой помощи на маршруте в РФ?',
    options: [
      { id: 'a', label: 'Проводник обязан иметь рецептурные антибиотики и делать внутривенные инъекции всем участникам по своему решению' },
      { id: 'b', label: 'Комплектация отвечает требованиям к оказанию первой помощи (перевязочные, жгут, средства иммобилизации, термоодеяло, антисептики); проводник без медобразования не назначает рецептурные препараты' },
      { id: 'c', label: 'Аптечку носит каждый турист сам, групповая укладка проводнику не требуется' },
      { id: 'd', label: 'Достаточно одного эластичного бинта и пластыря на группу до 15 человек' },
    ],
    correctOptionId: 'b',
    legalOrMethodRef: 'ФЗ № 323-ФЗ ст. 31 · Перечень состояний первой помощи',
    explanation:
      'Первая помощь юридически отделена от медицинской помощи: укладка проводника комплектуется для остановки кровотечений, обработки ран, иммобилизации, защиты от холода и фиксации СЛР, без самовольного назначения лекарств.',
    studyHint: 'Изучите разницу между первой помощью (ст. 31 ФЗ № 323-ФЗ) и медицинской помощью.',
    kbQuery: 'аптечка',
  },
  {
    id: 'aid-river-crossing',
    sectionId: 'first_aid',
    prompt:
      'Какое правило критически важно при переправе группы вброд через горную или таёжную реку с сильным течением?',
    options: [
      { id: 'a', label: 'Плотно затянуть поясной и грудной ремни рюкзака, чтобы рюкзак не болтался на спине' },
      { id: 'b', label: 'Расстегнуть поясной и грудной ремни рюкзака, переправляться со страховкой или шестом/«стенкой» ниже по течению не под прямым углом к потоку' },
      { id: 'c', label: 'Снимать обувь, чтобы лучше чувствовать камни босыми ногами' },
      { id: 'd', label: 'Переходить одновременно всей группой врассыпную без страховки' },
    ],
    correctOptionId: 'b',
    legalOrMethodRef: 'Методика ПСР ФСТР · Переправы',
    explanation:
      'Застёгнутый поясной ремень при падении в поток мешает сбросить рюкзак и может утянуть человека под воду. Обувь должна быть надета, а страховка и угол переправы подбираются с учётом сноса течением.',
    studyHint: 'Отработайте правила безопасной организации бродов и наведения навесной/перильной переправы.',
    kbQuery: 'спасработы',
  },

  // 4. Сопровождение группы и специфика ДФО
  {
    id: 'dfo-wildlife-encounter',
    sectionId: 'field_dfo',
    prompt:
      'При движении по таёжной тропе на юге Дальнего Востока группа заметила впереди бурого медведя или следы свежего выхода амурского тигра у добычи. Каковы правильные действия проводника?',
    options: [
      { id: 'a', label: 'Подпустить туристов поближе для фото, громко свистеть и бежать в сторону леса врассыпную' },
      { id: 'b', label: 'Остановить группу, собрать людей плотно вместе, исключить бегство и резкие движения, держать средства отпугивания наготове и медленно отступать, не поворачиваясь спиной' },
      { id: 'c', label: 'Бросить хищнику остатки продуктов, чтобы отвлечь его на время обеда' },
      { id: 'd', label: 'Разделить группу на одиночек и обходить участок разными оврагами' },
    ],
    correctOptionId: 'b',
    legalOrMethodRef: 'Регламент безопасности в ареале крупных хищников ДФО',
    explanation:
      'Бегство провоцирует инстинкт преследования, а прикормка закрепляет конфликтное поведение зверя. Группа должна визуально выглядеть единым крупным объектом и спокойно отойти с маршрута.',
    studyHint: 'Повторите протокол поведения группы при встрече с медведем и тигром и правила хранения продуктов в лагере.',
    kbQuery: 'безопасность',
  },
  {
    id: 'dfo-typhoon-river',
    sectionId: 'field_dfo',
    prompt:
      'На маршруте в Приморском крае или на Сахалине получено штормовое предупреждение о сильных ливнях (тайфун), а путь возврата пересекает паводкоопасную реку без моста. Какое решение обязан принять инструктор-проводник?',
    options: [
      { id: 'a', label: 'Продолжать движение по исходному графику любой ценой, чтобы уложиться в билеты на поезд' },
      { id: 'b', label: 'Прекратить движение через опасный участок, перевести группу на безопасный высокий берег или вывести по запасному варианту из паспорта маршрута и сообщить в МЧС / координатору' },
      { id: 'c', label: 'Поставить палатки на сухой песчаной косе прямо в русле реки до утра' },
      { id: 'd', label: 'Переложить принятие решения на голосование туристов и снять с себя ответственность' },
    ],
    correctOptionId: 'b',
    legalOrMethodRef: 'Методика управления группой в ЧС · ДФО',
    explanation:
      'В условиях муссонных ливней ДФО уровень воды в реках поднимается за считанные минуты. Проводник отвечает за жизнь группы, задействует запасной выход и информирует МЧС о смене графика.',
    studyHint: 'Изучите критерии схода с маршрута, выбор места бивака и использование запасных выходов.',
    kbQuery: 'ЧС',
  },
  {
    id: 'dfo-comms-control',
    sectionId: 'field_dfo',
    prompt:
      'Группа вышла за рамки планового времени прохождения контрольной точки в зоне отсутствия сотовой связи. Что должен предпринять проводник?',
    options: [
      { id: 'a', label: 'Не выходить на связь до конца похода, чтобы сэкономить заряд спутникового трекера' },
      { id: 'b', label: 'Передать сообщение о статусе, местоположении и новом расчётном времени по спутниковой связи (или через аварийный маяк при ЧС), не дожидаясь просрочки контрольного срока' },
      { id: 'c', label: 'Отправить одного самого быстрого туриста без снаряжения вперёд на поиск вышки связи' },
      { id: 'd', label: 'Удалить трек маршрута и изменить нитку без уведомления координатора' },
    ],
    correctOptionId: 'b',
    legalOrMethodRef: 'Протокол контрольных сроков связи',
    explanation:
      'Невыход на контрольную связь запускает поисково-спасательную операцию МЧС. Своевременная корректировка контрольного срока по спутниковой связи и запрет на разделение группы предотвращают ложную тревогу и ЧП.',
    studyHint: 'Проверьте регламент ведения контрольной связи и правило запрета разделения группы.',
    kbQuery: 'связь',
  },
];

const SECTION_LOOKUP = new Map<DiagnosticSectionId, DiagnosticSectionMeta>(
  DIAGNOSTIC_SECTIONS.map((s) => [s.id, s])
);

const QUESTION_LOOKUP = new Map<string, DiagnosticQuestion>(
  DIAGNOSTIC_QUESTIONS.map((q) => [q.id, q])
);

const VALID_OPTION_IDS: ReadonlySet<string> = new Set(['a', 'b', 'c', 'd']);

export function sanitizeDiagnosticAnswers(
  raw: unknown
): Partial<Record<string, DiagnosticOptionId>> {
  if (!raw || typeof raw !== 'object') return {};
  const result: Partial<Record<string, DiagnosticOptionId>> = {};
  for (const [qId, optId] of Object.entries(raw as Record<string, unknown>)) {
    if (QUESTION_LOOKUP.has(qId) && typeof optId === 'string' && VALID_OPTION_IDS.has(optId)) {
      result[qId] = optId as DiagnosticOptionId;
    }
  }
  return result;
}

export function sanitizeCheckedSections(
  raw: unknown
): Partial<Record<DiagnosticSectionId, boolean>> {
  if (!raw || typeof raw !== 'object') return {};
  const result: Partial<Record<DiagnosticSectionId, boolean>> = {};
  for (const [secId, val] of Object.entries(raw as Record<string, unknown>)) {
    if (SECTION_LOOKUP.has(secId as DiagnosticSectionId) && val === true) {
      result[secId as DiagnosticSectionId] = true;
    }
  }
  return result;
}

export function createEmptyDiagnosticsState(): StoredDiagnosticsState {
  return {
    answers: {},
    checkedSections: {},
    activeStep: 1,
    updatedAt: null,
  };
}

function getStorageKey(userId?: string | null): string {
  return `rca_attestation_diagnostics_v1_${userId && userId.trim() ? userId.trim() : 'guest'}`;
}

export function readStoredDiagnosticsState(userId?: string | null): StoredDiagnosticsState {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return createEmptyDiagnosticsState();
  }
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return createEmptyDiagnosticsState();
    const parsed = JSON.parse(raw) as Partial<StoredDiagnosticsState>;
    const maxStep = DIAGNOSTIC_SECTIONS.length + 1;
    const step =
      typeof parsed.activeStep === 'number' &&
      Number.isInteger(parsed.activeStep) &&
      parsed.activeStep >= 1 &&
      parsed.activeStep <= maxStep
        ? parsed.activeStep
        : 1;
    return {
      answers: sanitizeDiagnosticAnswers(parsed.answers),
      checkedSections: sanitizeCheckedSections(parsed.checkedSections),
      activeStep: step,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    };
  } catch {
    return createEmptyDiagnosticsState();
  }
}

export function writeStoredDiagnosticsState(
  userId: string | null | undefined,
  state: StoredDiagnosticsState
): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

export function evaluateAttestationDiagnostics(
  rawAnswers: Partial<Record<string, string>>
): AttestationDiagnosticsEvaluation {
  const answers = sanitizeDiagnosticAnswers(rawAnswers);

  const sections: DiagnosticSectionResult[] = DIAGNOSTIC_SECTIONS.map((meta) => {
    const sectionQuestions = DIAGNOSTIC_QUESTIONS.filter((q) => q.sectionId === meta.id);
    let answeredCount = 0;
    let correctCount = 0;
    const missedQuestions: MissedQuestionInsight[] = [];

    for (const q of sectionQuestions) {
      const selected = answers[q.id];
      const correctOption = q.options.find((o) => o.id === q.correctOptionId);
      if (selected) {
        answeredCount += 1;
        if (selected === q.correctOptionId) {
          correctCount += 1;
        } else {
          const selectedOption = q.options.find((o) => o.id === selected);
          missedQuestions.push({
            questionId: q.id,
            prompt: q.prompt,
            selectedOptionLabel: selectedOption?.label ?? null,
            correctOptionLabel: correctOption?.label ?? '',
            studyHint: q.studyHint,
            legalOrMethodRef: q.legalOrMethodRef,
            kbQuery: q.kbQuery,
          });
        }
      } else {
        missedQuestions.push({
          questionId: q.id,
          prompt: q.prompt,
          selectedOptionLabel: null,
          correctOptionLabel: correctOption?.label ?? '',
          studyHint: q.studyHint,
          legalOrMethodRef: q.legalOrMethodRef,
          kbQuery: q.kbQuery,
        });
      }
    }

    const totalCount = sectionQuestions.length;
    const scorePercent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

    let status: DiagnosticSectionStatus;
    let statusLabel: string;
    let recommendationTitle: string;
    let recommendationText: string;
    let recommendedStudyHours: number;

    if (scorePercent >= 80) {
      status = 'strong';
      statusLabel = 'Сильная база';
      recommendationTitle = meta.title;
      recommendationText = meta.strongText;
      recommendedStudyHours = 0;
    } else if (scorePercent >= 50) {
      status = 'moderate';
      statusLabel = 'Нужно закрепить';
      recommendationTitle = meta.moderateRecommendationTitle;
      recommendationText = meta.moderateRecommendationText;
      recommendedStudyHours = meta.estimatedModerateHours;
    } else {
      status = 'gap';
      statusLabel = 'Требуется подготовка';
      recommendationTitle = meta.gapRecommendationTitle;
      recommendationText = meta.gapRecommendationText;
      recommendedStudyHours = meta.estimatedGapHours;
    }

    return {
      id: meta.id,
      stepNumber: meta.stepNumber,
      title: meta.title,
      shortTitle: meta.shortTitle,
      description: meta.description,
      answeredCount,
      totalCount,
      correctCount,
      scorePercent,
      status,
      statusLabel,
      recommendationTitle,
      recommendationText,
      studyActions: meta.studyActions,
      recommendedStudyHours,
      kbQuery: meta.kbQuery,
      missedQuestions,
    };
  });

  const totalQuestions = DIAGNOSTIC_QUESTIONS.length;
  const answeredCount = sections.reduce((acc, s) => acc + s.answeredCount, 0);
  const unansweredCount = totalQuestions - answeredCount;
  const correctCount = sections.reduce((acc, s) => acc + s.correctCount, 0);
  const overallPercent =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const isComplete = answeredCount === totalQuestions;

  const incompleteSectionIds = sections
    .filter((s) => s.answeredCount < s.totalCount)
    .map((s) => s.id);

  // Order recommendations weakest-first so the candidate sees highest-impact topics first.
  const statusRank: Record<DiagnosticSectionStatus, number> = {
    gap: 0,
    moderate: 1,
    strong: 2,
  };
  const priorityRecommendations = [...sections].sort((a, b) => {
    const rankDiff = statusRank[a.status] - statusRank[b.status];
    if (rankDiff !== 0) return rankDiff;
    const scoreDiff = a.scorePercent - b.scorePercent;
    if (scoreDiff !== 0) return scoreDiff;
    return a.stepNumber - b.stepNumber;
  });

  const totalRecommendedHours = sections.reduce(
    (sum, sec) => sum + sec.recommendedStudyHours,
    0
  );

  let readinessTier: DiagnosticReadinessTier;
  let verdictLabel: string;
  let verdictTitle: string;
  let verdictSummary: string;
  let recommendedContour: string;

  if (answeredCount === 0) {
    readinessTier = 'incomplete';
    verdictLabel = 'Опрос не начат';
    verdictTitle = 'Пройдите 4 шага самодиагностики знаний';
    verdictSummary =
      'Ответьте на 12 практических вопросов по регламенту, паспортизации, первой помощи и тактике ДФО — система сформирует персональный план подготовки.';
    recommendedContour = 'Определится после прохождения опроса';
  } else if (!isComplete) {
    readinessTier = 'incomplete';
    verdictLabel = `Заполнено ${answeredCount} из ${totalQuestions}`;
    verdictTitle = 'Опрос завершён не полностью — предварительный расчёт';
    verdictSummary = `Сейчас верно решено ${correctCount} из ${answeredCount} отвеченных вопросов (${overallPercent}% от общего теста). Завершите оставшиеся разделы, чтобы получить точную оценку допуска к экзамену.`;
    recommendedContour = 'Предварительная оценка (завершите оставшиеся шаги)';
  } else if (overallPercent >= 80 && sections.every((s) => s.scorePercent >= 66)) {
    readinessTier = 'exam_ready';
    verdictLabel = 'Высокая готовность';
    verdictTitle = 'Знания соответствуют требованиям квалификационного экзамена';
    verdictSummary =
      'Вы уверенно ориентируетесь в нормативной базе ЕФРТА, паспорте маршрута № 760, первой помощи и специфике ДФО. Можно проверять пакет документов и выбирать ближайшую дату экзамена.';
    recommendedContour = 'Контур Б (при наличии стажа) или сдача экзамена после ДПО в Контуре А';
  } else if (overallPercent >= 50) {
    readinessTier = 'targeted_prep';
    verdictLabel = 'Нужна точечная подготовка';
    verdictTitle = 'База сформирована, но есть пробелы в отдельных разделах';
    verdictSummary =
      'Рекомендуем уделить 2–8 часов повторению слабых тем из списка ниже (особенно разделов с оценкой ниже 67%) перед подачей заявки на ближайшую экзаменационную сессию.';
    recommendedContour = 'Точечная самоподготовка + консультация перед экзаменом в РЦА';
  } else {
    readinessTier = 'dpo_recommended';
    verdictLabel = 'Рекомендуется обучение';
    verdictTitle = 'Перед экзаменом рекомендуется системная подготовка (ДПО или интенсивы)';
    verdictSummary =
      'Текущий уровень знаний по ключевым разделам недостаточен для уверенной сдачи аттестации. Оптимальный путь — пройти очно-заочную программу ДПО ВВГУ (Контур А) и практический тренинг WFA.';
    recommendedContour = 'Контур А (обучение по программе ДПО ВВГУ перед экзаменом)';
  }

  return {
    sections,
    totalQuestions,
    answeredCount,
    unansweredCount,
    correctCount,
    overallPercent,
    isComplete,
    readinessTier,
    verdictLabel,
    verdictTitle,
    verdictSummary,
    recommendedContour,
    totalRecommendedHours,
    priorityRecommendations,
    incompleteSectionIds,
  };
}
