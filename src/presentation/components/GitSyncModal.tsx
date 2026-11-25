import React from 'react';
import { CheckCircle2, Eye, EyeOff, GitBranch, GitCommitHorizontal, KeyRound, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { refineClient } from '../../application/refine/client.ts';
import { Modal } from './ui/Modal.tsx';

interface GitWorkspaceStatus {
  repository: string;
  targetBranch: string;
  currentBranch: string;
  lastCommit: string;
  changedCount: number;
  changedPreview: string[];
}

interface GitPushResult {
  ok: boolean;
  repository: string;
  branch: string;
  commitSha: string;
  committedNew: boolean;
  filesCount: number;
}

interface GitSyncModalProps {
  open: boolean;
  onClose: () => void;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
}

export const GitSyncModal: React.FC<GitSyncModalProps> = ({ open, onClose, onNotify }) => {
  const [status, setStatus] = useState<GitWorkspaceStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [commitMessage, setCommitMessage] = useState('chore: sync NexusHarness CRM changes');
  const [pat, setPat] = useState('');
  const [showPat, setShowPat] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pushResult, setPushResult] = useState<GitPushResult | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    setErrorMsg(null);
    try {
      const data = await refineClient.request<GitWorkspaceStatus>('/api/git/status');
      setStatus(data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Не удалось получить статус Git');
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setPushResult(null);
      setErrorMsg(null);
      void fetchStatus();
    } else {
      setPat('');
      setShowPat(false);
    }
  }, [open, fetchStatus]);

  const handleClose = () => {
    setPat('');
    setShowPat(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tokenValue = pat.trim();
    const messageValue = commitMessage.trim();

    if (messageValue.length < 3) {
      setErrorMsg('Введите сообщение коммита (минимум 3 символа)');
      return;
    }
    if (tokenValue.length < 10) {
      setErrorMsg('Введите действительный GitHub Personal Access Token (PAT)');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setPushResult(null);

    try {
      const result = await refineClient.request<GitPushResult>('/api/git/commit-push', {
        method: 'POST',
        body: JSON.stringify({
          commitMessage: messageValue,
          pat: tokenValue,
          branch: 'main',
        }),
      });
      setPushResult(result);
      setPat('');
      setShowPat(false);
      onNotify(`Изменения (${result.commitSha}) отправлены в ${result.repository} · main`);
      await fetchStatus();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка фиксации и отправки в main';
      setErrorMsg(message);
      onNotify(message, 'err');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        <span className="inline-flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-slate-700" />
          Коммит и отправка в GitHub
        </span>
      }
      subtitle={`${status?.repository || 'spawnperm/mvr'} · ветка main`}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-slate-700">
              Локальная ветка:{' '}
              <span className="font-mono text-slate-900">{status?.currentBranch || '...'}</span>
              <span className="mx-1.5 text-slate-300">·</span>
              <span>
                Изменений:{' '}
                <strong className="tabular-nums text-slate-900">
                  {status ? status.changedCount : '—'}
                </strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => void fetchStatus()}
              disabled={loadingStatus}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200/70 disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`h-3 w-3 ${loadingStatus ? 'animate-spin' : ''}`} />
              Обновить
            </button>
          </div>

          {status?.lastCommit && (
            <div className="mt-1.5 truncate font-mono text-[11px] text-slate-500">
              HEAD: {status.lastCommit}
            </div>
          )}

          {status && status.changedPreview.length > 0 && (
            <div className="mt-2.5 max-h-28 space-y-0.5 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 font-mono text-[11px] text-slate-700">
              {status.changedPreview.map((line) => (
                <div key={line} className="truncate">
                  {line}
                </div>
              ))}
              {status.changedCount > status.changedPreview.length && (
                <div className="text-slate-400">
                  + ещё {status.changedCount - status.changedPreview.length} файлов
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="git-commit-message" className="mb-1.5 block text-xs font-medium text-slate-700">
            Сообщение коммита
          </label>
          <div className="relative">
            <GitCommitHorizontal className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="git-commit-message"
              type="text"
              required
              minLength={3}
              maxLength={200}
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="feat: описание изменений"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 outline-none focus:border-[#0077FF]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="git-pat-input" className="mb-1.5 block text-xs font-medium text-slate-700">
            Ключ доступа GitHub (PAT)
          </label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="git-pat-input"
              type={showPat ? 'text' : 'password'}
              required
              autoComplete="off"
              spellCheck={false}
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="ghp_... или github_pat_..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 font-mono text-xs text-slate-900 outline-none focus:border-[#0077FF]"
            />
            <button
              type="button"
              onClick={() => setShowPat((prev) => !prev)}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
              aria-label={showPat ? 'Скрыть ключ' : 'Показать ключ'}
            >
              {showPat ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Ключ используется только для текущей HTTPS-отправки и не сохраняется в браузере или БД.
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {errorMsg}
          </div>
        )}

        {pushResult && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div>
              <div className="font-medium">
                Отправлено в {pushResult.repository} · {pushResult.branch}
              </div>
              <div className="mt-0.5 text-emerald-800">
                Коммит <span className="font-mono font-semibold">{pushResult.commitSha}</span>
                {' · '}
                {pushResult.committedNew
                  ? `зафиксировано файлов: ${pushResult.filesCount}`
                  : 'рабочее дерево было чистое'}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            Закрыть
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            <GitBranch className="h-3.5 w-3.5" />
            {submitting ? 'Отправка...' : 'Отправить в main'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
