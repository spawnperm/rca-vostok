import React, { useMemo, useState } from 'react';
import { Calculator, CheckCircle2, Info, MapPin, RotateCcw, Users } from 'lucide-react';
import { tracker } from '../utils/tracker';

type GuideCategoryId =
  | 'contour_a_experienced'
  | 'hiking_guide'
  | 'water_rafting'
  | 'expedition_34ks'
  | 'oopt_auto';

type ComplexityLevelId = 'base_1_2' | 'advanced_3_4' | 'special_oopt';

type PresenceRegionId =
  | 'primorye'
  | 'khabarovsk'
  | 'amur'
  | 'sakhalin'
  | 'kamchatka'
  | 'yakutia'
  | 'magadan_chukotka';

interface GuideCategoryOption {
  id: GuideCategoryId;
  title: string;
  shortTitle: string;
  dpoHours: string;
  baseDpoCost: number;
  baseExamFee: number;
  description: string;
}

interface PresenceRegionOption {
  id: PresenceRegionId;
  name: string;
  shortName: string;
  travelEstimate: number;
  subsidyEligible: boolean;
  formatNote: string;
  nearestSessionNote: string;
}

interface OptionalPrepModule {
  id: string;
  label: string;
  hint: string;
  cost: number;
}

const GUIDE_CATEGORIES: GuideCategoryOption[] = [
  {
    id: 'contour_a_experienced',
    title: 'Действующий гид · Контур А (зачёт стажа)',
    shortTitle: 'Контур А (действующий гид)',
    dpoHours: 'Без полного курса ДПО · верификация опыта',
    baseDpoCost: 0,
    baseExamFee: 15000,
    description:
      'Для практиков с подтверждёнными походами и договорами туроператоров: оплачивается аттестационный блок, защита паспорта маршрута и выездной экзамен.',
  },
  {
    id: 'hiking_guide',
    title: 'Инструктор пешеходного / горного туризма',
    shortTitle: 'Пешеходный / горный',
    dpoHours: '≈ 250 ч переподготовки ВВГУ + экзамен РЦА',
    baseDpoCost: 27200,
    baseExamFee: 15000,
    description:
      'Базовый поток ВВГУ и РЦА для маршрутов по горным хребтам, сопкам и экотропам (ориентирование, переправы, сопровождение групп 8–12 чел.).',
  },
  {
    id: 'water_rafting',
    title: 'Инструктор водного туризма и сплавов',
    shortTitle: 'Водный туризм и сплавы',
    dpoHours: 'Модульный поток ВВГУ (подтверждённая цена 27 200 ₽)',
    baseDpoCost: 27200,
    baseExamFee: 15000,
    description:
      'Специализация на горных реках и морском каякинге (10 договорных мест потока): гидрология, спасработы на течении и переправы.',
  },
  {
    id: 'expedition_34ks',
    title: 'Гид сложных и экспедиционных маршрутов (3–4 КС)',
    shortTitle: 'Экспедиционный (3–4 КС)',
    dpoHours: 'Расширенный модуль ДПО + повышенный полигон',
    baseDpoCost: 32000,
    baseExamFee: 25000,
    description:
      'Подготовка и аттестация руководителей малых групп (4–6 чел.) на удалённых и автономных маршрутах Камчатки, Сахалина, Якутии и Колымы.',
  },
  {
    id: 'oopt_auto',
    title: 'Гид автотуризма и экомаршрутов ООПТ',
    shortTitle: 'Автотуризм и ООПТ',
    dpoHours: 'Проектируемый профиль ВВГУ + стандарты ООПТ',
    baseDpoCost: 29500,
    baseExamFee: 15000,
    description:
      'Трек для маршрутов повышенной проходимости, прибрежных кластеров и особо охраняемых природных территорий («Земля леопарда», «Бикин»).',
  },
];

