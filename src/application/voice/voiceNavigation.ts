import type { PermissionCode } from '../../domain/iam/rbac.ts';
import type { PortalSectionId } from '../../presentation/types.ts';

export interface VoiceSectionRule {
  id: PortalSectionId;
  label: string;
  sampleCommand: string;
  exactPhrases: string[];
  keywords: string[];
}

export type DealPriorityLevel = 'Высокий' | 'Средний' | 'Низкий';

export interface VoiceActionPayload {
  stageQuery?: string;
  priority?: DealPriorityLevel;
  ownerQuery?: string;
  dealQuery?: string;
}

export type VoiceSectionActionId =
  | 'deals.create_deal'
  | 'deals.create_pipeline'
  | 'deals.view_kanban'
  | 'deals.view_list'
  | 'deals.view_gantt'
  | 'deals.view_analytics'
  | 'deals.ai_scoring'
  | 'deals.move_stage'
  | 'deals.set_priority'
  | 'deals.assign_owner'
  | 'deals.import'
  | 'deals.refresh'
  | 'tasks.create_task'
  | 'tasks.filter_open'
  | 'tasks.filter_overdue'
  | 'tasks.filter_completed'
  | 'tasks.filter_all'
  | 'tasks.refresh'
  | 'calendar.create_event'
  | 'calendar.filter_meetings'
  | 'calendar.filter_all'
  | 'calendar.refresh'
  | 'contacts.create_contact'
  | 'contacts.create_company'
  | 'contacts.tab_contacts'
  | 'contacts.tab_companies'
  | 'contacts.open_appearance'
  | 'contacts.open_schema_editor'
  | 'contacts.open_import'
  | 'contacts.refresh'
  | 'dashboard.refresh'
  | 'chat.create_channel'
  | 'chat.refresh'
  | 'profile.create_group'
  | 'profile.tab_wall'
  | 'profile.tab_about'
  | 'profile.tab_team'
  | 'profile.tab_groups'
  | 'profile.refresh'
  | 'templates.create_template'
  | 'templates.refresh'
  | 'office.create_document'
  | 'office.tab_univer'
  | 'office.tab_garage'
  | 'office.tab_forgejo'
  | 'office.refresh'
  | 'collections.create_collection'
  | 'collections.create_record'
  | 'collections.create_field'
  | 'collections.view_table'
  | 'collections.view_kanban'
  | 'collections.view_calendar'
  | 'collections.view_directus'
  | 'collections.refresh'
  | 'workflows.create_workflow'
  | 'workflows.create_approval'
  | 'workflows.tab_workflows'
  | 'workflows.tab_approvals'
  | 'workflows.tab_nats'
  | 'workflows.refresh'
  | 'marketplace.tab_catalog'
  | 'marketplace.tab_modules'
  | 'marketplace.publish_plugin'
  | 'marketplace.refresh'
  | 'admin.create_tenant'
  | 'admin.create_role'
  | 'admin.create_cms'
  | 'admin.tab_tenancy'
  | 'admin.tab_rbac'
  | 'admin.tab_cms'
  | 'admin.tab_health'
  | 'devtools.tab_harness'
  | 'devtools.tab_scalar'
  | 'devtools.tab_archify'
  | 'devtools.tab_storybook'
  | 'devtools.refresh';

export interface VoiceSectionActionRule {
  id: VoiceSectionActionId;
  sectionId: PortalSectionId;
  label: string;
  sampleCommand: string;
  exactPhrases: string[];
  /** Each inner array is a synonym group of token prefixes; all groups must match. */
  tokenGroups?: string[][];
  requiredAnyPermissions?: PermissionCode[];
}

export const VOICE_SECTION_RULES: VoiceSectionRule[] = [
  {
    id: 'deals',
    label: 'Сделки',
    sampleCommand: 'Перейти к сделкам',
    exactPhrases: ['сделки', 'воронка', 'воронка продаж', 'амосрм', 'amocrm', 'deals', 'pipeline'],
    keywords: ['сделк', 'сделок', 'воронк', 'amocrm', 'амосрм', 'pipeline', 'deal'],
  },
  {
    id: 'calendar',
    label: 'Календарь',
    sampleCommand: 'Открыть календарь',
    exactPhrases: ['календарь', 'расписание', 'встречи', 'calendar', 'schedule'],
    keywords: ['календар', 'расписан', 'встреч', 'calendar', 'schedule'],
  },
  {
    id: 'tasks',
    label: 'Задачи',
    sampleCommand: 'Открыть задачи',
    exactPhrases: ['задачи', 'список задач', 'поручения', 'tasks', 'todo'],
    keywords: ['задач', 'таск', 'поручен', 'todo', 'task'],
  },
  {
    id: 'contacts',
    label: 'Клиенты и компании',
    sampleCommand: 'Перейти к клиентам',
    exactPhrases: ['клиенты', 'компании', 'клиенты и компании', 'контакты', 'contacts', 'clients'],
    keywords: ['клиент', 'контакт', 'компани', 'контрагент', 'contact', 'client', 'compan'],
  },
  {
    id: 'chat',
    label: 'Командный чат',
    sampleCommand: 'Открыть командный чат',
    exactPhrases: [
      'чат',
      'командный чат',
      'чат и лента',
      'сообщения',
      'мессенджер',
      'mattermost',
      'chat',
    ],
    keywords: ['чат', 'командн', 'сообщени', 'мессенджер', 'переписк', 'mattermost', 'chat', 'messag'],
  },
  {
    id: 'profile',
    label: 'Сообщество и профиль',
    sampleCommand: 'Открыть профиль',
    exactPhrases: [
      'профиль',
      'сообщество и профиль',
      'сообщество',
      'лента и профиль',
      'моя страница',
      'лента',
      'соцсеть',
      'profile',
      'feed',
    ],
    keywords: ['профил', 'сообществ', 'стен', 'соцсет', 'buddyboss', 'вконтакт', 'лент', 'profile', 'feed'],
  },
  {
    id: 'dashboard',
    label: 'Обзор',
    sampleCommand: 'Открыть обзор',
    exactPhrases: ['обзор', 'дашборд', 'главная', 'рабочий стол', 'сводка', 'dashboard', 'home'],
    keywords: ['обзор', 'дашборд', 'главн', 'сводк', 'рабочий стол', 'рабочее место', 'dashboard', 'overview', 'home'],
  },
  {
    id: 'templates',
    label: 'Шаблоны писем',
    sampleCommand: 'Открыть шаблоны писем',
    exactPhrases: ['шаблоны', 'шаблоны писем', 'письма', 'почта', 'email templates', 'templates'],
    keywords: ['шаблон', 'писем', 'письм', 'почт', 'рассылк', 'email', 'templat', 'mail'],
  },
  {
    id: 'office',
    label: 'Офис Univer, S3 и Git',
    sampleCommand: 'Открыть офис',
    exactPhrases: [
      'офис',
      'офис univer',
      'univer',
      'документы',
      'таблицы',
      'файлы',
      'garage s3',
      'forgejo',
      'office',
      'documents',
    ],
    keywords: ['офис', 'univer', 'юнивер', 'документ', 'таблиц', 'эксел', 'excel', 'презентац', 'garage', 'гараж', 'forgejo', 's3', 'файл', 'office', 'document'],
  },
  {
    id: 'collections',
    label: 'Коллекции данных',
    sampleCommand: 'Перейти к коллекциям',
    exactPhrases: ['коллекции', 'коллекции данных', 'база данных', 'nocobase', 'collections'],
    keywords: ['коллекц', 'база данных', 'базе данных', 'конструктор данных', 'nocobase', 'нокобейс', 'collection'],
  },
  {
    id: 'workflows',
    label: 'Процессы и NATS',
    sampleCommand: 'Открыть процессы',
    exactPhrases: [
      'процессы',
      'процессы и nats',
      'согласования',
      'процессы и согласования',
      'воркфлоу',
      'очередь nats',
      'n8n',
      'workflows',
    ],
    keywords: ['процесс', 'согласован', 'воркфлоу', 'автоматизац', 'сценари', 'nats', 'n8n', 'workflow', 'approval'],
  },
  {
    id: 'marketplace',
    label: 'Маркет плагинов',
    sampleCommand: 'Открыть маркет плагинов',
    exactPhrases: ['маркет', 'маркет плагинов', 'плагины', 'магазин', 'verdaccio', 'marketplace', 'plugins'],
    keywords: ['маркет', 'плагин', 'расширен', 'магазин', 'verdaccio', 'marketplace', 'plugin', 'store'],
  },
  {
    id: 'admin',
    label: 'Администрирование',
    sampleCommand: 'Открыть администрирование',
    exactPhrases: ['администрирование', 'админка', 'тенанты', 'роли', 'rbac', 'admin', 'settings'],
    keywords: ['админ', 'тенант', 'поддомен', 'rbac', 'рбак', 'роли', 'ролям', 'управлен', 'cms', 'настройк', 'admin', 'setting'],
  },
  {
    id: 'devtools',
    label: 'Консоль разработчика',
    sampleCommand: 'Перейти к разработке',
    exactPhrases: [
      'разработка',
      'консоль разработчика',
      'разработка и api',
      'api',
      'openapi',
      'archify',
      'storybook',
      'devtools',
    ],
    keywords: ['разработ', 'консол', 'апи', 'api', 'openapi', 'swagger', 'scalar', 'archify', 'storybook', 'devtool', 'developer'],
  },
];

