# Руководство по установке и настройке платформы РЦА «Русский Восток» (`rca_vostok`)

Подробное руководство по развёртыванию, конфигурации, логированию и эксплуатации исследовательской и управленческой платформы **РЦА «Русский Восток»** из репозитория [`https://github.com/spawnperm/rca_vostok`](https://github.com/spawnperm/rca_vostok).

---

## 1. Архитектура и режимы работы

Платформа представляет собой full-stack TypeScript-приложение (**React 19 + Vite 8 + Tailwind CSS v4 + Express 4**) на базе Domain-Driven Design (8 ограниченных контекстов: `certification`, `analytics`, `research`, `feedback`, `identity`, `social`, `chat`, `media`).

Сервер (`server.ts`, порт `3000`) автоматически адаптируется под доступное окружение:

| Режим | Хранилище | Шина событий | Почта | Медиатека S3 | Какие модули активны |
|---|---|---|---|---|---|
| **Лёгкий локальный** (без БД) | JSON-файлы в `./data/` | `InMemoryDomainEventBus` | `LoggingMailer` (пишет в лог) | Отключена | Лендинг, аналитика, калькуляторы, заявки, отзывы, базовый кабинет (`identity`) |
| **Стендовый / полный** | PostgreSQL 17 | `InMemoryDomainEventBus` или NATS | `LoggingMailer` или SMTP | Опционально Garage S3 | Все модули, включая социальную ленту (`social`), чат (`chat`), медиаальбомы (`media`) |
| **Продакшен (Docker Compose)** | PostgreSQL 17 | NATS 2.10 (JetStream) | SMTP (`SmtpMailer`) | Garage S3 v1.0.1 | Полный стек за обратным прокси Traefik v3.3 + бэкапы в S3 + Forgejo |

---

## 2. Системные требования и зависимости

### 2.1. Базовые требования (для локального запуска и сборки)

- **Операционная система**: Linux (Ubuntu 22.04+/Debian 12+), macOS или Windows WSL2.
- **Node.js**: **>= 22.18** (в `Dockerfile` используется `node:22.23.5-bookworm-slim`). Требуется для прямого запуска `server.ts` со встроенным стриппингом TypeScript-типов (`node server.ts`, `node --test tests/*.test.ts`).
- **Менеджер пакетов**: **npm** (входит в состав Node.js 22).
- **Git**: `2.30+`.

### 2.2. Опциональные внешние сервисы (для полного функционала и продакшена)

- **Docker Engine** `24+` и **Docker Compose v2** (`docker compose`).
- **PostgreSQL 17** — реляционное хранилище для всех 8 контекстов и версионированных миграций (`schema_migrations`).
- **NATS 2.10** — брокер доменных событий (при недоступности приложение автоматически откатывается к `InMemoryDomainEventBus`).
- **Garage v1.0.1** (или совместимый S3) — объектное хранилище для медиабиблиотеки (`rca-media`) и дампов БД (`rca-vostok-backups`).
- **SMTP-сервер** — доставка писем восстановления пароля (`/api/auth/forgot-password`).
- **Traefik v3.3** — маршрутизация HTTP-трафика в Docker Compose.

### 2.3. Ключевые зависимости приложения (`package.json`)

| Категория | Пакет | Назначение |
|---|---|---|
| **Сервер и API** | `express`, `dotenv`, `zod`, `@scalar/express-api-reference` | HTTP-сервер, загрузка `.env`, валидация запросов, OpenAPI 3.1 + Scalar (`/api/docs`) |
| **Хранение и интеграции** | `pg`, `nats`, `@aws-sdk/client-s3`, `nodemailer` | Клиенты PostgreSQL, NATS, S3/Garage и SMTP |
| **Фронтенд и UI** | `react`, `react-dom`, `lucide-react`, `motion`, `tailwindcss`, `@tailwindcss/vite` | SPA-интерфейс, иконки, анимации, стилизация Tailwind CSS v4 |
| **Визуализация и карты** | `recharts`, `d3`, `leaflet`, `react-leaflet`, `@vis.gl/react-google-maps`, `jspdf` | Графики спроса/статистики, карты ДФО, экспорт PDF |
| **Сборка и разработка** | `vite`, `tsx`, `typescript`, `esbuild`, `@types/*` | Сборка SPA, запуск `server.ts` в dev-режиме (`tsx`), проверка типов (`tsc --noEmit`) |

---

## 3. Установка и первоначальная подготовка

### Шаг 1. Клонирование репозитория

```bash
git clone https://github.com/spawnperm/rca_vostok.git
cd rca_vostok
```

### Шаг 2. Установка Node.js-зависимостей

```bash
npm install
```

### Шаг 3. Создание файла конфигурации `.env`

Скопируйте шаблон переменных окружения:

```bash
cp .env.example .env
```

---

## 4. Конфигурация переменных окружения (`.env`)

### 4.1. Полный справочник переменных

| Переменная | Обязательна | Значение по умолчанию | Описание |
|---|---|---|---|
| `PORT` | Нет | `3000` | Порт HTTP-сервера Express |
| `NODE_ENV` | Нет | `development` | Режим (`development` или `production`) |
| `APP_URL` | Да (в prod) | `http://localhost:3000` | Публичный URL (canonical-ссылки, `robots.txt`, `sitemap.xml`, флаг `Secure` у cookie, ссылки сброса пароля) |
| `TRUST_PROXY` | Нет | `true` (`1` в Docker Compose) | Политика `trust proxy` Express (число хопов прокси за Traefik/Cloud Run или `true`/`false`) |
| `GEMINI_API_KEY` | Нет | — | Серверный ключ Gemini API (при подключении ИИ-функций) |
| `DATABASE_URL` | Нет | — | Строка подключения PostgreSQL (`postgres://user:pass@host:5432/db`). Приоритетнее `PG*` |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | Нет | `PGPORT=5432`, `PGDATABASE=rca_vostok`, `PGUSER=rca` | Раздельные параметры подключения к PostgreSQL (используются, если не задан `DATABASE_URL`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FULL_NAME`, `ADMIN_REGION` | Нет | — | Автоматическое создание/обновление администратора при старте сервера |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Нет | `SMTP_PORT=587`, `SMTP_SECURE=false` | Параметры SMTP для отправки писем (без `SMTP_HOST` используется `LoggingMailer`) |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL` | Нет | `S3_REGION=garage`, `S3_BUCKET=rca-media`, `S3_PUBLIC_BASE_URL=/media` | Настройки S3/Garage для медиаальбомов |
| `NATS_URL` | Нет | — | Адрес брокера NATS (`nats://nats:4222`). Без него работает `InMemoryDomainEventBus` |
| `LOG_LEVEL` | Нет | `DEBUG` (dev) / `INFO` (prod) | Уровень детализации логов: `DEBUG`, `INFO`, `ERROR` |
| `LOG_TO_FILE` | Нет | `true` (`false` в `node --test`) | Включает или отключает запись логов на диск |
| `LOG_DIR` | Нет | `./logs` | Директория хранения файлов логов |
| `LOG_FILE` | Нет | `rca-vostok.log` | Имя файла логов внутри `LOG_DIR` |
| `LOG_FORMAT` | Нет | `pretty` (dev) / `json` (prod) | Формат вывода в консоль (`pretty` или `json`); в файл всегда пишется NDJSON |
| `LOG_MAX_SIZE_MB` | Нет | `10` | Максимальный размер одного файла лога (МБ) до ротации |
| `LOG_MAX_FILES` | Нет | `5` | Количество сохраняемых архивных файлов ротации (`*.1` .. `*.N`) |

### 4.2. Примеры готовых конфигураций

#### Пример 1. Минимальный `.env` для локальной разработки (без БД)

```dotenv
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Логирование с максимальной детализацией в файл и удобным выводом в консоль
LOG_LEVEL=DEBUG
LOG_TO_FILE=true
LOG_DIR=./logs
LOG_FILE=rca-vostok-dev.log
LOG_FORMAT=pretty
LOG_MAX_SIZE_MB=10
LOG_MAX_FILES=3
```

#### Пример 2. Локальный или стендовый `.env` с PostgreSQL

```dotenv
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

DATABASE_URL=postgres://rca:strong_local_password@127.0.0.1:5432/rca_vostok

# Начальный администратор (пароль >= 10 символов, буквы и цифры)
ADMIN_EMAIL=admin@rca-vostok.ru
ADMIN_PASSWORD=RcaAdmin2026Strong
ADMIN_FULL_NAME="Администратор РЦА"
ADMIN_REGION="Приморский край"

LOG_LEVEL=INFO
LOG_TO_FILE=true
LOG_DIR=./logs
LOG_FILE=rca-vostok.log
LOG_FORMAT=pretty
```

#### Пример 3. Продакшен `.env` для Docker Compose

```dotenv
NODE_ENV=production
PORT=3000
APP_URL=https://rca-vostok.ru

# PostgreSQL (используется контейнерами postgres, postgres-init, app, forgejo)
POSTGRES_DB=rca_vostok
POSTGRES_USER=rca
POSTGRES_PASSWORD=REPLACE_WITH_LONG_RANDOM_PASSWORD
FORGEJO_DB_NAME=forgejo

# Опциональный NATS (в docker-compose по умолчанию nats://nats:4222)
NATS_URL=nats://nats:4222

# S3 / Garage (ключи создаются после инициализации Garage)
S3_ENDPOINT=http://garage:3900
S3_REGION=garage
S3_BUCKET=rca-media
S3_ACCESS_KEY_ID=GKxxxxxxxxxxxxxxxxxxxx
S3_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
S3_PUBLIC_BASE_URL=/media

# Бэкапы PostgreSQL в Garage S3 (deploy/backup.sh)
GARAGE_S3_ACCESS_KEY=GKxxxxxxxxxxxxxxxxxxxx
GARAGE_S3_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GARAGE_S3_BUCKET=rca-vostok-backups

# SMTP-почта
SMTP_HOST=smtp.example.ru
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=no-reply@rca-vostok.ru
SMTP_PASSWORD=REPLACE_WITH_SMTP_PASSWORD
SMTP_FROM="РЦА «Русский Восток» <no-reply@rca-vostok.ru>"

# Домен для Forgejo
FORGEJO_DOMAIN=rca-vostok.ru
FORGEJO_ROOT_URL=https://rca-vostok.ru/git/

# Логирование
LOG_LEVEL=INFO
LOG_TO_FILE=true
LOG_DIR=/app/logs
LOG_FILE=rca-vostok.log
LOG_FORMAT=json
LOG_MAX_SIZE_MB=20
LOG_MAX_FILES=5
```

---

## 5. Система логирования (`DEBUG`, `INFO`, `ERROR`)

Логирование реализовано в модуле `src/infrastructure/logging/Logger.ts` и интегрировано во все серверные подсистемы (`server`, `http`, `persistence`, `pg`, `migrations`, `auth`, `identity`, `rate-limit`, `mail`, `events`, `storage`, `housekeeping`, `admin`).

### 5.1. Уровни детализации

| Уровень | Что фиксируется | Когда использовать |
|---|---|---|
| `DEBUG` | Полная трассировка: все не-API HTTP-запросы (статика/Vite), детали конфигурации при старте, холостые запуски `HousekeepingJob`, отправка событий в NATS, тело писем `LoggingMailer` | Локальная отладка и диагностика инцидентов |
| `INFO` | Жизненный цикл сервера, выбор адаптера БД/почты/хранилища, применение миграций, доменные события, завершённые запросы `/api/*` (2xx–4xx), очистка просроченных сессий | Рекомендуемый уровень для продакшена |
| `ERROR` | HTTP-ответы `5xx`, необработанные исключения маршрутов, сбои БД/NATS/SMTP/S3, ошибки фоновой очистки, неизвестные правила rate-limiter | Минимальный режим (только сбои) |

### 5.2. Формат записей и ротация файлов

- **Хранение в файле**: записи сохраняются построчно в формате **NDJSON** в файл `<LOG_DIR>/<LOG_FILE>` (путь контролируется через `resolveConfinedPath`, каталог создаётся автоматически).
- **Пример записи в файле:**

```json
{"timestamp":"2026-11-22T19:30:12.415Z","level":"INFO","context":"app:http","message":"API request completed","meta":{"requestId":"a1b2c3d4","method":"GET","path":"/api/health","status":200,"durationMs":3.42,"ip":"127.0.0.1"}}
```

- **Корреляция запросов**: HTTP-middleware (`src/infrastructure/http/RequestLogger.ts`) присваивает каждому запросу заголовок `X-Request-Id` и передаёт его в `meta.requestId`.
- **Маскирование секретов**: поля с именами, содержащими `password`, `secret`, `token`, `cookie`, `authorization`, `api_key`, `credential`, автоматически заменяются на `"[REDACTED]"`.
- **Ротация**: при превышении `LOG_MAX_SIZE_MB` текущий файл сдвигается в `<LOG_FILE>.1` … `<LOG_FILE>.<LOG_MAX_FILES>`.
- **Корректное завершение (`flush`)**: при получении `SIGTERM`/`SIGINT` сервер дожидается записи буфера логов на диск перед выходом.

### 5.3. Просмотр логов в реальном времени

Локально:
```bash
tail -f logs/rca-vostok.log
```

В Docker Compose (stdout контейнера + том `rca-app-logs`):
```bash
docker compose logs -f app
docker compose exec app tail -f /app/logs/rca-vostok.log
```

---

## 6. Запуск и проверка работоспособности

### 6.1. Режим разработки (Vite HMR/middleware + `tsx`)

```bash
npm run dev
```

Сервер поднимется на `http://0.0.0.0:3000`. В режиме `development` Express монтирует `vite.middlewares`, поэтому фронтенд и API работают в одном процессе на порту `3000`.

### 6.2. Продакшен-сборка и запуск без Docker

```bash
npm run build
NODE_ENV=production npm run start
```

Собранная статика помещается в `dist/`, а `node server.ts` раздаёт её и обслуживает REST API.

### 6.3. Создание первого администратора

Публичная регистрация (`POST /api/auth/register`) всегда присваивает роль `candidate`. Создать или повысить администратора можно двумя способами:

1. **Через переменные окружения** `ADMIN_EMAIL` + `ADMIN_PASSWORD` при старте `server.ts`.
2. **Через CLI-скрипт `scripts/create-admin.ts`** (пароль передаётся через `stdin`, не попадая в историю команд и список процессов):

```bash
node scripts/create-admin.ts <<'JSON'
{
  "fullName": "Смирнов Александр",
  "email": "admin@rca-vostok.ru",
  "password": "RcaAdmin2026Strong",
  "region": "Приморский край"
}
JSON
```

В Docker Compose:
```bash
docker compose exec -T app node scripts/create-admin.ts <<'JSON'
{"fullName":"Смирнов Александр","email":"admin@rca-vostok.ru","password":"RcaAdmin2026Strong","region":"Приморский край"}
JSON
```

### 6.4. Smoke-проверка эндпоинтов

```bash
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1:3000/api/health/live
curl -fsS http://127.0.0.1:3000/api/health/ready
curl -fsS http://127.0.0.1:3000/api/metrics
curl -fsS "http://127.0.0.1:3000/api/metrics?format=prometheus" | head -n 15
curl -fsS http://127.0.0.1:3000/robots.txt
curl -fsS http://127.0.0.1:3000/sitemap.xml | head -n 10
```

Интерактивная документация OpenAPI 3.1 (Scalar) доступна в браузере по адресу `http://localhost:3000/api/docs` (спецификация JSON — `GET /api/openapi.json`).

---

## 7. Развёртывание полного стека в Docker Compose

### 7.1. Подготовка секретов и конфигурационных файлов

1. Заполните `.env` по образцу **Примера 3** (раздел 4.2).
2. Отредактируйте `deploy/garage.toml`: сгенерируйте секреты (`openssl rand -hex 32`) и подставьте их в `rpc_secret`, `admin_token` и `metrics_token`.
3. При необходимости привязки домена и HTTPS настройте `entrypoint websecure` в `deploy/traefik.yml` и маршруты в `deploy/traefik-dynamic.yml`.

### 7.2. Запуск контейнеров

```bash
docker compose up -d --build
docker compose ps
```

При старте `app` автоматически применяет версионированные миграции PostgreSQL (`001_analytics_and_content` … `005_media`) под advisory-блокировкой.

### 7.3. Однократная инициализация S3 Garage

```bash
NODE=$(docker exec rca-garage /garage status | awk '/^[0-9a-f]{16}/{print $1; exit}')
docker exec rca-garage /garage layout assign -z dc1 -c 20G "$NODE"
docker exec rca-garage /garage layout apply --version 1

# Бакет для бэкапов и бакет для медиатеки
docker exec rca-garage /garage bucket create rca-vostok-backups
docker exec rca-garage /garage bucket create rca-media

# Ключ доступа
docker exec rca-garage /garage key create rca-app-key
docker exec rca-garage /garage bucket allow --read --write --owner rca-vostok-backups --key rca-app-key
docker exec rca-garage /garage bucket allow --read --write --owner rca-media --key rca-app-key
docker exec rca-garage /garage key info rca-app-key --show-secret
```

Скопируйте полученные `Key ID` и `Secret key` в `.env` (`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `GARAGE_S3_ACCESS_KEY`, `GARAGE_S3_SECRET_KEY`) и перезапустите `app`:

```bash
docker compose up -d app
```

### 7.4. Резервное копирование, обновление и откат

- **Ручной бэкап БД в S3:** `./deploy/backup.sh`
- **Cron (ежедневно в 03:00):**
  ```cron
  0 3 * * * cd /opt/rca-vostok && ./deploy/backup.sh >> /var/log/rca-backup.log 2>&1
  ```
- **Выкат релиза и мгновенный откат:**
  ```bash
  ./deploy/release.sh             # сборка и выкат origin/main с проверкой healthcheck
  ./deploy/release.sh --rollback  # возврат к предыдущему тегу образа
  ```
- Подробности по `tmux`-сессиям эксплуатации (`deploy/setup-tmux.sh`, `deploy/setup-tmux-dev.sh`) приведены в [`deploy/README.md`](../deploy/README.md).

---

## 8. Проверка качества и тестирование

| Проверка | Команда (`npm`) | Что проверяет |
|---|---|---|
| Типизация TypeScript | `npm run lint` | `tsc --noEmit` без ошибок |
| Модульные и прикладные тесты | `npm test` | Все `tests/*.test.ts` (включая HTTP/API-тесты безопасности и `tests/logger.test.ts`; тесты БД пропускаются без `TEST_DATABASE_URL`) |
| Интеграционные тесты PostgreSQL | `TEST_DATABASE_URL=postgres://rca:pass@127.0.0.1:5432/rca_vostok_test node --test tests/postgres-integration.test.ts` | Реальные миграции, SQL-агрегаты, ограничения и каскады |
| Сборка бандла | `npm run build` | `vite build` в `dist/` |
| Полный цикл проверки | `npm run verify` | `lint` + `test` + `build` |

---

## 9. Решение типовых проблем (Troubleshooting)

1. **При запуске `node server.ts` падает с ошибкой синтаксиса TypeScript**
   - Проверьте версию Node.js (`node -v`). Требуется **Node.js >= 22.18** с поддержкой прямого стриппинга типов (не используйте `enum` и parameter properties в серверных `.ts`-модулях).
2. **Разделы «Лента», «Чат», «Медиа» недоступны после старта**
   - Эти 3 контекста требуют PostgreSQL (`DATABASE_URL` или `PGHOST` + `PGDATABASE`). Без БД сервер работает в режиме `json-file` и монтирует только публичную часть и базовый кабинет `identity`.
3. **`GET /api/health/ready` или `/api/health` возвращает `503 unhealthy`**
   - Проверьте доступность PostgreSQL и завершение миграций (`SELECT version FROM schema_migrations;`), а также лог-файл `logs/rca-vostok.log` с уровнем `LOG_LEVEL=DEBUG`.
4. **Ошибки прав записи в `/app/logs` или `/app/data` при монтировании локальных папок в Docker**
   - В контейнере процесс работает от пользователя `node` (UID `1000`). Используйте именованные Docker-тома (как `rca-app-logs:/app/logs` в `docker-compose.yml`) либо назначьте владельца `chown -R 1000:1000 ./logs ./data` на хосте.
5. **Лимитер (`429 RATE_LIMITED`) срабатывает одинаково для всех пользователей**
   - Убедитесь, что перед приложением стоит доверенный обратный прокси (например, Traefik), перезаписывающий заголовок `X-Forwarded-For`, и корректно задана переменная `TRUST_PROXY=1`.
