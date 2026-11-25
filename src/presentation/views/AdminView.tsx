import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Check,
  Copy,
  Database,
  Download,
  Edit3,
  Eye,
  EyeOff,
  Globe,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
} from 'lucide-react';
import { refineClient } from '../../application/refine/client.ts';
import { useVoiceSectionAction } from '../../application/voice/voiceActionBus.ts';
import type { AuthenticatedActor, TenantContext } from '../../domain/shared/types.ts';
import { getErrorMessage } from '../../shared/formatters.ts';
import { SystemHealthDashboard } from '../components/SystemHealthDashboard.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';

interface TenantRow {
  id: string;
  name: string;
  subdomain: string;
  plan: 'starter' | 'growth' | 'enterprise';
  status: 'active' | 'suspended';
  maxUsers: number;
  maxDeals: number;
  traefikRule: string;
}

interface RbacRole {
  id: string;
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  dataScope?: 'all' | 'own';
  hiddenFields?: string[];
  permissions: string[];
}

interface RbacPermissionMeta {
  code: string;
  module: string;
  label: string;
  description: string;
}

interface MaskableFieldMeta {
  key: string;
  label: string;
}

interface RbacUserRow {
  id: string;
  email: string;
  fullName: string;
  roleId: string;
  avatarUrl: string;
  isActive: boolean;
}

interface CmsBlock {
  id: string;
  slug: string;
  title: string;
  sectionType: 'hero' | 'announcement' | 'playbook' | 'onboarding' | 'release' | 'faq';
  body: string;
  ctaLabel: string;
  published: boolean;
}

interface DirectusCollection {
  collection: string;
  boundedContext: string;
  records: number;
  schemaValidatedBy: string;
}

interface AdminViewProps {
  actor: AuthenticatedActor;
  activeTenant: TenantContext;
  onSwitchSubdomain: (subdomain: string) => Promise<void>;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
}

type AdminTab = 'tenancy' | 'rbac' | 'cms' | 'health';

