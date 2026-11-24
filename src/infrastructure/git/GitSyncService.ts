import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { appLogger } from '../logging/Logger.ts';

const execFileAsync = promisify(execFile);
const gitLog = appLogger.child('git-sync');

export const TARGET_REPOSITORY_SLUG = 'spawnperm/rca-vostok';
export const TARGET_BRANCH = 'main';

const DEFAULT_AUTHOR_NAME = 'RCA Vostok Developer';
const DEFAULT_AUTHOR_EMAIL = 'spawnperm@gmail.com';

const SENSITIVE_PATH_PATTERNS: readonly RegExp[] = [
  /^\.env($|\.)/i,
  /\.pem$/i,
  /\.key$/i,
  /git-credentials/i,
  /git-sync-passcode/i,
  /^\.forgejo-/i,
];

export const commitAndPushInputSchema = z.object({
  commitMessage: z
    .string()
    .trim()
    .min(3, 'Укажите осмысленное сообщение коммита (минимум 3 символа).')
    .max(200, 'Сообщение коммита не должно превышать 200 символов.')
    .refine(
      (value) => !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value),
      'Сообщение коммита содержит недопустимые управляющие символы.'
    ),
  authorName: z
    .string()
    .trim()
    .min(2, 'Имя автора должно содержать минимум 2 символа.')
    .max(80, 'Имя автора слишком длинное.')
    .refine(
      (value) => !/[\r\n\x00-\x1f]/.test(value),
      'Имя автора содержит недопустимые символы.'
    )
    .optional(),
  authorEmail: z
    .string()
    .trim()
    .email('Укажите корректный e-mail автора коммита.')
    .max(120, 'E-mail автора слишком длинный.')
    .optional(),
});

export type CommitAndPushInput = z.infer<typeof commitAndPushInputSchema>;

export interface GitChangedFile {
  status: string;
  path: string;
}

export interface GitRecentCommit {
  hash: string;
  shortHash: string;
  subject: string;
  author: string;
  date: string;
}

export interface GitStatusReport {
  initialized?: boolean;
  statusMessage?: string;
  repository: string;
  branch: string;
  targetBranch: string;
  remoteUrl: string;
  ahead: number;
  behind: number;
  changedFiles: GitChangedFile[];
  hasChangesToCommit: boolean;
  canPush: boolean;
  recentCommits: GitRecentCommit[];
}

export interface GitCommitPushResult {
  ok: true;
  committed: boolean;
  pushed: boolean;
  commitHash: string | null;
  shortHash: string | null;
  commitMessage: string | null;
  filesCommittedCount: number;
  branch: string;
  remote: string;
  summary: string;
}

export class GitSyncError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 500, code = 'GIT_SYNC_ERROR') {
    super(message);
    this.name = 'GitSyncError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function sanitizeGitOutput(raw: string): string {
  return raw
    .replace(/x-access-token:[^@\s]+@/gi, 'x-access-token:***@')
    .replace(/https?:\/\/[^:\s/]+:[^@\s]+@/gi, 'https://***:***@')
    .replace(/ghp_[A-Za-z0-9_]+/g, 'ghp_***')
    .replace(/github_pat_[A-Za-z0-9_]+/g, 'github_pat_***');
}

export function sanitizeRemoteUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    return sanitizeGitOutput(trimmed);
  }
}

export function isSensitiveRepoPath(filePath: string): boolean {
  const base = path.basename(filePath.trim());
  if (base === '.env.example') return false;
  return SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(base) || pattern.test(filePath));
}

