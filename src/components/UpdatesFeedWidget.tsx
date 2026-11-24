import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  BellRing,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  Compass,
  Filter,
  Sparkles,
  Terminal,
} from 'lucide-react';
import {
  EXPERIENCE_JOURNAL_UPDATED_EVENT,
  experienceJournalGateway,
  readStoredExperienceJournal,
  type ExperienceLogEntry,
} from '../utils/experienceJournal';
import type { SessionUser } from '../utils/identityApi';
import {
  SELF_CHECK_UPDATED_EVENT,
  evaluateSelfCheck,
  readStoredSelfCheck,
  type SelfCheckEvaluation,
} from '../utils/qualificationSelfCheck';
import { tracker } from '../utils/tracker';
import {
  QUALIFICATION_LEVEL_META,
  buildQualificationUpdatesFeed,
  resolveUserQualificationProfile,
  type UpdateFeedActionTarget,
  type UpdateFeedCategory,
  type UpdateFeedItem,
} from '../utils/updatesFeed';
import type { UserAttestationSummary } from './AttestationProgressWidget';
import { REGIONAL_SESSIONS_TIMELINE } from './RegionalSessionsTimeline';
import type { InquiryRecord } from './social/MyInquiriesSection';

interface UpdatesFeedWidgetProps {
  user: SessionUser;
  inquiries: InquiryRecord[];
  progressSummary: UserAttestationSummary;
  onNavigateAction?: (target: UpdateFeedActionTarget, prompt?: string) => void;
}

type CategoryFilter = 'all' | UpdateFeedCategory;

const READ_STORAGE_PREFIX = 'rca_updates_feed_read_v1:';

