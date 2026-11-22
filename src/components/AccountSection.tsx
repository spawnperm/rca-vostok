import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  LogIn,
  LogOut,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  UserRound,
  Users,
  KeyRound,
  Save,
} from 'lucide-react';
import { tracker } from '../utils/tracker';
import { SocialProfileSection } from './social/SocialProfileSection';
import { MyInquiriesSection, type InquiryRecord } from './social/MyInquiriesSection';
import { ForgotPasswordForm, ResetPasswordForm } from './social/PasswordRecovery';
import {
  AttestationProgressWidget,
  computeUserAttestationSummary,
  type UserAttestationSummary,
} from './AttestationProgressWidget';
import { PersonalRoadmapWidget } from './PersonalRoadmapWidget';
import { NotificationCenterWidget } from './NotificationCenterWidget';
import { CenterReviewForm } from './CenterReviewForm';
import { ReviewStatsWidget } from './ReviewStatsWidget';
import {
  ApiError,
  ROLE_LABELS,
  identityApi,
  type Role,
  type SessionUser,
} from '../utils/identityApi';
import type { SiteTabId } from '../utils/seo';

type AuthMode = 'login' | 'register';

const REGIONS = [
  'Приморский край',
  'Камчатский край',
  'Хабаровский край',
  'Сахалинская область',
  'Республика Саха (Якутия)',
  'Амурская область',
  'Магаданская область',
  'Чукотский АО',
];

function hasPermission(user: SessionUser | null, permission: string): boolean {
  return Boolean(user?.permissions?.includes(permission));
}

