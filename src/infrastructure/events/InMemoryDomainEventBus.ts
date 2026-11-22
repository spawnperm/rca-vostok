import type {
  DomainEvent,
  DomainEventBus,
  DomainEventHandler,
} from '../../domain/shared/DomainError.ts';

export class InMemoryDomainEventBus implements DomainEventBus {
  private readonly listeners = new Map<string, Set<DomainEventHandler>>();

  publish<TPayload>(event: DomainEvent<TPayload>): void {
    const specific = this.listeners.get(event.eventName);
    if (specific) {
      for (const handler of specific) {
        handler(event as DomainEvent);
      }
    }
    const wildcard = this.listeners.get('*');
    if (wildcard) {
      for (const handler of wildcard) {
        handler(event as DomainEvent);
      }
    }
  }

  subscribe(eventName: string, handler: DomainEventHandler): () => void {
    const existing = this.listeners.get(eventName) ?? new Set<DomainEventHandler>();
    existing.add(handler);
    this.listeners.set(eventName, existing);

    return () => {
      const current = this.listeners.get(eventName);
      if (current) {
        current.delete(handler);
      }
    };
  }
}
