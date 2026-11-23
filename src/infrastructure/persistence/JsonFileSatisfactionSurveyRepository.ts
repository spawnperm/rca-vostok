import crypto from 'crypto';
import fs from 'fs';
import { ValidationError } from '../../domain/shared/DomainError.ts';
import {
  SATISFACTION_CATEGORIES,
  SATISFACTION_CLARITY_OPTIONS,
  SATISFACTION_MODULES,
  SATISFACTION_PROGRAMS,
  type CourseSatisfactionSurveyStats,
} from '../../utils/courseSatisfactionSurvey.ts';
import { atomicWriteJson, ensureDirectory, resolveConfinedPath } from './PathConfinement.ts';

const ALLOWED_PROGRAMS = new Set<string>(SATISFACTION_PROGRAMS);
const ALLOWED_CATEGORIES = new Set<string>(SATISFACTION_CATEGORIES);
const ALLOWED_CLARITY = new Set<string>(SATISFACTION_CLARITY_OPTIONS);
const ALLOWED_MODULES = new Set<string>(SATISFACTION_MODULES);

export interface CourseSatisfactionRecord {
  id: string;
  courseProgram: string;
  complexityCategory: string;
  preparationQuality: number;
  materialsQuality: number;
  practiceUtility: number;
  overallScore: number;
  materialsClarity: string;
  npsRecommend: number;
  mostUsefulModule: string;
  respondentName: string;
  improvementSuggestion: string;
  createdAt: string;
}

function parseIntegerRange(value: unknown, min: number, max: number, label: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ValidationError(`Укажите корректную оценку для «${label}» (от ${min} до ${max}).`);
  }
  return n;
}

export function validateSatisfactionSurveyInput(
  raw: Record<string, unknown>
): Omit<CourseSatisfactionRecord, 'id' | 'createdAt'> {
  const courseProgram = typeof raw.courseProgram === 'string' ? raw.courseProgram.trim() : '';
  const complexityCategory =
    typeof raw.complexityCategory === 'string' ? raw.complexityCategory.trim() : '';
  const materialsClarity =
    typeof raw.materialsClarity === 'string' ? raw.materialsClarity.trim() : '';
  const mostUsefulModule =
    typeof raw.mostUsefulModule === 'string' ? raw.mostUsefulModule.trim() : '';

  if (!ALLOWED_PROGRAMS.has(courseProgram)) {
    throw new ValidationError('Выберите корректную программу подготовки к аттестации.');
  }
  if (!ALLOWED_CATEGORIES.has(complexityCategory)) {
    throw new ValidationError('Выберите корректную категорию сложности маршрута.');
  }
  if (!ALLOWED_CLARITY.has(materialsClarity)) {
    throw new ValidationError('Выберите оценку достаточности учебных материалов.');
  }
  if (!ALLOWED_MODULES.has(mostUsefulModule)) {
    throw new ValidationError('Укажите наиболее полезный модуль подготовки.');
  }

  const preparationQuality = parseIntegerRange(
    raw.preparationQuality,
    1,
    5,
    'Качество подготовки'
  );
  const materialsQuality = parseIntegerRange(
    raw.materialsQuality,
    1,
    5,
    'Качество учебных материалов'
  );
  const practiceUtility = parseIntegerRange(
    raw.practiceUtility,
    1,
    5,
    'Полезность практики'
  );
  const npsRecommend = parseIntegerRange(
    raw.npsRecommend,
    0,
    10,
    'Готовность рекомендовать курс'
  );

  const overallScore =
    Math.round(((preparationQuality + materialsQuality + practiceUtility) / 3) * 10) / 10;

  const respondentName =
    typeof raw.respondentName === 'string' ? raw.respondentName.trim().slice(0, 120) : '';
  const improvementSuggestion =
    typeof raw.improvementSuggestion === 'string'
      ? raw.improvementSuggestion.trim().slice(0, 500)
      : '';

  return {
    courseProgram,
    complexityCategory,
    preparationQuality,
    materialsQuality,
    practiceUtility,
    overallScore,
    materialsClarity,
    npsRecommend,
    mostUsefulModule,
    respondentName,
    improvementSuggestion,
  };
}

export function computeSatisfactionSurveyStats(
  records: readonly CourseSatisfactionRecord[]
): CourseSatisfactionSurveyStats {
  const totalResponses = records.length;

  const avg = (getter: (r: CourseSatisfactionRecord) => number) =>
    totalResponses > 0
      ? Math.round((records.reduce((acc, r) => acc + getter(r), 0) / totalResponses) * 10) / 10
      : 0;

  const recommendCount = records.filter(
    (r) => r.npsRecommend >= 7 || r.overallScore >= 4
  ).length;
  const recommendSharePct =
    totalResponses > 0 ? Math.round((recommendCount / totalResponses) * 100) : 0;

  const moduleCounts = new Map<string, number>();
  for (const r of records) {
    moduleCounts.set(
      r.mostUsefulModule,
      (moduleCounts.get(r.mostUsefulModule) ?? 0) + 1
    );
  }

  const topUsefulModules = Array.from(moduleCounts.entries())
    .map(([module, count]) => ({ module, count }))
    .sort((a, b) => b.count - a.count);

  const recentFeedback = [...records]
    .reverse()
    .slice(0, 4)
    .map((r) => ({
      id: r.id,
      courseProgram: r.courseProgram,
      complexityCategory: r.complexityCategory,
      overallScore: r.overallScore,
      materialsClarity: r.materialsClarity,
      improvementSuggestion: r.improvementSuggestion,
      createdAt: r.createdAt,
    }));

  return {
    totalResponses,
    avgPreparationQuality: avg((r) => r.preparationQuality),
    avgMaterialsQuality: avg((r) => r.materialsQuality),
    avgPracticeUtility: avg((r) => r.practiceUtility),
    avgOverallScore: avg((r) => r.overallScore),
    avgNpsScore: avg((r) => r.npsRecommend),
    recommendSharePct,
    topUsefulModules,
    recentFeedback,
    updatedAt:
      records.length > 0 ? records[records.length - 1].createdAt : new Date().toISOString(),
  };
}

export class JsonFileSatisfactionSurveyRepository {
  private readonly dataDir: string;
  private readonly fileName: string;
  private readonly tempFileName: string;

  constructor(dataDir: string, fileName = 'course-satisfaction-survey.json') {
    this.dataDir = dataDir;
    this.fileName = fileName;
    this.tempFileName = `${fileName}.tmp`;
  }

  loadAll(): CourseSatisfactionRecord[] {
    ensureDirectory(this.dataDir);
    const targetPath = resolveConfinedPath(this.dataDir, this.fileName);
    if (!fs.existsSync(targetPath)) {
      return [];
    }
    try {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (item): item is CourseSatisfactionRecord =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as CourseSatisfactionRecord).id === 'string' &&
          typeof (item as CourseSatisfactionRecord).courseProgram === 'string'
      );
    } catch {
      return [];
    }
  }

  submit(rawInput: Record<string, unknown>): {
    record: CourseSatisfactionRecord;
    stats: CourseSatisfactionSurveyStats;
  } {
    const validated = validateSatisfactionSurveyInput(rawInput);
    const record: CourseSatisfactionRecord = {
      id: `SAT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      ...validated,
      createdAt: new Date().toISOString(),
    };

    const existing = this.loadAll();
    const updated = [...existing, record].slice(-1500);
    atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, updated);

    return {
      record,
      stats: computeSatisfactionSurveyStats(updated),
    };
  }

  getStats(): CourseSatisfactionSurveyStats {
    return computeSatisfactionSurveyStats(this.loadAll());
  }
}
