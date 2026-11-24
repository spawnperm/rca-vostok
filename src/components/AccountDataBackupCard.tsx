import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Compass,
  Copy,
  DatabaseBackup,
  Download,
  Eye,
  EyeOff,
  Trophy,
  BarChart3,
} from 'lucide-react';
import type { SessionUser } from '../utils/identityApi';
import type { UserAttestationSummary } from './AttestationProgressWidget';
import type { InquiryRecord } from './social/MyInquiriesSection';
import type { LinkedAccountDTO } from '../utils/linkedAccountsApi';
import type { PreparationContour } from '../utils/personalRoadmap';
import type { InstructorAchievementsSummary } from '../utils/instructorAchievements';
import {
  EXPERIENCE_JOURNAL_UPDATED_EVENT,
  experienceJournalGateway,
  readStoredExperienceJournal,
  type ExperienceLogEntry,
} from '../utils/experienceJournal';
import {
  buildAccountBackupFileName,
  buildAccountBackupPayload,
  downloadAccountBackupJson,
  serializeAccountBackupJson,
  type AccountBackupScope,
} from '../utils/accountBackupExport';
import { tracker } from '../utils/tracker';

interface AccountDataBackupCardProps {
  user: SessionUser;
  progressSummary: UserAttestationSummary;
  achievementsSummary: InstructorAchievementsSummary;
  inquiries: readonly InquiryRecord[];
  linkedAccounts: readonly LinkedAccountDTO[];
  selectedExamDate?: string;
  selectedContour?: PreparationContour;
  selfCheckRevision?: number;
}

const BACKUP_SCOPE_OPTIONS: ReadonlyArray<{
  id: AccountBackupScope;
  label: string;
  description: string;
}> = [
  {
    id: 'full',
    label: 'Полная копия',
    description: 'Профиль, вся статистика, ачивки, история походов, заявки и настройки кабинета',
  },
  {
    id: 'statistics',
    label: 'Статистика',
    description: 'Прогресс аттестации, метрики походов, самопроверка и диагностика',
  },
  {
    id: 'achievements',
    label: 'Ачивки',
    description: 'Полученные бейджи, прогресс по категориям и срез показателей',
  },
  {
    id: 'hike_history',
    label: 'История походов',
    description: 'Все записи журнала опыта, маршруты, километраж, категории КС и GPX-метаданные',
  },
];

