import fs from 'fs';
import type {
  CertificationInquiry,
  InquiryRecordDTO,
} from '../../domain/certification/CertificationInquiry.ts';
import type { InquiryRepository } from '../../domain/certification/InquiryRepository.ts';
import { atomicWriteJson, ensureDirectory, resolveConfinedPath } from './PathConfinement.ts';

export class JsonFileInquiryRepository implements InquiryRepository {
  private readonly dataDir: string;
  private readonly fileName: string;
  private readonly tempFileName: string;

  constructor(dataDir: string, fileName = 'inquiries.json') {
    this.dataDir = dataDir;
    this.fileName = fileName;
    this.tempFileName = `${fileName}.tmp`;
  }

  loadAll(): InquiryRecordDTO[] {
    ensureDirectory(this.dataDir);
    const targetPath = resolveConfinedPath(this.dataDir, this.fileName);
    if (!fs.existsSync(targetPath)) {
      return [];
    }
    try {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as InquiryRecordDTO[]) : [];
    } catch {
      return [];
    }
  }

  save(inquiry: CertificationInquiry): InquiryRecordDTO[] {
    const records = this.loadAll();
    records.push(inquiry.toDTO());
    const bounded = records.slice(-1000);
    atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, bounded);
    return bounded;
  }

  count(): number {
    return this.loadAll().length;
  }
}
