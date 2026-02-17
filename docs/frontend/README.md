# Frontend Documentation

DevSage has three frontend applications, each serving a different audience:

| App | URL | Audience | Package |
|-----|-----|----------|---------|
| [Web](web.md) | `devsage.org` | Participants, public visitors | `@devsage/web` |
| [Platform](platform.md) | `platform.devsage.org` | Organizers, judges | `@devsage/platform` |
| [Admin](admin.md) | `shikdd.devsage.org` | Platform administrators | `@devsage/admin` |

## Shared Stack

All three apps share the same technology stack:

- **React 18** with TypeScript (strict mode)
- **Vite** for build tooling
- **Tailwind CSS v4** for styling
- **shadcn/ui** (Radix primitives) for UI components
- **React Router v6** for routing
- **Sonner** for toast notifications
- **Lucide** for icons
- **Dark theme** with `#CCFF00` lime accent

## Shared Patterns

### API Integration

All apps use a shared `apiRequest<T>()` wrapper in `lib/api.ts`:
- Prefixes requests with `VITE_API_ORIGIN` (or relative in production)
- Sends `credentials: 'include'` for HttpOnly cookie auth
- Auto-refreshes JWT on 401 via `POST /auth/refresh`
- Returns typed JSON responses

### Authentication Context

Each app has `contexts/auth-context.tsx` providing:
- `user` — current user object
- `isAuthenticated` — boolean
- `isLoading` — initial auth check in progress
- `logout()` — sign out and clear state

Fetches `GET /auth/me` on mount to hydrate user state.

### Protected Routes

`components/protected-route.tsx` wraps authenticated routes:
- Redirects to `/login` if not authenticated
- Shows loading skeleton during auth check
- Admin app additionally checks `isPlatformAdmin`

### Response Envelope

All API responses follow: `{ ok: true, data: T, meta?: M }` / `{ ok: false, error: { code, message } }`

## Development

```bash
# Run all apps in dev mode
pnpm dev

# Run a single app
pnpm --filter @devsage/web dev
pnpm --filter @devsage/platform dev
pnpm --filter @devsage/admin dev

# Build all
pnpm build

# Deploy
pnpm deploy:web
pnpm deploy:platform
pnpm deploy:admin
pnpm deploy:api
```

Vite dev proxy forwards `/api/v1`, `/auth`, `/hackathons`, `/webhooks` to `http://localhost:8787`.
