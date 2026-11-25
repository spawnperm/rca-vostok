import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import { refineClient } from '../../../application/refine/client.ts';
import { Modal } from '../ui/Modal.tsx';

export interface ImportTargetFieldOption {
  key: string;
  label: string;
  required: boolean;
  isCustom: boolean;
  type: string;
}

interface PreviewData {
  dryRun: true;
  format: 'csv' | 'xlsx';
  headers: string[];
  totalRows: number;
  previewRows: Record<string, string>[];
  availableFields: ImportTargetFieldOption[];
  suggestedMapping: Record<string, string>;
}

interface CommitData {
  dryRun: false;
  format: 'csv' | 'xlsx';
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  errors: Array<{ row: number; reason: string }>;
}

interface CrmImportModalProps {
  open: boolean;
  onClose: () => void;
  mode: 'contacts' | 'companies' | 'deals';
  pipelineId?: string;
  pipelineName?: string;
  onImported: () => Promise<void> | void;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',').slice(1).join(',') : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать выбранный файл'));
    reader.readAsDataURL(file);
  });
}

export const CrmImportModal: React.FC<CrmImportModalProps> = ({
  open,
  onClose,
  mode,
  pipelineId,
  pipelineName,
  onImported,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [contentBase64, setContentBase64] = useState('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CommitData | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const resetState = () => {
    setFileName('');
    setContentBase64('');
    setPreview(null);
    setMapping({});
    setResult(null);
    setErrorMsg('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const endpoint = mode === 'deals' ? '/api/crm/deals/import' : '/api/crm/contacts/import';

  const buildTemplateUrl = (format: 'csv' | 'xlsx') => {
    if (mode === 'deals') {
      return `/api/crm/deals/export?format=${format}&template=1`;
    }
    return `/api/crm/contacts/export?format=${format}&entity=${mode}&template=1`;
  };

  const handleDownloadTemplate = async (format: 'csv' | 'xlsx') => {
    try {
      await refineClient.downloadBlob(buildTemplateUrl(format), `${mode}-template.${format}`);
      onNotify(`Шаблон ${format.toUpperCase()} скачан`);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Не удалось скачать шаблон', 'err');
    }
  };

  const handleFilePicked = async (file: File | null) => {
    if (!file) return;
    setErrorMsg('');
    setResult(null);
    setPreview(null);

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Максимальный размер файла для импорта — 5 МБ');
      return;
    }

    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx')) {
      setErrorMsg('Поддерживаются только файлы .csv и .xlsx');
      return;
    }

    setParsing(true);
    try {
      const base64 = await fileToBase64(file);
      const body =
        mode === 'deals'
          ? {
              pipelineId: pipelineId || '',
              fileName: file.name,
              contentBase64: base64,
              dryRun: true,
            }
          : {
              entityType: mode,
              fileName: file.name,
              contentBase64: base64,
              dryRun: true,
            };

      const res = await refineClient.request<PreviewData>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      setFileName(file.name);
      setContentBase64(base64);
      setPreview(res);
      setMapping(res.suggestedMapping || {});
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка разбора файла');
    } finally {
      setParsing(false);
    }
  };

  const handleCommitImport = async () => {
    if (!preview || !contentBase64) return;

    const requiredTargets = preview.availableFields.filter((f) => f.required);
    const mappedTargets = new Set(Object.values(mapping).filter((v) => v && v !== '__skip__'));
    const missingReq = requiredTargets.find((req) => !mappedTargets.has(req.key));
    if (missingReq) {
      setErrorMsg(`Укажите колонку для обязательного поля «${missingReq.label}»`);
      return;
    }

    setErrorMsg('');
    setImporting(true);
    try {
      const body =
        mode === 'deals'
          ? {
              pipelineId: pipelineId || '',
              fileName,
              contentBase64,
              dryRun: false,
              mapping,
            }
          : {
              entityType: mode,
              fileName,
              contentBase64,
              dryRun: false,
              mapping,
            };

      const res = await refineClient.request<CommitData>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      setResult(res);
      await onImported();
      onNotify(
        `Импорт завершён: добавлено ${res.importedCount} из ${res.totalRows}`,
        res.importedCount > 0 ? 'ok' : 'err'
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка импорта данных');
    } finally {
      setImporting(false);
    }
  };

  const titleLabel =
    mode === 'deals'
      ? `Импорт сделок${pipelineName ? ` в воронку «${pipelineName}»` : ''}`
      : mode === 'companies'
        ? 'Импорт компаний из CSV / Excel'
        : 'Импорт контактов из CSV / Excel';

  return (
    <Modal open={open} onClose={handleClose} title={titleLabel} maxWidthClass="max-w-4xl">
      <div className="space-y-4">
        {/* Step 1: File Picker & Templates */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#0077FF]">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900">
                {fileName || 'Выберите файл Excel (.xlsx) или CSV'}
              </div>
              <div className="text-xs text-slate-500">
                До 5 000 строк за импорт · поддержка разделителей «,» и «;» (Excel RU)
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleDownloadTemplate('xlsx')}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              Шаблон .xlsx
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadTemplate('csv')}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5 text-[#0077FF]" />
              Шаблон .csv
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#0077FF] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap">
              <Upload className="h-3.5 w-3.5" />
              <span>{parsing ? 'Разбор...' : preview ? 'Другой файл' : 'Выбрать файл'}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(e) => void handleFilePicked(e.target.files?.[0] || null)}
              />
            </label>
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 2: Column Mapping + Preview */}
        {preview && !result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>
                Формат: <strong className="uppercase text-slate-900">{preview.format}</strong> ·
                Найдено строк:{' '}
                <strong className="font-mono text-slate-900 tabular-nums">
                  {preview.totalRows}
                </strong>
              </span>
              <span className="text-slate-500">Сопоставьте столбцы файла с полями CRM</span>
            </div>

            <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Колонка в файле</th>
                    <th className="px-3 py-2 font-medium">Пример значения</th>
                    <th className="px-3 py-2 font-medium">Поле CRM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {preview.headers.map((header) => {
                    const sampleVal = preview.previewRows[0]?.[header] || '—';
                    return (
                      <tr key={header}>
                        <td className="px-3 py-2 font-medium text-slate-800">{header}</td>
                        <td className="max-w-[220px] truncate px-3 py-2 text-slate-500">
                          {sampleVal}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            aria-label={`Поле CRM для ${header}`}
                            value={mapping[header] || '__skip__'}
                            onChange={(e) =>
                              setMapping((prev) => ({
                                ...prev,
                                [header]: e.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-[#0077FF]"
                          >
                            <option value="__skip__">— Пропустить столбец —</option>
                            {preview.availableFields.map((field) => (
                              <option key={field.key} value={field.key}>
                                {field.label}
                                {field.required ? ' *' : ''}
                                {field.isCustom ? ' (доп. поле)' : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {preview.previewRows.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-slate-700">
                  Предпросмотр первых строк ({preview.previewRows.length})
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-[11px]">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <tr>
                        {preview.headers.map((h) => (
                          <th key={h} className="whitespace-nowrap px-2.5 py-1.5 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {preview.previewRows.map((row, idx) => (
                        <tr key={idx}>
                          {preview.headers.map((h) => (
                            <td
                              key={h}
                              className="max-w-[180px] truncate whitespace-nowrap px-2.5 py-1.5 text-slate-700"
                            >
                              {row[h] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={importing || preview.totalRows === 0}
                onClick={() => void handleCommitImport()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                {importing ? 'Импортируем...' : `Импортировать (${preview.totalRows})`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Import Summary */}
        {result && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Результат импорта файла «{fileName}»</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-[11px] text-slate-500">Всего строк</div>
                <div className="mt-0.5 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                  {result.totalRows}
                </div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                <div className="text-[11px] text-emerald-700">Импортировано</div>
                <div className="mt-0.5 font-mono text-lg font-semibold text-emerald-800 tabular-nums">
                  {result.importedCount}
                </div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <div className="text-[11px] text-amber-800">Пропущено с ошибкой</div>
                <div className="mt-0.5 font-mono text-lg font-semibold text-amber-900 tabular-nums">
                  {result.skippedCount}
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="max-h-36 overflow-y-auto rounded-lg border border-amber-200 bg-white p-2.5 text-xs text-slate-700">
                {result.errors.map((err, idx) => (
                  <div key={idx} className="py-0.5">
                    <span className="font-mono font-medium text-amber-800">Строка {err.row}:</span>{' '}
                    {err.reason}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={resetState}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Загрузить ещё файл
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg bg-[#0077FF] px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                Готово
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
