import assert from 'node:assert/strict';
import { test } from 'vitest';
import { UpdateProfileUseCase } from '../src/application/identity/IdentityUseCases.ts';
import {
  evaluateAttestationExpiry,
  pickRecommendedReattestationSession,
  subtractCalendarMonthsIso,
} from '../src/domain/certification/AttestationExpiryMonitor.ts';
import { ROLES } from '../src/domain/identity/Rbac.ts';
import { User } from '../src/domain/identity/User.ts';
import { ValidationError } from '../src/domain/shared/DomainError.ts';
import { InMemoryDomainEventBus } from '../src/infrastructure/events/InMemoryDomainEventBus.ts';
import { InMemoryUserRepository } from '../src/infrastructure/persistence/InMemoryIdentityRepositories.ts';

test('subtractCalendarMonthsIso clamps end-of-month dates across leap and non-leap years', () => {
  assert.equal(subtractCalendarMonthsIso('2027-02-20', 3), '2026-11-20');
  assert.equal(subtractCalendarMonthsIso('2027-05-31', 3), '2027-02-28');
  assert.equal(subtractCalendarMonthsIso('2024-05-31', 3), '2024-02-29');
  assert.equal(subtractCalendarMonthsIso('2027-01-15', 3), '2026-10-15');
});

test('evaluateAttestationExpiry triggers warning exactly 3 months before expiration', () => {
  const ref = new Date('2026-11-23T12:00:00Z');

  // > 3 months remaining: no warning banner
  const active = evaluateAttestationExpiry({
    expiresAtIso: '2027-03-10',
    referenceDate: ref,
  });
  assert.equal(active.status, 'active');
  assert.equal(active.showReattestationWarning, false);
  assert.equal(active.warningStartsAtIso, '2026-12-10');
  assert.ok((active.daysRemaining ?? 0) > 100);

  // Exactly 3 months before expiry (2027-02-23 - 3 months = 2026-11-23): warning active!
  const boundary = evaluateAttestationExpiry({
    expiresAtIso: '2027-02-23',
    referenceDate: ref,
  });
  assert.equal(boundary.status, 'expiring_soon');
  assert.equal(boundary.showReattestationWarning, true);
  assert.equal(boundary.warningStartsAtIso, '2026-11-23');
  assert.equal(boundary.isUrgent, false);

  // Within 30 days: urgent warning active
  const urgent = evaluateAttestationExpiry({
    expiresAtIso: '2026-12-15',
    referenceDate: ref,
  });
  assert.equal(urgent.status, 'expiring_soon');
  assert.equal(urgent.showReattestationWarning, true);
  assert.equal(urgent.isUrgent, true);
  assert.equal(urgent.daysRemaining, 22);

  // Expired
  const expired = evaluateAttestationExpiry({
    expiresAtIso: '2026-11-01',
    referenceDate: ref,
  });
  assert.equal(expired.status, 'expired');
  assert.equal(expired.showReattestationWarning, true);
  assert.equal(expired.isUrgent, true);
  assert.equal(expired.daysRemaining, -22);

  // Not configured in profile
  const unconfigured = evaluateAttestationExpiry({
    expiresAtIso: null,
    referenceDate: ref,
  });
  assert.equal(unconfigured.status, 'not_configured');
  assert.equal(unconfigured.showReattestationWarning, false);
});

test('evaluateAttestationExpiry detects existing scheduled re-attestation inquiry', () => {
  const result = evaluateAttestationExpiry({
    expiresAtIso: '2027-01-20',
    referenceDate: new Date('2026-11-23T00:00:00Z'),
    inquiries: [
      { status: 'rejected', sessionDate: '2026-12-01' },
      { status: 'in_review', sessionDate: '2026-12-14' },
    ],
  });
  assert.equal(result.hasScheduledReattestation, true);
  assert.equal(result.scheduledSessionDate, '2026-12-14');
});

test('pickRecommendedReattestationSession selects upcoming session cleanly', () => {
  const sessions = [
    { start: '2026-10-10' },
    { start: '2026-12-14' },
    { start: '2027-01-25' },
  ];
  const picked = pickRecommendedReattestationSession(
    sessions,
    '2027-02-10',
    new Date('2026-11-23T00:00:00Z')
  );
  assert.equal(picked?.start, '2026-12-14');
});

test('User aggregate and UpdateProfileUseCase validate and persist attestationExpiresAt', async () => {
  const users = new InMemoryUserRepository();
  const bus = new InMemoryDomainEventBus();
  const updateProfile = new UpdateProfileUseCase(users, bus);

  const actor = User.rehydrate({
    id: 'usr-mon-1',
    email: 'instructor@vostok.ru',
    fullName: 'Сергей Морозов',
    region: 'Приморский край',
    organisation: 'ФСТР ДФО',
    role: ROLES.INSTRUCTOR,
    passwordHash: 'hash',
    passwordSalt: 'salt',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastLoginAt: null,
  });
  await users.save(actor);

  await assert.rejects(
    () =>
      updateProfile.execute(actor, {
        attestationExpiresAt: '2026-02-30',
      }),
    ValidationError
  );

  const updated = await updateProfile.execute(actor, {
    attestationExpiresAt: '2027-01-15',
  });
  assert.equal(updated.attestationExpiresAt, '2027-01-15');

  const stored = await users.findById('usr-mon-1');
  assert.equal(stored?.attestationExpiresAt, '2027-01-15');

  const cleared = await updateProfile.execute(stored!, {
    attestationExpiresAt: '',
  });
  assert.equal(cleared.attestationExpiresAt, null);
});
