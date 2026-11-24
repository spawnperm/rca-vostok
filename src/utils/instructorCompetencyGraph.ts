export type CompetencyClusterId = 'law' | 'navigation' | 'safety' | 'specialization';

export type CompetencyProfileId = 'all' | 'hiking' | 'water' | 'expedition';

export type CompetencyRelationType = 'prerequisite' | 'synergy' | 'attestation';

export interface CompetencyClusterMeta {
  id: CompetencyClusterId;
  label: string;
  shortLabel: string;
  color: string;
  softBg: string;
  borderColor: string;
  textColor: string;
  anchorXRatio: number;
  anchorYRatio: number;
}

export interface CompetencyNodeDef {
  id: string;
  code: string;
  shortLabel: string;
  title: string;
  cluster: CompetencyClusterId;
  dpoHours: number;
  examWeightPct: number;
  legalRef: string;
  summary: string;
  skills: readonly string[];
  profiles: readonly Exclude<CompetencyProfileId, 'all'>[];
  actionTarget: 'exam' | 'glossary' | 'library';
}

export interface CompetencyEdgeDef {
  id: string;
  source: string;
  target: string;
  type: CompetencyRelationType;
  strength: 1 | 2 | 3;
  label: string;
}

export interface CompetencyGraphFilter {
  profile: CompetencyProfileId;
  clusters: readonly CompetencyClusterId[];
  relations: readonly CompetencyRelationType[];
  searchQuery?: string;
}

export interface ComputedCompetencyNode extends CompetencyNodeDef {
  clusterLabel: string;
  clusterColor: string;
  inDegree: number;
  outDegree: number;
  totalDegree: number;
  matchesFilter: boolean;
  matchesProfile: boolean;
  matchesSearch: boolean;
}

export interface ComputedCompetencyEdge extends CompetencyEdgeDef {
  matchesFilter: boolean;
}

export interface CompetencyNeighborItem {
  edgeId: string;
  node: CompetencyNodeDef;
  type: CompetencyRelationType;
  direction: 'incoming' | 'outgoing' | 'bidirectional';
  label: string;
  strength: 1 | 2 | 3;
}

export interface CompetencyConnectionsSummary {
  node: CompetencyNodeDef;
  cluster: CompetencyClusterMeta;
  prerequisites: CompetencyNeighborItem[];
  unlocks: CompetencyNeighborItem[];
  synergies: CompetencyNeighborItem[];
  attestationLinks: CompetencyNeighborItem[];
  totalConnections: number;
  neighborhoodHours: number;
}

export interface InstructorCompetencyGraphModel {
  nodes: ComputedCompetencyNode[];
  edges: ComputedCompetencyEdge[];
  activeNodeCount: number;
  activeEdgeCount: number;
  totalDpoHours: number;
  hubNodeId: string;
  clusterCounts: Record<CompetencyClusterId, number>;
}

export const COMPETENCY_CLUSTERS: readonly CompetencyClusterMeta[] = [
  {
    id: 'law',
    label: 'Право и регламент (НПА)',
    shortLabel: 'НПА и реестр',
    color: '#0F766E',
    softBg: '#F0FDFA',
    borderColor: '#99F6E4',
    textColor: '#115E59',
    anchorXRatio: 0.25,
    anchorYRatio: 0.28,
  },
  {
    id: 'navigation',
    label: 'Навигация и тактика маршрута',
    shortLabel: 'Навигация',
    color: '#0284C7',
    softBg: '#F0F9FF',
    borderColor: '#BAE6FD',
    textColor: '#075985',
    anchorXRatio: 0.74,
    anchorYRatio: 0.28,
  },
  {
    id: 'safety',
    label: 'Безопасность, ПСР и WFA',
    shortLabel: 'Безопасность',
    color: '#D97706',
    softBg: '#FFFBEB',
    borderColor: '#FDE68A',
    textColor: '#92400E',
    anchorXRatio: 0.74,
    anchorYRatio: 0.74,
  },
  {
    id: 'specialization',
    label: 'Профили 1–4 КС и руководство',
    shortLabel: 'Профили КС',
    color: '#1E40AF',
    softBg: '#EFF6FF',
    borderColor: '#BFDBFE',
    textColor: '#1E3A8A',
    anchorXRatio: 0.26,
    anchorYRatio: 0.74,
  },
] as const;

