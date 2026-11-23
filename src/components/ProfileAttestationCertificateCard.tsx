import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Download,
  Eye,
  FileBadge2,
  FileCheck2,
  FileJson,
  LogIn,
  RefreshCw,
  UserCog,
  X,
} from 'lucide-react';
import { ROLE_LABELS, type SessionUser } from '../utils/identityApi';
import type { UserAttestationSummary } from './AttestationProgressWidget';
import type { InquiryRecord } from './social/MyInquiriesSection';
import type { PreparationContour } from '../utils/personalRoadmap';
import {
  PROFILE_CERTIFICATE_CATEGORIES,
  PROFILE_CERTIFICATE_CONTOURS,
  PROFILE_CERTIFICATE_TRACKS,
  buildProfileAttestationCertificateData,
  generateProfileCertificatePdf,
  resolveDefaultExamDateIso,
  resolveDefaultTrack,
  type GeneratedProfileCertificateResult,
} from '../utils/profileCertificatePdf';
import { tracker } from '../utils/tracker';

interface ProfileAttestationCertificateCardProps {
  user: SessionUser | null;
  summary?: UserAttestationSummary;
  inquiries?: InquiryRecord[];
  selectedExamDate?: string;
  selectedContour?: PreparationContour;
  onJumpToProfile?: () => void;
  onFocusAuth?: () => void;
}

export const ProfileAttestationCertificateCard: React.FC<
  ProfileAttestationCertificateCardProps
