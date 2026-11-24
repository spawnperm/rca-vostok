import { z } from 'zod';
import type { User } from '../../domain/identity/User.ts';
import { PERMISSIONS } from '../../domain/identity/Rbac.ts';
import { ValidationError, type DomainEventBus } from '../../domain/shared/DomainError.ts';
import {
  createEmptyLmsProgressState,
  type LmsCompetencyQuizAttempt,
  type LmsDiagnosticSectionId,
  type LmsProgressRepository,
  type LmsProgressState,
} from '../../domain/lms/LmsProgress.ts';

const SelfCheckSchema = z.object({
  track: z.enum(['hiking', 'water', 'expedition']).default('hiking'),
  answers: z.record(z.string().max(64), z.enum(['confirmed', 'in_progress', 'missing'])).default({}),
  updatedAt: z.string().max(64).nullable().optional(),
});

const QuizAttemptSchema = z.object({
  id: z.string().min(1).max(80),
  completedAt: z.string().min(1).max(64),
  totalQuestions: z.number().int().min(1).max(100),
  correctCount: z.number().int().min(0).max(100),
  scorePercent: z.number().min(0).max(100),
  npaPercent: z.number().min(0).max(100),
  safetyPercent: z.number().min(0).max(100),
  intervalDays: z.union([z.literal(14), z.literal(30), z.literal(60)]),
  questionIds: z.array(z.string().max(64)).max(30),
  wrongQuestionIds: z.array(z.string().max(64)).max(30),
});

const CompetencyQuizSchema = z.object({
  intervalDays: z.union([z.literal(14), z.literal(30), z.literal(60)]).default(30),
  lastCompletedAt: z.string().max(64).nullable().optional(),
  attempts: z.array(QuizAttemptSchema).max(24).default([]),
  activeQuestionIds: z.array(z.string().max(64)).max(24).default([]),
  activeAnswers: z.record(z.string().max(64), z.string().max(32)).default({}),
  updatedAt: z.string().max(64).nullable().optional(),
});

const DiagnosticSectionEnum = z.enum(['regulation', 'routing', 'first_aid', 'field_dfo']);

const LearningPlanSchema = z.object({
  levelId: z.enum(['initial', 'intermediate', 'advanced']).default('intermediate'),
  contour: z.enum(['contour_a', 'contour_b']).default('contour_b'),
  gapDomainIds: z.array(DiagnosticSectionEnum).max(8).default([]),
  updatedAt: z.string().max(64).nullable().optional(),
});

const DiagnosticsSchema = z.object({
  answers: z.record(z.string().max(64), z.enum(['a', 'b', 'c', 'd'])).default({}),
  checkedSections: z
    .object({
      regulation: z.boolean().optional(),
      routing: z.boolean().optional(),
      first_aid: z.boolean().optional(),
      field_dfo: z.boolean().optional(),
    })
    .default({}),
  activeStep: z.number().int().min(1).max(5).default(1),
  updatedAt: z.string().max(64).nullable().optional(),
});

const LmsProgressUpdateSchema = z
  .object({
    selfCheck: SelfCheckSchema.optional(),
    competencyQuiz: CompetencyQuizSchema.optional(),
    learningPlan: LearningPlanSchema.optional(),
    diagnostics: DiagnosticsSchema.optional(),
  })
  .strict();

function normalizeStoredState(raw: LmsProgressState | null): LmsProgressState {
  const base = createEmptyLmsProgressState();
  if (!raw) return base;
  return {
    selfCheck: {
      track: raw.selfCheck?.track ?? base.selfCheck.track,
      answers: raw.selfCheck?.answers ?? {},
      updatedAt: raw.selfCheck?.updatedAt ?? null,
    },
    competencyQuiz: {
      intervalDays: raw.competencyQuiz?.intervalDays ?? 30,
      lastCompletedAt: raw.competencyQuiz?.lastCompletedAt ?? null,
      attempts: Array.isArray(raw.competencyQuiz?.attempts)
        ? raw.competencyQuiz.attempts.slice(0, 24)
        : [],
      activeQuestionIds: Array.isArray(raw.competencyQuiz?.activeQuestionIds)
        ? raw.competencyQuiz.activeQuestionIds
        : [],
      activeAnswers: raw.competencyQuiz?.activeAnswers ?? {},
      updatedAt: raw.competencyQuiz?.updatedAt ?? null,
    },
    learningPlan: {
      levelId: raw.learningPlan?.levelId ?? 'intermediate',
      contour: raw.learningPlan?.contour ?? 'contour_b',
      gapDomainIds: Array.isArray(raw.learningPlan?.gapDomainIds)
        ? raw.learningPlan.gapDomainIds
        : ['routing', 'first_aid'],
      updatedAt: raw.learningPlan?.updatedAt ?? null,
    },
    diagnostics: {
      answers: raw.diagnostics?.answers ?? {},
      checkedSections: raw.diagnostics?.checkedSections ?? {},
      activeStep: raw.diagnostics?.activeStep ?? 1,
      updatedAt: raw.diagnostics?.updatedAt ?? null,
    },
    updatedAt: raw.updatedAt ?? null,
  };
}