export const VOICE_SECTION_ACTION_RULES: VoiceSectionActionRule[] = [
  // Deals
  {
    id: 'deals.create_deal',
    sectionId: 'deals',
    label: 'Создать сделку',
    sampleCommand: 'Создать сделку',
    exactPhrases: ['создать сделку', 'новая сделка', 'добавить сделку', 'create deal', 'new deal'],
    tokenGroups: [
      ['созда', 'нов', 'добав', 'оформ', 'create', 'new', 'add'],
      ['сделк', 'deal'],
    ],
    requiredAnyPermissions: ['deals:write'],
  },
  {
    id: 'deals.create_pipeline',
    sectionId: 'deals',
    label: 'Создать воронку',
    sampleCommand: 'Новая воронка',
    exactPhrases: ['создать воронку', 'новая воронка', 'добавить воронку', 'create pipeline', 'new pipeline'],
    tokenGroups: [
      ['созда', 'нов', 'добав', 'create', 'new', 'add'],
      ['воронк', 'pipeline'],
    ],
    requiredAnyPermissions: ['deals:write'],
  },
  {
    id: 'deals.view_kanban',
    sectionId: 'deals',
    label: 'Вид «Канбан»',
    sampleCommand: 'Режим канбан',
    exactPhrases: ['канбан', 'режим канбан', 'вид канбан', 'показать канбан', 'kanban view', 'kanban'],
    tokenGroups: [
      ['режим', 'вид', 'переключ', 'покаж', 'view', 'mode', 'switch'],
      ['канбан', 'доск', 'kanban', 'board'],
    ],
  },
  {
    id: 'deals.view_list',
    sectionId: 'deals',
    label: 'Вид «Список»',
    sampleCommand: 'Показать список',
    exactPhrases: ['список', 'режим список', 'режим списка', 'вид список', 'показать список', 'таблица сделок', 'list view'],
    tokenGroups: [
      ['режим', 'вид', 'переключ', 'покаж', 'view', 'mode', 'switch'],
      ['спис', 'таблиц', 'list', 'table'],
    ],
  },
  {
    id: 'deals.view_gantt',
    sectionId: 'deals',
    label: 'Вид «Гант»',
    sampleCommand: 'Показать Гант',
    exactPhrases: ['гант', 'диаграмма ганта', 'режим гант', 'вид гант', 'показать гант', 'gantt', 'gantt view'],
    tokenGroups: [
      ['режим', 'вид', 'переключ', 'покаж', 'диаграмм', 'view', 'mode'],
      ['гант', 'gantt'],
    ],
  },
  {
    id: 'deals.view_analytics',
    sectionId: 'deals',
    label: 'Воронка и конверсии',
    sampleCommand: 'Показать аналитику',
    exactPhrases: [
      'аналитика',
      'конверсии',
      'аналитика воронки',
      'анализ конверсий',
      'показать аналитику',
      'показать конверсии',
      'график воронки',
      'analytics',
      'conversions',
    ],
    tokenGroups: [
      ['аналитик', 'конверси', 'график', 'отчет', 'статистик', 'analytics', 'conversion', 'funnel'],
    ],
  },
  {
    id: 'deals.ai_scoring',
    sectionId: 'deals',
    label: 'Запустить AI-скоринг',
    sampleCommand: 'Запустить AI-скоринг',
    exactPhrases: ['ai скоринг', 'ии скоринг', 'запустить скоринг', 'скоринг сделок', 'оценить сделки', 'run scoring', 'ai scoring'],
    tokenGroups: [
      ['скоринг', 'оцен', 'проанализ', 'анализ', 'scoring', 'analyze'],
      ['ai', 'ии', 'сдел', 'ворон', 'все', 'run', 'запуст'],
    ],
    requiredAnyPermissions: ['harness:execute'],
  },
  {
    id: 'deals.move_stage',
    sectionId: 'deals',
    label: 'Сменить этап сделки',
    sampleCommand: 'Перевести сделку в статус Оплата',
    exactPhrases: [
      'перевести сделку в статус оплата',
      'перевести сделку в статус переговоры',
      'сменить этап сделки',
      'перевести сделку на этап',
    ],
    requiredAnyPermissions: ['deals:write'],
  },
  {
    id: 'deals.set_priority',
    sectionId: 'deals',
    label: 'Установить приоритет сделки',
    sampleCommand: 'Установить приоритет сделки высокий',
    exactPhrases: [
      'установить приоритет сделки высокий',
      'установить приоритет сделки средний',
      'установить приоритет сделки низкий',
      'поставить высокий приоритет',
    ],
    requiredAnyPermissions: ['deals:write'],
  },
  {
    id: 'deals.assign_owner',
    sectionId: 'deals',
    label: 'Назначить ответственного',
    sampleCommand: 'Назначить ответственного Елена Смирнова',
    exactPhrases: [
      'назначить ответственного',
      'переназначить сделку',
      'сменить ответственного',
    ],
    requiredAnyPermissions: ['deals:write'],
  },
  {
    id: 'deals.import',
    sectionId: 'deals',
    label: 'Импорт сделок',
    sampleCommand: 'Импорт сделок',
    exactPhrases: ['импорт', 'импорт сделок', 'импортировать сделки', 'import deals'],
    tokenGroups: [['импорт', 'import'], ['сдел', 'файл', 'csv', 'excel', 'xlsx', 'deals']],
    requiredAnyPermissions: ['deals:write'],
  },
  {
    id: 'deals.refresh',
    sectionId: 'deals',
    label: 'Обновить сделки',
    sampleCommand: 'Обновить',
    exactPhrases: ['обновить', 'обновить сделки', 'обнови', 'refresh', 'reload'],
  },

  // Tasks
  {
    id: 'tasks.create_task',
    sectionId: 'tasks',
    label: 'Создать задачу',
    sampleCommand: 'Создать задачу',
    exactPhrases: ['создать задачу', 'новая задача', 'добавить задачу', 'create task', 'new task'],
    tokenGroups: [
      ['созда', 'нов', 'добав', 'постав', 'create', 'new', 'add'],
      ['задач', 'таск', 'поручен', 'task'],
    ],
    requiredAnyPermissions: ['tasks:write'],
  },
  {
    id: 'tasks.filter_open',
    sectionId: 'tasks',
    label: 'Показать открытые задачи',
    sampleCommand: 'Открытые задачи',
    exactPhrases: ['открытые задачи', 'показать открытые', 'в работе', 'open tasks'],
    tokenGroups: [
      ['открыт', 'активн', 'текущ', 'open', 'active'],
      ['задач', 'показ', 'фильтр', 'вкладк', 'tasks'],
    ],
  },
  {
    id: 'tasks.filter_overdue',
    sectionId: 'tasks',
    label: 'Показать просроченные задачи',
    sampleCommand: 'Просроченные задачи',
    exactPhrases: ['просроченные', 'просроченные задачи', 'показать просроченные', 'overdue tasks', 'overdue'],
    tokenGroups: [
      ['просроч', 'overdue'],
      ['задач', 'показ', 'фильтр', 'вкладк', 'tasks'],
    ],
  },
  {
    id: 'tasks.filter_completed',
    sectionId: 'tasks',
    label: 'Показать выполненные задачи',
    sampleCommand: 'Выполненные задачи',
    exactPhrases: ['выполненные', 'выполненные задачи', 'показать выполненные', 'завершенные задачи', 'completed tasks'],
    tokenGroups: [
      ['выполн', 'заверш', 'закрыт', 'completed', 'done'],
      ['задач', 'показ', 'фильтр', 'вкладк', 'tasks'],
    ],
  },
  {
    id: 'tasks.filter_all',
    sectionId: 'tasks',
    label: 'Показать все задачи',
    sampleCommand: 'Все задачи',
    exactPhrases: ['все задачи', 'показать все задачи', 'сбросить фильтр', 'all tasks'],
  },
  {
    id: 'tasks.refresh',
    sectionId: 'tasks',
    label: 'Обновить задачи',
    sampleCommand: 'Обновить',
    exactPhrases: ['обновить', 'обновить задачи', 'обнови', 'refresh', 'reload'],
  },

  // Calendar
  {
    id: 'calendar.create_event',
    sectionId: 'calendar',
    label: 'Создать встречу / событие',
    sampleCommand: 'Создать встречу',
    exactPhrases: [
      'создать встречу',
      'новая встреча',
      'добавить встречу',
      'запланировать встречу',
      'создать событие',
      'новое событие',
      'create meeting',
      'new event',
    ],
    tokenGroups: [
      ['созда', 'нов', 'добав', 'запланир', 'назнач', 'create', 'new', 'schedule'],
      ['встреч', 'событ', 'звонок', 'слот', 'meeting', 'event', 'call'],
    ],
    requiredAnyPermissions: ['tasks:write'],
  },
  {
    id: 'calendar.filter_meetings',
    sectionId: 'calendar',
    label: 'Только встречи по сделкам',
    sampleCommand: 'Только встречи',
    exactPhrases: ['только встречи', 'фильтр встречи', 'встречи по сделкам', 'meetings only'],
  },
  {
    id: 'calendar.filter_all',
    sectionId: 'calendar',
    label: 'Показать все события',
    sampleCommand: 'Все события',
    exactPhrases: ['все события', 'сбросить фильтр', 'показать все', 'all events'],
  },
  {
    id: 'calendar.refresh',
    sectionId: 'calendar',
    label: 'Синхронизировать календарь',
    sampleCommand: 'Синхронизировать',
    exactPhrases: ['обновить', 'синхронизировать', 'обновить календарь', 'refresh', 'sync'],
  },

  // Contacts
  {
    id: 'contacts.create_contact',
    sectionId: 'contacts',
    label: 'Создать контакт',
    sampleCommand: 'Создать контакт',
    exactPhrases: ['создать контакт', 'новый контакт', 'добавить контакт', 'новый клиент', 'create contact', 'new contact'],
    tokenGroups: [
      ['созда', 'нов', 'добав', 'create', 'new', 'add'],
      ['контакт', 'клиент', 'contact', 'client'],
    ],
    requiredAnyPermissions: ['contacts:write'],
  },
  {
    id: 'contacts.create_company',
    sectionId: 'contacts',
    label: 'Создать компанию',
    sampleCommand: 'Создать компанию',
    exactPhrases: ['создать компанию', 'новая компания', 'добавить компанию', 'create company', 'new company'],
    tokenGroups: [
      ['созда', 'нов', 'добав', 'create', 'new', 'add'],
      ['компани', 'контрагент', 'compan'],
    ],
    requiredAnyPermissions: ['contacts:write'],
  },
  {
    id: 'contacts.tab_contacts',
    sectionId: 'contacts',
    label: 'Вкладка «Контакты»',
    sampleCommand: 'Вкладка контакты',
    exactPhrases: ['вкладка контакты', 'показать контакты', 'список контактов', 'contacts tab'],
  },
  {
    id: 'contacts.tab_companies',
    sectionId: 'contacts',
    label: 'Вкладка «Компании»',
    sampleCommand: 'Вкладка компании',
    exactPhrases: ['вкладка компании', 'показать компании', 'список компаний', 'companies tab'],
  },
  {
    id: 'contacts.open_appearance',
    sectionId: 'contacts',
    label: 'Настройка таблицы',
    sampleCommand: 'Настройка таблицы',
    exactPhrases: ['настройка таблицы', 'настроить таблицу', 'колонки таблицы', 'table settings'],
  },
  {
    id: 'contacts.open_schema_editor',
    sectionId: 'contacts',
    label: 'Поля и разделы',
    sampleCommand: 'Поля и разделы',
    exactPhrases: ['поля и разделы', 'конструктор полей', 'редактор полей', 'edit fields'],
    requiredAnyPermissions: ['contacts:write'],
  },
  {
    id: 'contacts.open_import',
    sectionId: 'contacts',
    label: 'Импорт клиентов',
    sampleCommand: 'Импорт контактов',
    exactPhrases: ['импорт', 'импорт контактов', 'импортировать контакты', 'import contacts'],
    requiredAnyPermissions: ['contacts:write'],
  },
  {
    id: 'contacts.refresh',
    sectionId: 'contacts',
    label: 'Обновить справочник',
    sampleCommand: 'Обновить',
    exactPhrases: ['обновить', 'обновить контакты', 'refresh', 'reload'],
  },

  // Dashboard
  {
    id: 'dashboard.refresh',
    sectionId: 'dashboard',
    label: 'Обновить обзор',
    sampleCommand: 'Обновить обзор',
    exactPhrases: ['обновить', 'обновить обзор', 'обновить дашборд', 'обновить данные', 'refresh', 'reload'],
  },

  // Chat
  {
    id: 'chat.create_channel',
    sectionId: 'chat',
    label: 'Создать канал',
    sampleCommand: 'Создать канал',
    exactPhrases: ['создать канал', 'новый канал', 'добавить канал', 'create channel', 'new channel'],
    tokenGroups: [
      ['созда', 'нов', 'добав', 'create', 'new', 'add'],
      ['канал', 'channel'],
    ],
    requiredAnyPermissions: ['social:post'],
  },
  {
    id: 'chat.refresh',
    sectionId: 'chat',
    label: 'Обновить чат',
    sampleCommand: 'Обновить чат',
    exactPhrases: ['обновить', 'обновить чат', 'обновить сообщения', 'refresh', 'reload'],
  },

  // Profile
  {
    id: 'profile.create_group',
    sectionId: 'profile',
    label: 'Создать группу',
    sampleCommand: 'Создать группу',
    exactPhrases: ['создать группу', 'новая группа', 'добавить группу', 'create group', 'new group'],
    tokenGroups: [
      ['созда', 'нов', 'добав', 'create', 'new', 'add'],
      ['групп', 'сообществ', 'group'],
    ],
    requiredAnyPermissions: ['social:post'],
  },
  {
    id: 'profile.tab_wall',
    sectionId: 'profile',
    label: 'Вкладка «Стена»',
    sampleCommand: 'Показать стену',
    exactPhrases: ['стена', 'вкладка стена', 'показать стену', 'wall tab'],
  },
  {
    id: 'profile.tab_about',
    sectionId: 'profile',
    label: 'Вкладка «О себе»',
    sampleCommand: 'Вкладка о себе',
    exactPhrases: ['о себе', 'обо мне', 'вкладка о себе', 'about tab'],
  },
  {
    id: 'profile.tab_team',
    sectionId: 'profile',
    label: 'Вкладка «Команда»',
    sampleCommand: 'Показать команду',
    exactPhrases: ['команда', 'вкладка команда', 'показать команду', 'team tab'],
  },
  {
    id: 'profile.tab_groups',
    sectionId: 'profile',
    label: 'Вкладка «Группы»',
    sampleCommand: 'Показать группы',
    exactPhrases: ['группы', 'вкладка группы', 'показать группы', 'groups tab'],
  },
  {
    id: 'profile.refresh',
    sectionId: 'profile',
    label: 'Обновить ленту профиля',
    sampleCommand: 'Обновить',
    exactPhrases: ['обновить', 'обновить ленту', 'обновить профиль', 'refresh', 'reload'],
  },

  // Email Templates
  {
    id: 'templates.create_template',
    sectionId: 'templates',
    label: 'Создать шаблон письма',
    sampleCommand: 'Создать шаблон',
    exactPhrases: ['создать шаблон', 'новый шаблон', 'добавить шаблон', 'create template', 'new template'],
    tokenGroups: [
      ['созда', 'нов', 'добав', 'create', 'new', 'add'],
      ['шаблон', 'письм', 'template'],
    ],
    requiredAnyPermissions: ['deals:write'],
  },
  {
    id: 'templates.refresh',
    sectionId: 'templates',
    label: 'Обновить шаблоны',
    sampleCommand: 'Обновить',
    exactPhrases: ['обновить', 'обновить шаблоны', 'refresh', 'reload'],
  },

  // Office Documents
  {
    id: 'office.create_document',
    sectionId: 'office',
    label: 'Создать документ',
    sampleCommand: 'Создать документ',
    exactPhrases: [
      'создать документ',
      'новый документ',
      'добавить документ',
      'создать таблицу',
      'новая таблица',
      'создать файл',
      'create document',
      'new document',
    ],
    tokenGroups: [
      ['созда', 'нов', 'добав', 'create', 'new', 'add'],
      ['документ', 'таблиц', 'презентац', 'файл', 'document', 'sheet', 'slide'],
    ],
    requiredAnyPermissions: ['deals:write'],
  },
  {
    id: 'office.tab_univer',
    sectionId: 'office',
    label: 'Вкладка «Univer»',
    sampleCommand: 'Редактор Univer',
    exactPhrases: ['вкладка univer', 'редактор univer', 'юнивер', 'univer'],
  },
  {
    id: 'office.tab_garage',
    sectionId: 'office',
    label: 'Вкладка «Garage S3»',
    sampleCommand: 'Хранилище Garage S3',
    exactPhrases: ['вкладка garage', 'хранилище garage s3', 'бакеты s3', 'гараж s3', 'garage s3'],
  },
  {
    id: 'office.tab_forgejo',
    sectionId: 'office',
    label: 'Вкладка «Forgejo Git»',
    sampleCommand: 'Репозитории Forgejo',
    exactPhrases: ['вкладка forgejo', 'репозитории forgejo', 'репозитории git', 'forgejo'],
  },
  {
    id: 'office.refresh',
    sectionId: 'office',
    label: 'Обновить офис',
    sampleCommand: 'Обновить',
    exactPhrases: ['обновить', 'обновить офис', 'обновить документы', 'refresh', 'reload'],
  },

  // Collections (NocoBase)
  {
    id: 'collections.create_collection',
    sectionId: 'collections',
    label: 'Создать коллекцию',
    sampleCommand: 'Создать коллекцию',
    exactPhrases: ['создать коллекцию', 'новая коллекция', 'добавить коллекцию', 'create collection', 'new collection'],
    tokenGroups: [
      ['созда', 'нов', 'добав', 'create', 'new', 'add'],
      ['коллекц', 'таблиц', 'collection'],
    ],
    requiredAnyPermissions: ['collections:manage'],
  },
  {
    id: 'collections.create_record',
    sectionId: 'collections',
    label: 'Создать запись',
    sampleCommand: 'Создать запись',
    exactPhrases: ['создать запись', 'новая запись', 'добавить запись', 'create record', 'new record', 'add record'],
    tokenGroups: [
      ['созда', 'нов', 'добав', 'create', 'new', 'add'],
      ['запис', 'строк', 'record', 'row'],
    ],
    requiredAnyPermissions: ['collections:manage', 'deals:write'],
  },
  {
    id: 'collections.create_field',
    sectionId: 'collections',
    label: 'Добавить поле',
    sampleCommand: 'Добавить поле',
    exactPhrases: ['добавить поле', 'новое поле', 'создать поле', 'add field', 'new field'],
    tokenGroups: [
      ['созда', 'нов', 'добав', 'create', 'new', 'add'],
      ['пол', 'колонк', 'field', 'column'],
    ],
    requiredAnyPermissions: ['collections:manage'],
  },
  {
    id: 'collections.view_table',
    sectionId: 'collections',
    label: 'Вид «Таблица»',
    sampleCommand: 'Режим таблица',
    exactPhrases: ['режим таблица', 'вид таблица', 'показать как таблицу', 'table mode', 'table view'],
    tokenGroups: [
      ['режим', 'вид', 'как', 'mode', 'view'],
      ['таблиц', 'table'],
    ],
  },
  {
    id: 'collections.view_kanban',
    sectionId: 'collections',
    label: 'Вид «Канбан»',
    sampleCommand: 'Режим канбан',
    exactPhrases: ['режим канбан', 'вид канбан', 'показать как канбан', 'kanban mode', 'kanban view'],
    tokenGroups: [
      ['режим', 'вид', 'как', 'mode', 'view'],
      ['канбан', 'kanban'],
    ],
  },
  {
    id: 'collections.view_calendar',
    sectionId: 'collections',
    label: 'Вид «Календарь»',
    sampleCommand: 'Режим календарь',
    exactPhrases: ['режим календарь', 'вид календарь', 'показать как календарь', 'calendar mode', 'calendar view'],
    tokenGroups: [
      ['режим', 'вид', 'как', 'mode', 'view'],
      ['календар', 'calendar'],
    ],
  },
  {
    id: 'collections.view_directus',
    sectionId: 'collections',
    label: 'Метаданные Directus CMS',
    sampleCommand: 'Открыть Directus',
    exactPhrases: [
      'directus',
      'директус',
      'метаданные directus',
      'графики directus',
      'directus cms',
      'визуализация directus',
    ],
    tokenGroups: [
      ['откры', 'покаж', 'перекл', 'вкладк', 'график', 'метадан', 'open', 'show'],
      ['directus', 'директус'],
    ],
  },
  {
    id: 'collections.refresh',
    sectionId: 'collections',
    label: 'Обновить коллекции',
    sampleCommand: 'Обновить',
    exactPhrases: ['обновить', 'обновить коллекции', 'обновить записи', 'refresh', 'reload'],
  },

  // Workflows & NATS
  {
    id: 'workflows.create_workflow',
    sectionId: 'workflows',
    label: 'Создать сценарий n8n',
    sampleCommand: 'Создать сценарий',
    exactPhrases: ['создать процесс', 'новый процесс', 'создать сценарий', 'новый сценарий', 'create workflow', 'new workflow'],
    tokenGroups: [
      ['созда', 'нов', 'добав', 'create', 'new', 'add'],
      ['процесс', 'сценари', 'воркфлоу', 'workflow'],
    ],
    requiredAnyPermissions: ['workflows:manage'],
  },
  {
    id: 'workflows.create_approval',
    sectionId: 'workflows',
    label: 'Создать согласование',
    sampleCommand: 'Новое согласование',
    exactPhrases: ['создать согласование', 'новое согласование', 'добавить согласование', 'new approval'],
    tokenGroups: [
      ['созда', 'нов', 'добав', 'запрос', 'create', 'new', 'add'],
      ['согласован', 'заявк', 'approval'],
    ],
    requiredAnyPermissions: ['workflows:manage', 'deals:write', 'tenants:admin'],
  },
  {
    id: 'workflows.tab_workflows',
    sectionId: 'workflows',
    label: 'Вкладка «Сценарии»',
    sampleCommand: 'Вкладка сценарии',
    exactPhrases: ['вкладка процессы', 'вкладка сценарии', 'сценарии n8n', 'workflows tab'],
  },
  {
    id: 'workflows.tab_approvals',
    sectionId: 'workflows',
    label: 'Вкладка «Согласования»',
    sampleCommand: 'Вкладка согласования',
    exactPhrases: ['вкладка согласования', 'показать согласования', 'approvals tab'],
  },
  {
    id: 'workflows.tab_nats',
    sectionId: 'workflows',
    label: 'Вкладка «Очередь NATS»',
    sampleCommand: 'Вкладка NATS',
    exactPhrases: ['вкладка nats', 'очередь nats', 'показать nats', 'nats tab'],
  },
  {
    id: 'workflows.refresh',
    sectionId: 'workflows',
    label: 'Обновить процессы',
    sampleCommand: 'Обновить',
    exactPhrases: ['обновить', 'обновить процессы', 'refresh', 'reload'],
  },

  // Marketplace
  {
    id: 'marketplace.tab_catalog',
    sectionId: 'marketplace',
    label: 'Вкладка «Каталог»',
    sampleCommand: 'Вкладка каталог',
    exactPhrases: ['вкладка каталог', 'показать каталог', 'catalog tab'],
  },
  {
    id: 'marketplace.tab_modules',
    sectionId: 'marketplace',
    label: 'Вкладка «DDD-модули»',
    sampleCommand: 'Вкладка модули',
    exactPhrases: ['вкладка модули', 'установленные модули', 'ddd модули', 'modules tab'],
  },
  {
    id: 'marketplace.publish_plugin',
    sectionId: 'marketplace',
    label: 'Опубликовать плагин',
    sampleCommand: 'Опубликовать плагин',
    exactPhrases: ['опубликовать плагин', 'новый плагин', 'добавить плагин', 'publish plugin'],
    tokenGroups: [
      ['опублик', 'созда', 'нов', 'добав', 'publish', 'new', 'add'],
      ['плагин', 'модул', 'пакет', 'plugin', 'module'],
    ],
    requiredAnyPermissions: ['plugins:manage'],
  },
  {
    id: 'marketplace.refresh',
    sectionId: 'marketplace',
    label: 'Обновить маркет',
    sampleCommand: 'Обновить',
    exactPhrases: ['обновить', 'обновить маркет', 'обновить каталог', 'refresh', 'reload'],
  },

  // Admin
  {
    id: 'admin.create_tenant',
    sectionId: 'admin',
    label: 'Создать тенант',
    sampleCommand: 'Создать тенант',
    exactPhrases: ['создать тенант', 'новый тенант', 'добавить тенант', 'create tenant', 'new tenant'],
    tokenGroups: [
      ['созда', 'нов', 'добав', 'create', 'new', 'add'],
      ['тенант', 'поддомен', 'tenant'],
    ],
    requiredAnyPermissions: ['tenants:admin'],
  },
  {
    id: 'admin.create_role',
    sectionId: 'admin',
    label: 'Создать роль RBAC',
    sampleCommand: 'Создать роль',
    exactPhrases: ['создать роль', 'новая роль', 'добавить роль', 'create role', 'new role'],
    tokenGroups: [
      ['созда', 'нов', 'добав', 'create', 'new', 'add'],
      ['рол', 'role'],
    ],
    requiredAnyPermissions: ['rbac:manage'],
  },
  {
    id: 'admin.create_cms',
    sectionId: 'admin',
    label: 'Создать блок CMS',
    sampleCommand: 'Создать блок CMS',
    exactPhrases: ['создать блок', 'новый блок', 'новый блок cms', 'create block'],
    requiredAnyPermissions: ['cms:edit'],
  },
  {
    id: 'admin.tab_tenancy',
    sectionId: 'admin',
    label: 'Вкладка «Тенанты»',
    sampleCommand: 'Вкладка тенанты',
    exactPhrases: ['вкладка тенанты', 'показать тенанты', 'tenancy tab'],
    requiredAnyPermissions: ['tenants:admin'],
  },
  {
    id: 'admin.tab_rbac',
    sectionId: 'admin',
    label: 'Вкладка «Роли RBAC»',
    sampleCommand: 'Вкладка роли',
    exactPhrases: ['вкладка роли', 'показать роли', 'матрица rbac', 'rbac tab'],
    requiredAnyPermissions: ['rbac:manage'],
  },
  {
    id: 'admin.tab_cms',
    sectionId: 'admin',
    label: 'Вкладка «CMS и Directus»',
    sampleCommand: 'Вкладка CMS',
    exactPhrases: ['вкладка cms', 'показать cms', 'cms tab'],
    requiredAnyPermissions: ['cms:edit', 'docs:read'],
  },
  {
    id: 'admin.tab_health',
    sectionId: 'admin',
    label: 'Вкладка «Мониторинг»',
    sampleCommand: 'Вкладка мониторинг',
    exactPhrases: ['вкладка мониторинг', 'системное здоровье', 'мониторинг системы', 'health tab'],
  },

  // DevTools
  {
    id: 'devtools.tab_harness',
    sectionId: 'devtools',
    label: 'Вкладка «DeepSeek-Harness»',
    sampleCommand: 'Вкладка Harness',
    exactPhrases: ['вкладка harness', 'deepseek harness', 'harness tab'],
  },
  {
    id: 'devtools.tab_scalar',
    sectionId: 'devtools',
    label: 'Вкладка «OpenAPI / Scalar»',
    sampleCommand: 'Вкладка OpenAPI',
    exactPhrases: ['вкладка openapi', 'вкладка scalar', 'спецификация api', 'openapi tab'],
  },
  {
    id: 'devtools.tab_archify',
    sectionId: 'devtools',
    label: 'Вкладка «Archify DDD»',
    sampleCommand: 'Вкладка Archify',
    exactPhrases: ['вкладка archify', 'схема ddd', 'archify tab'],
  },
  {
    id: 'devtools.tab_storybook',
    sectionId: 'devtools',
    label: 'Вкладка «Storybook UI»',
    sampleCommand: 'Вкладка Storybook',
    exactPhrases: ['вкладка storybook', 'компоненты ui', 'storybook tab'],
  },
  {
    id: 'devtools.refresh',
    sectionId: 'devtools',
    label: 'Обновить консоль',
    sampleCommand: 'Обновить',
    exactPhrases: ['обновить', 'обновить данные', 'refresh', 'reload'],
  },
];

