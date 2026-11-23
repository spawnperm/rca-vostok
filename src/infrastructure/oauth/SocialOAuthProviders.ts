import crypto from 'node:crypto';
import { ValidationError } from '../../domain/shared/DomainError.ts';
import { SanitizedText } from '../../domain/shared/ValueObjects.ts';
import {
  LINKED_PROVIDER_META,
  OAUTH_PROVIDERS,
  type LinkedAccountDTO,
  type OAuthProviderId,
} from '../../domain/identity/LinkedAccounts.ts';

export interface OAuthProviderStatus {
  id: OAuthProviderId;
  label: string;
  oauthConfigured: boolean;
  callbackUrl: string;
  envHints: [string, string];
}

interface ProviderConfig {
  id: OAuthProviderId;
  clientIdEnv: string;
  clientSecretEnv: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
}

const PROVIDER_CONFIGS: Record<OAuthProviderId, ProviderConfig> = {
  google: {
    id: 'google',
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
  },
  vk: {
    id: 'vk',
    clientIdEnv: 'VK_CLIENT_ID',
    clientSecretEnv: 'VK_CLIENT_SECRET',
    authUrl: 'https://oauth.vk.com/authorize',
    tokenUrl: 'https://oauth.vk.com/access_token',
    scope: 'email',
  },
  yandex: {
    id: 'yandex',
    clientIdEnv: 'YANDEX_CLIENT_ID',
    clientSecretEnv: 'YANDEX_CLIENT_SECRET',
    authUrl: 'https://oauth.yandex.ru/authorize',
    tokenUrl: 'https://oauth.yandex.ru/token',
    scope: 'login:email login:info',
  },
  github: {
    id: 'github',
    clientIdEnv: 'GITHUB_CLIENT_ID',
    clientSecretEnv: 'GITHUB_CLIENT_SECRET',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
  },
};

interface PendingOAuthState {
  userId: string;
  provider: OAuthProviderId;
  redirectUri: string;
  expiresAt: number;
}

const STATE_TTL_MS = 10 * 60 * 1000;

export class SocialOAuthService {
  private readonly pendingStates = new Map<string, PendingOAuthState>();

