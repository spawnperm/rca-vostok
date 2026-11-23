import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Download,
  Eye,
  FileJson,
  FileText,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import type { SessionUser } from '../utils/identityApi';
import type { UserAttestationSummary } from './AttestationProgressWidget';
import type { InquiryRecord } from './social/MyInquiriesSection';
import {
  PRESET_INSTRUCTOR_SKILLS,
  buildInstructorDigitalPassport,
  buildInstructorPassportJsonString,
  exportInstructorPassportJson,
  generateInstructorPassportPdf,
  readStoredPassportExtras,
  writeStoredPassportExtras,
  type GeneratedPassportPdfResult,
  type MaxRouteCategory,
  type StoredPassportExtras,
} from '../utils/instructorPassportExport';
import { tracker } from '../utils/tracker';

interface InstructorPassportCardProps {
  user: SessionUser;
  summary: UserAttestationSummary;
  inquiries: InquiryRecord[];
  selfCheckRevision?: number;
}

const CATEGORIES: readonly MaxRouteCategory[] = ['1 КС', '2 КС', '3 КС', '4 КС', 'Не указана'];

export const InstructorPassportCard: React.FC<InstructorPassportCardProps> = ({
  user,
  summary,
  inquiries,
  selfCheckRevision = 0,
}) => {
  const [extras, setExtras] = useState<StoredPassportExtras>(() =>
    readStoredPassportExtras(user.id, inquiries)
  );
  const [newSkillText, setNewSkillText] = useState<string>('');
  const [pdfBusy, setPdfBusy] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [pdfResult, setPdfResult] = useState<GeneratedPassportPdfResult | null>(null);
  const [previewMode, setPreviewMode] = useState<'none' | 'pdf' | 'json'>('none');

  useEffect(() => {
    setExtras(readStoredPassportExtras(user.id, inquiries));
  }, [user.id, inquiries]);

  useEffect(() => {
    const url = pdfResult?.pdfBlobUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [pdfResult?.pdfBlobUrl]);

  useEffect(() => {
    if (previewMode === 'none') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewMode('none');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewMode]);

  const passport = useMemo(
    () =>
      buildInstructorDigitalPassport({
        user,
        summary,
        inquiries,
        extras,
      }),
    [user, summary, inquiries, extras, selfCheckRevision]
  );

  const updateExtras = (updater: (prev: StoredPassportExtras) => StoredPassportExtras) => {
    setExtras((prev) => {
      const next = updater(prev);
      writeStoredPassportExtras(user.id, next);
      return next;
    });
  };

  const togglePresetSkill = (skill: string) => {
    updateExtras((prev) => {
      const exists = prev.customSkills.includes(skill);
      return {
        ...prev,
        customSkills: exists
          ? prev.customSkills.filter((s) => s !== skill)
          : [...prev.customSkills, skill],
      };
    });
  };

  const handleAddCustomSkill = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const clean = newSkillText.trim();
    if (!clean) return;
    updateExtras((prev) => {
      if (prev.customSkills.some((s) => s.toLowerCase() === clean.toLowerCase())) {
        return prev;
      }
      return {
        ...prev,
        customSkills: [...prev.customSkills, clean],
      };
    });
    setNewSkillText('');
  };

  const handleExportPdf = () => {
    setPdfBusy(true);
    setExportError(null);
    try {
      const res = generateInstructorPassportPdf(passport);
      setPdfResult(res);
      setExportStatus(`Цифровой паспорт (PDF) сформирован: ${res.fileName}`);
      tracker.trackCustomInteraction(
        'Выгрузка Цифрового паспорта (PDF)',
        `${passport.confirmedSkills.length} навыков`
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Не удалось сформировать PDF паспорта.');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleExportJson = () => {
    setExportError(null);
    try {
      const res = exportInstructorPassportJson(passport);
      setExportStatus(`Цифровой паспорт (JSON) экспортирован: ${res.fileName}`);
      tracker.trackCustomInteraction(
        'Выгрузка Цифрового паспорта (JSON)',
        `${passport.confirmedSkills.length} навыков`
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Не удалось экспортировать JSON.');
    }
  };

  const confirmedCount = passport.confirmedSkills.filter((s) => s.status === 'confirmed').length;
  const completedAttestationStages = passport.attestations.stages.filter((s) => s.completed).length;

  return (
    <section
      id="instructor-digital-passport"
      aria-labelledby="instructor-digital-passport-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 scroll-mt-24"
    >
      {/* Header & Export Actions */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Выгрузка профиля аттестуемого · {passport.passportId}</span>
          </p>
          <h3
            id="instructor-digital-passport-heading"
            className="text-lg sm:text-xl font-bold text-slate-900"
          >
            Цифровой паспорт инструктора
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Сводный верифицированный документ соискателя: объединяет подтверждённые навыки (из
            самопроверки и профиля), пройденные этапы аттестации и походный стаж в форматах PDF и
            JSON.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={pdfBusy}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <Download className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
            <span>{pdfBusy ? 'Формируем PDF…' : 'Скачать паспорт (PDF)'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <FileJson className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Экспорт JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setPreviewMode((m) => (m === 'json' ? 'none' : 'json'))}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            <span>Просмотр структуры</span>
          </button>
        </div>
      </div>

      {/* Key KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
          <p className="text-[11px] text-slate-500 font-medium">Подтверждённые навыки</p>
          <p className="text-xl font-bold font-mono text-slate-900 tabular-nums">
            {confirmedCount}
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
          <p className="text-[11px] text-slate-500 font-medium">Пройдено этапов РЦА</p>
          <p className="text-xl font-bold font-mono text-slate-900 tabular-nums">
            {completedAttestationStages} / {passport.attestations.totalStagesCount}
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
          <p className="text-[11px] text-slate-500 font-medium">Заявленный стаж</p>
          <p className="text-xl font-bold font-mono text-slate-900 tabular-nums">
            {extras.yearsOfExperience} лет
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
          <p className="text-[11px] text-slate-500 font-medium">Маршрутов / макс. КС</p>
          <p className="text-xl font-bold font-mono text-teal-800 tabular-nums">
            {extras.completedRoutesCount} · {extras.maxRouteCategory}
          </p>
        </div>
      </div>

      {/* Status / Error Alerts */}
      {exportError && (
        <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {exportError}
        </p>
      )}

      {exportStatus && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 bg-teal-50/70 border border-teal-200 rounded-lg text-xs">
          <span className="inline-flex items-center gap-2 text-teal-950 font-medium">
            <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
            <span>{exportStatus}</span>
          </span>
          {pdfResult && (
            <button
              type="button"
              onClick={() => setPreviewMode('pdf')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-teal-300 text-teal-900 font-semibold rounded-md hover:bg-teal-50 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              Открыть предпросмотр PDF
            </button>
          )}
        </div>
      )}

      {/* Editable Tenure + Skills Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Tenure & Attestations Summary */}
        <div className="lg:col-span-6 space-y-4">
          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Стаж и параметры походной практики
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label htmlFor="passport-years" className="block text-xs font-medium text-slate-700">
                Стаж (лет)
              </label>
              <input
                id="passport-years"
                type="number"
                min={0}
                max={60}
                value={extras.yearsOfExperience}
                onChange={(e) =>
                  updateExtras((prev) => ({
                    ...prev,
                    yearsOfExperience: Math.max(0, Math.min(60, Number(e.target.value) || 0)),
                  }))
                }
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="passport-routes" className="block text-xs font-medium text-slate-700">
                Маршрутов (шт.)
              </label>
              <input
                id="passport-routes"
                type="number"
                min={0}
                max={999}
                value={extras.completedRoutesCount}
                onChange={(e) =>
                  updateExtras((prev) => ({
                    ...prev,
                    completedRoutesCount: Math.max(0, Math.min(999, Number(e.target.value) || 0)),
                  }))
                }
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="passport-max-ks" className="block text-xs font-medium text-slate-700">
                Макс. КС
              </label>
              <select
                id="passport-max-ks"
                value={extras.maxRouteCategory}
                onChange={(e) =>
                  updateExtras((prev) => ({
                    ...prev,
                    maxRouteCategory: e.target.value as MaxRouteCategory,
                  }))
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="passport-tenure-note" className="block text-xs font-medium text-slate-700">
              Краткая запись о походном опыте (включается в PDF и JSON)
            </label>
            <textarea
              id="passport-tenure-note"
              rows={3}
              value={extras.tenureSummary}
              onChange={(e) =>
                updateExtras((prev) => ({
                  ...prev,
                  tenureSummary: e.target.value,
                }))
              }
              placeholder="Например: 6 лет руководства пешими маршрутами 1–3 КС в Приморье (хр. Сихотэ-Алинь, ООПТ «Земля леопарда»), справки ФСТР №…"
              className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none"
            />
          </div>

          {/* Attestations Snapshot */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5">
            <p className="text-xs font-semibold text-slate-900 inline-flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>Пройденные этапы и статус аттестации</span>
            </p>
            <ul className="divide-y divide-slate-200 text-xs">
              {passport.attestations.stages.map((st) => (
                <li key={st.id} className="py-1.5 flex items-center justify-between gap-3">
                  <span className="text-slate-700 truncate">{st.title}</span>
                  <span
                    className={`font-mono font-semibold tabular-nums shrink-0 ${
                      st.completed
                        ? 'text-emerald-700'
                        : st.percent > 0
                          ? 'text-amber-700'
                          : 'text-slate-500'
                    }`}
                  >
                    {st.statusLabel} ({st.percent}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: Confirmed Skills Aggregation */}
        <div className="lg:col-span-6 space-y-4">
          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Подтверждённые навыки и компетенции
          </h4>

          {/* Preset toggles */}
          <div className="space-y-2">
            <p className="text-xs text-slate-600">
              Быстрое добавление профильных компетенций ДФО (автоматически синхронизируется с
              анкетой-самопроверкой):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_INSTRUCTOR_SKILLS.map((skill) => {
                const selected = extras.customSkills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => togglePresetSkill(skill)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors text-left cursor-pointer ${
                      selected
                        ? 'bg-teal-50 border-teal-700 text-teal-900 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {selected ? '✓ ' : '+ '}
                    {skill}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom skill input */}
          <form onSubmit={handleAddCustomSkill} className="flex items-center gap-2">
            <label htmlFor="passport-custom-skill" className="sr-only">
              Добавить навык в цифровой паспорт
            </label>
            <input
              id="passport-custom-skill"
              type="text"
              value={newSkillText}
              onChange={(e) => setNewSkillText(e.target.value)}
              placeholder="Добавить свой подтверждённый навык (например: Спасработы на воде 3 КС)"
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newSkillText.trim()}
              className="inline-flex items-center gap-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Добавить
            </button>
          </form>

          {/* Aggregated Skills List */}
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 max-h-[260px] overflow-y-auto bg-slate-50/50">
            {passport.confirmedSkills.length === 0 ? (
              <p className="p-4 text-xs text-slate-500 text-center">
                Отметьте компетенции выше или пройдите «Анкету-самопроверку» — подтверждённые
                навыки появятся в паспорте автоматически.
              </p>
            ) : (
              passport.confirmedSkills.map((sk) => (
                <div
                  key={sk.id}
                  className="px-3.5 py-2.5 flex items-start justify-between gap-3 text-xs bg-white"
                >
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-medium text-slate-900 leading-snug">{sk.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {sk.sourceLabel} ·{' '}
                      <span
                        className={
                          sk.status === 'confirmed'
                            ? 'text-emerald-700 font-semibold'
                            : 'text-amber-700 font-semibold'
                        }
                      >
                        {sk.status === 'confirmed' ? 'Подтверждён' : 'В работе'}
                      </span>
                    </p>
                  </div>
                  {sk.source === 'custom' && (
                    <button
                      type="button"
                      onClick={() =>
                        updateExtras((prev) => ({
                          ...prev,
                          customSkills: prev.customSkills.filter((item) => item !== sk.title),
                        }))
                      }
                      aria-label={`Удалить навык ${sk.title}`}
                      className="p-1 text-slate-400 hover:text-red-700 rounded cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* JSON Structure Preview Drawer */}
      {previewMode === 'json' && (
        <div className="border border-slate-200 rounded-xl bg-slate-950 text-slate-100 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-mono text-teal-300 inline-flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{passport.schemaVersion}</span>
            </p>
            <button
              type="button"
              onClick={() => setPreviewMode('none')}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Скрыть
            </button>
          </div>
          <pre className="text-[11px] font-mono overflow-x-auto max-h-[280px] leading-relaxed">
            {buildInstructorPassportJsonString(passport)}
          </pre>
        </div>
      )}

      {/* PDF Preview Modal */}
      {previewMode === 'pdf' && pdfResult && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="passport-pdf-preview-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h4 id="passport-pdf-preview-title" className="text-sm font-bold text-slate-900">
                  Цифровой паспорт инструктора · {pdfResult.passport.passportId}
                </h4>
                <p className="text-xs text-slate-500">
                  Подтверждённых навыков: {confirmedCount} · Стаж: {extras.yearsOfExperience} лет
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
                  onClick={() => setPreviewMode('none')}
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
                alt={`Цифровой паспорт инструктора ${pdfResult.passport.profile.fullName}`}
                className="max-w-full h-auto border border-slate-300 shadow-sm bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
