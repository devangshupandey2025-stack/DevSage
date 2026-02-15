const DEV_ORIGINS = new Set([
  'http://localhost:5173', // Vite dev (web)
  'http://localhost:5174', // Vite dev (admin)
  'http://localhost:5175', // Vite dev (platform)
]);

export function isAllowedOrigin(
  origin: string,
  envUrls?: { frontendUrl?: string; platformUrl?: string; adminUrl?: string },
): boolean {
  if (DEV_ORIGINS.has(origin)) return true;

  if (!envUrls) return false;

  const allowed = [envUrls.frontendUrl, envUrls.platformUrl, envUrls.adminUrl].filter(Boolean);
  return allowed.includes(origin);
}
