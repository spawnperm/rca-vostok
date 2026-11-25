import { z } from 'zod';
import { SubdomainSlugSchema } from '../shared/types.ts';

export const CreateTenantSchema = z.object({
  name: z.string().trim().min(2, 'Название компании обязательно').max(80),
  subdomain: SubdomainSlugSchema,
  plan: z.enum(['starter', 'growth', 'enterprise']).default('growth'),
  maxUsers: z.coerce.number().int().min(1).max(10000).default(50),
  maxDeals: z.coerce.number().int().min(10).max(500000).default(10000),
});

export const UpdateTenantSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  plan: z.enum(['starter', 'growth', 'enterprise']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  maxUsers: z.coerce.number().int().min(1).max(10000).optional(),
  maxDeals: z.coerce.number().int().min(10).max(500000).optional(),
});

export function buildTraefikHostRule(subdomain: string, baseDomain = 'platform.local'): string {
  return `Host(\`${subdomain}.${baseDomain}\`)`;
}
