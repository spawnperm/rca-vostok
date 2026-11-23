import type express from 'express';

/**
 * OpenAPI 3.1 description of the public API, rendered by Scalar at /api/docs.
 *
 * Kept as a plain object rather than generated from decorators: the server is
 * hand-written Express, and one readable document is easier to keep truthful
 * than scattering annotations across routers.
 */
export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'РЦА «Русский Восток» API',
    version: '1.0.0',
    description:
      'Публичный API платформы: аналитика кадровой потребности ДФО, заявки на аттестацию, ' +
      'личный кабинет с RBAC, лента сообщества и блог, чат по каналам и медиатека.',
  },
  servers: [{ url: '/', description: 'Текущий хост' }],
  tags: [
    { name: 'System', description: 'Состояние сервиса' },
    { name: 'Auth', description: 'Регистрация, вход, сессии' },
    { name: 'Account', description: 'Профиль пользователя' },
    { name: 'Admin', description: 'Управление пользователями (RBAC)' },
    { name: 'Social', description: 'Лента, блог, комментарии, подписки' },
    { name: 'Chat', description: 'Каналы, сообщения, треды, реакции' },
    { name: 'Media', description: 'Альбомы и файлы' },
    { name: 'Analytics', description: 'Поведение пользователей' },
    { name: 'Content', description: 'Заявки и обратная связь' },
  ],
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'rca_session',
        description: 'Сессионная cookie, выдаётся /api/auth/login.',
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
          kind: { type: 'string', enum: ['update', 'article'] },
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
        description: 'Недостаточно прав (RBAC)',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Состояние сервиса и адаптера хранения',
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
        },
      },
    },
    '/api/auth/logout': {
      post: { tags: ['Auth'], summary: 'Выход', responses: { '200': { description: 'OK' } } },
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
    '/api/social/feed': {
      get: {
        tags: ['Social'],
        summary: 'Лента и блог',
        parameters: [
          { name: 'authorId', in: 'query', schema: { type: 'string' } },
          { name: 'kind', in: 'query', schema: { type: 'string', enum: ['update', 'article'] } },
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
        summary: 'Опубликовать запись или статью',
        security: [{ sessionCookie: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['body'],
                properties: {
                  kind: { type: 'string', enum: ['update', 'article'] },
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
    '/api/analytics/summary': {
      get: {
        tags: ['Analytics'],
        summary: 'Агрегированная статистика поведения',
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
    '/api/guides/leaderboard': {
      get: {
        tags: ['Analytics'],
        summary: 'Рейтинг активных проводников ДФО по аттестованным маршрутам и стажу',
        responses: { '200': { description: 'OK' } },
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
        // Scalar standalone bundle, loaded lazily from CDN.
        (function () {
          var s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference';
          s.onload = function () {
            var root = document.getElementById('app');
            if (root) root.innerHTML = '<script id="api-reference" data-url="/api/openapi.json"><\\/script>';
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
