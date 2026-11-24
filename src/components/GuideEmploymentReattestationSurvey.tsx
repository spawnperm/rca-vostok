import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Database,
  Download,
  RotateCcw,
  Save,
  Send,
  Trash2,
} from 'lucide-react';
import { DFO_SURVEY_REGIONS } from '../data/dfoRegions';
import {
  DEFAULT_SURVEY_FORM_STATE,
  EMPLOYMENT_STATUS_OPTIONS,
  PREFERRED_REATTESTATION_FORMATS,
  REATTESTATION_NEED_TOPICS,
  REATTESTATION_URGENCY_OPTIONS,
  SEASONAL_WORKLOAD_OPTIONS,
  SURVEY_COMPLEXITY_LEVELS,
  SURVEY_DISCIPLINES,
  aggregateEmploymentSurvey,
  computeReattestationPriority,
  createSurveyEntry,
  getPriorityLabel,
  validateGuideEmploymentInput,
  type GuideEmploymentSurveyEntry,
  type GuideEmploymentSurveyInput,
  type GuideEmploymentSurveySummary,
  type ReattestationPriority,
} from '../utils/guideEmploymentSurvey';
import { tracker } from '../utils/tracker';

interface GuideEmploymentReattestationSurveyProps {
  onApplyForSession?: (regionName: string, trackName: string) => void;
}

interface PersistedEmploymentEntry extends GuideEmploymentSurveyEntry {
  archiveObjectKey?: string;
  canDelete?: boolean;
  localOnly?: boolean;
}

interface StorageRuntimeMeta {
  persistenceAdapter: string;
  storageProvider: string;
  archiveKey: string;
  synced: boolean;
}

type PriorityFilter = 'all' | ReattestationPriority;

const PRIORITY_STYLE: Record<ReattestationPriority, string> = {
  high: 'bg-rose-50 text-rose-900 border-rose-200',
  medium: 'bg-amber-50 text-amber-900 border-amber-200',
  low: 'bg-emerald-50 text-emerald-900 border-emerald-200',
};

