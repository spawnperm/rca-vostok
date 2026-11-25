import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileCode2,
  Package,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { refineClient } from '../../application/refine/client.ts';
import { useVoiceSectionAction } from '../../application/voice/voiceActionBus.ts';
import type { AuthenticatedActor } from '../../domain/shared/types.ts';
import type { PluginHealthCheckResult } from '../../infrastructure/marketplace/pluginHealthService.ts';
import type { ExtractedVerdaccioModuleInfo } from '../../infrastructure/verdaccio/registryService.ts';
import { getErrorMessage } from '../../shared/formatters.ts';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';

export interface MarketplacePluginItem {
  id: string;
  npmPackageName: string;
  version: string;
  verdaccioUrl: string;
  tarballSha512: string;
  name: string;
  category: string;
  author: string;
  description: string;
  slot: string;
  downloads: number;
  installed: boolean;
  enabled: boolean;
  tenantConfig: Record<string, unknown>;
  dddModule?: {
    extracted: boolean;
    directory: string;
    boundedContext: string;
    contextMapping: string;
    aggregates: string[];
    valueObjects: string[];
    publishedEvents: string[];
    subscribedSubjects: string[];
    tarballUrl: string;
    tarballBytes: number;
    filesCount: number;
    executable: boolean;
  } | null;
}

