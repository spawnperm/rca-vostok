import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileWarning,
  MapPin,
  MessageSquare,
} from 'lucide-react';
import { tracker } from '../utils/tracker';

type TimelineRegionFilter =
  | 'all'
  | 'primorye'
  | 'khabarovsk'
  | 'kamchatka'
  | 'sakhalin'
  | 'yakutia-amur'
  | 'magadan-chukotka';

type TimelineEventKindFilter = 'all' | 'session' | 'deadline';

export interface RegionalTimelineItem {
  id: string;
  regionId: Exclude<TimelineRegionFilter, 'all'> | 'federal';
  regionLabel: string;
  inquiryRegionValue: string;
  inquiryTrackValue: string;
  kind: 'session' | 'deadline';
  kindLabel: string;
  shortDate: string;
  isoTargetDate: string;
  title: string;
  shortTitle: string;
  submissionDeadline: string;
  isoSubmissionDeadline?: string;
  venue: string;
  tracks: string;
  quotaOrRule: string;
  summary: string;
  checklist: string[];
}

export const REGIONAL_SESSIONS_TIMELINE: RegionalTimelineItem[] = [
  {
    id: 'tl-federal-1893',
    regionId: 'federal',
    regionLabel: 'Весь ДФО (ПП № 1893)',
    inquiryRegionValue: 'Приморский край',
    inquiryTrackValue: 'Переаттестация действующего гида',
    kind: 'deadline',
    kindLabel: 'Федеральный дедлайн',
    shortDate: '01 окт 2026',
    isoTargetDate: '2026-10-01',
    title: 'Дедлайн обязательной аттестации по Постановлению № 1893',
    shortTitle: 'Закон № 1893',
    submissionDeadline: 'Действует постоянно (срок удостоверения — 5 лет)',
    venue: 'Единый федеральный реестр Минэкономразвития РФ',
    tracks: 'Все виды активных маршрутов (1–4 КС и спецсопровождение)',
    quotaOrRule: 'Обязательное требование допуска на маршруты и ООПТ ДФО',
    summary:
      'Переходный период завершён: работа гидом-проводником на маршрутах повышенного риска и в нацпарках Дальнего Востока допускается только при наличии действующей записи в федеральном реестре.',
    checklist: [
      'Проверка текущей записи и срока действия бейджа в реестре',
      'Для действующих гидов открыт ускоренный зачёт опыта (Контур А)',
      'Приёмом межрегиональных потоков ДФО занимается РЦА «Русский Восток»',
    ],
  },
  {
    id: 'tl-primorye-dec-deadline',
    regionId: 'primorye',
    regionLabel: 'Приморский край',
    inquiryRegionValue: 'Приморский край',
    inquiryTrackValue: 'Водный туризм и сплавы',
    kind: 'deadline',
    kindLabel: 'Дедлайн подачи документов',
    shortDate: '07 дек 2026',
    isoTargetDate: '2026-12-07',
    title: 'Окончание приёма комплектов на зимнюю сессию (Приморье)',
    shortTitle: 'Дедлайн · Дек',
    submissionDeadline: 'До 07 декабря 2026 (включительно до 18:00 ВЛД)',
    isoSubmissionDeadline: '2026-12-07',
    venue: 'Приёмная комиссия РЦА «Русский Восток» (ВВГУ, ул. Гоголя, 41)',
    tracks: 'Водный туризм и сплавы, зачёт стажа по Контуру А',
    quotaOrRule: '10 договорных мест потока · компенсация до 70% для юрлиц ПК',
    summary:
      'Крайний срок подачи медицинских справок, паспорта маршрута (ПП № 760) и справок о походном опыте для участия в декабрьском теоретическом экзамене на базе ВВГУ.',
    checklist: [
      'Скан паспорта и СНИЛС + согласие на внесение в реестр',
      'Медицинская справка о допуске к физическим нагрузкам на маршруте',
      'Подтверждение сплавного опыта или договор на модуль ДПО (27 200 ₽)',
    ],
  },
  {
    id: 'tl-primorye-dec-session',
    regionId: 'primorye',
    regionLabel: 'Приморский край',
    inquiryRegionValue: 'Приморский край',
    inquiryTrackValue: 'Водный туризм и сплавы',
    kind: 'session',
    kindLabel: 'Экзаменационная сессия',
    shortDate: '14–19 дек 2026',
    isoTargetDate: '2026-12-14',
    title: 'Зимняя сессия РЦА: водный туризм и теоретический блок ВВГУ',
    shortTitle: 'Приморье · Вода',
    submissionDeadline: 'Приём документов закрывается 07 декабря 2026',
    isoSubmissionDeadline: '2026-12-07',
    venue: 'г. Владивосток (аудитории ВВГУ) + бассейн / тренажёрные спасработы',
    tracks: 'Водный туризм и сплавы (1–3 КС), защита паспорта маршрута',
    quotaOrRule: 'Ускоренное внесение в реестр до старта весеннего паводка',
    summary:
      'Очная аттестационная сессия для водных инструкторов-проводников Приморья и соседних субъектов: тестирование, гидрология горных рек, защита паспортов и практический зачёт.',
    checklist: [
      'Теоретическое тестирование по нормативам ФСТР и ПП № 1003',
      'Защита паспорта водного маршрута перед комиссией ВВГУ',
      'Выпуск удостоверения и занесение в реестр в течение 10 рабочих дней',
    ],
  },
  {
    id: 'tl-khabarovsk-feb-session',
    regionId: 'khabarovsk',
    regionLabel: 'Хабаровский край',
    inquiryRegionValue: 'Хабаровский край',
    inquiryTrackValue: 'Пешеходный туризм',
    kind: 'session',
    kindLabel: 'Межрегиональная сессия',
    shortDate: '25–27 фев 2027',
    isoTargetDate: '2027-02-25',
    title: 'Межрегиональный поток для гидов Хабаровского края (Контур А)',
    shortTitle: 'Хабаровск',
    submissionDeadline: 'Приём документов и сверка опыта до 18 февраля 2027',
    isoSubmissionDeadline: '2027-02-18',
    venue: 'Дистанционная подача в Хабаровске + очная сдача в ВВГУ (Владивосток)',
    tracks: 'Пешеходный туризм, горно-таёжные сплавы (Хор, Анюй, Дуссе-Алинь)',
    quotaOrRule: 'Квота выездного потока: до 18 кандидатов (33 в реестре края)',
    summary:
      'Специальная зимне-весенняя сессия для закрытия отложенного спроса Хабаровского края с предварительной дистанционной верификацией справок МКК и договоров с туроператорами.',
    checklist: [
      'Предварительная сверка походного стажа за 14 дней до заезда',
      'Единая сдача теории и защиты паспорта маршрута за 3 дня',
      'Снижение командировочных издержек за счёт совмещения теории и практики',
    ],
  },
  {
    id: 'tl-kamchatka-mar-session',
    regionId: 'kamchatka',
    regionLabel: 'Камчатский край',
    inquiryRegionValue: 'Камчатский край',
    inquiryTrackValue: 'Переаттестация действующего гида',
    kind: 'session',
    kindLabel: 'Сессия переаттестации',
    shortDate: '12–14 мар 2027',
    isoTargetDate: '2027-03-12',
    title: 'Переаттестация камчатских гидов по правилам ПП № 1893',
    shortTitle: 'Камчатка',
    submissionDeadline: 'Подача портфолио и справок до 04 марта 2027',
    isoSubmissionDeadline: '2027-03-04',
    venue: 'Координация в Петропавловске-Камчатском · Комиссия ВВГУ и ФСТР',
    tracks: 'Вулканические треки, горный и экспедиционный туризм (малые группы)',
    quotaOrRule: 'Приоритет для действующих гидов из 343 записей реестра края',
    summary:
      'Организованный поток для инструкторов Камчатского края, подтверждающих квалификацию по новым нормам ПП № 1893 до открытия высокого весенне-летнего сезона.',
    checklist: [
      'Подтверждение навыков Wilderness First Aid и работы со спутниковой связью',
      'Зачёт подтверждённых восхождений и туров через Контур А',
      'Синхронизация со стандартами безопасности в ареале бурого медведя',
    ],
  },
  {
    id: 'tl-primorye-sakhalin-apr-session',
    regionId: 'sakhalin',
    regionLabel: 'Приморье и Сахалин',
    inquiryRegionValue: 'Сахалинская область',
    inquiryTrackValue: 'Пешеходный туризм',
    kind: 'session',
    kindLabel: 'Весенняя полевая сессия',
    shortDate: '16–18 апр 2027',
    isoTargetDate: '2027-04-16',
    title: 'Весенняя полевая сессия: Приморский край, Сахалин и Курилы (1–4 КС)',
    shortTitle: 'Сахалин / ПК',
    submissionDeadline: 'Дедлайн приёма комплектов документов: 09 апреля 2027',
    isoSubmissionDeadline: '2027-04-09',
    venue: 'г. Владивосток (ВВГУ) + Шкотовский полигон (хр. Ливадийский, р. Шкотовка)',
    tracks: 'Пешеходный, горный, комбинированный (прибрежный и морской каякинг)',
    quotaOrRule: 'Крупнейший весенний поток перед открытием экотроп ООПТ ДФО',
    summary:
      'Полноформатные полевые испытания на открытом рельефе для соискателей из Приморья и Сахалинской области (включая Курильский кластер): переправы, ориентирование и ПСР.',
    checklist: [
      'Обязательное наличие сертифицированного личного снаряжения и каски/обвязки',
      'Тест-маршрут по курумнику и организация навесной переправы',
      'Практикум по управлению группой 8–12 человек в прибрежной и горной зоне',
    ],
  },
  {
    id: 'tl-yakutia-amur-may-session',
    regionId: 'yakutia-amur',
    regionLabel: 'Якутия и Амурская обл.',
    inquiryRegionValue: 'Другой регион ДФО',
    inquiryTrackValue: 'Водный туризм и сплавы',
    kind: 'session',
    kindLabel: 'Майская сессия ДФО',
    shortDate: '14–16 май 2027',
    isoTargetDate: '2027-05-14',
    title: 'Предсезонный поток для Якутии и Амурской области (сплавы и автотуры)',
    shortTitle: 'Якутия / Амур',
    submissionDeadline: 'Дедлайн регистрации кандидатов: 06 мая 2027',
    isoSubmissionDeadline: '2027-05-06',
    venue: 'Дистанционная теория ВВГУ + выездная комиссия РЦА «Русский Восток»',
    tracks: 'Сплавы (Зея, Бурея, Лена), Ленские столбы, автомаршруты ДФО',
    quotaOrRule: 'Закрытие кадрового дефицита северных и речных маршрутов (18 + 12 в реестре)',
    summary:
      'Межрегиональная аттестация перед открытием навигации на Амуре и Лене, включая методические модули по автономному жизнеобеспечению и проектируемый трек автотуризма.',
    checklist: [
      'Сверка маршрутной книжки или коммерческих треков сплавов',
      'Экзамен по спасработам на течении и эвакуации с удалённых участков',
      'Получение бейджа реестра к началу июньских водных туров',
    ],
  },
  {
    id: 'tl-oopt-june-deadline',
    regionId: 'primorye',
    regionLabel: 'ООПТ и субсидии ДФО',
    inquiryRegionValue: 'Приморский край',
    inquiryTrackValue: 'Пешеходный туризм',
    kind: 'deadline',
    kindLabel: 'Сезонный дедлайн',
    shortDate: '01 июн 2027',
    isoTargetDate: '2027-06-01',
    title: 'Дедлайн допуска гидов на высокий летний сезон ООПТ и субсидирования',
    shortTitle: 'Дедлайн · Июнь',
    submissionDeadline: 'Подача на майскую пересдачу и реестр — до 20 мая 2027',
    isoSubmissionDeadline: '2027-05-20',
    venue: 'ООПТ ДФО («Земля леопарда», «Бикин», Лазовский заповедник) и туроператоры',
    tracks: 'Все организованные летние маршруты и договоры с глэмпингами',
    quotaOrRule: 'Контрольная точка Минтуризма по договорам сопровождения групп',
    summary:
      'К дате начала массового летнего сезона туроператоры, нацпарки и базы отдыха Приморья и ДФО должны иметь подтверждённые бейджи у всех задействованных инструкторов-проводников.',
    checklist: [
      'Убедитесь, что данные из РЦА переданы и опубликованы в федеральном реестре',
      'Подготовьте пакет на региональную субсидию компенсации обучения (до 70%)',
      'Спланируйте дублёров в штате с учётом пиковой нагрузки июля–сентября',
    ],
  },
  {
    id: 'tl-magadan-jun-session',
    regionId: 'magadan-chukotka',
    regionLabel: 'Магадан и Чукотка',
    inquiryRegionValue: 'Другой регион ДФО',
    inquiryTrackValue: 'Пешеходный туризм',
    kind: 'session',
    kindLabel: 'Предэкспедиционная сессия',
    shortDate: '04–06 июн 2027',
    isoTargetDate: '2027-06-04',
    title: 'Арктическая и экспедиционная сессия: Магаданская область и Чукотка',
    shortTitle: 'Магадан / ЧАО',
    submissionDeadline: 'Дедлайн подачи документов и маршрутов: 27 мая 2027',
    isoSubmissionDeadline: '2027-05-27',
    venue: 'Межрегиональная комиссия ВВГУ и ФСТР (очно-дистанционный формат)',
    tracks: 'Автономные экспедиции малых групп (4–6 чел., озеро Джека Лондона, хр. Черского)',
    quotaOrRule: 'Целевой поток для удалённых регионов (6 специалистов в реестре)',
    summary:
      'Завершающий предэкспедиционный блок перед коротким северным летним окном: оценка готовности гидов-лидеров к длительной автономии, ПСР и экстренной эвакуации.',
    checklist: [
      'Проверка регистрации маршрута в МЧС и полисов эвакуации',
      'Демонстрация протокола спутникового трекинга Garmin inReach',
      'Зачёт по расширенной первой помощи при переохлаждении и травмах',
    ],
  },
];

