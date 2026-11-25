import { z } from 'zod';

export const PluginSlotSchema = z.enum([
  'crm_deal_sidebar',
  'crm_toolbar',
  'social_composer',
  'portal_module',
]);

export const InstallPluginSchema = z.object({
  pluginId: z.string().min(1),
});

export const TogglePluginSchema = z.object({
  enabled: z.boolean(),
});

export const UpdatePluginConfigSchema = z.object({
  config: z.record(z.string(), z.unknown()),
});

export const PublishVerdaccioPluginSchema = z.object({
  npmPackageName: z
    .string()
    .trim()
    .regex(/^@nexus-plugins\/[a-z0-9-]+$/, 'Пакет должен иметь scope @nexus-plugins/<slug>'),
  version: z.string().trim().regex(/^\d+\.\d+\.\d+$/, 'Укажите SemVer версию (например 1.0.0)'),
  name: z.string().trim().min(2).max(80),
  category: z.enum(['AI & Harness', 'CRM Automation', 'Social Widgets', 'Integrations', 'DevOps']),
  description: z.string().trim().min(10).max(400),
  slot: PluginSlotSchema,
  author: z.string().trim().min(2).max(80).default('Internal Studio'),
});
