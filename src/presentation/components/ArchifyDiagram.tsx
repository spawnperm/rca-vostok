import React, { useState } from 'react';
import {
  ArrowRight,
  Database,
  FileSpreadsheet,
  GitBranch,
  Globe,
  Layers,
  Lock,
  Radio,
  Workflow,
} from 'lucide-react';

interface ContextNode {
  id: string;
  title: string;
  layer: 'Edge' | 'Harness' | 'DDD Bounded Context' | 'Infrastructure';
  stack: string;
  summary: string;
  contracts: string[];
}

const ARCHIFY_NODES: ContextNode[] = [
  {
    id: 'traefik',
    title: 'Traefik v3 Subdomain Edge',
    layer: 'Edge',
    stack: 'Traefik · HostRegexp · X-Tenant-Subdomain',
    summary:
      'Терминирует HTTPS и маршрутизирует *.platform.local на модульный Node/Express API с инъекцией заголовка X-Tenant-Subdomain.',
    contracts: ['Host(`acme.platform.local`)', 'Host(`globex.platform.local`)', 'Dynamic File Provider'],
  },
  {
    id: 'harness',
    title: 'DeepSeek-Harness & Modular Routers',
    layer: 'Harness',
    stack: 'authRouter · crmRouter · socialRouter · officeRouter · marketplaceRouter · platformRouter',
    summary:
      'Модульный роутинг с единым конвейером: валидация Zod (parseBody) -> проверка RBAC PolicyEvaluator -> доменная операция -> пакетный AI-анализ и публикация в NATS.',
    contracts: [
      'requireAuth',
      'requirePermission / requireAnyPermission',
      'analyzeTenantDealsBatch()',
    ],
  },
  {
    id: 'crm',
    title: 'CRM Bounded Context (amoCRM)',
    layer: 'DDD Bounded Context',
    stack: 'DealAggregate · Money · @nexus-plugins/dify-deal-copilot',
    summary:
      'Многоворонковые продажи, DealAggregate с инвариантами переходов и доменными событиями, справочник контактов и компаний с LTV, задачи, шаблоны рассылок и выделенный модуль AI Copilot.',
    contracts: ['DealAggregate.moveToStage()', 'Money.create()', 'CreateDealSchema', 'SendDealEmailSchema'],
  },
  {
    id: 'office',
    title: 'Office, S3 & Git (Univer · Garage · Forgejo)',
    layer: 'DDD Bounded Context',
    stack: 'Univer (.xlsx/.docx/.pptx) · Garage S3 · Forgejo Git LFS',
    summary:
      'Редактирование таблиц, документов и презентаций OOXML с хранением бинарных версий в Garage S3 и коммитами в репозиториях Forgejo.',
    contracts: ['CreateOfficeDocumentSchema', 'CreateGarageBucketSchema', 'CreateForgejoRepoSchema'],
  },
  {
    id: 'social',
    title: 'Social Cabinet (BuddyBoss / VK)',
    layer: 'DDD Bounded Context',
    stack: 'SocialPollAggregate · @nexus-plugins/vk-social-polls',
    summary:
      'Корпоративная лента, профили команды, выделенный пакет SocialPollAggregate с инвариантами голосования, репосты, прикрепление сделок CRM и сообщества с RBAC-модерацией.',
    contracts: ['SocialPollAggregate.castVote()', 'CreateWallPostSchema', 'CreateSocialGroupSchema'],
  },
  {
    id: 'marketplace',
    title: 'Verdaccio Registry & DDD Modules',
    layer: 'DDD Bounded Context',
    stack: '@nexus-core/ddd-kernel · @nexus-plugins/* · NocoBase · Directus ACL',
    summary:
      'Выделенные npm-модули в packages/* (Shared Kernel, Anti-Corruption Layer для Directus BI, Published Language для NATS Webhook Bridge), сборка .tgz и публикация Packument в Verdaccio.',
    contracts: [
      'PluginPackageAggregate.publishNew()',
      'GET /api/marketplace/verdaccio/modules',
      'GET /api/marketplace/verdaccio/registry/:scope/:pkg',
    ],
  },
  {
    id: 'postgres',
    title: 'PostgreSQL 16 (Drizzle ORM)',
    layer: 'Infrastructure',
    stack: 'PGlite ./data/pgdata + Drizzle ORM + pg.Pool',
    summary:
      'Реальная реляционная СУБД PostgreSQL внутри проекта с полной изоляцией по tenant_id и поддержкой внешнего кластера через POSTGRES_URL.',
    contracts: ['20+ normalized tables', 'JSONB custom_fields & configs'],
  },
  {
    id: 'mesh',
    title: 'NATS JetStream · Directus · TinaCMS · Scalar',
    layer: 'Infrastructure',
    stack: 'SSE /api/nats/stream · @nexus-plugins/nats-webhook-bridge · OpenAPI 3.1',
    summary:
      'Потоковая шина доменных событий NATS JetStream, ACL-проекция Directus BI, пакет TinaCMS Playbooks и спецификация OpenAPI 3.1 для Scalar.',
    contracts: ['crm.<tenant>.deal.moved', 'verdaccio.package.published', '/api/openapi.json'],
  },
];

