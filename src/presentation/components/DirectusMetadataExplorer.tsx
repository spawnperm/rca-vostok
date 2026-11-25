import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Braces,
  Database,
  Download,
  FileText,
  Layers,
  RefreshCw,
  Search,
  Shield,
  Table2,
} from 'lucide-react';
import {
  directusBiConnectorModule,
  type DirectusContentMetadataSnapshot,
} from '@nexus-plugins/directus-bi-connector';
import { refineClient } from '../../application/refine/client.ts';
import type { AuthenticatedActor } from '../../domain/shared/types.ts';
import { formatDateTimeRu, getErrorMessage } from '../../shared/formatters.ts';
import { EmptyState } from './ui/EmptyState.tsx';
import { DIRECTUS_SECTION_LABELS } from './DirectusMetadataCharts.tsx';

const DirectusMetadataCharts = React.lazy(() =>
  import('./DirectusMetadataCharts.tsx').then((mod) => ({ default: mod.DirectusMetadataCharts }))
);

interface DirectusMetadataSnapshotResponse extends DirectusContentMetadataSnapshot {
  pluginInstalled: boolean;
  pluginEnabled: boolean;
  database?: {
    engine?: string;
    mode?: string;
  };
}

interface DirectusPreviewResponse {
  collection: string;
  biCollection: string;
  totalRows: number;
  hiddenFieldsApplied: string[];
  redactedFieldsPerRow: number;
  items: Array<Record<string, unknown>>;
}

interface DirectusMetadataExplorerProps {
  actor: AuthenticatedActor;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
  refreshSignal?: number;
}

type ExplorerMode = 'charts' | 'inspector';
type InspectorTab = 'fields' | 'projection' | 'cms_content';

