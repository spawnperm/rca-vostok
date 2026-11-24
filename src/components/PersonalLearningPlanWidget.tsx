import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Download,
  Eye,
  GraduationCap,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  DIAGNOSTIC_SECTIONS,
  evaluateAttestationDiagnostics,
  readStoredDiagnosticsState,
  type DiagnosticSectionId,
} from '../utils/attestationSelfDiagnostics';
import type { SessionUser } from '../utils/identityApi';
import type { PreparationContour } from '../utils/personalRoadmap';
import {
  LEARNING_PREP_LEVELS,
  buildPersonalLearningPlanModel,
  generatePersonalLearningPlanPdf,
  type GeneratedLearningPlanPdf,
  type LearningPrepLevelId,
} from '../utils/learningPlanPdf';
import { buildRegionSelectOptions, DFO_REGIONS } from '../data/dfoRegions';
import { tracker } from '../utils/tracker';

interface PersonalLearningPlanWidgetProps {
  user: SessionUser | null;
  selfCheckRevision?: number;
  selectedContour?: PreparationContour;
  onJumpToDiagnostics?: () => void;
}

export const PersonalLearningPlanWidget: React.FC<PersonalLearningPlanWidgetProps> = ({
  user,
  selfCheckRevision = 0,
  selectedContour = 'contour_b',
  onJumpToDiagnostics,
}) => {
  const [candidateName, setCandidateName] = useState<string>(
    user?.fullName ?? 'Соискатель РЦА «Русский Восток»'
  );
  const [region, setRegion] = useState<string>(user?.region ?? DFO_REGIONS[0]);
  const [levelId, setLevelId] = useState<LearningPrepLevelId>('intermediate');
  const [contour, setContour] = useState<PreparationContour>(selectedContour);
  const [gapDomainIds, setGapDomainIds] = useState<DiagnosticSectionId[]>([
    'routing',
    'first_aid',
  ]);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [busyPdf, setBusyPdf] = useState<boolean>(false);
  const [pdfResult, setPdfResult] = useState<GeneratedLearningPlanPdf | null>(null);
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setCandidateName(user.fullName);
      setRegion(user.region);
    }
  }, [user]);

  useEffect(() => {
    setContour(selectedContour);
  }, [selectedContour]);

  const syncFromDiagnostics = (silent = false) => {
    const stored = readStoredDiagnosticsState(user?.id);
    const evalRes = evaluateAttestationDiagnostics(stored.answers);
    if (evalRes.answeredCount === 0) {
      if (!silent) {
        setSyncNotice(
          'Самодиагностика ещё не заполнена — отметьте пробелы вручную или пройдите тест ниже.'
        );
      }
      return;
    }

    const detectedGaps = evalRes.sections
      .filter((sec) => sec.status !== 'strong')
      .map((sec) => sec.id);
    setGapDomainIds(detectedGaps.length > 0 ? detectedGaps : ['routing']);
    if (evalRes.overallPercent >= 80) {
      setLevelId('advanced');
    } else if (evalRes.overallPercent >= 50) {
      setLevelId('intermediate');
    } else {
      setLevelId('initial');
    }
    if (!silent) {
      setSyncNotice(
        `Синхронизировано с самодиагностикой: результат ${evalRes.overallPercent}%, выявлено приоритетных тем: ${detectedGaps.length}.`
      );
      tracker.trackCustomInteraction('План обучения синхронизирован с диагностикой');
    }
  };

  useEffect(() => {
    syncFromDiagnostics(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selfCheckRevision]);

  useEffect(() => {
    const url = pdfResult?.pdfBlobUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [pdfResult?.pdfBlobUrl]);

  useEffect(() => {
    if (!previewOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewOpen]);

  const plan = useMemo(
    () =>
      buildPersonalLearningPlanModel({
        candidateName,
        region,
        levelId,
        gapDomainIds,
        contour,
      }),
    [candidateName, region, levelId, gapDomainIds, contour]
  );

  const toggleGap = (id: DiagnosticSectionId) => {
    setSyncNotice(null);
    setGapDomainIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleGeneratePdf = () => {
    setError(null);
    setBusyPdf(true);
    try {
      const result = generatePersonalLearningPlanPdf({
        candidateName,
        region,
        levelId,
        gapDomainIds,
        contour,
      });
      setPdfResult(result);
      tracker.trackCustomInteraction(
        'Личный кабинет · Скачать индивидуальный план обучения (PDF)',
        result.plan.docCode
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сформировать PDF-дорожную карту.');
    } finally {
      setBusyPdf(false);
    }
  };

  return (
    <section
      id="personal-learning-plan"
      aria-labelledby="personal-learning-plan-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 scroll-mt-24"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Персональная траектория подготовки к аттестации</span>
          </p>
          <h3 id="personal-learning-plan-heading" className="text-xl font-bold text-slate-900">
            Индивидуальный план обучения
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Сформируйте и выгрузите PDF-дорожную карту на основе вашего уровня подготовки и
            текущих пробелов в знаниях по 4 блокам аттестационного экзамена.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => syncFromDiagnostics(false)}
            className="px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Синхронизировать с самодиагностикой</span>
          </button>
          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={busyPdf}
            className="px-4 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{busyPdf ? 'Формирование PDF…' : 'Скачать PDF-дорожную карту'}</span>
          </button>
        </div>
      </div>

      {syncNotice && (
        <div className="text-xs bg-teal-50 border border-teal-200 text-teal-900 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <span>{syncNotice}</span>
          {onJumpToDiagnostics && (
            <button
              type="button"
              onClick={onJumpToDiagnostics}
              className="font-semibold text-teal-800 underline underline-offset-2 cursor-pointer"
            >
              Перейти к самодиагностике
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Configuration */}
        <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
          {!user && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="lp-name" className="block text-xs font-semibold text-slate-700">
                  ФИО инструктора
                </label>
                <input
                  id="lp-name"
                  type="text"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="lp-region" className="block text-xs font-semibold text-slate-700">
                  Регион ДФО
                </label>
                <select
                  id="lp-region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                >
                  {buildRegionSelectOptions(region).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">
              1. Выберите уровень подготовки инструктора
            </p>
            <div className="space-y-2">
              {LEARNING_PREP_LEVELS.map((lvl) => {
                const selected = levelId === lvl.id;
                return (
                  <label
                    key={lvl.id}
                    className={`block p-3 rounded-lg border cursor-pointer transition-colors ${
                      selected
                        ? 'bg-teal-50/70 border-teal-500 text-teal-950'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="learning-prep-level"
                        value={lvl.id}
                        checked={selected}
                        onChange={() => setLevelId(lvl.id)}
                        className="mt-0.5 accent-teal-700 cursor-pointer shrink-0"
                      />
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold leading-snug">{lvl.label}</p>
                        <p className="text-[11px] text-slate-600">{lvl.targetCategory}</p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="lp-contour" className="block text-xs font-semibold text-slate-700">
              2. Образовательный трек
            </label>
            <select
              id="lp-contour"
              value={contour}
              onChange={(e) => setContour(e.target.value as PreparationContour)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
            >
              <option value="contour_a">Контур А (зачёт подтверждённого стажа)</option>
              <option value="contour_b">Контур Б (программа ДПО ВВГУ + экзамен)</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-700">
                3. Отметьте текущие пробелы в знаниях
              </p>
              <span className="text-[11px] font-mono text-teal-800">
                {gapDomainIds.length} из {DIAGNOSTIC_SECTIONS.length}
              </span>
            </div>
            <div className="space-y-2">
              {DIAGNOSTIC_SECTIONS.map((sec) => {
                const isGap = gapDomainIds.includes(sec.id);
                return (
                  <label
                    key={sec.id}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isGap
                        ? 'bg-amber-50/70 border-amber-300 text-amber-950 font-medium'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isGap}
                      onChange={() => toggleGap(sec.id)}
                      className="mt-0.5 w-4 h-4 accent-amber-600 rounded cursor-pointer shrink-0"
                    />
                    <span className="leading-snug">{sec.title}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-700 font-medium">
              {error}
            </p>
          )}

          {pdfResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 space-y-2 text-xs text-emerald-950">
              <div className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                <span>Дорожная карта {pdfResult.plan.docCode} готова</span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-emerald-300 text-emerald-900 font-semibold rounded-md hover:bg-emerald-100 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Предпросмотр PDF</span>
                </button>
                <a
                  href={pdfResult.pdfBlobUrl}
                  download={pdfResult.fileName}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-700 text-white font-semibold rounded-md hover:bg-emerald-800"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Скачать ещё раз</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Right: Ordered Modules Preview */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white rounded-xl p-4 sm:p-5">
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium text-teal-300">{plan.contourLabel}</p>
              <p className="text-sm sm:text-base font-bold">
                Дорожная карта · {plan.level.targetCategory}
              </p>
            </div>
            <div className="flex items-center gap-4 font-mono tabular-nums text-xs">
              <div>
                <p className="text-slate-400 text-[10px]">Объём</p>
                <p className="font-bold text-white">{plan.totalHours} ак. ч.</p>
              </div>
              <div>
                <p className="text-slate-400 text-[10px]">Горизонт</p>
                <p className="font-bold text-teal-300">{plan.recommendedWeeks} нед.</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {plan.modules.map((mod) => (
              <div
                key={mod.domainId}
                className={`rounded-xl border p-4 space-y-2.5 ${
                  mod.isGap
                    ? 'bg-amber-50/45 border-amber-200'
                    : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-teal-800">
                      0{mod.order}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{mod.title}</h4>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-sans font-semibold ${
                        mod.isGap
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-teal-50 text-teal-800 border border-teal-200'
                      }`}
                    >
                      {mod.isGap ? (
                        <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                      ) : (
                        <BookOpen className="w-3 h-3" aria-hidden="true" />
                      )}
                      <span>{mod.priorityLabel}</span>
                    </span>
                    <span className="font-semibold text-slate-700">
                      {mod.hours} ч · {mod.timeframeLabel}
                    </span>
                  </div>
                </div>

                <ul className="space-y-1 text-xs text-slate-700">
                  {mod.actions.slice(0, 2).map((act) => (
                    <li key={act} className="leading-snug">
                      · {act}
                    </li>
                  ))}
                </ul>

                <p className="text-[11px] font-medium text-teal-900 pt-1 border-t border-slate-200/70">
                  Итог модуля: {mod.deliverable}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {previewOpen && pdfResult && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lp-pdf-preview-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h4 id="lp-pdf-preview-title" className="text-sm font-bold text-slate-900">
                  Индивидуальная дорожная карта · {pdfResult.plan.docCode}
                </h4>
                <p className="text-xs text-slate-500">
                  {pdfResult.plan.candidateName} · {pdfResult.plan.totalHours} ч ·{' '}
                  {pdfResult.plan.recommendedWeeks} нед.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={pdfResult.pdfBlobUrl}
                  download={pdfResult.fileName}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Скачать PDF
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  aria-label="Закрыть предпросмотр плана обучения"
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex justify-center">
              <img
                src={pdfResult.previewDataUrl}
                alt={`Дорожная карта обучения ${pdfResult.plan.candidateName}`}
                className="max-w-full h-auto border border-slate-300 shadow-sm bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
