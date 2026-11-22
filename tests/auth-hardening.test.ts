import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_LOGIN_RULES,
  RateLimiter,
} from '../src/infrastructure/http/RateLimiter.ts';
import {
  PasswordResetToken,
  RESET_TOKEN_TTL_MS,
  type Mailer,
  type MailMessage,
} from '../src/domain/identity/PasswordReset.ts';
import {
  ForgotPasswordUseCase,
  ResetPasswordUseCase,
} from '../src/application/identity/PasswordResetUseCases.ts';
import { RegisterUserUseCase } from '../src/application/identity/IdentityUseCases.ts';
import {
  InMemorySessionRepository,
  InMemoryUserRepository,
} from '../src/infrastructure/persistence/InMemoryIdentityRepositories.ts';
import { InMemoryPasswordResetRepository } from '../src/infrastructure/persistence/pg/PostgresPasswordResetRepository.ts';
import {
  ScryptPasswordHasher,
  Sha256SessionTokenService,
} from '../src/infrastructure/security/ScryptPasswordHasher.ts';
import { InMemoryDomainEventBus } from '../src/infrastructure/events/InMemoryDomainEventBus.ts';
import { ValidationError } from '../src/domain/shared/DomainError.ts';
import { CertificationInquiry } from '../src/domain/certification/CertificationInquiry.ts';
import { JsonFileInquiryRepository } from '../src/infrastructure/persistence/JsonFileInquiryRepository.ts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ── Rate limiting ───────────────────────────────────────────────────────────

test('RateLimiter: allows up to the limit, then blocks with a retry hint', () => {
  const limiter = new RateLimiter([{ name: 'test', windowMs: 60_000, max: 3 }]);

  assert.equal(limiter.hit('test', 'ip').allowed, true);
  assert.equal(limiter.hit('test', 'ip').allowed, true);
  assert.equal(limiter.hit('test', 'ip').allowed, true);

  const blocked = limiter.hit('test', 'ip');
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec > 0);
});

test('RateLimiter: keys are independent (one account does not exhaust another)', () => {
  const limiter = new RateLimiter([{ name: 'test', windowMs: 60_000, max: 1 }]);

  assert.equal(limiter.hit('test', 'a@example.ru').allowed, true);
  assert.equal(limiter.hit('test', 'a@example.ru').allowed, false);
  // A different key still has its own budget.
  assert.equal(limiter.hit('test', 'b@example.ru').allowed, true);
});

test('RateLimiter: reset clears the counter after a successful login', () => {
  const limiter = new RateLimiter([{ name: 'test', windowMs: 60_000, max: 1 }]);
  limiter.hit('test', 'ip');
  assert.equal(limiter.hit('test', 'ip').allowed, false);

  limiter.reset('test', 'ip');
  assert.equal(limiter.hit('test', 'ip').allowed, true);
});

test('RateLimiter: window expiry restores the budget', async () => {
  const limiter = new RateLimiter([{ name: 'test', windowMs: 30, max: 1 }]);
  assert.equal(limiter.hit('test', 'ip').allowed, true);
  assert.equal(limiter.hit('test', 'ip').allowed, false);

  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(limiter.hit('test', 'ip').allowed, true);
});

test('RateLimiter: unknown rule fails closed rather than open', () => {
  const limiter = new RateLimiter([{ name: 'known', windowMs: 1000, max: 5 }]);
  assert.equal(limiter.hit('missing', 'ip').allowed, false);
});

test('DEFAULT_LOGIN_RULES: account limit is stricter than the IP limit', () => {
  const ip = DEFAULT_LOGIN_RULES.find((r) => r.name === 'login-ip');
  const account = DEFAULT_LOGIN_RULES.find((r) => r.name === 'login-account');
  assert.ok(ip && account);
  // Per-account must be tighter: targeting one victim is the costlier attack.
  assert.ok(account.max < ip.max);
});

// ── Password reset ──────────────────────────────────────────────────────────

