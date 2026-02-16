import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' },
        singleWorker: true,
        isolatedStorage: false,
        miniflare: {
          bindings: {
            JWT_SECRET: 'dev-secret-key-min-32-chars-long!!',
            GITHUB_WEBHOOK_SECRET: 'test-webhook-secret-min-32-chars!!',
            FRONTEND_URL: 'http://localhost:5173',
            PLATFORM_URL: 'http://localhost:5174',
            ADMIN_URL: 'http://localhost:5175',
            DEV_AUTH_BYPASS: '',
          },
        },
      },
    },
  },
});
