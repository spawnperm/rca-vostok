# LLM Wiki — База знаний проекта РЦА «Русский Восток»

Единый индекс контекста диалога, исследовательской базы, архитектуры приложения и истории коммитов репозитория [`spawnperm/rca-vostok`](https://github.com/spawnperm/rca-vostok).

## Навигация и регламент

- [**SCHEMA.md**](./SCHEMA.md) — Конституция и правила ведения LLM Wiki (уровни источников, протоколы ingest/query/lint, запрет на хранение секретов).
- [**log.md**](./log.md) — Хронологический журнал всех этапов диалога, изменений кода и коммитов в GitHub (формат append-only).

## Контекст диалога и первоисточники

- [**dialogue-context.md**](./dialogue-context.md) — Полная хронология пользовательских запросов (от изучения `rca-vostok.ru` и 6 исходных документов до вики-архивации), принятые инженерные и дизайн-решения, статусы проверок и Git-коммитов.
- [**sources-synthesis.md**](./sources-synthesis.md) — Структурированный синтез материалов сайта `https://rca-vostok.ru/` и шести исходных аналитических файлов (`00_c77f6a30.txt` – `05_76353747.txt`).

## Предметная область и исследование

- [**entities-and-institutions.md**](./entities-and-institutions.md) — Институциональные субъекты (РЦА «Русский Восток», ВВГУ, ФСТР, Минтуризма ПК, Минэкономразвития РФ, ООПТ), руководство, программы ДПО, экспертные отзывы и хроника индустрии 2025–2026 гг.
- [**economic-model-and-market.md**](./economic-model-and-market.md) — Экономико-математическая модель кадрового дефицита, эмпирическая таблица, межрегиональные срезы ДФО (Приморье, Камчатка, Хабаровский край), 8 округов Приморского края на карте активности и дорожная карта 2025–2030.
- [**dissertation-and-presentations.md**](./dissertation-and-presentations.md) — Каркас диссертации ВАК 5.2.3 (область 4.15), научная новизна, положения на защиту, сравнение с IFMGA и спецификация двух презентационных колод (18 и 10 слайдов).
- [**digital-ecosystem-and-ux-seo.md**](./digital-ecosystem-and-ux-seo.md) — Аудит цифровой экосистемы аттестации Приморья (`visit-primorye.ru`, `attestation.tssr.ru/primorie`, `vvsu.ru`, `vk.com/rcaprm`, `@tourprimorsky`, `tour.primorsky.ru`), разрывы пути пользователя, UI/UX-слабости, SEO-каннибализация и рекомендации для «единого окна».

## Техническая реализация

- [**ddd-and-11-contours.md**](./ddd-and-11-contours.md) — Архитектура Domain-Driven Design (Bounded Contexts `certification`, `analytics`, Shared Kernel, Use Cases, Repositories, Domain Events) и матрица 11 контуров профессиональной разработки.
- [**system-architecture.md**](./system-architecture.md) — Стек React 19 + Vite + Express (`server.ts`), компоненты интерфейса, SEO-инфраструктура (`/robots.txt`, `/sitemap.xml`, JSON-LD), трекинг поведения и карта кликов, форма заявок `/api/inquiries`, хранение данных в `/data/` и правила дизайн-системы.
