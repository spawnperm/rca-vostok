interface TinaField {
  type: string;
  name: string;
  label: string;
  isTitle?: boolean;
  required?: boolean;
  options?: string[];
  ui?: { component: string };
}

interface TinaCollection {
  name: string;
  label: string;
  path: string;
  format: string;
  fields: TinaField[];
}

export interface TinaSchemaConfig {
  branch: string;
  clientId: string;
  token: string;
  build: { outputFolder: string; publicFolder: string };
  schema: { collections: TinaCollection[] };
}

const defineConfig = (config: TinaSchemaConfig): TinaSchemaConfig => config;

export default defineConfig({
  branch: process.env.TINA_BRANCH || 'main',
  clientId: process.env.TINA_CLIENT_ID || 'local-client',
  token: process.env.TINA_TOKEN || '',
  build: {
    outputFolder: 'admin',
    publicFolder: 'public',
  },
  schema: {
    collections: [
      {
        name: 'portalPage',
        label: 'Portal Landing & Knowledge Blocks',
        path: 'content/portal',
        format: 'json',
        fields: [
          { type: 'string', name: 'title', label: 'Block Title', isTitle: true, required: true },
          { type: 'string', name: 'tenantSubdomain', label: 'Tenant Subdomain', required: true },
          {
            type: 'string',
            name: 'sectionType',
            label: 'Section Type',
            options: ['hero', 'announcement', 'playbook', 'faq'],
          },
          { type: 'string', name: 'body', label: 'Body Content', ui: { component: 'textarea' } },
          { type: 'string', name: 'ctaLabel', label: 'Action Button Label' },
        ],
      },
    ],
  },
});
