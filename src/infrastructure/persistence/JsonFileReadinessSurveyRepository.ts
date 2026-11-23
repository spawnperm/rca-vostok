import crypto from 'crypto';
import fs from 'fs';
import { ValidationError } from '../../domain/shared/DomainError.ts';
import { atomicWriteJson, ensureDirectory, resolveConfinedPath } from './PathConfinement.ts';

export const ALLOWED_SURVEY_REGIONS = new Set<string>([
  'Приморский край',
  'Хабаровский край',
  'Камчатский край',
  'Сахалинская область',
  'Амурская область',
  'Республика Саха (Якутия)',
  'Магаданская область / Чукотский АО',
]);

export const ALLOWED_SURVEY_TRACKS = new Set<string>([
  'Пешеходный туризм',
  'Водный туризм и сплавы',
  'Горный / экспедиционный туризм',
  'Автомобильный туризм',
  'Переаттестация действующего гида',
]);

export const ALLOWED_SURVEY_EXPERIENCE = new Set<string>([
  'До 1 года',
  '1–3 года',
  '3–5 лет',
  'Более 5 лет',
]);

export const ALLOWED_SURVEY_FORMATS = new Set<string>([
  'Контур А (зачёт стажа практиков)',
  'Переподготовка ДПО ВВГУ + экзамен',
  'Плановая переаттестация (5 лет)',
]);

export const ALLOWED_SURVEY_TIMEFRAMES = new Set<string>([
  'Ближайшая сессия (зима 2026 / весна 2027)',
  'Лето–осень 2027',
  'В процессе подготовки документов',
]);

export const ALLOWED_SURVEY_BARRIERS = new Set<string>([
  'Оформление паспорта маршрута (ПП № 760)',
  'Подтверждение стажа без справок МКК',
  'Полевые испытания (переправы, WFA, ПСР)',
  'Стоимость обучения и поиск субсидии',
  'Барьеров нет — готов к экзамену',
]);

export const ALLOWED_SURVEY_DOCS = new Set<string>([
  'medical',
  'experience_proof',
  'route_passport',
  'education_dpo',
  'wfa_gear',
]);

export interface ReadinessSurveyRecord {
  id: string;
  region: string;
  track: string;
  experienceRange: string;
  preferredFormat: string;
  plannedTimeframe: string;
  mainBarrier: string;
  readyDocs: string[];
  readinessPct: number;
  respondentName: string;
  comment: string;
  createdAt: string;
}

export interface ReadinessSurveyStats {
  totalResponses: number;
  averageReadinessPct: number;
  byRegion: { region: string; count: number }[];
  byFormat: { format: string; count: number }[];
  topBarriers: { barrier: string; count: number }[];
  updatedAt: string;
}

export function validateReadinessSurveyInput(raw: Record<string, unknown>): Omit<
  ReadinessSurveyRecord,
  'id' | 'createdAt'
