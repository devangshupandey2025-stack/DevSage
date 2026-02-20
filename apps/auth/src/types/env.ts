export interface AuthEnv {
  Bindings: {
    DB: D1Database;
    BETTER_AUTH_SECRET: string;
    JWT_SECRET: string;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    SMTP_URL: string;
    SMTP_USERNAME: string;
    SMTP_PASSWORD: string;
    AUTH_URL: string;
    FRONTEND_URL: string;
    PLATFORM_URL: string;
    ADMIN_URL: string;
    API_URL: string;
    EMAIL_FROM: string;
  };
}
