import crypto from 'node:crypto';
import express from 'express';
import { ValidationError } from '../../domain/shared/DomainError.ts';
import { PERMISSIONS } from '../../domain/identity/Rbac.ts';
import {
  buildExamAutofillFromAccounts,
  isLinkedProvider,
  isOAuthProvider,
  LINKED_PROVIDER_META,
  normalizeManualLinkedAccount,
  type LinkedAccountsRepository,
} from '../../domain/identity/LinkedAccounts.ts';
import type { UserRepository } from '../../domain/identity/IdentityRepositories.ts';
import type { SocialRepository } from '../../domain/social/SocialRepository.ts';
import { requireAuth, requirePermission } from './AuthMiddleware.ts';
import { sendDomainError } from './ErrorHandler.ts';
import type { SocialOAuthService } from '../oauth/SocialOAuthProviders.ts';
import { appLogger } from '../logging/Logger.ts';

export interface LinkedAccountsRouterDeps {
  linkedAccountsRepo: LinkedAccountsRepository;
  userRepo: UserRepository;
  oauthService: SocialOAuthService;
  getBaseUrl: (req: express.Request) => string;
  socialRepo?: SocialRepository | null;
}

const log = appLogger.child('linked-accounts');

function sendError(err: unknown, res: express.Response): void {
  sendDomainError(err, res, log, 'Unhandled linked-accounts error');
}

function resolveTargetOrigin(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return '';
  }
}

function sendOAuthCallbackHtml(
  res: express.Response,
  payload: Record<string, unknown>,
  heading: string,
  description: string,
  targetOrigin: string
): void {
  const nonce = crypto.randomBytes(16).toString('base64');
  const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
  const safeOriginJson = JSON.stringify(targetOrigin).replace(/</g, '\\u003c');
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  res.setHeader(
    'Content-Security-Policy',
    `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'`
  );
  res.status(200).type('html').send(`<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading)}</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; padding: 32px; display: flex; align-items: center; justify-content: center; min-height: 80vh; margin: 0; }
      .card { max-width: 420px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 24px; text-align: center; }
      h1 { font-size: 18px; margin: 0 0 8px; }
      p { font-size: 14px; color: #475569; margin: 0; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${escapeHtml(heading)}</h1>
      <p>${escapeHtml(description)}</p>
    </div>
    <script nonce="${nonce}">
      (function () {
        var data = ${safeJson};
        var targetOrigin = ${safeOriginJson} || window.location.origin;
        if (window.opener && targetOrigin) {
          window.opener.postMessage(data, targetOrigin);
          window.close();
        } else {
          window.location.href = '/?tab=account';
        }
      })();
    </script>
  </body>
</html>`);
}

