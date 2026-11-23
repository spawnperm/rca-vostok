import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CheckCircle2,
  Circle,
  Compass,
  Download,
  Eye,
  FileCheck2,
  FileText,
  RefreshCw,
  RotateCcw,
  X,
} from 'lucide-react';
import { ROLE_LABELS, type SessionUser } from '../utils/identityApi';
import { tracker } from '../utils/tracker';
import {
  generateCandidateCertificatePdf,
  type GeneratedPdfResult,
} from '../utils/candidateCertificatePdf';
import {
  generateAttestationFinalCertificatePdf,
  isAttestationEligibleForCertificate,
  type GeneratedFinalCertificateResult,
} from '../utils/attestationFinalCertificatePdf';
import type { InquiryRecord } from './social/MyInquiriesSection';

export type AttestationStageId = 'application' | 'training' | 'exam' | 'certificate';

interface StageChecklistItem {
  id: string;
  label: string;
  hint: string;
}

interface AttestationStageDef {
  id: AttestationStageId;
  stepNumber: string;
  title: string;
  shortTitle: string;
  durationHint: string;
  summary: string;
  outputLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  tasks: StageChecklistItem[];
}

export const ATTESTATION_STAGES: AttestationStageDef[] = [
  {
    id: 'application',
    stepNumber: '01',
    title: 'Подача заявки',
    shortTitle: 'Подача заявки',
    durationHint: '1–3 рабочих дня',
    summary:
      'Заполнение анкеты в РЦА «Русский Восток», выбор категории маршрута и первичная проверка пакета документов соискателя.',
    outputLabel: 'Заявка зарегистрирована и принята куратором РЦА',
    icon: FileText,
    tasks: [
      {
        id: 'app_profile',
        label: 'Заполнены профиль, регион присутствия и организация',
        hint: 'Синхронизируется автоматически из карточки профиля',
      },
      {
        id: 'app_inquiry',
        label: 'Подана заявка на аттестацию в РЦА «Русский Восток»',
        hint: 'Отслеживается автоматически по разделу «Мои заявки»',
      },
      {
        id: 'app_docs',
        label: 'Проверены медсправка и подтверждение походного стажа',
        hint: 'Подтверждается при переводе заявки в работу или вручную',
      },
    ],
  },
  {
    id: 'training',
    stepNumber: '02',
    title: 'Обучение',
    shortTitle: 'Обучение',
    durationHint: 'до 6 недель (ДПО ВВГУ)',
    summary:
      'Прохождение модульной переподготовки ДПО ВВГУ (≈ 250 ч) либо верификация практики по Контуру А с оформлением паспорта маршрута.',
    outputLabel: 'Допуск кафедры и согласованный паспорт маршрута',
    icon: BookOpenCheck,
    tasks: [
      {
        id: 'trn_track',
        label: 'Выбран образовательный трек (ДПО ВВГУ или Контур А)',
        hint: 'Соответствует категории сложности и региону ДФО',
      },
      {
        id: 'trn_modules',
        label: 'Изучены модули безопасности, ПП № 1893 и первой помощи',
        hint: 'Теория доступна дистанционно для всех субъектов ДФО',
      },
      {
        id: 'trn_passport',
        label: 'Подготовлен паспорт туристского маршрута (ПП № 760)',
        hint: 'Схемы эвакуации, точки связи и контрольные сроки',
      },
    ],
  },
  {
    id: 'exam',
    stepNumber: '03',
    title: 'Экзамен',
    shortTitle: 'Экзамен',
    durationHint: '2–3 дня очной сессии',
    summary:
      'Теоретическое тестирование, защита паспорта маршрута и практическая проверка навыков сопровождения группы на полигоне.',
    outputLabel: 'Успешная сдача теории и практического зачёта',
    icon: Compass,
    tasks: [
      {
        id: 'exm_theory',
        label: 'Пройдено тестирование по нормативным и тактическим вопросам',
        hint: 'Компьютерный тест перед аттестационной комиссией',
      },
      {
        id: 'exm_defense',
        label: 'Защищён паспорт маршрута и план действий в ЧС',
        hint: 'Оценка рисков, связи и взаимодействия с МЧС',
      },
      {
        id: 'exm_field',
        label: 'Сдан полевой этап на полигоне (Шкотовский р-н / выезд)',
        hint: 'Практика ориентирования, переправ и спасработ',
      },
    ],
  },
  {
    id: 'certificate',
    stepNumber: '04',
    title: 'Получение свидетельства',
    shortTitle: 'Свидетельство',
    durationHint: 'до 5 рабочих дней',
    summary:
      'Оформление протокола комиссии, внесение сведений в Единый федеральный реестр инструкторов-проводников и выдача бейджа.',
    outputLabel: 'Действующий статус в реестре сроком на 5 лет',
    icon: Award,
    tasks: [
      {
        id: 'crt_protocol',
        label: 'Подписан итоговый протокол аттестационной комиссии',
        hint: 'Утверждается председателем и экспертами ФСТР / ВВГУ',
      },
      {
        id: 'crt_registry',
        label: 'Запись внесена в Единый федеральный реестр проводников',
        hint: 'Присвоен уникальный реестровый номер',
      },
      {
        id: 'crt_badge',
        label: 'Получены свидетельство и нагрудная карточка-бейдж (5 лет)',
        hint: 'Документ подтверждает право сопровождения на маршрутах',
      },
    ],
  },
];