function formatTimeRu(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatBackendLabels(meta: StorageRuntimeMeta): { dbLabel: string; s3Label: string } {
  const dbLabel =
    meta.persistenceAdapter === 'postgres' ? 'PostgreSQL' : 'Локальный реестр (резерв)';
  const s3Label =
    meta.storageProvider === 'garage-s3' ? 'Garage S3' : 'Локальный S3-бакет';
  return { dbLabel, s3Label };
}

export const GuideEmploymentReattestationSurvey: React.FC<
  GuideEmploymentReattestationSurveyProps
> = ({ onApplyForSession }) => {
  const [formState, setFormState] = useState<GuideEmploymentSurveyInput>(
    DEFAULT_SURVEY_FORM_STATE
  );
  const [savedResponses, setSavedResponses] = useState<PersistedEmploymentEntry[]>([]);
  const [serverSummary, setServerSummary] = useState<GuideEmploymentSurveySummary | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lastSavedEntry, setLastSavedEntry] = useState<PersistedEmploymentEntry | null>(null);
  const [storageMeta, setStorageMeta] = useState<StorageRuntimeMeta>({
    persistenceAdapter: 'json-file',
    storageProvider: 'local-disk',
    archiveKey: 'surveys/employment-reattestation/latest-snapshot.json',
    synced: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/employment-survey', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          summary?: GuideEmploymentSurveySummary;
          responses?: PersistedEmploymentEntry[];
          persistenceAdapter?: string;
          storageProvider?: string;
          archiveKey?: string;
        };
        if (cancelled) return;
        if (Array.isArray(data.responses)) {
          setSavedResponses(data.responses);
        }
        if (data.summary) {
          setServerSummary(data.summary);
        }
        setStorageMeta({
          persistenceAdapter: data.persistenceAdapter || 'json-file',
          storageProvider: data.storageProvider || 'local-disk',
          archiveKey:
            data.archiveKey || 'surveys/employment-reattestation/latest-snapshot.json',
          synced: true,
        });
      } catch {
        // Offline or unreachable server: keep local state gracefully
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(
    () => serverSummary ?? aggregateEmploymentSurvey(savedResponses),
    [serverSummary, savedResponses]
  );

  const backendLabels = useMemo(() => formatBackendLabels(storageMeta), [storageMeta]);

  const draftPriority = useMemo(
    () => computeReattestationPriority(formState),
    [formState]
  );

  const filteredResponses = useMemo(() => {
    if (priorityFilter === 'all') return savedResponses;
    return savedResponses.filter((item) => item.priorityLevel === priorityFilter);
  }, [savedResponses, priorityFilter]);

  const topicLabelById = useMemo(
    () => new Map(REATTESTATION_NEED_TOPICS.map((t) => [t.id, t.label])),
    []
  );

  const toggleTopic = (topicId: string) => {
    setFormState((prev) => {
      const exists = prev.neededTopics.includes(topicId);
      return {
        ...prev,
        neededTopics: exists
          ? prev.neededTopics.filter((id) => id !== topicId)
          : [...prev.neededTopics, topicId],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const validation = validateGuideEmploymentInput(formState);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/employment-survey', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'fetch',
        },
        body: JSON.stringify(formState),
      });

      if (res.ok) {
        const payload = (await res.json()) as {
          entry: PersistedEmploymentEntry;
          summary: GuideEmploymentSurveySummary;
          archiveKey?: string;
          persistenceAdapter?: string;
          storageProvider?: string;
        };
        setSavedResponses((prev) => [
          payload.entry,
          ...prev.filter((item) => item.id !== payload.entry.id),
        ]);
        setServerSummary(payload.summary);
        setLastSavedEntry(payload.entry);
        setStorageMeta((prev) => ({
          persistenceAdapter: payload.persistenceAdapter || prev.persistenceAdapter,
          storageProvider: payload.storageProvider || prev.storageProvider,
          archiveKey: payload.archiveKey || prev.archiveKey,
          synced: true,
        }));
        setFormState((prev) => ({
          ...prev,
          comment: '',
        }));
        tracker.trackCustomInteraction(
          `Анкета занятости и переаттестации сохранена (${payload.persistenceAdapter ?? 'server'} + ${payload.storageProvider ?? 's3'})`,
          payload.entry.priorityLevel
        );
        return;
      }

      if (res.status >= 400 && res.status < 500) {
        const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(errBody?.error || 'Не удалось сохранить анкету. Проверьте заполнение полей.');
        return;
      }

      throw new Error(`HTTP ${res.status}`);
    } catch {
      const localEntry: PersistedEmploymentEntry = {
        ...createSurveyEntry(formState, savedResponses.length + 1),
        localOnly: true,
        canDelete: true,
      };
      const nextList = [localEntry, ...savedResponses];
      setSavedResponses(nextList);
      setServerSummary(null);
      setLastSavedEntry(localEntry);
      setFormState((prev) => ({
        ...prev,
        comment: '',
      }));
      tracker.trackCustomInteraction(
        `Анкета занятости сохранена в локальный стейт (${localEntry.region})`,
        localEntry.priorityLevel
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetDraft = () => {
    setFormState(DEFAULT_SURVEY_FORM_STATE);
    setError(null);
    setLastSavedEntry(null);
  };

  const handleRemoveEntry = async (entry: PersistedEmploymentEntry) => {
    setError(null);

    if (entry.localOnly || !entry.canDelete) {
      const nextList = savedResponses.filter((item) => item.id !== entry.id);
      setSavedResponses(nextList);
      setServerSummary(null);
      if (lastSavedEntry?.id === entry.id) {
        setLastSavedEntry(null);
      }
      return;
    }

    setDeletingId(entry.id);
    try {
      const res = await fetch(`/api/employment-survey/${encodeURIComponent(entry.id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'fetch',
        },
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(errBody?.error || 'Не удалось удалить запись из хранилища.');
        return;
      }
      const data = (await res.json()) as { summary?: GuideEmploymentSurveySummary };
      setSavedResponses((prev) => prev.filter((item) => item.id !== entry.id));
      if (data.summary) {
        setServerSummary(data.summary);
      } else {
        setServerSummary(null);
      }
      if (lastSavedEntry?.id === entry.id) {
        setLastSavedEntry(null);
      }
    } catch {
      setError('Сервер недоступен — удаление записи не выполнено.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearLocalView = () => {
    setSavedResponses([]);
    setServerSummary(null);
    setLastSavedEntry(null);
    setPriorityFilter('all');
  };

  const handleExportSnapshotJson = async () => {
    if (savedResponses.length === 0) return;

    const triggerBlobDownload = (blob: Blob, fileName: string) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    try {
      if (storageMeta.synced) {
        const res = await fetch('/api/employment-survey/archive', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (res.ok) {
          const blob = await res.blob();
          triggerBlobDownload(
            blob,
            `rca-employment-reattestation-${new Date().toISOString().slice(0, 10)}.json`
          );
          tracker.trackCustomInteraction(
            `Экспорт снимка анкет из ${backendLabels.s3Label}`,
            String(savedResponses.length)
          );
          return;
        }
      }
    } catch {
      // Fallback to client JSON export
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      persistenceAdapter: storageMeta.persistenceAdapter,
      storageProvider: storageMeta.storageProvider,
      summary,
      responses: savedResponses,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    triggerBlobDownload(
      blob,
      `rca-employment-reattestation-${new Date().toISOString().slice(0, 10)}.json`
    );
    tracker.trackCustomInteraction(
      'Экспорт локальных анкет занятости и переаттестации (JSON)',
      String(savedResponses.length)
    );
  };

  return (
    <section
      id="overview-employment-reattestation-survey"
      aria-labelledby="employment-survey-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>
              Мониторинг занятости и графика переаттестации · {backendLabels.dbLabel} +{' '}
              {backendLabels.s3Label}
            </span>
          </p>
          <h2
            id="employment-survey-heading"
            className="text-xl font-bold text-slate-900 text-balance"
          >
            Опрос инструкторов-проводников: занятость и потребность в переаттестации
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Укажите формат вашей работы, сезонную загрузку на маршрутах и сроки обновления
            удостоверения. Анкета сохраняется в реестре РЦА и архивируется в JSON-снимок для
            планирования выездных сессий.
          </p>
        </div>

        {/* Tabular KPI Strip */}
        <div className="flex flex-wrap items-center gap-3 shrink-0 font-mono tabular-nums">
          <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-right">
            <p className="text-[11px] font-sans text-slate-500">Анкет в базе</p>
            <p className="text-sm font-bold text-slate-900">
              {loading && summary.totalResponses === 0 ? '…' : summary.totalResponses}
            </p>
          </div>
          <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-right">
            <p className="text-[11px] font-sans text-slate-500">Срочная переаттестация</p>
            <p className="text-sm font-bold text-rose-700">
              {summary.urgentReattestationCount}
            </p>
          </div>
          <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-right">
            <p className="text-[11px] font-sans text-slate-500">Средняя нагрузка</p>
            <p className="text-sm font-bold text-teal-800">
              {summary.totalResponses > 0
                ? `${summary.avgTourDaysPerSeason} дн.`
                : `${formState.tourDaysPerSeason} дн.`}
            </p>
          </div>
        </div>
      </div>

      {/* Main Split: Form (8 cols) + Summary Aside (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-5">
          {lastSavedEntry && (
            <div
              role="status"
              className="bg-teal-50/80 border border-teal-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-900">
                  <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                  <span>
                    Анкета <span className="font-mono">{lastSavedEntry.id}</span> сохранена{' '}
                    {lastSavedEntry.localOnly
                      ? 'в локальном буфере сессии'
                      : `(${backendLabels.dbLabel} и ${backendLabels.s3Label})`}
                  </span>
                </p>
                <p className="text-xs text-slate-700">
                  {lastSavedEntry.region} · {lastSavedEntry.employmentStatus} ·{' '}
                  <span className="font-mono tabular-nums">
                    {lastSavedEntry.tourDaysPerSeason} дн./сезон
                  </span>{' '}
                  · {getPriorityLabel(lastSavedEntry.priorityLevel)}.
                </p>
                {lastSavedEntry.archiveObjectKey && (
                  <p className="text-[11px] font-mono text-teal-800">
                    Объект архива: {lastSavedEntry.archiveObjectKey}
                  </p>
                )}
              </div>
              {onApplyForSession && lastSavedEntry.priorityLevel !== 'low' && (
                <button
                  type="button"
                  onClick={() =>
                    onApplyForSession(lastSavedEntry.region, lastSavedEntry.discipline)
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Подать заявку на сессию</span>
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Part 1: Current Employment */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">
                  01. Текущая занятость и нагрузка на маршрутах
                </h3>
                <span className="text-xs text-slate-500">Профиль практики</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="emp-status"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Формат текущей занятости
                  </label>
                  <select
                    id="emp-status"
                    value={formState.employmentStatus}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, employmentStatus: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                  >
                    {EMPLOYMENT_STATUS_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="emp-workload"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Сезонная занятость
                  </label>
                  <select
                    id="emp-workload"
                    value={formState.workloadRange}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, workloadRange: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                  >
                    {SEASONAL_WORKLOAD_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="emp-region"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Субъект ДФО
                  </label>
                  <select
                    id="emp-region"
                    value={formState.region}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, region: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                  >
                    {DFO_SURVEY_REGIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="emp-discipline"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Вид туризма
                  </label>
                  <select
                    id="emp-discipline"
                    value={formState.discipline}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, discipline: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                  >
                    {SURVEY_DISCIPLINES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="emp-complexity"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Категория маршрутов
                  </label>
                  <select
                    id="emp-complexity"
                    value={formState.complexityLevel}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, complexityLevel: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                  >
                    {SURVEY_COMPLEXITY_LEVELS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5">
                  <label
                    htmlFor="emp-tour-days"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Дней на маршрутах за сезон
                  </label>
                  <input
                    id="emp-tour-days"
                    type="number"
                    min={0}
                    max={365}
                    value={formState.tourDaysPerSeason}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        tourDaysPerSeason: Number(e.target.value || 0),
                      }))
                    }
                    className="w-full px-3 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="emp-groups-month"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Групп в пиковый месяц
                  </label>
                  <input
                    id="emp-groups-month"
                    type="number"
                    min={0}
                    max={60}
                    value={formState.groupsPerMonth}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        groupsPerMonth: Number(e.target.value || 0),
                      }))
                    }
                    className="w-full px-3 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                  />
                </div>

                <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800 cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={formState.hasActiveCertificate}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        hasActiveCertificate: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 accent-teal-700 rounded cursor-pointer shrink-0"
                  />
                  <span className="font-medium leading-snug">
                    Есть запись в реестре ФСТР
                  </span>
                </label>
              </div>
            </div>

            {/* Part 2: Re-attestation Needs */}
            <div className="space-y-4 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between gap-2 pb-1">
                <h3 className="text-sm font-bold text-slate-900">
                  02. Потребности в переаттестации и подготовке
                </h3>
                <span className="text-xs text-slate-500">Планирование сессий РЦА</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="emp-urgency"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Статус и срочность переаттестации
                  </label>
                  <select
                    id="emp-urgency"
                    value={formState.reattestationUrgency}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        reattestationUrgency: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                  >
                    {REATTESTATION_URGENCY_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="emp-format"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Удобный формат аттестации
                  </label>
                  <select
                    id="emp-format"
                    value={formState.preferredFormat}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, preferredFormat: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                  >
                    {PREFERRED_REATTESTATION_FORMATS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    Какие темы и модули востребованы перед переаттестацией?
                  </span>
                  <span className="text-xs font-mono text-teal-800 tabular-nums">
                    Выбрано: {formState.neededTopics.length}/{REATTESTATION_NEED_TOPICS.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {REATTESTATION_NEED_TOPICS.map((topic) => {
                    const checked = formState.neededTopics.includes(topic.id);
                    return (
                      <label
                        key={topic.id}
                        className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'bg-teal-50/60 border-teal-300 text-teal-950 font-medium'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTopic(topic.id)}
                          className="mt-0.5 w-4 h-4 accent-teal-700 rounded cursor-pointer shrink-0"
                        />
                        <span className="leading-snug">{topic.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="emp-name"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    ФИО или турклуб (необязательно)
                  </label>
                  <input
                    id="emp-name"
                    type="text"
                    value={formState.respondentName}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, respondentName: e.target.value }))
                    }
                    placeholder="Например, Игорь Соколов · «Тайга-ДВ»"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="emp-comment"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Комментарий или запрос по датам (необязательно)
                  </label>
                  <input
                    id="emp-comment"
                    type="text"
                    value={formState.comment}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, comment: e.target.value }))
                    }
                    placeholder="Например, требуется аттестация группы 6 гидов в апреле"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800 cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={formState.needsEmployerSubsidy}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      needsEmployerSubsidy: e.target.checked,
                    }))
                  }
                  className="mt-0.5 w-4 h-4 accent-teal-700 rounded cursor-pointer shrink-0"
                />
                <span>
                  Требуется софинансирование ДПО через туроператора или региональную субсидию
                </span>
              </label>
            </div>

            {error && (
              <p
                role="alert"
                className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3.5 py-2.5 font-medium"
              >
                {error}
              </p>
            )}

            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-700 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-teal-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <Save className="w-4 h-4" aria-hidden="true" />
                  <span>{submitting ? 'Сохранение…' : 'Отправить и сохранить анкету'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetDraft}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Сбросить поля</span>
                </button>
              </div>
              <span className="text-[11px] text-slate-500">
                Профиль формы: {getPriorityLabel(draftPriority)}
              </span>
            </div>
          </form>
        </div>

        {/* Right: Analytics Summary (4 cols) */}
        <aside className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="space-y-1.5 pb-3 border-b border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                <span>Сводка потребностей</span>
              </p>
              <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                {summary.totalResponses} зап.
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug inline-flex items-center gap-1.5">
              <Database className="w-3 h-3 text-teal-700 shrink-0" aria-hidden="true" />
              <span>
                Хранение: {backendLabels.dbLabel} · Снимок: {backendLabels.s3Label}
              </span>
            </p>
          </div>

          {summary.totalResponses > 0 ? (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-2.5 text-xs tabular-nums">
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <dt className="text-[11px] text-slate-500">Нуждаются в переаттестации</dt>
                  <dd className="mt-1 font-mono text-sm font-bold text-slate-900">
                    {summary.needsReattestationCount} ({summary.needsReattestationPct}%)
                  </dd>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <dt className="text-[11px] text-slate-500">В реестре ФСТР</dt>
                  <dd className="mt-1 font-mono text-sm font-bold text-teal-800">
                    {summary.certifiedSharePct}%
                  </dd>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <dt className="text-[11px] text-slate-500">Групп в месяц (средн.)</dt>
                  <dd className="mt-1 font-mono text-sm font-bold text-slate-900">
                    {summary.avgGroupsPerMonth}
                  </dd>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <dt className="text-[11px] text-slate-500">Запрос субсидии / ДПО</dt>
                  <dd className="mt-1 font-mono text-sm font-bold text-slate-900">
                    {summary.subsidyRequestedCount}
                  </dd>
                </div>
              </dl>

              <div className="space-y-2 pt-2 border-t border-slate-200">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Структура занятости
                </p>
                <ul className="space-y-2 text-xs">
                  {summary.byEmployment.slice(0, 4).map((row) => (
                    <li key={row.label} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-700 truncate">{row.label}</span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                          {row.count} ({row.pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 rounded-sm overflow-hidden">
                        <div
                          className="h-full bg-teal-700 transition-all duration-200"
                          style={{ width: `${Math.max(row.pct, 5)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {summary.topNeededTopics.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Запрошенные темы переаттестации
                  </p>
                  <ul className="space-y-2 text-xs">
                    {summary.topNeededTopics.slice(0, 4).map((topic) => (
                      <li key={topic.id} className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-slate-700 leading-snug">{topic.label}</span>
                          <span className="font-mono font-semibold text-teal-800 tabular-nums shrink-0">
                            {topic.count} ({topic.pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 rounded-sm overflow-hidden">
                          <div
                            className="h-full bg-slate-800 transition-all duration-200"
                            style={{ width: `${Math.max(topic.pct, 5)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExportSnapshotJson}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  <span>Скачать архив S3 (JSON)</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearLocalView}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-rose-200 text-rose-800 text-xs font-semibold rounded-lg hover:bg-rose-50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Скрыть список</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2 text-xs text-slate-600 leading-relaxed">
              <p>
                Сохранённых анкет пока нет. Заполните форму слева и отправьте ответ — данные
                попадут в базу {backendLabels.dbLabel} и архив {backendLabels.s3Label}.
              </p>
              <div className="pt-2 border-t border-slate-200 space-y-1 text-[11px] text-slate-500">
                <p>Предпросмотр текущей черновой анкеты:</p>
                <p className="font-semibold text-slate-800">
                  {formState.region} · {formState.discipline}
                </p>
                <p className="font-mono tabular-nums text-teal-800">
                  {formState.tourDaysPerSeason} дн./сезон · {formState.groupsPerMonth} гр./мес.
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Saved Entries Table / Registry */}
      {savedResponses.length > 0 && (
        <div className="pt-6 border-t border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Сохранённые анкеты инструкторов ({filteredResponses.length})
              </h3>
              <p className="text-xs text-slate-500">
                Отфильтруйте список по срочности переаттестации; автор или модератор может удалить
                свою запись.
              </p>
            </div>

            <div
              role="group"
              aria-label="Фильтр анкет по срочности переаттестации"
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              {(
                [
                  { id: 'all', label: `Все (${savedResponses.length})` },
                  { id: 'high', label: 'Срочно' },
                  { id: 'medium', label: 'Планово' },
                  { id: 'low', label: 'Запас > 1 г.' },
                ] as const
              ).map((item) => {
                const active = priorityFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPriorityFilter(item.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredResponses.length === 0 ? (
            <p className="text-xs text-slate-600 py-4">
              По выбранному фильтру приоритета сохранённых анкет нет.
            </p>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Код / время</th>
                    <th className="py-2.5 px-4 font-semibold">Инструктор и регион</th>
                    <th className="py-2.5 px-4 font-semibold">Занятость и нагрузка</th>
                    <th className="py-2.5 px-4 font-semibold">Переаттестация и темы</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredResponses.map((entry) => (
                    <tr key={entry.id} className="align-top hover:bg-slate-50/70">
                      <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums text-slate-700">
                        <div className="font-semibold text-slate-900">{entry.id}</div>
                        <div className="text-[11px] text-slate-500">
                          {formatTimeRu(entry.submittedAt)}
                        </div>
                      </td>
                      <td className="py-3 px-4 space-y-0.5">
                        <div className="font-semibold text-slate-900">
                          {entry.respondentName || 'Без указания имени'}
                        </div>
                        <div className="text-slate-600">
                          {entry.region} · {entry.discipline} · {entry.complexityLevel}
                        </div>
                      </td>
                      <td className="py-3 px-4 space-y-0.5">
                        <div className="text-slate-800 font-medium">{entry.employmentStatus}</div>
                        <div className="text-slate-600 font-mono tabular-nums">
                          {entry.tourDaysPerSeason} дн./сезон · {entry.groupsPerMonth} гр./мес. ·{' '}
                          {entry.hasActiveCertificate ? 'в реестре ФСТР' : 'без записи ФСТР'}
                        </div>
                      </td>
                      <td className="py-3 px-4 space-y-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-semibold ${PRIORITY_STYLE[entry.priorityLevel]}`}
                        >
                          {getPriorityLabel(entry.priorityLevel)}
                        </span>
                        <div className="text-slate-700">{entry.preferredFormat}</div>
                        {entry.neededTopics.length > 0 && (
                          <div className="text-[11px] text-slate-500">
                            {entry.neededTopics
                              .map((id) => topicLabelById.get(id) ?? id)
                              .join(' · ')}
                          </div>
                        )}
                        {entry.comment && (
                          <div className="text-[11px] text-slate-600 italic">
                            «{entry.comment}»
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={deletingId === entry.id}
                          onClick={() => void handleRemoveEntry(entry)}
                          aria-label={
                            entry.canDelete || entry.localOnly
                              ? `Удалить анкету ${entry.id}`
                              : `Скрыть анкету ${entry.id}`
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:text-rose-700 hover:border-rose-300 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>
                            {entry.canDelete || entry.localOnly ? 'Удалить' : 'Скрыть'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
