import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  atomicWriteJson,
  resolveConfinedPath,
} from '../persistence/PathConfinement.ts';
import {
  ScryptPasswordHasher,
  Sha256SessionTokenService,
} from '../security/ScryptPasswordHasher.ts';

const CLAIM_FILE_NAME = 'git-sync-passcode.json';
const CLAIM_TEMP_FILE = 'git-sync-passcode.tmp.json';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

interface StoredPasscodeClaim {
  passwordHash: string;
  passwordSalt: string;
  claimedAt: string;
}

export type GitSyncAuthMode = 'cabinet_admin' | 'passcode' | 'setup_required' | 'locked';

export interface GitSyncAuthOptions {
  dataDir: string;
  getEnvPasscode?: () => string | undefined;
}

function timingSafeEqualString(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Server-side authorization guard for the Git commit/push endpoints.
 *
 * Precedence:
 * 1. Authenticated cabinet admin (`users:manage`) is always authorized.
 * 2. If `GIT_SYNC_PASSCODE` is configured in the server environment, callers
 *    must unlock with that passcode (`POST /api/git/unlock`) to receive an
 *    in-memory Bearer token.
 * 3. If `GIT_SYNC_PASSCODE` is unset and no passcode has been claimed yet,
 *    the first operator claims a passcode (`POST /api/git/claim-passcode`),
 *    which is stored scrypt-hashed in `data/git-sync-passcode.json` (gitignored).
 */
export class GitSyncAuthService {
  private readonly dataDir: string;
  private readonly getEnvPasscode: () => string | undefined;
  private readonly hasher = new ScryptPasswordHasher();
  private readonly tokens = new Sha256SessionTokenService();
  private readonly sessions = new Map<string, { expiresAt: number }>();

  constructor(options: GitSyncAuthOptions) {
    this.dataDir = options.dataDir;
    this.getEnvPasscode = options.getEnvPasscode ?? (() => process.env.GIT_SYNC_PASSCODE);
  }

  private envPasscode(): string {
    return (this.getEnvPasscode() ?? '').trim();
  }

  private readClaimedPasscode(): StoredPasscodeClaim | null {
    try {
      const filePath = resolveConfinedPath(this.dataDir, CLAIM_FILE_NAME);
      if (!fs.existsSync(filePath)) return null;
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<StoredPasscodeClaim>;
      if (
        typeof parsed.passwordHash === 'string' &&
        typeof parsed.passwordSalt === 'string' &&
        parsed.passwordHash.length > 0 &&
        parsed.passwordSalt.length > 0
      ) {
        return {
          passwordHash: parsed.passwordHash,
          passwordSalt: parsed.passwordSalt,
          claimedAt: typeof parsed.claimedAt === 'string' ? parsed.claimedAt : '',
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  hasPasscodeConfigured(): boolean {
    if (this.envPasscode().length > 0) return true;
    return this.readClaimedPasscode() !== null;
  }

  private issueToken(): { token: string; expiresAt: string } {
    this.purgeExpired();
    const { token, tokenHash } = this.tokens.issue();
    const expiresAtMs = Date.now() + TOKEN_TTL_MS;
    this.sessions.set(tokenHash, { expiresAt: expiresAtMs });
    return { token, expiresAt: new Date(expiresAtMs).toISOString() };
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [hash, rec] of this.sessions) {
      if (rec.expiresAt <= now) {
        this.sessions.delete(hash);
      }
    }
  }

  resolveBearerToken(authHeader: string | undefined): boolean {
    if (!authHeader) return false;
    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    if (!match) return false;
    const rawToken = match[1].trim();
    if (!rawToken) return false;

    const hash = this.tokens.hashToken(rawToken);
    const rec = this.sessions.get(hash);
    if (!rec) return false;
    if (rec.expiresAt <= Date.now()) {
      this.sessions.delete(hash);
      return false;
    }
    return true;
  }

  revokeBearerToken(authHeader: string | undefined): void {
    if (!authHeader) return;
    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    if (!match) return;
    const rawToken = match[1].trim();
    if (!rawToken) return;
    this.sessions.delete(this.tokens.hashToken(rawToken));
  }

  getAuthStatus(options: { isCabinetAdmin: boolean; authHeader?: string }): {
    authorized: boolean;
    mode: GitSyncAuthMode;
  } {
    if (options.isCabinetAdmin) {
      return { authorized: true, mode: 'cabinet_admin' };
    }
    if (this.resolveBearerToken(options.authHeader)) {
      return { authorized: true, mode: 'passcode' };
    }
    if (!this.hasPasscodeConfigured()) {
      return { authorized: false, mode: 'setup_required' };
    }
    return { authorized: false, mode: 'locked' };
  }

  async claimPasscode(passcode: string): Promise<{ token: string; expiresAt: string }> {
    const trimmed = passcode.trim();
    if (trimmed.length < 8) {
      throw new GitAuthError('Пароль оператора Git должен содержать не менее 8 символов.', 400);
    }
    if (trimmed.length > 128) {
      throw new GitAuthError('Пароль слишком длинный (максимум 128 символов).', 400);
    }
    if (this.hasPasscodeConfigured()) {
      throw new GitAuthError(
        'Пароль оператора Git уже настроен. Используйте вход по паролю.',
        409
      );
    }

    const material = await this.hasher.hash(trimmed);
    atomicWriteJson(this.dataDir, CLAIM_FILE_NAME, CLAIM_TEMP_FILE, {
      passwordHash: material.passwordHash,
      passwordSalt: material.passwordSalt,
      claimedAt: new Date().toISOString(),
    });

    const targetPath = resolveConfinedPath(this.dataDir, CLAIM_FILE_NAME);
    try {
      fs.chmodSync(targetPath, 0o600);
    } catch {
      // Ignore chmod issues on filesystems without POSIX permissions
    }

    return this.issueToken();
  }

  async verifyPasscode(passcode: string): Promise<{ token: string; expiresAt: string }> {
    const trimmed = passcode.trim();
    if (!trimmed) {
      throw new GitAuthError('Введите пароль оператора Git.', 400);
    }

    const envSecret = this.envPasscode();
    if (envSecret.length > 0) {
      if (!timingSafeEqualString(trimmed, envSecret)) {
        throw new GitAuthError('Неверный пароль оператора Git.', 401);
      }
      return this.issueToken();
    }

    const claimed = this.readClaimedPasscode();
    if (!claimed) {
      throw new GitAuthError('Пароль оператора Git ещё не задан.', 409);
    }

    const ok = await this.hasher.verify(trimmed, claimed);
    if (!ok) {
      throw new GitAuthError('Неверный пароль оператора Git.', 401);
    }
    return this.issueToken();
  }
}

export class GitAuthError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'GitAuthError';
    this.statusCode = statusCode;
  }
}