export const ArchifyDiagram: React.FC = () => {
  const [selected, setSelected] = useState<ContextNode>(ARCHIFY_NODES[1]);

  const iconForNode = (id: string) => {
    if (id === 'traefik') return <Globe className="h-4 w-4 text-[#0077FF]" />;
    if (id === 'harness') return <Workflow className="h-4 w-4 text-[#0077FF]" />;
    if (id === 'office') return <FileSpreadsheet className="h-4 w-4 text-emerald-600" />;
    if (id === 'marketplace') return <Layers className="h-4 w-4 text-slate-600" />;
    if (id === 'postgres') return <Database className="h-4 w-4 text-emerald-600" />;
    if (id === 'mesh') return <Radio className="h-4 w-4 text-amber-600" />;
    if (id === 'social') return <Lock className="h-4 w-4 text-slate-600" />;
    return <GitBranch className="h-4 w-4 text-slate-600" />;
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Archify — DDD Топология и Bounded Contexts
            </h2>
            <p className="text-xs text-slate-500">
              Нажмите на любой узел архитектуры для инспекции модулей и контрактов Zod
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500">C4 Container View</span>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ARCHIFY_NODES.slice(0, 2).map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelected(node)}
                className={`rounded-xl border p-4 text-left transition-all ${
                  selected.id === node.id
                    ? 'border-[#0077FF] bg-white shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{node.layer}</span>
                  {iconForNode(node.id)}
                </div>
                <div className="mt-1.5 text-sm font-semibold text-slate-900">{node.title}</div>
                <div className="mt-1 font-mono text-[11px] text-slate-500">{node.stack}</div>
              </button>
            ))}
          </div>

          <div className="flex justify-center text-slate-400">
            <ArrowRight className="h-4 w-4 rotate-90" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ARCHIFY_NODES.slice(2, 6).map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelected(node)}
                className={`rounded-xl border p-4 text-left transition-all ${
                  selected.id === node.id
                    ? 'border-[#0077FF] bg-white shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{node.layer}</span>
                  {iconForNode(node.id)}
                </div>
                <div className="mt-1.5 text-sm font-semibold text-slate-900">{node.title}</div>
                <div className="mt-1 font-mono text-[11px] text-slate-500">{node.stack}</div>
              </button>
            ))}
          </div>

          <div className="flex justify-center text-slate-400">
            <ArrowRight className="h-4 w-4 rotate-90" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ARCHIFY_NODES.slice(6, 8).map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelected(node)}
                className={`rounded-xl border p-4 text-left transition-all ${
                  selected.id === node.id
                    ? 'border-[#0077FF] bg-white shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{node.layer}</span>
                  {iconForNode(node.id)}
                </div>
                <div className="mt-1.5 text-sm font-semibold text-slate-900">{node.title}</div>
                <div className="mt-1 font-mono text-[11px] text-slate-500">{node.stack}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4">
        <div className="text-xs font-medium text-[#0077FF]">{selected.layer}</div>
        <h3 className="mt-1 text-lg font-semibold text-slate-900">{selected.title}</h3>
        <div className="mt-1 font-mono text-xs text-slate-500">{selected.stack}</div>
        <p className="mt-4 text-sm leading-relaxed text-slate-700">{selected.summary}</p>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="text-xs font-semibold text-slate-900">Контракты и интерфейсы</div>
          <ul className="mt-2 space-y-1.5">
            {selected.contracts.map((c) => (
              <li key={c} className="rounded-md bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-700">
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
