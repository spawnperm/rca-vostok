import { ROLE_LABELS, type Role, type SessionUser } from './identityApi.ts';
import type { UserAttestationSummary } from '../components/AttestationProgressWidget.tsx';
import type { InquiryRecord } from '../components/social/MyInquiriesSection.tsx';
import type { LinkedAccountDTO } from '../domain/identity/LinkedAccounts.ts';
import {
  formatRussianDate,
  readStoredRoadmapPrefs,
  type PreparationContour,
  type StoredRoadmapPrefs,
} from './personalRoadmap.ts';
import {
  evaluateSelfCheck,
  QUALIFICATION_TRACKS,
  readStoredSelfCheck,
  type StoredSelfCheckState,
} from './qualificationSelfCheck.ts';
import {
  evaluateAttestationDiagnostics,
  readStoredDiagnosticsState,
  type StoredDiagnosticsState,
} from './attestationSelfDiagnostics.ts';
import {
  readStoredPassportExtras,
  sanitizePassportFileSlug,
  type StoredPassportExtras,
} from './instructorPassportExport.ts';
import {
  computeComplexityTierDistribution,
  computeJournalMetrics,
  experienceJournalGateway,
  forecastNextRouteComplexity,
  readStoredExperienceJournal,
  type ComplexityTierDistribution,
  type ExperienceJournalMetrics,
  type ExperienceLogEntry,
  type RouteComplexityForecastResult,
} from './experienceJournal.ts';
import {
  type AchievementCategorySummary,
  type EvaluatedAchievement,
  type InstructorAchievementsSummary,
} from '../domain/experience/InstructorAchievementsService.ts';
import { getFavoriteLiteratureIds } from './recommendedLiterature.ts';
import {
  readNotificationSubscriptionPrefs,
  type NotificationSubscriptionPrefs,
} from './notificationSubscriptions.ts';

export const ACCOUNT_BACKUP_SCHEMA_VERSION = 'rca-vostok.account-backup.v1' as const;

export type AccountBackupScope = 'full' | 'statistics' | 'achievements' | 'hike_history';

export interface AccountBackupBuildInput {
  user: SessionUser;
  progressSummary: UserAttestationSummary;
  achievementsSummary: InstructorAchievementsSummary;
  experienceEntries?: readonly ExperienceLogEntry[];
  inquiries?: readonly InquiryRecord[];
  linkedAccounts?: readonly LinkedAccountDTO[];
  selectedExamDate?: string;
  selectedContour?: PreparationContour;
  selfCheckOverride?: StoredSelfCheckState;
  diagnosticsOverride?: StoredDiagnosticsState;
  roadmapPrefsOverride?: StoredRoadmapPrefs;
  passportExtrasOverride?: StoredPassportExtras;
  favoriteLiteratureIdsOverride?: readonly string[];
  notificationPrefsOverride?: NotificationSubscriptionPrefs;
  now?: Date;
}

export interface SanitizedLinkedAccountBackupItem {
  provider: LinkedAccountDTO['provider'];
  connectionMethod: LinkedAccountDTO['connectionMethod'];
  displayName: string;
  preferredTrack: string;
  profileUrl: string;
  linkedAt: string;
  useForExamAutofill: boolean;
}

