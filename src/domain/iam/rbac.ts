import { z } from 'zod';

export const ALL_PERMISSIONS = [
  'deals:read',
  'deals:write',
  'deals:delete',
  'contacts:read',
  'contacts:write',
  'tasks:read',
  'tasks:write',
  'social:read',
  'social:post',
  'social:moderate',
  'plugins:read',
  'plugins:manage',
  'tenants:admin',
  'rbac:manage',
  'harness:execute',
  'cms:edit',
  'docs:read',
  'collections:read',
  'collections:manage',
  'workflows:read',
  'workflows:manage',
] as const;

export type PermissionCode = (typeof ALL_PERMISSIONS)[number];
export type DataScopeMode = 'all' | 'own';

export const ROLE_MASKABLE_FIELDS = [
  { key: 'budget', label: 'Бюджет сделки' },
  { key: 'lossReason', label: 'Причина проигрыша' },
  { key: 'phone', label: 'Телефон контакта' },
  { key: 'email', label: 'Email контакта' },
] as const;

export const PermissionMetadata: Record<
  PermissionCode,
  { module: string; label: string; description: string }
> = {
  'deals:read': { module: 'CRM', label: 'Просмотр сделок', description: 'Чтение воронок, сделок и таймлайна' },
  'deals:write': { module: 'CRM', label: 'Управление сделками', description: 'Создание, редактирование и смена этапов' },
  'deals:delete': { module: 'CRM', label: 'Удаление сделок', description: 'Безвозвратное удаление карточек сделок' },
  'contacts:read': { module: 'CRM', label: 'Просмотр контактов', description: 'Доступ к базе контактов и компаний' },
  'contacts:write': { module: 'CRM', label: 'Редактирование контактов', description: 'Добавление и обновление клиентов' },
  'tasks:read': { module: 'CRM', label: 'Просмотр задач', description: 'Просмотр календаря задач менеджеров' },
  'tasks:write': { module: 'CRM', label: 'Постановка задач', description: 'Создание и закрытие задач по сделкам' },
  'social:read': { module: 'Соцсеть', label: 'Лента и профили', description: 'Просмотр профилей, стен и групп сотрудников' },
  'social:post': { module: 'Соцсеть', label: 'Публикации и комментарии', description: 'Размещение постов, лайков и комментариев' },
  'social:moderate': { module: 'Соцсеть', label: 'Модерация контента', description: 'Удаление чужих постов и управление группами' },
  'plugins:read': { module: 'Маркет', label: 'Каталог плагинов', description: 'Просмотр пакетов Verdaccio в Маркете' },
  'plugins:manage': { module: 'Маркет', label: 'Установка и публикация', description: 'Установка, включение, настройка и публикация плагинов' },
  'tenants:admin': { module: 'Портал', label: 'Управление тенантами', description: 'Создание поддоменов, квот и маршрутов Traefik' },
  'rbac:manage': { module: 'Безопасность', label: 'Матрица RBAC', description: 'Создание ролей и назначение прав пользователям' },
  'harness:execute': { module: 'Harness & Dify', label: 'Запуск пайплайнов', description: 'Выполнение DeepSeek-Harness и Dify сценариев' },
  'cms:edit': { module: 'CMS', label: 'TinaCMS и Directus', description: 'Редактирование блоков портала и коллекций' },
  'docs:read': { module: 'Платформа', label: 'Scalar & Archify', description: 'Доступ к OpenAPI спецификации и архитектуре' },
  'collections:read': { module: 'NocoBase', label: 'Коллекции и записи', description: 'Просмотр динамических коллекций, канбана и календаря' },
  'collections:manage': { module: 'NocoBase', label: 'Конструктор схемы данных', description: 'Создание коллекций, полей, формул и редактирование записей' },
  'workflows:read': { module: 'NocoBase', label: 'Процессы и согласования', description: 'Просмотр автоматизаций и участие в согласованиях' },
  'workflows:manage': { module: 'NocoBase', label: 'Редактор автоматизаций', description: 'Создание триггерных сценариев, узлов и правил согласования' },
};

export const CreateRoleSchema = z.object({
  name: z.string().trim().min(2).max(60),
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9_]+$/, 'Код роли должен состоять из латиницы, цифр и _'),
  description: z.string().trim().max(240).default(''),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).min(1, 'Выберите хотя бы одно право'),
  dataScope: z.enum(['all', 'own']).default('all'),
  hiddenFields: z.array(z.string()).default([]),
});

export const UpdateRolePermissionsSchema = z.object({
  permissions: z.array(z.enum(ALL_PERMISSIONS)),
});

export const UpdateRoleAclSchema = z.object({
  dataScope: z.enum(['all', 'own']),
  hiddenFields: z.array(z.string().trim().min(1).max(60)).max(20),
});

export const AssignUserRoleSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
});

export const ToggleUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export class PolicyEvaluator {
  static hasPermission(granted: readonly string[], required: PermissionCode): boolean {
    return granted.includes(required);
  }

  static hasAnyPermission(granted: readonly string[], required: readonly PermissionCode[]): boolean {
    return required.some((perm) => granted.includes(perm));
  }
}
