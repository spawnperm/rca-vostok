import assert from 'node:assert/strict';
import { test } from 'vitest';
import { HousekeepingJob } from '../src/application/system/HousekeepingJob.ts';
import { InMemorySessionRepository } from '../src/infrastructure/persistence/InMemoryIdentityRepositories.ts';
import { InMemoryPasswordResetRepository } from '../src/infrastructure/persistence/pg/PostgresPasswordResetRepository.ts';
import { PasswordResetToken } from '../src/domain/identity/PasswordReset.ts';

// These tables grow without bound unless something prunes them, and nothing
// did until HousekeepingJob was added. The tests pin the pruning behaviour and
// the guard rails around it.

function pastIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function futureIso(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

test('Housekeeping: purges expired sessions and keeps live ones', async () => {
  const sessions = new InMemorySessionRepository();

  await sessions.create({
    tokenHash: 'expired-1',
    userId: 'u1',
    createdAt: pastIso(10),
    expiresAt: pastIso(3),
  });
  await sessions.create({
    tokenHash: 'live-1',
    userId: 'u1',
    createdAt: pastIso(1),
    expiresAt: futureIso(48),
  });

  const job = new HousekeepingJob({ sessions, autoStart: false });
  const result = await job.runOnce();

  assert.equal(result.expiredSessions, 1);
  assert.equal(await sessions.findByTokenHash('expired-1'), null);
  assert.ok(await sessions.findByTokenHash('live-1'), 'live session must survive');
});

test('Housekeeping: purges reset tokens older than the retention window', async () => {
  const tokens = new InMemoryPasswordResetRepository();

  const old = PasswordResetToken.issue('u1', new Date(Date.now() - 30 * 24 * 3600 * 1000));
  const fresh = PasswordResetToken.issue('u2');

  await tokens.save({ ...old.toRecord(), createdAt: pastIso(30) });
  await tokens.save(fresh.toRecord());

  const job = new HousekeepingJob({ resetTokens: tokens, autoStart: false });
  await job.runOnce();

  // 30 days old is beyond the 7-day retention, so it is gone.
  assert.equal(await tokens.findUsable(old.tokenHash, new Date().toISOString()), null);
  // A fresh token stays usable.
  assert.ok(await tokens.findUsable(fresh.tokenHash, new Date().toISOString()));
});

test('Housekeeping: runs with only one repository configured', async () => {
  const sessions = new InMemorySessionRepository();
  await sessions.create({
    tokenHash: 'expired',
    userId: 'u1',
    createdAt: pastIso(5),
    expiresAt: pastIso(1),
  });

  const job = new HousekeepingJob({ sessions, autoStart: false });
  const result = await job.runOnce();
  assert.equal(result.expiredSessions, 1);
});

test('Housekeeping: overlapping runs do not stack', async () => {
  const sessions = new InMemorySessionRepository();
  await sessions.create({
    tokenHash: 'expired',
    userId: 'u1',
    createdAt: pastIso(5),
    expiresAt: pastIso(1),
  });

  const job = new HousekeepingJob({ sessions, autoStart: false });

  // Fire two runs without awaiting the first: the second must short-circuit.
  const [first, second] = await Promise.all([job.runOnce(), job.runOnce()]);
  const total = first.expiredSessions + second.expiredSessions;

  // Exactly one of them did the work.
  assert.equal(total, 1);
});

test('Housekeeping: a failing repository does not throw', async () => {
  const broken = {
    purgeExpired: async () => {
      throw new Error('database down');
    },
  } as unknown as InMemorySessionRepository;

  const job = new HousekeepingJob({ sessions: broken, autoStart: false });
  // Must resolve rather than reject: housekeeping cannot take the site down.
  const result = await job.runOnce();
  assert.equal(result.expiredSessions, 0);
});

test('Housekeeping: stop() is safe without a timer', () => {
  const job = new HousekeepingJob({ autoStart: false });
  assert.doesNotThrow(() => job.stop());
});
