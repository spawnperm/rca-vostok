import crypto from 'crypto';
import type pg from 'pg';
import type { CourseSatisfactionSurveyStats } from '../../../utils/courseSatisfactionSurvey.ts';
import {
  computeSatisfactionSurveyStats,
  validateSatisfactionSurveyInput,
  type CourseSatisfactionRecord,
} from '../JsonFileSatisfactionSurveyRepository.ts';

interface SatisfactionSurveyRow {
  id: string;
  course_program: string;
  complexity_category: string;
  preparation_quality: number;
  materials_quality: number;
  practice_utility: number;
  overall_score: number;
  materials_clarity: string;
  nps_recommend: number;
  most_useful_module: string;
  respondent_name: string;
  improvement_suggestion: string;
  created_at: Date | string;
}

function rowToRecord(row: SatisfactionSurveyRow): CourseSatisfactionRecord {
  return {
    id: row.id,
    courseProgram: row.course_program,
    complexityCategory: row.complexity_category,
    preparationQuality: Number(row.preparation_quality) || 1,
    materialsQuality: Number(row.materials_quality) || 1,
    practiceUtility: Number(row.practice_utility) || 1,
    overallScore: Number(row.overall_score) || 0,
    materialsClarity: row.materials_clarity,
    npsRecommend: Number(row.nps_recommend) || 0,
    mostUsefulModule: row.most_useful_module,
    respondentName: row.respondent_name || '',
    improvementSuggestion: row.improvement_suggestion || '',
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export class PostgresSatisfactionSurveyRepository {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async loadAll(): Promise<CourseSatisfactionRecord[]> {
    const res = await this.pool.query<SatisfactionSurveyRow>(
      `SELECT id, course_program, complexity_category, preparation_quality,
              materials_quality, practice_utility, overall_score, materials_clarity,
              nps_recommend, most_useful_module, respondent_name, improvement_suggestion,
              created_at
         FROM satisfaction_surveys
        ORDER BY created_at ASC
        LIMIT 1500`
    );
    return res.rows.map(rowToRecord);
  }

  async submit(rawInput: Record<string, unknown>): Promise<{
    record: CourseSatisfactionRecord;
    stats: CourseSatisfactionSurveyStats;
  }> {
    const validated = validateSatisfactionSurveyInput(rawInput);
    const record: CourseSatisfactionRecord = {
      id: `SAT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      ...validated,
      createdAt: new Date().toISOString(),
    };

    await this.pool.query(
      `INSERT INTO satisfaction_surveys (
         id, course_program, complexity_category, preparation_quality,
         materials_quality, practice_utility, overall_score, materials_clarity,
         nps_recommend, most_useful_module, respondent_name, improvement_suggestion,
         created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        record.id,
        record.courseProgram,
        record.complexityCategory,
        record.preparationQuality,
        record.materialsQuality,
        record.practiceUtility,
        record.overallScore,
        record.materialsClarity,
        record.npsRecommend,
        record.mostUsefulModule,
        record.respondentName,
        record.improvementSuggestion,
        record.createdAt,
      ]
    );

    const all = await this.loadAll();
    return {
      record,
      stats: computeSatisfactionSurveyStats(all),
    };
  }

  async getStats(): Promise<CourseSatisfactionSurveyStats> {
    const all = await this.loadAll();
    return computeSatisfactionSurveyStats(all);
  }
}
