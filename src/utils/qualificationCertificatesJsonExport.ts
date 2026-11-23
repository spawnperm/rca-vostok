import { ROLE_LABELS, type SessionUser } from './identityApi.ts';
import type { UserAttestationSummary } from '../components/AttestationProgressWidget.tsx';
import type { InquiryRecord } from '../components/social/MyInquiriesSection.tsx';
import type { LinkedAccountDTO } from '../domain/identity/LinkedAccounts.ts';
import { formatRussianDate, type PreparationContour } from './personalRoadmap.ts';
import {
  evaluateSelfCheck,
  QUALIFICATION_TRACKS,
  readStoredSelfCheck,
  type DomainEvaluation,
  type QualificationTrackId,
  type SelfCheckVerdictTier,
  type StoredSelfCheckState,
} from './qualificationSelfCheck.ts';
import {
  buildInstructorDigitalPassport,
  readStoredPassportExtras,
  sanitizePassportFileSlug,
  type MaxRouteCategory,
  type PassportAttestationEntry,
  type PassportSkillEntry,
  type StoredPassportExtras,
} from './instructorPassportExport.ts';
import {
  buildProfileAttestationCertificateData,
  type ProfileAttestationCertificateData,
} from './profileCertificatePdf.ts';
import {
  buildFinalAttestationCertificateData,
  isAttestationEligibleForCertificate,
  type FinalAttestationCertificateData,
} from './attestationFinalCertificatePdf.ts';

export type JsonExportScope = 'all' | 'qualification' | 'certificates';

export interface QualificationCertificatesExportInput {
  user: SessionUser;
  summary: UserAttestationSummary;
  inquiries?: InquiryRecord[];
  linkedAccounts?: LinkedAccountDTO[];
  selectedExamDate?: string;
  selectedContour?: PreparationContour;
  selfCheckOverride?: StoredSelfCheckState;
  passportExtrasOverride?: StoredPassportExtras;
  now?: Date;
}

export interface ExternalLinkedCredentialItem {
  provider: LinkedAccountDTO['provider'];
  connectionMethod: LinkedAccountDTO['connectionMethod'];
  displayName: string;
  preferredTrack: string;
  profileUrl: string;
  linkedAt: string;
}

export interface QualificationCertificatesExportPayload {
  schemaVersion: 'rca-vostok.qualification-certificates.v1';
  exportScope: JsonExportScope;
  exportedAtIso: string;
  exportedDateFormatted: string;
  issuer: {
    center: string;
    federalDistrict: string;
    regulation: string;
  };
  instructor: {
    userId: string;
    fullName: string;
    email: string;
    role: SessionUser['role'];
    roleLabel: string;
    region: string;
    organisation: string;
  };
  qualification: {
    trackId: QualificationTrackId;
    trackLabel: string;
    selfCheck: {
      answeredCount: number;
      totalQuestions: number;
      isComplete: boolean;
      readinessPercent: number;
      confirmedCount: number;
      partialCount: number;
      missingCount: number;
      verdictTier: SelfCheckVerdictTier;
      verdictTitle: string;
      recommendedContour: string;
      domains: DomainEvaluation[];
    };
    competencies: PassportSkillEntry[];
    experience: {
      yearsOfExperience: number;
      completedRoutesCount: number;
      maxRouteCategory: MaxRouteCategory;
      summary: string;
    };
    linkedExternalProfiles: ExternalLinkedCredentialItem[];
  };
  certificates: {
    profileAttestationCertificate: ProfileAttestationCertificateData;
    finalAttestationEligible: boolean;
    finalAttestationCertificate: FinalAttestationCertificateData | null;
    attestationProgress: {
      overallPercent: number;
      completedStagesCount: number;
      totalStagesCount: number;
      activeStageLabel: string;
      registryStatus: string;
      stages: PassportAttestationEntry[];
    };
    inquiries: {
      id: string;
      track: string;
      region: string;
      sessionDate: string | null;
      status: InquiryRecord['status'];
      createdAt: string;
    }[];
  };
}

export type ScopedQualificationCertificatesExport =
  | QualificationCertificatesExportPayload
  | Omit<QualificationCertificatesExportPayload, 'certificates'>
  | Omit<QualificationCertificatesExportPayload, 'qualification'>;

