import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  BarChart3,
  BookOpen,
  Compass,
  DatabaseBackup,
  Download,
  Eye,
  FileBadge2,
  GitBranch,
  KeyRound,
  LogIn,
  LogOut,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { tracker } from '../utils/tracker';
import { SocialProfileSection } from './social/SocialProfileSection';
import { MyInquiriesSection, type InquiryRecord } from './social/MyInquiriesSection';
import { ForgotPasswordForm, ResetPasswordForm } from './social/PasswordRecovery';
import {
  AttestationProgressWidget,
  computeUserAttestationSummary,
  type AttestationStageId,
  type UserAttestationSummary,
} from './AttestationProgressWidget';
import { ApplicationProgressIndicator } from './ApplicationProgressIndicator';
import { AttestationExpiryMonitorWidget } from './AttestationExpiryMonitorWidget';
import { AttestationPathWidget } from './AttestationPathWidget';
import { AttestationSessionsCalendarWidget } from './AttestationSessionsCalendarWidget';
import { LinkedAccountsCard } from './LinkedAccountsCard';
import { PersonalLearningPlanWidget } from './PersonalLearningPlanWidget';
import { PersonalRoadmapWidget } from './PersonalRoadmapWidget';
import { NotificationCenterWidget } from './NotificationCenterWidget';
import { AccountKnowledgeBaseWidget } from './AccountKnowledgeBaseWidget';
import { FavoriteLiteratureCabinetWidget } from './FavoriteLiteratureCabinetWidget';
import { QualificationSelfCheckWidget } from './QualificationSelfCheckWidget';
import { AttestationSelfDiagnosticsWidget } from './AttestationSelfDiagnosticsWidget';
import { InstructorPassportCard } from './InstructorPassportCard';
import { InstructorResumeGeneratorCard } from './InstructorResumeGeneratorCard';
import { ProfessionalExperienceLogCard } from './ProfessionalExperienceLogCard';
import { ExperienceRoutesLeafletMapCard } from './ExperienceRoutesLeafletMapCard';
import { GearChecklistGeneratorCard } from './GearChecklistGeneratorCard';
import { UpdatesFeedWidget } from './UpdatesFeedWidget';
import { UserProfileCard } from './UserProfileCard';
import { type UpdateFeedActionTarget } from '../utils/updatesFeed';
import { RouteComplexityForecastCard } from './RouteComplexityForecastCard';
import { RouteComplexityPieWidget } from './RouteComplexityPieWidget';
import { ProfileAttestationCertificateCard } from './ProfileAttestationCertificateCard';
import { PreparationChecklistPdfCard } from './PreparationChecklistPdfCard';
import { QualificationCertificatesJsonExportCard } from './QualificationCertificatesJsonExportCard';
import { AccountDataBackupCard } from './AccountDataBackupCard';
import {
  AchievementIcon,
  InstructorAchievementsWidget,
  ProfileBadgesShowcase,
  getTierEmblemClasses,
} from './InstructorAchievementsWidget';
import {
  useInstructorAchievements,
  type AchievementTargetAction,
  type InstructorAchievementsSummary,
} from '../utils/instructorAchievements';
import {
  dispatchOpenRcaAssistant,
  dispatchRcaUserContext,
} from './RcaAssistantChatWidget';
import { DfoGuidesLeaderboardWidget } from './DfoGuidesLeaderboardWidget';
import { InstructorReviewsSection } from './InstructorReviewsSection';
import { ReviewStatsWidget } from './ReviewStatsWidget';
import {
  ApiError,
  ROLE_LABELS,
  identityApi,
  type Role,
  type SessionUser,
} from '../utils/identityApi';
import {
  linkedAccountsApi,
  type ExamAutofillPayload,
  type LinkedAccountDTO,
  type LinkedProviderId,
  type OAuthProviderStatusDTO,
} from '../utils/linkedAccountsApi';
import {
  generateAttestationFinalCertificatePdf,
  isAttestationEligibleForCertificate,
  type GeneratedFinalCertificateResult,
} from '../utils/attestationFinalCertificatePdf';
import { collectAndDownloadFullAccountBackup } from '../utils/accountBackupExport';
import type { SiteTabId } from '../utils/seo';

type AuthMode = 'login' | 'register';
type CabinetTab = 'profile' | 'preparation' | 'documents' | 'community';

