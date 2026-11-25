import React, { useState } from 'react';
import {
  Bold,
  Download,
  FileText,
  Heading1,
  List,
  MessageSquareQuote,
  Plus,
  Presentation,
  Sheet,
  Trash2,
} from 'lucide-react';
import { refineClient } from '../../application/refine/client.ts';
import {
  colIndexToLetter,
  coordsToKey,
  evaluateSheetCell,
  type UniverContent,
  type UniverSheetCell,
} from '../../domain/office/entities.ts';
import { sanitizeCsvCell } from '../../shared/formatters.ts';

interface UniverEditorCanvasProps {
  content: UniverContent;
  canWrite: boolean;
  docTitle?: string;
  onChange: (next: UniverContent) => void;
}

export const UniverEditorCanvas: React.FC<UniverEditorCanvasProps> = ({
  content,
  canWrite,
  docTitle = 'spreadsheet',
  onChange,
}) => {
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [selectedCellKey, setSelectedCellKey] = useState('0:0');
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);

  if (content.type === 'xlsx') {
    const safeIdx = Math.min(activeSheetIdx, Math.max(0, content.sheets.length - 1));
    const sheet = content.sheets[safeIdx];
    const selectedCell: UniverSheetCell = sheet.cells[selectedCellKey] || { value: '' };

    const [selR, selC] = selectedCellKey.split(':').map(Number);
    const selectedRef = `${colIndexToLetter(selC || 0)}${(selR || 0) + 1}`;

    const updateCellInput = (key: string, rawInput: string) => {
      if (!canWrite) return;
      const prevCell = sheet.cells[key] || { value: '' };
      const isFormula = rawInput.trim().startsWith('=');
      let nextCell: UniverSheetCell;
      if (isFormula) {
        nextCell = { ...prevCell, formula: rawInput.trim(), value: rawInput.trim() };
      } else {
        const trimmed = rawInput.trim();
        const asNumber = trimmed !== '' && /^-?\d+(?:\.\d+)?$/.test(trimmed) ? Number(trimmed) : null;
        nextCell = {
          ...prevCell,
          formula: undefined,
          value: asNumber !== null ? asNumber : rawInput,
        };
      }

      const nextSheets = content.sheets.map((s, idx) =>
        idx === safeIdx ? { ...s, cells: { ...s.cells, [key]: nextCell } } : s
      );
      onChange({ type: 'xlsx', sheets: nextSheets });
    };

    const toggleCellBold = () => {
      if (!canWrite) return;
      const prevCell = sheet.cells[selectedCellKey] || { value: '' };
      const nextSheets = content.sheets.map((s, idx) =>
        idx === safeIdx
          ? {
              ...s,
              cells: {
                ...s.cells,
                [selectedCellKey]: { ...prevCell, bold: !prevCell.bold },
              },
            }
          : s
      );
      onChange({ type: 'xlsx', sheets: nextSheets });
    };

    const addRowOrCol = (dimension: 'row' | 'col') => {
      if (!canWrite) return;
      const nextSheets = content.sheets.map((s, idx) =>
        idx === safeIdx
          ? {
              ...s,
              rows: dimension === 'row' ? Math.min(60, s.rows + 1) : s.rows,
              cols: dimension === 'col' ? Math.min(20, s.cols + 1) : s.cols,
            }
          : s
      );
      onChange({ type: 'xlsx', sheets: nextSheets });
    };

    const addSheet = () => {
      if (!canWrite) return;
      const nextNum = content.sheets.length + 1;
      onChange({
        type: 'xlsx',
        sheets: [
          ...content.sheets,
          {
            id: `sheet_${Date.now()}`,
            name: `Лист ${nextNum}`,
            rows: 12,
            cols: 6,
            cells: {},
          },
        ],
      });
      setActiveSheetIdx(content.sheets.length);
    };

    const removeSheet = (idxToRemove: number) => {
      if (!canWrite || content.sheets.length <= 1) return;
      const next = content.sheets.filter((_, idx) => idx !== idxToRemove);
      onChange({ type: 'xlsx', sheets: next });
      setActiveSheetIdx(Math.max(0, Math.min(safeIdx, next.length - 1)));
    };

    const handleExportCsv = () => {
      const lines: string[] = [];
      for (let r = 0; r < sheet.rows; r++) {
        const rowCells: string[] = [];
        let hasAny = false;
        for (let c = 0; c < sheet.cols; c++) {
          const key = coordsToKey(r, c);
          const cell = sheet.cells[key];
          const val = cell
            ? cell.formula?.startsWith('=')
              ? evaluateSheetCell(key, sheet.cells)
              : cell.value
            : '';
          const strVal = String(val ?? '');
          if (strVal !== '') hasAny = true;
          rowCells.push(sanitizeCsvCell(strVal));
        }
        if (hasAny || r === 0) lines.push(rowCells.join(','));
      }
      refineClient.downloadText(
        '\uFEFF' + lines.join('\n'),
        `${docTitle}-${sheet.name}.csv`,
        'text/csv;charset=utf-8;'
      );
    };

    return (
      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
        {/* Univer Sheets Toolbar & Formula Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <Sheet className="h-4 w-4" />
              Univer Sheets (.xlsx)
            </span>
            <button
              type="button"
              disabled={!canWrite}
              onClick={toggleCellBold}
              title="Полужирный"
              className={`rounded border px-2 py-1 text-xs transition-colors ${
                selectedCell.bold
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={!canWrite}
              onClick={() => addRowOrCol('row')}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              + Строка
            </button>
            <button
              type="button"
              disabled={!canWrite}
              onClick={() => addRowOrCol('col')}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              + Столбец
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              <Download className="h-3 w-3" /> CSV
            </button>
          </div>
          <span className="text-[11px] text-slate-500">
            Формулы: <span className="font-mono">=SUM(D2:D3)</span>,{' '}
            <span className="font-mono">=AVERAGE(...)</span>, <span className="font-mono">=B2*C2</span>
          </span>
        </div>

        {/* Formula Input Bar */}
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-1.5">
          <span className="w-12 rounded bg-slate-100 px-2 py-1 text-center font-mono text-xs font-semibold text-slate-700">
            {selectedRef}
          </span>
          <span className="font-serif text-xs italic font-semibold text-slate-400">fx</span>
          <input
            type="text"
            disabled={!canWrite}
            value={selectedCell.formula ?? String(selectedCell.value ?? '')}
            onChange={(e) => updateCellInput(selectedCellKey, e.target.value)}
            placeholder="Введите значение или формулу (например =SUM(D2:D3))..."
            className="flex-1 bg-transparent font-mono text-xs text-slate-900 outline-none"
          />
        </div>

        {/* Spreadsheet Grid */}
        <div className="max-h-[430px] overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100 text-slate-500">
              <tr>
                <th className="w-10 border-b border-r border-slate-200 bg-slate-100 py-1.5 text-center font-mono text-[11px]">
                  #
                </th>
                {Array.from({ length: sheet.cols }).map((_, c) => (
                  <th
                    key={c}
                    className="min-w-[120px] border-b border-r border-slate-200 py-1.5 text-center font-mono text-[11px] font-medium"
                  >
                    {colIndexToLetter(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: sheet.rows }).map((_, r) => (
                <tr key={r}>
                  <td className="border-b border-r border-slate-200 bg-slate-50 py-1 text-center font-mono text-[11px] text-slate-500 tabular-nums">
                    {r + 1}
                  </td>
                  {Array.from({ length: sheet.cols }).map((__, c) => {
                    const key = coordsToKey(r, c);
                    const cell = sheet.cells[key];
                    const isSelected = selectedCellKey === key;
                    const displayVal = cell
                      ? cell.formula?.startsWith('=')
                        ? evaluateSheetCell(key, sheet.cells)
                        : cell.value
                      : '';
                    const isNumeric = typeof displayVal === 'number';
                    return (
                      <td
                        key={key}
                        onClick={() => setSelectedCellKey(key)}
                        className={`border-b border-r border-slate-200 p-0 ${
                          isSelected ? 'ring-2 ring-inset ring-[#0077FF] bg-blue-50/30' : 'bg-white'
                        }`}
                      >
                        <input
                          type="text"
                          disabled={!canWrite}
                          value={
                            isSelected
                              ? cell?.formula ?? String(cell?.value ?? '')
                              : isNumeric
                              ? (displayVal as number).toLocaleString('ru-RU')
                              : String(displayVal ?? '')
                          }
                          onFocus={() => setSelectedCellKey(key)}
                          onChange={(e) => updateCellInput(key, e.target.value)}
                          className={`w-full bg-transparent px-2 py-1.5 text-xs outline-none ${
                            cell?.bold ? 'font-semibold text-slate-900' : 'text-slate-800'
                          } ${isNumeric && !isSelected ? 'text-right tabular-nums' : 'text-left'}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sheet Tabs Footer */}
        <div className="flex flex-wrap items-center gap-1 border-t border-slate-200 bg-slate-50 px-3 py-1.5">
          {content.sheets.map((s, idx) => (
            <div key={s.id} className="inline-flex items-center">
              <button
                type="button"
                onClick={() => {
                  setActiveSheetIdx(idx);
                  setSelectedCellKey('0:0');
                }}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  idx === safeIdx
                    ? 'border border-slate-200 bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                {s.name}
              </button>
              {canWrite && content.sheets.length > 1 && idx === safeIdx && (
                <button
                  type="button"
                  onClick={() => removeSheet(idx)}
                  aria-label="Удалить лист"
                  className="ml-0.5 rounded p-1 text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {canWrite && (
            <button
              type="button"
              onClick={addSheet}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#0077FF] hover:bg-blue-50 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Лист
            </button>
          )}
        </div>
      </div>
    );
  }

  if (content.type === 'docx') {
    const addBlock = (kind: 'heading' | 'paragraph' | 'bullet' | 'callout') => {
      if (!canWrite) return;
      const defaultText =
        kind === 'heading'
          ? 'Новый раздел документа'
          : kind === 'bullet'
          ? 'Пункт спецификации'
          : kind === 'callout'
          ? 'Важное примечание по условиям SLA'
          : 'Новый абзац текста...';
      onChange({
        ...content,
        blocks: [...content.blocks, { id: `blk_${Date.now()}`, kind, text: defaultText }],
      });
    };

    const updateBlock = (id: string, text: string) => {
      if (!canWrite) return;
      onChange({
        ...content,
        blocks: content.blocks.map((b) => (b.id === id ? { ...b, text } : b)),
      });
    };

    const removeBlock = (id: string) => {
      if (!canWrite || content.blocks.length <= 1) return;
      onChange({
        ...content,
        blocks: content.blocks.filter((b) => b.id !== id),
      });
    };

    return (
      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-[#F4F6F9]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
            <FileText className="h-4 w-4" />
            Univer Docs (.docx)
          </span>
          {canWrite && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => addBlock('heading')}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <Heading1 className="h-3.5 w-3.5" /> Заголовок
              </button>
              <button
                type="button"
                onClick={() => addBlock('paragraph')}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" /> Абзац
              </button>
              <button
                type="button"
                onClick={() => addBlock('bullet')}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <List className="h-3.5 w-3.5" /> Пункт списка
              </button>
              <button
                type="button"
                onClick={() => addBlock('callout')}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <MessageSquareQuote className="h-3.5 w-3.5" /> Выноска
              </button>
            </div>
          )}
        </div>

        <div className="max-h-[470px] overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl space-y-3 rounded-lg border border-slate-200 bg-white p-7">
            <input
              type="text"
              disabled={!canWrite}
              value={content.subtitle}
              onChange={(e) => onChange({ ...content, subtitle: e.target.value })}
              placeholder="Подзаголовок / реквизиты документа..."
              className="w-full border-b border-slate-100 pb-2 text-xs text-slate-500 outline-none focus:border-blue-300"
            />

            {content.blocks.map((blk) => (
              <div key={blk.id} className="group flex items-start gap-2">
                {blk.kind === 'bullet' && (
                  <span className="mt-2 text-sm font-bold text-[#0077FF]">•</span>
                )}
                <div className="flex-1">
                  {blk.kind === 'heading' ? (
                    <input
                      type="text"
                      disabled={!canWrite}
                      value={blk.text}
                      onChange={(e) => updateBlock(blk.id, e.target.value)}
                      className="w-full rounded px-1 py-0.5 text-lg font-semibold text-slate-900 outline-none focus:bg-slate-50"
                    />
                  ) : (
                    <textarea
                      rows={blk.kind === 'paragraph' ? 3 : 2}
                      disabled={!canWrite}
                      value={blk.text}
                      onChange={(e) => updateBlock(blk.id, e.target.value)}
                      className={`w-full resize-y rounded px-2.5 py-1.5 text-sm leading-relaxed outline-none ${
                        blk.kind === 'callout'
                          ? 'border border-blue-200 bg-blue-50/45 text-slate-800'
                          : 'text-slate-700 focus:bg-slate-50'
                      }`}
                    />
                  )}
                </div>
                {canWrite && content.blocks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBlock(blk.id)}
                    className="rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                    title="Удалить блок"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Univer Slides (.pptx)
  const safeSlideIdx = Math.min(activeSlideIdx, Math.max(0, content.slides.length - 1));
  const slide = content.slides[safeSlideIdx];

  const updateSlide = (patch: Partial<typeof slide>) => {
    if (!canWrite) return;
    onChange({
      type: 'pptx',
      slides: content.slides.map((s, idx) => (idx === safeSlideIdx ? { ...s, ...patch } : s)),
    });
  };

  const addSlide = () => {
    if (!canWrite) return;
    onChange({
      type: 'pptx',
      slides: [
        ...content.slides,
        {
          id: `slide_${Date.now()}`,
          title: `Слайд ${content.slides.length + 1}`,
          subtitle: 'Ключевые тезисы',
          bullets: ['Первый тезис презентации', 'Интеграция с Forgejo и Garage S3'],
          notes: '',
          accentColor: '#0077FF',
        },
      ],
    });
    setActiveSlideIdx(content.slides.length);
  };

  const deleteSlide = (idxToRemove: number) => {
    if (!canWrite || content.slides.length <= 1) return;
    const next = content.slides.filter((_, i) => i !== idxToRemove);
    onChange({ type: 'pptx', slides: next });
    setActiveSlideIdx(Math.max(0, Math.min(safeSlideIdx, next.length - 1)));
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-[#F4F6F9]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
          <Presentation className="h-4 w-4" />
          Univer Slides (.pptx)
        </span>
        {canWrite && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addSlide}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" /> Слайд
            </button>
            {content.slides.length > 1 && (
              <button
                type="button"
                onClick={() => deleteSlide(safeSlideIdx)}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 whitespace-nowrap"
              >
                <Trash2 className="h-3.5 w-3.5" /> Удалить слайд
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-12">
        <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1 lg:col-span-3">
          {content.slides.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSlideIdx(idx)}
              className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                idx === safeSlideIdx
                  ? 'border-[#0077FF] bg-white shadow-xs'
                  : 'border-slate-200 bg-white/70 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-slate-400 tabular-nums">
                <span>Слайд {idx + 1}</span>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: s.accentColor || '#0077FF' }}
                />
              </div>
              <div className="mt-1 truncate text-xs font-semibold text-slate-900">{s.title}</div>
            </button>
          ))}
        </div>

        <div className="space-y-3 lg:col-span-9">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="h-1.5 w-full" style={{ backgroundColor: slide.accentColor || '#0077FF' }} />
            <div className="space-y-4 p-6">
              <div>
                <input
                  type="text"
                  disabled={!canWrite}
                  value={slide.title}
                  onChange={(e) => updateSlide({ title: e.target.value })}
                  className="w-full rounded px-1 text-xl font-bold text-slate-900 outline-none focus:bg-slate-50"
                  placeholder="Заголовок слайда..."
                />
                <input
                  type="text"
                  disabled={!canWrite}
                  value={slide.subtitle}
                  onChange={(e) => updateSlide({ subtitle: e.target.value })}
                  className="mt-1 w-full rounded px-1 text-xs text-slate-500 outline-none focus:bg-slate-50"
                  placeholder="Подзаголовок..."
                />
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3">
                {slide.bullets.map((b, bIdx) => (
                  <div key={bIdx} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0077FF]" />
                    <input
                      type="text"
                      disabled={!canWrite}
                      value={b}
                      onChange={(e) => {
                        const nextBullets = slide.bullets.map((item, i) =>
                          i === bIdx ? e.target.value : item
                        );
                        updateSlide({ bullets: nextBullets });
                      }}
                      className="flex-1 rounded px-2 py-1 text-sm text-slate-800 outline-none focus:bg-slate-50"
                    />
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() =>
                          updateSlide({ bullets: slide.bullets.filter((_, i) => i !== bIdx) })
                        }
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => updateSlide({ bullets: [...slide.bullets, 'Новый тезис'] })}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#0077FF] hover:text-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Добавить пункт
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <label className="block text-[11px] font-medium text-slate-500">Заметки спикера</label>
            <textarea
              rows={2}
              disabled={!canWrite}
              value={slide.notes}
              onChange={(e) => updateSlide({ notes: e.target.value })}
              placeholder="Комментарии к слайду для выступления..."
              className="mt-1 w-full resize-none text-xs text-slate-700 outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