const NAVIGATION_PREFIXES = [
  'перейти пожалуйста к',
  'перейти пожалуйста в',
  'перейти пожалуйста на',
  'перейди пожалуйста к',
  'перейди пожалуйста в',
  'перейди пожалуйста на',
  'пожалуйста перейди к',
  'пожалуйста перейди в',
  'пожалуйста перейди на',
  'пожалуйста открой',
  'пожалуйста покажи',
  'перейти к',
  'перейти в',
  'перейти на',
  'перейди к',
  'перейди в',
  'перейди на',
  'переключись на',
  'переключить на',
  'переключи на',
  'переключить в',
  'переключи в',
  'открыть раздел',
  'открой раздел',
  'открыть вкладку',
  'открой вкладку',
  'открыть страницу',
  'открой страницу',
  'открыть',
  'открой',
  'показать',
  'покажи',
  'зайди в',
  'зайти в',
  'давай в',
  'navigate to',
  'switch to',
  'go to',
  'open',
  'show',
];

const STOP_COMMANDS = new Set([
  'стоп',
  'остановись',
  'остановить',
  'останови запись',
  'выключи микрофон',
  'выключить микрофон',
  'отключи микрофон',
  'хватит',
  'пауза',
  'stop',
  'stop listening',
  'mute',
]);

