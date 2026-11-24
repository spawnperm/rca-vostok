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
  phone: string;
  telegram: string;
  avatarUrl: string;
  role: Role;
  permissions: Permission[];
  isActive: boolean;
  attestationExpiresAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface CreateUserInput {
  email: unknown;
  password: unknown;
  fullName: unknown;
  region?: unknown;
  organisation?: unknown;
  phone?: unknown;
  telegram?: unknown;
  avatarUrl?: unknown;
  role?: unknown;
  attestationExpiresAt?: unknown;
}

export interface UpdateProfileInput {
  fullName?: unknown;
  region?: unknown;
  organisation?: unknown;
  phone?: unknown;
  telegram?: unknown;
  avatarUrl?: unknown;
  attestationExpiresAt?: unknown;
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
  readonly phone: string;
  readonly telegram: string;
  readonly avatarUrl: string;
  readonly role: Role;
  readonly passwordHash: string;
  readonly passwordSalt: string;
  readonly isActive: boolean;
  readonly attestationExpiresAt: string | null;
  readonly createdAt: string;
  readonly lastLoginAt: string | null;

  private constructor(props: {
    id: string;
    email: EmailAddress;
    fullName: SanitizedText;
    region: string;
    organisation: string;
    phone: string;
    telegram: string;
    avatarUrl: string;
    role: Role;
    passwordHash: string;
    passwordSalt: string;
    isActive: boolean;
    attestationExpiresAt: string | null;
    createdAt: string;
    lastLoginAt: string | null;
  }) {
    this.id = props.id;
    this.email = props.email;
    this.fullName = props.fullName;
    this.region = props.region;
    this.organisation = props.organisation;
    this.phone = props.phone;
    this.telegram = props.telegram;
    this.avatarUrl = props.avatarUrl;
    this.role = props.role;
    this.passwordHash = props.passwordHash;
    this.passwordSalt = props.passwordSalt;
    this.isActive = props.isActive;
    this.attestationExpiresAt = props.attestationExpiresAt;
    this.createdAt = props.createdAt;
    this.lastLoginAt = props.lastLoginAt;
  }