export function parseBranchHeader(headerLine: string): {
  branch: string;
  ahead: number;
  behind: number;
} {
  const clean = headerLine.replace(/^##\s*/, '').trim();
  const branchPart = clean.split('...')[0] || 'HEAD';
  const aheadMatch = /ahead\s+(\d+)/.exec(clean);
  const behindMatch = /behind\s+(\d+)/.exec(clean);
  return {
    branch: branchPart.trim(),
    ahead: aheadMatch ? Number(aheadMatch[1]) : 0,
    behind: behindMatch ? Number(behindMatch[1]) : 0,
  };
}

export class GitSyncService {
  private readonly repoRoot: string;

  constructor(repoRoot: string) {
    this.repoRoot = path.resolve(repoRoot);
  }

  private async runGit(
    args: string[],
    extraEnv?: Record<string, string>
  ): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await execFileAsync(
        'git',
        ['-c', `safe.directory=${this.repoRoot}`, ...args],
        {
          cwd: this.repoRoot,
          timeout: 30_000,
          maxBuffer: 2 * 1024 * 1024,
          env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: '0',
            ...(extraEnv ?? {}),
          },
        }
      );
      return {
        stdout: String(result.stdout ?? ''),
        stderr: String(result.stderr ?? ''),
      };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      const detail = sanitizeGitOutput(String(e.stderr || e.stdout || e.message || 'Git error'));
      throw new GitSyncError(detail, 500, 'GIT_COMMAND_FAILED');
    }
  }

  private async withTokenAskPass<T>(
    explicitToken: string | undefined,
    fn: (extraEnv: Record<string, string>) => Promise<T>
  ): Promise<T> {
    const token = (explicitToken || process.env.GITHUB_TOKEN || process.env.GIT_TOKEN || '').trim();
    if (!token) {
      throw new GitSyncError(
        'Отсутствует действующий ключ доступа GitHub для отправки изменений.',
        401,
        'KEY_REQUIRED'
      );
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-git-askpass-'));
    const scriptPath = path.join(tmpDir, 'askpass.sh');
    try {
      // Read token via environment variable rather than writing it into the script body.
      fs.writeFileSync(
        scriptPath,
        '#!/bin/sh\ncase "$1" in\n  *Username*) printf "%s\\n" "x-access-token" ;;\n  *) printf "%s\\n" "$RCA_GIT_TOKEN" ;;\nesac\n',
        { encoding: 'utf-8', mode: 0o700 }
      );
      return await fn({
        GIT_ASKPASS: scriptPath,
        RCA_GIT_TOKEN: token,
      });
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    }
  }

  async getStatus(): Promise<GitStatusReport> {
    const gitDirExists = fs.existsSync(path.join(this.repoRoot, '.git'));
    if (!gitDirExists) {
      return {
        initialized: false,
        statusMessage:
          'Локальный Git-репозиторий (.git) отсутствует в текущем окружении. Синхронизация недоступна в production-сборке.',
        repository: TARGET_REPOSITORY_SLUG,
        branch: 'unavailable',
        targetBranch: TARGET_BRANCH,
        remoteUrl: '',
        ahead: 0,
        behind: 0,
        changedFiles: [],
        hasChangesToCommit: false,
        canPush: false,
        recentCommits: [],
      };
    }

    let statusStdout = '';
    try {
      const statusRes = await this.runGit(['status', '--porcelain=v1', '-b']);
      statusStdout = statusRes.stdout;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      gitLog.info('Failed to inspect git repository status', {
        repoRoot: this.repoRoot,
        reason: msg,
      });
      return {
        initialized: false,
        statusMessage: `Не удалось прочитать статус Git: ${sanitizeGitOutput(msg)}`,
        repository: TARGET_REPOSITORY_SLUG,
        branch: 'unavailable',
        targetBranch: TARGET_BRANCH,
        remoteUrl: '',
        ahead: 0,
        behind: 0,
        changedFiles: [],
        hasChangesToCommit: false,
        canPush: false,
        recentCommits: [],
      };
    }

    const [remoteRes, logRes] = await Promise.all([
      this.runGit(['remote', 'get-url', 'origin']).catch(() => ({ stdout: '', stderr: '' })),
      this.runGit(['log', '-n', '5', '--format=%H%x1f%h%x1f%s%x1f%an%x1f%aI']).catch(() => ({
        stdout: '',
        stderr: '',
      })),
    ]);

    const lines = statusStdout.split(/\r?\n/).filter((line) => line.length > 0);
    const header = lines[0]?.startsWith('##') ? parseBranchHeader(lines[0]) : { branch: 'unknown', ahead: 0, behind: 0 };

    const changedFiles: GitChangedFile[] = lines
      .slice(lines[0]?.startsWith('##') ? 1 : 0)
      .map((line) => ({
        status: line.slice(0, 2).trim() || 'M',
        path: line.slice(3).trim(),
      }))
      .filter((entry) => entry.path.length > 0);

    const recentCommits: GitRecentCommit[] = logRes.stdout
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const [hash = '', shortHash = '', subject = '', author = '', date = ''] =
          line.split('\x1f');
        return { hash, shortHash, subject, author, date };
      });

    return {
      initialized: true,
      repository: TARGET_REPOSITORY_SLUG,
      branch: header.branch,
      targetBranch: TARGET_BRANCH,
      remoteUrl: sanitizeRemoteUrl(remoteRes.stdout),
      ahead: header.ahead,
      behind: header.behind,
      changedFiles,
      hasChangesToCommit: changedFiles.length > 0,
      canPush: changedFiles.length > 0 || header.ahead > 0,
      recentCommits,
    };
  }

  async commitAndPush(rawInput: unknown, accessKey?: string): Promise<GitCommitPushResult> {
    const parsed = commitAndPushInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Некорректные параметры коммита.';
      throw new GitSyncError(issue, 400, 'VALIDATION_ERROR');
    }

    const statusBefore = await this.getStatus();
    if (statusBefore.initialized === false) {
      throw new GitSyncError(
        statusBefore.statusMessage || 'Локальный Git-репозиторий (.git) не инициализирован.',
        409,
        'GIT_NOT_INITIALIZED'
      );
    }

    if (statusBefore.branch !== TARGET_BRANCH) {
      throw new GitSyncError(
        `Текущая ветка «${statusBefore.branch}» отличается от целевой ветки «${TARGET_BRANCH}».`,
        409,
        'WRONG_BRANCH'
      );
    }

    if (!statusBefore.remoteUrl.includes(TARGET_REPOSITORY_SLUG)) {
      throw new GitSyncError(
        `Удалённый репозиторий origin (${statusBefore.remoteUrl || 'не задан'}) не соответствует ${TARGET_REPOSITORY_SLUG}.`,
        409,
        'WRONG_REMOTE'
      );
    }

    if (statusBefore.changedFiles.length === 0 && statusBefore.ahead === 0) {
      throw new GitSyncError(
        'В проекте нет незафиксированных изменений или неотправленных коммитов.',
        409,
        'NOTHING_TO_COMMIT'
      );
    }

    const authorName =
      parsed.data.authorName || process.env.GIT_AUTHOR_NAME || DEFAULT_AUTHOR_NAME;
    const authorEmail =
      parsed.data.authorEmail || process.env.GIT_AUTHOR_EMAIL || DEFAULT_AUTHOR_EMAIL;

    let committed = false;
    let commitHash: string | null = null;
    let shortHash: string | null = null;
    let filesCommittedCount = 0;

    if (statusBefore.changedFiles.length > 0) {
      await this.runGit(['add', '-A']);

      const stagedRes = await this.runGit(['diff', '--cached', '--name-only']);
      const stagedFiles = stagedRes.stdout
        .split(/\r?\n/)
        .map((f) => f.trim())
        .filter(Boolean);

      const blockedSensitive = stagedFiles.filter((f) => isSensitiveRepoPath(f));
      if (blockedSensitive.length > 0) {
        await this.runGit(['reset', 'HEAD', '--', ...blockedSensitive]);
        throw new GitSyncError(
          `Операция остановлена: обнаружены конфиденциальные файлы (${blockedSensitive.join(', ')}).`,
          400,
          'SENSITIVE_FILE_BLOCKED'
        );
      }

      if (stagedFiles.length > 0) {
        await this.runGit([
          '-c',
          `user.name=${authorName}`,
          '-c',
          `user.email=${authorEmail}`,
          'commit',
          '-m',
          parsed.data.commitMessage,
        ]);

        const headRes = await this.runGit(['rev-parse', 'HEAD', '--short', 'HEAD']);
        const headLines = headRes.stdout.split(/\r?\n/).filter(Boolean);
        commitHash = headLines[0] ?? null;
        shortHash = headLines[1] ?? (commitHash ? commitHash.slice(0, 7) : null);
        filesCommittedCount = stagedFiles.length;
        committed = true;
      }
    }

    await this.withTokenAskPass(accessKey, async (extraEnv) => {
      // Disable global credential helpers so push strictly uses the verified key.
      await this.runGit(['-c', 'credential.helper=', 'push', 'origin', TARGET_BRANCH], extraEnv);
    });

    if (!commitHash) {
      const headRes = await this.runGit(['rev-parse', 'HEAD', '--short', 'HEAD']);
      const headLines = headRes.stdout.split(/\r?\n/).filter(Boolean);
      commitHash = headLines[0] ?? null;
      shortHash = headLines[1] ?? (commitHash ? commitHash.slice(0, 7) : null);
    }

    gitLog.info('Committed and pushed changes to GitHub', {
      repository: TARGET_REPOSITORY_SLUG,
      branch: TARGET_BRANCH,
      committed,
      shortHash,
      filesCommittedCount,
    });

    return {
      ok: true,
      committed,
      pushed: true,
      commitHash,
      shortHash,
      commitMessage: committed ? parsed.data.commitMessage : null,
      filesCommittedCount,
      branch: TARGET_BRANCH,
      remote: TARGET_REPOSITORY_SLUG,
      summary: committed
        ? `Коммит ${shortHash ?? ''} (${filesCommittedCount} ф.) зафиксирован и отправлен в ${TARGET_REPOSITORY_SLUG} (${TARGET_BRANCH}).`
        : `Локальные коммиты отправлены в ${TARGET_REPOSITORY_SLUG} (${TARGET_BRANCH}).`,
    };
  }
}
