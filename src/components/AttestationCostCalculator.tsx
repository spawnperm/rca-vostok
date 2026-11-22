import React, { useMemo, useState } from 'react';
import { Calculator, MessageSquare, RotateCcw } from 'lucide-react';
import { tracker } from '../utils/tracker';
import { formatRub } from '../utils/format.ts';

interface AttestationCostCalculatorProps {
  onContactCurator: (sourceLabel: string) => void;
}

type TrackKey = 'contour_a' | 'water_dpo' | 'hiking_dpo' | 'auto_dpo';

interface TrackPreset {
  id: TrackKey;
  label: string;
  shortLabel: string;
  defaultDpoFee: number;
  hoursLabel: string;
  basisNote: string;
}

const TRACK_PRESETS: TrackPreset[] = [
  {
    id: 'contour_a',
    label: 'Контур А · Без полного ДПО (для опытных гидов)',
    shortLabel: 'Контур А (зачёт опыта)',
    defaultDpoFee: 0,
    hoursLabel: 'Верификация стажа + защита паспорта',
    basisNote: 'Оплачивается только процедура аттестации и выбранные модули подготовки.',
  },
  {
    id: 'water_dpo',
    label: 'Водный туризм и сплавы · ДПО ВВГУ (27 200 ₽)',
    shortLabel: 'Водный туризм (ВВГУ)',
    defaultDpoFee: 27200,
    hoursLabel: 'Модульный поток · 10 договорных мест',
    basisNote: 'Подтверждённая стоимость договорного места ВВГУ: 27 200 ₽/год.',
  },
  {
    id: 'hiking_dpo',
    label: 'Пешеходный туризм · Переподготовка ВВГУ (≈ 250 ч)',
    shortLabel: 'Пешеходный туризм (250 ч)',
    defaultDpoFee: 27200,
    hoursLabel: 'Около 250 академических часов',
    basisNote: 'Ориентир по тарифной сетке ДПО ВВГУ; точная цена фиксируется договором.',
  },
  {
    id: 'auto_dpo',
    label: 'Автомобильный туризм · Проектируемый поток ВВГУ',
    shortLabel: 'Автотуризм (проект)',
    defaultDpoFee: 29500,
    hoursLabel: 'Плановый специализированный поток',
    basisNote: 'Предварительный ориентир до утверждения сметы запуска в 2027 г.',
  },
];

interface AddonModule {
  id: string;
  label: string;
  detail: string;
  defaultCost: number;
}

const ADDON_MODULES: AddonModule[] = [
  {
    id: 'wfa',
    label: 'Практикум Wilderness First Aid (автономная первая помощь)',
    detail: 'Отработка нормативов ДФО перед полевым экзаменом',
    defaultCost: 6500,
  },
  {
    id: 'passport',
    label: 'Методическая экспертиза и оформление паспорта маршрута',
    detail: 'Проверка контрольных сроков, связи и схемы эвакуации до защиты',
    defaultCost: 4000,
  },
  {
    id: 'polygon',
    label: 'Полевые сборы и полигонное снаряжение (Шкотовский район)',
    detail: 'Организационный взнос за выездной день и страховку на полигоне',
    defaultCost: 5500,
  },
  {
    id: 'medical',
    label: 'Медицинский осмотр и справка-допуск соискателя',
    detail: 'Обязательный документ для допуска к полевым испытаниям',
    defaultCost: 2800,
  },
];

const STATE_FEE_PRESETS = [
  {
    id: 'nk_zero',
    label: '0 ₽ · Только налоговая госпошлина НК РФ',
    amount: 0,
    note: 'Ст. 333.33 НК РФ не устанавливает отдельную налоговую пошлину за бейдж.',
  },
  {
    id: 'pprf_base',
    label: '15 000 ₽ · Аттестационный сбор (базовая категория)',
    amount: 15000,
    note: 'Регламентированная плата РЦА/ФСТР за приём экзаменов по методике ПП РФ № 891.',
  },
  {
    id: 'pprf_ext',
    label: '25 000 ₽ · Повышенная сложность / выездной этап',
    amount: 25000,
    note: 'Ориентир по ПП РФ № 891 при выездной комиссии и сложных маршрутах ДФО.',
  },
];

