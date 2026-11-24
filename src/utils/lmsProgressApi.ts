import {
  DIAGNOSTIC_SECTIONS,
  readStoredDiagnosticsState,
  writeStoredDiagnosticsState,
  type DiagnosticSectionId,
  type StoredDiagnosticsState,
} from './attestationSelfDiagnostics';
import {
  readStoredCompetencyQuizState,
  writeStoredCompetencyQuizState,
  type StoredCompetencyQuizState,
} from './competencyQuiz';
import type { LearningPrepLevelId } from './learningPlanPdf';
import type { PreparationContour } from './personalRoadmap';
import {
  readStoredSelfCheck,
  writeStoredSelfCheck,
  type StoredSelfCheckState,
} from './qualificationSelfCheck';

export interface StoredLearningPlanState {
  levelId: LearningPrepLevelId;
  contour: PreparationContour;
  gapDomainIds: DiagnosticSectionId[];
  updatedAt: string | null;
}

export interface ServerLmsProgressResponse {
  hasSavedData: boolean;
  progress: {
    selfCheck: StoredSelfCheckState;
    competencyQuiz: StoredCompetencyQuizState & { updatedAt?: string | null };
    learningPlan: StoredLearningPlanState;
    diagnostics: StoredDiagnosticsState;
    updatedAt: string | null;
  };
}

export interface PartialLmsProgressPayload {
  selfCheck?: StoredSelfCheckState;
  competencyQuiz?: StoredCompetencyQuizState & { updatedAt?: string | null };
  learningPlan?: StoredLearningPlanState;
  diagnostics?: StoredDiagnosticsState;
}

const LEARNING_PLAN_STORAGE_PREFIX = 'rca_learning_plan_v1_';
export const LEARNING_PLAN_UPDATED_EVENT = 'rca-learning-plan-updated';

const VALID_LEVELS: ReadonlySet<string> = new Set(['initial', 'intermediate', 'advanced']);
const VALID_CONTOURS: ReadonlySet<string> = new Set(['contour_a', 'contour_b']);
const VALID_DOMAINS: ReadonlySet<string> = new Set(DIAGNOSTIC_SECTIONS.map((s) => s.id));

export function createEmptyLearningPlanState(
  defaultContour: PreparationContour = 'contour_b'
): StoredLearningPlanState {
  return {
    levelId: 'intermediate',
    contour: defaultContour,
    gapDomainIds: ['routing', 'first_aid'],
    updatedAt: null,
  };
}

export function readStoredLearningPlan(
  userId?: string | null,
  defaultContour: PreparationContour = 'contour_b'
): StoredLearningPlanState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createEmptyLearningPlanState(defaultContour);
  }
  try {
    const raw = window.localStorage.getItem(
      `${LEARNING_PLAN_STORAGE_PREFIX}${userId && userId.trim() ? userId.trim() : 'guest'}`
    );
    if (!raw) return createEmptyLearningPlanState(defaultContour);
    const parsed = JSON.parse(raw) as Partial<StoredLearningPlanState>;
    const levelId: LearningPrepLevelId = VALID_LEVELS.has(String(parsed.levelId))
      ? (parsed.levelId as LearningPrepLevelId)
      : 'intermediate';
    const contour: PreparationContour = VALID_CONTOURS.has(String(parsed.contour))
      ? (parsed.contour as PreparationContour)
      : defaultContour;
    const gapDomainIds = Array.isArray(parsed.gapDomainIds)
      ? parsed.gapDomainIds.filter((id): id is DiagnosticSectionId =>
          VALID_DOMAINS.has(String(id))
        )
      : (['routing', 'first_aid'] as DiagnosticSectionId[]);
    return {
      levelId,
      contour,
      gapDomainIds,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    };
  } catch {
    return createEmptyLearningPlanState(defaultContour);
  }
}

export function writeStoredLearningPlan(
  userId: string | null | undefined,
  state: StoredLearningPlanState
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      `${LEARNING_PLAN_STORAGE_PREFIX}${userId && userId.trim() ? userId.trim() : 'guest'}`,
      JSON.stringify(state)
    );
    window.dispatchEvent(
      new CustomEvent(LEARNING_PLAN_UPDATED_EVENT, {
        detail: { userId: userId ?? null },
      })
    );
  } catch {
    // ignore storage quota errors
  }
}

function hasSelfCheckData(s: StoredSelfCheckState): boolean {
  return Boolean(s.updatedAt) || Object.keys(s.answers || {}).length > 0;
}