const ALL_TASK_IDS = ATTESTATION_STAGES.flatMap((stage) => stage.tasks.map((t) => t.id));
const STORAGE_PREFIX = 'rca_attestation_progress_v1:';

interface StoredProgress {
  completedTaskIds: string[];
  dismissedAutoIds?: string[];
  selectedStageId?: AttestationStageId;
}

function readStoredProgress(userId: string): StoredProgress {
  if (typeof window === 'undefined') {
    return { completedTaskIds: [], dismissedAutoIds: [] };
  }
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return { completedTaskIds: [], dismissedAutoIds: [] };
    const parsed = JSON.parse(raw) as Partial<StoredProgress>;
    return {
      completedTaskIds: Array.isArray(parsed.completedTaskIds)
        ? parsed.completedTaskIds.filter((id): id is string => typeof id === 'string')
        : [],
      dismissedAutoIds: Array.isArray(parsed.dismissedAutoIds)
        ? parsed.dismissedAutoIds.filter((id): id is string => typeof id === 'string')
        : [],
      selectedStageId: parsed.selectedStageId,
    };
  } catch {
    return { completedTaskIds: [], dismissedAutoIds: [] };
  }
}

function writeStoredProgress(userId: string, value: StoredProgress) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

function deriveAutoTaskIds(user: SessionUser, inquiries: InquiryRecord[]): Set<string> {
  const auto = new Set<string>();

  if (user.fullName.trim().length >= 2 && user.region.trim().length > 0) {
    auto.add('app_profile');
  }

  if (inquiries.length > 0) {
    auto.add('app_inquiry');
  }

  const hasInReviewOrApproved = inquiries.some(
    (inq) => inq.status === 'in_review' || inq.status === 'approved'
  );
  const hasApproved = inquiries.some((inq) => inq.status === 'approved');

  if (hasInReviewOrApproved) {
    auto.add('app_docs');
    auto.add('trn_track');
  }

  if (hasApproved) {
    auto.add('trn_modules');
  }

  if (user.role === 'instructor') {
    for (const id of ALL_TASK_IDS) {
      auto.add(id);
    }
  }

  return auto;
}

export interface UserAttestationSummary {
  percent: number;
  completedTasks: number;
  totalTasks: number;
  completedStages: number;
  activeStage: AttestationStageDef;
  stages: {
    stage: AttestationStageDef;
    completedCount: number;
    totalCount: number;
    percent: number;
    status: 'completed' | 'in_progress' | 'pending';
  }[];
  resolvedCompletedSet: Set<string>;
  autoTaskSet: Set<string>;
}

