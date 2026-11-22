import React, { useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, Mail } from 'lucide-react';

/**
 * Password recovery UI.
 *
 * Two modes driven by the URL: requesting a link (`/forgot-password`) and
 * completing it (`?reset=<token>`). The link in the email points at
 * `/?tab=account&reset=<token>`, so `AccountSection` routes here when that
 * parameter is present.
 */

const FORGOT_ENDPOINT = '/api/auth/forgot-password';
const RESET_ENDPOINT = '/api/auth/reset-password';

function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
    >
      {message}
    </p>
  );
}

/** Step 1: ask for the email and request a link. */
export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<boolean>(false);
  const [delivered, setDelivered] = useState<boolean | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Укажите адрес электронной почты.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(FORGOT_ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        delivered?: boolean;
      };

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Не удалось отправить письмо.');
      }

      setSent(true);
      setDelivered(data.delivered ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить письмо.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl p-8">
        <div className="max-w-md mx-auto space-y-4 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal-50 border border-teal-200">
            <Mail className="w-6 h-6 text-teal-700" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Проверьте почту</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Если адрес <span className="font-medium">{email}</span> зарегистрирован, мы отправили
            ссылку для восстановления пароля. Она действует 15 минут.
          </p>

          {delivered === false && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-left">
              Отправка писем на этом сервере пока не настроена, поэтому письмо не уйдёт.
              Свяжитесь с администратором платформы — он восстановит доступ вручную.
            </p>
          )}

          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Вернуться ко входу
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-8">
      <div className="max-w-md mx-auto space-y-6">
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal-50 border border-teal-200">
            <KeyRound className="w-6 h-6 text-teal-700" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Восстановление пароля</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Укажите адрес электронной почты, привязанный к аккаунту — мы отправим ссылку для
            смены пароля.
          </p>
        </div>

        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="forgot-email" className="block text-xs font-medium text-slate-700">
              Электронная почта
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="guide@example.ru"
              autoComplete="email"
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </div>

          {error && <ErrorNote message={error} />}

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
          >
            <Mail className="w-4 h-4" aria-hidden="true" />
            {busy ? 'Отправляем…' : 'Отправить ссылку'}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="w-full text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Вернуться ко входу
          </button>
        </form>
      </div>
    </section>
  );
}

/** Step 2: set a new password using the token from the email. */
export function ResetPasswordForm({
  token,
  onDone,
}: {
  token: string;
  onDone: () => void;
}) {
  const [password, setPassword] = useState<string>('');
  const [repeat, setRepeat] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<boolean>(false);

  useEffect(() => {
    setError(null);
  }, [token]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.length < 10) {
      setError('Пароль должен содержать не менее 10 символов.');
      return;
    }
    if (password !== repeat) {
      setError('Пароли не совпадают.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(RESET_ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Не удалось изменить пароль.');
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить пароль.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl p-8">
        <div className="max-w-md mx-auto space-y-4 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal-50 border border-teal-200">
            <KeyRound className="w-6 h-6 text-teal-700" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Пароль изменён</h2>
          <p className="text-sm text-slate-600">
            Все активные сеансы завершены. Войдите с новым паролем.
          </p>
          <button
            type="button"
            onClick={onDone}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            К входу
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-8">
      <div className="max-w-md mx-auto space-y-6">
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal-50 border border-teal-200">
            <KeyRound className="w-6 h-6 text-teal-700" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Новый пароль</h2>
          <p className="text-sm text-slate-600">
            Придумайте пароль: не менее 10 символов, буквы и цифры.
          </p>
        </div>

        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="reset-password" className="block text-xs font-medium text-slate-700">
              Новый пароль
            </label>
            <input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reset-repeat" className="block text-xs font-medium text-slate-700">
              Повторите пароль
            </label>
            <input
              id="reset-repeat"
              type="password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              autoComplete="new-password"
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </div>

          {error && <ErrorNote message={error} />}

          <button
            type="submit"
            disabled={busy}
            className="w-full px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
          >
            {busy ? 'Сохраняем…' : 'Сохранить пароль'}
          </button>
        </form>
      </div>
    </section>
  );
}
