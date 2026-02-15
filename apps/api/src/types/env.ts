export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  HACKATHON_SM: DurableObjectNamespace;
  REALTIME_GW: DurableObjectNamespace;
  WEBHOOK_QUEUE: Queue;
  EVENT_QUEUE: Queue;
  NOTIFICATION_QUEUE: Queue;
  JWT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SMTP_URL: string;
  SMTP_USERNAME: string;
  SMTP_PASSWORD: string;
  SMTP_EMAIL_ADDR: string;
  FRONTEND_URL: string;
  PLATFORM_URL: string;
  ADMIN_URL: string;
}
