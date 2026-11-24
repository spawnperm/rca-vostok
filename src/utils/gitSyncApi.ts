export type GitSyncAuthMode = 'key' | 'key_required';

export interface GitAuthStatusResponse {
  authorized: boolean;
  mode: GitSyncAuthMode;
}

export interface GitChangedFile {
  status: string;
  path: string;
}

export interface GitRecentCommit {
  hash: string;
  shortHash: string;
  subject: string;
  author: string;
  date: string;
}

export interface GitStatusResponse {
  initialized?: boolean;
  statusMessage?: string;
  repository: string;
  branch: string;
  targetBranch: string;
  remoteUrl: string;
  ahead: number;
  behind: number;
  changedFiles: GitChangedFile[];
  hasChangesToCommit: boolean;
  canPush: boolean;
  recentCommits: GitRecentCommit[];
}

export interface GitCommitPushResponse {
  ok: true;
  committed: boolean;
  pushed: boolean;
  commitHash: string | null;
  shortHash: string | null;
  commitMessage: string | null;
  filesCommittedCount: number;
  branch: string;
  remote: string;
  summary: string;
}

export class GitApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'GitApiError';
    this.status = status;
    this.code = code;
  }
}

function buildHeaders(bearerToken?: string | null, hasBody = false): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }
  return headers;
}

async function requestJson<T>(
  url: string,
  options: { method?: string; body?: unknown; bearerToken?: string | null } = {}
): Promise<T> {
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    headers: buildHeaders(options.bearerToken, options.body !== undefined),
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };

  if (!res.ok) {
    throw new GitApiError(
      payload.error || `Ошибка запроса (${res.status}).`,
      res.status,
      payload.code
    );
  }
  return payload as T;
}

export const gitSyncApi = {
  authStatus(bearerToken?: string | null): Promise<GitAuthStatusResponse> {
    return requestJson<GitAuthStatusResponse>('/api/git/auth-status', { bearerToken });
  },

  verifyKey(accessKey: string): Promise<{ ok: true; token: string; expiresAt: string }> {
    return requestJson('/api/git/verify-key', {
      method: 'POST',
      body: { accessKey },
    });
  },

  lock(bearerToken?: string | null): Promise<{ ok: true }> {
    return requestJson('/api/git/lock', {
      method: 'POST',
      bearerToken,
    });
  },

  status(bearerToken?: string | null): Promise<GitStatusResponse> {
    return requestJson<GitStatusResponse>('/api/git/status', { bearerToken });
  },

  commitAndPush(
    input: {
      commitMessage: string;
      accessKey?: string;
      authorName?: string;
      authorEmail?: string;
    },
    bearerToken?: string | null
  ): Promise<GitCommitPushResponse> {
    return requestJson<GitCommitPushResponse>('/api/git/commit-push', {
      method: 'POST',
      body: input,
      bearerToken,
    });
  },
};
