import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import {
  GetExperienceJournalUseCase,
  LogExpeditionUseCase,
  RemoveExpeditionUseCase,
  ResetExperienceJournalUseCase,
} from '../src/application/experience/ExperienceJournalUseCases.ts';
import {
  ExperienceEntry,
  type ExperienceLogEntry,
} from '../src/domain/experience/ExperienceEntry.ts';
import { NotFoundError, ValidationError, type DomainEvent } from '../src/domain/shared/DomainError.ts';
import { InMemoryDomainEventBus } from '../src/infrastructure/events/InMemoryDomainEventBus.ts';
import { JsonFileExperienceJournalRepository } from '../src/infrastructure/persistence/JsonFileExperienceJournalRepository.ts';

test('ExperienceEntry entity enforces invariants and generates default route title when omitted', () => {
  assert.throws(
    () =>
      ExperienceEntry.create({
        date: '2026-13-40',
        routeTitle: 'Некорректная дата',
        regionId: 'primorye',
        complexity: '2 КС',
        participantsCount: 8,
      }),
    ValidationError
  );

  assert.throws(
    () =>
      ExperienceEntry.create({
        date: '2026-07-10',
        routeTitle: 'Некорректная группа',
        regionId: 'primorye',
        complexity: '2 КС',
        participantsCount: 0,
      }),
    ValidationError
  );

  assert.throws(
    () =>
      ExperienceEntry.create({
        date: '2026-07-10',
        routeTitle: 'Слишком большая группа',
        regionId: 'primorye',
        complexity: '2 КС',
        participantsCount: 501,
      }),
    ValidationError
  );

  assert.throws(
    () =>
      ExperienceEntry.create({
        date: '2026-07-10',
        routeTitle: 'Неизвестный регион',
        regionId: 'unknown-region' as never,
        complexity: '2 КС',
        participantsCount: 10,
      }),
    ValidationError
  );

  const entity = ExperienceEntry.create({
    date: '2026-08-15',
    routeTitle: '   ',
    regionId: 'kamchatka',
    complexity: '3 КС',
    participantsCount: '12',
    notes: 'МЧС уведомлено',
  });
  const snap = entity.toSnapshot();
  assert.equal(snap.regionId, 'kamchatka');
  assert.equal(snap.regionName, 'Камчатский край');
  assert.equal(snap.participantsCount, 12);
  assert.match(snap.routeTitle, /Маршрут 3 КС · Камчатка/);
});

test('Experience Use Cases execute CRUD flow, publish domain events, and enforce NotFoundError', async () => {
  const store = new Map<string, ExperienceLogEntry[]>();
  const repo = {
    async listByOwner(ownerId: string) {
      return store.get(ownerId) ?? null;
    },
    async saveByOwner(ownerId: string, entries: readonly ExperienceLogEntry[]) {
      store.set(ownerId, [...entries]);
    },
  };

  const eventBus = new InMemoryDomainEventBus();
  const captured: DomainEvent[] = [];
  eventBus.subscribe('*', (ev) => {
    captured.push(ev);
  });

  const getJournal = new GetExperienceJournalUseCase(repo);
  const logExpedition = new LogExpeditionUseCase(repo, eventBus);
  const removeExpedition = new RemoveExpeditionUseCase(repo, eventBus);
  const resetJournal = new ResetExperienceJournalUseCase(repo, eventBus);

  const initial = await getJournal.execute({
    ownerId: 'user-42',
    preferredRegionName: 'Сахалинская область',
  });
  assert.ok(initial.entries.length >= 1);
  assert.equal(initial.metrics.totalTrips, initial.entries.length);

  const logged = await logExpedition.execute({
    ownerId: 'user-42',
    input: {
      date: '2026-10-05',
      routeTitle: 'Мыс Великан — бухта Тихая',
      regionId: 'sakhalin',
      complexity: '4 КС',
      participantsCount: 9,
      notes: 'Штормовое предупреждение',
    },
  });
  assert.equal(logged.projection.entries.length, initial.entries.length + 1);
  assert.equal(captured[0]?.eventName, 'experience.expedition_logged');
  assert.equal(captured[0]?.boundedContext, 'experience');

  await assert.rejects(
    () =>
      removeExpedition.execute({
        ownerId: 'user-42',
        entryId: 'non-existent-id',
      }),
    NotFoundError
  );

  const afterRemove = await removeExpedition.execute({
    ownerId: 'user-42',
    entryId: logged.entry.id,
  });
  assert.equal(afterRemove.entries.length, initial.entries.length);
  assert.equal(captured[1]?.eventName, 'experience.expedition_removed');
  assert.equal(captured[1]?.boundedContext, 'experience');

  const afterReset = await resetJournal.execute({
    ownerId: 'user-42',
    preferredRegionName: 'Приморский край',
  });
  assert.ok(afterReset.entries.length >= 1);
  assert.equal(captured[2]?.eventName, 'experience.journal_reset');
  assert.equal(captured[2]?.boundedContext, 'experience');
});

test('JsonFileExperienceJournalRepository persists and reloads owner journal entries on disk', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-exp-ddd-'));
  try {
    const repo = new JsonFileExperienceJournalRepository(tempDir);
    assert.equal(await repo.listByOwner('guide-1'), null);

    const entry = ExperienceEntry.create({
      date: '2026-09-12',
      routeTitle: 'Хребет Мяо-Чан',
      regionId: 'khabarovsk',
      complexity: '2 КС',
      participantsCount: 11,
      notes: 'Учебный сбор',
    }).toSnapshot();

    await repo.saveByOwner('guide-1', [entry]);

    const repoReloaded = new JsonFileExperienceJournalRepository(tempDir);
    const loaded = await repoReloaded.listByOwner('guide-1');
    assert.ok(Array.isArray(loaded));
    assert.equal(loaded?.length, 1);
    assert.equal(loaded?.[0]?.id, entry.id);
    assert.equal(loaded?.[0]?.routeTitle, 'Хребет Мяо-Чан');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
