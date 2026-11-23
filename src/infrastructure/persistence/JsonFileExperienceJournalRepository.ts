import fs from 'fs';
import type { ExperienceLogEntry } from '../../domain/experience/ExperienceEntry.ts';
import type { ExperienceJournalRepository } from '../../domain/experience/ExperienceJournalRepository.ts';
import { atomicWriteJson, ensureDirectory, resolveConfinedPath } from './PathConfinement.ts';

type ExperienceJournalStore = Record<string, ExperienceLogEntry[]>;

/**
 * Infrastructure adapter storing per-instructor professional experience journals
 * in an atomically written JSON file confined inside DATA_DIR.
 */
export class JsonFileExperienceJournalRepository implements ExperienceJournalRepository {
  private readonly dataDir: string;
  private readonly fileName: string;
  private readonly tempFileName: string;

  constructor(dataDir: string, fileName = 'experience-journal.json') {
    this.dataDir = dataDir;
    this.fileName = fileName;
    this.tempFileName = `${fileName}.tmp`;
  }

  private readStore(): ExperienceJournalStore {
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
      return parsed as ExperienceJournalStore;
    } catch {
      return {};
    }
  }

  async listByOwner(ownerId: string): Promise<ExperienceLogEntry[] | null> {
    const store = this.readStore();
    const list = store[ownerId];
    if (!Array.isArray(list)) {
      return null;
    }
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }

  async saveByOwner(ownerId: string, entries: readonly ExperienceLogEntry[]): Promise<void> {
    const store = this.readStore();
    store[ownerId] = [...entries]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 500);
    atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, store);
  }
}