const HELP_COMMANDS = new Set([
  'помощь',
  'команды',
  'список команд',
  'голосовые команды',
  'что ты умеешь',
  'справка',
  'help',
  'commands',
]);

export type VoiceNavigationResult =
  | {
      kind: 'navigate';
      sectionId: PortalSectionId;
      label: string;
      matchedPhrase: string;
    }
  | {
      kind: 'action';
      sectionId: PortalSectionId;
      actionId: VoiceSectionActionId;
      label: string;
      matchedPhrase: string;
      payload?: VoiceActionPayload;
    }
  | {
      kind: 'action_forbidden';
      sectionId: PortalSectionId;
      actionId: VoiceSectionActionId;
      label: string;
      matchedPhrase: string;
      payload?: VoiceActionPayload;
    }
  | {
      kind: 'forbidden';
      sectionId: PortalSectionId;
      label: string;
      matchedPhrase: string;
    }
  | {
      kind: 'stop';
    }
  | {
      kind: 'help';
    }
  | {
      kind: 'unknown';
      transcript: string;
    };

export function normalizeVoiceCommandText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,!?;:«»"'()[\]{}—–-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toPermissionSet(actorPermissions?: Iterable<string>): Set<string> | null {
  if (!actorPermissions) return null;
  return actorPermissions instanceof Set ? actorPermissions : new Set(actorPermissions);
}

