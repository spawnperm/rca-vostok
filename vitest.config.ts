import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Several suites import heavy browser-side modules (recharts, fullcalendar,
    // jsPDF) through the module graph. On a cold cache — and especially when the
    // repository lives on a bind-mounted Windows drive — a single dynamic import
    // can take tens of seconds, so the 5s default is not enough.
    testTimeout: 60000,
    hookTimeout: 60000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@nexus-core/ddd-kernel': path.resolve(__dirname, 'packages/ddd-kernel/src/index.ts'),
      '@nexus-plugins/dify-deal-copilot': path.resolve(__dirname, 'packages/dify-deal-copilot/src/index.ts'),
      '@nexus-plugins/nats-webhook-bridge': path.resolve(__dirname, 'packages/nats-webhook-bridge/src/index.ts'),
      '@nexus-plugins/vk-social-polls': path.resolve(__dirname, 'packages/vk-social-polls/src/index.ts'),
      '@nexus-plugins/directus-bi-connector': path.resolve(__dirname, 'packages/directus-bi-connector/src/index.ts'),
      '@nexus-plugins/tinacms-sales-playbooks': path.resolve(__dirname, 'packages/tinacms-sales-playbooks/src/index.ts'),
    },
  },
});
