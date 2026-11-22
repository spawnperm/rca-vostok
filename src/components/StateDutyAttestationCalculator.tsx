import React, { useMemo, useState } from 'react';
import { Info, Landmark, RotateCcw, Scale } from 'lucide-react';
import { tracker } from '../utils/tracker';

type ApplicantType = 'individual' | 'organization';
type ProcedureKind =
  | 'instructor_attestation'
  | 'guide_nk_attestation'
  | 'duplicate_document'
  | 'name_change';
type ComplexityGrade = 'ks1' | 'ks2' | 'ks3';
type CommissionFormat = 'stationary' | 'field_remote';

interface ProcedureOption {
  id: ProcedureKind;
  title: string;
  shortLabel: string;
  nkDutyPerPerson: number;
  legalBasis: string;
  description: string;
}

const PROCEDURE_OPTIONS: ProcedureOption[] = [
  {
    id: 'instructor_attestation',
    title: 'Аттестация инструктора-проводника (РЦА / ФСТР)',
    shortLabel: 'Инструктор-проводник',
    nkDutyPerPerson: 0,
    legalBasis: 'ФЗ № 132-ФЗ · ПП РФ № 891 от 29.06.2024 · ст. 333.33 НК РФ',
    description:
      'Аттестацию проводят уполномоченные организации, а не госорганы: налоговая госпошлина по НК РФ не взимается (0 ₽), оплачивается регламентированная плата по методике ПП РФ № 891 с учётом категории сложности.',
  },
  {
    id: 'guide_nk_attestation',
    title: 'Госпошлина за аттестат экскурсовода (гида) / гида-переводчика',
    shortLabel: 'Экскурсовод / гид (НК РФ)',
    nkDutyPerPerson: 2000,
    legalBasis: 'подп. 72 п. 1 ст. 333.33 НК РФ (в ред. ФЗ № 176-ФЗ с 01.01.2025)',
    description:
      'С 1 января 2025 г. за выдачу аттестата о прохождении аттестации в органе власти (в т.ч. для гидов-экскурсоводов или в смежных сферах) взимается повышенная госпошлина 2 000 ₽ (ранее 1 300 ₽).',
  },
  {
    id: 'duplicate_document',
    title: 'Выдача дубликата аттестата / нагрудного документа при утере',
    shortLabel: 'Дубликат документа',
    nkDutyPerPerson: 2000,
    legalBasis: 'подп. 72 п. 1 ст. 333.33 НК РФ (в ред. ФЗ № 176-ФЗ с 01.01.2025)',
    description:
      'Государственная пошлина за выдачу дубликата квалификационного аттестата или свидетельства взамен утраченного/испорченного составляет 2 000 ₽.',
  },
  {
    id: 'name_change',
    title: 'Внесение изменений в документ при смене ФИО',
    shortLabel: 'Смена ФИО',
    nkDutyPerPerson: 500,
    legalBasis: 'подп. 72 п. 1 ст. 333.33 НК РФ (в ред. ФЗ № 176-ФЗ с 01.01.2025)',
    description:
      'Госпошлина за переоформление выданного квалификационного документа в связи с переменой фамилии, имени или отчества составляет 500 ₽ (ранее 350 ₽).',
  },
];

const COMPLEXITY_MULTIPLIERS: {
  id: ComplexityGrade;
  label: string;
  coefficient: number;
  baseExamCost: number;
  note: string;
}[] = [
  {
    id: 'ks1',
    label: '1 категория сложности (1 к.с.)',
    coefficient: 1.0,
    baseExamCost: 12000,
    note: 'Базовый коэффициент Приложения № 3 к методике ПП РФ № 891',
  },
  {
    id: 'ks2',
    label: '2 категория сложности (2 к.с.)',
    coefficient: 1.25,
    baseExamCost: 15000,
    note: 'Повышенный коэффициент за сложность маршрута и полевую проверку',
  },
  {
    id: 'ks3',
    label: '3 категория сложности (3 к.с.)',
    coefficient: 1.65,
    baseExamCost: 19800,
    note: 'Высокий коэффициент сложности (автономные маршруты, оценка ПСР)',
  },
];

