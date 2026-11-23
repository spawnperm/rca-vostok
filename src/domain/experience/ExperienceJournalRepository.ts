import type { ExperienceLogEntry } from './ExperienceEntry.ts';

/**
 * Repository Port for the `experience` bounded context.
 * Implemented by JSON-file / PostgreSQL adapters on the server and
 * LocalStorage / HTTP adapters on the client.
 */
export interface ExperienceJournalRepository {
  listByOwner(ownerId: string): Promise<ExperienceLogEntry[] | null>;
  saveByOwner(ownerId: string, entries: readonly ExperienceLogEntry[]): Promise<void>;
}
