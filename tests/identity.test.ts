import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AssignRoleUseCase,
  ChangePasswordUseCase,
  ListUsersUseCase,
  LoginUseCase,
  ResolveSessionUseCase,
  SESSION_TTL_MS,
  SetUserActiveUseCase,
  UpdateProfileUseCase,
  RegisterUserUseCase,
} from '../src/application/identity/IdentityUseCases.ts';
import { ForbiddenError, User } from '../src/domain/identity/User.ts';
import {
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
  roleHasPermission,
} from '../src/domain/identity/Rbac.ts';
import { ValidationError } from '../src/domain/shared/DomainError.ts';
import { InMemoryDomainEventBus } from '../src/infrastructure/events/InMemoryDomainEventBus.ts';
import {
  InMemorySessionRepository,
  InMemoryUserRepository,
} from '../src/infrastructure/persistence/InMemoryIdentityRepositories.ts';
import {
  ScryptPasswordHasher,
  Sha256SessionTokenService,
} from '../src/infrastructure/security/ScryptPasswordHasher.ts';

/** Builds the identity slice wired exactly like server.ts, but in memory. */
function makeIdentity() {
  const users = new InMemoryUserRepository();
  const sessions = new InMemorySessionRepository();
  const hasher = new ScryptPasswordHasher();
  const tokens = new Sha256SessionTokenService();
  const eventBus = new InMemoryDomainEventBus();

  const published: string[] = [];
  eventBus.subscribe('*', (ev) => published.push(ev.eventName));

  return {
    users,
    sessions,
    hasher,
    tokens,
    eventBus,
    published,
    register: new RegisterUserUseCase(users, hasher, eventBus),
    login: new LoginUseCase(users, sessions, hasher, tokens, eventBus),
    resolveSession: new ResolveSessionUseCase(users, sessions, tokens),
    updateProfile: new UpdateProfileUseCase(users, eventBus),
    changePassword: new ChangePasswordUseCase(users, hasher, sessions),
    listUsers: new ListUsersUseCase(users),
    assignRole: new AssignRoleUseCase(users, eventBus),
    setUserActive: new SetUserActiveUseCase(users),
  };
}

async function registerAndAuthenticate(
  ctx: ReturnType<typeof makeIdentity>,
  overrides: Partial<{ email: string; fullName: string; password: string }> = {}
) {
  const email = overrides.email ?? 'guide@example.ru';
  const password = overrides.password ?? 'Vostok2026pass';
  await ctx.register.execute({
    email,
    password,
    fullName: overrides.fullName ?? 'Иван Проводников',
    region: 'Приморский край',
  });
  const auth = await ctx.login.execute({ email, password });
  const user = await ctx.users.findById(auth.user.id);
  assert.ok(user, 'user must exist after login');
  return { user, token: auth.token, auth };
}

// ── RBAC matrix ─────────────────────────────────────────────────────────────

test('RBAC: candidate cannot reach privileged permissions', () => {
  assert.equal(roleHasPermission(ROLES.CANDIDATE, PERMISSIONS.VIEW_OWN_PROFILE), true);
  assert.equal(roleHasPermission(ROLES.CANDIDATE, PERMISSIONS.EDIT_OWN_PROFILE), true);
  assert.equal(roleHasPermission(ROLES.CANDIDATE, PERMISSIONS.MANAGE_USERS), false);
  assert.equal(roleHasPermission(ROLES.CANDIDATE, PERMISSIONS.VIEW_ANALYTICS), false);
  assert.equal(roleHasPermission(ROLES.CANDIDATE, PERMISSIONS.VIEW_ALL_INQUIRIES), false);
});

test('RBAC: curator sees all inquiries and analytics but cannot manage users', () => {
  assert.equal(roleHasPermission(ROLES.CURATOR, PERMISSIONS.VIEW_ALL_INQUIRIES), true);
  assert.equal(roleHasPermission(ROLES.CURATOR, PERMISSIONS.VIEW_ANALYTICS), true);
  assert.equal(roleHasPermission(ROLES.CURATOR, PERMISSIONS.MANAGE_USERS), false);
});

test('RBAC: admin holds every declared permission', () => {
  const declared = Object.values(PERMISSIONS);
  for (const permission of declared) {
    assert.equal(
      roleHasPermission(ROLES.ADMIN, permission),
      true,
      `admin must hold ${permission}`
    );
  }
});

test('RBAC: role grants are cumulative (instructor subset of curator, curator subset of admin)', () => {
  for (const p of ROLE_PERMISSIONS[ROLES.CANDIDATE]) {
    assert.ok(ROLE_PERMISSIONS[ROLES.INSTRUCTOR].includes(p), `instructor missing ${p}`);
  }
  for (const p of ROLE_PERMISSIONS[ROLES.INSTRUCTOR]) {
    assert.ok(ROLE_PERMISSIONS[ROLES.CURATOR].includes(p), `curator missing ${p}`);
  }
  for (const p of ROLE_PERMISSIONS[ROLES.CURATOR]) {
    assert.ok(ROLE_PERMISSIONS[ROLES.ADMIN].includes(p), `admin missing ${p}`);
  }
});

