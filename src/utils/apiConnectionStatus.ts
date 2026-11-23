export type ApiConnectionState = 'checking' | 'connected' | 'disconnected';

export interface ApiConnectionSnapshot {
  status: ApiConnectionState;
  latencyMs: number | null;
  lastCheckedAt: string | null;
  serverStatus: 'healthy' | 'degraded' | 'unhealthy' | null;
  errorMessage: string | null;
}

export interface ProbeOptions {
  endpoint?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export function createInitialSnapshot(): ApiConnectionSnapshot {
  return {
    status: 'checking',
    latencyMs: null,
    lastCheckedAt: null,
    serverStatus: null,
    errorMessage: null,
  };
}

export function createOfflineSnapshot(now: () => number = () => Date.now()): ApiConnectionSnapshot {
  return {
    status: 'disconnected',
    latencyMs: null,
    lastCheckedAt: new Date(now()).toISOString(),
    serverStatus: null,
    errorMessage: 'Отсутствует сетевое подключение',
  };
}

function parseHealthStatus(body: unknown): 'healthy' | 'degraded' | 'unhealthy' | null {
  if (!body || typeof body !== 'object') return null;
  const raw = (body as { status?: unknown }).status;
  if (raw === 'healthy' || raw === 'degraded' || raw === 'unhealthy') {
    return raw;
  }
  return null;
}

export async function probeApiHealth(options: ProbeOptions = {}): Promise<ApiConnectionSnapshot> {
  const endpoint = options.endpoint ?? '/api/health';
  const timeoutMs = options.timeoutMs ?? 4000;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => Date.now());

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = now();

  try {
    const response = await fetchImpl(endpoint, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    const latencyMs = Math.max(0, Math.round(now() - startedAt));
    const checkedAt = new Date(now()).toISOString();

    let payload: unknown = null;
    try {
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        payload = await response.json();
      }
    } catch {
      payload = null;
    }

    const serverStatus = parseHealthStatus(payload);

    if (!response.ok) {
      return {
        status: 'disconnected',
        latencyMs,
        lastCheckedAt: checkedAt,
        serverStatus,
        errorMessage: `Сервер вернул HTTP ${response.status}`,
      };
    }

    if (serverStatus === null) {
      return {
        status: 'disconnected',
        latencyMs,
        lastCheckedAt: checkedAt,
        serverStatus: null,
        errorMessage: 'Некорректный ответ API',
      };
    }

    if (serverStatus === 'unhealthy') {
      return {
        status: 'disconnected',
        latencyMs,
        lastCheckedAt: checkedAt,
        serverStatus,
        errorMessage: 'Сервер сообщил о недоступности БД',
      };
    }

    return {
      status: 'connected',
      latencyMs,
      lastCheckedAt: checkedAt,
      serverStatus,
      errorMessage: null,
    };
  } catch (err) {
    const checkedAt = new Date(now()).toISOString();
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      status: 'disconnected',
      latencyMs: null,
      lastCheckedAt: checkedAt,
      serverStatus: null,
      errorMessage: isAbort ? 'Превышено время ожидания ответа сервера' : 'Нет связи с сервером API',
    };
  } finally {
    clearTimeout(timer);
  }
}