export const AccountDataBackupCard: React.FC<AccountDataBackupCardProps> = ({
  user,
  progressSummary,
  achievementsSummary,
  inquiries,
  linkedAccounts,
  selectedExamDate,
  selectedContour = 'contour_b',
  selfCheckRevision = 0,
}) => {
  const [scope, setScope] = useState<AccountBackupScope>('full');
  const [pretty, setPretty] = useState<boolean>(true);
  const [previewExpanded, setPreviewExpanded] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [busyDownload, setBusyDownload] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [entries, setEntries] = useState<ExperienceLogEntry[]>(() =>
    readStoredExperienceJournal(user.id, user.region)
  );

  useEffect(() => {
    let cancelled = false;
    setEntries(readStoredExperienceJournal(user.id, user.region));
    void experienceJournalGateway
      .load(user.id, user.region)
      .then((loaded) => {
        if (!cancelled) setEntries(loaded);
      })
      .catch(() => {
        // local cache already loaded
      });

    const onUpdated = () => {
      setEntries(readStoredExperienceJournal(user.id, user.region));
    };
    window.addEventListener(EXPERIENCE_JOURNAL_UPDATED_EVENT, onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(EXPERIENCE_JOURNAL_UPDATED_EVENT, onUpdated);
    };
  }, [user.id, user.region]);

  const payload = useMemo(
    () =>
      buildAccountBackupPayload({
        user,
        progressSummary,
        achievementsSummary,
        experienceEntries: entries,
        inquiries,
        linkedAccounts,
        selectedExamDate,
        selectedContour,
      }),
    [
      user,
      progressSummary,
      achievementsSummary,
      entries,
      inquiries,
      linkedAccounts,
      selectedExamDate,
      selectedContour,
      selfCheckRevision,
    ]
  );

  const jsonString = useMemo(
    () => serializeAccountBackupJson(payload, scope, { pretty }),
    [payload, scope, pretty]
  );

  const suggestedFileName = useMemo(
    () => buildAccountBackupFileName(payload, scope),
    [payload, scope]
  );

  const byteSize = new TextEncoder().encode(jsonString).length;
  const formattedSize =
    byteSize >= 1024 ? `${(byteSize / 1024).toFixed(1)} КБ` : `${byteSize} Б`;
  const lineCount = pretty ? jsonString.split('\n').length : 1;

  const handleDownloadBackup = async () => {
    setErrorMessage(null);
    setBusyDownload(true);
    try {
      const latestEntries = await experienceJournalGateway
        .load(user.id, user.region)
        .catch(() => entries);
      setEntries(latestEntries);
      const freshPayload = buildAccountBackupPayload({
        user,
        progressSummary,
        achievementsSummary,
        experienceEntries: latestEntries,
        inquiries,
        linkedAccounts,
        selectedExamDate,
        selectedContour,
      });
      const res = downloadAccountBackupJson(freshPayload, scope, { pretty });
      setStatusMessage(
        `Резервная копия сохранена: ${res.fileName} (${res.formattedSize})`
      );
      tracker.trackCustomInteraction(
        `Личный кабинет · Экспорт резервной копии (JSON): ${scope}`,
        res.formattedSize
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Не удалось сформировать резервную копию JSON.'
      );
    } finally {
      setBusyDownload(false);
    }
  };

  const handleCopyJson = async () => {
    setErrorMessage(null);
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        throw new Error('Буфер обмена недоступен в текущей среде браузера.');
      }
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setStatusMessage(`JSON (${formattedSize}) скопирован в буфер обмена.`);
      tracker.trackCustomInteraction('Личный кабинет · Копирование JSON резервной копии', scope);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Не удалось скопировать JSON. Воспользуйтесь кнопкой скачивания файла.'
      );
    }
  };

  const activeScopeMeta =
    BACKUP_SCOPE_OPTIONS.find((item) => item.id === scope) ?? BACKUP_SCOPE_OPTIONS[0];

  return (
    <section
      id="account-data-backup"
      aria-labelledby="account-data-backup-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 scroll-mt-24"
    >
      {/* Header & Primary Export Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-teal-800 font-medium">
            <DatabaseBackup className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Резервная копия и перенос данных</span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <code className="font-mono text-slate-600">{payload.meta.schemaVersion}</code>
          </div>
          <h3
            id="account-data-backup-heading"
            className="text-lg sm:text-xl font-bold text-slate-900 text-balance"
          >
            Экспорт всех данных пользователя (JSON)
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Полный архив профиля в машиночитаемом JSON для резервного копирования и переноса:
            статистика подготовки и диагностики, полученные ачивки и вся история походов. Пароли и
            секретные ключи в выгрузку не включаются.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void handleCopyJson()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            )}
            <span>{copied ? 'Скопировано' : 'Копировать JSON'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleDownloadBackup()}
            disabled={busyDownload}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <Download className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
            <span>{busyDownload ? 'Формируем JSON…' : 'Скачать резервную копию (.json)'}</span>
          </button>
        </div>
      </div>

      {/* Snapshot Summary: Statistics + Achievements + Hike History */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 inline-flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Статистика</span>
          </p>
          <p className="text-sm font-bold text-slate-900 font-mono tabular-nums">
            Аттестация: {payload.statistics.attestation.overallPercent}%
          </p>
          <p className="text-xs text-slate-600 tabular-nums">
            Самопроверка {payload.statistics.qualificationSelfCheck.readinessPercent}% · Диагностика{' '}
            {payload.statistics.safetyDiagnostics.overallPercent}% · Заявок:{' '}
            {payload.statistics.inquiriesSummary.totalCount}
          </p>
        </div>

        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 inline-flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
            <span>Ачивки и бейджи</span>
          </p>
          <p className="text-sm font-bold text-slate-900 font-mono tabular-nums">
            {payload.achievements.unlockedCount} из {payload.achievements.totalCount} получено
          </p>
          <p className="text-xs text-slate-600 tabular-nums">
            Выполнение: {payload.achievements.completionPercent}% · Регионов ДФО:{' '}
            {payload.achievements.metricsSnapshot.activeRegionsCount}
          </p>
        </div>

        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 inline-flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>История походов</span>
          </p>
          <p className="text-sm font-bold text-slate-900 font-mono tabular-nums">
            {payload.hikeHistory.totalEntries} маршрутов · {payload.hikeHistory.totalDistanceKm} км
          </p>
          <p className="text-xs text-slate-600">
            Макс. категория: {payload.hikeHistory.maxComplexity} · Включая GPX-треки
          </p>
        </div>
      </div>

      {/* Scope Tabs & Formatting Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        <div className="space-y-1">
          <div
            role="tablist"
            aria-label="Состав выгружаемого JSON-архива"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {BACKUP_SCOPE_OPTIONS.map((option) => {
              const active = scope === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setScope(option.id);
                    setStatusMessage(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500">{activeScopeMeta.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={pretty}
              onChange={(e) => setPretty(e.target.checked)}
              className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
            />
            <span>Форматировать (отступы)</span>
          </label>

          <button
            type="button"
            onClick={() => setPreviewExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium whitespace-nowrap shrink-0 cursor-pointer"
          >
            {previewExpanded ? (
              <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{previewExpanded ? 'Скрыть JSON' : 'Предпросмотр JSON'}</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <p
          role="status"
          className="text-xs text-teal-900 bg-teal-50 border border-teal-200 rounded-lg px-3.5 py-2.5 font-medium"
        >
          {statusMessage}
        </p>
      )}

      {errorMessage && (
        <p
          role="alert"
          className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 font-medium"
        >
          {errorMessage}
        </p>
      )}

      {/* Expandable JSON Preview */}
      {previewExpanded && (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-950 text-slate-100">
          <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-teal-400" aria-hidden="true" />
              <span>{suggestedFileName}</span>
            </span>
            <span className="tabular-nums">
              {lineCount} строк · {formattedSize}
            </span>
          </div>
          <pre className="p-4 text-[11px] font-mono leading-relaxed max-h-80 overflow-auto">
            <code>{jsonString}</code>
          </pre>
        </div>
      )}
    </section>
  );
};
