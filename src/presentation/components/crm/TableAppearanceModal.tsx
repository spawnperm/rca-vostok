import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, RotateCcw, Search } from 'lucide-react';
import {
  CRM_FIELD_TYPE_LABELS,
  type CrmEntityTableSchema,
  type CrmTableViewConfig,
} from '../../../domain/crm/tableSchema.ts';
import { Modal } from '../ui/Modal.tsx';

interface TableAppearanceModalProps {
  open: boolean;
  onClose: () => void;
  schema: CrmEntityTableSchema;
  entityLabel: string;
  onSave: (viewConfig: CrmTableViewConfig) => Promise<void>;
  onReset: () => Promise<void>;
}

export const TableAppearanceModal: React.FC<TableAppearanceModalProps> = ({
  open,
  onClose,
  schema,
  entityLabel,
  onSave,
  onReset,
}) => {
  const [draft, setDraft] = useState<CrmTableViewConfig>(schema.viewConfig);
  const [filterText, setFilterText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(schema.viewConfig);
      setFilterText('');
    }
  }, [open, schema]);

  const fieldMap = useMemo(
    () => new Map(schema.fields.map((f) => [f.key, f])),
    [schema.fields]
  );

  const sectionMap = useMemo(
    () => new Map(schema.sections.map((s) => [s.id, s.title])),
    [schema.sections]
  );

  const orderedKeys = useMemo(() => {
    const keys = [...draft.columnOrder];
    for (const f of schema.fields) {
      if (!keys.includes(f.key)) keys.push(f.key);
    }
    return keys.filter((k) => fieldMap.has(k));
  }, [draft.columnOrder, schema.fields, fieldMap]);

  const filteredKeys = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return orderedKeys;
    return orderedKeys.filter((k) => {
      const f = fieldMap.get(k);
      if (!f) return false;
      const sec = sectionMap.get(f.sectionId) || '';
      return f.label.toLowerCase().includes(q) || sec.toLowerCase().includes(q);
    });
  }, [orderedKeys, filterText, fieldMap, sectionMap]);

  const toggleColumn = (key: string) => {
    setDraft((prev) => {
      const exists = prev.visibleColumns.includes(key);
      if (exists && prev.visibleColumns.length <= 1) {
        return prev;
      }
      const visibleColumns = exists
        ? prev.visibleColumns.filter((k) => k !== key)
        : [...prev.visibleColumns, key];
      return { ...prev, visibleColumns };
    });
  };

  const moveColumn = (key: string, direction: -1 | 1) => {
    setDraft((prev) => {
      const list = [...orderedKeys];
      const idx = list.indexOf(key);
      const targetIdx = idx + direction;
      if (idx === -1 || targetIdx < 0 || targetIdx >= list.length) return prev;
      const [item] = list.splice(idx, 1);
      list.splice(targetIdx, 0, item);
      return { ...prev, columnOrder: list };
    });
  };

  const handleSelectAll = () => {
    setDraft((prev) => ({
      ...prev,
      visibleColumns: [...orderedKeys],
    }));
  };

  const handleSaveClick = async () => {
    setSaving(true);
    try {
      const orderedVisible = orderedKeys.filter((k) => draft.visibleColumns.includes(k));
      await onSave({
        ...draft,
        columnOrder: orderedKeys,
        visibleColumns: orderedVisible.length > 0 ? orderedVisible : [orderedKeys[0]],
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleResetClick = async () => {
    setSaving(true);
    try {
      await onReset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Настройка таблицы — ${entityLabel}`}
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Visual Density & Display Options */}
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-slate-800">Плотность строк таблицы</div>
            <div className="mt-2 flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
              {(
                [
                  ['compact', 'Компактный'],
                  ['normal', 'Стандартный'],
                  ['comfortable', 'Просторный'],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setDraft((p) => ({ ...p, density: val }))}
                  className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    draft.density === val
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-700">
            <div className="font-semibold text-slate-800">Параметры отображения</div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={draft.showBorders}
                onChange={(e) => setDraft((p) => ({ ...p, showBorders: e.target.checked }))}
                className="h-3.5 w-3.5 accent-[#0077FF]"
              />
              <span>Показывать вертикальные разделители колонок</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={draft.showSubtitles}
                onChange={(e) => setDraft((p) => ({ ...p, showSubtitles: e.target.checked }))}
                className="h-3.5 w-3.5 accent-[#0077FF]"
              />
              <span>Показывать подпись под названием (должность / отрасль)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={draft.wrapText}
                onChange={(e) => setDraft((p) => ({ ...p, wrapText: e.target.checked }))}
                className="h-3.5 w-3.5 accent-[#0077FF]"
              />
              <span>Переносить длинные значения ячеек</span>
            </label>
          </div>
        </div>

        {/* Columns Visibility & Ordering */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-semibold text-slate-900">
                Колонки и порядок отображения ({draft.visibleColumns.length} из {orderedKeys.length})
              </h4>
              <p className="text-[11px] text-slate-500">
                Отметьте нужные поля из разделов и задайте их порядок слева направо
              </p>
            </div>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-medium text-[#0077FF] hover:underline whitespace-nowrap"
            >
              Выбрать все колонки
            </button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Поиск поля по названию или разделу..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#0077FF] focus:bg-white"
            />
          </div>

          <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            {filteredKeys.map((key) => {
              const field = fieldMap.get(key);
              if (!field) return null;
              const isVisible = draft.visibleColumns.includes(key);
              const fullIdx = orderedKeys.indexOf(key);
              const sectionName = sectionMap.get(field.sectionId) || 'Основное';

              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs hover:bg-slate-50"
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => toggleColumn(key)}
                      className="h-4 w-4 shrink-0 accent-[#0077FF]"
                    />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">{field.label}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span>{sectionName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{CRM_FIELD_TYPE_LABELS[field.type]}</span>
                      </div>
                    </div>
                  </label>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={fullIdx <= 0}
                      onClick={() => moveColumn(key, -1)}
                      title="Переместить выше (левее в таблице)"
                      className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={fullIdx >= orderedKeys.length - 1}
                      onClick={() => moveColumn(key, 1)}
                      title="Переместить ниже (правее в таблице)"
                      className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleResetClick()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Сбросить вид
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveClick()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              Применить вид
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
