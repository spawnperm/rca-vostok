export const SATISFACTION_PROGRAMS = [
  'ДПО ВВГУ (250 ч) · Пешеходный и горный туризм',
  'ДПО ВВГУ · Водный туризм и сплавы',
  'Контур А · Экспресс-подготовка действующих гидов',
  'Комбинированный и экспедиционный курс ООПТ',
] as const;

export const SATISFACTION_CATEGORIES = [
  '1 КС (начальная сложность)',
  '2 КС (средняя сложность)',
  '3 КС (повышенная сложность)',
  '4+ КС (экспедиционная)',
] as const;

export const SATISFACTION_CLARITY_OPTIONS = [
  'Полностью достаточно для сдачи экзамена',
  'Хорошо, но полезно добавить больше разборов кейсов',
  'Не хватает практических примеров и шаблонов',
] as const;

export const SATISFACTION_MODULES = [
  'Паспортизация маршрута (ПП РФ № 760)',
  'Первая помощь в природных условиях (WFA)',
  'Полевые испытания и спасработы (ПСР)',
  'Нормативная база (ПП № 1003 / № 1893)',
  'Ориентирование, связь и безопасность в ДФО',
] as const;

export interface CourseSatisfactionSurveyStats {
  totalResponses: number;
  avgPreparationQuality: number;
  avgMaterialsQuality: number;
  avgPracticeUtility: number;
  avgOverallScore: number;
  avgNpsScore: number;
  recommendSharePct: number;
  topUsefulModules: { module: string; count: number }[];
  recentFeedback: {
    id: string;
    courseProgram: string;
    complexityCategory: string;
    overallScore: number;
    materialsClarity: string;
    improvementSuggestion: string;
    createdAt: string;
  }[];
  updatedAt: string;
}

export interface CourseSatisfactionSubmissionPayload {
  courseProgram: string;
  complexityCategory: string;
  preparationQuality: number;
  materialsQuality: number;
  practiceUtility: number;
  materialsClarity: string;
  npsRecommend: number;
  mostUsefulModule: string;
  respondentName: string;
  improvementSuggestion: string;
}

export function clampSurveyRating(val: number, min = 1, max = 5): number {
  const n = Math.round(Number(val));
  if (!Number.isFinite(n)) return max;
  return Math.max(min, Math.min(max, n));
}

export function computePersonalSatisfactionAvg(
  preparationQuality: number,
  materialsQuality: number,
  practiceUtility: number
): number {
  const p = clampSurveyRating(preparationQuality);
  const m = clampSurveyRating(materialsQuality);
  const u = clampSurveyRating(practiceUtility);
  return Math.round(((p + m + u) / 3) * 10) / 10;
}

export function getSatisfactionVerdictLabel(avgScore: number): string {
  if (avgScore >= 4.6) return 'Высокая удовлетворённость курсом и материалами';
  if (avgScore >= 3.8) return 'Положительная оценка подготовки';
  if (avgScore >= 3.0) return 'Базово удовлетворительно — есть зоны роста';
  return 'Требуется методическая доработка программы';
}
