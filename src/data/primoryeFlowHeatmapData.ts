export type HeatmapMetricMode = 'loadPct' | 'flowThousands' | 'guidesNeeded';
export type HeatmapTrackFilter = 'all' | 'hiking' | 'water' | 'expedition';
export type HeatmapSortMode = 'peakLoad' | 'annualFlow' | 'southToNorth';

export const PRIMORYE_MONTH_LABELS: readonly string[] = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек',
];

export interface PrimoryeRouteFlowProfile {
  id: string;
  shortName: string;
  fullName: string;
  districtName: string;
  track: 'hiking' | 'water' | 'expedition';
  trackLabel: string;
  difficultyCategory: string;
  /** Safe carrying capacity in thousands of visitors per month before ecological/safety overload. */
  monthlyCapacityThousands: number;
  /** Group size norm per certified guide. */
  groupNorm: number;
  /** Average active groups led per month by 1 guide during season. */
  groupsPerGuideMonth: number;
  /** Share of visitors travelling with organized groups (%). */
  organizedSharePct: number;
  /** Currently certified guides covering this route/cluster in federal registry. */
  certifiedGuidesAvailable: number;
  /** Monthly tourist flow in thousands of visits (12 entries: Jan..Dec). */
  monthlyFlowThousands: readonly number[];
  safetyNote: string;
  peakDriver: string;
}

