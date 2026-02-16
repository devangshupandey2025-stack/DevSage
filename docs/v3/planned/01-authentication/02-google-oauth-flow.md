# Google OAuth Flow

> `apps/api/src/routes/auth.ts` — Google OAuth 2.0 authorization code flow for organizer/admin accounts.

## Flow

```
1. GET /auth/google?redirect=/dashboard
2. → Generate state = crypto.randomUUID()
3. → Store in KV: oauth:state:{state} → { provider: 'google', redirect, timestamp } (TTL: 600s)
4. → Redirect to accounts.google.com/o/oauth2/v2/auth

5. Google redirects → GET /auth/callback/google?code=XXX&state=YYY
6. → Validate state from KV (delete after read)
7. → Exchange code for tokens via POST oauth2.googleapis.com/token
8. → Fetch profile: GET www.googleapis.com/oauth2/v2/userinfo
9. → Upsert user in DB
10. → Create token family + refresh token
11. → Sign JWT
12. → Set cookies
13. → Redirect to original redirect URL
```

## Endpoints

### `GET /auth/google`

**Query params:**
- `redirect` (optional) — URL to return to after auth (default: `/`)

**Implementation:**
```ts
const params = new URLSearchParams({
  client_id: env.GOOGLE_CLIENT_ID,
  redirect_uri: `${env.PLATFORM_URL}/auth/callback/google`,
  response_type: 'code',
  scope: 'openid email profile',
  state: state,
  access_type: 'offline',
  prompt: 'consent',
});
// Redirect to https://accounts.google.com/o/oauth2/v2/auth?${params}
```

### `GET /auth/callback/google`

**Query params:** `code`, `state`

**Steps:**
1. Read + delete state from KV
2. Exchange code → `POST https://oauth2.googleapis.com/token`
   - Body: `{ code, client_id, client_secret, redirect_uri, grant_type: 'authorization_code' }`
3. Fetch profile → `GET https://www.googleapis.com/oauth2/v2/userinfo`
   - Headers: `Authorization: Bearer ${access_token}`
4. Upsert user:
   - If `google_id` exists → update `name`, `avatar_url`, `last_login_at`
   - If email matches existing user → link Google identity
   - Otherwise → create new user
5. Create refresh token + sign JWT
6. Set cookies, redirect

**Google profile fields:**
```ts
{
  id: googleProfile.id,          // → google_id
  email: googleProfile.email,    // → email (always verified from Google)
  name: googleProfile.name,      // → name
  picture: googleProfile.picture // → avatar_url
}
```

**User upsert:**
```ts
{
  id: crypto.randomUUID(),
  email: googleProfile.email,
  name: googleProfile.name,
  google_id: googleProfile.id,
  avatar_url: googleProfile.picture,
  auth_provider: 'google',
  created_at: new Date().toISOString(),
  last_login_at: new Date().toISOString(),
}
```

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `AUTH_INVALID_STATE` | 400 | OAuth state missing, expired, or tampered |
| `AUTH_CODE_EXCHANGE_FAILED` | 502 | Google rejected the authorization code |
| `AUTH_PROFILE_FETCH_FAILED` | 502 | Could not fetch Google profile |

## DB Tables

- `users` — upsert on login (google_id field)
- `refresh_tokens` — new family + token

## Implementation Notes

- Google emails are always verified — no need for separate email verification
- `access_type: 'offline'` + `prompt: 'consent'` ensures we get a refresh token from Google (for future API access if needed)
- Google's refresh token is NOT the same as our app's refresh token — store Google's separately if needed
- Redirect URI must match exactly what's configured in Google Cloud Console