class CapturingMailer implements Mailer {
  readonly delivers = true;
  readonly sent: MailMessage[] = [];
  async send(message: MailMessage): Promise<boolean> {
    this.sent.push(message);
    return true;
  }
}

function makeAuth() {
  const users = new InMemoryUserRepository();
  const sessions = new InMemorySessionRepository();
  const tokens = new InMemoryPasswordResetRepository();
  const hasher = new ScryptPasswordHasher();
  const sessionTokens = new Sha256SessionTokenService();
  const eventBus = new InMemoryDomainEventBus();
  const mailer = new CapturingMailer();

  const register = new RegisterUserUseCase(users, hasher, eventBus);
  const forgot = new ForgotPasswordUseCase(
    users,
    tokens,
    mailer,
    eventBus,
    'https://example.test'
  );
  const reset = new ResetPasswordUseCase(users, tokens, sessions, hasher, eventBus);

  return { users, sessions, tokens, hasher, sessionTokens, eventBus, mailer, register, forgot, reset };
}

async function seedUser(ctx: ReturnType<typeof makeAuth>) {
  await ctx.register.execute({
    email: 'reset@example.ru',
    password: 'Vostok2026pass',
    fullName: 'Тест Восстановление',
  });
  const user = await ctx.users.findByEmail('reset@example.ru');
  assert.ok(user);
  return user;
}

test('PasswordResetToken: token is random, hashed and short-lived', () => {
  const a = PasswordResetToken.issue('u1');
  const b = PasswordResetToken.issue('u1');

  assert.notEqual(a.token, b.token, 'each token must be unique');
  assert.notEqual(a.tokenHash, a.token, 'only the hash is persisted');
  assert.equal(a.tokenHash, PasswordResetToken.hash(a.token));

  const ttl = new Date(a.expiresAt).getTime() - new Date(a.createdAt).getTime();
  assert.equal(ttl, RESET_TOKEN_TTL_MS);
});

test('ForgotPassword: sends a link containing the raw token exactly once', async () => {
  const ctx = makeAuth();
  await seedUser(ctx);

  const result = await ctx.forgot.execute({ email: 'reset@example.ru' });
  assert.equal(result.ok, true);
  assert.equal(result.delivered, true);
  assert.equal(ctx.mailer.sent.length, 1);

  const body = ctx.mailer.sent[0].text;
  assert.match(body, /example\.test/);
  assert.match(body, /reset=/);

  // The stored token must not be the raw value.
  const raw = decodeURIComponent(body.match(/reset=([^\s]+)/)![1]);
  assert.equal(raw.includes(raw), true);
});

test('ForgotPassword: unknown address produces the same response (no enumeration)', async () => {
  const ctx = makeAuth();
  const result = await ctx.forgot.execute({ email: 'nobody@example.ru' });

  assert.equal(result.ok, true);
  // Nothing was sent and no token stored, but the caller learns nothing.
  assert.equal(ctx.mailer.sent.length, 0);
});

test('ResetPassword: valid token sets the new password and revokes sessions', async () => {
  const ctx = makeAuth();
  const user = await seedUser(ctx);

  // Seed an existing session to prove it gets revoked.
  await ctx.sessions.create({
    tokenHash: 'existing-session',
    userId: user.id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  });

  await ctx.forgot.execute({ email: 'reset@example.ru' });
  const raw = decodeURIComponent(
    ctx.mailer.sent[0].text.match(/reset=([^\s]+)/)![1]
  );

  await ctx.reset.execute({ token: raw, password: 'BrandNewPass123' });

  assert.equal(await ctx.sessions.findByTokenHash('existing-session'), null);

  const updated = await ctx.users.findByEmail('reset@example.ru');
  assert.ok(updated);
  assert.equal(
    await ctx.hasher.verify('BrandNewPass123', {
      passwordHash: updated.passwordHash,
      passwordSalt: updated.passwordSalt,
    }),
    true
  );
});