export interface AccountBackupPayload {
  meta: {
    schemaVersion: typeof ACCOUNT_BACKUP_SCHEMA_VERSION;
    backupPurpose: 'full-user-data-backup-and-portability';
    exportedAtIso: string;
    exportedDateFormatted: string;
    platform: string;
  };
  profile: {
    userId: string;
    fullName: string;
    email: string;
    role: Role;
    roleLabel: string;
    region: string;
    organisation: string;
    attestationExpiresAt: string | null;
    linkedAccounts: SanitizedLinkedAccountBackupItem[];
    roadmapPreferences: StoredRoadmapPrefs;
    notificationPreferences: NotificationSubscriptionPrefs;
    favoriteLiteratureIds: string[];
    passportExtras: StoredPassportExtras;
  };
  statistics: {
    attestation: {
      overallPercent: number;
      completedTasks: number;
      totalTasks: number;
      completedStages: number;
      totalStages: number;
      activeStageId: string;
      activeStageLabel: string;
      selectedExamDate: string;
      selectedContour: PreparationContour;
      stages: {
        id: string;
        title: string;
        status: 'completed' | 'in_progress' | 'pending';
        completedCount: number;
        totalCount: number;
        percent: number;
      }[];
    };
    experience: {
      metrics: ExperienceJournalMetrics;
      complexityTiers: ComplexityTierDistribution;
      nextComplexityForecast: RouteComplexityForecastResult;
    };
    qualificationSelfCheck: {
      trackId: string;
      trackLabel: string;
      answeredCount: number;
      totalQuestions: number;
      isComplete: boolean;
      readinessPercent: number;
      confirmedCount: number;
      partialCount: number;
      missingCount: number;
      verdictTier: string;
      verdictTitle: string;
      domains: {
        domainId: string;
        title: string;
        percent: number;
        earned: number;
        max: number;
      }[];
    };
    safetyDiagnostics: {
      answeredCount: number;
      totalQuestions: number;
      overallPercent: number;
      isComplete: boolean;
      readinessTier: string;
      verdictLabel: string;
      sections: {
        id: string;
        title: string;
        scorePercent: number;
        status: string;
        answeredCount: number;
        totalCount: number;
      }[];
    };
    inquiriesSummary: {
      totalCount: number;
      byStatus: Record<string, number>;
    };
  };
  achievements: {
    unlockedCount: number;
    totalCount: number;
    completionPercent: number;
    byCategory: AchievementCategorySummary[];
    metricsSnapshot: InstructorAchievementsSummary['metricsSnapshot'];
    unlockedBadges: {
      id: string;
      title: string;
      shortBadgeLabel: string;
      category: string;
      tier: string;
      description: string;
    }[];
    allAchievements: EvaluatedAchievement[];
  };
  hikeHistory: {
    totalEntries: number;
    totalDistanceKm: number;
    maxComplexity: string;
    entries: ExperienceLogEntry[];
  };
  inquiries: {
    id: string;
    track: string;
    region: string;
    sessionDate: string | null;
    status: InquiryRecord['status'];
    createdAt: string;
    statusComment: string | null;
  }[];
}

export type ScopedAccountBackupPayload =
  | AccountBackupPayload
  | {
      meta: AccountBackupPayload['meta'] & { exportScope: 'statistics' };
      profile: Pick<AccountBackupPayload['profile'], 'userId' | 'fullName' | 'email' | 'region'>;
      statistics: AccountBackupPayload['statistics'];
    }
  | {
      meta: AccountBackupPayload['meta'] & { exportScope: 'achievements' };
      profile: Pick<AccountBackupPayload['profile'], 'userId' | 'fullName' | 'email' | 'region'>;
      achievements: AccountBackupPayload['achievements'];
    }
  | {
      meta: AccountBackupPayload['meta'] & { exportScope: 'hike_history' };
      profile: Pick<AccountBackupPayload['profile'], 'userId' | 'fullName' | 'email' | 'region'>;
      hikeHistory: AccountBackupPayload['hikeHistory'];
    };