const CABINET_TABS: readonly {
  id: CabinetTab;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'profile',
    label: 'Профиль и заявки',
    description: 'Заявки, уведомления, OAuth, профиль и безопасность',
    icon: UserRound,
  },
  {
    id: 'preparation',
    label: 'Подготовка и путь',
    description: 'Маршрут 5 этапов, календарь комиссий, план и база знаний',
    icon: Compass,
  },
  {
    id: 'documents',
    label: 'Опыт и документы',
    description: 'Журнал походов, цифровой паспорт, резюме и выгрузки',
    icon: FileBadge2,
  },
  {
    id: 'community',
    label: 'Сообщество и рейтинг',
    description: 'Лента, чат, достижения, рейтинг ДФО и отзывы',
    icon: Users,
  },
];

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

export function AccountSection({
  onNavigate,
  onOpenGitSync,
}: {
  onNavigate?: (tab: SiteTabId) => void;
  onOpenGitSync?: () => void;
} = {}) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [cabinetTab, setCabinetTab] = useState<CabinetTab>('profile');
  const [guestPreviewTab, setGuestPreviewTab] = useState<'analytics' | 'kb'>('analytics');

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
  const [reattestationPrefill, setReattestationPrefill] = useState<{
    note: string;
    nonce: number;
  } | null>(null);
  const [selectedContour, setSelectedContour] = useState<'contour_b' | 'contour_a'>('contour_b');
  const [reviewsRefreshKey, setReviewsRefreshKey] = useState<number>(0);
  const [selfCheckRevision, setSelfCheckRevision] = useState<number>(0);
  const [kbExternalSearch, setKbExternalSearch] = useState<{
    query: string;
    nonce: number;
  } | null>(null);
  const [externalSelectedStage, setExternalSelectedStage] = useState<{
    stageId: AttestationStageId;
    nonce: number;
  } | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccountDTO[]>([]);
  const [examAutofill, setExamAutofill] = useState<ExamAutofillPayload | null>(null);
  const [oauthProviders, setOauthProviders] = useState<OAuthProviderStatusDTO[]>([]);
  const [linkedLoading, setLinkedLoading] = useState<boolean>(false);
  const [finalCertBusy, setFinalCertBusy] = useState<boolean>(false);
  const [finalCertError, setFinalCertError] = useState<string | null>(null);
  const [finalCertResult, setFinalCertResult] = useState<GeneratedFinalCertificateResult | null>(
    null
  );
  const [finalCertPreviewOpen, setFinalCertPreviewOpen] = useState<boolean>(false);
  const [backupBusy, setBackupBusy] = useState<boolean>(false);
  const [backupNotice, setBackupNotice] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    const url = finalCertResult?.pdfBlobUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [finalCertResult?.pdfBlobUrl]);

  useEffect(() => {
    if (!finalCertPreviewOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFinalCertPreviewOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [finalCertPreviewOpen]);

  const resolvedProgressSummary = user
    ? (liveProgressSummary ?? computeUserAttestationSummary(user, inquiries))
    : null;

  const achievementsSummary = useInstructorAchievements({
    user,
    attestationPercent: resolvedProgressSummary?.percent ?? 0,
    completedStagesCount: resolvedProgressSummary?.completedStages ?? 0,
    inquiries,
    linkedAccounts,
    selfCheckRevision,
  });

  useEffect(() => {
    if (!user) {
      dispatchRcaUserContext({ user: null, progressSummary: null });
      return;
    }
    dispatchRcaUserContext({ user, progressSummary: resolvedProgressSummary });
  }, [user, resolvedProgressSummary]);

  const openAiAssistant = useCallback((prompt?: string) => {
    dispatchOpenRcaAssistant({ prompt, mode: 'rag' });
  }, []);

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

  const loadLinkedAccounts = useCallback(async () => {
    setLinkedLoading(true);
    try {
      const data = await linkedAccountsApi.list();
      setLinkedAccounts(data.accounts);
      setExamAutofill(data.autofill);
      setOauthProviders(data.providers);
    } catch {
      // keep existing state cleanly
    } finally {
      setLinkedLoading(false);
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

  useEffect(() => {
    if (user) {
      void loadLinkedAccounts();
    } else {
      setLinkedAccounts([]);
      setExamAutofill(null);
      setOauthProviders([]);
      setLinkedLoading(false);
    }
  }, [user, loadLinkedAccounts]);

  const handleSelectAutofillSource = useCallback(async (provider: LinkedProviderId) => {
    try {
      const res = await linkedAccountsApi.setAutofillSource(provider, true);
      setLinkedAccounts(res.accounts);
      setExamAutofill(res.autofill);
    } catch {
      // ignore transient error
    }
  }, []);

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
      setLinkedAccounts([]);
      setExamAutofill(null);
      setOauthProviders([]);
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

  const scrollToElementById = (elementId: string) => {
    const el = document.getElementById(elementId);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const navigateCabinetTarget = (targetTab: CabinetTab, elementId: string) => {
    setCabinetTab(targetTab);
    window.setTimeout(() => scrollToElementById(elementId), 60);
  };

  const jumpToKnowledgeBaseWithQuery = (query?: string) => {
    setKbExternalSearch((prev) => ({
      query: query ?? '',
      nonce: (prev?.nonce ?? 0) + 1,
    }));
    if (!user) {
      setGuestPreviewTab('kb');
      window.setTimeout(() => scrollToElementById('account-knowledge-base'), 60);
    } else {
      navigateCabinetTarget('preparation', 'account-knowledge-base');
    }
  };

  const jumpToAchievementAction = (action: AchievementTargetAction) => {
    if (!user && (action === 'profile' || action === 'attestation' || action === 'linked')) {
      scrollToElementById('account-auth-panel');
      return;
    }
    const targetMap: Record<AchievementTargetAction, { tab: CabinetTab; id: string }> = {
      experience: { tab: 'documents', id: 'professional-experience-log' },
      attestation: { tab: 'preparation', id: 'attestation-progress-widget' },
      profile: { tab: 'profile', id: 'account-profile-card' },
      diagnostics: { tab: 'preparation', id: 'attestation-self-diagnostics' },
      self_check: { tab: 'preparation', id: 'qualification-self-check' },
      linked: { tab: 'profile', id: 'account-linked-profiles' },
    };
    const mapped = targetMap[action] ?? { tab: 'documents', id: 'professional-experience-log' };
    navigateCabinetTarget(mapped.tab, mapped.id);
  };

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

  // ── Unauthenticated guest view ────────────────────────────────────────────
  if (!user) {
    return (
      <div className="space-y-8">
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5">
            <AuthPanel
              mode={authMode}
              onModeChange={setAuthMode}
              onAuthenticated={handleAuthenticated}
              onForgotPassword={() => setShowForgot(true)}
            />
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Единое пространство соискателя и проводника
              </p>
              <h1 className="text-2xl font-bold text-slate-900 text-balance">
                Личный кабинет РЦА «Русский Восток»
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                После входа или регистрации открывается персональный контур подготовки к
                аттестации инструкторов-проводников по ПП № 1003 (ред. № 1893).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CABINET_TABS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5"
                  >
                    <p className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                      <span>{item.label}</span>
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Public analytics / knowledge preview tabs for guests */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Открытые инструменты и рейтинг реестра
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                Доступны без авторизации — для знакомства со статистикой ДФО и справочником
                соискателя.
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Открытые разделы для гостей"
              className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              <button
                type="button"
                role="tab"
                aria-selected={guestPreviewTab === 'analytics'}
                onClick={() => setGuestPreviewTab('analytics')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  guestPreviewTab === 'analytics'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Рейтинг ДФО и отзывы</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={guestPreviewTab === 'kb'}
                onClick={() => setGuestPreviewTab('kb')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  guestPreviewTab === 'kb'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                <span>База знаний и библиотека</span>
              </button>
            </div>
          </div>

          {guestPreviewTab === 'analytics' && (
            <div className="space-y-6">
              <DfoGuidesLeaderboardWidget />
              <ReviewStatsWidget refreshKey={reviewsRefreshKey} />
            </div>
          )}

          {guestPreviewTab === 'kb' && (
            <div className="space-y-6">
              <AccountKnowledgeBaseWidget
                user={null}
                externalSearch={kbExternalSearch}
                onNavigate={onNavigate}
                onJumpToConsultant={() =>
                  openAiAssistant('Подскажите, какие документы нужны для аттестации?')
                }
              />
              <FavoriteLiteratureCabinetWidget
                userId={null}
                onOpenOverviewLibrary={
                  onNavigate
                    ? () => {
                        onNavigate('learning');
                        window.setTimeout(() => {
                          document
                            .getElementById('recommended-literature')
                            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 240);
                      }
                    : undefined
                }
              />
            </div>
          )}
        </section>
      </div>
    );
  }

  // ── Authenticated cabinet view ────────────────────────────────────────────
  const effectiveProgressSummary =
    resolvedProgressSummary ?? computeUserAttestationSummary(user, inquiries);
  const isAttestationComplete = isAttestationEligibleForCertificate(effectiveProgressSummary);

  const handleDownloadFinalCertificate = () => {
    setFinalCertBusy(true);
    setFinalCertError(null);
    try {
      const result = generateAttestationFinalCertificatePdf(
        user,
        effectiveProgressSummary,
        inquiries,
        selectedExamDate
      );
      setFinalCertResult(result);
      tracker.trackCustomInteraction(
        'Личный кабинет · Скачать сертификат (PDF)',
        result.data.certificateNumber
      );
    } catch (err) {
      setFinalCertError(
        err instanceof Error ? err.message : 'Не удалось сформировать PDF-сертификат.'
      );
    } finally {
      setFinalCertBusy(false);
    }
  };

  const handleDownloadFullBackup = async () => {
    setBackupBusy(true);
    setBackupNotice(null);
    try {
      const res = await collectAndDownloadFullAccountBackup({
        user,
        progressSummary: effectiveProgressSummary,
        achievementsSummary,
        inquiries,
        linkedAccounts,
        selectedExamDate,
        selectedContour,
      });
      setBackupNotice({
        kind: 'success',
        text: `Резервная копия данных кабинета сохранена: ${res.fileName} (${res.formattedSize}) — включены статистика, ачивки (${res.payload.achievements.unlockedCount}/${res.payload.achievements.totalCount}) и история походов (${res.payload.hikeHistory.totalEntries}).`,
      });
      tracker.trackCustomInteraction(
        'Личный кабинет · Быстрый экспорт резервной копии JSON',
        res.formattedSize
      );
    } catch (err) {
      setBackupNotice({
        kind: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Не удалось сформировать резервную копию данных в JSON.',
      });
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <CabinetHeader
        user={user}
        cabinetTab={cabinetTab}
        onSelectCabinetTab={(tab) => {
          setCabinetTab(tab);
          tracker.trackCustomInteraction(`Личный кабинет · ${tab}`, 'account');
        }}
        achievementsSummary={achievementsSummary}
        isAttestationComplete={isAttestationComplete}
        certificateBusy={finalCertBusy}
        onDownloadCertificate={handleDownloadFinalCertificate}
        backupBusy={backupBusy}
        onDownloadBackup={() => void handleDownloadFullBackup()}
        onLogout={handleLogout}
      />

      {backupNotice && (
        <p
          role="status"
          className={`text-xs rounded-lg px-4 py-2.5 font-medium border ${
            backupNotice.kind === 'error'
              ? 'text-red-800 bg-red-50 border-red-200'
              : 'text-teal-900 bg-teal-50 border-teal-200'
          }`}
        >
          {backupNotice.text}
        </p>
      )}

      {finalCertError && (
        <p
          role="alert"
          className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5"
        >
          {finalCertError}
        </p>
      )}

      {finalCertResult && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-emerald-50/85 border border-emerald-200 rounded-xl text-xs">
          <div className="flex items-center gap-2 text-emerald-950">
            <Award className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>
              Сертификат{' '}
              <span className="font-mono font-semibold">
                {finalCertResult.data.certificateNumber}
              </span>{' '}
              сформирован в PDF (действует до {finalCertResult.data.validUntilFormatted}).
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFinalCertPreviewOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-900 font-semibold rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              Просмотр сертификата
            </button>
            <a
              href={finalCertResult.pdfBlobUrl}
              download={finalCertResult.fileName}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white font-semibold rounded-lg hover:bg-emerald-800 transition-colors"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              Скачать PDF
            </a>
          </div>
        </div>
      )}

      {/* TAB 1: PROFILE, INQUIRIES, NOTIFICATIONS & SECURITY */}
      {cabinetTab === 'profile' && (
        <div className="space-y-6">
          <UserProfileCard
            user={user}
            attestationPercent={effectiveProgressSummary.percent}
            selfCheckRevision={selfCheckRevision}
            onUpdated={handleAuthenticated}
            onJumpToPreparation={() =>
              navigateCabinetTarget('preparation', 'qualification-self-check')
            }
            onJumpToExperience={() =>
              navigateCabinetTarget('documents', 'professional-experience-log')
            }
          />

          <AttestationExpiryMonitorWidget
            user={user}
            inquiries={inquiries}
            onUserUpdated={handleAuthenticated}
            onJumpToProfile={() => scrollToElementById('account-profile-card')}
            onBookReattestation={({ recommendedSessionDate, note }) => {
              if (recommendedSessionDate) {
                setSelectedExamDate(recommendedSessionDate);
              }
              setReattestationPrefill((prev) => ({
                note,
                nonce: (prev?.nonce ?? 0) + 1,
              }));
              navigateCabinetTarget('preparation', 'attestation-sessions-calendar');
            }}
          />

          <ApplicationProgressIndicator
            user={user}
            inquiries={inquiries}
            inquiriesLoading={inquiriesLoading}
            overallChecklistPercent={effectiveProgressSummary.percent}
            isAttestationComplete={isAttestationComplete}
            certificateBusy={finalCertBusy}
            onDownloadCertificate={handleDownloadFinalCertificate}
            onRefreshInquiries={
              hasPermission(user, 'inquiries:view_own') ? () => void loadInquiries() : undefined
            }
            onJumpToCalendar={() =>
              navigateCabinetTarget('preparation', 'attestation-sessions-calendar')
            }
            onJumpToInquiries={() => scrollToElementById('my-inquiries-status-table')}
            onJumpToChecklist={() =>
              navigateCabinetTarget('preparation', 'attestation-progress-widget')
            }
          />

          <MyInquiriesSection
            canView={hasPermission(user, 'inquiries:view_own')}
            inquiries={inquiries}
            loading={inquiriesLoading}
            error={inquiriesError}
            onRefresh={() => void loadInquiries()}
            onJumpToCalendar={() =>
              navigateCabinetTarget('preparation', 'attestation-sessions-calendar')
            }
            onJumpToChecklist={() =>
              navigateCabinetTarget('preparation', 'attestation-progress-widget')
            }
          />

          <NotificationCenterWidget
            user={user}
            inquiries={inquiries}
            inquiriesLoading={inquiriesLoading}
            onRefreshInquiries={
              hasPermission(user, 'inquiries:view_own') ? () => void loadInquiries() : undefined
            }
            onOpenOverview={onNavigate ? () => onNavigate('overview') : undefined}
          />

          <UpdatesFeedWidget
            user={user}
            inquiries={inquiries}
            progressSummary={effectiveProgressSummary}
            onNavigateAction={(target: UpdateFeedActionTarget, prompt?: string) => {
              switch (target) {
                case 'calendar':
                  navigateCabinetTarget('preparation', 'attestation-sessions-calendar');
                  break;
                case 'self_check':
                  navigateCabinetTarget('preparation', 'qualification-self-check');
                  break;
                case 'gear':
                  navigateCabinetTarget('documents', 'gear-checklist-generator');
                  break;
                case 'experience':
                  navigateCabinetTarget('documents', 'experience-routes-leaflet-map');
                  break;
                case 'inquiries':
                  scrollToElementById('my-inquiries-status-table');
                  break;
                case 'assistant':
                  openAiAssistant(
                    prompt ??
                      'Подскажите оптимальный план подготовки и развития навыков для моего уровня квалификации.'
                  );
                  break;
              }
            }}
          />

          <LinkedAccountsCard
            user={user}
            accounts={linkedAccounts}
            autofill={examAutofill}
            providers={oauthProviders}
            loading={linkedLoading}
            onUpdated={(accounts, autofill) => {
              setLinkedAccounts(accounts);
              setExamAutofill(autofill);
            }}
            onRefreshAll={loadLinkedAccounts}
            onJumpToCalendar={() =>
              navigateCabinetTarget('preparation', 'attestation-sessions-calendar')
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <ProfileCard
                user={user}
                achievementsSummary={achievementsSummary}
                onUpdated={handleAuthenticated}
                onJumpToAchievements={() =>
                  navigateCabinetTarget('community', 'instructor-achievements')
                }
              />
              <PasswordCard onChanged={() => setUser(null)} />
            </div>
            <div className="space-y-6">
              <PermissionsCard user={user} />
              {hasPermission(user, 'users:manage') && <UserAdminCard currentUserId={user.id} />}
              {onOpenGitSync && hasPermission(user, 'users:manage') && (
                <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900 inline-flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-teal-700" aria-hidden="true" />
                      <span>Публикация в репозиторий</span>
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Фиксация изменений коммитом и отправка в ветку{' '}
                      <code className="font-mono">main</code> репозитория{' '}
                      <code className="font-mono">spawnperm/rca-vostok</code>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenGitSync}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <GitBranch className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
                    <span>Зафиксировать и отправить в main</span>
                  </button>
                </section>
              )}
            </div>
          </div>

          <AccountDataBackupCard
            user={user}
            progressSummary={effectiveProgressSummary}
            achievementsSummary={achievementsSummary}
            inquiries={inquiries}
            linkedAccounts={linkedAccounts}
            selectedExamDate={selectedExamDate}
            selectedContour={selectedContour}
            selfCheckRevision={selfCheckRevision}
          />
        </div>
      )}

      {/* TAB 2: PREPARATION, PATH, CALENDAR, DIAGNOSTICS & KNOWLEDGE BASE */}
      {cabinetTab === 'preparation' && (
        <div className="space-y-6">
          <AttestationPathWidget
            user={user}
            summary={effectiveProgressSummary}
            inquiries={inquiries}
            examDateIso={selectedExamDate}
            contour={selectedContour}
            onSelectStageInChecklist={(stageId) => {
              setExternalSelectedStage((prev) => ({
                stageId,
                nonce: (prev?.nonce ?? 0) + 1,
              }));
              scrollToElementById('attestation-progress-details');
            }}
            onOpenApplication={() => scrollToElementById('attestation-sessions-calendar')}
            onJumpToRoadmap={() => scrollToElementById('personal-roadmap-widget')}
            onJumpToPassport={() =>
              navigateCabinetTarget('documents', 'instructor-digital-passport')
            }
          />

          <AttestationProgressWidget
            user={user}
            inquiries={inquiries}
            inquiriesLoading={inquiriesLoading}
            selectedExamDate={selectedExamDate}
            externalSelectedStage={externalSelectedStage}
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
            onContourChange={setSelectedContour}
          />

          <AttestationSessionsCalendarWidget
            user={user}
            inquiries={inquiries}
            selectedExamDate={selectedExamDate}
            linkedAccounts={linkedAccounts}
            autofill={examAutofill}
            externalReattestationPrefill={reattestationPrefill}
            onSelectAutofillSource={(provider) => void handleSelectAutofillSource(provider)}
            onJumpToLinkedAccounts={() =>
              navigateCabinetTarget('profile', 'account-linked-profiles')
            }
            onSelectExamDate={setSelectedExamDate}
            onSessionBooked={(sessionDateIso) => {
              setSelectedExamDate(sessionDateIso);
              if (hasPermission(user, 'inquiries:view_own')) {
                void loadInquiries();
              }
            }}
            onJumpToInquiries={() =>
              navigateCabinetTarget('profile', 'my-inquiries-status-table')
            }
          />

          <QualificationSelfCheckWidget
            user={user}
            onChange={() => setSelfCheckRevision((n) => n + 1)}
            onJumpToKnowledgeBase={jumpToKnowledgeBaseWithQuery}
            onJumpToConsultant={() =>
              openAiAssistant('Помогите разобраться с пробелами по итогам самопроверки.')
            }
          />

          <AttestationSelfDiagnosticsWidget
            user={user}
            onJumpToKnowledgeBase={jumpToKnowledgeBaseWithQuery}
            onJumpToConsultant={(prompt) => openAiAssistant(prompt)}
            onJumpToSelfCheck={() => scrollToElementById('qualification-self-check')}
            onJumpToCalendar={() => scrollToElementById('attestation-sessions-calendar')}
          />

          <PersonalLearningPlanWidget
            user={user}
            selfCheckRevision={selfCheckRevision}
            selectedContour={selectedContour}
            onJumpToDiagnostics={() => scrollToElementById('attestation-self-diagnostics')}
          />

          <AccountKnowledgeBaseWidget
            user={user}
            externalSearch={kbExternalSearch}
            onNavigate={onNavigate}
            onJumpToChecklist={() => scrollToElementById('qualification-self-check')}
            onJumpToConsultant={() => openAiAssistant()}
          />

          <FavoriteLiteratureCabinetWidget
            userId={user.id}
            onOpenOverviewLibrary={
              onNavigate
                ? () => {
                    onNavigate('learning');
                    window.setTimeout(() => {
                      document
                        .getElementById('recommended-literature')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 240);
                  }
                : undefined
            }
          />
        </div>
      )}

      {/* TAB 3: EXPERIENCE JOURNAL & OFFICIAL DOCUMENTS */}
      {cabinetTab === 'documents' && (
        <div className="space-y-6">
          <InstructorPassportCard
            user={user}
            summary={effectiveProgressSummary}
            inquiries={inquiries}
            selfCheckRevision={selfCheckRevision}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ProfileAttestationCertificateCard
              user={user}
              summary={effectiveProgressSummary}
              inquiries={inquiries}
              selectedExamDate={selectedExamDate}
              selectedContour={selectedContour}
              onJumpToProfile={() => navigateCabinetTarget('profile', 'account-profile-card')}
            />
            <PreparationChecklistPdfCard
              user={user}
              summary={effectiveProgressSummary}
              inquiries={inquiries}
              selectedContour={selectedContour}
            />
          </div>

          <InstructorResumeGeneratorCard
            user={user}
            summary={effectiveProgressSummary}
            inquiries={inquiries}
            selfCheckRevision={selfCheckRevision}
            selectedContour={selectedContour}
            onJumpToProfile={() => navigateCabinetTarget('profile', 'account-profile-card')}
            onJumpToPassport={() => scrollToElementById('instructor-digital-passport')}
          />

          <QualificationCertificatesJsonExportCard
            user={user}
            summary={effectiveProgressSummary}
            inquiries={inquiries}
            linkedAccounts={linkedAccounts}
            selectedExamDate={selectedExamDate}
            selectedContour={selectedContour}
            selfCheckRevision={selfCheckRevision}
          />

          <ProfessionalExperienceLogCard user={user} />

          <ExperienceRoutesLeafletMapCard
            user={user}
            onJumpToJournal={() => scrollToElementById('professional-experience-log')}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RouteComplexityPieWidget
              user={user}
              onJumpToJournal={() => scrollToElementById('professional-experience-log')}
            />
            <RouteComplexityForecastCard
              user={user}
              onJumpToJournal={() => scrollToElementById('professional-experience-log')}
            />
          </div>

          <GearChecklistGeneratorCard
            user={user}
            onJumpToJournal={() => scrollToElementById('professional-experience-log')}
          />
        </div>
      )}

      {/* TAB 4: COMMUNITY, ACHIEVEMENTS, LEADERBOARD & REVIEWS */}
      {cabinetTab === 'community' && (
        <div className="space-y-6">
          <SocialProfileSection
            userId={user.id}
            currentUserId={user.id}
            permissions={user.permissions}
          />

          <InstructorAchievementsWidget
            user={user}
            summary={achievementsSummary}
            onActionJump={jumpToAchievementAction}
          />

          <DfoGuidesLeaderboardWidget
            currentUserId={user.id}
            currentUserRegion={user.region}
          />

          <InstructorReviewsSection
            user={user}
            progressSummary={effectiveProgressSummary}
            inquiries={inquiries}
            refreshKey={reviewsRefreshKey}
            onReviewSubmitted={() => setReviewsRefreshKey((k) => k + 1)}
            onJumpToProgress={() =>
              navigateCabinetTarget('preparation', 'attestation-progress-widget')
            }
          />

          <ReviewStatsWidget refreshKey={reviewsRefreshKey} />
        </div>
      )}

      {finalCertPreviewOpen && finalCertResult && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-final-cert-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h4 id="account-final-cert-title" className="text-sm font-bold text-slate-900">
                  Сертификат об аттестации · {finalCertResult.data.certificateNumber}
                </h4>
                <p className="text-xs text-slate-500">
                  Официальный документ А4 · Действует до{' '}
                  {finalCertResult.data.validUntilFormatted}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={finalCertResult.pdfBlobUrl}
                  download={finalCertResult.fileName}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Скачать PDF
                </a>
                <button
                  type="button"
                  onClick={() => setFinalCertPreviewOpen(false)}
                  aria-label="Закрыть предпросмотр сертификата"
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex justify-center">
              <img
                src={finalCertResult.previewDataUrl}
                alt={`Сертификат об аттестации ${finalCertResult.data.holderName}`}
                className="max-w-full h-auto border border-slate-300 shadow-sm bg-white"
              />
            </div>
          </div>
        </div>
      )}
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

// ── Streamlined Cabinet Header + 4-Tab Workspace Navigation ─────────────────

function CabinetHeader({
  user,
  cabinetTab,
  onSelectCabinetTab,
  achievementsSummary,
  isAttestationComplete,
  certificateBusy,
  onDownloadCertificate,
  backupBusy,
  onDownloadBackup,
  onLogout,
}: {
  user: SessionUser;
  cabinetTab: CabinetTab;
  onSelectCabinetTab: (tab: CabinetTab) => void;
  achievementsSummary: InstructorAchievementsSummary;
  isAttestationComplete: boolean;
  certificateBusy: boolean;
  onDownloadCertificate: () => void;
  backupBusy: boolean;
  onDownloadBackup: () => void;
  onLogout: () => void;
}) {
  const featuredProfileBadges = achievementsSummary.featuredBadges.slice(0, 4);

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={`Аватар ${user.fullName}`}
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-full object-cover border border-teal-200 bg-slate-100 shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
              <UserRound className="w-7 h-7 text-teal-700" aria-hidden="true" />
            </div>
          )}
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900">{user.fullName}</h1>
            <p className="text-sm text-slate-600">{user.email}</p>
            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5 font-semibold text-teal-800">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{ROLE_LABELS[user.role]}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>{user.region}</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => onSelectCabinetTab('community')}
                className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-teal-800 hover:text-teal-950 cursor-pointer tabular-nums"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                <span>
                  Бейджи: {achievementsSummary.unlockedCount}/{achievementsSummary.totalCount}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAttestationComplete && (
            <button
              type="button"
              onClick={onDownloadCertificate}
              disabled={certificateBusy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              <Award className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{certificateBusy ? 'Формируем PDF…' : 'Скачать сертификат'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onDownloadBackup}
            disabled={backupBusy}
            title="Скачать полную резервную копию данных кабинета (статистика, ачивки, история походов) в JSON"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <DatabaseBackup className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>{backupBusy ? 'Экспорт…' : 'Резервная копия JSON'}</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Выйти</span>
          </button>
        </div>
      </div>

      {/* 4 Clean Workspace Section Tabs */}
      <div
        role="tablist"
        aria-label="Разделы личного кабинета"
        className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg"
      >
        {CABINET_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = cabinetTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelectCabinetTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                active
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {featuredProfileBadges.length > 0 && (
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500">
              Активные бейджи профиля:
            </span>
            {featuredProfileBadges.map((badge) => {
              const styles = getTierEmblemClasses(badge.tier, true);
              return (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => onSelectCabinetTab('community')}
                  title={badge.description}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-xs font-medium text-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center ${styles.emblemBox}`}
                  >
                    <AchievementIcon iconKey={badge.iconKey} className="w-3 h-3" />
                  </span>
                  <span>{badge.shortBadgeLabel}</span>
                </button>
              );
            })}
          </div>

          {achievementsSummary.unlockedCount > featuredProfileBadges.length && (
            <button
              type="button"
              onClick={() => onSelectCabinetTab('community')}
              className="text-xs font-semibold text-teal-800 hover:text-teal-950 whitespace-nowrap shrink-0 cursor-pointer"
            >
              + ещё {achievementsSummary.unlockedCount - featuredProfileBadges.length}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ── Profile ─────────────────────────────────────────────────────────────────

function ProfileCard({
  user,
  achievementsSummary,
  onUpdated,
  onJumpToAchievements,
}: {
  user: SessionUser;
  achievementsSummary: InstructorAchievementsSummary;
  onUpdated: (user: SessionUser) => void;
  onJumpToAchievements?: () => void;
}) {
  const [fullName, setFullName] = useState<string>(user.fullName);
  const [region, setRegion] = useState<string>(user.region);
  const [organisation, setOrganisation] = useState<string>(user.organisation);
  const [attestationExpiresAt, setAttestationExpiresAt] = useState<string>(
    user.attestationExpiresAt ?? ''
  );
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(user.fullName);
    setRegion(user.region);
    setOrganisation(user.organisation);
    setAttestationExpiresAt(user.attestationExpiresAt ?? '');
  }, [user]);

  const canEdit = user.permissions.includes('profile:edit_own');

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus('saving');
    try {
      const updated = await identityApi.updateProfile({
        fullName,
        region,
        organisation,
        attestationExpiresAt: attestationExpiresAt.trim() || null,
      });
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
    <section
      id="account-profile-card"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 scroll-mt-24"
    >
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

        <Field
          label="Дата окончания текущей аттестации"
          htmlFor="profile-attestation-expires-at"
          hint="Монитор в личном кабинете выведет предупреждение за 3 месяца до указанной даты"
        >
          <input
            id="profile-attestation-expires-at"
            type="date"
            value={attestationExpiresAt}
            disabled={!canEdit}
            onChange={(e) => setAttestationExpiresAt(e.target.value)}
            className="w-full sm:max-w-xs px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-500"
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
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                Изменения сохранены
              </span>
            )}
          </div>
        )}
      </form>

      <ProfileBadgesShowcase
        summary={achievementsSummary}
        onJumpToAchievements={onJumpToAchievements}
      />
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
