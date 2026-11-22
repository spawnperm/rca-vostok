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

### Shared Kernel (`src/domain/shared/`)
- [`DomainError.ts`](../src/domain/shared/DomainError.ts): иерархия `ValidationError`, `InvariantViolationError`, `NotFoundError`, а также контракты `DomainEvent` и `DomainEventBus`.
- [`ValueObjects.ts`](../src/domain/shared/ValueObjects.ts): `EmailAddress`, `SanitizedText`, `BoundedNumber`.

## 2. Матрица 11 контуров профессиональной разработки

| № | Контур | Реализация в репозитории |
|---|---|---|
| 1 | **Предметное моделирование (DDD)** | Value Objects, Aggregate Root `CertificationInquiry`, Domain Services `DemandForecastService` и `AnalyticsAggregationService`, шина событий `DomainEventBus` |
| 2 | **Слоистая / гексагональная архитектура** | Чёткое разделение `src/domain/` → `src/application/` → `src/infrastructure/` → HTTP-адаптер `server.ts` и React UI `src/components/` |
| 3 | **Безопасность и валидация границ** | Строгая валидация DTO через Value Objects, изоляция путей [`PathConfinement.ts`](../src/infrastructure/persistence/PathConfinement.ts), заголовки `nosniff`/`Referrer-Policy`, отключение `X-Powered-By`, отсутствие ПДн в публичной статистике |
| 4 | **Качество кода и статический анализ** | Строгая типизация TypeScript, `pnpm run lint` (`tsc --noEmit`), совместимость со strip-types Node 22 |
| 5 | **Автоматизированное тестирование** | Нативный набор тестов `pnpm test` ([`tests/ddd-domain.test.ts`](../tests/ddd-domain.test.ts)) для инвариантов DDD, формулы потребности и Use Cases |
| 6 | **Производительность и оптимизация** | Лимитирование буфера телеметрии (`500` сессий / `5000` событий), кэширование в `JsonFileAnalyticsRepository`, `useMemo` в UI, GPU-анимация (`transform: scaleX`) |
| 7 | **Наблюдаемость и телеметрия** | Структурированное JSON-логирование доменных событий (без ПДн) через `InMemoryDomainEventBus` и health-check эндпоинт `GET /api/health` (`GetSystemHealthUseCase`) |
| 8 | **Надёжность и отказоустойчивость** | React [`ErrorBoundary.tsx`](../src/components/ErrorBoundary.tsx), атомарная запись файлов через `.tmp` + `fs.renameSync`, устойчивый парсинг JSON с fallback |
| 9 | **Доступность и UX-стандарты** | Единая дизайн-конституция, `tabular-nums`, `focus-visible`, `role="alert"`, WCAG AA контраст |
| 10 | **Документация и управление знаниями** | Поддерживаемая [`LLM Wiki`](./index.md) с фиксацией схемы, контекста и архитектурных решений |
| 11 | **CI/CD и инженерные гейты качества** | Скрипт `pnpm run verify` и workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) для автоматической проверки при пуше в `main` |
