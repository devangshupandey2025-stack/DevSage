import { KV_TTL } from '../lib/constants.js';

const GITHUB_API = 'https://api.github.com';
const TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Get installation access token (cached in KV for 50 min).
 * Fail-open: returns null on failure.
 */
export async function getInstallationToken(
  installationId: number,
  kv: KVNamespace
): Promise<string | null> {
  const cacheKey = `gh:install:${installationId}`;
  const cached = await kv.get(cacheKey);
  if (cached) return cached;

  // TODO: Implement JWT signing for GitHub App authentication
  // This requires the GitHub App private key which would be a secret binding
  // For Phase 1, installation tokens are obtained during the OAuth/installation flow
  console.warn(`Installation token not cached for ${installationId}`);
  return null;
}

/**
 * Post commit status to GitHub. Fail-open: log warning on failure.
 */
export async function postCommitStatus(
  owner: string,
  repo: string,
  sha: string,
  state: 'pending' | 'success' | 'failure' | 'error',
  description: string,
  context: string,
  token: string,
  targetUrl?: string
): Promise<void> {
  try {
    const body: Record<string, string> = { state, description, context };
    if (targetUrl) body.target_url = targetUrl;

    const res = await fetchWithTimeout(`${GITHUB_API}/repos/${owner}/${repo}/statuses/${sha}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DevSage',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn(`Failed to post commit status: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.warn(`Commit status post failed (fail-open): ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Get tag SHA from GitHub API. Fail-open: returns null.
 */
export async function getTagSha(
  owner: string,
  repo: string,
  tagName: string,
  token: string
): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      `${GITHUB_API}/repos/${owner}/${repo}/git/refs/tags/${tagName}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'DevSage',
          Accept: 'application/vnd.github+json',
        },
      }
    );

    if (!res.ok) return null;

    const data = await res.json() as { object: { sha: string; type: string; url: string } };

    // If it's an annotated tag, follow the reference to get the commit SHA
    if (data.object.type === 'tag') {
      const tagRes = await fetchWithTimeout(data.object.url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'DevSage',
          Accept: 'application/vnd.github+json',
        },
      });
      if (!tagRes.ok) return data.object.sha;
      const tagData = await tagRes.json() as { object: { sha: string } };
      return tagData.object.sha;
    }

    return data.object.sha;
  } catch (err) {
    console.warn(`Get tag SHA failed (fail-open): ${err instanceof Error ? err.message : err}`);
    return null;
  }
}
