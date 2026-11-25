import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  FileCode2,
  GitBranch,
  GitCommitHorizontal,
  KeyRound,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  GitApiError,
  gitSyncApi,
  type GitAuthStatusResponse,
  type GitCommitPushResponse,
  type GitStatusResponse,
} from '../utils/gitSyncApi';
import { tracker } from '../utils/tracker';

const DEFAULT_COMMIT_MESSAGE = 'feat: обновление платформы РЦА «Русский Восток»';

function formatStatusCode(code: string): { label: string; tone: string } {
  const normalized = code.trim();
  if (normalized === '??' || normalized.includes('A')) {
    return { label: 'Новый', tone: 'text-emerald-700' };
  }
  if (normalized.includes('D')) {
    return { label: 'Удалён', tone: 'text-red-700' };
  }
  if (normalized.includes('R')) {
    return { label: 'Переименован', tone: 'text-sky-700' };
  }
  return { label: 'Изменён', tone: 'text-amber-700' };
}

interface GitSyncPanelProps {
  onClose?: () => void;
  bearerToken: string | null;
  onTokenChange: (token: string | null) => void;
}

export const GitSyncPanel: React.FC<GitSyncPanelProps> = ({
  onClose,
  bearerToken,
  onTokenChange,
}) => {
  const [authStatus, setAuthStatus] = useState<GitAuthStatusResponse | null>(null);
  const [repoStatus, setRepoStatus] = useState<GitStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [accessKey, setAccessKey] = useState<string>('');
  const [commitMessage, setCommitMessage] = useState<string>(DEFAULT_COMMIT_MESSAGE);
  const [authorName, setAuthorName] = useState<string>('');
  const [authorEmail, setAuthorEmail] = useState<string>('');
  const [showAuthorFields, setShowAuthorFields] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pushResult, setPushResult] = useState<GitCommitPushResponse | null>(null);

  const loadState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await gitSyncApi.authStatus(bearerToken);
      setAuthStatus(auth);
      if (auth.authorized) {
        const status = await gitSyncApi.status(bearerToken);
        setRepoStatus(status);
      } else {
        setRepoStatus(null);
      }
    } catch (err) {
      if (err instanceof GitApiError && err.status === 401) {
        onTokenChange(null);
      }
      setError(err instanceof GitApiError ? err.message : 'Не удалось проверить статус Git.');
    } finally {
      setLoading(false);
    }
  }, [bearerToken, onTokenChange]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const handleVerifyKey = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await gitSyncApi.verifyKey(accessKey);
      onTokenChange(res.token);
      setAccessKey('');
    } catch (err) {
      setError(err instanceof GitApiError ? err.message : 'Не удалось проверить ключ доступа.');
    } finally {
      setBusy(false);
    }
  };

  const handleResetKey = async () => {
    setBusy(true);
    try {
      await gitSyncApi.lock(bearerToken);
    } catch {
      // ignore lock errors
    } finally {
      onTokenChange(null);
      setRepoStatus(null);
      setPushResult(null);
      setBusy(false);
    }
  };

  const handleCommitAndPush = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPushResult(null);

    if (commitMessage.trim().length < 3) {
      setError('Укажите сообщение коммита (минимум 3 символа).');
      return;
    }

    setBusy(true);
    try {
      const result = await gitSyncApi.commitAndPush(
        {
          commitMessage: commitMessage.trim(),
          authorName: authorName.trim() || undefined,
          authorEmail: authorEmail.trim() || undefined,
        },
        bearerToken
      );
      setPushResult(result);
      tracker.trackCustomInteraction(
        `Git commit & push в ${result.remote} (${result.branch})`,
        result.shortHash ?? 'main'
      );
      const refreshed = await gitSyncApi.status(bearerToken);
      setRepoStatus(refreshed);
    } catch (err) {
      if (err instanceof GitApiError && err.status === 401) {
        onTokenChange(null);
      }
      setError(err instanceof GitApiError ? err.message : 'Не удалось выполнить коммит и отправку.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
        <div className="space-y-0.5 min-w-0">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>spawnperm/rca-vostok · ветка main</span>
          </p>
          <h3 className="text-base font-bold text-slate-900">
            Фиксация изменений и отправка в репозиторий
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {authStatus?.authorized && (
            <button
              type="button"
              onClick={() => void loadState()}
              disabled={loading || busy}
              aria-label="Обновить статус Git"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
          )}
          {authStatus?.authorized && (
            <button
              type="button"
              onClick={() => void handleResetKey()}
              disabled={busy}
              title="Сбросить подтверждённый ключ доступа"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Сменить ключ</span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть окно синхронизации Git"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-5">
        {loading && !authStatus ? (
          <p className="text-sm text-slate-500">Проверяем состояние репозитория…</p>
        ) : authStatus?.gitAvailable === false ? (
          // The feature cannot work here, so asking for a key would be a dead
          // end. Say so plainly instead of collecting a credential first.
          <div
            role="status"
            className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2"
          >
            <p className="text-xs font-semibold text-amber-900 inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-700" aria-hidden="true" />
              <span>Синхронизация с GitHub недоступна в этом окружении</span>
            </p>
            <p className="text-xs text-amber-900 leading-relaxed">
              {authStatus.unavailableReason ||
                'Утилита git не установлена в текущем окружении.'}
            </p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Изменения можно зафиксировать локально и отправить в репозиторий командой{' '}
              <code className="font-mono">git push</code> из рабочей копии на машине разработчика.
            </p>
          </div>
        ) : !authStatus?.authorized ? (
          <form onSubmit={handleVerifyKey} className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1.5">
              <p className="text-xs font-semibold text-slate-900 inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-700" aria-hidden="true" />
                <span>Требуется ключ доступа к репозиторию GitHub</span>
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Для фиксации изменений коммитом и отправки в ветку{' '}
                <code className="font-mono">main</code> репозитория{' '}
                <code className="font-mono">spawnperm/rca-vostok</code> введите персональный ключ
                доступа GitHub с правами на запись (push). Ключ проверяется на сервере через GitHub
                API, не сохраняется на диск и действует только в оперативной памяти текущей сессии.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="git-access-key" className="block text-xs font-medium text-slate-700">
                Ключ доступа GitHub (Personal Access Token)
              </label>
              <input
                id="git-access-key"
                type="password"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="ghp_... или github_pat_..."
                className="w-full px-3 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>

            {error && (
              <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !accessKey.trim()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{busy ? 'Проверяем ключ…' : 'Подтвердить ключ доступа'}</span>
            </button>
          </form>
        ) : (
          <>
            {/* Status Strip */}
            {repoStatus && (
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 text-xs">
                <div className="flex flex-wrap items-center gap-2 text-slate-700">
                  <span>
                    Ветка: <strong className="font-mono text-slate-900">{repoStatus.branch}</strong>
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span>
                    Изменено файлов:{' '}
                    <strong className="font-mono text-slate-900 tabular-nums">
                      {repoStatus.changedFiles.length}
                    </strong>
                  </span>
                  {repoStatus.ahead > 0 && (
                    <>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-teal-800 font-medium">
                        Неотправленных коммитов: {repoStatus.ahead}
                      </span>
                    </>
                  )}
                </div>

                <span className="text-[11px] font-medium text-emerald-800 inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                  <span>Ключ доступа подтверждён</span>
                </span>
              </div>
            )}

            {/* Changed Files List */}
            {repoStatus && repoStatus.changedFiles.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700">
                  Изменения в рабочей копии ({repoStatus.changedFiles.length})
                </p>
                <ul className="max-h-44 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-slate-50/70">
                  {repoStatus.changedFiles.map((file) => {
                    const badge = formatStatusCode(file.status);
                    return (
                      <li
                        key={`${file.status}:${file.path}`}
                        className="px-3 py-2 flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="inline-flex items-center gap-2 min-w-0 text-slate-800 font-mono text-[11px]">
                          <FileCode2 className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                          <span className="truncate">{file.path}</span>
                        </span>
                        <span className={`text-[11px] font-medium shrink-0 ${badge.tone}`}>
                          {badge.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : repoStatus ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-600">
                {repoStatus.initialized === false
                  ? repoStatus.statusMessage ||
                    'Локальный Git-репозиторий (.git) отсутствует в текущем окружении.'
                  : repoStatus.ahead > 0
                    ? `Рабочее дерево чистое, но есть локальные коммиты (${repoStatus.ahead}), готовые к отправке в main.`
                    : 'Рабочее дерево чистое — все изменения уже зафиксированы и отправлены в main.'}
              </div>
            ) : null}

            {/* Commit & Push Form */}
            <form onSubmit={handleCommitAndPush} className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="git-commit-message" className="block text-xs font-medium text-slate-700">
                  Сообщение коммита
                </label>
                <input
                  id="git-commit-message"
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  maxLength={200}
                  placeholder="feat: описание изменений в проекте"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowAuthorFields((v) => !v)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2 cursor-pointer"
                >
                  {showAuthorFields ? 'Скрыть данные автора коммита' : 'Указать имя и e-mail автора (необязательно)'}
                </button>

                {showAuthorFields && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5">
                    <input
                      type="text"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      placeholder="Имя автора"
                      aria-label="Имя автора коммита"
                      className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none"
                    />
                    <input
                      type="email"
                      value={authorEmail}
                      onChange={(e) => setAuthorEmail(e.target.value)}
                      placeholder="author@example.com"
                      aria-label="E-mail автора коммита"
                      className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {error && (
                <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {pushResult && (
                <div
                  role="status"
                  className="bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5 text-xs text-emerald-900 flex items-start gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-0.5">
                    <p className="font-semibold">{pushResult.summary}</p>
                    {pushResult.shortHash && (
                      <p className="font-mono text-[11px] text-emerald-800">
                        SHA: {pushResult.shortHash} · {pushResult.remote}/{pushResult.branch}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="submit"
                  disabled={busy || loading || !repoStatus?.canPush}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{busy ? 'Выполняем commit & push…' : 'Зафиксировать и отправить в main'}</span>
                </button>

                <span className="text-[11px] text-slate-500">
                  Отправка с подтверждённым ключом в <code className="font-mono">origin/main</code>
                </span>
              </div>
            </form>

            {/* Recent Commits */}
            {repoStatus && repoStatus.recentCommits.length > 0 && (
              <div className="pt-4 border-t border-slate-200 space-y-2">
                <p className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5">
                  <GitCommitHorizontal className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>Последние коммиты в ветке {repoStatus.branch}</span>
                </p>
                <ul className="divide-y divide-slate-100 text-xs">
                  {repoStatus.recentCommits.map((commit) => (
                    <li key={commit.hash} className="py-1.5 flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-slate-800">
                        <code className="font-mono text-[11px] text-teal-800 mr-2">
                          {commit.shortHash}
                        </code>
                        {commit.subject}
                      </span>
                      <span className="text-[11px] text-slate-500 whitespace-nowrap shrink-0">
                        {commit.author}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

interface GitSyncModalProps {
  open: boolean;
  onClose: () => void;
  bearerToken: string | null;
  onTokenChange: (token: string | null) => void;
}

export const GitSyncModal: React.FC<GitSyncModalProps> = ({
  open,
  onClose,
  bearerToken,
  onTokenChange,
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const firstFocusable = containerRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }, 10);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Фиксация изменений и отправка в main"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Закрыть диалог"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
      />
      <div
        ref={containerRef}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl rounded-xl"
      >
        <GitSyncPanel
          onClose={onClose}
          bearerToken={bearerToken}
          onTokenChange={onTokenChange}
        />
      </div>
    </div>
  );
};
