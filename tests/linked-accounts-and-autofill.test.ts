import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildExamAutofillFromAccounts,
  inferExamDiscipline,
  normalizeManualLinkedAccount,
  normalizeSafeHttpUrl,
} from '../src/domain/identity/LinkedAccounts.ts';
import { ValidationError } from '../src/domain/shared/DomainError.ts';
import { JsonFileLinkedAccountsRepository } from '../src/infrastructure/persistence/JsonFileLinkedAccountsRepository.ts';
import { SocialOAuthService } from '../src/infrastructure/oauth/SocialOAuthProviders.ts';

describe('Linked Social / Google Profiles & Exam Autofill', () => {
  it('validates profile URLs, normalizes Telegram and VK contacts, and blocks unsafe schemes', () => {
    assert.throws(() => normalizeSafeHttpUrl('javascript:alert(1)'), ValidationError);
    assert.throws(() => normalizeSafeHttpUrl('data:text/html,xss'), ValidationError);
    assert.equal(normalizeSafeHttpUrl('vk.com/guide_dv'), 'https://vk.com/guide_dv');

    const tg = normalizeManualLinkedAccount(
      {
        provider: 'telegram',
        contactChannel: '@kamchatka_guide',
        region: 'Камчатский край',
        preferredTrack: 'Горный туризм',
        experienceSummary: '3 КС, вулканы Камчатки',
      },
      {
        fullName: 'Татьяна Смирнова',
        email: 'tatyana@example.ru',
        region: 'Приморский край',
        organisation: 'Клуб ДВ',
      }
    );

    assert.equal(tg.provider, 'telegram');
    assert.equal(tg.connectionMethod, 'profile_link');
    assert.equal(tg.contactChannel, '@kamchatka_guide');
    assert.equal(tg.profileUrl, 'https://t.me/kamchatka_guide');
    assert.equal(tg.region, 'Камчатский край');
    assert.equal(tg.useForExamAutofill, true);
  });

  it('infers canonical exam discipline and builds autofill payload from active linked account', () => {
    assert.equal(inferExamDiscipline('Водный туризм', 'сплавы 3 КС'), 'водный');
    assert.equal(inferExamDiscipline('Пешеходный + горный', 'восхождения'), 'горный');
    assert.equal(inferExamDiscipline('Спелео', 'пещеры Приморья'), 'спелеологический');

    const vk = normalizeManualLinkedAccount(
      {
        provider: 'vk',
        profileUrl: 'https://vk.com/id777888',
        displayName: 'Иван Петров',
        region: 'Хабаровский край',
        organisation: 'Турклуб Амур',
        preferredTrack: 'Водный туризм',
        experienceSummary: 'Сплав по Анюй 2 КС',
        useForExamAutofill: true,
      },
      {
        fullName: 'Иван',
        email: 'ivan@example.ru',
        region: 'Приморский край',
        organisation: '',
      }
    );

    const payload = buildExamAutofillFromAccounts(
      {
        fullName: 'Иван',
        email: 'ivan@example.ru',
        region: 'Приморский край',
        organisation: '',
      },
      [vk]
    );

    assert.ok(payload);
    assert.equal(payload.sourceProvider, 'vk');
    assert.equal(payload.fullName, 'Иван Петров');
    assert.equal(payload.region, 'Хабаровский край');
    assert.equal(payload.preferredDiscipline, 'водный');
    assert.equal(payload.contactChannel, 'vk.com/id777888');
    assert.ok(payload.experienceNote.includes('Турклуб Амур'));
    assert.ok(payload.experienceNote.includes('https://vk.com/id777888'));
  });

  it('persists multiple linked accounts per user, switches active autofill source, and promotes fallback on unlink', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-linked-test-'));
    try {
      const repo = new JsonFileLinkedAccountsRepository(tmpDir);
      const fallback = {
        fullName: 'Мария Соколова',
        email: 'maria@example.ru',
        region: 'Приморский край',
        organisation: 'ВВГУ',
      };

      const tg = normalizeManualLinkedAccount(
        { provider: 'telegram', contactChannel: '@msokolova', useForExamAutofill: true },
        fallback
      );
      await repo.upsert('usr-1', tg);

      const google = normalizeManualLinkedAccount(
        {
          provider: 'google',
          email: 'maria.sokolova@gmail.com',
          displayName: 'Мария Соколова',
          useForExamAutofill: true,
        },
        fallback
      );
      const afterSecond = await repo.upsert('usr-1', google);
      assert.equal(afterSecond.length, 2);
      assert.equal(afterSecond.find((a) => a.provider === 'google')?.useForExamAutofill, true);
      assert.equal(afterSecond.find((a) => a.provider === 'telegram')?.useForExamAutofill, false);

      const switched = await repo.setAutofillSource('usr-1', 'telegram');
      assert.equal(switched.find((a) => a.provider === 'telegram')?.useForExamAutofill, true);
      assert.equal(switched.find((a) => a.provider === 'google')?.useForExamAutofill, false);

      const afterUnlink = await repo.unlink('usr-1', 'telegram');
      assert.equal(afterUnlink.length, 1);
      assert.equal(afterUnlink[0].provider, 'google');
      assert.equal(afterUnlink[0].useForExamAutofill, true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('builds real OAuth URL with state and callback URI when credentials exist, and fails cleanly when absent', () => {
    const prevId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const prevSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    try {
      delete process.env.GOOGLE_OAUTH_CLIENT_ID;
      delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;

      const oauth = new SocialOAuthService();
      assert.throws(
        () =>
          oauth.createAuthorizationUrl({
            provider: 'google',
            userId: 'usr-9',
            baseUrl: 'https://example.run.app',
          }),
        ValidationError
      );

      process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret';

      const urlStr = oauth.createAuthorizationUrl({
        provider: 'google',
        userId: 'usr-9',
        baseUrl: 'https://example.run.app/',
      });
      const parsed = new URL(urlStr);
      assert.equal(parsed.origin, 'https://accounts.google.com');
      assert.equal(
        parsed.searchParams.get('redirect_uri'),
        'https://example.run.app/api/account/oauth/google/callback'
      );
      const state = parsed.searchParams.get('state') || '';
      assert.ok(state.length >= 32);

      const consumed = oauth.consumeState(state, 'google');
      assert.equal(consumed.userId, 'usr-9');
      // State is single-use
      assert.throws(() => oauth.consumeState(state, 'google'), ValidationError);
    } finally {
      if (prevId !== undefined) process.env.GOOGLE_OAUTH_CLIENT_ID = prevId;
      else delete process.env.GOOGLE_OAUTH_CLIENT_ID;
      if (prevSecret !== undefined) process.env.GOOGLE_OAUTH_CLIENT_SECRET = prevSecret;
      else delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    }
  });
});
