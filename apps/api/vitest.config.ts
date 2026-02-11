import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' },
        singleWorker: true,
        miniflare: {
          bindings: {
            JWT_SECRET: 'dev-secret-key-min-32-chars-long!!',
            GOOGLE_CLIENT_ID: 'test-google-client-id',
            GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
            GITHUB_CLIENT_ID: 'test-github-client-id',
            GITHUB_CLIENT_SECRET: 'test-github-client-secret',
            GITHUB_WEBHOOK_SECRET: 'test-webhook-secret-min-32-chars!!',
            FRONTEND_URL: 'http://localhost:5173',
          },
        },
      },
    },
  },
});
