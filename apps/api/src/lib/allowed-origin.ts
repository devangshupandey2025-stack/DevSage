interface OriginEnv {
  FRONTEND_URL: string;
  PLATFORM_URL: string;
  ADMIN_URL: string;
  JUDGE_URL: string;
  HACKATHON_ORIGIN_PATTERN?: string; // e.g. "https://*.hackathon.devsage.org"
  PAGES_ORIGIN_PATTERN?: string;     // e.g. "https://*.pages.dev"
  WORKERS_ORIGIN_PATTERN?: string;   // e.g. "https://*.workers.dev"
}

/**
 * Returns a function-based origin matcher that checks:
 *  1. Static origins (FRONTEND_URL, PLATFORM_URL, ADMIN_URL)
 *  2. Hackathon wildcard pattern  (*.hackathon.devsage.org)
 *  3. Cloudflare Pages dev pattern (*.pages.dev)
 */
export function getAllowedOrigins(env: OriginEnv): (origin: string) => boolean {
  const staticOrigins = [env.FRONTEND_URL, env.PLATFORM_URL, env.ADMIN_URL, env.JUDGE_URL];

  // Build an array of RegExp matchers from wildcard patterns
  const patterns: RegExp[] = [];

  for (const raw of [env.HACKATHON_ORIGIN_PATTERN, env.PAGES_ORIGIN_PATTERN, env.WORKERS_ORIGIN_PATTERN]) {
    if (!raw) continue;
    // Convert glob pattern to regex:
    //   https://*.example.com → https://[a-z0-9.-]+\.example\.com
    // 1. Replace the glob * with a placeholder before escaping
    const placeholder = '__WILDCARD__';
    const withPlaceholder = raw.replace('*', placeholder);
    // 2. Escape all regex special chars
    const escaped = withPlaceholder.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    // 3. Replace placeholder with a regex character class
    const regexStr = escaped.replace(placeholder, '[a-z0-9.-]+');
    patterns.push(new RegExp(`^${regexStr}$`, 'i'));
  }

  return (origin: string) => {
    if (staticOrigins.includes(origin)) return true;
    return patterns.some((re) => re.test(origin));
  };
}

export function isAllowedOrigin(origin: string, env: OriginEnv): boolean {
  return getAllowedOrigins(env)(origin);
}
