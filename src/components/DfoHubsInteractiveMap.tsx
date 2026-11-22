import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Compass, MapPin, ShieldCheck } from 'lucide-react';
import { DFO_REGIONS_DISTRIBUTION } from '../data/researchData';
import { tracker } from '../utils/tracker';
import type { DfoRegionFilterId } from './DfoDemandForecastChart';

type NodeKindFilter = 'all' | 'office' | 'hub';

interface DfoCooperationNode {
  id: string;
  name: string;
  shortName: string;
  kind: 'office' | 'hub';
  kindLabel: string;
  regionId: Exclude<DfoRegionFilterId, 'all'>;
  regionName: string;
  city: string;
  x: number;
  y: number;
  labelDx?: number;
  labelDy?: number;
  labelAnchor?: 'start' | 'middle' | 'end';
  cooperationFormat: string;
  keyMetricLabel: string;
  keyMetricValue: string;
  programsAndRoutes: string[];
  description: string;
}

const HQ_COORDS = { x: 338, y: 380 };

const DFO_COOPERATION_NODES: DfoCooperationNode[] = [
  {
    id: 'node-vladivostok-hq',
    name: 'Головной центр РЦА «Русский Восток» (ВВГУ)',
    shortName: 'Владивосток (ВВГУ)',
    kind: 'office',
    kindLabel: 'Головное представительство РЦА',
    regionId: 'primorye',
    regionName: 'Приморский край',
    city: 'г. Владивосток',
    x: 338,
    y: 380,
    labelDx: -10,
    labelDy: 14,
    labelAnchor: 'end',
    cooperationFormat: 'Аттестационная комиссия ВВГУ и ФСТР · Приём документов и теорэкзамен',
    keyMetricLabel: 'Поток РЦА и ДПО',
    keyMetricValue: '122 в реестре · 52 обуч. / 26 аттест. (окт. 2026)',
    programsAndRoutes: [
      'ДПО «Пешеходный туризм» (≈250 ч)',
      'ДПО «Водный туризм и сплавы» (27 200 ₽)',
      'Защита паспортов маршрутов по ПП № 760',
    ],
    description:
      'Опорный узел Дальнего Востока на базе Института туризма и креативных индустрий ВВГУ: координация межрегиональных потоков, обучение и внесение данных в Единый федеральный реестр.',
  },
  {
    id: 'node-shkotovo-polygon',
    name: 'Полевой аттестационный полигон «Шкотовский»',
    shortName: 'Шкотовский полигон',
    kind: 'office',
    kindLabel: 'Полевой полигон РЦА и ФСТР',
    regionId: 'primorye',
    regionName: 'Приморский край',
    city: 'Шкотовский округ (г. Ливадийская)',
    x: 365,
    y: 368,
    labelDx: 10,
    labelDy: 4,
    labelAnchor: 'start',
    cooperationFormat: 'Практические испытания и спасработы на горно-таёжном рельефе',
    keyMetricLabel: 'Охват потока',
    keyMetricValue: 'Все очные и выездные группы ДФО',
    programsAndRoutes: [
      'Навесные и водные переправы (р. Шкотовка)',
      'Ориентирование на курумниках (хр. Ливадийский)',
      'Первая помощь Wilderness First Aid и ПСР',
    ],
    description:
      'Основная практическая база выездного экзамена РЦА «Русский Восток» для оценки навыков сопровождения групп, эвакуации пострадавших и работы со спутниковой связью.',
  },
  {
    id: 'node-khabarovsk-office',
    name: 'Выездная комиссия РЦА · Хабаровский край',
    shortName: 'Хабаровск',
    kind: 'office',
    kindLabel: 'Региональное представительство',
    regionId: 'khabarovsk',
    regionName: 'Хабаровский край',
    city: 'г. Хабаровск',
    x: 342,
    y: 248,
    labelDx: -10,
    labelDy: -6,
    labelAnchor: 'end',
    cooperationFormat: 'Формирование выездных групп и сверка походного стажа (Контур А)',
    keyMetricLabel: 'Динамика',
    keyMetricValue: '33 в реестре · +9 аттест. в окт. 2026',
    programsAndRoutes: [
      'Горные и таёжные сплавы (Хор, Анюй)',
      'Хребет Дуссе-Алинь и Шантарский кластер',
      'Предэкзаменационный аудит договоров туроператоров',
    ],
    description:
      'Межрегиональный канал для закрытия отложенного спроса Хабаровского края: треть выпускников октябрьской сессии РЦА в Приморье составили инструкторы из Хабаровска.',
  },
  {
    id: 'node-kamchatka-office',
    name: 'Партнёрский пункт переаттестации · Камчатка',
    shortName: 'Петропавловск-Камчатский',
    kind: 'office',
    kindLabel: 'Партнёрский узел переаттестации',
    regionId: 'kamchatka',
    regionName: 'Камчатский край',
    city: 'г. Петропавловск-Камчатский',
    x: 503,
    y: 172,
    labelDx: 10,
    labelDy: 4,
    labelAnchor: 'start',
    cooperationFormat: 'Переаттестация действующих гидов по ПП № 1893 и обмен стандартами',
    keyMetricLabel: 'Реестр и активность',
    keyMetricValue: '343 в реестре · >80 подтвердили статус · +2 в РЦА',
    programsAndRoutes: [
      'Вулканические восхождения (Мутновский, Горелый)',
      'Экспедиции малых групп (4–6 чел.)',
      'Совместные тренинги по лавинной и медвежьей безопасности',
    ],
    description:
      'Координация камчатских туроператоров (88% организованных групп) и перекрёстная аттестация экспедиционных гидов на площадке РЦА «Русский Восток».',
  },
  {
    id: 'node-sakhalin-office',
    name: 'Партнёрская площадка · Сахалин и Курилы',
    shortName: 'Южно-Сахалинск',
    kind: 'office',
    kindLabel: 'Партнёрская площадка ДФО',
    regionId: 'sakhalin',
    regionName: 'Сахалинская область (и Курилы)',
    city: 'г. Южно-Сахалинск',
    x: 420,
    y: 298,
    labelDx: 10,
    labelDy: 4,
    labelAnchor: 'start',
    cooperationFormat: 'Мультипрофильная подготовка «пешеходный + морской каякинг»',
    keyMetricLabel: 'Кадровая цель',
    keyMetricValue: '48 в реестре · расчётный спрос 320 чел.',
    programsAndRoutes: [
      'Мыс Великан и прибрежный каякинг',
      'Экспедиционные туры на Курильские острова',
      'Направление групп на модульные потоки ДПО ВВГУ',
    ],
    description:
      'Отраслевое взаимодействие по островным маршрутам с повышенной ветро-волновой нагрузкой и комбинированной квалификацией проводников.',
  },
  {
    id: 'node-khasan-hub',
    name: 'Южно-Приморский хаб (Нацпарк «Земля леопарда» — п-ов Гамова)',
    shortName: 'Хасанский кластер',
    kind: 'hub',
    kindLabel: 'Туристический хаб и ООПТ',
    regionId: 'primorye',
    regionName: 'Приморский край',
    city: 'Хасанский округ',
    x: 316,
    y: 399,
    labelDx: -10,
    labelDy: 10,
    labelAnchor: 'end',
    cooperationFormat: 'Обязательное сопровождение аттестованными гидами на экотропах ООПТ',
    keyMetricLabel: 'Сезонный поток',
    keyMetricValue: 'Высокая плотность групп · март–ноябрь',
    programsAndRoutes: [
      'Экотропа «Земля леопарда» и п-ов Гамова',
      'Бухта Теляковского и морские переходы',
      'Квалификационная практика по работе с иностранными группами',
    ],
    description:
      'Ключевой прибрежный туристический хаб Приморья с жёсткими требованиями режима ООПТ и массовым спросом на сертифицированных гидов-экскурсоводов.',
  },
  {
    id: 'node-bikin-hub',
    name: 'Таёжный хаб ООПТ «Бикин» и Центр «Амурский тигр»',
    shortName: 'Нацпарк «Бикин»',
    kind: 'hub',
    kindLabel: 'Совместный экотуристический хаб',
    regionId: 'primorye',
    regionName: 'Приморский край',
    city: 'с. Красный Яр, Пожарский округ',
    x: 356,
    y: 326,
    labelDx: 10,
    labelDy: -6,
    labelAnchor: 'start',
    cooperationFormat: 'Апробация регламентов безопасности ООПТ и стажировка водно-таёжных гидов',
    keyMetricLabel: 'Маршрутная сеть',
    keyMetricValue: '11 паспортизованных маршрутов округа',
    programsAndRoutes: [
      'Сплавы по р. Бикин и таёжные этнотропы',
      'Протокол поведения при встрече с крупным хищником',
      'Вовлечение проводников из числа КМНС в федеральный реестр',
    ],
    description:
      'Совместная методическая площадка с Центром «Амурский тигр» по интеграции местных таёжных проводников в официальную систему аттестации.',
  },
  {
    id: 'node-amur-hub',
    name: 'Благовещенский речной и автотуристский хаб',
    shortName: 'Благовещенск (Амур)',
    kind: 'hub',
    kindLabel: 'Туристический хаб ДФО',
    regionId: 'amur',
    regionName: 'Амурская область',
    city: 'г. Благовещенск',
    x: 232,
    y: 242,
    labelDx: -10,
    labelDy: 4,
    labelAnchor: 'end',
    cooperationFormat: 'Подготовка гидов под проектируемый трек автотуризма и речные сплавы',
    keyMetricLabel: 'Дефицит кадров',
    keyMetricValue: '12 в реестре · спрос 110 чел.',
    programsAndRoutes: [
      'Сплавы по рекам Зея и Бурея',
      'Трансграничные автоэкспедиционные туры',
      'Дистанционное прохождение теории в ВВГУ',
    ],
    description:
      'Формирующийся узел авто- и речного туризма Приамурья, взаимодействующий с ВВГУ по целевому обучению гидов для маршрутов повышенной проходимости.',
  },
  {
    id: 'node-yakutia-hub',
    name: 'Якутский экспедиционный хаб (НП «Ленские столбы»)',
    shortName: 'Якутск',
    kind: 'hub',
    kindLabel: 'Северный туристический хаб',
    regionId: 'yakutia',
    regionName: 'Республика Саха (Якутия)',
    city: 'г. Якутск',
    x: 204,
    y: 120,
    labelDx: 0,
    labelDy: -14,
    labelAnchor: 'middle',
    cooperationFormat: 'Методический обмен по автономным маршрутам и экстремальным температурам',
    keyMetricLabel: 'Кадровый профиль',
    keyMetricValue: '18 в реестре · спрос 180 чел.',
    programsAndRoutes: [
      'Сплавы и треккинг в НП «Ленские столбы»',
      'Горная система Сунтар-Хаята и Буотама',
      'Повышенные стандарты спутниковой связи и ПСР',
    ],
    description:
      'Северный кластер с длинными автономными маршрутами, использующий методическую базу РЦА по оказанию первой помощи в удалённых районах.',
  },
  {
    id: 'node-magadan-hub',
    name: 'Колымско-Чукотский арктический туристический хаб',
    shortName: 'Магадан / Чукотка',
    kind: 'hub',
    kindLabel: 'Арктический экспедиционный хаб',
    regionId: 'magadan-chukotka',
    regionName: 'Магаданская область и Чукотка',
    city: 'г. Магадан · Анадырь',
    x: 452,
    y: 78,
    labelDx: 0,
    labelDy: -14,
    labelAnchor: 'middle',
    cooperationFormat: 'Точечная аттестация гидов-лидеров для малых экспедиционных групп',
    keyMetricLabel: 'Кадровая обеспеченность',
    keyMetricValue: '6 в реестре · спрос 70 чел.',
    programsAndRoutes: [
      'Озеро Джека Лондона и хребет Черского',
      'Тундровые и морские экспедиции (4–6 чел.)',
      'Обязательное страхование эвакуации и трекинг inReach',
    ],
    description:
      'Удалённый макрорегион с критической ценой ошибки на маршруте; туроператоры направляют ведущих гидов на аттестацию по стандартам ФСТР в РЦА Приморья.',
  },
];

