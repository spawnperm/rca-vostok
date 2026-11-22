# Техническая архитектура, SEO, аналитика и API

Платформа построена как full-stack приложение на базе **React 19 + TypeScript + Vite 8 + Tailwind CSS v4** и сервера **Express (`server.ts`)** на порту `3000`.

## 1. Структура модулей проекта

- `server.ts` — Единая точка входа Node.js (`tsx server.ts` в dev, `node server.ts` в prod). Подключает Vite middleware в dev или раздаёт `dist/` в production, обслуживает SEO-файлы и REST API.
- `index.html` & `src/utils/seo.ts` — Управление `<title>`, `<meta name="description">`, OpenGraph, Twitter Cards, canonical URL и динамическим внедрением структурированных данных **Schema.org JSON-LD** (`EducationalOrganization`, `FAQPage`, `WebApplication`) под активную вкладку.
- `src/utils/tracker.ts` — Клиентский трекер поведения: фиксирует `session_start`, `pageview`, `click` (включая точные координаты `xPct`/`yPct` для тепловой карты), максимальную глубину скролла (`scroll`), кастомные взаимодействия (`interaction`) и исходящие переходы (`outbound`). Отправка батчами с поддержкой `navigator.sendBeacon`.
- `src/App.tsx` — Корневой каркас с двумя уровнями навигации: **верхний бар** повторяет разделы официального сайта `rca-vostok.ru` (Главная, Обучение, Подготовка, Аттестация, Консалтинг, Связь) и содержит вход в личный кабинет; **правый боковой рельс** (сворачиваемый, на мобильных — выдвижное меню) содержит разделы аналитической платформы (Обзор центра, Калькулятор, Рынок ДФО, Диссертация, Презентации, SEO и аналитика, Личный кабинет). Состояние синхронизировано с URL-параметром `?tab=...`.
- **Компоненты лендинга (`src/components/landing/`)** — содержимое перенесено с официального сайта через его публичный API `https://rca-vostok.ru/api/content` и лежит типизированными данными в `src/data/landingContent.ts`:
  - `LandingHero` — заголовок «Подготовка инструкторов-проводников по туризму», слоган «Обучение — Практика — Аттестация», кнопки перехода к программам и контактам, анонс набора на курсы.
  - `LearningSection` — «Реализуемые программы»: пешеходный и водный туризм, экскурсовод, руководитель туристической группы.
  - `PreparationSection` — «Практика по пешеходному туризму»: подготовка к аттестации, практика по туризму, категорийные походы.
  - `CertificationSection` — «График аттестаций на 2027 год»: пять сессий категории 1–4 КС с дисциплинами (пешеходный, водный, горный, спелеологический и комбинации) и ссылкой на внешнюю аттестацию ФСТР.
  - `ConsultingSection` — консалтинг: паспортизация маршрутов по Постановлению № 760, планирование маршрутов, методическая поддержка.
  - `NewsSection` — «Новости аттестации и рынка»: **публикации из личного кабинета** (вид `news`, подгружаются из `/api/social/feed?kind=news` хуком `useNewsFeed`, обновляются без деплоя), затем шесть записей `INDUSTRY_NEWS` с раскрытием подробностей и блок анонсов `ATTESTATION_ANNOUNCEMENTS` (сессии отдельно, нормативные изменения отдельно). На самом сайте `rca-vostok.ru` этот раздел пока содержит только заголовок «Новый раздел», поэтому содержимое взято из исследовательской базы платформы, а не придумано.
  - `RoutesSection` — «Маршруты и округа Приморского края»: селектор восьми округов `PRIMORYE_DISTRICTS` с карточкой выбранного округа (точки маршрутов, обеспеченность проводниками, расчётная потребность, сезонность, безопасность) и сводными показателями. Аналогично заменяет пустую заглушку сайта.
  - `ContactsSection` — телефон, почта, адрес (Владивосток, ул. Гоголя, 41) и мессенджеры (Telegram, ВКонтакте).
  - Даты сессий форматируются собственной функцией `formatSessionRange` с родительным падежом месяцев: `toLocaleDateString` отдаёт именительный («16–18 апрель»), что по-русски некорректно.
