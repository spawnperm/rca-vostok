import { useEffect, useMemo, useState } from 'react';
import {
  evaluateInstructorAchievements,
  type AchievementEvaluationInput,
  type InstructorAchievementsSummary,
} from '../domain/experience/InstructorAchievementsService.ts';
import {
  EXPERIENCE_JOURNAL_UPDATED_EVENT,
  experienceJournalGateway,
  readStoredExperienceJournal,
  type ExperienceLogEntry,
} from './experienceJournal.ts';
import {
  DIAGNOSTICS_UPDATED_EVENT,
  evaluateAttestationDiagnostics,
  readStoredDiagnosticsState,
} from './attestationSelfDiagnostics.ts';
import {
  SELF_CHECK_UPDATED_EVENT,
  evaluateSelfCheck,
  readStoredSelfCheck,
} from './qualificationSelfCheck.ts';
import type { SessionUser } from './identityApi.ts';
import type { LinkedAccountDTO } from './linkedAccountsApi.ts';

export * from '../domain/experience/InstructorAchievementsService.ts';

export interface ClientAchievementsSourceParams {
  user: SessionUser | null;
  attestationPercent?: number;
  completedStagesCount?: number;
  inquiries?: readonly { status: string; track?: string }[];
  linkedAccounts?: readonly LinkedAccountDTO[];
  selfCheckRevision?: number;
}

export function buildAchievementInputFromClientState(
  params: ClientAchievementsSourceParams,
  entries: readonly ExperienceLogEntry[]
): AchievementEvaluationInput {
  const userId = params.user?.id ?? null;

  let selfCheckConfirmedCount = 0;
  if (userId) {
    const sc = readStoredSelfCheck(userId);
    selfCheckConfirmedCount = evaluateSelfCheck(sc.answers, sc.track).confirmedCount;
  }

  const diagStored = readStoredDiagnosticsState(userId);
  const diagEval = evaluateAttestationDiagnostics(diagStored.answers);

  return {
    entries,
    role: params.user?.role ?? 'guest',
    attestationPercent: params.attestationPercent ?? 0,
    completedStagesCount: params.completedStagesCount ?? 0,
    fullName: params.user?.fullName ?? '',
    region: params.user?.region ?? '',
    organisation: params.user?.organisation ?? '',
    hasAttestationExpiry: Boolean(params.user?.attestationExpiresAt),
    inquiries: params.inquiries ?? [],
    selfCheckConfirmedCount,
    diagnosticsPercent: diagEval.answeredCount > 0 ? diagEval.overallPercent : null,
    diagnosticsComplete: diagEval.isComplete,
    linkedAccountsCount: params.linkedAccounts?.length ?? 0,
  };
}

/**
 * Reactive hook evaluating professional achievements from live experience journal,
 * attestation progress, profile fields, linked profiles, self-check, and diagnostics.
 */
export function useInstructorAchievements(
  params: ClientAchievementsSourceParams
): InstructorAchievementsSummary {
  const userId = params.user?.id ?? null;
  const preferredRegion = params.user?.region;

  const [entries, setEntries] = useState<ExperienceLogEntry[]>(() =>
    readStoredExperienceJournal(userId, preferredRegion)
  );
  const [localRevision, setLocalRevision] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    setEntries(readStoredExperienceJournal(userId, preferredRegion));
    void experienceJournalGateway
      .load(userId, preferredRegion)
      .then((loaded) => {
        if (!cancelled) {
          setEntries(loaded);
        }
      })
      .catch(() => {
        // Fallback already populated synchronously
      });
    return () => {
      cancelled = true;
    };
  }, [userId, preferredRegion]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleJournalUpdated = () => {
      setEntries(readStoredExperienceJournal(userId, preferredRegion));
      setLocalRevision((n) => n + 1);
    };

    const handleLocalMetricsUpdated = () => {
      setLocalRevision((n) => n + 1);
    };

    window.addEventListener(EXPERIENCE_JOURNAL_UPDATED_EVENT, handleJournalUpdated);
    window.addEventListener(DIAGNOSTICS_UPDATED_EVENT, handleLocalMetricsUpdated);
    window.addEventListener(SELF_CHECK_UPDATED_EVENT, handleLocalMetricsUpdated);
    window.addEventListener('storage', handleJournalUpdated);

    return () => {
      window.removeEventListener(EXPERIENCE_JOURNAL_UPDATED_EVENT, handleJournalUpdated);
      window.removeEventListener(DIAGNOSTICS_UPDATED_EVENT, handleLocalMetricsUpdated);
      window.removeEventListener(SELF_CHECK_UPDATED_EVENT, handleLocalMetricsUpdated);
      window.removeEventListener('storage', handleJournalUpdated);
    };
  }, [userId, preferredRegion]);

  return useMemo(() => {
    const input = buildAchievementInputFromClientState(params, entries);
    return evaluateInstructorAchievements(input);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    entries,
    params.user?.id,
    params.user?.role,
    params.user?.fullName,
    params.user?.region,
    params.user?.organisation,
    params.user?.attestationExpiresAt,
    params.attestationPercent,
    params.completedStagesCount,
    params.inquiries,
    params.linkedAccounts,
    params.selfCheckRevision,
    localRevision,
  ]);
}
