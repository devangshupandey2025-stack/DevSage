# Auth Middleware

> `apps/api/src/middleware/auth.ts` — JWT extraction and verification from HttpOnly cookies.

## Two Variants

### `optionalAuth` (applied globally)

Extracts JWT if present, sets user context. Does NOT reject unauthenticated requests.

```ts
const optionalAuth: MiddlewareHandler<AuthAppEnv> = async (c, next) => {
  const token = getAccessTokenCookie(c); // reads 'access_token' cookie

  if (token) {
    const payload = await verifyJWT(token, c.env.JWT_SECRET);

    if (payload && payload.exp > Math.floor(Date.now() / 1000)) {
      c.set('user', {
        sub: payload.sub,
        ghid: payload.ghid,
        ghu: payload.ghu,
        fam: payload.fam,
      });
    }
    // Invalid/expired token → silently continue as anonymous
  }

  await next();
};
```

### `authMiddleware` (applied per-route)

Requires valid JWT. Rejects with 401 if missing or invalid.

```ts
const authMiddleware: MiddlewareHandler<AuthAppEnv> = async (c, next) => {
  const user = c.get('user'); // set by optionalAuth

  if (!user) {
    return errorResponse(c, 401, 'AUTH_REQUIRED', 'Authentication required');
  }

  await next();
};
```

## Middleware Chain Position

```
CORS → Request ID → optionalAuth → Rate Limiter → [Route Handler]
                                                        ↓
                                                   authMiddleware (if route requires auth)
                                                        ↓
                                                   requireRole(minRole) (if route requires role)
```

- `optionalAuth` runs on EVERY request (set globally in `index.ts`)
- `authMiddleware` is applied per-route or per-route-group
- `requireRole()` always comes after `authMiddleware`

## User Context Shape

After `optionalAuth` succeeds, `c.get('user')` returns:

```ts
interface UserContext {
  sub: string;   // user UUID
  ghid: number;  // GitHub user ID
  ghu: string;   // GitHub username
  fam: string;   // token family ID
}
```

If no valid token: `c.get('user')` returns `undefined`.

## Route Usage Examples

```ts
// Public route (no auth needed)
app.get('/hackathons/:slug', async (c) => { ... });

// Authenticated route
app.get('/auth/me', authMiddleware, async (c) => {
  const user = c.get('user')!; // guaranteed non-null after authMiddleware
});

// Role-gated route
app.post('/hackathons/:slug/teams', authMiddleware, requireRole('team_member'), async (c) => { ... });
```

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `AUTH_REQUIRED` | 401 | No valid access token in cookie |
| `AUTH_TOKEN_EXPIRED` | 401 | JWT has expired (client should refresh) |
| `AUTH_TOKEN_INVALID` | 401 | JWT signature verification failed |
