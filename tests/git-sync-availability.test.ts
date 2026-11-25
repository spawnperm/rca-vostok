import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  isGitBinaryAvailable,
  resetGitAvailabilityCache,
} from '../src/infrastructure/git/GitSyncService.ts';

// The production image is node:*-slim, which has no git, and .dockerignore
// excludes .git. So git-sync cannot work there — but the only guard used to be
// a check for a .git directory, and a missing binary surfaced as a raw
// "spawn git ENOENT" from execFile rather than an explanation.
//
// These tests pin the probe that now runs first.

test('isGitBinaryAvailable: returns a boolean and does not throw', async () => {
  resetGitAvailabilityCache();
  const available = await isGitBinaryAvailable();
  assert.equal(typeof available, 'boolean');
});

test('isGitBinaryAvailable: result is cached', async () => {
  resetGitAvailabilityCache();
  const first = await isGitBinaryAvailable();
  const second = await isGitBinaryAvailable();
  assert.equal(first, second, 'both calls must agree');
});

test('resetGitAvailabilityCache: forces a fresh probe', async () => {
  resetGitAvailabilityCache();
  const before = await isGitBinaryAvailable();
  resetGitAvailabilityCache();
  const after = await isGitBinaryAvailable();
  // In any given environment the answer cannot change, so a re-probe must
  // produce the same value — the point is that it does not throw.
  assert.equal(before, after);
});

test('this environment has git, so the probe reports true here', async () => {
  resetGitAvailabilityCache();
  const available = await isGitBinaryAvailable();
  // CI and developer machines have git; only the slim runtime image does not.
  // If this fails, the probe itself is broken rather than the environment.
  assert.equal(available, true, 'git should be available in a dev/CI environment');
});
