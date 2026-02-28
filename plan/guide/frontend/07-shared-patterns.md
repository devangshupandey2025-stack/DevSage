# Shared Patterns & Design System

Cross-app improvements for consistency, code reuse, and developer experience.

## Current Situation

- Each app independently copies shadcn/ui primitives into `components/ui/`
- No shared component package between apps
- Inconsistent data fetching: React Query in platform/judge, raw fetch in admin, none in web
- Auth context is copy-pasted (identical in app, platform, admin, judge)

## Recommendations

### 1. Shared UI Package (Optional)

**Option A — Continue copying (recommended for now)**:
shadcn/ui is designed to be copied into projects. The components are small and may need per-app customization. Extracting to a shared package adds build complexity.

**Option B — Extract if components diverge**:
If apps start customizing the same components differently, extract to `packages/ui/`:
```
packages/ui/
  src/
    button.tsx
    card.tsx
    dialog.tsx
    ...
  package.json  → @devsage/ui
```

### 2. Shared Auth Context

The auth context is identical across app, platform, admin, and judge. Extract to shared:

```
packages/shared/src/react/
  auth-context.tsx    — AuthProvider + useAuth hook
  protected-route.tsx — Generic route guard
  api-client.tsx      — apiRequest with 401 refresh
```

This would be a new export from `@devsage/shared`:
```typescript
// packages/shared/src/index.ts
export { AuthProvider, useAuth } from './react/auth-context.js';
export { ProtectedRoute } from './react/protected-route.js';
export { createApiClient } from './react/api-client.js';
```

**Trade-off**: Adds React as a dependency to `@devsage/shared`. Alternative: create `@devsage/react` package.

### 3. Standardize Data Fetching

**Current state**:
- `app` (new): Not built yet — should use React Query from the start
- `platform` + `judge`: React Query v5 with `lib/queries.ts`
- `admin`: Direct `apiRequest()` + `useState/useEffect`
- `web`: No API calls (static marketing site)
- `status`: Own self-contained backend/frontend

**Recommendation**:
- Build `app` with React Query v5 from day one
- Migrate `admin` to React Query (see `03-admin.md`)
- `web` needs no data fetching at all
- Standardize query key patterns across app, platform, judge, admin

**Query key convention** (already used in platform):
```typescript
const queryKeys = {
  hackathons: {
    all: ['hackathons'] as const,
    detail: (slug: string) => ['hackathons', slug] as const,
    teams: (slug: string) => ['hackathons', slug, 'teams'] as const,
    submissions: (slug: string) => ['hackathons', slug, 'submissions'] as const,
    judging: (slug: string) => ['hackathons', slug, 'judging'] as const,
  },
  workspaces: {
    all: ['workspaces'] as const,
    detail: (id: string) => ['workspaces', id] as const,
  },
};
```

### 4. Error Handling Pattern

Add consistent error handling across all apps:

```typescript
// Shared error boundary for route-level errors
function RouteErrorBoundary() {
  const error = useRouteError();

  if (error instanceof ApiError) {
    if (error.status === 403) return <ForbiddenPage />;
    if (error.status === 404) return <NotFoundPage />;
  }

  return <GenericErrorPage error={error} />;
}
```

Add to React Router configuration:
```typescript
{
  path: '/hackathons/:slug',
  element: <HackathonDetail />,
  errorElement: <RouteErrorBoundary />,
}
```

### 5. Loading States

Standardize loading patterns:

```typescript
// Shared loading component
function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />  {/* Title */}
      <Skeleton className="h-4 w-96" />  {/* Description */}
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
```

### 6. Date & Time Formatting

Consistent timezone-aware formatting (hackathons have configurable timezones):

```typescript
// Shared date utilities
function formatHackathonDate(isoString: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoString));
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  // ... convert to appropriate unit
}
```

### 7. Form Patterns

Standardize form validation using Zod schemas from `@devsage/shared`:

```typescript
import { createHackathonSchema } from '@devsage/shared';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

function CreateHackathonForm() {
  const form = useForm({
    resolver: zodResolver(createHackathonSchema),
  });
  // ...
}
```

This ensures frontend validation matches backend validation exactly.

## Implementation Priority

1. **Error handling** — prevents blank screens on API errors (app, platform, admin, judge)
2. **Loading states** — better UX during data fetching (app, platform, admin, judge)
3. **Date formatting** — timezone handling for hackathon deadlines (app, platform, judge)
4. **Form validation** — Zod schema reuse (app, platform)
5. **Auth context extraction** — extract when building `app` (reuse from platform)
6. **React Query migration** — admin app (defer to Phase 3)