// ── Registration ────────────────────────────────────────────────────────────

test('Registration: rejects weak passwords and duplicate emails', async () => {
  const ctx = makeIdentity();

  await assert.rejects(
    () => ctx.register.execute({ email: 'a@b.ru', password: 'short1', fullName: 'Тест Тестов' }),
    ValidationError
  );
  await assert.rejects(
    () => ctx.register.execute({ email: 'a@b.ru', password: 'alllettersonly', fullName: 'Тест Тестов' }),
    ValidationError
  );
  await assert.rejects(
    () => ctx.register.execute({ email: 'a@b.ru', password: '1111111111111', fullName: 'Тест Тестов' }),
    ValidationError
  );
  await assert.rejects(
    () => ctx.register.execute({ email: 'not-an-email', password: 'Vostok2026pass', fullName: 'Тест Тестов' }),
    ValidationError
  );

  await ctx.register.execute({
    email: 'dup@example.ru',
    password: 'Vostok2026pass',
    fullName: 'Первый Пользователь',
  });

  await assert.rejects(
    () =>
      ctx.register.execute({
        email: 'DUP@example.ru',
        password: 'Vostok2026pass',
        fullName: 'Второй Пользователь',
      }),
    ValidationError
  );
});

test('Registration: new accounts start as candidate with no admin rights', async () => {
  const ctx = makeIdentity();
  const dto = await ctx.register.execute({
    email: 'new@example.ru',
    password: 'Vostok2026pass',
    fullName: 'Новый Соискатель',
  });

  assert.equal(dto.role, ROLES.CANDIDATE);
  assert.ok(dto.permissions.includes(PERMISSIONS.VIEW_OWN_PROFILE));
  assert.ok(!dto.permissions.includes(PERMISSIONS.MANAGE_USERS));
  assert.equal(dto.isActive, true);
  // The password must never be readable from the DTO.
  assert.equal(Object.prototype.hasOwnProperty.call(dto, 'password'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(dto, 'passwordHash'), false);
});

test('Registration: a self-declared admin role in the payload cannot escalate privileges', async () => {
  const ctx = makeIdentity();
  // TypeScript types are erased at runtime, so a forged `role` in the request
  // body reaches the use case as data. Registration must ignore it entirely.
  const dto = await ctx.register.execute({
    email: 'forge@example.ru',
    password: 'Vostok2026pass',
    fullName: 'Подозрительный Пользователь',
    // @ts-expect-error deliberately passing an unsupported field
    role: 'admin',
  });
  assert.equal(dto.role, ROLES.CANDIDATE);
  assert.ok(!dto.permissions.includes(PERMISSIONS.MANAGE_USERS));
});

// ── Login / sessions ────────────────────────────────────────────────────────

test('Login: returns a session token and stores only its hash', async () => {
  const ctx = makeIdentity();
  const { token, user } = await registerAndAuthenticate(ctx);

  assert.equal(typeof token, 'string');
  assert.ok(token.length >= 32);

  const rawLookup = await ctx.sessions.findByTokenHash(token);
  assert.equal(rawLookup, null, 'the raw token must not be stored');

  const hashed = await ctx.sessions.findByTokenHash(ctx.tokens.hashToken(token));
  assert.ok(hashed, 'the hashed token must resolve');
  assert.equal(hashed?.userId, user.id);
});

test('Login: wrong password and unknown account yield the same generic error', async () => {
  const ctx = makeIdentity();
  await registerAndAuthenticate(ctx);

  for (const input of [
    { email: 'guide@example.ru', password: 'WrongPassword123' },
    { email: 'nobody@example.ru', password: 'Vostok2026pass' },
  ]) {
    await assert.rejects(
      () => ctx.login.execute(input),
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.equal(err.code, 'INVALID_CREDENTIALS');
        assert.match(err.message, /Неверный адрес/);
        return true;
      }
    );
  }
});

test('Session: expires and cannot authenticate after TTL', async () => {
  const ctx = makeIdentity();
  const { token, user } = await registerAndAuthenticate(ctx);

  // Doctor the stored expiry into the past.
  const hash = ctx.tokens.hashToken(token);
  await ctx.sessions.create({
    tokenHash: hash,
    userId: user.id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  });

  const resolved = await ctx.resolveSession.execute(token);
  assert.equal(resolved, null);
  assert.equal(await ctx.sessions.findByTokenHash(hash), null, 'expired session is purged');
});