export const COMPETENCY_CLUSTER_MAP: Record<CompetencyClusterId, CompetencyClusterMeta> = {
  law: COMPETENCY_CLUSTERS[0],
  navigation: COMPETENCY_CLUSTERS[1],
  safety: COMPETENCY_CLUSTERS[2],
  specialization: COMPETENCY_CLUSTERS[3],
};

export const COMPETENCY_PROFILES: readonly {
  id: CompetencyProfileId;
  label: string;
  shortLabel: string;
  description: string;
}[] = [
  {
    id: 'all',
    label: 'Все профили подготовки',
    shortLabel: 'Все профили',
    description: 'Полная матрица компетенций инструктора-проводника РЦА «Русский Восток»',
  },
  {
    id: 'hiking',
    label: 'Пешеходный туризм (1–4 КС)',
    shortLabel: 'Пешеходный',
    description: 'Горно-таёжные маршруты Приморья, экотропы ООПТ и базовый курс ДПО ВВГУ 250 ч',
  },
  {
    id: 'water',
    label: 'Водный туризм и сплавы',
    shortLabel: 'Водный',
    description: 'Реки ДФО (Кема, Арму, Партизанская), чтение лоции, страховка и спасработы на воде',
  },
  {
    id: 'expedition',
    label: 'Автономные экспедиции (3–4 КС)',
    shortLabel: 'Экспедиционный',
    description: 'Удалённые районы ДФО, малые группы, спутниковая связь и расширенная WFA',
  },
] as const;

export const COMPETENCY_RELATION_META: Record<
  CompetencyRelationType,
  {
    id: CompetencyRelationType;
    label: string;
    shortLabel: string;
    stroke: string;
    dashArray?: string;
    description: string;
  }
> = {
  prerequisite: {
    id: 'prerequisite',
    label: 'Базовая опора (пререквизит)',
    shortLabel: 'Опора',
    stroke: '#0F766E',
    description: 'Направленная зависимость: освоение первой компетенции необходимо для следующей',
  },
  synergy: {
    id: 'synergy',
    label: 'Операционная связка в поле',
    shortLabel: 'Связка в поле',
    stroke: '#0284C7',
    description: 'Взаимное усиление навыков при принятии решений на реальном маршруте',
  },
  attestation: {
    id: 'attestation',
    label: 'Связка на аттестации РЦА',
    shortLabel: 'Экзамен РЦА',
    stroke: '#D97706',
    dashArray: '5 4',
    description: 'Компетенции оцениваются комиссией совместно в рамках билета или полигона',
  },
};

