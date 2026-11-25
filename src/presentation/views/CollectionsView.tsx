import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Columns3,
  Database,
  Download,
  Edit3,
  Eye,
  EyeOff,
  BarChart3,
  Pin,
  Plus,
  Search,
  SlidersHorizontal,
  Table2,
  Trash2,
} from 'lucide-react';
import { directusBiConnectorModule } from '@nexus-plugins/directus-bi-connector';
import { refineClient } from '../../application/refine/client.ts';
import { useVoiceSectionAction } from '../../application/voice/voiceActionBus.ts';
import { getErrorMessage } from '../../shared/formatters.ts';
import {
  applyFormulaFields,
  COLLECTION_FIELD_TYPES,
  type CollectionFieldDef,
  type CollectionFieldType,
  type CollectionViewMode,
} from '../../domain/nocobase/entities.ts';
import type { AuthenticatedActor } from '../../domain/shared/types.ts';
import { DirectusMetadataExplorer } from '../components/DirectusMetadataExplorer.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';

interface RelationOption {
  id: string;
  label: string;
}

interface CollectionDef {
  id: string;
  key: string;
  title: string;
  description: string;
  defaultView: CollectionViewMode;
  kanbanGroupBy: string | null;
  calendarDateField: string | null;
  pinnedToDashboard: boolean;
  fields: CollectionFieldDef[];
  recordsCount: number;
}

interface CollectionRecord {
  id: string;
  collectionKey: string;
  data: Record<string, unknown>;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

interface CollectionsViewProps {
  actor: AuthenticatedActor;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
}

const FIELD_TYPE_LABELS: Record<CollectionFieldType, string> = {
  string: 'Строка',
  text: 'Текст',
  number: 'Число',
  currency: 'Валюта ₽',
  boolean: 'Флажок',
  date: 'Дата',
  select: 'Список',
  relation: 'Связь CRM',
  formula: 'Формула',
};

export const CollectionsView: React.FC<CollectionsViewProps> = ({ actor, onNotify }) => {
  const canManage =
    refineClient.can(actor, 'collections:manage') || refineClient.can(actor, 'deals:write');
  const canSchema = refineClient.can(actor, 'collections:manage');

  const [collections, setCollections] = useState<CollectionDef[]>([]);
  const [relationOptions, setRelationOptions] = useState<{
    deals: RelationOption[];
    contacts: RelationOption[];
    companies: RelationOption[];
  }>({ deals: [], contacts: [], companies: [] });

  const [workspaceTab, setWorkspaceTab] = useState<'nocobase' | 'directus'>('nocobase');
  const [directusRefreshSignal, setDirectusRefreshSignal] = useState(0);
  const [activeKey, setActiveKey] = useState<string>('');
  const [viewMode, setViewMode] = useState<CollectionViewMode>('table');
  const [records, setRecords] = useState<CollectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSchemaDrawer, setShowSchemaDrawer] = useState(false);

  // Record Create / Edit modal
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CollectionRecord | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // New Collection modal
  const [newColOpen, setNewColOpen] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');
  const [newColKey, setNewColKey] = useState('');
  const [newColDesc, setNewColDesc] = useState('');
  const [newColPrimaryLabel, setNewColPrimaryLabel] = useState('Название');

  // New Field modal
  const [newFieldOpen, setNewFieldOpen] = useState(false);
  const [nfKey, setNfKey] = useState('');
  const [nfLabel, setNfLabel] = useState('');
  const [nfType, setNfType] = useState<CollectionFieldType>('string');
  const [nfRequired, setNfRequired] = useState(false);
  const [nfOptions, setNfOptions] = useState('Новый, В работе, Завершён');
  const [nfRelationTarget, setNfRelationTarget] = useState<'deals' | 'contacts' | 'companies'>('deals');
  const [nfFormula, setNfFormula] = useState('{amount} * 0.2');