test('Session: a valid token resolves to the owning account', async () => {
  const ctx = makeIdentity();
  const { token, user } = await registerAndAuthenticate(ctx);

  const resolved = await ctx.resolveSession.execute(token);
  assert.ok(resolved);
  assert.equal(resolved?.user.id, user.id);

  assert.equal(await ctx.resolveSession.execute(null), null);
  assert.equal(await ctx.resolveSession.execute('garbage-token'), null);
});

test('Session TTL is seven days', () => {
  assert.equal(SESSION_TTL_MS, 7 * 24 * 60 * 60 * 1000);
});

// ── Profile ─────────────────────────────────────────────────────────────────

test('Profile: owner can edit allowed fields; role and email are immutable', async () => {
  const ctx = makeIdentity();
  const { user } = await registerAndAuthenticate(ctx);

  const updated = await ctx.updateProfile.execute(user, {
    fullName: 'Пётр Обновлённый',
    region: 'Камчатский край',
    organisation: 'Турклуб «Вулкан»',
  });

  assert.equal(updated.fullName, 'Пётр Обновлённый');
  assert.equal(updated.region, 'Камчатский край');
  assert.equal(updated.organisation, 'Турклуб «Вулкан»');
  assert.equal(updated.email, user.email.value);
  assert.equal(updated.role, user.role);

  await assert.rejects(
    () => ctx.updateProfile.execute(user, { fullName: 'X' }),
    ValidationError
  );
});

test('Profile: deactivated account cannot authenticate or act', async () => {
  const ctx = makeIdentity();
  const { user } = await registerAndAuthenticate(ctx);

  const admin = await ctx.users.findById(user.id);
  assert.ok(admin);
  const disabled = admin.setActive(false);

  assert.equal(disabled.can(PERMISSIONS.VIEW_OWN_PROFILE), false);
  assert.throws(() => disabled.assertCan(PERMISSIONS.VIEW_OWN_PROFILE), ForbiddenError);
});

// ── Password change ─────────────────────────────────────────────────────────

test('Password change: requires the current password and revokes existing sessions', async () => {
  const ctx = makeIdentity();
  const { token, user } = await registerAndAuthenticate(ctx);

  await assert.rejects(
    () =>
      ctx.changePassword.execute(user, {
        currentPassword: 'WrongCurrent123',
        newPassword: 'BrandNewPass123',
      }),
    ValidationError
  );

  await ctx.changePassword.execute(user, {
    currentPassword: 'Vostok2026pass',
    newPassword: 'BrandNewPass123',
  });

  // Old session is gone.
  assert.equal(await ctx.resolveSession.execute(token), null);

  // Old password no longer works, the new one does.
  await assert.rejects(
    () => ctx.login.execute({ email: 'guide@example.ru', password: 'Vostok2026pass' }),
    ValidationError
  );
  const relogin = await ctx.login.execute({
    email: 'guide@example.ru',
    password: 'BrandNewPass123',
  });
  assert.ok(relogin.token);
});

// ── Admin / RBAC enforcement in use cases ───────────────────────────────────

test('Admin: only a user with users:manage can list accounts or assign roles', async () => {
  const ctx = makeIdentity();
  const { user: candidate } = await registerAndAuthenticate(ctx);

  await assert.rejects(() => ctx.listUsers.execute(candidate), ForbiddenError);
  await assert.rejects(
    () => ctx.assignRole.execute(candidate, { userId: candidate.id, role: ROLES.ADMIN }),
    ForbiddenError
  );

  // Promote to admin through the aggregate, then the same call succeeds.
  const promoted = candidate.changeRole(ROLES.ADMIN);
  await ctx.users.save(promoted);

  const list = await ctx.listUsers.execute(promoted);
  assert.equal(list.length, 1);
  assert.equal(list[0].role, ROLES.ADMIN);
});

test('Admin: cannot demote themselves and lose administration', async () => {
  const ctx = makeIdentity();
  const { user } = await registerAndAuthenticate(ctx);
  const admin = user.changeRole(ROLES.ADMIN);
  await ctx.users.save(admin);

  await assert.rejects(
    () => ctx.assignRole.execute(admin, { userId: admin.id, role: ROLES.CURATOR }),
    ForbiddenError
  );

  // Demoting someone else is fine.
  const second = await ctx.register.execute({
    email: 'second@example.ru',
    password: 'Vostok2026pass',
    fullName: 'Второй Куратор',
  });
  const updated = await ctx.assignRole.execute(admin, {
    userId: second.id,
    role: ROLES.CURATOR,
  });
  assert.equal(updated.role, ROLES.CURATOR);
});

