import crypto from 'node:crypto';
import { Sha256SessionTokenService } from '../security/ScryptPasswordHasher.ts';
import { TARGET_REPOSITORY_SLUG } from './GitSyncService.ts';

const TOKEN_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours
const GITHUB_REPO_API_URL = `https://api.github.com/repos/${TARGET_REPOSITORY_SLUG}`;

export type GitSyncAuthMode = 'key' | 'key_required';

export interface GitKeyVerificationResult {
  valid: boolean;
  canPush: boolean;
  reason?: string;
}

export type GitRepoKeyVerifier = (accessKey: string) => Promise<GitKeyVerificationResult>;

export interface GitSyncAuthOptions {
  getEnvAccessKey?: () => string | undefined;
  getEnvGitHubToken?: () => string | undefined;
  verifyRepoKey?: GitRepoKeyVerifier;
}

interface KeySessionRecord {
  expiresAt: number;
  pushToken: string;
}

function timingSafeEqualString(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Verifies a GitHub Personal Access Token directly against the target
 * repository API (`https://api.github.com/repos/spawnperm/rca-vostok`) and
 * ensures it holds `push` permission.
 */
export async function defaultVerifyGitHubRepoKey(
  accessKey: string
): Promise<GitKeyVerificationResult> {
  const trimmed = accessKey.trim();
  if (!trimmed) {
    return { valid: false, canPush: false, reason: 'Ключ доступа не может быть пустым.' };
  }

  let response: Response;
  try {
    response = await fetch(GITHUB_REPO_API_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${trimmed}`,
        'User-Agent': 'rca-vostok-git-sync',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return {
      valid: false,
      canPush: false,
      reason: 'Не удалось связаться с GitHub API для проверки ключа доступа.',
    };
  }

  if (response.status === 401) {
    return {
      valid: false,
      canPush: false,
      reason: 'Ключ доступа отклонён GitHub (неверный или отозванный токен).',
    };
  }

  if (response.status === 403 || response.status === 404) {
    return {
      valid: false,
      canPush: false,
      reason: `Ключ не имеет доступа к репозиторию ${TARGET_REPOSITORY_SLUG}.`,
    };
  }

  if (!response.ok) {
    return {
      valid: false,
      canPush: false,
      reason: `GitHub API вернул ошибку проверки ключа (${response.status}).`,
    };
  }

  const payload = (await response.json().catch(() => ({}))) as {
    permissions?: { push?: boolean; admin?: boolean };
  };
  const canPush = Boolean(payload.permissions?.push || payload.permissions?.admin);
  if (!canPush) {
    return {
      valid: true,
      canPush: false,
      reason: `Ключ действителен, но у него нет прав на запись (push) в ${TARGET_REPOSITORY_SLUG}.`,
    };
  }

  return { valid: true, canPush: true };
}

/**
 * Server-side key-based authorization for Git commit & push operations.
 *
 * Keys are never written to disk or echoed back to clients; verified keys stay
 * only in process memory for the lifetime of the Bearer session (8 hours).
 */
export class GitSyncAuthService {
  private readonly getEnvAccessKey: () => string | undefined;
  private readonly getEnvGitHubToken: () => string | undefined;
  private readonly verifyRepoKey: GitRepoKeyVerifier;
  private readonly tokens = new Sha256SessionTokenService();
  private readonly sessions = new Map<string, KeySessionRecord>();

  constructor(options: GitSyncAuthOptions = {}) {
    this.getEnvAccessKey = options.getEnvAccessKey ?? (() => process.env.GIT_ACCESS_KEY);
    this.getEnvGitHubToken =
      options.getEnvGitHubToken ?? (() => process.env.GITHUB_TOKEN || process.env.GIT_TOKEN);
    this.verifyRepoKey = options.verifyRepoKey ?? defaultVerifyGitHubRepoKey;
  }

  private issueToken(pushToken: string): { token: string; expiresAt: string } {
    this.purgeExpired();
    const { token, tokenHash } = this.tokens.issue();
    const expiresAtMs = Date.now() + TOKEN_TTL_MS;
    this.sessions.set(tokenHash, { expiresAt: expiresAtMs, pushToken });
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

  private extractBearer(authHeader: string | undefined): string | null {
    if (!authHeader) return null;
    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    if (!match) return null;
    const rawToken = match[1].trim();
    return rawToken || null;
  }

  resolveSession(authHeader: string | undefined): { authorized: boolean; pushToken?: string } {
    const rawToken = this.extractBearer(authHeader);
    if (!rawToken) return { authorized: false };

    const hash = this.tokens.hashToken(rawToken);
    const rec = this.sessions.get(hash);
    if (!rec) return { authorized: false };
    if (rec.expiresAt <= Date.now()) {
      this.sessions.delete(hash);
      return { authorized: false };
    }
    return { authorized: true, pushToken: rec.pushToken };
  }

  resolveBearerToken(authHeader: string | undefined): boolean {
    return this.resolveSession(authHeader).authorized;
  }

  revokeBearerToken(authHeader: string | undefined): void {
    const rawToken = this.extractBearer(authHeader);
    if (!rawToken) return;
    this.sessions.delete(this.tokens.hashToken(rawToken));
  }

  getAuthStatus(options: { authHeader?: string }): {
    authorized: boolean;
    mode: GitSyncAuthMode;
  } {
    if (this.resolveBearerToken(options.authHeader)) {
      return { authorized: true, mode: 'key' };
    }
    return { authorized: false, mode: 'key_required' };
  }

  async verifyAccessKey(accessKey: string): Promise<{ token: string; expiresAt: string }> {
    const trimmed = accessKey.trim();
    if (trimmed.length < 8) {
      throw new GitAuthError('Укажите корректный ключ доступа (минимум 8 символов).', 400);
    }
    if (trimmed.length > 256) {
      throw new GitAuthError('Ключ доступа слишком длинный.', 400);
    }

    const envAccessKey = (this.getEnvAccessKey() ?? '').trim();
    if (envAccessKey.length > 0 && timingSafeEqualString(trimmed, envAccessKey)) {
      const configuredPushToken = (this.getEnvGitHubToken() ?? '').trim() || trimmed;
      return this.issueToken(configuredPushToken);
    }

    const check = await this.verifyRepoKey(trimmed);
    if (!check.valid || !check.canPush) {
      throw new GitAuthError(
        check.reason || `Ключ доступа не подходит для отправки в ${TARGET_REPOSITORY_SLUG}.`,
        check.valid ? 403 : 401
      );
    }

    return this.issueToken(trimmed);
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
