import React, { useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileJson,
  LogIn,
} from 'lucide-react';
import type { SessionUser } from '../utils/identityApi';
import type { UserAttestationSummary } from './AttestationProgressWidget';
import type { InquiryRecord } from './social/MyInquiriesSection';
import type { LinkedAccountDTO } from '../utils/linkedAccountsApi';
import type { PreparationContour } from '../utils/personalRoadmap';
import {
  buildQualificationCertificatesExportPayload,
  buildQualificationCertificatesFileName,
  buildQualificationCertificatesJsonString,
  downloadQualificationCertificatesJson,
  type JsonExportScope,
} from '../utils/qualificationCertificatesJsonExport';
import { tracker } from '../utils/tracker';

interface QualificationCertificatesJsonExportCardProps {
  user: SessionUser | null;
  summary?: UserAttestationSummary;
  inquiries?: InquiryRecord[];
  linkedAccounts?: LinkedAccountDTO[];
  selectedExamDate?: string;
  selectedContour?: PreparationContour;
  selfCheckRevision?: number;
  onFocusAuth?: () => void;
}

const SCOPE_OPTIONS: ReadonlyArray<{
  id: JsonExportScope;
  label: string;
  description: string;
}> = [
  {
    id: 'all',
    label: 'Полный пакет',
    description: 'Профиль, квалификация, стаж и все данные о сертификатах',
  },
  {
    id: 'qualification',
    label: 'Квалификация',
    description: 'Самопроверка по 4 доменам, подтверждённые компетенции и опыт',
  },
  {
    id: 'certificates',
    label: 'Сертификаты',
    description: 'Регистрационные номера, сроки действия, этапы и заявки',
  },
];

export const QualificationCertificatesJsonExportCard: React.FC<
  QualificationCertificatesJsonExportCardProps
