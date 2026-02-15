const TRUSTED_DOMAIN = '.devsage.org';

const DEV_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
]);

export function isAllowedOrigin(origin: string): boolean {
  if (DEV_ORIGINS.has(origin)) return true;

  try {
    const url = new URL(origin);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'devsage.org' || url.hostname.endsWith(TRUSTED_DOMAIN))
    );
  } catch {
    return false;
  }
}