export function AccountSection({ onNavigate }: { onNavigate?: (tab: SiteTabId) => void } = {}) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  /** Password recovery views: null = normal auth, 'forgot' = request, string = reset token. */
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState<boolean>(false);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [inquiriesLoading, setInquiriesLoading] = useState<boolean>(false);
  const [inquiriesError, setInquiriesError] = useState<string | null>(null);
  const [liveProgressSummary, setLiveProgressSummary] = useState<UserAttestationSummary | null>(
    null
  );
  const [selectedExamDate, setSelectedExamDate] = useState<string | undefined>(undefined);
  const [reviewsRefreshKey, setReviewsRefreshKey] = useState<number>(0);

  // A reset link lands on ?tab=account&reset=<token>, so the cabinet opens
  // straight into the "set a new password" step.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('reset');
      if (token) setResetToken(token);
    } catch {
      // ignore malformed URLs
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    identityApi
      .session()
      .then((res) => {
        if (!cancelled) setUser(res.authenticated && res.user ? res.user : null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadInquiries = useCallback(async () => {
    setInquiriesLoading(true);
    try {
      const res = await fetch('/api/account/inquiries', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const data = (await res.json()) as { inquiries?: InquiryRecord[]; error?: string };
      if (!res.ok) {
        setInquiriesError(data.error || 'Не удалось загрузить заявки.');
        return;
      }
      setInquiries(data.inquiries ?? []);
      setInquiriesError(null);
    } catch {
      setInquiriesError('Не удалось загрузить заявки.');
    } finally {
      setInquiriesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && hasPermission(user, 'inquiries:view_own')) {
      void loadInquiries();
    } else {
      setInquiries([]);
      setInquiriesError(null);
      setInquiriesLoading(false);
    }
  }, [user, loadInquiries]);

  const handleAuthenticated = useCallback((next: SessionUser) => {
    setUser(next);
    setLoading(false);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await identityApi.logout();
    } finally {
      setUser(null);
      setInquiries([]);
      tracker.trackCustomInteraction('Выход из личного кабинета', 'account');
    }
  }, []);

  const clearResetToken = useCallback(() => {
    setResetToken(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('reset');
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  }, []);

  if (loading) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl p-8">
        <p className="text-sm text-slate-500">Проверяем сессию…</p>
      </section>
    );
  }

  // Recovery flows take precedence over the normal auth panel.
  if (resetToken) {
    return <ResetPasswordForm token={resetToken} onDone={clearResetToken} />;
  }
  if (showForgot) {
    return <ForgotPasswordForm onBack={() => setShowForgot(false)} />;
  }

  if (!user) {
    return (
      <AuthPanel
        mode={authMode}
        onModeChange={setAuthMode}
        onAuthenticated={handleAuthenticated}
        onForgotPassword={() => setShowForgot(true)}
      />
    );
  }

  const effectiveProgressSummary =
    liveProgressSummary ?? computeUserAttestationSummary(user, inquiries);

  return (
    <div className="space-y-6">
      <CabinetHeader user={user} onLogout={handleLogout} />
      <AttestationProgressWidget
        user={user}
        inquiries={inquiries}
        inquiriesLoading={inquiriesLoading}
        selectedExamDate={selectedExamDate}
        onSummaryChange={setLiveProgressSummary}
        onRefreshInquiries={
          hasPermission(user, 'inquiries:view_own') ? () => void loadInquiries() : undefined
        }
        onOpenApplication={onNavigate ? () => onNavigate('overview') : undefined}
      />
      <PersonalRoadmapWidget
        user={user}
        summary={effectiveProgressSummary}
        onExamDateChange={setSelectedExamDate}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <NotificationCenterWidget
            user={user}
            inquiries={inquiries}
            inquiriesLoading={inquiriesLoading}
            onRefreshInquiries={
              hasPermission(user, 'inquiries:view_own') ? () => void loadInquiries() : undefined
            }
            onOpenOverview={onNavigate ? () => onNavigate('overview') : undefined}
          />
          <ProfileCard user={user} onUpdated={handleAuthenticated} />
          <MyInquiriesSection
            canView={hasPermission(user, 'inquiries:view_own')}
            inquiries={inquiries}
            loading={inquiriesLoading}
            error={inquiriesError}
            onRefresh={() => void loadInquiries()}
          />
          <ReviewStatsWidget refreshKey={reviewsRefreshKey} />
          <CenterReviewForm
            user={user}
            onSubmitted={() => setReviewsRefreshKey((k) => k + 1)}
          />
          <PasswordCard onChanged={() => setUser(null)} />
        </div>
        <div className="space-y-6">
          <PermissionsCard user={user} />
          {hasPermission(user, 'users:manage') && <UserAdminCard currentUserId={user.id} />}
        </div>
      </div>

      {/* Social profile: feed, blog, chat and media library */}
      <SocialProfileSection
        userId={user.id}
        currentUserId={user.id}
        permissions={user.permissions}
      />
    </div>
  );
}

// ── Authentication ──────────────────────────────────────────────────────────

function AuthPanel({
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
  const [region, setRegion] = useState<string>(REGIONS[0]);
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
      aria-labelledby="account-auth-heading"
      className="bg-white border border-slate-200 rounded-xl p-8"
    >
      <div className="max-w-md mx-auto space-y-6">
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
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                mode === m ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
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
                  {REGIONS.map((r) => (
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
            <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
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

function Field({
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

// ── Cabinet header ──────────────────────────────────────────────────────────

function CabinetHeader({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
            <UserRound className="w-7 h-7 text-teal-700" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900">{user.fullName}</h2>
            <p className="text-sm text-slate-600">{user.email}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold rounded-md">
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                {ROLE_LABELS[user.role]}
              </span>
              <span className="text-xs text-slate-500">{user.region}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          Выйти
        </button>
      </div>
    </section>
  );
}

// ── Profile ─────────────────────────────────────────────────────────────────

function ProfileCard({
  user,
  onUpdated,
}: {
  user: SessionUser;
  onUpdated: (user: SessionUser) => void;
}) {
  const [fullName, setFullName] = useState<string>(user.fullName);
  const [region, setRegion] = useState<string>(user.region);
  const [organisation, setOrganisation] = useState<string>(user.organisation);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(user.fullName);
    setRegion(user.region);
    setOrganisation(user.organisation);
  }, [user]);

  const canEdit = user.permissions.includes('profile:edit_own');

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus('saving');
    try {
      const updated = await identityApi.updateProfile({ fullName, region, organisation });
      onUpdated(updated);
      setStatus('saved');
      tracker.trackCustomInteraction('Обновление профиля', 'account');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить профиль.');
      setStatus('idle');
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="space-y-1">
        <h3 className="text-base font-bold text-slate-900">Профиль</h3>
        <p className="text-sm text-slate-600">
          Данные используются при подготовке заявок и уведомлений об аттестации.
        </p>
      </div>

      <form onSubmit={save} className="space-y-4">
        <Field label="ФИО" htmlFor="profile-fullname">
          <input
            id="profile-fullname"
            type="text"
            value={fullName}
            disabled={!canEdit}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </Field>

        <Field label="Электронная почта" htmlFor="profile-email" hint="Адрес входа изменить нельзя">
          <input
            id="profile-email"
            type="email"
            value={user.email}
            readOnly
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Регион" htmlFor="profile-region">
            <select
              id="profile-region"
              value={region}
              disabled={!canEdit}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-500"
            >
              {[...new Set([region, ...REGIONS])].filter(Boolean).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Организация" htmlFor="profile-organisation">
            <input
              id="profile-organisation"
              type="text"
              value={organisation}
              disabled={!canEdit}
              onChange={(e) => setOrganisation(e.target.value)}
              placeholder="Турклуб, ООПТ, туроператор"
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </Field>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {canEdit && (
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={status === 'saving'}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-60 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              {status === 'saving' ? 'Сохраняем…' : 'Сохранить'}
            </button>
            {status === 'saved' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                Изменения сохранены
              </span>
            )}
          </div>
        )}
      </form>
    </section>
  );
}

// ── Password ────────────────────────────────────────────────────────────────

function PasswordCard({ onChanged }: { onChanged: () => void }) {
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
      // The server invalidates all sessions, so the UI must sign out too.
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
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-300 text-slate-800 text-sm font-semibold rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-60 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <KeyRound className="w-4 h-4" aria-hidden="true" />
          {busy ? 'Обновляем…' : 'Изменить пароль'}
        </button>
      </form>
    </section>
  );
}

// ── Permissions ─────────────────────────────────────────────────────────────

function PermissionsCard({ user }: { user: SessionUser }) {
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

// ── Admin: user management ──────────────────────────────────────────────────

function UserAdminCard({ currentUserId }: { currentUserId: string }) {
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
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
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

                {/* Compact per-user attestation progress bar */}
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
