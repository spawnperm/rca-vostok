import fs from 'fs';
import {
  isLinkedProvider,
  type LinkedAccountDTO,
  type LinkedAccountsRepository,
  type LinkedProviderId,
} from '../../domain/identity/LinkedAccounts.ts';
import { atomicWriteJson, ensureDirectory, resolveConfinedPath } from './PathConfinement.ts';

type StoredMap = Record<string, LinkedAccountDTO[]>;

/**
 * File-backed persistence for linked social/Google accounts when PostgreSQL
 * is not configured (local development and unit tests).
 */
export class JsonFileLinkedAccountsRepository implements LinkedAccountsRepository {
  private readonly dataDir: string;
  private readonly fileName: string;
  private readonly tempFileName: string;

  constructor(dataDir: string, fileName = 'linked-accounts.json') {
    this.dataDir = dataDir;
    this.fileName = fileName;
    this.tempFileName = `${fileName}.tmp`;
  }

  private loadMap(): StoredMap {
    ensureDirectory(this.dataDir);
    const targetPath = resolveConfinedPath(this.dataDir, this.fileName);
    if (!fs.existsSync(targetPath)) {
      return {};
    }
    try {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const out: StoredMap = {};
      for (const [userId, items] of Object.entries(parsed as Record<string, unknown>)) {
        if (!Array.isArray(items)) continue;
        out[userId] = items.filter(
          (item): item is LinkedAccountDTO =>
            Boolean(item && typeof item === 'object' && isLinkedProvider((item as LinkedAccountDTO).provider))
        );
      }
      return out;
    } catch {
      return {};
    }
  }

  private saveMap(map: StoredMap): void {
    atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, map);
  }

  async findByUserId(userId: string): Promise<LinkedAccountDTO[]> {
    const map = this.loadMap();
    const list = map[userId] ?? [];
    return [...list].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  async upsert(userId: string, account: LinkedAccountDTO): Promise<LinkedAccountDTO[]> {
    const map = this.loadMap();
    const current = map[userId] ?? [];

    const filtered = current
      .filter((item) => item.provider !== account.provider)
      .map((item) =>
        account.useForExamAutofill
          ? { ...item, useForExamAutofill: false }
          : item
      );

    const next = [account, ...filtered].sort((a, b) =>
      a.updatedAt < b.updatedAt ? 1 : -1
    );
    map[userId] = next;
    this.saveMap(map);
    return next;
  }

  async setAutofillSource(
    userId: string,
    provider: LinkedProviderId | null
  ): Promise<LinkedAccountDTO[]> {
    const map = this.loadMap();
    const current = map[userId] ?? [];
    const next = current.map((item) => ({
      ...item,
      useForExamAutofill: provider !== null && item.provider === provider,
    }));
    map[userId] = next;
    this.saveMap(map);
    return [...next].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  async unlink(userId: string, provider: LinkedProviderId): Promise<LinkedAccountDTO[]> {
    const map = this.loadMap();
    const current = map[userId] ?? [];
    const remaining = current.filter((item) => item.provider !== provider);

    // If the unlinked provider was active for autofill and others exist, promote the most recent one.
    const hasActive = remaining.some((item) => item.useForExamAutofill);
    const next =
      !hasActive && remaining.length > 0
        ? remaining.map((item, idx) =>
            idx === 0 ? { ...item, useForExamAutofill: true } : item
          )
        : remaining;

    map[userId] = next;
    this.saveMap(map);
    return [...next].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }
}