const REGION_FILTERS: { id: TimelineRegionFilter; label: string }[] = [
  { id: 'all', label: 'Весь ДФО' },
  { id: 'primorye', label: 'Приморье' },
  { id: 'khabarovsk', label: 'Хабаровский кр.' },
  { id: 'kamchatka', label: 'Камчатка' },
  { id: 'sakhalin', label: 'Сахалин' },
  { id: 'yakutia-amur', label: 'Якутия / Амур' },
  { id: 'magadan-chukotka', label: 'Магадан / ЧАО' },
];

// Reference calendar date used for relative status badges
const TODAY_ISO = '2026-11-22';

function getRelativeDayStatus(isoDate: string): { label: string; tone: 'past' | 'urgent' | 'upcoming' } {
  const target = new Date(`${isoDate}T00:00:00Z`).getTime();
  const today = new Date(`${TODAY_ISO}T00:00:00Z`).getTime();
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: 'Вступил в силу', tone: 'past' };
  }
  if (diffDays === 0) {
    return { label: 'Сегодня', tone: 'urgent' };
  }
  if (diffDays <= 30) {
    return { label: `Через ${diffDays} дн.`, tone: 'urgent' };
  }
  const months = Math.round(diffDays / 30);
  return { label: `Через ~${months} мес. (${diffDays} дн.)`, tone: 'upcoming' };
}

