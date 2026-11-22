import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Grid,
  Pause,
  Play,
  Printer,
  RotateCcw,
} from 'lucide-react';
import {
  ACADEMIC_SLIDES,
  EMPIRICAL_TABLE,
  MANAGEMENT_SLIDES,
  PRESENTATION_GUIDELINES,
  SlideItem,
} from '../data/researchData';

const SlideVisualRenderer: React.FC<{ slide: SlideItem; deckType: 'academic' | 'management' }> = ({
  slide,
  deckType,
}) => {
  switch (slide.visualType) {
    case 'title':
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 flex flex-col justify-between h-full">
          <div className="space-y-2">
            <p className="text-xs font-mono text-teal-700">
              {deckType === 'academic' ? 'Специальность 5.2.3 · ВАК РФ' : 'Минтуризма · МЭР · ВВГУ'}
            </p>
            <p className="text-base font-bold text-slate-900">
              {deckType === 'academic'
                ? 'Защита диссертационного исследования'
                : 'Управленческая сессия по кадровому обеспечению'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200 text-xs">
            <div>
              <p className="text-slate-500">Площадка</p>
              <p className="font-semibold text-slate-900">ВВГУ · РЦА «Русский Восток»</p>
            </div>
            <div>
              <p className="text-slate-500">Регламент</p>
              <p className="font-mono font-semibold text-slate-900 tabular-nums">
                {deckType === 'academic' ? '18 мин · 18 слайдов' : '12 мин · 10 слайдов'}
              </p>
            </div>
          </div>
        </div>
      );

    case 'contrast-columns':
      return (
        <div className="grid grid-cols-2 gap-4 h-full">
          <div className="bg-teal-50/70 border border-teal-200 rounded-lg p-5 flex flex-col justify-between">
            <p className="text-xs font-semibold text-teal-800">Спрос (растёт)</p>
            <div className="space-y-2 my-3">
              <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">4 068,9 тыс.</p>
              <p className="text-xs text-slate-600">поездок в Приморье (+4,5%)</p>
              <p className="text-xl font-bold font-mono text-teal-800 tabular-nums">≈ 835 тыс.</p>
              <p className="text-xs text-slate-600">активных туристов (20%)</p>
            </div>
            <p className="text-[11px] text-slate-500">Сезон 7 месяцев</p>
          </div>
          <div className="bg-red-50/60 border border-red-200 rounded-lg p-5 flex flex-col justify-between">
            <p className="text-xs font-semibold text-red-800">Легальное предложение</p>
            <div className="space-y-2 my-3">
              <p className="text-2xl font-bold font-mono text-red-700 tabular-nums">122 чел.</p>
              <p className="text-xs text-slate-600">в федеральном реестре по краю</p>
              <p className="text-xl font-bold font-mono text-slate-900 tabular-nums">26 / 52</p>
              <p className="text-xs text-slate-600">аттестованы окт. 2026 / обучены за год</p>
            </div>
            <p className="text-[11px] text-red-700 font-medium">Дефицит более 18 раз</p>
          </div>
        </div>
      );

    case 'normative-flow':
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col justify-center gap-3 h-full">
          {[
            { label: 'Нормативный фильтр', sub: 'ПП № 1003 и № 1893 (дедлайн 01.10.2026)' },
            { label: 'Барьер легализации', sub: 'Отрыв от работы + цена + процедура экзамена' },
            { label: 'Отложенный спрос и дефицит', sub: 'Опытные гиды вне реестра, недопроданные туры' },
          ].map((step, i) => (
            <div key={step.label} className="bg-white border border-slate-200 rounded-md p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-900">{step.label}</p>
                <p className="text-[11px] text-slate-600">{step.sub}</p>
              </div>
              <span className="font-mono text-xs text-teal-700 font-semibold">0{i + 1}</span>
            </div>
          ))}
        </div>
      );

    case 'kamchatka-funnel':
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col justify-center space-y-4 h-full">
          <p className="text-xs font-semibold text-slate-700">Контрольная точка · Камчатский край (2026)</p>
          {[
            { label: 'Специалистов в реестре', val: 343, max: 350, color: 'bg-slate-800' },
            { label: 'Прошли аттестацию фактически', val: 82, max: 350, color: 'bg-teal-700' },
            { label: 'Записались на переаттестацию-2026', val: 9, max: 350, color: 'bg-red-700' },
          ].map((b) => (
            <div key={b.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-700">{b.label}</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">{b.val} чел.</span>
              </div>
              <div className="h-3 bg-slate-200 rounded-sm overflow-hidden">
                <div className={`h-full ${b.color}`} style={{ width: `${Math.max((b.val / b.max) * 100, 3)}%` }} />
              </div>
            </div>
          ))}
          <p className="text-[11px] text-slate-500 pt-1">Индикатор отложенного спроса на переобучение</p>
        </div>
      );

    case 'gap-bars':
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col justify-center space-y-4 h-full">
          <p className="text-xs font-semibold text-slate-700">Приморье: Потребность vs Реестр (чел.)</p>
          {[
            { label: 'Базовая потребность (P_org = 30%)', val: 2390, max: 2500, color: 'bg-slate-900' },
            { label: 'Консервативный сценарий (15–20%)', val: 1400, max: 2500, color: 'bg-teal-700' },
            { label: 'Реестр Приморья', val: 122, max: 2500, color: 'bg-red-700' },
          ].map((b) => (
            <div key={b.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-700">{b.label}</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">{b.val}</span>
              </div>
              <div className="h-3.5 bg-slate-200 rounded-sm overflow-hidden">
                <div className={`h-full ${b.color}`} style={{ width: `${Math.max((b.val / b.max) * 100, 4)}%` }} />
              </div>
            </div>
          ))}
        </div>
      );

    case 'two-contour':
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-3 h-full flex flex-col justify-center">
          <div className="bg-white border border-teal-700 rounded-md p-3.5">
            <p className="text-xs font-bold text-teal-800">Контур А · Действующие гиды</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Модульный формат · Зачёт практического опыта · Совмещение с сезоном
            </p>
          </div>
          <div className="bg-white border border-slate-300 rounded-md p-3.5">
            <p className="text-xs font-bold text-slate-900">Контур Б · Подготовка «с нуля»</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Базовая программа ДПО (250 ч) · Практика на маршрутах Шкотовского района
            </p>
          </div>
          <div className="bg-slate-900 text-white rounded-md p-3 text-center text-xs font-semibold">
            Единый результат: сдача экзамена РЦА и внесение в федеральный реестр
          </div>
        </div>
      );

    case 'ifmga-timeline':
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col justify-center space-y-4 h-full">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-slate-900">
              <span>Стандарт IFMGA</span>
              <span className="font-mono">5–10 лет</span>
            </div>
            <div className="h-3 bg-slate-900 rounded-sm w-full" />
            <p className="text-[11px] text-slate-600">Отбор + 55 маршрутов + ≥ 90 дней обучения</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-teal-800">
              <span>Российская модель (ПП № 1003)</span>
              <span className="font-mono">250 ч + экзамен</span>
            </div>
            <div className="h-3 bg-teal-700 rounded-sm w-1/4" />
            <p className="text-[11px] text-slate-600">Переаттестация каждые 5 лет · Важен неснижаемый практический минимум</p>
          </div>
        </div>
      );

    case 'three-numbers':
      return (
        <div className="grid grid-cols-1 gap-3 h-full">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
            <span className="text-xs text-slate-600">Активные туристы в год</span>
            <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">835 тыс.</span>
          </div>
          <div className="bg-red-50/70 border border-red-200 rounded-lg p-4 flex items-center justify-between">
            <span className="text-xs text-red-800">В реестре Приморья</span>
            <span className="text-xl font-bold font-mono text-red-700 tabular-nums">≈ 120 чел.</span>
          </div>
          <div className="bg-teal-50/70 border border-teal-200 rounded-lg p-4 flex items-center justify-between">
            <span className="text-xs text-teal-800">Расчётная потребность</span>
            <span className="text-xl font-bold font-mono text-teal-800 tabular-nums">1,2–2,4 тыс.</span>
          </div>
        </div>
      );

    case 'effects-table':
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 h-full flex flex-col justify-center">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-300 text-slate-500">
                <th className="py-2 pr-2">Эффект</th>
                <th className="py-2 px-2">Индикатор</th>
                <th className="py-2 pl-2 text-right">Срок</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
              <tr>
                <td className="py-2 pr-2">Прирост легальных кадров</td>
                <td className="py-2 px-2 font-mono">+N в реестре</td>
                <td className="py-2 pl-2 text-right font-mono">12–18 мес.</td>
              </tr>
              <tr>
                <td className="py-2 pr-2">Выход из «серой» зоны</td>
                <td className="py-2 px-2 font-mono">% аттестованных</td>
                <td className="py-2 pl-2 text-right font-mono">2 года</td>
              </tr>
              <tr>
                <td className="py-2 pr-2">Загрузка вне пика</td>
                <td className="py-2 px-2">Межсезонные туры</td>
                <td className="py-2 pl-2 text-right font-mono">2–3 года</td>
              </tr>
              <tr>
                <td className="py-2 pr-2">Снижение страховых издержек</td>
                <td className="py-2 px-2">Допуск на ООПТ</td>
                <td className="py-2 pl-2 text-right font-mono">3 года</td>
              </tr>
            </tbody>
          </table>
        </div>
      );

    case 'agency-matrix':
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5 h-full flex flex-col justify-center text-xs">
          {[
            { org: 'Минтуризма', task: 'Субсидии до 70% для бизнеса на ДПО' },
            { org: 'Минэкономразвития', task: 'Актуальный срез реестра + статус ДФО' },
            { org: 'Туроператоры', task: 'Опросы дефицита + целевые профили' },
            { org: 'ВВГУ и РЦА', task: 'Двухконтурная модель + водные модули' },
          ].map((row) => (
            <div key={row.org} className="bg-white border border-slate-200 rounded-md p-2.5 flex justify-between gap-3">
              <span className="font-bold text-teal-800 shrink-0">{row.org}</span>
              <span className="text-slate-700 text-right">{row.task}</span>
            </div>
          ))}
        </div>
      );

    default:
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col justify-between h-full">
          <p className="text-xs font-mono font-semibold text-teal-700">
            Слайд {String(slide.number).padStart(2, '0')} · Опорная схема
          </p>
          <div className="space-y-2.5 my-3">
            {slide.bullets.slice(0, 3).map((b, idx) => (
              <div key={b} className="bg-white border border-slate-200 rounded-md p-3 flex gap-2.5 items-start">
                <span className="font-mono text-[11px] font-bold text-slate-400 tabular-nums pt-0.5">
                  0{idx + 1}
                </span>
                <p className="text-xs text-slate-700 leading-snug">{b}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">РЦА «Русский Восток» · ВВГУ</p>
        </div>
      );
  }
};

