// Client-side Infrastructure & Facade for the `experience` Bounded Context.
// Re-exports pure Domain Entities, Value Objects, and Domain Services while
// providing LocalStorage and HTTP Repository adapters for UI components.

import {
  GetExperienceJournalUseCase,
  LogExpeditionUseCase,
  RemoveExpeditionUseCase,
  ResetExperienceJournalUseCase,
  type ExperienceJournalProjection,
} from '../application/experience/ExperienceJournalUseCases.ts';
import {
  getDefaultJournalEntries,
  type ExperienceLogEntry,
  type JournalEntryDraftInput,
} from '../domain/experience/ExperienceEntry.ts';
import type { ExperienceJournalRepository } from '../domain/experience/ExperienceJournalRepository.ts';

export * from '../domain/experience/ExperienceEntry.ts';
export * from '../domain/experience/ExperienceAnalyticsService.ts';
export * from '../domain/experience/GpxTrackParser.ts';
export type { ExperienceJournalRepository } from '../domain/experience/ExperienceJournalRepository.ts';
export {
  GetExperienceJournalUseCase,
  LogExpeditionUseCase,
  RemoveExpeditionUseCase,
  ResetExperienceJournalUseCase,
  buildExperienceJournalProjection,
  type ExperienceJournalProjection,
} from '../application/experience/ExperienceJournalUseCases.ts';

const STORAGE_PREFIX = 'rca-experience-journal-v1:';
export const EXPERIENCE_JOURNAL_UPDATED_EVENT = 'rca-experience-journal-updated';

function getStorageKey(userId?: string | null): string {
  return `${STORAGE_PREFIX}${userId ? userId : 'guest'}`;
}

export function notifyExperienceJournalUpdated(userId?: string | null): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(EXPERIENCE_JOURNAL_UPDATED_EVENT, {
      detail: { userId: userId ?? null },
    })
  );
}

export function readStoredExperienceJournal(
  userId?: string | null,
  preferredRegionName?: string
): ExperienceLogEntry[] {
  if (typeof window === 'undefined') {
    return getDefaultJournalEntries(preferredRegionName);
  }
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) {
      return getDefaultJournalEntries(preferredRegionName);
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return getDefaultJournalEntries(preferredRegionName);
    }
    const valid = parsed.filter(
      (item): item is ExperienceLogEntry =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as ExperienceLogEntry).id === 'string' &&
        typeof (item as ExperienceLogEntry).date === 'string' &&
        typeof (item as ExperienceLogEntry).regionId === 'string' &&
        typeof (item as ExperienceLogEntry).complexity === 'string' &&
        typeof (item as ExperienceLogEntry).participantsCount === 'number'
    );
    return valid.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return getDefaultJournalEntries(preferredRegionName);
  }
}

export function writeStoredExperienceJournal(
  userId: string | null | undefined,
  entries: readonly ExperienceLogEntry[]
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(entries));
    notifyExperienceJournalUpdated(userId);
  } catch {
    // ignore storage quota errors gracefully
  }
}

/**
 * Client-side LocalStorage adapter implementing the Domain `ExperienceJournalRepository` port.
 * Used seamlessly for guest exploration and as a synchronous cache for authenticated users.
 */
export class LocalStorageExperienceJournalRepository implements ExperienceJournalRepository {
  async listByOwner(ownerId: string): Promise<ExperienceLogEntry[] | null> {
    if (typeof window === 'undefined') return null;
    try {
      const key = `${STORAGE_PREFIX}${ownerId || 'guest'}`;
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return null;
      return (parsed as ExperienceLogEntry[]).sort((a, b) => b.date.localeCompare(a.date));
    } catch {
      return null;
    }
  }

  async saveByOwner(ownerId: string, entries: readonly ExperienceLogEntry[]): Promise<void> {
    writeStoredExperienceJournal(ownerId === 'guest' ? null : ownerId, entries);
  }
}

const localRepo = new LocalStorageExperienceJournalRepository();
const localGetJournal = new GetExperienceJournalUseCase(localRepo);
const localLogExpedition = new LogExpeditionUseCase(localRepo);
const localRemoveExpedition = new RemoveExpeditionUseCase(localRepo);
const localResetJournal = new ResetExperienceJournalUseCase(localRepo);

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch',
      ...(init.headers || {}),
    },
    ...init,
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Ошибка запроса (${res.status}).`);
  }
  return data;
}

/**
 * Facade routing Experience Journal commands & queries through DDD Use Cases
 * (backend API repository when authenticated, LocalStorage repository in guest mode).
 */
export const experienceJournalGateway = {
  async load(userId: string | null, preferredRegionName?: string): Promise<ExperienceLogEntry[]> {
    if (userId) {
      try {
        const data = await requestJson<ExperienceJournalProjection>(
          '/api/account/experience-journal'
        );
        writeStoredExperienceJournal(userId, data.entries);
        return data.entries;
      } catch {
        // Fallback gracefully to local cache if network is offline
      }
    }
    const localProj = await localGetJournal.execute({
      ownerId: userId ?? 'guest',
      preferredRegionName,
    });
    return localProj.entries;
  },

  async logExpedition(params: {
    userId: string | null;
    preferredRegionName?: string;
    input: JournalEntryDraftInput;
  }): Promise<{ entry: ExperienceLogEntry; entries: ExperienceLogEntry[] }> {
    if (params.userId) {
      try {
        const res = await requestJson<{
          entry: ExperienceLogEntry;
          projection: ExperienceJournalProjection;
        }>('/api/account/experience-journal', {
          method: 'POST',
          body: JSON.stringify(params.input),
        });
        writeStoredExperienceJournal(params.userId, res.projection.entries);
        return { entry: res.entry, entries: res.projection.entries };
      } catch (err) {
        // Re-throw validation errors from backend; fallback only on transport failures
        if (err instanceof Error && !/fetch|network/i.test(err.message)) {
          throw err;
        }
      }
    }

    const localRes = await localLogExpedition.execute({
      ownerId: params.userId ?? 'guest',
      preferredRegionName: params.preferredRegionName,
      input: params.input,
    });
    return { entry: localRes.entry, entries: localRes.projection.entries };
  },

  async removeExpedition(params: {
    userId: string | null;
    entryId: string;
    preferredRegionName?: string;
  }): Promise<ExperienceLogEntry[]> {
    if (params.userId) {
      try {
        const proj = await requestJson<ExperienceJournalProjection>(
          `/api/account/experience-journal/${encodeURIComponent(params.entryId)}`,
          { method: 'DELETE' }
        );
        writeStoredExperienceJournal(params.userId, proj.entries);
        return proj.entries;
      } catch (err) {
        if (err instanceof Error && !/fetch|network/i.test(err.message)) {
          throw err;
        }
      }
    }

    const proj = await localRemoveExpedition.execute({
      ownerId: params.userId ?? 'guest',
      entryId: params.entryId,
      preferredRegionName: params.preferredRegionName,
    });
    return proj.entries;
  },

  async resetDemo(params: {
    userId: string | null;
    preferredRegionName?: string;
  }): Promise<ExperienceLogEntry[]> {
    if (params.userId) {
      try {
        const proj = await requestJson<ExperienceJournalProjection>(
          '/api/account/experience-journal/reset',
          { method: 'POST' }
        );
        writeStoredExperienceJournal(params.userId, proj.entries);
        return proj.entries;
      } catch {
        // fallback to local
      }
    }

    const proj = await localResetJournal.execute({
      ownerId: params.userId ?? 'guest',
      preferredRegionName: params.preferredRegionName,
    });
    return proj.entries;
  },
};
