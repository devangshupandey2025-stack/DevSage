export interface AppEnv {
  Bindings: {
    DB: D1Database;
    KV: KVNamespace;
    HACKATHON_SM: DurableObjectNamespace;
    WEBHOOK_QUEUE: Queue;
    NOTIFICATION_QUEUE: Queue;
    JWT_SECRET: string;
    GITHUB_WEBHOOK_SECRET: string;
    SMTP_URL: string;
    SMTP_USERNAME: string;
    SMTP_PASSWORD: string;
    SMTP_EMAIL_ADDR?: string;
    GEMINI_API_KEY?: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    NODE_ENV?: string;
    FRONTEND_URL: string;
    PLATFORM_URL: string;
    ADMIN_URL: string;
    JUDGE_URL: string;
    API_URL: string;
    EMAIL_FROM: string;
    HACKATHON_ORIGIN_PATTERN?: string;
    PAGES_ORIGIN_PATTERN?: string;
  };
  Variables: {
    user: UserContext | null;
    requestId: string;
    hackathon?: HackathonContext;
    role?: HackathonRole;
  };
}

export interface UserContext {
  id: string;
  email: string;
  name: string;
  image: string | null;
  avatar_url: string | null;
  created_at: string | null;
  platformAdmin: boolean;
  hackathonRoles: Record<string, string[]>;
  workspaceRoles: Record<string, string>;
}

export interface HackathonContext {
  id: string;
  workspace_id: string;
  slug: string;
  status: string;
}

export type HackathonRole = 'organizer' | 'co_organizer' | 'judge' | 'leader' | 'member' | 'anonymous';
