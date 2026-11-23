import fs from 'fs';
import {
  INITIAL_DFO_CERTIFIED_GUIDES,
  filterGuideRecords,
  type CertifiedGuideRecord,
  type GuideLeaderboardFilter,
  type GuideLeaderboardRepository,
} from '../../domain/certification/GuideLeaderboard.ts';
import { atomicWriteJson, ensureDirectory, resolveConfinedPath } from './PathConfinement.ts';

/**
 * File-backed database adapter for the DFO Certified Guides Registry.
 * Seeds `data/guides-registry.json` on first read so queries run against real
 * persisted records when PostgreSQL is not provisioned.
 */
export class JsonFileGuideLeaderboardRepository implements GuideLeaderboardRepository {
  private readonly dataDir: string;
  private readonly fileName: string;
  private readonly tempFileName: string;

  constructor(dataDir: string, fileName = 'guides-registry.json') {
    this.dataDir = dataDir;
    this.fileName = fileName;
    this.tempFileName = `${fileName}.tmp`;
  }

  private ensureSeededAndLoad(): CertifiedGuideRecord[] {
    ensureDirectory(this.dataDir);
    const targetPath = resolveConfinedPath(this.dataDir, this.fileName);
    if (!fs.existsSync(targetPath)) {
      const initial = INITIAL_DFO_CERTIFIED_GUIDES.map((row) => ({ ...row }));
      atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, initial);
      return initial;
    }

    try {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        const initial = INITIAL_DFO_CERTIFIED_GUIDES.map((row) => ({ ...row }));
        atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, initial);
        return initial;
      }
      return (parsed as Partial<CertifiedGuideRecord>[]).map((row) => ({
        id: String(row.id ?? ''),
        userId: typeof row.userId === 'string' ? row.userId : null,
        fullName: String(row.fullName ?? ''),
        region: String(row.region ?? ''),
        organisation: String(row.organisation ?? ''),
        track: (row.track ?? 'hiking') as CertifiedGuideRecord['track'],
        certifiedRoutesCount: Number(row.certifiedRoutesCount ?? 0),
        experienceYears: Number(row.experienceYears ?? 0),
        maxComplexity: (row.maxComplexity ?? '2 КС') as CertifiedGuideRecord['maxComplexity'],
        registryNumber: String(row.registryNumber ?? ''),
        isActive: row.isActive !== false,
        lastAttestationDate: String(row.lastAttestationDate ?? '2026-01-01'),
      }));
    } catch {
      return INITIAL_DFO_CERTIFIED_GUIDES.map((row) => ({ ...row }));
    }
  }

  async list(filter?: GuideLeaderboardFilter): Promise<CertifiedGuideRecord[]> {
    const rows = this.ensureSeededAndLoad();
    return filterGuideRecords(rows, filter);
  }

  async upsert(record: CertifiedGuideRecord): Promise<void> {
    const rows = this.ensureSeededAndLoad();
    const index = rows.findIndex(
      (r) =>
        r.id === record.id ||
        (record.userId !== null && r.userId !== null && r.userId === record.userId)
    );
    const next = [...rows];
    if (index >= 0) {
      next[index] = { ...record };
    } else {
      next.push({ ...record });
    }
    atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, next);
  }

  async count(): Promise<number> {
    return this.ensureSeededAndLoad().length;
  }
}
