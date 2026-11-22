import { ValidationError, type DomainEventBus } from '../../domain/shared/DomainError.ts';
import type { UserRepository } from '../../domain/identity/IdentityRepositories.ts';
import type { User } from '../../domain/identity/User.ts';
import {
  PasswordResetToken,
  type Mailer,
  type PasswordResetRepository,
} from '../../domain/identity/PasswordReset.ts';
import type { PasswordHasher } from './SecurityPorts.ts';
import type { SessionRepository } from '../../domain/identity/IdentityRepositories.ts';
import { User as UserAggregate } from '../../domain/identity/User.ts';

export interface ForgotPasswordResult {
  ok: true;
  /**
   * True only when a mail transport is configured AND the account exists.
   * The HTTP layer deliberately returns the same body regardless, so this flag
   * exists for operators/tests, not for the client.
   */
  delivered: boolean;
}

/**
 * Starts the password-reset flow.
 *
 * Security notes:
 * - The response never reveals whether the email belongs to an account, so this
 *   endpoint cannot be used to enumerate users. Unknown addresses return the
 *   same shape and are not stored.
 * - Any previously issued token for the account is deleted first, so only the
 *   newest link works.
 */
export class ForgotPasswordUseCase {
  private readonly users: UserRepository;
  private readonly tokens: PasswordResetRepository;
  private readonly mailer: Mailer;
  private readonly eventBus: DomainEventBus;
  private readonly publicBaseUrl: string;

  constructor(
    users: UserRepository,
    tokens: PasswordResetRepository,
    mailer: Mailer,
    eventBus: DomainEventBus,
    publicBaseUrl: string
  ) {
    this.users = users;
    this.tokens = tokens;
    this.mailer = mailer;
    this.eventBus = eventBus;
    this.publicBaseUrl = publicBaseUrl.replace(/\/+$/, '');
  }

  async execute(input: { email: unknown }): Promise<ForgotPasswordResult> {
    const rawEmail = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    if (!rawEmail) {
      throw new ValidationError('Укажите адрес электронной почты.');
    }

    const user = await this.users.findByEmail(rawEmail);
    if (!user || !user.isActive) {
      // Same shape as success; nothing is stored and no mail is sent.
      return { ok: true, delivered: false };
    }

    await this.tokens.deleteForUser(user.id);

    const token = PasswordResetToken.issue(user.id);
    await this.tokens.save(token.toRecord());

    const link = `${this.publicBaseUrl}/?tab=account&reset=${encodeURIComponent(token.token)}`;
    const delivered = await this.mailer.send({
      to: user.email.value,
      subject: 'Восстановление пароля — РЦА «Русский Восток»',
      text: [
        `Здравствуйте, ${user.fullName.value}!`,
        '',
        'Вы запросили восстановление пароля на платформе РЦА «Русский Восток».',
        `Перейдите по ссылке (действует 15 минут): ${link}`,
        '',
        'Если вы не запрашивали восстановление, просто проигнорируйте это письмо.',
      ].join('\n'),
      html: `<p>Здравствуйте, ${escapeHtml(user.fullName.value)}!</p>
<p>Вы запросили восстановление пароля на платформе РЦА «Русский Восток».</p>
<p><a href="${escapeHtml(link)}">Задать новый пароль</a> — ссылка действует 15 минут.</p>
<p>Если вы не запрашивали восстановление, просто проигнорируйте это письмо.</p>`,
    });

    this.eventBus.publish({
      eventName: 'identity.password_reset_requested',
      occurredAt: token.createdAt,
      boundedContext: 'identity',
      payload: { userId: user.id, delivered },
    });

    return { ok: true, delivered };
  }
}

/**
 * Completes the reset: validates the token, applies the domain password policy
 * and revokes every session so a stolen cookie cannot outlive the recovery.
 */
export class ResetPasswordUseCase {
  private readonly users: UserRepository;
  private readonly tokens: PasswordResetRepository;
  private readonly sessions: SessionRepository;
  private readonly hasher: PasswordHasher;
  private readonly eventBus: DomainEventBus;

  constructor(
    users: UserRepository,
    tokens: PasswordResetRepository,
    sessions: SessionRepository,
    hasher: PasswordHasher,
    eventBus: DomainEventBus
  ) {
    this.users = users;
    this.tokens = tokens;
    this.sessions = sessions;
    this.hasher = hasher;
    this.eventBus = eventBus;
  }

  async execute(input: { token: unknown; password: unknown }): Promise<{ ok: true }> {
    const rawToken = PasswordResetToken.assertTokenShape(input.token);
    const tokenHash = PasswordResetToken.hash(rawToken);

    const record = await this.tokens.findUsable(tokenHash, new Date().toISOString());
    if (!record) {
      throw new ValidationError(
        'Ссылка восстановления недействительна или истекла.',
        'INVALID_RESET_TOKEN'
      );
    }

    const user = await this.users.findById(record.userId);
    if (!user || !user.isActive) {
      throw new ValidationError(
        'Ссылка восстановления недействительна или истекла.',
        'INVALID_RESET_TOKEN'
      );
    }

    // Reuse the aggregate's password policy by building a validated draft.
    // User.create() returns the aggregate plus the validated plain password,
    // which is the only place the raw value is available for hashing.
    const draft = UserAggregate.create({
      email: user.email.value,
      fullName: user.fullName.value,
      password: input.password,
    });

    const material = await this.hasher.hash(draft.plainPassword);
    await this.users.save(user.withPassword(material));

    // Single-use token, and every existing session is revoked.
    await this.tokens.markUsed(tokenHash, new Date().toISOString());
    await this.sessions.deleteByUserId(user.id);

    this.eventBus.publish({
      eventName: 'identity.password_reset_completed',
      occurredAt: new Date().toISOString(),
      boundedContext: 'identity',
      payload: { userId: user.id },
    });

    return { ok: true };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
