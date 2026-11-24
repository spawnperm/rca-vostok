import fs from 'fs';
import type { LmsProgressRepository, LmsProgressState } from '../../domain/lms/LmsProgress.ts';
import { atomicWriteJson, ensureDirectory, resolveConfinedPath } from './PathConfinement.ts';

type LmsProgressStore = Record<string, LmsProgressState>;

/**
 * Stores per-user LMS progress (self-check, competency quiz, learning plan,
 * diagnostics) in an atomically written JSON file confined inside DATA_DIR.
 */
export class JsonFileLmsProgressRepository implements LmsProgressRepository {
  private readonly dataDir: string;
  private readonly fileName: string;
  private readonly tempFileName: string;

  constructor(dataDir: string, fileName = 'lms-progress.json') {
    this.dataDir = dataDir;
    this.fileName = fileName;
    this.tempFileName = `${fileName}.tmp`;
  }

  private readStore(): LmsProgressStore {
    ensureDirectory(this.dataDir);
    const targetPath = resolveConfinedPath(this.dataDir, this.fileName);
    if (!fs.existsSync(targetPath)) {
      return {};
    }
    try {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      return parsed as LmsProgressStore;
    } catch {
      return {};
    }
  }

  async findByOwner(ownerId: string): Promise<LmsProgressState | null> {
    const store = this.readStore();
    const state = store[ownerId];
    if (!state || typeof state !== 'object') {
      return null;
    }
    return state;
  }

  async saveByOwner(ownerId: string, state: LmsProgressState): Promise<void> {
    const store = this.readStore();
    store[ownerId] = state;
    atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, store);
  }
}
