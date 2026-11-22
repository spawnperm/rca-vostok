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

## [2026-11-22] feature | Глоссарий терминов и раздел «Статус аккредитации центра»
- В `src/data/researchData.ts` добавлены структуры `CENTER_ACCREDITATION_STATUS` (лицензия ДПО ВВГУ по ФЗ № 273-ФЗ, полномочия РЦА/ФСТР по ФЗ № 132-ФЗ, ПП РФ № 1003 и № 1893, матрица соответствия требованиям РФ) и `GLOSSARY_TERMS` (9 терминов: аттестация, инструктор-проводник, категория сложности, Единый федеральный реестр, паспорт маршрута, нелегализованный резерв, двухконтурная модель, Wilderness First Aid, режим ООПТ).
- В `src/components/OverviewSection.tsx` добавлен раздел «Статус аккредитации центра» с переключением 3 правовых контуров и реестром соответствия нормам РФ, а также блок «Глоссарий терминов» с всплывающими определениями при наведении/фокусе как внутри контекстного абзаца, так и в фильтруемом каталоге терминов.
- Обновлены [`entities-and-institutions.md`](./entities-and-institutions.md) и [`dialogue-context.md`](./dialogue-context.md). Зафиксирован коммит `67f8fac`.

## [2026-11-22] feature | Модальное окно куратора и Recharts-график прогноза спроса ДФО до 2030 г.
- В `src/components/OverviewSection.tsx` добавлена кнопка «Связаться с куратором» (в Hero-блоке и карточке архитектуры РЦА) и модальное окно (`role="dialog"`) с формой запроса на консультацию, отправляемой в `POST /api/inquiries`.
- Установлена библиотека `recharts`, добавлен массив `DFO_REGIONAL_DEMAND_FORECAST_2025_2030` в `src/data/researchData.ts` и создан компонент `src/components/DfoDemandForecastChart.tsx` (динамика по Приморскому краю, Камчатке, Хабаровскому краю и другим субъектам ДФО в базовом и консервативном сценариях), встроенный в `src/components/AnalyticsSection.tsx`.

## [2026-11-22] feature | SVG-карта распределения аттестованных проводников по регионам ДФО
- В `src/data/researchData.ts` добавлен набор `DFO_REGIONS_DISTRIBUTION` по 7 субъектам и кластерам ДФО (Приморский край, Камчатский край, Хабаровский край, Сахалинская область, Якутия, Амурская область, Магадан/Чукотка; суммарно `582` в реестре и `4 530` расчётного спроса).
- Создан компонент `src/components/DfoRegionsDistributionMap.tsx` со стилизованной SVG-картой ДФО, переключением режимов (`В реестре`, `Спрос`, `Сессия РЦА окт. 2026` с дугами межрегионального потока во Владивосток) и инспектором выбранного региона. Компонент встроен в `src/components/AnalyticsSection.tsx`.