> {
  const region = typeof raw.region === 'string' ? raw.region.trim() : '';
  const track = typeof raw.track === 'string' ? raw.track.trim() : '';
  const experienceRange = typeof raw.experienceRange === 'string' ? raw.experienceRange.trim() : '';
  const preferredFormat = typeof raw.preferredFormat === 'string' ? raw.preferredFormat.trim() : '';
  const plannedTimeframe = typeof raw.plannedTimeframe === 'string' ? raw.plannedTimeframe.trim() : '';
  const mainBarrier = typeof raw.mainBarrier === 'string' ? raw.mainBarrier.trim() : '';

  if (!ALLOWED_SURVEY_REGIONS.has(region)) {
    throw new ValidationError('Укажите корректный субъект ДФО.');
  }
  if (!ALLOWED_SURVEY_TRACKS.has(track)) {
    throw new ValidationError('Укажите корректное направление аттестации.');
  }
  if (!ALLOWED_SURVEY_EXPERIENCE.has(experienceRange)) {
    throw new ValidationError('Укажите корректный диапазон походного стажа.');
  }
  if (!ALLOWED_SURVEY_FORMATS.has(preferredFormat)) {
    throw new ValidationError('Укажите корректный трек подготовки.');
  }
  if (!ALLOWED_SURVEY_TIMEFRAMES.has(plannedTimeframe)) {
    throw new ValidationError('Укажите корректный планируемый срок аттестации.');
  }
  if (!ALLOWED_SURVEY_BARRIERS.has(mainBarrier)) {
    throw new ValidationError('Укажите корректный барьер подготовки.');
  }

  const docsInput = Array.isArray(raw.readyDocs) ? raw.readyDocs : [];
  const readyDocs = Array.from(
    new Set(
      docsInput
        .filter((d): d is string => typeof d === 'string')
        .map((d) => d.trim())
        .filter((d) => ALLOWED_SURVEY_DOCS.has(d))
    )
  );

  const respondentName =
    typeof raw.respondentName === 'string' ? raw.respondentName.trim().slice(0, 120) : '';
  const comment = typeof raw.comment === 'string' ? raw.comment.trim().slice(0, 400) : '';
  const readinessPct = Math.round((readyDocs.length / ALLOWED_SURVEY_DOCS.size) * 100);

  return {
    region,
    track,
    experienceRange,
    preferredFormat,
    plannedTimeframe,
    mainBarrier,
    readyDocs,
    readinessPct,
    respondentName,
    comment,
  };
}

export function computeReadinessSurveyStats(
  records: readonly ReadinessSurveyRecord[]
): ReadinessSurveyStats {
  const totalResponses = records.length;
  const averageReadinessPct =
    totalResponses > 0
      ? Math.round(records.reduce((acc, r) => acc + r.readinessPct, 0) / totalResponses)
      : 0;

  const regionCounts = new Map<string, number>();
  const formatCounts = new Map<string, number>();
  const barrierCounts = new Map<string, number>();

  for (const r of records) {
    regionCounts.set(r.region, (regionCounts.get(r.region) ?? 0) + 1);
    formatCounts.set(r.preferredFormat, (formatCounts.get(r.preferredFormat) ?? 0) + 1);
    barrierCounts.set(r.mainBarrier, (barrierCounts.get(r.mainBarrier) ?? 0) + 1);
  }

  const byRegion = Array.from(regionCounts.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count);

  const byFormat = Array.from(formatCounts.entries())
    .map(([format, count]) => ({ format, count }))
    .sort((a, b) => b.count - a.count);

  const topBarriers = Array.from(barrierCounts.entries())
    .map(([barrier, count]) => ({ barrier, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalResponses,
    averageReadinessPct,
    byRegion,
    byFormat,
    topBarriers,
    updatedAt:
      records.length > 0 ? records[records.length - 1].createdAt : new Date().toISOString(),
  };
}

export class JsonFileReadinessSurveyRepository {
  private readonly dataDir: string;
  private readonly fileName: string;
  private readonly tempFileName: string;

  constructor(dataDir: string, fileName = 'readiness-survey.json') {
    this.dataDir = dataDir;
    this.fileName = fileName;
    this.tempFileName = `${fileName}.tmp`;
  }

  loadAll(): ReadinessSurveyRecord[] {
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
        (item): item is ReadinessSurveyRecord =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as ReadinessSurveyRecord).id === 'string' &&
          typeof (item as ReadinessSurveyRecord).region === 'string'
      );
    } catch {
      return [];
    }
  }

  submit(rawInput: Record<string, unknown>): {
    record: ReadinessSurveyRecord;
    stats: ReadinessSurveyStats;
  } {
    const validated = validateReadinessSurveyInput(rawInput);
    const record: ReadinessSurveyRecord = {
      id: `SRV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      ...validated,
      createdAt: new Date().toISOString(),
    };

    const existing = this.loadAll();
    const updated = [...existing, record].slice(-1500);
    atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, updated);

    return {
      record,
      stats: computeReadinessSurveyStats(updated),
    };
  }

  getStats(): ReadinessSurveyStats {
    return computeReadinessSurveyStats(this.loadAll());
  }
}
