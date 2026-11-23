import {
  COMPLEXITY_RANK,
  type ExperienceLogEntry,
} from './ExperienceEntry.ts';
import { computeJournalMetrics } from './ExperienceAnalyticsService.ts';

export type AchievementCategory = 'routes' | 'attestation' | 'competence';
export type AchievementTier = 'bronze' | 'silver' | 'gold';
export type AchievementTargetAction =
  | 'experience'
  | 'attestation'
  | 'profile'
  | 'diagnostics'
  | 'self_check'
  | 'linked';

export type AchievementIconKey =
  | 'footprints'
  | 'award'
  | 'compass'
  | 'map'
  | 'shield'
  | 'mountain'
  | 'navigation'
  | 'user_check'
  | 'heart_pulse'
  | 'medal';

export interface AchievementInquiryHint {
  status: string;
  track?: string;
}

export interface AchievementEvaluationInput {
  entries: readonly ExperienceLogEntry[];
  role: 'candidate' | 'instructor' | 'curator' | 'admin' | 'guest';
  attestationPercent: number;
  completedStagesCount: number;
  fullName: string;
  region: string;
  organisation: string;
  hasAttestationExpiry: boolean;
  inquiries: readonly AchievementInquiryHint[];
  selfCheckConfirmedCount: number;
  diagnosticsPercent: number | null;
  diagnosticsComplete: boolean;
  linkedAccountsCount: number;
}

export interface EvaluatedAchievement {
  id: string;
  title: string;
  shortBadgeLabel: string;
  description: string;
  category: AchievementCategory;
  categoryLabel: string;
  tier: AchievementTier;
  tierLabel: string;
  iconKey: AchievementIconKey;
  unlocked: boolean;
  progressCurrent: number;
  progressTarget: number;
  progressPercent: number;
  progressText: string;
  unlockedReason: string | null;
  nextStepHint: string;
  targetAction: AchievementTargetAction;
  targetActionLabel: string;
}

export interface AchievementCategorySummary {
  category: AchievementCategory;
  label: string;
  unlockedCount: number;
  totalCount: number;
}

export interface InstructorAchievementsSummary {
  achievements: EvaluatedAchievement[];
  unlockedCount: number;
  totalCount: number;
  completionPercent: number;
  featuredBadges: EvaluatedAchievement[];
  nextClosestAchievement: EvaluatedAchievement | null;
  byCategory: AchievementCategorySummary[];
  metricsSnapshot: {
    totalDistanceKm: number;
    totalTrips: number;
    totalParticipants: number;
    activeRegionsCount: number;
    gpxEntriesCount: number;
    attestationPercent: number;
  };
}

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  routes: 'Маршруты и опыт',
  attestation: 'Аттестация',
  competence: 'Профиль и навыки',
};

const TIER_LABELS: Record<AchievementTier, string> = {
  bronze: 'Бронза',
  silver: 'Серебро',
  gold: 'Золото',
};

