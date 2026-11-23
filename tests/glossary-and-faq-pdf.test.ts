import assert from 'node:assert/strict';
import test from 'node:test';
import { GLOSSARY_TERMS } from '../src/data/researchData.ts';
import { ENRICHED_ATTESTATION_FAQ } from '../src/utils/accountKnowledgeBase.ts';
import { buildFaqExportPayload } from '../src/utils/faqPdfExport.ts';

test('GLOSSARY_TERMS includes core regulatory definitions for attestation', () => {
  const ids = new Set(GLOSSARY_TERMS.map((t) => t.id));
  assert.ok(ids.has('term-fz-132'));
  assert.ok(ids.has('term-pp-1003-1893'));
  assert.ok(ids.has('term-pp-760'));
  assert.ok(ids.has('term-mkk'));
  assert.ok(ids.has('term-rca'));
  assert.ok(GLOSSARY_TERMS.length >= 15);
});

test('GLOSSARY_TERMS regulatory filtering matches query by statute number and category', () => {
  const query = '1003';
  const matched = GLOSSARY_TERMS.filter((item) => {
    const haystack = `${item.term} ${item.shortTag} ${item.categoryLabel} ${item.definition} ${item.contextNote}`.toLowerCase();
    return haystack.includes(query);
  });
  assert.ok(matched.length >= 2);
  assert.ok(matched.some((item) => item.id === 'term-pp-1003-1893'));
});

test('buildFaqExportPayload packages all FAQ answers for PDF print export', () => {
  const payload = buildFaqExportPayload(
    ENRICHED_ATTESTATION_FAQ,
    'Полный справочник соискателя (FAQ)',
    new Date('2026-11-23T10:00:00Z')
  );

  assert.equal(payload.docNumber, 'РЦА-2026/FAQ-1123');
  assert.equal(payload.totalQuestions, ENRICHED_ATTESTATION_FAQ.length);
  assert.ok(payload.totalQuestions >= 15);
  assert.ok(payload.items.every((item) => item.question.length > 5 && item.answer.length > 20));
});