- **Компоненты разделов (`src/components/`)**:
  - `OverviewSection.tsx` + `AttestationRoadmap.tsx` + `AttestationNewsFeed.tsx` + `AttestationCostCalculator.tsx` + `PlatformFeedbackForm.tsx` — Hero-секция с кнопкой «Связаться с куратором» (модальное окно консультации с отправкой в `/api/inquiries`), 4 KPI, архитектура РЦА, **дорожная карта аттестации (5 шагов до удостоверения)**, **лента новостей аттестации (анонсы сессий и изменения НПА)**, **калькулятор стоимости аттестации и обучения ДПО**, **статус аккредитации центра**, 4 этапа и программы ВВГУ, сравнительные графики, **горизонтальный таймлайн 2025–2030**, эмпирическая таблица, **карусель «Отзывы экспертов»**, **лента «Новости индустрии»**, **глоссарий терминов** с hover-подсказками, **FAQ (12 вопросов с поиском и эскалацией куратору)**, **форма подписки на уведомления** и **форма обратной связи по работе платформы** (`/api/feedback`).
  - `CalculatorSection.tsx` + `DfoRegionalForecastModule.tsx` — Интерактивный калькулятор потребности, пресеты сценариев, график чувствительности по `P_org`, симулятор закрытия разрыва до 2030 года и **модуль прогнозирования потребности по 7 регионам ДФО до 2030 г. с учётом туристического потока** (`DemandForecastService.forecastDfoRegions2030`, `DFO_REGIONAL_FLOW_PROFILES`).
  - `MarketSection.tsx` + `PrimoryeActivityMap.tsx` + `DfoComparisonSvgMap.tsx` + `DfoRegionComparisonChart.tsx` + `DfoCertifiedDynamicsLineChart.tsx` — Сегменты ДФО, интерактивная SVG-карта активности по 8 округам Приморья, **интерактивная SVG-карта 7 субъектов ДФО для автозаполнения формы сравнения регионов**, **линейный график Recharts динамики аттестованных инструкторов по годам (2024–2030 гг.) для выбранного на карте региона** (`DFO_CERTIFIED_DYNAMICS_BY_REGION`), **межрегиональное визуальное сравнение двух выбранных субъектов ДФО** (`BarChart` структуры аттестации/долей и `LineChart` прогноза спроса 2025–2030), 5 узких мест, горизонты 1–3 года и 7 рекомендаций.
  - `DissertationSection.tsx` — Паспорт ВАК 5.2.3, таблица сравнения кандидатской/докторской, новизна, IFMGA и публикации.
  - `PresentationsSection.tsx` — Две колоды (18 и 10 слайдов), навигация клавишами, таймер репетиции и печатный раздаточный лист.
  - `AnalyticsSection.tsx` + `DfoDemandForecastChart.tsx` + `DfoRegionsDistributionMap.tsx` — Панель SEO-аудита (мета-теги, `robots.txt`, `sitemap.xml`), статистика визитов и устройств, **синхронизированный фильтр по 7 регионам ДФО**, **график прогнозной динамики спроса в регионах ДФО до 2030 года (Recharts)**, **SVG-карта географического распределения аттестованных проводников ДФО**, лента событий сессий и визуальная **Click Heatmap**.

## 2. Серверные маршруты (`server.ts`)

| Метод и путь | Назначение | Хранилище / ответ |
|---|---|---|
| `GET /robots.txt` | Динамическая генерация правил индексации с указанием актуального `Sitemap` | `text/plain; charset=utf-8` |
| `GET /sitemap.xml` | Карта сайта по всем 6 маршрутам (`/?tab=...`) с приоритетами | `application/xml; charset=utf-8` |
| `POST /api/analytics/collect` | Приём батча событий поведения, определение устройства/браузера, обновление сессий | `/data/analytics-store.json` (лимит 500 сессий / 5000 событий) |
| `GET /api/analytics/summary` | Агрегированная статистика, таймлайн трафика, топ кликов, точки тепловой карты | JSON-дашборд |
| `GET /api/analytics/sessions/:sessionId` | Детальный лог действий выбранной сессии | JSON |
| `DELETE /api/analytics/reset` | Очистка накопленной статистики аналитики | JSON `{ ok: true }` |
| `GET /api/seo/server-status` | Проверка доступности и URL-адресов `/robots.txt` и `/sitemap.xml` | JSON |
| `GET /api/inquiries/stats` | Публичный счётчик зарегистрированных подписок без раскрытия ПДн | JSON `{ totalSubscriptions }` |
| `POST /api/inquiries` | Валидация и сохранение заявки инструктора (ФИО, email, контакты, регион, трек, опыт) | `/data/inquiries.json` (атомарная запись через `.tmp.json`) |
| `GET /api/feedback/stats` | Публичный счётчик обращений по развитию платформы без раскрытия ПДн | JSON `{ totalFeedback }` |
| `POST /api/feedback` | Валидация и сохранение предложений/вопросов по работе платформы | `/data/feedback.json` (атомарная запись через `.tmp`) |
| `POST /api/auth/register` | Самостоятельная регистрация в личном кабинете; роль всегда `candidate` | `users` + сессионная cookie |
| `POST /api/auth/login` | Вход по email/паролю, выпуск сессии (scrypt-проверка) | `user_sessions` (хранится SHA-256 хеш токена) |
| `POST /api/auth/logout` | Завершение сессии и очистка cookie | `{ ok: true }` |
| `GET /api/auth/session` | Восстановление сессии при загрузке SPA | `{ authenticated, user }` |
| `GET /api/account/profile` | Профиль текущего пользователя (требует `profile:view_own`) | JSON `UserDTO` |
| `PATCH /api/account/profile` | Редактирование ФИО, региона, организации (требует `profile:edit_own`) | JSON `UserDTO` |
| `POST /api/account/password` | Смена пароля; отзывает **все** сессии аккаунта | `{ ok: true, reauthenticate: true }` |
| `GET /api/admin/users` | Список учётных записей (требует `users:manage`) | `{ users: UserDTO[] }` |
| `PATCH /api/admin/users/:id/role` | Назначение роли; запрещено самопонижение администратора | JSON `UserDTO` |
| `PATCH /api/admin/users/:id/status` | Блокировка/разблокировка; запрещена самоблокировка | JSON `UserDTO` |

