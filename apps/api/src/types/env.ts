export interface Env {
  // ─── Cloudflare Bindings (always present) ──────────────────
  DB: D1Database;
  KV: KVNamespace;
  HACKATHON_SM: DurableObjectNamespace;
  WEBHOOK_QUEUE: Queue;
  NOTIFICATION_QUEUE: Queue;

  // ─── Cloudflare Bindings (not yet provisioned) ─────────────
  /** Enable after R2 bucket is created in Cloudflare Dashboard. */
  R2?: R2Bucket;
  /** Enable after: wrangler queues create devsage-events */
  EVENT_QUEUE?: Queue;
  /** Enable after RealtimeGateway DO is implemented. */
  REALTIME_GW?: DurableObjectNamespace;

  // ─── Auth Secrets ──────────────────────────────────────────
  JWT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;

  // ─── GitHub App (for webhook/repo integration, NOT login) ──
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;

  // ─── SMTP ──────────────────────────────────────────────────
  SMTP_URL: string;
  SMTP_USERNAME: string;
  SMTP_PASSWORD: string;
  SMTP_EMAIL_ADDR: string;

  // ─── Frontend URLs ─────────────────────────────────────────
  FRONTEND_URL: string;
  PLATFORM_URL: string;
  ADMIN_URL: string;
}
