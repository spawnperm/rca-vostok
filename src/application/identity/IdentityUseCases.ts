import { createHash, timingSafeEqual } from 'crypto';
import { ValidationError, type DomainEventBus } from '../../domain/shared/DomainError.ts';
import {
  ForbiddenError,
  User,
  type UpdateProfileInput,
  type UserDTO,
} from '../../domain/identity/User.ts';
import type {
  SessionRecord,
  SessionRepository,
  UserRepository,
} from '../../domain/identity/IdentityRepositories.ts';
import {
  type Permission,
  type Role,
  PERMISSIONS,
  ROLES,
  isRole,
} from '../../domain/identity/Rbac.ts';
import type { PasswordHasher, SessionTokenService } from './SecurityPorts.ts';

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export interface AuthResult {
  user: UserDTO;
  token: string;
  expiresAt: string;
}

export class RegisterUserUseCase {
  private readonly users: UserRepository;
  private readonly hasher: PasswordHasher;
  private readonly eventBus: DomainEventBus;

  constructor(users: UserRepository, hasher: PasswordHasher, eventBus: DomainEventBus) {
    this.users = users;
    this.hasher = hasher;
    this.eventBus = eventBus;
  }

  async execute(input: {
    email: unknown;
    password: unknown;
    fullName: unknown;
    region?: unknown;
    organisation?: unknown;
    phone?: unknown;
    telegram?: unknown;
    avatarUrl?: unknown;
    attestationExpiresAt?: unknown;
  }): Promise<UserDTO> {
    // Build the aggregate from an explicit whitelist. TypeScript types are
    // erased at runtime, so spreading `input` here would let a caller smuggle
    // `role: 'admin'` from a request body straight into User.create() and
    // escalate privileges. Self-registration always yields a candidate.
    const draft = User.create({
      email: input.email,
      password: input.password,
      fullName: input.fullName,
      region: input.region,
      organisation: input.organisation,
      phone: input.phone,
      telegram: input.telegram,
      avatarUrl: input.avatarUrl,
      attestationExpiresAt: input.attestationExpiresAt,
      role: ROLES.CANDIDATE,
    });

    // Email uniqueness is a domain invariant, checked through the port.
    const existing = await this.users.findByEmail(draft.email.value);
    if (existing) {
      throw new ValidationError('Пользователь с таким адресом уже зарегистрирован.');
    }

    const material = await this.hasher.hash(draft.plainPassword);
    const user = draft.withPassword(material);

    await this.users.save(user);

    this.eventBus.publish({
      eventName: 'identity.user_registered',
      occurredAt: user.createdAt,
      boundedContext: 'identity',
      payload: { userId: user.id, role: user.role },
    });

    return user.toDTO();
  }
}

export class LoginUseCase {
  private readonly users: UserRepository;
  private readonly sessions: SessionRepository;
  private readonly hasher: PasswordHasher;
  private readonly tokens: SessionTokenService;
  private readonly eventBus: DomainEventBus;

  constructor(
    users: UserRepository,
    sessions: SessionRepository,
    hasher: PasswordHasher,
    tokens: SessionTokenService,
    eventBus: DomainEventBus
  ) {
    this.users = users;
    this.sessions = sessions;
    this.hasher = hasher;
    this.tokens = tokens;
    this.eventBus = eventBus;
  }

  async execute(input: { email: unknown; password: unknown }): Promise<AuthResult> {
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' ? input.password : '';

    if (!email || !password) {
      throw new ValidationError('Укажите адрес электронной почты и пароль.');
    }

    const user = await this.users.findByEmail(email);

    // Uniform failure message: never reveal whether the account exists.
    if (!user) {
      throw new ValidationError('Неверный адрес электронной почты или пароль.', 'INVALID_CREDENTIALS');
    }
    if (!user.isActive) {
      throw new ValidationError('Учётная запись заблокирована.', 'ACCOUNT_DISABLED');
    }

    const passwordOk = await this.hasher.verify(password, {
      passwordHash: user.passwordHash,
      passwordSalt: user.passwordSalt,
    });
    if (!passwordOk) {
      throw new ValidationError('Неверный адрес электронной почты или пароль.', 'INVALID_CREDENTIALS');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
    const { token, tokenHash } = this.tokens.issue();

    await this.sessions.create({
      tokenHash,
      userId: user.id,
      createdAt: now.toISOString(),
      expiresAt,
    });

    const touched = user.withLastLogin(now.toISOString());
    await this.users.save(touched);

    this.eventBus.publish({
      eventName: 'identity.user_logged_in',
      occurredAt: now.toISOString(),
      boundedContext: 'identity',
      payload: { userId: user.id, role: user.role },
    });

    return { user: touched.toDTO(), token, expiresAt };
  }
}

export class LogoutUseCase {
  private readonly sessions: SessionRepository;
  private readonly tokens: SessionTokenService;

