export function buildOpenApiSpec(baseUrl: string) {
  const tenantHeader = { name: 'X-Tenant-Subdomain', in: 'header', schema: { type: 'string', default: 'acme' } };
  const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
  const channelIdParam = { name: 'channelId', in: 'path', required: true, schema: { type: 'string' } };
  const teamIdParam = { name: 'teamId', in: 'path', required: true, schema: { type: 'string' } };

  return {
    openapi: '3.1.0',
    info: {
      title: 'NexusHarness CRM & Social Portal API',
      version: '2.1.0',
      description:
        'Модульный DDD API с мультитенантностью на поддоменах (Traefik), RBAC-матрицей, PostgreSQL (Drizzle), Mattermost Chat & WebSocket, NATS JetStream SSE, Verdaccio плагинами, Univer Office + Garage S3 + Forgejo и DeepSeek-Harness.',
    },
    servers: [{ url: baseUrl, description: 'Active Portal Runtime' }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'HMAC-SHA256',
          description: 'Токен сессии, выдаваемый POST /api/auth/login',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          required: ['error'],
          properties: {
            error: { type: 'string' },
            code: { type: 'string', enum: ['VALIDATION_ERROR', 'NOT_FOUND', 'RATE_LIMIT_EXCEEDED', 'INVALID_JSON', 'PAYLOAD_TOO_LARGE', 'INTERNAL_ERROR'] },
            requestId: { type: 'string' },
            field: { type: 'string' },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            status: { type: 'string', enum: ['ok', 'degraded'] },
            uptimeSeconds: { type: 'integer' },
            database: {
              type: 'object',
              properties: {
                engine: { type: 'string' },
                persistence: { type: 'string' },
                ok: { type: 'boolean' },
                latencyMs: { type: 'integer' },
              },
            },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    tags: [
      { name: 'Observability & Ops', description: 'Liveness/Readiness пробы, Prometheus метрики и телеметрия инфраструктуры' },
      { name: 'Auth & Tenancy', description: 'Сессии, поддомены тенантов и динамическая конфигурация Traefik v3' },
      { name: 'CRM (amoCRM)', description: 'Воронки, сделки, контакты, компании, задачи, календарь, email-шаблоны и таймлайн' },
      { name: 'Social (BuddyBoss / VK)', description: 'Профили, стена, интерактивные опросы, комментарии и сообщества' },
      { name: 'Chat (Mattermost v4)', description: 'Совместимый с @mattermost/client REST API v4 и WebSocket-хаб реального времени' },
      { name: 'Office, S3 & Forgejo', description: 'Univer (.xlsx/.docx/.pptx), объектное хранилище Garage S3 и Git Forgejo' },
      { name: 'Marketplace (Verdaccio)', description: 'Каталог, установка, удаление, health-check и публикация плагинов' },
      { name: 'NocoBase (Data & Workflows)', description: 'Динамические коллекции, формулы, триггерные процессы и центр согласований' },
      { name: 'RBAC, CMS & DevTools', description: 'Матрица прав RBAC, Data Scope ACL, TinaCMS, Directus, DeepSeek-Harness, NATS и Git Sync' },
    ],
    paths: {
      '/api/health': {
        get: {
          tags: ['Observability & Ops'],
          security: [],
          summary: 'Liveness-проба сервиса и SELECT 1 проверка PostgreSQL',
          responses: { '200': { description: 'OK' }, '503': { description: 'Database degraded' } },
        },
      },
      '/api/ready': {
        get: {
          tags: ['Observability & Ops'],
          security: [],
          summary: 'Readiness-проба (готовность БД и инициализированных тенантов)',
          responses: { '200': { description: 'Ready' }, '503': { description: 'Not ready' } },
        },
      },
      '/api/metrics': {
        get: {
          tags: ['Observability & Ops'],
          security: [],
          summary: 'Метрики Prometheus (text/plain) или JSON (?format=json)',
          responses: { '200': { description: 'Метрики HTTP, памяти, WS и NATS SSE' } },
        },
      },
      '/api/auth/demo-accounts': {
        get: { tags: ['Auth & Tenancy'], security: [], summary: 'Список активных демо-аккаунтов портала', responses: { '200': { description: 'Список аккаунтов' } } },
      },
      '/api/auth/login': {
        post: { tags: ['Auth & Tenancy'], security: [], summary: 'Аутентификация (userId или email + password) и выдача Bearer токена', responses: { '200': { description: 'Токен и профиль актора' }, '429': { description: 'Rate limit exceeded' } } },
      },
      '/api/auth/me': {
        get: { tags: ['Auth & Tenancy'], summary: 'Текущий актор и контекст тенанта', responses: { '200': { description: 'Профиль и права' } } },
      },
      '/api/tenancy/tenants': {
        get: { tags: ['Auth & Tenancy'], summary: 'Список всех тенантов (tenants:admin)', responses: { '200': { description: 'Список тенантов' } } },
        post: { tags: ['Auth & Tenancy'], summary: 'Создать новый тенант и инициализировать воронку', responses: { '201': { description: 'Созданный тенант' } } },
      },
      '/api/tenancy/traefik-config': {
        get: { tags: ['Auth & Tenancy'], summary: 'Динамическая конфигурация Traefik v3 YAML/JSON', responses: { '200': { description: 'Traefik routers & middlewares' } } },
      },
      '/api/crm/pipelines': {
        get: { tags: ['CRM (amoCRM)'], summary: 'Список воронок и этапов', parameters: [tenantHeader], responses: { '200': { description: 'Воронки и этапы' } } },
        post: { tags: ['CRM (amoCRM)'], summary: 'Создать новую воронку продаж', responses: { '201': { description: 'Новая воронка и этапы' } } },
      },
      '/api/crm/deals': {
        get: { tags: ['CRM (amoCRM)'], summary: 'Сделки тенанта с аналитикой DeepSeek-Harness', parameters: [tenantHeader], responses: { '200': { description: 'Сделки, этапы, контакты, компании' } } },
        post: { tags: ['CRM (amoCRM)'], summary: 'Создать сделку (Zod + RBAC deals:write)', responses: { '201': { description: 'Созданная сделка и анализ Harness' } } },
      },
      '/api/crm/deals/{id}': {
        patch: { tags: ['CRM (amoCRM)'], summary: 'Обновить поля, контакт, компанию или бюджет сделки', parameters: [idParam], responses: { '200': { description: 'Обновлённая сделка' } } },
        delete: { tags: ['CRM (amoCRM)'], summary: 'Удалить сделку (deals:delete)', parameters: [idParam], responses: { '200': { description: 'Удалено' } } },
      },
      '/api/crm/deals/{id}/stage': {
        patch: { tags: ['CRM (amoCRM)'], summary: 'Переместить сделку по этапам воронки', parameters: [idParam], responses: { '200': { description: 'Обновленный этап и запись в таймлайн' } } },
      },
      '/api/crm/deals/{id}/timeline': {
        get: { tags: ['CRM (amoCRM)'], summary: 'Лента событий и заметок сделки', parameters: [idParam], responses: { '200': { description: 'События таймлайна' } } },
        post: { tags: ['CRM (amoCRM)'], summary: 'Добавить заметку, звонок или инсайт в таймлайн', parameters: [idParam], responses: { '201': { description: 'Запись добавлена' } } },
      },
      '/api/crm/deals/{id}/send-email': {
        post: { tags: ['CRM (amoCRM)'], summary: 'Отправить письмо клиенту из карточки сделки', parameters: [idParam], responses: { '201': { description: 'Письмо зафиксировано в таймлайне' } } },
      },
      '/api/crm/deals/analyze': {
        post: { tags: ['CRM (amoCRM)'], summary: 'AI-анализ одной сделки в DeepSeek-Harness', responses: { '200': { description: 'Вероятность, риск и следующий шаг' } } },
      },
      '/api/crm/deals/analyze-all': {
        post: { tags: ['CRM (amoCRM)'], summary: 'Пакетный AI-анализ всех сделок тенанта', responses: { '200': { description: 'Массив анализов' } } },
      },
      '/api/crm/deals/export': {
        get: { tags: ['CRM (amoCRM)'], summary: 'Экспорт сделок в CSV или Excel (.xlsx) с учётом Data Scope и ACL', parameters: [tenantHeader], responses: { '200': { description: 'Файл экспорта (.csv / .xlsx)' } } },
      },
      '/api/crm/deals/import': {
        post: { tags: ['CRM (amoCRM)'], summary: 'Предпросмотр и импорт сделок из CSV / Excel (.xlsx)', responses: { '201': { description: 'Результат импорта' } } },
      },
      '/api/crm/contacts': {
        get: { tags: ['CRM (amoCRM)'], summary: 'Контакты и компании со сводкой по сделкам', responses: { '200': { description: 'Списки контактов и компаний' } } },
        post: { tags: ['CRM (amoCRM)'], summary: 'Создать контакт', responses: { '201': { description: 'Контакт создан' } } },
      },
      '/api/crm/contacts/export': {
        get: { tags: ['CRM (amoCRM)'], summary: 'Экспорт контактов и компаний в CSV или Excel (.xlsx) с доп. полями', parameters: [tenantHeader], responses: { '200': { description: 'Файл экспорта (.csv / .xlsx)' } } },
      },
      '/api/crm/contacts/import': {
        post: { tags: ['CRM (amoCRM)'], summary: 'Предпросмотр и импорт контактов/компаний из CSV / Excel (.xlsx)', responses: { '201': { description: 'Результат импорта' } } },
      },
      '/api/crm/contacts/{id}': {
        patch: { tags: ['CRM (amoCRM)'], summary: 'Редактировать контакт', parameters: [idParam], responses: { '200': { description: 'Контакт обновлён' } } },
        delete: { tags: ['CRM (amoCRM)'], summary: 'Удалить контакт', parameters: [idParam], responses: { '200': { description: 'Удалено' } } },
      },
      '/api/crm/companies': {
        post: { tags: ['CRM (amoCRM)'], summary: 'Создать компанию', responses: { '201': { description: 'Компания создана' } } },
      },
      '/api/crm/companies/{id}': {
        patch: { tags: ['CRM (amoCRM)'], summary: 'Обновить компанию', parameters: [idParam], responses: { '200': { description: 'Компания обновлена' } } },
        delete: { tags: ['CRM (amoCRM)'], summary: 'Удалить компанию', parameters: [idParam], responses: { '200': { description: 'Удалено' } } },
      },
      '/api/crm/directory-schemas': {
        get: { tags: ['CRM (amoCRM)'], summary: 'Конструктор разделов, полей и вида таблиц контактов/компаний (amoCRM)', responses: { '200': { description: 'Схемы таблиц и настройки вида' } } },
      },
      '/api/crm/tasks': {
        get: { tags: ['CRM (amoCRM)'], summary: 'Список задач по сделкам', responses: { '200': { description: 'Задачи и исполнители' } } },
        post: { tags: ['CRM (amoCRM)'], summary: 'Создать задачу', responses: { '201': { description: 'Задача создана' } } },
      },
      '/api/crm/tasks/{id}': {
        patch: { tags: ['CRM (amoCRM)'], summary: 'Обновить задачу', parameters: [idParam], responses: { '200': { description: 'Задача обновлена' } } },
        delete: { tags: ['CRM (amoCRM)'], summary: 'Удалить задачу', parameters: [idParam], responses: { '200': { description: 'Удалено' } } },
      },
      '/api/crm/calendar': {
        get: { tags: ['CRM (amoCRM)'], summary: 'Синхронизированный календарь встреч, звонков и задач по сделкам', parameters: [tenantHeader], responses: { '200': { description: 'События календаря, сделки и исполнители' } } },
      },
      '/api/crm/email-templates': {
        get: { tags: ['CRM (amoCRM)'], summary: 'Список шаблонов email-рассылок', responses: { '200': { description: 'Шаблоны тенанта' } } },
        post: { tags: ['CRM (amoCRM)'], summary: 'Создать шаблон email', responses: { '201': { description: 'Шаблон создан' } } },
      },
      '/api/social/cabinet': {
        get: { tags: ['Social (BuddyBoss / VK)'], summary: 'Кабинет соцсети (профиль, лента, группы, команда тенанта)', responses: { '200': { description: 'Данные кабинета' } } },
      },
      '/api/social/posts': {
        post: { tags: ['Social (BuddyBoss / VK)'], summary: 'Опубликовать пост или опрос на стену', responses: { '201': { description: 'Созданный пост' } } },
      },
      '/api/social/posts/{id}/vote': {
        post: { tags: ['Social (BuddyBoss / VK)'], summary: 'Проголосовать в интерактивном опросе', parameters: [idParam], responses: { '200': { description: 'Обновлённый опрос' } } },
      },
      '/api/social/groups': {
        post: { tags: ['Social (BuddyBoss / VK)'], summary: 'Создать новое сообщество (social:moderate)', responses: { '201': { description: 'Группа создана' } } },
      },
      '/api/v4/users/me': {
        get: { tags: ['Chat (Mattermost v4)'], summary: 'Текущий профиль Mattermost пользователя', parameters: [tenantHeader], responses: { '200': { description: 'UserProfile' } } },
      },
      '/api/v4/users/me/teams': {
        get: { tags: ['Chat (Mattermost v4)'], summary: 'Команды тенанта для текущего пользователя', parameters: [tenantHeader], responses: { '200': { description: 'Массив Team' } } },
      },
      '/api/v4/users/me/teams/{teamId}/channels': {
        get: { tags: ['Chat (Mattermost v4)'], summary: 'Публичные, приватные и личные каналы пользователя', parameters: [tenantHeader, teamIdParam], responses: { '200': { description: 'Массив Channel' } } },
      },
      '/api/v4/channels/{channelId}/posts': {
        get: { tags: ['Chat (Mattermost v4)'], summary: 'История сообщений канала', parameters: [tenantHeader, channelIdParam], responses: { '200': { description: 'PostList' } } },
      },
      '/api/v4/posts': {
        post: { tags: ['Chat (Mattermost v4)'], summary: 'Отправить сообщение или ответ в тред (с двусторонней синхронизацией #news-feed)', parameters: [tenantHeader], responses: { '201': { description: 'Созданный Post' } } },
      },
      '/api/v4/teams/{teamId}/posts/search': {
        post: { tags: ['Chat (Mattermost v4)'], summary: 'Полнотекстовый поиск по доступным каналам команды', parameters: [tenantHeader, teamIdParam], responses: { '200': { description: 'PostSearchResults' } } },
      },
      '/api/office/workspace': {
        get: { tags: ['Office, S3 & Forgejo'], summary: 'Рабочее пространство Univer Office + Garage S3 + Forgejo', responses: { '200': { description: 'Документы, бакеты, репозитории' } } },
      },
      '/api/office/documents': {
        post: { tags: ['Office, S3 & Forgejo'], summary: 'Создать документ (.xlsx/.docx/.pptx) и зафиксировать в S3/Forgejo', responses: { '201': { description: 'Документ создан' } } },
      },
      '/api/office/garage/objects/{id}/preview': {
        get: { tags: ['Office, S3 & Forgejo'], summary: 'Безопасный предпросмотр объекта Garage S3', parameters: [idParam], responses: { '200': { description: 'Метаданные и режим предпросмотра' } } },
      },
      '/api/marketplace/plugins': {
        get: { tags: ['Marketplace (Verdaccio)'], summary: 'Каталог плагинов из реестра Verdaccio с метаданными DDD', responses: { '200': { description: 'Список пакетов @nexus-plugins/*' } } },
      },
      '/api/marketplace/verdaccio/modules': {
        get: { tags: ['Marketplace (Verdaccio)'], summary: 'Список выделенных программных модулей (@nexus-core/*, @nexus-plugins/*) с SHA-512 и Bounded Contexts', responses: { '200': { description: 'Манифесты модулей и статус Verdaccio' } } },
      },
      '/api/marketplace/verdaccio/registry/{scope}/{pkg}': {
        get: { tags: ['Marketplace (Verdaccio)'], summary: 'Стандартный Packument JSON пакета Verdaccio (dist-tags, integrity, tarball)', responses: { '200': { description: 'NPM/Verdaccio Packument' } } },
      },
      '/api/marketplace/verdaccio/tarball/{scope}/{pkg}/{filename}': {
        get: { tags: ['Marketplace (Verdaccio)'], summary: 'Скачать собранный .tgz архив выделенного модуля', responses: { '200': { description: 'application/gzip' } } },
      },
      '/api/marketplace/modules/{slug}/verify': {
        post: { tags: ['Marketplace (Verdaccio)'], summary: 'Выполнить доменный сценарий выделенного DDD-модуля и проверить Zod-контракт', responses: { '200': { description: 'Результат доменной логики' } } },
      },
      '/api/marketplace/plugins/health-check': {
        post: { tags: ['Marketplace (Verdaccio)'], summary: 'Проверка зависимостей установленных плагинов', responses: { '200': { description: 'Отчёт о состоянии зависимостей' } } },
      },
      '/api/marketplace/verdaccio/publish': {
        post: { tags: ['Marketplace (Verdaccio)'], summary: 'Опубликовать новый пакет плагина в Verdaccio реестр', responses: { '201': { description: 'Манифест сохранен' } } },
      },
      '/api/rbac/matrix': {
        get: { tags: ['RBAC, CMS & DevTools'], summary: 'Роли, разрешения и пользователи тенанта', responses: { '200': { description: 'RBAC матрица' } } },
      },
      '/api/cms/blocks': {
        get: { tags: ['RBAC, CMS & DevTools'], summary: 'Блоки контента TinaCMS', responses: { '200': { description: 'Блоки' } } },
        post: { tags: ['RBAC, CMS & DevTools'], summary: 'Создать блок TinaCMS', responses: { '201': { description: 'Блок создан' } } },
      },
      '/api/directus/collections': {
        get: { tags: ['NocoBase (Data & Workflows)'], summary: 'Сводка коллекций Directus CMS + PostgreSQL интроспекция', responses: { '200': { description: 'Список коллекций Directus' } } },
      },
      '/api/directus/metadata': {
        get: { tags: ['NocoBase (Data & Workflows)'], summary: 'Метаданные контента и схем Directus CMS через @nexus-plugins/directus-bi-connector', responses: { '200': { description: 'Снимок метаданных Directus CMS' } } },
      },
      '/api/directus/metadata/{collection}/preview': {
        get: { tags: ['NocoBase (Data & Workflows)'], summary: 'BI-проекция записей коллекции с учётом RBAC ACL (@nexus-plugins/directus-bi-connector)', responses: { '200': { description: 'Безопасный срез BI DTO' } } },
      },
      '/api/directus/sync': {
        post: { tags: ['NocoBase (Data & Workflows)'], summary: 'Принудительная синхронизация метаданных Directus BI и публикация события в NATS', responses: { '200': { description: 'Снимок синхронизации' } } },
      },
      '/api/harness/workflows': {
        get: { tags: ['RBAC, CMS & DevTools'], summary: 'Список сценариев DeepSeek-Harness и журнал запусков', responses: { '200': { description: 'Workflows и runs' } } },
      },
      '/api/harness/execute': {
        post: { tags: ['RBAC, CMS & DevTools'], summary: 'Выполнить workflow в DeepSeek-Harness / Dify', responses: { '200': { description: 'Результат выполнения' } } },
      },
      '/api/nats/events': {
        get: { tags: ['RBAC, CMS & DevTools'], summary: 'Журнал событий NATS JetStream', responses: { '200': { description: 'Последние события домена' } } },
      },
      '/api/nats/queue': {
        get: { tags: ['RBAC, CMS & DevTools'], summary: 'Снимок очереди NATS JetStream и активных консьюмеров', responses: { '200': { description: 'Очередь и статистика консьюмеров' } } },
      },
      '/api/nats/publish': {
        post: { tags: ['RBAC, CMS & DevTools'], summary: 'Публикация события в шину NATS JetStream', responses: { '201': { description: 'Событие опубликовано' } } },
      },
      '/api/nats/stream': {
        get: { tags: ['RBAC, CMS & DevTools'], summary: 'Поток событий NATS JetStream (SSE)', responses: { '200': { description: 'text/event-stream' } } },
      },
      '/api/nocobase/collections': {
        get: { tags: ['NocoBase (Data & Workflows)'], summary: 'Список No-Code коллекций и полей (формулы, связи, селекты)', responses: { '200': { description: 'Коллекции и опции связей' } } },
        post: { tags: ['NocoBase (Data & Workflows)'], summary: 'Создать новую коллекцию данных', responses: { '201': { description: 'Коллекция создана' } } },
      },
      '/api/nocobase/collections/{key}/records': {
        get: { tags: ['NocoBase (Data & Workflows)'], summary: 'Записи коллекции с вычислением формул и Data Scope ACL', responses: { '200': { description: 'Массив записей' } } },
        post: { tags: ['NocoBase (Data & Workflows)'], summary: 'Создать запись и запустить триггерные процессы', responses: { '201': { description: 'Запись создана' } } },
      },
      '/api/nocobase/workflows': {
        get: { tags: ['NocoBase (Data & Workflows)'], summary: 'Событийные процессы автоматизации и журнал запусков', responses: { '200': { description: 'Процессы и логи' } } },
        post: { tags: ['NocoBase (Data & Workflows)'], summary: 'Создать событийный процесс автоматизации', responses: { '201': { description: 'Процесс создан' } } },
      },
      '/api/nocobase/approvals': {
        get: { tags: ['NocoBase (Data & Workflows)'], summary: 'Центр согласований сделок и документов', responses: { '200': { description: 'Очередь согласований' } } },
        post: { tags: ['NocoBase (Data & Workflows)'], summary: 'Отправить запрос на согласование', responses: { '201': { description: 'Запрос создан' } } },
      },
      '/api/git/status': {
        get: { tags: ['RBAC, CMS & DevTools'], summary: 'Статус локального Git-репозитория (tenants:admin)', responses: { '200': { description: 'Ветка и список изменений' } } },
      },
      '/api/git/commit-push': {
        post: { tags: ['RBAC, CMS & DevTools'], summary: 'Зафиксировать и отправить изменения в origin/main с одноразовым PAT', responses: { '200': { description: 'Результат push в main' } } },
      },
      '/api/system/health': {
        get: { tags: ['Observability & Ops'], summary: 'Мониторинг ресурсов (CPU, RAM, HDD, NET) и статусы PostgreSQL, NATS, Forgejo, Garage S3', responses: { '200': { description: 'Снимок телеметрии и подключений' } } },
      },
    },
  };
}
