# Внедрение DDD и 11 контуров профессиональной разработки

Платформа переведена на многослойную архитектуру **Domain-Driven Design (DDD)** с чётким выделением **Bounded Contexts (ограниченных контекстов)** и охватом **11 инженерных контуров качества**.

## 1. Bounded Contexts (Ограниченные контексты DDD)

### Контекст 1: `certification` (`src/domain/certification/`, `src/application/certification/`)
- **Aggregate Root**: [`CertificationInquiry`](../src/domain/certification/CertificationInquiry.ts) — инкапсулирует инварианты заявки инструктора (`EmailAddress`, `SanitizedText`, обязательное `consentAccepted: true`).
- **Domain Service**: [`DemandForecastService`](../src/domain/certification/DemandForecastService.ts) — единый источник истины для расчёта потребности, кривой чувствительности и 5-летней когортной проекции (используется и в UI `CalculatorSection.tsx`, и в юнит-тестах).
- **Port**: [`InquiryRepository`](../src/domain/certification/InquiryRepository.ts).
- **Use Cases**: `SubmitInquiryUseCase`, `GetInquiryStatsUseCase`.
- **Domain Event**: `certification.inquiry_submitted`.

### Контекст 2: `analytics` (`src/domain/analytics/`, `src/application/analytics/`)
- **Models & Factory**: [`BehaviorEventFactory`](../src/domain/analytics/BehaviorModels.ts) — нормализация типов событий, ограничение координат тепловой карты (`0..100`) и парсинг User-Agent.
- **Domain Service**: [`AnalyticsAggregationService`](../src/domain/analytics/AnalyticsAggregationService.ts) — расчёт агрегатов сессий, устройств, рефереров, таймлайна, топа кликов и тепловой карты.
- **Port**: [`AnalyticsRepository`](../src/domain/analytics/AnalyticsRepository.ts).
- **Use Cases**: `CollectBehaviorUseCase`, `GetAnalyticsSummaryUseCase`, `GetSessionDetailsUseCase`, `ResetAnalyticsUseCase`.

### Контекст 3: `identity` (`src/domain/identity/`, `src/application/identity/`)
- **Aggregate Root**: [`User`](../src/domain/identity/User.ts) — политика пароля (минимум 10 символов, буквы и цифры), неизменяемые `email`/`role`, методы `can()`/`assertCan()`, доменная ошибка `ForbiddenError`.
- **Domain Service**: [`Rbac`](../src/domain/identity/Rbac.ts) — единственный источник истины по правам: 4 роли (`candidate`, `instructor`, `curator`, `admin`), 20 разрешений и кумулятивная матрица грантов. Маршруты запрашивают **возможность**, а не роль.
- **Aggregate**: [`PasswordResetToken`](../src/domain/identity/PasswordReset.ts) — одноразовый токен, 15 минут, в БД только SHA-256.
- **Ports**: [`UserRepository`, `SessionRepository`](../src/domain/identity/IdentityRepositories.ts), [`PasswordResetRepository`, `Mailer`](../src/domain/identity/PasswordReset.ts).
- **Use Cases**: регистрация, вход/выход, разыменование сессии, профиль, смена пароля, восстановление пароля, администрирование пользователей.
- **Domain Events**: `identity.user_registered`, `identity.user_logged_in`, `identity.profile_updated`, `identity.role_assigned`, `identity.password_reset_requested/completed`.

### Контекст 4: `social` (`src/domain/social/`, `src/application/social/`)
- **Aggregate Root**: [`Post`](../src/domain/social/Post.ts) — три вида записи: `update`, `article` (заголовок и ≥200 символов), `news` (заголовок и ≥40 символов, публикуется на лендинг и требует права модератора). Мягкое удаление сохраняет треды комментариев.
- **Aggregates**: `Comment`, [`SocialProfile`](../src/domain/social/SocialProfile.ts) — расширенный профиль сообщества, подписки, лента активности.
- **Port**: [`SocialRepository`](../src/domain/social/SocialRepository.ts).
- **Схемы границ**: Zod (`createPostSchema`, `feedQuerySchema`, `socialProfileSchema`) проверяют форму запроса до домена и называют поле в ошибке.

### Контекст 5: `chat` (`src/domain/chat/`, `src/application/chat/`)
- **Модель по образцу Mattermost**: [`Channel`/`ChatMessage`](../src/domain/chat/Chat.ts) — каналы (`public`/`private`), участие, сообщения с тредами через `rootId`, реакции по белому списку эмодзи.
- **Port**: [`ChatRepository`](../src/domain/chat/ChatRepository.ts) — каналы, участники, сообщения, реакции, счётчик непрочитанного.
- **Транспорт**: HTTP-поллинг с интервалом 5 с; отдельного WS-сервера нет (осознанный выбор для 2 vCPU).