function readStoredReadIds(userId: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${READ_STORAGE_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeStoredReadIds(userId: string, ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${READ_STORAGE_PREFIX}${userId}`, JSON.stringify(ids));
  } catch {
    // ignore storage quota errors
  }
}

function getKindVisual(kind: UpdateFeedCategory): {
  icon: React.ComponentType<{ className?: string }>;
  badgeClass: string;
  iconBgClass: string;
} {
  switch (kind) {
    case 'system':
      return {
        icon: Terminal,
        badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
        iconBgClass: 'bg-slate-100 text-slate-700',
      };
    case 'event':
      return {
        icon: CalendarClock,
        badgeClass: 'bg-teal-50 text-teal-900 border-teal-200',
        iconBgClass: 'bg-teal-100 text-teal-800',
      };
    case 'advice':
      return {
        icon: Sparkles,
        badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
        iconBgClass: 'bg-amber-100 text-amber-800',
      };
  }
}

export const UpdatesFeedWidget: React.FC<UpdatesFeedWidgetProps> = ({
  user,
  inquiries,
  progressSummary,
  onNavigateAction,
}) => {
  const [journalEntries, setJournalEntries] = useState<ExperienceLogEntry[]>(() =>
    readStoredExperienceJournal(user.id, user.region)
  );
  const [selfCheck, setSelfCheck] = useState<SelfCheckEvaluation>(() => {
    const stored = readStoredSelfCheck(user.id);
    return evaluateSelfCheck(stored.answers, stored.track);
  });
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [includeOtherLevels, setIncludeOtherLevels] = useState<boolean>(false);
  const [readIds, setReadIds] = useState<string[]>(() => readStoredReadIds(user.id));

  useEffect(() => {
    let cancelled = false;
    setJournalEntries(readStoredExperienceJournal(user.id, user.region));
    void experienceJournalGateway
      .load(user.id, user.region)
      .then((loaded) => {
        if (!cancelled) setJournalEntries(loaded);
      })
      .catch(() => {
        // local storage snapshot already loaded
      });

    const syncSelfCheck = () => {
      const stored = readStoredSelfCheck(user.id);
      setSelfCheck(evaluateSelfCheck(stored.answers, stored.track));
    };
    syncSelfCheck();
    setReadIds(readStoredReadIds(user.id));

    const onJournalUpdated = () => {
      setJournalEntries(readStoredExperienceJournal(user.id, user.region));
    };

    window.addEventListener(EXPERIENCE_JOURNAL_UPDATED_EVENT, onJournalUpdated);
    window.addEventListener(SELF_CHECK_UPDATED_EVENT, syncSelfCheck);
    return () => {
      cancelled = true;
      window.removeEventListener(EXPERIENCE_JOURNAL_UPDATED_EVENT, onJournalUpdated);
      window.removeEventListener(SELF_CHECK_UPDATED_EVENT, syncSelfCheck);
    };
  }, [user.id, user.region]);

  const qualification = useMemo(
    () =>
      resolveUserQualificationProfile({
        user,
        attestationPercent: progressSummary.percent,
        selfCheck,
        journalEntries,
      }),
    [user, progressSummary.percent, selfCheck, journalEntries]
  );

  const regionalEventsInput = useMemo(
    () =>
      REGIONAL_SESSIONS_TIMELINE.map((ev) => ({
        id: ev.id,
        title: ev.title,
        regionLabel: ev.regionLabel,
        shortDate: ev.shortDate,
        isoTargetDate: ev.isoTargetDate,
        venue: ev.venue,
        tracks: ev.tracks,
        submissionDeadline: ev.submissionDeadline,
        kindLabel: ev.kindLabel,
      })),
    []
  );

  const allFeedItems = useMemo(
    () =>
      buildQualificationUpdatesFeed({
        user,
        qualification,
        inquiries,
        attestationPercent: progressSummary.percent,
        selfCheck,
        journalEntries,
        regionalEvents: regionalEventsInput,
        includeOtherLevels,
      }),
    [
      user,
      qualification,
      inquiries,
      progressSummary.percent,
      selfCheck,
      journalEntries,
      regionalEventsInput,
      includeOtherLevels,
    ]
  );

  const visibleItems = useMemo(() => {
    if (categoryFilter === 'all') return allFeedItems;
    return allFeedItems.filter((item) => item.kind === categoryFilter);
  }, [allFeedItems, categoryFilter]);

  const countsByKind = useMemo(() => {
    const counts = { all: allFeedItems.length, system: 0, event: 0, advice: 0 };
    for (const item of allFeedItems) {
      counts[item.kind] += 1;
    }
    return counts;
  }, [allFeedItems]);

  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const unreadCount = useMemo(
    () => allFeedItems.filter((item) => !readSet.has(item.id)).length,
    [allFeedItems, readSet]
  );

  const markAsRead = (id: string) => {
    if (readSet.has(id)) return;
    const next = [...readIds, id];
    setReadIds(next);
    writeStoredReadIds(user.id, next);
  };

  const handleMarkAllRead = () => {
    const merged = Array.from(new Set([...readIds, ...allFeedItems.map((i) => i.id)]));
    setReadIds(merged);
    writeStoredReadIds(user.id, merged);
    tracker.trackCustomInteraction(
      'Лента обновлений · Отметить всё прочитанным',
      qualification.shortLabel
    );
  };

  const handleItemAction = (item: UpdateFeedItem) => {
    markAsRead(item.id);
    tracker.trackCustomInteraction(`Лента обновлений · ${item.kind}`, item.title);
    if (item.actionTarget && onNavigateAction) {
      onNavigateAction(item.actionTarget, item.actionPrompt);
    }
  };

  return (
    <section
      id="updates-feed-widget"
      aria-labelledby="updates-feed-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-md text-[11px] font-bold uppercase tracking-wider">
              <BellRing className="w-3.5 h-3.5" aria-hidden="true" />
              Лента обновлений
            </span>
            {unreadCount > 0 ? (
              <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-md text-[11px] font-mono font-semibold">
                Новых: {unreadCount}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[11px] font-semibold">
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                Всё просмотрено
              </span>
            )}
          </div>
          <h3 id="updates-feed-heading" className="text-lg font-bold text-slate-900">
            Персональная лента обновлений и рекомендаций
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
            Системные уведомления, приглашения на мероприятия РЦА и советы по развитию навыков,
            отфильтрованные по вашему текущему уровню квалификации.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              Отметить всё прочитанным
            </button>
          )}
        </div>
      </div>

      {/* Active Qualification Level Banner */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Award className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
            <span className="text-xs font-bold text-slate-900">{qualification.label}</span>
            <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-white border border-slate-200 text-slate-700 rounded">
              {qualification.complexityRange}
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">{qualification.description}</p>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {qualification.reasons.map((reason, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] text-slate-700"
              >
                {reason}
              </span>
            ))}
          </div>
        </div>

        <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 cursor-pointer shrink-0 select-none hover:border-slate-300 transition-colors">
          <input
            type="checkbox"
            checked={includeOtherLevels}
            onChange={(e) => {
              setIncludeOtherLevels(e.target.checked);
              tracker.trackCustomInteraction(
                'Лента обновлений · Показать все уровни',
                e.target.checked ? 'all' : qualification.level
              );
            }}
            className="w-3.5 h-3.5 accent-teal-700 rounded cursor-pointer"
          />
          <Filter className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          <span>Показать все уровни</span>
        </label>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Категории ленты обновлений">
        {(
          [
            { id: 'all', label: 'Все', count: countsByKind.all },
            { id: 'system', label: 'Системные', count: countsByKind.system },
            { id: 'event', label: 'Мероприятия РЦА', count: countsByKind.event },
            { id: 'advice', label: 'Советы по навыкам', count: countsByKind.advice },
          ] as const
        ).map((tab) => {
          const active = categoryFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setCategoryFilter(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                active
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[11px] font-mono ${
                  active ? 'bg-teal-800 text-teal-100' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Feed List */}
      {visibleItems.length === 0 ? (
        <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-1.5">
          <Compass className="w-6 h-6 text-slate-400 mx-auto" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-700">
            В выбранной категории нет обновлений для вашего уровня
          </p>
          <p className="text-xs text-slate-500">
            Переключите фильтр категории или включите отображение материалов других уровней.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleItems.map((item) => {
            const isRead = readSet.has(item.id);
            const visual = getKindVisual(item.kind);
            const Icon = visual.icon;
            const matchesCurrentLevel = item.targetLevels.includes(qualification.level);

            return (
              <article
                key={item.id}
                className={`p-4 rounded-xl border transition-colors ${
                  isRead
                    ? 'bg-slate-50/60 border-slate-200/80'
                    : item.priority === 'high'
                    ? 'bg-white border-teal-300 shadow-xs'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${visual.iconBgClass}`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold ${visual.badgeClass}`}
                        >
                          {item.kindLabel}
                        </span>
                        {item.priority === 'high' && !isRead && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold uppercase tracking-wide">
                            Приоритет
                          </span>
                        )}
                        {!matchesCurrentLevel && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                            Другой уровень:{' '}
                            {item.targetLevels
                              .map((lvl) => QUALIFICATION_LEVEL_META[lvl].complexityRange)
                              .join(', ')}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">{item.dateLabel}</span>
                    </div>

                    <h4
                      className={`text-sm font-bold leading-snug ${
                        isRead ? 'text-slate-700' : 'text-slate-900'
                      }`}
                    >
                      {item.title}
                    </h4>

                    <p className="text-xs text-slate-600 leading-relaxed">{item.message}</p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-slate-500">{item.metaLine}</span>

                      <div className="flex flex-wrap items-center gap-2">
                        {!isRead && (
                          <button
                            type="button"
                            onClick={() => markAsRead(item.id)}
                            className="text-[11px] font-medium text-slate-500 hover:text-slate-800 underline underline-offset-2 cursor-pointer"
                          >
                            Прочитано
                          </button>
                        )}
                        {item.actionLabel && item.actionTarget && (
                          <button
                            type="button"
                            onClick={() => handleItemAction(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <span>{item.actionLabel}</span>
                            <ArrowRight className="w-3 h-3" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
