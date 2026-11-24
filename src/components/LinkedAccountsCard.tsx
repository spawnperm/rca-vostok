import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck2,
  CheckCircle2,
  ExternalLink,
  Link2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Unlink,
  UserCheck,
} from 'lucide-react';
import { ApiError, type SessionUser } from '../utils/identityApi';
import {
  linkedAccountsApi,
  type ExamAutofillPayload,
  type LinkedAccountDTO,
  type LinkedProviderId,
  type OAuthProviderId,
  type OAuthProviderStatusDTO,
} from '../utils/linkedAccountsApi';
import { LINKED_PROVIDER_META } from '../domain/identity/LinkedAccounts';
import { buildRegionSelectOptions } from '../data/dfoRegions';
import { tracker } from '../utils/tracker';

interface LinkedAccountsCardProps {
  user: SessionUser;
  accounts: LinkedAccountDTO[];
  autofill: ExamAutofillPayload | null;
  providers: OAuthProviderStatusDTO[];
  loading: boolean;
  onUpdated: (accounts: LinkedAccountDTO[], autofill: ExamAutofillPayload | null) => void;
  onRefreshAll: () => Promise<void>;
  onJumpToCalendar: () => void;
}

const TRACK_OPTIONS = [
  'Пешеходный туризм',
  'Водный туризм',
  'Горный туризм',
  'Спелеологический туризм',
  'Пешеходный + водный туризм',
];

const PROVIDER_ORDER: readonly LinkedProviderId[] = [
  'google',
  'vk',
  'telegram',
  'yandex',
  'github',
  'rca_social',
];

const METHOD_LABEL_RU: Record<LinkedAccountDTO['connectionMethod'], string> = {
  oauth: 'Подключено через OAuth 2.0',
  profile_link: 'Привязан профиль / контакты',
  internal_social: 'Синхронизирован профиль РЦА',
};

function ProviderMark({ provider }: { provider: LinkedProviderId }) {
  if (provider === 'google') {
    return (
      <span
        className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4">
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
        </svg>
      </span>
    );
  }
  const badgeColors: Record<Exclude<LinkedProviderId, 'google'>, string> = {
    vk: 'bg-sky-600 text-white',
    telegram: 'bg-sky-500 text-white',
    yandex: 'bg-red-600 text-white',
    github: 'bg-slate-900 text-white',
    rca_social: 'bg-teal-700 text-white',
  };
  const badgeText: Record<Exclude<LinkedProviderId, 'google'>, string> = {
    vk: 'VK',
    telegram: 'TG',
    yandex: 'Я',
    github: 'GH',
    rca_social: 'РЦА',
  };
  return (
    <span
      className={`w-8 h-8 rounded-lg text-[11px] font-bold flex items-center justify-center shrink-0 ${badgeColors[provider]}`}
      aria-hidden="true"
    >
      {badgeText[provider]}
    </span>
  );
}