interface MarketplaceViewProps {
  actor: AuthenticatedActor;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
}

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({ actor, onNotify }) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'modules'>('catalog');
  const [plugins, setPlugins] = useState<MarketplacePluginItem[]>([]);
  const [workspaceModules, setWorkspaceModules] = useState<ExtractedVerdaccioModuleInfo[]>([]);
  const [verdaccioEndpoint, setVerdaccioEndpoint] = useState('http://localhost:4873');
  const [registryMode, setRegistryMode] = useState<string>('embedded_workspace_registry');
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Все');
  const [slotFilter, setSlotFilter] = useState('all');
  const [installedOnly, setInstalledOnly] = useState(false);

  const [configPlugin, setConfigPlugin] = useState<MarketplacePluginItem | null>(null);
  const [configJsonText, setConfigJsonText] = useState('');
  const [showPublishModal, setShowPublishModal] = useState(false);

  const [packumentData, setPackumentData] = useState<{
    packageName: string;
    json: Record<string, unknown>;
    tarballUrl: string;
  } | null>(null);
  const [npmCmdCopied, setNpmCmdCopied] = useState(false);

  const [verifyResult, setVerifyResult] = useState<{
    packageName: string;
    boundedContext: string;
    contextMapping: string;
    validatedConfig: Record<string, unknown>;
    output: Record<string, unknown>;
  } | null>(null);

  const [pkgName, setPkgName] = useState('@nexus-plugins/crm-sla-watchdog');
  const [pkgVersion, setPkgVersion] = useState('1.0.0');
  const [pkgTitle, setPkgTitle] = useState('CRM SLA Watchdog');
  const [pkgCategory, setPkgCategory] = useState('CRM Automation');
  const [pkgSlot, setPkgSlot] = useState('crm_deal_sidebar');
  const [pkgDesc, setPkgDesc] = useState(
    'Отслеживает время ответа по сделке и отправляет уведомления в NATS при нарушении SLA.'
  );
  const [healthByPluginId, setHealthByPluginId] = useState<Record<string, PluginHealthCheckResult>>({});
  const [checkingHealth, setCheckingHealth] = useState(false);

  const canManage = refineClient.can(actor, 'plugins:manage');

  useVoiceSectionAction('marketplace', (actionId) => {
    switch (actionId) {
      case 'marketplace.tab_catalog':
        setActiveTab('catalog');
        return true;
      case 'marketplace.tab_modules':
        setActiveTab('modules');
        return true;
      case 'marketplace.publish_plugin':
        if (!canManage) return false;
        setShowPublishModal(true);
        return true;
      case 'marketplace.refresh':
        void loadCatalog();
        return true;
      default:
        return false;
    }
  });

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const [pluginsRes, modulesRes] = await Promise.all([
        refineClient.request<{
          verdaccioEndpoint: string;
          registryMode?: string;
          plugins: MarketplacePluginItem[];
        }>('/api/marketplace/plugins'),
        refineClient.request<{
          modules: ExtractedVerdaccioModuleInfo[];
        }>('/api/marketplace/verdaccio/modules'),
      ]);
      setVerdaccioEndpoint(pluginsRes.verdaccioEndpoint);
      if (pluginsRes.registryMode) setRegistryMode(pluginsRes.registryMode);
      setPlugins(pluginsRes.plugins);
      setWorkspaceModules(modulesRes.modules || []);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка загрузки Маркета плагинов', 'err');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    void loadCatalog();
  }, [actor.userId, loadCatalog]);

  const installedIdsKey = useMemo(
    () =>
      plugins
        .filter((p) => p.installed)
        .map((p) => `${p.id}:${p.enabled ? '1' : '0'}`)
        .sort()
        .join(','),
    [plugins]
  );

  const runHealthChecks = useCallback(
    async (manual = false) => {
      if (!installedIdsKey) {
        setHealthByPluginId({});
        return;
      }
      setCheckingHealth(true);
      try {
        const res = await refineClient.request<{
          checkedAt: string;
          totalInstalled: number;
          unhealthyCount: number;
          results: PluginHealthCheckResult[];
        }>('/api/marketplace/plugins/health-check', {
          method: 'POST',
          body: JSON.stringify({}),
        });
        const nextMap: Record<string, PluginHealthCheckResult> = {};
        for (const item of res.results) {
          nextMap[item.pluginId] = item;
        }
        setHealthByPluginId(nextMap);
        if (manual) {
          if (res.unhealthyCount > 0) {
            onNotify(
              `Обнаружены сбои зависимостей (${res.unhealthyCount}) — события отправлены в NATS`,
              'err'
            );
          } else {
            onNotify(`Зависимости всех установленных плагинов (${res.totalInstalled}) в норме`);
          }
        }
      } catch (err: unknown) {
        if (manual) {
          onNotify(
            err instanceof Error ? err.message : 'Ошибка проверки зависимостей плагинов',
            'err'
          );
        }
      } finally {
        setCheckingHealth(false);
      }
    },
    [installedIdsKey, onNotify]
  );

  useEffect(() => {
    if (!installedIdsKey) return;
    void runHealthChecks(false);
    const intervalId = window.setInterval(() => {
      void runHealthChecks(false);
    }, 30000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [installedIdsKey, runHealthChecks]);

  const categories = ['Все', 'AI & Harness', 'CRM Automation', 'Social Widgets', 'Integrations', 'DevOps'];
  const filtered = plugins.filter((p) => {
    const matchesCat = categoryFilter === 'Все' || p.category === categoryFilter;
    const matchesSlot = slotFilter === 'all' || p.slot === slotFilter;
    const matchesInstalled = !installedOnly || p.installed;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.npmPackageName.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      (p.dddModule?.boundedContext || '').toLowerCase().includes(q);
    return matchesCat && matchesSlot && matchesInstalled && matchesSearch;
  });

  const handleInstall = async (pluginId: string) => {
    try {
      await refineClient.request('/api/marketplace/plugins/install', {
        method: 'POST',
        body: JSON.stringify({ pluginId }),
      });
      await loadCatalog();
      onNotify('Плагин установлен из Verdaccio и активирован для тенанта');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка установки плагина', 'err');
    }
  };

  const handleUninstall = async (pluginId: string) => {
    try {
      await refineClient.deleteOne('marketplace/plugins', pluginId);
      await loadCatalog();
      onNotify('Плагин удалён из конфигурации тенанта');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка удаления плагина', 'err');
    }
  };

  const handleToggle = async (pluginId: string, nextEnabled: boolean) => {
    try {
      await refineClient.request(`/api/marketplace/plugins/${pluginId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      await loadCatalog();
      onNotify(nextEnabled ? 'Плагин включён' : 'Плагин отключён');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка переключения плагина', 'err');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configPlugin) return;
    try {
      const parsed = JSON.parse(configJsonText);
      await refineClient.request(`/api/marketplace/plugins/${configPlugin.id}/config`, {
        method: 'PATCH',
        body: JSON.stringify({ config: parsed }),
      });
      setConfigPlugin(null);
      await loadCatalog();
      await runHealthChecks(false);
      onNotify('Конфигурация плагина сохранена в PostgreSQL');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Некорректный JSON конфигурации', 'err');
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await refineClient.request('/api/marketplace/verdaccio/publish', {
        method: 'POST',
        body: JSON.stringify({
          npmPackageName: pkgName,
          version: pkgVersion,
          name: pkgTitle,
          category: pkgCategory,
          slot: pkgSlot,
          description: pkgDesc,
          author: actor.fullName,
        }),
      });
      setShowPublishModal(false);
      await loadCatalog();
      onNotify(`Пакет ${pkgName}@${pkgVersion} опубликован в Verdaccio`);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка публикации в Verdaccio', 'err');
    }
  };

  const handleInspectPackument = async (packageName: string, tarballUrl: string) => {
    try {
      const [scope, pkg] = packageName.split('/');
      const json = await refineClient.request<Record<string, unknown>>(
        `/api/marketplace/verdaccio/registry/${encodeURIComponent(scope)}/${encodeURIComponent(pkg)}`
      );
      setPackumentData({ packageName, json, tarballUrl });
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка чтения манифеста Verdaccio', 'err');
    }
  };

  const handleVerifyModule = async (packageName: string) => {
    try {
      const [, slug] = packageName.split('/');
      const res = await refineClient.request<{
        packageName: string;
        boundedContext: string;
        contextMapping: string;
        validatedConfig: Record<string, unknown>;
        output: Record<string, unknown>;
      }>(`/api/marketplace/modules/${encodeURIComponent(slug)}/verify`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setVerifyResult(res);
      onNotify(`Доменная логика модуля ${packageName} проверена`);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка выполнения DDD-модуля', 'err');
    }
  };

  const handleDownloadTarball = async (tarballUrl: string, filename: string) => {
    try {
      await refineClient.downloadBlob(tarballUrl, filename);
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка загрузки .tgz из Verdaccio'), 'err');
    }
  };

  const handleCopyNpmInstall = async (packageName: string) => {
    const cmd = `npm install ${packageName} --registry ${verdaccioEndpoint}`;
    try {
      await navigator.clipboard.writeText(cmd);
      setNpmCmdCopied(true);
      onNotify('Команда npm install скопирована');
      window.setTimeout(() => setNpmCmdCopied(false), 1800);
    } catch {
      onNotify('Не удалось скопировать команду', 'err');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Маркет плагинов и DDD-модули Verdaccio"
        subtitle={`Verdaccio Registry: ${verdaccioEndpoint} · ${
          registryMode === 'live_verdaccio' ? 'Live Registry' : 'Embedded Workspace Registry'
        } · Модулей: ${workspaceModules.length} · Установлено: ${plugins.filter((p) => p.installed).length}`}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('catalog')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'catalog'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="h-3.5 w-3.5" /> Каталог плагинов
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('modules')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'modules'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Boxes className="h-3.5 w-3.5" /> Программные модули ({workspaceModules.length})
              </button>
            </div>
            <button
              type="button"
              onClick={() => void runHealthChecks(true)}
              disabled={checkingHealth || !installedIdsKey}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-600 ${checkingHealth ? 'animate-spin' : ''}`} />
              {checkingHealth ? 'Проверка...' : 'Проверить зависимости'}
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() => setShowPublishModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
              >
                <UploadCloud className="h-3.5 w-3.5" /> Опубликовать пакет
              </button>
            )}
          </>
        }
      />

      {activeTab === 'modules' ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-slate-900">
              Выделенные программные модули (packages/* · Verdaccio @nexus-core / @nexus-plugins)
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Изолированные npm-пакеты с явными DDD Bounded Contexts, агрегатами, событиями NATS и SHA-512 tarball сборкой.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {workspaceModules.map((mod) => (
              <div key={mod.packageName} className="flex flex-col justify-between gap-4 px-5 py-4 lg:flex-row lg:items-center">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-semibold text-[#0077FF]">{mod.packageName}</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-mono text-slate-600 tabular-nums">v{mod.version}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600">Контекст: {mod.boundedContext}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">{mod.contextMapping}</span>
                  </div>
                  <p className="text-xs text-slate-700">{mod.description}</p>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-500 tabular-nums">
                    <span>{mod.directory}</span>
                    <span>·</span>
                    <span>Агрегаты: {mod.aggregates.join(', ') || '—'}</span>
                    <span>·</span>
                    <span>События: {mod.publishedEvents.join(', ') || '—'}</span>
                    <span>·</span>
                    <span>{(mod.tarballBytes / 1024).toFixed(1)} КБ (.tgz)</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleInspectPackument(mod.packageName, mod.tarballUrl)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <FileCode2 className="h-3.5 w-3.5" /> Packument
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownloadTarball(mod.tarballUrl, mod.tarballFilename)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" /> .tgz
                  </button>
                  {mod.role === 'plugin-module' && (
                    <button
                      type="button"
                      onClick={() => void handleVerifyModule(mod.packageName)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
                    >
                      <Play className="h-3.5 w-3.5" /> Запустить DDD-тест
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Category & Slot Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    categoryFilter === cat
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={installedOnly}
                  onChange={(e) => setInstalledOnly(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#0077FF]"
                />
                <span>Только установленные</span>
              </label>

              <select
                value={slotFilter}
                onChange={(e) => setSlotFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-700 outline-none"
              >
                <option value="all">Все слоты UI</option>
                <option value="crm_deal_sidebar">crm_deal_sidebar</option>
                <option value="crm_toolbar">crm_toolbar</option>
                <option value="social_composer">social_composer</option>
                <option value="portal_module">portal_module</option>
              </select>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск @nexus-plugins/..."
                  className="w-56 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#0077FF] focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Plugin Cards Grid */}
          {loading && plugins.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
              Загрузка каталога Verdaccio...
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Package className="h-5 w-5" />}
              title="Плагины не найдены"
              description="Измените фильтр категории, слота или строку поиска."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((plg) => {
                const health = plg.installed ? healthByPluginId[plg.id] : undefined;
                return (
                  <div
                    key={plg.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-xs text-[#0077FF]">
                            {plg.npmPackageName}
                          </div>
                          <h3 className="mt-1 text-base font-semibold text-slate-900">{plg.name}</h3>
                        </div>
                        <Package className="h-5 w-5 shrink-0 text-slate-400" />
                      </div>

                      <div className="mt-1.5 text-xs text-slate-500 tabular-nums">
                        v{plg.version} · {plg.category} · {plg.slot}
                      </div>

                      {plg.dddModule && (
                        <div className="mt-1 font-mono text-[11px] text-slate-500">
                          DDD: {plg.dddModule.boundedContext} / {plg.dddModule.contextMapping} ·{' '}
                          {plg.dddModule.directory}
                        </div>
                      )}

                      <p className="mt-3 text-xs leading-relaxed text-slate-600">{plg.description}</p>

                      {health && (
                        <div className="mt-3 border-t border-slate-100 pt-2.5">
                          {health.healthy ? (
                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 tabular-nums">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                              <span>
                                Зависимости: OK · {health.latencyMs} мс ·{' '}
                                {new Date(health.checkedAt).toLocaleTimeString('ru-RU')}
                              </span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-red-700">
                              <div className="flex items-center gap-1.5 font-semibold text-red-800">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                                <span>Сбой: {health.failedDependency}</span>
                              </div>
                              <p className="mt-1 leading-snug text-red-700">{health.errorMessage}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-5 border-t border-slate-100 pt-3.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> SHA-512 verified
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Download className="h-3 w-3" /> {plg.downloads}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {!plg.installed ? (
                          <button
                            type="button"
                            onClick={() => void handleInstall(plg.id)}
                            disabled={!canManage}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0077FF] px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                          >
                            <Plus className="h-3.5 w-3.5" /> Установить
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleToggle(plg.id, !plg.enabled)}
                              disabled={!canManage}
                              className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap ${
                                plg.enabled
                                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                  : 'border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {plg.enabled ? 'Включён (Выкл)' : 'Отключён (Вкл)'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setConfigPlugin(plg);
                                setConfigJsonText(JSON.stringify(plg.tenantConfig, null, 2));
                              }}
                              disabled={!canManage}
                              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                              aria-label="Настроить плагин"
                            >
                              <Settings className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleUninstall(plg.id)}
                              disabled={!canManage}
                              className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                              aria-label="Удалить плагин"
                              title="Удалить из тенанта"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {plg.dddModule?.executable && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                void handleInspectPackument(
                                  plg.npmPackageName,
                                  plg.dddModule!.tarballUrl
                                )
                              }
                              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                              aria-label="Открыть манифест Verdaccio"
                              title="Packument JSON и .tgz"
                            >
                              <FileCode2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleVerifyModule(plg.npmPackageName)}
                              className="rounded-lg border border-slate-200 p-2 text-[#0077FF] hover:bg-blue-50"
                              aria-label="Проверить DDD-модуль"
                              title="Выполнить доменную логику модуля"
                            >
                              <Play className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Config JSON Modal */}
      <Modal
        open={Boolean(configPlugin)}
        onClose={() => setConfigPlugin(null)}
        title={configPlugin ? `Настройка ${configPlugin.npmPackageName}` : ''}
        subtitle="Параметры сохраняются изолированно для текущего тенанта в PostgreSQL"
      >
        <form onSubmit={handleSaveConfig} className="space-y-4">
          <textarea
            rows={8}
            value={configJsonText}
            onChange={(e) => setConfigJsonText(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 outline-none focus:border-[#0077FF]"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfigPlugin(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Сохранить JSON
            </button>
          </div>
        </form>
      </Modal>

      {/* Packument & Verdaccio Tarball Modal */}
      <Modal
        open={Boolean(packumentData)}
        onClose={() => setPackumentData(null)}
        title={packumentData ? `Verdaccio Packument · ${packumentData.packageName}` : ''}
        subtitle={`Установка: npm install ${packumentData?.packageName || ''} --registry ${verdaccioEndpoint}`}
        maxWidthClass="max-w-2xl"
      >
        {packumentData && (
          <div className="space-y-3">
            <pre className="max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 font-mono text-[11px] text-slate-100">
              {JSON.stringify(packumentData.json, null, 2)}
            </pre>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleCopyNpmInstall(packumentData.packageName)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {npmCmdCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {npmCmdCopied ? 'Скопировано' : 'Копировать npm install'}
              </button>
              <button
                type="button"
                onClick={() =>
                  void handleDownloadTarball(
                    packumentData.tarballUrl,
                    `${packumentData.packageName.split('/')[1] || 'module'}.tgz`
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" /> Скачать .tgz
              </button>
              <button
                type="button"
                onClick={() => setPackumentData(null)}
                className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* DDD Module Verification Output Modal */}
      <Modal
        open={Boolean(verifyResult)}
        onClose={() => setVerifyResult(null)}
        title={verifyResult ? `Результат DDD-модуля · ${verifyResult.packageName}` : ''}
        subtitle={
          verifyResult
            ? `Bounded Context: ${verifyResult.boundedContext} · ${verifyResult.contextMapping}`
            : ''
        }
        maxWidthClass="max-w-xl"
      >
        {verifyResult && (
          <div className="space-y-3">
            <div className="text-xs font-medium text-slate-700">Валидированная конфигурация (Zod)</div>
            <pre className="overflow-auto rounded-lg bg-slate-50 p-3 font-mono text-[11px] text-slate-800">
              {JSON.stringify(verifyResult.validatedConfig, null, 2)}
            </pre>
            <div className="text-xs font-medium text-slate-700">Результат доменного сценария</div>
            <pre className="max-h-72 overflow-auto rounded-lg bg-slate-900 p-4 font-mono text-[11px] text-slate-100">
              {JSON.stringify(verifyResult.output, null, 2)}
            </pre>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setVerifyResult(null)}
                className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
              >
                Готово
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Publish to Verdaccio Modal */}
      <Modal
        open={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        title="Публикация пакета в Verdaccio"
      >
        <form onSubmit={handlePublish} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-700">NPM Package Name</label>
              <input
                required
                value={pkgName}
                onChange={(e) => setPkgName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-[#0077FF]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">SemVer</label>
              <input
                required
                value={pkgVersion}
                onChange={(e) => setPkgVersion(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-[#0077FF]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Название в Маркете</label>
            <input
              required
              value={pkgTitle}
              onChange={(e) => setPkgTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Категория</label>
              <select
                value={pkgCategory}
                onChange={(e) => setPkgCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
              >
                <option value="AI & Harness">AI & Harness</option>
                <option value="CRM Automation">CRM Automation</option>
                <option value="Social Widgets">Social Widgets</option>
                <option value="Integrations">Integrations</option>
                <option value="DevOps">DevOps</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Слот расширения UI</label>
              <select
                value={pkgSlot}
                onChange={(e) => setPkgSlot(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none"
              >
                <option value="crm_deal_sidebar">crm_deal_sidebar</option>
                <option value="crm_toolbar">crm_toolbar</option>
                <option value="social_composer">social_composer</option>
                <option value="portal_module">portal_module</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Описание</label>
            <textarea
              rows={3}
              required
              value={pkgDesc}
              onChange={(e) => setPkgDesc(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowPublishModal(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Опубликовать
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
