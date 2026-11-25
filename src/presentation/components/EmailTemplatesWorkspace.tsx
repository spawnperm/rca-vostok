import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Eye, FileEdit, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { refineClient } from '../../application/refine/client.ts';
import {
  EMAIL_TEMPLATE_CATEGORY_LABELS,
  EMAIL_TEMPLATE_VARIABLES,
  type DealEmailContext,
  type EmailTemplateCategory,
  type EmailTemplateFieldErrors,
  renderEmailTemplate,
  validateEmailTemplateFields,
} from '../../domain/crm/entities.ts';

export interface EmailTemplateRecord {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  createdBy: string;
  createdAt?: string;
}

interface EmailTemplatesWorkspaceProps {
  templates: EmailTemplateRecord[];
  initialTemplateId?: string;
  canWrite: boolean;
  previewContext?: DealEmailContext;
  onTemplatesChange: (nextTemplates: EmailTemplateRecord[]) => void;
  onApplyToDeal?: (template: EmailTemplateRecord) => void;
  onAfterApply?: () => void;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
  heightClass?: string;
  createSignal?: number;
}

const DEFAULT_PREVIEW_CONTEXT: DealEmailContext = {
  contactName: 'Анна Соколова',
  companyName: 'ООО «ТехноПром»',
  dealTitle: 'Внедрение корпоративного портала',
  budget: '1 250 000 RUB',
  ownerName: 'Алексей Волков',
  stageName: 'Переговоры',
};