  const loadCollections = useCallback(async () => {
    try {
      const res = await refineClient.request<{
        collections: CollectionDef[];
        relationOptions: {
          deals: RelationOption[];
          contacts: RelationOption[];
          companies: RelationOption[];
        };
      }>('/api/nocobase/collections');
      setCollections(res.collections);
      setRelationOptions(res.relationOptions);
      if (res.collections.length > 0) {
        setActiveKey((prev) => {
          if (prev && res.collections.some((c) => c.key === prev)) {
            return prev;
          }
          const first = res.collections[0];
          setViewMode(first.defaultView);
          return first.key;
        });
      }
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка загрузки коллекций'), 'err');
    }
  }, [onNotify]);

  const loadRecords = useCallback(
    async (colKey: string) => {
      if (!colKey) {
        setRecords([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await refineClient.request<{ records: CollectionRecord[] }>(
          `/api/nocobase/collections/${colKey}/records`
        );
        setRecords(res.records);
      } catch (err: unknown) {
        onNotify(err instanceof Error ? err.message : 'Ошибка загрузки записей', 'err');
      } finally {
        setLoading(false);
      }
    },
    [onNotify]
  );

  useEffect(() => {
    void loadCollections();
  }, [actor.tenantId, loadCollections]);

  useEffect(() => {
    if (activeKey) {
      void loadRecords(activeKey);
    }
  }, [activeKey, loadRecords]);

  const activeCollection = useMemo(
    () => collections.find((c) => c.key === activeKey) || null,
    [collections, activeKey]
  );

  const handleSelectCollection = (col: CollectionDef) => {
    setActiveKey(col.key);
    setViewMode(col.defaultView);
    setSearchQuery('');
  };

  const resolveRelationLabel = useCallback(
    (target: 'deals' | 'contacts' | 'companies' | undefined, idVal: unknown): string => {
      if (!idVal || !target) return '—';
      const list = relationOptions[target] || [];
      return list.find((item) => item.id === String(idVal))?.label || String(idVal);
    },
    [relationOptions]
  );

  const visibleColumns = useMemo(() => {
    if (!activeCollection) return [];
    const vis = activeCollection.fields.filter((f) => f.visibleInTable);
    return vis.length > 0 ? vis : activeCollection.fields.slice(0, 4);
  }, [activeCollection]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return records;
    return records.filter((rec) =>
      JSON.stringify(rec.data).toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  const kanbanField = useMemo(() => {
    if (!activeCollection) return null;
    if (activeCollection.kanbanGroupBy) {
      const f = activeCollection.fields.find((item) => item.key === activeCollection.kanbanGroupBy);
      if (f && f.type === 'select') return f;
    }
    return activeCollection.fields.find((item) => item.type === 'select') || null;
  }, [activeCollection]);

  const dateField = useMemo(() => {
    if (!activeCollection) return null;
    if (activeCollection.calendarDateField) {
      const f = activeCollection.fields.find((item) => item.key === activeCollection.calendarDateField);
      if (f && f.type === 'date') return f;
    }
    return activeCollection.fields.find((item) => item.type === 'date') || null;
  }, [activeCollection]);

  const formatCellValue = (field: CollectionFieldDef, val: unknown): string => {
    if (val === undefined || val === null || val === '') return '—';
    if (field.type === 'boolean') return val ? 'Да' : 'Нет';
    if (field.type === 'currency') {
      const num = Number(val);
      return Number.isFinite(num) ? `${num.toLocaleString('ru-RU')} ₽` : String(val);
    }
    if (field.type === 'number' || field.type === 'formula') {
      const num = Number(val);
      return Number.isFinite(num) ? num.toLocaleString('ru-RU') : String(val);
    }
    if (field.type === 'date') {
      const d = new Date(String(val));
      return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('ru-RU');
    }
    if (field.type === 'relation') {
      return resolveRelationLabel(field.relationTarget, val);
    }
    return String(val);
  };

  const openCreateRecordModal = () => {
    if (!activeCollection) return;
    const initial: Record<string, unknown> = {};
    for (const f of activeCollection.fields) {
      if (f.type === 'boolean') initial[f.key] = false;
      else if (f.type === 'select' && f.options?.length) initial[f.key] = f.options[0];
      else if (f.type === 'date') initial[f.key] = new Date().toISOString().slice(0, 10);
      else if (f.type === 'number' || f.type === 'currency') initial[f.key] = 0;
      else initial[f.key] = '';
    }
    setEditingRecord(null);
    setFormData(initial);
    setRecordModalOpen(true);
  };

  useVoiceSectionAction('collections', (actionId) => {
    switch (actionId) {
      case 'collections.create_collection':
        if (!canSchema) return false;
        setNewColOpen(true);
        return true;
      case 'collections.create_record':
        if (!canManage || !activeCollection) return false;
        setWorkspaceTab('nocobase');
        openCreateRecordModal();
        return true;
      case 'collections.create_field':
        if (!canSchema || !activeCollection) return false;
        setWorkspaceTab('nocobase');
        setNewFieldOpen(true);
        return true;
      case 'collections.view_table':
        setWorkspaceTab('nocobase');
        setViewMode('table');
        return true;
      case 'collections.view_kanban':
        setWorkspaceTab('nocobase');
        setViewMode('kanban');
        return true;
      case 'collections.view_calendar':
        setWorkspaceTab('nocobase');
        setViewMode('calendar');
        return true;
      case 'collections.view_directus':
        setWorkspaceTab('directus');
        return true;
      case 'collections.refresh':
        void loadCollections();
        if (activeKey) void loadRecords(activeKey);
        setDirectusRefreshSignal((n) => n + 1);
        return true;
      default:
        return false;
    }
  });

  const openEditRecordModal = (rec: CollectionRecord) => {
    setEditingRecord(rec);
    setFormData({ ...rec.data });
    setRecordModalOpen(true);
  };

  const previewComputedData = useMemo(() => {
    if (!activeCollection) return formData;
    return applyFormulaFields(activeCollection.fields, formData);
  }, [activeCollection, formData]);

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCollection) return;
    try {
      if (editingRecord) {
        await refineClient.request(
          `/api/nocobase/collections/${activeCollection.key}/records/${editingRecord.id}`,
          { method: 'PATCH', body: JSON.stringify({ data: formData }) }
        );
        onNotify('Запись обновлена');
      } else {
        const res = await refineClient.request<{ triggeredWorkflows?: number }>(
          `/api/nocobase/collections/${activeCollection.key}/records`,
          { method: 'POST', body: JSON.stringify({ data: formData }) }
        );
        const wfMsg = res.triggeredWorkflows
          ? ` · Запущено процессов: ${res.triggeredWorkflows}`
          : '';
        onNotify(`Запись добавлена${wfMsg}`);
      }
      setRecordModalOpen(false);
      await Promise.all([loadRecords(activeCollection.key), loadCollections()]);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка сохранения записи', 'err');
    }
  };

  const handleDeleteRecord = async (recId: string) => {
    if (!activeCollection) return;
    try {
      await refineClient.request(
        `/api/nocobase/collections/${activeCollection.key}/records/${recId}`,
        { method: 'DELETE' }
      );
      await Promise.all([loadRecords(activeCollection.key), loadCollections()]);
      onNotify('Запись удалена');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка удаления записи', 'err');
    }
  };

  const handleMoveKanbanStatus = async (rec: CollectionRecord, nextVal: string) => {
    if (!activeCollection || !kanbanField) return;
    try {
      await refineClient.request(
        `/api/nocobase/collections/${activeCollection.key}/records/${rec.id}`,
        { method: 'PATCH', body: JSON.stringify({ data: { [kanbanField.key]: nextVal } }) }
      );
      await loadRecords(activeCollection.key);
      onNotify(`Статус изменён на «${nextVal}»`);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Не удалось изменить статус', 'err');
    }
  };

  const handleToggleColumnVisible = async (fieldKey: string) => {
    if (!activeCollection || !canSchema) return;
    const nextFields = activeCollection.fields.map((f) =>
      f.key === fieldKey ? { ...f, visibleInTable: !f.visibleInTable } : f
    );
    try {
      await refineClient.request(`/api/nocobase/collections/${activeCollection.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: nextFields }),
      });
      await loadCollections();
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка обновления колонок', 'err');
    }
  };

  const handleTogglePinDashboard = async () => {
    if (!activeCollection || !canSchema) return;
    try {
      await refineClient.request(`/api/nocobase/collections/${activeCollection.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ pinnedToDashboard: !activeCollection.pinnedToDashboard }),
      });
      await loadCollections();
      onNotify(
        activeCollection.pinnedToDashboard
          ? 'Коллекция откреплена от Обзора'
          : 'Коллекция закреплена на экране Обзор'
      );
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка закрепления коллекции', 'err');
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanKey = newColKey.trim().toLowerCase();
      await refineClient.request('/api/nocobase/collections', {
        method: 'POST',
        body: JSON.stringify({
          key: cleanKey,
          title: newColTitle,
          description: newColDesc,
          defaultView: 'table',
          kanbanGroupBy: 'status',
          fields: [
            {
              key: 'title',
              label: newColPrimaryLabel || 'Название',
              type: 'string',
              required: true,
              visibleInTable: true,
            },
            {
              key: 'status',
              label: 'Статус',
              type: 'select',
              required: true,
              visibleInTable: true,
              options: ['Черновик', 'Активно', 'Завершено'],
            },
          ],
        }),
      });
      setNewColOpen(false);
      setNewColTitle('');
      setNewColKey('');
      setNewColDesc('');
      await loadCollections();
      setActiveKey(cleanKey);
      onNotify('Коллекция создана в PostgreSQL');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка создания коллекции', 'err');
    }
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCollection) return;
    try {
      const payload: Record<string, unknown> = {
        key: nfKey.trim().toLowerCase(),
        label: nfLabel.trim(),
        type: nfType,
        required: nfRequired,
        visibleInTable: true,
      };
      if (nfType === 'select') {
        payload.options = nfOptions
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (nfType === 'relation') {
        payload.relationTarget = nfRelationTarget;
      }
      if (nfType === 'formula') {
        payload.formulaExpression = nfFormula.trim();
      }
      await refineClient.request(`/api/nocobase/collections/${activeCollection.key}/fields`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setNewFieldOpen(false);
      setNfKey('');
      setNfLabel('');
      await Promise.all([loadCollections(), loadRecords(activeCollection.key)]);
      onNotify('Поле добавлено в схему коллекции');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка добавления поля', 'err');
    }
  };

  const handleDeleteField = async (fieldKey: string) => {
    if (!activeCollection) return;
    try {
      await refineClient.request(
        `/api/nocobase/collections/${activeCollection.key}/fields/${fieldKey}`,
        { method: 'DELETE' }
      );
      await loadCollections();
      onNotify('Поле удалено из схемы');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Не удалось удалить поле', 'err');
    }
  };

  const handleExportCsv = async () => {
    if (!activeCollection) return;
    try {
      await refineClient.downloadBlob(
        `/api/nocobase/collections/${activeCollection.key}/export.csv`,
        `${activeCollection.key}.csv`
      );
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка экспорта CSV', 'err');
    }
  };

  const calendarGroups = useMemo(() => {
    if (!dateField) return [];
    const map = new Map<string, CollectionRecord[]>();
    for (const rec of filteredRecords) {
      const raw = rec.data[dateField.key];
      const dateKey = raw ? String(raw).slice(0, 10) : 'Без даты';
      const list = map.get(dateKey) || [];
      list.push(rec);
      map.set(dateKey, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [dateField, filteredRecords]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Коллекции данных и Directus CMS"
        subtitle={`Моделирование сущностей NocoBase и визуализация метаданных Directus CMS через ${directusBiConnectorModule.packageName} v${directusBiConnectorModule.version}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setWorkspaceTab('nocobase')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  workspaceTab === 'nocobase'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Database className="h-3.5 w-3.5" /> Коллекции NocoBase
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceTab('directus')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  workspaceTab === 'directus'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" /> Метаданные Directus CMS
              </button>
            </div>
            {workspaceTab === 'nocobase' && canSchema && (
              <button
                type="button"
                onClick={() => setNewColOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" /> Новая коллекция
              </button>
            )}
          </div>
        }
      />

      {workspaceTab === 'directus' ? (
        <DirectusMetadataExplorer
          actor={actor}
          onNotify={onNotify}
          refreshSignal={directusRefreshSignal}
        />
      ) : (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Collection Navigation List */}
        <aside className="rounded-xl border border-slate-200 bg-white p-3 lg:col-span-3">
          <div className="px-2 pb-2 text-xs font-semibold text-slate-500">
            Таблицы данных ({collections.length})
          </div>
          <div className="space-y-1">
            {collections.map((col) => {
              const active = col.key === activeKey;
              return (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => handleSelectCollection(col)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    active
                      ? 'bg-[#0077FF]/8 text-[#0077FF]'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate text-xs font-semibold">
                      <Database className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{col.title}</span>
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-slate-400">
                      {col.key} · {col.fields.length} полей
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-slate-500">
                    {col.recordsCount}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Active Collection Workspace */}
        <section className="space-y-4 lg:col-span-9">
          {!activeCollection ? (
            <EmptyState
              icon={<Database className="h-8 w-8" />}
              title="Нет коллекций данных"
              description="Создайте первую динамическую коллекцию для учёта договоров, заявок или партнёров."
            />
          ) : (
            <>
              {/* Workspace Toolbar */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono text-slate-700">{activeCollection.key}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{records.length} записей</span>
                      {activeCollection.pinnedToDashboard && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-[#0077FF]">На рабочем столе</span>
                        </>
                      )}
                    </div>
                    <h2 className="mt-0.5 text-base font-semibold text-slate-900">
                      {activeCollection.title}
                    </h2>
                    {activeCollection.description && (
                      <p className="mt-0.5 text-xs text-slate-500">{activeCollection.description}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* View Switcher */}
                    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ${
                          viewMode === 'table'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Table2 className="h-3.5 w-3.5" /> Таблица
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('kanban')}
                        disabled={!kanbanField}
                        title={kanbanField ? `Канбан по полю «${kanbanField.label}»` : 'Добавьте поле типа Список'}
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap disabled:opacity-40 ${
                          viewMode === 'kanban'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Columns3 className="h-3.5 w-3.5" /> Канбан
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('calendar')}
                        disabled={!dateField}
                        title={dateField ? `Календарь по полю «${dateField.label}»` : 'Добавьте поле типа Дата'}
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap disabled:opacity-40 ${
                          viewMode === 'calendar'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Calendar className="h-3.5 w-3.5" /> Календарь
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowSchemaDrawer((v) => !v)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                        showSchemaDrawer
                          ? 'border-[#0077FF] bg-blue-50 text-[#0077FF]'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" /> Поля и схема
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleExportCsv()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Download className="h-3.5 w-3.5" /> CSV
                    </button>

                    {canManage && (
                      <button
                        type="button"
                        onClick={openCreateRecordModal}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
                      >
                        <Plus className="h-3.5 w-3.5" /> Добавить запись
                      </button>
                    )}
                  </div>
                </div>

                {/* Search & Quick Schema Controls */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Быстрый поиск по всем полям коллекции..."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#0077FF] focus:bg-white"
                    />
                  </div>
                  {canSchema && (
                    <button
                      type="button"
                      onClick={() => void handleTogglePinDashboard()}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                        activeCollection.pinnedToDashboard
                          ? 'border-[#0077FF]/40 bg-blue-50/50 text-[#0077FF]'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Pin className="h-3.5 w-3.5" />
                      {activeCollection.pinnedToDashboard ? 'Открепить с Обзора' : 'Закрепить в Обзор'}
                    </button>
                  )}
                </div>

                {/* Field Modeler & Column Visibility Panel */}
                {showSchemaDrawer && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-semibold text-slate-900">
                          Конструктор полей и колонок ({activeCollection.fields.length})
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Управляйте полями, формулами и видимостью столбцов без миграций вручную
                        </p>
                      </div>
                      {canSchema && (
                        <button
                          type="button"
                          onClick={() => setNewFieldOpen(true)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#0077FF] px-2.5 py-1 text-xs font-medium text-[#0077FF] hover:bg-blue-50 whitespace-nowrap"
                        >
                          <Plus className="h-3.5 w-3.5" /> Добавить поле
                        </button>
                      )}
                    </div>

                    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Название</th>
                            <th className="px-3 py-2">Ключ</th>
                            <th className="px-3 py-2">Тип</th>
                            <th className="px-3 py-2">Детали (формула / связь / список)</th>
                            <th className="px-3 py-2 text-right">Таблица</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeCollection.fields.map((f) => (
                            <tr key={f.key} className="hover:bg-slate-50">
                              <td className="px-3 py-2 font-medium text-slate-900">
                                {f.label}
                                {f.required && <span className="ml-1 text-red-500">*</span>}
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                                {f.key}
                              </td>
                              <td className="px-3 py-2 text-slate-700">
                                {FIELD_TYPE_LABELS[f.type]}
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                                {f.type === 'formula'
                                  ? f.formulaExpression
                                  : f.type === 'relation'
                                  ? `-> ${f.relationTarget}`
                                  : f.type === 'select'
                                  ? (f.options || []).join(', ')
                                  : '—'}
                              </td>
                              <td className="space-x-1.5 px-3 py-2 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  disabled={!canSchema}
                                  onClick={() => void handleToggleColumnVisible(f.key)}
                                  title={f.visibleInTable ? 'Скрыть колонку' : 'Показать колонку'}
                                  className="inline-flex rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
                                >
                                  {f.visibleInTable ? (
                                    <Eye className="h-3.5 w-3.5" />
                                  ) : (
                                    <EyeOff className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                {canSchema && activeCollection.fields.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteField(f.key)}
                                    title="Удалить поле"
                                    className="inline-flex rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* VIEW 1: TABLE */}
              {viewMode === 'table' && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {loading ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      Загрузка записей...
                    </div>
                  ) : filteredRecords.length === 0 ? (
                    <EmptyState
                      icon={<Table2 className="h-8 w-8" />}
                      title="Записи не найдены"
                      description="Добавьте первую запись в эту коллекцию или измените поисковый запрос."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50 font-medium text-slate-500">
                          <tr>
                            {visibleColumns.map((col) => (
                              <th key={col.key} className="px-4 py-3 whitespace-nowrap">
                                {col.label}
                              </th>
                            ))}
                            <th className="px-4 py-3 text-right">Действия</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredRecords.map((rec) => (
                            <tr key={rec.id} className="hover:bg-slate-50">
                              {visibleColumns.map((col) => {
                                const isNumeric =
                                  col.type === 'number' ||
                                  col.type === 'currency' ||
                                  col.type === 'formula';
                                return (
                                  <td
                                    key={col.key}
                                    className={`px-4 py-3 ${
                                      isNumeric
                                        ? 'font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap'
                                        : 'text-slate-700'
                                    }`}
                                  >
                                    {formatCellValue(col, rec.data[col.key])}
                                  </td>
                                );
                              })}
                              <td className="space-x-1 px-4 py-3 text-right whitespace-nowrap">
                                {canManage && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openEditRecordModal(rec)}
                                      title="Редактировать"
                                      className="inline-flex rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#0077FF]"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteRecord(rec.id)}
                                      title="Удалить"
                                      className="inline-flex rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 2: KANBAN */}
              {viewMode === 'kanban' && kanbanField && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {(kanbanField.options || []).map((option) => {
                    const colRecords = filteredRecords.filter(
                      (r) => String(r.data[kanbanField.key] ?? '') === option
                    );
                    return (
                      <div
                        key={option}
                        className="flex flex-col rounded-xl border border-slate-200 bg-white"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5">
                          <span className="text-xs font-semibold text-slate-900">{option}</span>
                          <span className="font-mono text-xs font-medium text-slate-500 tabular-nums">
                            {colRecords.length}
                          </span>
                        </div>
                        <div className="flex-1 space-y-2.5 p-3">
                          {colRecords.length === 0 ? (
                            <div className="py-6 text-center text-[11px] text-slate-400">
                              Пусто
                            </div>
                          ) : (
                            colRecords.map((rec) => {
                              const titleField = visibleColumns[0];
                              const secondaryFields = visibleColumns
                                .filter((f) => f.key !== titleField?.key && f.key !== kanbanField.key)
                                .slice(0, 3);
                              return (
                                <div
                                  key={rec.id}
                                  className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 transition-colors hover:border-slate-300"
                                >
                                  <div className="text-xs font-semibold text-slate-900">
                                    {titleField
                                      ? formatCellValue(titleField, rec.data[titleField.key])
                                      : rec.id}
                                  </div>
                                  <div className="mt-1.5 space-y-1 text-[11px] text-slate-600">
                                    {secondaryFields.map((sf) => (
                                      <div key={sf.key} className="flex justify-between gap-2">
                                        <span className="truncate text-slate-400">{sf.label}</span>
                                        <span className="truncate font-medium text-slate-800 tabular-nums">
                                          {formatCellValue(sf, rec.data[sf.key])}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  {canManage && (
                                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2">
                                      <select
                                        value={String(rec.data[kanbanField.key] ?? '')}
                                        onChange={(e) =>
                                          void handleMoveKanbanStatus(rec, e.target.value)
                                        }
                                        className="max-w-[140px] rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none"
                                      >
                                        {(kanbanField.options || []).map((opt) => (
                                          <option key={opt} value={opt}>
                                            {opt}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() => openEditRecordModal(rec)}
                                        className="text-[11px] font-medium text-[#0077FF] hover:underline"
                                      >
                                        Открыть
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* VIEW 3: CALENDAR SCHEDULE */}
              {viewMode === 'calendar' && dateField && (
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Календарь по полю «{dateField.label}»
                      </h3>
                      <p className="text-xs text-slate-500">
                        Хронология записей и контрольных дат
                      </p>
                    </div>
                    <span className="font-mono text-xs text-slate-500 tabular-nums">
                      {calendarGroups.length} дат
                    </span>
                  </div>

                  {calendarGroups.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Нет записей с датами
                    </div>
                  ) : (
                    <div className="mt-4 divide-y divide-slate-100">
                      {calendarGroups.map(([dateKey, items]) => (
                        <div key={dateKey} className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-12">
                          <div className="font-mono text-xs font-semibold text-slate-700 tabular-nums sm:col-span-3">
                            {dateKey === 'Без даты'
                              ? 'Без даты'
                              : new Date(dateKey).toLocaleDateString('ru-RU', {
                                  weekday: 'short',
                                  day: '2-digit',
                                  month: 'long',
                                  year: 'numeric',
                                })}
                          </div>
                          <div className="space-y-2 sm:col-span-9">
                            {items.map((rec) => {
                              const primary = visibleColumns[0];
                              return (
                                <div
                                  key={rec.id}
                                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate font-semibold text-slate-900">
                                      {primary
                                        ? formatCellValue(primary, rec.data[primary.key])
                                        : rec.id}
                                    </div>
                                    <div className="mt-0.5 truncate text-[11px] text-slate-500">
                                      {visibleColumns
                                        .slice(1, 4)
                                        .map((f) => `${f.label}: ${formatCellValue(f, rec.data[f.key])}`)
                                        .join(' · ')}
                                    </div>
                                  </div>
                                  {canManage && (
                                    <button
                                      type="button"
                                      onClick={() => openEditRecordModal(rec)}
                                      className="shrink-0 text-xs font-medium text-[#0077FF] hover:underline"
                                    >
                                      Изменить
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
      )}

      {/* Dynamic Record Create / Edit Modal */}
      <Modal
        open={recordModalOpen}
        onClose={() => setRecordModalOpen(false)}
        title={
          editingRecord
            ? `Редактирование записи — ${activeCollection?.title || ''}`
            : `Новая запись — ${activeCollection?.title || ''}`
        }
      >
        <form onSubmit={handleSaveRecord} className="space-y-3">
          {activeCollection?.fields.map((field) => {
            if (field.type === 'formula') {
              return (
                <div
                  key={field.key}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700">{field.label}</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatCellValue(field, previewComputedData[field.key])}
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                    Формула: {field.formulaExpression}
                  </div>
                </div>
              );
            }

            const val = formData[field.key];
            if (field.type === 'boolean') {
              return (
                <label
                  key={field.key}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"
                >
                  <span>{field.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(val)}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, [field.key]: e.target.checked }))
                    }
                    className="h-4 w-4 accent-[#0077FF]"
                  />
                </label>
              );
            }

            if (field.type === 'select') {
              return (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-slate-700">
                    {field.label}
                  </label>
                  <select
                    required={field.required}
                    value={String(val ?? '')}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
                  >
                    {(field.options || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            if (field.type === 'relation') {
              const target = field.relationTarget || 'deals';
              const opts = relationOptions[target] || [];
              return (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-slate-700">
                    {field.label}
                  </label>
                  <select
                    value={String(val ?? '')}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
                  >
                    <option value="">Не выбрано</option>
                    {opts.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            if (field.type === 'text') {
              return (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-slate-700">
                    {field.label}
                  </label>
                  <textarea
                    rows={3}
                    required={field.required}
                    value={String(val ?? '')}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
                  />
                </div>
              );
            }

            return (
              <div key={field.key}>
                <label className="block text-xs font-medium text-slate-700">
                  {field.label}
                  {field.required && <span className="ml-1 text-red-500">*</span>}
                </label>
                <input
                  type={
                    field.type === 'number' || field.type === 'currency'
                      ? 'number'
                      : field.type === 'date'
                      ? 'date'
                      : 'text'
                  }
                  step={field.type === 'number' || field.type === 'currency' ? 'any' : undefined}
                  required={field.required}
                  value={String(val ?? '')}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      [field.key]:
                        field.type === 'number' || field.type === 'currency'
                          ? Number(e.target.value)
                          : e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
                />
              </div>
            );
          })}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRecordModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              {editingRecord ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </Modal>

      {/* New Collection Modal */}
      <Modal
        open={newColOpen}
        onClose={() => setNewColOpen(false)}
        title="Новая No-Code коллекция"
      >
        <form onSubmit={handleCreateCollection} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Название коллекции</label>
            <input
              required
              value={newColTitle}
              onChange={(e) => setNewColTitle(e.target.value)}
              placeholder="Реестр оборудования"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Технический ключ (латиница)
            </label>
            <input
              required
              value={newColKey}
              onChange={(e) => setNewColKey(e.target.value)}
              placeholder="assets_inventory"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-[#0077FF]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Основное поле (заголовок записи)
            </label>
            <input
              required
              value={newColPrimaryLabel}
              onChange={(e) => setNewColPrimaryLabel(e.target.value)}
              placeholder="Наименование актива"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Описание</label>
            <textarea
              rows={2}
              value={newColDesc}
              onChange={(e) => setNewColDesc(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setNewColOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Создать коллекцию
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Field Modal */}
      <Modal
        open={newFieldOpen}
        onClose={() => setNewFieldOpen(false)}
        title={`Добавить поле в «${activeCollection?.title || ''}»`}
      >
        <form onSubmit={handleAddField} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Название поля</label>
              <input
                required
                value={nfLabel}
                onChange={(e) => setNfLabel(e.target.value)}
                placeholder="Скидка %"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Ключ поля</label>
              <input
                required
                value={nfKey}
                onChange={(e) => setNfKey(e.target.value)}
                placeholder="discount_pct"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-[#0077FF]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Тип данных</label>
            <select
              value={nfType}
              onChange={(e) => setNfType(e.target.value as CollectionFieldType)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
            >
              {COLLECTION_FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FIELD_TYPE_LABELS[t]} ({t})
                </option>
              ))}
            </select>
          </div>

          {nfType === 'select' && (
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Варианты через запятую
              </label>
              <input
                value={nfOptions}
                onChange={(e) => setNfOptions(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
              />
            </div>
          )}

          {nfType === 'relation' && (
            <div>
              <label className="block text-xs font-medium text-slate-700">Связанная сущность</label>
              <select
                value={nfRelationTarget}
                onChange={(e) =>
                  setNfRelationTarget(e.target.value as 'deals' | 'contacts' | 'companies')
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
              >
                <option value="deals">Сделки (deals)</option>
                <option value="contacts">Контакты (contacts)</option>
                <option value="companies">Компании (companies)</option>
              </select>
            </div>
          )}

          {nfType === 'formula' && (
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Выражение формулы (используйте {'{ключ_поля}'})
              </label>
              <input
                required
                value={nfFormula}
                onChange={(e) => setNfFormula(e.target.value)}
                placeholder="{amount} * 0.2"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-[#0077FF]"
              />
            </div>
          )}

          {nfType !== 'formula' && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={nfRequired}
                onChange={(e) => setNfRequired(e.target.checked)}
                className="h-4 w-4 accent-[#0077FF]"
              />
              Обязательное поле
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setNewFieldOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Добавить поле
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
