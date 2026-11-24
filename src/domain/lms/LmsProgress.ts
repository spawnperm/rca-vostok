export type LmsSelfCheckTrackId = 'hiking' | 'water' | 'expedition';
export type LmsSelfCheckAnswerLevel = 'confirmed' | 'in_progress' | 'missing';

export interface LmsSelfCheckState {
  track: LmsSelfCheckTrackId;
  answers: Partial<Record<string, LmsSelfCheckAnswerLevel>>;
  updatedAt: string | null;
}

export type LmsQuizIntervalDays = 14 | 30 | 60;

export interface LmsCompetencyQuizAttempt {
  id: string;
  completedAt: string;
  totalQuestions: number;
  correctCount: number;
  scorePercent: number;
  npaPercent: number;
  safetyPercent: number;
  intervalDays: LmsQuizIntervalDays;
  questionIds: string[];
  wrongQuestionIds: string[];
}

export interface LmsCompetencyQuizState {
  intervalDays: LmsQuizIntervalDays;
  lastCompletedAt: string | null;
  attempts: LmsCompetencyQuizAttempt[];
  activeQuestionIds: string[];
  activeAnswers: Record<string, string>;
  updatedAt?: string | null;
}

export type LmsPrepLevelId = 'initial' | 'intermediate' | 'advanced';
export type LmsPreparationContour = 'contour_a' | 'contour_b';
export type LmsDiagnosticSectionId = 'regulation' | 'routing' | 'first_aid' | 'field_dfo';
export type LmsDiagnosticOptionId = 'a' | 'b' | 'c' | 'd';

export interface LmsLearningPlanState {
  levelId: LmsPrepLevelId;
  contour: LmsPreparationContour;
  gapDomainIds: LmsDiagnosticSectionId[];
  updatedAt: string | null;
}

export interface LmsDiagnosticsState {
  answers: Partial<Record<string, LmsDiagnosticOptionId>>;
  checkedSections: Partial<Record<LmsDiagnosticSectionId, boolean>>;
  activeStep: number;
  updatedAt: string | null;
}

export interface LmsProgressState {
  selfCheck: LmsSelfCheckState;
  competencyQuiz: LmsCompetencyQuizState;
  learningPlan: LmsLearningPlanState;
  diagnostics: LmsDiagnosticsState;
  updatedAt: string | null;
}

export interface PartialLmsProgressUpdate {
  selfCheck?: LmsSelfCheckState;
  competencyQuiz?: LmsCompetencyQuizState;
  learningPlan?: LmsLearningPlanState;
  diagnostics?: LmsDiagnosticsState;
}

export function createEmptyLmsProgressState(): LmsProgressState {
  return {
    selfCheck: {
      track: 'hiking',
      answers: {},
      updatedAt: null,
    },
    competencyQuiz: {
      intervalDays: 30,
      lastCompletedAt: null,
      attempts: [],
      activeQuestionIds: [],
      activeAnswers: {},
      updatedAt: null,
    },
    learningPlan: {
      levelId: 'intermediate',
      contour: 'contour_b',
      gapDomainIds: ['routing', 'first_aid'],
      updatedAt: null,
    },
    diagnostics: {
      answers: {},
      checkedSections: {},
      activeStep: 1,
      updatedAt: null,
    },
    updatedAt: null,
  };
}

export interface LmsProgressRepository {
  findByOwner(ownerId: string): Promise<LmsProgressState | null>;
  saveByOwner(ownerId: string, state: LmsProgressState): Promise<void>;
}
