/**
 * AuthAppEnv — Hono environment type for the DevSage API Worker.
 * Used as the generic parameter for OpenAPIHono and route handlers.
 */
export interface AuthAppEnv {
  Bindings: {
    // Cloudflare bindings
    DB: D1Database;
    KV: KVNamespace;
    HACKATHON_SM: DurableObjectNamespace;
    WEBHOOK_QUEUE: Queue;
    NOTIFICATION_QUEUE: Queue;

    // Better Auth secrets
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;

    // OAuth provider credentials
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;

    // Existing secrets
    JWT_SECRET: string;
    GITHUB_WEBHOOK_SECRET: string;
    SMTP_URL: string;
    SMTP_USERNAME: string;
    SMTP_PASSWORD: string;
    SMTP_EMAIL_ADDR?: string;
    GEMINI_API_KEY?: string;

    // Non-secret vars
    NODE_ENV?: string;
    FRONTEND_URL: string;
    PLATFORM_URL: string;
    ADMIN_URL: string;
    API_URL: string;
    EMAIL_FROM: string;
    HACKATHON_ORIGIN_PATTERN?: string;
    PAGES_ORIGIN_PATTERN?: string;
    WORKERS_ORIGIN_PATTERN?: string;
  };
  Variables: {
    requestId: string;
    // Legacy variables — kept for backward compat during brownfield rebuild
    user: UserContext | null;
    hackathon?: HackathonContext;
    role?: HackathonRole;
  };
}

// Keep AppEnv as alias for backward compatibility during brownfield rebuild
export type AppEnv = AuthAppEnv;

export interface UserContext {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  github_username: string;
  created_at: string;
}

export interface HackathonContext {
  id: string;
  workspace_id: string;
  slug: string;
  status: string;
}

export type HackathonRole = 'organizer' | 'co_organizer' | 'judge' | 'leader' | 'member' | 'anonymous';