export const DirectusMetadataExplorer: React.FC<DirectusMetadataExplorerProps> = ({
  actor,
  onNotify,
  refreshSignal = 0,
}) => {
  const canSync =
    refineClient.can(actor, 'collections:manage') ||
    refineClient.can(actor, 'cms:edit') ||
    refineClient.can(actor, 'tenants:admin');

  const [snapshot, setSnapshot] = useState<DirectusMetadataSnapshotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [explorerMode, setExplorerMode] = useState<ExplorerMode>('charts');
  const [searchQuery, setSearchQuery] = useState('');
  const [contextFilter, setContextFilter] = useState('all');
  const [selectedCollectionName, setSelectedCollectionName] = useState<string>('');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('fields');

  const [preview, setPreview] = useState<DirectusPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [cmsSectionFilter, setCmsSectionFilter] = useState('all');

  const loadMetadata = useCallback(async () => {
    setLoading(true);
    try {
      const res = await refineClient.request<DirectusMetadataSnapshotResponse>('/api/directus/metadata');
      setSnapshot(res);
      setSelectedCollectionName((prev) => {
        if (prev && res.collections.some((c) => c.collection === prev)) {
          return prev;
        }
        return res.collections[0]?.collection || '';
      });
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка извлечения метаданных Directus CMS'), 'err');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    void loadMetadata();
  }, [actor.tenantId, refreshSignal, loadMetadata]);

  const loadPreview = useCallback(
    async (collectionName: string) => {
      if (!collectionName) {
        setPreview(null);
        return;
      }
      setPreviewLoading(true);
      try {
        const res = await refineClient.request<DirectusPreviewResponse>(
          `/api/directus/metadata/${encodeURIComponent(collectionName)}/preview`
        );
        setPreview(res);
      } catch (err: unknown) {
        setPreview(null);
        onNotify(getErrorMessage(err, 'Ошибка загрузки BI-проекции коллекции'), 'err');
      } finally {
        setPreviewLoading(false);
      }
    },
    [onNotify]
  );

  useEffect(() => {
    if (explorerMode === 'inspector' && inspectorTab === 'projection' && selectedCollectionName) {
      void loadPreview(selectedCollectionName);
    }
  }, [explorerMode, inspectorTab, selectedCollectionName, loadPreview]);

  const handleSync = async () => {
    if (!canSync) return;
    setSyncing(true);
    try {
      const res = await refineClient.request<{
        syncedAt: string;
        pluginInstalled: boolean;
        pluginEnabled: boolean;
        snapshot: DirectusContentMetadataSnapshot;
      }>('/api/directus/sync', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setSnapshot({
        ...res.snapshot,
        pluginInstalled: res.pluginInstalled,
        pluginEnabled: res.pluginEnabled,
      });
      if (explorerMode === 'inspector' && inspectorTab === 'projection' && selectedCollectionName) {
        await loadPreview(selectedCollectionName);
      }
      onNotify(
        `Метаданные Directus CMS синхронизированы через ${directusBiConnectorModule.packageName}`
      );
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка синхронизации Directus BI'), 'err');
    } finally {
      setSyncing(false);
    }
  };

  const handleExportMetadataJson = () => {
    if (!snapshot) return;
    refineClient.downloadJson(
      snapshot,
      `directus-metadata-${actor.tenantId}-${new Date().toISOString().slice(0, 10)}.json`
    );
    onNotify('Схема метаданных Directus CMS сохранена в JSON');
  };

  const handleInspectFromCharts = useCallback(
    (collectionName: string, tab: InspectorTab = 'fields') => {
      setSelectedCollectionName(collectionName);
      setInspectorTab(tab);
      setExplorerMode('inspector');
    },
    []
  );

  const availableContexts = useMemo(() => {
    if (!snapshot) return [];
    return [...new Set(snapshot.collections.map((c) => c.boundedContext))];
  }, [snapshot]);

  const filteredCollections = useMemo(() => {
    if (!snapshot) return [];
    const q = searchQuery.trim().toLowerCase();
    return snapshot.collections.filter((col) => {
      if (contextFilter !== 'all' && col.boundedContext !== contextFilter) return false;
      if (!q) return true;
      return (
        col.collection.toLowerCase().includes(q) ||
        col.biCollection.toLowerCase().includes(q) ||
        col.displayName.toLowerCase().includes(q) ||
        col.boundedContext.toLowerCase().includes(q)
      );
    });
  }, [snapshot, searchQuery, contextFilter]);

  const selectedCollection = useMemo(() => {
    if (!snapshot) return null;
    return (
      snapshot.collections.find((c) => c.collection === selectedCollectionName) ||
      filteredCollections[0] ||
      null
    );
  }, [snapshot, selectedCollectionName, filteredCollections]);

  const filteredCmsItems = useMemo(() => {
    if (!snapshot) return [];
    if (cmsSectionFilter === 'all') return snapshot.contentItems;
    return snapshot.contentItems.filter((item) => item.sectionType === cmsSectionFilter);
  }, [snapshot, cmsSectionFilter]);

  if (loading && !snapshot) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-14 text-center text-xs text-slate-500">
        Извлечение метаданных контента через {directusBiConnectorModule.packageName}...
      </div>
    );
  }

  if (!snapshot) {
    return (
      <EmptyState
        icon={<Database className="h-8 w-8" />}
        title="Метаданные Directus CMS недоступны"
        description="Проверьте права доступа или повторите синхронизацию коннектора Directus BI."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Connector Toolbar & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setExplorerMode('charts')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                explorerMode === 'charts'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Графики и таблицы BI
            </button>
            <button
              type="button"
              onClick={() => setExplorerMode('inspector')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                explorerMode === 'inspector'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table2 className="h-3.5 w-3.5" />
              Инспектор схем и ACL
            </button>
          </div>

          <div className="text-xs text-slate-500">
            <span className="font-mono font-medium text-slate-700">
              {snapshot.connectorPackage}@{snapshot.connectorVersion}
            </span>
            <span className="mx-1.5" aria-hidden="true">
              ·
            </span>
            <span>{directusBiConnectorModule.contextMapping}</span>
            {snapshot.graphqlEndpoint && (
              <>
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  {snapshot.graphqlEndpoint}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-500 tabular-nums">
            Снимок: {formatDateTimeRu(snapshot.extractedAt)}
          </span>
          <button
            type="button"
            onClick={handleExportMetadataJson}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" /> Экспорт JSON
          </button>
          {canSync && (
            <button
              type="button"
              disabled={syncing}
              onClick={() => void handleSync()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Синхронизация...' : 'Синхронизировать BI'}
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip: single-elevation flat cards with tabular numerals */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Коллекций в схеме Directus</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {snapshot.summary.totalCollections}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {snapshot.summary.totalFields} описанных полей
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Записей под контролем ACL</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {snapshot.summary.totalRecords.toLocaleString('ru-RU')}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Проекция в витрину <span className="font-mono">bi_*</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Контент Directus CMS</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {snapshot.summary.cmsBlocksPublished} / {snapshot.summary.cmsBlocksTotal}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            Опубликовано · Черновиков: {snapshot.summary.cmsBlocksDraft}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Коннектор Directus BI</div>
          <div className="mt-1 text-base font-semibold text-slate-900">
            {snapshot.sourceMode === 'directus-live'
              ? 'Live Directus REST API'
              : 'PostgreSQL Introspection'}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            Интервал {snapshot.syncSchedule.intervalSec}с · GraphQL{' '}
            {snapshot.syncSchedule.exposeGraphQL ? 'вкл' : 'выкл'}
          </div>
        </div>
      </div>

      {explorerMode === 'charts' ? (
        <Suspense
          fallback={
            <div className="rounded-xl border border-slate-200 bg-white py-14 text-center text-xs text-slate-500">
              Загрузка графиков и таблиц Directus CMS (Recharts)...
            </div>
          }
        >
          <DirectusMetadataCharts
            snapshot={snapshot}
            selectedCollectionName={selectedCollectionName}
            onInspectCollection={handleInspectFromCharts}
          />
        </Suspense>
      ) : (
        /* Master-Detail Directus Metadata Inspector */
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left List: Extracted Directus Collections */}
          <aside className="rounded-xl border border-slate-200 bg-white p-3 lg:col-span-4">
            <div className="space-y-2 pb-3">
              <div className="flex items-center justify-between px-1 text-xs font-semibold text-slate-600">
                <span>Схемы Directus ({filteredCollections.length})</span>
                <span className="font-mono text-[11px] font-normal text-slate-400">
                  v{snapshot.connectorVersion}
                </span>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск коллекции или BI DTO..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#0077FF] focus:bg-white"
                />
              </div>

              <select
                value={contextFilter}
                onChange={(e) => setContextFilter(e.target.value)}
                aria-label="Фильтр по контексту"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0077FF]"
              >
                <option value="all">Все контексты ({snapshot.collections.length})</option>
                {availableContexts.map((ctx) => (
                  <option key={ctx} value={ctx}>
                    {ctx}
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-[540px] divide-y divide-slate-100 overflow-y-auto border-t border-slate-100">
              {filteredCollections.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Коллекции не найдены
                </div>
              ) : (
                filteredCollections.map((col) => {
                  const isSelected = selectedCollection?.collection === col.collection;
                  return (
                    <button
                      key={col.collection}
                      type="button"
                      onClick={() => setSelectedCollectionName(col.collection)}
                      className={`flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? 'bg-[#0077FF]/8 text-[#0077FF]'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold">{col.displayName}</div>
                        <div className="mt-0.5 truncate font-mono text-[11px] text-slate-400">
                          {col.collection} → {col.biCollection}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-slate-500">
                          {col.boundedContext} · {col.fieldsCount} полей
                        </div>
                      </div>
                      <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-slate-500">
                        {col.recordsCount}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Right Detail: Selected Collection Metadata + BI Projection + CMS Content */}
          <section className="space-y-4 lg:col-span-8">
            {!selectedCollection ? (
              <EmptyState
                icon={<Layers className="h-8 w-8" />}
                title="Выберите коллекцию Directus"
                description="Откройте любую коллекцию слева для просмотра структуры полей, ACL-маскирования и метаданных контента."
              />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white">
                {/* Inspector Header */}
                <div className="border-b border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono text-slate-700">
                          {selectedCollection.collection}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[#0077FF]">
                          {selectedCollection.biCollection}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{selectedCollection.boundedContext}</span>
                        <span aria-hidden="true">·</span>
                        <span>{selectedCollection.schemaValidatedBy}</span>
                      </div>
                      <h2 className="mt-1 text-base font-semibold text-slate-900">
                        {selectedCollection.displayName}
                      </h2>
                      {selectedCollection.note && (
                        <p className="mt-0.5 text-xs text-slate-500">{selectedCollection.note}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setExplorerMode('charts')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
                    >
                      <BarChart3 className="h-3.5 w-3.5 text-[#0077FF]" /> К графикам Recharts
                    </button>
                  </div>

                  {/* Sub-tabs */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => setInspectorTab('fields')}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                          inspectorTab === 'fields'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Table2 className="h-3.5 w-3.5" />
                        Схема полей ({selectedCollection.fieldsCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectorTab('projection')}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                          inspectorTab === 'projection'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Shield className="h-3.5 w-3.5" />
                        BI-проекция и ACL
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectorTab('cms_content')}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                          inspectorTab === 'cms_content'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Контент CMS ({snapshot.contentItems.length})
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-500 tabular-nums">
                      Обновлено: {formatDateTimeRu(snapshot.extractedAt)} ·{' '}
                      <span className="font-mono">{snapshot.directusEndpoint}</span>
                    </div>
                  </div>
                </div>

                {/* TAB 1: Directus Schema Fields */}
                {inspectorTab === 'fields' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 font-medium text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">Поле</th>
                          <th className="px-4 py-2.5">Тип</th>
                          <th className="px-4 py-2.5">Интерфейс Directus</th>
                          <th className="px-4 py-2.5">ACL и ограничения</th>
                          <th className="px-4 py-2.5">Описание</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedCollection.fields.map((f) => (
                          <tr key={f.field} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-mono font-semibold text-slate-900 whitespace-nowrap">
                              {f.field}
                              {f.required && <span className="ml-1 text-red-600">*</span>}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-slate-600 whitespace-nowrap">
                              {f.type}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-slate-600 whitespace-nowrap">
                              {f.interface}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              {f.hidden ? (
                                <span className="font-medium text-amber-700">
                                  Скрыто ACL ([REDACTED_ACL])
                                </span>
                              ) : f.readonly ? (
                                <span className="text-slate-500">Только чтение</span>
                              ) : (
                                <span className="text-emerald-700">Открыто в BI</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-slate-600">{f.note || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* TAB 2: ACL-Protected BI Projection Preview */}
                {inspectorTab === 'projection' && (
                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-slate-600">
                        Модуль{' '}
                        <span className="font-mono font-medium">
                          {directusBiConnectorModule.packageName}
                        </span>{' '}
                        применил маску ACL к полям:{' '}
                        <span className="font-mono text-slate-900">
                          {preview?.hiddenFieldsApplied.join(', ') || 'passwordHash, phone, email'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowRawJson((v) => !v)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        <Braces className="h-3.5 w-3.5" />
                        {showRawJson ? 'Таблица' : 'JSON DTO'}
                      </button>
                    </div>

                    {previewLoading ? (
                      <div className="py-10 text-center text-xs text-slate-400">
                        Построение BI-проекции...
                      </div>
                    ) : !preview || preview.items.length === 0 ? (
                      <EmptyState
                        icon={<Database className="h-7 w-7" />}
                        title="Нет записей для предпросмотра"
                        description="Добавьте записи в выбранную коллекцию, чтобы увидеть их BI-проекцию."
                      />
                    ) : showRawJson ? (
                      <pre className="max-h-[420px] overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3.5 font-mono text-[11px] leading-relaxed text-slate-100">
                        {JSON.stringify(preview, null, 2)}
                      </pre>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-slate-200 bg-slate-50 font-medium text-slate-500">
                            <tr>
                              {Object.keys(preview.items[0]).map((key) => (
                                <th key={key} className="px-3 py-2 font-mono whitespace-nowrap">
                                  {key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {preview.items.map((row, idx) => (
                              <tr key={String(row.id || idx)} className="hover:bg-slate-50">
                                {Object.keys(preview.items[0]).map((key) => {
                                  const val = row[key];
                                  const isRedacted = val === '[REDACTED_ACL]';
                                  const display =
                                    typeof val === 'boolean'
                                      ? val
                                        ? 'Да'
                                        : 'Нет'
                                      : val === null || val === undefined || val === ''
                                      ? '—'
                                      : String(val);
                                  return (
                                    <td
                                      key={key}
                                      className={`max-w-[240px] truncate px-3 py-2 ${
                                        isRedacted
                                          ? 'font-mono font-medium text-amber-700'
                                          : typeof val === 'number'
                                          ? 'font-mono font-semibold text-slate-900 tabular-nums'
                                          : 'text-slate-700'
                                      }`}
                                    >
                                      {display}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: Directus CMS Content Blocks Metadata */}
                {inspectorTab === 'cms_content' && (
                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-slate-600">
                        Реестр контента Directus / TinaCMS ({filteredCmsItems.length} блоков)
                      </div>
                      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
                        <button
                          type="button"
                          onClick={() => setCmsSectionFilter('all')}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                            cmsSectionFilter === 'all'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Все ({snapshot.contentItems.length})
                        </button>
                        {snapshot.summary.sectionBreakdown.map((sec) => (
                          <button
                            key={sec.sectionType}
                            type="button"
                            onClick={() => setCmsSectionFilter(sec.sectionType)}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                              cmsSectionFilter === sec.sectionType
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {DIRECTUS_SECTION_LABELS[sec.sectionType] || sec.sectionType} (
                            {sec.count})
                          </button>
                        ))}
                      </div>
                    </div>

                    {filteredCmsItems.length === 0 ? (
                      <EmptyState
                        icon={<FileText className="h-7 w-7" />}
                        title="Контентные блоки не найдены"
                        description="Создайте блоки контента в разделе Администрирование -> Directus и TinaCMS."
                      />
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-slate-200 bg-slate-50 font-medium text-slate-500">
                            <tr>
                              <th className="px-3 py-2.5">Заголовок и фрагмент</th>
                              <th className="px-3 py-2.5">Slug</th>
                              <th className="px-3 py-2.5">Секция</th>
                              <th className="px-3 py-2.5">Статус</th>
                              <th className="px-3 py-2.5 text-right">Обновлён</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredCmsItems.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50">
                                <td className="max-w-[300px] px-3 py-2.5">
                                  <div className="font-semibold text-slate-900">{item.title}</div>
                                  <div className="mt-0.5 truncate text-[11px] text-slate-500">
                                    {item.bodyPreview}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                                  {item.slug}
                                </td>
                                <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                                  {DIRECTUS_SECTION_LABELS[item.sectionType] || item.sectionType}
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  {item.published ? (
                                    <span className="font-medium text-emerald-700">
                                      Опубликован
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">Черновик</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                                  {formatDateTimeRu(item.updatedAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