export function buildAccountBackupPayload({
  user,
  progressSummary,
  achievementsSummary,
  experienceEntries,
  inquiries = [],
  linkedAccounts = [],
  selectedExamDate,
  selectedContour,
  selfCheckOverride,
  diagnosticsOverride,
  roadmapPrefsOverride,
  passportExtrasOverride,
  favoriteLiteratureIdsOverride,
  notificationPrefsOverride,
  now = new Date(),
}: AccountBackupBuildInput): AccountBackupPayload {
  const exportedAtIso = now.toISOString();
  const exportedDateFormatted = formatRussianDate(exportedAtIso.slice(0, 10));

  const entries = [...(experienceEntries ?? readStoredExperienceJournal(user.id, user.region))].sort(
    (a, b) => b.date.localeCompare(a.date)
  );
  const experienceMetrics = computeJournalMetrics(entries);
  const complexityTiers = computeComplexityTierDistribution(entries);
  const nextComplexityForecast = forecastNextRouteComplexity(entries);

  const roadmapPreferences = roadmapPrefsOverride ?? readStoredRoadmapPrefs(user.id);
  const resolvedExamDate = selectedExamDate ?? roadmapPreferences.examDateIso;
  const resolvedContour = selectedContour ?? roadmapPreferences.contour;

  const selfCheckState = selfCheckOverride ?? readStoredSelfCheck(user.id);
  const selfCheckEval = evaluateSelfCheck(selfCheckState.answers, selfCheckState.track);
  const trackMeta =
    QUALIFICATION_TRACKS.find((t) => t.id === selfCheckState.track) ?? QUALIFICATION_TRACKS[0];

  const diagState = diagnosticsOverride ?? readStoredDiagnosticsState(user.id);
  const diagEval = evaluateAttestationDiagnostics(diagState.answers);

  const passportExtras =
    passportExtrasOverride ?? readStoredPassportExtras(user.id, [...inquiries]);
  const favoriteLiteratureIds = [
    ...(favoriteLiteratureIdsOverride ?? getFavoriteLiteratureIds(user.id)),
  ];
  const notificationPreferences =
    notificationPrefsOverride ?? readNotificationSubscriptionPrefs(user.id, user.region);

  const inquiriesByStatus: Record<string, number> = {};
  for (const inq of inquiries) {
    inquiriesByStatus[inq.status] = (inquiriesByStatus[inq.status] ?? 0) + 1;
  }

  const sanitizedLinkedAccounts: SanitizedLinkedAccountBackupItem[] = linkedAccounts.map((acc) => ({
    provider: acc.provider,
    connectionMethod: acc.connectionMethod,
    displayName: acc.displayName,
    preferredTrack: acc.preferredTrack,
    profileUrl: acc.profileUrl,
    linkedAt: acc.linkedAt,
    useForExamAutofill: acc.useForExamAutofill,
  }));

  const unlockedBadges = achievementsSummary.achievements
    .filter((a) => a.unlocked)
    .map((a) => ({
      id: a.id,
      title: a.title,
      shortBadgeLabel: a.shortBadgeLabel,
      category: a.category,
      tier: a.tier,
      description: a.description,
    }));

  return {
    meta: {
      schemaVersion: ACCOUNT_BACKUP_SCHEMA_VERSION,
      backupPurpose: 'full-user-data-backup-and-portability',
      exportedAtIso,
      exportedDateFormatted,
      platform: 'РЦА «Русский Восток» (ВВГУ · ФСТР)',
    },
    profile: {
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role],
      region: user.region,
      organisation: user.organisation,
      attestationExpiresAt: user.attestationExpiresAt ?? null,
      linkedAccounts: sanitizedLinkedAccounts,
      roadmapPreferences,
      notificationPreferences,
      favoriteLiteratureIds,
      passportExtras,
    },
    statistics: {
      attestation: {
        overallPercent: progressSummary.percent,
        completedTasks: progressSummary.completedTasks,
        totalTasks: progressSummary.totalTasks,
        completedStages: progressSummary.completedStages,
        totalStages: progressSummary.stages.length,
        activeStageId: progressSummary.activeStage.id,
        activeStageLabel: progressSummary.activeStage.title,
        selectedExamDate: resolvedExamDate,
        selectedContour: resolvedContour,
        stages: progressSummary.stages.map((s) => ({
          id: s.stage.id,
          title: s.stage.title,
          status: s.status,
          completedCount: s.completedCount,
          totalCount: s.totalCount,
          percent: s.percent,
        })),
      },
      experience: {
        metrics: experienceMetrics,
        complexityTiers,
        nextComplexityForecast,
      },
      qualificationSelfCheck: {
        trackId: trackMeta.id,
        trackLabel: trackMeta.label,
        answeredCount: selfCheckEval.answeredCount,
        totalQuestions: selfCheckEval.totalQuestions,
        isComplete: selfCheckEval.isComplete,
        readinessPercent: selfCheckEval.readinessPercent,
        confirmedCount: selfCheckEval.confirmedCount,
        partialCount: selfCheckEval.partialCount,
        missingCount: selfCheckEval.missingCount,
        verdictTier: selfCheckEval.verdictTier,
        verdictTitle: selfCheckEval.verdictTitle,
        domains: selfCheckEval.domainBreakdown.map((d) => ({
          domainId: d.id,
          title: d.label,
          percent: d.percent,
          earned: d.earned,
          max: d.max,
        })),
      },
      safetyDiagnostics: {
        answeredCount: diagEval.answeredCount,
        totalQuestions: diagEval.totalQuestions,
        overallPercent: diagEval.overallPercent,
        isComplete: diagEval.isComplete,
        readinessTier: diagEval.readinessTier,
        verdictLabel: diagEval.verdictLabel,
        sections: diagEval.sections.map((sec) => ({
          id: sec.id,
          title: sec.shortTitle,
          scorePercent: sec.scorePercent,
          status: sec.status,
          answeredCount: sec.answeredCount,
          totalCount: sec.totalCount,
        })),
      },
      inquiriesSummary: {
        totalCount: inquiries.length,
        byStatus: inquiriesByStatus,
      },
    },
    achievements: {
      unlockedCount: achievementsSummary.unlockedCount,
      totalCount: achievementsSummary.totalCount,
      completionPercent: achievementsSummary.completionPercent,
      byCategory: achievementsSummary.byCategory,
      metricsSnapshot: achievementsSummary.metricsSnapshot,
      unlockedBadges,
      allAchievements: achievementsSummary.achievements,
    },
    hikeHistory: {
      totalEntries: entries.length,
      totalDistanceKm: experienceMetrics.totalDistanceKm,
      maxComplexity: experienceMetrics.maxComplexity,
      entries,
    },
    inquiries: inquiries.map((inq) => ({
      id: inq.id,
      track: inq.track,
      region: inq.region,
      sessionDate: inq.sessionDate ?? null,
      status: inq.status,
      createdAt: inq.createdAt,
      statusComment: inq.statusComment ?? null,
    })),
  };
}