export const COMPETENCY_NODES: readonly CompetencyNodeDef[] = [
  {
    id: 'npa_efrta',
    code: 'НПА-01',
    shortLabel: 'ЕФРТА и ФЗ-132',
    title: 'Правовой статус и реестр ЕФРТА',
    cluster: 'law',
    dpoHours: 24,
    examWeightPct: 14,
    legalRef: 'ФЗ № 132-ФЗ · ПП РФ № 1003 (ред. № 1893)',
    summary:
      'Обязательность аттестации с 1 октября 2026 г., порядок внесения в Единый федеральный реестр, срок действия бейджа 5 лет и разграничение с деятельностью экскурсовода.',
    skills: [
      'Проверка статуса записи и QR-бейджа в ЕФРТА',
      'Разграничение ответственности гида и инструктора-проводника',
      'Оформление пакета досье для Контура А и Контура Б',
    ],
    profiles: ['hiking', 'water', 'expedition'],
    actionTarget: 'exam',
  },
  {
    id: 'route_passport',
    code: 'НПА-02',
    shortLabel: 'Паспорт ПП № 760',
    title: 'Паспортизация маршрута (ПП № 760)',
    cluster: 'law',
    dpoHours: 22,
    examWeightPct: 12,
    legalRef: 'ПП РФ № 760 · Методика ФСТР',
    summary:
      'Разработка технологической карты и паспорта туристского маршрута: расчёт рекреационной ёмкости, матрицы рисков, контрольных точек и аварийных выходов.',
    skills: [
      'Составление таблицы опасных участков и мер снижения риска',
      'Расчёт предельной численности и пропускной способности тропы',
      'Привязка эвакуационных коридоров и точек устойчивой связи',
    ],
    profiles: ['hiking', 'water', 'expedition'],
    actionTarget: 'exam',
  },
  {
    id: 'mchs_ksr',
    code: 'НПА-03',
    shortLabel: 'МЧС и КСР',
    title: 'Регистрация групп в МЧС и контроль КСР',
    cluster: 'law',
    dpoHours: 14,
    examWeightPct: 9,
    legalRef: 'Приказ МЧС России № 42 · Регламент КСР',
    summary:
      'Подача уведомления в территориальное управление МЧС не позднее чем за 10 рабочих дней, ведение журнала инструктажа по ТБ и регламент снятия с маршрута.',
    skills: [
      'Оформление заявки МЧС с указанием нитки, состава и КСР',
      'Протокол связи с координатором при изменении графика',
      'Документирование предпоходного инструктажа туристов',
    ],
    profiles: ['hiking', 'water', 'expedition'],
    actionTarget: 'glossary',
  },
  {
    id: 'oopt_mode',
    code: 'НПА-04',
    shortLabel: 'Режим ООПТ',
    title: 'Режим ООПТ и заповедников ДФО',
    cluster: 'law',
    dpoHours: 16,
    examWeightPct: 8,
    legalRef: 'ФЗ № 33-ФЗ · Регламенты нацпарков ДФО',
    summary:
      'Согласование маршрутов на особо охраняемых природных территориях Приморья («Земля леопарда», «Бикин», Лазовский и Сихотэ-Алиньский заповедники), лимиты посещения и экологический этикет.',
    skills: [
      'Оформление разрешений и пропусков для коммерческих групп',
      'Соблюдение санитарных и противопожарных правил стоянок',
      'Взаимодействие с государственными инспекторами ООПТ',
    ],
    profiles: ['hiking', 'expedition'],
    actionTarget: 'glossary',
  },
  {
    id: 'topo_nav',
    code: 'НАВ-01',
    shortLabel: 'Топография',
    title: 'Топография и автономное ориентирование',
    cluster: 'navigation',
    dpoHours: 26,
    examWeightPct: 11,
    legalRef: 'Программа ДПО ВВГУ · Раздел «Картография»',
    summary:
      'Чтение горизонталей и форм рельефа, движение по азимуту, привязка к линейным и точечным ориентирам в условиях густой тайги, курумника и приморского тумана.',
    skills: [
      'Работа с магнитным компасом и бумажной картой М 1:50 000',
      'Оценка крутизны склонов, седловин и водных преград по карте',
      'Выход на ориентир при потере видимости или отказе электроники',
    ],
    profiles: ['hiking', 'water', 'expedition'],
    actionTarget: 'library',
  },
  {
    id: 'gps_gpx',
    code: 'НАВ-02',
    shortLabel: 'GPX и ГЛОНАСС',
    title: 'Спутниковая навигация и GPX-треки',
    cluster: 'navigation',
    dpoHours: 16,
    examWeightPct: 7,
    legalRef: 'Стандарт ФСТР · Навигационное обеспечение',
    summary:
      'Загрузка офлайн-слоёв, запись и проверка GPX-треков, разметка точек водопоя, бивуака и вертолётных площадок, резервирование питания устройств.',
    skills: [
      'Импорт и валидация GPX-нитки перед выходом на маршрут',
      'Фиксация координат ЧС в формате WGS-84 для передачи в МЧС',
      'Энергоменеджмент навигаторов и трекеров в холодных условиях',
    ],
    profiles: ['hiking', 'water', 'expedition'],
    actionTarget: 'library',
  },
  {
    id: 'route_tactics',
    code: 'НАВ-03',
    shortLabel: 'Тактика и нитка',
    title: 'Тактика прохождения и запасные выходы',
    cluster: 'navigation',
    dpoHours: 22,
    examWeightPct: 10,
    legalRef: 'Правила видов спорта (спортивный туризм)',
    summary:
      'Расчёт ходового времени, питьевого и калорийного баланса, выбор графика привалов, назначение «точек невозврата» и аварийный сход с маршрута.',
    skills: [
      'Расчёт темпа группы по формуле Наисмита с учётом груза',
      'Принятие решения о развороте группы до наступления темноты',
      'Организация разведки сложных участков до подхода основной группы',
    ],
    profiles: ['hiking', 'water', 'expedition'],
    actionTarget: 'exam',
  },
  {
    id: 'meteo_dfo',
    code: 'НАВ-04',
    shortLabel: 'Метео ДФО',
    title: 'Метеоанализ и паводки ДФО',
    cluster: 'navigation',
    dpoHours: 14,
    examWeightPct: 7,
    legalRef: 'Региональный модуль ДФО · Прогноз рисков',
    summary:
      'Интерпретация синоптических карт, прогноз штормовых приливов, тайфунов, резких паводков на горных реках Приморья и обледенения на хребтах.',
    skills: [
      'Оценка угрозы дождевого паводка по скорости помутнения воды',
      'Чтение локальных признаков смены погоды на побережье и в горах',
      'Корректировка или отмена выхода при штормовом предупреждении',
    ],
    profiles: ['hiking', 'water', 'expedition'],
    actionTarget: 'library',
  },
  {
    id: 'wfa_first_aid',
    code: 'БЕЗ-01',
    shortLabel: 'Первая помощь WFA',
    title: 'Автономная первая помощь (WFA)',
    cluster: 'safety',
    dpoHours: 32,
    examWeightPct: 15,
    legalRef: 'Протокол WFA · Приказ Минздрава № 220н',
    summary:
      'Первичный и вторичный осмотр пострадавшего вдали от дорог, купирование гипотермии, иммобилизация травм конечностей, остановка кровотечений и мониторинг витальных функций.',
    skills: [
      'Алгоритм ABCDE и сортировка при множественных травмах',
      'Профилактика и вывод из умеренной гипотермии в полевых условиях',
      'Комплектация групповой аптечки под профиль и КС маршрута',
    ],
    profiles: ['hiking', 'water', 'expedition'],
    actionTarget: 'exam',
  },
  {
    id: 'psr_rescue',
    code: 'БЕЗ-02',
    shortLabel: 'ПСР и страховка',
    title: 'Поисково-спасательные работы (ПСР)',
    cluster: 'safety',
    dpoHours: 28,
    examWeightPct: 11,
    legalRef: 'Регламент полигонов РЦА · Техника ФСТР',
    summary:
      'Организация самовылаза и транспортировки пострадавшего на носилках/волокушах, наведение полиспастов, организация командной страховки на крутом рельефе.',
    skills: [
      'Вязка базовых и страховочных узлов (восьмёрка, булинь, схватывающий)',
      'Сборка полиспаста 3:1 для подъёма пострадавшего или снаряжения',
      'Изготовление импровизированных носилок из подручного снаряжения',
    ],
    profiles: ['hiking', 'water', 'expedition'],
    actionTarget: 'glossary',
  },
  {
    id: 'river_crossing',
    code: 'БЕЗ-03',
    shortLabel: 'Переправы и вода',
    title: 'Техника переправ и спасработы на реке',
    cluster: 'safety',
    dpoHours: 20,
    examWeightPct: 8,
    legalRef: 'Техника ФСТР · Методика безопасных переправ',
    summary:
      'Выбор створа переправы, движение «стенкой» и с шестом, работа с «морковкой» (спасброском), наведение перил и обязательный сброс поясного ремня рюкзака.',
    skills: [
      'Оценка скорости течения и безопасной глубины брода',
      'Прицельный бросок спас-конца с берега и приём пловца',
      'Наведение и натяжение навесной переправы через поток',
    ],
    profiles: ['hiking', 'water'],
    actionTarget: 'exam',
  },
  {
    id: 'wildlife_dfo',
    code: 'БЕЗ-04',
    shortLabel: 'Фауна и клещи ДФО',
    title: 'Безопасность при встрече с фауной ДФО',
    cluster: 'safety',
    dpoHours: 12,
    examWeightPct: 6,
    legalRef: 'Памятка ООПТ ДФО · СанПиН энцефалит',
    summary:
      'Профилактика конфликтов с бурым медведем и амурским тигром, герметизация продуктов, выбор бивуака вдали от звериных троп, акарицидная защита и осмотры от клещей.',
    skills: [
      'Подвес и герметизация провианта в таёжном лагере',
      'Поведение группы при визуальном контакте с хищником',
      'Профилактика клещевого энцефалита и тактика при укусе',
    ],
    profiles: ['hiking', 'expedition'],
    actionTarget: 'glossary',
  },
  {
    id: 'group_leadership',
    code: 'ПРОФ-01',
    shortLabel: 'Лидерство в группе',
    title: 'Психология и управление тургруппой',
    cluster: 'specialization',
    dpoHours: 18,
    examWeightPct: 7,
    legalRef: 'Модуль ВВГУ · Педагогика и конфликтология',
    summary:
      'Проведение предпоходного брифинга, контроль морально-психологического состояния участников, предотвращение расслоения группы и управление паникой при ЧС.',
    skills: [
      'Распределение ролей: направляющий, замыкающий, дежурные',
      'Адаптация нагрузки под разноуровневых коммерческих туристов',
      'Деэскалация конфликтов и чёткое командование при ЧС',
    ],
    profiles: ['hiking', 'water', 'expedition'],
    actionTarget: 'library',
  },
  {
    id: 'hiking_tech',
    code: 'ПРОФ-02',
    shortLabel: 'Пешеходный 1–4 КС',
    title: 'Пешеходный и горно-таёжный профиль',
    cluster: 'specialization',
    dpoHours: 48,
    examWeightPct: 10,
    legalRef: 'ДПО ВВГУ · Пешеходный туризм (250 ч)',
    summary:
      'Организация бивуака в сложных погодных условиях, техника передвижения по курумникам, осыпям и снежникам, прохождение маршрутов уровня Пидана, Фалазы, горы Облачной.',
    skills: [
      'Выбор безопасной террасы для лагеря вне зон паводка и сухостоя',
      'Движение по подвижным осыпям и влажному курумнику без травм',
      'Оформление маршрутной книжки и отчёта для защиты 1–4 КС',
    ],
    profiles: ['hiking'],
    actionTarget: 'exam',
  },
  {
    id: 'water_tech',
    code: 'ПРОФ-03',
    shortLabel: 'Водный профиль',
    title: 'Водный туризм и техника сплава',
    cluster: 'specialization',
    dpoHours: 52,
    examWeightPct: 10,
    legalRef: 'ДПО ВВГУ · Водный туризм (250 ч)',
    summary:
      'Чтение лоции порогов, управление рафтом и катамараном в шиверах и прижимах, постановка судна после оверкиля, береговая страховка на реках Приморья и ДФО.',
    skills: [
      'Разведка и просмотр порогов с берега перед прохождением',
      'Слаживание экипажа: команды гребли, крен, траверс струи',
      'Спасение экипажа и судна при киле в холодной воде',
    ],
    profiles: ['water'],
    actionTarget: 'exam',
  },
  {
    id: 'expedition_auto',
    code: 'ПРОФ-04',
    shortLabel: 'Автономные 3–4 КС',
    title: 'Автономные экспедиции и логистика ДФО',
    cluster: 'specialization',
    dpoHours: 40,
    examWeightPct: 9,
    legalRef: 'ДПО ВВГУ · Экспедиционный и автотуризм',
    summary:
      'Планирование многодневных экспедиций в удалённых районах ДФО, спутниковая связь (Iridium/InReach), работа малыми группами, заброска и эвакуационная логистика.',
    skills: [
      'Проектирование автономного рациона, топлива и резерва снаряжения',
      'Протокол двусторонней спутниковой связи и вызова санрейса',
      'Межведомственное взаимодействие на труднодоступных территориях',
    ],
    profiles: ['expedition'],
    actionTarget: 'library',
  },
] as const;

