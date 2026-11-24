import React, { useState } from 'react';
import { LogIn, UserPlus, UserRound } from 'lucide-react';
import { DFO_REGIONS } from '../../data/dfoRegions';
import { ApiError, identityApi, type SessionUser } from '../../utils/identityApi';
import { tracker } from '../../utils/tracker';

export type AuthMode = 'login' | 'register';

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

export function AuthPanel({
  mode,
  onModeChange,
  onAuthenticated,
  onForgotPassword,
}: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onAuthenticated: (user: SessionUser) => void;
  onForgotPassword: () => void;
}) {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [region, setRegion] = useState<string>(DFO_REGIONS[0]);
  const [organisation, setOrganisation] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const isRegister = mode === 'register';

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Укажите адрес электронной почты.');
      return;
    }
    if (!password) {
      setError('Введите пароль.');
      return;
    }
    if (isRegister && fullName.trim().length < 2) {
      setError('Укажите ФИО (не менее 2 символов).');
      return;
    }

    setBusy(true);
    try {
      const res = isRegister
        ? await identityApi.register({
            email: email.trim(),
            password,
            fullName: fullName.trim(),
            region,
            organisation: organisation.trim(),
          })
        : await identityApi.login(email.trim(), password);

      onAuthenticated(res.user);
      tracker.trackCustomInteraction(
        isRegister ? 'Регистрация в личном кабинете' : 'Вход в личный кабинет',
        'account'
      );
      setPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось выполнить запрос.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      id="account-auth-panel"
      aria-labelledby="account-auth-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 scroll-mt-24"
    >
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal-50 border border-teal-200">
            <UserRound className="w-6 h-6 text-teal-700" aria-hidden="true" />
          </div>
          <h2 id="account-auth-heading" className="text-xl font-bold text-slate-900">
            {isRegister ? 'Регистрация' : 'Вход в личный кабинет'}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {isRegister
              ? 'Создайте учётную запись, чтобы отслеживать заявки на аттестацию и статус проводника.'
              : 'Доступ к заявкам, статусу аттестации и персональным настройкам.'}
          </p>
        </div>

        <div className="flex rounded-lg border border-slate-200 p-1 bg-slate-50" role="tablist">
          {(['login', 'register'] as AuthMode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                onModeChange(m);
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                mode === m
                  ? 'bg-white text-teal-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {m === 'login' ? 'Вход' : 'Регистрация'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} noValidate className="space-y-4">
          {isRegister && (
            <Field label="ФИО" htmlFor="reg-fullname">
              <input
                id="reg-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Иванов Иван Иванович"
                autoComplete="name"
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </Field>
          )}

          <Field label="Электронная почта" htmlFor="auth-email">
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="guide@example.ru"
              autoComplete="email"
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </Field>

          <Field
            label="Пароль"
            htmlFor="auth-password"
            hint={isRegister ? 'Не менее 10 символов, буквы и цифры' : undefined}
          >
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </Field>

          {isRegister && (
            <>
              <Field label="Регион" htmlFor="reg-region">
                <select
                  id="reg-region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                >
                  {DFO_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Организация (необязательно)" htmlFor="reg-organisation">
                <input
                  id="reg-organisation"
                  type="text"
                  value={organisation}
                  onChange={(e) => setOrganisation(e.target.value)}
                  placeholder="Турклуб, ООПТ, туроператор"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </Field>
            </>
          )}

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
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            {isRegister ? (
              <UserPlus className="w-4 h-4" aria-hidden="true" />
            ) : (
              <LogIn className="w-4 h-4" aria-hidden="true" />
            )}
            {busy ? 'Выполняется…' : isRegister ? 'Создать учётную запись' : 'Войти'}
          </button>

          {!isRegister && (
            <button
              type="button"
              onClick={onForgotPassword}
              className="w-full text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Забыли пароль?
            </button>
          )}
        </form>
      </div>
    </section>
  );
}