### 2.1. Ограниченный контекст `identity` и RBAC

Личный кабинет реализован как отдельный ограниченный контекст по образцу существующих (`domain` → `application` → `infrastructure`):

- `src/domain/identity/Rbac.ts` — единственный источник истины по правам: `PERMISSIONS` (8 возможностей), `ROLES` (`candidate`, `instructor`, `curator`, `admin`) и матрица `ROLE_PERMISSIONS`. Гранты кумулятивны: `candidate ⊂ instructor ⊂ curator ⊂ admin`.
- `src/domain/identity/User.ts` — агрегат пользователя: валидация пароля (минимум 10 символов, буквы и цифры, отказ от односимвольных повторов), неизменяемые `email`/`role`, `can()`/`assertCan()` для доменных проверок, `ForbiddenError` с кодом `FORBIDDEN`.
- `src/domain/identity/IdentityRepositories.ts` — порты `UserRepository` и `SessionRepository` (асинхронные, как и остальные адаптеры PostgreSQL).
- `src/application/identity/IdentityUseCases.ts` — регистрация, вход, выход, разыменование сессии, профиль, смена пароля, администрирование пользователей.
- `src/infrastructure/security/ScryptPasswordHasher.ts` — scrypt (встроен в Node, без нативных зависимостей), `timingSafeEqual` при проверке; `Sha256SessionTokenService` выпускает 32-байтные токены.
- `src/infrastructure/http/AuthMiddleware.ts` — `requireAuth()` и `requirePermission()`: маршруты описывают требуемую **возможность**, а не роль, поэтому все проверки проходят через одну точку.
- `src/infrastructure/http/IdentityRouter.ts` — HTTP-адаптер контекста.
- `src/components/AccountSection.tsx` — UI кабинета: вход/регистрация, профиль, смена пароля, список своих прав и (только для `admin`) управление пользователями.

Ключевые защитные решения:

1. **Никакой эскалации при регистрации.** `RegisterUserUseCase` собирает агрегат из явного белого списка полей и принудительно ставит `candidate`; переданный в теле запроса `role: "admin"` игнорируется (покрыто тестом).
2. **Сессии непрозрачны для БД.** В `user_sessions` хранится только `sha256(token)`; cookie — `HttpOnly`, `SameSite=Lax`, `Secure` при `https` в `APP_URL`.
3. **Единый ответ на неудачный вход.** Неверный пароль и несуществующий аккаунт возвращают одинаковую ошибку `INVALID_CREDENTIALS`, чтобы не раскрывать наличие учётной записи.
4. **Смена пароля отзывает все сеансы** (`deleteByUserId`), принуждая повторный вход.
5. **Администратор не может лишиться доступа**: самопонижение роли и самоблокировка возвращают `403`.
6. **Роль ограничена на уровне БД** (`users_role_check`), а `parseRole` деградирует к `candidate` при неизвестном значении — испорченная строка не даёт прав.

### 2.2. Социальный профиль, чат, блог и медиатека

Личный кабинет расширен до профиля встроенной социальной сети. Три новых ограниченных контекста используют ту же слоистую схему (`domain` → `application` → `infrastructure`) и разрешения из `Rbac.ts`.

