import {
  CERTIFICATION_SCHEDULE,
  formatSessionRange,
  type CertificationSlot,
} from '../data/landingContent.ts';
import { formatRussianDate, type PreparationContour } from './personalRoadmap.ts';

export type RouteComplexityId = '1_ks' | '2_ks' | '3_ks' | '4_plus_ks';
export type RouteDisciplineId = 'hiking' | 'water' | 'expedition';
export type PreparationPaceId = 'intensive' | 'standard' | 'relaxed';

export interface RouteComplexityPreset {
  id: RouteComplexityId;
  codeLabel: string;
  shortTitle: string;
  dfoExamples: string;
  terrainNote: string;
  groupNorm: string;
  minExperienceNote: string;
  /** Base stage durations in days for Контур Б (ДПО), standard pace, hiking track. */
  stageDaysContourB: readonly [number, number, number, number, number, number];
  /** Base stage durations in days for Контур А (Стаж), standard pace, hiking track. */
  stageDaysContourA: readonly [number, number, number, number, number, number];
  baseStudyHoursB: number;
  baseStudyHoursA: number;
  practiceDrillsCount: number;
}

export const ROUTE_COMPLEXITY_PRESETS: readonly RouteComplexityPreset[] = [
  {
    id: '1_ks',
    codeLabel: '1 КС',
    shortTitle: 'Начальная сложность',
    dfoExamples: 'Ливадийский хребет, о. Путятина, экотропы ООПТ Приморья',
    terrainNote: 'Базовый горно-таёжный и прибрежный рельеф, дневные переходы до 15–18 км.',
    groupNorm: 'до 10–12 туристов в группе',
    minExperienceNote: 'Участие в походах 1 КС или обучение по программе ДПО ВВГУ 250 ч.',
    stageDaysContourB: [4, 10, 5, 5, 3, 3], // 30 дн. до экзамена + 3 дн. экзамен
    stageDaysContourA: [4, 5, 4, 4, 3, 3],  // 23 дн.
    baseStudyHoursB: 120,
    baseStudyHoursA: 48,
    practiceDrillsCount: 2,
  },
  {
    id: '2_ks',
    codeLabel: '2 КС',
    shortTitle: 'Средняя сложность',
    dfoExamples: 'Пик Снежный, р. Шкотовка, Авачинский перевал (1А–1Б)',
    terrainNote: 'Локальные препятствия 1А–1Б, организация переправ, автономные ночёвки 4–6 суток.',
    groupNorm: 'до 8–10 туристов в группе',
    minExperienceNote: 'Подтверждённый опыт 1 КС + участие в маршрутах 2 КС или диплом ДПО.',
    stageDaysContourB: [5, 14, 7, 9, 4, 3], // 42 дн.
    stageDaysContourA: [5, 7, 5, 7, 4, 3],  // 31 дн.
    baseStudyHoursB: 175,
    baseStudyHoursA: 72,
    practiceDrillsCount: 3,
  },
  {
    id: '3_ks',
    codeLabel: '3 КС',
    shortTitle: 'Повышенная сложность',
    dfoExamples: 'Верховья р. Бикин, вулканы Камчатки (2А), сплавы Сахалина',
    terrainNote: 'Длительная автономия (7–12 дней), перевалы/пороги 2А–3 к.т., спутниковая связь.',
    groupNorm: 'до 6–8 туристов в группе',
    minExperienceNote: 'Руководство маршрутами 2 КС и подтверждённое участие 3 КС (справки МКК).',
    stageDaysContourB: [6, 18, 10, 14, 5, 3], // 56 дн.
    stageDaysContourA: [6, 10, 8, 10, 5, 3],  // 42 дн.
    baseStudyHoursB: 230,
    baseStudyHoursA: 105,
    practiceDrillsCount: 5,
  },
  {
    id: '4_plus_ks',
    codeLabel: '4+ КС',
    shortTitle: 'Экспедиционные маршруты',
    dfoExamples: 'Курильская гряда, Сихотэ-Алинь (4 КС), ледники Ключевской группы',
    terrainNote: 'Высокая автономия (>12 дней), сложные спасработы малой группой, авиаэвакуация.',
    groupNorm: '4–6 человек (экспедиционный состав)',
    minExperienceNote: 'Обязательное руководство 3 КС, зачётные справки МКК и расширенный WFA.',
    stageDaysContourB: [8, 22, 14, 21, 7, 3], // 75 дн.
    stageDaysContourA: [8, 12, 11, 16, 7, 3], // 57 дн.
    baseStudyHoursB: 280,
    baseStudyHoursA: 140,
    practiceDrillsCount: 7,
  },
] as const;

