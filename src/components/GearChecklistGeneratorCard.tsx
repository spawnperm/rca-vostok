import React, { useEffect, useMemo, useState } from 'react';
import {
  Backpack,
  Check,
  CheckCircle2,
  Compass,
  Copy,
  Download,
  HeartPulse,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import {
  EXPERIENCE_COMPLEXITIES,
  EXPERIENCE_JOURNAL_UPDATED_EVENT,
  JOURNAL_DFO_REGIONS,
  experienceJournalGateway,
  readStoredExperienceJournal,
  type DfoJournalRegionId,
  type ExpeditionComplexity,
  type ExperienceLogEntry,
} from '../utils/experienceJournal';
import {
  GEAR_PROFILE_OPTIONS,
  formatGearChecklistText,
  generateGearChecklist,
  readStoredGearCheckedIds,
  summarizeJournalForGear,
  writeStoredGearCheckedIds,
  type GearItemGroupId,
  type GearRouteProfile,
  type GearSeasonMode,
} from '../utils/gearChecklistGenerator';
import { downloadTextFile } from '../utils/download';
import type { SessionUser } from '../utils/identityApi';
import { tracker } from '../utils/tracker';

interface GearChecklistGeneratorCardProps {
  user: SessionUser | null;
  onJumpToJournal?: () => void;
}

type ChecklistFilterMode = 'all' | 'equipment' | 'medication' | 'mandatory';

function getGroupIcon(groupId: GearItemGroupId): React.ComponentType<{ className?: string }> {
  switch (groupId) {
    case 'personal_bivouac':
      return Backpack;
    case 'navigation_dfo_safety':
      return Compass;
    case 'technical_route':
      return Wrench;
    case 'medications_wfa':
      return HeartPulse;
  }
}

export const GearChecklistGeneratorCard: React.FC<GearChecklistGeneratorCardProps> = ({
  user,
  onJumpToJournal,
}) => {
  const userId = user?.id ?? null;
  const preferredRegion = user?.region;

  const [entries, setEntries] = useState<ExperienceLogEntry[]>(() =>
    readStoredExperienceJournal(userId, preferredRegion)
  );

  useEffect(() => {
    let cancelled = false;
    setEntries(readStoredExperienceJournal(userId, preferredRegion));
    void experienceJournalGateway
      .load(userId, preferredRegion)
      .then((loaded) => {
        if (!cancelled) setEntries(loaded);
      })
      .catch(() => {
        // fallback already populated
      });

    const onJournalUpdated = () => {
      setEntries(readStoredExperienceJournal(userId, preferredRegion));
    };
    window.addEventListener(EXPERIENCE_JOURNAL_UPDATED_EVENT, onJournalUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(EXPERIENCE_JOURNAL_UPDATED_EVENT, onJournalUpdated);
    };
  }, [userId, preferredRegion]);

  const journalSummary = useMemo(
    () => summarizeJournalForGear(entries, preferredRegion),
    [entries, preferredRegion]
  );

  const [regionId, setRegionId] = useState<DfoJournalRegionId>(journalSummary.primaryRegionId);
  const [complexity, setComplexity] = useState<ExpeditionComplexity>(
    journalSummary.recommendedNextComplexity
  );
  const [profile, setProfile] = useState<GearRouteProfile>(journalSummary.inferredProfile);
  const [season, setSeason] = useState<GearSeasonMode>('warm');
  const [groupSize, setGroupSize] = useState<number>(journalSummary.avgGroupSize);
  const [filterMode, setFilterMode] = useState<ChecklistFilterMode>('all');
  const [hasManualOverride, setHasManualOverride] = useState<boolean>(false);

  const [checkedIds, setCheckedIds] = useState<string[]>(() =>
    readStoredGearCheckedIds(userId)
  );
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    setCheckedIds(readStoredGearCheckedIds(userId));
  }, [userId]);

  // Automatically sync defaults with Journal updates unless user manually customized controls
  useEffect(() => {
    if (hasManualOverride) return;
    setRegionId(journalSummary.primaryRegionId);
    setComplexity(journalSummary.recommendedNextComplexity);
    setProfile(journalSummary.inferredProfile);
    setGroupSize(journalSummary.avgGroupSize);
  }, [hasManualOverride, journalSummary]);

  const checklist = useMemo(
    () =>
      generateGearChecklist({
        regionId,
        complexity,
        profile,
        season,
        groupSize,
      }),
    [regionId, complexity, profile, season, groupSize]
  );

  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);

  const filteredGroups = useMemo(() => {
    return checklist.groups
      .map((group) => {
        const items = group.items.filter((item) => {
          if (filterMode === 'equipment') return item.kind === 'equipment';
          if (filterMode === 'medication') return item.kind === 'medication';
          if (filterMode === 'mandatory') return item.priority === 'mandatory';
          return true;
        });
        return { ...group, items };
      })
      .filter((group) => group.items.length > 0);
  }, [checklist.groups, filterMode]);

  const packedCount = useMemo(
    () => checklist.allItems.filter((item) => checkedSet.has(item.id)).length,
    [checklist.allItems, checkedSet]
  );
  const totalCount = checklist.allItems.length;
  const progressPct = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;

  const toggleItemChecked = (itemId: string) => {
    setCheckedIds((prev) => {
      const next = prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId];
      writeStoredGearCheckedIds(userId, next);
      return next;
    });
  };

  const handleSyncFromJournal = () => {
    setHasManualOverride(false);
    setRegionId(journalSummary.primaryRegionId);
    setComplexity(journalSummary.recommendedNextComplexity);
    setProfile(journalSummary.inferredProfile);
    setGroupSize(journalSummary.avgGroupSize);
    setActionNotice(
      `Параметры синхронизированы с журналом: ${journalSummary.primaryRegionName}, рекомендуемая сложность ${journalSummary.recommendedNextComplexity}.`
    );
    tracker.trackCustomInteraction(
      'Личный кабинет · Генератор снаряжения: синхронизация с журналом',
      `${journalSummary.primaryRegionId}:${journalSummary.recommendedNextComplexity}`
    );
    window.setTimeout(() => setActionNotice(null), 5000);
  };

  const handleResetChecks = () => {
    setCheckedIds([]);
    writeStoredGearCheckedIds(userId, []);
    setActionNotice('Отметки сборки сброшены.');
    window.setTimeout(() => setActionNotice(null), 3500);
  };

  const handleCopyChecklist = async () => {
    const text = formatGearChecklistText(checklist, checkedSet);
    try {
      await navigator.clipboard.writeText(text);
      setActionNotice('Чек-лист оборудования и медикаментов скопирован в буфер обмена.');
      tracker.trackCustomInteraction('Личный кабинет · Копирование чек-листа снаряжения');
    } catch {
      setActionNotice('Не удалось скопировать автоматически — используйте скачивание файла.');
    }
    window.setTimeout(() => setActionNotice(null), 4500);
  };

  const handleDownloadTxt = () => {
    const text = formatGearChecklistText(checklist, checkedSet);
    downloadTextFile(text, `rca-gear-${regionId}-${complexity.replace(/\s+/g, '')}.txt`);
    tracker.trackCustomInteraction(
      'Личный кабинет · Скачать чек-лист снаряжения (.txt)',
      `${regionId}:${complexity}`
    );
  };

  return (
    <section
      id="gear-checklist-generator"
      aria-labelledby="gear-checklist-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Backpack className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Подготовка следующего маршрута · На основе журнала опыта</span>
          </p>
          <h3 id="gear-checklist-heading" className="text-xl font-bold text-slate-900">
            Генератор чек-листа снаряжения и медикаментов
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Формирует структурированный перечень оборудования, средств связи ДФО и аптечки WFA
            на основе ваших регионов и сложности походов из «Журнала профессионального опыта».
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSyncFromJournal}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-teal-50 border border-teal-200 text-teal-900 text-xs font-semibold rounded-lg hover:bg-teal-100 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Из журнала опыта</span>
          </button>
          <button
            type="button"
            onClick={() => void handleCopyChecklist()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            <span>Копировать</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadTxt}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
            <span>Скачать (.txt)</span>
          </button>
        </div>
      </div>

      {/* Journal Data Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="space-y-1">
          <p className="font-semibold text-slate-900">
            Анализ журнала ({journalSummary.totalTrips} поход(ов)): регионы{' '}
            <span className="text-teal-800">
              {journalSummary.visitedRegionNames.join(', ')}
            </span>
          </p>
          <p className="text-slate-600">
            Макс. сложность в журнале:{' '}
            <strong className="text-slate-900">{journalSummary.maxComplexity}</strong> ·
            Рекомендовано для следующего маршрута:{' '}
            <strong className="text-teal-800">
              {journalSummary.recommendedNextComplexity}
            </strong>{' '}
            · Ср. группа: <strong className="text-slate-900">{journalSummary.avgGroupSize} чел.</strong>
          </p>
        </div>

        {onJumpToJournal && (
          <button
            type="button"
            onClick={onJumpToJournal}
            className="text-xs font-semibold text-teal-700 hover:text-teal-900 underline underline-offset-2 cursor-pointer"
          >
            Открыть журнал походов
          </button>
        )}
      </div>

      {/* Route Parameter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Регион ДФО</span>
          <select
            value={regionId}
            onChange={(e) => {
              setHasManualOverride(true);
              setRegionId(e.target.value as DfoJournalRegionId);
            }}
            className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
          >
            {JOURNAL_DFO_REGIONS.map((reg) => {
              const inJournal = journalSummary.visitedRegionIds.includes(reg.id);
              return (
                <option key={reg.id} value={reg.id}>
                  {reg.name}
                  {inJournal ? ' (из журнала)' : ''}
                </option>
              );
            })}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Сложность следующего маршрута</span>
          <select
            value={complexity}
            onChange={(e) => {
              setHasManualOverride(true);
              setComplexity(e.target.value as ExpeditionComplexity);
            }}
            className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
          >
            {EXPERIENCE_COMPLEXITIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.shortLabel}
                {c.value === journalSummary.recommendedNextComplexity ? ' · прогноз' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Профиль маршрута</span>
          <select
            value={profile}
            onChange={(e) => {
              setHasManualOverride(true);
              setProfile(e.target.value as GearRouteProfile);
            }}
            className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
          >
            {GEAR_PROFILE_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.shortLabel}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Сезон</span>
          <select
            value={season}
            onChange={(e) => {
              setHasManualOverride(true);
              setSeason(e.target.value as GearSeasonMode);
            }}
            className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
          >
            <option value="warm">Лето / межсезонье</option>
            <option value="cold">Зима / высокогорье</option>
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Состав группы (чел.)</span>
          <input
            type="number"
            min={1}
            max={60}
            value={groupSize}
            onChange={(e) => {
              setHasManualOverride(true);
              const val = Number.parseInt(e.target.value, 10);
              setGroupSize(Number.isFinite(val) ? Math.max(1, Math.min(60, val)) : 1);
            }}
            className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-600 focus:outline-none"
          />
        </label>
      </div>

      {/* Regional Climate & Safety Note */}
      <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50/75 border border-amber-200 rounded-xl text-xs text-amber-950">
        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">{checklist.regionClimateNote}</p>
      </div>

      {actionNotice && (
        <p
          role="status"
          className="text-xs text-teal-900 bg-teal-50 border border-teal-200 rounded-lg px-3.5 py-2 font-medium"
        >
          {actionNotice}
        </p>
      )}

      {/* Progress Bar & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <div
          role="tablist"
          aria-label="Фильтр позиций чек-листа снаряжения"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {(
            [
              { id: 'all', label: `Всё (${totalCount})` },
              { id: 'equipment', label: `Оборудование (${checklist.equipmentCount})` },
              { id: 'medication', label: `Медикаменты (${checklist.medicationCount})` },
              { id: 'mandatory', label: `Обязательное (${checklist.mandatoryCount})` },
            ] as const
          ).map((tab) => {
            const active = filterMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilterMode(tab.id)}
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

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-mono tabular-nums">
              Собрано: <strong className="text-slate-900">{packedCount}</strong> / {totalCount} (
              {progressPct}%)
            </span>
            <div className="w-24 h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-teal-700 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {packedCount > 0 && (
            <button
              type="button"
              onClick={handleResetChecks}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Сбросить</span>
            </button>
          )}
        </div>
      </div>

      {/* Checklist Groups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredGroups.map((group) => {
          const GroupIcon = getGroupIcon(group.id);
          const groupCheckedCount = group.items.filter((i) => checkedSet.has(i.id)).length;
          const isMedGroup = group.kind === 'medication';

          return (
            <div
              key={group.id}
              className={`border rounded-xl p-5 space-y-4 ${
                isMedGroup
                  ? 'border-rose-200/90 bg-rose-50/25'
                  : 'border-slate-200 bg-slate-50/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-slate-900 inline-flex items-center gap-2">
                    <GroupIcon
                      className={`w-4 h-4 shrink-0 ${
                        isMedGroup ? 'text-rose-700' : 'text-teal-700'
                      }`}
                      aria-hidden="true"
                    />
                    <span>{group.title}</span>
                  </h4>
                  <p className="text-xs text-slate-500">{group.subtitle}</p>
                </div>
                <span className="text-[11px] font-mono font-semibold text-slate-600 tabular-nums shrink-0">
                  {groupCheckedCount}/{group.items.length}
                </span>
              </div>

              <ul className="space-y-2.5">
                {group.items.map((item) => {
                  const checked = checkedSet.has(item.id);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => toggleItemChecked(item.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors flex items-start gap-3 cursor-pointer ${
                          checked
                            ? 'bg-emerald-50/60 border-emerald-200'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span
                          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            checked
                              ? 'bg-teal-700 border-teal-700 text-white'
                              : 'bg-white border-slate-300'
                          }`}
                        >
                          {checked && <Check className="w-3 h-3" aria-hidden="true" />}
                        </span>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={`text-xs sm:text-sm font-semibold leading-snug ${
                                checked ? 'line-through text-slate-500' : 'text-slate-900'
                              }`}
                            >
                              {item.name}
                            </span>
                            <span className="text-[11px] font-mono font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded shrink-0">
                              {item.quantity}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            <span
                              className={`font-semibold ${
                                item.priority === 'mandatory'
                                  ? 'text-amber-800'
                                  : 'text-slate-600'
                              }`}
                            >
                              {item.priority === 'mandatory' ? 'Обязательно' : 'Рекомендуется'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{item.rationale}</span>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {packedCount === totalCount && totalCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
          <span>
            Комплектация полностью собрана ({totalCount} позиций оборудования и медикаментов WFA).
          </span>
        </div>
      )}
    </section>
  );
};
