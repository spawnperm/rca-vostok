import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPERT_PROFILES,
  filterExpertProfiles,
  getExpertCounts,
} from '../src/utils/expertProfiles.ts';
import {
  ENRICHED_ATTESTATION_FAQ,
  METHODOLOGICAL_MATERIALS,
  getMaterialById,
  searchAccountKnowledgeBase,
} from '../src/utils/accountKnowledgeBase.ts';

test('getExpertCounts reports accurate commission and speaker totals', () => {
  const counts = getExpertCounts();
  assert.equal(counts.all, EXPERT_PROFILES.length);
  assert.equal(counts.all, 5);
  assert.equal(counts.commission, 4);
  assert.equal(counts.speaker, 5);
});

test('filterExpertProfiles filters by role kind and Russian search query', () => {
  const commissionOnly = filterExpertProfiles('commission');
  assert.equal(commissionOnly.length, 4);
  assert.ok(!commissionOnly.some((e) => e.name === 'Андрей Колесников'));

  const waterResults = filterExpertProfiles('all', 'сплавы');
  assert.ok(waterResults.some((e) => e.name === 'Дмитрий Верещагин'));

  const wfaResults = filterExpertProfiles('speaker', 'Garmin');
  assert.equal(wfaResults.length, 1);
  assert.equal(wfaResults[0].name, 'Елена Морозова');
});

test('searchAccountKnowledgeBase integrates FAQ and methodological materials in one query', () => {
  const res = searchAccountKnowledgeBase({ query: 'Контур А', scope: 'all' });
  assert.ok(res.faqItems.length >= 2, 'Should match Contour A FAQ entries');
  assert.ok(
    res.materials.some((m) => m.id === 'method-contour-a'),
    'Should match methodological guide for Contour A'
  );
  assert.ok(
    res.glossaryItems.some((g) => g.id === 'term-two-contour'),
    'Should match glossary term for two-contour model'
  );
  assert.equal(
    res.totalCount,
    res.faqItems.length + res.materials.length + res.glossaryItems.length
  );
});

test('searchAccountKnowledgeBase respects scope filtering and faq categories', () => {
  const materialsOnly = searchAccountKnowledgeBase({
    query: '760',
    scope: 'materials',
  });
  assert.equal(materialsOnly.faqItems.length, 0);
  assert.equal(materialsOnly.glossaryItems.length, 0);
  assert.equal(materialsOnly.materials.length, 1);
  assert.equal(materialsOnly.materials[0].id, 'method-route-passport');

  const trainingFaqOnly = searchAccountKnowledgeBase({
    query: '',
    scope: 'faq',
    faqCategory: 'training',
  });
  assert.ok(trainingFaqOnly.faqItems.length > 0);
  assert.ok(trainingFaqOnly.faqItems.every((item) => item.category === 'training'));
  assert.equal(trainingFaqOnly.materials.length, 0);
});

test('every FAQ item and methodological material cross-references existing entities', () => {
  for (const faq of ENRICHED_ATTESTATION_FAQ) {
    assert.ok(faq.quickHighlight.length > 0, `Missing quickHighlight on ${faq.id}`);
    for (const matId of faq.relatedMaterialIds) {
      assert.ok(
        getMaterialById(matId),
        `FAQ ${faq.id} references unknown material ${matId}`
      );
    }
  }

  for (const mat of METHODOLOGICAL_MATERIALS) {
    assert.ok(mat.keyPoints.length >= 2, `Material ${mat.id} should include keyPoints`);
    for (const faqId of mat.relatedFaqIds) {
      assert.ok(
        ENRICHED_ATTESTATION_FAQ.some((f) => f.id === faqId),
        `Material ${mat.id} references unknown FAQ ${faqId}`
      );
    }
  }
});

test('searchAccountKnowledgeBase handles unmatched queries gracefully', () => {
  const empty = searchAccountKnowledgeBase({
    query: 'несуществующийзапрос12345',
    scope: 'all',
  });
  assert.equal(empty.totalCount, 0);
  assert.equal(empty.faqItems.length, 0);
  assert.equal(empty.materials.length, 0);
  assert.equal(empty.glossaryItems.length, 0);
});
