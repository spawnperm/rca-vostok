import { connect, type NatsConnection, type Subscription } from 'nats';
import type {
  DomainEvent,
  DomainEventBus,
  DomainEventHandler,
} from '../../domain/shared/DomainError.ts';

/**
 * Domain event bus backed by NATS.
 *
 * In-process subscribers keep working exactly as before (so the existing
 * observability logging and tests are unaffected); events are additionally
 * published to NATS so other services — and future worker processes — can
 * consume them. Publishing is fire-and-forget: a broker outage must never break
 * a user request, so failures are logged and swallowed.
 */
export class NatsDomainEventBus implements DomainEventBus {
  private readonly localHandlers = new Map<string, Set<DomainEventHandler>>();
  private readonly connection: NatsConnection;
  private readonly subjectPrefix: string;

  constructor(connection: NatsConnection, subjectPrefix = 'rca.events') {
    this.connection = connection;
    this.subjectPrefix = subjectPrefix;
    void this.subscribeToRemote();
  }

  /** Wires NATS messages back into local handlers for cross-process fan-out. */
  private async subscribeToRemote(): Promise<void> {
    try {
      const sub: Subscription = this.connection.subscribe(`${this.subjectPrefix}.>`);
      for await (const msg of sub) {
        try {
          const event = JSON.parse(new TextDecoder().decode(msg.data)) as DomainEvent;
          this.dispatchLocally(event);
        } catch (err) {
          console.error('[nats] malformed event payload', err);
        }
      }
    } catch (err) {
      console.error('[nats] subscription failed', err);
    }
  }

  publish<TPayload>(event: DomainEvent<TPayload>): void {
    // Local delivery first: in-process subscribers must run even when NATS is
    // unavailable.
    this.dispatchLocally(event);

    const subject = `${this.subjectPrefix}.${event.boundedContext}.${event.eventName}`;
    try {
      this.connection.publish(subject, new TextEncoder().encode(JSON.stringify(event)));
    } catch (err) {
      console.error('[nats] publish failed', err);
    }
  }

  subscribe(eventName: string, handler: DomainEventHandler): () => void {
    const set = this.localHandlers.get(eventName) ?? new Set<DomainEventHandler>();
    set.add(handler);
    this.localHandlers.set(eventName, set);

    return () => {
      set.delete(handler);
    };
  }

  private dispatchLocally(event: DomainEvent<unknown>): void {
    for (const name of [event.eventName, '*']) {
      const handlers = this.localHandlers.get(name);
      if (!handlers) continue;
      for (const handler of handlers) {
        try {
          // Handlers are typed against Record<string, unknown>; the generic
          // payload is erased here because the dispatch loop is payload-agnostic.
          handler(event as DomainEvent<Record<string, unknown>>);
        } catch (err) {
          console.error('[events] handler failed', err);
        }
      }
    }
  }

  async drain(): Promise<void> {
    await this.connection.drain();
  }
}

/**
 * Connects to NATS when configured.
 *
 * Returns null when NATS_URL is absent or the broker is unreachable, in which
 * case the composition root falls back to the in-memory bus. A dead optional
 * dependency must not prevent the application from booting.
 */
export async function createNatsBusFromEnv(): Promise<NatsDomainEventBus | null> {
  const url = process.env.NATS_URL;
  if (!url) return null;

  try {
    const connection = await connect({
      servers: url,
      maxReconnectAttempts: 5,
      reconnectTimeWait: 1000,
      timeout: 5000,
    });
    console.info(`[events] connected to NATS at ${url}`);
    return new NatsDomainEventBus(connection);
  } catch (err) {
    console.error('[events] NATS unavailable, falling back to in-memory bus', err);
    return null;
  }
}
