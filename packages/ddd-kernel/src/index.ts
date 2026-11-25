import { z } from 'zod';

/**
 * Bounded contexts of this platform.
 *
 * Adopted from the mvr_ kernel, but the list now names the contexts that
 * actually exist in src/domain/: certification, analytics, identity, social,
 * chat, media, experience, lms. Anything the platform cannot emit or handle is
 * removed rather than left as a lying union member.
 */
export type BoundedContextId =
  | 'shared-kernel'
  | 'identity'
  | 'certification'
  | 'analytics'
  | 'research'
  | 'feedback'
  | 'social'
  | 'chat'
  | 'media'
  | 'experience'
  | 'lms';

export type PluginExtensionSlot =
  | 'account_sidebar'
  | 'account_toolbar'
  | 'social_composer'
  | 'admin_module';

export class DomainInvariantError extends Error {
  readonly code: string;
  readonly context: BoundedContextId;

  constructor(message: string, code = 'DOMAIN_INVARIANT_VIOLATION', context: BoundedContextId = 'shared-kernel') {
    super(message);
    this.name = 'DomainInvariantError';
    this.code = code;
    this.context = context;
  }
}

export interface DomainEventEnvelope<TPayload = Record<string, unknown>> {
  eventId: string;
  eventName: string;
  subject: string;
  aggregateId: string;
  aggregateType: string;
  boundedContext: BoundedContextId;
  tenantId: string;
  actorId: string;
  occurredAt: string;
  payload: TPayload;
}

export abstract class ValueObject<TProps extends object> {
  protected readonly props: Readonly<TProps>;

  protected constructor(props: TProps) {
    this.props = Object.freeze({ ...props });
  }

  get value(): Readonly<TProps> {
    return this.props;
  }

  equals(other?: ValueObject<TProps> | null): boolean {
    if (!other || other.constructor !== this.constructor) return false;
    const selfRecord = this.props as Record<string, unknown>;
    const otherRecord = other.props as Record<string, unknown>;
    const aKeys = Object.keys(selfRecord);
    const bKeys = Object.keys(otherRecord);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) => selfRecord[k] === otherRecord[k]);
  }
}

export abstract class Entity<TProps extends object, TId extends string = string> {
  readonly id: TId;
  protected props: TProps;

  protected constructor(id: TId, props: TProps) {
    if (!id || !id.trim()) {
      throw new DomainInvariantError('Идентификатор сущности не может быть пустым', 'EMPTY_ENTITY_ID');
    }
    this.id = id;
    this.props = { ...props };
  }

  equals(other?: Entity<TProps, TId> | null): boolean {
    if (!other || other.constructor !== this.constructor) return false;
    return this.id === other.id;
  }

  toProps(): Readonly<TProps> {
    return Object.freeze({ ...this.props });
  }
}

export abstract class AggregateRoot<TProps extends object, TId extends string = string> extends Entity<
  TProps,
  TId
> {
  private domainEvents: DomainEventEnvelope[] = [];
  private _version = 0;

  get version(): number {
    return this._version;
  }

  protected addDomainEvent<TPayload extends Record<string, unknown>>(
    event: Omit<DomainEventEnvelope<TPayload>, 'eventId' | 'occurredAt' | 'aggregateId'>
  ): DomainEventEnvelope<TPayload> {
    const envelope: DomainEventEnvelope<TPayload> = {
      ...event,
      eventId: createEventUuid(),
      aggregateId: this.id,
      occurredAt: new Date().toISOString(),
    };
    this.domainEvents.push(envelope);
    this._version += 1;
    return envelope;
  }

  pullDomainEvents(): DomainEventEnvelope[] {
    const events = [...this.domainEvents];
    this.domainEvents = [];
    return events;
  }

  peekDomainEvents(): readonly DomainEventEnvelope[] {
    return this.domainEvents;
  }
}

function createEventUuid(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return `evt_${globalThis.crypto.randomUUID().slice(0, 12)}`;
  }
  return `evt_${Math.random().toString(36).slice(2, 14)}`;
}

export type CurrencyCode = 'RUB' | 'USD' | 'EUR';

export class Money extends ValueObject<{ amount: number; currency: CurrencyCode }> {
  private constructor(amount: number, currency: CurrencyCode) {
    super({ amount, currency });
  }

  static create(amount: number, currency: CurrencyCode = 'RUB'): Money {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new DomainInvariantError(
        'Денежная сумма не может быть отрицательной или нечисловой',
        'INVALID_MONEY_AMOUNT',
        'certification'
      );
    }
    return new Money(Math.round(amount * 100) / 100, currency);
  }

  get amount(): number {
    return this.props.amount;
  }

  get currency(): CurrencyCode {
    return this.props.currency;
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) {
      throw new DomainInvariantError(
        `Нельзя складывать суммы в разных валютах: ${this.currency} и ${other.currency}`,
        'CURRENCY_MISMATCH',
        'certification'
      );
    }
    return Money.create(this.amount + other.amount, this.currency);
  }

  formatRu(): string {
    return `${this.amount.toLocaleString('ru-RU')} ${this.currency}`;
  }
}

export const VerdaccioPackageNameSchema = z
  .string()
  .trim()
  .regex(
    /^@(nexus-plugins|nexus-core)\/[a-z0-9][a-z0-9-]{1,48}$/,
    'Пакет Verdaccio должен принадлежать скоупу @nexus-plugins/* или @nexus-core/*'
  );

export class VerdaccioPackageName extends ValueObject<{ fullName: string; scope: string; slug: string }> {
  private constructor(fullName: string, scope: string, slug: string) {
    super({ fullName, scope, slug });
  }

  static create(rawName: string): VerdaccioPackageName {
    const parsed = VerdaccioPackageNameSchema.safeParse(rawName);
    if (!parsed.success) {
      throw new DomainInvariantError(
        parsed.error.issues[0]?.message || 'Некорректное имя пакета Verdaccio',
        'INVALID_PACKAGE_NAME',
        'social'
      );
    }
    const [scope, slug] = parsed.data.split('/');
    return new VerdaccioPackageName(parsed.data, scope, slug);
  }

  get fullName(): string {
    return this.props.fullName;
  }

  get scope(): string {
    return this.props.scope;
  }

  get slug(): string {
    return this.props.slug;
  }

  tarballFilename(version: string): string {
    return `${this.slug}-${version}.tgz`;
  }
}

export interface NexusModuleDescriptor<TConfig = Record<string, unknown>> {
  packageName: string;
  version: string;
  title: string;
  category: string;
  slot: PluginExtensionSlot;
  boundedContext: BoundedContextId;
  contextMapping: 'Shared Kernel' | 'Customer-Supplier' | 'Anti-Corruption Layer' | 'Published Language';
  aggregates: string[];
  valueObjects: string[];
  publishedEvents: string[];
  subscribedSubjects: string[];
  permissionsRequired: string[];
  configSchema: z.ZodType<TConfig>;
  defaultConfig: TConfig;
  runDomainPreview: (config: TConfig, input?: Record<string, unknown>) => Record<string, unknown>;
}
