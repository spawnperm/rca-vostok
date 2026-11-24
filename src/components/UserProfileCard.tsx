import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Building2,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  Compass,
  Download,
  Eye,
  FileDown,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
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
import {
  generateUserProfileCommissionPdf,
  type GeneratedUserProfilePdfResult,
} from '../utils/userProfileCommissionPdf';

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

export const GENERATED_GUIDE_AVATAR_PRESETS: readonly {
  id: string;
  title: string;
  trackHint: string;
  url: string;
}[] = [
  {
    id: 'taiga',
    title: 'Таёжно-горный маршрут',
    trackHint: 'Сихотэ-Алинь · треккинг',
    url: '/src/assets/images/guide_portrait_taiga_1795488166052.jpg',
  },
  {
    id: 'eco',
    title: 'Экотропы и побережье',
    trackHint: 'ООПТ · береговые маршруты',
    url: '/src/assets/images/guide_portrait_eco_1795488165693.jpg',
  },
  {
    id: 'kamchatka',
    title: 'Вулканы и высокогорье',
    trackHint: 'Камчатка · экспедиции 3–5 КС',
    url: '/src/assets/images/guide_portrait_kamchatka_1795488166702.jpg',
  },
  {
    id: 'water',
    title: 'Водный туризм и сплавы',
    trackHint: 'Горные реки · морской каякинг',
    url: '/src/assets/images/guide_portrait_water_1795488167929.jpg',
  },
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

async function compressAvatarFileToDataUrl(file: File): Promise<string> {
  if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
    throw new Error('Поддерживаются только изображения JPEG, PNG или WebP.');
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Не удалось прочитать выбранное изображение.'));
      el.src = objectUrl;
    });

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Браузер не поддерживает обработку изображений Canvas.');
    }

    const scale = Math.max(size / img.width, size / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
    if (dataUrl.length > 180_000) {
      return canvas.toDataURL('image/jpeg', 0.72);
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
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

  // Contacts edit state
  const [isEditingContacts, setIsEditingContacts] = useState<boolean>(false);
  const [phoneDraft, setPhoneDraft] = useState<string>(user.phone ?? '');
  const [telegramDraft, setTelegramDraft] = useState<string>(user.telegram ?? '');
  const [regionDraft, setRegionDraft] = useState<string>(user.region);
  const [organisationDraft, setOrganisationDraft] = useState<string>(user.organisation ?? '');
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Avatar studio state
  const [avatarStudioOpen, setAvatarStudioOpen] = useState<boolean>(false);
  const [avatarDraftUrl, setAvatarDraftUrl] = useState<string>(user.avatarUrl ?? '');
  const [avatarBusy, setAvatarBusy] = useState<boolean>(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Commission PDF export state
  const [pdfBusy, setPdfBusy] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfResult, setPdfResult] = useState<GeneratedUserProfilePdfResult | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState<boolean>(false);

  const canEdit = user.permissions.includes('profile:edit_own');

  useEffect(() => {
    setPhoneDraft(user.phone ?? '');
    setTelegramDraft(user.telegram ?? '');
    setRegionDraft(user.region);
    setOrganisationDraft(user.organisation ?? '');
    setAvatarDraftUrl(user.avatarUrl ?? '');
  }, [user.phone, user.telegram, user.region, user.organisation, user.avatarUrl]);

  useEffect(() => {
    const blobUrl = pdfResult?.pdfBlobUrl;
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [pdfResult?.pdfBlobUrl]);

  useEffect(() => {
    if (!pdfPreviewOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPdfPreviewOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pdfPreviewOpen]);

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
  const currentAvatarUrl = user.avatarUrl?.trim() || '';

  const showTransientNotice = (text: string) => {
    setSavedNotice(text);
    window.setTimeout(() => setSavedNotice(null), 4000);
  };

  const handleOpenEditContacts = () => {
    setPhoneDraft(user.phone ?? '');
    setTelegramDraft(user.telegram ?? '');
    setRegionDraft(user.region);
    setOrganisationDraft(user.organisation ?? '');
    setSaveError(null);
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
      showTransientNotice('Контактные данные успешно обновлены и сохранены в профиле.');
      tracker.trackCustomInteraction(
        'Профиль пользователя · Контактные данные обновлены',
        'account'
      );
    } catch (err) {
      setSaveError(
        err instanceof ApiError ? err.message : 'Не удалось сохранить контактные данные.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAutoMatchAvatar = () => {
    let targetId = 'taiga';
    if (selfCheck.track === 'water') {
      targetId = 'water';
    } else if (
      selfCheck.track === 'expedition' ||
      user.region.includes('Камчат') ||
      qualification.level === 'advanced'
    ) {
      targetId = 'kamchatka';
    } else if (user.region.includes('Сахалин') || user.region.includes('Приморск')) {
      targetId = 'eco';
    }
    const preset =
      GENERATED_GUIDE_AVATAR_PRESETS.find((p) => p.id === targetId) ??
      GENERATED_GUIDE_AVATAR_PRESETS[0];
    setAvatarDraftUrl(preset.url);
    setAvatarError(null);
    tracker.trackCustomInteraction('Профиль пользователя · Автоподбор аватара', preset.id);
  };

  const handleUploadAvatarFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAvatarError(null);
    try {
      const dataUrl = await compressAvatarFileToDataUrl(file);
      setAvatarDraftUrl(dataUrl);
      tracker.trackCustomInteraction('Профиль пользователя · Загружено своё фото аватара', 'account');
    } catch (err) {
      setAvatarError(
        err instanceof Error ? err.message : 'Не удалось обработать выбранный файл.'
      );
    }
  };

  const handleSaveAvatar = async (nextUrl: string) => {
    setAvatarError(null);
    setAvatarBusy(true);
    try {
      const updated = await identityApi.updateProfile({ avatarUrl: nextUrl });
      onUpdated(updated);
      setAvatarDraftUrl(updated.avatarUrl ?? '');
      setAvatarStudioOpen(false);
      showTransientNotice(
        nextUrl
          ? 'Фото-портрет проводника обновлён в профиле и шапке кабинета.'
          : 'Аватар сброшен на стандартные инициалы.'
      );
      tracker.trackCustomInteraction(
        'Профиль пользователя · Сохранение аватара',
        nextUrl ? 'portrait' : 'initials'
      );
    } catch (err) {
      setAvatarError(
        err instanceof ApiError ? err.message : 'Не удалось сохранить выбранный аватар.'
      );
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleExportCommissionPdf = async () => {
    setPdfBusy(true);
    setPdfError(null);
    try {
      const result = await generateUserProfileCommissionPdf(
        {
          user,
          qualification,
          attestationPercent,
          selfCheck,
          journalEntries,
        },
        { autoDownload: true }
      );
      setPdfResult(result);
      showTransientNotice(
        `Учётная карта профиля (${result.data.dossierNumber}) экспортирована в PDF.`
      );
      tracker.trackCustomInteraction(
        'Профиль пользователя · Экспорт PDF для комиссии',
        result.data.dossierNumber
      );
    } catch (err) {
      setPdfError(
        err instanceof Error
          ? err.message
          : 'Не удалось сформировать PDF-файл профиля для комиссии.'
      );
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <section
      id="user-profile-overview-card"
      aria-labelledby="user-profile-overview-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 scroll-mt-24"
    >
      {/* Top Row: Avatar + Full Name + Actions */}
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            {currentAvatarUrl ? (
              <img
                src={currentAvatarUrl}
                alt={`Портрет проводника ${user.fullName}`}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-xs bg-slate-100"
              />
            ) : (
              <div
                aria-hidden="true"
                className="w-16 h-16 rounded-xl bg-teal-700 text-white flex items-center justify-center text-lg font-bold tracking-tight"
              >
                {getInitials(user.fullName)}
              </div>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setAvatarError(null);
                  setAvatarDraftUrl(currentAvatarUrl);
                  setAvatarStudioOpen((prev) => !prev);
                }}
                title="Выбрать или сменить фото-портрет проводника"
                aria-label="Выбрать или сменить фото-портрет проводника"
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 shadow-xs flex items-center justify-center text-slate-700 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              </button>
            )}
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

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setAvatarError(null);
                setAvatarDraftUrl(currentAvatarUrl);
                setAvatarStudioOpen((prev) => !prev);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>{avatarStudioOpen ? 'Скрыть выбор аватара' : 'Выбрать аватар'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleExportCommissionPdf()}
            disabled={pdfBusy}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{pdfBusy ? 'Формируем PDF…' : 'Экспорт в PDF для комиссии'}</span>
          </button>

          {canEdit && !isEditingContacts && (
            <button
              type="button"
              onClick={handleOpenEditContacts}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Редактировать контактные данные</span>
            </button>
          )}
        </div>
      </div>

      {/* Notices & Errors */}
      {savedNotice && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-900"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>{savedNotice}</span>
          </div>
          {pdfResult && (
            <button
              type="button"
              onClick={() => setPdfPreviewOpen(true)}
              className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:text-emerald-950 underline underline-offset-2 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              Открыть предпросмотр PDF
            </button>
          )}
        </div>
      )}

      {!savedNotice && pdfResult && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <span className="text-slate-700">
            Учётная карта для комиссии{' '}
            <span className="font-mono font-semibold text-slate-900">
              {pdfResult.data.dossierNumber}
            </span>{' '}
            готова к печати и подаче.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPdfPreviewOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 rounded-md font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              Предпросмотр
            </button>
            <a
              href={pdfResult.pdfBlobUrl}
              download={pdfResult.fileName}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-700 text-white rounded-md font-semibold hover:bg-teal-800"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              Скачать PDF
            </a>
          </div>
        </div>
      )}

      {pdfError && (
        <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {pdfError}
        </p>
      )}

      {/* Interactive Guide Portrait / Avatar Selector Drawer */}
      {avatarStudioOpen && canEdit && (
        <div className="p-4 rounded-xl bg-slate-50 border border-teal-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Фото-портрет и аватар проводника
              </h3>
              <p className="text-xs text-slate-600">
                Выберите сгенерированный профессиональный портрет проводника ДФО или загрузите собственное фото — оно автоматически попадёт в PDF-карту для комиссии.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAvatarStudioOpen(false)}
              aria-label="Закрыть панель выбора аватара"
              className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-200/70 cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {GENERATED_GUIDE_AVATAR_PRESETS.map((preset) => {
              const selected = avatarDraftUrl === preset.url;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setAvatarDraftUrl(preset.url);
                    setAvatarError(null);
                  }}
                  className={`group text-left p-2 rounded-xl border transition-all cursor-pointer ${
                    selected
                      ? 'bg-teal-50 border-teal-600 ring-2 ring-teal-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 mb-2">
                    <img
                      src={preset.url}
                      alt={preset.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {selected && (
                      <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-teal-700 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-900 leading-tight">{preset.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{preset.trackHint}</p>
                </button>
              );
            })}
          </div>

          {/* Custom upload & auto-match actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAutoMatchAvatar}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                Подобрать под мой профиль
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => void handleUploadAvatarFile(e)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                Загрузить своё фото
              </button>

              {(avatarDraftUrl || currentAvatarUrl) && (
                <button
                  type="button"
                  onClick={() => void handleSaveAvatar('')}
                  disabled={avatarBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Сбросить на инициалы
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAvatarStudioOpen(false)}
                disabled={avatarBusy}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void handleSaveAvatar(avatarDraftUrl)}
                disabled={avatarBusy || !avatarDraftUrl}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
                {avatarBusy ? 'Сохраняем…' : 'Сохранить портрет'}
              </button>
            </div>
          </div>

          {avatarDraftUrl.startsWith('data:image/') && (
            <div className="flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-lg text-xs">
              <img
                src={avatarDraftUrl}
                alt="Загруженный портрет"
                className="w-10 h-10 rounded-lg object-cover border border-slate-200"
              />
              <span className="text-slate-700">
                Собственное фото подготовлено (квадрат 256×256). Нажмите «Сохранить портрет».
              </span>
            </div>
          )}

          {avatarError && (
            <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {avatarError}
            </p>
          )}
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

      {/* Commission PDF Preview Modal */}
      {pdfPreviewOpen && pdfResult && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-commission-pdf-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h4 id="profile-commission-pdf-title" className="text-sm font-bold text-slate-900">
                  Учётная карта профиля · {pdfResult.data.dossierNumber}
                </h4>
                <p className="text-xs text-slate-500">
                  Документ для аттестационной комиссии РЦА · Код{' '}
                  {pdfResult.data.verificationCode}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={pdfResult.pdfBlobUrl}
                  download={pdfResult.fileName}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Скачать PDF
                </a>
                <button
                  type="button"
                  onClick={() => setPdfPreviewOpen(false)}
                  aria-label="Закрыть предпросмотр PDF"
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex justify-center">
              <img
                src={pdfResult.previewDataUrl}
                alt={`Учётная карта профиля ${pdfResult.data.fullName}`}
                className="max-w-full h-auto border border-slate-300 shadow-sm bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
