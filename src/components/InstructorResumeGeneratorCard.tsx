import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Briefcase,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  UserCog,
  X,
} from 'lucide-react';
import type { UserAttestationSummary } from './AttestationProgressWidget';
import type { InquiryRecord } from './social/MyInquiriesSection';
import type { SessionUser } from '../utils/identityApi';
import {
  PRESET_INSTRUCTOR_SKILLS,
  type MaxRouteCategory,
} from '../utils/instructorPassportExport';
import {
  RESUME_SPECIALIZATIONS,
  buildDefaultResumeDraft,
  buildInstructorResumeModel,
  generateInstructorResumePdf,
  type GeneratedInstructorResumePdf,
  type InstructorResumeInput,
} from '../utils/instructorResumePdf';
import type { PreparationContour } from '../utils/personalRoadmap';
import { tracker } from '../utils/tracker';

interface InstructorResumeGeneratorCardProps {
  user: SessionUser | null;
  summary?: UserAttestationSummary;
  inquiries?: InquiryRecord[];
  selfCheckRevision?: number;
  selectedContour?: PreparationContour;
  onJumpToProfile?: () => void;
  onJumpToPassport?: () => void;
}

const REGIONS = [
  'Приморский край',
  'Хабаровский край',
  'Камчатский край',
  'Сахалинская область',
  'Амурская область',
  'Республика Саха (Якутия)',
] as const;

const CATEGORIES: readonly MaxRouteCategory[] = ['1 КС', '2 КС', '3 КС', '4 КС', 'Не указана'];

