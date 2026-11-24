import type express from 'express';

/**
 * OpenAPI 3.1 description of the public API, rendered by Scalar at /api/docs.
 *
 * Kept as a single declarative specification object matching every Express router.
 */
export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'РЦА «Русский Восток» API',
    version: '1.1.0',
    description:
      'Публичный и кабинетный API платформы: аналитика кадровой потребности ДФО, заявки на аттестацию, ' +
      'личный кабинет с RBAC, социальная лента и блог, чат по каналам, медиатека, журнал стажа, LMS, ' +
      'телеметрия сервиса и ИИ-консультант.',
  },
  servers: [{ url: '/', description: 'Текущий хост' }],
  tags: [
    { name: 'System', description: 'Состояние сервиса, готовность, метрики и SEO' },
    { name: 'Auth', description: 'Регистрация, вход, сессии, восстановление пароля' },
    { name: 'Account', description: 'Профиль, связанные аккаунты, журнал стажа, LMS' },
    { name: 'Admin', description: 'Управление пользователями и заявками (RBAC)' },
    { name: 'Social', description: 'Лента, блог, новости, комментарии, подписки' },
    { name: 'Chat', description: 'Каналы, сообщения, треды, реакции' },
    { name: 'Media', description: 'Альбомы и медиафайлы' },
    { name: 'Analytics', description: 'Поведенческая аналитика и рейтинг проводников' },
    { name: 'Content', description: 'Заявки, опросы готовности и обратная связь' },
    { name: 'Market', description: 'Оперативная сводка рынка ДФО, погода, карты, ИИ-помощник' },
  ],
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'rca_session',
        description: 'Сессионная cookie (HttpOnly), выдаётся /api/auth/login и /api/auth/register.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
        },
        required: ['error'],
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          fullName: { type: 'string' },
          region: { type: 'string' },
          organisation: { type: 'string' },
          role: { type: 'string', enum: ['candidate', 'instructor', 'curator', 'admin'] },
          permissions: { type: 'array', items: { type: 'string' } },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      Post: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          authorId: { type: 'string' },
          authorName: { type: 'string' },
          kind: { type: 'string', enum: ['update', 'article', 'news'] },
          title: { type: 'string' },
          body: { type: 'string' },
          excerpt: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['draft', 'published', 'removed'] },
          likeCount: { type: 'integer' },
          commentCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          publishedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      Channel: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          slug: { type: 'string' },
          displayName: { type: 'string' },
          purpose: { type: 'string' },
          type: { type: 'string', enum: ['public', 'private'] },
          memberCount: { type: 'integer' },
          unreadCount: { type: 'integer' },
        },
      },
      Message: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          channelId: { type: 'string' },
          authorId: { type: 'string' },
          authorName: { type: 'string' },
          body: { type: 'string' },
          rootId: { type: 'string', nullable: true },
          replyCount: { type: 'integer' },
          reactions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                emoji: { type: 'string' },
                count: { type: 'integer' },
                mine: { type: 'boolean' },
              },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      MediaAsset: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          albumId: { type: 'string', nullable: true },
          ownerId: { type: 'string' },
          kind: { type: 'string', enum: ['image', 'video', 'audio'] },
          title: { type: 'string' },
          mimeType: { type: 'string' },
          sizeBytes: { type: 'integer' },
          durationSec: { type: 'integer', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Требуется вход',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Forbidden: {
        description: 'Недостаточно прав (RBAC) или отказ CSRF-проверки',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      RateLimited: {
        description: 'Превышен лимит запросов (см. Retry-After)',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Состояние сервиса и адаптера хранения',
        responses: {
          '200': { description: 'OK (healthy или degraded)' },
          '503': { description: 'Критическая зависимость недоступна' },
        },
      },
    },
    '/api/health/live': {
      get: {
        tags: ['System'],
        summary: 'Быстрая liveness-проба процесса',
        responses: { '200': { description: 'Процесс активен' } },
      },
    },
    '/api/health/ready': {
      get: {
        tags: ['System'],
        summary: 'Readiness-проба (БД, миграции, шина событий)',
        responses: {
          '200': { description: 'Готов к приёму трафика' },
          '503': { description: 'Зависимости не готовы' },
        },
      },
    },
    '/api/metrics': {
      get: {
        tags: ['System'],
        summary: 'Внутрипроцессные метрики (JSON или Prometheus text format)',
        parameters: [
          {
            name: 'format',
            in: 'query',
            schema: { type: 'string', enum: ['json', 'prometheus'] },
          },
        ],
        responses: { '200': { description: 'Метрики процесса и маршрутов' } },
      },
    },
    '/api/seo/server-status': {
      get: {
        tags: ['System'],
        summary: 'Статус серверной SEO-конфигурации (robots.txt и sitemap.xml)',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Регистрация (всегда роль candidate)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'fullName'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 10 },
                  fullName: { type: 'string' },
                  region: { type: 'string' },
                  organisation: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Создано, cookie установлена' },
          '400': { description: 'Ошибка валидации' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Вход по email и паролю',
        responses: {
          '200': { description: 'Сессия создана' },
          '401': { description: 'Неверные учётные данные' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/api/auth/logout': {
      post: { tags: ['Auth'], summary: 'Выход', responses: { '200': { description: 'OK' } } },
    },
    '/api/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Запрос ссылки восстановления пароля',
        responses: {
          '200': { description: 'Единообразный ответ без раскрытия существования адреса' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/api/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Смена пароля по одноразовому токену',
        responses: { '200': { description: 'Пароль обновлён, сессии отозваны' } },
      },
    },
    '/api/auth/session': {
      get: {
        tags: ['Auth'],
        summary: 'Текущая сессия',
        responses: { '200': { description: '{ authenticated, user? }' } },
      },
    },
    '/api/account/profile': {
      get: {
        tags: ['Account'],
        summary: 'Свой профиль',
        security: [{ sessionCookie: [] }],
        responses: {
          '200': { description: 'OK' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      patch: {
        tags: ['Account'],
        summary: 'Обновить профиль',
        security: [{ sessionCookie: [] }],
        responses: {
          '200': { description: 'OK' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/account/password': {
      post: {
        tags: ['Account'],
        summary: 'Смена пароля текущего пользователя',
        security: [{ sessionCookie: [] }],
        responses: { '200': { description: 'Пароль обновлён' } },
      },
    },
    '/api/account/inquiries': {
      get: {
        tags: ['Account'],
        summary: 'Список заявок текущего пользователя',
        security: [{ sessionCookie: [] }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/account/linked-accounts': {
      get: {
        tags: ['Account'],
        summary: 'Связанные внешние профили и статус OAuth-провайдеров',
        security: [{ sessionCookie: [] }],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        tags: ['Account'],
        summary: 'Привязать или обновить профиль для автозаполнения',
        security: [{ sessionCookie: [] }],
        responses: { '201': { description: 'Сохранено' } },
      },
    },
    '/api/account/experience-journal': {
      get: {
        tags: ['Account'],
        summary: 'Журнал туристского стажа',
        security: [{ sessionCookie: [] }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/account/lms-progress': {
      get: {
        tags: ['Account'],
        summary: 'Прогресс подготовки по программе LMS',
        security: [{ sessionCookie: [] }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/account/leaderboard-sync': {
      post: {
        tags: ['Account'],
        summary: 'Синхронизация показателей проводника с рейтингом ДФО',
        security: [{ sessionCookie: [] }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'Список пользователей (users:manage)',
        security: [{ sessionCookie: [] }],
        responses: {
          '200': { description: 'OK' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/admin/users/{userId}/role': {
      patch: {
        tags: ['Admin'],
        summary: 'Назначить роль пользователю',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Роль обновлена' } },
      },
    },
    '/api/admin/inquiries': {
      get: {
        tags: ['Admin'],
        summary: 'Все заявки на аттестацию',
        security: [{ sessionCookie: [] }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/social/feed': {
      get: {
        tags: ['Social'],
        summary: 'Лента, блог и новости',
        parameters: [
          { name: 'authorId', in: 'query', schema: { type: 'string' } },
          { name: 'kind', in: 'query', schema: { type: 'string', enum: ['update', 'article', 'news'] } },
          { name: 'tag', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'Список записей' } },
      },
    },
    '/api/social/posts': {
      post: {
        tags: ['Social'],
        summary: 'Опубликовать запись, статью или новость',
        security: [{ sessionCookie: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['body'],
                properties: {
                  kind: { type: 'string', enum: ['update', 'article', 'news'] },
                  title: { type: 'string' },
                  body: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
                  publish: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Создано' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/social/posts/{postId}': {
      get: {
        tags: ['Social'],
        summary: 'Получить публикацию и комментарии',
        parameters: [{ name: 'postId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
      patch: {
        tags: ['Social'],
        summary: 'Обновить публикацию',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'postId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Обновлено' } },
      },
      delete: {
        tags: ['Social'],
        summary: 'Удалить публикацию',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'postId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Удалено' } },
      },
    },
    '/api/social/posts/{postId}/comments': {
      post: {
        tags: ['Social'],
        summary: 'Добавить комментарий',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'postId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '201': { description: 'Создано' } },
      },
    },
    '/api/social/posts/{postId}/like': {
      post: {
        tags: ['Social'],
        summary: 'Поставить или убрать лайк',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'postId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: '{ liked, count }' } },
      },
    },
    '/api/chat/channels': {
      get: {
        tags: ['Chat'],
        summary: 'Мои каналы и публичные каналы',
        security: [{ sessionCookie: [] }],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        tags: ['Chat'],
        summary: 'Создать канал (chat:create_channel)',
        security: [{ sessionCookie: [] }],
        responses: { '201': { description: 'Создано' } },
      },
    },
    '/api/chat/channels/{channelId}/messages': {
      get: {
        tags: ['Chat'],
        summary: 'Сообщения канала или треда',
        security: [{ sessionCookie: [] }],
        parameters: [
          { name: 'channelId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'threadRootId', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 100 } },
        ],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        tags: ['Chat'],
        summary: 'Отправить сообщение или ответ в тред',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'channelId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '201': { description: 'Создано' } },
      },
    },
    '/api/media/albums': {
      get: { tags: ['Media'], summary: 'Альбомы', responses: { '200': { description: 'OK' } } },
      post: {
        tags: ['Media'],
        summary: 'Создать альбом',
        security: [{ sessionCookie: [] }],
        responses: { '201': { description: 'Создано' } },
      },
    },
    '/api/media/assets': {
      get: { tags: ['Media'], summary: 'Файлы', responses: { '200': { description: 'OK' } } },
      post: {
        tags: ['Media'],
        summary: 'Загрузить файл (raw body, метаданные в query)',
        security: [{ sessionCookie: [] }],
        parameters: [
          { name: 'mimeType', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'sizeBytes', in: 'query', required: true, schema: { type: 'integer' } },
          { name: 'albumId', in: 'query', schema: { type: 'string' } },
          { name: 'title', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '201': { description: 'Создано' } },
      },
    },
    '/media/{assetId}': {
      get: {
        tags: ['Media'],
        summary: 'Потоковая выдача медиафайла с проверкой доступа альбома',
        parameters: [{ name: 'assetId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Бинарный поток медиафайла' } },
      },
    },
    '/api/analytics/collect': {
      post: {
        tags: ['Analytics'],
        summary: 'Отправка пакета событий поведения клиента',
        responses: { '200': { description: 'Принято' } },
      },
    },
    '/api/analytics/summary': {
      get: {
        tags: ['Analytics'],
        summary: 'Агрегированная статистика поведения',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/analytics/sessions/{sessionId}': {
      get: {
        tags: ['Analytics'],
        summary: 'События конкретной пользовательской сессии',
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/analytics/reset': {
      delete: {
        tags: ['Analytics'],
        summary: 'Очистка журнала аналитики (требуется право analytics:view)',
        security: [{ sessionCookie: [] }],
        responses: {
          '200': { description: 'Очищено' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/guides/leaderboard': {
      get: {
        tags: ['Analytics'],
        summary: 'Рейтинг активных проводников ДФО по аттестованным маршрутам и стажу',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/inquiries': {
      post: {
        tags: ['Content'],
        summary: 'Заявка на аттестацию',
        responses: { '201': { description: 'Создано' } },
      },
    },
    '/api/inquiries/stats': {
      get: {
        tags: ['Content'],
        summary: 'Агрегированные счётчики заявок',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/inquiries/stats/stream': {
      get: {
        tags: ['Content'],
        summary: 'SSE-поток счётчиков заявок',
        responses: { '200': { description: 'text/event-stream' } },
      },
    },
    '/api/feedback': {
      post: {
        tags: ['Content'],
        summary: 'Обратная связь по платформе',
        responses: { '201': { description: 'Создано' } },
      },
    },
    '/api/feedback/reviews': {
      get: {
        tags: ['Content'],
        summary: 'Список отзывов инструкторов с рейтингом аттестации и обучения',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/readiness-survey': {
      post: {
        tags: ['Content'],
        summary: 'Отправка анкеты готовности инструктора',
        responses: { '201': { description: 'Сохранено' } },
      },
    },
    '/api/readiness-survey/stats': {
      get: {
        tags: ['Content'],
        summary: 'Сводная статистика анкеты готовности',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/course-satisfaction': {
      post: {
        tags: ['Content'],
        summary: 'Оценка удовлетворённости программой ДПО и аттестацией',
        responses: { '201': { description: 'Сохранено' } },
      },
    },
    '/api/course-satisfaction/stats': {
      get: {
        tags: ['Content'],
        summary: 'Сводка удовлетворённости обучением',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/employment-survey': {
      get: {
        tags: ['Content'],
        summary: 'Список анкет занятости и переаттестации + сводка (PostgreSQL / JSON)',
        responses: { '200': { description: 'Сводка и список анкет' } },
      },
      post: {
        tags: ['Content'],
        summary: 'Сохранить анкету занятости и переаттестации (БД + архив Garage S3)',
        responses: {
          '201': { description: 'Сохранено в БД и архивировано в S3' },
          '400': { description: 'Ошибка валидации' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/api/employment-survey/archive': {
      get: {
        tags: ['Content'],
        summary: 'Скачать консолидированный JSON-снимок анкет из объектного хранилища (Garage S3)',
        responses: {
          '200': { description: 'JSON-архив из объектного хранилища' },
          '404': { description: 'Снимок не найден' },
        },
      },
    },
    '/api/employment-survey/{id}': {
      delete: {
        tags: ['Content'],
        summary: 'Удалить анкету занятости (автор или модератор) из БД и S3',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Удалено' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { description: 'Анкета не найдена' },
        },
      },
    },
    '/api/market/live-stats': {
      get: {
        tags: ['Market'],
        summary: 'Оперативный срез рынка инструкторов-проводников ДФО',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/market/live-stats/stream': {
      get: {
        tags: ['Market'],
        summary: 'SSE-поток живых показателей рынка ДФО',
        responses: { '200': { description: 'text/event-stream' } },
      },
    },
    '/api/weather/hubs': {
      get: {
        tags: ['Market'],
        summary: 'Актуальная погода в туристских хабах ДФО',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/maps/config': {
      get: {
        tags: ['Market'],
        summary: 'Публичная конфигурация Google Maps Platform (если задана)',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/assistant/chat': {
      post: {
        tags: ['Market'],
        summary: 'ИИ-консультант личного кабинета с контекстом RAG и правил РЦА',
        responses: {
          '200': { description: 'Ответ консультанта' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
  },
} as const;

/**
 * Mounts the Scalar API reference UI and the raw OpenAPI document.
 *
 * Scalar is lazy-loaded so the documentation bundle never affects application
 * startup time and cannot break the app if the CDN is unreachable.
 */
export function mountApiDocs(app: express.Express): void {
  app.get('/api/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });

  app.get('/api/docs', (_req, res) => {
    res.type('html').send(`<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API — РЦА «Русский Восток»</title>
    <style>
      body { margin: 0; }
      .api-shell { font-family: ui-sans-serif, system-ui, sans-serif; padding: 48px; color: #0f172a; }
      a { color: #0f766e; }
      code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
    </style>
  </head>
  <body>
    <div id="app" class="api-shell">
      <h1>API РЦА «Русский Восток»</h1>
      <p>
        Машиночитаемая спецификация:
        <a href="/api/openapi.json"><code>/api/openapi.json</code></a>
      </p>
      <p>
        Интерактивная документация Scalar подключается отдельно; если она не
        загрузилась, используйте JSON-спецификацию выше.
      </p>
      <script>
        (function () {
          var s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference';
          s.onload = function () {
            var root = document.getElementById('app');
            if (root) {
              while (root.firstChild) root.removeChild(root.firstChild);
              var ref = document.createElement('script');
              ref.id = 'api-reference';
              ref.setAttribute('data-url', '/api/openapi.json');
              root.appendChild(ref);
            }
            var sc = document.createElement('script');
            sc.src = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference';
            document.body.appendChild(sc);
          };
          document.body.appendChild(s);
        })();
      </script>
    </div>
  </body>
</html>`);
  });
}