export const AttestationCostCalculator: React.FC<AttestationCostCalculatorProps> = ({
  onContactCurator,
}) => {
  const [selectedTrack, setSelectedTrack] = useState<TrackKey>('water_dpo');
  const [stateDutyOrExamFee, setStateDutyOrExamFee] = useState<number>(15000);
  const [customDpoFee, setCustomDpoFee] = useState<number>(27200);
  const [selectedAddons, setSelectedAddons] = useState<string[]>(['wfa', 'polygon']);
  const [candidatesCount, setCandidatesCount] = useState<number>(1);
  const [applyPrimoryeSubsidy, setApplyPrimoryeSubsidy] = useState<boolean>(false);

  const activeTrackPreset =
    TRACK_PRESETS.find((t) => t.id === selectedTrack) ?? TRACK_PRESETS[0];

  const handleTrackChange = (trackId: TrackKey) => {
    setSelectedTrack(trackId);
    const preset = TRACK_PRESETS.find((t) => t.id === trackId);
    if (preset) {
      setCustomDpoFee(preset.defaultDpoFee);
      tracker.trackCustomInteraction(`Калькулятор сметы: ${preset.shortLabel}`);
    }
  };

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleReset = () => {
    setSelectedTrack('water_dpo');
    setStateDutyOrExamFee(15000);
    setCustomDpoFee(27200);
    setSelectedAddons(['wfa', 'polygon']);
    setCandidatesCount(1);
    setApplyPrimoryeSubsidy(false);
    tracker.trackCustomInteraction('Калькулятор сметы: сброс');
  };

  const estimate = useMemo(() => {
    const safeCandidates = Math.max(1, Math.min(30, candidatesCount));
    const perPersonDuty = Math.max(0, stateDutyOrExamFee);
    const perPersonDpo = Math.max(0, customDpoFee);
    const addonsList = ADDON_MODULES.filter((a) => selectedAddons.includes(a.id));
    const perPersonAddons = addonsList.reduce((acc, item) => acc + item.defaultCost, 0);

    const totalDuty = perPersonDuty * safeCandidates;
    const totalDpo = perPersonDpo * safeCandidates;
    const totalAddons = perPersonAddons * safeCandidates;
    const grossTotal = totalDuty + totalDpo + totalAddons;

    // Regional Primorye business subsidy compensates up to 70% of DPO training costs
    const subsidyAmount =
      applyPrimoryeSubsidy && totalDpo > 0 ? Math.round(totalDpo * 0.7) : 0;
    const netTotal = Math.max(0, grossTotal - subsidyAmount);
    const netPerCandidate = Math.round(netTotal / safeCandidates);

    const shareDenominator = Math.max(grossTotal, 1);
    const dutySharePct = Math.round((totalDuty / shareDenominator) * 100);
    const dpoSharePct = Math.round((totalDpo / shareDenominator) * 100);
    const addonsSharePct = Math.max(0, 100 - dutySharePct - dpoSharePct);

    return {
      safeCandidates,
      perPersonDuty,
      perPersonDpo,
      perPersonAddons,
      addonsList,
      totalDuty,
      totalDpo,
      totalAddons,
      grossTotal,
      subsidyAmount,
      netTotal,
      netPerCandidate,
      dutySharePct,
      dpoSharePct,
      addonsSharePct,
    };
  }, [
    candidatesCount,
    stateDutyOrExamFee,
    customDpoFee,
    selectedAddons,
    applyPrimoryeSubsidy,
  ]);

  return (
    <section
      aria-labelledby="cost-calculator-heading"
      className="bg-white border border-slate-200 rounded-xl p-8 space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <p className="text-xs font-medium text-teal-700">
            Финансовое планирование кандидата и туроператора
          </p>
          <h2
            id="cost-calculator-heading"
            className="text-xl font-bold text-slate-900 text-balance"
          >
            Калькулятор стоимости аттестации
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Предварительная смета затрат с учётом государственной пошлины / аттестационного сбора
            (ПП РФ № 891 и ст. 333.33 НК РФ), программ ДПО на базе ВВГУ, дополнительных сборов за
            подготовку и региональной компенсации для бизнеса Приморского края до 70%.
          </p>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Сбросить смету</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2 border-t border-slate-200">
        {/* Left Controls Panel */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. State Duty / Attestation Fee */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="calc-state-fee"
                className="text-xs font-semibold text-slate-900"
              >
                01. Государственная пошлина и обязательный аттестационный сбор (на 1 чел.)
              </label>
              <span className="text-xs font-mono font-semibold text-teal-800 tabular-nums">
                {formatRub(stateDutyOrExamFee)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {STATE_FEE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setStateDutyOrExamFee(preset.amount)}
                  className={`px-3 py-2 text-left rounded-lg border text-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                    stateDutyOrExamFee === preset.amount
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="block font-mono font-semibold tabular-nums">
                    {formatRub(preset.amount)}
                  </span>
                  <span
                    className={`block text-[11px] mt-0.5 leading-snug ${
                      stateDutyOrExamFee === preset.amount ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {preset.id === 'nk_zero'
                      ? 'Налоговая пошлина НК РФ'
                      : preset.id === 'pprf_base'
                      ? 'Сбор РЦА/ФСТР (базовый)'
                      : 'Выездной / сложный этап'}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                id="calc-state-fee"
                type="number"
                min={0}
                max={150000}
                step={500}
                value={stateDutyOrExamFee}
                onChange={(e) =>
                  setStateDutyOrExamFee(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-full sm:w-44 px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Правовая справка: ст. 333.33 НК РФ не вводит налоговую пошлину (0 ₽), однако
                проведение экзамена уполномоченным центром оплачивается по методике ПП РФ № 891.
              </p>
            </div>
          </div>

          {/* 2. DPO Training Track */}
          <div className="pt-5 border-t border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="calc-dpo-track"
                className="text-xs font-semibold text-slate-900"
              >
                02. Программа обучения и переподготовки ДПО ВВГУ (на 1 чел.)
              </label>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {activeTrackPreset.hoursLabel}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TRACK_PRESETS.map((track) => {
                const isSelected = selectedTrack === track.id;
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => handleTrackChange(track.id)}
                    className={`p-3 text-left rounded-lg border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                      isSelected
                        ? 'bg-teal-50/60 border-teal-700 text-slate-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">{track.shortLabel}</span>
                      <span className="text-xs font-mono font-semibold text-teal-800 tabular-nums shrink-0">
                        {formatRub(track.defaultDpoFee)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                      {track.basisNote}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <label
                htmlFor="calc-dpo-custom"
                className="text-xs text-slate-600 shrink-0"
              >
                Стоимость обучения по договору ВВГУ (₽):
              </label>
              <input
                id="calc-dpo-custom"
                type="number"
                min={0}
                max={200000}
                step={200}
                value={customDpoFee}
                onChange={(e) =>
                  setCustomDpoFee(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-36 px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
              />
            </div>
          </div>

          {/* 3. Additional Preparation & Field Modules */}
          <div className="pt-5 border-t border-slate-200 space-y-3">
            <p className="text-xs font-semibold text-slate-900">
              03. Дополнительные сборы за подготовку и допуск (на 1 чел.)
            </p>
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
              {ADDON_MODULES.map((addon) => {
                const checked = selectedAddons.includes(addon.id);
                return (
                  <label
                    key={addon.id}
                    className="flex items-start justify-between gap-4 p-3.5 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <span className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAddon(addon.id)}
                        className="mt-0.5 w-4 h-4 accent-teal-700 rounded cursor-pointer shrink-0"
                      />
                      <span className="space-y-0.5">
                        <span className="block text-xs font-semibold text-slate-900">
                          {addon.label}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          {addon.detail}
                        </span>
                      </span>
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-800 tabular-nums shrink-0">
                      + {formatRub(addon.defaultCost)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 4. Group Count & Primorye Subsidy */}
          <div className="pt-5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div className="space-y-1.5">
              <label
                htmlFor="calc-candidates-count"
                className="block text-xs font-semibold text-slate-900"
              >
                Количество направляемых гидов
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="calc-candidates-count"
                  type="range"
                  min={1}
                  max={15}
                  value={candidatesCount}
                  onChange={(e) => setCandidatesCount(Number(e.target.value))}
                  className="flex-1 accent-teal-700 cursor-pointer"
                />
                <span className="w-16 text-right text-sm font-mono font-semibold text-slate-900 tabular-nums">
                  {estimate.safeCandidates} чел.
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                1 чел. — самозанятый / физлицо; от 2 чел. — команда туроператора
              </p>
            </div>

            <label className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={applyPrimoryeSubsidy}
                onChange={(e) => setApplyPrimoryeSubsidy(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-teal-700 rounded cursor-pointer shrink-0"
              />
              <span className="space-y-1">
                <span className="block text-xs font-semibold text-slate-900">
                  Субсидия Приморского края (−70% ДПО)
                </span>
                <span className="block text-[11px] text-slate-600 leading-snug">
                  Компенсация затрат на обучение в ВВГУ для юрлиц и ИП региона (не
                  распространяется на экзаменационный сбор).
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* Right Side: Itemized Estimate Ledger */}
        <aside className="lg:col-span-5 bg-slate-900 text-white rounded-xl p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-teal-300" aria-hidden="true" />
              <h3 className="text-base font-bold text-white">Итоговая смета расходов</h3>
            </div>
            <span className="text-xs font-mono text-teal-300 tabular-nums">
              {estimate.safeCandidates} чел.
            </span>
          </div>

          {/* Net Headline Total */}
          <div className="space-y-1">
            <p className="text-xs text-slate-300">Итоговая смета к оплате (с учётом льгот)</p>
            <p className="text-3xl font-bold font-mono text-white tabular-nums">
              {formatRub(estimate.netTotal)}
            </p>
            {estimate.safeCandidates > 1 && (
              <p className="text-xs font-mono text-teal-300 tabular-nums">
                {formatRub(estimate.netPerCandidate)} / 1 инструктор-проводник
              </p>
            )}
          </div>

          {/* Cost Composition Bar */}
          {estimate.grossTotal > 0 && (
            <div className="space-y-2">
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                {estimate.dutySharePct > 0 && (
                  <div
                    className="h-full bg-teal-400"
                    style={{ width: `${estimate.dutySharePct}%` }}
                    title={`Пошлина и экзамен: ${estimate.dutySharePct}%`}
                  />
                )}
                {estimate.dpoSharePct > 0 && (
                  <div
                    className="h-full bg-sky-400"
                    style={{ width: `${estimate.dpoSharePct}%` }}
                    title={`ДПО ВВГУ: ${estimate.dpoSharePct}%`}
                  />
                )}
                {estimate.addonsSharePct > 0 && (
                  <div
                    className="h-full bg-amber-300"
                    style={{ width: `${estimate.addonsSharePct}%` }}
                    title={`Доп. сборы: ${estimate.addonsSharePct}%`}
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-300 tabular-nums">
                <span>Пошлина/сбор: {estimate.dutySharePct}%</span>
                <span>ДПО ВВГУ: {estimate.dpoSharePct}%</span>
                <span>Доп. сборы: {estimate.addonsSharePct}%</span>
              </div>
            </div>
          )}

          {/* Breakdown Rows */}
          <dl className="space-y-3 pt-4 border-t border-slate-700 text-xs">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-slate-300">
                Госпошлина / сбор РЦА ({formatRub(estimate.perPersonDuty)} × {estimate.safeCandidates})
              </dt>
              <dd className="font-mono font-semibold text-white tabular-nums shrink-0">
                {formatRub(estimate.totalDuty)}
              </dd>
            </div>

            <div className="flex items-start justify-between gap-4">
              <dt className="text-slate-300">
                Обучение ДПО ВВГУ ({activeTrackPreset.shortLabel})
              </dt>
              <dd className="font-mono font-semibold text-white tabular-nums shrink-0">
                {formatRub(estimate.totalDpo)}
              </dd>
            </div>

            <div className="flex items-start justify-between gap-4">
              <dt className="text-slate-300">
                Доп. сборы ({estimate.addonsList.length} поз. × {estimate.safeCandidates})
              </dt>
              <dd className="font-mono font-semibold text-white tabular-nums shrink-0">
                {formatRub(estimate.totalAddons)}
              </dd>
            </div>

            {estimate.subsidyAmount > 0 && (
              <div className="flex items-start justify-between gap-4 pt-2 border-t border-slate-800 text-teal-300">
                <dt>Компенсация Приморского края (70% ДПО)</dt>
                <dd className="font-mono font-semibold tabular-nums shrink-0">
                  − {formatRub(estimate.subsidyAmount)}
                </dd>
              </div>
            )}

            <div className="flex items-start justify-between gap-4 pt-3 border-t border-slate-700 text-sm">
              <dt className="font-semibold text-white">Валовая сумма / к оплате</dt>
              <dd className="font-mono font-bold text-teal-300 tabular-nums shrink-0">
                {estimate.subsidyAmount > 0
                  ? `${formatRub(estimate.grossTotal)} → ${formatRub(estimate.netTotal)}`
                  : formatRub(estimate.netTotal)}
              </dd>
            </div>
          </dl>

          <div className="pt-3 border-t border-slate-700 space-y-3">
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Расчёт носит ориентировочный характер для планирования бюджета (срок действия
              удостоверения — 5 лет). Окончательный счёт формируется после проверки стажа и
              выбора категории маршрута.
            </p>
            <button
              type="button"
              onClick={() =>
                onContactCurator(
                  `Смета аттестации: ${formatRub(estimate.netTotal)} (${estimate.safeCandidates} чел.)`
                )
              }
              className="w-full px-4 py-2.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-500 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
            >
              <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Уточнить смету и счёт у куратора</span>
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
};
