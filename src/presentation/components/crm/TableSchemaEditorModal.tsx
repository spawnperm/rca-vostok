import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Edit3,
  FolderPlus,
  Layers,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  CRM_FIELD_TYPE_LABELS,
  CRM_FIELD_TYPES,
  type CrmEntityTableSchema,
  type CrmFieldDefinition,
  type CrmFieldSection,
  type CrmFieldType,
} from '../../../domain/crm/tableSchema.ts';
import { Modal } from '../ui/Modal.tsx';

interface TableSchemaEditorModalProps {
  open: boolean;
  onClose: () => void;
  schema: CrmEntityTableSchema;
  entityLabel: string;
  onAddSection: (title: string) => Promise<void>;
  onRenameSection: (sectionId: string, title: string) => Promise<void>;
  onDeleteSection: (sectionId: string) => Promise<void>;
  onAddField: (input: {
    label: string;
    type: CrmFieldType;
    sectionId: string;
    required: boolean;
    visibleInTable: boolean;
    options: string[];
    placeholder: string;
  }) => Promise<void>;
  onUpdateField: (
    fieldKey: string,
    patch: {
      label?: string;
      type?: CrmFieldType;
      sectionId?: string;
      required?: boolean;
      options?: string[];
      placeholder?: string;
    }
  ) => Promise<void>;
  onDeleteField: (fieldKey: string) => Promise<void>;
}