export const PRIMORYE_ROUTE_FLOW_PROFILES: readonly PrimoryeRouteFlowProfile[] = [
  {
    id: 'khasan-gamova',
    shortName: 'П-ов Гамова и «Земля леопарда»',
    fullName: 'Экотропа «Земля леопарда — бухта Алеут — п-ов Гамова»',
    districtName: 'Хасанский округ',
    track: 'hiking',
    trackLabel: 'Пешеходный / ООПТ',
    difficultyCategory: '1 КС (лимит ООПТ)',
    monthlyCapacityThousands: 28,
    groupNorm: 10,
    groupsPerGuideMonth: 12,
    organizedSharePct: 36,
    certifiedGuidesAvailable: 18,
    // Strong summer coastal surge + spring/autumn OOPT visits (~162k/yr)
    monthlyFlowThousands: [2.4, 2.8, 5.1, 9.6, 15.8, 22.4, 31.2, 34.6, 21.5, 11.2, 3.8, 1.9],
    safetyNote: 'Строгий лимит кордонов ООПТ и протокол в ареале амурского леопарда; с 2027 г. нагрузка вырастет за счёт курорта «Приморье».',
    peakDriver: 'Пляжно-экотропный пик июля–августа (124% от проектной нормы ООПТ)',
  },
  {
    id: 'russky-tobizina',
    shortName: 'О. Русский и мыс Тобизина',
    fullName: 'Экомаршрут «Остров Русский: бухта Карпинского — мыс Тобизина»',
    districtName: 'Владивостокский ГО',
    track: 'hiking',
    trackLabel: 'Пешеходный и прибрежный',
    difficultyCategory: '1 КС (спецсопровождение)',
    monthlyCapacityThousands: 34,
    groupNorm: 12,
    groupsPerGuideMonth: 14,
    organizedSharePct: 32,
    certifiedGuidesAvailable: 42,
    // Highest year-round peri-urban flux (~216k/yr)
    monthlyFlowThousands: [5.6, 6.2, 10.4, 15.8, 21.6, 26.8, 34.5, 36.8, 26.2, 17.5, 8.9, 5.9],
    safetyNote: 'Открытые скальные обрывы и шквалистые порывы ветра; высокая доля иностранных и корпоративных групп.',
    peakDriver: 'Максимальный в крае пригородный и въездной поток (июнь–сентябрь)',
  },
  {
    id: 'triozerye-sestra',
    shortName: 'Бухта Триозёрье и г. Сестра',
    fullName: 'Прибрежно-горный кластер «Бухта Триозёрье — залив Восток — г. Сестра»',
    districtName: 'Находкинский ГО',
    track: 'hiking',
    trackLabel: 'Пешеходный и глэмпинги',
    difficultyCategory: '1 КС',
    monthlyCapacityThousands: 24,
    groupNorm: 11,
    groupsPerGuideMonth: 13,
    organizedSharePct: 26,
    certifiedGuidesAvailable: 11,
    // Steep July-August coastal load (~120k/yr)
    monthlyFlowThousands: [1.1, 1.3, 2.6, 5.2, 9.8, 16.5, 26.8, 29.4, 15.2, 7.6, 2.8, 1.4],
    safetyNote: 'Дефицит аттестованных проводников на базах отдыха и глэмпингах в пик купально-треккингового сезона.',
    peakDriver: 'Резкий июльско-августовский всплеск автотуризма и глэмпинг-заездов (123% к норме)',
  },
  {
    id: 'pidan-falaza',
    shortName: 'Хребет Ливадийский (Пидан / Фалаза)',
    fullName: 'Горный хребет Ливадийский (г. Пидан — г. Фалаза)',
    districtName: 'Шкотовский округ',
    track: 'hiking',
    trackLabel: 'Горный треккинг',
    difficultyCategory: '1–2 КС',
    monthlyCapacityThousands: 19,
    groupNorm: 9,
    groupsPerGuideMonth: 10,
    organizedSharePct: 38,
    certifiedGuidesAvailable: 24,
    // Dual-peak autumn & spring mountain trekking (~127k/yr)
    monthlyFlowThousands: [3.8, 4.2, 6.8, 10.5, 17.6, 12.4, 11.2, 13.8, 20.4, 18.2, 5.6, 3.1],
    safetyNote: 'Основной полевой полигон РЦА «Русский Восток»: курумник, перепад >1 000 м и резкие смены погоды осенью.',
    peakDriver: 'Выраженный осенний и майский горный пик («золотая осень», 107% нормы в сентябре)',
  },
  {
    id: 'kravtsovo-smolny',
    shortName: 'Кравцовские и Смольные водопады',
    fullName: 'Экомаршрут «Кравцовские водопады — Смольные пороги — ключ Медвежий»',
    districtName: 'Хасанский / Шкотовский',
    track: 'hiking',
    trackLabel: 'Пешеходный экотуризм',
    difficultyCategory: '1 КС',
    monthlyCapacityThousands: 18,
    groupNorm: 12,
    groupsPerGuideMonth: 14,
    organizedSharePct: 30,
    certifiedGuidesAvailable: 14,
    // Spring snowmelt & autumn weekend flow (~102k/yr)
    monthlyFlowThousands: [1.8, 2.1, 4.2, 8.9, 14.4, 12.8, 13.6, 14.9, 13.8, 10.2, 3.4, 1.8],
    safetyNote: 'Скользкие мостки и камни в распадках в период таяния и дождевых паводков; нужен контроль темпа группы.',
    peakDriver: 'Майское полноводье водопадов и устойчивый трафик выходного дня мая–октября',
  },
  {
    id: 'partizanskaya-water',
    shortName: 'Сплав: р. Партизанская — зал. Восток',
    fullName: 'Водный маршрут «р. Партизанская — бухта Лашкевича — залив Восток»',
    districtName: 'Партизанский округ',
    track: 'water',
    trackLabel: 'Водный и SUP-туризм',
    difficultyCategory: '2 КС (водный)',
    monthlyCapacityThousands: 12,
    groupNorm: 7,
    groupsPerGuideMonth: 9,
    organizedSharePct: 48,
    certifiedGuidesAvailable: 9,
    // May flood + warm July-August rafting/SUP (~54k/yr)
    monthlyFlowThousands: [0.0, 0.0, 0.8, 3.4, 8.2, 9.6, 10.4, 11.2, 6.8, 2.9, 0.5, 0.0],
    safetyNote: 'Обязательна профильная аттестация по водному треку (27 200 ₽ ВВГУ), спасжилеты и береговая страховка.',
    peakDriver: 'Весенний сплавной паводок мая–июня и летний SUP/каякинг июля–августа',
  },
  {
    id: 'lazo-petrova',
    shortName: 'О. Петрова и Беневские водопады',
    fullName: 'Заповедный кластер «Лазовский заповедник — о. Петрова — бухта Тасовая»',
    districtName: 'Лазовский округ',
    track: 'hiking',
    trackLabel: 'Заповедный экотуризм',
    difficultyCategory: '1–2 КС (ООПТ)',
    monthlyCapacityThousands: 9.5,
    groupNorm: 8,
    groupsPerGuideMonth: 10,
    organizedSharePct: 52,
    certifiedGuidesAvailable: 6,
    // High Summer/early autumn OOPT quota (~45k/yr)
    monthlyFlowThousands: [0.3, 0.4, 0.9, 2.1, 4.6, 6.8, 8.9, 9.4, 6.5, 3.8, 1.0, 0.3],
    safetyNote: 'Лимитированная пропускная способность тиссовой рощи на о. Петрова и сложная логистика подъезда.',
    peakDriver: 'Почти 99% загрузка квоты ООПТ в августе при нехватке местных гидов',
  },
  {
    id: 'bikin-taiga',
    shortName: 'Нацпарк «Бикин» (с. Красный Яр)',
    fullName: 'Водно-таёжная экспедиция «Национальный парк «Бикин» — Красный Яр»',
    districtName: 'Пожарский округ',
    track: 'expedition',
    trackLabel: 'Водно-таёжный ООПТ',
    difficultyCategory: '3 КС',
    monthlyCapacityThousands: 4.5,
    groupNorm: 6,
    groupsPerGuideMonth: 6,
    organizedSharePct: 68,
    certifiedGuidesAvailable: 7,
    // Summer-autumn expedition window (~17k/yr)
    monthlyFlowThousands: [0.2, 0.2, 0.4, 0.8, 1.9, 2.8, 3.4, 3.6, 2.4, 1.1, 0.3, 0.2],
    safetyNote: 'Спутниковая связь Garmin inReach, подготовка Wilderness First Aid и совместные программы с ЦАТ.',
    peakDriver: 'Ограниченный экспедиционный сезон (июнь–сентябрь, высокая доля организованных туров)',
  },
  {
    id: 'kema-sikhote',
    shortName: 'Р. Кема и Сихотэ-Алинь',
    fullName: 'Автономная экспедиция «Сихотэ-Алинский заповедник — пороги р. Кема»',
    districtName: 'Тернейский округ',
    track: 'expedition',
    trackLabel: 'Экспедиционный / 3–4 КС',
    difficultyCategory: '3–4 КС',
    monthlyCapacityThousands: 3.2,
    groupNorm: 5,
    groupsPerGuideMonth: 5,
    organizedSharePct: 74,
    certifiedGuidesAvailable: 4,
    // Narrow high-category window (~11k/yr)
    monthlyFlowThousands: [0.0, 0.0, 0.1, 0.3, 0.9, 1.8, 2.6, 2.8, 1.7, 0.6, 0.1, 0.0],
    safetyNote: 'Категорийные пороги 3–4 КС, малые группы 4–5 чел., обязательная регистрация в МЧС и допуск заповедника.',
    peakDriver: 'Пик водно-таёжных экспедиций в июле–августе (острый дефицит кадров 3–4 КС)',
  },
];

