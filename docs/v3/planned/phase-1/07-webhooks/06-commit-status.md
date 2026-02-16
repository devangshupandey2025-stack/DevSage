# Commit Status

> `apps/api/src/services/github.ts` — Posting check statuses back to GitHub repos.

## When Statuses Are Posted

| Event | Status | Context |
|-------|--------|---------|
| Submission accepted | `success` — "Submission captured" | `devsage/submission` |
| Submission rejected | `failure` — "Rejected: {reason}" | `devsage/submission` |
| Validation passed | `success` — "All checks passed" | `devsage/validation` |
| Validation failed | `failure` — "Checks failed: {details}" | `devsage/validation` |
| Results published | `success` — "Rank #{rank}" | `devsage/results` |
| Deadline passed | `failure` — "Deadline passed" | `devsage/submission` |

## Implementation

```ts
async function postCommitStatus(
  env: Env,
  installationId: number,
  owner: string,
  repo: string,
  sha: string,
  status: { state: 'success' | 'failure' | 'pending'; description: string; context: string }
) {
  // 1. Get installation access token
  const token = await getInstallationToken(env, installationId);

  // 2. Post status
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/statuses/${sha}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'DevSage-Bot',
      },
      body: JSON.stringify({
        state: status.state,
        description: status.description.substring(0, 140), // GitHub limit
        context: status.context,
        target_url: `${env.PLATFORM_URL}/hackathons/${hackathonSlug}/submissions`,
      }),
      signal: AbortSignal.timeout(10000), // 10s timeout (fail-open)
    }
  );

  if (!response.ok) {
    console.warn(`Failed to post commit status: ${response.status}`);
    // Fail-open: don't throw, don't retry
  }
}
```

## Getting Installation Tokens

```ts
async function getInstallationToken(env: Env, installationId: number): Promise<string> {
  // Check KV cache first
  const cached = await env.KV.get(`github:token:${installationId}`);
  if (cached) return cached;

  // Generate JWT for GitHub App
  const appJwt = await signGitHubAppJWT(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY);

  // Request installation token
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  const { token, expires_at } = await response.json();

  // Cache with TTL (expires in ~1 hour, cache for 50 minutes)
  await env.KV.put(`github:token:${installationId}`, token, { expirationTtl: 3000 });

  return token;
}
```

## Implementation Notes

- All GitHub API calls use the **fail-open** pattern: 10s timeout, catch errors, log warning, never throw
- Installation tokens expire after 1 hour — cache in KV for 50 minutes
- GitHub App JWT is short-lived (10 minutes) — generated on demand
- `target_url` links back to the DevSage submission page
- Description limited to 140 characters (GitHub API constraint)
