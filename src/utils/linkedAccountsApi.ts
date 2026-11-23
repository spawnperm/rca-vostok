import { ApiError } from './identityApi';
import type {
  ExamAutofillPayload,
  LinkedAccountDTO,
  LinkedProviderId,
  OAuthProviderId,
} from '../domain/identity/LinkedAccounts';

export type {
  ExamAutofillPayload,
  LinkedAccountDTO,
  LinkedProviderId,
  OAuthProviderId,
};

export interface OAuthProviderStatusDTO {
  id: OAuthProviderId;
  label: string;
  oauthConfigured: boolean;
  callbackUrl: string;
  envHints: [string, string];
}

export interface LinkedAccountsStateResponse {
  accounts: LinkedAccountDTO[];
  autofill: ExamAutofillPayload | null;
  providers: OAuthProviderStatusDTO[];
}

export interface LinkedAccountsMutationResponse {
  accounts: LinkedAccountDTO[];
  autofill: ExamAutofillPayload | null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch',
      ...(init.headers || {}),
    },
    ...init,
  });

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const body = (payload ?? {}) as { error?: string; code?: string };
    throw new ApiError(
      body.error || `Ошибка запроса (${res.status}).`,
      res.status,
      body.code || 'HTTP_ERROR'
    );
  }

  return payload as T;
}

export const linkedAccountsApi = {
  async list(): Promise<LinkedAccountsStateResponse> {
    return request('/api/account/linked-accounts');
  },

  async getOAuthUrl(provider: OAuthProviderId): Promise<{ url: string; provider: OAuthProviderId }> {
    return request(`/api/account/oauth/${encodeURIComponent(provider)}/url`);
  },

  async linkProfile(input: {
    provider: LinkedProviderId;
    displayName?: string;
    email?: string;
    contactChannel?: string;
    region?: string;
    organisation?: string;
    profileUrl?: string;
    preferredTrack?: string;
    experienceSummary?: string;
    useForExamAutofill?: boolean;
  }): Promise<LinkedAccountsMutationResponse> {
    return request('/api/account/linked-accounts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async syncInternalSocial(input?: {
    contactChannel?: string;
    preferredTrack?: string;
    experienceSummary?: string;
  }): Promise<LinkedAccountsMutationResponse> {
    return request('/api/account/linked-accounts/sync-internal', {
      method: 'POST',
      body: JSON.stringify(input ?? {}),
    });
  },

  async setAutofillSource(
    provider: LinkedProviderId,
    enabled = true
  ): Promise<LinkedAccountsMutationResponse> {
    return request(
      `/api/account/linked-accounts/${encodeURIComponent(provider)}/autofill`,
      {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }
    );
  },

  async unlink(provider: LinkedProviderId): Promise<LinkedAccountsMutationResponse> {
    return request(`/api/account/linked-accounts/${encodeURIComponent(provider)}`, {
      method: 'DELETE',
    });
  },
};
