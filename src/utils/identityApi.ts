/**
 * Thin client for the personal-cabinet API.
 *
 * All requests send the session cookie (`credentials: 'same-origin'`), and
 * errors are normalised into Error instances carrying the server's message so
 * the UI can show domain wording instead of generic failures.
 */

export type Role = 'candidate' | 'instructor' | 'curator' | 'admin';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  region: string;
  organisation: string;
  role: Role;
  permissions: string[];
  isActive: boolean;
  attestationExpiresAt?: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, status: number, code = 'ERROR') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
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
      body.error || `Запрос завершился с ошибкой (${res.status}).`,
      res.status,
      body.code || 'HTTP_ERROR'
    );
  }

  return payload as T;
}

export const identityApi = {
  async session(): Promise<{ authenticated: boolean; user?: SessionUser }> {
    return request('/api/auth/session');
  },

  async login(email: string, password: string): Promise<{ user: SessionUser }> {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async register(input: {
    email: string;
    password: string;
    fullName: string;
    region?: string;
    organisation?: string;
    attestationExpiresAt?: string | null;
  }): Promise<{ user: SessionUser }> {
    return request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async logout(): Promise<{ ok: true }> {
    return request('/api/auth/logout', { method: 'POST' });
  },

  async updateProfile(input: {
    fullName?: string;
    region?: string;
    organisation?: string;
    attestationExpiresAt?: string | null;
  }): Promise<SessionUser> {
    return request('/api/account/profile', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async changePassword(input: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ ok: true }> {
    return request('/api/account/password', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async listUsers(): Promise<{ users: SessionUser[] }> {
    return request('/api/admin/users');
  },

  async assignRole(userId: string, role: Role): Promise<SessionUser> {
    return request(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  async setUserActive(userId: string, isActive: boolean): Promise<SessionUser> {
    return request(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  },
};

export const ROLE_LABELS: Record<Role, string> = {
  candidate: 'Соискатель',
  instructor: 'Инструктор-проводник',
  curator: 'Куратор РЦА',
  admin: 'Администратор',
};
