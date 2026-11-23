import { CERTIFICATION_SCHEDULE } from '../data/landingContent.ts';

export type AttestationPathStageId = 'application' | 'training' | 'exam' | 'certificate';

export type AttestationPathStepState = 'completed' | 'current' | 'upcoming';

export type PreparationContourPath = 'contour_b' | 'contour_a';

export type DeadlineUrgency = 'completed' | 'overdue' | 'urgent' | 'soon' | 'on_track';

export type AttestationPathActionKind =
  | 'open_application'
  | 'open_checklist'
  | 'open_roadmap'
  | 'open_passport';

export interface PathTaskDef {
  id: string;
  label: string;
  hint: string;
}

export interface PathStageMeta {
  id: AttestationPathStageId;
  stepNumber: string;
  title: string;
  shortTitle: string;
  durationHint: string;
  summary: string;
  outputLabel: string;
  tasks: PathTaskDef[];
}

export interface AttestationSummaryStageInput {
  stage: PathStageMeta;
  completedCount: number;
  totalCount: number;
  percent: number;
  status: 'completed' | 'in_progress' | 'pending';
}

export interface AttestationSummaryInput {
  percent: number;
  completedTasks: number;
  totalTasks: number;
  completedStages: number;
  activeStage: PathStageMeta;
  stages: AttestationSummaryStageInput[];
  resolvedCompletedSet: Set<string>;
}

export interface AttestationInquiryInput {
  id: string;
  track: string;
  status: 'new' | 'in_review' | 'approved' | 'rejected';
  createdAt: string;
}

export interface AttestationPathOptions {
  /** Reference calendar date in YYYY-MM-DD (defaults to current UTC date). */
  todayIso?: string;
  /** Target exam session start date in YYYY-MM-DD (defaults to nearest upcoming schedule slot). */
  examDateIso?: string;
  /** Candidate preparation track determining regulatory lead times. */
  contour?: PreparationContourPath;
}

export interface PathStepTaskItem extends PathTaskDef {
  completed: boolean;
}

export interface StageDeadlineInfo {
  deadlineIso: string;
  deadlineFormatted: string;
  deadlineShortFormatted: string;
  regulationRule: string;
  daysRemaining: number;
  urgency: DeadlineUrgency;
  countdownLabel: string;
  urgencyLabel: string;
}

export interface NextStageTimerInfo {
  targetTitle: string;
  nextStageShortTitle: string | null;
  targetDateIso: string;
  targetDateFormatted: string;
  daysRemaining: number;
  urgency: DeadlineUrgency;
  countdownText: string;
  regulationNote: string;
  overdueStepsCount: number;
  urgentStepsCount: number;
  examDateIso: string;
  examDateFormatted: string;
  contour: PreparationContourPath;
}

export interface AttestationPathStepView {
  index: number;
  id: AttestationPathStageId;
  stepNumber: string;
  title: string;
  shortTitle: string;
  durationHint: string;
  summary: string;
  outputLabel: string;
  completedCount: number;
  totalCount: number;
  stagePercent: number;
  stepState: AttestationPathStepState;
  stateLabel: string;
  isCurrent: boolean;
  isCompleted: boolean;
  deadline: StageDeadlineInfo;
  tasks: PathStepTaskItem[];
  nextHint: string;
  primaryAction: {
    kind: AttestationPathActionKind;
    label: string;
  };
}

export interface AttestationPathViewModel {
  isAllCompleted: boolean;
  todayIso: string;
  overallPercent: number;
  completedTasks: number;
  totalTasks: number;
  completedStages: number;
  totalStages: number;
  currentStepIndex: number;
  currentStageId: AttestationPathStageId;
  currentStageTitle: string;
  /** Connector fill 0..100 spanning centers of stage 1 to stage 4. */
  trackProgressPercent: number;
  headlineStatus: string;
  nextStageTimer: NextStageTimerInfo;
  latestInquirySummary: {
    track: string;
    status: AttestationInquiryInput['status'];
    statusLabel: string;
  } | null;
  steps: AttestationPathStepView[];
}

