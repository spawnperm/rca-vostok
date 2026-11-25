import { execFile } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';
import { natsBus } from '../nats/eventBus.ts';

const execFileAsync = promisify(execFile);

export const TARGET_REPO_DISPLAY = 'spawnperm/mvr';
export const TARGET_REPO_URL = 'https://github.com/spawnperm/mvr.git';

export const GitCommitPushSchema = z.object({
  commitMessage: z
    .string()
    .trim()
    .min(3, 'Укажите сообщение коммита (минимум 3 символа)')
    .max(200, 'Сообщение коммита не должно превышать 200 символов'),
  pat: z
    .string()
    .trim()
    .min(10, 'Укажите действительный GitHub Personal Access Token (PAT)')
    .max(250),
  branch: z.literal('main').default('main'),
});

function sanitizeGitOutput(text: string): string {
  return text
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, 'Basic [REDACTED]')
    .replace(/ghp_[A-Za-z0-9_]+/g, '[REDACTED_PAT]')
    .replace(/github_pat_[A-Za-z0-9_]+/g, '[REDACTED_PAT]')
    .replace(/x-access-token:[^@\s]+/gi, 'x-access-token:[REDACTED]');
}

async function runGit(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync('git', args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
    },
    maxBuffer: 1024 * 1024 * 4,
  });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

export async function getGitWorkspaceStatus() {
  try {
    const [branchRes, statusRes, logRes] = await Promise.all([
      runGit(['rev-parse', '--abbrev-ref', 'HEAD']),
      runGit(['status', '--porcelain']),
      runGit(['log', '-n', '1', '--oneline']).catch(() => ({ stdout: 'Нет коммитов', stderr: '' })),
    ]);

    const changedFiles = statusRes.stdout
      ? statusRes.stdout.split('\n').filter(Boolean)
      : [];

    return {
      repository: TARGET_REPO_DISPLAY,
      targetBranch: 'main',
      currentBranch: branchRes.stdout || 'main',
      lastCommit: logRes.stdout,
      changedCount: changedFiles.length,
      changedPreview: changedFiles.slice(0, 12),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Git недоступен';
    throw new Error(sanitizeGitOutput(msg));
  }
}

export async function commitAndPushToMain(params: {
  tenantId: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  commitMessage: string;
  pat: string;
}) {
  try {
    // Ensure git author identity is configured locally
    await runGit(['config', 'user.name', params.actorName || 'NexusHarness User']);
    await runGit(['config', 'user.email', params.actorEmail || 'portal@platform.local']);

    // Stage all tracked & untracked non-ignored changes
    await runGit(['add', '-A']);
    const statusAfterAdd = await runGit(['status', '--porcelain']);
    const stagedLines = statusAfterAdd.stdout
      ? statusAfterAdd.stdout.split('\n').filter(Boolean)
      : [];

    let committedNew = false;
    if (stagedLines.length > 0) {
      await runGit(['commit', '-m', params.commitMessage]);
      committedNew = true;
    }

    const authBasic = Buffer.from(`x-access-token:${params.pat}`, 'utf8').toString('base64');
    const authConfig = `http.extraHeader=Authorization: Basic ${authBasic}`;

    // Fetch origin/main safely using transient extraHeader (not stored on disk)
    let hasRemoteMain = true;
    try {
      await runGit(['-c', authConfig, 'fetch', TARGET_REPO_URL, 'refs/heads/main:refs/remotes/origin/main']);
    } catch {
      hasRemoteMain = false;
    }

    if (hasRemoteMain) {
      let isAncestor = false;
      try {
        await runGit(['merge-base', '--is-ancestor', 'refs/remotes/origin/main', 'HEAD']);
        isAncestor = true;
      } catch {
        isAncestor = false;
      }

      if (!isAncestor) {
        // Preserve remote main history while keeping 100% of current workspace tree (-s ours)
        await runGit([
          'merge',
          '--allow-unrelated-histories',
          '-s',
          'ours',
          '--no-edit',
          '-m',
          `chore: sync ${params.commitMessage} with origin/main`,
          'refs/remotes/origin/main',
        ]);
      }
    }

    await runGit(['-c', authConfig, 'push', TARGET_REPO_URL, 'HEAD:refs/heads/main']);

    const headShaRes = await runGit(['rev-parse', '--short', 'HEAD']);
    const commitSha = headShaRes.stdout;

    await natsBus.publish(params.tenantId, 'devops.git.pushed', params.actorId, {
      repository: TARGET_REPO_DISPLAY,
      branch: 'main',
      commitSha,
      committedNew,
      filesCount: stagedLines.length,
    });

    return {
      ok: true,
      repository: TARGET_REPO_DISPLAY,
      branch: 'main',
      commitSha,
      committedNew,
      filesCount: stagedLines.length,
    };
  } catch (err: unknown) {
    const raw =
      err && typeof err === 'object' && 'stderr' in err
        ? String((err as { stderr?: string; message?: string }).stderr || (err as { message?: string }).message)
        : err instanceof Error
        ? err.message
        : 'Ошибка отправки в GitHub';
    throw new Error(sanitizeGitOutput(raw));
  }
}
