import {
  forecastNextRouteComplexity,
  computeJournalMetrics,
} from '../domain/experience/ExperienceAnalyticsService.ts';
import {
  COMPLEXITY_RANK,
  getJournalRegionById,
  resolveJournalRegionId,
  type DfoJournalRegionId,
  type ExpeditionComplexity,
  type ExperienceLogEntry,
} from '../domain/experience/ExperienceEntry.ts';

export type GearRouteProfile = 'hiking' | 'water' | 'expedition';
export type GearSeasonMode = 'warm' | 'cold';
export type GearItemGroupId =
  | 'personal_bivouac'
  | 'navigation_dfo_safety'
  | 'technical_route'
  | 'medications_wfa';

export interface GearChecklistItem {
  id: string;
  group: GearItemGroupId;
  kind: 'equipment' | 'medication';
  name: string;
  quantity: string;
  priority: 'mandatory' | 'recommended';
  rationale: string;
}

export interface GearChecklistGroup {
  id: GearItemGroupId;
  title: string;
  subtitle: string;
  kind: 'equipment' | 'medication';
  items: GearChecklistItem[];
}

export interface JournalGearSummary {
  totalTrips: number;
  visitedRegionIds: DfoJournalRegionId[];
  visitedRegionNames: string[];
  primaryRegionId: DfoJournalRegionId;
  primaryRegionName: string;
  maxComplexity: ExpeditionComplexity;
  recommendedNextComplexity: ExpeditionComplexity;
  inferredProfile: GearRouteProfile;
  avgGroupSize: number;
}

export interface GearChecklistConfig {
  regionId: DfoJournalRegionId;
  complexity: ExpeditionComplexity;
  profile: GearRouteProfile;
  season: GearSeasonMode;
  groupSize: number;
}

export interface GearChecklistResult {
  config: GearChecklistConfig;
  regionName: string;
  regionClimateNote: string;
  groups: GearChecklistGroup[];
  allItems: GearChecklistItem[];
  equipmentCount: number;
  medicationCount: number;
  mandatoryCount: number;
}

export const GEAR_PROFILE_OPTIONS: readonly {
  id: GearRouteProfile;
  label: string;
  shortLabel: string;
}[] = [
  { id: 'hiking', label: 'Пешеходный / горно-таёжный', shortLabel: 'Пешеходный' },
  { id: 'water', label: 'Водный туризм и сплавы', shortLabel: 'Водный' },
  { id: 'expedition', label: 'Автономная экспедиция', shortLabel: 'Экспедиция' },
];

const REGION_SAFETY_NOTES: Record<DfoJournalRegionId, string> = {
  primorye:
    'Приморский край: повышенная влажность и клещевая активность (май–октябрь), муссонные паводки, ареал амурского тигра и гималайского медведя.',
  kamchatka:
    'Камчатский край: высокая плотность бурого медведя, вулканический шлак/пепел, резкие смены погоды и холодные броды.',
  khabarovsk:
    'Хабаровский край: длительные автономные таёжные участки, перепады температур, гнус/клещи и удалённость от дорог.',
  sakhalin:
    'Сахалин и Курилы: сильные прибрежные ветра, плотный бамбучник (курильский), туманы и приливно-отливная динамика.',
  yakutia:
    'Якутия: резко континентальный климат, наледи и вечная мерзлота, низкие ночные температуры даже летом.',
  amur:
    'Амурская область: заболоченные мари, переправы через таёжные притоки и высокая пожароопасность в сухой сезон.',
  'magadan-chukotka':
    'Магаданская область и Чукотка: субарктическая тундра, отсутствие связи, сильные ветра и низкие температуры воды.',
};

const STORAGE_PREFIX = 'rca-gear-checklist-checked-v1:';

export function readStoredGearCheckedIds(userId?: string | null): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId ?? 'guest'}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

