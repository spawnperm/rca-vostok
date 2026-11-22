export interface DfoTrainingOffice {
  id: string;
  regionId: string;
  regionName: string;
  officeName: string;
  officeTypeLabel: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  hours: string;
  coordinatorName: string;
  coordinatorRole: string;
  trainingPrograms: string[];
  notes: string;
}

export const DFO_REGIONAL_TRAINING_OFFICES: DfoTrainingOffice[] = [
  {
    id: 'office-primorye-vvgu',
    regionId: 'primorye',
    regionName: 'Приморский край',
    officeName: 'Институт туризма и креативных индустрий ВВГУ · РЦА «Русский Восток»',
    officeTypeLabel: 'Головной центр подготовки и аттестации',
    city: 'г. Владивосток',
    address: '690014, г. Владивосток, ул. Гоголя, д. 41, ауд. 1612',
    phone: '+7 (423) 240-41-86',
    email: 'info@rca-vostok.ru',
    hours: 'Пн–Пт 09:00–18:00 (время Владивостока)',
    coordinatorName: 'Григорий Саранча',
    coordinatorRole: 'Руководитель РЦА «Русский Восток», доцент ВВГУ',
    trainingPrograms: [
      'ДПО «Инструктор-проводник: пешеходный туризм» (250 ч)',
      'ДПО «Водный туризм и сплавы» (договорные группы, 27 200 ₽)',
      'Модуль переаттестации действующих гидов (Контур А)',
    ],
    notes:
      'Очный приём документов, теоретическая подготовка, защита паспортов маршрутов и направление на полевой полигон в Шкотовском районе.',
  },
  {
    id: 'office-primorye-fstr',
    regionId: 'primorye',
    regionName: 'Приморский край',
    officeName: 'Учебно-методический отдел ФСТР Приморского края (полевой блок)',
    officeTypeLabel: 'Полевая подготовка и стажировки',
    city: 'Шкотовский округ / Владивосток',
    address: 'г. Владивосток, ул. Светланская, д. 147 (учебный штаб ФСТР ПК)',
    phone: '+7 (423) 226-74-15',
    email: 'primorye-fstr@rca-vostok.ru',
    hours: 'Вт–Сб 10:00–18:00 · выезды по графику полигона',
    coordinatorName: 'Дмитрий Верещагин',
    coordinatorRole: 'Старший инструктор-методист I категории ФСТР',
    trainingPrograms: [
      'Практикум спасработ на склонах и переправах (1–4 КС)',
      'Курс первой помощи в удалённой местности (WFA)',
      'Тренировка ориентирования и спутникового трекинга',
    ],
    notes:
      'Формирование практических смен перед выходом на аттестационный полигон хр. Ливадийский и р. Шкотовка.',
  },
  {
    id: 'office-khabarovsk-branch',
    regionId: 'khabarovsk',
    regionName: 'Хабаровский край',
    officeName: 'Хабаровское отделение подготовки инструкторов-проводников (ФСТР и ДПО)',
    officeTypeLabel: 'Региональное учебно-координационное отделение',
    city: 'г. Хабаровск',
    address: '680000, г. Хабаровск, ул. Карла Маркса, д. 68, офис 304',
    phone: '+7 (4212) 47-82-19',
    email: 'khabarovsk@rca-vostok.ru',
    hours: 'Пн–Пт 09:30–18:00',
    coordinatorName: 'Андрей Киселёв',
    coordinatorRole: 'Координатор подготовки выездных групп Хабаровского края',
    trainingPrograms: [
      'Теоретическая подготовка ДПО (дистанционно с ВВГУ)',
      'Спецкурс по горно-таёжным сплавам (реки Хор, Анюй)',
      'Предварительный аудит походных справок (Контур А)',
    ],
    notes:
      'Осуществляет предварительную сверку походного стажа, комплектование выездных потоков на сессии РЦА в Приморье и консультации туроператоров.',
  },
  {
    id: 'office-kamchatka-center',
    regionId: 'kamchatka',
    regionName: 'Камчатский край',
    officeName: 'Камчатский координационный центр подготовки и переаттестации гидов',
    officeTypeLabel: 'Региональный партнёрский центр подготовки',
    city: 'г. Петропавловск-Камчатский',
    address: '683000, г. Петропавловск-Камчатский, ул. Ленинская, д. 59, каб. 211',
    phone: '+7 (4152) 42-18-64',
    email: 'kamchatka@rca-vostok.ru',
    hours: 'Пн–Пт 09:00–17:30',
    coordinatorName: 'Наталья Соколова',
    coordinatorRole: 'Методист по переаттестации экспедиционных гидов ДФО',
    trainingPrograms: [
      'Интенсив подготовки к переаттестации по ПП РФ № 1893',
      'Горно-вулканическая безопасность и лавинная подготовка',
      'Медицина удалённых экспедиций и спутниковая связь',
    ],
    notes:
      'Помогает действующим камчатским гидам подготовить пакет документов по стажу и пройти межрегиональную аттестацию на площадке РЦА.',
  },
  {
    id: 'office-sakhalin-center',
    regionId: 'sakhalin',
    regionName: 'Сахалинская область (и Курилы)',
    officeName: 'Сахалинское отделение подготовки мультипрофильных проводников',
    officeTypeLabel: 'Региональная учебная площадка',
    city: 'г. Южно-Сахалинск',
    address: '693000, г. Южно-Сахалинск, Коммунистический пр., д. 39Б, оф. 12',
    phone: '+7 (4242) 31-05-48',
    email: 'sakhalin@rca-vostok.ru',
    hours: 'Пн–Пт 09:30–18:00',
    coordinatorName: 'Игорь Ткаченко',
    coordinatorRole: 'Руководитель направления горно-прибрежного туризма',
    trainingPrograms: [
      'Комбинированный трек «Пешеходный + водный туризм»',
      'Безопасность на прибрежных и курильских маршрутах',
      'Оценка гидрометеорологических рисков',
    ],
    notes:
      'Готовит проводников Сахалина и Курильских островов к прохождению модулей ДПО ВВГУ и совмещённой аттестации по 1–3 КС.',
  },
  {
    id: 'office-amur-center',
    regionId: 'amur',
    regionName: 'Амурская область',
    officeName: 'Амурский учебно-методический пункт подготовки проводников',
    officeTypeLabel: 'Региональный пункт подготовки',
    city: 'г. Благовещенск',
    address: '675000, г. Благовещенск, ул. Ленина, д. 104, ауд. 207',
    phone: '+7 (4162) 53-29-14',
    email: 'amur@rca-vostok.ru',
    hours: 'Пн–Пт 09:00–17:30',
    coordinatorName: 'Сергей Власов',
    coordinatorRole: 'Представитель межрегиональной коллегии инструкторов',
    trainingPrograms: [
      'Подготовка проводников речных сплавов (Зея, Бурея)',
      'Базовый модуль «Автомобильный и экспедиционный туризм»',
      'Дистанционный подготовительный поток ВВГУ',
    ],
    notes:
      'Консультирует соискателей Амурской области по дистанционному изучению теоретического блока и оформлению паспортов речных маршрутов.',
  },
  {
    id: 'office-yakutia-center',
    regionId: 'yakutia',
    regionName: 'Республика Саха (Якутия)',
    officeName: 'Якутское региональное отделение подготовки экспедиционных гидов',
    officeTypeLabel: 'Региональное отделение подготовки',
    city: 'г. Якутск',
    address: '677000, г. Якутск, пр. Ленина, д. 30, каб. 405',
    phone: '+7 (4112) 40-17-92',
    email: 'yakutia@rca-vostok.ru',
    hours: 'Пн–Пт 09:00–17:00',
    coordinatorName: 'Николай Прокопьев',
    coordinatorRole: 'Координатор северных и автономных маршрутов',
    trainingPrograms: [
      'Автономные пешие и водные маршруты (Ленские столбы, Сунтар-Хаята)',
      'Работа при низких температурах и ПСР на удалённых участках',
      'Подготовка паспортов маршрутов для ООПТ Якутии',
    ],
    notes:
      'Сопровождает соискателей Республики Саха при прохождении онлайн-лекций ДПО ВВГУ и подаче документов на весенне-летние сессии РЦА.',
  },
  {
    id: 'office-magadan-chukotka',
    regionId: 'magadan-chukotka',
    regionName: 'Магаданская область и Чукотка',
    officeName: 'Северо-Восточный координационный пункт подготовки гидов-экспедиционеров',
    officeTypeLabel: 'Координационный пункт (Магадан · Анадырь)',
    city: 'г. Магадан',
    address: '685000, г. Магадан, ул. Портовая, д. 8, оф. 18',
    phone: '+7 (4132) 62-44-09',
    email: 'northeast@rca-vostok.ru',
    hours: 'Пн–Пт 10:00–17:30',
    coordinatorName: 'Виктор Осипов',
    coordinatorRole: 'Куратор экспедиционной подготовки Северо-Востока ДФО',
    trainingPrograms: [
      'Индивидуальный трек подготовки гидов-лидеров (малые группы 4–6 чел.)',
      'Экстренная эвакуация и спутниковый мониторинг маршрутов',
      'Предэкзаменационное консультирование для летней сессии РЦА',
    ],
    notes:
      'Организует точечную подготовку и дистанционное сопровождение гидов Магаданской области и Чукотского АО перед аттестацией в РЦА «Русский Восток».',
  },
];

