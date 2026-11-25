export {
  AggregateRoot,
  DomainInvariantError,
  Entity,
  Money,
  ValueObject,
  VerdaccioPackageName,
  VerdaccioPackageNameSchema,
  type BoundedContextId,
  type CurrencyCode,
  type DomainEventEnvelope,
  type NexusModuleDescriptor,
  type PluginExtensionSlot,
} from '@nexus-core/ddd-kernel';

import type { DomainEventEnvelope } from '@nexus-core/ddd-kernel';

export interface DomainRepository<TAggregate, TId = string> {
  findById(tenantId: string, id: TId): Promise<TAggregate | null>;
  save(aggregate: TAggregate): Promise<void>;
}

export interface DomainEventDispatcher {
  dispatchAll(events: readonly DomainEventEnvelope[]): Promise<void>;
}
