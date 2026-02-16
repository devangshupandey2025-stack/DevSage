# Frontend Architecture

> Three React SPAs (Vite + Tailwind v4 + shadcn/ui), each deployed to Cloudflare Pages.

## Apps

| App | Domain | Purpose | Users |
|-----|--------|---------|-------|
| `apps/web` | `devsage.org` | Main website, public info | Everyone |
| `apps/platform` | `platform.devsage.org` | Organizer/judge dashboard | Organizers, judges |
| `apps/admin` | `shikdd.devsage.org` | Platform admin panel | Platform admins |

## Shared Stack

All three apps use:
- **React 19** with TypeScript strict
- **Vite** for bundling
- **Tailwind CSS v4** for styling
- **React Router** for client-side routing
- **`@devsage/shared`** for Zod schemas and types (only shared package dependency)

Platform app additionally uses:
- **shadcn/ui** component library
- **TanStack Query** for data fetching (platform has the most complex data needs)

## Dependency Rule

Frontend apps may only import from `@devsage/shared`:
```ts
import { createHackathonSchema, type User } from '@devsage/shared';
```

Never import from `@devsage/db` or `@devsage/api` — those are backend-only.

## Auth Context

All apps share the same auth pattern via `AuthProvider`:
```ts
// apps/*/src/contexts/auth-context.tsx
const { user, isAuthenticated, isLoading, logout } = useAuth();
```

See [04-auth-flow.md](04-auth-flow.md) for details.

## Files

| File | Description |
|------|-------------|
| [01-platform-app.md](01-platform-app.md) | Organizer/judge dashboard |
| [02-admin-app.md](02-admin-app.md) | Platform admin panel |
| [03-web-app.md](03-web-app.md) | Main website |
| [04-auth-flow.md](04-auth-flow.md) | Frontend auth: login, callback, refresh |
| [05-data-fetching.md](05-data-fetching.md) | API client, caching patterns |
| [06-component-library.md](06-component-library.md) | shadcn/ui, Tailwind v4 |
| [07-build-deploy.md](07-build-deploy.md) | Vite config, Cloudflare Pages |
