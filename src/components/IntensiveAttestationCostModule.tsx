import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CalendarClock,
  CheckCircle2,
  Compass,
  RotateCcw,
} from 'lucide-react';
import {
  COMPLEXITY_TARIFFS,
  INTENSIVE_MAX_DAYS,
  INTENSIVE_MIN_DAYS,
  calculateIntensiveCost,
  type IntensiveComplexityId,
} from '../utils/intensiveCostCalculator';
import { formatRub } from '../utils/format';
import { tracker } from '../utils/tracker';

const QUICK_DAYS_PRESETS = [2, 4, 6, 8, 10] as const;

export const IntensiveAttestationCostModule: React.FC = () => {
  const [complexityId, setComplexityId] = useState<IntensiveComplexityId>('ks2');
  const [intensiveDays, setIntensiveDays] = useState<number>(4);
  const [includeFieldGear, setIncludeFieldGear] = useState<boolean>(false);
  const [applyTrainingSubsidy, setApplyTrainingSubsidy] = useState<boolean>(false);

  const result = useMemo(
    () =>
      calculateIntensiveCost({
        complexityId,
        intensiveDays,
        includeFieldGear,
        applyTrainingSubsidy,
      }),
    [complexityId, intensiveDays, includeFieldGear, applyTrainingSubsidy]
  );

  const handleSelectComplexity = (nextId: IntensiveComplexityId) => {
    setComplexityId(nextId);
    const matched = COMPLEXITY_TARIFFS.find((t) => t.id === nextId);
    if (matched) {
      setIntensiveDays(matched.recommendedDays);
      tracker.trackCustomInteraction(`Калькулятор интенсива: ${matched.shortLabel}`, 'calculator');
    }
  };

  const handleReset = () => {
    setComplexityId('ks2');
    setIntensiveDays(4);
    setIncludeFieldGear(false);
    setApplyTrainingSubsidy(false);
    tracker.trackCustomInteraction('Калькулятор интенсива: сброс', 'calculator');
  };

  return (
    <section
      id="intensive-cost-calculator"
      aria-labelledby="intensive-cost-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-teal-700">
            <Calculator className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Вспомогательный расчёт сметы соискателя</span>
            <span aria-hidden="true">·</span>
            <span>Категория сложности и длительность интенсива</span>
          </div>
          <h2 id="intensive-cost-heading" className="text-xl font-bold text-slate-900">
            Расчёт примерной стоимости аттестации и интенсива по категории сложности
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Экспресс-оценка бюджета для планирования поездки на экзаменационную сессию РЦА «Русский
            Восток»: выберите категорию сложности маршрутов и длительность очно-полевого интенсива
            подготовки.
          </p>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Сбросить параметры</span>
        </button>
      </div>

      {/* Main 2-column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Controls (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Complexity selector */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
              <span>1. Категория сложности заявляемых маршрутов</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {COMPLEXITY_TARIFFS.map((tariff) => {
                const active = tariff.id === complexityId;
                return (
                  <button
                    key={tariff.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleSelectComplexity(tariff.id)}
                    className={`text-left p-3.5 rounded-lg border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                      active
                        ? 'bg-teal-50/80 border-teal-700 text-slate-900 ring-1 ring-teal-700'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">{tariff.shortLabel}</span>
                      <span className="text-xs font-mono font-semibold text-teal-700 tabular-nums">
                        {formatRub(tariff.dailyIntensiveRate)}/дн.
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 leading-snug">
                      {tariff.scopeDescription}
                    </p>
                    <p className="mt-1.5 text-[11px] font-mono text-slate-500 tabular-nums">
                      Сбор: {formatRub(tariff.baseAttestationFee)} · Рек.: {tariff.recommendedDays} дн.
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Intensive days slider & quick chips */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label
                htmlFor="intensive-days-slider"
                className="text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5"
              >
                <CalendarClock className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                <span>2. Количество дней очно-полевого интенсива</span>
              </label>
              <span className="font-mono text-sm font-bold text-teal-800 tabular-nums">
                {result.intensiveDays} дн.
              </span>
            </div>

            <input
              id="intensive-days-slider"
              type="range"
              min={INTENSIVE_MIN_DAYS}
              max={INTENSIVE_MAX_DAYS}
              step={1}
              value={intensiveDays}
              onChange={(e) => setIntensiveDays(Number(e.target.value))}
              className="w-full accent-teal-700 cursor-pointer"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {QUICK_DAYS_PRESETS.map((daysVal) => {
                  const active = intensiveDays === daysVal;
                  return (
                    <button
                      key={daysVal}
                      type="button"
                      onClick={() => setIntensiveDays(daysVal)}
                      className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {daysVal} дн.
                    </button>
                  );
                })}
              </div>

              {intensiveDays !== result.tariff.recommendedDays && (
                <button
                  type="button"
                  onClick={() => setIntensiveDays(result.tariff.recommendedDays)}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-900 underline underline-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Рекомендовано для {result.tariff.shortLabel}: {result.tariff.recommendedDays} дн.
                </button>
              )}
            </div>

            {result.intensiveDays >= 7 && (
              <p className="text-xs text-emerald-800 font-medium inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  При длительности от 7 дней учтена пакетная скидка 10% на учебный интенсив.
                </span>
              </p>
            )}
          </div>

          {/* Optional modifiers */}
          <div className="space-y-2.5 pt-2 border-t border-slate-200">
            <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeFieldGear}
                onChange={(e) => setIncludeFieldGear(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              <span>
                <span className="font-semibold text-slate-900">
                  Включить аренду полигонного снаряжения (+{formatRub(result.tariff.fieldGearCost)})
                </span>
                <span className="block text-slate-500 mt-0.5">
                  Верёвки, страховочные системы, аптечка WFA и спутниковый трекер на время сборов.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={applyTrainingSubsidy}
                onChange={(e) => setApplyTrainingSubsidy(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              <span>
                <span className="font-semibold text-slate-900">
                  Учитывать региональную субсидию на обучение (−50% от курса)
                </span>
                <span className="block text-slate-500 mt-0.5">
                  Для сотрудников туроператоров и субъектов МСП Приморья по программам компенсации ДПО.
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* Right Result Card (6 cols) */}
        <div className="lg:col-span-6 bg-slate-50 border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
          {/* Primary Figure */}
          <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <p className="text-xs font-medium text-slate-600">
                Примерная стоимость подготовки и аттестации
              </p>
              <p className="mt-1 text-3xl font-bold text-slate-900 font-mono tabular-nums">
                {formatRub(result.totalCost)}
              </p>
              <p className="mt-1 text-xs text-slate-600 font-mono tabular-nums">
                {result.tariff.title} · {result.intensiveDays} дн. интенсива · в пересчёте{' '}
                {formatRub(result.costPerDayEquivalent)}/день
              </p>
            </div>

            <div className="text-right text-xs text-slate-600">
              <p>Налоговая пошлина НК РФ</p>
              <p className="font-mono font-bold text-slate-900 tabular-nums">
                {formatRub(result.nkTaxDuty)}
              </p>
            </div>
          </div>

          {/* Stacked Proportion Bar */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>Структура сметы</span>
              <span className="font-mono tabular-nums">
                Аттестация {result.attestationSharePct}% · Интенсив {result.trainingSharePct}%
                {result.gearSharePct > 0 ? ` · Снаряжение ${result.gearSharePct}%` : ''}
              </span>
            </div>
            <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-slate-900 transition-all duration-200"
                style={{ width: `${result.attestationSharePct}%` }}
                title={`Аттестация: ${result.attestationSharePct}%`}
              />
              <div
                className="h-full bg-teal-600 transition-all duration-200"
                style={{ width: `${result.trainingSharePct}%` }}
                title={`Интенсив обучения: ${result.trainingSharePct}%`}
              />
              {result.gearSharePct > 0 && (
                <div
                  className="h-full bg-amber-500 transition-all duration-200"
                  style={{ width: `${result.gearSharePct}%` }}
                  title={`Снаряжение: ${result.gearSharePct}%`}
                />
              )}
            </div>
          </div>

          {/* Detailed Breakdown Rows */}
          <div className="divide-y divide-slate-200 bg-white border border-slate-200 rounded-lg px-4">
            {result.breakdown.map((row) => (
              <div key={row.id} className="py-3 flex items-start justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs font-semibold text-slate-900">{row.label}</p>
                  <p className="text-[11px] text-slate-500 leading-snug">{row.detail}</p>
                </div>
                <span
                  className={`text-xs font-mono font-bold tabular-nums shrink-0 ${
                    row.amount < 0 ? 'text-emerald-700' : 'text-slate-900'
                  }`}
                >
                  {row.amount < 0
                    ? `−${formatRub(Math.abs(row.amount))}`
                    : formatRub(row.amount)}
                </span>
              </div>
            ))}
          </div>

          {/* Recommended duration notice */}
          {result.isBelowRecommendedDays && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-semibold">
                  Выбрано меньше рекомендованного срока для {result.tariff.shortLabel}
                </p>
                <p className="text-amber-900 leading-snug">
                  Для уверенной сдачи полевого этапа по {result.tariff.shortLabel} обычно закладывают
                  от {result.tariff.recommendedDays} дн. интенсива (при отсутствии полного стажа).
                </p>
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Расчёт носит ориентировочный характер для планирования бюджета кандидата (с опорой на
            методику ПП РФ № 891 и тарифную сетку ДПО ВВГУ); точная стоимость фиксируется в договоре
            потока.
          </p>
        </div>
      </div>
    </section>
  );
};