export const EmailTemplatesWorkspace: React.FC<EmailTemplatesWorkspaceProps> = ({
  templates,
  initialTemplateId,
  canWrite,
  previewContext,
  onTemplatesChange,
  onApplyToDeal,
  onAfterApply,
  onNotify,
  heightClass = 'min-h-[580px]',
  createSignal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [mode, setMode] = useState<'create' | 'edit'>('edit');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<EmailTemplateCategory>('followup');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const [fieldErrors, setFieldErrors] = useState<EmailTemplateFieldErrors>({});
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const subjectInputRef = useRef<HTMLInputElement | null>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const activeFieldRef = useRef<'subject' | 'body'>('body');

  const selectTemplateForEdit = (tpl: EmailTemplateRecord) => {
    setMode('edit');
    setEditingId(tpl.id);
    setName(tpl.name);
    setCategory(
      (tpl.category in EMAIL_TEMPLATE_CATEGORY_LABELS
        ? tpl.category
        : 'followup') as EmailTemplateCategory
    );
    setSubject(tpl.subject);
    setBody(tpl.body);
    setFieldErrors({});
    setSubmittedOnce(false);
    setConfirmDeleteId(null);
  };

  const startCreateNew = () => {
    setMode('create');
    setEditingId(null);
    setName('');
    setCategory('followup');
    setSubject('');
    setBody('');
    setFieldErrors({});
    setSubmittedOnce(false);
    setConfirmDeleteId(null);
  };

  const lastCreateSignalRef = useRef(createSignal);
  useEffect(() => {
    if (createSignal !== undefined && createSignal !== lastCreateSignalRef.current) {
      lastCreateSignalRef.current = createSignal;
      startCreateNew();
    }
  }, [createSignal]);

  useEffect(() => {
    if (initialTemplateId) {
      const found = templates.find((t) => t.id === initialTemplateId);
      if (found) {
        selectTemplateForEdit(found);
        return;
      }
    }
    if (templates.length > 0 && !editingId && mode !== 'create') {
      selectTemplateForEdit(templates[0]);
    } else if (templates.length === 0 && !editingId) {
      startCreateNew();
    }
  }, [initialTemplateId, templates, editingId, mode]);

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return templates.filter((tpl) => {
      if (categoryFilter !== 'all' && tpl.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        tpl.name.toLowerCase().includes(q) ||
        tpl.subject.toLowerCase().includes(q) ||
        tpl.body.toLowerCase().includes(q)
      );
    });
  }, [templates, searchQuery, categoryFilter]);

  const effectivePreviewCtx = previewContext || DEFAULT_PREVIEW_CONTEXT;

  const renderedPreview = useMemo(
    () => ({
      subject: renderEmailTemplate(subject || 'Тема письма', effectivePreviewCtx),
      body: renderEmailTemplate(body || 'Введите текст шаблона для предпросмотра...', effectivePreviewCtx),
    }),
    [subject, body, effectivePreviewCtx]
  );

  useEffect(() => {
    if (!submittedOnce) return;
    const result = validateEmailTemplateFields({ name, category, subject, body });
    setFieldErrors(result.success ? {} : result.fieldErrors);
  }, [submittedOnce, name, category, subject, body]);

  const insertVariable = (token: string) => {
    if (!canWrite) return;
    if (activeFieldRef.current === 'subject' && subjectInputRef.current) {
      const el = subjectInputRef.current;
      const start = el.selectionStart ?? subject.length;
      const end = el.selectionEnd ?? subject.length;
      setSubject(subject.slice(0, start) + token + subject.slice(end));
      window.requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      });
      return;
    }

    const el = bodyTextareaRef.current;
    if (el) {
      const start = el.selectionStart ?? body.length;
      const end = el.selectionEnd ?? body.length;
      setBody(body.slice(0, start) + token + body.slice(end));
      window.requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      });
    } else {
      setBody((prev) => `${prev}${prev ? ' ' : ''}${token}`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedOnce(true);

    const validation = validateEmailTemplateFields({ name, category, subject, body });
    if (!validation.success) {
      setFieldErrors(validation.fieldErrors);
      onNotify(validation.message, 'err');
      return;
    }

    setFieldErrors({});
    setSaving(true);
    try {
      if (mode === 'create') {
        const res = await refineClient.request<{ template: EmailTemplateRecord }>('/api/crm/email-templates', {
          method: 'POST',
          body: JSON.stringify(validation.data),
        });
        onTemplatesChange([res.template, ...templates]);
        selectTemplateForEdit(res.template);
        onNotify(`Шаблон «${res.template.name}» создан`);
      } else if (editingId) {
        const res = await refineClient.request<{ template: EmailTemplateRecord }>(
          `/api/crm/email-templates/${editingId}`,
          {
            method: 'PATCH',
            body: JSON.stringify(validation.data),
          }
        );
        onTemplatesChange(templates.map((t) => (t.id === res.template.id ? res.template : t)));
        selectTemplateForEdit(res.template);
        onNotify(`Шаблон «${res.template.name}» обновлён`);
      }
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка сохранения шаблона', 'err');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await refineClient.request(`/api/crm/email-templates/${id}`, { method: 'DELETE' });
      const nextList = templates.filter((t) => t.id !== id);
      onTemplatesChange(nextList);
      setConfirmDeleteId(null);
      if (nextList.length > 0) {
        selectTemplateForEdit(nextList[0]);
      } else {
        startCreateNew();
      }
      onNotify('Шаблон рассылки удалён');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка удаления шаблона', 'err');
    } finally {
      setDeleting(false);
    }
  };

  const activeTemplateForApply: EmailTemplateRecord | null =
    mode === 'edit' && editingId
      ? {
          id: editingId,
          name,
          category,
          subject,
          body,
          createdBy: templates.find((t) => t.id === editingId)?.createdBy || '',
        }
      : null;

  return (
    <div className={`grid grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid-cols-12 ${heightClass}`}>
      <div className="flex min-h-0 flex-col border-b border-slate-200 bg-[#F8FAFC] lg:col-span-4 lg:border-b-0 lg:border-r">
        <div className="space-y-2.5 border-b border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск шаблона..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2.5 text-xs text-slate-900 outline-none focus:border-[#0077FF] focus:bg-white"
              />
            </div>
            {canWrite && (
              <button
                type="button"
                onClick={startCreateNew}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#0077FF] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                Создать
              </button>
            )}
          </div>

          <select
            aria-label="Фильтр по категории шаблонов"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-[#0077FF]"
          >
            <option value="all">Все категории ({templates.length})</option>
            {Object.entries(EMAIL_TEMPLATE_CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
          {filteredTemplates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500">
              Шаблоны не найдены
            </div>
          ) : (
            filteredTemplates.map((tpl) => {
              const selected = mode === 'edit' && editingId === tpl.id;
              const catLabel =
                EMAIL_TEMPLATE_CATEGORY_LABELS[tpl.category as EmailTemplateCategory] || tpl.category;
              return (
                <div
                  key={tpl.id}
                  onClick={() => selectTemplateForEdit(tpl)}
                  className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                    selected
                      ? 'border-[#0077FF] bg-blue-50/70'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-900">{tpl.name}</div>
                      <div className="mt-0.5 text-[11px] font-medium text-slate-500">{catLabel}</div>
                    </div>
                    {onApplyToDeal && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onApplyToDeal(tpl);
                          onAfterApply?.();
                        }}
                        className="shrink-0 rounded border border-blue-200 bg-white px-2 py-0.5 text-[11px] font-medium text-[#0077FF] hover:bg-blue-50 whitespace-nowrap"
                      >
                        Выбрать
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 truncate text-[11px] text-slate-600">{tpl.subject}</div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-col overflow-y-auto bg-white p-6 lg:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileEdit className="h-4 w-4 text-[#0077FF]" />
            <h3 className="text-sm font-semibold text-slate-900">
              {mode === 'create' ? 'Создание нового шаблона' : 'Редактирование шаблона'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ${
                showPreview
                  ? 'border-blue-200 bg-blue-50 text-[#0077FF]'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              Предпросмотр
            </button>

            {mode === 'edit' && editingId && canWrite && (
              confirmDeleteId === editingId ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void handleDelete(editingId)}
                    className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    {deleting ? 'Удаление...' : 'Подтвердить'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    Отмена
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(editingId)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 whitespace-nowrap"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Удалить
                </button>
              )
            )}
          </div>
        </div>

        <form onSubmit={handleSave} noValidate className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Название шаблона <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                disabled={!canWrite}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Отправка коммерческого предложения"
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs text-slate-900 outline-none ${
                  fieldErrors.name
                    ? 'border-red-400 bg-red-50/40 focus:border-red-500'
                    : 'border-slate-200 focus:border-[#0077FF]'
                }`}
              />
              {fieldErrors.name && (
                <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">Категория</label>
              <select
                disabled={!canWrite}
                value={category}
                onChange={(e) => setCategory(e.target.value as EmailTemplateCategory)}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs text-slate-900 outline-none ${
                  fieldErrors.category ? 'border-red-400' : 'border-slate-200 focus:border-[#0077FF]'
                }`}
              >
                {Object.entries(EMAIL_TEMPLATE_CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Тема письма <span className="text-red-500">*</span>
            </label>
            <input
              ref={subjectInputRef}
              type="text"
              disabled={!canWrite}
              value={subject}
              onFocus={() => {
                activeFieldRef.current = 'subject';
              }}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Коммерческое предложение по проекту «{{dealTitle}}»"
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs text-slate-900 outline-none ${
                fieldErrors.subject
                  ? 'border-red-400 bg-red-50/40 focus:border-red-500'
                  : 'border-slate-200 focus:border-[#0077FF]'
              }`}
            />
            {fieldErrors.subject && (
              <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.subject}</p>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-medium text-slate-700">
                Текст письма <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">Нажмите на переменную для вставки</span>
            </div>

            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {EMAIL_TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  disabled={!canWrite}
                  onClick={() => insertVariable(v.key)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                >
                  <span>{v.key}</span>
                  <span className="font-sans text-slate-400">· {v.label}</span>
                </button>
              ))}
            </div>

            <textarea
              ref={bodyTextareaRef}
              rows={7}
              disabled={!canWrite}
              value={body}
              onFocus={() => {
                activeFieldRef.current = 'body';
              }}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Здравствуйте, {{contactName}}! ..."
              className={`mt-2 w-full resize-y rounded-lg border p-3 text-xs leading-relaxed text-slate-900 outline-none ${
                fieldErrors.body
                  ? 'border-red-400 bg-red-50/40 focus:border-red-500'
                  : 'border-slate-200 focus:border-[#0077FF]'
              }`}
            />
            {fieldErrors.body && (
              <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.body}</p>
            )}
          </div>

          {showPreview && (
            <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <Sparkles className="h-3.5 w-3.5 text-[#0077FF]" />
                Предпросмотр ({effectivePreviewCtx.contactName} · {effectivePreviewCtx.companyName})
              </div>
              <div className="mt-2 rounded-md border border-slate-200 bg-white p-3">
                <div className="border-b border-slate-100 pb-2 text-xs font-semibold text-slate-900">
                  Тема: {renderedPreview.subject}
                </div>
                <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-700">
                  {renderedPreview.body}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
            <div className="text-[11px] text-slate-500">
              {canWrite
                ? 'Сохраняется в PostgreSQL и публикуется в NATS'
                : 'Режим только для чтения (требуется deals:write)'}
            </div>

            <div className="flex items-center gap-2">
              {onApplyToDeal && activeTemplateForApply && (
                <button
                  type="button"
                  onClick={() => {
                    onApplyToDeal(activeTemplateForApply);
                    onAfterApply?.();
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-medium text-[#0077FF] hover:bg-blue-100 whitespace-nowrap"
                >
                  <Check className="h-3.5 w-3.5" />
                  Подставить в письмо
                </button>
              )}

              {canWrite && (
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {saving
                    ? 'Сохранение...'
                    : mode === 'create'
                    ? 'Создать шаблон'
                    : 'Сохранить изменения'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