export function buildQualificationCertificatesExportPayload({
  user,
  summary,
  inquiries = [],
  linkedAccounts = [],
  selectedExamDate,
  selectedContour = 'contour_b',
  selfCheckOverride,
  passportExtrasOverride,
  now = new Date(),
}: QualificationCertificatesExportInput): QualificationCertificatesExportPayload {
  const exportedAtIso = now.toISOString();
  const exportedDateFormatted = formatRussianDate(exportedAtIso.slice(0, 10));

  const selfCheckState = selfCheckOverride ?? readStoredSelfCheck(user.id);
  const selfCheckEval = evaluateSelfCheck(selfCheckState.answers, selfCheckState.track);
  const trackMeta =
    QUALIFICATION_TRACKS.find((t) => t.id === selfCheckState.track) ??
    QUALIFICATION_TRACKS[0];

  const extras = passportExtrasOverride ?? readStoredPassportExtras(user.id, inquiries);
  const passport = buildInstructorDigitalPassport({
    user,
    summary,
    inquiries,
    extras,
    selfCheckOverride: selfCheckState,
    now,
  });

  const profileCert = buildProfileAttestationCertificateData({
    user,
    summary,
    inquiries,
    contour: selectedContour,
    examDateIso: selectedExamDate,
    now,
  });

  const finalEligible = isAttestationEligibleForCertificate(summary);
  const finalCert = finalEligible
    ? buildFinalAttestationCertificateData(
        user,
        summary,
        inquiries,
        selectedExamDate,
        now
      )
    : null;

  return {
    schemaVersion: 'rca-vostok.qualification-certificates.v1',
    exportScope: 'all',
    exportedAtIso,
    exportedDateFormatted,
    issuer: {
      center: 'РЦА «Русский Восток» (ВВГУ · ФСТР)',
      federalDistrict: 'Дальневосточный федеральный округ',
      regulation: 'Постановление Правительства РФ № 1003 (в редакции № 1893)',
    },
    instructor: {
      userId: user.id,
      fullName: user.fullName.trim() || 'Инструктор-проводник ДФО',
      email: user.email,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role],
      region: user.region?.trim() || 'Приморский край',
      organisation:
        user.organisation?.trim() || 'Независимый инструктор-проводник',
    },
    qualification: {
      trackId: selfCheckState.track,
      trackLabel: trackMeta.label,
      selfCheck: {
        answeredCount: selfCheckEval.answeredCount,
        totalQuestions: selfCheckEval.totalQuestions,
        isComplete: selfCheckEval.isComplete,
        readinessPercent: selfCheckEval.readinessPercent,
        confirmedCount: selfCheckEval.confirmedCount,
        partialCount: selfCheckEval.partialCount,
        missingCount: selfCheckEval.missingCount,
        verdictTier: selfCheckEval.verdictTier,
        verdictTitle: selfCheckEval.verdictTitle,
        recommendedContour: selfCheckEval.recommendedContour,
        domains: selfCheckEval.domainBreakdown,
      },
      competencies: passport.confirmedSkills,
      experience: passport.experience,
      linkedExternalProfiles: linkedAccounts.map((acc) => ({
        provider: acc.provider,
        connectionMethod: acc.connectionMethod,
        displayName: acc.displayName,
        preferredTrack: acc.preferredTrack,
        profileUrl: acc.profileUrl,
        linkedAt: acc.linkedAt,
      })),
    },
    certificates: {
      profileAttestationCertificate: profileCert,
      finalAttestationEligible: finalEligible,
      finalAttestationCertificate: finalCert,
      attestationProgress: {
        overallPercent: passport.attestations.overallProgressPercent,
        completedStagesCount: passport.attestations.completedStagesCount,
        totalStagesCount: passport.attestations.totalStagesCount,
        activeStageLabel: passport.attestations.activeStageLabel,
        registryStatus: passport.attestations.registryStatus,
        stages: passport.attestations.stages,
      },
      inquiries: inquiries.map((inq) => ({
        id: inq.id,
        track: inq.track,
        region: inq.region,
        sessionDate: inq.sessionDate ?? null,
        status: inq.status,
        createdAt: inq.createdAt,
      })),
    },
  };
}

export function buildScopedQualificationCertificatesObject(
  payload: QualificationCertificatesExportPayload,
  scope: JsonExportScope
): ScopedQualificationCertificatesExport {
  if (scope === 'qualification') {
    const { certificates: _omitted, ...rest } = payload;
    return {
      ...rest,
      exportScope: 'qualification',
    };
  }
  if (scope === 'certificates') {
    const { qualification: _omitted, ...rest } = payload;
    return {
      ...rest,
      exportScope: 'certificates',
    };
  }
  return {
    ...payload,
    exportScope: 'all',
  };
}

export function buildQualificationCertificatesJsonString(
  payload: QualificationCertificatesExportPayload,
  scope: JsonExportScope = 'all',
  options: { pretty?: boolean } = {}
): string {
  const scoped = buildScopedQualificationCertificatesObject(payload, scope);
  return JSON.stringify(scoped, null, options.pretty !== false ? 2 : undefined);
}

export function buildQualificationCertificatesFileName(
  payload: QualificationCertificatesExportPayload,
  scope: JsonExportScope = 'all'
): string {
  const datePart = payload.exportedAtIso.slice(0, 10);
  const slug = sanitizePassportFileSlug(payload.instructor.fullName);
  const prefix =
    scope === 'qualification'
      ? 'Kvalifikaciya_RCA'
      : scope === 'certificates'
        ? 'Sertifikaty_RCA'
        : 'Kvalifikaciya_i_Sertifikaty_RCA';
  return `${prefix}_${slug}_${datePart}.json`;
}

export function downloadQualificationCertificatesJson(
  payload: QualificationCertificatesExportPayload,
  scope: JsonExportScope = 'all',
  options: { pretty?: boolean } = {}
): { fileName: string; jsonContent: string } {
  const jsonContent = buildQualificationCertificatesJsonString(payload, scope, options);
  const fileName = buildQualificationCertificatesFileName(payload, scope);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { fileName, jsonContent };
}
