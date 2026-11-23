import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Download,
  Eye,
  FileCheck2,
  LogIn,
  RefreshCw,
  RotateCcw,
  Square,
  X,
} from 'lucide-react';
import type { SessionUser } from '../utils/identityApi';
import type { UserAttestationSummary } from './AttestationProgressWidget';
import type { InquiryRecord } from './social/MyInquiriesSection';
import type { PreparationContour } from '../utils/personalRoadmap';
import {
  CHECKLIST_DISCIPLINES,
  HIKE_COMPLEXITY_CATEGORIES,
  buildPreparationChecklistData,
  generatePreparationChecklistPdf,
  inferInitialComplexityFromInquiries,
  type GeneratedChecklistPdfResult,
  type HikeComplexityId,
} from '../utils/preparationChecklistPdf';
import { tracker } from '../utils/tracker';

interface PreparationChecklistPdfCardProps {
  user: SessionUser | null;
  summary?: UserAttestationSummary;
  inquiries?: InquiryRecord[];
  selectedContour?: PreparationContour;
  onFocusAuth?: () => void;
}

const STORAGE_PREFIX = 'rca_prep_checklist_items_v1';

function readStoredCheckedIds(userId: string, complexityId: HikeComplexityId): string[] {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:${userId}:${complexityId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeStoredCheckedIds(
  userId: string,
  complexityId: HikeComplexityId,
  ids: string[]
) {
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}:${userId}:${complexityId}`,
      JSON.stringify(ids)
    );
  } catch {
    // ignore storage quota errors
  }
}

export const PreparationChecklistPdfCard: React.FC<PreparationChecklistPdfCardProps> = ({
  user,
  summary,
  inquiries = [],
  selectedContour = 'contour_b',
  onFocusAuth,
}) => {
  const inferredComplexity = useMemo(
    () => inferInitialComplexityFromInquiries(inquiries),
    [inquiries]
  );

  const [complexityId, setComplexityId] = useState<HikeComplexityId>(inferredComplexity);
  const [discipline, setDiscipline] = useState<string>(CHECKLIST_DISCIPLINES[0]);
  const [contour, setContour] = useState<PreparationContour>(selectedContour);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [busyMode, setBusyMode] = useState<'none' | 'download' | 'preview'>('none');
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedChecklistPdfResult | null>(null);
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);

  useEffect(() => {
    setContour(selectedContour);
  }, [selectedContour]);

  useEffect(() => {
    setComplexityId(inferredComplexity);
  }, [inferredComplexity]);

  useEffect(() => {
    if (!user) {
      setCheckedIds([]);
      return;
    }
    setCheckedIds(readStoredCheckedIds(user.id, complexityId));
  }, [user, complexityId]);

  useEffect(() => {
    const url = generated?.pdfBlobUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [generated?.pdfBlobUrl]);

  useEffect(() => {
    if (!previewOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewOpen]);

  const checklistData = useMemo(() => {
    if (!user) return null;
    return buildPreparationChecklistData({
      user,
      complexityId,
      discipline,
      contour,
      checkedItemIds: checkedIds,
      summary,
      inquiries,
    });
  }, [user, complexityId, discipline, contour, checkedIds, summary, inquiries]);

  if (!user || !checklistData) {
    return (
      <section
        id="account-checklist-pdf"
        aria-labelledby="account-checklist-guest-heading"
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 scroll-mt-24"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Персональный план подготовки · PDF формата А4</span>
            </p>
            <h3
              id="account-checklist-guest-heading"
              className="text-lg sm:text-xl font-bold text-slate-900"
            >
              Динамический PDF-чек-лист подготовки по категории сложности
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              После входа в личный кабинет выберите заявляемую категорию сложности похода
              (1 КС, 2 КС, 3 КС или 4+ КС), направление и контур — платформа автоматически
              соберёт персональный чек-лист документов, теории и снаряжения в PDF.
            </p>
          </div>
          {onFocusAuth && (
            <button
              type="button"
              onClick={onFocusAuth}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 self-start md:self-auto cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <LogIn className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
              <span>Войти для генерации чек-листа</span>
            </button>
          )}
        </div>
      </section>
    );
  }

  const toggleItem = (itemId: string) => {
    setCheckedIds((prev) => {
      const next = prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId];
      writeStoredCheckedIds(user.id, complexityId, next);
      return next;
    });
    setStatusMessage(null);
  };

  const handleResetChecks = () => {
    setCheckedIds([]);
    writeStoredCheckedIds(user.id, complexityId, []);
    setStatusMessage('Отметки текущего чек-листа сброшены.');
  };

  const handleGenerate = async (mode: 'download' | 'preview') => {
    setError(null);
    setStatusMessage(null);
    setBusyMode(mode);

    try {
      const result = await generatePreparationChecklistPdf(checklistData);
      setGenerated(result);

      if (mode === 'download') {
        const link = document.createElement('a');
        link.href = result.pdfBlobUrl;
        link.download = result.fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setStatusMessage(
          `Чек-лист для категории «${checklistData.complexity.codeLabel}» сформирован и сохранён в PDF (${result.fileName}).`
        );
      } else {
        setPreviewOpen(true);
      }

      tracker.trackCustomInteraction(
        `Личный кабинет · PDF-чек-лист (${checklistData.complexity.codeLabel})`,
        mode
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось сформировать PDF-чек-лист.'
      );
    } finally {
      setBusyMode('none');
    }
  };

  return (
    <section
      id="account-checklist-pdf"
      aria-labelledby="account-checklist-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <FileCheck2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Динамический подбор требований под категорию сложности · PDF А4</span>
          </p>
          <h3 id="account-checklist-heading" className="text-lg font-bold text-slate-900">
            Чек-лист подготовки к аттестации по категории сложности похода
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Перечень документов, теоретических разделов, полевых нормативов и снаряжения
            перестраивается автоматически при выборе категории (1–4+ КС), вида туризма и
            контура допуска. Ваши отметки готовности попадают прямо в PDF-файл.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void handleGenerate('preview')}
            disabled={busyMode !== 'none'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>{busyMode === 'preview' ? 'Готовим макет…' : 'Предпросмотр А4'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleGenerate('download')}
            disabled={busyMode !== 'none'}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            {busyMode === 'download' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>
              {busyMode === 'download' ? 'Генерируем PDF…' : 'Скачать PDF-чек-лист'}
            </span>
          </button>
        </div>
      </div>

      {/* Category of Difficulty Selector */}
      <div className="space-y-2.5">
        <span className="block text-xs font-semibold text-slate-700">
          1. Выберите категорию сложности похода
        </span>
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          role="radiogroup"
          aria-label="Категория сложности похода"
        >
          {HIKE_COMPLEXITY_CATEGORIES.map((cat) => {
            const selected = cat.id === complexityId;
            return (
              <button
                key={cat.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setComplexityId(cat.id);
                  setStatusMessage(null);
                }}
                className={`text-left rounded-lg border p-3.5 transition-colors cursor-pointer space-y-1 ${
                  selected
                    ? 'bg-teal-50/70 border-teal-600 ring-1 ring-teal-600'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-mono text-sm font-bold tabular-nums ${
                      selected ? 'text-teal-900' : 'text-slate-900'
                    }`}
                  >
                    {cat.codeLabel}
                  </span>
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    {cat.recommendedPrepWeeks}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-800">{cat.shortTitle}</p>
                <p className="text-[11px] text-slate-500 leading-snug">
                  {cat.maxGroupSize}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Secondary Controls: Discipline & Contour + Dynamic Readiness Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="lg:col-span-5 space-y-1.5">
          <label
            htmlFor="checklist-discipline"
            className="block text-xs font-semibold text-slate-700"
          >
            Направление (вид туризма)
          </label>
          <select
            id="checklist-discipline"
            value={discipline}
            onChange={(e) => {
              setDiscipline(e.target.value);
              setStatusMessage(null);
            }}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
          >
            {CHECKLIST_DISCIPLINES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-4 space-y-1.5">
          <label
            htmlFor="checklist-contour"
            className="block text-xs font-semibold text-slate-700"
          >
            Траектория допуска
          </label>
          <select
            id="checklist-contour"
            value={contour}
            onChange={(e) => {
              setContour(e.target.value as PreparationContour);
              setStatusMessage(null);
            }}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
          >
            <option value="contour_b">Контур Б · ДПО ВВГУ (250 ч)</option>
            <option value="contour_a">Контур А · подтверждение стажа</option>
          </select>
        </div>

        <div className="lg:col-span-3 flex items-center justify-between lg:justify-end gap-3 pt-1">
          <div className="text-left lg:text-right">
            <p className="text-[11px] text-slate-500">Готовность по чек-листу</p>
            <p className="text-sm font-mono font-bold text-slate-900 tabular-nums">
              {checklistData.checkedItems} / {checklistData.totalItems} ({checklistData.readinessPercent}%)
            </p>
          </div>
          {checkedIds.length > 0 && (
            <button
              type="button"
              onClick={handleResetChecks}
              title="Сбросить отметки"
              className="p-2 bg-white border border-slate-300 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Selected Complexity Requirements Banner */}
      <div className="bg-teal-50/50 border border-teal-200 rounded-lg px-4 py-3 text-xs text-slate-700 space-y-1">
        <p className="font-semibold text-teal-950">
          Требования к уровню «{checklistData.complexity.codeLabel}»:
        </p>
        <p>
          <span className="font-medium text-slate-900">Ценз допуска:</span>{' '}
          {checklistData.complexity.experienceRequirement} ·{' '}
          <span className="font-medium text-slate-900">Фокус комиссии:</span>{' '}
          {checklistData.complexity.examFocus}
        </p>
      </div>

      {/* Interactive Checklist Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {checklistData.sections.map((section) => (
          <div
            key={section.id}
            className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white"
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-900">
                <span className="font-mono text-teal-700 mr-1.5">{section.number}.</span>
                {section.title}
              </h4>
              <span className="text-[11px] font-mono text-slate-500 tabular-nums shrink-0">
                {section.items.filter((i) => i.checked).length}/{section.items.length}
              </span>
            </div>

            <ul className="space-y-2">
              {section.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    aria-pressed={item.checked}
                    className={`w-full text-left flex items-start gap-2.5 p-2 rounded-md border transition-colors cursor-pointer ${
                      item.checked
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : 'bg-slate-50/60 border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    {item.checked ? (
                      <CheckSquare
                        className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                    ) : (
                      <Square
                        className="w-4 h-4 text-slate-400 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                    )}
                    <div className="space-y-0.5 min-w-0">
                      <p
                        className={`text-xs font-semibold leading-snug ${
                          item.checked ? 'text-emerald-950' : 'text-slate-900'
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {item.detail}
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 pt-0.5">
                        {item.priority}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5"
        >
          {error}
        </p>
      )}

      {statusMessage && (
        <p
          role="status"
          className="text-xs text-teal-900 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2.5 font-medium"
        >
          {statusMessage}
        </p>
      )}

      {/* A4 Preview Modal */}
      {previewOpen && generated && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="checklist-pdf-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h4
                  id="checklist-pdf-modal-title"
                  className="text-sm font-bold text-slate-900"
                >
                  Предпросмотр PDF-чек-листа · {generated.data.complexity.codeLabel}
                </h4>
                <p className="text-xs text-slate-500 tabular-nums">
                  {generated.fileName} · Страниц: {generated.previewPagesDataUrls.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={generated.pdfBlobUrl}
                  download={generated.fileName}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Скачать PDF</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  aria-label="Закрыть предпросмотр"
                  className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="p-6 bg-slate-100 overflow-y-auto space-y-6">
              {generated.previewPagesDataUrls.map((src, idx) => (
                <div key={idx} className="bg-white shadow-md rounded border border-slate-200 overflow-hidden">
                  <img
                    src={src}
                    alt={`Страница ${idx + 1} чек-листа подготовки к аттестации`}
                    className="w-full h-auto block"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
