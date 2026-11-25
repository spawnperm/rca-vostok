import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import {
  AssignRoleUseCase,
  ClaimAdminAccessUseCase,
  GetAdminBootstrapStatusUseCase,
  LoginUseCase,
  RegisterUserUseCase,
  ResolveSessionUseCase,
} from '../src/application/identity/IdentityUseCases.ts';
import {
  ForgotPasswordUseCase,
  ResetPasswordUseCase,
} from '../src/application/identity/PasswordResetUseCases.ts';
import {
  ListAllInquiriesUseCase,
  SubmitInquiryUseCase,
  UpdateInquiryStatusUseCase,
} from '../src/application/certification/InquiryUseCases.ts';
import {
  GetLmsProgressUseCase,
  UpdateLmsProgressUseCase,
} from '../src/application/lms/LmsProgressUseCases.ts';
import { PasswordResetToken } from '../src/domain/identity/PasswordReset.ts';
import { ForbiddenError } from '../src/domain/identity/User.ts';
import { ROLES } from '../src/domain/identity/Rbac.ts';
import { ValidationError } from '../src/domain/shared/DomainError.ts';
import { InMemoryDomainEventBus } from '../src/infrastructure/events/InMemoryDomainEventBus.ts';
import { LoggingMailer } from '../src/infrastructure/mail/Mailer.ts';
import {
  JsonFilePasswordResetRepository,
  JsonFileSessionRepository,
  JsonFileUserRepository,
} from '../src/infrastructure/persistence/JsonFileIdentityRepositories.ts';
import { JsonFileInquiryRepository } from '../src/infrastructure/persistence/JsonFileInquiryRepository.ts';
import { JsonFileLmsProgressRepository } from '../src/infrastructure/persistence/JsonFileLmsProgressRepository.ts';
import {
  ScryptPasswordHasher,
  Sha256SessionTokenService,
} from '../src/infrastructure/security/ScryptPasswordHasher.ts';

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('JsonFile identity repositories persist users, sessions and password resets across restarts', async () => {
  const dir = makeTempDir('rca-id-persist-');
  try {
    const hasher = new ScryptPasswordHasher();
    const tokens = new Sha256SessionTokenService();
    const eventBus = new InMemoryDomainEventBus();

    const users1 = new JsonFileUserRepository(dir);
    const sessions1 = new JsonFileSessionRepository(dir);
    const resets1 = new JsonFilePasswordResetRepository(dir);

    const register = new RegisterUserUseCase(users1, hasher, eventBus);
    const login = new LoginUseCase(users1, sessions1, hasher, tokens, eventBus);

    const created = await register.execute({
      email: 'persist@vostok.ru',
      password: 'VostokPassword2026',
      fullName: 'Алексей Дальний',
      region: 'Приморский край',
    });
    const auth = await login.execute({
      email: 'persist@vostok.ru',
      password: 'VostokPassword2026',
    });

    // Simulate a server restart with brand new repository instances reading the same directory
    const users2 = new JsonFileUserRepository(dir);
    const sessions2 = new JsonFileSessionRepository(dir);
    const resets2 = new JsonFilePasswordResetRepository(dir);
    const resolve2 = new ResolveSessionUseCase(users2, sessions2, tokens);

    const resolved = await resolve2.execute(auth.token);
    assert.ok(resolved, 'session must survive server restart');
    assert.equal(resolved?.user.id, created.id);
    assert.equal(resolved?.user.email.value, 'persist@vostok.ru');

    // Password reset token also survives restart
    const forgot = new ForgotPasswordUseCase(
      users2,
      resets2,
      new LoggingMailer(),
      eventBus,
      'http://localhost:3000'
    );
    const forgotRes = await forgot.execute({ email: 'persist@vostok.ru' });
    assert.equal(forgotRes.delivered, false);

    // Ensure token record exists on disk and can be inspected & consumed via a third instance
    const issuedReset = PasswordResetToken.issue(created.id);
    await resets2.save(issuedReset.toRecord());

    const resets3 = new JsonFilePasswordResetRepository(dir);
    const usable = await resets3.findUsable(issuedReset.tokenHash, new Date().toISOString());
    assert.ok(usable, 'password reset token must persist across restart');
    assert.equal(usable?.userId, created.id);

    const resetUc = new ResetPasswordUseCase(users2, resets3, sessions2, hasher, eventBus);
    await resetUc.execute({ token: issuedReset.token, password: 'NewVostokPassword99' });

    const usedAfter = await resets3.findUsable(issuedReset.tokenHash, new Date().toISOString());
    assert.equal(usedAfter, null, 'consumed reset token must be marked used on disk');

    // Old session should be invalidated after password reset
    assert.equal(await resolve2.execute(auth.token), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Local admin bootstrap claims first admin and locks afterward; curator CRM manages all inquiries', async () => {
  const dir = makeTempDir('rca-crm-bootstrap-');
  const prevKey = process.env.RCA_ADMIN_SETUP_KEY;
  delete process.env.RCA_ADMIN_SETUP_KEY;

  try {
    const users = new JsonFileUserRepository(dir);
    const inquiries = new JsonFileInquiryRepository(dir);
    const hasher = new ScryptPasswordHasher();
    const eventBus = new InMemoryDomainEventBus();

    const register = new RegisterUserUseCase(users, hasher, eventBus);
    const bootstrapStatus = new GetAdminBootstrapStatusUseCase(users);
    const claimAdmin = new ClaimAdminAccessUseCase(users, eventBus);
    const assignRole = new AssignRoleUseCase(users, eventBus);

    const u1Dto = await register.execute({
      email: 'first@vostok.ru',
      password: 'VostokPassword2026',
      fullName: 'Первый Администратор',
    });
    const u2Dto = await register.execute({
      email: 'curator@vostok.ru',
      password: 'VostokPassword2026',
      fullName: 'Куратор Очереди',
    });

    const before = await bootstrapStatus.execute();
    assert.equal(before.canClaimFirstAdmin, true);
    assert.equal(before.hasAdmin, false);

    const u1 = (await users.findById(u1Dto.id))!;
    const promoted = await claimAdmin.execute(u1);
    assert.equal(promoted.role, ROLES.ADMIN);

    const after = await bootstrapStatus.execute();
    assert.equal(after.canClaimFirstAdmin, false);
    assert.equal(after.hasAdmin, true);

    // Second user cannot self-claim once an admin exists without setup key
    const u2 = (await users.findById(u2Dto.id))!;
    await assert.rejects(() => claimAdmin.execute(u2), ForbiddenError);

    // Admin grants curator role to second user
    const u1Reloaded = (await users.findById(u1Dto.id))!;
    const curatorDto = await assignRole.execute(u1Reloaded, {
      userId: u2Dto.id,
      role: ROLES.CURATOR,
    });
    assert.equal(curatorDto.role, ROLES.CURATOR);

    // Submit an inquiry and verify curator can view and update it
    const submitInquiry = new SubmitInquiryUseCase(inquiries, eventBus);
    const createdInq = await submitInquiry.execute(
      {
        fullName: 'Кандидат Сахалина',
        email: 'cand@sakhalin.ru',
        contactChannel: '@cand_sakh',
        region: 'Сахалинская область',
        track: 'Пешеходный туризм',
        experienceNote: '3 года маршрутов по Итурупу',
        consentAccepted: true,
      },
      null
    );

    const curator = (await users.findById(u2Dto.id))!;
    const listAll = new ListAllInquiriesUseCase(inquiries);
    const updateStatus = new UpdateInquiryStatusUseCase(inquiries, eventBus);

    const allInq = await listAll.execute(curator);
    assert.equal(allInq.length, 1);
    assert.equal(allInq[0].id, createdInq.id);

    const updatedInq = await updateStatus.execute(curator, {
      inquiryId: createdInq.id,
      status: 'needs_documents',
      statusComment: 'Приложите скан медсправки и маршрутную книжку.',
    });
    assert.equal(updatedInq.status, 'needs_documents');
    assert.equal(
      updatedInq.statusComment,
      'Приложите скан медсправки и маршрутную книжку.'
    );

    // With RCA_ADMIN_SETUP_KEY configured, wrong key is rejected
    process.env.RCA_ADMIN_SETUP_KEY = 'super-secret-setup-key-2026';
    await assert.rejects(
      () => claimAdmin.execute(curator, { setupKey: 'wrong-key' }),
      ValidationError
    );
    const promotedViaKey = await claimAdmin.execute(curator, {
      setupKey: 'super-secret-setup-key-2026',
    });
    assert.equal(promotedViaKey.role, ROLES.ADMIN);
  } finally {
    if (prevKey === undefined) delete process.env.RCA_ADMIN_SETUP_KEY;
    else process.env.RCA_ADMIN_SETUP_KEY = prevKey;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('LMS progress persists self-check, competency quiz, learning plan and diagnostics across instances', async () => {
  const dir = makeTempDir('rca-lms-persist-');
  try {
    const users = new JsonFileUserRepository(dir);
    const lms1 = new JsonFileLmsProgressRepository(dir);
    const hasher = new ScryptPasswordHasher();
    const eventBus = new InMemoryDomainEventBus();

    const register = new RegisterUserUseCase(users, hasher, eventBus);
    const userDto = await register.execute({
      email: 'lms@vostok.ru',
      password: 'VostokPassword2026',
      fullName: 'Мария Методист',
    });
    const user = (await users.findById(userDto.id))!;

    const get1 = new GetLmsProgressUseCase(lms1);
    const update1 = new UpdateLmsProgressUseCase(lms1, eventBus);

    const initial = await get1.execute(user);
    assert.equal(initial.hasSavedData, false);

    // Invalid enum rejected by Zod
    await assert.rejects(
      () =>
        update1.execute(user, {
          selfCheck: { track: 'invalid_track', answers: {} },
        }),
      ValidationError
    );

    await update1.execute(user, {
      selfCheck: {
        track: 'water',
        answers: { 'sc-identity-education': 'confirmed', 'sc-medical-clearance': 'in_progress' },
        updatedAt: '2026-11-24T00:00:00.000Z',
      },
      learningPlan: {
        levelId: 'advanced',
        contour: 'contour_a',
        gapDomainIds: ['first_aid', 'field_dfo'],
        updatedAt: '2026-11-24T00:01:00.000Z',
      },
    });

    await update1.execute(user, {
      competencyQuiz: {
        intervalDays: 14,
        lastCompletedAt: '2026-11-24T01:00:00.000Z',
        attempts: [
          {
            id: 'att-1',
            completedAt: '2026-11-24T01:00:00.000Z',
            totalQuestions: 6,
            correctCount: 5,
            scorePercent: 83,
            npaPercent: 100,
            safetyPercent: 67,
            intervalDays: 14,
            questionIds: ['comp-npa-1'],
            wrongQuestionIds: ['comp-safety-2'],
          },
        ],
        activeQuestionIds: ['comp-npa-1', 'comp-safety-2'],
        activeAnswers: { 'comp-npa-1': 'b' },
      },
    });

    // Simulate fresh browser / server restart reading from disk
    const lms2 = new JsonFileLmsProgressRepository(dir);
    const get2 = new GetLmsProgressUseCase(lms2);
    const fetched = await get2.execute(user);

    assert.equal(fetched.hasSavedData, true);
    assert.equal(fetched.progress.selfCheck.track, 'water');
    assert.equal(fetched.progress.selfCheck.answers['sc-identity-education'], 'confirmed');
    assert.equal(fetched.progress.learningPlan.levelId, 'advanced');
    assert.deepEqual(fetched.progress.learningPlan.gapDomainIds, ['first_aid', 'field_dfo']);
    assert.equal(fetched.progress.competencyQuiz.intervalDays, 14);
    assert.equal(fetched.progress.competencyQuiz.attempts.length, 1);
    assert.equal(fetched.progress.competencyQuiz.attempts[0].scorePercent, 83);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
