import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, ShieldAlert, ShieldCheck, ShieldPlus, Users } from 'lucide-react';
import {
  ApiError,
  ROLE_LABELS,
  identityApi,
  type AdminBootstrapStatus,
  type Role,
  type SessionUser,
} from '../../utils/identityApi';
import { tracker } from '../../utils/tracker';
import { computeUserAttestationSummary } from '../AttestationProgressWidget';
import { Field } from './AuthPanel';

export function PasswordCard({ onChanged }: { onChanged: () => void }) {
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!currentPassword || !newPassword) {
      setError('Заполните оба поля.');
      return;
    }

    setBusy(true);
    try {
      await identityApi.changePassword({ currentPassword, newPassword });
      tracker.trackCustomInteraction('Смена пароля', 'account');
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось изменить пароль.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="space-y-1">
        <h3 className="text-base font-bold text-slate-900">Смена пароля</h3>
        <p className="text-sm text-slate-600">
          После смены пароля все активные сеансы завершаются — потребуется войти заново.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Текущий пароль" htmlFor="pwd-current">
          <input
            id="pwd-current"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
          />
        </Field>

        <Field label="Новый пароль" htmlFor="pwd-new" hint="Не менее 10 символов, буквы и цифры">
          <input
            id="pwd-new"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
          />
        </Field>

        {error && (
          <p
            role="alert"
            className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-300 text-slate-800 text-sm font-semibold rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-60 whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <KeyRound className="w-4 h-4" aria-hidden="true" />
          {busy ? 'Обновляем…' : 'Изменить пароль'}
        </button>
      </form>
    </section>
  );
}

export function PermissionsCard({ user }: { user: SessionUser }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-bold text-slate-900">Права доступа</h3>
        <p className="text-sm text-slate-600">
          Роль «{ROLE_LABELS[user.role]}» определяет доступные действия.
        </p>
      </div>

      <ul className="space-y-2">
        {user.permissions.map((permission) => (
          <li key={permission} className="flex items-start gap-2 text-sm text-slate-700">
            <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
            <code className="font-mono text-xs text-slate-600">{permission}</code>
          </li>
        ))}
      </ul>

      {user.permissions.length === 0 && (
        <p className="text-sm text-slate-500">Разрешения не назначены.</p>
      )}
    </section>
  );
}

export function UserAdminCard({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await identityApi.listUsers();
      setUsers(res.users);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить пользователей.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const changeRole = async (userId: string, role: Role) => {
    try {
      await identityApi.assignRole(userId, role);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось изменить роль.');
    }
  };

  const toggleActive = async (userId: string, isActive: boolean) => {
    try {
      await identityApi.setUserActive(userId, isActive);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось изменить статус.');
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-bold text-slate-900 inline-flex items-center gap-2">
          <Users className="w-4 h-4 text-teal-700" aria-hidden="true" />
          Управление пользователями
        </h3>
        <p className="text-sm text-slate-600">
          Доступно только администраторам. Всего учётных записей: {users.length}.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Загружаем список…</p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            const userProgress = computeUserAttestationSummary(u);
            return (
              <li key={u.id} className="py-3 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{u.fullName}</p>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded shrink-0 ${
                      u.isActive
                        ? 'bg-teal-50 text-teal-800 border border-teal-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {u.isActive ? 'активен' : 'заблокирован'}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span className="truncate">
                      {userProgress.percent === 100
                        ? 'Свидетельство получено'
                        : `Этап ${userProgress.activeStage.stepNumber}: ${userProgress.activeStage.title}`}
                    </span>
                    <span className="font-mono font-semibold text-slate-800 tabular-nums shrink-0 ml-2">
                      {userProgress.percent}%
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`Прогресс аттестации: ${u.fullName}`}
                    aria-valuenow={userProgress.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden"
                  >
                    <div
                      className={`h-full transition-all duration-200 ${
                        userProgress.percent === 100 ? 'bg-emerald-600' : 'bg-teal-700'
                      }`}
                      style={{ width: `${userProgress.percent}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={u.role}
                    disabled={isSelf}
                    onChange={(e) => void changeRole(u.id, e.target.value as Role)}
                    className="px-2 py-1.5 text-xs border border-slate-300 rounded-md bg-white disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={isSelf}
                    onClick={() => void toggleActive(u.id, !u.isActive)}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {u.isActive ? 'Заблокировать' : 'Разблокировать'}
                  </button>

                  {isSelf && (
                    <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" aria-hidden="true" />
                      собственная запись
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function AdminBootstrapCard({
  user,
  onPromoted,
}: {
  user: SessionUser;
  onPromoted: (nextUser: SessionUser) => void;
}) {
  const [status, setStatus] = useState<AdminBootstrapStatus | null>(null);
  const [setupKey, setSetupKey] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user.role === 'admin') {
      setStatus(null);
      return;
    }
    let cancelled = false;
    identityApi
      .adminBootstrapStatus()
      .then((res) => {
        if (!cancelled) setStatus(res);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id, user.role]);

  if (user.role === 'admin' || !status) return null;
  if (!status.canClaimFirstAdmin && !status.canClaimWithSetupKey) return null;

  const handleClaim = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await identityApi.claimAdmin(status.setupKeyConfigured ? setupKey : undefined);
      setSetupKey('');
      tracker.trackCustomInteraction('Первичная активация роли администратора', 'account');
      onPromoted(res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось активировать права администратора.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      id="local-admin-bootstrap"
      className="bg-teal-50/60 border border-teal-200 rounded-xl p-6 space-y-4"
    >
      <div className="space-y-1">
        <h3 className="text-base font-bold text-slate-900 inline-flex items-center gap-2">
          <ShieldPlus className="w-4 h-4 text-teal-700" aria-hidden="true" />
          <span>Назначение прав администратора и куратора (локальный режим)</span>
        </h3>
        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
          {status.setupKeyConfigured
            ? 'На сервере задан ключ активации администратора (RCA_ADMIN_SETUP_KEY). Введите его, чтобы получить права администратора, управлять ролями (включая «Куратор РЦА») и работать с CRM-очередью заявок.'
            : 'В локальной базе ещё не назначен ни один администратор. Вы можете активировать права первого администратора для текущей учётной записи — откроется CRM-очередь заявок и панель назначения ролей («Куратор РЦА», «Администратор»). После первой активации кнопка автоматически заблокируется для остальных аккаунтов.'}
        </p>
      </div>

      {status.setupKeyConfigured ? (
        <form onSubmit={(e) => void handleClaim(e)} className="space-y-3">
          <Field label="Ключ активации администратора" htmlFor="admin-setup-key">
            <input
              id="admin-setup-key"
              type="password"
              value={setupKey}
              onChange={(e) => setSetupKey(e.target.value)}
              placeholder="Введите RCA_ADMIN_SETUP_KEY"
              autoComplete="off"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
            />
          </Field>
          {error && (
            <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !setupKey.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <ShieldPlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{busy ? 'Активация…' : 'Получить права администратора'}</span>
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          {error && (
            <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleClaim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <ShieldPlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{busy ? 'Активация…' : 'Активировать права первого администратора'}</span>
          </button>
        </div>
      )}
    </section>
  );
}