function hasQuizData(q: StoredCompetencyQuizState): boolean {
  return (
    Boolean(q.lastCompletedAt) ||
    (q.attempts?.length ?? 0) > 0 ||
    Object.keys(q.activeAnswers || {}).length > 0
  );
}

function hasDiagnosticsData(d: StoredDiagnosticsState): boolean {
  return (
    Boolean(d.updatedAt) ||
    Object.keys(d.answers || {}).length > 0 ||
    d.activeStep > 1
  );
}

function hasLearningPlanData(p: StoredLearningPlanState): boolean {
  return Boolean(p.updatedAt);
}

const syncInFlightByUser = new Map<string, Promise<ServerLmsProgressResponse | null>>();
const syncedUsers = new Set<string>();

export function resetLmsProgressClientCache(): void {
  syncInFlightByUser.clear();
  syncedUsers.clear();
}

export const lmsProgressApi = {
  async get(): Promise<ServerLmsProgressResponse> {
    const res = await fetch('/api/account/lms-progress', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`LMS progress fetch failed (${res.status})`);
    }
    return (await res.json()) as ServerLmsProgressResponse;
  },

  async patch(payload: PartialLmsProgressPayload): Promise<ServerLmsProgressResponse['progress']> {
    const res = await fetch('/api/account/lms-progress', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'fetch',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`LMS progress update failed (${res.status})`);
    }
    const body = (await res.json()) as { progress: ServerLmsProgressResponse['progress'] };
    return body.progress;
  },

  /**
   * Synchronises server LMS state with localStorage cache once per session/user.
   * - If server already holds saved state for a section, it hydrates localStorage
   *   and emits section events so mounted widgets refresh immediately.
   * - If server lacks data for a section while this browser holds prior localStorage
   *   answers, it migrates them upward so nothing is lost across sessions.
   */
  async syncForUser(userId: string): Promise<ServerLmsProgressResponse | null> {
    if (syncedUsers.has(userId)) {
      return null;
    }
    const existing = syncInFlightByUser.get(userId);
    if (existing) return existing;

    const task = (async (): Promise<ServerLmsProgressResponse | null> => {
      try {
        const remote = await this.get();
        const localSelfCheck = readStoredSelfCheck(userId);
        const localQuiz = readStoredCompetencyQuizState(userId);
        const localPlan = readStoredLearningPlan(userId);
        const localDiag = readStoredDiagnosticsState(userId);

        const uploadPayload: PartialLmsProgressPayload = {};

        if (hasSelfCheckData(remote.progress.selfCheck)) {
          writeStoredSelfCheck(userId, remote.progress.selfCheck);
        } else if (hasSelfCheckData(localSelfCheck)) {
          uploadPayload.selfCheck = localSelfCheck;
        }

        if (hasQuizData(remote.progress.competencyQuiz)) {
          const normalizedQuiz: StoredCompetencyQuizState = {
            intervalDays: remote.progress.competencyQuiz.intervalDays,
            lastCompletedAt: remote.progress.competencyQuiz.lastCompletedAt ?? null,
            attempts: remote.progress.competencyQuiz.attempts ?? [],
            activeQuestionIds:
              remote.progress.competencyQuiz.activeQuestionIds.length > 0
                ? remote.progress.competencyQuiz.activeQuestionIds
                : localQuiz.activeQuestionIds,
            activeAnswers: remote.progress.competencyQuiz.activeAnswers ?? {},
          };
          writeStoredCompetencyQuizState(userId, normalizedQuiz);
        } else if (hasQuizData(localQuiz)) {
          uploadPayload.competencyQuiz = localQuiz;
        }

        if (hasLearningPlanData(remote.progress.learningPlan)) {
          writeStoredLearningPlan(userId, remote.progress.learningPlan);
        } else if (hasLearningPlanData(localPlan)) {
          uploadPayload.learningPlan = localPlan;
        }

        if (hasDiagnosticsData(remote.progress.diagnostics)) {
          writeStoredDiagnosticsState(userId, remote.progress.diagnostics);
        } else if (hasDiagnosticsData(localDiag)) {
          uploadPayload.diagnostics = localDiag;
        }

        if (Object.keys(uploadPayload).length > 0) {
          await this.patch(uploadPayload);
        }

        syncedUsers.add(userId);
        return remote;
      } catch {
        return null;
      } finally {
        syncInFlightByUser.delete(userId);
      }
    })();

    syncInFlightByUser.set(userId, task);
    return task;
  },
};