export interface RouteDisciplineOption {
  id: RouteDisciplineId;
  label: string;
  shortLabel: string;
  extraPrepDays: number;
  fieldModuleNote: string;
}

export const ROUTE_DISCIPLINE_OPTIONS: readonly RouteDisciplineOption[] = [
  {
    id: 'hiking',
    label: 'Пешеходный и горный туризм',
    shortLabel: 'Пешеходный / горный',
    extraPrepDays: 0,
    fieldModuleNote: 'Склон, узлы, переправа маятником и поиск пострадавшего на рельефе.',
  },
  {
    id: 'water',
    label: 'Водный туризм и сплавы',
    shortLabel: 'Водный / сплавы',
    extraPrepDays: 4,
    fieldModuleNote: 'Спасработы «морковкой», постановка кильнутого судна и чтение порогов.',
  },
  {
    id: 'expedition',
    label: 'Экспедиционный и ООПТ ДФО',
    shortLabel: 'Экспедиции / ООПТ',
    extraPrepDays: 6,
    fieldModuleNote: 'Протокол кордонов ООПТ, спутниковый трекер InReach/Иридиум и эвакуация.',
  },
] as const;

export interface PreparationPaceOption {
  id: PreparationPaceId;
  label: string;
  hint: string;
  multiplier: number;
  hoursPerWeek: string;
}

export const PREPARATION_PACE_OPTIONS: readonly PreparationPaceOption[] = [
  {
    id: 'intensive',
    label: 'Интенсивный',
    hint: 'Ежедневно 2–3 ч + полигон в выходные',
    multiplier: 0.78,
    hoursPerWeek: '18–22 ч/нед.',
  },
  {
    id: 'standard',
    label: 'Стандартный',
    hint: 'Вечерние модули + выезд 1 раз в неделю',
    multiplier: 1.0,
    hoursPerWeek: '10–14 ч/нед.',
  },
  {
    id: 'relaxed',
    label: 'Размеренный',
    hint: 'Без отрыва от туров и основной работы',
    multiplier: 1.3,
    hoursPerWeek: '6–8 ч/нед.',
  },
] as const;

export interface ComplexityRoadmapInput {
  complexityId: RouteComplexityId;
  contour: PreparationContour;
  disciplineId: RouteDisciplineId;
  paceId: PreparationPaceId;
  startDateIso: string;
}

export type RoadmapPhaseTone = 'slate' | 'teal' | 'amber' | 'sky' | 'emerald';

export interface ComplexityRoadmapStage {
  id: string;
  order: number;
  phaseTag: string;
  title: string;
  summary: string;
  deliverable: string;
  checklistPoints: string[];
  durationDays: number;
  offsetStartDay: number;
  offsetEndDay: number;
  startDateIso: string;
  endDateIso: string;
  startDateFormatted: string;
  endDateFormatted: string;
  /** Horizontal timeline bar left offset in percent (0..100). */
  leftPercent: number;
  /** Horizontal timeline bar width in percent (0..100). */
  widthPercent: number;
  tone: RoadmapPhaseTone;
  isExamStage: boolean;
}

export interface MatchedAttestationSession {
  index: number;
  startIso: string;
  endIso: string;
  rangeLabel: string;
  category: string;
  bufferDaysAfterPrep: number;
  dossierDeadlineIso: string;
  dossierDeadlineFormatted: string;
  fitsBeforeDeadline: boolean;
}

export interface ComplexityRoadmapResult {
  input: ComplexityRoadmapInput;
  preset: RouteComplexityPreset;
  discipline: RouteDisciplineOption;
  pace: PreparationPaceOption;
  stages: ComplexityRoadmapStage[];
  /** Days spent preparing before the exam session starts (stages 1–5). */
  prepDaysBeforeExam: number;
  /** Total span including the 3-day exam / EFRTA registration stage. */
  totalDurationDays: number;
  estimatedWeeks: number;
  studyHoursTotal: number;
  startDateIso: string;
  startDateFormatted: string;
  estimatedReadyIso: string;
  estimatedReadyFormatted: string;
  estimatedCompletionIso: string;
  estimatedCompletionFormatted: string;
  recommendedSession: MatchedAttestationSession | null;
  alternativeSession: MatchedAttestationSession | null;
}

