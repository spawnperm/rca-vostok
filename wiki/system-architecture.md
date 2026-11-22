# Техническая архитектура, SEO, аналитика и API

Платформа построена как full-stack приложение на базе **React 19 + TypeScript + Vite 8 + Tailwind CSS v4** и сервера **Express (`server.ts`)** на порту `3000`.

## 1. Структура модулей проекта

- `server.ts` — Единая точка входа Node.js (`tsx server.ts` в dev, `node server.ts` в prod). Подключает Vite middleware в dev или раздаёт `dist/` в production, обслуживает SEO-файлы и REST API.
- `index.html` & `src/utils/seo.ts` — Управление `<title>`, `<meta name="description">`, OpenGraph, Twitter Cards, canonical URL и динамическим внедрением структурированных данных **Schema.org JSON-LD** (`EducationalOrganization`, `FAQPage`, `WebApplication`) под активную вкладку.
- `src/utils/tracker.ts` — Клиентский трекер поведения: фиксирует `session_start`, `pageview`, `click` (включая точные координаты `xPct`/`yPct` для тепловой карты), максимальную глубину скролла (`scroll`), кастомные взаимодействия (`interaction`) и исходящие переходы (`outbound`). Отправка батчами с поддержкой `navigator.sendBeacon`.
- `src/App.tsx` — Корневой каркас с 3-зонным верхним баром (`РЦА «Русский Восток»` | 5 разделов навигации | кнопка `Режим защиты` с модальным/полноэкранным режимом презентации) и синхронизацией URL-параметров (`?tab=...`).
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

## 3. Визуальные ассеты и правила игнорирования

- Сгенерированные изображения в `/src/assets/images/`:
  - `primorye_ridge_expedition_1795333557369.jpg`
  - `river_rafting_taiga_1795333557039.jpg`
  - `trail_safety_assessment_1795333557526.jpg`
- Правило `.gitignore` настроено как `/data/` (с ведущим слэшем), чтобы runtime-файлы (`/data/analytics-store.json`, `/data/inquiries.json`) не попадали в Git, а модуль данных [`src/data/researchData.ts`](../src/data/researchData.ts) отслеживался в репозитории.

## 4. Команды сборки и проверки

- Разработка: `npm run dev` (`tsx server.ts`)
- Проверка типов: `npm run lint` (`tsc --noEmit`)
- Продакшен-сборка и запуск: `npm run build` (`vite build`) → `npm run start` (`node server.ts`)
