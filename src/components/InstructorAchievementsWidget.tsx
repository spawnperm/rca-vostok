import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Compass,
  Footprints,
  HeartPulse,
  Lock,
  Map as MapIcon,
  Medal,
  Mountain,
  Navigation,
  ShieldCheck,
  Trophy,
  UserCheck,
} from 'lucide-react';
import type {
  AchievementCategory,
  AchievementIconKey,
  AchievementTargetAction,
  AchievementTier,
  EvaluatedAchievement,
  InstructorAchievementsSummary,
} from '../utils/instructorAchievements';
import type { SessionUser } from '../utils/identityApi';
import { tracker } from '../utils/tracker';

type StatusFilter = 'all' | 'unlocked' | 'locked';
type CategoryFilter = 'all' | AchievementCategory;

export function AchievementIcon({
  iconKey,
  className = 'w-4 h-4',
}: {
  iconKey: AchievementIconKey;
  className?: string;
}) {
  switch (iconKey) {
    case 'footprints':
      return <Footprints className={className} aria-hidden="true" />;
    case 'award':
      return <Award className={className} aria-hidden="true" />;
    case 'compass':
      return <Compass className={className} aria-hidden="true" />;
    case 'map':
      return <MapIcon className={className} aria-hidden="true" />;
    case 'shield':
      return <ShieldCheck className={className} aria-hidden="true" />;
    case 'mountain':
      return <Mountain className={className} aria-hidden="true" />;
    case 'navigation':
      return <Navigation className={className} aria-hidden="true" />;
    case 'user_check':
      return <UserCheck className={className} aria-hidden="true" />;
    case 'heart_pulse':
      return <HeartPulse className={className} aria-hidden="true" />;
    case 'medal':
      return <Medal className={className} aria-hidden="true" />;
  }
}

export function getTierEmblemClasses(tier: AchievementTier, unlocked: boolean): {
  emblemBox: string;
  tierText: string;
  barFill: string;
} {
  if (!unlocked) {
    return {
      emblemBox: 'bg-slate-50 border-slate-200 text-slate-400',
      tierText: 'text-slate-500',
      barFill: 'bg-teal-700',
    };
  }
  switch (tier) {
    case 'gold':
      return {
        emblemBox: 'bg-amber-50 border-amber-300 text-amber-700',
        tierText: 'text-amber-800',
        barFill: 'bg-amber-600',
      };
    case 'silver':
      return {
        emblemBox: 'bg-teal-50 border-teal-300 text-teal-700',
        tierText: 'text-teal-800',
        barFill: 'bg-teal-700',
      };
    case 'bronze':
      return {
        emblemBox: 'bg-slate-100 border-slate-300 text-slate-800',
        tierText: 'text-slate-700',
        barFill: 'bg-slate-700',
      };
  }
}

interface InstructorAchievementsWidgetProps {
  user: SessionUser | null;
  summary: InstructorAchievementsSummary;
  onActionJump?: (action: AchievementTargetAction) => void;
  onFocusAuth?: () => void;
}