| Контекст | Домен | Таблицы | Ключевые правила |
|---|---|---|---|
| `social` | `Post`, `Comment`, `SocialProfile` | `posts`, `post_comments`, `post_likes`, `social_profiles`, `social_follows`, `social_activity` | Три вида: `update`, `article` (заголовок и ≥200 символов), `news` (заголовок и ≥40 символов, выводится на публичный лендинг); статья требует заголовок и ≥200 символов; теги дубликаты схлопываются, лимит 8; удаление записи мягкое (`status='removed'`) |
| `chat` | `Channel`, `ChatMessage` | `chat_channels`, `chat_members`, `chat_messages`, `chat_reactions` | Модель повторяет объекты Mattermost (`Channel`/`Member`/`Post`/`Reaction`); `rootId` превращает сообщение в ответ треда; реакции валидируются по белому списку эмодзи |
| `media` | `Album`, `MediaAsset` | `media_albums`, `media_assets` | Тип выводится из MIME; лимиты 15 МБ (изображение), 300 МБ (видео), 50 МБ (аудио); приватный альбом отдаётся только владельцу |

Дополнительные разрешения (всего 18): `social:view_feed`, `social:publish_post`, `social:comment`, `social:react`, `social:follow`, `social:moderate`, `chat:use`, `chat:create_channel`, `chat:moderate`, `media:upload`, `media:create_album`, `media:moderate`. Роли `candidate` и `instructor` получают полный набор социальных прав, но не модерируют; создание каналов и модерация — у `curator` и `admin`.

**Хранение медиа.** Байты лежат в Garage S3 (`rca-media`), метаданные — в PostgreSQL. S3 требует подписанных запросов, поэтому файлы отдаёт само приложение по маршруту `GET /media/:assetId`, предварительно проверяя видимость альбома; ключи объектов генерируются сервером (`media/<kind>/<yyyymm>/<random>.<ext>`), что исключает выход за префикс бакета.

**Медиапроигрыватель** (`src/components/media/MediaPlayer.tsx`) построен на нативных `<video>`/`<audio>`: воспроизведение, перемотка с индикацией буфера, громкость, выбор скорости (0.5–2×), полный экран и клавиатурные сокращения (пробел, стрелки, `m`, `f`).

**Шина событий.** `NatsDomainEventBus` публикует доменные события в NATS (`rca.events.<context>.<event>`) и одновременно доставляет их локальным подписчикам. Если брокер недоступен, приложение автоматически использует `InMemoryDomainEventBus` — сбой необязательной зависимости не блокирует запуск и не ломает пользовательские сценарии.

**Валидация границ.** Схемы Zod (`createPostSchema`, `feedQuerySchema`, `sendMessageSchema`, `uploadMetaSchema` и др.) проверяют форму запроса до домена и дают сообщение с именем поля; доменные инварианты остаются вторым рубежом.

**Документация API.** `GET /api/openapi.json` отдаёт спецификацию OpenAPI 3.1 (18 путей, 6 схем), `GET /api/docs` — интерактивный интерфейс Scalar.

## 3. Визуальные ассеты и правила игнорирования


- Сгенерированные изображения в `/src/assets/images/`:
  - `primorye_ridge_expedition_1795333557369.jpg`
  - `river_rafting_taiga_1795333557039.jpg`
  - `trail_safety_assessment_1795333557526.jpg`
- Правило `.gitignore` настроено как `/data/` (с ведущим слэшем), чтобы runtime-файлы (`/data/analytics-store.json`, `/data/inquiries.json`) не попадали в Git, а модуль данных [`src/data/researchData.ts`](../src/data/researchData.ts) отслеживался в репозитории.

## 4. Команды сборки и проверки

Менеджер пакетов — **pnpm** (зафиксирован в `packageManager`, запускается через Corepack). Локфайл `pnpm-lock.yaml` обязателен; `package-lock.json`, `yarn.lock` и `bun.lock` игнорируются.

- Установка: `pnpm install` (в CI и Docker — `pnpm install --frozen-lockfile`)
- Разработка: `pnpm run dev` (`tsx server.ts`)
- Проверка типов: `pnpm run lint` (`tsc --noEmit`)
- Тесты: `pnpm test` (`node --test tests/*.test.ts`)
- Продакшен-сборка и запуск: `pnpm run build` (`vite build`) → `pnpm run start` (`node server.ts`)
- Полный гейт: `pnpm run verify` (lint + test + build)

**Разрешения на build-скрипты.** pnpm 11 по умолчанию не выполняет postinstall-скрипты зависимостей. Разрешённые пакеты перечислены явно в `pnpm-workspace.yaml` (`allowBuilds`): `esbuild` (скачивает платформенный бинарник), `@google/genai` и `protobufjs`. Без записи `esbuild: true` сборка и `tsx` падают; добавление новой зависимости со скриптом требует такой же записи, иначе pnpm завершится с `ERR_PNPM_IGNORED_BUILDS`.