export function hasActionPermissions(
  rule: VoiceSectionActionRule,
  actorPermissions?: Iterable<string>
): boolean {
  if (!rule.requiredAnyPermissions || rule.requiredAnyPermissions.length === 0) {
    return true;
  }
  const permSet = toPermissionSet(actorPermissions);
  if (!permSet) return true;
  return rule.requiredAnyPermissions.some((perm) => permSet.has(perm));
}

export function getVoiceActionsForSection(
  sectionId: PortalSectionId,
  actorPermissions?: Iterable<string>
): VoiceSectionActionRule[] {
  return VOICE_SECTION_ACTION_RULES.filter(
    (rule) => rule.sectionId === sectionId && hasActionPermissions(rule, actorPermissions)
  );
}

function stripNavigationPrefix(normalized: string): {
  hasPrefix: boolean;
  target: string;
} {
  for (const prefix of NAVIGATION_PREFIXES) {
    if (normalized === prefix) {
      return { hasPrefix: true, target: '' };
    }
    if (normalized.startsWith(`${prefix} `)) {
      const stripped = normalized
        .slice(prefix.length)
        .replace(/^(раздел|вкладку|вкладка|страницу|страница|мои|моим|наши|нашим)\s+/i, '')
        .trim();
      return { hasPrefix: true, target: stripped };
    }
  }
  return { hasPrefix: false, target: normalized };
}