const formatRub = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₽`;

export const StateDutyAttestationCalculator: React.FC = () => {
  const [applicantType, setApplicantType] = useState<ApplicantType>('individual');
  const [procedureKind, setProcedureKind] = useState<ProcedureKind>(
    'instructor_attestation'
  );
  const [complexityGrade, setComplexityGrade] = useState<ComplexityGrade>('ks1');
  const [commissionFormat, setCommissionFormat] =
    useState<CommissionFormat>('stationary');
  const [applicantsCount, setApplicantsCount] = useState<number>(1);
  const [includeReattestationDiscount, setIncludeReattestationDiscount] =
    useState<boolean>(false);

  const activeProcedure =
    PROCEDURE_OPTIONS.find((p) => p.id === procedureKind) ?? PROCEDURE_OPTIONS[0];
  const activeComplexity =
    COMPLEXITY_MULTIPLIERS.find((c) => c.id === complexityGrade) ??
    COMPLEXITY_MULTIPLIERS[0];

  const isInstructorTrack = procedureKind === 'instructor_attestation';

  const calculation = useMemo(() => {
    const qty = Math.max(1, Math.min(20, applicantsCount));
    const nkDutyPerPerson = activeProcedure.nkDutyPerPerson;
    const totalNkDuty = nkDutyPerPerson * qty;

    let examFeePerPerson = 0;
    if (isInstructorTrack) {
      const baseWithComplexity = activeComplexity.baseExamCost;
      const remoteSurcharge = commissionFormat === 'field_remote' ? 4500 : 0;
      const rawPerPerson = baseWithComplexity + remoteSurcharge;
      // Planned 5-year re-attestation (confirmation of compliance) reduces theory/admin check ~25%
      examFeePerPerson = includeReattestationDiscount
        ? Math.round(rawPerPerson * 0.75)
        : rawPerPerson;
    }

    const totalExamFee = examFeePerPerson * qty;
    const grandTotal = totalNkDuty + totalExamFee;

    return {
      qty,
      nkDutyPerPerson,
      totalNkDuty,
      examFeePerPerson,
      totalExamFee,
      grandTotal,
    };
  }, [
    applicantsCount,
    activeProcedure,
    isInstructorTrack,
    activeComplexity,
    commissionFormat,
    includeReattestationDiscount,
  ]);

  const handleReset = () => {
    setApplicantType('individual');
    setProcedureKind('instructor_attestation');
    setComplexityGrade('ks1');
    setCommissionFormat('stationary');
    setApplicantsCount(1);
    setIncludeReattestationDiscount(false);
    tracker.trackCustomInteraction('Калькулятор госпошлины: сброс');
  };

  return (
    <section
      aria-labelledby="state-duty-calculator-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Налоговый кодекс РФ и Постановление Правительства РФ № 891</span>
          </p>
          <h2
            id="state-duty-calculator-heading"
            className="text-xl sm:text-2xl font-bold text-slate-900"
          >
            Расчёт государственной пошлины и обязательных сборов за аттестацию
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Интерактивный расчёт налоговой госпошлины (с учётом поправок ФЗ № 176-ФЗ к ст. 333.33
            НК РФ, действующих в 2025–2026 гг.) и платы за проведение аттестации
            инструктора-проводника по методике ПП РФ № 891.
          </p>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Сбросить</span>
        </button>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-4 border-t border-slate-200">
        {/* Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Applicant Status */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-slate-900">
              01. Категория плательщика (ст. 333.17–333.18 НК РФ)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setApplicantType('individual');
                  setApplicantsCount(1);
                  tracker.trackCustomInteraction('Госпошлина: Физическое лицо');
                }}
                className={`p-3.5 text-left rounded-lg border transition-colors cursor-pointer ${
                  applicantType === 'individual'
                    ? 'bg-teal-50/70 border-teal-700 text-slate-900'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <p className="text-xs font-bold text-slate-900">
                  Физическое лицо / самозанятый
                </p>
                <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                  Самостоятельная подача заявления и оплата от собственного имени
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setApplicantType('organization');
                  setApplicantsCount((prev) => (prev < 2 ? 3 : prev));
                  tracker.trackCustomInteraction('Госпошлина: Туроператор / юрлицо');
                }}
                className={`p-3.5 text-left rounded-lg border transition-colors cursor-pointer ${
                  applicantType === 'organization'
                    ? 'bg-teal-50/70 border-teal-700 text-slate-900'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <p className="text-xs font-bold text-slate-900">
                  Юридическое лицо / туроператор (за штат)
                </p>
                <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                  Безналичная оплата за группу инструкторов по счёту/платёжному поручению
                </p>
              </button>
            </div>
          </div>

          {/* 2. Procedure Kind */}
          <div className="space-y-2.5 pt-4 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-900">
              02. Вид аттестационного действия или документа
            </p>
            <div className="space-y-2">
              {PROCEDURE_OPTIONS.map((proc) => {
                const selected = proc.id === procedureKind;
                return (
                  <button
                    key={proc.id}
                    type="button"
                    onClick={() => {
                      setProcedureKind(proc.id);
                      tracker.trackCustomInteraction(`Госпошлина: ${proc.shortLabel}`);
                    }}
                    className={`w-full p-3.5 text-left rounded-lg border transition-colors cursor-pointer ${
                      selected
                        ? 'bg-teal-50/70 border-teal-700 text-slate-900'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">{proc.title}</span>
                      <span className="font-mono text-xs font-semibold text-teal-800 tabular-nums shrink-0">
                        НК РФ: {formatRub(proc.nkDutyPerPerson)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                      {proc.legalBasis}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. PP RF 891 Parameters when instructor-guide is selected */}
          {isInstructorTrack && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-900">
                  03. Категория сложности маршрута (Приложение № 3 к ПП РФ № 891)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {COMPLEXITY_MULTIPLIERS.map((lvl) => {
                    const selected = lvl.id === complexityGrade;
                    return (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setComplexityGrade(lvl.id)}
                        className={`p-3 text-left rounded-lg border text-xs transition-colors cursor-pointer ${
                          selected
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <p className="font-semibold leading-snug">{lvl.label}</p>
                        <p
                          className={`mt-1 text-[11px] font-mono tabular-nums ${
                            selected ? 'text-teal-300' : 'text-slate-500'
                          }`}
                        >
                          k = {lvl.coefficient.toFixed(2)} · {formatRub(lvl.baseExamCost)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCommissionFormat('stationary')}
                  className={`p-3 text-left rounded-lg border text-xs transition-colors cursor-pointer ${
                    commissionFormat === 'stationary'
                      ? 'bg-teal-50/70 border-teal-700 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <p className="font-semibold">Площадка РЦА (ВВГУ / Шкотово)</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Без командировочных расходов комиссии (+0 ₽)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setCommissionFormat('field_remote')}
                  className={`p-3 text-left rounded-lg border text-xs transition-colors cursor-pointer ${
                    commissionFormat === 'field_remote'
                      ? 'bg-teal-50/70 border-teal-700 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <p className="font-semibold">Выездная аттестационная комиссия</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Учёт выездной работы членов комиссии (+4 500 ₽)
                  </p>
                </button>
              </div>

              <label className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeReattestationDiscount}
                  onChange={(e) => setIncludeReattestationDiscount(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-teal-700 rounded cursor-pointer shrink-0"
                />
                <span className="text-xs">
                  <span className="block font-semibold text-slate-900">
                    Плановое подтверждение соответствия через 5 лет (−25%)
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    Сниженный объём проверки при продлении действующей записи в Едином реестре
                  </span>
                </span>
              </label>
            </div>
          )}

          {/* 4. Count of applicants */}
          <div className="pt-4 border-t border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="duty-applicants-count" className="font-semibold text-slate-900">
                Количество аттестуемых лиц
              </label>
              <span className="font-mono font-bold text-teal-800 tabular-nums">
                {calculation.qty} чел.
              </span>
            </div>
            <input
              id="duty-applicants-count"
              type="range"
              min={1}
              max={20}
              step={1}
              value={applicantsCount}
              onChange={(e) => setApplicantsCount(Number(e.target.value))}
              className="w-full accent-teal-700 cursor-pointer"
            />
          </div>
        </div>

        {/* Result Card (5 cols) */}
        <aside className="lg:col-span-5 bg-slate-900 text-white rounded-xl p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-teal-300" aria-hidden="true" />
              <h3 className="text-base font-bold text-white">Расчёт обязательных платежей</h3>
            </div>
            <span className="text-xs font-mono text-teal-300">
              {applicantType === 'individual' ? 'Физлицо' : 'Юрлицо'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4 space-y-1">
              <p className="text-xs text-slate-300">Госпошлина в бюджет по НК РФ</p>
              <p className="text-2xl font-bold font-mono text-white tabular-nums">
                {formatRub(calculation.totalNkDuty)}
              </p>
              <p className="text-[11px] font-mono text-teal-300 tabular-nums">
                Ставка: {formatRub(calculation.nkDutyPerPerson)} / чел.
              </p>
            </div>

            {isInstructorTrack && (
              <div className="bg-slate-800/80 border border-teal-700/60 rounded-lg p-4 space-y-1">
                <p className="text-xs text-slate-300">
                  Плата уполномоченной организации (ПП РФ № 891)
                </p>
                <p className="text-2xl font-bold font-mono text-teal-300 tabular-nums">
                  {formatRub(calculation.totalExamFee)}
                </p>
                <p className="text-[11px] font-mono text-slate-300 tabular-nums">
                  {formatRub(calculation.examFeePerPerson)} / чел. (коэф.{' '}
                  {activeComplexity.coefficient.toFixed(2)})
                </p>
              </div>
            )}
          </div>

          <dl className="divide-y divide-slate-800 text-xs">
            <div className="py-2.5 flex items-start justify-between gap-3">
              <dt className="text-slate-300">Процедура</dt>
              <dd className="text-right font-medium text-white max-w-[220px]">
                {activeProcedure.shortLabel}
              </dd>
            </div>
            <div className="py-2.5 flex items-start justify-between gap-3">
              <dt className="text-slate-300">Количество заявителей</dt>
              <dd className="font-mono font-semibold text-white tabular-nums">
                {calculation.qty} чел.
              </dd>
            </div>
            <div className="py-3 flex items-baseline justify-between gap-3 text-sm">
              <dt className="font-semibold text-white">Итого к уплате</dt>
              <dd className="font-mono text-xl font-bold text-teal-300 tabular-nums">
                {formatRub(calculation.grandTotal)}
              </dd>
            </div>
          </dl>

          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 space-y-2 text-xs">
            <div className="flex items-start gap-2 text-slate-200">
              <Info className="w-4 h-4 text-teal-300 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="leading-relaxed">{activeProcedure.description}</p>
            </div>
            <p className="text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-700/70">
              {activeProcedure.legalBasis}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
};
