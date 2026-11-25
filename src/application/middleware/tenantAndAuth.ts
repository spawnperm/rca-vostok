import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { PolicyEvaluator } from '../../domain/iam/rbac.ts';
import type { PermissionCode } from '../../domain/iam/rbac.ts';
import type { AuthenticatedActor, TenantContext } from '../../domain/shared/types.ts';
import { getDb } from '../../infrastructure/db/client.ts';
import { rolePermissions, roles, tenants, users } from '../../infrastructure/db/schema.ts';

const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

function getSigningSecret(): string {
  return process.env.SESSION_SECRET || EPHEMERAL_SECRET;
}

export interface TokenPayload {
  userId: string;
  tenantId: string;
  exp: number;
}

export function signSessionToken(userId: string, tenantId: string): string {
  const payload: TokenPayload = {
    userId,
    tenantId,
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSigningSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = crypto.createHmac('sha256', getSigningSecret()).update(encoded).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed.userId || !parsed.tenantId || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface PortalRequest extends Request {
  tenant?: TenantContext;
  actor?: AuthenticatedActor;
}

export function extractSubdomain(req: Request): string {
  const headerSub = req.headers['x-tenant-subdomain'];
  if (typeof headerSub === 'string' && /^[a-z0-9-]+$/.test(headerSub.trim())) {
    return headerSub.trim().toLowerCase();
  }
  const host = (req.headers.host || '').split(':')[0].toLowerCase();
  if (host.endsWith('.platform.local')) {
    const sub = host.replace('.platform.local', '');
    if (sub && !sub.includes('.')) return sub;
  }
  return 'acme';
}

export async function resolveTenant(req: PortalRequest, res: Response, next: NextFunction) {
  try {
    const db = await getDb();
    const subdomain = extractSubdomain(req);
    const [tenantRow] = await db.select().from(tenants).where(eq(tenants.subdomain, subdomain));

    const fallbackRows = tenantRow ? [tenantRow] : await db.select().from(tenants).where(eq(tenants.subdomain, 'acme'));
    const active = fallbackRows[0];
    if (!active) {
      return res.status(404).json({ error: 'Тенант портала не найден' });
    }

    req.tenant = {
      id: active.id,
      subdomain: active.subdomain,
      name: active.name,
      plan: active.plan as TenantContext['plan'],
      status: active.status as TenantContext['status'],
    };
    next();
  } catch (err) {
    console.error('Tenant resolution error:', err);
    res.status(500).json({ error: 'Ошибка определения тенанта' });
  }
}

export async function requireAuth(req: PortalRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const bearerMatch = typeof authHeader === 'string' ? /^bearer\s+(.+)$/i.exec(authHeader.trim()) : null;
  if (!bearerMatch) {
    return res.status(401).json({ error: 'Требуется авторизация (Bearer token)' });
  }

  const token = bearerMatch[1].trim();
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Сессия недействительна или истекла' });
  }

  try {
    const db = await getDb();
    const [userRow] = await db.select().from(users).where(eq(users.id, payload.userId));
    if (!userRow || !userRow.isActive) {
      return res.status(401).json({ error: 'Пользователь не найден или деактивирован' });
    }

    const [roleRow] = await db.select().from(roles).where(eq(roles.id, userRow.roleId));
    const permRows = roleRow
      ? await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, roleRow.id))
      : [];

    const permissions = permRows.map((p) => p.permission);

    // Portal SuperAdmin (with tenants:admin) can inspect other subdomains cleanly
    const isPortalSuperAdmin = permissions.includes('tenants:admin');
    if (req.tenant && userRow.tenantId !== req.tenant.id && !isPortalSuperAdmin) {
      return res.status(403).json({
        error: 'Доступ запрещен: пользователь не принадлежит данному поддомену тенанта',
      });
    }

    if (req.tenant?.status === 'suspended' && !isPortalSuperAdmin) {
      return res.status(403).json({ error: 'Тенант приостановлен администратором портала' });
    }

    req.actor = {
      userId: userRow.id,
      email: userRow.email,
      fullName: userRow.fullName,
      tenantId: req.tenant?.id || userRow.tenantId,
      roleId: roleRow?.id || userRow.roleId,
      roleName: roleRow?.name || 'User',
      permissions,
      dataScope: roleRow?.dataScope === 'own' ? 'own' : 'all',
      hiddenFields: Array.isArray(roleRow?.hiddenFields) ? roleRow.hiddenFields : [],
      avatarUrl: userRow.avatarUrl,
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Ошибка проверки прав доступа' });
  }
}

export function requirePermission(permission: PermissionCode) {
  return (req: PortalRequest, res: Response, next: NextFunction) => {
    if (!req.actor) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    if (!PolicyEvaluator.hasPermission(req.actor.permissions, permission)) {
      return res.status(403).json({
        error: `Недостаточно прав RBAC: требуется разрешение ${permission}`,
        requiredPermission: permission,
        role: req.actor.roleName,
      });
    }
    next();
  };
}

export function requireAnyPermission(permissions: readonly PermissionCode[]) {
  return (req: PortalRequest, res: Response, next: NextFunction) => {
    if (!req.actor) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    if (!PolicyEvaluator.hasAnyPermission(req.actor.permissions, permissions)) {
      return res.status(403).json({
        error: `Недостаточно прав RBAC: требуется одно из разрешений (${permissions.join(', ')})`,
        requiredPermissions: permissions,
        role: req.actor.roleName,
      });
    }
    next();
  };
}