export function selectAccountBackupScope(
  payload: AccountBackupPayload,
  scope: AccountBackupScope = 'full'
): ScopedAccountBackupPayload {
  const identityHeader = {
    userId: payload.profile.userId,
    fullName: payload.profile.fullName,
    email: payload.profile.email,
    region: payload.profile.region,
  };

  switch (scope) {
    case 'statistics':
      return {
        meta: { ...payload.meta, exportScope: 'statistics' },
        profile: identityHeader,
        statistics: payload.statistics,
      };
    case 'achievements':
      return {
        meta: { ...payload.meta, exportScope: 'achievements' },
        profile: identityHeader,
        achievements: payload.achievements,
      };
    case 'hike_history':
      return {
        meta: { ...payload.meta, exportScope: 'hike_history' },
        profile: identityHeader,
        hikeHistory: payload.hikeHistory,
      };
    case 'full':
    default:
      return payload;
  }
}

export function buildAccountBackupFileName(
  payload: AccountBackupPayload,
  scope: AccountBackupScope = 'full'
): string {
  const slug = sanitizePassportFileSlug(payload.profile.fullName);
  const dateIso = payload.meta.exportedAtIso.slice(0, 10);
  const scopePart = scope === 'full' ? 'full' : scope.replace('_', '-');
  return `rca-vostok-backup-${slug}-${scopePart}-${dateIso}.json`;
}

export function serializeAccountBackupJson(
  payload: AccountBackupPayload,
  scope: AccountBackupScope = 'full',
  options: { pretty?: boolean } = {}
): string {
  const scoped = selectAccountBackupScope(payload, scope);
  return JSON.stringify(scoped, null, options.pretty === false ? 0 : 2);
}

export function downloadAccountBackupJson(
  payload: AccountBackupPayload,
  scope: AccountBackupScope = 'full',
  options: { pretty?: boolean } = {}
): { fileName: string; byteSize: number; formattedSize: string } {
  const fileName = buildAccountBackupFileName(payload, scope);
  const jsonText = serializeAccountBackupJson(payload, scope, options);
  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8;' });
  const byteSize = blob.size;
  const formattedSize =
    byteSize >= 1024 ? `${(byteSize / 1024).toFixed(1)} КБ` : `${byteSize} Б`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { fileName, byteSize, formattedSize };
}

export async function collectAndDownloadFullAccountBackup(
  input: Omit<AccountBackupBuildInput, 'experienceEntries'>,
  options: { scope?: AccountBackupScope; pretty?: boolean } = {}
): Promise<{
  payload: AccountBackupPayload;
  fileName: string;
  byteSize: number;
  formattedSize: string;
}> {
  const entries = await experienceJournalGateway
    .load(input.user.id, input.user.region)
    .catch(() => readStoredExperienceJournal(input.user.id, input.user.region));

  const payload = buildAccountBackupPayload({
    ...input,
    experienceEntries: entries,
  });

  const downloadInfo = downloadAccountBackupJson(payload, options.scope ?? 'full', {
    pretty: options.pretty ?? true,
  });

  return {
    payload,
    ...downloadInfo,
  };
}