export const InstructorResumeGeneratorCard: React.FC<InstructorResumeGeneratorCardProps> = ({
  user,
  summary,
  inquiries = [],
  selfCheckRevision = 0,
  selectedContour = 'contour_b',
  onJumpToProfile,
  onJumpToPassport,
}) => {
  const [draft, setDraft] = useState<InstructorResumeInput>(() =>
    buildDefaultResumeDraft({
      user,
      summary,
      inquiries,
      selectedContour,
    })
  );
  const [newAchTitle, setNewAchTitle] = useState<string>('');
  const [newAchMeta, setNewAchMeta] = useState<string>('ДФО · Практика');
  const [newSkillText, setNewSkillText] = useState<string>('');
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [busyMode, setBusyMode] = useState<'none' | 'download' | 'preview'>('none');
  const [error, setError] = useState<string | null>(null);
  const [pdfResult, setPdfResult] = useState<GeneratedInstructorResumePdf | null>(null);
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);

  const syncFromProfileAndAttestation = (silent = false) => {
    const nextDraft = buildDefaultResumeDraft({
      user,
      summary,
      inquiries,
      selectedContour,
    });
    setDraft(nextDraft);
    if (!silent) {
      setSyncNotice('Данные резюме синхронизированы с профилем, паспортом и этапами аттестации.');
      tracker.trackCustomInteraction('Резюме инструктора синхронизировано с профилем');
    }
  };

  useEffect(() => {
    syncFromProfileAndAttestation(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.fullName, user?.region, user?.organisation, summary?.percent, selectedContour, selfCheckRevision]);

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

  const resumeModel = useMemo(() => buildInstructorResumeModel(draft), [draft]);

  const handleAddAchievement = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const title = newAchTitle.trim();
    if (!title) return;
    setDraft((prev) => ({
      ...prev,
      achievements: [
        ...prev.achievements,
        {
          id: `custom-ach-${Date.now()}`,
          title,
          meta: newAchMeta.trim() || prev.region,
        },
      ],
    }));
    setNewAchTitle('');
  };

  const removeAchievement = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      achievements: prev.achievements.filter((a) => a.id !== id),
    }));
  };

  const toggleSkill = (skill: string) => {
    setDraft((prev) => {
      const exists = prev.competencies.includes(skill);
      return {
        ...prev,
        competencies: exists
          ? prev.competencies.filter((s) => s !== skill)
          : [...prev.competencies, skill],
      };
    });
  };

  const handleAddSkill = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const clean = newSkillText.trim();
    if (!clean) return;
    setDraft((prev) => ({
      ...prev,
      competencies: prev.competencies.some((s) => s.toLowerCase() === clean.toLowerCase())
        ? prev.competencies
        : [...prev.competencies, clean],
    }));
    setNewSkillText('');
  };

  const handleGenerate = (mode: 'download' | 'preview') => {
    setError(null);
    setBusyMode(mode);
    try {
      const result = generateInstructorResumePdf(draft, {
        autoDownload: mode === 'download',
      });
      setPdfResult(result);
      if (mode === 'preview') {
        setPreviewOpen(true);
      }
      tracker.trackCustomInteraction(
        mode === 'download'
          ? 'Личный кабинет · Скачать резюме инструктора (PDF)'
          : 'Личный кабинет · Предпросмотр резюме инструктора',
        result.resume.resumeId
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сформировать PDF-резюме.');
    } finally {
      setBusyMode('none');
    }
  };

  return (
    <section
      id="instructor-resume-generator"
      aria-labelledby="instructor-resume-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Профессиональное CV на базе профиля и аттестации · {resumeModel.resumeId}</span>
          </p>
          <h3 id="instructor-resume-heading" className="text-xl font-bold text-slate-900">
            Генератор резюме инструктора
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Автоматически собирает сведения вашего профиля, пройденные этапы аттестации РЦА,
            походный стаж, достижения и подтверждённые навыки в структурированный PDF-документ для
            туроператоров и администраций ООПТ.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => syncFromProfileAndAttestation(false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Синхронизировать</span>
          </button>
          <button
            type="button"
            onClick={() => handleGenerate('preview')}
            disabled={busyMode !== 'none'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>{busyMode === 'preview' ? 'Готовим…' : 'Предпросмотр А4'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleGenerate('download')}
            disabled={busyMode !== 'none'}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{busyMode === 'download' ? 'Формируем PDF…' : 'Скачать резюме (PDF)'}</span>
          </button>
        </div>
      </div>

      {syncNotice && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-950">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
            <span>{syncNotice}</span>
          </span>
          <div className="flex items-center gap-3">
            {user && onJumpToProfile && (
              <button
                type="button"
                onClick={onJumpToProfile}
                className="font-semibold text-teal-800 underline underline-offset-2 cursor-pointer inline-flex items-center gap-1"
              >
                <UserCog className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Профиль</span>
              </button>
            )}
            {user && onJumpToPassport && (
              <button
                type="button"
                onClick={onJumpToPassport}
                className="font-semibold text-teal-800 underline underline-offset-2 cursor-pointer"
              >
                Цифровой паспорт
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

      {pdfResult && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950">
          <div className="inline-flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>
              PDF-резюме <span className="font-mono font-semibold">{pdfResult.fileName}</span>{' '}
              сформировано.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-emerald-300 text-emerald-900 font-semibold rounded-md hover:bg-emerald-100 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Открыть А4</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Editable Resume Content */}
        <div className="lg:col-span-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label htmlFor="cv-fullname" className="block text-xs font-semibold text-slate-700">
                ФИО инструктора
              </label>
              <input
                id="cv-fullname"
                type="text"
                value={draft.fullName}
                onChange={(e) => setDraft((p) => ({ ...p, fullName: e.target.value }))}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="cv-phone" className="block text-xs font-semibold text-slate-700">
                Телефон или Telegram
              </label>
              <input
                id="cv-phone"
                type="text"
                value={draft.contactPhone}
                onChange={(e) => setDraft((p) => ({ ...p, contactPhone: e.target.value }))}
                placeholder="+7 914 … или @username"
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="cv-region" className="block text-xs font-semibold text-slate-700">
                Субъект ДФО
              </label>
              <select
                id="cv-region"
                value={draft.region}
                onChange={(e) => setDraft((p) => ({ ...p, region: e.target.value }))}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none"
              >
                {Array.from(new Set([draft.region, ...REGIONS].filter(Boolean))).map((reg) => (
                  <option key={reg} value={reg}>
                    {reg}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="cv-org" className="block text-xs font-semibold text-slate-700">
                Организация / турклуб
              </label>
              <input
                id="cv-org"
                type="text"
                value={draft.organisation}
                onChange={(e) => setDraft((p) => ({ ...p, organisation: e.target.value }))}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="cv-spec" className="block text-xs font-semibold text-slate-700">
              Профессиональная специализация
            </label>
            <select
              id="cv-spec"
              value={draft.specialization}
              onChange={(e) => setDraft((p) => ({ ...p, specialization: e.target.value }))}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none"
            >
              {Array.from(
                new Set([draft.specialization, ...RESUME_SPECIALIZATIONS].filter(Boolean))
              ).map((sp) => (
                <option key={sp} value={sp}>
                  {sp}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label htmlFor="cv-years" className="block text-xs font-semibold text-slate-700">
                Стаж (лет)
              </label>
              <input
                id="cv-years"
                type="number"
                min={0}
                max={60}
                value={draft.yearsOfExperience}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    yearsOfExperience: Math.max(0, Math.min(60, Number(e.target.value) || 0)),
                  }))
                }
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="cv-routes" className="block text-xs font-semibold text-slate-700">
                Маршрутов
              </label>
              <input
                id="cv-routes"
                type="number"
                min={0}
                max={999}
                value={draft.completedRoutesCount}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    completedRoutesCount: Math.max(0, Math.min(999, Number(e.target.value) || 0)),
                  }))
                }
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="cv-cat" className="block text-xs font-semibold text-slate-700">
                Макс. КС
              </label>
              <select
                id="cv-cat"
                value={draft.maxCategory}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, maxCategory: e.target.value as MaxRouteCategory }))
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="cv-about" className="block text-xs font-semibold text-slate-700">
              Краткое описание походного опыта (Summary)
            </label>
            <textarea
              id="cv-about"
              rows={3}
              value={draft.aboutSummary}
              onChange={(e) => setDraft((p) => ({ ...p, aboutSummary: e.target.value }))}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none"
            />
          </div>

          {/* Achievements Editor */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-slate-700">
              Профессиональные достижения (включаются в PDF)
            </p>
            <form onSubmit={handleAddAchievement} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="text"
                aria-label="Новое профессиональное достижение"
                value={newAchTitle}
                onChange={(e) => setNewAchTitle(e.target.value)}
                placeholder="Например: Проведено 12 горных групп по хребту Ливадийский без ЧП"
                className="sm:col-span-7 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none"
              />
              <input
                type="text"
                aria-label="Период или регион достижения"
                value={newAchMeta}
                onChange={(e) => setNewAchMeta(e.target.value)}
                placeholder="2025–2026"
                className="sm:col-span-3 px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newAchTitle.trim()}
                className="sm:col-span-2 inline-flex items-center justify-center gap-1 px-2.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="sm:hidden">Добавить</span>
              </button>
            </form>

            <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-slate-50/50 max-h-52 overflow-y-auto">
              {draft.achievements.map((ach) => (
                <li
                  key={ach.id}
                  className="px-3 py-2 flex items-start justify-between gap-2 text-xs bg-white"
                >
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-medium text-slate-900 leading-snug">{ach.title}</p>
                    <p className="text-[11px] font-mono text-teal-800">{ach.meta}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAchievement(ach.id)}
                    aria-label={`Удалить достижение ${ach.title}`}
                    className="p-1 text-slate-400 hover:text-red-700 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Competencies Toggles */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">Ключевые компетенции ДФО</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_INSTRUCTOR_SKILLS.map((skill) => {
                const selected = draft.competencies.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleSkill(skill)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
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

            <form onSubmit={handleAddSkill} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                aria-label="Добавить свою компетенцию в резюме"
                value={newSkillText}
                onChange={(e) => setNewSkillText(e.target.value)}
                placeholder="Добавить навык (например: Свободный китайский / английский язык для групп)"
                className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newSkillText.trim()}
                className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg disabled:opacity-40 cursor-pointer"
              >
                Добавить
              </button>
            </form>
          </div>
        </div>

        {/* Right: Real-Time Resume Mockup */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800 inline-flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>Макет резюме инструктора в реальном времени</span>
            </span>
            <span className="font-mono text-slate-500">А4 · PDF</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
            <div className="bg-white border border-slate-300 rounded-lg overflow-hidden shadow-xs">
              {/* Banner */}
              <div className="bg-slate-900 text-white p-5 border-b-4 border-teal-700 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-300">
                  Профессиональное резюме · РЦА «Русский Восток»
                </p>
                <h4 className="text-lg font-bold leading-tight">{resumeModel.fullName}</h4>
                <p className="text-xs font-medium text-teal-200">{resumeModel.specialization}</p>
                <p className="text-[11px] text-slate-300 pt-1">
                  {resumeModel.region} · {resumeModel.organisation} · {resumeModel.email}
                  {resumeModel.contactPhone ? ` · ${resumeModel.contactPhone}` : ''}
                </p>
              </div>

              <div className="p-5 space-y-4">
                {/* KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[10px] text-slate-500">Стаж</p>
                    <p className="text-xs font-bold font-mono text-slate-900">
                      {resumeModel.yearsOfExperience} лет
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[10px] text-slate-500">Маршрутов</p>
                    <p className="text-xs font-bold font-mono text-slate-900">
                      {resumeModel.completedRoutesCount}
                    </p>
                  </div>
                  <div className="bg-teal-50 border border-teal-200 rounded p-2">
                    <p className="text-[10px] text-teal-800">Макс. КС</p>
                    <p className="text-xs font-bold font-mono text-teal-900">
                      {resumeModel.maxCategory}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <p className="text-[10px] text-slate-500">Аттестация</p>
                    <p className="text-xs font-bold font-mono text-teal-800">
                      {resumeModel.attestationPercent}%
                    </p>
                  </div>
                </div>

                {/* Summary */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                    Профиль и опыт
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {resumeModel.aboutSummary}
                  </p>
                </div>

                {/* Attestation */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-xs">
                  <div className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                    <Award className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                    <span>{resumeModel.attestationStatusLabel}</span>
                  </div>
                  <p className="text-[11px] text-slate-600">{resumeModel.educationAndDpo}</p>
                </div>

                {/* Achievements */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                    Ключевые достижения ({resumeModel.achievements.length})
                  </p>
                  <ul className="space-y-1.5 text-xs">
                    {resumeModel.achievements.slice(0, 5).map((ach) => (
                      <li key={ach.id} className="flex items-start justify-between gap-2">
                        <span className="text-slate-800 leading-snug">• {ach.title}</span>
                        <span className="text-[10px] font-mono text-teal-800 shrink-0 mt-0.5">
                          {ach.meta}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Competencies */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                    Подтверждённые компетенции ({resumeModel.competencies.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {resumeModel.competencies.slice(0, 6).map((c) => (
                      <span
                        key={c}
                        className="px-2 py-0.5 text-[10px] bg-slate-100 border border-slate-200 text-slate-800 rounded"
                      >
                        ✓ {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full A4 Preview Modal */}
      {previewOpen && pdfResult && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="resume-pdf-preview-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h4 id="resume-pdf-preview-title" className="text-sm font-bold text-slate-900">
                  Резюме инструктора · {pdfResult.resume.fullName}
                </h4>
                <p className="text-xs text-slate-500">
                  Код: {pdfResult.resume.resumeId} · Стаж {pdfResult.resume.yearsOfExperience} лет ·{' '}
                  Достижений: {pdfResult.resume.achievements.length}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={pdfResult.pdfBlobUrl}
                  download={pdfResult.fileName}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Скачать PDF</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  aria-label="Закрыть предпросмотр резюме"
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex justify-center">
              <img
                src={pdfResult.previewDataUrl}
                alt={`PDF-резюме инструктора ${pdfResult.resume.fullName}`}
                className="max-w-full h-auto border border-slate-300 shadow-sm bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