export interface HeatmapCellDatum {
  routeId: string;
  routeShortName: string;
  districtName: string;
  monthIndex: number;
  monthLabel: string;
  flowThousands: number;
  capacityThousands: number;
  loadPct: number;
  guidesNeeded: number;
  certifiedGuidesAvailable: number;
  metricValue: number;
  isActiveSeason: boolean;
}

export interface HeatmapRouteSummary {
  profile: PrimoryeRouteFlowProfile;
  annualFlowThousands: number;
  peakFlowThousands: number;
  peakLoadPct: number;
  peakMonthLabel: string;
  peakGuidesNeeded: number;
  guideGapAtPeak: number;
}

export interface PrimoryeHeatmapMatrixResult {
  routes: HeatmapRouteSummary[];
  cells: HeatmapCellDatum[];
  maxMetricValue: number;
  totalAnnualFlowThousands: number;
  overloadedRouteMonthsCount: number;
  peakMonthAggregateLabel: string;
  peakMonthAggregateFlowThousands: number;
}

export function buildPrimoryeHeatmapMatrix(options?: {
  trackFilter?: HeatmapTrackFilter;
  sortMode?: HeatmapSortMode;
  metricMode?: HeatmapMetricMode;
}): PrimoryeHeatmapMatrixResult {
  const trackFilter = options?.trackFilter ?? 'all';
  const sortMode = options?.sortMode ?? 'peakLoad';
  const metricMode = options?.metricMode ?? 'loadPct';

  const filteredProfiles = PRIMORYE_ROUTE_FLOW_PROFILES.filter(
    (p) => trackFilter === 'all' || p.track === trackFilter
  );

  const routeSummaries: HeatmapRouteSummary[] = filteredProfiles.map((profile) => {
    const annualFlowThousands =
      Math.round(profile.monthlyFlowThousands.reduce((acc, v) => acc + v, 0) * 10) / 10;
    let peakFlowThousands = 0;
    let peakMonthIdx = 0;
    profile.monthlyFlowThousands.forEach((val, idx) => {
      if (val > peakFlowThousands) {
        peakFlowThousands = val;
        peakMonthIdx = idx;
      }
    });
    const peakLoadPct = Math.round((peakFlowThousands / profile.monthlyCapacityThousands) * 100);
    const peakGuidesNeeded = Math.max(
      1,
      Math.round(
        ((peakFlowThousands * 1000 * (profile.organizedSharePct / 100)) /
          profile.groupNorm /
          profile.groupsPerGuideMonth)
      )
    );
    return {
      profile,
      annualFlowThousands,
      peakFlowThousands,
      peakLoadPct,
      peakMonthLabel: PRIMORYE_MONTH_LABELS[peakMonthIdx] ?? 'Авг',
      peakGuidesNeeded,
      guideGapAtPeak: Math.max(0, peakGuidesNeeded - profile.certifiedGuidesAvailable),
    };
  });

  if (sortMode === 'peakLoad') {
    routeSummaries.sort((a, b) => b.peakLoadPct - a.peakLoadPct);
  } else if (sortMode === 'annualFlow') {
    routeSummaries.sort((a, b) => b.annualFlowThousands - a.annualFlowThousands);
  }
  // 'southToNorth' keeps canonical geographical order from Khasan -> Vladivostok -> Terney

  const cells: HeatmapCellDatum[] = [];
  let maxMetricValue = 0;
  let overloadedRouteMonthsCount = 0;

  const monthlyTotals = new Array<number>(12).fill(0);

  for (const summary of routeSummaries) {
    const { profile } = summary;
    profile.monthlyFlowThousands.forEach((flowThousands, monthIndex) => {
      monthlyTotals[monthIndex] += flowThousands;
      const loadPct = Math.round((flowThousands / profile.monthlyCapacityThousands) * 100);
      const guidesNeeded =
        flowThousands <= 0
          ? 0
          : Math.max(
              1,
              Math.round(
                (flowThousands * 1000 * (profile.organizedSharePct / 100)) /
                  profile.groupNorm /
                  profile.groupsPerGuideMonth
              )
            );
      if (loadPct >= 90) {
        overloadedRouteMonthsCount += 1;
      }

      const metricValue =
        metricMode === 'loadPct'
          ? loadPct
          : metricMode === 'flowThousands'
            ? flowThousands
            : guidesNeeded;

      if (metricValue > maxMetricValue) {
        maxMetricValue = metricValue;
      }

      cells.push({
        routeId: profile.id,
        routeShortName: profile.shortName,
        districtName: profile.districtName,
        monthIndex,
        monthLabel: PRIMORYE_MONTH_LABELS[monthIndex],
        flowThousands,
        capacityThousands: profile.monthlyCapacityThousands,
        loadPct,
        guidesNeeded,
        certifiedGuidesAvailable: profile.certifiedGuidesAvailable,
        metricValue,
        // Primorye active season corridor: March (index 2) .. November (index 10)
        isActiveSeason: monthIndex >= 2 && monthIndex <= 10,
      });
    });
  }

  let peakMonthIdx = 0;
  let peakMonthAggregateFlowThousands = 0;
  monthlyTotals.forEach((tot, idx) => {
    if (tot > peakMonthAggregateFlowThousands) {
      peakMonthAggregateFlowThousands = Math.round(tot * 10) / 10;
      peakMonthIdx = idx;
    }
  });

  const totalAnnualFlowThousands =
    Math.round(routeSummaries.reduce((acc, r) => acc + r.annualFlowThousands, 0) * 10) / 10;

  return {
    routes: routeSummaries,
    cells,
    maxMetricValue,
    totalAnnualFlowThousands,
    overloadedRouteMonthsCount,
    peakMonthAggregateLabel: PRIMORYE_MONTH_LABELS[peakMonthIdx] ?? 'Авг',
    peakMonthAggregateFlowThousands,
  };
}