function scoreActionRule(rule: VoiceSectionActionRule, normalized: string): number {
  if (!normalized) return 0;

  let best = 0;
  const tokens = normalized.split(' ').filter(Boolean);

  for (const exact of rule.exactPhrases) {
    const normExact = normalizeVoiceCommandText(exact);
    if (!normExact) continue;
    if (normalized === normExact) {
      best = Math.max(best, 130 + normExact.length);
    } else if (normExact.includes(' ') && normalized.includes(normExact)) {
      best = Math.max(best, 100 + normExact.length);
    } else if (!normExact.includes(' ') && tokens.length <= 3 && tokens.includes(normExact)) {
      best = Math.max(best, 90 + normExact.length);
    }
  }

  if (rule.tokenGroups && rule.tokenGroups.length > 0 && tokens.length <= 6) {
    let allGroupsMatched = true;
    let totalMatchedChars = 0;

    for (const group of rule.tokenGroups) {
      let groupBest = 0;
      for (const prefix of group) {
        const normPrefix = normalizeVoiceCommandText(prefix);
        if (!normPrefix) continue;
        const matched = tokens.some(
          (tok) => tok === normPrefix || tok.startsWith(normPrefix)
        );
        if (matched) {
          groupBest = Math.max(groupBest, normPrefix.length);
        }
      }
      if (groupBest === 0) {
        allGroupsMatched = false;
        break;
      }
      totalMatchedChars += groupBest;
    }

    if (allGroupsMatched) {
      best = Math.max(best, 95 + rule.tokenGroups.length * 10 + totalMatchedChars);
    }
  }

  return best;
}

