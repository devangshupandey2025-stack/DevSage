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

The platform app uses TanStack Query for server state management:

```tsx
// Query
const { data: hackathons, isLoading } = useQuery({
  queryKey: ['hackathons'],
  queryFn: () => apiRequest<Hackathon[]>('/api/v1/hackathons'),
});

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
- TanStack Query `staleTime` defaults: 0 (always refetch on mount)
- `credentials: 'include'` is critical — without it, cookies aren't sent cross-origin