  constructor(sessions: SessionRepository, tokens: SessionTokenService) {
    this.sessions = sessions;
    this.tokens = tokens;
  }

  async execute(rawToken: string | null): Promise<{ ok: true }> {
    if (rawToken) {
      // The client sends the raw token; only its hash is ever stored.
      await this.sessions.deleteByTokenHash(this.tokens.hashToken(rawToken));
    }
    return { ok: true };
  }
}

/** Resolves a session token into the authenticated principal. */
export class ResolveSessionUseCase {
  private readonly users: UserRepository;
  private readonly sessions: SessionRepository;
  private readonly tokens: SessionTokenService;

  constructor(users: UserRepository, sessions: SessionRepository, tokens: SessionTokenService) {
    this.users = users;
    this.sessions = sessions;
    this.tokens = tokens;
  }

  async execute(rawToken: string | null): Promise<{ user: User; session: SessionRecord } | null> {
    if (!rawToken) return null;

    const tokenHash = this.tokens.hashToken(rawToken);
    const session = await this.sessions.findByTokenHash(tokenHash);
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await this.sessions.deleteByTokenHash(tokenHash);
      return null;
    }

    const user = await this.users.findById(session.userId);
    if (!user || !user.isActive) return null;

    return { user, session };
  }
}

export class GetProfileUseCase {
  async execute(user: User): Promise<UserDTO> {
    user.assertCan(PERMISSIONS.VIEW_OWN_PROFILE);
    return user.toDTO();
  }
}

export class UpdateProfileUseCase {
  private readonly users: UserRepository;
  private readonly eventBus: DomainEventBus;

  constructor(users: UserRepository, eventBus: DomainEventBus) {
    this.users = users;
    this.eventBus = eventBus;
  }

  async execute(actor: User, input: UpdateProfileInput): Promise<UserDTO> {
    actor.assertCan(PERMISSIONS.EDIT_OWN_PROFILE);

    const updated = actor.updateProfile(input);
    await this.users.save(updated);

    this.eventBus.publish({
      eventName: 'identity.profile_updated',
      occurredAt: new Date().toISOString(),
      boundedContext: 'identity',
      payload: { userId: updated.id },
    });

    return updated.toDTO();
  }
}

export class ChangePasswordUseCase {
  private readonly users: UserRepository;
  private readonly hasher: PasswordHasher;
  private readonly sessions: SessionRepository;

  constructor(users: UserRepository, hasher: PasswordHasher, sessions: SessionRepository) {
    this.users = users;
    this.hasher = hasher;
    this.sessions = sessions;
  }

  async execute(
    actor: User,
    input: { currentPassword: unknown; newPassword: unknown }
  ): Promise<{ ok: true }> {
    actor.assertCan(PERMISSIONS.EDIT_OWN_PROFILE);

    const current = typeof input.currentPassword === 'string' ? input.currentPassword : '';
    const next = typeof input.newPassword === 'string' ? input.newPassword : '';

    const ok = await this.hasher.verify(current, {
      passwordHash: actor.passwordHash,
      passwordSalt: actor.passwordSalt,
    });
    if (!ok) {
      throw new ValidationError('Текущий пароль указан неверно.', 'INVALID_CREDENTIALS');
    }

    // Reuse the domain password policy by building a validated draft.
    const draft = User.create({
      email: actor.email.value,
      fullName: actor.fullName.value,
      password: next,
    });

    const material = await this.hasher.hash(draft.plainPassword);
    await this.users.save(actor.withPassword(material));

    // A password change invalidates every existing session of the account.
    await this.sessions.deleteByUserId(actor.id);

    return { ok: true };
  }
}

/** Admin-only listing of accounts. */
export class ListUsersUseCase {
  private readonly users: UserRepository;

  constructor(users: UserRepository) {
    this.users = users;
  }

  async execute(actor: User): Promise<UserDTO[]> {
    actor.assertCan(PERMISSIONS.MANAGE_USERS);
    const all = await this.users.listAll();
    return all.map((u) => u.toDTO());
  }
}

/** Admin-only role assignment, with a self-demotion guard. */
export class AssignRoleUseCase {
  private readonly users: UserRepository;
  private readonly eventBus: DomainEventBus;

  constructor(users: UserRepository, eventBus: DomainEventBus) {
    this.users = users;
    this.eventBus = eventBus;
  }

