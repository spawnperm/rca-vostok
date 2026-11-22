import { InvariantViolationError, ValidationError } from '../shared/DomainError.ts';
import { EmailAddress, SanitizedText } from '../shared/ValueObjects.ts';
import {
  type Permission,
  type Role,
  ROLES,
  parseRole,
  permissionsForRole as rolePermissions,
  roleHasPermission,
} from './Rbac.ts';

/** Password hash material, produced and verified by an infrastructure adapter. */
export interface PasswordHash {
  readonly passwordHash: string;
  readonly passwordSalt: string;
}

export interface UserDTO {
  id: string;
  email: string;
  fullName: string;
  region: string;
  organisation: string;
  role: Role;
  permissions: Permission[];
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface CreateUserInput {
  email: unknown;
  password: unknown;
  fullName: unknown;
  region?: unknown;
  organisation?: unknown;
  role?: unknown;
}

export interface UpdateProfileInput {
  fullName?: unknown;
  region?: unknown;
  organisation?: unknown;
}

/** Password policy is a domain rule, not a controller concern. */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

export class User {
  readonly id: string;
  readonly email: EmailAddress;
  readonly fullName: SanitizedText;
  readonly region: string;
  readonly organisation: string;
  readonly role: Role;
  readonly passwordHash: string;
  readonly passwordSalt: string;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly lastLoginAt: string | null;

  private constructor(props: {
    id: string;
    email: EmailAddress;
    fullName: SanitizedText;
    region: string;
    organisation: string;
    role: Role;
    passwordHash: string;
    passwordSalt: string;
    isActive: boolean;
    createdAt: string;
    lastLoginAt: string | null;
  }) {
    this.id = props.id;
    this.email = props.email;
    this.fullName = props.fullName;
    this.region = props.region;
    this.organisation = props.organisation;
    this.role = props.role;
    this.passwordHash = props.passwordHash;
    this.passwordSalt = props.passwordSalt;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.lastLoginAt = props.lastLoginAt;
  }

  /**
   * Validates registration input. The password itself is *not* stored here:
   * hashing is an infrastructure concern, so callers pass the derived material
   * to `withPassword`.
   */
  static create(input: CreateUserInput): User & { readonly plainPassword: string } {
    const email = EmailAddress.create(input.email);
    const fullName = SanitizedText.create(input.fullName, {
      fieldLabel: 'ФИО',
      minLen: 2,
      maxLen: 120,
    });
    const password = User.assertPassword(input.password);
    const region =
      SanitizedText.sanitizeRaw(input.region, 80) || 'Приморский край';
    const organisation = SanitizedText.sanitizeRaw(input.organisation, 160);
    const role = parseRole(input.role, ROLES.CANDIDATE);

    const user = new User({
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      email,
      fullName,
      region,
      organisation,
      role,
      // Placeholders: replaced by withPassword() before persistence.
      passwordHash: '',
      passwordSalt: '',
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    });

    return Object.assign(user, { plainPassword: password });
  }

  private static assertPassword(input: unknown): string {
    if (typeof input !== 'string') {
      throw new ValidationError('Пароль обязателен.');
    }
    if (input.length < PASSWORD_MIN_LENGTH) {
      throw new ValidationError(
        `Пароль должен содержать не менее ${PASSWORD_MIN_LENGTH} символов.`
      );
    }
    if (input.length > PASSWORD_MAX_LENGTH) {
      throw new ValidationError(
        `Пароль не должен превышать ${PASSWORD_MAX_LENGTH} символов.`
      );
    }
    // Reject all-same-character and trivially common secrets.
    if (/^(.)\1+$/u.test(input)) {
      throw new ValidationError('Пароль слишком простой: используйте разные символы.');
    }
    if (!/[a-zA-Zа-яА-Я]/u.test(input) || !/\d/u.test(input)) {
      throw new ValidationError('Пароль должен содержать буквы и цифры.');
    }
    return input;
  }

  /** Returns a copy carrying the derived password material. */
  withPassword(material: PasswordHash): User {
    if (!material.passwordHash || !material.passwordSalt) {
      throw new InvariantViolationError('Password material must not be empty.');
    }
    return new User({
      id: this.id,
      email: this.email,
      fullName: this.fullName,
      region: this.region,
      organisation: this.organisation,
      role: this.role,
      passwordHash: material.passwordHash,
      passwordSalt: material.passwordSalt,
      isActive: this.isActive,
      createdAt: this.createdAt,
      lastLoginAt: this.lastLoginAt,
    });
  }

