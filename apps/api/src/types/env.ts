export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  HACKATHON_SM: DurableObjectNamespace;
  WEBHOOK_QUEUE: Queue;
  NOTIFICATION_QUEUE: Queue;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_WEBHOOK_SECRET: string;
  FRONTEND_URL: string;
  PLATFORM_URL: string;
  ADMIN_URL: string;
  SMTP_URL: string;
  SMTP_USERNAME: string;
  SMTP_PASSWORD: string;
  SMTP_EMAIL_ADDR: string;
}