export class GetLmsProgressUseCase {
  private readonly repo: LmsProgressRepository;

  constructor(repo: LmsProgressRepository) {
    this.repo = repo;
  }

  async execute(actor: User): Promise<{ hasSavedData: boolean; progress: LmsProgressState }> {
    actor.assertCan(PERMISSIONS.VIEW_OWN_PROFILE);
    const stored = await this.repo.findByOwner(actor.id);
    return {
      hasSavedData: stored !== null,
      progress: normalizeStoredState(stored),
    };
  }
}

export class UpdateLmsProgressUseCase {
  private readonly repo: LmsProgressRepository;
  private readonly eventBus?: DomainEventBus;

  constructor(repo: LmsProgressRepository, eventBus?: DomainEventBus) {
    this.repo = repo;
    this.eventBus = eventBus;
  }

  async execute(actor: User, rawInput: unknown): Promise<LmsProgressState> {
    actor.assertCan(PERMISSIONS.EDIT_OWN_PROFILE);

    const parsed = LmsProgressUpdateSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      throw new ValidationError(
        'Некорректный формат данных прогресса обучения.',
        'INVALID_LMS_PROGRESS'
      );
    }

    const input = parsed.data;
    if (
      !input.selfCheck &&
      !input.competencyQuiz &&
      !input.learningPlan &&
      !input.diagnostics
    ) {
      throw new ValidationError(
        'Укажите хотя бы один блок прогресса для сохранения.',
        'EMPTY_LMS_PROGRESS'
      );
    }

    const current = normalizeStoredState(await this.repo.findByOwner(actor.id));
    const now = new Date().toISOString();

    const uniqueGapDomains = (list: LmsDiagnosticSectionId[]): LmsDiagnosticSectionId[] => {
      const seen = new Set<LmsDiagnosticSectionId>();
      const out: LmsDiagnosticSectionId[] = [];
      for (const id of list) {
        if (!seen.has(id)) {
          seen.add(id);
          out.push(id);
        }
      }
      return out;
    };

    const next: LmsProgressState = {
      selfCheck: input.selfCheck
        ? {
            track: input.selfCheck.track,
            answers: { ...input.selfCheck.answers },
            updatedAt: input.selfCheck.updatedAt ?? now,
          }
        : current.selfCheck,
      competencyQuiz: input.competencyQuiz
        ? {
            intervalDays: input.competencyQuiz.intervalDays,
            lastCompletedAt: input.competencyQuiz.lastCompletedAt ?? null,
            attempts: input.competencyQuiz.attempts.slice(0, 12) as LmsCompetencyQuizAttempt[],
            activeQuestionIds: [...input.competencyQuiz.activeQuestionIds],
            activeAnswers: { ...input.competencyQuiz.activeAnswers },
            updatedAt: input.competencyQuiz.updatedAt ?? now,
          }
        : current.competencyQuiz,
      learningPlan: input.learningPlan
        ? {
            levelId: input.learningPlan.levelId,
            contour: input.learningPlan.contour,
            gapDomainIds: uniqueGapDomains(input.learningPlan.gapDomainIds),
            updatedAt: input.learningPlan.updatedAt ?? now,
          }
        : current.learningPlan,
      diagnostics: input.diagnostics
        ? {
            answers: { ...input.diagnostics.answers },
            checkedSections: { ...input.diagnostics.checkedSections },
            activeStep: input.diagnostics.activeStep,
            updatedAt: input.diagnostics.updatedAt ?? now,
          }
        : current.diagnostics,
      updatedAt: now,
    };

    await this.repo.saveByOwner(actor.id, next);

    this.eventBus?.publish({
      eventName: 'lms.progress_updated',
      occurredAt: now,
      boundedContext: 'experience',
      payload: {
        userId: actor.id,
        sections: Object.keys(input),
      },
    });

    return next;
  }
}
