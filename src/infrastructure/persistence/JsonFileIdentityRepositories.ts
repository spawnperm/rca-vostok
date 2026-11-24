import fs from 'fs';
import { User } from '../../domain/identity/User.ts';
import type {
  SessionRecord,
  SessionRepository,
  UserRepository,
} from '../../domain/identity/IdentityRepositories.ts';
import type {
  PasswordResetRepository,
  PasswordResetTokenRecord,
} from '../../domain/identity/PasswordReset.ts';
import { atomicWriteJson, ensureDirectory, resolveConfinedPath } from './PathConfinement.ts';

interface StoredUserRecord {
  id: string;
  email: string;
  fullName: string;
  region: string;
  organisation: string;
  phone: string;
  telegram: string;
  avatarUrl: string;
  role: string;
  passwordHash: string;
  passwordSalt: string;
  isActive: boolean;
  attestationExpiresAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

function serializeUser(user: User): StoredUserRecord {
  return {
    id: user.id,
    email: user.email.value,
    fullName: user.fullName.value,
    region: user.region,
    organisation: user.organisation,
    phone: user.phone,
    telegram: user.telegram,
    avatarUrl: user.avatarUrl,
    role: user.role,
    passwordHash: user.passwordHash,
    passwordSalt: user.passwordSalt,
    isActive: user.isActive,
    attestationExpiresAt: user.attestationExpiresAt,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function readJsonArray<T>(dataDir: string, fileName: string): T[] {
  ensureDirectory(dataDir);
  const filePath = resolveConfinedPath(dataDir, fileName);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * File-backed user repository confined inside DATA_DIR so registered accounts,
 * roles and passwords persist across restarts in local / non-Postgres runs.
 */
export class JsonFileUserRepository implements UserRepository {
  private readonly dataDir: string;
  private readonly fileName: string;
  private readonly tempFileName: string;

  constructor(dataDir: string, fileName = 'users.json') {
    this.dataDir = dataDir;
    this.fileName = fileName;
    this.tempFileName = `${fileName}.tmp`;
  }

  private readAllRecords(): StoredUserRecord[] {
    return readJsonArray<StoredUserRecord>(this.dataDir, this.fileName);
  }

  async findById(id: string): Promise<User | null> {
    const row = this.readAllRecords().find((r) => r.id === id);
    return row ? User.rehydrate(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const needle = email.trim().toLowerCase();
    const row = this.readAllRecords().find((r) => r.email.toLowerCase() === needle);
    return row ? User.rehydrate(row) : null;
  }

  async save(user: User): Promise<void> {
    const records = this.readAllRecords();
    const serialized = serializeUser(user);
    const idx = records.findIndex((r) => r.id === user.id);
    if (idx === -1) {
      records.push(serialized);
    } else {
      records[idx] = serialized;
    }
    atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, records);
  }

  async listAll(): Promise<User[]> {
    return this.readAllRecords()
      .map((r) => User.rehydrate(r))
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }

  async count(): Promise<number> {
    return this.readAllRecords().length;
  }
}

/**
 * File-backed session store storing only SHA-256 session token hashes.
 */
export class JsonFileSessionRepository implements SessionRepository {
  private readonly dataDir: string;
  private readonly fileName: string;
  private readonly tempFileName: string;

  constructor(dataDir: string, fileName = 'user-sessions.json') {
    this.dataDir = dataDir;
    this.fileName = fileName;
    this.tempFileName = `${fileName}.tmp`;
  }

  private readAll(): SessionRecord[] {
    return readJsonArray<SessionRecord>(this.dataDir, this.fileName);
  }

  private writeAll(records: SessionRecord[]): void {
    atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, records);
  }

  async create(session: SessionRecord): Promise<void> {
    const records = this.readAll().filter((r) => r.tokenHash !== session.tokenHash);
    records.push(session);
    this.writeAll(records);
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.readAll().find((r) => r.tokenHash === tokenHash) ?? null;
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    const records = this.readAll();
    const next = records.filter((r) => r.tokenHash !== tokenHash);
    if (next.length !== records.length) {
      this.writeAll(next);
    }
  }

  async deleteByUserId(userId: string): Promise<void> {
    const records = this.readAll();
    const next = records.filter((r) => r.userId !== userId);
    if (next.length !== records.length) {
      this.writeAll(next);
    }
  }

  async purgeExpired(now: string): Promise<number> {
    const records = this.readAll();
    const next = records.filter((r) => r.expiresAt > now);
    const removed = records.length - next.length;
    if (removed > 0) {
      this.writeAll(next);
    }
    return removed;
  }
}

/**
 * File-backed single-use password-reset token store.
 */
export class JsonFilePasswordResetRepository implements PasswordResetRepository {
  private readonly dataDir: string;
  private readonly fileName: string;
  private readonly tempFileName: string;

  constructor(dataDir: string, fileName = 'password-reset-tokens.json') {
    this.dataDir = dataDir;
    this.fileName = fileName;
    this.tempFileName = `${fileName}.tmp`;
  }

  private readAll(): PasswordResetTokenRecord[] {
    return readJsonArray<PasswordResetTokenRecord>(this.dataDir, this.fileName);
  }

  private writeAll(records: PasswordResetTokenRecord[]): void {
    atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, records);
  }

  async save(record: PasswordResetTokenRecord): Promise<void> {
    const records = this.readAll();
    if (records.some((r) => r.tokenHash === record.tokenHash)) return;
    records.push(record);
    this.writeAll(records);
  }

  async findUsable(
    tokenHash: string,
    now: string
  ): Promise<PasswordResetTokenRecord | null> {
    const record = this.readAll().find((r) => r.tokenHash === tokenHash);
    if (!record || record.usedAt || record.expiresAt <= now) return null;
    return record;
  }

  async markUsed(tokenHash: string, at: string): Promise<void> {
    const records = this.readAll();
    let changed = false;
    const next = records.map((r) => {
      if (r.tokenHash !== tokenHash) return r;
      changed = true;
      return { ...r, usedAt: at };
    });
    if (changed) {
      this.writeAll(next);
    }
  }

  async deleteForUser(userId: string): Promise<void> {
    const records = this.readAll();
    const next = records.filter((r) => r.userId !== userId);
    if (next.length !== records.length) {
      this.writeAll(next);
    }
  }

  async purgeExpired(cutoffIso: string): Promise<number> {
    const records = this.readAll();
    const next = records.filter((r) => r.createdAt >= cutoffIso);
    const removed = records.length - next.length;
    if (removed > 0) {
      this.writeAll(next);
    }
    return removed;
  }
}
