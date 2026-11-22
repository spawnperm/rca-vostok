import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ASSISTANT_MODEL,
  AssistantServiceError,
  buildRcaSystemInstruction,
  generateRcaAssistantReply,
} from '../src/infrastructure/ai/RcaAssistantService.ts';

test('ASSISTANT_MODEL targets gemini-4-hydrogen and prompt embeds key RCA regulations', () => {
  assert.equal(ASSISTANT_MODEL, 'gemini-4-hydrogen');
  const prompt = buildRcaSystemInstruction({
    region: 'Приморский край',
    progressPercent: 50,
    activeStageTitle: 'Обучение',
  });

  assert.ok(prompt.includes('1893'));
  assert.ok(prompt.includes('760'));
  assert.ok(prompt.includes('Контур А'));
  assert.ok(prompt.includes('Приморский край'));
  assert.ok(prompt.includes('50%'));
});

test('generateRcaAssistantReply rejects empty message arrays with 400 validation error', async () => {
  await assert.rejects(
    () => generateRcaAssistantReply({ messages: [] }),
    (err: unknown) =>
      err instanceof AssistantServiceError && err.statusCode === 400 && err.code === 'VALIDATION_ERROR'
  );
});

test('generateRcaAssistantReply fails loudly without mock answers when GEMINI_API_KEY is missing', async () => {
  const prevKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    await assert.rejects(
      () =>
        generateRcaAssistantReply({
          messages: [{ role: 'user', text: 'Какие документы нужны для аттестации?' }],
        }),
      (err: unknown) =>
        err instanceof AssistantServiceError &&
        err.statusCode === 503 &&
        err.code === 'GEMINI_NOT_CONFIGURED'
    );
  } finally {
    if (prevKey !== undefined) {
      process.env.GEMINI_API_KEY = prevKey;
    }
  }
});
