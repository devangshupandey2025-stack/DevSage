# Frontend Auth Flow

> OAuth login, callback handling, and token refresh in all frontend apps.

## Login Flow

```
1. User clicks "Login with GitHub"
2. Frontend redirects to: /auth/github (API endpoint)
3. API generates state, stores in KV (10min TTL), redirects to GitHub
4. GitHub redirects to: /auth/callback/github?code=...&state=...
5. API verifies state, exchanges code for tokens, sets cookies
6. API redirects to frontend URL (FRONTEND_URL, PLATFORM_URL, or ADMIN_URL)
7. Frontend calls GET /auth/me → gets user object
8. AuthProvider stores user in state
```

## Cookie-Based Auth

The API sets two HttpOnly cookies on successful login:

```
Set-Cookie: access_token=eyJhbG...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=900
Set-Cookie: refresh_token=a1b2c3...; HttpOnly; Secure; SameSite=Lax; Path=/auth/refresh; Max-Age=2592000
```

Frontend never touches tokens directly — they're HttpOnly.

## AuthProvider

```tsx
// apps/*/src/contexts/auth-context.tsx
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // On mount, check if user is logged in
    apiRequest<User>('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const logout = async () => {
    await apiRequest('/auth/logout', { method: 'POST' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

## Silent Token Refresh

`apiRequest()` automatically handles expired access tokens:

```ts
async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    credentials: 'include',
  });

  if (res.status === 401) {
    // Try refreshing
    const refreshRes = await fetch(`${API_ORIGIN}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (refreshRes.ok) {
      // Retry original request with new access_token cookie
      res = await fetch(`${API_ORIGIN}${path}`, { ...init, credentials: 'include' });
    }
  }

  if (!res.ok) throw new ApiError(res);
  const json = await res.json();
  return json.data;
}
```

## Implementation Notes

- `credentials: 'include'` on every fetch — sends cookies cross-origin
- CORS on API must allow the specific frontend origin (not `*`)
- Refresh token cookie `Path=/auth/refresh` — only sent on refresh requests
- Access token cookie `Path=/` — sent on all requests
- Each app has its own AuthProvider but they share the same pattern
- Post-login redirect: API reads `redirect_uri` from OAuth state stored in KV
