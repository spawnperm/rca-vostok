import { CERTIFICATION_SCHEDULE, formatSessionRange } from '../data/landingContent.ts';
import type { AttestationStageId, UserAttestationSummary } from '../components/AttestationProgressWidget.tsx';

export type PreparationContour = 'contour_b' | 'contour_a';

export interface RoadmapExamOption {
  id: string;
  startIso: string;
  endIso: string;
  label: string;
  category: string;
}

export type RoadmapMilestoneStatus = 'completed' | 'active' | 'overdue' | 'upcoming';

export interface RoadmapMilestone {
  id: string;
  order: number;
  title: string;
  description: string;
  linkedStageId: AttestationStageId;
  targetDateIso: string;
  targetDateFormatted: string;
  windowLabel: string;
  offsetDays: number;
  status: RoadmapMilestoneStatus;
  statusLabel: string;
}

export interface PersonalRoadmapPlan {
  examDateIso: string;
  examDateFormatted: string;
  contour: PreparationContour;
  daysUntilExam: number;
  isCompressedSchedule: boolean;
  recommendedDays: number;
  milestones: RoadmapMilestone[];
  completedCount: number;
}

const STORAGE_PREFIX = 'rca_personal_roadmap_v1:';

export const OFFICIAL_EXAM_OPTIONS: RoadmapExamOption[] = CERTIFICATION_SCHEDULE.map((slot, index) => ({
  id: `session-${index + 1}`,
  startIso: slot.start,
  endIso: slot.end,
  label: formatSessionRange(slot.start, slot.end),
  category: slot.category,
}));

export interface StoredRoadmapPrefs {
  examDateIso: string;
  contour: PreparationContour;
}

export function getDefaultExamDateIso(): string {
  return OFFICIAL_EXAM_OPTIONS[0]?.startIso ?? '2027-04-16';
}

export function readStoredRoadmapPrefs(userId: string): StoredRoadmapPrefs {
  const fallback: StoredRoadmapPrefs = {
    examDateIso: getDefaultExamDateIso(),
    contour: 'contour_b',
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredRoadmapPrefs>;
    const examDateIso =
      typeof parsed.examDateIso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.examDateIso)
        ? parsed.examDateIso
        : fallback.examDateIso;
    const contour: PreparationContour =
      parsed.contour === 'contour_a' ? 'contour_a' : 'contour_b';
    return { examDateIso, contour };
  } catch {
    return fallback;
  }
}

export function writeStoredRoadmapPrefs(userId: string, prefs: StoredRoadmapPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(prefs));
  } catch {
    // ignore storage quota errors
  }
}

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

