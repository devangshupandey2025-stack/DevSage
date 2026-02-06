export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  HACKATHON_LIFECYCLE: DurableObjectNamespace;
  SUBMISSION: DurableObjectNamespace;
  WEBHOOK_QUEUE: Queue;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_WEBHOOK_SECRET: string;
  FRONTEND_URL: string;
}