> = ({
  user,
  summary,
  inquiries = [],
  selectedExamDate,
  selectedContour = 'contour_b',
  onJumpToProfile,
  onFocusAuth,
}) => {
  const defaultTrack = useMemo(() => resolveDefaultTrack(inquiries), [inquiries]);
  const defaultExamIso = useMemo(
    () => resolveDefaultExamDateIso(inquiries, selectedExamDate),
    [inquiries, selectedExamDate]
  );

  const [track, setTrack] = useState<string>(defaultTrack);
  const [complexityCategory, setComplexityCategory] = useState<string>(
    PROFILE_CERTIFICATE_CATEGORIES[1]
  );
  const [contour, setContour] = useState<PreparationContour>(selectedContour);
  const [examDateIso, setExamDateIso] = useState<string>(defaultExamIso);
  const [protocolNote, setProtocolNote] = useState<string>('');
  const [busyMode, setBusyMode] = useState<'none' | 'download' | 'preview'>('none');
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedProfileCertificateResult | null>(null);
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);

  useEffect(() => {
    setTrack(defaultTrack);
  }, [defaultTrack]);

  useEffect(() => {
    setExamDateIso(defaultExamIso);
  }, [defaultExamIso]);

  useEffect(() => {
    setContour(selectedContour);
  }, [selectedContour]);

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

  const previewData = useMemo(() => {
    if (!user || !summary) return null;
    return buildProfileAttestationCertificateData({
      user,
      summary,
      inquiries,
      track,
      complexityCategory,
      contour,
      examDateIso,
      protocolNote,
    });
  }, [
    user,
    summary,
    inquiries,
    track,
    complexityCategory,
    contour,
    examDateIso,
    protocolNote,
  ]);

  if (!user || !summary || !previewData) {
    return (
      <section
        id="account-certificate-generator"
        aria-labelledby="account-certificate-guest-heading"
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 scroll-mt-24"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
              <FileBadge2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Персональный документ А4 · PDF на основе профиля</span>
            </p>
            <h3
              id="account-certificate-guest-heading"
              className="text-lg sm:text-xl font-bold text-slate-900"
            >
              Генератор PDF-сертификата об аттестации
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              После входа в личный кабинет инструктор может сформировать официальный
              PDF-сертификат формата А4 на основе данных профиля: ФИО, субъекта ДФО,
              организации, выбранного направления, категории сложности и пройденных этапов.
            </p>
          </div>
          {onFocusAuth && (
            <button
              type="button"
              onClick={onFocusAuth}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 self-start md:self-auto cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <LogIn className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
              <span>Войти для генерации PDF</span>
            </button>
          )}
        </div>
      </section>
    );
  }

  const trackOptions = Array.from(
    new Set([track, ...PROFILE_CERTIFICATE_TRACKS].filter(Boolean))
  );

  const handleGenerate = (mode: 'download' | 'preview') => {
    setBusyMode(mode);
    setError(null);
    try {
      const result = generateProfileCertificatePdf(
        {
          user,
          summary,
          inquiries,
          track,
          complexityCategory,
          contour,
          examDateIso,
          protocolNote,
        },
        { autoDownload: mode === 'download' }
      );
      setGenerated(result);
      setStatusMessage(
        mode === 'download'
          ? `PDF-сертификат ${result.data.certificateNumber} сформирован и загружен.`
          : `Предпросмотр А4 для сертификата ${result.data.certificateNumber} готов.`
      );
      if (mode === 'preview') {
        setPreviewOpen(true);
      }
      tracker.trackCustomInteraction(
        mode === 'download'
          ? 'Генерация PDF-сертификата по профилю'
          : 'Предпросмотр PDF-сертификата по профилю',
        `${result.data.certificateNumber} · ${result.data.trackLabel}`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось сформировать PDF-сертификат по данным профиля.'
      );
    } finally {
      setBusyMode('none');
    }
  };

  const handleResetDefaults = () => {
    setTrack(defaultTrack);
    setComplexityCategory(PROFILE_CERTIFICATE_CATEGORIES[1]);
    setContour(selectedContour);
    setExamDateIso(defaultExamIso);
    setProtocolNote('');
    setError(null);
    setStatusMessage('Параметры сертификата синхронизированы с данными профиля.');
  };

  const handleDownloadCertificateJson = () => {
    setError(null);
    try {
      const payload = {
        schemaVersion: 'rca-vostok.certificate.v1',
        exportedAtIso: new Date().toISOString(),
        certificate: previewData,
      };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const fileName = `Sertifikat_RCA_${previewData.certificateNumber}_${previewData.issuedAtIso}.json`;
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatusMessage(`JSON-данные сертификата сохранены: ${fileName}`);
      tracker.trackCustomInteraction(
        'Экспорт сертификата (JSON)',
        `${previewData.certificateNumber} · ${previewData.trackLabel}`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось сформировать JSON-файл сертификата.'
      );
    }
  };

  return (
    <section
      id="account-certificate-generator"
      aria-labelledby="account-certificate-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 scroll-mt-24"
    >
      {/* Top Header & Primary Actions */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-teal-800 font-medium">
            <Award className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Документ личного кабинета</span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="font-mono tabular-nums">{previewData.certificateNumber}</span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="font-mono text-slate-600 tabular-nums">
              {previewData.verificationCode}
            </span>
          </div>
          <h3
            id="account-certificate-heading"
            className="text-lg sm:text-xl font-bold text-slate-900 text-balance"
          >
            Генератор PDF-сертификата об аттестации
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Формирует официальный бланк формата А4 с печатью РЦА «Русский Восток» на основе
            актуальных сведений вашего профиля, заявки и прогресса прохождения этапов.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadCertificateJson}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <FileJson className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>JSON сертификата</span>
          </button>

          <button
            type="button"
            onClick={() => handleGenerate('preview')}
            disabled={busyMode !== 'none'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <Eye className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>
              {busyMode === 'preview' ? 'Готовим предпросмотр…' : 'Предпросмотр А4'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleGenerate('download')}
            disabled={busyMode !== 'none'}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {busyMode === 'download' ? 'Формируем PDF…' : 'Сформировать и скачать PDF'}
            </span>
          </button>
        </div>
      </div>

      {/* 4-column Summary Metrics Strip */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1 min-w-0">
          <dt className="text-xs text-slate-500">Владелец сертификата</dt>
          <dd className="text-sm font-semibold text-slate-900 truncate">
            {previewData.holderName}
          </dd>
        </div>
        <div className="space-y-1 min-w-0">
          <dt className="text-xs text-slate-500">Субъект ДФО и роль</dt>
          <dd className="text-sm font-semibold text-slate-900 truncate">
            {previewData.region} · {ROLE_LABELS[user.role]}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs text-slate-500">Срок действия документа</dt>
          <dd className="text-sm font-semibold font-mono text-slate-900 tabular-nums">
            5 лет · до {previewData.validUntilFormatted}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs text-slate-500">Готовность по этапам</dt>
          <dd
            className={`text-sm font-semibold font-mono tabular-nums ${
              previewData.isFullyCompleted ? 'text-emerald-700' : 'text-teal-800'
            }`}
          >
            {previewData.percent}% · {previewData.completedStages}/{previewData.totalStages}{' '}
            этапов
          </dd>
        </div>
      </dl>

      {/* Alerts */}
      {error && (
        <p
          role="alert"
          className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5"
        >
          {error}
        </p>
      )}

      {statusMessage && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 bg-teal-50/80 border border-teal-200 rounded-lg text-xs">
          <span className="inline-flex items-center gap-2 text-teal-950 font-medium">
            <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
            <span>{statusMessage}</span>
          </span>
          {generated && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-teal-300 text-teal-900 font-semibold rounded-md hover:bg-teal-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                Открыть бланк
              </button>
              <a
                href={generated.pdfBlobUrl}
                download={generated.fileName}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-700 text-white font-semibold rounded-md hover:bg-teal-800 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                Скачать повторно
              </a>
            </div>
          )}
        </div>
      )}

      {/* Main 2-column Grid: Profile Controls + Live Sheet Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Profile-synced data + Customizable attestation parameters */}
        <div className="lg:col-span-6 space-y-5">
          {/* Profile Data Snapshot (flat hairline rows, synced live with ProfileCard) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-slate-800">
                Сведения, автоматически подтянутые из профиля
              </h4>
              {onJumpToProfile && (
                <button
                  type="button"
                  onClick={onJumpToProfile}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <UserCog className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Изменить в профиле</span>
                </button>
              )}
            </div>

            <dl className="divide-y divide-slate-200 border-y border-slate-200 text-xs">
              <div className="py-2 flex items-baseline justify-between gap-4">
                <dt className="text-slate-500 shrink-0">ФИО соискателя</dt>
                <dd className="font-semibold text-slate-900 text-right">
                  {previewData.holderName}
                </dd>
              </div>
              <div className="py-2 flex items-baseline justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Электронная почта</dt>
                <dd className="font-mono text-slate-700 text-right truncate">
                  {previewData.holderEmail}
                </dd>
              </div>
              <div className="py-2 flex items-baseline justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Регион ДФО</dt>
                <dd className="font-medium text-slate-900 text-right">
                  {previewData.region}
                </dd>
              </div>
              <div className="py-2 flex items-baseline justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Организация</dt>
                <dd className="font-medium text-slate-900 text-right">
                  {previewData.organisation}
                </dd>
              </div>
            </dl>
          </div>

          {/* Customizable Attestation Certificate Parameters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-slate-800">
                Параметры аттестационного бланка
              </h4>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                <span>Сбросить по профилю</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label
                  htmlFor="cert-track-select"
                  className="block text-xs font-medium text-slate-700"
                >
                  Направление туризма
                </label>
                <select
                  id="cert-track-select"
                  value={track}
                  onChange={(e) => setTrack(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
                >
                  {trackOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="cert-category-select"
                  className="block text-xs font-medium text-slate-700"
                >
                  Категория сложности (КС)
                </label>
                <select
                  id="cert-category-select"
                  value={complexityCategory}
                  onChange={(e) => setComplexityCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
                >
                  {PROFILE_CERTIFICATE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="cert-contour-select"
                  className="block text-xs font-medium text-slate-700"
                >
                  Контур аттестации
                </label>
                <select
                  id="cert-contour-select"
                  value={contour}
                  onChange={(e) => setContour(e.target.value as PreparationContour)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
                >
                  {PROFILE_CERTIFICATE_CONTOURS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.shortLabel}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="cert-exam-date"
                  className="block text-xs font-medium text-slate-700"
                >
                  Дата аттестационной сессии
                </label>
                <input
                  id="cert-exam-date"
                  type="date"
                  value={examDateIso}
                  onChange={(e) => setExamDateIso(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="cert-protocol-note"
                className="block text-xs font-medium text-slate-700"
              >
                Основание / номер протокола комиссии (необязательно)
              </label>
              <input
                id="cert-protocol-note"
                type="text"
                maxLength={110}
                value={protocolNote}
                onChange={(e) => setProtocolNote(e.target.value)}
                placeholder="По умолчанию заполняется автоматически по профилю и статусу"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>
          </div>
        </div>

        {/* Right: Live Instant Certificate Sheet Preview */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-800 inline-flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>Макет сертификата в реальном времени</span>
            </span>
            <span className="font-mono text-slate-500 tabular-nums">Формат А4</span>
          </div>

          <div
            aria-label="Предварительный макет сертификата об аттестации"
            className="bg-slate-50 border border-slate-200 rounded-lg p-4 sm:p-5"
          >
            <div className="bg-white border-2 border-teal-800 p-4 sm:p-5 space-y-4 shadow-xs">
              {/* Institutional Band */}
              <div className="bg-teal-800 text-white px-3.5 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-teal-100 truncate">
                    РЦА Приморского края · ВВГУ и ФСТР
                  </p>
                  <p className="text-xs sm:text-sm font-bold tracking-tight truncate">
                    ЦЕНТР АТТЕСТАЦИИ «РУССКИЙ ВОСТОК»
                  </p>
                </div>
                <span className="font-mono text-[10px] text-teal-100 tabular-nums shrink-0">
                  {previewData.certificateNumber}
                </span>
              </div>

              {/* Main Title */}
              <div className="text-center space-y-1 pt-1">
                <p className="font-serif text-lg sm:text-xl font-bold tracking-wide text-slate-900">
                  СЕРТИФИКАТ
                </p>
                <p className="text-[11px] font-semibold text-teal-800">
                  о прохождении аттестации инструктора-проводника
                </p>
              </div>

              {/* Holder Block */}
              <div className="text-center border-y border-slate-200 py-3 space-y-1">
                <p className="text-[11px] text-slate-500">Выдан специалисту:</p>
                <p className="text-base sm:text-lg font-bold text-slate-900">
                  {previewData.holderName}
                </p>
                <p className="text-[11px] text-slate-600">
                  {previewData.region} · {previewData.organisation}
                </p>
              </div>

              {/* Details Rows */}
              <dl className="divide-y divide-slate-100 text-[11px]">
                <div className="py-1.5 flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500 shrink-0">Направление</dt>
                  <dd className="font-semibold text-slate-900 text-right">
                    {previewData.trackLabel}
                  </dd>
                </div>
                <div className="py-1.5 flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500 shrink-0">Сложность</dt>
                  <dd className="font-medium text-slate-900 text-right">
                    {previewData.complexityCategory}
                  </dd>
                </div>
                <div className="py-1.5 flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500 shrink-0">Дата сессии</dt>
                  <dd className="font-mono text-slate-900 text-right tabular-nums">
                    {previewData.examDateLabel}
                  </dd>
                </div>
                <div className="py-1.5 flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500 shrink-0">Действует до</dt>
                  <dd className="font-mono text-slate-900 text-right tabular-nums">
                    {previewData.validUntilFormatted}
                  </dd>
                </div>
                <div className="py-1.5 flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500 shrink-0">Статус</dt>
                  <dd
                    className={`font-semibold text-right ${
                      previewData.isFullyCompleted ? 'text-emerald-700' : 'text-teal-800'
                    }`}
                  >
                    {previewData.isFullyCompleted
                      ? 'Аттестация завершена (100%)'
                      : `По профилю (${previewData.percent}% этапов)`}
                  </dd>
                </div>
              </dl>

              {/* Footer Sign & Seal Indicator */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-3 text-[10px] text-slate-500">
                <span>Г. С. Саранча · Г. А. Гомилевская</span>
                <span className="font-mono tabular-nums text-teal-800 font-semibold">
                  М.П. · {previewData.verificationCode}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full A4 PDF Preview Modal */}
      {previewOpen && generated && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-cert-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h4
                  id="profile-cert-modal-title"
                  className="text-sm font-bold text-slate-900 truncate"
                >
                  Сертификат об аттестации · {generated.data.certificateNumber}
                </h4>
                <p className="text-xs text-slate-500 truncate">
                  {generated.data.holderName} · {generated.data.trackLabel} · Действует до{' '}
                  {generated.data.validUntilFormatted}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={generated.pdfBlobUrl}
                  download={generated.fileName}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Скачать PDF</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  aria-label="Закрыть предпросмотр сертификата"
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex justify-center">
              <img
                src={generated.previewDataUrl}
                alt={`PDF-сертификат об аттестации ${generated.data.holderName}`}
                className="max-w-full h-auto border border-slate-300 shadow-sm bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
