export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, code = 'VALIDATION_ERROR') {
    super(code, message);
  }
}

export class InvariantViolationError extends DomainError {
  constructor(message: string, code = 'INVARIANT_VIOLATION') {
    super(code, message);
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string, code = 'NOT_FOUND') {
    super(code, message);
  }
}

export interface DomainEvent<TPayload = Record<string, unknown>> {
  readonly eventName: string;
  readonly occurredAt: string;
  readonly boundedContext:
    | 'certification'
    | 'analytics'
    | 'research'
    | 'feedback'
    | 'identity'
    | 'experience';
  readonly payload: TPayload;
}

export type DomainEventHandler<TPayload = Record<string, unknown>> = (
  event: DomainEvent<TPayload>
) => void;

export interface DomainEventBus {
  publish<TPayload>(event: DomainEvent<TPayload>): void;
  subscribe(eventName: string, handler: DomainEventHandler): () => void;
}