export const ATTESTATION_PATH_STAGES: PathStageMeta[] = [
  {
    id: 'application',
    stepNumber: '01',
    title: 'Подача заявки',
    shortTitle: 'Подача заявки',
    durationHint: '1–3 рабочих дня',
    summary:
      'Заполнение анкеты в РЦА «Русский Восток», выбор категории маршрута и первичная проверка пакета документов соискателя.',
    outputLabel: 'Заявка зарегистрирована и принята куратором РЦА',
    tasks: [
      {
        id: 'app_profile',
        label: 'Заполнены профиль, регион присутствия и организация',
        hint: 'Синхронизируется автоматически из карточки профиля',
      },
      {
        id: 'app_inquiry',
        label: 'Подана заявка на аттестацию в РЦА «Русский Восток»',
        hint: 'Отслеживается автоматически по разделу «Мои заявки»',
      },
      {
        id: 'app_docs',
        label: 'Проверены медсправка и подтверждение походного стажа',
        hint: 'Подтверждается при переводе заявки в работу или вручную',
      },
    ],
  },
  {
    id: 'training',
    stepNumber: '02',
    title: 'Обучение',
    shortTitle: 'Обучение',
    durationHint: 'до 6 недель (ДПО ВВГУ)',
    summary:
      'Прохождение модульной переподготовки ДПО ВВГУ (≈ 250 ч) либо верификация практики по Контуру А с оформлением паспорта маршрута.',
    outputLabel: 'Допуск кафедры и согласованный паспорт маршрута',
    tasks: [
      {
        id: 'trn_track',
        label: 'Выбран образовательный трек (ДПО ВВГУ или Контур А)',
        hint: 'Соответствует категории сложности и региону ДФО',
      },
      {
        id: 'trn_modules',
        label: 'Изучены модули безопасности, ПП № 1893 и первой помощи',
        hint: 'Теория доступна дистанционно для всех субъектов ДФО',
      },
      {
        id: 'trn_passport',
        label: 'Подготовлен паспорт туристского маршрута (ПП № 760)',
        hint: 'Схемы эвакуации, точки связи и контрольные сроки',
      },
    ],
  },
  {
    id: 'exam',
    stepNumber: '03',
    title: 'Экзамен',
    shortTitle: 'Экзамен',
    durationHint: '2–3 дня очной сессии',
    summary:
      'Теоретическое тестирование, защита паспорта маршрута и практическая проверка навыков сопровождения группы на полигоне.',
    outputLabel: 'Успешная сдача теории и практического зачёта',
    tasks: [
      {
        id: 'exm_theory',
        label: 'Пройдено тестирование по нормативным и тактическим вопросам',
        hint: 'Компьютерный тест перед аттестационной комиссией',
      },
      {
        id: 'exm_defense',
        label: 'Защищён паспорт маршрута и план действий в ЧС',
        hint: 'Оценка рисков, связи и взаимодействия с МЧС',
      },
      {
        id: 'exm_field',
        label: 'Сдан полевой этап на полигоне (Шкотовский р-н / выезд)',
        hint: 'Практика ориентирования, переправ и спасработ',
      },
    ],
  },
  {
    id: 'certificate',
    stepNumber: '04',
    title: 'Получение свидетельства',
    shortTitle: 'Свидетельство',
    durationHint: 'до 5 рабочих дней',
    summary:
      'Оформление протокола комиссии, внесение сведений в Единый федеральный реестр инструкторов-проводников и выдача бейджа.',
    outputLabel: 'Действующий статус в реестре сроком на 5 лет',
    tasks: [
      {
        id: 'crt_protocol',
        label: 'Подписан итоговый протокол аттестационной комиссии',
        hint: 'Утверждается председателем и экспертами ФСТР / ВВГУ',
      },
      {
        id: 'crt_registry',
        label: 'Запись внесена в Единый федеральный реестр проводников',
        hint: 'Присвоен уникальный реестровый номер',
      },
      {
        id: 'crt_badge',
        label: 'Получены свидетельство и нагрудная карточка-бейдж (5 лет)',
        hint: 'Документ подтверждает право сопровождения на маршрутах',
      },
    ],
  },
];

