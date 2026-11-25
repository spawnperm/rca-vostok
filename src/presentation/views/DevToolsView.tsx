import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BookMarked,
  BookOpen,
  Cpu,
  Download,
  FileCode2,
  GitBranch,
  Play,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useNatsQueue } from '../../application/nats/useNatsQueue.ts';
import { refineClient } from '../../application/refine/client.ts';
import { useVoiceSectionAction } from '../../application/voice/voiceActionBus.ts';
import type { AuthenticatedActor, TenantContext } from '../../domain/shared/types.ts';
import { formatDateTimeRu, getErrorMessage } from '../../shared/formatters.ts';
import { AdrRegistryPanel } from '../components/AdrRegistryPanel.tsx';
import { ArchifyDiagram } from '../components/ArchifyDiagram.tsx';
import { NatsQueueVisualizer } from '../components/NatsQueueVisualizer.tsx';
import { PrometheusMetricsViewer } from '../components/PrometheusMetricsViewer.tsx';
import { StorybookCatalog } from '../components/StorybookCatalog.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import type { DealItem } from '../types.ts';

interface HarnessWorkflow {
  id: string;
  name: string;
  engine: string;
  description: string;
  nodes: string[];
}

interface HarnessRun {
  id: string;
  workflowId: string;
  workflowName: string;
  status: string;
  durationMs: number;
  outputPayload: Record<string, unknown>;
  createdAt: string;
}

interface DevToolsViewProps {
  actor: AuthenticatedActor;
  activeTenant: TenantContext;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
}

type DevTab = 'harness' | 'scalar' | 'metrics' | 'adr' | 'archify' | 'storybook';

const DEFAULT_OPENAPI_PATHS = [
  '/api/crm/deals',
  '/api/crm/contacts',
  '/api/crm/tasks',
  '/api/social/cabinet',
  '/api/office/workspace',
  '/api/marketplace/plugins',
  '/api/rbac/matrix',
  '/api/nats/queue',
  '/api/openapi.json',
];

