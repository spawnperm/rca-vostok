import fs from 'fs';
import {
  CertificationInquiry,
  type InquiryRecordDTO,
  type InquiryStatus,
} from '../../domain/certification/CertificationInquiry.ts';
import type { InquiryRepository } from '../../domain/certification/InquiryRepository.ts';
import { atomicWriteJson, ensureDirectory, resolveConfinedPath } from './PathConfinement.ts';

/**
 * File-backed inquiry adapter. Used for local development and tests.
 * Production runs the PostgreSQL adapter instead.
 */
export class JsonFileInquiryRepository implements InquiryRepository {
  private readonly dataDir: string;
  private readonly fileName: string;
  private readonly tempFileName: string;

  constructor(dataDir: string, fileName = 'inquiries.json') {
    this.dataDir = dataDir;
    this.fileName = fileName;
    this.tempFileName = `${fileName}.tmp`;
  }

  async loadAll(): Promise<InquiryRecordDTO[]> {
    ensureDirectory(this.dataDir);
    const targetPath = resolveConfinedPath(this.dataDir, this.fileName);
    if (!fs.existsSync(targetPath)) {
      return [];
    }
    try {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Records written before the owner/status migration lack the new fields.
      return (parsed as Partial<InquiryRecordDTO>[]).map((row) => ({
        id: row.id ?? '',
        fullName: row.fullName ?? '',
        email: row.email ?? '',
        contactChannel: row.contactChannel ?? '',
        region: row.region ?? '',
        track: row.track ?? '',
        experienceNote: row.experienceNote ?? '',
        consentAccepted: row.consentAccepted === true,
        userId: row.userId ?? null,
        status: (row.status as InquiryStatus) ?? 'new',
        createdAt: row.createdAt ?? new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  }

  async save(inquiry: CertificationInquiry): Promise<InquiryRecordDTO[]> {
    const records = await this.loadAll();
    records.push(inquiry.toDTO());
    const bounded = records.slice(-1000);
    atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, bounded);
    return bounded;
  }

  async saveOne(inquiry: CertificationInquiry): Promise<void> {
    const records = await this.loadAll();
    const dto = inquiry.toDTO();
    const next = records.map((row) => (row.id === dto.id ? dto : row));
    atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, next);
  }

  async findById(id: string): Promise<CertificationInquiry | null> {
    const records = await this.loadAll();
    const row = records.find((r) => r.id === id);
    if (!row) return null;
    return CertificationInquiry.rehydrate({
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      contactChannel: row.contactChannel,
      region: row.region,
      track: row.track,
      experienceNote: row.experienceNote,
      consentAccepted: row.consentAccepted,
      userId: row.userId,
      status: row.status,
      createdAt: row.createdAt,
    });
  }

  async findByUser(userId: string): Promise<InquiryRecordDTO[]> {
    const records = await this.loadAll();
    return records
      .filter((r) => r.userId === userId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async count(): Promise<number> {
    return (await this.loadAll()).length;
  }
}