export function createLinkedAccountsRouter(deps: LinkedAccountsRouterDeps): express.Router {
  const router = express.Router();

  // CSRF guard for cookie-authenticated mutations
  router.use('/api/account/linked-accounts', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      next();
      return;
    }
    const requestedWith = req.get('x-requested-with');
    if (requestedWith) {
      next();
      return;
    }
    const origin = req.get('origin');
    const host = req.get('x-forwarded-host') || req.get('host');
    if (origin && host) {
      try {
        if (new URL(origin).host === host) {
          next();
          return;
        }
      } catch {
        // reject malformed origin below
      }
    }
    res.status(403).json({
      error: 'Запрос отклонён проверкой безопасности источника.',
      code: 'CSRF_ORIGIN_MISMATCH',
    });
  });

  // Read linked profiles + OAuth status + derived exam autofill payload
  router.get(
    '/api/account/linked-accounts',
    requireAuth(),
    requirePermission(PERMISSIONS.VIEW_OWN_PROFILE),
    async (req, res) => {
      try {
        const user = req.authUser!;
        const accounts = await deps.linkedAccountsRepo.findByUserId(user.id);
        const autofill = buildExamAutofillFromAccounts(
          {
            fullName: user.fullName.value,
            email: user.email.value,
            region: user.region,
            organisation: user.organisation,
          },
          accounts
        );
        const providers = deps.oauthService.listProviderStatuses(deps.getBaseUrl(req));
        res.json({ accounts, autofill, providers });
      } catch (err) {
        sendError(err, res);
      }
    }
  );

  // Build real popup OAuth 2.0 URL
  router.get(
    '/api/account/oauth/:provider/url',
    requireAuth(),
    requirePermission(PERMISSIONS.EDIT_OWN_PROFILE),
    async (req, res) => {
      try {
        const provider = req.params.provider;
        if (!isOAuthProvider(provider)) {
          throw new ValidationError('Указанный провайдер не поддерживает OAuth 2.0.');
        }
        const url = deps.oauthService.createAuthorizationUrl({
          provider,
          userId: req.authUser!.id,
          baseUrl: deps.getBaseUrl(req),
        });
        res.json({ url, provider });
      } catch (err) {
        sendError(err, res);
      }
    }
  );

  // OAuth callback handler (supports both with and without trailing slash)
  const oauthCallbackHandler: express.RequestHandler = async (req, res) => {
    const targetOrigin = resolveTargetOrigin(deps.getBaseUrl(req));
    const rawProvider = req.params.provider;
    if (!isOAuthProvider(rawProvider)) {
      sendOAuthCallbackHtml(
        res,
        { type: 'OAUTH_AUTH_ERROR', error: 'Неизвестный провайдер.' },
        'Ошибка подключения',
        'Указанный провайдер не поддерживается.',
        targetOrigin
      );
      return;
    }

    const oauthError = typeof req.query.error === 'string' ? req.query.error : '';
    if (oauthError) {
      sendOAuthCallbackHtml(
        res,
        {
          type: 'OAUTH_AUTH_ERROR',
          provider: rawProvider,
          error: 'Доступ отклонён пользователем.',
        },
        'Подключение отменено',
        'Вы можете закрыть это окно и повторить попытку в личном кабинете.',
        targetOrigin
      );
      return;
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';

    if (!code || !state) {
      sendOAuthCallbackHtml(
        res,
        {
          type: 'OAUTH_AUTH_ERROR',
          provider: rawProvider,
          error: 'Отсутствуют параметры авторизации.',
        },
        'Ошибка авторизации',
        'Параметры подтверждения не получены.',
        targetOrigin
      );
      return;
    }

    try {
      const pending = deps.oauthService.consumeState(state, rawProvider);
      const user = await deps.userRepo.findById(pending.userId);
      if (!user || !user.isActive) {
        throw new ValidationError('Учётная запись пользователя не найдена.');
      }

      const existing = (await deps.linkedAccountsRepo.findByUserId(user.id)).find(
        (a) => a.provider === rawProvider
      );

      const account = await deps.oauthService.exchangeCodeAndBuildAccount({
        provider: rawProvider,
        code,
        redirectUri: pending.redirectUri,
        fallbackUser: {
          fullName: user.fullName.value,
          email: user.email.value,
          region: user.region,
          organisation: user.organisation,
        },
        existingLinkedAt: existing?.linkedAt,
      });

      await deps.linkedAccountsRepo.upsert(user.id, account);

      sendOAuthCallbackHtml(
        res,
        { type: 'OAUTH_AUTH_SUCCESS', provider: rawProvider },
        `${LINKED_PROVIDER_META[rawProvider].label} подключён`,
        'Данные синхронизированы для автозаполнения очных экзаменов. Окно закроется автоматически.',
        targetOrigin
      );
    } catch (err) {
      const message =
        err instanceof ValidationError
          ? err.message
          : 'Не удалось завершить привязку аккаунта.';
      sendOAuthCallbackHtml(
        res,
        { type: 'OAUTH_AUTH_ERROR', provider: rawProvider, error: message },
        'Ошибка привязки профиля',
        message,
        targetOrigin
      );
    }
  };

  router.get(
    ['/api/account/oauth/:provider/callback', '/api/account/oauth/:provider/callback/'],
    oauthCallbackHandler
  );

  // Sync built-in RCA Social Profile (and cabinet data fallback when DB is file-backed)
  router.post(
    '/api/account/linked-accounts/sync-internal',
    requireAuth(),
    requirePermission(PERMISSIONS.EDIT_OWN_PROFILE),
    async (req, res) => {
      try {
        const user = req.authUser!;
        const body = (req.body || {}) as Record<string, unknown>;
        const existingList = await deps.linkedAccountsRepo.findByUserId(user.id);
        const existing = existingList.find((a) => a.provider === 'rca_social');

        let displayName = user.fullName.value;
        let region = user.region;
        let organisation = user.organisation;
        let websiteUrl = '';
        let skillsText = '';
        let headline = '';

        if (deps.socialRepo) {
          const profile = await deps.socialRepo.findProfile(user.id);
          if (profile) {
            displayName = profile.displayName || displayName;
            region = profile.region || region;
            organisation = profile.organisation || organisation;
            websiteUrl = profile.websiteUrl || '';
            skillsText = profile.skills.join(', ');
            headline = profile.headline || '';
          }
        }

        const customTrack =
          typeof body.preferredTrack === 'string' && body.preferredTrack.trim()
            ? body.preferredTrack.trim()
            : skillsText || headline || '';

        const summaryParts = [headline, skillsText ? `Навыки: ${skillsText}` : ''].filter(
          Boolean
        );

        const account = normalizeManualLinkedAccount(
          {
            provider: 'rca_social',
            externalId: user.id,
            displayName,
            email: user.email.value,
            contactChannel:
              typeof body.contactChannel === 'string' && body.contactChannel.trim()
                ? body.contactChannel
                : user.email.value,
            region,
            organisation,
            profileUrl: websiteUrl,
            preferredTrack: customTrack,
            experienceSummary:
              typeof body.experienceSummary === 'string' && body.experienceSummary.trim()
                ? body.experienceSummary
                : summaryParts.join(' · '),
            useForExamAutofill: true,
          },
          {
            fullName: user.fullName.value,
            email: user.email.value,
            region: user.region,
            organisation: user.organisation,
          },
          existing?.linkedAt
        );

        const accounts = await deps.linkedAccountsRepo.upsert(user.id, account);
        const autofill = buildExamAutofillFromAccounts(
          {
            fullName: user.fullName.value,
            email: user.email.value,
            region: user.region,
            organisation: user.organisation,
          },
          accounts
        );
        res.status(200).json({ accounts, autofill });
      } catch (err) {
        sendError(err, res);
      }
    }
  );

  // Manually link or update a social profile handle/URL / Google email for exam autofill
  router.post(
    '/api/account/linked-accounts',
    requireAuth(),
    requirePermission(PERMISSIONS.EDIT_OWN_PROFILE),
    async (req, res) => {
      try {
        const user = req.authUser!;
        const body = (req.body || {}) as Record<string, unknown>;
        if (!isLinkedProvider(body.provider)) {
          throw new ValidationError('Укажите поддерживаемый сервис для привязки профиля.');
        }

        const existingList = await deps.linkedAccountsRepo.findByUserId(user.id);
        const existing = existingList.find((a) => a.provider === body.provider);

        const account = normalizeManualLinkedAccount(
          {
            provider: body.provider,
            externalId: body.externalId,
            displayName: body.displayName,
            email: body.email,
            contactChannel: body.contactChannel,
            region: body.region,
            organisation: body.organisation,
            profileUrl: body.profileUrl,
            preferredTrack: body.preferredTrack,
            experienceSummary: body.experienceSummary,
            useForExamAutofill: body.useForExamAutofill,
          },
          {
            fullName: user.fullName.value,
            email: user.email.value,
            region: user.region,
            organisation: user.organisation,
          },
          existing?.linkedAt
        );

        const accounts = await deps.linkedAccountsRepo.upsert(user.id, account);
        const autofill = buildExamAutofillFromAccounts(
          {
            fullName: user.fullName.value,
            email: user.email.value,
            region: user.region,
            organisation: user.organisation,
          },
          accounts
        );
        res.status(201).json({ accounts, autofill });
      } catch (err) {
        sendError(err, res);
      }
    }
  );

  // Switch active autofill source
  router.patch(
    '/api/account/linked-accounts/:provider/autofill',
    requireAuth(),
    requirePermission(PERMISSIONS.EDIT_OWN_PROFILE),
    async (req, res) => {
      try {
        const user = req.authUser!;
        const provider = req.params.provider;
        if (!isLinkedProvider(provider)) {
          throw new ValidationError('Указан неизвестный профиль.');
        }
        const body = (req.body || {}) as Record<string, unknown>;
        const enabled = body.enabled !== false;

        const existingList = await deps.linkedAccountsRepo.findByUserId(user.id);
        if (!existingList.some((a) => a.provider === provider)) {
          throw new ValidationError('Сначала свяжите указанный профиль с личным кабинетом.');
        }

        const accounts = await deps.linkedAccountsRepo.setAutofillSource(
          user.id,
          enabled ? provider : null
        );
        const autofill = buildExamAutofillFromAccounts(
          {
            fullName: user.fullName.value,
            email: user.email.value,
            region: user.region,
            organisation: user.organisation,
          },
          accounts
        );
        res.json({ accounts, autofill });
      } catch (err) {
        sendError(err, res);
      }
    }
  );

  // Unlink a connected profile
  router.delete(
    '/api/account/linked-accounts/:provider',
    requireAuth(),
    requirePermission(PERMISSIONS.EDIT_OWN_PROFILE),
    async (req, res) => {
      try {
        const user = req.authUser!;
        const provider = req.params.provider;
        if (!isLinkedProvider(provider)) {
          throw new ValidationError('Указан неизвестный профиль.');
        }

        const accounts = await deps.linkedAccountsRepo.unlink(user.id, provider);
        const autofill = buildExamAutofillFromAccounts(
          {
            fullName: user.fullName.value,
            email: user.email.value,
            region: user.region,
            organisation: user.organisation,
          },
          accounts
        );
        res.json({ accounts, autofill });
      } catch (err) {
        sendError(err, res);
      }
    }
  );

  return router;
}
