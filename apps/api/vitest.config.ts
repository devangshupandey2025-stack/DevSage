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
            BETTER_AUTH_SECRET: 'test-ba-secret-min-32-chars-long!!',
            BETTER_AUTH_URL: 'http://localhost:8787',
            GITHUB_CLIENT_ID: 'test-github-client-id',
            GITHUB_CLIENT_SECRET: 'test-github-client-secret',
            GOOGLE_CLIENT_ID: 'test-google-client-id',
            GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
          },
        },
      },
    },
  },
});
