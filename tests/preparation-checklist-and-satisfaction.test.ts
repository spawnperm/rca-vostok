import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildPreparationChecklistData,
  inferInitialComplexityFromInquiries,
} from '../src/utils/preparationChecklistPdf.ts';
import {
  SATISFACTION_CATEGORIES,
  SATISFACTION_CLARITY_OPTIONS,
  SATISFACTION_MODULES,
  SATISFACTION_PROGRAMS,
  computePersonalSatisfactionAvg,
  getSatisfactionVerdictLabel,
} from '../src/utils/courseSatisfactionSurvey.ts';
import { JsonFileSatisfactionSurveyRepository } from '../src/infrastructure/persistence/JsonFileSatisfactionSurveyRepository.ts';
import type { SessionUser } from '../src/utils/identityApi.ts';

const MOCK_USER: SessionUser = {
  id: 'usr-test-1',
  email: 'guide@vostok.ru',
  fullName: 'Сергей Белозёров',
  role: 'candidate',
  region: 'Сахалинская область',
  organisation: 'Турклуб «Остров»',
  permissions: ['profile:view_own', 'inquiries:view_own'],
  isActive: true,
  createdAt: '2026-09-01T10:00:00Z',
  lastLoginAt: null,
};

test('buildPreparationChecklistData scales checklist items dynamically with hike complexity category and contour', () => {
  const level1ContourB = buildPreparationChecklistData({
    user: MOCK_USER,
    complexityId: '1_ks',
    discipline: 'Пешеходный и горный туризм',
    contour: 'contour_b',
  });

  const level4ContourA = buildPreparationChecklistData({
    user: MOCK_USER,
    complexityId: '4_plus_ks',
    discipline: 'Водный туризм и сплавы',
    contour: 'contour_a',
    checkedItemIds: ['doc_passport_snils', 'doc_medical', 'gear_sat_tracker_3ks'],
  });

  assert.equal(level1ContourB.complexity.codeLabel, '1 КС');
  assert.equal(level4ContourA.complexity.codeLabel, '4+ КС');
  assert.ok(
    level4ContourA.totalItems > level1ContourB.totalItems,
    '4+ КС must include significantly more checklist requirements than 1 КС'
  );

  // Contour B includes DPO item; Contour A includes experience proof instead
  const level1Ids = new Set(level1ContourB.sections.flatMap((s) => s.items.map((i) => i.id)));
  const level4Ids = new Set(level4ContourA.sections.flatMap((s) => s.items.map((i) => i.id)));
  assert.ok(level1Ids.has('doc_contour_b_dpo'));
  assert.ok(!level1Ids.has('doc_contour_a_exp'));
  assert.ok(level4Ids.has('doc_contour_a_exp'));
  assert.ok(level4Ids.has('fld_water_throw'));
  assert.ok(level4Ids.has('gear_expedition_reserve_4ks'));

  assert.equal(level4ContourA.checkedItems, 3);
  assert.ok(level4ContourA.readinessPercent > 0);
});

test('inferInitialComplexityFromInquiries detects complexity from inquiry text', () => {
  assert.equal(
    inferInitialComplexityFromInquiries([
      {
        id: 'inq-1',
        fullName: 'Test',
        email: 'a@b.ru',
        contactChannel: '+7 999 000 00 00',
        region: 'Приморский край',
        track: 'Водный туризм · 3 КС',
        experienceNote: 'Подготовка к 3 КС',
        consentAccepted: true,
        sessionDate: '2026-11-20',
        userId: 'usr-test-1',
        status: 'new',
        createdAt: '2026-10-01T00:00:00Z',
      },
    ]),
    '3_ks'
  );
  assert.equal(inferInitialComplexityFromInquiries([]), '2_ks');
});

test('JsonFileSatisfactionSurveyRepository validates, persists, and aggregates course satisfaction ratings', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-sat-test-'));
  try {
    const repo = new JsonFileSatisfactionSurveyRepository(tmpDir);
    assert.equal(repo.getStats().totalResponses, 0);

    const first = repo.submit({
      courseProgram: SATISFACTION_PROGRAMS[0],
      complexityCategory: SATISFACTION_CATEGORIES[1],
      preparationQuality: 5,
      materialsQuality: 4,
      practiceUtility: 5,
      materialsClarity: SATISFACTION_CLARITY_OPTIONS[0],
      npsRecommend: 9,
      mostUsefulModule: SATISFACTION_MODULES[0],
      respondentName: 'Дмитрий К.',
      improvementSuggestion: 'Добавить больше видеоразборов переправ.',
    });

    assert.equal(first.record.overallScore, 4.7);
    assert.equal(first.stats.totalResponses, 1);
    assert.equal(first.stats.avgPreparationQuality, 5);
    assert.equal(first.stats.avgMaterialsQuality, 4);
    assert.equal(first.stats.recommendSharePct, 100);

    const avg = computePersonalSatisfactionAvg(5, 4, 5);
    assert.equal(avg, 4.7);
    assert.match(getSatisfactionVerdictLabel(avg), /Высокая удовлетворённость/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
