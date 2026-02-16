# GitHub OAuth Flow

> `apps/api/src/routes/auth.ts` — GitHub OAuth 2.0 authorization code flow with KV-backed state.

## Flow

```
1. GET /auth/github?redirect=/dashboard
2. → Generate state = crypto.randomUUID()
3. → Store in KV: oauth:state:{state} → { provider, redirect, timestamp } (TTL: 600s)
4. → Redirect to github.com/login/oauth/authorize

5. GitHub redirects → GET /auth/callback/github?code=XXX&state=YYY
6. → Validate state from KV (delete after read)
7. → Exchange code for access_token via POST github.com/login/oauth/access_token
8. → Fetch user profile: GET api.github.com/user
9. → Fetch emails: GET api.github.com/user/emails (find primary verified)
10. → Upsert user in DB
11. → Create token family + refresh token
12. → Sign JWT
13. → Set cookies (access_token + refresh_token)
14. → Redirect to original redirect URL
```

## Endpoints

### `GET /auth/github`

**Query params:**
- `redirect` (optional) — URL to return to after auth (default: `/`)

**Redirect validation:**
```ts
// Validate redirect is a relative path to prevent open redirect attacks
const redirect = c.req.query('redirect') || '/';
if (redirect.startsWith('//') || /^https?:\/\//i.test(redirect)) {
  return c.json({ ok: false, error: { code: 'INVALID_REDIRECT' } }, 400);
}
```

**Implementation:**
```ts
// Build GitHub authorize URL
const params = new URLSearchParams({
  client_id: env.GITHUB_CLIENT_ID,
  redirect_uri: `${env.API_URL}/auth/callback/github`,
  scope: 'read:user user:email',
  state: state,
});
```

**KV state shape:**
```ts
interface OAuthState {
  provider: 'github' | 'google';
  redirect: string;
  timestamp: number;
}
```

### `GET /auth/callback/github`

**Query params:** `code`, `state`

**Steps:**
1. Read + delete state from KV (`oauth:state:{state}`)
2. If missing/expired → 400 `AUTH_INVALID_STATE`
3. Exchange code → `POST https://github.com/login/oauth/access_token`
4. Fetch profile → `GET https://api.github.com/user`
5. Fetch emails → `GET https://api.github.com/user/emails`
6. Find primary verified email
7. Upsert user:
   - If `github_id` exists → update `github_username`, `avatar_url`, `last_login_at`
   - If email matches existing user → link GitHub identity
   - Otherwise → create new user
8. Create refresh token family + token
9. Sign JWT with payload: `{ sub, ghid, ghu, fam }`
10. Set HttpOnly cookies
11. Redirect to stored `redirect` URL

**User upsert fields:**
```ts
{
  id: crypto.randomUUID(),
  email: primaryEmail,
  name: githubProfile.name || githubProfile.login,
  github_id: githubProfile.id,
  github_username: githubProfile.login,
  avatar_url: githubProfile.avatar_url,
  auth_provider: 'github',
  created_at: new Date().toISOString(),
  last_login_at: new Date().toISOString(),
}
```

### `GET /auth/github/elevate`

**Purpose:** Re-authorize with expanded scopes (adds `repo` for bot features).

**Query params:** `scope` (e.g., `repo`)

Same flow as above but with additional scopes appended. On callback, update the user's stored GitHub access token.

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `AUTH_INVALID_STATE` | 400 | OAuth state missing, expired, or tampered |
| `AUTH_CODE_EXCHANGE_FAILED` | 502 | GitHub rejected the authorization code |
| `AUTH_PROFILE_FETCH_FAILED` | 502 | Could not fetch GitHub profile |
| `AUTH_NO_VERIFIED_EMAIL` | 400 | GitHub account has no verified email |

## DB Tables

- `users` — upsert on login
- `refresh_tokens` — new family + token created on login

## Edge Cases

- **GitHub API unreachable during code exchange.** Return 502 `AUTH_CODE_EXCHANGE_FAILED`, redirect to login page with `?error=github_unavailable`.
- **GitHub account has no verified email.** Return 400 `AUTH_NO_VERIFIED_EMAIL`, show an instructional page guiding the user to verify their email on GitHub.
- **OAuth state expired (user took >10 min).** Return 400 `AUTH_INVALID_STATE`, restart the OAuth flow from scratch.
- **User opens multiple login tabs.** Each tab gets its own KV state entry. All are valid until used or expired. No conflict.
- **GitHub returns a different email than existing user but same `github_id`.** Update the email. GitHub is the source of truth for GitHub-linked accounts.

## Done When

- [ ] GET /auth/github redirects to GitHub with correct params
- [ ] GET /auth/callback/github exchanges code, upserts user, sets cookies, redirects
- [ ] Invalid/expired state returns 400 with AUTH_INVALID_STATE
- [ ] Missing verified email returns 400 with AUTH_NO_VERIFIED_EMAIL
- [ ] GitHub API failures return 502 with appropriate error code
- [ ] New users created with correct fields
- [ ] Existing users updated (last_login_at, avatar_url, github_username)
- [ ] Refresh token family created
- [ ] Audit event logged: auth.login
- [ ] Integration test: full OAuth flow with mocked GitHub responses

## Implementation Notes

- State TTL is 600 seconds (10 minutes) — reject stale OAuth flows
- Always delete state from KV after reading (single-use)
- GitHub access token from code exchange is NOT stored in JWT — it's used server-side only
- For scope elevation, store the GitHub access token encrypted in KV or DB for API calls