### Контекст 6: `media` (`src/domain/media/`, `src/application/media/`)
- **Aggregates**: [`Album`, `MediaAsset`](../src/domain/media/MediaLibrary.ts) — тип выводится из MIME, лимиты 15 МБ (изображение) / 300 МБ (видео) / 50 МБ (аудио), приватный альбом доступен только владельцу.
- **Ports**: [`MediaRepository`, `ObjectStorage`](../src/domain/media/MediaRepository.ts) — `ObjectStorage` абстрагирует S3 (Garage в проде, локальный диск в dev) и умеет отдавать объект потоком.
- **Хранение**: байты в Garage S3, метаданные в PostgreSQL; ключи генерируются сервером (`media/<kind>/<yyyymm>/<random>.<ext>`), что исключает выход за префикс бакета.

### Shared Kernel (`src/domain/shared/`)
- [`DomainError.ts`](../src/domain/shared/DomainError.ts): иерархия `ValidationError`, `InvariantViolationError`, `NotFoundError`, а также контракты `DomainEvent` и `DomainEventBus`.
- [`ValueObjects.ts`](../src/domain/shared/ValueObjects.ts): `EmailAddress`, `SanitizedText`, `BoundedNumber`.

## 2. Матрица 11 контуров профессиональной разработки

| № | Контур | Реализация в репозитории |
|---|---|---|
| 1 | **Предметное моделирование (DDD)** | Value Objects, Aggregate Root `CertificationInquiry`, Domain Services `DemandForecastService` и `AnalyticsAggregationService`, шина событий `DomainEventBus` |
| 2 | **Слоистая / гексагональная архитектура** | Разделение `src/domain/` → `src/application/` → `src/infrastructure/` → HTTP-адаптеры (`src/infrastructure/http/`) и React UI. Домен не импортирует инфраструктуру — проверяется отдельно при аудите |
| 3 | **Безопасность и валидация границ** | Value Objects + Zod, scrypt-хеширование паролей, сессии с хешем токена, CSP и `X-Frame-Options`, HSTS только под HTTPS, RBAC с проверкой на сервере, rate limiting на вход/восстановление и публичные пишущие эндпоинты, изоляция путей [`PathConfinement.ts`](../src/infrastructure/persistence/PathConfinement.ts) |
| 4 | **Качество кода и статический анализ** | Строгая типизация TypeScript, `pnpm run lint` (`tsc --noEmit`), совместимость со strip-types Node 22 |
| 5 | **Автоматизированное тестирование** | `pnpm test` — 98 модульных тестов плюс 10 интеграционных против реального PostgreSQL (`tests/postgres-integration.test.ts`). Интеграционные пропускаются без `TEST_DATABASE_URL`; в CI вынесены в отдельный job с сервисным контейнером |
| 6 | **Производительность и оптимизация** | Лимитирование буфера телеметрии (`500`/`5000`), SQL-агрегаты сводки вместо переноса событий в Node, code splitting (начальный чанк 1280 → 415 КБ), потоковая отдача медиа с поддержкой `Range` |
| 7 | **Наблюдаемость и телеметрия** | Структурированные JSON-логи доменных событий через шину (NATS с откатом к in-memory), `GET /api/health` с реальными пробами БД/шины/миграций (503 при недоступной БД), `GET /api/metrics` с p50/p95 и разбивкой по маршрутам |
| 8 | **Надёжность и отказоустойчивость** | React [`ErrorBoundary.tsx`](../src/components/ErrorBoundary.tsx), атомарная запись файлов через `.tmp` + `fs.renameSync`, устойчивый парсинг JSON с fallback |
| 9 | **Доступность и UX-стандарты** | Единая дизайн-конституция, `tabular-nums`, `focus-visible`, `role="alert"`, WCAG AA контраст |
| 10 | **Документация и управление знаниями** | Поддерживаемая [`LLM Wiki`](./index.md) с фиксацией схемы, контекста и архитектурных решений |
| 11 | **CI/CD и инженерные гейты качества** | `pnpm run verify` и [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): аудит зависимостей, типизация, тесты, сборка и отдельный job интеграционных тестов с PostgreSQL. Деплой — `deploy/release.sh` с тегом образа по SHA и откатом |

## 3. Персистентность

Порты репозиториев асинхронные, потому что продакшен работает на PostgreSQL. Адаптеры:

- **PostgreSQL** — 20 предметных таблиц плюс служебная `schema_migrations`, миграции версионированы (`schema_migrations`, пять шагов), применяются под advisory-lock и каждый шаг в своей транзакции.
- **JSON-файлы и in-memory** — для локальной разработки и тестов, когда `DATABASE_URL` не задан.

Выбор адаптера происходит в композиционном корне; `/api/health` сообщает активный адаптер, поэтому подмена видна сразу.

Аналитический контекст сохраняет контракт `loadStore → mutate → saveStore`, но запись идёт в одной транзакции с ограничением окна (500 сессий / 5000 событий) и дедупликацией событий по естественному ключу `(session_id, event_key)` — без этого повторный `saveStore` дублировал всё окно, что дало 73 тыс. строк в проде.