> = ({
  user,
  summary,
  inquiries = [],
  linkedAccounts = [],
  selectedExamDate,
  selectedContour = 'contour_b',
  selfCheckRevision = 0,
  onFocusAuth,
}) => {
  const [scope, setScope] = useState<JsonExportScope>('all');
  const [pretty, setPretty] = useState<boolean>(true);
  const [previewExpanded, setPreviewExpanded] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const payload = useMemo(() => {
    if (!user || !summary) return null;
    return buildQualificationCertificatesExportPayload({
      user,
      summary,
      inquiries,
      linkedAccounts,
      selectedExamDate,
      selectedContour,
    });
  }, [
    user,
    summary,
    inquiries,
    linkedAccounts,
    selectedExamDate,
    selectedContour,
    selfCheckRevision,
  ]);

  const jsonString = useMemo(() => {
    if (!payload) return '';
    return buildQualificationCertificatesJsonString(payload, scope, { pretty });
  }, [payload, scope, pretty]);

  const suggestedFileName = useMemo(() => {
    if (!payload) return '';
    return buildQualificationCertificatesFileName(payload, scope);
  }, [payload, scope]);

  if (!user || !summary || !payload) {
    return (
      <section
        id="account-json-export"
        aria-labelledby="account-json-export-guest-heading"
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 scroll-mt-24"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
              <FileJson className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Интеграция с внешними системами · JSON-выгрузка</span>
            </p>
            <h3
              id="account-json-export-guest-heading"
              className="text-lg sm:text-xl font-bold text-slate-900"
            >
              Экспорт квалификации и сертификатов в JSON
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              После авторизации вы сможете выгрузить структурированный JSON-пакет (схема{' '}
              <code className="font-mono text-slate-800">
                rca-vostok.qualification-certificates.v1
              </code>
              ) для передачи во внешние системы туроператоров, МКК, ФСТР и корпоративные LMS.
            </p>
          </div>
          {onFocusAuth && (
            <button
              type="button"
              onClick={onFocusAuth}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 self-start md:self-auto cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <LogIn className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
              <span>Войти для экспорта JSON</span>
            </button>
          )}
        </div>
      </section>
    );
  }

  const byteSize = new TextEncoder().encode(jsonString).length;
  const formattedSize =
    byteSize >= 1024 ? `${(byteSize / 1024).toFixed(1)} КБ` : `${byteSize} Б`;
  const lineCount = pretty ? jsonString.split('\n').length : 1;

  const handleDownloadJson = () => {
    setErrorMessage(null);
    try {
      const res = downloadQualificationCertificatesJson(payload, scope, { pretty });
      setStatusMessage(`Файл выгружен: ${res.fileName} (${formattedSize})`);
      tracker.trackCustomInteraction(
        'Экспорт квалификации и сертификатов (JSON)',
        `${scope} · ${formattedSize}`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Не удалось сформировать JSON-файл.'
      );
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
      tracker.trackCustomInteraction('Копирование JSON квалификации и сертификатов', scope);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Не удалось скопировать JSON. Воспользуйтесь скачиванием файла.'
      );
    }
  };

  const activeScopeMeta =
    SCOPE_OPTIONS.find((item) => item.id === scope) ?? SCOPE_OPTIONS[0];

  return (
    <section
      id="account-json-export"
      aria-labelledby="account-json-export-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 scroll-mt-24"
    >
      {/* Header & Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-teal-800 font-medium">
            <FileJson className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Машиночитаемая выгрузка</span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <code className="font-mono text-slate-600">{payload.schemaVersion}</code>
          </div>
          <h3
            id="account-json-export-heading"
            className="text-lg sm:text-xl font-bold text-slate-900 text-balance"
          >
            Экспорт данных квалификации и сертификатов (JSON)
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Единый структурированный JSON-документ для интеграции с внешними системами
            туроператоров, МКК, ФСТР и корпоративных LMS без передачи приватных ключей.
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
            onClick={handleDownloadJson}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Скачать .json</span>
          </button>
        </div>
      </div>

      {/* Scope Tabs + Formatting Control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div
            role="tablist"
            aria-label="Состав экспортируемых данных JSON"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {SCOPE_OPTIONS.map((option) => {
              const active = scope === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setScope(option.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500">{activeScopeMeta.description}</p>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer select-none self-start md:self-center">
          <input
            type="checkbox"
            checked={pretty}
            onChange={(e) => setPretty(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
          />
          <span>Форматированный JSON (отступы 2 пробела)</span>
        </label>
      </div>

      {/* 4-column Tabular Metrics */}
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-4 border-y border-slate-200">
        <div className="space-y-1">
          <dt className="text-xs text-slate-500">Готовность квалификации</dt>
          <dd className="text-sm font-semibold font-mono text-slate-900 tabular-nums">
            {payload.qualification.selfCheck.readinessPercent}% ({payload.qualification.selfCheck.answeredCount}/
            {payload.qualification.selfCheck.totalQuestions})
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs text-slate-500">Компетенции и стаж</dt>
          <dd className="text-sm font-semibold font-mono text-slate-900 tabular-nums">
            {payload.qualification.competencies.length} навыков ·{' '}
            {payload.qualification.experience.yearsOfExperience} лет
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs text-slate-500">Сертификат и этапы</dt>
          <dd className="text-sm font-semibold font-mono text-teal-800 tabular-nums truncate">
            {payload.certificates.profileAttestationCertificate.certificateNumber}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs text-slate-500">Объём пакета</dt>
          <dd className="text-sm font-semibold font-mono text-slate-900 tabular-nums">
            {formattedSize} · {lineCount} стр.
          </dd>
        </div>
      </dl>

      {/* Alerts */}
      {errorMessage && (
        <p
          role="alert"
          className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5"
        >
          {errorMessage}
        </p>
      )}

      {statusMessage && (
        <p className="text-xs text-teal-900 bg-teal-50/80 border border-teal-200 rounded-lg px-3.5 py-2.5">
          {statusMessage}
        </p>
      )}

      {/* Live JSON Code Viewer */}
      <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-950 text-slate-100">
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-mono text-teal-300 truncate">
            <Code2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{suggestedFileName}</span>
          </span>
          <button
            type="button"
            onClick={() => setPreviewExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white font-medium whitespace-nowrap shrink-0 cursor-pointer"
          >
            {previewExpanded ? (
              <>
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Свернуть код</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Развернуть предпросмотр</span>
              </>
            )}
          </button>
        </div>
        <pre
          className={`p-4 font-mono text-[11px] leading-relaxed overflow-x-auto text-slate-200 ${
            previewExpanded ? 'max-h-[540px]' : 'max-h-[220px]'
          } overflow-y-auto`}
        >
          {jsonString}
        </pre>
      </div>
    </section>
  );
};
