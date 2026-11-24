import crypto from 'crypto';
import fs from 'fs';
import { DFO_SURVEY_REGIONS } from '../../data/dfoRegions.ts';
import { ValidationError } from '../../domain/shared/DomainError.ts';
import {
  EMPLOYMENT_STATUS_OPTIONS,
  PREFERRED_REATTESTATION_FORMATS,
  REATTESTATION_NEED_TOPICS,
  REATTESTATION_URGENCY_OPTIONS,
  SEASONAL_WORKLOAD_OPTIONS,
  SURVEY_COMPLEXITY_LEVELS,
  SURVEY_DISCIPLINES,
  aggregateEmploymentSurvey,
  computeReattestationPriority,
  type GuideEmploymentSurveyEntry,
  type GuideEmploymentSurveyInput,
  type GuideEmploymentSurveySummary,
} from '../../utils/guideEmploymentSurvey.ts';
import { atomicWriteJson, ensureDirectory, resolveConfinedPath } from './PathConfinement.ts';

const ALLOWED_REGIONS = new Set<string>(DFO_SURVEY_REGIONS);
const ALLOWED_DISCIPLINES = new Set<string>(SURVEY_DISCIPLINES);
const ALLOWED_COMPLEXITIES = new Set<string>(SURVEY_COMPLEXITY_LEVELS);
const ALLOWED_EMPLOYMENT = new Set<string>(EMPLOYMENT_STATUS_OPTIONS);
const ALLOWED_WORKLOADS = new Set<string>(SEASONAL_WORKLOAD_OPTIONS);
const ALLOWED_URGENCIES = new Set<string>(REATTESTATION_URGENCY_OPTIONS);
const ALLOWED_FORMATS = new Set<string>(PREFERRED_REATTESTATION_FORMATS);
const ALLOWED_TOPICS = new Set<string>(REATTESTATION_NEED_TOPICS.map((t) => t.id));

export interface StoredEmploymentSurveyRecord extends GuideEmploymentSurveyEntry {
  ownerUserId?: string | null;
  archiveObjectKey?: string;
}

export interface EmploymentSurveySnapshot {
  summary: GuideEmploymentSurveySummary;
  responses: StoredEmploymentSurveyRecord[];
}

export interface EmploymentSurveyRepository {
  listAll(limit?: number): Promise<StoredEmploymentSurveyRecord[]>;
  getSummary(): Promise<GuideEmploymentSurveySummary>;
  findById(id: string): Promise<StoredEmploymentSurveyRecord | null>;
  submit(
    rawInput: Record<string, unknown>,
    options?: { ownerUserId?: string | null; archiveObjectKey?: string }
  ): Promise<{
    record: StoredEmploymentSurveyRecord;
    summary: GuideEmploymentSurveySummary;
    allRecords: StoredEmploymentSurveyRecord[];
  }>;
  updateArchiveKey(id: string, archiveObjectKey: string): Promise<void>;
  deleteById(id: string): Promise<boolean>;
}

