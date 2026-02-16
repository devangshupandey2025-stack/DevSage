# Data Fetching

> API client patterns, TanStack Query usage, and caching strategy.

## API Client

All frontend apps use `apiRequest<T>()`:

```ts
// apps/*/src/lib/api.ts
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? '';

export async function apiRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (res.status === 401) {
    // Auto-refresh and retry (see 04-auth-flow.md)
  }

  if (!res.ok) {
    const error = await res.json();
    throw new ApiError(error.error.code, error.error.message);
  }

  const json = await res.json();
  return json.data;
}
```

## TanStack Query (Platform App)

> **TanStack Query v5**: use `isPending` (no data yet) instead of `isLoading` (which now means isPending AND isFetching). `gcTime` replaces the old `cacheTime`.

### QueryClient Setup

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5 minutes — don't refetch on every mount
      gcTime: 1000 * 60 * 60,     // 1 hour — keep unused data in cache
      retry: 1,                    // 1 retry on failure
      refetchOnWindowFocus: false, // disable for hackathon UX (avoid surprise refetches)
    },
  },
});
```

> `gcTime` replaces the old `cacheTime`. `staleTime: 0` (default) causes a refetch on every component mount — set a reasonable default to reduce API load.

### Query Options Factory

Always define queries via `queryOptions()` factories. This ensures query keys are consistent, enables type-safe prefetching, and prevents key duplication.

```ts
import { queryOptions } from '@tanstack/react-query';

// Centralized query definitions — type-safe, reusable
export const hackathonQueries = {
  all: () => queryOptions({
    queryKey: ['hackathons'],
    queryFn: () => apiRequest<Hackathon[]>('/api/v1/hackathons'),
  }),
  detail: (slug: string) => queryOptions({
    queryKey: ['hackathons', slug],
    queryFn: () => apiRequest<Hackathon>(`/api/v1/hackathons/${slug}`),
  }),
  teams: (slug: string) => queryOptions({
    queryKey: ['hackathons', slug, 'teams'],
    queryFn: () => apiRequest<Team[]>(`/api/v1/hackathons/${slug}/teams`),
  }),
};

// Usage in components
const { data } = useQuery(hackathonQueries.detail('my-hackathon'));

// Usage for prefetching
queryClient.prefetchQuery(hackathonQueries.teams('my-hackathon'));
```

### Basic Usage

The platform app uses TanStack Query for server state management:

```tsx
// Query
const { data: hackathons, isPending } = useQuery({
  queryKey: ['hackathons'],
  queryFn: () => apiRequest<Hackathon[]>('/api/v1/hackathons'),
});

if (isPending) return <Skeleton />;

// Mutation with cache invalidation
const createTeam = useMutation({
  mutationFn: (data: CreateTeamInput) =>
    apiRequest<Team>(`/api/v1/hackathons/${slug}/teams`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['teams', slug] });
  },
});
```

## Query Key Convention

```ts
['hackathons']                          // List all
['hackathons', slug]                    // Single hackathon
['hackathons', slug, 'teams']           // Teams in hackathon
['hackathons', slug, 'teams', teamId]   // Single team
['hackathons', slug, 'submissions']     // Submissions
['hackathons', slug, 'leaderboard']     // Leaderboard
['auth', 'me']                          // Current user
['notifications']                       // User notifications
```

## Pagination

API returns paginated responses. Frontend handles with offset params:

```tsx
const { data } = useQuery({
  queryKey: ['hackathons', slug, 'teams', { limit, offset }],
  queryFn: () => apiRequest<PaginatedResponse<Team>>(
    `/api/v1/hackathons/${slug}/teams?limit=${limit}&offset=${offset}`
  ),
});

// data.meta = { total, limit, offset, has_more }
```

## Implementation Notes

- `VITE_API_ORIGIN` is empty string in dev (Vite proxy handles it)
- In production, set to `https://api.devsage.org`
- Web and admin apps can use simple `useEffect` + `useState` instead of TanStack Query
- TanStack Query `staleTime` and `gcTime` defaults are configured in QueryClient (see above)
- `credentials: 'include'` is critical — without it, cookies aren't sent cross-origin
