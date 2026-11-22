# Хронологический журнал операций (LLM Wiki Log)

Журнал ведётся в режиме добавления новых записей (append-only) и фиксирует ключевые события диалога, синтеза источников, разработки модулей и публикации коммитов в `spawnperm/rca-vostok`.

---

## [2026-11-22] init | Базовая платформа РЦА «Русский Восток», SEO и трекинг поведения
- Изучены веб-источник `https://rca-vostok.ru/` и 5 прикреплённых файлов в `/public/assets/aistudio/` (`00`–`04`).
- Создана многомодульная платформа на базе React 19 + Tailwind CSS v4 + Express (`server.ts` на порту `3000`).
- Реализованы модули: `OverviewSection`, `CalculatorSection`, `MarketSection`, `PrimoryeActivityMap` (8 округов Приморья), `DissertationSection`, `PresentationsSection` (18 и 10 слайдов + печатный лист), `AnalyticsSection`.
- Добавлены динамические `/robots.txt`, `/sitemap.xml`, Schema.org JSON-LD (`src/utils/seo.ts`), сбор реальных визитов и карта кликов (`src/utils/tracker.ts`, `/api/analytics/*`, хранение в `/data/analytics-store.json`).
- Добавлена секция FAQ (8 вопросов с фильтрацией по категориям) в `OverviewSection`.
- Создан репозиторий `https://github.com/spawnperm/rca-vostok`; зафиксированы коммиты `716cd62` (инициализация платформы) и `8dcc928` (уточнение `.gitignore` с `/data/` и добавление `src/data/researchData.ts`).

## [2026-11-22] feature | Форма обратной связи инструкторов и серверный приём заявок
- В `OverviewSection.tsx` добавлен блок подписки на уведомления об аттестации (ФИО, email, телефон/Telegram, регион ДФО, направление, комментарий, согласие).
- В `server.ts` реализованы эндпоинты `POST /api/inquiries` (валидация и сохранение в `/data/inquiries.json`) и `GET /api/inquiries/stats` (агрегированный счётчик без раскрытия ПДн).
- Зафиксирован и отправлен в GitHub коммит `7f0a394`.

## [2026-11-22] feature | Блок «Отзывы экспертов» и секция «Новости индустрии»
- В `src/data/researchData.ts` добавлены наборы `EXPERT_TESTIMONIALS` (5 экспертов ДФО) и `INDUSTRY_NEWS` (6 датированных событий с февраля по ноябрь 2026 г.).
- В `OverviewSection.tsx` реализована интерактивная карусель цитат экспертов со счётчиком `01 / 05` и панелью быстрого выбора, а также хронологическая лента новостей с фильтром по категориям и раскрытием деталей.
- Пройдены `compile_applet` и `tsc --noEmit`; зафиксирован и отправлен в GitHub коммит `747b65b`.

## [2026-11-22] feature | Горизонтальный таймлайн «Этапы развития аттестации 2025-2030»
- В `src/data/researchData.ts` добавлен массив `ATTESTATION_TIMELINE_2025_2030` (6 этапов с 2025 по 2030 гг.).
- В `OverviewSection.tsx` добавлена интерактивная горизонтальная таймлайн-лента с GPU-анимацией шкалы прогресса (`transform: scaleX`), узлами этапов (`01`–`06`), стрелками навигации и карточкой контрольных задач.
- Пройдены `compile_applet` и `tsc --noEmit`; зафиксирован и отправлен в GitHub коммит `7b39461`.

## [2026-11-22] wiki | Сохранение полного контекста диалога в формате LLM Wiki
- Сформирована папка `/wiki/` (`SCHEMA.md`, `index.md`, `log.md`, `dialogue-context.md`, `sources-synthesis.md`, `entities-and-institutions.md`, `economic-model-and-market.md`, `dissertation-and-presentations.md`, `system-architecture.md`) с перекрёстными ссылками на все исходные файлы, модули и коммиты.
- Обновлён `README.md` ссылкой на каталог `/wiki/index.md` и подготовлена публикация в GitHub (`spawnperm/rca-vostok`).

## [2026-11-22] refactor | Внедрение DDD и 11 контуров профессиональной разработки
- Выделены слои `src/domain/` (`shared`, `certification`, `analytics`), `src/application/` (Use Cases), `src/infrastructure/` (JSON-репозитории с `PathConfinement`, `InMemoryDomainEventBus`) и тонкий HTTP-адаптер `server.ts`.
- `CalculatorSection.tsx` переведён на доменный сервис `DemandForecastService`, `App.tsx` обёрнут в `ErrorBoundary`.
- Добавлены эндпоинт `GET /api/health`, заголовки безопасности, набор тестов `tests/ddd-domain.test.ts` (`npm test`) и CI-пайплайн `.github/workflows/ci.yml`.
- Создана страница документации [`ddd-and-11-contours.md`](./ddd-and-11-contours.md).