const COMPLEXITY_LEVELS: {
  id: ComplexityLevelId;
  label: string;
  feeDelta: number;
  note: string;
}[] = [
  {
    id: 'special_oopt',
    label: 'Спецсопровождение / экотропы ООПТ',
    feeDelta: 0,
    note: 'Базовый экзаменационный тариф без усложнения горно-водного этапа',
  },
  {
    id: 'base_1_2',
    label: '1–2 категория сложности (КС)',
    feeDelta: 0,
    note: 'Стандартный очный теоретический и полевой блок РЦА и ФСТР',
  },
  {
    id: 'advanced_3_4',
    label: '3–4 категория сложности (КС)',
    feeDelta: 8000,
    note: 'Усиленный полевой экзамен, оценка ПСР и автономной эвакуации',
  },
];

const PRESENCE_REGIONS: PresenceRegionOption[] = [
  {
    id: 'primorye',
    name: 'Приморский край (база ВВГУ и Шкотовский полигон)',
    shortName: 'Приморский край',
    travelEstimate: 0,
    subsidyEligible: true,
    formatNote: 'Очное прохождение во Владивостоке и Шкотовском районе без затрат на авиаперелёт.',
    nearestSessionNote: '14–19 дек 2026 (вода) · 16–18 апр 2027 (1–4 КС)',
  },
  {
    id: 'khabarovsk',
    name: 'Хабаровский край (дистанционно + выезд на экзамен)',
    shortName: 'Хабаровский край',
    travelEstimate: 9500,
    subsidyEligible: false,
    formatNote: 'Теория и сверка стажа онлайн; очный приём и полигон на площадке РЦА во Владивостоке.',
    nearestSessionNote: '25–27 фев 2027 (межрегиональный поток)',
  },
  {
    id: 'amur',
    name: 'Амурская область (дистанционная теория + выезд)',
    shortName: 'Амурская область',
    travelEstimate: 11000,
    subsidyEligible: false,
    formatNote: 'Онлайн-модуль ДПО ВВГУ + поездка на весеннюю или майскую сессию в Приморье.',
    nearestSessionNote: '14–16 май 2027 (речной и автопрофиль)',
  },
  {
    id: 'sakhalin',
    name: 'Сахалинская область и Курилы',
    shortName: 'Сахалин и Курилы',
    travelEstimate: 16500,
    subsidyEligible: false,
    formatNote: 'Дистанционная подготовка + перелёт во Владивосток на комбинированную сессию.',
    nearestSessionNote: '16–18 апр 2027 (пешка + морской каякинг)',
  },
  {
    id: 'kamchatka',
    name: 'Камчатский край (переаттестация и комиссия ДФО)',
    shortName: 'Камчатский край',
    travelEstimate: 22000,
    subsidyEligible: false,
    formatNote: 'Дистанционное портфолио по ПП № 1893 + выездное участие в комиссии ВВГУ/ФСТР.',
    nearestSessionNote: '12–14 мар 2027 (переаттестация гидов)',
  },
  {
    id: 'yakutia',
    name: 'Республика Саха (Якутия)',
    shortName: 'Якутия',
    travelEstimate: 26000,
    subsidyEligible: false,
    formatNote: 'Удалённый теоретический этап ВВГУ + очно-полевой экзамен в межрегиональной группе.',
    nearestSessionNote: '14–16 май 2027 (автономные маршруты)',
  },
  {
    id: 'magadan_chukotka',
    name: 'Магаданская область и Чукотка',
    shortName: 'Магадан и Чукотка',
    travelEstimate: 31000,
    subsidyEligible: false,
    formatNote: 'Предэкспедиционный интенсив + перелёт лидера группы на итоговую сессию РЦА.',
    nearestSessionNote: '04–06 июн 2027 (экспедиционный поток)',
  },
];

const OPTIONAL_PREP_MODULES: OptionalPrepModule[] = [
  {
    id: 'wfa',
    label: 'Модуль Wilderness First Aid (автономная первая помощь)',
    hint: 'Практикум помощи в удалённых районах ДФО',
    cost: 6500,
  },
  {
    id: 'polygon_gear',
    label: 'Сборы на Шкотовском полигоне и страховка испытаний',
    hint: 'Выездной организационный день и групповое снаряжение',
    cost: 5500,
  },
  {
    id: 'passport_audit',
    label: 'Экспертиза и оформление паспорта маршрута (ПП № 760)',
    hint: 'Методическая проверка схем эвакуации и связи до защиты',
    cost: 4000,
  },
  {
    id: 'med_check',
    label: 'Медицинский допуск соискателя (справка установленной формы)',
    hint: 'Ориентир прохождения медкомиссии перед подачей документов',
    cost: 2800,
  },
];

