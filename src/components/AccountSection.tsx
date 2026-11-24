import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  BarChart3,
  BookOpen,
  Download,
  Eye,
  GitBranch,
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
import { AccountKnowledgeBaseWidget } from './AccountKnowledgeBaseWidget';
import { FavoriteLiteratureCabinetWidget } from './FavoriteLiteratureCabinetWidget';
import { QualificationSelfCheckWidget } from './QualificationSelfCheckWidget';
import { AttestationSelfDiagnosticsWidget } from './AttestationSelfDiagnosticsWidget';
import { InstructorPassportCard } from './InstructorPassportCard';
import { InstructorResumeGeneratorCard } from './InstructorResumeGeneratorCard';
import { ProfessionalExperienceLogCard } from './ProfessionalExperienceLogCard';
import { ExperienceRoutesLeafletMapCard } from './ExperienceRoutesLeafletMapCard';
import { GearChecklistGeneratorCard } from './GearChecklistGeneratorCard';
import { UserProfileCard } from './UserProfileCard';
import { type UpdateFeedActionTarget } from '../utils/updatesFeed';
import { RouteComplexityForecastCard } from './RouteComplexityForecastCard';
import { RouteComplexityPieWidget } from './RouteComplexityPieWidget';
import { ProfileAttestationCertificateCard } from './ProfileAttestationCertificateCard';
import { PreparationChecklistPdfCard } from './PreparationChecklistPdfCard';
import { QualificationCertificatesJsonExportCard } from './QualificationCertificatesJsonExportCard';
import { AccountDataBackupCard } from './AccountDataBackupCard';
import {
  CompetencyAssessmentQuizCard,
  CompetencyPeriodicBanner,
} from './CompetencyAssessmentQuizCard';
import { HikeScheduleExportCard } from './HikeScheduleExportCard';
import { InstructorAchievementsWidget } from './InstructorAchievementsWidget';
import {
  useInstructorAchievements,
  type AchievementTargetAction,
} from '../utils/instructorAchievements';
import {
  dispatchOpenRcaAssistant,
  dispatchRcaUserContext,
} from './RcaAssistantChatWidget';
import { DfoGuidesLeaderboardWidget } from './DfoGuidesLeaderboardWidget';
import { InstructorReviewsSection } from './InstructorReviewsSection';
import { ReviewStatsWidget } from './ReviewStatsWidget';
import { AuthPanel, type AuthMode } from './account/AuthPanel';
import { CABINET_TABS, CabinetHeader, type CabinetTab } from './account/CabinetHeader';
import {
  AdminBootstrapCard,
  PasswordCard,
  PermissionsCard,
  UserAdminCard,
} from './account/SecurityAndAdminPanel';
import { CuratorInquiriesCrmCard } from './account/CuratorInquiriesCrmCard';
import { AccountNotificationsHub } from './account/AccountNotificationsHub';
import { identityApi, type SessionUser } from '../utils/identityApi';
import { lmsProgressApi, resetLmsProgressClientCache } from '../utils/lmsProgressApi';
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
import type { NavigateOptions, SiteTabId } from '../utils/seo';

type PrepSubTabId = 'track' | 'diagnostics' | 'knowledge';
type DocSubTabId = 'dossier' | 'expeditions';

const VALID_CABINET_TABS = new Set<CabinetTab>([
  'profile',
  'preparation',
  'documents',
  'community',
]);

function resolveCabinetTab(sub?: string): CabinetTab {
  if (sub && VALID_CABINET_TABS.has(sub as CabinetTab)) {
    return sub as CabinetTab;
  }
  return 'profile';
}

const PREP_SUBTAB_BY_ELEMENT: Record<string, PrepSubTabId> = {
  'attestation-path-widget': 'track',
  'attestation-progress-widget': 'track',
  'attestation-progress-details': 'track',
  'personal-roadmap-widget': 'track',
  'attestation-sessions-calendar': 'track',
  'qualification-self-check': 'diagnostics',
  'competency-assessment-quiz': 'diagnostics',
  'attestation-self-diagnostics': 'diagnostics',
  'personal-learning-plan': 'diagnostics',
  'account-knowledge-base': 'knowledge',
  'favorite-literature-cabinet': 'knowledge',
};

const DOC_SUBTAB_BY_ELEMENT: Record<string, DocSubTabId> = {
  'instructor-digital-passport': 'dossier',
  'profile-attestation-certificate': 'dossier',
  'preparation-checklist-pdf': 'dossier',
  'instructor-resume-generator': 'dossier',
  'qualification-certificates-json-export': 'dossier',
  'professional-experience-log': 'expeditions',
  'hike-schedule-export': 'expeditions',
  'experience-routes-leaflet-map': 'expeditions',
  'route-complexity-pie': 'expeditions',
  'route-complexity-forecast': 'expeditions',
  'gear-checklist-generator': 'expeditions',
};