function scoreRule(rule: VoiceSectionRule, target: string, fullText: string): number {
  if (!target) return 0;

  let best = 0;

  for (const exact of rule.exactPhrases) {
    const normExact = normalizeVoiceCommandText(exact);
    if (target === normExact) {
      best = Math.max(best, 100 + normExact.length);
    } else if (target.includes(normExact) || fullText.includes(normExact)) {
      best = Math.max(best, 75 + normExact.length);
    }
  }

  const tokens = target.split(' ').filter(Boolean);
  let matchedKeywordCount = 0;
  let keywordBest = 0;

  for (const kw of rule.keywords) {
    const normKw = normalizeVoiceCommandText(kw);
    if (!normKw) continue;

    let kwScore = 0;
    for (const token of tokens) {
      if (token === normKw) {
        kwScore = Math.max(kwScore, 85 + normKw.length);
      } else if (token.startsWith(normKw)) {
        kwScore = Math.max(kwScore, 65 + normKw.length);
      } else if (normKw.length >= 4 && token.includes(normKw)) {
        kwScore = Math.max(kwScore, 50 + normKw.length);
      }
    }

    if (normKw.includes(' ') && target.includes(normKw)) {
      kwScore = Math.max(kwScore, 80 + normKw.length);
    }

    if (kwScore > 0) {
      matchedKeywordCount += 1;
      keywordBest = Math.max(keywordBest, kwScore);
    }
  }

  if (keywordBest > 0) {
    const multiBonus = Math.max(0, matchedKeywordCount - 1) * 15;
    best = Math.max(best, keywordBest + multiBonus);
  }

  // Disambiguate "чат и лента" (chat) vs "лента и профиль" (profile)
  if (rule.id === 'chat' && tokens.some((t) => t.startsWith('чат'))) {
    best = Math.max(best, 95);
  }

  return best;
}

function cleanDealQuerySegment(raw?: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw
    .replace(
      /^(?:эту|этой|текущую|текущей|выбранную|выбранной|активную|активной|по|у|для|с|this|current|of)\s+/g,
      ''
    )
    .replace(/\s+(?:эту|этой|текущую|текущей|выбранную|выбранной|сделку|сделки|сделке|deal)$/g, '')
    .trim();
  if (
    !cleaned ||
    /^(?:сделк[аеиу]|эту|этой|текущ(?:ую|ей)|выбранн(?:ую|ой)|активн(?:ую|ой)|deal|this|current)$/.test(
      cleaned
    )
  ) {
    return undefined;
  }
  return cleaned;
}

function parsePriorityToken(token: string): DealPriorityLevel | null {
  if (/^(?:высок|срочн|критич|важн|максимал|топ|high|urgent|critical|p1)/.test(token)) {
    return 'Высокий';
  }
  if (/^(?:средн|обычн|нормал|умерен|medium|normal|standard|p2)/.test(token)) {
    return 'Средний';
  }
  if (/^(?:низк|минимал|несрочн|low|minor|p3)/.test(token)) {
    return 'Низкий';
  }
  return null;
}

export function parseDealsStateVoiceCommand(normalized: string): {
  actionId: 'deals.move_stage' | 'deals.set_priority' | 'deals.assign_owner';
  label: string;
  payload: VoiceActionPayload;
} | null {
  if (!normalized) return null;

  // 1. Set deal priority: e.g. "установить приоритет сделки высокий", "поставить высокий приоритет сделки Балтик"
  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.some((tok) => tok.startsWith('приоритет') || tok === 'priority')) {
    let matchedPriority: DealPriorityLevel | null = null;
    let priorityTokenIdx = -1;

    for (let i = 0; i < tokens.length; i += 1) {
      const p = parsePriorityToken(tokens[i]);
      if (p) {
        matchedPriority = p;
        priorityTokenIdx = i;
        break;
      }
    }

    if (matchedPriority && priorityTokenIdx >= 0) {
      const fillerTokens = new Set([
        'установить',
        'установи',
        'поставить',
        'поставь',
        'сделать',
        'сделай',
        'изменить',
        'измени',
        'сменить',
        'смени',
        'поменять',
        'поменяй',
        'назначить',
        'назначь',
        'задать',
        'задай',
        'приоритет',
        'приоритета',
        'приоритету',
        'приоритетом',
        'сделка',
        'сделки',
        'сделке',
        'сделку',
        'сделкой',
        'этой',
        'эту',
        'текущей',
        'текущую',
        'выбранной',
        'выбранную',
        'на',
        'в',
        'по',
        'для',
        'у',
        'set',
        'change',
        'update',
        'deal',
        'priority',
        'to',
        'as',
        'of',
        'this',
        'current',
      ]);
      const dealTokens = tokens.filter(
        (tok, idx) => idx !== priorityTokenIdx && !fillerTokens.has(tok)
      );
      const dealQuery = cleanDealQuerySegment(dealTokens.join(' '));
      return {
        actionId: 'deals.set_priority',
        label: dealQuery
          ? `Приоритет «${dealQuery}»: ${matchedPriority}`
          : `Приоритет сделки: ${matchedPriority}`,
        payload: {
          priority: matchedPriority,
          ...(dealQuery ? { dealQuery } : {}),
        },
      };
    }
  }

  // 2. Move deal stage / status:
  // e.g. "перевести сделку в статус Оплата", "перевести сделку Балтик Ритейл в этап Переговоры",
  // "сменить статус сделки на Оплата", "статус сделки Оплата"
  const stagePatterns: Array<{
    regex: RegExp;
    dealGroup: number | null;
    stageGroup: number;
  }> = [
    {
      regex:
        /^(?:перевести|переведи|переместить|перемести|отправить|отправь|перенести|перенеси)\s+(?:(?:эту|текущую|выбранную)\s+)?(?:сделку|сделка)(?:\s+(.+?))?\s+(?:в|на)\s+(?:статус|этап|колонку|стадию)\s+(.+)$/,
      dealGroup: 1,
      stageGroup: 2,
    },
    {
      regex:
        /^(?:перевести|переведи|переместить|перемести|отправить|отправь|перенести|перенеси)\s+(?:(?:эту|текущую|выбранную)\s+)?(?:сделку|сделка)(?:\s+(.+?))?\s+(?:в|на)\s+(.+)$/,
      dealGroup: 1,
      stageGroup: 2,
    },
    {
      regex:
        /^(?:перевести|переведи|переместить|перемести|отправить|отправь|перенести|перенеси)\s+(?:в|на)\s+(?:статус|этап|колонку|стадию)\s+(.+)$/,
      dealGroup: null,
      stageGroup: 1,
    },
    {
      regex:
        /^(?:сменить|смени|изменить|измени|поменять|поменяй|установить|установи|поставить|поставь|обновить|обнови)\s+(?:статус|этап|стадию)\s+(?:(?:этой|текущей|выбранной)\s+)?(?:(?:у|для|по)\s+)?(?:сделки|сделку)?\s*(?:(.+?)\s+)?(?:на|в)\s+(.+)$/,
      dealGroup: 1,
      stageGroup: 2,
    },
    {
      regex:
        /^(?:сменить|смени|изменить|измени|поменять|поменяй|установить|установи|поставить|поставь)\s+(?:статус|этап|стадию)\s+(?:(?:этой|текущей|выбранной)\s+)?(?:сделки|сделку)\s+(.+)$/,
      dealGroup: null,
      stageGroup: 1,
    },
    {
      regex:
        /^(?:статус|этап)\s+(?:(?:этой|текущей|выбранной)\s+)?(?:сделки|у\s+сделки)\s+(.+?)\s+(?:на|в)\s+(.+)$/,
      dealGroup: 1,
      stageGroup: 2,
    },
    {
      regex: /^(?:статус|этап)\s+(?:(?:этой|текущей|выбранной)\s+)?сделки\s+(.+)$/,
      dealGroup: null,
      stageGroup: 1,
    },
    {
      regex:
        /^(?:move|change|set|switch)\s+(?:(?:this|current)\s+)?deal(?:\s+(.+?))?\s+(?:(?:stage|status)\s+)?(?:to|as)\s+(.+)$/,
      dealGroup: 1,
      stageGroup: 2,
    },
    {
      regex: /^(?:set|change)\s+deal\s+(?:stage|status)\s+(?:of\s+(.+?)\s+)?(?:to|as)\s+(.+)$/,
      dealGroup: 1,
      stageGroup: 2,
    },
  ];

  for (const pat of stagePatterns) {
    const m = normalized.match(pat.regex);
    if (!m) continue;
    const rawStage = m[pat.stageGroup]
      ?.replace(/^(?:статус|этап|колонку|стадию|stage|status)\s+/g, '')
      .trim();
    const rawDeal = pat.dealGroup ? m[pat.dealGroup] : undefined;
    const dealQuery = cleanDealQuerySegment(rawDeal);
    if (rawStage) {
      return {
        actionId: 'deals.move_stage',
        label: dealQuery
          ? `Перевести «${dealQuery}» в «${rawStage}»`
          : `Перевести в этап «${rawStage}»`,
        payload: {
          stageQuery: rawStage,
          ...(dealQuery ? { dealQuery } : {}),
        },
      };
    }
  }

  // 3. Assign owner: e.g. "назначить ответственного Елена Смирнова", "переназначить сделку на Дмитрий Кузнецов"
  const ownerPatterns: Array<{
    regex: RegExp;
    dealGroup: number | null;
    ownerGroup: number;
  }> = [
    {
      regex:
        /^(?:переназначить|переназначь|передать|передай|назначить|назначь|сменить|смени|изменить|измени)\s+(?:(?:эту|текущую|выбранную)\s+)?(?:сделку|сделка)\s+(?:(.+?)\s+)?(?:на|менеджеру|ответственному)\s+(.+)$/,
      dealGroup: 1,
      ownerGroup: 2,
    },
    {
      regex:
        /^(?:назначить|назначь|сменить|смени|изменить|измени|поставить|поставь)\s+(?:ответственного|ответственным|менеджера|менеджером|владельца)\s+(?:(?:по|для|у)\s+сделки\s+(?:(.+?)\s+)?)?(?:на\s+)?(.+)$/,
      dealGroup: 1,
      ownerGroup: 2,
    },
    {
      regex:
        /^(?:assign|reassign)\s+(?:deal\s+(?:(.+?)\s+)?)?(?:owner\s+)?(?:to\s+)?(.+)$/,
      dealGroup: 1,
      ownerGroup: 2,
    },
  ];

  for (const pat of ownerPatterns) {
    const m = normalized.match(pat.regex);
    if (!m) continue;
    const rawOwner = m[pat.ownerGroup]
      ?.replace(/^(?:на|менеджеру|ответственному|to)\s+/g, '')
      .trim();
    const rawDeal = pat.dealGroup ? m[pat.dealGroup] : undefined;
    const dealQuery = cleanDealQuerySegment(rawDeal);
    if (rawOwner) {
      return {
        actionId: 'deals.assign_owner',
        label: `Ответственный: ${rawOwner}`,
        payload: {
          ownerQuery: rawOwner,
          ...(dealQuery ? { dealQuery } : {}),
        },
      };
    }
  }

  return null;
}