const formatRub = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₽`;

export const TrainingAndAttestationCostEstimator: React.FC = () => {
  const [categoryId, setCategoryId] = useState<GuideCategoryId>('water_rafting');
  const [complexityId, setComplexityId] = useState<ComplexityLevelId>('base_1_2');
  const [regionId, setRegionId] = useState<PresenceRegionId>('primorye');
  const [candidatesCount, setCandidatesCount] = useState<number>(1);
  const [includeTravelLogistics, setIncludeTravelLogistics] = useState<boolean>(true);
  const [applyPrimoryeSubsidy, setApplyPrimoryeSubsidy] = useState<boolean>(false);
  const [selectedModules, setSelectedModules] = useState<string[]>([
    'wfa',
    'polygon_gear',
  ]);

  const activeCategory =
    GUIDE_CATEGORIES.find((c) => c.id === categoryId) ?? GUIDE_CATEGORIES[0];
  const activeComplexity =
    COMPLEXITY_LEVELS.find((l) => l.id === complexityId) ?? COMPLEXITY_LEVELS[1];
  const activeRegion =
    PRESENCE_REGIONS.find((r) => r.id === regionId) ?? PRESENCE_REGIONS[0];

  const handleReset = () => {
    setCategoryId('water_rafting');
    setComplexityId('base_1_2');
    setRegionId('primorye');
    setCandidatesCount(1);
    setIncludeTravelLogistics(true);
    setApplyPrimoryeSubsidy(false);
    setSelectedModules(['wfa', 'polygon_gear']);
    tracker.trackCustomInteraction('Калькулятор стоимости ДФО: сброс');
  };

  const toggleModule = (id: string) => {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const breakdown = useMemo(() => {
    const qty = Math.max(1, Math.min(25, candidatesCount));
    const dpoPerPerson = activeCategory.baseDpoCost;
    const examPerPerson = activeCategory.baseExamFee + activeComplexity.feeDelta;
    const addonsPerPerson = OPTIONAL_PREP_MODULES.filter((m) =>
      selectedModules.includes(m.id)
    ).reduce((sum, m) => sum + m.cost, 0);
    const travelPerPerson = includeTravelLogistics ? activeRegion.travelEstimate : 0;

    // Group logistics discount of 15% when sending 3+ candidates from remote DFO regions together
    const effectiveTravelPerPerson =
      qty >= 3 && travelPerPerson > 0 ? Math.round(travelPerPerson * 0.85) : travelPerPerson;

    const totalDpo = dpoPerPerson * qty;
    const totalExam = examPerPerson * qty;
    const totalAddons = addonsPerPerson * qty;
    const totalTravel = effectiveTravelPerPerson * qty;
    const grossTotal = totalDpo + totalExam + totalAddons + totalTravel;

    // Primorye corporate subsidy covers up to 70% of DPO tuition for Primorye tour operators/IE
    const subsidyEligibleNow = activeRegion.subsidyEligible && totalDpo > 0;
    const subsidyAmount =
      applyPrimoryeSubsidy && subsidyEligibleNow ? Math.round(totalDpo * 0.7) : 0;

    const netTotal = Math.max(0, grossTotal - subsidyAmount);
    const netPerPerson = Math.round(netTotal / qty);

    const avgPrimoryeVoucher = 27900; // Research data: average tourist package in Primorye = 27.9k RUB
    const paybackVouchers =
      netPerPerson > 0 ? Math.max(1, Math.ceil(netPerPerson / avgPrimoryeVoucher)) : 0;

    const denom = Math.max(grossTotal, 1);
    const pctDpo = Math.round((totalDpo / denom) * 100);
    const pctExam = Math.round((totalExam / denom) * 100);
    const pctAddons = Math.round((totalAddons / denom) * 100);
    const pctTravel = Math.max(0, 100 - pctDpo - pctExam - pctAddons);

    return {
      qty,
      dpoPerPerson,
      examPerPerson,
      addonsPerPerson,
      effectiveTravelPerPerson,
      totalDpo,
      totalExam,
      totalAddons,
      totalTravel,
      grossTotal,
      subsidyEligibleNow,
      subsidyAmount,
      netTotal,
      netPerPerson,
      paybackVouchers,
      pctDpo,
      pctExam,
      pctAddons,
      pctTravel,
    };
  }, [
    candidatesCount,
    activeCategory,
    activeComplexity,
    activeRegion,
    selectedModules,
    includeTravelLogistics,
    applyPrimoryeSubsidy,
  ]);

  return (
    <section
      aria-labelledby="training-cost-estimator-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Бюджетный модуль соискателя и туроператора ДФО</span>
          </p>
          <h2
            id="training-cost-estimator-heading"
            className="text-xl sm:text-2xl font-bold text-slate-900"
          >
            Расчёт примерной стоимости обучения и аттестации по категориям и регионам
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Оценка индивидуальных или корпоративных затрат на переподготовку ДПО в ВВГУ,
            аттестационные испытания РЦА «Русский Восток», дополнительные модули и логистику выезда
            для каждого субъекта Дальнего Востока.
          </p>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Сбросить расчёт</span>
        </button>
      </div>

      {/* Main Split: Controls (7 cols) + Summary Result Dashboard (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-4 border-t border-slate-200">
        {/* Left: Category, Complexity, Region & Options */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Guide Category */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-900">
              01. Категория инструктора-проводника и программа подготовки
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {GUIDE_CATEGORIES.map((cat) => {
                const isSelected = cat.id === categoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCategoryId(cat.id);
                      tracker.trackCustomInteraction(`Смета ДФО · категория: ${cat.shortTitle}`);
                    }}
                    className={`p-3.5 text-left rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50/70 border-teal-700 text-slate-900'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">{cat.shortTitle}</span>
                      <span className="font-mono text-xs font-semibold text-teal-800 tabular-nums shrink-0">
                        ДПО: {formatRub(cat.baseDpoCost)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 leading-snug">{cat.dpoHours}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 leading-relaxed">
              {activeCategory.description}
            </p>
          </div>

          {/* 2. Route Complexity Level */}
          <div className="space-y-2.5 pt-4 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-900">
              02. Заявленная категория сложности маршрута (КС)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {COMPLEXITY_LEVELS.map((lvl) => {
                const isSelected = lvl.id === complexityId;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setComplexityId(lvl.id)}
                    className={`p-3 text-left rounded-lg border text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-semibold leading-snug">{lvl.label}</p>
                    <p
                      className={`mt-1 text-[11px] font-mono tabular-nums ${
                        isSelected ? 'text-teal-300' : 'text-slate-500'
                      }`}
                    >
                      {lvl.feeDelta > 0 ? `+ ${formatRub(lvl.feeDelta)} к экзамену` : 'Базовый тариф'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Presence Region */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="estimator-presence-region"
                className="text-xs font-semibold text-slate-900 inline-flex items-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                <span>03. Регион присутствия кандидата / туроператора в ДФО</span>
              </label>
              <span className="text-[11px] font-mono text-teal-800 tabular-nums">
                {activeRegion.nearestSessionNote}
              </span>
            </div>

            <select
              id="estimator-presence-region"
              value={regionId}
              onChange={(e) => {
                const nextId = e.target.value as PresenceRegionId;
                setRegionId(nextId);
                if (nextId !== 'primorye') {
                  setApplyPrimoryeSubsidy(false);
                }
                tracker.trackCustomInteraction(`Смета ДФО · регион: ${nextId}`);
              }}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
            >
              {PRESENCE_REGIONS.map((reg) => (
                <option key={reg.id} value={reg.id}>
                  {reg.name} {reg.travelEstimate > 0 ? `(выезд ~${formatRub(reg.travelEstimate)})` : '(без перелёта)'}
                </option>
              ))}
            </select>

            <p className="text-xs text-slate-600 leading-relaxed">{activeRegion.formatNote}</p>

            {/* Logistics + Candidates + Subsidy Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTravelLogistics}
                  onChange={(e) => setIncludeTravelLogistics(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-teal-700 rounded cursor-pointer shrink-0"
                />
                <span className="text-xs">
                  <span className="block font-semibold text-slate-900">
                    Учитывать логистику очного этапа
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    {activeRegion.travelEstimate === 0
                      ? 'Внутри Приморского края доп. перелёт не требуется'
                      : `Билеты и проживание ~${formatRub(activeRegion.travelEstimate)}/чел. (−15% от 3 чел.)`}
                  </span>
                </span>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 border rounded-lg transition-colors ${
                  breakdown.subsidyEligibleNow
                    ? 'bg-teal-50/60 border-teal-200 cursor-pointer'
                    : 'bg-slate-50 border-slate-200 opacity-65 cursor-not-allowed'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!breakdown.subsidyEligibleNow}
                  checked={applyPrimoryeSubsidy && breakdown.subsidyEligibleNow}
                  onChange={(e) => setApplyPrimoryeSubsidy(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-teal-700 rounded cursor-pointer shrink-0 disabled:cursor-not-allowed"
                />
                <span className="text-xs">
                  <span className="block font-semibold text-slate-900">
                    Субсидия Приморья (до 70% ДПО)
                  </span>
                  <span className="block text-[11px] text-slate-600 mt-0.5">
                    {breakdown.subsidyEligibleNow
                      ? 'Компенсация затрат юрлицам и ИП Приморского края'
                      : activeRegion.subsidyEligible
                      ? 'Применима только при выборе курса ДПО ВВГУ'
                      : 'Доступна при регистрации бизнеса в Приморском крае'}
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* 4. Team Size & Optional Modules */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor="estimator-group-qty"
                  className="font-semibold text-slate-900 inline-flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>04. Количество аттестуемых специалистов</span>
                </label>
                <span className="font-mono font-bold text-teal-800 tabular-nums">
                  {breakdown.qty} чел.
                </span>
              </div>
              <input
                id="estimator-group-qty"
                type="range"
                min={1}
                max={25}
                step={1}
                value={candidatesCount}
                onChange={(e) => setCandidatesCount(Number(e.target.value))}
                className="w-full accent-teal-700 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">
                При коллективной заявке от 3 человек из соседних регионов ДФО закладывается 15%
                экономия на совместной логистике выезда.
              </p>
            </div>

            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
              {OPTIONAL_PREP_MODULES.map((mod) => {
                const checked = selectedModules.includes(mod.id);
                return (
                  <label
                    key={mod.id}
                    className="flex items-start justify-between gap-3 p-3 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <span className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleModule(mod.id)}
                        className="mt-0.5 w-4 h-4 accent-teal-700 rounded cursor-pointer shrink-0"
                      />
                      <span>
                        <span className="block text-xs font-semibold text-slate-900">
                          {mod.label}
                        </span>
                        <span className="block text-[11px] text-slate-500">{mod.hint}</span>
                      </span>
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-800 tabular-nums shrink-0">
                      + {formatRub(mod.cost)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Cost Estimate Summary Dashboard (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 text-white rounded-xl p-6 sm:p-7 space-y-6">
          <div className="space-y-1">
            <p className="text-xs font-medium text-teal-300">
              {activeCategory.shortTitle} · {activeRegion.shortName}
            </p>
            <h3 className="text-lg font-bold text-white">Ориентировочный бюджет</h3>
          </div>

          <div className="bg-slate-800/80 border border-teal-700/60 rounded-xl p-5 space-y-2">
            <p className="text-xs text-slate-300">
              Итого к оплате ({breakdown.qty} {breakdown.qty === 1 ? 'специалист' : 'спец.'})
            </p>
            <p className="text-3xl sm:text-4xl font-bold font-mono text-white tabular-nums">
              {formatRub(breakdown.netTotal)}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs font-mono tabular-nums">
              <span className="text-teal-300">
                На 1 проводника: {formatRub(breakdown.netPerPerson)}
              </span>
              {breakdown.subsidyAmount > 0 && (
                <span className="text-amber-300">
                  Субсидия: −{formatRub(breakdown.subsidyAmount)}
                </span>
              )}
            </div>
          </div>

          {/* Stacked Cost Structure Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] text-slate-300">
              <span>Структура затрат (без учёта субсидии)</span>
              <span className="font-mono tabular-nums">{formatRub(breakdown.grossTotal)}</span>
            </div>
            <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden flex">
              {breakdown.pctDpo > 0 && (
                <div
                  className="h-full bg-teal-400"
                  style={{ width: `${breakdown.pctDpo}%` }}
                  title={`Обучение ДПО: ${breakdown.pctDpo}%`}
                />
              )}
              {breakdown.pctExam > 0 && (
                <div
                  className="h-full bg-sky-400"
                  style={{ width: `${breakdown.pctExam}%` }}
                  title={`Аттестация РЦА/ФСТР: ${breakdown.pctExam}%`}
                />
              )}
              {breakdown.pctAddons > 0 && (
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${breakdown.pctAddons}%` }}
                  title={`Доп. модули: ${breakdown.pctAddons}%`}
                />
              )}
              {breakdown.pctTravel > 0 && (
                <div
                  className="h-full bg-slate-500"
                  style={{ width: `${breakdown.pctTravel}%` }}
                  title={`Логистика ДФО: ${breakdown.pctTravel}%`}
                />
              )}
            </div>
          </div>

          {/* Itemized Breakdown */}
          <dl className="divide-y divide-slate-800 text-xs">
            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-300 inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-xs bg-teal-400 shrink-0" aria-hidden="true" />
                <span>Программа ДПО ВВГУ</span>
              </dt>
              <dd className="font-mono font-semibold text-white tabular-nums">
                {formatRub(breakdown.totalDpo)}
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-300 inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-xs bg-sky-400 shrink-0" aria-hidden="true" />
                <span>Экзамен РЦА и ФСТР ({activeComplexity.label})</span>
              </dt>
              <dd className="font-mono font-semibold text-white tabular-nums">
                {formatRub(breakdown.totalExam)}
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-300 inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-xs bg-amber-400 shrink-0" aria-hidden="true" />
                <span>Доп. модули и допуск ({selectedModules.length})</span>
              </dt>
              <dd className="font-mono font-semibold text-white tabular-nums">
                {formatRub(breakdown.totalAddons)}
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-300 inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-xs bg-slate-500 shrink-0" aria-hidden="true" />
                <span>Логистика региона ({activeRegion.shortName})</span>
              </dt>
              <dd className="font-mono font-semibold text-white tabular-nums">
                {formatRub(breakdown.totalTravel)}
              </dd>
            </div>
            {breakdown.subsidyAmount > 0 && (
              <div className="py-2.5 flex items-center justify-between gap-3">
                <dt className="text-teal-300 font-medium">
                  Компенсация бизнеса Приморья (70% ДПО)
                </dt>
                <dd className="font-mono font-bold text-teal-300 tabular-nums">
                  −{formatRub(breakdown.subsidyAmount)}
                </dd>
              </div>
            )}
          </dl>

          {/* Payback & Benchmark Box */}
          <div className="bg-slate-800/50 border border-slate-700/80 rounded-lg p-4 space-y-2 text-xs">
            <div className="flex items-start gap-2 text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="leading-relaxed">
                Окупаемость на 1 проводника: около{' '}
                <strong className="font-mono text-white">
                  {breakdown.paybackVouchers} организованных туров
                </strong>{' '}
                (при средней стоимости путёвки в Приморье 27 900 ₽) при сроке действия бейджа 5
                лет.
              </p>
            </div>
            <div className="flex items-start gap-2 text-slate-400 text-[11px] pt-1 border-t border-slate-700/70">
              <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="leading-relaxed">
                Ориентир ДПО по водному треку ВВГУ (27 200 ₽) и компенсация до 70% основаны на
                данных РЦА; логистика проезда и смета сложных КС носят расчётный характер.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