export function validateEmploymentSurveyPayload(
  raw: Record<string, unknown>
): GuideEmploymentSurveyInput {
  const region = typeof raw.region === 'string' ? raw.region.trim() : '';
  const discipline = typeof raw.discipline === 'string' ? raw.discipline.trim() : '';
  const complexityLevel =
    typeof raw.complexityLevel === 'string' ? raw.complexityLevel.trim() : '';
  const employmentStatus =
    typeof raw.employmentStatus === 'string' ? raw.employmentStatus.trim() : '';
  const workloadRange = typeof raw.workloadRange === 'string' ? raw.workloadRange.trim() : '';
  const reattestationUrgency =
    typeof raw.reattestationUrgency === 'string' ? raw.reattestationUrgency.trim() : '';
  const preferredFormat =
    typeof raw.preferredFormat === 'string' ? raw.preferredFormat.trim() : '';

  if (!ALLOWED_REGIONS.has(region)) {
    throw new ValidationError('Укажите корректный субъект ДФО.');
  }
  if (!ALLOWED_DISCIPLINES.has(discipline)) {
    throw new ValidationError('Укажите корректный вид туризма.');
  }
  if (!ALLOWED_COMPLEXITIES.has(complexityLevel)) {
    throw new ValidationError('Укажите корректную категорию сложности маршрутов.');
  }
  if (!ALLOWED_EMPLOYMENT.has(employmentStatus)) {
    throw new ValidationError('Укажите корректный формат текущей занятости.');
  }
  if (!ALLOWED_WORKLOADS.has(workloadRange)) {
    throw new ValidationError('Укажите корректный диапазон сезонной занятости.');
  }
  if (!ALLOWED_URGENCIES.has(reattestationUrgency)) {
    throw new ValidationError('Укажите корректный статус переаттестации.');
  }
  if (!ALLOWED_FORMATS.has(preferredFormat)) {
    throw new ValidationError('Укажите корректный формат прохождения аттестации.');
  }

  const tourDaysPerSeason = Math.round(Number(raw.tourDaysPerSeason));
  if (!Number.isFinite(tourDaysPerSeason) || tourDaysPerSeason < 0 || tourDaysPerSeason > 365) {
    throw new ValidationError(
      'Укажите корректное количество дней на маршрутах за сезон (0–365).'
    );
  }

  const groupsPerMonth = Math.round(Number(raw.groupsPerMonth));
  if (!Number.isFinite(groupsPerMonth) || groupsPerMonth < 0 || groupsPerMonth > 60) {
    throw new ValidationError('Укажите корректное число групп в месяц (0–60).');
  }

  const hasActiveCertificate = Boolean(raw.hasActiveCertificate);
  const needsEmployerSubsidy = Boolean(raw.needsEmployerSubsidy);

  const rawTopics = Array.isArray(raw.neededTopics) ? raw.neededTopics : [];
  const neededTopics = Array.from(
    new Set(
      rawTopics
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => ALLOWED_TOPICS.has(item))
    )
  );

  const priority = computeReattestationPriority({
    hasActiveCertificate,
    reattestationUrgency,
  });

  if (priority !== 'low' && neededTopics.length === 0) {
    throw new ValidationError(
      'Отметьте хотя бы один необходимый модуль подготовки для переаттестации.'
    );
  }

  const respondentName =
    typeof raw.respondentName === 'string' ? raw.respondentName.trim().slice(0, 120) : '';
  const comment = typeof raw.comment === 'string' ? raw.comment.trim().slice(0, 500) : '';

  return {
    respondentName,
    region,
    discipline,
    complexityLevel,
    employmentStatus,
    workloadRange,
    tourDaysPerSeason,
    groupsPerMonth,
    hasActiveCertificate,
    reattestationUrgency,
    preferredFormat,
    neededTopics,
    needsEmployerSubsidy,
    comment,
  };
}

export class JsonFileEmploymentSurveyRepository implements EmploymentSurveyRepository {
  private readonly dataDir: string;
  private readonly fileName: string;
  private readonly tempFileName: string;

  constructor(dataDir: string, fileName = 'employment-reattestation-survey.json') {
    this.dataDir = dataDir;
    this.fileName = fileName;
    this.tempFileName = `${fileName}.tmp`;
  }

  private loadRaw(): StoredEmploymentSurveyRecord[] {
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
        (item): item is StoredEmploymentSurveyRecord =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as StoredEmploymentSurveyRecord).id === 'string' &&
          typeof (item as StoredEmploymentSurveyRecord).region === 'string'
      );
    } catch {
      return [];
    }
  }

  private saveRaw(records: StoredEmploymentSurveyRecord[]): void {
    atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, records.slice(0, 1500));
  }

  async listAll(limit = 100): Promise<StoredEmploymentSurveyRecord[]> {
    const records = this.loadRaw();
    const sorted = [...records].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return sorted.slice(0, Math.max(1, Math.min(limit, 500)));
  }

  async getSummary(): Promise<GuideEmploymentSurveySummary> {
    return aggregateEmploymentSurvey(this.loadRaw());
  }

  async findById(id: string): Promise<StoredEmploymentSurveyRecord | null> {
    return this.loadRaw().find((r) => r.id === id) ?? null;
  }

  async submit(
    rawInput: Record<string, unknown>,
    options: { ownerUserId?: string | null; archiveObjectKey?: string } = {}
  ): Promise<{
    record: StoredEmploymentSurveyRecord;
    summary: GuideEmploymentSurveySummary;
    allRecords: StoredEmploymentSurveyRecord[];
  }> {
    const validated = validateEmploymentSurveyPayload(rawInput);
    const id = `EMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const priorityLevel = computeReattestationPriority(validated);
    const record: StoredEmploymentSurveyRecord = {
      id,
      ...validated,
      priorityLevel,
      submittedAt: new Date().toISOString(),
      ownerUserId: options.ownerUserId ?? null,
      archiveObjectKey: options.archiveObjectKey ?? '',
    };

    const existing = this.loadRaw();
    const updated = [record, ...existing].slice(0, 1500);
    this.saveRaw(updated);

    return {
      record,
      summary: aggregateEmploymentSurvey(updated),
      allRecords: updated,
    };
  }

  async updateArchiveKey(id: string, archiveObjectKey: string): Promise<void> {
    const existing = this.loadRaw();
    const updated = existing.map((item) =>
      item.id === id ? { ...item, archiveObjectKey } : item
    );
    this.saveRaw(updated);
  }

  async deleteById(id: string): Promise<boolean> {
    const existing = this.loadRaw();
    const next = existing.filter((item) => item.id !== id);
    if (next.length === existing.length) return false;
    this.saveRaw(next);
    return true;
  }
}
