import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Check,
  Edit3,
  ExternalLink,
  Layers,
  Mail,
  Phone,
  Plus,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { refineClient } from '../../application/refine/client.ts';
import { useVoiceSectionAction } from '../../application/voice/voiceActionBus.ts';
import {
  buildDefaultCrmSchema,
  type CrmEntityTableSchema,
  type CrmEntityType,
  type CrmFieldDefinition,
  type CrmFieldType,
  type CrmTableViewConfig,
  sanitizeExternalHref,
} from '../../domain/crm/tableSchema.ts';
import type { AuthenticatedActor } from '../../domain/shared/types.ts';
import { CrmExportMenu } from '../components/crm/CrmExportMenu.tsx';
import { CrmImportModal } from '../components/crm/CrmImportModal.tsx';
import { TableAppearanceModal } from '../components/crm/TableAppearanceModal.tsx';
import { TableSchemaEditorModal } from '../components/crm/TableSchemaEditorModal.tsx';
import { VoiceSearchInput } from '../components/crm/VoiceSearchInput.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import type { CompanyItem, ContactItem } from '../types.ts';

interface ContactsViewProps {
  actor: AuthenticatedActor;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
}

const SYSTEM_CONTACT_KEYS = new Set([
  'fullName',
  'position',
  'companyName',
  'phone',
  'email',
  'tags',
  'dealsSummary',
]);

const SYSTEM_COMPANY_KEYS = new Set([
  'name',
  'industry',
  'website',
  'phone',
  'dealsSummary',
]);