interface RegionalSessionsTimelineProps {
  onApplyForSession?: (region: string, track: string) => void;
  onContactCurator: (sourceLabel: string) => void;
}

export const RegionalSessionsTimeline: React.FC<RegionalSessionsTimelineProps> = ({
  onApplyForSession,
  onContactCurator,
}) => {
  const [regionFilter, setRegionFilter] = useState<TimelineRegionFilter>('all');
  const [kindFilter, setKindFilter] = useState<TimelineEventKindFilter>('all');
  const [selectedId, setSelectedId] = useState<string>('tl-primorye-dec-deadline');

  const filteredItems = useMemo(() => {
    return REGIONAL_SESSIONS_TIMELINE.filter((item) => {
      if (kindFilter !== 'all' && item.kind !== kindFilter) return false;
      if (regionFilter === 'all') return true;
      if (item.regionId === 'federal') return true;
      // Primorye spring session also accepts Sakhalin & coastal Primorye candidates
      if (regionFilter === 'primorye' && item.id === 'tl-primorye-sakhalin-apr-session') {
        return true;
      }
      return item.regionId === regionFilter;
    });
  }, [regionFilter, kindFilter]);

  const activeIndex = useMemo(() => {
    const idx = filteredItems.findIndex((i) => i.id === selectedId);
    return idx >= 0 ? idx : 0;
  }, [filteredItems, selectedId]);

  const activeItem = filteredItems[activeIndex] ?? REGIONAL_SESSIONS_TIMELINE[0];
  const relativeStatus = getRelativeDayStatus(activeItem.isoTargetDate);

  const handleSelectItem = (item: RegionalTimelineItem) => {
    setSelectedId(item.id);
    tracker.trackCustomInteraction(
      `Шкала сессий ДФО: ${item.shortDate} (${item.regionLabel})`,
      item.kindLabel
    );
  };

  const handleStep = (delta: number) => {
    if (filteredItems.length === 0) return;
    const nextIdx = Math.max(0, Math.min(activeIndex + delta, filteredItems.length - 1));
    handleSelectItem(filteredItems[nextIdx]);
  };

  const railProgressPct =
    filteredItems.length > 1 ? activeIndex / (filteredItems.length - 1) : 1;

  return (
    <section
      aria-labelledby="regional-sessions-timeline-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header & Prev/Next Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <p className="text-xs font-medium text-teal-700">
            Календарный график РЦА «Русский Восток» · 2026–2027
          </p>
          <h2
            id="regional-sessions-timeline-heading"
            className="text-xl font-bold text-slate-900"
          >
            Временная шкала аттестационных сессий и дедлайнов по регионам ДФО
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Запланированные очные и межрегиональные экзаменационные потоки, крайние сроки подачи
            документов и контрольные нормативные даты для субъектов Дальнего Востока.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono text-slate-500 tabular-nums mr-1">
            {String(activeIndex + 1).padStart(2, '0')} /{' '}
            {String(filteredItems.length).padStart(2, '0')}
          </span>
          <button
            type="button"
            disabled={activeIndex === 0}
            onClick={() => handleStep(-1)}
            aria-label="Предыдущая дата на шкале"
            className="p-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={activeIndex >= filteredItems.length - 1}
            onClick={() => handleStep(1)}
            aria-label="Следующая дата на шкале"
            className="p-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div
          role="group"
          aria-label="Фильтр по регионам ДФО"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {REGION_FILTERS.map((reg) => {
            const isSelected = regionFilter === reg.id;
            return (
              <button
                key={reg.id}
                type="button"
                onClick={() => {
                  setRegionFilter(reg.id);
                  tracker.trackCustomInteraction(`Шкала ДФО: регион ${reg.label}`);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {reg.label}
              </button>
            );
          })}
        </div>

        <div
          role="group"
          aria-label="Фильтр по типу события"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {(
            [
              { id: 'all', label: 'Все события' },
              { id: 'session', label: 'Экзаменационные сессии' },
              { id: 'deadline', label: 'Дедлайны и сроки' },
            ] as const
          ).map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKindFilter(k.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                kindFilter === k.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Horizontal Timeline Axis */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 pb-4 mb-2 border-b border-slate-200">
          <span>Нажмите на дату на шкале, чтобы открыть дедлайн подачи и состав этапа</span>
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-700" aria-hidden="true" />
              Сессия аттестации
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm rotate-45 bg-amber-600" aria-hidden="true" />
              Дедлайн подачи / закона
            </span>
          </div>
        </div>

        <div className="overflow-x-auto pb-2 -mx-1 px-1">
          <div
            style={{ minWidth: `${Math.max(filteredItems.length * 124, 620)}px` }}
            className="relative pt-3"
          >
            {/* Axis Track */}
            <div
              aria-hidden="true"
              className="absolute left-[6%] right-[6%] top-[30px] h-0.5 bg-slate-200"
            >
              <div
                className="h-full w-full bg-teal-700 origin-left transition-transform duration-200"
                style={{ transform: `scaleX(${railProgressPct})` }}
              />
            </div>

            <ol
              style={{
                gridTemplateColumns: `repeat(${Math.max(filteredItems.length, 1)}, minmax(0, 1fr))`,
              }}
              className="grid gap-2 relative"
            >
              {filteredItems.map((item, idx) => {
                const isSelected = item.id === activeItem.id;
                const isDeadline = item.kind === 'deadline';
                const status = getRelativeDayStatus(item.isoTargetDate);

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      aria-current={isSelected ? 'step' : undefined}
                      className="w-full text-center flex flex-col items-center gap-2 px-1.5 py-1 rounded-lg group cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                    >
                      <span
                        className={`w-9 h-9 flex items-center justify-center text-[11px] font-mono font-bold tabular-nums border-2 transition-all ${
                          isDeadline ? 'rounded-lg' : 'rounded-full'
                        } ${
                          isSelected
                            ? isDeadline
                              ? 'bg-amber-600 border-amber-600 text-white scale-105'
                              : 'bg-teal-700 border-teal-700 text-white scale-105'
                            : status.tone === 'past'
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : isDeadline
                            ? 'bg-white border-amber-500 text-amber-800 group-hover:bg-amber-50'
                            : 'bg-white border-slate-300 text-slate-700 group-hover:border-teal-700 group-hover:text-teal-800'
                        }`}
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      <div className="space-y-0.5">
                        <p
                          className={`text-xs font-mono font-semibold tabular-nums whitespace-nowrap ${
                            isSelected
                              ? isDeadline
                                ? 'text-amber-800'
                                : 'text-teal-800'
                              : 'text-slate-900'
                          }`}
                        >
                          {item.shortDate}
                        </p>
                        <p className="text-[11px] text-slate-600 font-medium leading-tight">
                          {item.shortTitle}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>

      {/* Bottom Split: Selected Milestone Inspector (7 cols) + Synchronized Quick Index (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 font-semibold ${
                    activeItem.kind === 'deadline' ? 'text-amber-800' : 'text-teal-800'
                  }`}
                >
                  {activeItem.kind === 'deadline' ? (
                    <FileWarning className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <CalendarDays className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>{activeItem.kindLabel}</span>
                </span>
                <span className="text-slate-400" aria-hidden="true">
                  ·
                </span>
                <span className="font-medium text-slate-700 inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  {activeItem.regionLabel}
                </span>
              </div>

              <span
                className={`font-mono text-[11px] font-semibold tabular-nums px-2.5 py-0.5 rounded-md border ${
                  relativeStatus.tone === 'past'
                    ? 'bg-slate-200/80 border-slate-300 text-slate-800'
                    : relativeStatus.tone === 'urgent'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-teal-50 border-teal-200 text-teal-800'
                }`}
              >
                {relativeStatus.label}
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-mono font-bold text-slate-900 tabular-nums">
                {activeItem.shortDate}
              </p>
              <h3 className="text-lg font-bold text-slate-900 leading-snug">
                {activeItem.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {activeItem.summary}
              </p>
            </div>

            <dl className="divide-y divide-slate-200 border-y border-slate-200 text-xs">
              <div className="py-2.5 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3">
                <dt className="text-slate-500 font-medium inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
                  <span>Дедлайн подачи</span>
                </dt>
                <dd className="sm:col-span-2 font-mono font-semibold text-slate-900">
                  {activeItem.submissionDeadline}
                </dd>
              </div>
              <div className="py-2.5 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3">
                <dt className="text-slate-500 font-medium">Площадка и формат</dt>
                <dd className="sm:col-span-2 text-slate-800">{activeItem.venue}</dd>
              </div>
              <div className="py-2.5 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3">
                <dt className="text-slate-500 font-medium">Направления и КС</dt>
                <dd className="sm:col-span-2 text-slate-800">{activeItem.tracks}</dd>
              </div>
              <div className="py-2.5 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3">
                <dt className="text-slate-500 font-medium">Квота / условие</dt>
                <dd className="sm:col-span-2 font-medium text-teal-800">
                  {activeItem.quotaOrRule}
                </dd>
              </div>
            </dl>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Что подготовить к этой дате
              </p>
              <ul className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
                {activeItem.checklist.map((step, idx) => (
                  <li key={step} className="flex items-start gap-2">
                    <span className="font-mono font-semibold text-teal-700 tabular-nums shrink-0">
                      0{idx + 1}.
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                onContactCurator(
                  `Временная шкала (${activeItem.shortDate} · ${activeItem.regionLabel})`
                )
              }
              className="px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>Уточнить график у куратора</span>
            </button>

            {onApplyForSession && (
              <button
                type="button"
                onClick={() => {
                  onApplyForSession(
                    activeItem.inquiryRegionValue,
                    activeItem.inquiryTrackValue
                  );
                  tracker.trackCustomInteraction(
                    `Запись с временной шкалы: ${activeItem.shortDate}`,
                    activeItem.regionLabel
                  );
                }}
                className="px-4 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Записаться на этот поток</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Synchronized Chronological Schedule List (5 cols) */}
        <div className="lg:col-span-5 border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>Хронология по выбранному фильтру</span>
            </span>
            <span className="font-mono text-slate-500 tabular-nums">
              {filteredItems.length} событий
            </span>
          </div>

          <div className="divide-y divide-slate-200 flex-1 overflow-y-auto max-h-[460px]">
            {filteredItems.map((item) => {
              const isSelected = item.id === activeItem.id;
              const isDeadline = item.kind === 'deadline';
              const status = getRelativeDayStatus(item.isoTargetDate);

              return (
                <button
                  key={`list-${item.id}`}
                  type="button"
                  onClick={() => handleSelectItem(item)}
                  className={`w-full px-4 py-3 text-left transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                    isSelected ? 'bg-teal-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span
                        className={`font-mono font-bold tabular-nums ${
                          isDeadline ? 'text-amber-800' : 'text-teal-800'
                        }`}
                      >
                        {item.shortDate}
                      </span>
                      <span className="text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-600 font-medium truncate">
                        {item.regionLabel}
                      </span>
                    </div>
                    <p
                      className={`text-xs leading-snug ${
                        isSelected ? 'font-semibold text-slate-950' : 'font-medium text-slate-800'
                      }`}
                    >
                      {item.title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {item.submissionDeadline}
                    </p>
                  </div>

                  <span
                    className={`text-[10px] font-mono tabular-nums shrink-0 mt-0.5 ${
                      status.tone === 'past'
                        ? 'text-slate-500'
                        : status.tone === 'urgent'
                        ? 'text-amber-800 font-semibold'
                        : 'text-teal-800'
                    }`}
                  >
                    {status.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
