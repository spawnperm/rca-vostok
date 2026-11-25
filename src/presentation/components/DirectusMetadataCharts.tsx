import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowUpRight,
  BarChart3,
  Database,
  FileText,
  Layers,
  Search,
  Shield,
} from 'lucide-react';
import {
  directusBiConnectorModule,
  type DirectusCollectionMetadata,
  type DirectusContentMetadataSnapshot,
} from '@nexus-plugins/directus-bi-connector';
import { formatDateTimeRu } from '../../shared/formatters.ts';

export const DIRECTUS_SECTION_LABELS: Record<string, string> = {
  hero: 'Hero-секция',
  playbook: 'Плейбук',
  onboarding: 'Онбординг',
  announcement: 'Объявление',
  release: 'Релиз',
  faq: 'FAQ',
};

const FIELD_TYPE_COLORS: Record<string, string> = {
  string: '#0077FF',
  integer: '#10B981',
  float: '#0EA5E9',
  boolean: '#8B5CF6',
  timestamp: '#F59E0B',
  text: '#64748B',
};

const FALLBACK_PALETTE = ['#0077FF', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#0EA5E9', '#64748B'];

export interface DirectusCollectionChartItem {
  collection: string;
  biCollection: string;
  displayName: string;
  shortName: string;
  boundedContext: string;
  source: DirectusCollectionMetadata['source'];
  schemaValidatedBy: string;
  recordsCount: number;
  fieldsCount: number;
  requiredFieldsCount: number;
  hiddenFieldsCount: number;
  readonlyFieldsCount: number;
  redactedSampleCount: number;
  lastUpdatedAt: string;
}

export interface DirectusContextChartItem {
  boundedContext: string;
  shortContext: string;
  collectionsCount: number;
  totalRecords: number;
  totalFields: number;
  hiddenFieldsCount: number;
}

export interface DirectusFieldTypeChartItem {
  type: string;
  count: number;
  requiredCount: number;
  hiddenCount: number;
  color: string;
}

export interface DirectusAclExposureItem {
  name: string;
  count: number;
  color: string;
}

export interface DirectusCmsSectionChartItem {
  sectionType: string;
  label: string;
  total: number;
  published: number;
  draft: number;
}

export interface DirectusMetadataChartsData {
  collectionMetrics: DirectusCollectionChartItem[];
  contextMetrics: DirectusContextChartItem[];
  fieldTypeMetrics: DirectusFieldTypeChartItem[];
  aclExposure: DirectusAclExposureItem[];
  cmsSectionMetrics: DirectusCmsSectionChartItem[];
  totals: {
    totalCollections: number;
    totalFields: number;
    totalRecords: number;
    hiddenFieldsTotal: number;
    requiredFieldsTotal: number;
    readonlyFieldsTotal: number;
    aclProtectedCollectionsCount: number;
    publishRatePct: number;
  };
}

function truncateLabel(value: string, maxLen = 16): string {
  return value.length > maxLen ? `${value.slice(0, maxLen - 1)}…` : value;
}

export function computeDirectusMetadataChartsData(
  snapshot: DirectusContentMetadataSnapshot
): DirectusMetadataChartsData {
  const collectionMetrics: DirectusCollectionChartItem[] = snapshot.collections.map((col) => {
    const requiredFieldsCount = col.fields.filter((f) => f.required).length;
    const hiddenFieldsCount = col.fields.filter((f) => f.hidden).length;
    const readonlyFieldsCount = col.fields.filter((f) => f.readonly).length;
    return {
      collection: col.collection,
      biCollection: col.biCollection,
      displayName: col.displayName,
      shortName: truncateLabel(col.collection, 15),
      boundedContext: col.boundedContext,
      source: col.source,
      schemaValidatedBy: col.schemaValidatedBy,
      recordsCount: col.recordsCount,
      fieldsCount: col.fieldsCount,
      requiredFieldsCount,
      hiddenFieldsCount,
      readonlyFieldsCount,
      redactedSampleCount: col.sampleProjection?.redactedFieldsCount ?? hiddenFieldsCount,
      lastUpdatedAt: col.lastUpdatedAt,
    };
  });

  const contextMap = new Map<string, DirectusContextChartItem>();
  for (const item of collectionMetrics) {
    const existing = contextMap.get(item.boundedContext) || {
      boundedContext: item.boundedContext,
      shortContext: truncateLabel(item.boundedContext, 18),
      collectionsCount: 0,
      totalRecords: 0,
      totalFields: 0,
      hiddenFieldsCount: 0,
    };
    existing.collectionsCount += 1;
    existing.totalRecords += item.recordsCount;
    existing.totalFields += item.fieldsCount;
    existing.hiddenFieldsCount += item.hiddenFieldsCount;
    contextMap.set(item.boundedContext, existing);
  }
  const contextMetrics = [...contextMap.values()].sort(
    (a, b) => b.totalRecords - a.totalRecords || b.totalFields - a.totalFields
  );

  const typeMap = new Map<string, { count: number; requiredCount: number; hiddenCount: number }>();
  let hiddenFieldsTotal = 0;
  let requiredFieldsTotal = 0;
  let readonlyFieldsTotal = 0;
  let openBiFieldsTotal = 0;

  for (const col of snapshot.collections) {
    for (const field of col.fields) {
      const cur = typeMap.get(field.type) || { count: 0, requiredCount: 0, hiddenCount: 0 };
      cur.count += 1;
      if (field.required) {
        cur.requiredCount += 1;
        requiredFieldsTotal += 1;
      }
      if (field.hidden) {
        cur.hiddenCount += 1;
        hiddenFieldsTotal += 1;
      } else if (field.readonly) {
        readonlyFieldsTotal += 1;
      } else {
        openBiFieldsTotal += 1;
      }
      typeMap.set(field.type, cur);
    }
  }

  const fieldTypeMetrics: DirectusFieldTypeChartItem[] = [...typeMap.entries()]
    .map(([type, stats], index) => ({
      type,
      count: stats.count,
      requiredCount: stats.requiredCount,
      hiddenCount: stats.hiddenCount,
      color: FIELD_TYPE_COLORS[type] || FALLBACK_PALETTE[index % FALLBACK_PALETTE.length],
    }))
    .sort((a, b) => b.count - a.count);

  const aclExposure: DirectusAclExposureItem[] = [
    { name: 'Открыто в BI DTO', count: openBiFieldsTotal, color: '#16A34A' },
    { name: 'Только чтение / системные', count: readonlyFieldsTotal, color: '#0077FF' },
    { name: 'Скрыто ACL ([REDACTED_ACL])', count: hiddenFieldsTotal, color: '#D97706' },
  ].filter((item) => item.count > 0);

  const cmsSectionMetrics: DirectusCmsSectionChartItem[] = snapshot.summary.sectionBreakdown.map(
    (sec) => ({
      sectionType: sec.sectionType,
      label: DIRECTUS_SECTION_LABELS[sec.sectionType] || sec.sectionType,
      total: sec.count,
      published: sec.publishedCount,
      draft: Math.max(0, sec.count - sec.publishedCount),
    })
  );

  const totalFields = snapshot.collections.reduce((sum, c) => sum + c.fieldsCount, 0);
  const totalRecords = snapshot.collections.reduce((sum, c) => sum + c.recordsCount, 0);
  const aclProtectedCollectionsCount = collectionMetrics.filter(
    (c) => c.hiddenFieldsCount > 0 || c.redactedSampleCount > 0
  ).length;
  const publishRatePct =
    snapshot.summary.cmsBlocksTotal > 0
      ? Math.round((snapshot.summary.cmsBlocksPublished / snapshot.summary.cmsBlocksTotal) * 100)
      : 0;

  return {
    collectionMetrics,
    contextMetrics,
    fieldTypeMetrics,
    aclExposure,
    cmsSectionMetrics,
    totals: {
      totalCollections: snapshot.collections.length,
      totalFields,
      totalRecords,
      hiddenFieldsTotal,
      requiredFieldsTotal,
      readonlyFieldsTotal,
      aclProtectedCollectionsCount,
      publishRatePct,
    },
  };
}

interface DirectusMetadataChartsProps {
  snapshot: DirectusContentMetadataSnapshot;
  selectedCollectionName?: string;
  onInspectCollection?: (collectionName: string, tab?: 'fields' | 'projection' | 'cms_content') => void;
}

export const DirectusMetadataCharts: React.FC<DirectusMetadataChartsProps> = ({
  snapshot,
  selectedCollectionName,
  onInspectCollection,
}) => {
  const [tableSearch, setTableSearch] = useState('');
  const [contextFilter, setContextFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'records' | 'fields' | 'name'>('records');

  const chartsData = useMemo(() => computeDirectusMetadataChartsData(snapshot), [snapshot]);

  const filteredTableRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    const list = chartsData.collectionMetrics.filter((row) => {
      if (contextFilter !== 'all' && row.boundedContext !== contextFilter) return false;
      if (!q) return true;
      return (
        row.collection.toLowerCase().includes(q) ||
        row.biCollection.toLowerCase().includes(q) ||
        row.displayName.toLowerCase().includes(q) ||
        row.boundedContext.toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => {
      if (sortBy === 'fields') return b.fieldsCount - a.fieldsCount || b.recordsCount - a.recordsCount;
      if (sortBy === 'name') return a.collection.localeCompare(b.collection);
      return b.recordsCount - a.recordsCount || b.fieldsCount - a.fieldsCount;
    });
  }, [chartsData.collectionMetrics, tableSearch, contextFilter, sortBy]);

  return (
    <div className="space-y-4">
      {/* Row 1: Collections Records vs Fields ComposedChart + CMS Content Sections Stacked BarChart */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Объём записей и плотность схемы коллекций Directus (Recharts)
              </h3>
              <p className="text-[11px] text-slate-500">
                Столбцы — записи в коллекциях · Линия — количество полей в BI DTO (нажмите для инспекции)
              </p>
            </div>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500">
              <BarChart3 className="h-3.5 w-3.5 text-[#0077FF]" />
              {directusBiConnectorModule.packageName}
            </span>
          </div>

          {chartsData.collectionMetrics.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Нет коллекций Directus для визуализации
            </div>
          ) : (
            <div className="mt-3 h-[280px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartsData.collectionMetrics}
                  margin={{ top: 10, right: 12, left: 0, bottom: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fontSize: 11, fill: '#475569' }}
                    interval={0}
                    angle={chartsData.collectionMetrics.length > 6 ? -18 : 0}
                    textAnchor={chartsData.collectionMetrics.length > 6 ? 'end' : 'middle'}
                    height={chartsData.collectionMetrics.length > 6 ? 48 : 30}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <YAxis
                    yAxisId="records"
                    tick={{ fontSize: 11, fill: '#475569' }}
                    allowDecimals={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <YAxis
                    yAxisId="fields"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#10B981' }}
                    allowDecimals={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const row = payload[0]?.payload as DirectusCollectionChartItem;
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                          <div className="font-semibold text-slate-900">{row.displayName}</div>
                          <div className="font-mono text-[11px] text-[#0077FF]">
                            {row.collection} → {row.biCollection}
                          </div>
                          <div className="mt-1.5 space-y-0.5 text-slate-600">
                            <div>
                              Контекст: <strong className="text-slate-900">{row.boundedContext}</strong>
                            </div>
                            <div>
                              Записей: <strong className="text-slate-900">{row.recordsCount}</strong> ·
                              Полей: <strong className="text-emerald-700">{row.fieldsCount}</strong>
                            </div>
                            <div>
                              Обязательных: <strong>{row.requiredFieldsCount}</strong> · Скрыто ACL:{' '}
                              <strong className="text-amber-700">{row.hiddenFieldsCount}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    yAxisId="records"
                    dataKey="recordsCount"
                    name="Записей"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={38}
                    cursor="pointer"
                    onClick={(data) => {
                      const col = (data as unknown as DirectusCollectionChartItem)?.collection;
                      if (col && onInspectCollection) onInspectCollection(col, 'projection');
                    }}
                  >
                    {chartsData.collectionMetrics.map((entry) => (
                      <Cell
                        key={entry.collection}
                        fill={
                          entry.collection === selectedCollectionName ? '#0055CC' : '#0077FF'
                        }
                        fillOpacity={entry.collection === selectedCollectionName ? 1 : 0.85}
                      />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="fields"
                    type="monotone"
                    dataKey="fieldsCount"
                    name="Полей схемы"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#10B981', stroke: '#FFFFFF', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-5">
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Контентные блоки Directus CMS по секциям
              </h3>
              <p className="text-[11px] text-slate-500">
                Публикация {chartsData.totals.publishRatePct}% ({snapshot.summary.cmsBlocksPublished}{' '}
                из {snapshot.summary.cmsBlocksTotal} блоков)
              </p>
            </div>
            <FileText className="h-4 w-4 text-slate-400" />
          </div>

          {chartsData.cmsSectionMetrics.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Контентные блоки CMS отсутствуют
            </div>
          ) : (
            <div className="mt-3 h-[280px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartsData.cmsSectionMetrics}
                  margin={{ top: 10, right: 12, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#475569' }}
                    interval={0}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#475569' }}
                    allowDecimals={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const row = payload[0]?.payload as DirectusCmsSectionChartItem;
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                          <div className="font-semibold text-slate-900">{row.label}</div>
                          <div className="mt-1 space-y-0.5 text-slate-600">
                            <div>
                              Всего блоков: <strong className="text-slate-900">{row.total}</strong>
                            </div>
                            <div>
                              Опубликовано:{' '}
                              <strong className="text-emerald-700">{row.published}</strong>
                            </div>
                            <div>
                              Черновики: <strong className="text-slate-700">{row.draft}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="published"
                    name="Опубликовано"
                    stackId="cms"
                    fill="#16A34A"
                    radius={[0, 0, 0, 0]}
                    maxBarSize={42}
                  />
                  <Bar
                    dataKey="draft"
                    name="Черновик"
                    stackId="cms"
                    fill="#94A3B8"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={42}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: DDD Bounded Contexts Distribution BarChart + Field Types & ACL PieChart */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-6">
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Распределение метаданных по Bounded Contexts
              </h3>
              <p className="text-[11px] text-slate-500">
                Записи, поля и защищённые ACL-атрибуты в разрезе доменных контекстов
              </p>
            </div>
            <Layers className="h-4 w-4 text-slate-400" />
          </div>

          {chartsData.contextMetrics.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">Нет доменных контекстов</div>
          ) : (
            <div className="mt-3 h-[240px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartsData.contextMetrics}
                  margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="shortContext"
                    tick={{ fontSize: 11, fill: '#475569' }}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const row = payload[0]?.payload as DirectusContextChartItem;
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                          <div className="font-semibold text-slate-900">{row.boundedContext}</div>
                          <div className="mt-1 space-y-0.5 text-slate-600">
                            <div>
                              Коллекций: <strong className="text-slate-900">{row.collectionsCount}</strong>
                            </div>
                            <div>
                              Записей: <strong className="text-[#0077FF]">{row.totalRecords}</strong>
                            </div>
                            <div>
                              Полей: <strong className="text-emerald-700">{row.totalFields}</strong>
                            </div>
                            <div>
                              Маскируется ACL:{' '}
                              <strong className="text-amber-700">{row.hiddenFieldsCount}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="totalRecords"
                    name="Записей"
                    fill="#0077FF"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="totalFields"
                    name="Полей"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="hiddenFieldsCount"
                    name="ACL-полей"
                    fill="#F59E0B"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-6">
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Типы полей Directus и покрытие ACL BI-витрины
              </h3>
              <p className="text-[11px] text-slate-500">
                Всего {chartsData.totals.totalFields} полей · Обязательных:{' '}
                {chartsData.totals.requiredFieldsTotal} · ACL-масок:{' '}
                {chartsData.totals.hiddenFieldsTotal}
              </p>
            </div>
            <Shield className="h-4 w-4 text-amber-600" />
          </div>

          <div className="mt-3 grid grid-cols-1 items-center gap-4 sm:grid-cols-12">
            <div className="h-[220px] w-full min-w-0 sm:col-span-6">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const row = payload[0]?.payload as DirectusFieldTypeChartItem;
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                          <div className="font-mono font-semibold text-slate-900">{row.type}</div>
                          <div className="mt-1 space-y-0.5 text-slate-600">
                            <div>
                              Полей: <strong className="text-slate-900">{row.count}</strong>
                            </div>
                            <div>
                              Обязательных: <strong>{row.requiredCount}</strong>
                            </div>
                            <div>
                              Скрыто ACL: <strong className="text-amber-700">{row.hiddenCount}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Pie
                    data={chartsData.fieldTypeMetrics}
                    dataKey="count"
                    nameKey="type"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={3}
                  >
                    {chartsData.fieldTypeMetrics.map((entry) => (
                      <Cell key={entry.type} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3 sm:col-span-6">
              <div className="space-y-1.5">
                {chartsData.fieldTypeMetrics.map((item) => (
                  <div
                    key={item.type}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-mono font-medium text-slate-800">{item.type}</span>
                    </div>
                    <div className="shrink-0 font-mono text-slate-700 tabular-nums">
                      <span className="font-semibold text-slate-900">{item.count}</span>
                      {item.hiddenCount > 0 && (
                        <span className="ml-1.5 text-[11px] text-amber-700">
                          ({item.hiddenCount} ACL)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 pt-2.5">
                <div className="mb-1.5 text-[11px] font-medium text-slate-500">
                  Режим доступа ACL в BI-витрине ({chartsData.totals.aclProtectedCollectionsCount} колл. с маской)
                </div>
                <div className="grid grid-cols-1 gap-1 text-[11px]">
                  {chartsData.aclExposure.map((acl) => (
                    <div key={acl.name} className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: acl.color }}
                        />
                        {acl.name}
                      </span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {acl.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table 1: Aggregated Directus BI Collections Metadata Matrix */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-900">
              <Database className="h-3.5 w-3.5 text-[#0077FF]" />
              Сводная таблица метаданных коллекций Directus BI ({filteredTableRows.length})
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Сопоставление исходных таблиц, витрины <span className="font-mono">bi_*</span>,
              валидаторов и политик ACL
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Фильтр таблиц..."
                className="w-44 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs outline-none focus:border-[#0077FF]"
              />
            </div>

            <select
              value={contextFilter}
              onChange={(e) => setContextFilter(e.target.value)}
              aria-label="Фильтр таблицы по контексту"
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0077FF]"
            >
              <option value="all">Все контексты</option>
              {chartsData.contextMetrics.map((ctx) => (
                <option key={ctx.boundedContext} value={ctx.boundedContext}>
                  {ctx.boundedContext} ({ctx.collectionsCount})
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'records' | 'fields' | 'name')}
              aria-label="Сортировка таблицы метаданных"
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0077FF]"
            >
              <option value="records">По записям</option>
              <option value="fields">По полям</option>
              <option value="name">По имени</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-white text-[11px] font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Коллекция</th>
                <th className="px-4 py-2.5">BI DTO</th>
                <th className="px-4 py-2.5">Контекст</th>
                <th className="px-4 py-2.5">Валидация / Источник</th>
                <th className="px-4 py-2.5 text-right">Записей</th>
                <th className="px-4 py-2.5 text-right">Полей</th>
                <th className="px-4 py-2.5 text-right">Обязат.</th>
                <th className="px-4 py-2.5 text-right">ACL-масок</th>
                <th className="px-4 py-2.5 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTableRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-xs text-slate-400">
                    Нет коллекций, соответствующих фильтру
                  </td>
                </tr>
              ) : (
                filteredTableRows.map((row) => (
                  <tr
                    key={row.collection}
                    className={`hover:bg-slate-50 ${
                      row.collection === selectedCollectionName ? 'bg-[#0077FF]/5' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-slate-900">{row.displayName}</div>
                      <div className="font-mono text-[11px] text-slate-500">{row.collection}</div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[#0077FF] whitespace-nowrap">
                      {row.biCollection}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                      {row.boundedContext}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                      <div>{row.schemaValidatedBy}</div>
                      <div className="font-mono text-[10px] text-slate-400">
                        {row.source === 'directus-live' ? 'Directus REST' : 'PG Introspection'}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {row.recordsCount.toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700 tabular-nums">
                      {row.fieldsCount}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-600 tabular-nums">
                      {row.requiredFieldsCount}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                      {row.hiddenFieldsCount > 0 ? (
                        <span className="font-semibold text-amber-700">
                          {row.hiddenFieldsCount}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {onInspectCollection && (
                        <button
                          type="button"
                          onClick={() => onInspectCollection(row.collection, 'fields')}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-[#0077FF] hover:text-[#0077FF]"
                        >
                          Схема <ArrowUpRight className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 2: Directus CMS Content Blocks Overview Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
            <FileText className="h-3.5 w-3.5 text-emerald-600" />
            Реестр контентных блоков Directus CMS ({snapshot.contentItems.length})
          </div>
          <div className="font-mono text-[11px] text-slate-500 tabular-nums">
            Опубликовано: {snapshot.summary.cmsBlocksPublished} · Черновиков:{' '}
            {snapshot.summary.cmsBlocksDraft}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-white text-[11px] font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Блок контента</th>
                <th className="px-4 py-2.5">Slug</th>
                <th className="px-4 py-2.5">Секция</th>
                <th className="px-4 py-2.5">BI Витрина</th>
                <th className="px-4 py-2.5">Статус</th>
                <th className="px-4 py-2.5 text-right">Обновлён</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {snapshot.contentItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">
                    Контентные блоки Directus CMS не найдены
                  </td>
                </tr>
              ) : (
                snapshot.contentItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="max-w-[300px] px-4 py-2.5">
                      <div className="font-semibold text-slate-900">{item.title}</div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-500">
                        {item.bodyPreview}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {item.slug}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                      {DIRECTUS_SECTION_LABELS[item.sectionType] || item.sectionType}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[#0077FF] whitespace-nowrap">
                      {item.biCollection}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {item.published ? (
                        <span className="font-medium text-emerald-700">Опубликован</span>
                      ) : (
                        <span className="text-slate-500">Черновик</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                      {formatDateTimeRu(item.updatedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
