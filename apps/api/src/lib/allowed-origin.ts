export function getAllowedOrigins(env: { FRONTEND_URL: string; PLATFORM_URL: string; ADMIN_URL: string }): string[] {
  return [env.FRONTEND_URL, env.PLATFORM_URL, env.ADMIN_URL];
}

export function isAllowedOrigin(origin: string, env: { FRONTEND_URL: string; PLATFORM_URL: string; ADMIN_URL: string }): boolean {
  return getAllowedOrigins(env).includes(origin);
}
