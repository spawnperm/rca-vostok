/**
 * RBAC vocabulary for the identity bounded context.
 *
 * Roles are coarse organisational labels; permissions are the capabilities the
 * application actually checks. Route guards and UI rendering both resolve
 * permissions through `ROLE_PERMISSIONS`, so a role change is a one-line edit
 * rather than a scattering of `role === '...'` checks.
 */

export const PERMISSIONS = {
  VIEW_OWN_PROFILE: 'profile:view_own',
  EDIT_OWN_PROFILE: 'profile:edit_own',
  VIEW_OWN_INQUIRIES: 'inquiries:view_own',
  SUBMIT_INQUIRY: 'inquiries:submit',
  VIEW_ALL_INQUIRIES: 'inquiries:view_all',
  MANAGE_USERS: 'users:manage',
  VIEW_ANALYTICS: 'analytics:view',
  VIEW_ADMIN_DASHBOARD: 'admin:dashboard',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

export const ROLES = {
  CANDIDATE: 'candidate',
  INSTRUCTOR: 'instructor',
  CURATOR: 'curator',
  ADMIN: 'admin',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: readonly Role[] = Object.values(ROLES);

/** Human-readable labels used by the cabinet UI. */
export const ROLE_LABELS: Record<Role, string> = {
  candidate: 'Соискатель',
  instructor: 'Инструктор-проводник',
  curator: 'Куратор РЦА',
  admin: 'Администратор',
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  'profile:view_own': 'Просмотр своего профиля',
  'profile:edit_own': 'Редактирование своего профиля',
  'inquiries:view_own': 'Просмотр своих заявок',
  'inquiries:submit': 'Подача заявки на аттестацию',
  'inquiries:view_all': 'Просмотр всех заявок',
  'users:manage': 'Управление пользователями',
  'analytics:view': 'Просмотр аналитики платформы',
  'admin:dashboard': 'Административная панель',
};

/**
 * Role -> permission grants. Deliberately explicit and cumulative: a curator
 * inherits everything an instructor can do, an admin everything a curator can.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  candidate: [
    PERMISSIONS.VIEW_OWN_PROFILE,
    PERMISSIONS.EDIT_OWN_PROFILE,
    PERMISSIONS.VIEW_OWN_INQUIRIES,
    PERMISSIONS.SUBMIT_INQUIRY,
  ],
  instructor: [
    PERMISSIONS.VIEW_OWN_PROFILE,
    PERMISSIONS.EDIT_OWN_PROFILE,
    PERMISSIONS.VIEW_OWN_INQUIRIES,
    PERMISSIONS.SUBMIT_INQUIRY,
  ],
  curator: [
    PERMISSIONS.VIEW_OWN_PROFILE,
    PERMISSIONS.EDIT_OWN_PROFILE,
    PERMISSIONS.VIEW_OWN_INQUIRIES,
    PERMISSIONS.SUBMIT_INQUIRY,
    PERMISSIONS.VIEW_ALL_INQUIRIES,
    PERMISSIONS.VIEW_ANALYTICS,
  ],
  admin: ALL_PERMISSIONS,
};

/** Roles an admin may assign through the management UI. */
export const ASSIGNABLE_ROLES: readonly Role[] = ALL_ROLES;

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ALL_ROLES as readonly string[]).includes(value);
}

export function permissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Parses a raw role coming from persistence or HTTP. Unknown values degrade to
 * the least-privileged role instead of throwing, so a corrupted row cannot
 * accidentally grant access.
 */
export function parseRole(value: unknown, fallback: Role = ROLES.CANDIDATE): Role {
  return isRole(value) ? value : fallback;
}