test('Admin: rejects an unknown role value', async () => {
  const ctx = makeIdentity();
  const { user } = await registerAndAuthenticate(ctx);
  const admin = user.changeRole(ROLES.ADMIN);
  await ctx.users.save(admin);

  await assert.rejects(
    () => ctx.assignRole.execute(admin, { userId: admin.id, role: 'superuser' }),
    ValidationError
  );
});

test('Admin: cannot deactivate themselves', async () => {
  const ctx = makeIdentity();
  const { user } = await registerAndAuthenticate(ctx);
  const admin = user.changeRole(ROLES.ADMIN);
  await ctx.users.save(admin);

  await assert.rejects(
    () => ctx.setUserActive.execute(admin, { userId: admin.id, isActive: false }),
    ForbiddenError
  );
});

test('Identity events are published for the observability subscriber', async () => {
  const ctx = makeIdentity();
  const { user } = await registerAndAuthenticate(ctx);

  assert.ok(ctx.published.includes('identity.user_registered'));
  assert.ok(ctx.published.includes('identity.user_logged_in'));

  await ctx.updateProfile.execute(user, { fullName: 'Событийный Пользователь' });
  assert.ok(ctx.published.includes('identity.profile_updated'));
});

// ── Domain edge cases ───────────────────────────────────────────────────────

test('User.create: unknown role degrades to the least-privileged role', () => {
  const created = User.create({
    email: 'edge@example.ru',
    password: 'Vostok2026pass',
    fullName: 'Граничный Пользователь',
    role: 'root',
  });
  assert.equal(created.role, ROLES.CANDIDATE);
  assert.equal(created.can(PERMISSIONS.MANAGE_USERS), false);
});

test('User: password hash material must be present when attached', () => {
  const created = User.create({
    email: 'edge2@example.ru',
    password: 'Vostok2026pass',
    fullName: 'Граничный Пользователь',
  });
  assert.throws(() => created.withPassword({ passwordHash: '', passwordSalt: '' }));
});

test('Profile: updateProfile validates and persists phone and telegram contact details', async () => {
  const ctx = makeIdentity();
  const { user } = await registerAndAuthenticate(ctx);

  const updated = await ctx.updateProfile.execute(user, {
    phone: '+7 (914) 555-01-22',
    telegram: 'https://t.me/guide_vostok',
    region: 'Камчатский край',
    organisation: 'Турклуб «Вулкан»',
  });

  assert.equal(updated.phone, '+7 (914) 555-01-22');
  assert.equal(updated.telegram, '@guide_vostok');
  assert.equal(updated.region, 'Камчатский край');
  assert.equal(updated.organisation, 'Турклуб «Вулкан»');

  const stored = await ctx.users.findById(user.id);
  assert.equal(stored?.phone, '+7 (914) 555-01-22');
  assert.equal(stored?.telegram, '@guide_vostok');

  await assert.rejects(
    () => ctx.updateProfile.execute(stored!, { phone: '123' }),
    ValidationError
  );
  await assert.rejects(
    () => ctx.updateProfile.execute(stored!, { telegram: 'bad handle!' }),
    ValidationError
  );
});

test('Profile: updateProfile validates and persists avatarUrl presets, raster data URLs, and rejects unsafe URLs', async () => {
  const ctx = makeIdentity();
  const { user } = await registerAndAuthenticate(ctx);

  const presetUrl = '/src/assets/images/guide_portrait_taiga_1795488166052.jpg';
  const withPreset = await ctx.updateProfile.execute(user, { avatarUrl: presetUrl });
  assert.equal(withPreset.avatarUrl, presetUrl);

  const storedPreset = await ctx.users.findById(user.id);
  assert.equal(storedPreset?.avatarUrl, presetUrl);

  const sampleJpegDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/';
  const withDataUrl = await ctx.updateProfile.execute(storedPreset!, {
    avatarUrl: sampleJpegDataUrl,
  });
  assert.equal(withDataUrl.avatarUrl, sampleJpegDataUrl);

  const reset = await ctx.updateProfile.execute(
    (await ctx.users.findById(user.id))!,
    { avatarUrl: '' }
  );
  assert.equal(reset.avatarUrl, '');

  for (const unsafe of [
    'javascript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    'https://evil.example/avatar.jpg',
    'data:image/jpeg;base64,' + 'A'.repeat(180_005),
  ]) {
    await assert.rejects(
      () =>
        ctx.updateProfile.execute(
          User.rehydrate({
            id: user.id,
            email: user.email.value,
            fullName: user.fullName.value,
            region: user.region,
            organisation: user.organisation,
            phone: user.phone,
            telegram: user.telegram,
            avatarUrl: '',
            role: user.role,
            passwordHash: user.passwordHash,
            passwordSalt: user.passwordSalt,
            isActive: user.isActive,
            attestationExpiresAt: user.attestationExpiresAt,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt,
          }),
          { avatarUrl: unsafe }
        ),
      ValidationError
    );
  }
});


