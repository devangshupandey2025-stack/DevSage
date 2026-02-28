# GitHub Integration

Priority: HIGH — blocks the entire submission pipeline (webhooks, repos, submissions).

**Note**: SEC-001 from `01-security-hardening.md` is consolidated here. This is the single source of truth for the getInstallationToken fix.

## Current State

- **Webhook receiver** (`routes/webhooks.ts`): Working. HMAC SHA-256 verification, event normalization, queuing.
- **Queue handlers**: Working. Push, tag-create, tag-delete, installation handlers all implemented.
- **GitHub service** (`services/github.ts`): **PARTIALLY WORKING**. RS256 JWT signing for the GitHub App is already implemented (lines 20-55). The `getInstallationToken()` exchange is the stub.
- **Team repos** (`routes/team-repos.ts`): Working for CRUD, but repo operations (fetching commits, checking tags) fail without real tokens.

## Implementation Plan

### 1. Fix getInstallationToken() — CRITICAL

**File**: `src/services/github.ts`

The RS256 `signGitHubAppJWT()` function already exists. Only the token exchange is missing:

```
Flow:
1. Call existing signGitHubAppJWT() to generate GitHub App JWT
2. POST /app/installations/{id}/access_tokens (exchange for installation token)
3. Cache token in module-level Map (in-memory, per-isolate)
4. On cache hit + not expired: return cached token
5. On cache miss or expired: regenerate
```

**Required changes**:
1. Add bindings to `apps/api/wrangler.jsonc` (NOT repo root):
   - `GITHUB_APP_ID` — GitHub App ID (env var)
   - `GITHUB_APP_PRIVATE_KEY` — RS256 private key (secret)
2. Update `src/types/env.ts` — add `GITHUB_APP_ID: string` and `GITHUB_APP_PRIVATE_KEY: string` to bindings
3. Implement the exchange in `getInstallationToken()`:

```typescript
// Module-level in-memory cache (auto-clears on isolate recycle)
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getInstallationToken(env: AppEnv['Bindings'], installationId: string): Promise<string> {
  // Check in-memory cache
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  // Generate App JWT (function already exists)
  const appJwt = await signGitHubAppJWT(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY);

  // Exchange for installation token
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 10_000); // 10s fail-open timeout

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'DevSage-App',
      },
    }
  );

  if (!response.ok) {
    console.error(`GitHub token exchange failed: ${response.status}`);
    throw new Error(`GitHub installation token exchange failed: ${response.status}`);
  }

  const { token, expires_at } = await response.json() as { token: string; expires_at: string };

  // Cache in-memory (expire 60s before actual expiry)
  const expiresAt = new Date(expires_at).getTime() - 60_000;
  tokenCache.set(installationId, { token, expiresAt });

  return token;
}
```

**Why in-memory instead of KV**: GitHub installation tokens expire every hour. KV has a 1,000 writes/day limit on the free plan — each token refresh would burn a write. In-memory caching is free, fast, and auto-clears when Workers isolates recycle. The worst case (cold isolate) adds one extra GitHub API call (~200ms), which is acceptable for a non-hot-path operation.
```

### 2. Webhook Pipeline Improvements

**From `role-event-lead.md`**: Webhooks must guarantee exactly-once processing.

Current: `webhook_deliveries` table with `github_delivery_id` UNIQUE constraint provides idempotency.

Missing:
- **Dead-letter queue**: Failed webhook events should be retried 3x then moved to dead-letter for manual replay
- **Replay endpoint**: `POST /api/v1/admin/webhooks/:deliveryId/replay` — admin-only, re-enqueue a failed webhook

**Schema change**: Add `retry_count INTEGER NOT NULL DEFAULT 0` column to `webhook_deliveries`

Implementation:
1. On queue handler failure: increment `retry_count`, re-enqueue if < 3
2. On 3rd failure: set `status = 'dead_letter'`
3. Add admin replay endpoint

### 3. Submission via Git Tag (role-participant.md)

**Flow** (already partially implemented):
```
1. Participant pushes git tag matching pattern (e.g., submission_v1)
2. GitHub sends tag webhook → queue
3. tag-create-handler creates submission record
4. DO locks submission (optimistic versioning)
5. Submission validated (tag format, repo access, deadline check)
```

**Missing pieces**:
- Per-round tag patterns (GAP-008): `submission_tag_pattern` is global, needs to be per-round
- Resubmission: when `allow_resubmission=true` and same tag pushed, update existing submission
- Tag deletion: `tag-delete-handler` unlocks but doesn't invalidate scores

### 4. Repo Bot Activation

**From `role-event-lead.md`**: When a team links a repo, the GitHub App bot should be activated.

Current: `team-repos.ts` queues a `bot_activation` event, but the queue handler is a no-op.

Implementation:
1. On bot activation: verify GitHub App is installed on repo (via `GET /repos/{owner}/{repo}/installation`)
2. If not installed: create a `pending_installations` record, return setup URL
3. If installed: set `bot_active = true`, start receiving webhooks

### 5. Repo Content Proxy for Judges

**From `role-judge.md`**: Judges see a code browser with files at the pinned submission SHA.

**Endpoint**: `GET /api/v1/hackathons/:slug/submissions/:submissionId/files`
- Query params: `path` (file path), `type` (tree or blob)
- Uses installation token to fetch from GitHub API
- Returns file tree or file content

**Scalability concern**: Large repos could exceed 30s CPU limit. Mitigations:
1. Limit file size: reject files > 1MB
2. For initial release: **link to GitHub directly** instead of proxying (simpler, no CPU risk, no storage cost)
3. Future: if proxying is needed, cache file trees in D1 keyed by SHA (immutable content = cache forever)

### 6. Repo Health Check

**From `role-event-lead.md`**: Dashboard shows GitHub App installation status and repo visibility.

**Endpoint**: `GET /api/v1/hackathons/:slug/teams/:teamId/repo-status`
- Returns: `{ installed: boolean, botActive: boolean, visibility: 'public' | 'private', lastPushAt: string }`
- Checks GitHub App installation via API
- No caching needed — this is a low-frequency organizer action, not a hot path

## Tests to Add

- [ ] `getInstallationToken()` exchanges JWT for installation token
- [ ] In-memory token cache returns same token on repeated calls
- [ ] Token re-fetched after in-memory cache expires
- [ ] Webhook idempotency (duplicate delivery ID rejected)
- [ ] Dead-letter after 3 retries
- [ ] Tag-based submission creation
- [ ] Resubmission when allowed
- [ ] Repo content proxy returns file tree
- [ ] Repo health check returns correct status