export const InstructorAchievementsWidget: React.FC<InstructorAchievementsWidgetProps> = ({
  user,
  summary,
  onActionJump,
  onFocusAuth,
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const filteredAchievements = useMemo(() => {
    return summary.achievements.filter((item) => {
      if (statusFilter === 'unlocked' && !item.unlocked) return false;
      if (statusFilter === 'locked' && item.unlocked) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      return true;
    });
  }, [summary.achievements, statusFilter, categoryFilter]);

  const handleAction = (item: EvaluatedAchievement) => {
    tracker.trackCustomInteraction(
      `Ачивки · Переход к задаче: ${item.title}`,
      item.targetAction
    );
    onActionJump?.(item.targetAction);
  };

  return (
    <section
      id="instructor-achievements"
      aria-labelledby="instructor-achievements-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 scroll-mt-24"
    >
      {/* Header & Summary Progress */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Профессиональные достижения и квалификационные знаки РЦА</span>
          </p>
          <h3
            id="instructor-achievements-heading"
            className="text-lg sm:text-xl font-bold text-slate-900"
          >
            Достижения и бейджи инструктора
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Бейджи присваиваются автоматически за реальные показатели в журнале опыта, импорт
            GPX-треков, этапы аттестации, заполненный профиль и прохождение диагностики
            безопасности.
          </p>
        </div>

        <div className="flex items-center gap-5 shrink-0">
          <div className="text-right">
            <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums leading-none">
              {summary.unlockedCount} / {summary.totalCount}
            </p>
            <p className="text-[11px] font-mono text-slate-500 tabular-nums mt-1">
              Получено ({summary.completionPercent}%)
            </p>
          </div>

          {!user && onFocusAuth && (
            <button
              type="button"
              onClick={onFocusAuth}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Войти для сохранения в профиль
            </button>
          )}
        </div>
      </div>

      {/* Overall Completion Bar + Key Snapshot */}
      <div className="space-y-3">
        <div
          role="progressbar"
          aria-label="Прогресс получения профессиональных бейджей"
          aria-valuenow={summary.completionPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200"
        >
          <div
            className="h-full bg-teal-700 transition-all duration-200"
            style={{ width: `${summary.completionPercent}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {summary.byCategory.map((cat) => (
              <span key={cat.category} className="font-mono tabular-nums">
                {cat.label}:{' '}
                <strong className="text-slate-900">
                  {cat.unlockedCount}/{cat.totalCount}
                </strong>
              </span>
            ))}
          </div>

          <span className="font-mono tabular-nums text-slate-500">
            Километраж: {summary.metricsSnapshot.totalDistanceKm.toFixed(1)} км · Регионов ДФО:{' '}
            {summary.metricsSnapshot.activeRegionsCount}
          </span>
        </div>
      </div>

      {/* Next Closest Achievement Callout */}
      {summary.nextClosestAchievement && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 text-teal-700 flex items-center justify-center shrink-0">
              <AchievementIcon
                iconKey={summary.nextClosestAchievement.iconKey}
                className="w-5 h-5"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                <span className="font-semibold text-teal-800">Ближайший бейдж</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {summary.nextClosestAchievement.progressText} (
                  {summary.nextClosestAchievement.progressPercent}%)
                </span>
              </div>
              <p className="text-sm font-bold text-slate-900">
                {summary.nextClosestAchievement.title}
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                {summary.nextClosestAchievement.nextStepHint}
              </p>
            </div>
          </div>

          {onActionJump && (
            <button
              type="button"
              onClick={() => handleAction(summary.nextClosestAchievement!)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-center cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <span>{summary.nextClosestAchievement.targetActionLabel}</span>
              <ArrowRight className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Interactive Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Фильтр статуса достижений"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {(
            [
              { id: 'all', label: `Все (${summary.totalCount})` },
              { id: 'unlocked', label: `Полученные (${summary.unlockedCount})` },
              {
                id: 'locked',
                label: `В процессе (${summary.totalCount - summary.unlockedCount})`,
              },
            ] as const
          ).map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setStatusFilter(tab.id);
                  tracker.trackCustomInteraction('Ачивки · Фильтр статуса', tab.id);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          role="tablist"
          aria-label="Фильтр категорий достижений"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {(
            [
              { id: 'all', label: 'Все направления' },
              { id: 'routes', label: 'Маршруты' },
              { id: 'attestation', label: 'Аттестация' },
              { id: 'competence', label: 'Профиль и навыки' },
            ] as const
          ).map((tab) => {
            const active = categoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setCategoryFilter(tab.id);
                  tracker.trackCustomInteraction('Ачивки · Фильтр категории', tab.id);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Achievements Grid */}
      {filteredAchievements.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center space-y-3">
          <p className="text-sm font-medium text-slate-700">
            По выбранным фильтрам достижений не найдено.
          </p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setCategoryFilter('all');
            }}
            className="px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 cursor-pointer"
          >
            Сбросить фильтры
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAchievements.map((item) => {
            const styles = getTierEmblemClasses(item.tier, item.unlocked);
            return (
              <li
                key={item.id}
                className={`border rounded-xl p-4 flex flex-col justify-between gap-4 transition-colors ${
                  item.unlocked
                    ? 'bg-white border-slate-300'
                    : 'bg-slate-50/60 border-slate-200'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Row: Emblem + Unboxed Metadata */}
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${styles.emblemBox}`}
                    >
                      <AchievementIcon iconKey={item.iconKey} className="w-5 h-5" />
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-medium pt-0.5">
                      {item.unlocked ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>Получен</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>В процессе</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Clean Unboxed Metadata */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500">
                      <span>{item.categoryLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className={`font-semibold ${styles.tierText}`}>
                        {item.tierLabel}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                  </div>
                </div>

                {/* Progress Bar & Action Footer */}
                <div className="space-y-2.5 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                    <span className="text-slate-600 truncate">{item.progressText}</span>
                    <span
                      className={`font-semibold shrink-0 ${
                        item.unlocked ? 'text-emerald-700' : 'text-slate-700'
                      }`}
                    >
                      {item.progressPercent}%
                    </span>
                  </div>

                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${
                        item.unlocked ? 'bg-emerald-600' : styles.barFill
                      }`}
                      style={{ width: `${item.progressPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <p className="text-[11px] text-slate-500 leading-snug min-w-0">
                      {item.unlocked
                        ? item.unlockedReason ?? 'Условие выполнено'
                        : item.nextStepHint}
                    </p>

                    {!item.unlocked && onActionJump && (
                      <button
                        type="button"
                        onClick={() => handleAction(item)}
                        className="px-2.5 py-1.5 text-[11px] font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {item.targetActionLabel}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

interface ProfileBadgesShowcaseProps {
  summary: InstructorAchievementsSummary;
  onJumpToAchievements?: () => void;
}

/**
 * Compact achievement badge strip embedded directly inside the user's Profile card.
 */
export const ProfileBadgesShowcase: React.FC<ProfileBadgesShowcaseProps> = ({
  summary,
  onJumpToAchievements,
}) => {
  const earned = summary.featuredBadges;

  return (
    <div className="pt-4 border-t border-slate-200 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h4 className="text-xs font-semibold text-slate-900 inline-flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Бейджи и достижения профиля</span>
          </h4>
          <p className="text-[11px] text-slate-500 font-mono tabular-nums">
            Открыто {summary.unlockedCount} из {summary.totalCount} ({summary.completionPercent}%)
          </p>
        </div>

        {onJumpToAchievements && (
          <button
            type="button"
            onClick={onJumpToAchievements}
            className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:text-teal-950 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Все ачивки</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {earned.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            Пока нет открытых бейджей. Заполните организацию в профиле, добавьте походы или
            пройдите этапы аттестации.
          </p>
          {onJumpToAchievements && (
            <button
              type="button"
              onClick={onJumpToAchievements}
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-800 rounded-md hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Посмотреть задачи
            </button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {earned.map((badge) => {
            const styles = getTierEmblemClasses(badge.tier, true);
            return (
              <li
                key={badge.id}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50/70"
              >
                <div
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${styles.emblemBox}`}
                >
                  <AchievementIcon iconKey={badge.iconKey} className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{badge.title}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {badge.tierLabel} · {badge.unlockedReason ?? badge.progressText}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