export const ContactsView: React.FC<ContactsViewProps> = ({ actor, onNotify }) => {
  const [tab, setTab] = useState<CrmEntityType>('contacts');
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [schemas, setSchemas] = useState<Record<CrmEntityType, CrmEntityTableSchema>>({
    contacts: buildDefaultCrmSchema('contacts'),
    companies: buildDefaultCrmSchema('companies'),
  });
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // amoCRM Table Editors & Import/Export
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [schemaEditorOpen, setSchemaEditorOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Contact Modal (Create / Edit with Sections & Custom Fields)
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactItem | null>(null);
  const [contactSectionTab, setContactSectionTab] = useState<string>('all');
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPosition, setCPosition] = useState('');
  const [cCompanyId, setCCompanyId] = useState('');
  const [cCompanyName, setCCompanyName] = useState('');
  const [cTags, setCTags] = useState<string[]>([]);
  const [cCustom, setCCustom] = useState<Record<string, unknown>>({});

  // Company Modal (Create / Edit with Sections & Custom Fields)
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyItem | null>(null);
  const [companySectionTab, setCompanySectionTab] = useState<string>('all');
  const [cmpName, setCmpName] = useState('');
  const [cmpIndustry, setCmpIndustry] = useState('');
  const [cmpWebsite, setCmpWebsite] = useState('');
  const [cmpPhone, setCmpPhone] = useState('');
  const [cmpCustom, setCmpCustom] = useState<Record<string, unknown>>({});

  const canWrite = refineClient.can(actor, 'contacts:write');
  const activeSchema = schemas[tab];

  useVoiceSectionAction('contacts', (actionId) => {
    switch (actionId) {
      case 'contacts.create_contact':
        if (!canWrite) return false;
        setTab('contacts');
        openContactModal();
        return true;
      case 'contacts.create_company':
        if (!canWrite) return false;
        setTab('companies');
        openCompanyModal();
        return true;
      case 'contacts.tab_contacts':
        setTab('contacts');
        setSortKey('');
        return true;
      case 'contacts.tab_companies':
        setTab('companies');
        setSortKey('');
        return true;
      case 'contacts.open_appearance':
        setAppearanceOpen(true);
        return true;
      case 'contacts.open_schema_editor':
        if (!canWrite) return false;
        setSchemaEditorOpen(true);
        return true;
      case 'contacts.open_import':
        if (!canWrite) return false;
        setImportModalOpen(true);
        return true;
      case 'contacts.refresh':
        void loadDirectory();
        return true;
      default:
        return false;
    }
  });

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await refineClient.request<{
        contacts: ContactItem[];
        companies: CompanyItem[];
        schemas?: Record<CrmEntityType, CrmEntityTableSchema>;
      }>('/api/crm/contacts');
      setContacts(data.contacts);
      setCompanies(data.companies);
      if (data.schemas) {
        setSchemas(data.schemas);
      }
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка загрузки справочника', 'err');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const updateActiveSchema = (entityType: CrmEntityType, nextSchema: CrmEntityTableSchema) => {
    setSchemas((prev) => ({ ...prev, [entityType]: nextSchema }));
  };

  // Schema & View Handlers
  const handleSaveViewConfig = async (viewConfig: CrmTableViewConfig) => {
    try {
      const res = await refineClient.request<{ schema: CrmEntityTableSchema }>(
        `/api/crm/directory-schemas/${tab}/view`,
        {
          method: 'PUT',
          body: JSON.stringify(viewConfig),
        }
      );
      updateActiveSchema(tab, res.schema);
      onNotify('Внешний вид таблицы сохранён');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка сохранения вида таблицы', 'err');
      throw err;
    }
  };

  const handleResetViewConfig = async () => {
    try {
      const res = await refineClient.request<{ schema: CrmEntityTableSchema }>(
        `/api/crm/directory-schemas/${tab}/view/reset`,
        { method: 'POST' }
      );
      updateActiveSchema(tab, res.schema);
      onNotify('Вид таблицы сброшен по умолчанию');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка сброса вида таблицы', 'err');
      throw err;
    }
  };

  const handleAddSection = async (title: string) => {
    try {
      const res = await refineClient.request<{ schema: CrmEntityTableSchema }>(
        `/api/crm/directory-schemas/${tab}/sections`,
        { method: 'POST', body: JSON.stringify({ title }) }
      );
      updateActiveSchema(tab, res.schema);
      onNotify(`Раздел «${title}» добавлен`);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка создания раздела', 'err');
    }
  };

  const handleRenameSection = async (sectionId: string, title: string) => {
    try {
      const res = await refineClient.request<{ schema: CrmEntityTableSchema }>(
        `/api/crm/directory-schemas/${tab}/sections/${sectionId}`,
        { method: 'PATCH', body: JSON.stringify({ title }) }
      );
      updateActiveSchema(tab, res.schema);
      onNotify('Раздел переименован');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка обновления раздела', 'err');
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    try {
      const res = await refineClient.request<{ schema: CrmEntityTableSchema }>(
        `/api/crm/directory-schemas/${tab}/sections/${sectionId}`,
        { method: 'DELETE' }
      );
      updateActiveSchema(tab, res.schema);
      onNotify('Раздел удалён');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка удаления раздела', 'err');
    }
  };

  const handleAddField = async (input: {
    label: string;
    type: CrmFieldType;
    sectionId: string;
    required: boolean;
    visibleInTable: boolean;
    options: string[];
    placeholder: string;
  }) => {
    try {
      const res = await refineClient.request<{ schema: CrmEntityTableSchema }>(
        `/api/crm/directory-schemas/${tab}/fields`,
        { method: 'POST', body: JSON.stringify(input) }
      );
      updateActiveSchema(tab, res.schema);
      onNotify(`Поле «${input.label}» добавлено в таблицу`);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка добавления поля', 'err');
    }
  };

  const handleUpdateField = async (
    fieldKey: string,
    patch: {
      label?: string;
      type?: CrmFieldType;
      sectionId?: string;
      required?: boolean;
      options?: string[];
      placeholder?: string;
    }
  ) => {
    try {
      const res = await refineClient.request<{ schema: CrmEntityTableSchema }>(
        `/api/crm/directory-schemas/${tab}/fields/${fieldKey}`,
        { method: 'PATCH', body: JSON.stringify(patch) }
      );
      updateActiveSchema(tab, res.schema);
      onNotify('Поле обновлено');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка обновления поля', 'err');
    }
  };

  const handleDeleteField = async (fieldKey: string) => {
    try {
      const res = await refineClient.request<{ schema: CrmEntityTableSchema }>(
        `/api/crm/directory-schemas/${tab}/fields/${fieldKey}`,
        { method: 'DELETE' }
      );
      updateActiveSchema(tab, res.schema);
      onNotify('Поле удалено');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка удаления поля', 'err');
    }
  };

  // Contact CRUD
  const openContactModal = (contact?: ContactItem) => {
    setEditingContact(contact || null);
    setContactSectionTab('all');
    setCName(contact?.fullName || '');
    setCPhone(contact?.phone || '');
    setCEmail(contact?.email || '');
    setCPosition(contact?.position || '');
    setCCompanyId(contact?.companyId || '');
    setCCompanyName(contact?.companyName || '');
    setCTags(contact?.tags || []);
    setCCustom({ ...(contact?.customFields || {}) });
    setContactModalOpen(true);
  };

  const validateRequiredCustomFields = (
    schema: CrmEntityTableSchema,
    systemKeys: Set<string>,
    customValues: Record<string, unknown>
  ): string | null => {
    for (const field of schema.fields) {
      if (systemKeys.has(field.key) || field.readOnly || !field.required) continue;
      const val = customValues[field.key];
      const isEmpty =
        val === undefined ||
        val === null ||
        val === '' ||
        (Array.isArray(val) && val.length === 0);
      if (isEmpty) {
        return `Заполните обязательное поле «${field.label}»`;
      }
    }
    return null;
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErr = validateRequiredCustomFields(schemas.contacts, SYSTEM_CONTACT_KEYS, cCustom);
    if (validationErr) {
      onNotify(validationErr, 'err');
      return;
    }
    try {
      const payload = {
        fullName: cName,
        phone: cPhone,
        email: cEmail,
        position: cPosition,
        companyId: cCompanyId || null,
        companyName: cCompanyName,
        tags: cTags.length > 0 ? cTags : editingContact?.tags || ['CRM'],
        customFields: cCustom,
      };
      if (editingContact) {
        await refineClient.update('crm/contacts', editingContact.id, payload);
        onNotify('Контакт обновлён');
      } else {
        await refineClient.create('crm/contacts', payload);
        onNotify('Контакт добавлен');
      }
      setContactModalOpen(false);
      await loadDirectory();
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка сохранения контакта', 'err');
    }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      await refineClient.deleteOne('crm/contacts', id);
      onNotify('Контакт удалён');
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка удаления контакта', 'err');
    }
  };

  // Company CRUD
  const openCompanyModal = (company?: CompanyItem) => {
    setEditingCompany(company || null);
    setCompanySectionTab('all');
    setCmpName(company?.name || '');
    setCmpIndustry(company?.industry || '');
    setCmpWebsite(company?.website || '');
    setCmpPhone(company?.phone || '');
    setCmpCustom({ ...(company?.customFields || {}) });
    setCompanyModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErr = validateRequiredCustomFields(schemas.companies, SYSTEM_COMPANY_KEYS, cmpCustom);
    if (validationErr) {
      onNotify(validationErr, 'err');
      return;
    }
    try {
      const payload = {
        name: cmpName,
        industry: cmpIndustry,
        website: cmpWebsite,
        phone: cmpPhone,
        customFields: cmpCustom,
      };
      if (editingCompany) {
        await refineClient.update('crm/companies', editingCompany.id, payload);
        onNotify('Компания обновлена');
      } else {
        await refineClient.create('crm/companies', payload);
        onNotify('Компания добавлена');
      }
      setCompanyModalOpen(false);
      await loadDirectory();
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка сохранения компании', 'err');
    }
  };

  const handleDeleteCompany = async (id: string) => {
    try {
      await refineClient.deleteOne('crm/companies', id);
      onNotify('Компания удалена');
      setCompanies((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка удаления компании', 'err');
    }
  };

  // Dynamic Columns for Active View
  const visibleFields = useMemo(() => {
    const fieldMap = new Map(activeSchema.fields.map((f) => [f.key, f]));
    const visibleSet = new Set(activeSchema.viewConfig.visibleColumns);
    const ordered = activeSchema.viewConfig.columnOrder
      .filter((key) => visibleSet.has(key) && fieldMap.has(key))
      .map((key) => fieldMap.get(key)!);
    return ordered.length > 0 ? ordered : activeSchema.fields.slice(0, 5);
  }, [activeSchema]);

  const getCellRawValue = useCallback(
    (entityType: CrmEntityType, item: ContactItem | CompanyItem, key: string): unknown => {
      if (entityType === 'contacts') {
        const c = item as ContactItem;
        if (key === 'fullName') return c.fullName;
        if (key === 'position') return c.position;
        if (key === 'companyName') return c.companyName;
        if (key === 'phone') return c.phone;
        if (key === 'email') return c.email;
        if (key === 'tags') return c.tags;
        if (key === 'dealsSummary') return c.dealsBudget || 0;
        return c.customFields?.[key];
      }
      const cmp = item as CompanyItem;
      if (key === 'name') return cmp.name;
      if (key === 'industry') return cmp.industry;
      if (key === 'website') return cmp.website;
      if (key === 'phone') return cmp.phone;
      if (key === 'dealsSummary') return cmp.dealsBudget || 0;
      return cmp.customFields?.[key];
    },
    []
  );

  const handleSortColumn = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const availableContactTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const c of contacts) {
      for (const t of c.tags || []) {
        if (t.trim()) tagSet.add(t.trim());
      }
    }
    return [...tagSet].sort((a, b) => a.localeCompare(b, 'ru'));
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = contacts.filter((c) => {
      if (tagFilter !== 'all' && !(c.tags || []).includes(tagFilter)) {
        return false;
      }
      if (!q) return true;
      const baseMatch =
        c.fullName.toLowerCase().includes(q) ||
        c.companyName.toLowerCase().includes(q) ||
        c.position.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q));
      if (baseMatch) return true;
      return Object.values(c.customFields || {}).some((val) =>
        String(val ?? '').toLowerCase().includes(q)
      );
    });

    if (!sortKey || tab !== 'contacts') return list;
    return [...list].sort((a, b) => {
      const av = getCellRawValue('contacts', a, sortKey);
      const bv = getCellRawValue('contacts', b, sortKey);
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av ?? '').localeCompare(String(bv ?? ''), 'ru');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [contacts, search, tagFilter, sortKey, sortDir, tab, getCellRawValue]);

  const filteredCompanies = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = !q
      ? companies
      : companies.filter((c) => {
          const baseMatch =
            c.name.toLowerCase().includes(q) ||
            c.industry.toLowerCase().includes(q) ||
            c.website.toLowerCase().includes(q) ||
            c.phone.toLowerCase().includes(q);
          if (baseMatch) return true;
          return Object.values(c.customFields || {}).some((val) =>
            String(val ?? '').toLowerCase().includes(q)
          );
        });

    if (!sortKey || tab !== 'companies') return list;
    return [...list].sort((a, b) => {
      const av = getCellRawValue('companies', a, sortKey);
      const bv = getCellRawValue('companies', b, sortKey);
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av ?? '').localeCompare(String(bv ?? ''), 'ru');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [companies, search, sortKey, sortDir, tab, getCellRawValue]);

  const densityClass =
    activeSchema.viewConfig.density === 'compact'
      ? 'px-3 py-1.5'
      : activeSchema.viewConfig.density === 'comfortable'
        ? 'px-4 py-3.5'
        : 'px-4 py-2.5';

  const renderTableCell = (
    entityType: CrmEntityType,
    item: ContactItem | CompanyItem,
    field: CrmFieldDefinition
  ) => {
    const val = getCellRawValue(entityType, item, field.key);
    const wrapClass = activeSchema.viewConfig.wrapText ? 'whitespace-normal' : 'truncate max-w-[240px]';

    // Special system renderers preserving amoCRM clarity
    if (entityType === 'contacts' && field.key === 'fullName') {
      const c = item as ContactItem;
      return (
        <div className={wrapClass}>
          <div className="font-medium text-slate-900">{c.fullName}</div>
          {activeSchema.viewConfig.showSubtitles && c.position && (
            <div className="text-xs text-slate-500">{c.position}</div>
          )}
        </div>
      );
    }

    if (entityType === 'companies' && field.key === 'name') {
      const cmp = item as CompanyItem;
      return (
        <div className={wrapClass}>
          <div className="font-medium text-slate-900">{cmp.name}</div>
          {activeSchema.viewConfig.showSubtitles && cmp.industry && (
            <div className="text-xs text-slate-500">{cmp.industry}</div>
          )}
        </div>
      );
    }

    if (field.key === 'dealsSummary') {
      return (
        <div className="text-right text-xs tabular-nums">
          <div className="font-semibold text-slate-900">
            {(item.dealsBudget || 0).toLocaleString('ru-RU')} ₽
          </div>
          <div className="text-slate-500">Сделок: {item.dealsCount || 0}</div>
        </div>
      );
    }

    if (field.type === 'phone') {
      const str = String(val ?? '').trim();
      if (!str) return <span className="text-slate-400">—</span>;
      return (
        <span className="inline-flex items-center gap-1 text-xs text-slate-700 font-mono tabular-nums">
          <Phone className="h-3 w-3 shrink-0 text-slate-400" />
          {str}
        </span>
      );
    }

    if (field.type === 'email') {
      const str = String(val ?? '').trim();
      if (!str) return <span className="text-slate-400">—</span>;
      return (
        <span className="inline-flex items-center gap-1 text-xs text-slate-700">
          <Mail className="h-3 w-3 shrink-0 text-slate-400" />
          <span className={wrapClass}>{str}</span>
        </span>
      );
    }

    if (field.type === 'url') {
      const str = String(val ?? '').trim();
      const safeHref = sanitizeExternalHref(str);
      if (!str || !safeHref) return <span className="text-slate-400">—</span>;
      return (
        <a
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 font-mono text-xs text-[#0077FF] hover:underline"
        >
          <span className={wrapClass}>{str}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      );
    }

    if (field.type === 'checkbox') {
      const checked = val === true || val === 'true' || val === 'Да';
      return checked ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
          <Check className="h-3.5 w-3.5" />
          Да
        </span>
      ) : (
        <span className="text-xs text-slate-400">Нет</span>
      );
    }

    if (field.type === 'currency') {
      if (val === undefined || val === null || val === '') {
        return <span className="text-slate-400">—</span>;
      }
      const num = Number(val);
      return (
        <span className="font-mono text-xs font-medium text-slate-900 tabular-nums">
          {Number.isFinite(num) ? `${num.toLocaleString('ru-RU')} ₽` : String(val)}
        </span>
      );
    }

    if (field.type === 'number') {
      if (val === undefined || val === null || val === '') {
        return <span className="text-slate-400">—</span>;
      }
      const num = Number(val);
      return (
        <span className="font-mono text-xs text-slate-800 tabular-nums">
          {Number.isFinite(num) ? num.toLocaleString('ru-RU') : String(val)}
        </span>
      );
    }

    if (field.type === 'date') {
      const str = String(val ?? '').trim();
      if (!str) return <span className="text-slate-400">—</span>;
      const d = new Date(str);
      return (
        <span className="font-mono text-xs text-slate-700 tabular-nums">
          {Number.isNaN(d.getTime()) ? str : d.toLocaleDateString('ru-RU')}
        </span>
      );
    }

    if (field.type === 'multiselect') {
      const list = Array.isArray(val)
        ? val.map(String).filter(Boolean)
        : typeof val === 'string'
          ? val
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
      if (list.length === 0) return <span className="text-slate-400">—</span>;
      return <span className={`text-xs text-slate-700 ${wrapClass}`}>{list.join(' · ')}</span>;
    }

    const str = String(val ?? '').trim();
    return str ? (
      <span className={`block text-xs text-slate-700 ${wrapClass}`}>{str}</span>
    ) : (
      <span className="text-xs text-slate-400">—</span>
    );
  };

  // Dynamic Field Control Renderer inside Create/Edit Modal
  const renderDynamicFormField = (
    entityType: CrmEntityType,
    field: CrmFieldDefinition,
    customState: Record<string, unknown>,
    setCustomState: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
  ) => {
    if (field.readOnly) return null;

    // System fields for Contacts
    if (entityType === 'contacts') {
      if (field.key === 'fullName') {
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-slate-700">{field.label} *</label>
            <input
              type="text"
              required
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              placeholder={field.placeholder || 'Иван Петров'}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
        );
      }
      if (field.key === 'phone') {
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-slate-700">{field.label}</label>
            <input
              type="text"
              value={cPhone}
              onChange={(e) => setCPhone(e.target.value)}
              placeholder={field.placeholder || '+7 (999) 000-00-00'}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
        );
      }
      if (field.key === 'email') {
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-slate-700">{field.label}</label>
            <input
              type="email"
              value={cEmail}
              onChange={(e) => setCEmail(e.target.value)}
              placeholder={field.placeholder || 'name@company.ru'}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
        );
      }
      if (field.key === 'position') {
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-slate-700">{field.label}</label>
            <input
              type="text"
              value={cPosition}
              onChange={(e) => setCPosition(e.target.value)}
              placeholder={field.placeholder || 'Должность'}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
        );
      }
      if (field.key === 'companyName') {
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-slate-700">{field.label}</label>
            <select
              value={cCompanyId}
              onChange={(e) => {
                setCCompanyId(e.target.value);
                const found = companies.find((cmp) => cmp.id === e.target.value);
                if (found) setCCompanyName(found.name);
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
            >
              <option value="">Указать вручную / без привязки</option>
              {companies.map((cmp) => (
                <option key={cmp.id} value={cmp.id}>
                  {cmp.name}
                </option>
              ))}
            </select>
            {!cCompanyId && (
              <input
                type="text"
                value={cCompanyName}
                onChange={(e) => setCCompanyName(e.target.value)}
                placeholder="Название компании..."
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
              />
            )}
          </div>
        );
      }
      if (field.key === 'tags') {
        const opts = field.options?.length ? field.options : ['CRM', 'Enterprise', 'VIP', 'Партнёр'];
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-slate-700">{field.label}</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {opts.map((opt) => {
                const checked = cTags.includes(opt);
                return (
                  <label
                    key={opt}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${
                      checked
                        ? 'border-[#0077FF] bg-blue-50 text-[#0077FF]'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setCTags((prev) =>
                          checked ? prev.filter((x) => x !== opt) : [...prev, opt]
                        )
                      }
                      className="h-3.5 w-3.5 accent-[#0077FF]"
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      }
    }

    // System fields for Companies
    if (entityType === 'companies') {
      if (field.key === 'name') {
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-slate-700">{field.label} *</label>
            <input
              type="text"
              required
              value={cmpName}
              onChange={(e) => setCmpName(e.target.value)}
              placeholder={field.placeholder || 'ООО «Вектор»'}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
        );
      }
      if (field.key === 'industry') {
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-slate-700">{field.label}</label>
            <input
              type="text"
              value={cmpIndustry}
              onChange={(e) => setCmpIndustry(e.target.value)}
              placeholder={field.placeholder || 'Отрасль'}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
        );
      }
      if (field.key === 'website') {
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-slate-700">{field.label}</label>
            <input
              type="text"
              value={cmpWebsite}
              onChange={(e) => setCmpWebsite(e.target.value)}
              placeholder={field.placeholder || 'company.ru'}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
        );
      }
      if (field.key === 'phone') {
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-slate-700">{field.label}</label>
            <input
              type="text"
              value={cmpPhone}
              onChange={(e) => setCmpPhone(e.target.value)}
              placeholder={field.placeholder || '+7 (495) 000-00-00'}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
        );
      }
    }

    // Custom fields (stored in customFields JSONB)
    const rawVal = customState[field.key];
    const setFieldValue = (val: unknown) =>
      setCustomState((prev) => ({ ...prev, [field.key]: val }));

    if (field.type === 'checkbox') {
      const checked = rawVal === true || rawVal === 'true';
      return (
        <label
          key={field.key}
          className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800"
        >
          <span>
            {field.label}
            {field.required && <span className="ml-1 text-red-600">*</span>}
          </span>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setFieldValue(e.target.checked)}
            className="h-4 w-4 accent-[#0077FF]"
          />
        </label>
      );
    }

    if (field.type === 'select') {
      const options = field.options || [];
      return (
        <div key={field.key}>
          <label className="block text-xs font-medium text-slate-700">
            {field.label}
            {field.required && <span className="ml-1 text-red-600">*</span>}
          </label>
          <select
            required={field.required}
            value={String(rawVal ?? '')}
            onChange={(e) => setFieldValue(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
          >
            <option value="">Не выбрано</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (field.type === 'multiselect') {
      const options = field.options || [];
      const selected = Array.isArray(rawVal) ? rawVal.map(String) : [];
      return (
        <div key={field.key}>
          <label className="block text-xs font-medium text-slate-700">
            {field.label}
            {field.required && <span className="ml-1 text-red-600">*</span>}
          </label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {options.map((opt) => {
              const isSelected = selected.includes(opt);
              return (
                <label
                  key={opt}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${
                    isSelected
                      ? 'border-[#0077FF] bg-blue-50 text-[#0077FF]'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() =>
                      setFieldValue(
                        isSelected ? selected.filter((x) => x !== opt) : [...selected, opt]
                      )
                    }
                    className="h-3.5 w-3.5 accent-[#0077FF]"
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.key}>
          <label className="block text-xs font-medium text-slate-700">
            {field.label}
            {field.required && <span className="ml-1 text-red-600">*</span>}
          </label>
          <textarea
            rows={3}
            required={field.required}
            value={String(rawVal ?? '')}
            onChange={(e) => setFieldValue(e.target.value)}
            placeholder={field.placeholder || ''}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
          />
        </div>
      );
    }

    const htmlType =
      field.type === 'number' || field.type === 'currency'
        ? 'number'
        : field.type === 'date'
          ? 'date'
          : field.type === 'email'
            ? 'email'
            : 'text';

    return (
      <div key={field.key}>
        <label className="block text-xs font-medium text-slate-700">
          {field.label}
          {field.required && <span className="ml-1 text-red-600">*</span>}
        </label>
        <input
          type={htmlType}
          required={field.required}
          value={String(rawVal ?? '')}
          onChange={(e) =>
            setFieldValue(
              htmlType === 'number'
                ? e.target.value === ''
                  ? ''
                  : Number(e.target.value)
                : e.target.value
            )
          }
          placeholder={field.placeholder || ''}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
        />
      </div>
    );
  };

  const currentItems = tab === 'contacts' ? filteredContacts : filteredCompanies;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Клиенты и компании CRM"
        subtitle={`Контактов: ${contacts.length} · Компаний: ${companies.length} · Колонок в таблице: ${visibleFields.length}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setTab('contacts');
                  setSortKey('');
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap shrink-0 ${
                  tab === 'contacts' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Контакты ({contacts.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('companies');
                  setSortKey('');
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap shrink-0 ${
                  tab === 'companies' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                Компании ({companies.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setAppearanceOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              title="Настроить отображаемые колонки и внешний вид таблицы"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
              Настройка таблицы
            </button>

            {canWrite && (
              <button
                type="button"
                onClick={() => setSchemaEditorOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                title="Добавить или изменить разделы и поля таблицы (amoCRM)"
              >
                <Layers className="h-3.5 w-3.5 text-[#0077FF]" />
                Поля и разделы
              </button>
            )}

            <CrmExportMenu
              label="Экспорт"
              filePrefix={tab === 'contacts' ? 'crm-contacts' : 'crm-companies'}
              buildUrl={(format) => {
                const params = new URLSearchParams({ format, entity: tab });
                if (search.trim()) params.set('q', search.trim());
                return `/api/crm/contacts/export?${params.toString()}`;
              }}
              onNotify={onNotify}
            />

            {canWrite && (
              <button
                type="button"
                onClick={() => setImportModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                title="Импортировать записи из CSV или Excel (.xlsx)"
              >
                <Upload className="h-3.5 w-3.5 text-slate-500" />
                Импорт
              </button>
            )}

            {canWrite && (
              <button
                type="button"
                onClick={() => (tab === 'contacts' ? openContactModal() : openCompanyModal())}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                {tab === 'contacts' ? 'Новый контакт' : 'Новая компания'}
              </button>
            )}
          </div>
        }
      />

      {/* Search & Active Layout Info */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
        <VoiceSearchInput
          value={search}
          onChange={setSearch}
          placeholder={
            tab === 'contacts'
              ? 'Поиск по имени, компании, телефону, email и доп. полям...'
              : 'Поиск по названию компании, отрасли, сайту, ИНН и доп. полям...'
          }
          ariaLabel={tab === 'contacts' ? 'Поиск контактов' : 'Поиск компаний'}
          voiceHint={
            tab === 'contacts'
              ? 'Назовите имя контакта, телефон или компанию'
              : 'Назовите компанию, отрасль или ИНН'
          }
          onNotify={onNotify}
        />
        {tab === 'contacts' && availableContactTags.length > 0 && (
          <select
            aria-label="Фильтр контактов по тегу"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0077FF]"
          >
            <option value="all">Все теги</option>
            {availableContactTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Разделов: {activeSchema.sections.length}</span>
          <span aria-hidden="true">·</span>
          <span>Полей: {activeSchema.fields.length}</span>
          <span aria-hidden="true">·</span>
          <span>
            Вид:{' '}
            {activeSchema.viewConfig.density === 'compact'
              ? 'Компактный'
              : activeSchema.viewConfig.density === 'comfortable'
                ? 'Просторный'
                : 'Стандартный'}
          </span>
        </div>
      </div>

      {/* Unified Configurable amoCRM Data Table */}
      {loading ? (
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ) : currentItems.length === 0 ? (
        <EmptyState
          icon={tab === 'contacts' ? <Users className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
          title={tab === 'contacts' ? 'Контакты не найдены' : 'Компании не найдены'}
          description={
            tab === 'contacts'
              ? 'Добавьте первого клиента или измените строку поиска.'
              : 'Создайте карточку B2B-компании для группировки сделок и контактов.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
              <tr>
                {visibleFields.map((field) => {
                  const isNumericRight =
                    field.key === 'dealsSummary' || field.type === 'currency' || field.type === 'number';
                  const isSorted = sortKey === field.key;
                  return (
                    <th
                      key={field.key}
                      className={`${densityClass} ${
                        activeSchema.viewConfig.showBorders ? 'border-r border-slate-200/70 last:border-r-0' : ''
                      } ${isNumericRight ? 'text-right' : 'text-left'} whitespace-nowrap`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSortColumn(field.key)}
                        className={`inline-flex items-center gap-1 hover:text-slate-900 ${
                          isNumericRight ? 'flex-row-reverse' : ''
                        }`}
                      >
                        <span>{field.label}</span>
                        {isSorted &&
                          (sortDir === 'asc' ? (
                            <ArrowUp className="h-3 w-3 text-[#0077FF]" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-[#0077FF]" />
                          ))}
                      </button>
                    </th>
                  );
                })}
                <th className={`${densityClass} text-right whitespace-nowrap`}>
                  <button
                    type="button"
                    onClick={() => setAppearanceOpen(true)}
                    title="Настроить колонки таблицы"
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Настройка столбцов</span>
                  </button>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {currentItems.map((item) => (
                <tr
                  key={item.id}
                  onClick={() =>
                    canWrite
                      ? tab === 'contacts'
                        ? openContactModal(item as ContactItem)
                        : openCompanyModal(item as CompanyItem)
                      : undefined
                  }
                  className={`${canWrite ? 'cursor-pointer' : ''} hover:bg-slate-50/80`}
                >
                  {visibleFields.map((field) => {
                    const isNumericRight =
                      field.key === 'dealsSummary' || field.type === 'currency' || field.type === 'number';
                    return (
                      <td
                        key={field.key}
                        className={`${densityClass} ${
                          activeSchema.viewConfig.showBorders
                            ? 'border-r border-slate-100 last:border-r-0'
                            : ''
                        } ${isNumericRight ? 'text-right' : 'text-left'}`}
                      >
                        {renderTableCell(tab, item, field)}
                      </td>
                    );
                  })}

                  <td
                    className={`${densityClass} text-right whitespace-nowrap`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canWrite && (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            tab === 'contacts'
                              ? openContactModal(item as ContactItem)
                              : openCompanyModal(item as CompanyItem)
                          }
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          title="Редактировать"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void (tab === 'contacts'
                              ? handleDeleteContact(item.id)
                              : handleDeleteCompany(item.id))
                          }
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Удалить"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* amoCRM Table Appearance Modal (View Mode) */}
      <TableAppearanceModal
        open={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
        schema={activeSchema}
        entityLabel={tab === 'contacts' ? 'Контакты' : 'Компании'}
        onSave={handleSaveViewConfig}
        onReset={handleResetViewConfig}
      />

      {/* amoCRM Table Sections & Fields Editor Modal */}
      <TableSchemaEditorModal
        open={schemaEditorOpen}
        onClose={() => setSchemaEditorOpen(false)}
        schema={activeSchema}
        entityLabel={tab === 'contacts' ? 'Контакты' : 'Компании'}
        onAddSection={handleAddSection}
        onRenameSection={handleRenameSection}
        onDeleteSection={handleDeleteSection}
        onAddField={handleAddField}
        onUpdateField={handleUpdateField}
        onDeleteField={handleDeleteField}
      />

      {/* Contact Sectioned Modal */}
      <Modal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        title={editingContact ? `Контакт: ${editingContact.fullName}` : 'Новый контакт'}
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleSaveContact} className="space-y-4">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setContactSectionTab('all')}
              className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap ${
                contactSectionTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Все разделы
            </button>
            {schemas.contacts.sections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => setContactSectionTab(sec.id)}
                className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap ${
                  contactSectionTab === sec.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                {sec.title}
              </button>
            ))}
          </div>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {schemas.contacts.sections
              .filter((sec) => contactSectionTab === 'all' || sec.id === contactSectionTab)
              .map((sec) => {
                const sectionFields = schemas.contacts.fields.filter(
                  (f) => f.sectionId === sec.id && !f.readOnly
                );
                if (sectionFields.length === 0) return null;
                return (
                  <div key={sec.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="border-b border-slate-100 pb-2 text-xs font-semibold text-slate-800">
                      {sec.title}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {sectionFields.map((field) =>
                        renderDynamicFormField('contacts', field, cCustom, setCCustom)
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setContactModalOpen(false)}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Сохранить контакт
            </button>
          </div>
        </form>
      </Modal>

      {/* Company Sectioned Modal */}
      <Modal
        open={companyModalOpen}
        onClose={() => setCompanyModalOpen(false)}
        title={editingCompany ? `Компания: ${editingCompany.name}` : 'Новая компания'}
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleSaveCompany} className="space-y-4">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setCompanySectionTab('all')}
              className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap ${
                companySectionTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Все разделы
            </button>
            {schemas.companies.sections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => setCompanySectionTab(sec.id)}
                className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap ${
                  companySectionTab === sec.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                {sec.title}
              </button>
            ))}
          </div>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {schemas.companies.sections
              .filter((sec) => companySectionTab === 'all' || sec.id === companySectionTab)
              .map((sec) => {
                const sectionFields = schemas.companies.fields.filter(
                  (f) => f.sectionId === sec.id && !f.readOnly
                );
                if (sectionFields.length === 0) return null;
                return (
                  <div key={sec.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="border-b border-slate-100 pb-2 text-xs font-semibold text-slate-800">
                      {sec.title}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {sectionFields.map((field) =>
                        renderDynamicFormField('companies', field, cmpCustom, setCmpCustom)
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setCompanyModalOpen(false)}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Сохранить компанию
            </button>
          </div>
        </form>
      </Modal>

      {/* CSV / Excel Import Modal */}
      <CrmImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        mode={tab}
        onImported={loadDirectory}
        onNotify={onNotify}
      />
    </div>
  );
};