  static parseAttestationExpiresAt(input: unknown): string | null {
    if (input === null || input === undefined) {
      return null;
    }
    if (typeof input !== 'string') {
      throw new ValidationError('Некорректный формат даты истечения аттестации.');
    }
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new ValidationError(
        'Укажите дату истечения аттестации в формате ГГГГ-ММ-ДД.'
      );
    }
    const [yStr, mStr, dStr] = trimmed.split('-');
    const year = Number(yStr);
    const month = Number(mStr);
    const day = Number(dStr);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() + 1 !== month ||
      parsed.getUTCDate() !== day
    ) {
      throw new ValidationError('Указана несуществующая календарная дата аттестации.');
    }
    return trimmed;
  }

  static parsePhone(input: unknown): string {
    if (input === null || input === undefined) return '';
    if (typeof input !== 'string') {
      throw new ValidationError('Некорректный формат контактного телефона.');
    }
    const clean = SanitizedText.sanitizeRaw(input, 32);
    if (!clean) return '';
    if (!/^[+\d\s()\-]+$/u.test(clean)) {
      throw new ValidationError(
        'Телефон может содержать только цифры, пробелы, скобки, дефисы и знак +.'
      );
    }
    const digitsCount = clean.replace(/\D/g, '').length;
    if (digitsCount < 6 || digitsCount > 15) {
      throw new ValidationError('Укажите корректный номер телефона (от 6 до 15 цифр).');
    }
    return clean;
  }

  static parseTelegram(input: unknown): string {
    if (input === null || input === undefined) return '';
    if (typeof input !== 'string') {
      throw new ValidationError('Некорректный формат Telegram-контакта.');
    }
    const trimmed = SanitizedText.sanitizeRaw(input, 64);
    if (!trimmed) return '';
    const withoutUrl = trimmed.replace(/^https?:\/\/t\.me\//i, '').replace(/^t\.me\//i, '');
    const normalized = withoutUrl.startsWith('@') ? withoutUrl : `@${withoutUrl}`;
    if (!/^@[a-zA-Z0-9_]{4,35}$/.test(normalized)) {
      throw new ValidationError(
        'Укажите корректный ник в Telegram (латиница, цифры или «_», от 4 до 35 символов).'
      );
    }
    return normalized;
  }

  static parseAvatarUrl(input: unknown): string {
    if (input === null || input === undefined) return '';
    if (typeof input !== 'string') {
      throw new ValidationError('Некорректный формат изображения аватара.');
    }
    const trimmed = input.trim();
    if (!trimmed) return '';
    if (trimmed.length > 180_000) {
      throw new ValidationError(
        'Размер изображения аватара превышает допустимый лимит (до 180 КБ).'
      );
    }
    // Allow built-in generated guide portraits, Media Library images, or compact raster data URLs (no SVG/scripts).
    if (/^\/src\/assets\/images\/[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$/i.test(trimmed)) {
      return trimmed;
    }
    if (/^\/media\/[a-zA-Z0-9_-]+$/i.test(trimmed)) {
      return trimmed;
    }
    if (/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
      return trimmed;
    }
    throw new ValidationError(
      'Допустимы только встроенные фото-портреты РЦА, файлы из Медиатеки или изображения JPEG/PNG/WebP.'
    );
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
    const phone = User.parsePhone(input.phone);
    const telegram = User.parseTelegram(input.telegram);
    const avatarUrl = User.parseAvatarUrl(input.avatarUrl);
    const role = parseRole(input.role, ROLES.CANDIDATE);
    const attestationExpiresAt =
      input.attestationExpiresAt === undefined
        ? null
        : User.parseAttestationExpiresAt(input.attestationExpiresAt);

    const user = new User({
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      email,
      fullName,
      region,
      organisation,
      phone,
      telegram,
      avatarUrl,
      role,
      // Placeholders: replaced by withPassword() before persistence.
      passwordHash: '',
      passwordSalt: '',
      isActive: true,
      attestationExpiresAt,
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
      phone: this.phone,
      telegram: this.telegram,
      avatarUrl: this.avatarUrl,
      role: this.role,
      passwordHash: material.passwordHash,
      passwordSalt: material.passwordSalt,
      isActive: this.isActive,
      attestationExpiresAt: this.attestationExpiresAt,
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
    phone?: string;
    telegram?: string;
    avatarUrl?: string;
    role: unknown;
    passwordHash: string;
    passwordSalt: string;
    isActive: boolean;
    attestationExpiresAt?: string | null;
    createdAt: string;
    lastLoginAt: string | null;
  }): User {
    return new User({
      id: props.id,
      email: EmailAddress.rehydrate(props.email),
      fullName: SanitizedText.rehydrate(props.fullName),
      region: props.region,
      organisation: props.organisation,
      phone: props.phone ?? '',
      telegram: props.telegram ?? '',
      avatarUrl: props.avatarUrl ?? '',
      role: parseRole(props.role),
      passwordHash: props.passwordHash,
      passwordSalt: props.passwordSalt,
      isActive: props.isActive,
      attestationExpiresAt: props.attestationExpiresAt ?? null,
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
    const phone =
      input.phone === undefined ? this.phone : User.parsePhone(input.phone);
    const telegram =
      input.telegram === undefined ? this.telegram : User.parseTelegram(input.telegram);
    const avatarUrl =
      input.avatarUrl === undefined ? this.avatarUrl : User.parseAvatarUrl(input.avatarUrl);
    const attestationExpiresAt =
      input.attestationExpiresAt === undefined
        ? this.attestationExpiresAt
        : User.parseAttestationExpiresAt(input.attestationExpiresAt);

    return new User({
      id: this.id,
      email: this.email,
      fullName,
      region,
      organisation,
      phone,
      telegram,
      avatarUrl,
      role: this.role,
      passwordHash: this.passwordHash,
      passwordSalt: this.passwordSalt,
      isActive: this.isActive,
      attestationExpiresAt,
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
      phone: this.phone,
      telegram: this.telegram,
      avatarUrl: this.avatarUrl,
      role,
      passwordHash: this.passwordHash,
      passwordSalt: this.passwordSalt,
      isActive: this.isActive,
      attestationExpiresAt: this.attestationExpiresAt,
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
      phone: this.phone,
      telegram: this.telegram,
      avatarUrl: this.avatarUrl,
      role: this.role,
      passwordHash: this.passwordHash,
      passwordSalt: this.passwordSalt,
      isActive: this.isActive,
      attestationExpiresAt: this.attestationExpiresAt,
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
      phone: this.phone,
      telegram: this.telegram,
      avatarUrl: this.avatarUrl,
      role: this.role,
      passwordHash: this.passwordHash,
      passwordSalt: this.passwordSalt,
      isActive,
      attestationExpiresAt: this.attestationExpiresAt,
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
      phone: this.phone,
      telegram: this.telegram,
      avatarUrl: this.avatarUrl,
      role: this.role,
      permissions: [...rolePermissions(this.role)],
      isActive: this.isActive,
      attestationExpiresAt: this.attestationExpiresAt,
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
