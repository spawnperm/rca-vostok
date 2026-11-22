import fs from 'fs';
import type {
  PlatformFeedback,
  PlatformFeedbackDTO,
} from '../../domain/feedback/PlatformFeedback.ts';
import type { FeedbackRepository } from '../../domain/feedback/FeedbackRepository.ts';
import { atomicWriteJson, ensureDirectory, resolveConfinedPath } from './PathConfinement.ts';

/**
 * File-backed feedback adapter. Used for local development and tests.
 * Production runs the PostgreSQL adapter instead.
 */
export class JsonFileFeedbackRepository implements FeedbackRepository {
  private readonly dataDir: string;
  private readonly fileName: string;
  private readonly tempFileName: string;

  constructor(dataDir: string, fileName = 'feedback.json') {
    this.dataDir = dataDir;
    this.fileName = fileName;
    this.tempFileName = `${fileName}.tmp`;
  }

  async loadAll(): Promise<PlatformFeedbackDTO[]> {
    ensureDirectory(this.dataDir);
    const targetPath = resolveConfinedPath(this.dataDir, this.fileName);
    if (!fs.existsSync(targetPath)) {
      return [];
    }
    try {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as PlatformFeedbackDTO[]) : [];
    } catch {
      return [];
    }
  }

  async save(feedback: PlatformFeedback): Promise<PlatformFeedbackDTO[]> {
    const records = await this.loadAll();
    records.push(feedback.toDTO());
    const bounded = records.slice(-1000);
    atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, bounded);
    return bounded;
  }

  async count(): Promise<number> {
    return (await this.loadAll()).length;
  }
}