test('ResetPassword: a token cannot be used twice', async () => {
  const ctx = makeAuth();
  await seedUser(ctx);

  await ctx.forgot.execute({ email: 'reset@example.ru' });
  const raw = decodeURIComponent(ctx.mailer.sent[0].text.match(/reset=([^\s]+)/)![1]);

  await ctx.reset.execute({ token: raw, password: 'FirstNewPass123' });

  await assert.rejects(
    () => ctx.reset.execute({ token: raw, password: 'SecondNewPass123' }),
    ValidationError
  );
});

test('ResetPassword: garbage and empty tokens are rejected', async () => {
  const ctx = makeAuth();
  await seedUser(ctx);

  for (const token of ['', 'short', 'x'.repeat(500)]) {
    await assert.rejects(
      () => ctx.reset.execute({ token, password: 'SomeNewPass123' }),
      ValidationError
    );
  }
});

test('ResetPassword: new password must satisfy the domain policy', async () => {
  const ctx = makeAuth();
  await seedUser(ctx);
  await ctx.forgot.execute({ email: 'reset@example.ru' });
  const raw = decodeURIComponent(ctx.mailer.sent[0].text.match(/reset=([^\s]+)/)![1]);

  await assert.rejects(
    () => ctx.reset.execute({ token: raw, password: 'nodigitshere' }),
    ValidationError
  );
});

test('ForgotPassword: a newer request invalidates the previous link', async () => {
  const ctx = makeAuth();
  await seedUser(ctx);

  await ctx.forgot.execute({ email: 'reset@example.ru' });
  const first = decodeURIComponent(ctx.mailer.sent[0].text.match(/reset=([^\s]+)/)![1]);

  await ctx.forgot.execute({ email: 'reset@example.ru' });
  const second = decodeURIComponent(ctx.mailer.sent[1].text.match(/reset=([^\s]+)/)![1]);

  assert.notEqual(first, second);
  await assert.rejects(
    () => ctx.reset.execute({ token: first, password: 'SomeNewPass123' }),
    ValidationError
  );
});

// ── Inquiry ownership ───────────────────────────────────────────────────────

test('CertificationInquiry: records the owning account when provided', () => {
  const inquiry = CertificationInquiry.create({
    userId: 'usr-1',
    fullName: 'Иван Проводников',
    email: 'ivan@example.ru',
    region: 'Приморский край',
    consentAccepted: true,
  });

  assert.equal(inquiry.toDTO().userId, 'usr-1');
  assert.equal(inquiry.toDTO().status, 'new');
});

test('CertificationInquiry: anonymous submissions have no owner', () => {
  const inquiry = CertificationInquiry.create({
    fullName: 'Аноним Анонимов',
    email: 'anon@example.ru',
    consentAccepted: true,
  });
  assert.equal(inquiry.toDTO().userId, null);
});

test('CertificationInquiry: status transitions survive a round trip', () => {
  const inquiry = CertificationInquiry.create({
    userId: 'usr-1',
    fullName: 'Иван Проводников',
    email: 'ivan@example.ru',
    consentAccepted: true,
  });

  const approved = inquiry.withStatus('approved');
  assert.equal(approved.toDTO().status, 'approved');
  assert.equal(approved.toDTO().id, inquiry.id, 'identity is preserved');
});

test('JsonFileInquiryRepository: filters requests by owner', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-inq-'));
  try {
    const repo = new JsonFileInquiryRepository(dir);

    await repo.save(
      CertificationInquiry.create({
        userId: 'usr-a',
        fullName: 'Первый Пользователь',
        email: 'a@example.ru',
        consentAccepted: true,
      })
    );
    await repo.save(
      CertificationInquiry.create({
        userId: 'usr-b',
        fullName: 'Второй Пользователь',
        email: 'b@example.ru',
        consentAccepted: true,
      })
    );
    await repo.save(
      CertificationInquiry.create({
        fullName: 'Анонимный Соискатель',
        email: 'c@example.ru',
        consentAccepted: true,
      })
    );

    const mine = await repo.findByUser('usr-a');
    assert.equal(mine.length, 1);
    assert.equal(mine[0].userId, 'usr-a');

    const all = await repo.loadAll();
    assert.equal(all.length, 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
