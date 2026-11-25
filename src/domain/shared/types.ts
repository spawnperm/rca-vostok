import { z } from 'zod';

export interface DomainEvent<T = Record<string, unknown>> {
  id: string;
  subject: string;
  tenantId: string;
  actorId: string;
  occurredAt: string;
  payload: T;
}

export interface TenantContext {
  id: string;
  subdomain: string;
  name: string;
  plan: 'starter' | 'growth' | 'enterprise';
  status: 'active' | 'suspended';
}

export interface AuthenticatedActor {
  userId: string;
  email: string;
  fullName: string;
  tenantId: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  dataScope?: 'all' | 'own';
  hiddenFields?: string[];
  avatarUrl: string;
}

export const SubdomainSlugSchema = z
  .string()
  .min(2, 'Поддомен должен содержать минимум 2 символа')
  .max(48, 'Поддомен не может превышать 48 символов')
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Разрешены только строчные латинские буквы, цифры и дефис')
  .refine(
    (val) => !['www', 'api', 'admin', 'traefik', 'verdaccio', 'nats', 'directus'].includes(val),
    'Этот поддомен зарезервирован платформой'
  );

export const NonEmptyString = z.string().trim().min(1, 'Поле обязательно для заполнения');