  /** Rehydrates an aggregate from persistence without re-running validation. */
  static rehydrate(props: {
    id: string;
    email: string;
    fullName: string;
    region: string;
    organisation: string;
    role: unknown;
    passwordHash: string;
    passwordSalt: string;
    isActive: boolean;
    createdAt: string;
    lastLoginAt: string | null;
  }): User {
    return new User({
      id: props.id,
      email: EmailAddress.rehydrate(props.email),
      fullName: SanitizedText.rehydrate(props.fullName),
      region: props.region,
      organisation: props.organisation,
      role: parseRole(props.role),
      passwordHash: props.passwordHash,
      passwordSalt: props.passwordSalt,
      isActive: props.isActive,
      createdAt: props.createdAt,
      lastLoginAt: props.lastLoginAt,
    });
  }

  updateProfile(input: UpdateProfileInput): User {
    const fullName =
      input.fullName === undefined
        ? this.fullName
        : SanitizedText.create(input.fullName, {
            fieldLabel: 'ФИО',
            minLen: 2,
            maxLen: 120,
          });
    const region =
      input.region === undefined
        ? this.region
        : SanitizedText.sanitizeRaw(input.region, 80) || this.region;
    const organisation =
      input.organisation === undefined
        ? this.organisation
        : SanitizedText.sanitizeRaw(input.organisation, 160);

    return new User({
      id: this.id,
      email: this.email,
      fullName,
      region,
      organisation,
      role: this.role,
      passwordHash: this.passwordHash,
      passwordSalt: this.passwordSalt,
      isActive: this.isActive,
      createdAt: this.createdAt,
      lastLoginAt: this.lastLoginAt,
    });
  }

  /**
   * Role changes are a privileged operation; only an admin may reassign roles
   * and an admin must not strip their own privileges (guarded in the use case).
   */
  changeRole(role: Role): User {
    return new User({
      id: this.id,
      email: this.email,
      fullName: this.fullName,
      region: this.region,
      organisation: this.organisation,
      role,
      passwordHash: this.passwordHash,
      passwordSalt: this.passwordSalt,
      isActive: this.isActive,
      createdAt: this.createdAt,
      lastLoginAt: this.lastLoginAt,
    });
  }

  withLastLogin(at: string): User {
    return new User({
      id: this.id,
      email: this.email,
      fullName: this.fullName,
      region: this.region,
      organisation: this.organisation,
      role: this.role,
      passwordHash: this.passwordHash,
      passwordSalt: this.passwordSalt,
      isActive: this.isActive,
      createdAt: this.createdAt,
      lastLoginAt: at,
    });
  }

  /** Enables or disables sign-in for the account (admin operation). */
  setActive(isActive: boolean): User {
    return new User({
      id: this.id,
      email: this.email,
      fullName: this.fullName,
      region: this.region,
      organisation: this.organisation,
      role: this.role,
      passwordHash: this.passwordHash,
      passwordSalt: this.passwordSalt,
      isActive,
      createdAt: this.createdAt,
      lastLoginAt: this.lastLoginAt,
    });
  }

  /** Domain-level RBAC check. */
  can(permission: Permission): boolean {
    if (!this.isActive) return false;
    return roleHasPermission(this.role, permission);
  }

  assertCan(permission: Permission): void {
    if (!this.can(permission)) {
      throw new ForbiddenError(permission);
    }
  }

  toDTO(): UserDTO {
    return {
      id: this.id,
      email: this.email.value,
      fullName: this.fullName.value,
      region: this.region,
      organisation: this.organisation,
      role: this.role,
      permissions: [...rolePermissions(this.role)],
      isActive: this.isActive,
      createdAt: this.createdAt,
      lastLoginAt: this.lastLoginAt,
    };
  }
}

/** Thrown when an authenticated principal lacks the required permission. */
export class ForbiddenError extends InvariantViolationError {
  readonly permission: string;

  constructor(permission: string) {
    super(
      `Недостаточно прав для выполнения операции (требуется «${permission}»).`,
      'FORBIDDEN'
    );
    this.permission = permission;
  }
}