export function parseVoiceNavigationCommand(
  transcript: string,
  allowedSections?: Set<PortalSectionId>,
  activeSection?: PortalSectionId,
  actorPermissions?: Iterable<string>
): VoiceNavigationResult {
  const normalized = normalizeVoiceCommandText(transcript);
  if (!normalized) {
    return { kind: 'unknown', transcript: '' };
  }

  if (STOP_COMMANDS.has(normalized)) {
    return { kind: 'stop' };
  }

  if (HELP_COMMANDS.has(normalized)) {
    return { kind: 'help' };
  }

  const { hasPrefix, target } = stripNavigationPrefix(normalized);

  if (target && STOP_COMMANDS.has(target)) {
    return { kind: 'stop' };
  }
  if (target && HELP_COMMANDS.has(target)) {
    return { kind: 'help' };
  }

  // 1. Try contextual action rules inside the current active section
  if (activeSection && (!allowedSections || allowedSections.has(activeSection))) {
    if (activeSection === 'deals') {
      const dealsCommand = parseDealsStateVoiceCommand(normalized);
      if (dealsCommand) {
        const rule = VOICE_SECTION_ACTION_RULES.find((r) => r.id === dealsCommand.actionId);
        if (rule && !hasActionPermissions(rule, actorPermissions)) {
          return {
            kind: 'action_forbidden',
            sectionId: 'deals',
            actionId: dealsCommand.actionId,
            label: dealsCommand.label,
            matchedPhrase: normalized,
            payload: dealsCommand.payload,
          };
        }
        return {
          kind: 'action',
          sectionId: 'deals',
          actionId: dealsCommand.actionId,
          label: dealsCommand.label,
          matchedPhrase: normalized,
          payload: dealsCommand.payload,
        };
      }
    }

    let bestActionRule: VoiceSectionActionRule | null = null;
    let bestActionScore = 0;

    for (const actionRule of VOICE_SECTION_ACTION_RULES) {
      if (actionRule.sectionId !== activeSection) continue;
      const score = scoreActionRule(actionRule, normalized);
      if (score > bestActionScore) {
        bestActionScore = score;
        bestActionRule = actionRule;
      }
    }

    if (bestActionRule && bestActionScore >= 90) {
      if (!hasActionPermissions(bestActionRule, actorPermissions)) {
        return {
          kind: 'action_forbidden',
          sectionId: bestActionRule.sectionId,
          actionId: bestActionRule.id,
          label: bestActionRule.label,
          matchedPhrase: normalized,
        };
      }
      return {
        kind: 'action',
        sectionId: bestActionRule.sectionId,
        actionId: bestActionRule.id,
        label: bestActionRule.label,
        matchedPhrase: normalized,
      };
    }
  }

  // 2. Fall back to cross-section navigation
  // Require concise phrasing when no explicit navigation verb was spoken
  const wordCount = target.split(' ').filter(Boolean).length;
  if (!hasPrefix && wordCount > 4) {
    return { kind: 'unknown', transcript: normalized };
  }

  let bestRule: VoiceSectionRule | null = null;
  let bestScore = 0;

  for (const rule of VOICE_SECTION_RULES) {
    const score = scoreRule(rule, target, normalized);
    if (score > bestScore) {
      bestScore = score;
      bestRule = rule;
    }
  }

  if (!bestRule || bestScore < 50) {
    return { kind: 'unknown', transcript: normalized };
  }

  if (allowedSections && !allowedSections.has(bestRule.id)) {
    return {
      kind: 'forbidden',
      sectionId: bestRule.id,
      label: bestRule.label,
      matchedPhrase: target || normalized,
    };
  }

  return {
    kind: 'navigate',
    sectionId: bestRule.id,
    label: bestRule.label,
    matchedPhrase: target || normalized,
  };
}
