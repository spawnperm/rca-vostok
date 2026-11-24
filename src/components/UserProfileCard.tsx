import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Building2,
  CalendarClock,
  CheckCircle2,
  Compass,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import {
  EXPERIENCE_JOURNAL_UPDATED_EVENT,
  experienceJournalGateway,
  readStoredExperienceJournal,
  type ExperienceLogEntry,
} from '../utils/experienceJournal';
import {
  ApiError,
  ROLE_LABELS,
  identityApi,
  type SessionUser,
} from '../utils/identityApi';
import {
  SELF_CHECK_UPDATED_EVENT,
  evaluateSelfCheck,
  readStoredSelfCheck,
  type SelfCheckEvaluation,
} from '../utils/qualificationSelfCheck';
import { tracker } from '../utils/tracker';
import {
  resolveUserQualificationProfile,
  type UserQualificationLevelId,
} from '../utils/updatesFeed';

const DFO_REGIONS = [
  'Приморский край',
  'Камчатский край',
  'Хабаровский край',
  'Сахалинская область',
  'Республика Саха (Якутия)',
  'Амурская область',
  'Магаданская область',
  'Чукотский АО',
];

interface UserProfileCardProps {
  user: SessionUser;
  attestationPercent: number;
  selfCheckRevision?: number;
  onUpdated: (user: SessionUser) => void;
  onJumpToPreparation?: () => void;
  onJumpToExperience?: () => void;
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'П';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function getLevelBadgeStyles(level: UserQualificationLevelId): {
  cardBorder: string;
  cardBg: string;
  badgeClass: string;
  iconClass: string;
} {
  switch (level) {
    case 'advanced':
      return {
        cardBorder: 'border-emerald-200',
        cardBg: 'bg-emerald-50/70',
        badgeClass: 'bg-emerald-700 text-white border-emerald-700',
        iconClass: 'text-emerald-700',
      };
    case 'intermediate':
      return {
        cardBorder: 'border-teal-200',
        cardBg: 'bg-teal-50/70',
        badgeClass: 'bg-teal-700 text-white border-teal-700',
        iconClass: 'text-teal-700',
      };
    case 'novice':
    default:
      return {
        cardBorder: 'border-slate-200',
        cardBg: 'bg-slate-50/90',
        badgeClass: 'bg-slate-800 text-white border-slate-800',
        iconClass: 'text-slate-700',
      };
  }
}

export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  user,
  attestationPercent,
  selfCheckRevision = 0,
  onUpdated,
  onJumpToPreparation,
  onJumpToExperience,
}) => {
  const [journalEntries, setJournalEntries] = useState<ExperienceLogEntry[]>(() =>
    readStoredExperienceJournal(user.id, user.region)
  );
  const [selfCheck, setSelfCheck] = useState<SelfCheckEvaluation>(() => {
    const stored = readStoredSelfCheck(user.id);
    return evaluateSelfCheck(stored.answers, stored.track);
  });

  const [isEditingContacts, setIsEditingContacts] = useState<boolean>(false);
  const [phoneDraft, setPhoneDraft] = useState<string>(user.phone ?? '');
  const [telegramDraft, setTelegramDraft] = useState<string>(user.telegram ?? '');
  const [regionDraft, setRegionDraft] = useState<string>(user.region);
  const [organisationDraft, setOrganisationDraft] = useState<string>(user.organisation ?? '');
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  const canEdit = user.permissions.includes('profile:edit_own');

  useEffect(() => {
    setPhoneDraft(user.phone ?? '');
    setTelegramDraft(user.telegram ?? '');
    setRegionDraft(user.region);
    setOrganisationDraft(user.organisation ?? '');
  }, [user.phone, user.telegram, user.region, user.organisation]);

  useEffect(() => {
    let cancelled = false;
    setJournalEntries(readStoredExperienceJournal(user.id, user.region));
    void experienceJournalGateway
      .load(user.id, user.region)
      .then((loaded) => {
        if (!cancelled) setJournalEntries(loaded);
      })
      .catch(() => {
        // local storage fallback already loaded
      });

    const syncSelfCheck = () => {
      const stored = readStoredSelfCheck(user.id);
      setSelfCheck(evaluateSelfCheck(stored.answers, stored.track));
    };
    syncSelfCheck();

    const onJournalUpdated = () => {
      setJournalEntries(readStoredExperienceJournal(user.id, user.region));
    };

    window.addEventListener(EXPERIENCE_JOURNAL_UPDATED_EVENT, onJournalUpdated);
    window.addEventListener(SELF_CHECK_UPDATED_EVENT, syncSelfCheck);
    return () => {
      cancelled = true;
      window.removeEventListener(EXPERIENCE_JOURNAL_UPDATED_EVENT, onJournalUpdated);
      window.removeEventListener(SELF_CHECK_UPDATED_EVENT, syncSelfCheck);
    };
  }, [user.id, user.region, selfCheckRevision]);

  const qualification = useMemo(
    () =>
      resolveUserQualificationProfile({
        user,
        attestationPercent,
        selfCheck,
        journalEntries,
      }),
    [user, attestationPercent, selfCheck, journalEntries]
  );

  const levelStyles = getLevelBadgeStyles(qualification.level);

  const handleOpenEditContacts = () => {
    setPhoneDraft(user.phone ?? '');
    setTelegramDraft(user.telegram ?? '');
    setRegionDraft(user.region);
    setOrganisationDraft(user.organisation ?? '');
    setSaveError(null);
    setSavedNotice(false);
    setIsEditingContacts(true);
    tracker.trackCustomInteraction(
      'Профиль пользователя · Открыть редактирование контактов',
      'account'
    );
  };

  const handleCancelEdit = () => {
    setPhoneDraft(user.phone ?? '');
    setTelegramDraft(user.telegram ?? '');
    setRegionDraft(user.region);
    setOrganisationDraft(user.organisation ?? '');
    setSaveError(null);
    setIsEditingContacts(false);
  };

  const handleSaveContacts = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError(null);
    setSavedNotice(false);
    setSaving(true);
    try {
      const updated = await identityApi.updateProfile({
        phone: phoneDraft.trim(),
        telegram: telegramDraft.trim(),
        region: regionDraft,
        organisation: organisationDraft.trim(),
      });
      onUpdated(updated);
      setIsEditingContacts(false);
      setSavedNotice(true);
      tracker.trackCustomInteraction(
        'Профиль пользователя · Контактные данные обновлены',
        'account'
      );
      window.setTimeout(() => setSavedNotice(false), 3500);
    } catch (err) {
      setSaveError(
        err instanceof ApiError ? err.message : 'Не удалось сохранить контактные данные.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      id="user-profile-overview-card"
      aria-labelledby="user-profile-overview-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 scroll-mt-24"
    >
      {/* Top Row: Avatar + Full Name + Edit Contacts Button */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            aria-hidden="true"
            className="w-14 h-14 rounded-xl bg-teal-700 text-white flex items-center justify-center text-lg font-bold tracking-tight shrink-0"
          >
            {getInitials(user.fullName)}
          </div>

          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded text-[11px] font-bold uppercase tracking-wider">
                <UserRound className="w-3 h-3" aria-hidden="true" />
                Профиль пользователя
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-semibold">
                <ShieldCheck className="w-3 h-3 text-teal-700" aria-hidden="true" />
                {ROLE_LABELS[user.role]}
              </span>
            </div>

            <h2
              id="user-profile-overview-heading"
              className="text-xl font-bold text-slate-900 leading-snug break-words"
            >
              {user.fullName}
            </h2>

            <p className="text-xs text-slate-500">
              {user.organisation
                ? `${user.organisation} · ${user.region}`
                : `${user.region} · Личный кабинет участника РЦА`}
            </p>
          </div>
        </div>

        {canEdit && !isEditingContacts && (
          <button
            type="button"
            onClick={handleOpenEditContacts}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Редактировать контактные данные</span>
          </button>
        )}
      </div>

      {savedNotice && (
        <div
          role="status"
          className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-900"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
          <span>Контактные данные успешно обновлены и сохранены в профиле.</span>
        </div>
      )}

      {/* Main Content Grid: Qualification Block + Contact Details Block */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Current Qualification (Guide Level) */}
        <div
          className={`lg:col-span-6 p-4 rounded-xl border space-y-3 ${levelStyles.cardBg} ${levelStyles.cardBorder}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-800">
              <Award className={`w-4 h-4 ${levelStyles.iconClass}`} aria-hidden="true" />
              <span>Текущая квалификация</span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-md border text-[11px] font-mono font-bold ${levelStyles.badgeClass}`}
            >
              Уровень: {qualification.complexityRange}
            </span>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-900">{qualification.label}</p>
            <p className="text-xs text-slate-600 leading-relaxed">{qualification.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {qualification.reasons.map((reason, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-0.5 bg-white/90 border border-slate-200 rounded text-[11px] text-slate-700"
              >
                {reason}
              </span>
            ))}
            {user.attestationExpiresAt && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/90 border border-slate-200 rounded text-[11px] font-mono text-slate-700">
                <CalendarClock className="w-3 h-3 text-teal-700" aria-hidden="true" />
                до {new Date(`${user.attestationExpiresAt}T00:00:00`).toLocaleDateString('ru-RU')}
              </span>
            )}
          </div>

          {(onJumpToPreparation || onJumpToExperience) && (
            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-200/70">
              {onJumpToPreparation && (
                <button
                  type="button"
                  onClick={onJumpToPreparation}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:text-teal-950 cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Самопроверка квалификации ({selfCheck.readinessPercent}%)</span>
                </button>
              )}
              {onJumpToExperience && (
                <button
                  type="button"
                  onClick={onJumpToExperience}
                  className="text-xs font-semibold text-slate-700 hover:text-slate-950 cursor-pointer"
                >
                  Походов в журнале: {journalEntries.length}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Contact Details (View or Inline Edit Mode) */}
        <div className="lg:col-span-6 p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">
              Контактные данные для связи с РЦА
            </h3>
            {isEditingContacts && (
              <button
                type="button"
                onClick={handleCancelEdit}
                aria-label="Закрыть форму редактирования контактов"
                className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-200/60 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {!isEditingContacts ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-0.5">
                <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  <Phone className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>Телефон</span>
                </dt>
                <dd className="font-semibold text-slate-900 font-mono">
                  {user.phone ? user.phone : <span className="text-slate-400 font-sans font-normal">Не указан</span>}
                </dd>
              </div>

              <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-0.5">
                <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  <MessageCircle className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>Telegram</span>
                </dt>
                <dd className="font-semibold text-slate-900">
                  {user.telegram ? user.telegram : <span className="text-slate-400 font-normal">Не указан</span>}
                </dd>
              </div>

              <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-0.5">
                <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  <Mail className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>Электронная почта</span>
                </dt>
                <dd className="font-semibold text-slate-900 truncate" title={user.email}>
                  {user.email}
                </dd>
              </div>

              <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-0.5">
                <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>Регион ДФО</span>
                </dt>
                <dd className="font-semibold text-slate-900">{user.region}</dd>
              </div>

              <div className="sm:col-span-2 p-2.5 bg-white border border-slate-200 rounded-lg space-y-0.5">
                <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  <Building2 className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>Организация / турклуб</span>
                </dt>
                <dd className="font-semibold text-slate-900">
                  {user.organisation ? (
                    user.organisation
                  ) : (
                    <span className="text-slate-400 font-normal">Не указана</span>
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <form onSubmit={handleSaveContacts} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="contact-edit-phone" className="block text-[11px] font-semibold text-slate-700">
                    Телефон
                  </label>
                  <input
                    id="contact-edit-phone"
                    type="tel"
                    value={phoneDraft}
                    onChange={(e) => setPhoneDraft(e.target.value)}
                    placeholder="+7 (999) 123-45-67"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="contact-edit-telegram" className="block text-[11px] font-semibold text-slate-700">
                    Telegram
                  </label>
                  <input
                    id="contact-edit-telegram"
                    type="text"
                    value={telegramDraft}
                    onChange={(e) => setTelegramDraft(e.target.value)}
                    placeholder="@guide_vostok"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="contact-edit-region" className="block text-[11px] font-semibold text-slate-700">
                    Регион ДФО
                  </label>
                  <select
                    id="contact-edit-region"
                    value={regionDraft}
                    onChange={(e) => setRegionDraft(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  >
                    {[...new Set([regionDraft, ...DFO_REGIONS])].filter(Boolean).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="contact-edit-org" className="block text-[11px] font-semibold text-slate-700">
                    Организация / турклуб
                  </label>
                  <input
                    id="contact-edit-org"
                    type="text"
                    value={organisationDraft}
                    onChange={(e) => setOrganisationDraft(e.target.value)}
                    placeholder="Турклуб, ООПТ, туроператор"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                Основной e-mail (<span className="font-mono">{user.email}</span>) закреплён за
                учётной записью для входа и уведомлений.
              </p>

              {saveError && (
                <p
                  role="alert"
                  className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                >
                  {saveError}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{saving ? 'Сохраняем…' : 'Сохранить контакты'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Отмена
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};