export const DevToolsView: React.FC<DevToolsViewProps> = ({
  actor,
  activeTenant,
  onNotify,
}) => {
  const [tab, setTab] = useState<DevTab>('harness');

  // Harness Workflows & Runs
  const [workflows, setWorkflows] = useState<HarnessWorkflow[]>([]);
  const [runs, setRuns] = useState<HarnessRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [selectedDealId, setSelectedDealId] = useState('');

  // Shared live NATS JetStream state
  const {
    snapshot: natsSnapshot,
    loading: natsLoading,
    connectionState: natsConnectionState,
    livePaused: natsLivePaused,
    lastPulseAt: natsLastPulseAt,
    refresh: loadNatsQueue,
    togglePause: toggleNatsPause,
    publishEvent: handlePublishNatsEvent,
    replayMessage: handleReplayNatsMessage,
  } = useNatsQueue(actor.tenantId, onNotify);

  // Scalar OpenAPI Explorer
  const [openApiJson, setOpenApiJson] = useState<Record<string, unknown> | null>(null);
  const [openApiFilter, setOpenApiFilter] = useState('');
  const [httpMethod, setHttpMethod] = useState<'GET' | 'POST' | 'PATCH' | 'DELETE'>('GET');
  const [scalarPath, setScalarPath] = useState('/api/crm/deals');
  const [scalarBody, setScalarBody] = useState('{\n  \n}');
  const [scalarResponse, setScalarResponse] = useState('');
  const [scalarMeta, setScalarMeta] = useState<{ ok: boolean; ms: number } | null>(null);
  const [executing, setExecuting] = useState(false);

  const canHarness = refineClient.can(actor, 'harness:execute');
  const canReadDeals = refineClient.can(actor, 'deals:read');

  useVoiceSectionAction('devtools', (actionId) => {
    switch (actionId) {
      case 'devtools.tab_harness':
        setTab('harness');
        return true;
      case 'devtools.tab_scalar':
        setTab('scalar');
        return true;
      case 'devtools.tab_archify':
        setTab('archify');
        return true;
      case 'devtools.tab_storybook':
        setTab('storybook');
        return true;
      case 'devtools.refresh':
        void loadHarness();
        void loadOpenApi();
        void loadNatsQueue();
        return true;
      default:
        return false;
    }
  });

  const loadHarness = useCallback(async () => {
    try {
      const [hRes, dRes] = await Promise.all([
        refineClient.request<{ workflows: HarnessWorkflow[]; runs: HarnessRun[] }>(
          '/api/harness/workflows'
        ),
        canReadDeals
          ? refineClient.request<{ deals: DealItem[] }>('/api/crm/deals')
          : Promise.resolve({ deals: [] }),
      ]);
      setWorkflows(hRes.workflows);
      setRuns(hRes.runs);
      if (hRes.runs.length > 0) {
        setSelectedRunId((prev) =>
          prev && hRes.runs.some((r) => r.id === prev) ? prev : hRes.runs[0].id
        );
      }
      const nextDeals = dRes.deals || [];
      setDeals(nextDeals);
      if (nextDeals.length > 0) {
        setSelectedDealId((prev) =>
          prev && nextDeals.some((d) => d.id === prev) ? prev : nextDeals[0].id
        );
      }
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка загрузки DeepSeek-Harness'), 'err');
    }
  }, [canReadDeals, onNotify]);

  const loadOpenApi = useCallback(async () => {
    try {
      const spec = await refineClient.request<Record<string, unknown>>('/api/openapi.json');
      setOpenApiJson(spec);
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка загрузки OpenAPI'), 'err');
    }
  }, [onNotify]);

  useEffect(() => {
    if (tab === 'harness') void loadHarness();
    if (tab === 'scalar') void loadOpenApi();
  }, [tab, activeTenant.id, loadHarness, loadOpenApi]);

  const handleRunWorkflow = async (workflowId: string) => {
    try {
      await refineClient.request('/api/harness/execute', {
        method: 'POST',
        body: JSON.stringify({
          workflowId,
          dealId: selectedDealId || deals[0]?.id,
        }),
      });
      await Promise.all([loadHarness(), loadNatsQueue()]);
      onNotify('Сценарий DeepSeek-Harness выполнен, событие отправлено в NATS');
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка выполнения сценария'), 'err');
    }
  };

  const handleScalarExecute = async () => {
    setExecuting(true);
    const t0 = performance.now();
    try {
      const init: RequestInit = { method: httpMethod };
      if (httpMethod === 'POST' || httpMethod === 'PATCH') {
        init.body = JSON.stringify(JSON.parse(scalarBody || '{}'));
      }
      const res = await refineClient.request<unknown>(scalarPath, init);
      setScalarMeta({ ok: true, ms: Math.round(performance.now() - t0) });
      setScalarResponse(JSON.stringify(res, null, 2));
    } catch (err: unknown) {
      setScalarMeta({ ok: false, ms: Math.round(performance.now() - t0) });
      setScalarResponse(
        JSON.stringify({ error: getErrorMessage(err, 'Request failed') }, null, 2)
      );
    } finally {
      setExecuting(false);
    }
  };

  const openApiEndpoints = useMemo(() => {
    const pathsObj = openApiJson?.paths as Record<string, Record<string, unknown>> | undefined;
    const rawList = pathsObj
      ? Object.entries(pathsObj).map(([endpoint, ops]) => ({
          endpoint,
          methods: Object.keys(ops || {})
            .map((m) => m.toUpperCase())
            .filter((m) => ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(m)),
        }))
      : DEFAULT_OPENAPI_PATHS.map((endpoint) => ({ endpoint, methods: ['GET'] }));

    const q = openApiFilter.trim().toLowerCase();
    return q
      ? rawList.filter((item) => item.endpoint.toLowerCase().includes(q))
      : rawList;
  }, [openApiJson, openApiFilter]);

  const activeRun = useMemo(
    () => runs.find((r) => r.id === selectedRunId) || runs[0] || null,
    [runs, selectedRunId]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Консоль разработчика и архитектура"
        subtitle={`Контур: ${activeTenant.subdomain}.platform.local · DeepSeek-Harness, Scalar OpenAPI 3.1, Archify DDD и Storybook UI`}
        actions={
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(
              [
                ['harness', 'Harness & Dify', <Cpu key="c" className="h-3.5 w-3.5" />],
                ['scalar', 'Scalar OpenAPI', <FileCode2 key="f" className="h-3.5 w-3.5" />],
                ['metrics', 'Prometheus', <Activity key="m" className="h-3.5 w-3.5" />],
                ['adr', 'Реестр ADR', <BookMarked key="a" className="h-3.5 w-3.5" />],
                ['archify', 'Archify DDD', <GitBranch key="g" className="h-3.5 w-3.5" />],
                ['storybook', 'Storybook UI', <BookOpen key="b" className="h-3.5 w-3.5" />],
              ] as const
            ).map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  tab === id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        }
      />

      {/* HARNESS & DIFY WORKFLOW ENGINE */}
      {tab === 'harness' && (
        <div className="space-y-4">
          <NatsQueueVisualizer
            actor={actor}
            mode="compact"
            snapshot={natsSnapshot}
            connectionState={natsConnectionState}
            loading={natsLoading}
            livePaused={natsLivePaused}
            lastPulseAt={natsLastPulseAt}
            onTogglePause={toggleNatsPause}
            onRefresh={loadNatsQueue}
            onPublishEvent={handlePublishNatsEvent}
            onReplayMessage={handleReplayNatsMessage}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    DeepSeek-Harness & Dify Workflow Engine
                  </h3>
                  <p className="text-xs text-slate-500">
                    Детерминированное выполнение AI-пайплайнов с валидацией Zod и публикацией в NATS
                  </p>
                </div>
                <select
                  aria-label="Сделка для запуска Harness"
                  value={selectedDealId}
                  onChange={(e) => setSelectedDealId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none"
                >
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      Сделка: {d.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                {workflows.map((wf) => (
                  <div key={wf.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-[11px] text-[#0077FF]">{wf.engine}</div>
                        <h4 className="mt-0.5 text-sm font-semibold text-slate-900">{wf.name}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRunWorkflow(wf.id)}
                        disabled={!canHarness}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0077FF] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        <Play className="h-3.5 w-3.5" /> Запустить
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">{wf.description}</p>
                    <div className="mt-2.5 font-mono text-[11px] text-slate-400">
                      Узлы: {wf.nodes.join(' -> ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Harness Run Inspector */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  Инспектор запусков Harness ({runs.length})
                </h3>
                <button
                  type="button"
                  onClick={() => void loadHarness()}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Обновить
                </button>
              </div>

              {runs.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Запустите любой сценарий слева, чтобы просмотреть структурированный JSON-отчёт.
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                    {runs.map((r) => {
                      const active = activeRun?.id === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setSelectedRunId(r.id)}
                          className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs transition-colors ${
                            active ? 'bg-blue-50/70 text-[#0077FF]' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-900">{r.workflowName}</div>
                            <div className="text-[11px] text-slate-500 tabular-nums">
                              {formatDateTimeRu(r.createdAt)}
                            </div>
                          </div>
                          <span className="shrink-0 font-mono text-[11px] text-emerald-700 tabular-nums">
                            {r.durationMs} мс
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {activeRun && (
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-mono font-semibold text-slate-700">
                          Output JSON · {activeRun.id}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            refineClient.downloadJson(activeRun, `harness-run-${activeRun.id}.json`)
                          }
                          className="inline-flex items-center gap-1 text-[#0077FF] hover:underline"
                        >
                          <Download className="h-3 w-3" /> JSON
                        </button>
                      </div>
                      <pre className="max-h-72 overflow-auto rounded-lg bg-slate-900 p-3.5 font-mono text-[11px] text-slate-100">
                        {JSON.stringify(activeRun.outputPayload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SCALAR OPENAPI 3.1 EXPLORER */}
      {tab === 'scalar' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Scalar OpenAPI 3.1 Spec</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Контракты API на базе схем Zod (/api/openapi.json)
                </p>
              </div>
              {openApiJson && (
                <button
                  type="button"
                  onClick={() => refineClient.downloadJson(openApiJson, 'nexusharness-openapi.json')}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" /> Spec JSON
                </button>
              )}
            </div>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={openApiFilter}
                onChange={(e) => setOpenApiFilter(e.target.value)}
                placeholder="Фильтр маршрутов (/crm, /office, /nats)..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 font-mono text-xs outline-none focus:border-[#0077FF] focus:bg-white"
              />
            </div>

            <div className="mt-3 max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
              {openApiEndpoints.map(({ endpoint, methods }) => (
                <button
                  key={endpoint}
                  type="button"
                  onClick={() => {
                    setScalarPath(endpoint);
                    if (methods.length > 0 && ['GET', 'POST', 'PATCH', 'DELETE'].includes(methods[0])) {
                      setHttpMethod(methods[0] as typeof httpMethod);
                    }
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left font-mono text-xs ${
                    scalarPath === endpoint
                      ? 'border-[#0077FF] bg-blue-50/50 text-blue-900'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{endpoint}</span>
                  <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                    {methods.join(' · ')}
                  </span>
                </button>
              ))}
            </div>
            {openApiJson && (
              <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500 tabular-nums">
                Спецификация: OpenAPI {String(openApiJson.openapi || '3.1.0')} ·{' '}
                {openApiEndpoints.length} маршрутов
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={httpMethod}
                onChange={(e) => setHttpMethod(e.target.value as typeof httpMethod)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs font-semibold text-slate-900 outline-none"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
              <input
                type="text"
                value={scalarPath}
                onChange={(e) => setScalarPath(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-900 outline-none focus:border-[#0077FF] focus:bg-white"
              />
              <button
                type="button"
                disabled={executing}
                onClick={() => void handleScalarExecute()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
              >
                <Play className="h-3.5 w-3.5" /> {executing ? 'Выполнение...' : 'Выполнить'}
              </button>
            </div>

            {scalarMeta && (
              <div className="flex items-center justify-between text-xs tabular-nums">
                <span className={scalarMeta.ok ? 'font-medium text-emerald-700' : 'font-medium text-red-600'}>
                  {scalarMeta.ok ? '200 OK' : 'Ошибка запроса'}
                </span>
                <span className="font-mono text-slate-500">{scalarMeta.ms} мс</span>
              </div>
            )}

            {(httpMethod === 'POST' || httpMethod === 'PATCH') && (
              <div>
                <label className="block text-[11px] font-medium text-slate-500">
                  JSON Body
                </label>
                <textarea
                  rows={4}
                  value={scalarBody}
                  onChange={(e) => setScalarBody(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 font-mono text-xs text-slate-800 outline-none focus:border-[#0077FF]"
                />
              </div>
            )}

            <pre className="max-h-[420px] overflow-auto rounded-lg bg-slate-900 p-4 font-mono text-[11px] text-slate-100">
              {scalarResponse || 'Выберите путь и нажмите «Выполнить», чтобы протестировать REST API...'}
            </pre>
          </div>
        </div>
      )}

      {tab === 'metrics' && <PrometheusMetricsViewer onNotify={onNotify} />}
      {tab === 'adr' && (
        <AdrRegistryPanel
          canCreate={refineClient.can(actor, 'tenants:admin')}
          onNotify={onNotify}
        />
      )}
      {tab === 'archify' && <ArchifyDiagram />}
      {tab === 'storybook' && <StorybookCatalog />}
    </div>
  );
};
