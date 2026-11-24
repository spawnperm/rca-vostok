import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Copy,
  Flag,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { CERTIFIED_TOURIST_ROUTES, type CertifiedTouristRoute } from '../../data/researchData';
import type { PreparationContour } from '../../utils/personalRoadmap';
import {
  PREPARATION_PACE_OPTIONS,
  ROUTE_COMPLEXITY_PRESETS,
  ROUTE_DISCIPLINE_OPTIONS,
  buildComplexityPreparationRoadmap,
  formatComplexityRoadmapText,
  inferComplexityFromDifficultyLabel,
  type ComplexityRoadmapStage,
  type PreparationPaceId,
  type RoadmapPhaseTone,
  type RouteComplexityId,
  type RouteDisciplineId,
} from '../../utils/routeComplexityRoadmap';
import {
  buildScheduleSlotCalendarEvent,
  downloadCalendarIcs,
} from '../../utils/attestationCalendar';
import { tracker } from '../../utils/tracker';

interface RoutePreparationRoadmapBuilderProps {
  selectedRouteId?: string | null;
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const TONE_BAR_CLASSES: Record<
  RoadmapPhaseTone,
  { bar: string; selectedRing: string; dot: string }
> = {
  slate: {
    bar: 'bg-slate-700 text-white',
    selectedRing: 'ring-2 ring-slate-900 ring-offset-1',
    dot: 'bg-slate-700',
  },
  teal: {
    bar: 'bg-teal-700 text-white',
    selectedRing: 'ring-2 ring-teal-900 ring-offset-1',
    dot: 'bg-teal-700',
  },
  amber: {
    bar: 'bg-amber-600 text-white',
    selectedRing: 'ring-2 ring-amber-800 ring-offset-1',
    dot: 'bg-amber-600',
  },
  sky: {
    bar: 'bg-sky-700 text-white',
    selectedRing: 'ring-2 ring-sky-900 ring-offset-1',
    dot: 'bg-sky-700',
  },
  emerald: {
    bar: 'bg-emerald-700 text-white',
    selectedRing: 'ring-2 ring-emerald-900 ring-offset-1',
    dot: 'bg-emerald-700',
  },
};

export const RoutePreparationRoadmapBuilder: React.FC<RoutePreparationRoadmapBuilderProps> = ({
  selectedRouteId = null,
}) => {
  const [complexityId, setComplexityId] = useState<RouteComplexityId>('2_ks');
  const [contour, setContour] = useState<PreparationContour>('contour_b');
  const [disciplineId, setDisciplineId] = useState<RouteDisciplineId>('hiking');
  const [paceId, setPaceId] = useState<PreparationPaceId>('standard');
  const [startDateIso, setStartDateIso] = useState<string>(() => getTodayIso());
  const [activeStageId, setActiveStageId] = useState<string>('passport_field');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const selectedMapRoute: CertifiedTouristRoute | undefined = useMemo(
    () =>
      selectedRouteId
        ? CERTIFIED_TOURIST_ROUTES.find((route) => route.id === selectedRouteId)
        : undefined,
    [selectedRouteId]
  );

  const roadmap = useMemo(
    () =>
      buildComplexityPreparationRoadmap({
        complexityId,
        contour,
        disciplineId,
        paceId,
        startDateIso,
      }),
    [complexityId, contour, disciplineId, paceId, startDateIso]
  );

  const activeStageIndex = Math.max(
    0,
    roadmap.stages.findIndex((s) => s.id === activeStageId)
  );
  const activeStage: ComplexityRoadmapStage =
    roadmap.stages[activeStageIndex] ?? roadmap.stages[0];

  const readyDividerPercent = Number(
    ((roadmap.prepDaysBeforeExam / roadmap.totalDurationDays) * 100).toFixed(2)
  );

  const handleSelectComplexity = (nextId: RouteComplexityId) => {
    setComplexityId(nextId);
    setStatusNotice(null);
    tracker.trackCustomInteraction('Конструктор дорожной карты · Сложность', nextId);
  };

  const handleApplySelectedRoute = () => {
    if (!selectedMapRoute) return;
    const inferredComplexity = inferComplexityFromDifficultyLabel(
      selectedMapRoute.difficultyCategory
    );
    setComplexityId(inferredComplexity);
    setDisciplineId(selectedMapRoute.track);
    setStatusNotice(
      `Параметры карты подстроены под маршрут «${selectedMapRoute.shortName}» (${selectedMapRoute.difficultyCategory}).`
    );
    tracker.trackCustomInteraction(
      'Конструктор дорожной карты · Применить маршрут с карты',
      selectedMapRoute.shortName
    );
  };

  const handleExportSessionIcs = () => {
    const rec = roadmap.recommendedSession;
    if (!rec) return;
    const ev = buildScheduleSlotCalendarEvent(
      {
        start: rec.startIso,
        end: rec.endIso,
        category: rec.category,
        disciplines: [roadmap.discipline.shortLabel],
      },
      rec.index
    );
    const fileName = downloadCalendarIcs(ev, 1440);
    setStatusNotice(
      `Файл ${fileName} скачан для сессии ${rec.rangeLabel}. Подача досье в РЦА — до ${rec.dossierDeadlineFormatted}.`
    );
    tracker.trackCustomInteraction(
      'Конструктор дорожной карты · Экспорт .ics',
      rec.startIso
    );
  };

  const handleCopySummary = async () => {
    const text = formatComplexityRoadmapText(roadmap);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setStatusNotice('План подготовки и контрольные даты скопированы в буфер обмена.');
      } else {
        setStatusNotice('Буфер обмена недоступен в текущем браузере.');
      }
    } catch {
      setStatusNotice('Не удалось скопировать план — проверьте разрешения браузера.');
    }
    tracker.trackCustomInteraction(
      'Конструктор дорожной карты · Копировать план',
      roadmap.preset.codeLabel
    );
  };

  const moveStage = (delta: -1 | 1) => {
    const nextIdx = activeStageIndex + delta;
    const next = roadmap.stages[nextIdx];
    if (next) {
      setActiveStageId(next.id);
    }
  };

  return (
    <section
      id="route-roadmap-builder"
      aria-labelledby="route-roadmap-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            Визуальный конструктор маршрутной подготовки
          </p>
          <h3
            id="route-roadmap-heading"
            className="text-lg sm:text-xl font-bold text-slate-900 text-balance"
          >
            Дорожная карта подготовки инструктора по сложности маршрута
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Выберите целевую категорию сложности маршрута, ваш образовательный контур и
            темп обучения — конструктор построит поэтапный календарный график и подберёт
            ближайшую подходящую сессию аттестации РЦА.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopySummary}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span>Копировать план</span>
          </button>
          {roadmap.recommendedSession && (
            <button
              type="button"
              onClick={handleExportSessionIcs}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>В календарь (.ics)</span>
            </button>
          )}
        </div>
      </div>

      {/* Contextual sync banner when user clicked a route on the DFO map above */}
      {selectedMapRoute && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-teal-50/70 border border-teal-200 rounded-lg px-4 py-3">
          <div className="text-xs text-teal-950 space-y-0.5">
            <p className="font-semibold">
              Выбран маршрут на карте: {selectedMapRoute.shortName}
            </p>
            <p className="text-teal-800">
              {selectedMapRoute.regionName} · {selectedMapRoute.difficultyCategory} ·{' '}
              {selectedMapRoute.passportStatus}
            </p>
          </div>
          <button
            type="button"
            onClick={handleApplySelectedRoute}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-teal-300 text-teal-900 hover:bg-teal-100/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Подстроить карту под маршрут
          </button>
        </div>
      )}

      {/* Step 1: Complexity Selector */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700">
            1. Целевая категория сложности маршрута (КС)
          </span>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Влияет на длительность практики ПСР и защиту паспорта № 760
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {ROUTE_COMPLEXITY_PRESETS.map((preset) => {
            const active = preset.id === complexityId;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectComplexity(preset.id)}
                aria-pressed={active}
                className={`text-left rounded-xl border p-3.5 transition-colors cursor-pointer space-y-1.5 ${
                  active
                    ? 'bg-teal-50/70 border-teal-700 ring-1 ring-teal-700/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-sm font-bold font-mono tabular-nums ${
                      active ? 'text-teal-900' : 'text-slate-900'
                    }`}
                  >
                    {preset.codeLabel}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
                    {preset.practiceDrillsCount} ПСР
                  </span>
                </div>
                <p
                  className={`text-xs font-semibold ${
                    active ? 'text-teal-900' : 'text-slate-800'
                  }`}
                >
                  {preset.shortTitle}
                </p>
                <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                  {preset.dfoExamples}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Preparation Configuration Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-4 border-t border-slate-200">
        {/* Contour */}
        <div className="md:col-span-4 space-y-2">
          <span className="block text-xs font-semibold text-slate-700">
            2. Контур допуска (ПП № 1893)
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setContour('contour_b')}
              aria-pressed={contour === 'contour_b'}
              className={`px-3 py-2 text-left rounded-lg border transition-colors cursor-pointer ${
                contour === 'contour_b'
                  ? 'bg-teal-50 border-teal-700 text-teal-900 font-semibold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="block text-xs">Контур Б</span>
              <span className="block text-[11px] text-slate-500 font-normal">
                ДПО ВВГУ 250 ч
              </span>
            </button>
            <button
              type="button"
              onClick={() => setContour('contour_a')}
              aria-pressed={contour === 'contour_a'}
              className={`px-3 py-2 text-left rounded-lg border transition-colors cursor-pointer ${
                contour === 'contour_a'
                  ? 'bg-teal-50 border-teal-700 text-teal-900 font-semibold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="block text-xs">Контур А</span>
              <span className="block text-[11px] text-slate-500 font-normal">
                Подтв. стажа МКК
              </span>
            </button>
          </div>
        </div>

        {/* Discipline */}
        <div className="md:col-span-4 space-y-2">
          <span className="block text-xs font-semibold text-slate-700">
            3. Вид туризма
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ROUTE_DISCIPLINE_OPTIONS.map((opt) => {
              const active = opt.id === disciplineId;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDisciplineId(opt.id)}
                  aria-pressed={active}
                  className={`px-2.5 py-2 text-xs rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-teal-50 border-teal-700 text-teal-900 font-semibold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pace + Start Date */}
        <div className="md:col-span-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="roadmap-start-date"
              className="text-xs font-semibold text-slate-700"
            >
              4. Темп и дата старта
            </label>
            <button
              type="button"
              onClick={() => setStartDateIso(getTodayIso())}
              className="text-[11px] font-medium text-teal-700 hover:text-teal-900 cursor-pointer"
            >
              От сегодня
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {PREPARATION_PACE_OPTIONS.map((p) => {
                const active = p.id === paceId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPaceId(p.id)}
                    aria-pressed={active}
                    title={`${p.label}: ${p.hint}`}
                    className={`px-2.5 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white text-slate-900 font-semibold border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <input
              id="roadmap-start-date"
              type="date"
              value={startDateIso}
              min="2026-01-01"
              max="2028-12-31"
              onChange={(e) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) {
                  setStartDateIso(e.target.value);
                }
              }}
              className="px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-teal-700"
            />
          </div>
        </div>
      </div>

      {/* Calculated Summary + Recommended Official Session */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
        <dl className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-4 items-start">
          <div>
            <dt className="text-[11px] text-slate-500">Длительность подготовки</dt>
            <dd className="text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5">
              ~{roadmap.estimatedWeeks} нед.
            </dd>
            <p className="text-[11px] text-slate-500 tabular-nums">
              {roadmap.prepDaysBeforeExam} дн. до экзамена
            </p>
          </div>
          <div>
            <dt className="text-[11px] text-slate-500">Готовность к сессии</dt>
            <dd className="text-sm sm:text-base font-bold text-teal-800 mt-1">
              {roadmap.estimatedReadyFormatted}
            </dd>
            <p className="text-[11px] text-slate-500">
              Старт {roadmap.startDateFormatted}
            </p>
          </div>
          <div>
            <dt className="text-[11px] text-slate-500">Учебный объём</dt>
            <dd className="text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5">
              {roadmap.studyHoursTotal} ч
            </dd>
            <p className="text-[11px] text-slate-500">{roadmap.pace.hoursPerWeek}</p>
          </div>
          <div>
            <dt className="text-[11px] text-slate-500">Финал с ЕФРТА</dt>
            <dd className="text-sm sm:text-base font-bold text-slate-900 mt-1">
              {roadmap.estimatedCompletionFormatted}
            </dd>
            <p className="text-[11px] text-slate-500">
              Всего {roadmap.totalDurationDays} дн. пути
            </p>
          </div>
        </dl>

        <div className="lg:col-span-5 lg:border-l lg:border-slate-200 lg:pl-5 flex flex-col justify-center space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Flag className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
            <span>Рекомендуемая официальная сессия РЦА</span>
          </div>

          {roadmap.recommendedSession ? (
            <>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-base font-bold text-slate-900">
                  {roadmap.recommendedSession.rangeLabel}
                </span>
                <span className="text-xs font-medium text-teal-800">
                  {roadmap.recommendedSession.category} · запас{' '}
                  {roadmap.recommendedSession.bufferDaysAfterPrep} дн.
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-snug">
                Подача полного досье в комиссию до{' '}
                <span className="font-semibold text-slate-800">
                  {roadmap.recommendedSession.dossierDeadlineFormatted}
                </span>
                {roadmap.alternativeSession
                  ? ` · резервный поток: ${roadmap.alternativeSession.rangeLabel}`
                  : ''}
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-600 leading-snug">
              Расчётная готовность ({roadmap.estimatedReadyFormatted}) выходит за рамки
              опубликованного календаря 2027 г. — комиссия назначит поток на 2028 год.
            </p>
          )}
        </div>
      </div>

      {statusNotice && (
        <p
          role="status"
          className="text-xs font-medium text-teal-900 bg-teal-50 border border-teal-200 rounded-lg px-3.5 py-2"
        >
          {statusNotice}
        </p>
      )}

      {/* Visual Gantt / Timeline Representation */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
            <Layers className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
            <span>
              Визуальная шкала этапов (День 1 — День {roadmap.totalDurationDays})
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-teal-700 inline-block" aria-hidden="true" />
              Подготовка
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-600 inline-block" aria-hidden="true" />
              WFA и ПСР
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-700 inline-block" aria-hidden="true" />
              Экзамен и ЕФРТА
            </span>
            <span>Нажмите на любой этап для деталей</span>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          {/* Timeline Ruler Header */}
          <div className="hidden md:flex items-center bg-slate-50 border-b border-slate-200 px-4 py-2 text-[11px] font-mono text-slate-500">
            <div className="w-64 shrink-0 font-sans font-semibold text-slate-600">
              Этап подготовки
            </div>
            <div className="flex-1 relative h-4 flex items-center justify-between">
              <span>Старт ({roadmap.startDateFormatted})</span>
              <span>Середина пути</span>
              <span>Готовность · {roadmap.estimatedReadyFormatted}</span>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {roadmap.stages.map((stage) => {
              const isSelected = stage.id === activeStage.id;
              const toneStyle = TONE_BAR_CLASSES[stage.tone];
              const barWidth = Math.max(stage.widthPercent, 4.5);

              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setActiveStageId(stage.id)}
                  aria-pressed={isSelected}
                  className={`w-full text-left px-4 py-3 flex flex-col md:flex-row md:items-center gap-2.5 md:gap-4 transition-colors cursor-pointer ${
                    isSelected ? 'bg-teal-50/40' : 'hover:bg-slate-50/80'
                  }`}
                >
                  {/* Stage Title Column */}
                  <div className="md:w-64 shrink-0 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-slate-400 tabular-nums">
                          0{stage.order}
                        </span>
                        <span
                          className={`text-xs font-semibold truncate ${
                            isSelected ? 'text-teal-900' : 'text-slate-900'
                          }`}
                        >
                          {stage.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums pl-6">
                        {stage.startDateFormatted} — {stage.endDateFormatted}
                      </p>
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-700 tabular-nums shrink-0 md:hidden">
                      {stage.durationDays} дн.
                    </span>
                  </div>

                  {/* Proportional Gantt Bar Column */}
                  <div className="flex-1 flex items-center gap-3">
                    <div className="relative flex-1 h-8 bg-slate-100/90 rounded-lg border border-slate-200/80 overflow-hidden">
                      {/* Quarter guide lines */}
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-1/4 border-l border-slate-200/70"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-1/2 border-l border-slate-200/70"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-3/4 border-l border-slate-200/70"
                      />

                      {/* Exam Readiness Threshold Line */}
                      <span
                        aria-hidden="true"
                        style={{ left: `${readyDividerPercent}%` }}
                        className="absolute inset-y-0 border-l-2 border-dashed border-emerald-600/60 z-10"
                      />

                      {/* Stage Proportional Bar */}
                      <div
                        style={{
                          left: `${stage.leftPercent}%`,
                          width: `${barWidth}%`,
                        }}
                        className={`absolute top-1 bottom-1 rounded-md flex items-center justify-center px-1.5 text-[11px] font-mono font-semibold tabular-nums transition-all ${
                          toneStyle.bar
                        } ${isSelected ? toneStyle.selectedRing : ''}`}
                      >
                        {stage.widthPercent >= 9 ? `${stage.durationDays} дн.` : ''}
                      </div>
                    </div>

                    <span className="hidden md:inline-block w-14 text-right text-xs font-mono font-semibold text-slate-700 tabular-nums shrink-0">
                      {stage.durationDays} дн.
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Stage Inspector Card */}
      <article
        aria-live="polite"
        className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-teal-800">{activeStage.phaseTag}</span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="inline-flex items-center gap-1 text-slate-600 font-mono tabular-nums">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                {activeStage.startDateFormatted} — {activeStage.endDateFormatted}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="inline-flex items-center gap-1 text-slate-600 font-mono tabular-nums">
                <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                {activeStage.durationDays} дн. (день {activeStage.offsetStartDay + 1}–
                {activeStage.offsetEndDay})
              </span>
            </div>
            <h4 className="text-base font-bold text-slate-900">{activeStage.title}</h4>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={activeStageIndex === 0}
              onClick={() => moveStage(-1)}
              aria-label="Предыдущий этап"
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <span className="text-xs font-mono text-slate-500 tabular-nums px-1.5">
              {activeStage.order} / {roadmap.stages.length}
            </span>
            <button
              type="button"
              disabled={activeStageIndex === roadmap.stages.length - 1}
              onClick={() => moveStage(1)}
              aria-label="Следующий этап"
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 space-y-3">
            <p className="text-sm text-slate-700 leading-relaxed">{activeStage.summary}</p>
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Compass className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                <span>Контрольный результат этапа</span>
              </div>
              <p className="text-xs text-slate-800 leading-relaxed font-medium">
                {activeStage.deliverable}
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
              <span>Ключевые задачи и нормативы этапа ({roadmap.preset.codeLabel})</span>
            </div>
            <ul className="space-y-2">
              {activeStage.checklistPoints.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-2.5 bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs text-slate-700 leading-relaxed"
                >
                  <CheckCircle2
                    className="w-4 h-4 text-teal-700 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </article>
    </section>
  );
};