/**
 * Computes the 4-stage attestation progress for a specific user from:
 * - their role & profile completeness,
 * - their submitted inquiries (if available),
 * - and per-user checkpoints persisted in localStorage.
 */
export function computeUserAttestationSummary(
  user: SessionUser,
  inquiries: InquiryRecord[] = []
): UserAttestationSummary {
  const stored = readStoredProgress(user.id);
  const autoSet = deriveAutoTaskIds(user, inquiries);
  const dismissed = new Set(stored.dismissedAutoIds ?? []);
  const manual = new Set(stored.completedTaskIds);

  const resolvedCompletedSet = new Set<string>();
  for (const taskId of ALL_TASK_IDS) {
    if (manual.has(taskId) || (autoSet.has(taskId) && !dismissed.has(taskId))) {
      resolvedCompletedSet.add(taskId);
    }
  }

  const stageSummaries = ATTESTATION_STAGES.map((stage) => {
    const totalCount = stage.tasks.length;
    const completedCount = stage.tasks.filter((t) => resolvedCompletedSet.has(t.id)).length;
    const percent = Math.round((completedCount / Math.max(totalCount, 1)) * 100);
    const status: 'completed' | 'in_progress' | 'pending' =
      completedCount === totalCount
        ? 'completed'
        : completedCount > 0
        ? 'in_progress'
        : 'pending';

    return {
      stage,
      completedCount,
      totalCount,
      percent,
      status,
    };
  });

  const totalTasks = ALL_TASK_IDS.length;
  const completedTasks = resolvedCompletedSet.size;
  const percent = Math.round((completedTasks / Math.max(totalTasks, 1)) * 100);
  const completedStages = stageSummaries.filter((s) => s.status === 'completed').length;

  const firstIncomplete =
    stageSummaries.find((s) => s.status !== 'completed')?.stage ??
    ATTESTATION_STAGES[ATTESTATION_STAGES.length - 1];

  return {
    percent,
    completedTasks,
    totalTasks,
    completedStages,
    activeStage: firstIncomplete,
    stages: stageSummaries,
    resolvedCompletedSet,
    autoTaskSet: autoSet,
  };
}

interface AttestationProgressWidgetProps {
  user: SessionUser;
  inquiries: InquiryRecord[];
  inquiriesLoading?: boolean;
  selectedExamDate?: string;
  externalSelectedStage?: { stageId: AttestationStageId; nonce: number } | null;
  onSummaryChange?: (summary: UserAttestationSummary) => void;
  onRefreshInquiries?: () => void;
  onOpenApplication?: () => void;
}