export function writeStoredGearCheckedIds(
  userId: string | null | undefined,
  ids: readonly string[]
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${userId ?? 'guest'}`, JSON.stringify(ids));
  } catch {
    // ignore storage quota errors
  }
}

export function summarizeJournalForGear(
  entries: readonly ExperienceLogEntry[],
  preferredRegionName?: string
): JournalGearSummary {
  const fallbackRegionId = resolveJournalRegionId(preferredRegionName);
  if (entries.length === 0) {
    const reg = getJournalRegionById(fallbackRegionId);
    return {
      totalTrips: 0,
      visitedRegionIds: [fallbackRegionId],
      visitedRegionNames: [reg.name],
      primaryRegionId: fallbackRegionId,
      primaryRegionName: reg.name,
      maxComplexity: '1 КС',
      recommendedNextComplexity: '1 КС',
      inferredProfile: 'hiking',
      avgGroupSize: 8,
    };
  }

  const metrics = computeJournalMetrics(entries);
  const forecast = forecastNextRouteComplexity(entries);

  const visitedRegionIds = metrics.byRegionList
    .filter((r) => r.tripsCount > 0)
    .map((r) => r.regionId);
  const primaryRegionId =
    visitedRegionIds[0] ?? entries[0]?.regionId ?? fallbackRegionId;
  const primaryRegionName = getJournalRegionById(primaryRegionId).name;

  // Infer dominant route profile from route titles and notes
  const waterMatches = entries.filter((e) =>
    /(сплав|рафт|катамаран|река|р\.|каяк|море|морск)/i.test(
      `${e.routeTitle} ${e.notes}`
    )
  ).length;
  const expMatches = entries.filter(
    (e) =>
      COMPLEXITY_RANK[e.complexity] >= 3 ||
      /(экспедиц|траверс|автоном|перевал)/i.test(`${e.routeTitle} ${e.notes}`)
  ).length;

  let inferredProfile: GearRouteProfile = 'hiking';
  if (waterMatches >= Math.max(1, Math.ceil(entries.length * 0.4))) {
    inferredProfile = 'water';
  } else if (expMatches >= Math.max(1, Math.ceil(entries.length * 0.45))) {
    inferredProfile = 'expedition';
  }

  return {
    totalTrips: metrics.totalTrips,
    visitedRegionIds: visitedRegionIds.length > 0 ? visitedRegionIds : [primaryRegionId],
    visitedRegionNames:
      visitedRegionIds.length > 0
        ? visitedRegionIds.map((id) => getJournalRegionById(id).shortName)
        : [primaryRegionName],
    primaryRegionId,
    primaryRegionName,
    maxComplexity: metrics.maxComplexity === '—' ? 'н/к' : metrics.maxComplexity,
    recommendedNextComplexity: forecast.recommendedComplexity,
    inferredProfile,
    avgGroupSize: Math.max(2, Math.min(30, metrics.avgGroupSize || 8)),
  };
}

export function generateGearChecklist(rawConfig: GearChecklistConfig): GearChecklistResult {
  const groupSize = Math.max(1, Math.min(60, Math.round(rawConfig.groupSize || 8)));
  const config: GearChecklistConfig = { ...rawConfig, groupSize };
  const rank = COMPLEXITY_RANK[config.complexity];
  const isMultiDay = rank >= 1;
  const isHard = rank >= 3;
  const isExtreme = rank >= 4;
  const isCold = config.season === 'cold';
  const region = getJournalRegionById(config.regionId);

  const medKitsCount = groupSize > 12 ? 2 : 1;
  const radiosCount = Math.max(2, Math.ceil(groupSize / 5) + 1);
  const thermalBlanketsCount = Math.max(2, Math.ceil(groupSize / 2));

  // 1. Personal & Bivouac Equipment
  const personalItems: GearChecklistItem[] = [
    {
      id: 'eq-boots',
      group: 'personal_bivouac',
      kind: 'equipment',
      name:
        config.profile === 'water'
          ? 'Неопреновая обувь / гидроботинки + трекинговые кроссовки'
          : 'Треккинговые ботинки с фиксацией голеностопа + запасные стельки',
      quantity: `${groupSize} пар`,
      priority: 'mandatory',
      rationale:
        config.profile === 'water'
          ? 'Защита стоп на мокром камне и при проводке судов.'
          : 'Профилактика вывихов на курумах и мокрой тропе.',
    },
    {
      id: 'eq-rain-membrane',
      group: 'personal_bivouac',
      kind: 'equipment',
      name: 'Мембранная штормовая куртка и брюки (водозащита >= 10 000 мм)',
      quantity: `${groupSize} компл.`,
      priority: 'mandatory',
      rationale: `Защита от затяжных осадков и ветра (${region.shortName}).`,
    },
    {
      id: 'eq-headlamp',
      group: 'personal_bivouac',
      kind: 'equipment',
      name: 'Налобный фонарь + запасной комплект батареек / АКБ',
      quantity: `${groupSize} шт.`,
      priority: 'mandatory',
      rationale: 'Обязательно даже на дневных выходах при задержке группы.',
    },
  ];

  if (isMultiDay) {
    personalItems.push(
      {
        id: 'eq-tent',
        group: 'personal_bivouac',
        kind: 'equipment',
        name:
          isHard || isCold
            ? 'Экспедиционные штормовые палатки (алюминиевые дуги)'
            : 'Треккинговые двухслойные палатки с ветровыми оттяжками',
        quantity: `${Math.ceil(groupSize / 3)} шт.`,
        priority: 'mandatory',
        rationale: `Устойчивость бивака для сложности ${config.complexity}.`,
      },
      {
        id: 'eq-sleep-system',
        group: 'personal_bivouac',
        kind: 'equipment',
        name: isCold
          ? 'Зимний спальник (T comfort <= -15°C) + коврик R-value >= 4.0'
          : 'Спальник (T comfort 0..+5°C) + теплоизолирующий коврик',
        quantity: `${groupSize} компл.`,
        priority: 'mandatory',
        rationale: 'Предотвращение ночного переохлаждения группы.',
      },
      {
        id: 'eq-stove',
        group: 'personal_bivouac',
        kind: 'equipment',
        name: 'Групповые газовые/мультитопливные горелки и ветрозащита',
        quantity: `${Math.max(1, Math.ceil(groupSize / 6))} компл.`,
        priority: 'mandatory',
        rationale: isCold
          ? 'Мультитопливо / зимняя газовая смесь для стабильного кипячения.'
          : 'Быстрое приготовление горячего питья и дезинфекция воды.',
      }
    );
  }

  if (isCold || config.regionId === 'yakutia' || config.regionId === 'magadan-chukotka') {
    personalItems.push({
      id: 'eq-thermos-down',
      group: 'personal_bivouac',
      kind: 'equipment',
      name: 'Утеплённая пуховка (бивачная) + термос 1 л на участника',
      quantity: `${groupSize} компл.`,
      priority: 'mandatory',
      rationale: 'Резкие суточные перепады температур и холодовые условия Севера/зимы.',
    });
  }

  if (config.regionId === 'sakhalin') {
    personalItems.push({
      id: 'eq-gaiters-gloves',
      group: 'personal_bivouac',
      kind: 'equipment',
      name: 'Плотные гамаши (фонарики) и защитные перчатки для бамбучника',
      quantity: `${groupSize} пар`,
      priority: 'recommended',
      rationale: 'Защита одежды и рук при движении через сахалинский бамбучник.',
    });
  }

  // 2. Navigation, Communications & DFO Safety
  const navSafetyItems: GearChecklistItem[] = [
    {
      id: 'nav-gps-topo',
      group: 'navigation_dfo_safety',
      kind: 'equipment',
      name: 'Навигатор ГЛОНАСС/GPS + ламинированная бумажная топокарта и компас',
      quantity: '2 компл. на группу',
      priority: 'mandatory',
      rationale: 'Дублирование навигации при отказе электроники или тумане (ПП № 760).',
    },
    {
      id: 'nav-radios',
      group: 'navigation_dfo_safety',
      kind: 'equipment',
      name: 'Портативные VHF/UHF рации с гарнитурой и резервными АКБ',
      quantity: `${radiosCount} шт.`,
      priority: 'mandatory',
      rationale: 'Связь ведущего, замыкающего и экипажей на маршруте.',
    },
    {
      id: 'nav-sat-inreach',
      group: 'navigation_dfo_safety',
      kind: 'equipment',
      name: 'Спутниковый трекер с кнопкой SOS (Garmin inReach / Иридиум)',
      quantity: isExtreme ? '2 шт.' : '1 шт.',
      priority: rank >= 2 || config.profile === 'expedition' ? 'mandatory' : 'recommended',
      rationale: 'Аварийная связь вне сотового покрытия и контрольные выходы МЧС.',
    },
    {
      id: 'nav-powerbank',
      group: 'navigation_dfo_safety',
      kind: 'equipment',
      name: 'Защищённые пауэрбанки (20 000 мА·ч) в гермоупаковке',
      quantity: `${Math.max(2, Math.ceil(groupSize / 4))} шт.`,
      priority: 'mandatory',
      rationale: 'Резерв питания для навигации, связи и трекеров.',
    },
  ];

  // DFO predator & OOPT specific gear
  if (
    config.regionId === 'primorye' ||
    config.regionId === 'kamchatka' ||
    config.regionId === 'khabarovsk' ||
    config.regionId === 'sakhalin' ||
    config.regionId === 'amur'
  ) {
    navSafetyItems.push({
      id: 'nav-predator-deterrent',
      group: 'navigation_dfo_safety',
      kind: 'equipment',
      name: 'Фальшфейеры / сигнал охотника и перцовый баллон (антимедвежий)',
      quantity: `${Math.max(2, Math.ceil(groupSize / 4))} компл.`,
      priority: 'mandatory',
      rationale: `Протокол безопасности РЦА в ареале бурого медведя и амурского тигра (${region.shortName}).`,
    });
  }

  navSafetyItems.push({
    id: 'nav-mchs-passport',
    group: 'navigation_dfo_safety',
    kind: 'equipment',
    name: 'Паспорт маршрута (форма № 760), список группы и номер регистрации МЧС',
    quantity: '2 экз. (в гермопакете)',
    priority: 'mandatory',
    rationale: 'Обязательное требование ПП РФ № 1893 и проверок на ООПТ.',
  });

  // 3. Technical Equipment by Complexity & Profile
  const techItems: GearChecklistItem[] = [];

  if (config.profile === 'water') {
    techItems.push(
      {
        id: 'tech-pfd-helmet',
        group: 'technical_route',
        kind: 'equipment',
        name: 'Спасжилеты (объём по весу) и водные каски с фиксацией',
        quantity: `${groupSize} компл.`,
        priority: 'mandatory',
        rationale: 'Базовое требование допуска экипажа на водный маршрут.',
      },
      {
        id: 'tech-throwbag',
        group: 'technical_route',
        kind: 'equipment',
        name: 'Спасконец («морковка», длина 20–25 м) + стропорез',
        quantity: `${Math.max(2, Math.ceil(groupSize / 4))} компл.`,
        priority: 'mandatory',
        rationale: 'Страховка на порогах и спасработы на течении.',
      },
      {
        id: 'tech-drybags',
        group: 'technical_route',
        kind: 'equipment',
        name: 'Гермомешки (60–80 л) + ремнабор для ПВХ/каркаса',
        quantity: `${groupSize} мешков + 1 ремнабор`,
        priority: 'mandatory',
        rationale: 'Защита спальников, аптечки и провианта от намокания.',
      }
    );
    if (rank >= 2) {
      techItems.push({
        id: 'tech-wetsuit',
        group: 'technical_route',
        kind: 'equipment',
        name: 'Гидрокостюмы (сухие или неопрен >= 3 мм) и спас-карабины',
        quantity: `${groupSize} компл.`,
        priority: 'mandatory',
        rationale: `Защита от острой гипотермии в холодных реках ДФО (${config.complexity}).`,
      });
    }
  } else {
    // Hiking / Expedition technical gear
    if (rank >= 1) {
      techItems.push({
        id: 'tech-poles',
        group: 'technical_route',
        kind: 'equipment',
        name: 'Треккинговые палки с темляками + ремнабор (скотч, стяжки, репшнур)',
        quantity: `${groupSize} пар + 1 ремнабор`,
        priority: 'recommended',
        rationale: 'Разгрузка коленей на спусках и устойчивость на бродах.',
      });
    }
    if (rank >= 2) {
      techItems.push({
        id: 'tech-rope-basic',
        group: 'technical_route',
        kind: 'equipment',
        name: 'Основная динамическая/статическая верёвка (50 м, 10 мм) + 6 муфтованных карабинов',
        quantity: '1 комплект на группу',
        priority: 'mandatory',
        rationale: `Организация перил и страховки на переправах для ${config.complexity}.`,
      });
    }
    if (isHard || isCold) {
      techItems.push(
        {
          id: 'tech-crampons-axe',
          group: 'technical_route',
          kind: 'equipment',
          name: 'Кошки (или ледоступы для 1–2 КС зимой), ледоруб и альпинистские каски',
          quantity: `${groupSize} компл.`,
          priority: 'mandatory',
          rationale: `Движение по снежникам, наледям и осыпям (${config.complexity}).`,
        },
        {
          id: 'tech-harness-belay',
          group: 'technical_route',
          kind: 'equipment',
          name: 'Страховочные системы (ИСС), усы самостраховки, жумар и спусковое устройство',
          quantity: `${groupSize} компл.`,
          priority: 'mandatory',
          rationale: 'Безопасная работа на крутых склонах и при ПСР.',
        }
      );
    }
    if (isExtreme) {
      techItems.push({
        id: 'tech-avalanche-beacon',
        group: 'technical_route',
        kind: 'equipment',
        name: 'Лавинные датчики (биперы), щупы и лавинные лопаты (при снежных перевалах)',
        quantity: `${groupSize} биперов + ${Math.ceil(groupSize / 3)} лопат`,
        priority: 'recommended',
        rationale: `Обязательный контур безопасности для автономных маршрутов ${config.complexity}.`,
      });
    }
  }

  // 4. Medications & WFA First-Aid Kit
  const medItems: GearChecklistItem[] = [
    {
      id: 'med-bleeding-trauma',
      group: 'medications_wfa',
      kind: 'medication',
      name: 'Жгут-турникет (CAT), гемостатический бинт, ИПП, стерильные бинты (5/7/10 см) и лейкопластырь',
      quantity: `${medKitsCount} укладки (${Math.max(4, groupSize)} перевязок)`,
      priority: 'mandatory',
      rationale: 'Базовый травматологический модуль стандарта WFA.',
    },
    {
      id: 'med-antiseptic-burn',
      group: 'medications_wfa',
      kind: 'medication',
      name: 'Хлоргексидин 0,05%, повидон-йод, противоожоговые гидрогелевые повязки',
      quantity: `${medKitsCount * 2} фл. + 4 повязки`,
      priority: 'mandatory',
      rationale: 'Обработка ран, ссадин и термических ожогов на биваке.',
    },
    {
      id: 'med-pain-fever',
      group: 'medications_wfa',
      kind: 'medication',
      name: 'Ибупрофен 400 мг, парацетамол 500 мг, кеторолак (табл./амп. при сильной боли)',
      quantity: `по ${Math.max(20, groupSize * 2)} табл.`,
      priority: 'mandatory',
      rationale: 'Обезболивание и жаропонижающая терапия в автономии.',
    },
    {
      id: 'med-allergy-shock',
      group: 'medications_wfa',
      kind: 'medication',
      name: 'Цетиризин/лоратадин 10 мг + дексаметазон амп. и шприцы (при анафилаксии)',
      quantity: `1 уп. + ${medKitsCount * 3} амп.`,
      priority: 'mandatory',
      rationale: 'Купирование острых аллергических реакций и отёка Квинке.',
    },
    {
      id: 'med-gi-rehydration',
      group: 'medications_wfa',
      kind: 'medication',
      name: 'Регидрон (пакеты), энтеросорбент (Полисорб/Смекта), лоперамид, дротаверин',
      quantity: `${Math.max(10, groupSize)} пак. + 2 уп.`,
      priority: 'mandatory',
      rationale: 'Профилактика обезвоживания и коррекция ЖКТ-расстройств.',
    },
    {
      id: 'med-thermal-blankets',
      group: 'medications_wfa',
      kind: 'medication',
      name: 'Спасательные изотермические покрывала (фольгированные) + химические грелки',
      quantity: `${thermalBlanketsCount} шт.`,
      priority: 'mandatory',
      rationale: 'Профилактика гипотермии при травме, броде или ожидании ПСР.',
    },
  ];

  if (
    config.regionId === 'primorye' ||
    config.regionId === 'khabarovsk' ||
    config.regionId === 'amur' ||
    config.regionId === 'sakhalin'
  ) {
    medItems.push({
      id: 'med-tick-kit',
      group: 'medications_wfa',
      kind: 'medication',
      name: 'Выкручиватель клещей (Тик-Твистер), пробирка для анализа, акарицидный репеллент',
      quantity: `${medKitsCount * 2} наб. + ${Math.ceil(groupSize / 3)} балл.`,
      priority: 'mandatory',
      rationale: `Эндемичные по клещевому энцефалиту и боррелиозу районы (${region.shortName}).`,
    });
  }

  if (rank >= 2 || config.profile === 'water' || config.profile === 'expedition') {
    medItems.push({
      id: 'med-splint-elastic',
      group: 'medications_wfa',
      kind: 'medication',
      name: 'Иммобилизационная шина (SAM Splint), косыночная повязка, эластичные бинты',
      quantity: `${medKitsCount * 2} шины + 4 бинта`,
      priority: 'mandatory',
      rationale: `Фиксация переломов и растяжений при удалении от дорог (${config.complexity}).`,
    });
  }

  if (isHard || config.regionId === 'kamchatka') {
    medItems.push({
      id: 'med-eye-uv-antibiotic',
      group: 'medications_wfa',
      kind: 'medication',
      name: 'Глазные капли (сульфацетамид / «искусственная слеза») + солнцезащитный крем SPF 50',
      quantity: `${medKitsCount * 2} фл.`,
      priority: 'recommended',
      rationale:
        config.regionId === 'kamchatka'
          ? 'Защита глаз от вулканического пепла и отражённого УФ на снежниках.'
          : 'Защита от снежной офтальмии и солнечных ожогов в горах.',
    });
  }

  if (isExtreme) {
    medItems.push({
      id: 'med-expedition-reserve',
      group: 'medications_wfa',
      kind: 'medication',
      name: 'Личный набор экстренного антибиотика (по назначению врача группы) и пульсоксиметр',
      quantity: '1 комплект в старшей аптечке',
      priority: 'recommended',
      rationale: `Длительная автономия категории ${config.complexity} при задержке эвакуации.`,
    });
  }

  const rawGroups: GearChecklistGroup[] = [
    {
      id: 'personal_bivouac',
      title: 'Личное и бивачное снаряжение',
      subtitle: 'Одежда, обувь, защита от осадков и организация лагеря',
      kind: 'equipment',
      items: personalItems,
    },
    {
      id: 'navigation_dfo_safety',
      title: 'Навигация, связь и безопасность ДФО',
      subtitle: 'Топография, спутниковый трекинг, регистрация МЧС и защита от хищников',
      kind: 'equipment',
      items: navSafetyItems,
    },
    {
      id: 'technical_route',
      title: 'Специальное техническое снаряжение',
      subtitle: `Комплектация под профиль «${
        GEAR_PROFILE_OPTIONS.find((p) => p.id === config.profile)?.shortLabel ?? ''
      }» и сложность ${config.complexity}`,
      kind: 'equipment',
      items: techItems,
    },
    {
      id: 'medications_wfa',
      title: 'Групповая аптечка и медикаменты (стандарт WFA)',
      subtitle: 'Неотложная помощь, перевязка, гипотермия и региональная профилактика',
      kind: 'medication',
      items: medItems,
    },
  ];
  const groups = rawGroups.filter((g) => g.items.length > 0);

  const allItems = groups.flatMap((g) => g.items);

  return {
    config,
    regionName: region.name,
    regionClimateNote: REGION_SAFETY_NOTES[config.regionId],
    groups,
    allItems,
    equipmentCount: allItems.filter((i) => i.kind === 'equipment').length,
    medicationCount: allItems.filter((i) => i.kind === 'medication').length,
    mandatoryCount: allItems.filter((i) => i.priority === 'mandatory').length,
  };
}

export function formatGearChecklistText(
  result: GearChecklistResult,
  checkedIds: ReadonlySet<string>
): string {
  const profileLabel =
    GEAR_PROFILE_OPTIONS.find((p) => p.id === result.config.profile)?.label ??
    result.config.profile;
  const seasonLabel = result.config.season === 'cold' ? 'Холодный сезон / зима' : 'Тёплый сезон / межсезонье';

  const lines: string[] = [
    'ЧЕК-ЛИСТ СНАРЯЖЕНИЯ И МЕДИКАМЕНТОВ РЦА «РУССКИЙ ВОСТОК»',
    `Регион: ${result.regionName}`,
    `Сложность: ${result.config.complexity} | Профиль: ${profileLabel}`,
    `Сезон: ${seasonLabel} | Состав группы: ${result.config.groupSize} чел.`,
    `Особенность региона: ${result.regionClimateNote}`,
    '',
  ];

  for (const group of result.groups) {
    lines.push(`=== ${group.title.toUpperCase()} ===`);
    for (const item of group.items) {
      const mark = checkedIds.has(item.id) ? '[x]' : '[ ]';
      const req = item.priority === 'mandatory' ? 'ОБЯЗАТЕЛЬНО' : 'рекомендуется';
      lines.push(`${mark} ${item.name} — ${item.quantity} (${req})`);
      lines.push(`    Примечание: ${item.rationale}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