  async execute(actor: User, input: { userId: unknown; role: unknown }): Promise<UserDTO> {
    actor.assertCan(PERMISSIONS.MANAGE_USERS);

    const userId = typeof input.userId === 'string' ? input.userId : '';
    if (!userId) {
      throw new ValidationError('Не указан пользователь.');
    }
    if (!isRole(input.role)) {
      throw new ValidationError('Указана неизвестная роль.');
    }
    const nextRole: Role = input.role;

    const target = await this.users.findById(userId);
    if (!target) {
      throw new ValidationError('Пользователь не найден.', 'NOT_FOUND');
    }

    // An admin must not lock themselves out of administration.
    if (target.id === actor.id && nextRole !== ROLES.ADMIN) {
      throw new ForbiddenError('users:manage');
    }

    const updated = target.changeRole(nextRole);
    await this.users.save(updated);

    this.eventBus.publish({
      eventName: 'identity.role_assigned',
      occurredAt: new Date().toISOString(),
      boundedContext: 'identity',
      payload: { userId: updated.id, role: nextRole, assignedBy: actor.id },
    });

    return updated.toDTO();
  }
}

/** Admin-only activation toggle. */
export class SetUserActiveUseCase {
  private readonly users: UserRepository;

  constructor(users: UserRepository) {
    this.users = users;
  }

  async execute(actor: User, input: { userId: unknown; isActive: unknown }): Promise<UserDTO> {
    actor.assertCan(PERMISSIONS.MANAGE_USERS);

    const userId = typeof input.userId === 'string' ? input.userId : '';
    if (!userId) {
      throw new ValidationError('Не указан пользователь.');
    }
    if (typeof input.isActive !== 'boolean') {
      throw new ValidationError('Некорректное значение статуса.');
    }
    if (userId === actor.id && input.isActive === false) {
      throw new ForbiddenError('users:manage');
    }

    const target = await this.users.findById(userId);
    if (!target) {
      throw new ValidationError('Пользователь не найден.', 'NOT_FOUND');
    }

    const updated = target.setActive(input.isActive);
    await this.users.save(updated);
    return updated.toDTO();
  }
}

export interface AdminBootstrapStatus {
  hasAdmin: boolean;
  setupKeyConfigured: boolean;
  canClaimFirstAdmin: boolean;
  canClaimWithSetupKey: boolean;
}

function constantTimeSecretMatches(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided, 'utf8').digest();
  const b = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(a, b);
}

/** Reports whether the local/initial admin bootstrap flow is still open. */
export class GetAdminBootstrapStatusUseCase {
  private readonly users: UserRepository;

  constructor(users: UserRepository) {
    this.users = users;
  }

  async execute(): Promise<AdminBootstrapStatus> {
    const all = await this.users.listAll();
    const hasAdmin = all.some((u) => u.role === ROLES.ADMIN && u.isActive);
    const setupKeyConfigured = Boolean((process.env.RCA_ADMIN_SETUP_KEY ?? '').trim());
    return {
      hasAdmin,
      setupKeyConfigured,
      canClaimFirstAdmin: !hasAdmin && !setupKeyConfigured,
      canClaimWithSetupKey: setupKeyConfigured,
    };
  }
}

/**
 * Promotes the authenticated account to `admin` either:
 * 1) in local mode when no active admin exists yet (`RCA_ADMIN_SETUP_KEY` unset), OR
 * 2) when the caller supplies the server-side `RCA_ADMIN_SETUP_KEY` env secret.
 */
export class ClaimAdminAccessUseCase {
  private readonly users: UserRepository;
  private readonly eventBus: DomainEventBus;

  constructor(users: UserRepository, eventBus: DomainEventBus) {
    this.users = users;
    this.eventBus = eventBus;
  }

  async execute(actor: User, input: { setupKey?: unknown } = {}): Promise<UserDTO> {
    if (!actor.isActive) {
      throw new ForbiddenError('users:manage');
    }

    const configuredKey = (process.env.RCA_ADMIN_SETUP_KEY ?? '').trim();
    if (configuredKey) {
      const provided = typeof input.setupKey === 'string' ? input.setupKey.trim() : '';
      if (!provided || !constantTimeSecretMatches(provided, configuredKey)) {
        throw new ValidationError('Неверный ключ активации администратора.', 'INVALID_CREDENTIALS');
      }
    } else {
      const all = await this.users.listAll();
      const hasAdmin = all.some((u) => u.role === ROLES.ADMIN && u.isActive);
      if (hasAdmin && actor.role !== ROLES.ADMIN) {
        throw new ForbiddenError('users:manage');
      }
    }

    const updated = actor.role === ROLES.ADMIN ? actor : actor.changeRole(ROLES.ADMIN);
    if (actor.role !== ROLES.ADMIN) {
      await this.users.save(updated);
      this.eventBus.publish({
        eventName: 'identity.role_assigned',
        occurredAt: new Date().toISOString(),
        boundedContext: 'identity',
        payload: { userId: updated.id, role: ROLES.ADMIN, assignedBy: 'bootstrap' },
      });
    }

    return updated.toDTO();
  }
}

/** Convenience re-export so HTTP guards can express intent without importing the enum. */
export type { Permission };