export function formatRussianDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return `${d.getUTCDate()} ${MONTHS_GENITIVE_RU[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

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

interface MilestoneBlueprint {
  id: string;
  title: string;
  description: string;
  linkedStageId: AttestationStageId;
  requiredTaskIds: string[];
  contourBOffsetDays: number;
  contourAOffsetDays: number;
  windowDurationDays: number;
}

const MILESTONE_BLUEPRINTS: MilestoneBlueprint[] = [
  {
    id: 'rm-docs',
    title: 'Сбор документов и подтверждение походного стажа',
    description:
      'Проверка профиля, медицинской справки, сведений о пройденных маршрутах и выбор категории сложности (1–4 КС).',
    linkedStageId: 'application',
    requiredTaskIds: ['app_profile', 'app_docs'],
    contourBOffsetDays: -45,
    contourAOffsetDays: -28,
    windowDurationDays: 5,
  },
  {
    id: 'rm-inquiry',
    title: 'Подача и регистрация заявки в РЦА «Русский Восток»',
    description:
      'Направление заявления на аттестационную сессию и согласование потока с куратором центра.',
    linkedStageId: 'application',
    requiredTaskIds: ['app_inquiry'],
    contourBOffsetDays: -38,
    contourAOffsetDays: -21,
    windowDurationDays: 3,
  },
  {
    id: 'rm-theory',
    title: 'Теоретический модуль: НПА ПП № 1893, топография и WFA',
    description:
      'Освоение программы ДПО ВВГУ или самоподготовка по билетам первой помощи, тактики группы и нормативной базы.',
    linkedStageId: 'training',
    requiredTaskIds: ['trn_track', 'trn_modules'],
    contourBOffsetDays: -24,
    contourAOffsetDays: -14,
    windowDurationDays: 14,
  },
  {
    id: 'rm-passport',
    title: 'Подготовка и предпроверка паспорта маршрута (ПП № 760)',
    description:
      'Оформление схемы эвакуации, контрольных точек связи, графика движения и матрицы рисков по выбранному маршруту.',
    linkedStageId: 'training',
    requiredTaskIds: ['trn_passport'],
    contourBOffsetDays: -10,
    contourAOffsetDays: -8,
    windowDurationDays: 4,
  },
  {
    id: 'rm-exam',
    title: 'Экзамен: тестирование, защита паспорта и полевой этап',
    description:
      'Очная аттестационная сессия перед комиссией ВВГУ и ФСТР, практические испытания на полигоне Шкотовского района.',
    linkedStageId: 'exam',
    requiredTaskIds: ['exm_theory', 'exm_defense', 'exm_field'],
    contourBOffsetDays: 0,
    contourAOffsetDays: 0,
    windowDurationDays: 3,
  },
  {
    id: 'rm-registry',
    title: 'Протокол и внесение в Единый федеральный реестр',
    description:
      'Утверждение итогового протокола комиссии, присвоение реестрового номера и выдача нагрудного бейджа на 5 лет.',
    linkedStageId: 'certificate',
    requiredTaskIds: ['crt_protocol', 'crt_registry', 'crt_badge'],
    contourBOffsetDays: 5,
    contourAOffsetDays: 5,
    windowDurationDays: 5,
  },
];

export function buildPersonalRoadmap(
  examDateIso: string,
  contour: PreparationContour,
  summary: UserAttestationSummary,
  todayIso = new Date().toISOString().slice(0, 10)
): PersonalRoadmapPlan {
  const recommendedDays = contour === 'contour_b' ? 45 : 28;
  const daysUntilExam = diffUtcDays(todayIso, examDateIso);
  const isCompressedSchedule = daysUntilExam < recommendedDays;

  let activeAssigned = false;

  const milestones: RoadmapMilestone[] = MILESTONE_BLUEPRINTS.map((bp, idx) => {
    const offsetDays = contour === 'contour_b' ? bp.contourBOffsetDays : bp.contourAOffsetDays;
    const rawTarget = addUtcDays(examDateIso, offsetDays);
    // Keep preparation milestones from drifting further back than today if exam is soon,
    // except keep rawTarget for clear overdue signaling when a milestone is already behind schedule.
    const targetDateIso = rawTarget;
    const endWindowIso = addUtcDays(targetDateIso, Math.max(bp.windowDurationDays - 1, 0));
    const isCompleted = bp.requiredTaskIds.every((id) => summary.resolvedCompletedSet.has(id));

    let status: RoadmapMilestoneStatus;
    let statusLabel: string;

    if (isCompleted) {
      status = 'completed';
      statusLabel = 'Выполнено';
    } else if (targetDateIso < todayIso) {
      status = 'overdue';
      statusLabel = 'Требует ускорения';
    } else if (!activeAssigned) {
      status = 'active';
      activeAssigned = true;
      statusLabel = 'Текущий ориентир';
    } else {
      status = 'upcoming';
      statusLabel = 'По плану';
    }

    const windowLabel =
      bp.windowDurationDays <= 1
        ? formatRussianDate(targetDateIso)
        : `${formatRussianDate(targetDateIso)} — ${formatRussianDate(endWindowIso)}`;

    return {
      id: bp.id,
      order: idx + 1,
      title: bp.title,
      description: bp.description,
      linkedStageId: bp.linkedStageId,
      targetDateIso,
      targetDateFormatted: formatRussianDate(targetDateIso),
      windowLabel,
      offsetDays,
      status,
      statusLabel,
    };
  });

  const completedCount = milestones.filter((m) => m.status === 'completed').length;

  return {
    examDateIso,
    examDateFormatted: formatRussianDate(examDateIso),
    contour,
    daysUntilExam,
    isCompressedSchedule,
    recommendedDays,
    milestones,
    completedCount,
  };
}