function hasPermission(user: SessionUser | null, permission: string): boolean {
  return Boolean(user?.permissions?.includes(permission));
}

export function AccountSection({
  initialSubTab,
  onSubTabChange,
  onNavigate,
  onOpenGitSync,
}: {
  initialSubTab?: string;
  onSubTabChange?: (subTab: string) => void;
  onNavigate?: (tab: SiteTabId, options?: NavigateOptions) => void;
  onOpenGitSync?: () => void;
} = {}) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [cabinetTab, setCabinetTab] = useState<CabinetTab>(() => resolveCabinetTab(initialSubTab));
  const [prepSubTab, setPrepSubTab] = useState<PrepSubTabId>('track');
  const [docSubTab, setDocSubTab] = useState<DocSubTabId>('dossier');
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
  const [competencyRevision, setCompetencyRevision] = useState<number>(0);
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
    if (initialSubTab) {
      setCabinetTab(resolveCabinetTab(initialSubTab));
    }
  }, [initialSubTab]);

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

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void lmsProgressApi.syncForUser(user.id).then((res) => {
      if (!cancelled && res) {
        setSelfCheckRevision((n) => n + 1);
        setCompetencyRevision((n) => n + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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
      resetLmsProgressClientCache();
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

  const selectCabinetTab = (next: CabinetTab) => {
    setCabinetTab(next);
    onSubTabChange?.(next);
  };

  const navigateCabinetTarget = (targetTab: CabinetTab, elementId: string) => {
    selectCabinetTab(targetTab);
    if (targetTab === 'preparation' && elementId in PREP_SUBTAB_BY_ELEMENT) {
      setPrepSubTab(PREP_SUBTAB_BY_ELEMENT[elementId]);
    } else if (targetTab === 'documents' && elementId in DOC_SUBTAB_BY_ELEMENT) {
      setDocSubTab(DOC_SUBTAB_BY_ELEMENT[elementId]);
    }
    window.setTimeout(() => scrollToElementById(elementId), 80);
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
                    ? () =>
                        onNavigate('learning', {
                          subTab: 'library',
                          anchor: 'recommended-literature',
                        })
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
          selectCabinetTab(tab);
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
            achievementsSummary={achievementsSummary}
            onUpdated={handleAuthenticated}
            onJumpToPreparation={() =>
              navigateCabinetTarget('preparation', 'qualification-self-check')
            }
            onJumpToExperience={() =>
              navigateCabinetTarget('documents', 'professional-experience-log')
            }
            onJumpToAchievements={() =>
              navigateCabinetTarget('community', 'instructor-achievements')
            }
          />

          <CompetencyPeriodicBanner
            user={user}
            revision={competencyRevision}
            onStartQuiz={() =>
              navigateCabinetTarget('preparation', 'competency-assessment-quiz')
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

          {hasPermission(user, 'inquiries:view_all') && (
            <CuratorInquiriesCrmCard onInquiryUpdated={() => void loadInquiries()} />
          )}

          <AccountNotificationsHub
            user={user}
            inquiries={inquiries}
            inquiriesLoading={inquiriesLoading}
            progressSummary={effectiveProgressSummary}
            onRefreshInquiries={
              hasPermission(user, 'inquiries:view_own') ? () => void loadInquiries() : undefined
            }
            onOpenOverview={
              onNavigate ? () => onNavigate('overview', { subTab: 'summary' }) : undefined
            }
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-6">
              <AdminBootstrapCard user={user} onPromoted={handleAuthenticated} />
              <PasswordCard onChanged={() => setUser(null)} />
              {hasPermission(user, 'users:manage') && <UserAdminCard currentUserId={user.id} />}
            </div>
            <div className="lg:col-span-5 space-y-6">
              <PermissionsCard user={user} />
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
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-teal-700">
                Готовность: {effectiveProgressSummary.percent}% · Этапов:{' '}
                {effectiveProgressSummary.completedStages} · Заявок: {inquiries.length}
              </p>
              <h2 className="text-base font-bold text-slate-900">
                Персональный контур подготовки и аттестации
              </h2>
            </div>

            <div
              role="tablist"
              aria-label="Подразделы подготовки соискателя"
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start lg:self-auto"
            >
              {(
                [
                  { id: 'track', label: 'Трек, календарь и план' },
                  { id: 'diagnostics', label: 'Самопроверка и тесты' },
                  { id: 'knowledge', label: 'База знаний и литература' },
                ] as const
              ).map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  role="tab"
                  aria-selected={prepSubTab === sub.id}
                  onClick={() => setPrepSubTab(sub.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    prepSubTab === sub.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          </div>

          {prepSubTab === 'track' && (
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
                onOpenApplication={
                  onNavigate
                    ? () =>
                        onNavigate('overview', {
                          subTab: 'summary',
                          anchor: 'inquiry-section',
                        })
                    : undefined
                }
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
            </div>
          )}

          {prepSubTab === 'diagnostics' && (
            <div className="space-y-6">
              <QualificationSelfCheckWidget
                user={user}
                onChange={() => setSelfCheckRevision((n) => n + 1)}
                onJumpToKnowledgeBase={jumpToKnowledgeBaseWithQuery}
                onJumpToConsultant={() =>
                  openAiAssistant('Помогите разобраться с пробелами по итогам самопроверки.')
                }
              />

              <CompetencyAssessmentQuizCard
                user={user}
                onJumpToKnowledgeBase={jumpToKnowledgeBaseWithQuery}
                onUpdated={() => setCompetencyRevision((n) => n + 1)}
              />

              <AttestationSelfDiagnosticsWidget
                user={user}
                onJumpToKnowledgeBase={jumpToKnowledgeBaseWithQuery}
                onJumpToConsultant={(prompt) => openAiAssistant(prompt)}
                onJumpToSelfCheck={() => scrollToElementById('qualification-self-check')}
                onJumpToCalendar={() =>
                  navigateCabinetTarget('preparation', 'attestation-sessions-calendar')
                }
              />

              <PersonalLearningPlanWidget
                user={user}
                selfCheckRevision={selfCheckRevision}
                selectedContour={selectedContour}
                onJumpToDiagnostics={() => scrollToElementById('attestation-self-diagnostics')}
              />
            </div>
          )}

          {prepSubTab === 'knowledge' && (
            <div className="space-y-6">
              <AccountKnowledgeBaseWidget
                user={user}
                externalSearch={kbExternalSearch}
                onNavigate={onNavigate}
                onJumpToChecklist={() =>
                  navigateCabinetTarget('preparation', 'qualification-self-check')
                }
                onJumpToConsultant={() => openAiAssistant()}
              />

              <FavoriteLiteratureCabinetWidget
                userId={user.id}
                onOpenOverviewLibrary={
                  onNavigate
                    ? () =>
                        onNavigate('learning', {
                          subTab: 'library',
                          anchor: 'recommended-literature',
                        })
                    : undefined
                }
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 3: EXPERIENCE JOURNAL & OFFICIAL DOCUMENTS */}
      {cabinetTab === 'documents' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-teal-700">
                Паспорт инструктора · Сертификаты PDF/JSON · Полевой стаж и маршруты
              </p>
              <h2 className="text-base font-bold text-slate-900">
                Документы соискателя и журнал экспедиционного опыта
              </h2>
            </div>

            <div
              role="tablist"
              aria-label="Подразделы документов и стажа"
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start lg:self-auto"
            >
              {(
                [
                  { id: 'dossier', label: 'Паспорт, сертификаты и резюме' },
                  { id: 'expeditions', label: 'Журнал стажа, маршруты и снаряжение' },
                ] as const
              ).map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  role="tab"
                  aria-selected={docSubTab === sub.id}
                  onClick={() => setDocSubTab(sub.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    docSubTab === sub.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          </div>

          {docSubTab === 'dossier' && (
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
            </div>
          )}

          {docSubTab === 'expeditions' && (
            <div className="space-y-6">
              <ProfessionalExperienceLogCard user={user} />

              <HikeScheduleExportCard user={user} />

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
        </div>
      )}

      {/* TAB 4: COMMUNITY, ACHIEVEMENTS, LEADERBOARD & REVIEWS */}
      {cabinetTab === 'community' && (
        <div className="space-y-6">
          <SocialProfileSection
            userId={user.id}
            currentUserId={user.id}
            userAvatarUrl={user.avatarUrl}
            userEmail={user.email}
            permissions={user.permissions}
            onProfileSynced={(updatedProfile) => {
              setUser((prev) =>
                prev
                  ? {
                      ...prev,
                      fullName: updatedProfile.displayName || prev.fullName,
                      region: updatedProfile.region || prev.region,
                      organisation: updatedProfile.organisation ?? prev.organisation,
                      phone: updatedProfile.phone ?? prev.phone,
                      telegram: updatedProfile.telegram ?? prev.telegram,
                      avatarUrl: updatedProfile.avatarUrl ?? prev.avatarUrl,
                    }
                  : prev
              );
            }}
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
