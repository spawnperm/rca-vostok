import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  GitAuthError,
  GitSyncAuthService,
} from '../src/infrastructure/git/GitSyncAuth.ts';
import {
  GitSyncError,
  GitSyncService,
  commitAndPushInputSchema,
  isSensitiveRepoPath,
  parseBranchHeader,
  sanitizeGitOutput,
  sanitizeRemoteUrl,
} from '../src/infrastructure/git/GitSyncService.ts';

test('GitSyncAuthService: requires a verified repository access key with push permission', async () => {
  const auth = new GitSyncAuthService({
    getEnvAccessKey: () => undefined,
    verifyRepoKey: async (key) => {
      if (key === 'ghp_valid_push_key') {
        return { valid: true, canPush: true };
      }
      if (key === 'ghp_readonly_key') {
        return { valid: true, canPush: false, reason: 'Нет прав на push.' };
      }
      return { valid: false, canPush: false, reason: 'Неверный ключ.' };
    },
  });

  assert.deepEqual(auth.getAuthStatus({}), {
    authorized: false,
    mode: 'key_required',
  });

  await assert.rejects(
    () => auth.verifyAccessKey('short'),
    (err: unknown) => err instanceof GitAuthError && err.statusCode === 400
  );

  await assert.rejects(
    () => auth.verifyAccessKey('ghp_invalid_key'),
    (err: unknown) => err instanceof GitAuthError && err.statusCode === 401
  );

  await assert.rejects(
    () => auth.verifyAccessKey('ghp_readonly_key'),
    (err: unknown) => err instanceof GitAuthError && err.statusCode === 403
  );

  const verified = await auth.verifyAccessKey('ghp_valid_push_key');
  assert.ok(verified.token.length > 20);
  assert.deepEqual(auth.getAuthStatus({ authHeader: `Bearer ${verified.token}` }), {
    authorized: true,
    mode: 'key',
  });
  assert.deepEqual(auth.resolveSession(`Bearer ${verified.token}`), {
    authorized: true,
    pushToken: 'ghp_valid_push_key',
  });

  auth.revokeBearerToken(`Bearer ${verified.token}`);
  assert.equal(auth.resolveBearerToken(`Bearer ${verified.token}`), false);
});

test('GitSyncAuthService: supports GIT_ACCESS_KEY server override paired with GITHUB_TOKEN', async () => {
  const auth = new GitSyncAuthService({
    getEnvAccessKey: () => 'server-access-key-2027',
    getEnvGitHubToken: () => 'ghp_configured_push_token',
    verifyRepoKey: async () => ({ valid: false, canPush: false }),
  });

  const verified = await auth.verifyAccessKey('server-access-key-2027');
  const session = auth.resolveSession(`Bearer ${verified.token}`);
  assert.equal(session.authorized, true);
  assert.equal(session.pushToken, 'ghp_configured_push_token');
});

test('GitSyncService helpers: sanitize credentials, block sensitive paths, and validate commit input', async () => {
  assert.equal(
    sanitizeRemoteUrl('https://x-access-token:ghp_secret123@github.com/spawnperm/rca-vostok.git'),
    'https://github.com/spawnperm/rca-vostok.git'
  );
  assert.equal(
    sanitizeGitOutput('fatal: auth failed with ghp_AbCdEf123456'),
    'fatal: auth failed with ghp_***'
  );

  assert.equal(isSensitiveRepoPath('.env'), true);
  assert.equal(isSensitiveRepoPath('.env.local'), true);
  assert.equal(isSensitiveRepoPath('data/git-sync-passcode.json'), true);
  assert.equal(isSensitiveRepoPath('.env.example'), false);
  assert.equal(isSensitiveRepoPath('src/App.tsx'), false);

  assert.deepEqual(parseBranchHeader('## main...origin/main [ahead 2, behind 1]'), {
    branch: 'main',
    ahead: 2,
    behind: 1,
  });

  assert.equal(commitAndPushInputSchema.safeParse({ commitMessage: 'hi' }).success, false);
  assert.equal(
    commitAndPushInputSchema.safeParse({ commitMessage: 'bad\x00message' }).success,
    false
  );
  assert.equal(
    commitAndPushInputSchema.safeParse({
      commitMessage: 'feat: sync updates',
      authorName: 'Developer',
      authorEmail: 'dev@example.com',
    }).success,
    true
  );

  const service = new GitSyncService(process.cwd());
  await assert.rejects(
    () => service.commitAndPush({ commitMessage: '' }),
    (err: unknown) => err instanceof GitSyncError && err.statusCode === 400
  );
});

test('GitSyncService: gracefully reports uninitialized status instead of 500 when .git directory is missing', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-no-git-'));
  try {
    const service = new GitSyncService(tempRoot);
    const status = await service.getStatus();
    assert.equal(status.initialized, false);
    assert.equal(status.branch, 'unavailable');
    assert.equal(status.canPush, false);
    assert.deepEqual(status.changedFiles, []);

    await assert.rejects(
      () => service.commitAndPush({ commitMessage: 'feat: test missing git dir' }),
      (err: unknown) =>
        err instanceof GitSyncError &&
        err.statusCode === 409 &&
        err.code === 'GIT_NOT_INITIALIZED'
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

