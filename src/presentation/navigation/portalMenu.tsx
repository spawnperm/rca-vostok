import React from 'react';
import {
  CalendarDays,
  CheckSquare,
  Code2,
  Database,
  FileSpreadsheet,
  FolderKanban,
  LayoutDashboard,
  Mail,
  MessageSquare,
  ShieldCheck,
  Store,
  UserCircle2,
  Users,
  Workflow,
} from 'lucide-react';
import type { PermissionCode } from '../../domain/iam/rbac.ts';
import type { AuthenticatedActor } from '../../domain/shared/types.ts';
import type { PortalSectionId } from '../types.ts';

export interface MenuItemDef {
  id: PortalSectionId;
  label: string;
  description: string;
  icon: React.ReactNode;
  anyPermissions?: PermissionCode[];
}

export interface MenuGroupDef {
  title: string;
  items: MenuItemDef[];
}

export const PORTAL_MENU_GROUPS: MenuGroupDef[] = [
  {
    title: 'Обзор и коммуникации',
    items: [
      {
        id: 'dashboard',
        label: 'Обзор',
        description: 'KPI, настраиваемые виджеты, воронка и лента событий',
        icon: <LayoutDashboard className="h-4 w-4 shrink-0" />,
      },
      {
        id: 'chat',
        label: 'Командный чат',
        description: 'Каналы Mattermost, личные диалоги и обсуждения в реальном времени',
        icon: <MessageSquare className="h-4 w-4 shrink-0" />,
        anyPermissions: ['social:read'],
      },
      {
        id: 'profile',
        label: 'Сообщество и профиль',
        description: 'Корпоративная стена, опросы, команда, группы и личная карточка',
        icon: <UserCircle2 className="h-4 w-4 shrink-0" />,
        anyPermissions: ['social:read'],
      },
    ],
  },
  {
    title: 'CRM и продажи',
    items: [
      {
        id: 'deals',
        label: 'Сделки',
        description: 'Воронки amoCRM, Kanban, список, Gantt и AI-скоринг',
        icon: <FolderKanban className="h-4 w-4 shrink-0" />,
        anyPermissions: ['deals:read'],
      },
      {
        id: 'contacts',
        label: 'Клиенты и компании',
        description: 'Справочник контрагентов, конструктор полей, импорт и экспорт',
        icon: <Users className="h-4 w-4 shrink-0" />,
        anyPermissions: ['contacts:read'],
      },
      {
        id: 'tasks',
        label: 'Задачи',
        description: 'Трекер поручений, просрочки, фильтры и контроль сроков',
        icon: <CheckSquare className="h-4 w-4 shrink-0" />,
        anyPermissions: ['tasks:read'],
      },
      {
        id: 'calendar',
        label: 'Календарь',
        description: 'Встречи по сделкам, звонки и AI-слоты с Drag & Drop',
        icon: <CalendarDays className="h-4 w-4 shrink-0" />,
        anyPermissions: ['tasks:read', 'deals:read'],
      },
      {
        id: 'templates',
        label: 'Шаблоны писем',
        description: 'Конструктор CRM-писем с переменными и живым предпросмотром',
        icon: <Mail className="h-4 w-4 shrink-0" />,
        anyPermissions: ['deals:read'],
      },
    ],
  },
  {
    title: 'Документы и процессы',
    items: [
      {
        id: 'office',
        label: 'Офис Univer, S3 и Git',
        description: 'Таблицы, документы, слайды, файловый менеджер Garage S3 и Forgejo',
        icon: <FileSpreadsheet className="h-4 w-4 shrink-0" />,
        anyPermissions: ['deals:read', 'docs:read'],
      },
      {
        id: 'collections',
        label: 'Коллекции данных',
        description: 'Динамические таблицы NocoBase, формулы, связи, Kanban и календарь',
        icon: <Database className="h-4 w-4 shrink-0" />,
        anyPermissions: ['collections:read', 'deals:read'],
      },
      {
        id: 'workflows',
        label: 'Процессы и NATS',
        description: 'Визуальные сценарии n8n, центр согласований и очередь NATS JetStream',
        icon: <Workflow className="h-4 w-4 shrink-0" />,
        anyPermissions: ['workflows:read', 'harness:execute', 'deals:read'],
      },
    ],
  },
  {
    title: 'Платформа и разработка',
    items: [
      {
        id: 'marketplace',
        label: 'Маркет плагинов',
        description: 'Реестр Verdaccio, DDD-модули, .tgz пакеты и проверка зависимостей',
        icon: <Store className="h-4 w-4 shrink-0" />,
        anyPermissions: ['plugins:read'],
      },
      {
        id: 'admin',
        label: 'Администрирование',
        description: 'Тенанты Traefik, матрица RBAC/ACL, TinaCMS, Directus и мониторинг',
        icon: <ShieldCheck className="h-4 w-4 shrink-0" />,
        anyPermissions: ['tenants:admin', 'rbac:manage', 'cms:edit', 'docs:read'],
      },
      {
        id: 'devtools',
        label: 'Консоль разработчика',
        description: 'DeepSeek-Harness, Scalar OpenAPI 3.1, Archify DDD и Storybook UI',
        icon: <Code2 className="h-4 w-4 shrink-0" />,
        anyPermissions: ['docs:read', 'harness:execute'],
      },
    ],
  },
];

export function filterVisibleMenuGroups(
  groups: MenuGroupDef[],
  actor: AuthenticatedActor | null
): MenuGroupDef[] {
  if (!actor) return [];
  const permSet = new Set(actor.permissions);
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.anyPermissions || item.anyPermissions.some((perm) => permSet.has(perm))
      ),
    }))
    .filter((group) => group.items.length > 0);
}

export function getAllowedSections(groups: MenuGroupDef[]): Set<PortalSectionId> {
  const ids = new Set<PortalSectionId>();
  for (const group of groups) {
    for (const item of group.items) {
      ids.add(item.id);
    }
  }
  return ids;
}

export function findSectionLabel(groups: MenuGroupDef[], sectionId: PortalSectionId): string {
  for (const g of groups) {
    const found = g.items.find((i) => i.id === sectionId);
    if (found) return found.label;
  }
  return 'Обзор';
}