export function getOfficesByRegionId(regionId: string): DfoTrainingOffice[] {
  return DFO_REGIONAL_TRAINING_OFFICES.filter((office) => office.regionId === regionId);
}

export interface ExpertMemberBrief {
  name: string;
  credential: string;
  focus: string;
}

export interface AttestationPointExpertGroup {
  id: string;
  shortName: string;
  pointName: string;
  pointKind: 'headquarters' | 'field_polygon' | 'regional_point';
  pointKindLabel: string;
  regionId: string;
  regionName: string;
  city: string;
  venue: string;
  x: number;
  y: number;
  labelDx: number;
  labelDy: number;
  labelAnchor: 'start' | 'middle' | 'end';
  expertGroup: {
    groupCode: string;
    groupTitle: string;
    chairName: string;
    chairRole: string;
    experts: ExpertMemberBrief[];
    disciplines: string[];
    capacityNote: string;
    nextExamWindow: string;
    protocolStandard: string;
  };
}

export const DFO_ATTESTATION_POINTS: AttestationPointExpertGroup[] = [
  {
    id: 'ap-vladivostok-vvgu',
    shortName: 'Владивосток · ВВГУ',
    pointName: 'Головной центр аттестации РЦА «Русский Восток» (ВВГУ)',
    pointKind: 'headquarters',
    pointKindLabel: 'Головной экзаменационный центр',
    regionId: 'primorye',
    regionName: 'Приморский край',
    city: 'г. Владивосток',
    venue: 'ул. Гоголя, д. 41, кампус ВВГУ (Институт туризма и креативных индустрий)',
    x: 336,
    y: 382,
    labelDx: -12,
    labelDy: 14,
    labelAnchor: 'end',
    expertGroup: {
      groupCode: 'ЭГ-01 · Приморье (ВВГУ)',
      groupTitle: 'Главная аттестационная комиссия РЦА и ФСТР',
      chairName: 'Галина Гомилевская',
      chairRole: 'Председатель комиссии, директор ИТКИ ВВГУ',
      experts: [
        {
          name: 'Галина Гомилевская',
          credential: 'д.э.н. / Директор ИТКИ ВВГУ',
          focus: 'Нормативное регулирование, ДПО и защита паспортов маршрутов',
        },
        {
          name: 'Григорий Саранча',
          credential: 'Доцент ВВГУ · Эксперт ФСТР',
          focus: 'Координация аттестации ДФО, зачёт стажа (Контур А)',
        },
        {
          name: 'Елена Морозова',
          credential: 'Эксперт ООПТ и Wilderness First Aid',
          focus: 'Теоретический контроль первой помощи и связи',
        },
      ],
      disciplines: ['Пешеходный 1–4 КС', 'Водный 1–4 КС', 'Горный туризм', 'Защита паспортов (ПП № 760)'],
      capacityNote: 'До 30 соискателей за поток · теория, тестирование и документарный аудит',
      nextExamWindow: '14–19 декабря 2026 · 16–18 апреля 2027',
      protocolStandard: 'ФЗ № 132-ФЗ · ПП РФ № 1003 и № 1893 · Выгрузка в Единый реестр МЭР РФ',
    },
  },
  {
    id: 'ap-shkotovo-polygon',
    shortName: 'Шкотовский полигон',
    pointName: 'Полевой аттестационный полигон «Шкотовский» (Пидан — р. Шкотовка)',
    pointKind: 'field_polygon',
    pointKindLabel: 'Полевой полигон испытаний',
    regionId: 'primorye',
    regionName: 'Приморский край',
    city: 'Шкотовский округ',
    venue: 'Горно-таёжный массив хр. Ливадийский и р. Шкотовка / Артемовка',
    x: 367,
    y: 368,
    labelDx: 12,
    labelDy: 4,
    labelAnchor: 'start',
    expertGroup: {
      groupCode: 'ЭГ-02 · Полевой полигон',
      groupTitle: 'Полевая экзаменационная группа по спасработам и тактике',
      chairName: 'Григорий Саранча',
      chairRole: 'Руководитель полевого этапа, эксперт ФСТР',
      experts: [
        {
          name: 'Григорий Саранча',
          credential: 'Руководитель РЦА «Русский Восток»',
          focus: 'Руководство группой на рельефе и ориентирование без связи',
        },
        {
          name: 'Дмитрий Верещагин',
          credential: 'Инструктор-методист I кат. ФСТР',
          focus: 'Навесные и водные переправы, спасработы на горной реке',
        },
        {
          name: 'Елена Морозова',
          credential: 'Инструктор WFA',
          focus: 'Иммобилизация, транспортировка пострадавшего, Garmin inReach',
        },
      ],
      disciplines: ['Полевой экзамен 1–4 КС', 'Навесные и брод-переправы', 'ПСР и WFA'],
      capacityNote: 'Малые экзаменационные подгруппы по 6–8 человек на 3 контрольных рубежах',
      nextExamWindow: '16–18 апреля 2027 · 14–16 мая 2027',
      protocolStandard: 'Практический этап РЦА и ФСТР · Верификация по нормативу ПП РФ № 1893',
    },
  },
  {
    id: 'ap-bikin-oopt',
    shortName: 'Нацпарк «Бикин»',
    pointName: 'Северная точка испытаний ООПТ «Бикин» (с. Красный Яр)',
    pointKind: 'field_polygon',
    pointKindLabel: 'Полигон ООПТ и таёжных сплавов',
    regionId: 'primorye',
    regionName: 'Приморский край (Север)',
    city: 'с. Красный Яр, Пожарский округ',
    venue: 'Визит-центр Национального парка «Бикин» и речной полигон',
    x: 356,
    y: 326,
    labelDx: 12,
    labelDy: -6,
    labelAnchor: 'start',
    expertGroup: {
      groupCode: 'ЭГ-03 · ООПТ и Бикин',
      groupTitle: 'Специализированная экспертная группа режимов ООПТ',
      chairName: 'Елена Морозова',
      chairRole: 'Координатор экотроп Сихотэ-Алиня и безопасности ООПТ',
      experts: [
        {
          name: 'Елена Морозова',
          credential: 'Методист стандартов допуска ООПТ',
          focus: 'Протоколы безопасности в ареале амурского тигра и бурого медведя',
        },
        {
          name: 'Дмитрий Верещагин',
          credential: 'Экзаменатор водного блока ФСТР',
          focus: 'Управление группой на таёжных сплавах 1–3 КС',
        },
      ],
      disciplines: ['Водно-таёжные маршруты', 'Экологический туризм ООПТ', 'Радио- и спутниковая связь'],
      capacityNote: 'Выездная сессия 10–12 проводников (включая гидов из числа КМНС)',
      nextExamWindow: 'Июнь 2027 (по согласованию с дирекцией нацпарка)',
      protocolStandard: 'Регламент Минприроды РФ и Центра «Амурский тигр» + стандарт ФСТР',
    },
  },
  {
    id: 'ap-khabarovsk',
    shortName: 'Хабаровск',
    pointName: 'Выездная аттестационная точка · Хабаровский край',
    pointKind: 'regional_point',
    pointKindLabel: 'Межрегиональная точка приёма',
    regionId: 'khabarovsk',
    regionName: 'Хабаровский край',
    city: 'г. Хабаровск',
    venue: 'Региональный штаб ФСТР Хабаровского края (сверка) + выезд на полигон РЦА',
    x: 342,
    y: 248,
    labelDx: -12,
    labelDy: -6,
    labelAnchor: 'end',
    expertGroup: {
      groupCode: 'ЭГ-04 · Хабаровский поток',
      groupTitle: 'Объединённая выездная экспертная группа (ВВГУ + ФСТР Хабаровск)',
      chairName: 'Григорий Саранча',
      chairRole: 'Куратор межрегиональной комиссии',
      experts: [
        {
          name: 'Григорий Саранча',
          credential: 'Руководитель РЦА «Русский Восток»',
          focus: 'Итоговая аттестационная оценка хабаровских потоков',
        },
        {
          name: 'Андрей Киселёв',
          credential: 'Эксперт ФСТР Хабаровского края',
          focus: 'Предварительный разбор маршрутных книжек и справок о стаже',
        },
      ],
      disciplines: ['Горно-таёжные сплавы', 'Пешеходный 1–3 КС', 'Шантарский и Дуссе-Алиньский кластеры'],
      capacityNote: 'Группы по 8–15 чел. (в окт. 2026 аттестованы 9 хабаровских гидов)',
      nextExamWindow: 'Февраль–март 2027 · 16–18 апреля 2027',
      protocolStandard: 'Межрегиональный протокол РЦА «Русский Восток» · Срок удостоверения 5 лет',
    },
  },
  {
    id: 'ap-kamchatka',
    shortName: 'Петропавловск-Камчатский',
    pointName: 'Ключевая точка переаттестации · Камчатский край',
    pointKind: 'regional_point',
    pointKindLabel: 'Партнёрская точка переаттестации',
    regionId: 'kamchatka',
    regionName: 'Камчатский край',
    city: 'г. Петропавловск-Камчатский',
    venue: 'Координационный узел камчатских гидов и туроператоров (Авачинско-Мутновский кластер)',
    x: 503,
    y: 172,
    labelDx: 12,
    labelDy: 4,
    labelAnchor: 'start',
    expertGroup: {
      groupCode: 'ЭГ-05 · Камчатка',
      groupTitle: 'Экспертная группа переаттестации горных и вулканических гидов',
      chairName: 'Галина Гомилевская',
      chairRole: 'Председатель итоговой комиссии ВВГУ',
      experts: [
        {
          name: 'Наталья Соколова',
          credential: 'Методист переаттестации гидов Камчатки',
          focus: 'Аудит экспедиционного стажа и договоров с туроператорами',
        },
        {
          name: 'Галина Гомилевская',
          credential: 'Председатель комиссии РЦА',
          focus: 'Защита паспортов вулканических маршрутов по ПП № 1893',
        },
        {
          name: 'Дмитрий Верещагин',
          credential: 'Старший экзаменатор ФСТР',
          focus: 'Оценка горно-спасательных компетенций 2–4 КС',
        },
      ],
      disciplines: ['Вулканические треки', 'Горный туризм 2–4 КС', 'Экспедиции малых групп (4–6 чел.)'],
      capacityNote: '343 гида в краевом реестре · выездные группы по 6–10 чел.',
      nextExamWindow: 'Февраль–март 2027 · 14–16 мая 2027',
      protocolStandard: 'ПП РФ № 1893 (переаттестация действующих гидов до/после 01.10.2026)',
    },
  },
  {
    id: 'ap-sakhalin',
    shortName: 'Южно-Сахалинск',
    pointName: 'Островная точка аттестации · Сахалин и Курилы',
    pointKind: 'regional_point',
    pointKindLabel: 'Островная площадка координации',
    regionId: 'sakhalin',
    regionName: 'Сахалинская область (и Курилы)',
    city: 'г. Южно-Сахалинск',
    venue: 'Учебно-координационная площадка Сахалинской области и Курильских маршрутов',
    x: 420,
    y: 298,
    labelDx: 12,
    labelDy: 4,
    labelAnchor: 'start',
    expertGroup: {
      groupCode: 'ЭГ-06 · Сахалин и Курилы',
      groupTitle: 'Экспертная группа комбинированных прибрежно-горных маршрутов',
      chairName: 'Дмитрий Верещагин',
      chairRole: 'Старший экзаменатор комбинированного и водного профиля',
      experts: [
        {
          name: 'Игорь Ткаченко',
          credential: 'Координатор Сахалинской площадки',
          focus: 'Специфика ветро-волновой нагрузки, приливов и курильских переходов',
        },
        {
          name: 'Дмитрий Верещагин',
          credential: 'Эксперт I категории ФСТР',
          focus: 'Совмещённый зачёт «пешеходный + морской каякинг»',
        },
      ],
      disciplines: ['Пешеходный 1–3 КС', 'Морской каякинг и SUP', 'Комбинированные экспедиции'],
      capacityNote: 'Целевые мультипрофильные группы по 8–12 специалистов',
      nextExamWindow: '16–18 апреля 2027 (весенний поток РЦА)',
      protocolStandard: 'Стандарты ФСТР и МЧС по прибрежно-морской безопасности',
    },
  },
  {
    id: 'ap-yakutia',
    shortName: 'Якутск',
    pointName: 'Северная точка аттестации · Республика Саха (Якутия)',
    pointKind: 'regional_point',
    pointKindLabel: 'Северный экспедиционный узел',
    regionId: 'yakutia',
    regionName: 'Республика Саха (Якутия)',
    city: 'г. Якутск',
    venue: 'Координационный пункт НП «Ленские столбы» и дистанционный модуль ВВГУ',
    x: 204,
    y: 120,
    labelDx: 0,
    labelDy: -14,
    labelAnchor: 'middle',
    expertGroup: {
      groupCode: 'ЭГ-07 · Якутия (Север)',
      groupTitle: 'Экспертная группа северных и автономных экспедиционных треков',
      chairName: 'Елена Морозова',
      chairRole: 'Эксперт по автономному выживанию и ООПТ',
      experts: [
        {
          name: 'Николай Прокопьев',
          credential: 'Региональный эксперт Якутии',
          focus: 'Специфика длинных автономных маршрутов и холодового фактора',
        },
        {
          name: 'Елена Морозова',
          credential: 'Методист WFA и связи',
          focus: 'Оценка готовности к автономной медпомощи и спутниковой эвакуации',
        },
      ],
      disciplines: ['Автономные сплавы', 'Трекинг ООПТ «Ленские столбы»', 'Экстремальная медицина WFA'],
      capacityNote: 'Дистанционная теория в ВВГУ + очная аттестация в майском потоке',
      nextExamWindow: '14–16 мая 2027',
      protocolStandard: 'ПП РФ № 1893 · Повышенный стандарт автономности и связи',
    },
  },
];