export const LinkedAccountsCard: React.FC<LinkedAccountsCardProps> = ({
  user,
  accounts,
  autofill,
  providers,
  loading,
  onUpdated,
  onRefreshAll,
  onJumpToCalendar,
}) => {
  const [editingProvider, setEditingProvider] = useState<LinkedProviderId | null>(null);
  const [formDisplayName, setFormDisplayName] = useState<string>(user.fullName);
  const [formEmail, setFormEmail] = useState<string>(user.email);
  const [formContact, setFormContact] = useState<string>('');
  const [formProfileUrl, setFormProfileUrl] = useState<string>('');
  const [formRegion, setFormRegion] = useState<string>(user.region);
  const [formOrganisation, setFormOrganisation] = useState<string>(user.organisation);
  const [formTrack, setFormTrack] = useState<string>(TRACK_OPTIONS[0]);
  const [formExperience, setFormExperience] = useState<string>('');
  const [busyProvider, setBusyProvider] = useState<LinkedProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const accountByProvider = useMemo(() => {
    const map = new Map<LinkedProviderId, LinkedAccountDTO>();
    for (const acc of accounts) {
      map.set(acc.provider, acc);
    }
    return map;
  }, [accounts]);

  const oauthByProvider = useMemo(() => {
    const map = new Map<OAuthProviderId, OAuthProviderStatusDTO>();
    for (const p of providers) {
      map.set(p.id, p);
    }
    return map;
  }, [providers]);

  // Listen for OAuth popup completion via postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      const data = event.data as {
        type?: string;
        provider?: LinkedProviderId;
        error?: string;
      } | null;
      if (!data || typeof data.type !== 'string') return;

      if (data.type === 'OAUTH_AUTH_SUCCESS') {
        const label = data.provider
          ? LINKED_PROVIDER_META[data.provider]?.label
          : 'Аккаунт';
        setError(null);
        setNotice(
          `${label} успешно подключён через OAuth. Данные подготовлены для автозаполнения очных экзаменов.`
        );
        void onRefreshAll();
        tracker.trackCustomInteraction(
          'Связанные профили · OAuth-подключение',
          data.provider ?? 'oauth'
        );
      } else if (data.type === 'OAUTH_AUTH_ERROR') {
        setError(data.error || 'Не удалось завершить авторизацию через внешний сервис.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onRefreshAll]);

  const openEditor = (provider: LinkedProviderId) => {
    const existing = accountByProvider.get(provider);
    setError(null);
    setNotice(null);
    setEditingProvider(provider);
    setFormDisplayName(existing?.displayName || user.fullName);
    setFormEmail(existing?.email || (provider === 'google' || provider === 'yandex' ? user.email : ''));
    setFormContact(existing?.contactChannel || '');
    setFormProfileUrl(existing?.profileUrl || '');
    setFormRegion(existing?.region || user.region);
    setFormOrganisation(existing?.organisation || user.organisation);
    setFormTrack(existing?.preferredTrack || TRACK_OPTIONS[0]);
    setFormExperience(existing?.experienceSummary || '');
  };

  const handleOAuthConnect = async (provider: OAuthProviderId) => {
    setError(null);
    setNotice(null);
    setBusyProvider(provider);
    try {
      const { url } = await linkedAccountsApi.getOAuthUrl(provider);
      const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
      if (!authWindow) {
        setError(
          'Браузер заблокировал всплывающее окно авторизации. Разрешите всплывающие окна для сайта или привяжите профиль вручную.'
        );
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Не удалось запустить OAuth-подключение.'
      );
    } finally {
      setBusyProvider(null);
    }
  };

  const handleSyncInternalSocial = async () => {
    setError(null);
    setNotice(null);
    setBusyProvider('rca_social');
    try {
      const res = await linkedAccountsApi.syncInternalSocial();
      onUpdated(res.accounts, res.autofill);
      setNotice(
        'Социальный профиль РЦА синхронизирован и выбран источником автозаполнения.'
      );
      tracker.trackCustomInteraction(
        'Связанные профили · Синхронизация профиля РЦА',
        'rca_social'
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Не удалось синхронизировать социальный профиль РЦА.'
      );
    } finally {
      setBusyProvider(null);
    }
  };

  const handleSaveManualProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProvider) return;
    setError(null);
    setNotice(null);
    setBusyProvider(editingProvider);
    try {
      const res = await linkedAccountsApi.linkProfile({
        provider: editingProvider,
        displayName: formDisplayName,
        email: formEmail,
        contactChannel: formContact,
        profileUrl: formProfileUrl,
        region: formRegion,
        organisation: formOrganisation,
        preferredTrack: formTrack,
        experienceSummary: formExperience,
        useForExamAutofill: true,
      });
      onUpdated(res.accounts, res.autofill);
      const label = LINKED_PROVIDER_META[editingProvider].label;
      setNotice(
        `Профиль «${label}» привязан к личному кабинету и активирован для автозаполнения заявок на очные экзамены.`
      );
      tracker.trackCustomInteraction('Связанные профили · Привязка профиля', editingProvider);
      setEditingProvider(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Не удалось сохранить привязку профиля.'
      );
    } finally {
      setBusyProvider(null);
    }
  };

  const handleSetAutofill = async (provider: LinkedProviderId) => {
    setError(null);
    setNotice(null);
    setBusyProvider(provider);
    try {
      const res = await linkedAccountsApi.setAutofillSource(provider, true);
      onUpdated(res.accounts, res.autofill);
      setNotice(
        `Источник «${LINKED_PROVIDER_META[provider].label}» выбран для автозаполнения регистрации на экзамены.`
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось обновить источник.');
    } finally {
      setBusyProvider(null);
    }
  };

  const handleUnlink = async (provider: LinkedProviderId) => {
    setError(null);
    setNotice(null);
    setBusyProvider(provider);
    try {
      const res = await linkedAccountsApi.unlink(provider);
      onUpdated(res.accounts, res.autofill);
      if (editingProvider === provider) {
        setEditingProvider(null);
      }
      setNotice(`Связь с «${LINKED_PROVIDER_META[provider].label}» удалена.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отвязать профиль.');
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <section
      id="account-linked-profiles"
      aria-labelledby="account-linked-profiles-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-teal-700">
            <Link2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Интеграция профиля и автозаполнение очных экзаменов</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-700">
              Связано сервисов: {accounts.length}
            </span>
          </div>
          <h3
            id="account-linked-profiles-heading"
            className="text-lg font-bold text-slate-900"
          >
            Связанные профили: Google и социальные сети
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Свяжите личный кабинет с Google-аккаунтом, социальной сетью (ВКонтакте, Telegram,
            Яндекс ID, GitHub) или профилем сообщества РЦА — ФИО, контакты, регион и
            профильное направление автоматически подставятся в форму записи на очный экзамен.
          </p>
        </div>

        <button
          type="button"
          onClick={onJumpToCalendar}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-50 border border-teal-200 text-teal-900 text-xs font-semibold rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0 self-start cursor-pointer"
        >
          <CalendarCheck2 className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
          <span>К записи на экзамен</span>
        </button>
      </div>

      {/* Active Autofill Preview */}
      {autofill ? (
        <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-bold text-teal-950 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
              <span>
                Активный источник автозаполнения: {autofill.sourceLabel} (
                {METHOD_LABEL_RU[autofill.connectionMethod]})
              </span>
            </p>
            <p className="text-xs text-teal-900 leading-relaxed">
              <span className="font-semibold">{autofill.fullName}</span> · {autofill.email} ·{' '}
              Контакт: <span className="font-medium">{autofill.contactChannel}</span> ·{' '}
              {autofill.region} · {autofill.preferredTrack}
            </p>
          </div>
          <button
            type="button"
            onClick={onJumpToCalendar}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-center cursor-pointer"
          >
            <CalendarCheck2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Записаться с автозаполнением</span>
          </button>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 leading-relaxed">
          Пока ни один внешний аккаунт не привязан. Подключите Google-аккаунт, профиль ВКонтакте,
          Telegram или синхронизируйте внутренний профиль РЦА ниже — после привязки форма
          регистрации на очные экзамены будет заполняться автоматически.
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </p>
      )}

      {/* Providers Grid */}
      {loading ? (
        <p className="text-xs text-slate-500 py-2">Загружаем привязанные профили…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {PROVIDER_ORDER.map((providerId) => {
            const meta = LINKED_PROVIDER_META[providerId];
            const linked = accountByProvider.get(providerId);
            const oauthStatus = meta.supportsOAuth
              ? oauthByProvider.get(providerId as OAuthProviderId)
              : undefined;
            const isBusy = busyProvider === providerId;
            const isAutofillActive = Boolean(linked?.useForExamAutofill);

            return (
              <div
                key={providerId}
                className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                  linked
                    ? isAutofillActive
                      ? 'border-teal-600 bg-teal-50/30'
                      : 'border-slate-300 bg-white'
                    : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ProviderMark provider={providerId} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{meta.label}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {linked
                            ? METHOD_LABEL_RU[linked.connectionMethod]
                            : meta.supportsOAuth
                              ? oauthStatus?.oauthConfigured
                                ? 'Готово OAuth-подключение'
                                : 'Привязка профиля / OAuth'
                              : 'Профиль для связи комиссии'}
                        </p>
                      </div>
                    </div>

                    {isAutofillActive && (
                      <span className="text-[11px] font-semibold text-teal-800 whitespace-nowrap shrink-0 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                        <span>Автозаполнение</span>
                      </span>
                    )}
                  </div>

                  {linked ? (
                    <div className="text-xs text-slate-700 space-y-1 bg-white/90 border border-slate-200 rounded-lg p-2.5">
                      <p className="font-semibold text-slate-900 truncate">{linked.displayName}</p>
                      <p className="text-[11px] text-slate-600 truncate">
                        Контакт: {linked.contactChannel || linked.email}
                      </p>
                      {linked.preferredTrack && (
                        <p className="text-[11px] text-slate-600 truncate">
                          Профиль: {linked.preferredTrack}
                        </p>
                      )}
                      {linked.profileUrl && (
                        <a
                          href={linked.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:underline truncate max-w-full"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{linked.profileUrl}</span>
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {providerId === 'rca_social'
                        ? 'Подтянет ФИО, организацию, регион и навыки из профиля инструктора в сообществе РЦА.'
                        : `Используйте ${meta.shortLabel} для быстрого автозаполнения заявок и связи с комиссией.`}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/80">
                  {providerId === 'rca_social' ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={handleSyncInternalSocial}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                    >
                      <RefreshCw className="w-3 h-3" aria-hidden="true" />
                      <span>{linked ? 'Обновить из РЦА' : 'Синхронизировать'}</span>
                    </button>
                  ) : (
                    <>
                      {meta.supportsOAuth && oauthStatus?.oauthConfigured && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void handleOAuthConnect(providerId as OAuthProviderId)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                        >
                          <ShieldCheck className="w-3 h-3 text-teal-300" aria-hidden="true" />
                          <span>{linked ? 'Переподключить OAuth' : 'Подключить OAuth'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openEditor(providerId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                      >
                        <UserCheck className="w-3 h-3 text-teal-700" aria-hidden="true" />
                        <span>{linked ? 'Изменить' : 'Привязать профиль'}</span>
                      </button>
                    </>
                  )}

                  {linked && !isAutofillActive && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleSetAutofill(providerId)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-teal-50 border border-teal-200 hover:bg-teal-100 text-teal-900 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" aria-hidden="true" />
                      <span>Для экзаменов</span>
                    </button>
                  )}

                  {linked && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleUnlink(providerId)}
                      aria-label={`Отвязать ${meta.label}`}
                      className="inline-flex items-center gap-1 px-2 py-1.5 text-slate-500 hover:text-red-700 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ml-auto"
                    >
                      {isBusy ? (
                        <span>…</span>
                      ) : (
                        <>
                          <Unlink className="w-3 h-3" aria-hidden="true" />
                          <span>Отвязать</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inline Bind / Edit Form */}
      {editingProvider && (
        <form
          onSubmit={handleSaveManualProfile}
          className="bg-slate-50 border border-slate-300 rounded-xl p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ProviderMark provider={editingProvider} />
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Привязка данных: {LINKED_PROVIDER_META[editingProvider].label}
                </h4>
                <p className="text-[11px] text-slate-600">
                  Укажите сведения профиля для автоматического заполнения заявок на очные экзамены.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditingProvider(null)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Закрыть
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label
                htmlFor="linked-display-name"
                className="block text-xs font-medium text-slate-700"
              >
                ФИО для протокола экзамена
              </label>
              <input
                id="linked-display-name"
                type="text"
                value={formDisplayName}
                onChange={(e) => setFormDisplayName(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="linked-email"
                className="block text-xs font-medium text-slate-700"
              >
                Email из аккаунта (необязательно для мессенджеров)
              </label>
              <input
                id="linked-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="guide@gmail.com"
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="linked-contact"
                className="block text-xs font-medium text-slate-700"
              >
                Никнейм / телефон / канал связи
              </label>
              <input
                id="linked-contact"
                type="text"
                value={formContact}
                onChange={(e) => setFormContact(e.target.value)}
                placeholder={LINKED_PROVIDER_META[editingProvider].contactHint}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="linked-profile-url"
                className="block text-xs font-medium text-slate-700"
              >
                Ссылка на профиль в соцсети (необязательно)
              </label>
              <input
                id="linked-profile-url"
                type="url"
                value={formProfileUrl}
                onChange={(e) => setFormProfileUrl(e.target.value)}
                placeholder={LINKED_PROVIDER_META[editingProvider].placeholderUrl || 'https://...'}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="linked-region"
                className="block text-xs font-medium text-slate-700"
              >
                Субъект ДФО
              </label>
              <select
                id="linked-region"
                value={formRegion}
                onChange={(e) => setFormRegion(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              >
                {buildRegionSelectOptions(formRegion).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="linked-track"
                className="block text-xs font-medium text-slate-700"
              >
                Основное направление аттестации
              </label>
              <select
                id="linked-track"
                value={formTrack}
                onChange={(e) => setFormTrack(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              >
                {TRACK_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="linked-organisation"
                className="block text-xs font-medium text-slate-700"
              >
                Организация / турклуб
              </label>
              <input
                id="linked-organisation"
                type="text"
                value={formOrganisation}
                onChange={(e) => setFormOrganisation(e.target.value)}
                placeholder="Турклуб, ООПТ, туроператор"
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="linked-experience"
                className="block text-xs font-medium text-slate-700"
              >
                Кратко о категории и стаже (для автозаполнения)
              </label>
              <input
                id="linked-experience"
                type="text"
                value={formExperience}
                onChange={(e) => setFormExperience(e.target.value)}
                placeholder="Например: 2 КС, стаж 4 года, контур Б"
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={busyProvider === editingProvider}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-60"
            >
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {busyProvider === editingProvider
                  ? 'Сохраняем…'
                  : 'Сохранить и включить автозаполнение'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setEditingProvider(null)}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Отмена
            </button>
          </div>
        </form>
      )}
    </section>
  );
};