export const AttestationProgressWidget: React.FC<AttestationProgressWidgetProps> = ({
  user,
  inquiries,
  inquiriesLoading = false,
  selectedExamDate,
  externalSelectedStage = null,
  onSummaryChange,
  onRefreshInquiries,
  onOpenApplication,
}) => {
  const [stored, setStored] = useState<StoredProgress>(() => readStoredProgress(user.id));
  const [pdfBusy, setPdfBusy] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfResult, setPdfResult] = useState<GeneratedPdfResult | null>(null);
  const [finalCertBusy, setFinalCertBusy] = useState<boolean>(false);
  const [finalCertResult, setFinalCertResult] = useState<GeneratedFinalCertificateResult | null>(
    null
  );
  const [previewKind, setPreviewKind] = useState<'none' | 'status' | 'final'>('none');

  useEffect(() => {
    setStored(readStoredProgress(user.id));
  }, [user.id]);

  useEffect(() => {
    if (!externalSelectedStage?.stageId) return;
    setStored((prev) => {
      const next = { ...prev, selectedStageId: externalSelectedStage.stageId };
      writeStoredProgress(user.id, next);
      return next;
    });
  }, [externalSelectedStage, user.id]);

  const summary = useMemo(
    () => computeUserAttestationSummary(user, inquiries),
    // `stored` triggers recalculation when local checkboxes change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, inquiries, stored]
  );

  const isAllCompleted = isAttestationEligibleForCertificate(summary);

  useEffect(() => {
    onSummaryChange?.(summary);
  }, [summary, onSummaryChange]);

  useEffect(() => {
    const url = pdfResult?.pdfBlobUrl;
    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [pdfResult?.pdfBlobUrl]);

  useEffect(() => {
    const url = finalCertResult?.pdfBlobUrl;
    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [finalCertResult?.pdfBlobUrl]);

  useEffect(() => {
    if (previewKind === 'none') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewKind('none');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewKind]);

  const selectedStageId: AttestationStageId =
    stored.selectedStageId && ATTESTATION_STAGES.some((s) => s.id === stored.selectedStageId)
      ? stored.selectedStageId
      : summary.activeStage.id;

  const selectedStageSummary =
    summary.stages.find((s) => s.stage.id === selectedStageId) ?? summary.stages[0];

  const latestInquiry = inquiries[0] ?? null;

  const updateStored = (updater: (prev: StoredProgress) => StoredProgress) => {
    setStored((prev) => {
      const next = updater(prev);
      writeStoredProgress(user.id, next);
      return next;
    });
  };

  const handleSelectStage = (stageId: AttestationStageId) => {
    updateStored((prev) => ({ ...prev, selectedStageId: stageId }));
    const stageObj = ATTESTATION_STAGES.find((s) => s.id === stageId);
    if (stageObj) {
      tracker.trackCustomInteraction(
        `Прогресс аттестации · Этап ${stageObj.stepNumber}`,
        stageObj.shortTitle
      );
    }
  };

  const handleToggleTask = (taskId: string) => {
    const isCurrentlyChecked = summary.resolvedCompletedSet.has(taskId);
    const isAuto = summary.autoTaskSet.has(taskId);

    updateStored((prev) => {
      const manual = new Set(prev.completedTaskIds);
      const dismissed = new Set(prev.dismissedAutoIds ?? []);

      if (isCurrentlyChecked) {
        manual.delete(taskId);
        if (isAuto) dismissed.add(taskId);
      } else {
        manual.add(taskId);
        dismissed.delete(taskId);
      }

      return {
        ...prev,
        completedTaskIds: Array.from(manual),
        dismissedAutoIds: Array.from(dismissed),
      };
    });

    tracker.trackCustomInteraction('Чек-лист аттестации в кабинете', taskId);
  };

  const handleToggleWholeStage = (stage: AttestationStageDef) => {
    const allDone = stage.tasks.every((t) => summary.resolvedCompletedSet.has(t.id));
    updateStored((prev) => {
      const manual = new Set(prev.completedTaskIds);
      const dismissed = new Set(prev.dismissedAutoIds ?? []);

      for (const t of stage.tasks) {
        const isAuto = summary.autoTaskSet.has(t.id);
        if (allDone) {
          manual.delete(t.id);
          if (isAuto) dismissed.add(t.id);
        } else {
          manual.add(t.id);
          dismissed.delete(t.id);
        }
      }

      return {
        ...prev,
        completedTaskIds: Array.from(manual),
        dismissedAutoIds: Array.from(dismissed),
      };
    });

    tracker.trackCustomInteraction(
      allDone ? `Сброс этапа ${stage.shortTitle}` : `Завершён этап ${stage.shortTitle}`,
      'account'
    );
  };

  const handleResetProgress = () => {
    const fresh: StoredProgress = {
      completedTaskIds: [],
      dismissedAutoIds: [],
      selectedStageId: undefined,
    };
    writeStoredProgress(user.id, fresh);
    setStored(fresh);
    tracker.trackCustomInteraction('Сброс прогресса аттестации', 'account');
  };

  const handleGenerateCertificatePdf = () => {
    setPdfBusy(true);
    setPdfError(null);
    try {
      const result = generateCandidateCertificatePdf(
        user,
        summary,
        inquiries,
        selectedExamDate
      );
      setPdfResult(result);
      tracker.trackCustomInteraction(
        'Генерация справки о статусе кандидата (PDF)',
        `${summary.percent}% · ${result.data.docNumber}`
      );
    } catch (err) {
      setPdfError(
        err instanceof Error ? err.message : 'Не удалось сформировать PDF-справку.'
      );
    } finally {
      setPdfBusy(false);
    }
  };

  const handleGenerateFinalCertificatePdf = () => {
    setFinalCertBusy(true);
    setPdfError(null);
    try {
      const result = generateAttestationFinalCertificatePdf(
        user,
        summary,
        inquiries,
        selectedExamDate
      );
      setFinalCertResult(result);
      tracker.trackCustomInteraction(
        'Скачивание сертификата об аттестации (PDF)',
        result.data.certificateNumber
      );
    } catch (err) {
      setPdfError(
        err instanceof Error ? err.message : 'Не удалось сформировать PDF-сертификат.'
      );
    } finally {
      setFinalCertBusy(false);
    }
  };

  const statusText =
    summary.percent === 100
      ? 'Аттестация завершена · Свидетельство активно'
      : `Текущий этап: ${summary.activeStage.stepNumber}. ${summary.activeStage.title}`;

  return (
    <section
      id="attestation-progress-widget"
      aria-labelledby="cabinet-attestation-progress-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 scroll-mt-24"
    >
      {/* Header + Overall Progress Summary */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-medium text-teal-700">
            Индивидуальный маршрут соискателя · РЦА «Русский Восток»
          </p>
          <h3
            id="cabinet-attestation-progress-heading"
            className="text-lg sm:text-xl font-bold text-slate-900"
          >
            Этапы аттестации и прогресс
          </h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{user.fullName}</span>
            <span aria-hidden="true">·</span>
            <span>{ROLE_LABELS[user.role]}</span>
            <span aria-hidden="true">·</span>
            <span>{user.region}</span>
            {latestInquiry && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-teal-800 font-medium">{latestInquiry.track}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums leading-none">
              {summary.percent}%
            </p>
            <p className="text-[11px] font-mono text-slate-500 tabular-nums mt-1">
              {summary.completedStages} из {ATTESTATION_STAGES.length} этапов ·{' '}
              {summary.completedTasks}/{summary.totalTasks} шагов
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {onRefreshInquiries && (
              <button
                type="button"
                onClick={onRefreshInquiries}
                disabled={inquiriesLoading}
                title="Синхронизировать со статусом заявок"
                className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <RefreshCw
                  className={`w-4 h-4 ${inquiriesLoading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span className="sr-only">Обновить статус заявок</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleResetProgress}
              title="Сбросить ручные отметки к данным профиля и заявок"
              className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">Сбросить прогресс</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overall Linear Progress Bar + Certificate PDF Action */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-800">{statusText}</span>
          <span className="font-mono text-slate-500 tabular-nums">
            Прогресс прохождения: {summary.percent}%
          </span>
        </div>

        <div
          role="progressbar"
          aria-label="Общий прогресс аттестации"
          aria-valuenow={summary.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="relative h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200"
        >
          <div
            className={`h-full transition-all duration-200 ${
              summary.percent === 100 ? 'bg-emerald-600' : 'bg-teal-700'
            }`}
            style={{ width: `${summary.percent}%` }}
          />
          {/* Quarter milestone ticks */}
          <span
            aria-hidden="true"
            className="absolute left-1/4 top-0 bottom-0 w-px bg-white/80"
          />
          <span
            aria-hidden="true"
            className="absolute left-2/4 top-0 bottom-0 w-px bg-white/80"
          />
          <span
            aria-hidden="true"
            className="absolute left-3/4 top-0 bottom-0 w-px bg-white/80"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-500">
            {isAllCompleted
              ? 'Все 4 этапа аттестации завершены (100%) — доступен итоговый сертификат и справка о статусе в PDF.'
              : `Данные прогресс-бара (${summary.percent}%, ${summary.completedTasks}/${summary.totalTasks} шагов) включаются в PDF-справку. После завершения всех этапов откроется кнопка скачивания сертификата.`}
          </p>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isAllCompleted && (
              <button
                type="button"
                onClick={handleGenerateFinalCertificatePdf}
                disabled={finalCertBusy}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                <Award className="w-4 h-4" aria-hidden="true" />
                {finalCertBusy ? 'Формируем PDF…' : 'Скачать сертификат (PDF)'}
              </button>
            )}

            <button
              type="button"
              onClick={handleGenerateCertificatePdf}
              disabled={pdfBusy}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <FileCheck2 className="w-4 h-4" aria-hidden="true" />
              {pdfBusy ? 'Формируем PDF…' : 'Справка о статусе кандидата (PDF)'}
            </button>
          </div>
        </div>

        {pdfError && (
          <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {pdfError}
          </p>
        )}

        {finalCertResult && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs">
            <div className="flex items-center gap-2 text-emerald-950">
              <Award className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>
                Сертификат{' '}
                <span className="font-mono font-semibold">
                  {finalCertResult.data.certificateNumber}
                </span>{' '}
                сформирован (100% · действует до {finalCertResult.data.validUntilFormatted}).
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewKind('final')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-emerald-300 text-emerald-900 font-semibold rounded-md hover:bg-emerald-50 transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                Просмотр сертификата
              </button>
              <a
                href={finalCertResult.pdfBlobUrl}
                download={finalCertResult.fileName}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-700 text-white font-semibold rounded-md hover:bg-emerald-800 transition-colors"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                Скачать PDF
              </a>
            </div>
          </div>
        )}

        {pdfResult && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 bg-teal-50/70 border border-teal-200 rounded-lg text-xs">
            <div className="flex items-center gap-2 text-teal-950">
              <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
              <span>
                Справка{' '}
                <span className="font-mono font-semibold">{pdfResult.data.docNumber}</span>{' '}
                сформирована ({pdfResult.data.overallPercent}%).
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewKind('status')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-teal-300 text-teal-900 font-semibold rounded-md hover:bg-teal-50 transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                Просмотр и печать РЦА
              </button>
              <a
                href={pdfResult.pdfBlobUrl}
                download={pdfResult.fileName}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-teal-700 text-white font-semibold rounded-md hover:bg-teal-800 transition-colors"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                Скачать PDF
              </a>
            </div>
          </div>
        )}
      </div>

      {/* 4-Stage Pipeline Selector */}
      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {summary.stages.map((item) => {
          const { stage, completedCount, totalCount, percent, status } = item;
          const Icon = stage.icon;
          const isSelected = stage.id === selectedStageId;

          const statusLabel =
            status === 'completed'
              ? 'Завершён'
              : status === 'in_progress'
              ? 'В работе'
              : 'Ожидает';

          const statusTextColor =
            status === 'completed'
              ? 'text-emerald-700'
              : status === 'in_progress'
              ? 'text-amber-700'
              : 'text-slate-500';

          return (
            <li key={stage.id}>
              <button
                type="button"
                onClick={() => handleSelectStage(stage.id)}
                aria-current={isSelected ? 'step' : undefined}
                className={`w-full h-full text-left p-4 rounded-xl border transition-colors flex flex-col justify-between gap-3 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                  isSelected
                    ? 'bg-teal-50/70 border-teal-700'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                        status === 'completed'
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : isSelected
                          ? 'bg-teal-700 border-teal-700 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      {status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Icon className="w-4 h-4" aria-hidden="true" />
                      )}
                    </span>

                    <span className={`text-[11px] font-semibold ${statusTextColor}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-mono text-slate-500 tabular-nums">
                      Этап {stage.stepNumber}
                    </p>
                    <p className="text-sm font-bold text-slate-900 leading-snug mt-0.5">
                      {stage.title}
                    </p>
                  </div>
                </div>

                {/* Per-Stage Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500">
                    <span>
                      {completedCount}/{totalCount}
                    </span>
                    <span>{percent}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${
                        status === 'completed'
                          ? 'bg-emerald-600'
                          : status === 'in_progress'
                          ? 'bg-teal-700'
                          : 'bg-slate-300'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Active / Selected Stage Detail & Interactive Checklist */}
      <div
        id="attestation-progress-details"
        className="pt-5 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start scroll-mt-24"
      >
        <div className="lg:col-span-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-mono font-semibold text-teal-800 tabular-nums">
              Этап {selectedStageSummary.stage.stepNumber}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {selectedStageSummary.stage.durationHint}
            </span>
          </div>

          <h4 className="text-base font-bold text-slate-900">
            {selectedStageSummary.stage.title}
          </h4>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {selectedStageSummary.stage.summary}
          </p>

          <p className="text-xs text-slate-700 pt-1">
            <span className="font-semibold text-slate-900">Результат этапа:</span>{' '}
            {selectedStageSummary.stage.outputLabel}
          </p>

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => handleToggleWholeStage(selectedStageSummary.stage)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              {selectedStageSummary.status === 'completed'
                ? 'Снять отметку этапа'
                : 'Отметить этап завершённым'}
            </button>

            {selectedStageSummary.stage.id === 'application' &&
              inquiries.length === 0 &&
              onOpenApplication && (
                <button
                  type="button"
                  onClick={onOpenApplication}
                  className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <span>Подать заявку</span>
                  <ArrowRight className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                </button>
              )}
          </div>
        </div>

        <div className="lg:col-span-7 divide-y divide-slate-200 border border-slate-200 rounded-xl bg-slate-50/50">
          {selectedStageSummary.stage.tasks.map((task) => {
            const checked = summary.resolvedCompletedSet.has(task.id);
            const autoVerified = summary.autoTaskSet.has(task.id);

            return (
              <label
                key={task.id}
                className="flex items-start gap-3 p-3.5 hover:bg-white transition-colors cursor-pointer first:rounded-t-xl last:rounded-b-xl"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleToggleTask(task.id)}
                  className="sr-only"
                />
                <span className="mt-0.5 shrink-0">
                  {checked ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-400" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span
                    className={`block text-xs sm:text-sm font-medium ${
                      checked ? 'text-slate-900' : 'text-slate-700'
                    }`}
                  >
                    {task.label}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {autoVerified ? 'Подтверждено по данным кабинета · ' : ''}
                    {task.hint}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Preview Modal for generated Candidate Status Certificate or Final Certificate PDF */}
      {previewKind === 'status' && pdfResult && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="certificate-preview-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h4 id="certificate-preview-title" className="text-sm font-bold text-slate-900">
                  Справка о статусе кандидата · {pdfResult.data.docNumber}
                </h4>
                <p className="text-xs text-slate-500">
                  Форма А4 с текущим прогрессом ({pdfResult.data.overallPercent}%) и печатью РЦА
                  «Русский Восток»
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={pdfResult.pdfBlobUrl}
                  download={pdfResult.fileName}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Скачать PDF
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewKind('none')}
                  aria-label="Закрыть предпросмотр"
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex justify-center">
              <img
                src={pdfResult.previewDataUrl}
                alt={`Справка о статусе кандидата ${pdfResult.data.candidateName}`}
                className="max-w-full h-auto border border-slate-300 shadow-sm bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {previewKind === 'final' && finalCertResult && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="final-certificate-preview-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h4 id="final-certificate-preview-title" className="text-sm font-bold text-slate-900">
                  Сертификат об аттестации · {finalCertResult.data.certificateNumber}
                </h4>
                <p className="text-xs text-slate-500">
                  Итоговый документ А4 · Действителен до {finalCertResult.data.validUntilFormatted}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={finalCertResult.pdfBlobUrl}
                  download={finalCertResult.fileName}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Скачать PDF
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewKind('none')}
                  aria-label="Закрыть предпросмотр"
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex justify-center">
              <img
                src={finalCertResult.previewDataUrl}
                alt={`Сертификат об аттестации ${finalCertResult.data.holderName}`}
                className="max-w-full h-auto border border-slate-300 shadow-sm bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