export const COMPETENCY_EDGES: readonly CompetencyEdgeDef[] = [
  // Prerequisites (направленная опора)
  {
    id: 'e-efrta-passport',
    source: 'npa_efrta',
    target: 'route_passport',
    type: 'prerequisite',
    strength: 3,
    label: 'Законодательная основа паспорта маршрута',
  },
  {
    id: 'e-passport-mchs',
    source: 'route_passport',
    target: 'mchs_ksr',
    type: 'prerequisite',
    strength: 3,
    label: 'Нитка, КСР и выходы из паспорта передаются в МЧС',
  },
  {
    id: 'e-topo-gps',
    source: 'topo_nav',
    target: 'gps_gpx',
    type: 'prerequisite',
    strength: 2,
    label: 'Понимание рельефа необходимо для чтения GPX-трека',
  },
  {
    id: 'e-topo-tactics',
    source: 'topo_nav',
    target: 'route_tactics',
    type: 'prerequisite',
    strength: 3,
    label: 'Расчёт хронометража и профиля высоты по карте',
  },
  {
    id: 'e-tactics-hiking',
    source: 'route_tactics',
    target: 'hiking_tech',
    type: 'prerequisite',
    strength: 3,
    label: 'Тактика переходов задаёт режим горно-таёжного похода',
  },
  {
    id: 'e-wfa-psr',
    source: 'wfa_first_aid',
    target: 'psr_rescue',
    type: 'prerequisite',
    strength: 3,
    label: 'Стабилизация пострадавшего до начала транспортировки',
  },
  {
    id: 'e-psr-water',
    source: 'psr_rescue',
    target: 'water_tech',
    type: 'prerequisite',
    strength: 2,
    label: 'Полиспасты и спасработы применяются при снятии судов',
  },
  {
    id: 'e-tactics-expedition',
    source: 'route_tactics',
    target: 'expedition_auto',
    type: 'prerequisite',
    strength: 2,
    label: 'График и точки невозврата критичны в автономе 3–4 КС',
  },

  // Synergies (операционная связка в поле)
  {
    id: 'e-meteo-river',
    source: 'meteo_dfo',
    target: 'river_crossing',
    type: 'synergy',
    strength: 3,
    label: 'Ливни и паводок напрямую меняют выбор створа переправы',
  },
  {
    id: 'e-meteo-water',
    source: 'meteo_dfo',
    target: 'water_tech',
    type: 'synergy',
    strength: 3,
    label: 'Уровень воды определяет категорию сложности порогов',
  },
  {
    id: 'e-oopt-wildlife',
    source: 'oopt_mode',
    target: 'wildlife_dfo',
    type: 'synergy',
    strength: 3,
    label: 'Регламенты нацпарков ДФО закрепляют защиту от конфликтов с фауной',
  },
  {
    id: 'e-gps-mchs',
    source: 'gps_gpx',
    target: 'mchs_ksr',
    type: 'synergy',
    strength: 2,
    label: 'Точные координаты WGS-84 ускоряют реагирование ПСО',
  },
  {
    id: 'e-leader-wfa',
    source: 'group_leadership',
    target: 'wfa_first_aid',
    type: 'synergy',
    strength: 2,
    label: 'Управление группой и предотвращение паники при травме',
  },
  {
    id: 'e-river-water',
    source: 'river_crossing',
    target: 'water_tech',
    type: 'synergy',
    strength: 3,
    label: 'Спасбросок и страховка с берега при сплавах',
  },
  {
    id: 'e-gps-expedition',
    source: 'gps_gpx',
    target: 'expedition_auto',
    type: 'synergy',
    strength: 3,
    label: 'Спутниковый трекинг и запасные выходы на севере ДФО',
  },
  {
    id: 'e-leader-tactics',
    source: 'group_leadership',
    target: 'route_tactics',
    type: 'synergy',
    strength: 2,
    label: 'Соразмерность темпа и физического состояния участников',
  },

  // Attestation links (совместная проверка на экзамене РЦА)
  {
    id: 'e-att-efrta-oopt',
    source: 'npa_efrta',
    target: 'oopt_mode',
    type: 'attestation',
    strength: 2,
    label: 'Проверка бейджа ЕФРТА и пропуска ООПТ в билетах НПА',
  },
  {
    id: 'e-att-passport-hiking',
    source: 'route_passport',
    target: 'hiking_tech',
    type: 'attestation',
    strength: 3,
    label: 'Защита паспорта маршрута № 760 на полигоне 1–4 КС',
  },
  {
    id: 'e-att-wildlife-hiking',
    source: 'wildlife_dfo',
    target: 'hiking_tech',
    type: 'attestation',
    strength: 2,
    label: 'Оценка выбора безопасного бивуака на таёжном полигоне',
  },
  {
    id: 'e-att-wfa-expedition',
    source: 'wfa_first_aid',
    target: 'expedition_auto',
    type: 'attestation',
    strength: 2,
    label: 'Кейсы автономной медэвакуации при аттестации 3–4 КС',
  },
  {
    id: 'e-att-psr-hiking',
    source: 'psr_rescue',
    target: 'hiking_tech',
    type: 'attestation',
    strength: 3,
    label: 'Полевой этап: вязка узлов, страховка и транспортировка',
  },
  {
    id: 'e-att-mchs-leader',
    source: 'mchs_ksr',
    target: 'group_leadership',
    type: 'attestation',
    strength: 2,
    label: 'Ситуационная задача по сходу группы и обновлению КСР',
  },
] as const;