export const AdminView: React.FC<AdminViewProps> = ({
  actor,
  activeTenant,
  onSwitchSubdomain,
  onNotify,
}) => {
  const canTenantsAdmin = refineClient.can(actor, 'tenants:admin');
  const canRbacManage = refineClient.can(actor, 'rbac:manage');
  const canCms = refineClient.can(actor, 'cms:edit');

  const [tab, setTab] = useState<AdminTab>(canTenantsAdmin ? 'tenancy' : 'rbac');

  useVoiceSectionAction('admin', (actionId) => {
    switch (actionId) {
      case 'admin.create_tenant':
        if (!canTenantsAdmin) return false;
        setTab('tenancy');
        setShowNewTenant(true);
        return true;
      case 'admin.create_role':
        if (!canRbacManage) return false;
        setTab('rbac');
        setShowNewRole(true);
        return true;
      case 'admin.create_cms':
        if (!canCms) return false;
        setTab('cms');
        setEditingCms(null);
        setCmsModalOpen(true);
        return true;
      case 'admin.tab_tenancy':
        if (!canTenantsAdmin) return false;
        setTab('tenancy');
        return true;
      case 'admin.tab_rbac':
        if (!canRbacManage) return false;
        setTab('rbac');
        return true;
      case 'admin.tab_cms':
        setTab('cms');
        return true;
      case 'admin.tab_health':
        setTab('health');
        return true;
      default:
        return false;
    }
  });

  // Tenancy & Traefik
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [traefikYaml, setTraefikYaml] = useState('');
  const [showNewTenant, setShowNewTenant] = useState(false);
  const [tName, setTName] = useState('');
  const [tSub, setTSub] = useState('');
  const [tPlan, setTPlan] = useState<'starter' | 'growth' | 'enterprise'>('growth');

  // RBAC
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [allPermissions, setAllPermissions] = useState<RbacPermissionMeta[]>([]);
  const [maskableFields, setMaskableFields] = useState<MaskableFieldMeta[]>([]);
  const [rbacUsers, setRbacUsers] = useState<RbacUserRow[]>([]);
  const [permQuery, setPermQuery] = useState('');
  const [permModule, setPermModule] = useState('all');
  const [yamlCopied, setYamlCopied] = useState(false);
  const [showNewRole, setShowNewRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCode, setNewRoleCode] = useState('');

  // CMS & Directus
  const [cmsBlocks, setCmsBlocks] = useState<CmsBlock[]>([]);
  const [collections, setCollections] = useState<DirectusCollection[]>([]);
  const [cmsModalOpen, setCmsModalOpen] = useState(false);
  const [editingCms, setEditingCms] = useState<CmsBlock | null>(null);
  const [cmsTitle, setCmsTitle] = useState('');
  const [cmsSlug, setCmsSlug] = useState('');
  const [cmsSectionType, setCmsSectionType] = useState<CmsBlock['sectionType']>('playbook');
  const [cmsBody, setCmsBody] = useState('');
  const [cmsCta, setCmsCta] = useState('Открыть');

  const loadTenancy = useCallback(async () => {
    if (!canTenantsAdmin) return;
    try {
      const [tRes, trRes] = await Promise.all([
        refineClient.request<{ tenants: TenantRow[] }>('/api/tenancy/tenants'),
        refineClient.request<{ yaml: string }>('/api/tenancy/traefik-config'),
      ]);
      setTenants(tRes.tenants);
      setTraefikYaml(trRes.yaml);
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка загрузки тенантов'), 'err');
    }
  }, [canTenantsAdmin, onNotify]);

  const loadRbac = useCallback(async () => {
    try {
      const res = await refineClient.request<{
        allPermissions: RbacPermissionMeta[];
        maskableFields?: MaskableFieldMeta[];
        roles: RbacRole[];
        users: RbacUserRow[];
      }>('/api/rbac/matrix');
      setAllPermissions(res.allPermissions);
      setMaskableFields(res.maskableFields || []);
      setRoles(res.roles);
      setRbacUsers(res.users);
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка загрузки RBAC'), 'err');
    }
  }, [onNotify]);

  const loadCmsAndDirectus = useCallback(async () => {
    try {
      const [cRes, dRes] = await Promise.all([
        refineClient.request<{ blocks: CmsBlock[] }>('/api/cms/blocks'),
        refineClient.request<{ collections: DirectusCollection[] }>('/api/directus/collections'),
      ]);
      setCmsBlocks(cRes.blocks);
      setCollections(dRes.collections);
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка загрузки TinaCMS/Directus'), 'err');
    }
  }, [onNotify]);

  useEffect(() => {
    if (tab === 'tenancy') void loadTenancy();
    if (tab === 'rbac') void loadRbac();
    if (tab === 'cms') void loadCmsAndDirectus();
  }, [tab, activeTenant.id, loadTenancy, loadRbac, loadCmsAndDirectus]);

  const permissionModules = useMemo(
    () => [...new Set(allPermissions.map((p) => p.module))].sort((a, b) => a.localeCompare(b, 'ru')),
    [allPermissions]
  );

  const filteredPermissions = useMemo(() => {
    const q = permQuery.trim().toLowerCase();
    return allPermissions.filter((perm) => {
      if (permModule !== 'all' && perm.module !== permModule) return false;
      if (!q) return true;
      return (
        perm.code.toLowerCase().includes(q) ||
        perm.label.toLowerCase().includes(q) ||
        perm.module.toLowerCase().includes(q)
      );
    });
  }, [allPermissions, permQuery, permModule]);

  const handleCopyTraefikYaml = async () => {
    if (!traefikYaml) return;
    try {
      await navigator.clipboard.writeText(traefikYaml);
      setYamlCopied(true);
      onNotify('Traefik YAML скопирован в буфер обмена');
      window.setTimeout(() => setYamlCopied(false), 1800);
    } catch {
      onNotify('Не удалось скопировать YAML', 'err');
    }
  };

  const handleDownloadTraefikYaml = () => {
    if (!traefikYaml) return;
    refineClient.downloadText(traefikYaml, 'traefik-tenants.yml', 'text/yaml;charset=utf-8');
    onNotify('Конфигурация traefik-tenants.yml скачана');
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await refineClient.create('tenancy/tenants', {
        name: tName,
        subdomain: tSub.toLowerCase(),
        plan: tPlan,
      });
      setTName('');
      setTSub('');
      setShowNewTenant(false);
      await loadTenancy();
      onNotify('Тенант создан и маршруты Traefik обновлены');
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка создания тенанта'), 'err');
    }
  };

  const handleToggleTenantStatus = async (t: TenantRow) => {
    const nextStatus = t.status === 'active' ? 'suspended' : 'active';
    try {
      await refineClient.update('tenancy/tenants', t.id, { status: nextStatus });
      await loadTenancy();
      onNotify(`Тенант ${t.subdomain} переведён в статус ${nextStatus}`);
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка обновления тенанта'), 'err');
    }
  };

  const handleTogglePermission = async (role: RbacRole, permCode: string) => {
    if (!canRbacManage) {
      onNotify('Требуется право rbac:manage', 'err');
      return;
    }
    const exists = role.permissions.includes(permCode);
    const next = exists
      ? role.permissions.filter((p) => p !== permCode)
      : [...role.permissions, permCode];
    try {
      await refineClient.request(`/api/rbac/roles/${role.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: next }),
      });
      await loadRbac();
      onNotify(`Права роли «${role.name}» обновлены в PostgreSQL`);
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка обновления RBAC'), 'err');
    }
  };

  const handleUpdateRoleAcl = async (
    role: RbacRole,
    nextScope: 'all' | 'own',
    nextHiddenFields: string[]
  ) => {
    if (!canRbacManage) {
      onNotify('Требуется право rbac:manage', 'err');
      return;
    }
    try {
      await refineClient.request(`/api/rbac/roles/${role.id}/acl`, {
        method: 'PATCH',
        body: JSON.stringify({ dataScope: nextScope, hiddenFields: nextHiddenFields }),
      });
      await loadRbac();
      onNotify(`Область данных (ACL) для роли «${role.name}» обновлена`);
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка обновления ACL'), 'err');
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await refineClient.create('rbac/roles', {
        name: newRoleName,
        code: newRoleCode,
        permissions: ['deals:read', 'contacts:read', 'social:read', 'docs:read'],
      });
      setNewRoleName('');
      setNewRoleCode('');
      setShowNewRole(false);
      await loadRbac();
      onNotify('Новая роль RBAC создана');
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка создания роли'), 'err');
    }
  };

  const handleDeleteRole = async (role: RbacRole) => {
    try {
      await refineClient.deleteOne('rbac/roles', role.id);
      await loadRbac();
      onNotify(`Роль «${role.name}» удалена`);
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка удаления роли'), 'err');
    }
  };

  const handleAssignRole = async (userId: string, roleId: string) => {
    try {
      await refineClient.request('/api/rbac/users/assign', {
        method: 'PATCH',
        body: JSON.stringify({ userId, roleId }),
      });
      await loadRbac();
      onNotify('Роль сотрудника обновлена');
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка назначения роли'), 'err');
    }
  };

  const handleToggleUserStatus = async (user: RbacUserRow) => {
    try {
      await refineClient.request(`/api/rbac/users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      await loadRbac();
      onNotify(user.isActive ? 'Доступ сотрудника отключён' : 'Доступ сотрудника активирован');
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка статуса пользователя'), 'err');
    }
  };

  const openCreateCmsModal = () => {
    setEditingCms(null);
    setCmsTitle('');
    setCmsSlug('');
    setCmsSectionType('playbook');
    setCmsBody('');
    setCmsCta('Открыть');
    setCmsModalOpen(true);
  };

  const openEditCmsModal = (b: CmsBlock) => {
    setEditingCms(b);
    setCmsTitle(b.title);
    setCmsSlug(b.slug);
    setCmsSectionType(b.sectionType);
    setCmsBody(b.body);
    setCmsCta(b.ctaLabel);
    setCmsModalOpen(true);
  };

  const handleSaveCmsBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCms) {
        await refineClient.update('cms/blocks', editingCms.id, {
          title: cmsTitle,
          sectionType: cmsSectionType,
          body: cmsBody,
          ctaLabel: cmsCta,
        });
        onNotify('Блок TinaCMS обновлён');
      } else {
        await refineClient.create('cms/blocks', {
          title: cmsTitle,
          slug: cmsSlug || undefined,
          sectionType: cmsSectionType,
          body: cmsBody,
          ctaLabel: cmsCta,
          published: true,
        });
        onNotify('Блок TinaCMS опубликован в PostgreSQL');
      }
      setCmsModalOpen(false);
      await loadCmsAndDirectus();
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка сохранения TinaCMS'), 'err');
    }
  };

  const handleToggleCmsPublished = async (b: CmsBlock) => {
    try {
      await refineClient.update('cms/blocks', b.id, { published: !b.published });
      await loadCmsAndDirectus();
      onNotify(!b.published ? 'Блок опубликован на рабочем столе' : 'Блок скрыт в черновики');
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка публикации блока'), 'err');
    }
  };

  const handleDeleteCmsBlock = async (id: string) => {
    try {
      await refineClient.deleteOne('cms/blocks', id);
      await loadCmsAndDirectus();
      onNotify('Блок TinaCMS удалён');
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка удаления блока'), 'err');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Администрирование портала"
        subtitle={`Текущий тенант: ${activeTenant.subdomain}.platform.local · Роли RBAC, поддомены Traefik, TinaCMS и ресурсы узла`}
        actions={
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(
              [
                ['tenancy', 'Тенанты и Traefik', <Globe key="g" className="h-3.5 w-3.5" />],
                ['rbac', 'RBAC и пользователи', <Shield key="s" className="h-3.5 w-3.5" />],
                ['cms', 'Directus и TinaCMS', <Database key="d" className="h-3.5 w-3.5" />],
                ['health', 'Ресурсы и сервисы', <Activity key="a" className="h-3.5 w-3.5" />],
              ] as const
            ).map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
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

      {/* TENANCY & TRAEFIK */}
      {tab === 'tenancy' && (
        <div className="space-y-4">
          {!canTenantsAdmin ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
              Доступ к управлению тенантами на поддоменах открыт только для роли с разрешением{' '}
              <span className="font-mono font-semibold">tenants:admin</span> (Portal SuperAdmin).
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-7">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Тенанты на поддоменах ({tenants.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Изоляция PostgreSQL-данных и маршрутизация Traefik по X-Tenant-Subdomain
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewTenant(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5" /> Новый поддомен
                  </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 font-medium text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Компания и поддомен</th>
                        <th className="px-4 py-3">Тариф</th>
                        <th className="px-4 py-3">Квоты</th>
                        <th className="px-4 py-3">Статус</th>
                        <th className="px-4 py-3 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tenants.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{t.name}</div>
                            <div className="font-mono text-[11px] text-[#0077FF]">
                              {t.subdomain}.platform.local
                            </div>
                          </td>
                          <td className="px-4 py-3 uppercase text-slate-600">{t.plan}</td>
                          <td className="px-4 py-3 text-slate-600 tabular-nums">
                            {t.maxUsers} польз. / {t.maxDeals} сд.
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                t.status === 'active'
                                  ? 'font-medium text-emerald-700'
                                  : 'font-medium text-red-600'
                              }
                            >
                              {t.status === 'active' ? 'Активен' : 'Приостановлен'}
                            </span>
                          </td>
                          <td className="space-x-2 px-4 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => void onSwitchSubdomain(t.subdomain)}
                              className="font-medium text-[#0077FF] hover:underline"
                            >
                              {activeTenant.subdomain === t.subdomain ? 'Текущий' : 'Войти'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleTenantStatus(t)}
                              className="text-slate-500 hover:text-slate-900"
                            >
                              {t.status === 'active' ? 'Пауза' : 'Вкл'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">Traefik v3 Dynamic Router YAML</h3>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleCopyTraefikYaml()}
                      disabled={!traefikYaml}
                      title="Копировать YAML"
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      {yamlCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      {yamlCopied ? 'Скопировано' : 'Копировать'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadTraefikYaml}
                      disabled={!traefikYaml}
                      title="Скачать traefik-tenants.yml"
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <Download className="h-3 w-3" /> .yml
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadTenancy()}
                      className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                      aria-label="Обновить Traefik YAML"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Сгенерировано автоматически из таблицы tenants в PostgreSQL
                </p>
                <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 font-mono text-[11px] text-slate-100">
                  {traefikYaml || 'Загрузка...'}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RBAC & USERS */}
      {tab === 'rbac' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Ролевая модель RBAC</h3>
              <p className="text-xs text-slate-500">
                Каждое разрешение проверяется на сервере Express (requirePermission) и в клиенте Refine
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewRole(true)}
              disabled={!canRbacManage}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" /> Создать роль
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={permQuery}
                onChange={(e) => setPermQuery(e.target.value)}
                placeholder="Поиск права по коду или названию (deals:write, rbac...)..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#0077FF] focus:bg-white"
              />
            </div>
            <select
              aria-label="Фильтр прав по модулю"
              value={permModule}
              onChange={(e) => setPermModule(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0077FF]"
            >
              <option value="all">Все модули ({allPermissions.length})</option>
              {permissionModules.map((mod) => (
                <option key={mod} value={mod}>
                  {mod}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-medium text-slate-600">
                <tr>
                  <th className="px-4 py-3">Право (Permission)</th>
                  <th className="px-4 py-3">Модуль</th>
                  {roles.map((r) => (
                    <th key={r.id} className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <span>{r.name}</span>
                        {!r.isSystem && canRbacManage && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteRole(r)}
                            title="Удалить пользовательскую роль"
                            className="text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <div className="font-mono text-[10px] font-normal text-slate-400">{r.code}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPermissions.map((perm) => (
                  <tr key={perm.code} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-900">{perm.label}</div>
                      <div className="font-mono text-[11px] text-slate-400">{perm.code}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{perm.module}</td>
                    {roles.map((r) => {
                      const checked = r.permissions.includes(perm.code);
                      return (
                        <td key={r.id} className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!canRbacManage}
                            onChange={() => void handleTogglePermission(r, perm.code)}
                            className="h-4 w-4 cursor-pointer accent-[#0077FF]"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Область данных и скрытие полей (NocoBase ACL)
              </h3>
              <p className="text-xs text-slate-500">
                Ограничивайте видимость чужих сделок/записей (Data Scope: Все vs Только свои) и маскируйте чувствительные поля на уровне API
              </p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Роль</th>
                    <th className="px-4 py-2.5">Область записей (Data Scope)</th>
                    <th className="px-4 py-2.5">Скрытые поля (Field ACL)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roles.map((r) => {
                    const scope = r.dataScope === 'own' ? 'own' : 'all';
                    const hidden = Array.isArray(r.hiddenFields) ? r.hiddenFields : [];
                    return (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {r.name}
                          <div className="font-mono text-[10px] text-slate-400">{r.code}</div>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={scope}
                            disabled={!canRbacManage}
                            onChange={(e) =>
                              void handleUpdateRoleAcl(
                                r,
                                e.target.value as 'all' | 'own',
                                hidden
                              )
                            }
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none"
                          >
                            <option value="all">Все записи тенанта (all)</option>
                            <option value="own">Только свои записи (own)</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-3">
                            {maskableFields.map((mf) => {
                              const isHidden = hidden.includes(mf.key);
                              return (
                                <label
                                  key={mf.key}
                                  className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-700"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isHidden}
                                    disabled={!canRbacManage}
                                    onChange={() => {
                                      const next = isHidden
                                        ? hidden.filter((k) => k !== mf.key)
                                        : [...hidden, mf.key];
                                      void handleUpdateRoleAcl(r, scope, next);
                                    }}
                                    className="h-3.5 w-3.5 accent-[#0077FF]"
                                  />
                                  <span>{mf.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Сотрудники тенанта и доступ ({rbacUsers.length})
            </h3>
            <div className="mt-3 divide-y divide-slate-100">
              {rbacUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={u.avatarUrl}
                      alt={u.fullName}
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <div>
                      <div className="font-medium text-slate-900">
                        {u.fullName}{' '}
                        {!u.isActive && (
                          <span className="font-normal text-red-600">· Деактивирован</span>
                        )}
                      </div>
                      <div className="text-slate-400">{u.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={u.roleId}
                      disabled={!canRbacManage}
                      onChange={(e) => void handleAssignRole(u.id, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 outline-none"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    {canRbacManage && u.id !== actor.userId && (
                      <button
                        type="button"
                        onClick={() => void handleToggleUserStatus(u)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ${
                          u.isActive
                            ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {u.isActive ? 'Отключить' : 'Активировать'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DIRECTUS & TINACMS */}
      {tab === 'cms' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5">
            <h3 className="text-base font-semibold text-slate-900">
              Directus Collections (PostgreSQL)
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Интроспекция таблиц PostgreSQL текущего тенанта
            </p>
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5">Коллекция</th>
                    <th className="px-3 py-2.5">DDD Контекст</th>
                    <th className="px-3 py-2.5 text-right">Записей</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {collections.map((c) => (
                    <tr key={c.collection}>
                      <td className="px-3 py-2.5 font-mono font-medium text-slate-900">
                        {c.collection}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{c.boundedContext}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                        {c.records}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-slate-900">TinaCMS Content Blocks</h3>
                <p className="text-xs text-slate-500">
                  Плейбуки продаж и регламенты на рабочем столе портала
                </p>
              </div>
              {canCms && (
                <button
                  type="button"
                  onClick={openCreateCmsModal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" /> Новый блок
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {cmsBlocks.map((b) => (
                <div key={b.id} className="py-3.5 first:pt-2 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      {b.sectionType} · <span className="font-mono">{b.slug}</span> ·{' '}
                      <span className={b.published ? 'text-emerald-700 font-medium' : 'text-amber-700'}>
                        {b.published ? 'Опубликован' : 'Черновик'}
                      </span>
                    </span>
                    {canCms && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleToggleCmsPublished(b)}
                          title={b.published ? 'Снять с публикации' : 'Опубликовать'}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        >
                          {b.published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditCmsModal(b)}
                          title="Редактировать"
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-[#0077FF]"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteCmsBlock(b.id)}
                          title="Удалить"
                          className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{b.title}</div>
                  <p className="mt-1 text-xs text-slate-600">{b.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SYSTEM HEALTH & TELEMETRY */}
      {tab === 'health' && (
        <SystemHealthDashboard activeTenant={activeTenant} onNotify={onNotify} />
      )}

      {/* New Tenant Modal */}
      <Modal
        open={showNewTenant}
        onClose={() => setShowNewTenant(false)}
        title="Новый тенант на поддомене"
      >
        <form onSubmit={handleCreateTenant} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Название организации</label>
            <input
              required
              value={tName}
              onChange={(e) => setTName(e.target.value)}
              placeholder="Nordic Energy Corp"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Поддомен (*.platform.local)</label>
            <input
              required
              value={tSub}
              onChange={(e) => setTSub(e.target.value)}
              placeholder="nordic"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Тарифный план</label>
            <select
              value={tPlan}
              onChange={(e) => setTPlan(e.target.value as typeof tPlan)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
            >
              <option value="starter">Starter</option>
              <option value="growth">Growth</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowNewTenant(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Создать поддомен
            </button>
          </div>
        </form>
      </Modal>

      {/* New RBAC Role Modal */}
      <Modal open={showNewRole} onClose={() => setShowNewRole(false)} title="Создать роль RBAC">
        <form onSubmit={handleCreateRole} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Название роли</label>
            <input
              required
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="Модератор комьюнити"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Код роли (латиница)</label>
            <input
              required
              value={newRoleCode}
              onChange={(e) => setNewRoleCode(e.target.value)}
              placeholder="community_mod"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowNewRole(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Создать
            </button>
          </div>
        </form>
      </Modal>

      {/* TinaCMS Block Create / Edit Modal */}
      <Modal
        open={cmsModalOpen}
        onClose={() => setCmsModalOpen(false)}
        title={editingCms ? 'Редактировать блок TinaCMS' : 'Новый блок TinaCMS'}
      >
        <form onSubmit={handleSaveCmsBlock} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Заголовок</label>
            <input
              required
              value={cmsTitle}
              onChange={(e) => setCmsTitle(e.target.value)}
              placeholder="Регламент Enterprise-сделок"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Тип секции</label>
              <select
                value={cmsSectionType}
                onChange={(e) => setCmsSectionType(e.target.value as CmsBlock['sectionType'])}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
              >
                <option value="playbook">playbook</option>
                <option value="announcement">announcement</option>
                <option value="onboarding">onboarding</option>
                <option value="hero">hero</option>
                <option value="release">release</option>
                <option value="faq">faq</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Текст кнопки CTA</label>
              <input
                value={cmsCta}
                onChange={(e) => setCmsCta(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
              />
            </div>
          </div>
          {!editingCms && (
            <div>
              <label className="block text-xs font-medium text-slate-700">Slug (опционально)</label>
              <input
                value={cmsSlug}
                onChange={(e) => setCmsSlug(e.target.value)}
                placeholder="enterprise-playbook"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-[#0077FF]"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700">Содержимое</label>
            <textarea
              rows={4}
              required
              value={cmsBody}
              onChange={(e) => setCmsBody(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCmsModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              {editingCms ? 'Сохранить изменения' : 'Создать блок'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