const INQUIRY_STATUS_LABELS: Record<AttestationInquiryInput['status'], string> = {
  new: 'Новая заявка',
  in_review: 'На рассмотрении',
  approved: 'Одобрена',
  rejected: 'Отклонена',
};

const MONTHS_GENITIVE_RU = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

function addUtcDays(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function diffUtcDays(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime();
  const b = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

function formatRussianDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return `${d.getUTCDate()} ${MONTHS_GENITIVE_RU[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function formatShortRuDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}.${m}.${y}`;
}

export function formatDaysRu(count: number): string {
  const abs = Math.abs(Math.trunc(count));
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${abs} дней`;
  if (mod10 === 1) return `${abs} день`;
  if (mod10 >= 2 && mod10 <= 4) return `${abs} дня`;
  return `${abs} дней`;
}

export function resolveDefaultExamDateIso(todayIso: string): string {
  const upcoming = CERTIFICATION_SCHEDULE.find((slot) => slot.start >= todayIso);
  return (
    upcoming?.start ??
    CERTIFICATION_SCHEDULE[0]?.start ??
    '2027-04-16'
  );
}

function getStageRegulationSpec(
  stageId: AttestationPathStageId,
  contour: PreparationContourPath
): { offsetDays: number; rule: string } {
  switch (stageId) {
    case 'application':
      return contour === 'contour_b'
        ? {
            offsetDays: -38,
            rule: 'Регламент ДПО: подача заявки не позднее чем за 38 дн. до экзамена',
          }
        : {
            offsetDays: -21,
            rule: 'Регламент Контура А: подача заявки не позднее чем за 21 день до экзамена',
          };
    case 'training':
      return {
        offsetDays: -7,
        rule: 'Регламент ПП № 760: завершение обучения и паспорта маршрута за 7 дн. до сессии',
      };
    case 'exam':
      return {
        offsetDays: 0,
        rule: 'Календарный график РЦА: дата старта очной аттестационной сессии',
      };
    case 'certificate':
      return {
        offsetDays: 5,
        rule: 'Регламент ФСТР: оформление протокола и внесение в реестр в течение 5 дн. после экзамена',
      };
  }
}

export function classifyDeadlineUrgency(
  daysRemaining: number,
  isCompleted: boolean
): DeadlineUrgency {
  if (isCompleted) return 'completed';
  if (daysRemaining < 0) return 'overdue';
  if (daysRemaining <= 7) return 'urgent';
  if (daysRemaining <= 21) return 'soon';
  return 'on_track';
}

function computeStageDeadline(
  stageId: AttestationPathStageId,
  isCompleted: boolean,
  todayIso: string,
  examDateIso: string,
  contour: PreparationContourPath
): StageDeadlineInfo {
  const spec = getStageRegulationSpec(stageId, contour);
  const deadlineIso = addUtcDays(examDateIso, spec.offsetDays);
  const daysRemaining = diffUtcDays(todayIso, deadlineIso);
  const urgency = classifyDeadlineUrgency(daysRemaining, isCompleted);

  let countdownLabel: string;
  let urgencyLabel: string;

  switch (urgency) {
    case 'completed':
      countdownLabel = 'Выполнено';
      urgencyLabel = 'Завершён';
      break;
    case 'overdue':
      countdownLabel = `Просрочен на ${formatDaysRu(Math.abs(daysRemaining))}`;
      urgencyLabel = 'Дедлайн просрочен';
      break;
    case 'urgent':
      countdownLabel =
        daysRemaining === 0
          ? 'Дедлайн сегодня'
          : `Осталось ${formatDaysRu(daysRemaining)}`;
      urgencyLabel = 'Дедлайн приближается';
      break;
    case 'soon':
      countdownLabel = `Осталось ${formatDaysRu(daysRemaining)}`;
      urgencyLabel = 'Скоро дедлайн';
      break;
    case 'on_track':
    default:
      countdownLabel = `Осталось ${formatDaysRu(daysRemaining)}`;
      urgencyLabel = 'По регламенту';
      break;
  }

  return {
    deadlineIso,
    deadlineFormatted: formatRussianDate(deadlineIso),
    deadlineShortFormatted: formatShortRuDate(deadlineIso),
    regulationRule: spec.rule,
    daysRemaining,
    urgency,
    countdownLabel,
    urgencyLabel,
  };
}

function resolveNextHintAndAction(
  stageId: AttestationPathStageId,
  stepState: AttestationPathStepState,
  completedTasks: PathStepTaskItem[],
  inquiries: AttestationInquiryInput[],
  deadline: StageDeadlineInfo
): { nextHint: string; primaryAction: { kind: AttestationPathActionKind; label: string } } {
  const remaining = completedTasks.filter((t) => !t.completed);
  const latestInquiry = inquiries[0] ?? null;

  if (stepState === 'completed') {
    if (stageId === 'certificate') {
      return {
        nextHint:
          'Все шаги аттестации выполнены. Сведения актуальны для цифрового паспорта и проверки в реестре.',
        primaryAction: {
          kind: 'open_passport',
          label: 'Открыть цифровой паспорт',
        },
      };
    }
    return {
      nextHint: 'Этап полностью завершён. При необходимости отметки можно скорректировать в чек-листе.',
      primaryAction: {
        kind: 'open_checklist',
        label: 'Просмотреть чек-лист этапа',
      },
    };
  }

  const deadlineSuffix =
    deadline.urgency === 'overdue'
      ? ` Регламентный срок (${deadline.deadlineFormatted}) уже наступил — рекомендуем ускорить выполнение.`
      : deadline.urgency === 'urgent'
      ? ` До дедлайна осталось ${formatDaysRu(deadline.daysRemaining)} (${deadline.deadlineFormatted}).`
      : '';

  if (stageId === 'application') {
    if (!latestInquiry) {
      return {
        nextHint: `Подайте первичную заявку на аттестацию с главной страницы, чтобы зафиксировать трек и перевести этап в работу.${deadlineSuffix}`,
        primaryAction: {
          kind: 'open_application',
          label: 'Подать заявку',
        },
      };
    }
    if (latestInquiry.status === 'rejected') {
      return {
        nextHint: `Последняя заявка отклонена — уточните данные маршрута и отправьте повторную анкету.${deadlineSuffix}`,
        primaryAction: {
          kind: 'open_application',
          label: 'Обновить заявку',
        },
      };
    }
    const nextItem = remaining[0];
    return {
      nextHint: nextItem
        ? `Следующий шаг: ${nextItem.label.toLowerCase()}.${deadlineSuffix}`
        : `Дождитесь подтверждения документов куратором РЦА.${deadlineSuffix}`,
      primaryAction: {
        kind: 'open_checklist',
        label: 'Открыть чек-лист этапа',
      },
    };
  }

  if (stageId === 'training') {
    const nextItem = remaining[0];
    return {
      nextHint: nextItem
        ? `Текущий фокус обучения: ${nextItem.label.toLowerCase()}.${deadlineSuffix}`
        : `Подготовьте паспорт маршрута и перейдите к выбору даты экзамена.${deadlineSuffix}`,
      primaryAction: {
        kind: 'open_checklist',
        label: 'Перейти к задачам этапа',
      },
    };
  }

  if (stageId === 'exam') {
    const nextItem = remaining[0];
    return {
      nextHint: nextItem
        ? `Допуск и сдача сессии: ${nextItem.label.toLowerCase()}. Выберите удобную дату в графике аттестаций.${deadlineSuffix}`
        : `Зафиксируйте прохождение полевого этапа в чек-листе.${deadlineSuffix}`,
      primaryAction: {
        kind: 'open_roadmap',
        label: 'График экзаменов',
      },
    };
  }

  // certificate
  const nextItem = remaining[0];
  return {
    nextHint: nextItem
      ? `Финальное оформление: ${nextItem.label.toLowerCase()}.${deadlineSuffix}`
      : `Проверьте запись в реестре и выгрузите цифровой паспорт.${deadlineSuffix}`,
    primaryAction: {
      kind: 'open_checklist',
      label: 'Проверить статус выдачи',
    },
  };
}

/**
 * Derives a connected 4-step path view model highlighting completed,
 * active ("current") and upcoming stages, together with regulatory deadlines
 * and time-until-next-stage indicators based on the current date.
 */
export function buildAttestationPathViewModel(
  summary: AttestationSummaryInput,
  inquiries: AttestationInquiryInput[] = [],
  options: AttestationPathOptions = {}
): AttestationPathViewModel {
  const todayIso =
    options.todayIso && /^\d{4}-\d{2}-\d{2}$/.test(options.todayIso)
      ? options.todayIso
      : new Date().toISOString().slice(0, 10);
  const examDateIso =
    options.examDateIso && /^\d{4}-\d{2}-\d{2}$/.test(options.examDateIso)
      ? options.examDateIso
      : resolveDefaultExamDateIso(todayIso);
  const contour: PreparationContourPath =
    options.contour === 'contour_a' ? 'contour_a' : 'contour_b';

  const isAllCompleted = summary.percent === 100 || summary.completedStages === summary.stages.length;
  const activeId = summary.activeStage.id;
  const totalStages = Math.max(summary.stages.length, 1);

  const steps: AttestationPathStepView[] = summary.stages.map((item, index) => {
    const { stage, completedCount, totalCount, percent, status } = item;

    let stepState: AttestationPathStepState;
    if (status === 'completed') {
      stepState = 'completed';
    } else if (!isAllCompleted && stage.id === activeId) {
      stepState = 'current';
    } else {
      stepState = 'upcoming';
    }

    const isCompleted = stepState === 'completed';

    const stateLabel =
      stepState === 'completed'
        ? 'Завершён'
        : stepState === 'current'
        ? completedCount > 0
          ? 'Текущий · в работе'
          : 'Текущий этап'
        : 'Предстоит';

    const deadline = computeStageDeadline(
      stage.id,
      isCompleted,
      todayIso,
      examDateIso,
      contour
    );

    const tasks: PathStepTaskItem[] = stage.tasks.map((t) => ({
      ...t,
      completed: summary.resolvedCompletedSet.has(t.id),
    }));

    const { nextHint, primaryAction } = resolveNextHintAndAction(
      stage.id,
      stepState,
      tasks,
      inquiries,
      deadline
    );

    return {
      index,
      id: stage.id,
      stepNumber: stage.stepNumber,
      title: stage.title,
      shortTitle: stage.shortTitle,
      durationHint: stage.durationHint,
      summary: stage.summary,
      outputLabel: stage.outputLabel,
      completedCount,
      totalCount,
      stagePercent: percent,
      stepState,
      stateLabel,
      isCurrent: stepState === 'current',
      isCompleted,
      deadline,
      tasks,
      nextHint,
      primaryAction,
    };
  });

  const foundCurrentIndex = steps.findIndex((s) => s.isCurrent);
  const currentStepIndex = isAllCompleted
    ? totalStages - 1
    : foundCurrentIndex >= 0
    ? foundCurrentIndex
    : 0;

  let trackProgressPercent = 0;
  if (isAllCompleted) {
    trackProgressPercent = 100;
  } else if (totalStages > 1) {
    const segmentSpan = 100 / (totalStages - 1);
    const activeStep = steps[currentStepIndex];
    const intraStepFraction =
      activeStep && activeStep.totalCount > 0
        ? (activeStep.completedCount / activeStep.totalCount) * 0.5
        : 0;
    trackProgressPercent = Math.min(
      100,
      Math.max(0, Math.round((currentStepIndex + intraStepFraction) * segmentSpan))
    );
  }

  const currentStep = steps[currentStepIndex] ?? steps[0];
  const nextStep = !isAllCompleted ? steps[currentStepIndex + 1] ?? null : null;
  const overdueStepsCount = steps.filter((s) => s.deadline.urgency === 'overdue').length;
  const urgentStepsCount = steps.filter(
    (s) => s.deadline.urgency === 'urgent' || s.deadline.urgency === 'soon'
  ).length;

  let nextStageTimer: NextStageTimerInfo;
  if (isAllCompleted) {
    nextStageTimer = {
      targetTitle: 'Все этапы пути завершены',
      nextStageShortTitle: null,
      targetDateIso: currentStep.deadline.deadlineIso,
      targetDateFormatted: currentStep.deadline.deadlineFormatted,
      daysRemaining: 0,
      urgency: 'completed',
      countdownText: 'Аттестация пройдена в полном объёме',
      regulationNote: 'Реестровая запись действует 5 лет с даты утверждения протокола.',
      overdueStepsCount: 0,
      urgentStepsCount: 0,
      examDateIso,
      examDateFormatted: formatRussianDate(examDateIso),
      contour,
    };
  } else {
    const targetDeadline = currentStep.deadline;
    const targetTitle = nextStep
      ? `До перехода на этап ${nextStep.stepNumber} «${nextStep.shortTitle}»`
      : `До завершения этапа ${currentStep.stepNumber} «${currentStep.shortTitle}»`;

    const countdownText =
      targetDeadline.urgency === 'overdue'
        ? `Просрочен на ${formatDaysRu(Math.abs(targetDeadline.daysRemaining))}`
        : targetDeadline.daysRemaining === 0
        ? 'Дедлайн сегодня'
        : `Осталось ${formatDaysRu(targetDeadline.daysRemaining)}`;

    nextStageTimer = {
      targetTitle,
      nextStageShortTitle: nextStep?.shortTitle ?? null,
      targetDateIso: targetDeadline.deadlineIso,
      targetDateFormatted: targetDeadline.deadlineFormatted,
      daysRemaining: targetDeadline.daysRemaining,
      urgency: targetDeadline.urgency,
      countdownText,
      regulationNote: targetDeadline.regulationRule,
      overdueStepsCount,
      urgentStepsCount,
      examDateIso,
      examDateFormatted: formatRussianDate(examDateIso),
      contour,
    };
  }

  const latest = inquiries[0] ?? null;

  return {
    isAllCompleted,
    todayIso,
    overallPercent: summary.percent,
    completedTasks: summary.completedTasks,
    totalTasks: summary.totalTasks,
    completedStages: summary.completedStages,
    totalStages: summary.stages.length,
    currentStepIndex,
    currentStageId: currentStep.id,
    currentStageTitle: `${currentStep.stepNumber}. ${currentStep.title}`,
    trackProgressPercent,
    headlineStatus: isAllCompleted
      ? 'Аттестация пройдена полностью · Свидетельство активно'
      : `Вы сейчас на этапе ${currentStep.stepNumber}: ${currentStep.title}`,
    nextStageTimer,
    latestInquirySummary: latest
      ? {
          track: latest.track,
          status: latest.status,
          statusLabel: INQUIRY_STATUS_LABELS[latest.status] ?? latest.status,
        }
      : null,
    steps,
  };
}

/**
 * Provides a clean preview summary for unauthenticated visitors opening the cabinet.
 */
export function buildPreviewAttestationSummary(): AttestationSummaryInput {
  const resolvedCompletedSet = new Set<string>(['app_profile']);
  const stages: AttestationSummaryStageInput[] = ATTESTATION_PATH_STAGES.map((stage, idx) => {
    const completedCount = stage.tasks.filter((t) => resolvedCompletedSet.has(t.id)).length;
    const totalCount = stage.tasks.length;
    return {
      stage,
      completedCount,
      totalCount,
      percent: Math.round((completedCount / totalCount) * 100),
      status: idx === 0 && completedCount > 0 ? 'in_progress' : 'pending',
    };
  });

  const totalTasks = ATTESTATION_PATH_STAGES.reduce((acc, s) => acc + s.tasks.length, 0);

  return {
    percent: Math.round((resolvedCompletedSet.size / totalTasks) * 100),
    completedTasks: resolvedCompletedSet.size,
    totalTasks,
    completedStages: 0,
    activeStage: ATTESTATION_PATH_STAGES[0],
    stages,
    resolvedCompletedSet,
  };
}