const NODE_BY_ID = new Map<string, CompetencyNodeDef>(
  COMPETENCY_NODES.map((node) => [node.id, node])
);

export function getCompetencyNodeById(id: string): CompetencyNodeDef | undefined {
  return NODE_BY_ID.get(id);
}

export function buildInstructorCompetencyGraphModel(
  filter: CompetencyGraphFilter
): InstructorCompetencyGraphModel {
  const clusterSet = new Set<CompetencyClusterId>(filter.clusters);
  const relationSet = new Set<CompetencyRelationType>(filter.relations);
  const query = (filter.searchQuery ?? '').trim().toLowerCase();

  const inDegreeMap = new Map<string, number>();
  const outDegreeMap = new Map<string, number>();

  for (const node of COMPETENCY_NODES) {
    inDegreeMap.set(node.id, 0);
    outDegreeMap.set(node.id, 0);
  }

  for (const edge of COMPETENCY_EDGES) {
    if (!relationSet.has(edge.type)) continue;
    outDegreeMap.set(edge.source, (outDegreeMap.get(edge.source) ?? 0) + 1);
    inDegreeMap.set(edge.target, (inDegreeMap.get(edge.target) ?? 0) + 1);
    if (edge.type !== 'prerequisite') {
      outDegreeMap.set(edge.target, (outDegreeMap.get(edge.target) ?? 0) + 1);
      inDegreeMap.set(edge.source, (inDegreeMap.get(edge.source) ?? 0) + 1);
    }
  }

  const computedNodes: ComputedCompetencyNode[] = COMPETENCY_NODES.map((node) => {
    const clusterMeta = COMPETENCY_CLUSTER_MAP[node.cluster];
    const matchesCluster = clusterSet.has(node.cluster);
    const matchesProfile =
      filter.profile === 'all' || node.profiles.includes(filter.profile);
    const matchesSearch =
      query.length === 0 ||
      node.title.toLowerCase().includes(query) ||
      node.shortLabel.toLowerCase().includes(query) ||
      node.code.toLowerCase().includes(query) ||
      node.legalRef.toLowerCase().includes(query) ||
      node.summary.toLowerCase().includes(query) ||
      node.skills.some((skill) => skill.toLowerCase().includes(query));

    const inDegree = inDegreeMap.get(node.id) ?? 0;
    const outDegree = outDegreeMap.get(node.id) ?? 0;
    const totalDegree = inDegree + outDegree;

    return {
      ...node,
      clusterLabel: clusterMeta.label,
      clusterColor: clusterMeta.color,
      inDegree,
      outDegree,
      totalDegree,
      matchesProfile,
      matchesSearch,
      matchesFilter: matchesCluster && matchesProfile && matchesSearch,
    };
  });

  const activeNodeIdSet = new Set(
    computedNodes.filter((n) => n.matchesFilter).map((n) => n.id)
  );

  const computedEdges: ComputedCompetencyEdge[] = COMPETENCY_EDGES.map((edge) => ({
    ...edge,
    matchesFilter:
      relationSet.has(edge.type) &&
      activeNodeIdSet.has(edge.source) &&
      activeNodeIdSet.has(edge.target),
  }));

  const activeNodes = computedNodes.filter((n) => n.matchesFilter);
  const activeEdges = computedEdges.filter((e) => e.matchesFilter);

  const clusterCounts: Record<CompetencyClusterId, number> = {
    law: 0,
    navigation: 0,
    safety: 0,
    specialization: 0,
  };

  let totalDpoHours = 0;
  let hubNode = activeNodes[0] ?? computedNodes[0];

  for (const node of activeNodes) {
    clusterCounts[node.cluster] += 1;
    totalDpoHours += node.dpoHours;
    if (node.totalDegree > hubNode.totalDegree) {
      hubNode = node;
    }
  }

  return {
    nodes: computedNodes,
    edges: computedEdges,
    activeNodeCount: activeNodes.length,
    activeEdgeCount: activeEdges.length,
    totalDpoHours,
    hubNodeId: hubNode.id,
    clusterCounts,
  };
}