interface DfoHubsInteractiveMapProps {
  regionFilter?: DfoRegionFilterId;
  onSelectRegionFilter?: (regionId: DfoRegionFilterId) => void;
}

export const DfoHubsInteractiveMap: React.FC<DfoHubsInteractiveMapProps> = ({
  regionFilter = 'all',
  onSelectRegionFilter,
}) => {
  const [kindFilter, setKindFilter] = useState<NodeKindFilter>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node-vladivostok-hq');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const visibleNodes = useMemo(() => {
    return DFO_COOPERATION_NODES.filter((node) => {
      if (kindFilter !== 'all' && node.kind !== kindFilter) return false;
      return true;
    });
  }, [kindFilter]);

  // Synchronize selected node when external DFO region filter changes
  useEffect(() => {
    if (regionFilter === 'all') return;
    const current = DFO_COOPERATION_NODES.find((n) => n.id === selectedNodeId);
    if (current && current.regionId === regionFilter && (kindFilter === 'all' || current.kind === kindFilter)) {
      return;
    }
    const matching = visibleNodes.find((n) => n.regionId === regionFilter) ??
      DFO_COOPERATION_NODES.find((n) => n.regionId === regionFilter);
    if (matching) {
      setSelectedNodeId(matching.id);
    }
  }, [regionFilter, kindFilter, selectedNodeId, visibleNodes]);

  const activeNode = useMemo(() => {
    return (
      visibleNodes.find((n) => n.id === selectedNodeId) ??
      DFO_COOPERATION_NODES.find((n) => n.id === selectedNodeId) ??
      visibleNodes[0] ??
      DFO_COOPERATION_NODES[0]
    );
  }, [selectedNodeId, visibleNodes]);

  const hoveredNode = useMemo(
    () => (hoveredNodeId ? DFO_COOPERATION_NODES.find((n) => n.id === hoveredNodeId) ?? null : null),
    [hoveredNodeId]
  );

  const officeCount = useMemo(
    () => DFO_COOPERATION_NODES.filter((n) => n.kind === 'office').length,
    []
  );
  const hubCount = useMemo(
    () => DFO_COOPERATION_NODES.filter((n) => n.kind === 'hub').length,
    []
  );

  const handleSelectNode = (node: DfoCooperationNode) => {
    setSelectedNodeId(node.id);
    if (onSelectRegionFilter) {
      onSelectRegionFilter(node.regionId);
    }
    tracker.trackCustomInteraction(`Хаб ДФО: ${node.shortName}`, node.kindLabel);
  };

  return (
    <section
      aria-labelledby="dfo-hubs-map-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header & Layer Filter */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700">
            Кооперационная сеть РЦА «Русский Восток»
            {regionFilter !== 'all' ? ` · Фильтр: ${activeNode.regionName}` : ''}
          </p>
          <h2 id="dfo-hubs-map-heading" className="text-lg sm:text-xl font-bold text-slate-900">
            Карта представительств РЦА и туристических хабов Дальнего Востока
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Точки присутствия аттестационных комиссий, полевых полигонов и ключевых туристических
            кластеров ООПТ ДФО, взаимодействующих с головным центром на базе ВВГУ.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {regionFilter !== 'all' && onSelectRegionFilter && (
            <button
              type="button"
              onClick={() => onSelectRegionFilter('all')}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Сбросить регион
            </button>
          )}

          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: `Все точки (${DFO_COOPERATION_NODES.length})` },
                { id: 'office', label: `Представительства РЦА (${officeCount})` },
                { id: 'hub', label: `Турхабы и ООПТ (${hubCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setKindFilter(tab.id);
                  tracker.trackCustomInteraction(`Фильтр сети ДФО: ${tab.label}`);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  kindFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Split: Map Canvas (7 cols) + Node Inspector (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pb-3 border-b border-slate-200">
            <span>Наведите или нажмите на точку для просмотра формата работы</span>
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-700 ring-2 ring-teal-200" aria-hidden="true" />
                Представительство / полигон РЦА
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm rotate-45 bg-amber-600" aria-hidden="true" />
                Туристический хаб / ООПТ
              </span>
            </div>
          </div>

          <div className="relative w-full">
            <svg
              viewBox="0 0 640 430"
              className="w-full max-h-[410px] h-auto mx-auto select-none"
              role="img"
              aria-label="Интерактивная карта представительств РЦА и туристических хабов Дальнего Востока"
            >
              {/* Maritime backdrop */}
              <rect x="0" y="0" width="640" height="430" fill="#EFF6FF" rx="8" />

              {/* Coordinate grid */}
              <g stroke="#DCE7F3" strokeWidth="1" strokeDasharray="3 4">
                <line x1="0" y1="110" x2="640" y2="110" />
                <line x1="0" y1="220" x2="640" y2="220" />
                <line x1="0" y1="330" x2="640" y2="330" />
                <line x1="160" y1="0" x2="160" y2="430" />
                <line x1="320" y1="0" x2="320" y2="430" />
                <line x1="480" y1="0" x2="480" y2="430" />
              </g>

              {/* Water body labels */}
              <text x="456" y="275" className="fill-slate-400 text-[10px] font-serif italic">
                Охотское море
              </text>
              <text x="382" y="408" className="fill-slate-400 text-[10px] font-serif italic">
                Японское море
              </text>
              <text x="536" y="295" className="fill-slate-400 text-[10px] font-serif italic">
                Тихий океан
              </text>

              {/* DFO Regions Base Polygons */}
              {DFO_REGIONS_DISTRIBUTION.map((region) => {
                const isRegionSelected =
                  regionFilter !== 'all'
                    ? region.id === regionFilter
                    : activeNode.regionId === region.id;
                const dimRegion = regionFilter !== 'all' && region.id !== regionFilter;

                return (
                  <path
                    key={`hub-reg-${region.id}`}
                    d={region.svgPath}
                    fill={isRegionSelected ? '#F0FDFA' : '#FFFFFF'}
                    fillOpacity={dimRegion ? 0.55 : 1}
                    stroke={isRegionSelected ? '#0F766E' : '#CBD5E1'}
                    strokeWidth={isRegionSelected ? 1.8 : 1.2}
                    strokeLinejoin="round"
                    onClick={() => {
                      if (onSelectRegionFilter) {
                        onSelectRegionFilter(region.id as DfoRegionFilterId);
                      }
                      const firstInRegion =
                        visibleNodes.find((n) => n.regionId === region.id) ??
                        DFO_COOPERATION_NODES.find((n) => n.regionId === region.id);
                      if (firstInRegion) {
                        setSelectedNodeId(firstInRegion.id);
                      }
                    }}
                    className="cursor-pointer transition-colors duration-150"
                  />
                );
              })}

              {/* Interaction Arcs from Vladivostok HQ to all other visible nodes */}
              <g fill="none">
                {visibleNodes
                  .filter((n) => n.id !== 'node-vladivostok-hq')
                  .map((node) => {
                    const isHighlighted =
                      node.id === activeNode.id || node.id === hoveredNodeId;
                    const midX = (HQ_COORDS.x + node.x) / 2 - (node.y < 260 ? 28 : 10);
                    const midY = (HQ_COORDS.y + node.y) / 2 + (node.x > 400 ? 18 : -10);
                    const dimArc = regionFilter !== 'all' && node.regionId !== regionFilter;

                    return (
                      <path
                        key={`arc-${node.id}`}
                        d={`M ${HQ_COORDS.x},${HQ_COORDS.y} Q ${midX},${midY} ${node.x},${node.y}`}
                        stroke={
                          isHighlighted
                            ? node.kind === 'office'
                              ? '#0F766E'
                              : '#B45309'
                            : '#94A3B8'
                        }
                        strokeWidth={isHighlighted ? 2.2 : 1.1}
                        strokeDasharray={isHighlighted ? undefined : '4 4'}
                        strokeOpacity={dimArc ? 0.2 : isHighlighted ? 0.9 : 0.45}
                      />
                    );
                  })}
              </g>

              {/* Cooperation Nodes */}
              {visibleNodes.map((node) => {
                const isSelected = node.id === activeNode.id;
                const isHovered = node.id === hoveredNodeId;
                const isHq = node.id === 'node-vladivostok-hq';
                const dimNode =
                  regionFilter !== 'all' && node.regionId !== regionFilter && !isHovered;

                const fillColor = node.kind === 'office' ? '#0F766E' : '#D97706';

                return (
                  <g
                    key={node.id}
                    onClick={() => handleSelectNode(node)}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() =>
                      setHoveredNodeId((prev) => (prev === node.id ? null : prev))
                    }
                    opacity={dimNode ? 0.35 : 1}
                    className="cursor-pointer transition-opacity duration-150"
                  >
                    {(isSelected || isHovered) && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={isHq ? 15 : 12}
                        fill="none"
                        stroke={isSelected ? '#0F172A' : fillColor}
                        strokeWidth={1.6}
                      />
                    )}

                    {node.kind === 'office' ? (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={isHq ? 9 : 6.5}
                        fill={fillColor}
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      />
                    ) : (
                      <rect
                        x={node.x - 5.5}
                        y={node.y - 5.5}
                        width={11}
                        height={11}
                        rx={2}
                        transform={`rotate(45 ${node.x} ${node.y})`}
                        fill={fillColor}
                        stroke="#FFFFFF"
                        strokeWidth={1.8}
                      />
                    )}

                    {isHq && (
                      <circle cx={node.x} cy={node.y} r={3} fill="#FFFFFF" className="pointer-events-none" />
                    )}

                    <text
                      x={node.x + (node.labelDx ?? 10)}
                      y={node.y + (node.labelDy ?? 4)}
                      textAnchor={node.labelAnchor ?? 'start'}
                      className={`text-[10px] font-sans pointer-events-none ${
                        isSelected || isHovered
                          ? 'fill-slate-950 font-bold'
                          : 'fill-slate-700 font-medium'
                      }`}
                    >
                      {node.shortName}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Floating Hover Summary Card */}
            {hoveredNode && (
              <div
                role="status"
                className="mt-3 sm:mt-0 sm:absolute sm:top-3 sm:left-3 z-10 max-w-xs bg-slate-900/95 text-white border border-slate-700 rounded-lg px-3.5 py-2.5 shadow-md pointer-events-none"
              >
                <p className="text-[10px] font-mono text-teal-300 uppercase tracking-wider">
                  {hoveredNode.kindLabel}
                </p>
                <p className="text-xs font-semibold text-white mt-0.5 leading-snug">
                  {hoveredNode.name}
                </p>
                <p className="text-[11px] text-slate-300 mt-1 font-mono tabular-nums">
                  {hoveredNode.keyMetricValue}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Selected Node Details + Directory List (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-medium text-teal-800">
                {activeNode.kind === 'office' ? (
                  <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Compass className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
                )}
                <span className={activeNode.kind === 'office' ? 'text-teal-800' : 'text-amber-800'}>
                  {activeNode.kindLabel} · {activeNode.regionName}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                {activeNode.name}
              </h3>
              <p className="text-xs text-slate-500 inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                <span>{activeNode.city}</span>
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-1">
              <p className="text-[11px] text-slate-500">{activeNode.keyMetricLabel}</p>
              <p className="text-sm font-bold font-mono text-teal-800 tabular-nums">
                {activeNode.keyMetricValue}
              </p>
            </div>

            <dl className="divide-y divide-slate-200 text-xs">
              <div className="py-2.5">
                <dt className="text-slate-500">Формат взаимодействия с РЦА</dt>
                <dd className="mt-1 font-medium text-slate-900 leading-relaxed">
                  {activeNode.cooperationFormat}
                </dd>
              </div>
              <div className="py-2.5">
                <dt className="text-slate-500">Профиль и роль в сети ДФО</dt>
                <dd className="mt-1 text-slate-700 leading-relaxed">{activeNode.description}</dd>
              </div>
              <div className="py-2.5 space-y-1.5">
                <dt className="text-slate-500">Ключевые программы и маршруты</dt>
                <dd>
                  <ul className="space-y-1.5 text-slate-800">
                    {activeNode.programsAndRoutes.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <ShieldCheck
                          className="w-3.5 h-3.5 text-teal-700 mt-0.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          </div>

          {/* Interactive Directory of Points */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex justify-between">
              <span>Узлы взаимодействия с РЦА</span>
              <span className="font-mono tabular-nums">{visibleNodes.length} шт.</span>
            </div>
            <div className="divide-y divide-slate-200 max-h-[210px] overflow-y-auto">
              {visibleNodes.map((node) => {
                const selected = node.id === activeNode.id;
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => handleSelectNode(node)}
                    className={`w-full px-4 py-2.5 text-left text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      selected
                        ? 'bg-teal-50/80 font-semibold text-slate-900'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 shrink-0 ${
                          node.kind === 'office'
                            ? 'rounded-full bg-teal-700'
                            : 'rounded-xs rotate-45 bg-amber-600'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{node.shortName}</span>
                    </span>
                    <span className="text-[11px] text-slate-500 shrink-0">
                      {node.kind === 'office' ? 'РЦА' : 'Хаб'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