function addUtcDays(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    return isoDate;
  }
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function diffUtcDays(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime();
  const b = new Date(`${toIso}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function scaleDays(baseDays: number, multiplier: number, minDays: number): number {
  return Math.max(minDays, Math.round(baseDays * multiplier));
}

function sessionSupportsComplexity(
  slot: CertificationSlot,
  complexityId: RouteComplexityId
): boolean {
  const category = slot.category.toUpperCase();
  if (category.includes('1–4') || category.includes('1-4')) return true;
  if (complexityId === '1_ks') return /1/.test(category);
  if (complexityId === '2_ks') return /1–3|1-3|2–4|2-4|2/.test(category);
  if (complexityId === '3_ks') return /1–3|1-3|2–4|2-4|3/.test(category);
  return /4/.test(category);
}

function findMatchingSessions(
  readyIso: string,
  complexityId: RouteComplexityId
): {
  recommended: MatchedAttestationSession | null;
  alternative: MatchedAttestationSession | null;
} {
  const eligible = CERTIFICATION_SCHEDULE.map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => sessionSupportsComplexity(slot, complexityId))
    .map(({ slot, index }): MatchedAttestationSession => {
      const bufferDays = diffUtcDays(readyIso, slot.start);
      const dossierDeadlineIso = addUtcDays(slot.start, -10);
      return {
        index,
        startIso: slot.start,
        endIso: slot.end,
        rangeLabel: formatSessionRange(slot.start, slot.end),
        category: slot.category,
        bufferDaysAfterPrep: bufferDays,
        dossierDeadlineIso,
        dossierDeadlineFormatted: formatRussianDate(dossierDeadlineIso),
        fitsBeforeDeadline: bufferDays >= 0,
      };
    });

  const futureMatches = eligible.filter((s) => s.bufferDaysAfterPrep >= 0);
  if (futureMatches.length > 0) {
    return {
      recommended: futureMatches[0],
      alternative: futureMatches[1] ?? null,
    };
  }
  return {
    recommended: null,
    alternative: eligible[eligible.length - 1] ?? null,
  };
}

export function buildComplexityPreparationRoadmap(
  rawInput: ComplexityRoadmapInput
): ComplexityRoadmapResult {
  const preset =
    ROUTE_COMPLEXITY_PRESETS.find((p) => p.id === rawInput.complexityId) ??
    ROUTE_COMPLEXITY_PRESETS[1];
  const discipline =
    ROUTE_DISCIPLINE_OPTIONS.find((d) => d.id === rawInput.disciplineId) ??
    ROUTE_DISCIPLINE_OPTIONS[0];
  const pace =
    PREPARATION_PACE_OPTIONS.find((p) => p.id === rawInput.paceId) ??
    PREPARATION_PACE_OPTIONS[1];
  const contour: PreparationContour =
    rawInput.contour === 'contour_a' ? 'contour_a' : 'contour_b';
  const startDateIso = isValidIsoDate(rawInput.startDateIso)
    ? rawInput.startDateIso
    : '2027-02-01';

  const baseStages =
    contour === 'contour_b' ? preset.stageDaysContourB : preset.stageDaysContourA;

  // Stage 1–5 scale with pace; stage 4 (field/passport) also receives discipline extra days; stage 6 is official 3-day exam.
  const d1 = scaleDays(baseStages[0], pace.multiplier, 2);
  const d2 = scaleDays(baseStages[1], pace.multiplier, 3);
  const d3 = scaleDays(baseStages[2] + Math.floor(discipline.extraPrepDays / 2), pace.multiplier, 3);
  const d4 = scaleDays(baseStages[3] + Math.ceil(discipline.extraPrepDays / 2), pace.multiplier, 3);
  const d5 = scaleDays(baseStages[4], pace.multiplier, 2);
  const d6 = baseStages[5]; // Fixed 3-day commission session & protocol

  const durations = [d1, d2, d3, d4, d5, d6] as const;
  const prepDaysBeforeExam = d1 + d2 + d3 + d4 + d5;
  const totalDurationDays = prepDaysBeforeExam + d6;

  const isHigherComplexity = preset.id === '3_ks' || preset.id === '4_plus_ks';

  const stageSpecs: Array<{
    id: string;
    phaseTag: string;
    title: string;
    summary: string;
    deliverable: string;
    checklistPoints: string[];
    tone: RoadmapPhaseTone;
    isExamStage: boolean;
  }> = [
    {
      id: 'audit_docs',
      phaseTag: 'Этап 1 · Допуск и медкомиссия',
      title: 'Аудит походного стажа и медзаключение',
      summary: `Сверка квалификационных требований под категорию ${preset.codeLabel} (${preset.shortTitle}) и оформление медицинской справки.`,
      deliverable: 'Пакет справок МКК / трудовой книжки и медзаключение без противопоказаний',
      checklistPoints: [
        preset.minExperienceNote,
        'Справка о прохождении медосмотра (приказ Минздрава для работы на маршрутах)',
        'Подбор фото 3×4, СНИЛС и выписка профильного образования',
      ],
      tone: 'slate',
      isExamStage: false,
    },
    {
      id: 'contour_theory',
      phaseTag:
        contour === 'contour_b'
          ? 'Этап 2 · ДПО ВВГУ 250 ч'
          : 'Этап 2 · Повторение НПА',
      title:
        contour === 'contour_b'
          ? 'Учебные модули ДПО и правовой блок'
          : 'Повтор нормативной базы 132-ФЗ и ПП № 1893',
      summary:
        contour === 'contour_b'
          ? `Изучение теории по 132-ФЗ, ПП РФ № 1003/1893, топографии и управлению группой (${preset.groupNorm}).`
          : `Интенсивная проработка изменений ПП РФ № 1893, правил ЕФРТА и экзаменационных билетов ${preset.codeLabel}.`,
      deliverable:
        contour === 'contour_b'
          ? 'Зачтённые учебные модули ВВГУ и пробный тест >= 85%'
          : 'Пробный тест теории >= 85% по билетам категории',
      checklistPoints: [
        'ФЗ № 132-ФЗ «Об основах туристской деятельности» и ПП РФ № 1893',
        `Тактика ведения группы (${preset.groupNorm}) и права/обязанности проводника`,
        'Алгоритм регистрации группы в МЧС (за 10 дней) и правила ООПТ ДФО',
      ],
      tone: 'teal',
      isExamStage: false,
    },
    {
      id: 'safety_wfa',
      phaseTag: 'Этап 3 · Безопасность и ПСР',
      title: `Первая помощь (WFA) и спасработы (${discipline.shortLabel})`,
      summary: `Отработка автономной помощи пострадавшему до прибытия спасателей с учётом профиля «${discipline.shortLabel}».`,
      deliverable: `Зачёт по WFA и ${preset.practiceDrillsCount} практических сценария ПСР`,
      checklistPoints: [
        'Иммобилизация, гипотермия, шок и сортировка пострадавших в автономии',
        discipline.fieldModuleNote,
        isHigherComplexity
          ? 'Протокол вертолётной/наземной эвакуации и радиообмен малой группой'
          : 'Сборка укрытия, сигнальные средства и контроль состояния группы на стоянке',
      ],
      tone: 'amber',
      isExamStage: false,
    },
    {
      id: 'passport_field',
      phaseTag: 'Этап 4 · Паспорт № 760 и полигон',
      title: `Паспорт маршрута ПП № 760 (${preset.codeLabel}) и выезд`,
      summary: `Разработка технологической карты эталонного маршрута (${preset.dfoExamples}) и полевая тренировка.`,
      deliverable: 'Утверждённый черновик паспорта по форме № 760 + трек полигона',
      checklistPoints: [
        `Профиль маршрута: ${preset.terrainNote}`,
        'Матрица рисков, график прохождения КП и аварийные выходы при ЧС',
        'Тренировочный выход на полигон с проверкой узлов, навигации и страховки',
      ],
      tone: 'sky',
      isExamStage: false,
    },
    {
      id: 'dossier_filing',
      phaseTag: 'Этап 5 · Заявка в РЦА',
      title: 'Подача досье на Госуслугах / ФСТР и допуск',
      summary:
        'Финальная проверка комплекта документов комиссией РЦА минимум за 10 календарных дней до очного потока.',
      deliverable: 'Официальное уведомление о допуске к аттестационной сессии',
      checklistPoints: [
        'Подача электронного заявления и оплата госпошлины за реестровую запись',
        'Загрузка паспорта маршрута № 760 и подтверждений походного опыта',
        'Бронирование слота на очно-полевой экзамен (ВВГУ + Шкотовский полигон)',
      ],
      tone: 'teal',
      isExamStage: false,
    },
    {
      id: 'exam_efrta',
      phaseTag: 'Этап 6 · Аттестация и ЕФРТА',
      title: 'Очный экзамен в РЦА и внесение в ЕФРТА',
      summary: `3-дневная сессия комиссии ВВГУ/ФСТР (${preset.codeLabel}), защита паспорта и выдача нагрудного бейджа.`,
      deliverable: `Протокол аттестации ${preset.codeLabel} на 5 лет в реестре ЕФРТА`,
      checklistPoints: [
        'День 1: очное тестирование в кампусе ВВГУ и защита паспорта № 760',
        'День 2–3: полевой полигон — ориентирование, переправы и оказание ПП',
        'Передача данных в Минэкономразвития и активация ID проводника на 5 лет',
      ],
      tone: 'emerald',
      isExamStage: true,
    },
  ];

  let cursorDay = 0;
  const stages: ComplexityRoadmapStage[] = stageSpecs.map((spec, idx) => {
    const durationDays = durations[idx];
    const offsetStartDay = cursorDay;
    const offsetEndDay = cursorDay + durationDays;
    cursorDay = offsetEndDay;

    const stageStartIso = addUtcDays(startDateIso, offsetStartDay);
    const stageEndIso = addUtcDays(startDateIso, Math.max(offsetStartDay, offsetEndDay - 1));

    const leftPercent = Number(((offsetStartDay / totalDurationDays) * 100).toFixed(2));
    const widthPercent = Number(((durationDays / totalDurationDays) * 100).toFixed(2));

    return {
      ...spec,
      order: idx + 1,
      durationDays,
      offsetStartDay,
      offsetEndDay,
      startDateIso: stageStartIso,
      endDateIso: stageEndIso,
      startDateFormatted: formatRussianDate(stageStartIso),
      endDateFormatted: formatRussianDate(stageEndIso),
      leftPercent,
      widthPercent,
    };
  });

  const estimatedReadyIso = addUtcDays(startDateIso, prepDaysBeforeExam);
  const estimatedCompletionIso = addUtcDays(startDateIso, totalDurationDays - 1);
  const baseHours =
    contour === 'contour_b' ? preset.baseStudyHoursB : preset.baseStudyHoursA;
  const studyHoursTotal = baseHours + discipline.extraPrepDays * 3;
  const { recommended, alternative } = findMatchingSessions(estimatedReadyIso, preset.id);

  return {
    input: {
      complexityId: preset.id,
      contour,
      disciplineId: discipline.id,
      paceId: pace.id,
      startDateIso,
    },
    preset,
    discipline,
    pace,
    stages,
    prepDaysBeforeExam,
    totalDurationDays,
    estimatedWeeks: Number((prepDaysBeforeExam / 7).toFixed(1)),
    studyHoursTotal,
    startDateIso,
    startDateFormatted: formatRussianDate(startDateIso),
    estimatedReadyIso,
    estimatedReadyFormatted: formatRussianDate(estimatedReadyIso),
    estimatedCompletionIso,
    estimatedCompletionFormatted: formatRussianDate(estimatedCompletionIso),
    recommendedSession: recommended,
    alternativeSession: alternative,
  };
}

export function inferComplexityFromDifficultyLabel(
  difficultyLabel: string
): RouteComplexityId {
  if (/4/.test(difficultyLabel)) return '4_plus_ks';
  if (/3/.test(difficultyLabel)) return '3_ks';
  if (/2/.test(difficultyLabel)) return '2_ks';
  return '1_ks';
}

export function formatComplexityRoadmapText(plan: ComplexityRoadmapResult): string {
  const contourTitle =
    plan.input.contour === 'contour_b'
      ? 'Контур Б (ДПО ВВГУ 250 ч)'
      : 'Контур А (подтверждение стажа)';
  const lines = [
    `Дорожная карта подготовки инструктора-проводника · ${plan.preset.codeLabel} (${plan.preset.shortTitle})`,
    `Профиль: ${plan.discipline.label}`,
    `Контур и темп: ${contourTitle} · ${plan.pace.label} (${plan.pace.hoursPerWeek})`,
    `Старт подготовки: ${plan.startDateFormatted}`,
    `Готовность к экзамену: ${plan.estimatedReadyFormatted} (${plan.prepDaysBeforeExam} дн. / ~${plan.estimatedWeeks} нед., ${plan.studyHoursTotal} ч)`,
    `Финал аттестации (вкл. 3 дня сессии): ${plan.estimatedCompletionFormatted}`,
    plan.recommendedSession
      ? `Рекомендуемая сессия РЦА: ${plan.recommendedSession.rangeLabel} (${plan.recommendedSession.category}), подача досье до ${plan.recommendedSession.dossierDeadlineFormatted}`
      : 'Рекомендуемая сессия РЦА: за пределами опубликованного графика 2027 г. (уточнить в комиссии)',
    '',
    'Этапы подготовки:',
    ...plan.stages.map(
      (s) =>
        `${s.order}. ${s.title} (${s.startDateFormatted} — ${s.endDateFormatted}, ${s.durationDays} дн.) — ${s.deliverable}`
    ),
  ];
  return lines.join('\n');
}