export const PresentationsSection: React.FC = () => {
  const [deckMode, setDeckMode] = useState<'academic' | 'management' | 'handout'>('academic');
  const [slideIndex, setSlideIndex] = useState<number>(0);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [showNotes, setShowNotes] = useState<boolean>(true);

  // Rehearsal timer in seconds
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const activeSlides = deckMode === 'management' ? MANAGEMENT_SLIDES : ACADEMIC_SLIDES;
  const totalSlides = activeSlides.length;
  const currentSlide = activeSlides[Math.min(slideIndex, totalSlides - 1)];
  const targetMinutes = deckMode === 'management' ? 12 : 18;

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (deckMode === 'handout') return;
      if (e.key === 'ArrowRight') {
        setSlideIndex((prev) => Math.min(prev + 1, totalSlides - 1));
      } else if (e.key === 'ArrowLeft') {
        setSlideIndex((prev) => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deckMode, totalSlides]);

  const switchDeck = (mode: 'academic' | 'management' | 'handout') => {
    setDeckMode(mode);
    setSlideIndex(0);
    setShowGrid(false);
    setTimerRunning(false);
    setElapsedSeconds(0);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8">
      {/* Control Toolbar */}
      <section className="no-print bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => switchDeck('academic')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              deckMode === 'academic'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Академическая защита (18 слайдов · 18 мин)
          </button>
          <button
            type="button"
            onClick={() => switchDeck('management')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              deckMode === 'management'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Управленческий доклад (10 слайдов · 12 мин)
          </button>
          <button
            type="button"
            onClick={() => switchDeck('handout')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              deckMode === 'handout'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Раздаточный лист и правила ВАК
          </button>
        </div>

        {deckMode !== 'handout' ? (
          <div className="flex flex-wrap items-center gap-3">
            {/* Rehearsal Timer */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono tabular-nums">
              <Clock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <span className={elapsedSeconds > targetMinutes * 60 ? 'text-red-700 font-bold' : 'text-slate-900 font-semibold'}>
                {formatTime(elapsedSeconds)}
              </span>
              <span className="text-slate-400">/ {targetMinutes}:00</span>
              <button
                type="button"
                onClick={() => setTimerRunning((r) => !r)}
                aria-label={timerRunning ? 'Пауза таймера' : 'Запустить таймер'}
                className="p-1 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
              >
                {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimerRunning(false);
                  setElapsedSeconds(0);
                }}
                aria-label="Сбросить таймер"
                className="p-1 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowGrid((g) => !g)}
              className={`px-3 py-2 text-xs font-medium rounded-lg border inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showGrid
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Grid className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Все слайды</span>
            </button>

            <button
              type="button"
              onClick={() => setShowNotes((n) => !n)}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {showNotes ? 'Скрыть тезисы доклада' : 'Показать тезисы доклада'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Печать / PDF раздатки</span>
          </button>
        )}
      </section>

      {deckMode === 'handout' ? (
        /* One-Page Printable Handout + VAK Rules */
        <div className="space-y-8">
          <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
            <div className="border-b border-slate-200 pb-4 flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-teal-700">Одностраничное резюме для ведомств и совета</p>
                <h1 className="mt-1 text-2xl font-bold text-slate-900">
                  Кадровое обеспечение активного туризма Приморья: разрыв и 4 решения
                </h1>
              </div>
              <span className="text-xs text-slate-500">РЦА «Русский Восток» · ВВГУ · Ноябрь 2026</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {EMPIRICAL_TABLE.slice(0, 4).map((m) => (
                <div key={m.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p className="text-[11px] text-slate-500 leading-snug">{m.indicator}</p>
                  <p className="mt-1.5 text-lg font-bold font-mono text-slate-900 tabular-nums">{m.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Четыре ключевых предложения
                </h2>
                <ul className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
                  <li>
                    <span className="font-semibold text-slate-900">1. Двухконтурная подготовка ВВГУ:</span>{' '}
                    модульное переобучение действующих гидов (с зачётом опыта) + базовый поток 250 ч.
                  </li>
                  <li>
                    <span className="font-semibold text-slate-900">2. Встроенная аттестация:</span>{' '}
                    синхронизация ДПО с экзаменом в РЦА без повторного обучения.
                  </li>
                  <li>
                    <span className="font-semibold text-slate-900">3. Договорные профили с бизнесом:</span>{' '}
                    целевой набор под глэмпинги, экотропы и водные маршруты (10 мест · 27 200 ₽/год).
                  </li>
                  <li>
                    <span className="font-semibold text-slate-900">4. Мониторинг дефицита и субсидии:</span>{' '}
                    опрос 10–15 туроператоров + компенсация до 70% затрат через региональные меры поддержки.
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Ожидаемые эффекты (1–3 года)
                </h2>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-1.5">Эффект</th>
                      <th className="py-1.5">Индикатор</th>
                      <th className="py-1.5 text-right">Горизонт</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    <tr>
                      <td className="py-2">Прирост легальных проводников</td>
                      <td className="py-2 font-mono">+N чел. в реестре</td>
                      <td className="py-2 text-right font-mono">12–18 мес.</td>
                    </tr>
                    <tr>
                      <td className="py-2">Сокращение «серого» сегмента</td>
                      <td className="py-2 font-mono">% аттестованных</td>
                      <td className="py-2 text-right font-mono">2 года</td>
                    </tr>
                    <tr>
                      <td className="py-2">Рост занятости в межсезонье</td>
                      <td className="py-2">Межсезонные программы</td>
                      <td className="py-2 text-right font-mono">2–3 года</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="no-print grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Единые правила оформления</h3>
              <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
                {PRESENTATION_GUIDELINES.formattingRules.map((rule) => (
                  <li key={rule}>· {rule}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Рекомендации к защите ВАК</h3>
              <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
                {PRESENTATION_GUIDELINES.academicTips.map((tip) => (
                  <li key={tip}>· {tip}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Рекомендации для Минтуризма</h3>
              <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
                {PRESENTATION_GUIDELINES.managementTips.map((tip) => (
                  <li key={tip}>· {tip}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      ) : showGrid ? (
        /* Slide Grid Overview */
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeSlides.map((s, idx) => {
            const isCurrent = idx === slideIndex;
            return (
              <button
                key={s.number}
                type="button"
                onClick={() => {
                  setSlideIndex(idx);
                  setShowGrid(false);
                }}
                className={`text-left p-5 rounded-xl border transition-colors cursor-pointer ${
                  isCurrent
                    ? 'bg-teal-50/70 border-teal-700'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-2">
                  <span>Слайд {String(s.number).padStart(2, '0')}</span>
                  <span>{idx + 1} / {totalSlides}</span>
                </div>
                <p className="text-sm font-bold text-slate-900 leading-snug">{s.title}</p>
                <p className="mt-2 text-xs text-slate-500 line-clamp-2">{s.kicker}</p>
              </button>
            );
          })}
        </section>
      ) : (
        /* Active Slide Canvas */
        <div className="space-y-6">
          <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
            {/* Slide Header Bar */}
            <div className="px-8 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/60">
              <span className="text-xs font-medium text-slate-500 truncate">
                {currentSlide.kicker}
              </span>
              <span className="text-xs font-mono font-semibold text-slate-700 tabular-nums shrink-0">
                Слайд {String(currentSlide.number).padStart(2, '0')} / {totalSlides}
              </span>
            </div>

            {/* Slide Body (16:9 feel, light high-contrast readable design) */}
            <div className="p-8 sm:p-10 min-h-[380px] grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-7 flex flex-col justify-between gap-6">
                <div className="space-y-5">
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight text-balance">
                    {currentSlide.title}
                  </h2>

                  <ul className="space-y-3 text-sm sm:text-base text-slate-700">
                    {currentSlide.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-3 leading-relaxed">
                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-teal-700 shrink-0" aria-hidden="true" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {(currentSlide.sources || currentSlide.keyTakeaway) && (
                  <p className="text-xs text-slate-500 pt-4 border-t border-slate-200">
                    {currentSlide.sources ? `Источники: ${currentSlide.sources}` : currentSlide.keyTakeaway}
                  </p>
                )}
              </div>

              <div className="lg:col-span-5">
                <SlideVisualRenderer
                  slide={currentSlide}
                  deckType={deckMode === 'management' ? 'management' : 'academic'}
                />
              </div>
            </div>

            {/* Slide Navigation Footer */}
            <div className="no-print px-8 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
              <button
                type="button"
                disabled={slideIndex === 0}
                onClick={() => setSlideIndex((i) => Math.max(i - 1, 0))}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                <span>Назад</span>
              </button>

              {/* Progress Track */}
              <div className="hidden sm:flex items-center gap-1.5 flex-1 max-w-md mx-4">
                {activeSlides.map((s, idx) => (
                  <button
                    key={s.number}
                    type="button"
                    aria-label={`Перейти к слайду ${s.number}`}
                    onClick={() => setSlideIndex(idx)}
                    className={`h-1.5 flex-1 rounded-full transition-colors cursor-pointer ${
                      idx === slideIndex ? 'bg-teal-700' : idx < slideIndex ? 'bg-teal-300' : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                disabled={slideIndex === totalSlides - 1}
                onClick={() => setSlideIndex((i) => Math.min(i + 1, totalSlides - 1))}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Далее</span>
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {showNotes && (
            <div className="no-print bg-white border border-slate-200 rounded-xl p-6 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Тезис докладчика к слайду {currentSlide.number}</span>
                <span>Навигация: клавиши ← и →</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{currentSlide.speakerNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