  private readCredentials(provider: OAuthProviderId): {
    clientId: string;
    clientSecret: string;
  } | null {
    const cfg = PROVIDER_CONFIGS[provider];
    const clientId = (process.env[cfg.clientIdEnv] ?? '').trim();
    const clientSecret = (process.env[cfg.clientSecretEnv] ?? '').trim();
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret };
  }

  getCallbackUrl(provider: OAuthProviderId, baseUrl: string): string {
    const normalizedBase = baseUrl.replace(/\/+$/, '');
    return `${normalizedBase}/api/account/oauth/${provider}/callback`;
  }

  listProviderStatuses(baseUrl: string): OAuthProviderStatus[] {
    return OAUTH_PROVIDERS.map((id) => {
      const cfg = PROVIDER_CONFIGS[id];
      const creds = this.readCredentials(id);
      return {
        id,
        label: LINKED_PROVIDER_META[id].label,
        oauthConfigured: Boolean(creds),
        callbackUrl: this.getCallbackUrl(id, baseUrl),
        envHints: [cfg.clientIdEnv, cfg.clientSecretEnv],
      };
    });
  }

  createAuthorizationUrl(input: {
    provider: OAuthProviderId;
    userId: string;
    baseUrl: string;
  }): string {
    const creds = this.readCredentials(input.provider);
    if (!creds) {
      const cfg = PROVIDER_CONFIGS[input.provider];
      throw new ValidationError(
        `OAuth для «${LINKED_PROVIDER_META[input.provider].label}» не настроен на сервере (добавьте ${cfg.clientIdEnv} и ${cfg.clientSecretEnv} в Secrets) или воспользуйтесь привязкой профиля по ссылке.`,
        'OAUTH_NOT_CONFIGURED'
      );
    }

    this.pruneExpiredStates();

    const state = crypto.randomBytes(24).toString('hex');
    const redirectUri = this.getCallbackUrl(input.provider, input.baseUrl);
    this.pendingStates.set(state, {
      userId: input.userId,
      provider: input.provider,
      redirectUri,
      expiresAt: Date.now() + STATE_TTL_MS,
    });

    const cfg = PROVIDER_CONFIGS[input.provider];
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: cfg.scope,
      state,
    });

    if (input.provider === 'google') {
      params.set('prompt', 'select_account consent');
      params.set('access_type', 'online');
    } else if (input.provider === 'vk') {
      params.set('display', 'popup');
      params.set('v', '5.199');
    }

    return `${cfg.authUrl}?${params.toString()}`;
  }

  consumeState(stateRaw: string, provider: OAuthProviderId): PendingOAuthState {
    this.pruneExpiredStates();
    const record = this.pendingStates.get(stateRaw);
    if (!record) {
      throw new ValidationError(
        'Сессия подтверждения OAuth истекла или недействительна. Повторите попытку.'
      );
    }
    this.pendingStates.delete(stateRaw);
    if (record.provider !== provider || record.expiresAt <= Date.now()) {
      throw new ValidationError('Несоответствие параметров безопасности OAuth-запроса.');
    }
    return record;
  }

  async exchangeCodeAndBuildAccount(input: {
    provider: OAuthProviderId;
    code: string;
    redirectUri: string;
    fallbackUser: {
      fullName: string;
      email: string;
      region: string;
      organisation: string;
    };
    existingLinkedAt?: string;
  }): Promise<LinkedAccountDTO> {
    const creds = this.readCredentials(input.provider);
    if (!creds) {
      throw new ValidationError('OAuth-провайдер не настроен на сервере.');
    }

    const now = new Date().toISOString();

    if (input.provider === 'google') {
      return this.exchangeGoogle(
        creds,
        input.code,
        input.redirectUri,
        input.fallbackUser,
        input.existingLinkedAt || now,
        now
      );
    }
    if (input.provider === 'vk') {
      return this.exchangeVk(
        creds,
        input.code,
        input.redirectUri,
        input.fallbackUser,
        input.existingLinkedAt || now,
        now
      );
    }
    if (input.provider === 'yandex') {
      return this.exchangeYandex(
        creds,
        input.code,
        input.fallbackUser,
        input.existingLinkedAt || now,
        now
      );
    }
    return this.exchangeGithub(
      creds,
      input.code,
      input.redirectUri,
      input.fallbackUser,
      input.existingLinkedAt || now,
      now
    );
  }

  private async exchangeGoogle(
    creds: { clientId: string; clientSecret: string },
    code: string,
    redirectUri: string,
    fallback: { fullName: string; email: string; region: string; organisation: string },
    linkedAt: string,
    updatedAt: string
  ): Promise<LinkedAccountDTO> {
    const tokenRes = await fetch(PROVIDER_CONFIGS.google.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenRes.ok) {
      throw new ValidationError('Не удалось обменять код авторизации Google.');
    }
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      throw new ValidationError('Google не вернул токен доступа.');
    }

    const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!profileRes.ok) {
      throw new ValidationError('Не удалось загрузить профиль Google-аккаунта.');
    }
    const profile = (await profileRes.json()) as {
      sub?: string;
      name?: string;
      email?: string;
    };

    const email = SanitizedText.sanitizeRaw(profile.email, 160).toLowerCase() || fallback.email;
    const displayName = SanitizedText.sanitizeRaw(profile.name, 120) || fallback.fullName;

    return {
      provider: 'google',
      connectionMethod: 'oauth',
      externalId: SanitizedText.sanitizeRaw(profile.sub, 120) || email,
      displayName,
      email,
      contactChannel: email,
      region: fallback.region,
      organisation: fallback.organisation,
      profileUrl: '',
      preferredTrack: '',
      experienceSummary: '',
      useForExamAutofill: true,
      linkedAt,
      updatedAt,
    };
  }

  private async exchangeVk(
    creds: { clientId: string; clientSecret: string },
    code: string,
    redirectUri: string,
    fallback: { fullName: string; email: string; region: string; organisation: string },
    linkedAt: string,
    updatedAt: string
  ): Promise<LinkedAccountDTO> {
    const params = new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: redirectUri,
      code,
    });
    const tokenRes = await fetch(`${PROVIDER_CONFIGS.vk.tokenUrl}?${params.toString()}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenRes.ok) {
      throw new ValidationError('Не удалось завершить авторизацию ВКонтакте.');
    }
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      user_id?: number;
      email?: string;
    };
    if (!tokenData.access_token) {
      throw new ValidationError('ВКонтакте не вернул токен доступа.');
    }

    const userRes = await fetch(
      `https://api.vk.com/method/users.get?fields=city,screen_name,domain&v=5.199`,
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        signal: AbortSignal.timeout(10_000),
      }
    );
    const userPayload = (await userRes.json()) as {
      response?: Array<{
        id: number;
        first_name?: string;
        last_name?: string;
        domain?: string;
        screen_name?: string;
        city?: { title?: string };
      }>;
    };
    const vkUser = userPayload.response?.[0];
    const fullName = vkUser
      ? `${vkUser.first_name ?? ''} ${vkUser.last_name ?? ''}`.trim()
      : '';
    const slug = vkUser?.screen_name || vkUser?.domain || (vkUser ? `id${vkUser.id}` : '');
    const profileUrl = slug ? `https://vk.com/${slug}` : '';

    return {
      provider: 'vk',
      connectionMethod: 'oauth',
      externalId: String(vkUser?.id ?? tokenData.user_id ?? slug ?? 'vk'),
      displayName: SanitizedText.sanitizeRaw(fullName, 120) || fallback.fullName,
      email: SanitizedText.sanitizeRaw(tokenData.email, 160).toLowerCase() || fallback.email,
      contactChannel: slug ? `vk.com/${slug}` : fallback.email,
      region: SanitizedText.sanitizeRaw(vkUser?.city?.title, 80) || fallback.region,
      organisation: fallback.organisation,
      profileUrl,
      preferredTrack: '',
      experienceSummary: '',
      useForExamAutofill: true,
      linkedAt,
      updatedAt,
    };
  }

  private async exchangeYandex(
    creds: { clientId: string; clientSecret: string },
    code: string,
    fallback: { fullName: string; email: string; region: string; organisation: string },
    linkedAt: string,
    updatedAt: string
  ): Promise<LinkedAccountDTO> {
    const tokenRes = await fetch(PROVIDER_CONFIGS.yandex.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenRes.ok) {
      throw new ValidationError('Не удалось обменять код авторизации Яндекс ID.');
    }
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      throw new ValidationError('Яндекс ID не вернул токен доступа.');
    }

    const infoRes = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${tokenData.access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!infoRes.ok) {
      throw new ValidationError('Не удалось получить профиль Яндекс ID.');
    }
    const info = (await infoRes.json()) as {
      id?: string;
      real_name?: string;
      display_name?: string;
      default_email?: string;
      default_phone?: { number?: string };
    };
    const email = SanitizedText.sanitizeRaw(info.default_email, 160).toLowerCase() || fallback.email;
    const phone = SanitizedText.sanitizeRaw(info.default_phone?.number, 60);

    return {
      provider: 'yandex',
      connectionMethod: 'oauth',
      externalId: SanitizedText.sanitizeRaw(info.id, 120) || email,
      displayName:
        SanitizedText.sanitizeRaw(info.real_name || info.display_name, 120) ||
        fallback.fullName,
      email,
      contactChannel: phone || email,
      region: fallback.region,
      organisation: fallback.organisation,
      profileUrl: '',
      preferredTrack: '',
      experienceSummary: '',
      useForExamAutofill: true,
      linkedAt,
      updatedAt,
    };
  }

  private async exchangeGithub(
    creds: { clientId: string; clientSecret: string },
    code: string,
    redirectUri: string,
    fallback: { fullName: string; email: string; region: string; organisation: string },
    linkedAt: string,
    updatedAt: string
  ): Promise<LinkedAccountDTO> {
    const tokenRes = await fetch(PROVIDER_CONFIGS.github.tokenUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenRes.ok) {
      throw new ValidationError('Не удалось обменять код авторизации GitHub.');
    }
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      throw new ValidationError('GitHub не вернул токен доступа.');
    }

    const headers = {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'rca-vostok',
    };
    const userRes = await fetch('https://api.github.com/user', {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!userRes.ok) {
      throw new ValidationError('Не удалось получить профиль GitHub.');
    }
    const ghUser = (await userRes.json()) as {
      id?: number;
      login?: string;
      name?: string;
      email?: string | null;
      company?: string | null;
      location?: string | null;
      html_url?: string;
    };

    let email = SanitizedText.sanitizeRaw(ghUser.email, 160).toLowerCase();
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (emailsRes.ok) {
        const list = (await emailsRes.json()) as Array<{ email: string; primary?: boolean }>;
        const primary = list.find((e) => e.primary) ?? list[0];
        if (primary?.email) {
          email = SanitizedText.sanitizeRaw(primary.email, 160).toLowerCase();
        }
      }
    }

    return {
      provider: 'github',
      connectionMethod: 'oauth',
      externalId: String(ghUser.id ?? ghUser.login ?? 'github'),
      displayName: SanitizedText.sanitizeRaw(ghUser.name || ghUser.login, 120) || fallback.fullName,
      email: email || fallback.email,
      contactChannel: ghUser.login ? `@${ghUser.login}` : email || fallback.email,
      region: SanitizedText.sanitizeRaw(ghUser.location, 80) || fallback.region,
      organisation: SanitizedText.sanitizeRaw(ghUser.company, 160) || fallback.organisation,
      profileUrl: SanitizedText.sanitizeRaw(ghUser.html_url, 240),
      preferredTrack: '',
      experienceSummary: '',
      useForExamAutofill: true,
      linkedAt,
      updatedAt,
    };
  }

  private pruneExpiredStates(): void {
    const now = Date.now();
    for (const [key, value] of this.pendingStates.entries()) {
      if (value.expiresAt <= now) {
        this.pendingStates.delete(key);
      }
    }
  }
}