export function getCompetencyConnections(nodeId: string): CompetencyConnectionsSummary | null {
  const node = NODE_BY_ID.get(nodeId);
  if (!node) return null;

  const prerequisites: CompetencyNeighborItem[] = [];
  const unlocks: CompetencyNeighborItem[] = [];
  const synergies: CompetencyNeighborItem[] = [];
  const attestationLinks: CompetencyNeighborItem[] = [];
  const relatedNodeIds = new Set<string>([node.id]);

  for (const edge of COMPETENCY_EDGES) {
    if (edge.source !== node.id && edge.target !== node.id) continue;

    const otherId = edge.source === node.id ? edge.target : edge.source;
    const otherNode = NODE_BY_ID.get(otherId);
    if (!otherNode) continue;

    relatedNodeIds.add(otherNode.id);

    if (edge.type === 'prerequisite') {
      if (edge.target === node.id) {
        prerequisites.push({
          edgeId: edge.id,
          node: otherNode,
          type: edge.type,
          direction: 'incoming',
          label: edge.label,
          strength: edge.strength,
        });
      } else {
        unlocks.push({
          edgeId: edge.id,
          node: otherNode,
          type: edge.type,
          direction: 'outgoing',
          label: edge.label,
          strength: edge.strength,
        });
      }
    } else if (edge.type === 'synergy') {
      synergies.push({
        edgeId: edge.id,
        node: otherNode,
        type: edge.type,
        direction: 'bidirectional',
        label: edge.label,
        strength: edge.strength,
      });
    } else {
      attestationLinks.push({
        edgeId: edge.id,
        node: otherNode,
        type: edge.type,
        direction: 'bidirectional',
        label: edge.label,
        strength: edge.strength,
      });
    }
  }

  let neighborhoodHours = 0;
  for (const id of relatedNodeIds) {
    neighborhoodHours += NODE_BY_ID.get(id)?.dpoHours ?? 0;
  }

  return {
    node,
    cluster: COMPETENCY_CLUSTER_MAP[node.cluster],
    prerequisites,
    unlocks,
    synergies,
    attestationLinks,
    totalConnections:
      prerequisites.length + unlocks.length + synergies.length + attestationLinks.length,
    neighborhoodHours,
  };
}
