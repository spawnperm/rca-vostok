import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ASSISTANT_MODEL,
  AssistantServiceError,
  buildRcaSystemInstruction,
  formatGeminiUpstreamError,
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

test('formatGeminiUpstreamError sanitizes raw JSON errors into Russian user messages', () => {
  const overloaded = formatGeminiUpstreamError(
    new Error('{"error":{"code":503,"message":"This model is currently experiencing high demand","status":"UNAVAILABLE"}}')
  );
  assert.equal(overloaded.statusCode, 503);
  assert.equal(overloaded.code, 'GEMINI_OVERLOADED');
  assert.ok(!overloaded.message.includes('{'));

  const quota = formatGeminiUpstreamError(
    new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}')
  );
  assert.equal(quota.statusCode, 429);
  assert.equal(quota.code, 'GEMINI_RATE_LIMITED');

  const keyErr = formatGeminiUpstreamError(
    new Error('{"error":{"code":400,"message":"API_KEY_INVALID","status":"INVALID_ARGUMENT"}}')
  );
  assert.equal(keyErr.statusCode, 502);
  assert.equal(keyErr.code, 'GEMINI_KEY_REJECTED');
});