export function filterAttestationPoints(
  kindFilter: 'all' | AttestationPointExpertGroup['pointKind']
): AttestationPointExpertGroup[] {
  if (kindFilter === 'all') return DFO_ATTESTATION_POINTS;
  return DFO_ATTESTATION_POINTS.filter((p) => p.pointKind === kindFilter);
}

export interface AccreditationRegistryEntry {
  id: string;
  category: 'education' | 'attestation' | 'registry';
  categoryLabel: string;
  documentName: string;
  registryNumber: string;
  legalNorm: string;
  issuingAuthority: string;
  scopeAndTerms: string;
  validUntil: string;
  status: 'active' | 'updated_2026' | 'in_progress';
  statusLabel: string;
}

export const ACCREDITATION_REGISTRY_ENTRIES: AccreditationRegistryEntry[] = [
  {
    id: 'reg-vvgu-dpo-license',
    category: 'education',
    categoryLabel: 'Образование ДПО (ВВГУ)',
    documentName: 'Государственная лицензия на образовательную деятельность (программы ДПО)',
    registryNumber: 'Реестр Рособрнадзора · ФГБОУ ВО «ВВГУ» (Л035-00115-25/00097028)',
    legalNorm: 'ФЗ № 273-ФЗ (ст. 76, ст. 91) · ПП РФ № 1490',
    issuingAuthority: 'Рособрнадзор РФ',
    scopeAndTerms:
      'Профпереподготовка «Инструктор-проводник» (пешеходный ≈250 ч, водный — договорные места), выдача дипломов установленного образца с правом субсидирования до 70%.',
    validUntil: 'Бессрочно',
    status: 'active',
    statusLabel: 'Действует',
  },
  {
    id: 'reg-rca-fstr-authority',
    category: 'attestation',
    categoryLabel: 'Полномочия РЦА и ФСТР',
    documentName: 'Уполномоченный статус Регионального центра аттестации «Русский Восток»',
    registryNumber: 'Соглашение ВВГУ + ФСТР · Площадка Приморского края (rca-vostok.ru)',
    legalNorm: 'ФЗ № 132-ФЗ (ст. 4.4) · ПП РФ № 1003',
    issuingAuthority: 'Федерация спортивного туризма России (ФСТР) · Минтуризма ПК',
    scopeAndTerms:
      'Приём заявок, верификация стажа (Контур А), проведение теоретического и практического этапов аттестации 1–4 КС для соискателей всех субъектов ДФО.',
    validUntil: 'Действует (регулярный аудит)',
    status: 'active',
    statusLabel: 'Аккредитован',
  },
  {
    id: 'reg-pp1893-exam-update',
    category: 'attestation',
    categoryLabel: 'Полномочия РЦА и ФСТР',
    documentName: 'Соответствие экзаменационных билетов и полевых нормативов обновлённым правилам 2026 года',
    registryNumber: 'Протокол методического совета ВВГУ и ФСТР № 03-2026',
    legalNorm: 'Постановление Правительства РФ № 1893 (в силе с 01.03.2026)',
    issuingAuthority: 'Минэкономразвития РФ · Аттестационная комиссия ВВГУ',
    scopeAndTerms:
      'Обязательные блоки: паспорт маршрута (ПП № 760), Wilderness First Aid, спутниковые коммуникаторы, прохождение переаттестации действующих гидов.',
    validUntil: 'Актуализировано с 01.03.2026',
    status: 'updated_2026',
    statusLabel: 'Внедрено',
  },
  {
    id: 'reg-mer-federal-registry',
    category: 'registry',
    categoryLabel: 'Федеральный реестр и ПДн',
    documentName: 'Подключение к выгрузке сведений в Единый федеральный реестр инструкторов-проводников',
    registryNumber: 'Интеграционный контур МЭР РФ · Реестр Приморского края',
    legalNorm: 'Приказ Минэкономразвития РФ · ПП РФ № 1003',
    issuingAuthority: 'Министерство экономического развития РФ',
    scopeAndTerms:
      'Передача протоколов успешной аттестации (уже внесено 26 выпускников октябрьской сессии 2026 г.) и выпуск нагрудных идентификационных карт сроком на 5 лет.',
    validUntil: 'Срок записи: 5 лет',
    status: 'active',
    statusLabel: 'Верифицирован',
  },
  {
    id: 'reg-shkotovo-bikin-polygons',
    category: 'attestation',
    categoryLabel: 'Полномочия РЦА и ФСТР',
    documentName: 'Паспортизация полевых испытательных полигонов (Шкотовский р-н и ООПТ «Бикин»)',
    registryNumber: 'Акты пригодности полигонов ФСТР ПК № 14/2026',
    legalNorm: 'ФЗ № 132-ФЗ · Режимные регламенты ООПТ РФ',
    issuingAuthority: 'ФСТР Приморского края · Дирекция НП «Бикин»',
    scopeAndTerms:
      'Верифицированные природные площадки для проверки переправ, ориентирования на горно-таёжном рельефе и протоколов поведения в ареале крупных хищников.',
    validUntil: 'До 31.12.2028',
    status: 'active',
    statusLabel: 'Действует',
  },
  {
    id: 'reg-fz152-pdn-contour',
    category: 'registry',
    categoryLabel: 'Федеральный реестр и ПДн',
    documentName: 'Защищённый контур обработки персональных данных соискателей и слушателей ДПО',
    registryNumber: 'Реестр операторов ПДн (Роскомнадзор) · ВВГУ',
    legalNorm: 'ФЗ № 152-ФЗ «О персональных данных» · Приказ ФСТЭК № 21',
    issuingAuthority: 'Роскомнадзор РФ · Служба ИБ ВВГУ',
    scopeAndTerms:
      'Безопасный приём копий паспортов, справок о походном опыте, медицинских допусков и данных об уплате госпошлины без публикации в открытом доступе.',
    validUntil: 'Действует постоянно',
    status: 'active',
    statusLabel: 'Защищён',
  },
  {
    id: 'reg-autotourism-track-2027',
    category: 'education',
    categoryLabel: 'Образование ДПО (ВВГУ)',
    documentName: 'Лицензионное расширение модуля ДПО «Автомобильный и экспедиционный туризм»',
    registryNumber: 'Проект УМС Института туризма и креативных индустрий ВВГУ (2026–2027)',
    legalNorm: 'ФЗ № 273-ФЗ · Методические рекомендации ФСТР',
    issuingAuthority: 'Учебно-методический совет ВВГУ · Экспертный совет ФСТР',
    scopeAndTerms:
      'Утверждение учебного плана для гидов внедорожных и автоэкспедиционных туров ДФО (Приморье, Камчатка, Амурская область) к запуску в 2027 году.',
    validUntil: 'План запуска: I кв. 2027',
    status: 'in_progress',
    statusLabel: 'На согласовании',
  },
];

export function filterAccreditationEntries(
  category: 'all' | AccreditationRegistryEntry['category'],
  statusFilter: 'all' | AccreditationRegistryEntry['status'] = 'all'
): AccreditationRegistryEntry[] {
  return ACCREDITATION_REGISTRY_ENTRIES.filter((entry) => {
    if (category !== 'all' && entry.category !== category) return false;
    if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
    return true;
  });
}

export function getAccreditationSummaryStats(): {
  total: number;
  verifiedCount: number;
  inProgressCount: number;
} {
  const total = ACCREDITATION_REGISTRY_ENTRIES.length;
  const inProgressCount = ACCREDITATION_REGISTRY_ENTRIES.filter(
    (item) => item.status === 'in_progress'
  ).length;
  return {
    total,
    verifiedCount: total - inProgressCount,
    inProgressCount,
  };
}
