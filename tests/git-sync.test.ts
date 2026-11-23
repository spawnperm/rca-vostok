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

test('GitSyncAuthService: supports first-run claim, verification, token resolution, and revocation', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-git-auth-'));
  try {
    const auth = new GitSyncAuthService({
      dataDir: tmpDir,
      getEnvPasscode: () => undefined,
    });

    assert.deepEqual(auth.getAuthStatus({ isCabinetAdmin: false }), {
      authorized: false,
      mode: 'setup_required',
    });

    await assert.rejects(
      () => auth.claimPasscode('short'),
      (err: unknown) => err instanceof GitAuthError && err.statusCode === 400
    );

    const claimed = await auth.claimPasscode('vostok-operator-2027');
    assert.ok(claimed.token.length > 20);
    assert.equal(auth.resolveBearerToken(`Bearer ${claimed.token}`), true);
    assert.deepEqual(
      auth.getAuthStatus({ isCabinetAdmin: false, authHeader: `Bearer ${claimed.token}` }),
      { authorized: true, mode: 'passcode' }
    );

    // Second claim must be rejected once claimed.
    await assert.rejects(
      () => auth.claimPasscode('another-passcode-123'),
      (err: unknown) => err instanceof GitAuthError && err.statusCode === 409
    );

    // Wrong passcode fails with 401.
    await assert.rejects(
      () => auth.verifyPasscode('wrong-passcode'),
      (err: unknown) => err instanceof GitAuthError && err.statusCode === 401
    );

    // Valid passcode issues a working token.
    const unlocked = await auth.verifyPasscode('vostok-operator-2027');
    assert.equal(auth.resolveBearerToken(`Bearer ${unlocked.token}`), true);

    // Revocation invalidates token immediately.
    auth.revokeBearerToken(`Bearer ${unlocked.token}`);
    assert.equal(auth.resolveBearerToken(`Bearer ${unlocked.token}`), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('GitSyncAuthService: env passcode takes precedence and cabinet admin always bypasses passcode', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-git-env-'));
  try {
    const auth = new GitSyncAuthService({
      dataDir: tmpDir,
      getEnvPasscode: () => 'env-secret-pass',
    });

    assert.deepEqual(auth.getAuthStatus({ isCabinetAdmin: true }), {
      authorized: true,
      mode: 'cabinet_admin',
    });

    assert.deepEqual(auth.getAuthStatus({ isCabinetAdmin: false }), {
      authorized: false,
      mode: 'locked',
    });

    const verified = await auth.verifyPasscode('env-secret-pass');
    assert.equal(auth.resolveBearerToken(`Bearer ${verified.token}`), true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
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
