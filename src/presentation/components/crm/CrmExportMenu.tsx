import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileCode2, FileSpreadsheet, FileText } from 'lucide-react';
import { refineClient } from '../../../application/refine/client.ts';

interface CrmExportMenuProps {
  label?: string;
  buildUrl: (format: 'csv' | 'xlsx') => string;
  filePrefix: string;
  onClientExportPdf?: () => Promise<string | void> | string | void;
  onClientExportXlsx?: () => Promise<string | void> | string | void;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
}

export const CrmExportMenu: React.FC<CrmExportMenuProps> = ({
  label = 'Экспорт',
  buildUrl,
  filePrefix,
  onClientExportPdf,
  onClientExportXlsx,
  onNotify,
}) => {
  const [open, setOpen] = useState(false);
  const [busyFormat, setBusyFormat] = useState<'csv' | 'xlsx' | 'pdf' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const handleDownload = async (format: 'csv' | 'xlsx' | 'pdf') => {
    setBusyFormat(format);
    setOpen(false);
    try {
      if (format === 'pdf' && onClientExportPdf) {
        const fileName = await onClientExportPdf();
        onNotify(fileName ? `PDF отчёт «${fileName}» сформирован` : 'PDF отчёт сформирован и скачан');
      } else if (format === 'xlsx' && onClientExportXlsx) {
        const fileName = await onClientExportXlsx();
        onNotify(fileName ? `Excel отчёт «${fileName}» сформирован` : 'Excel отчёт сформирован и скачан');
      } else {
        const serverFormat = format === 'pdf' ? 'xlsx' : format;
        const dateStr = new Date().toISOString().slice(0, 10);
        await refineClient.downloadBlob(buildUrl(serverFormat), `${filePrefix}-${dateStr}.${serverFormat}`);
        onNotify(`Файл ${serverFormat.toUpperCase()} сформирован и скачан`);
      }
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка экспорта данных', 'err');
    } finally {
      setBusyFormat(null);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={busyFormat !== null}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5 text-slate-500" />
        <span>{busyFormat ? `Экспорт ${busyFormat.toUpperCase()}...` : label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          {onClientExportPdf && (
            <button
              type="button"
              onClick={() => void handleDownload('pdf')}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
            >
              <FileText className="h-4 w-4 text-red-600 shrink-0" />
              <div>
                <div className="font-medium text-slate-900">PDF отчёт (.pdf)</div>
                <div className="text-[11px] text-slate-500">Аналитика и таблица сделок</div>
              </div>
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleDownload('xlsx')}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
            <div>
              <div className="font-medium text-slate-900">Excel (.xlsx)</div>
              <div className="text-[11px] text-slate-500">
                {onClientExportXlsx ? 'Листы сделок и сводки по этапам' : 'Таблица с форматированием'}
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => void handleDownload('csv')}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
          >
            <FileCode2 className="h-4 w-4 text-[#0077FF] shrink-0" />
            <div>
              <div className="font-medium text-slate-900">CSV (UTF-8)</div>
              <div className="text-[11px] text-slate-500">Универсальный текстовый формат</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
