import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  ALL_FAQ_SCENARIOS,
  matchFaqScenarioReply,
  retrieveSectionRagContext,
} from '../src/utils/rcaRagEngine.ts';
import { buildRcaSystemInstruction } from '../src/infrastructure/ai/RcaAssistantService.ts';

test('retrieveSectionRagContext prioritizes current section knowledge chunk and returns digest', () => {
  const calcRag = retrieveSectionRagContext('субсидия и прогноз 2030', 'calculator', 4);
  assert.equal(calcRag.section.tab, 'calculator');
  assert.ok(calcRag.chunks.some((c) => c.id === 'section-calculator'));
  assert.ok(calcRag.promptDigest.length >= 1);

  const analyticsRag = retrieveSectionRagContext('реестр действующих проводников', 'analytics', 4);
  assert.equal(analyticsRag.section.tab, 'analytics');
  assert.ok(analyticsRag.chunks.some((c) => c.id === 'section-analytics'));
});

test('matchFaqScenarioReply responds immediately for predefined scenario IDs and free-text FAQ queries', () => {
  const firstScenario = ALL_FAQ_SCENARIOS[0];
  assert.ok(firstScenario);

  const exactReply = matchFaqScenarioReply(firstScenario.id, 'certification');
  assert.ok(exactReply.matchedFaq);
  assert.ok(exactReply.answer.length > 20);
  assert.ok(exactReply.relatedScenarios.length > 0);
  assert.ok(exactReply.ragChunks.length > 0);

  const keywordReply = matchFaqScenarioReply('Как зачесть опыт Контур А без ДПО?', 'dissertation');
  assert.ok(keywordReply.matchedFaq);
  assert.match(keywordReply.answer, /Контур А|опыт/i);
});

test('buildRcaSystemInstruction injects section-specific RAG context into prompt', () => {
  const instruction = buildRcaSystemInstruction(
    {
      activeTab: 'calculator',
      sectionName: 'Калькулятор потребности',
      sectionDescription: 'Модель расчёта дефицита инструкторов до 2030 года',
      ragPassages: ['[Раздел «Калькулятор»] Субсидия до 70% от стоимости обучения ДПО ВВГУ.'],
    },
    'Как работает субсидия?'
  );

  assert.ok(instruction.includes('Контекст текущего раздела сайта (RAG)'));
  assert.ok(instruction.includes('Калькулятор потребности'));
  assert.ok(instruction.includes('Субсидия до 70%'));
});
