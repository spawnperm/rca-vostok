import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import {
  GetGuideLeaderboardUseCase,
  SyncMyGuideLeaderboardUseCase,
} from '../src/application/certification/GetGuideLeaderboardUseCase.ts';
import { JsonFileGuideLeaderboardRepository } from '../src/infrastructure/persistence/JsonFileGuideLeaderboardRepository.ts';
import { ValidationError } from '../src/domain/shared/DomainError.ts';
import { searchAccountKnowledgeBase } from '../src/utils/accountKnowledgeBase.ts';

test('GetGuideLeaderboardUseCase reads seeded database records and ranks by certified routes and experience', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-guides-db-'));
  try {
    const repo = new JsonFileGuideLeaderboardRepository(tmpDir);
    const useCase = new GetGuideLeaderboardUseCase(repo, 'json-file');

    const byRoutes = await useCase.execute({ sortBy: 'routes', limit: 15 });
    assert.equal(byRoutes.sourceAdapter, 'json-file');
    assert.ok(byRoutes.guides.length >= 10);
    assert.equal(byRoutes.guides[0].rank, 1);
    assert.ok(
      byRoutes.guides[0].certifiedRoutesCount >= byRoutes.guides[1].certifiedRoutesCount,
      'Routes sort must order descending by certifiedRoutesCount'
    );
    assert.ok(byRoutes.availableRegions.includes('Приморский край'));
    assert.ok(byRoutes.summary.totalCertifiedRoutes > 150);

    const byExperience = await useCase.execute({ sortBy: 'experience', limit: 15 });
    assert.ok(
      byExperience.guides[0].experienceYears >= byExperience.guides[1].experienceYears,
      'Experience sort must order descending by experienceYears'
    );

    const primoryeOnly = await useCase.execute({ region: 'Приморский край' });
    assert.ok(primoryeOnly.guides.length >= 3);
    assert.ok(primoryeOnly.guides.every((g) => g.region === 'Приморский край'));

    await assert.rejects(
      () => useCase.execute({ track: 'invalid-track' }),
      ValidationError
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('SyncMyGuideLeaderboardUseCase persists user standing into the guide registry database', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-guides-sync-'));
  try {
    const repo = new JsonFileGuideLeaderboardRepository(tmpDir);
    const syncUseCase = new SyncMyGuideLeaderboardUseCase(repo);
    const queryUseCase = new GetGuideLeaderboardUseCase(repo, 'json-file');

    await syncUseCase.execute({
      userId: 'usr-test-42',
      fullName: 'Миронов Тимур Сергеевич',
      region: 'Сахалинская область',
      organisation: 'Островной клуб маршрутов',
      certifiedRoutesCount: 28,
      experienceYears: 18,
      track: 'expedition',
      maxComplexity: '4 КС',
    });

    // Read using a fresh repository instance to verify persistence to disk DB
    const freshRepo = new JsonFileGuideLeaderboardRepository(tmpDir);
    const freshQuery = new GetGuideLeaderboardUseCase(freshRepo, 'json-file');
    const result = await freshQuery.execute({ sortBy: 'routes' });

    assert.equal(result.guides[0].userId, 'usr-test-42');
    assert.equal(result.guides[0].certifiedRoutesCount, 28);
    assert.equal(result.guides[0].experienceYears, 18);
    assert.equal(result.guides[0].rank, 1);

    await assert.rejects(
      () =>
        syncUseCase.execute({
          userId: 'usr-test-42',
          fullName: 'Тест',
          region: 'Приморский край',
          organisation: '',
          certifiedRoutesCount: -5,
          experienceYears: 3,
        }),
      ValidationError
    );
    assert.ok((await queryUseCase.execute()).guides.length >= 15);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('searchAccountKnowledgeBase supports attestation, qualification requirements, and document submission topic groups', () => {
  const att = searchAccountKnowledgeBase({ scope: 'faq', faqTopic: 'attestation' });
  const req = searchAccountKnowledgeBase({ scope: 'faq', faqTopic: 'requirements' });
  const doc = searchAccountKnowledgeBase({ scope: 'faq', faqTopic: 'documents' });

  assert.ok(att.faqItems.length >= 4);
  assert.ok(req.faqItems.length >= 4);
  assert.ok(doc.faqItems.length >= 3);
  assert.ok(req.faqItems.every((f) => f.topicGroup === 'requirements'));
  assert.ok(doc.faqItems.every((f) => f.topicGroup === 'documents'));

  const passportFaq = searchAccountKnowledgeBase({
    scope: 'faq',
    query: 'подача документов',
  });
  assert.ok(passportFaq.faqItems.some((f) => f.id === 'faq-14'));
});
