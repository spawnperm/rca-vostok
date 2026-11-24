import React, { useEffect, useState } from 'react';
import {
  Award,
  Compass,
  DatabaseBackup,
  FileBadge2,
  LogOut,
  ShieldCheck,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react';
import { ROLE_LABELS, type SessionUser } from '../../utils/identityApi';
import type { InstructorAchievementsSummary } from '../../utils/instructorAchievements';
import { AchievementIcon, getTierEmblemClasses } from '../InstructorAchievementsWidget';

export type CabinetTab = 'profile' | 'preparation' | 'documents' | 'community';

export const CABINET_TABS: readonly {
  id: CabinetTab;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'profile',
    label: 'Профиль и заявки',
    description: 'Заявки и CRM куратора, уведомления, OAuth, профиль и безопасность',
    icon: UserRound,
  },
  {
    id: 'preparation',
    label: 'Подготовка и LMS',
    description: 'LMS-трек 5 этапов, тесты компетенций, календарь комиссий и база знаний',
    icon: Compass,
  },
  {
    id: 'documents',
    label: 'Документооборот и стаж',
    description: 'Паспорт инструктора, PDF-сертификаты, резюме и журнал походов',
    icon: FileBadge2,
  },
  {
    id: 'community',
    label: 'Соцсеть, блог и медиа',
    description: 'Профили, новостной блог и CMS, чат, медиатека, ачивки и рейтинг',
    icon: Users,
  },
];

export function CabinetHeader({
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
  const [avatarLoadError, setAvatarLoadError] = useState<boolean>(false);

  useEffect(() => {
    setAvatarLoadError(false);
  }, [user.avatarUrl]);

  const featuredProfileBadges = achievementsSummary.featuredBadges.slice(0, 4);

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {user.avatarUrl && !avatarLoadError ? (
            <img
              src={user.avatarUrl}
              alt={`Аватар ${user.fullName}`}
              referrerPolicy="no-referrer"
              onError={() => setAvatarLoadError(true)}
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