const TIER_PRIORITY: Record<AchievementTier, number> = {
  gold: 3,
  silver: 2,
  bronze: 1,
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isGpxDerivedEntry(entry: ExperienceLogEntry): boolean {
  const notes = (entry.notes || '').toLowerCase();
  return (
    notes.includes('gpx') ||
    notes.includes('набор высоты:') ||
    notes.includes('трек:')
  );
}

/**
 * Pure Domain Service evaluating professional achievements (badges)
 * for instructors and candidates based on field experience, GPX logs,
 * attestation milestones, profile completeness, and safety diagnostics.
 */
export function evaluateInstructorAchievements(
  input: AchievementEvaluationInput
): InstructorAchievementsSummary {
  const journalMetrics = computeJournalMetrics(input.entries);
  const totalDistanceKm = Math.round(journalMetrics.totalDistanceKm * 10) / 10;
  const totalTrips = journalMetrics.totalTrips;
  const totalParticipants = journalMetrics.totalParticipants;
  const activeRegionsCount = journalMetrics.activeRegionsCount;

  const gpxEntriesCount = input.entries.filter(isGpxDerivedEntry).length;
  const maxComplexityRank = input.entries.reduce(
    (max, entry) => Math.max(max, COMPLEXITY_RANK[entry.complexity] ?? 0),
    -1
  );

  const hasApprovedInquiry = input.inquiries.some((inq) => inq.status === 'approved');
  const isCertifiedRole = input.role === 'instructor';

  const profileChecks = [
    input.fullName.trim().length >= 2,
    input.region.trim().length >= 2,
    input.organisation.trim().length >= 2,
    input.hasAttestationExpiry || input.linkedAccountsCount > 0,
  ];
  const completedProfileFields = profileChecks.filter(Boolean).length;

  const hasFirstCategory =
    isCertifiedRole ||
    hasApprovedInquiry ||
    input.attestationPercent >= 50 ||
    input.completedStagesCount >= 2;

  const hasFullCertification = isCertifiedRole || input.attestationPercent >= 100;

  const hasSafetyExpertise =
    input.selfCheckConfirmedCount >= 5 ||
    (input.diagnosticsComplete && (input.diagnosticsPercent ?? 0) >= 70);

  const rawDefinitions: Omit<EvaluatedAchievement, 'categoryLabel' | 'tierLabel'>[] = [
    {
      id: 'hundred_km_trails',
      title: '100 км походов',
      shortBadgeLabel: '100 км походов',
      description:
        'Пройдено и зафиксировано в журнале профессионального опыта не менее 100 км туристских маршрутов.',
      category: 'routes',
      tier: 'silver',
      iconKey: 'footprints',
      unlocked: totalDistanceKm >= 100,
      progressCurrent: Math.min(100, totalDistanceKm),
      progressTarget: 100,
      progressPercent: clampPercent((totalDistanceKm / 100) * 100),
      progressText: `${totalDistanceKm.toFixed(1)} / 100 км`,
      unlockedReason:
        totalDistanceKm >= 100
          ? `Суммарная дистанция в журнале: ${totalDistanceKm.toFixed(1)} км`
          : null,
      nextStepHint: `Осталось зафиксировать ${Math.max(0, 100 - totalDistanceKm).toFixed(1)} км маршрутов в журнале опыта или через импорт GPX.`,
      targetAction: 'experience',
      targetActionLabel: 'В журнал опыта',
    },
    {
      id: 'first_category_attestation',
      title: 'Первая категория аттестации',
      shortBadgeLabel: '1-я категория',
      description:
        'Подтверждена готовность к аттестации первой категории: пройдены этапы подачи заявки и обучения (≥ 50%), одобрена заявка или активен статус инструктора.',
      category: 'attestation',
      tier: 'silver',
      iconKey: 'award',
      unlocked: hasFirstCategory,
      progressCurrent: hasFirstCategory ? 50 : Math.min(50, input.attestationPercent),
      progressTarget: 50,
      progressPercent: hasFirstCategory ? 100 : clampPercent((input.attestationPercent / 50) * 100),
      progressText: hasFirstCategory
        ? 'Подтверждена (≥ 50% этапов)'
        : `${input.attestationPercent}% / 50% прогресса`,
      unlockedReason: isCertifiedRole
        ? 'Подтверждён действующий статус «Инструктор-проводник»'
        : hasApprovedInquiry
        ? 'Заявка на аттестацию одобрена куратором РЦА'
        : hasFirstCategory
        ? `Выполнены этапы заявки и обучения (${input.attestationPercent}%)`
        : null,
      nextStepHint:
        'Завершите чек-лист этапов «Подача заявки» и «Обучение» или дождитесь одобрения заявки в РЦА.',
      targetAction: 'attestation',
      targetActionLabel: 'К этапам аттестации',
    },
    {
      id: 'gpx_navigator',
      title: 'Цифровой GPX-навигатор',
      shortBadgeLabel: 'GPX-навигатор',
      description:
        'Загружен и сохранён в журнале опыта хотя бы один реальный GPX-трек маршрута с GPS-координатами.',
      category: 'routes',
      tier: 'bronze',
      iconKey: 'navigation',
      unlocked: gpxEntriesCount >= 1,
      progressCurrent: Math.min(1, gpxEntriesCount),
      progressTarget: 1,
      progressPercent: gpxEntriesCount >= 1 ? 100 : 0,
      progressText: `${Math.min(1, gpxEntriesCount)} / 1 GPX-трек`,
      unlockedReason:
        gpxEntriesCount >= 1
          ? `Импортировано GPX-маршрутов: ${gpxEntriesCount}`
          : null,
      nextStepHint:
        'Загрузите файл .gpx (или пример GPX) в форме добавления похода в «Журнале профессионального опыта».',
      targetAction: 'experience',
      targetActionLabel: 'Импортировать GPX',
    },
    {
      id: 'three_dfo_regions',
      title: 'Исследователь Дальнего Востока',
      shortBadgeLabel: '3+ региона ДФО',
      description:
        'Проведены туристские маршруты минимум в 3 различных субъектах Дальневосточного федерального округа.',
      category: 'routes',
      tier: 'silver',
      iconKey: 'map',
      unlocked: activeRegionsCount >= 3,
      progressCurrent: Math.min(3, activeRegionsCount),
      progressTarget: 3,
      progressPercent: clampPercent((activeRegionsCount / 3) * 100),
      progressText: `${activeRegionsCount} / 3 региона ДФО`,
      unlockedReason:
        activeRegionsCount >= 3
          ? `Охвачено субъектов ДФО: ${activeRegionsCount}`
          : null,
      nextStepHint: `Добавьте походы ещё в ${Math.max(0, 3 - activeRegionsCount)} регионе(ах) ДФО для расширения географии.`,
      targetAction: 'experience',
      targetActionLabel: 'Открыть карту походов',
    },
    {
      id: 'expedition_commander',
      title: 'Командир туристских групп',
      shortBadgeLabel: '5+ походов · 30+ чел.',
      description:
        'Накоплено не менее 5 проведённых маршрутов с общим охватом от 30 сопровождённых участников.',
      category: 'routes',
      tier: 'bronze',
      iconKey: 'compass',
      unlocked: totalTrips >= 5 && totalParticipants >= 30,
      progressCurrent: Math.min(
        100,
        Math.round(
          (Math.min(1, totalTrips / 5) * 0.5 + Math.min(1, totalParticipants / 30) * 0.5) * 100
        )
      ),
      progressTarget: 100,
      progressPercent: clampPercent(
        (Math.min(1, totalTrips / 5) * 0.5 + Math.min(1, totalParticipants / 30) * 0.5) * 100
      ),
      progressText: `${totalTrips}/5 походов · ${totalParticipants}/30 чел.`,
      unlockedReason:
        totalTrips >= 5 && totalParticipants >= 30
          ? `Проведено ${totalTrips} походов (${totalParticipants} участников)`
          : null,
      nextStepHint:
        'Зафиксируйте не менее 5 маршрутов и 30 участников групп в журнале опыта.',
      targetAction: 'experience',
      targetActionLabel: 'Добавить поход',
    },
    {
      id: 'mountain_leader_3ks',
      title: 'Лидер сложных маршрутов (3+ КС)',
      shortBadgeLabel: 'Маршруты 3+ КС',
      description:
        'В журнале опыта подтверждён выход или руководство маршрутом повышенной сложности (3 КС, 4 КС или 5 КС).',
      category: 'routes',
      tier: 'gold',
      iconKey: 'mountain',
      unlocked: maxComplexityRank >= 3,
      progressCurrent: Math.max(0, Math.min(3, maxComplexityRank)),
      progressTarget: 3,
      progressPercent:
        maxComplexityRank >= 3
          ? 100
          : clampPercent((Math.max(0, maxComplexityRank) / 3) * 100),
      progressText:
        maxComplexityRank >= 3
          ? `Макс. уровень: ${journalMetrics.maxComplexity}`
          : `Текущий макс.: ${journalMetrics.maxComplexity}`,
      unlockedReason:
        maxComplexityRank >= 3
          ? `Подтверждена категория сложности ${journalMetrics.maxComplexity}`
          : null,
      nextStepHint:
        'Занесите в журнал пройденный маршрут категории 3 КС или выше.',
      targetAction: 'experience',
      targetActionLabel: 'Зафиксировать маршрут',
    },
    {
      id: 'marathonec_250_km',
      title: 'Дальневосточный марафонец (250 км)',
      shortBadgeLabel: '250 км походов',
      description:
        'Суммарная протяжённость зарегистрированных маршрутов по ДФО достигла 250 км.',
      category: 'routes',
      tier: 'gold',
      iconKey: 'medal',
      unlocked: totalDistanceKm >= 250,
      progressCurrent: Math.min(250, totalDistanceKm),
      progressTarget: 250,
      progressPercent: clampPercent((totalDistanceKm / 250) * 100),
      progressText: `${totalDistanceKm.toFixed(1)} / 250 км`,
      unlockedReason:
        totalDistanceKm >= 250
          ? `Пройдено ${totalDistanceKm.toFixed(1)} км по маршрутам ДФО`
          : null,
      nextStepHint: `До рубежа 250 км осталось ${Math.max(0, 250 - totalDistanceKm).toFixed(1)} км.`,
      targetAction: 'experience',
      targetActionLabel: 'Добавить дистанцию',
    },
    {
      id: 'verified_profile',
      title: 'Верифицированный профиль',
      shortBadgeLabel: 'Профиль заполнен',
      description:
        'В профиле указаны ФИО, субъект ДФО, организация и дата действия аттестации (либо привязан внешний аккаунт).',
      category: 'competence',
      tier: 'bronze',
      iconKey: 'user_check',
      unlocked: completedProfileFields === 4,
      progressCurrent: completedProfileFields,
      progressTarget: 4,
      progressPercent: clampPercent((completedProfileFields / 4) * 100),
      progressText: `${completedProfileFields} / 4 критерия профиля`,
      unlockedReason:
        completedProfileFields === 4
          ? `Профиль «${input.organisation.trim()}» полностью заполнен`
          : null,
      nextStepHint:
        'Укажите организацию и дату истечения аттестации в карточке «Профиль» или свяжите внешний профиль.',
      targetAction: 'profile',
      targetActionLabel: 'Заполнить профиль',
    },
    {
      id: 'safety_diagnostician',
      title: 'Эксперт безопасности РЦА',
      shortBadgeLabel: 'Безопасность ДФО',
      description:
        'Подтверждено не менее 5 критериев в анкете-самопроверке либо пройдена самодиагностика знаний с результатом ≥ 70%.',
      category: 'competence',
      tier: 'silver',
      iconKey: 'heart_pulse',
      unlocked: hasSafetyExpertise,
      progressCurrent: hasSafetyExpertise
        ? 100
        : Math.max(
            clampPercent((input.selfCheckConfirmedCount / 5) * 100),
            input.diagnosticsPercent ?? 0
          ),
      progressTarget: 100,
      progressPercent: hasSafetyExpertise
        ? 100
        : Math.max(
            clampPercent((input.selfCheckConfirmedCount / 5) * 100),
            clampPercent(((input.diagnosticsPercent ?? 0) / 70) * 100)
          ),
      progressText:
        input.diagnosticsComplete && input.diagnosticsPercent !== null
          ? `Диагностика: ${input.diagnosticsPercent}% · Самопроверка: ${input.selfCheckConfirmedCount}/5`
          : `Самопроверка: ${Math.min(5, input.selfCheckConfirmedCount)} / 5 критериев`,
      unlockedReason:
        input.diagnosticsComplete && (input.diagnosticsPercent ?? 0) >= 70
          ? `Самодиагностика пройдена с результатом ${input.diagnosticsPercent}%`
          : input.selfCheckConfirmedCount >= 5
          ? `В анкете-самопроверке подтверждено ${input.selfCheckConfirmedCount} компетенций`
          : null,
      nextStepHint:
        'Пройдите «Самодиагностику знаний» на 70%+ или отметьте 5 подтверждённых пунктов в «Анкете-самопроверке».',
      targetAction: 'diagnostics',
      targetActionLabel: 'Пройти диагностику',
    },
    {
      id: 'certified_guide_rca',
      title: 'Аттестованный проводник РЦА',
      shortBadgeLabel: 'Аттестован РЦА',
      description:
        'Пройдены все 4 этапа аттестации (100%) и получен подтверждённый статус инструктора-проводника в реестре.',
      category: 'attestation',
      tier: 'gold',
      iconKey: 'shield',
      unlocked: hasFullCertification,
      progressCurrent: hasFullCertification ? 100 : input.attestationPercent,
      progressTarget: 100,
      progressPercent: hasFullCertification ? 100 : clampPercent(input.attestationPercent),
      progressText: hasFullCertification
        ? '100% · Действующий статус'
        : `${input.attestationPercent}% / 100% этапов`,
      unlockedReason: isCertifiedRole
        ? 'Учётная запись имеет роль «Инструктор-проводник»'
        : hasFullCertification
        ? 'Завершены все 4 этапа аттестации РЦА'
        : null,
      nextStepHint:
        'Завершите оставшиеся шаги в чек-листе этапов аттестации (подача, обучение, экзамен, свидетельство).',
      targetAction: 'attestation',
      targetActionLabel: 'Открыть чек-лист',
    },
  ];

  const achievements: EvaluatedAchievement[] = rawDefinitions.map((item) => ({
    ...item,
    categoryLabel: CATEGORY_LABELS[item.category],
    tierLabel: TIER_LABELS[item.tier],
  }));

  const unlockedList = achievements.filter((a) => a.unlocked);
  const lockedList = achievements.filter((a) => !a.unlocked);

  const featuredBadges = [...unlockedList].sort((a, b) => {
    const tierDiff = TIER_PRIORITY[b.tier] - TIER_PRIORITY[a.tier];
    if (tierDiff !== 0) return tierDiff;
    return 0;
  });

  const nextClosestAchievement =
    lockedList.length > 0
      ? [...lockedList].sort((a, b) => b.progressPercent - a.progressPercent)[0]
      : null;

  const byCategory: AchievementCategorySummary[] = (
    ['routes', 'attestation', 'competence'] as AchievementCategory[]
  ).map((category) => {
    const items = achievements.filter((a) => a.category === category);
    return {
      category,
      label: CATEGORY_LABELS[category],
      unlockedCount: items.filter((i) => i.unlocked).length,
      totalCount: items.length,
    };
  });

  const totalCount = achievements.length;
  const unlockedCount = unlockedList.length;

  return {
    achievements,
    unlockedCount,
    totalCount,
    completionPercent: totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0,
    featuredBadges,
    nextClosestAchievement,
    byCategory,
    metricsSnapshot: {
      totalDistanceKm,
      totalTrips,
      totalParticipants,
      activeRegionsCount,
      gpxEntriesCount,
      attestationPercent: input.attestationPercent,
    },
  };
}