export const TableSchemaEditorModal: React.FC<TableSchemaEditorModalProps> = ({
  open,
  onClose,
  schema,
  entityLabel,
  onAddSection,
  onRenameSection,
  onDeleteSection,
  onAddField,
  onUpdateField,
  onDeleteField,
}) => {
  const [activeSectionId, setActiveSectionId] = useState<string>('');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState('');

  // Add / Edit Field form
  const [editingField, setEditingField] = useState<CrmFieldDefinition | null>(null);
  const [fLabel, setFLabel] = useState('');
  const [fType, setFType] = useState<CrmFieldType>('text');
  const [fSectionId, setFSectionId] = useState('');
  const [fRequired, setFRequired] = useState(false);
  const [fVisibleInTable, setFVisibleInTable] = useState(true);
  const [fOptionsText, setFOptionsText] = useState('');
  const [fPlaceholder, setFPlaceholder] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && schema.sections.length > 0) {
      const stillExists = schema.sections.some((s) => s.id === activeSectionId);
      const firstId = stillExists ? activeSectionId : schema.sections[0].id;
      setActiveSectionId(firstId);
      if (!editingField) {
        setFSectionId(firstId);
      }
    }
  }, [open, schema.sections, activeSectionId, editingField]);

  const resetFieldForm = (sectionId?: string) => {
    setEditingField(null);
    setFLabel('');
    setFType('text');
    setFSectionId(sectionId || activeSectionId || schema.sections[0]?.id || '');
    setFRequired(false);
    setFVisibleInTable(true);
    setFOptionsText('');
    setFPlaceholder('');
  };

  const startEditField = (field: CrmFieldDefinition) => {
    setEditingField(field);
    setFLabel(field.label);
    setFType(field.type);
    setFSectionId(field.sectionId);
    setFRequired(field.required);
    setFVisibleInTable(schema.viewConfig.visibleColumns.includes(field.key));
    setFOptionsText((field.options || []).join(', '));
    setFPlaceholder(field.placeholder || '');
  };

  const fieldsBySection = useMemo(() => {
    const map = new Map<string, CrmFieldDefinition[]>();
    for (const s of schema.sections) {
      map.set(s.id, []);
    }
    for (const f of schema.fields) {
      const list = map.get(f.sectionId) || [];
      list.push(f);
      map.set(f.sectionId, list);
    }
    return map;
  }, [schema.sections, schema.fields]);

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionTitle.trim()) return;
    setSubmitting(true);
    try {
      await onAddSection(newSectionTitle.trim());
      setNewSectionTitle('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSectionRename = async (section: CrmFieldSection) => {
    if (!editingSectionTitle.trim()) return;
    setSubmitting(true);
    try {
      await onRenameSection(section.id, editingSectionTitle.trim());
      setEditingSectionId(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fLabel.trim() || !fSectionId) return;
    const options = fOptionsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      if (editingField) {
        await onUpdateField(editingField.key, {
          label: fLabel.trim(),
          ...(!editingField.isSystem ? { type: fType, required: fRequired } : {}),
          sectionId: fSectionId,
          options: fType === 'select' || fType === 'multiselect' ? options : [],
          placeholder: fPlaceholder.trim(),
        });
      } else {
        await onAddField({
          label: fLabel.trim(),
          type: fType,
          sectionId: fSectionId,
          required: fRequired,
          visibleInTable: fVisibleInTable,
          options,
          placeholder: fPlaceholder.trim(),
        });
      }
      resetFieldForm(fSectionId);
    } finally {
      setSubmitting(false);
    }
  };

  const activeFields = fieldsBySection.get(activeSectionId) || [];
  const activeSection = schema.sections.find((s) => s.id === activeSectionId) || schema.sections[0];
  const needsOptions = fType === 'select' || fType === 'multiselect';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Редактор разделов и полей (amoCRM) — ${entityLabel}`}
      maxWidthClass="max-w-4xl"
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Pane: Sections List & Add Section */}
        <div className="space-y-3 lg:col-span-4">
          <div className="flex items-center justify-between">
            <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
              <Layers className="h-3.5 w-3.5 text-[#0077FF]" />
              Разделы карточки и таблицы
            </h4>
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              {schema.sections.length}
            </span>
          </div>

          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {schema.sections.map((sec) => {
              const count = fieldsBySection.get(sec.id)?.length || 0;
              const isSelected = sec.id === activeSectionId;
              const isEditing = editingSectionId === sec.id;

              return (
                <div
                  key={sec.id}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 text-xs transition-colors ${
                    isSelected ? 'bg-blue-50/70 text-[#0077FF]' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {isEditing ? (
                    <div className="flex flex-1 items-center gap-1">
                      <input
                        type="text"
                        value={editingSectionTitle}
                        onChange={(e) => setEditingSectionTitle(e.target.value)}
                        className="w-full rounded border border-blue-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSaveSectionRename(sec)}
                        className="rounded bg-[#0077FF] p-1 text-white"
                        title="Сохранить название"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSectionId(sec.id);
                        if (!editingField) setFSectionId(sec.id);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate font-medium">{sec.title}</div>
                      <div className="text-[11px] text-slate-400 tabular-nums">
                        Полей: {count}
                        {sec.isSystem ? ' · системный' : ''}
                      </div>
                    </button>
                  )}

                  {!isEditing && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSectionId(sec.id);
                          setEditingSectionTitle(sec.title);
                        }}
                        title="Переименовать раздел"
                        className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-800"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                      {!sec.isSystem && (
                        <button
                          type="button"
                          onClick={() => void onDeleteSection(sec.id)}
                          title="Удалить раздел (поля перенесутся в Основное)"
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <form onSubmit={handleCreateSection} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <label className="block text-[11px] font-medium text-slate-700">
              Новый раздел (вкладка)
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                required
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="Например: Договор и ЭДО"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#0077FF]"
              />
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Добавить
              </button>
            </div>
          </form>
        </div>

        {/* Right Pane: Fields in Selected Section + Field Builder */}
        <div className="space-y-4 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-semibold text-slate-900">
                Поля раздела «{activeSection?.title || 'Основное'}»
              </h4>
              <p className="text-[11px] text-slate-500">
                Добавляйте поля нужного типа — они сразу появятся в форме карточки и в настройках таблицы
              </p>
            </div>
            {editingField && (
              <button
                type="button"
                onClick={() => resetFieldForm(activeSectionId)}
                className="text-xs font-medium text-[#0077FF] hover:underline"
              >
                + Создать новое поле
              </button>
            )}
          </div>

          <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            {activeFields.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500">
                В этом разделе пока нет полей. Добавьте новое поле ниже.
              </div>
            ) : (
              activeFields.map((field) => (
                <div
                  key={field.key}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-slate-900">{field.label}</span>
                      {field.required && <span className="text-red-600">*</span>}
                      <span className="text-[11px] text-slate-400">
                        · {CRM_FIELD_TYPE_LABELS[field.type]}
                      </span>
                      {field.isSystem && (
                        <span className="text-[11px] text-slate-400">· системное</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-400">
                      <span>{field.key}</span>
                      {field.options && field.options.length > 0 && (
                        <span className="font-sans text-slate-500">
                          · Варианты: {field.options.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEditField(field)}
                      title="Настроить поле"
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    {!field.isSystem && (
                      <button
                        type="button"
                        onClick={() => void onDeleteField(field.key)}
                        title="Удалить поле"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add / Edit Field Form */}
          <form
            onSubmit={handleSaveField}
            className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
          >
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-semibold text-slate-900">
                {editingField
                  ? `Редактировать поле «${editingField.label}»`
                  : 'Добавить новое поле в таблицу'}
              </h5>
              {editingField && (
                <button
                  type="button"
                  onClick={() => resetFieldForm()}
                  className="text-[11px] text-slate-500 hover:text-slate-900"
                >
                  Отмена редактирования
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700">
                  Название поля *
                </label>
                <input
                  type="text"
                  required
                  value={fLabel}
                  onChange={(e) => setFLabel(e.target.value)}
                  placeholder="Например: Дата договора"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#0077FF]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700">
                  Тип поля *
                </label>
                <select
                  value={fType}
                  disabled={Boolean(editingField?.isSystem)}
                  onChange={(e) => setFType(e.target.value as CrmFieldType)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#0077FF] disabled:bg-slate-100 disabled:text-slate-500"
                >
                  {CRM_FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {CRM_FIELD_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700">
                  Раздел *
                </label>
                <select
                  value={fSectionId}
                  onChange={(e) => setFSectionId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#0077FF]"
                >
                  {schema.sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {needsOptions && (
              <div>
                <label className="block text-[11px] font-medium text-slate-700">
                  Варианты списка (через запятую)
                </label>
                <input
                  type="text"
                  value={fOptionsText}
                  onChange={(e) => setFOptionsText(e.target.value)}
                  placeholder="Новый, В работе, VIP, Архив"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#0077FF]"
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-700">
                  Подсказка (placeholder)
                </label>
                <input
                  type="text"
                  value={fPlaceholder}
                  onChange={(e) => setFPlaceholder(e.target.value)}
                  placeholder="Введите значение..."
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#0077FF]"
                />
              </div>

              <div className="flex flex-col justify-end gap-1.5 text-xs text-slate-700">
                {!editingField?.isSystem && (
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={fRequired}
                      onChange={(e) => setFRequired(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[#0077FF]"
                    />
                    <span>Обязательное при заполнении</span>
                  </label>
                )}
                {!editingField && (
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={fVisibleInTable}
                      onChange={(e) => setFVisibleInTable(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[#0077FF]"
                    />
                    <span>Сразу отображать колонкой в таблице</span>
                  </label>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" />
                {editingField ? 'Сохранить поле' : 'Добавить поле в раздел'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
};
