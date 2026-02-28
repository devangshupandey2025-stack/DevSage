# Frontend Testing Strategy

Priority: HIGH — zero test files across all frontend apps.

## Current State

- Vitest configured in all apps (`vitest.config.ts` + `jsdom`)
- Testing libraries installed: `@testing-library/react`, `@testing-library/jest-dom`
- Zero test files written
- `packages/shared` has `__tests__/schemas.test.ts` (Zod schema validation)

## Testing Approach

Focus on **integration tests** that test user-visible behavior, not implementation details. Match the backend's integration-first philosophy.

### Tier 1 — Critical Path Tests (start here)

Test the flows that, if broken, would make the app unusable.

**Platform app** (highest page count, most complex):
```
src/__tests__/
  auth.test.tsx         — Login, logout, 401 refresh, protected routes
  hackathon-crud.test.tsx — Create, edit, transition hackathon
  team-management.test.tsx — View teams, eliminate, disqualify
  scoring.test.tsx      — Submit scores, view leaderboard
```

**Judge app**:
```
src/__tests__/
  auth.test.tsx         — Login, invite acceptance
  scoring.test.tsx      — Score submission, time window enforcement
  assignments.test.tsx  — View assignments, multi-round navigation
```

**Admin app**:
```
src/__tests__/
  auth.test.tsx         — Login, admin role check
  requests.test.tsx     — Approve/reject hackathon requests
```

**Participant app** (new, high priority — core user flow):
```
src/__tests__/
  auth.test.tsx              — Login, register, invite acceptance
  hackathon-browse.test.tsx  — Browse, filter, view detail
  registration.test.tsx      — Register for hackathon, create/join team
  team.test.tsx              — Team dashboard, members, invite link
  submissions.test.tsx       — Submit, view history, repo status
```

**Web app** (lowest priority — static marketing, no API):
```
src/__tests__/
  pages.test.tsx             — Static pages render correctly
  navigation.test.tsx        — Links point to correct app domains
```

### Tier 2 — Component Tests

Test reusable components in isolation:

```
src/components/__tests__/
  StatusBadge.test.tsx
  CountdownTimer.test.tsx
  MetricCard.test.tsx
  PageHeader.test.tsx
```

### Tier 3 — Utility Tests

```
src/lib/__tests__/
  api.test.ts           — apiRequest error handling, 401 refresh
  queries.test.ts       — Query key generation
  utils.test.ts         — formatDate, cn, etc.
```

## Test Setup

### MSW for API Mocking

Use [MSW (Mock Service Worker)](https://mswjs.io/) to mock API responses:

```typescript
// src/__tests__/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('*/auth/me', () => {
    return HttpResponse.json({
      ok: true,
      data: {
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
        isPlatformAdmin: false,
        hackathonRoles: {},
        workspaceRoles: {},
      },
    });
  }),

  http.get('*/api/v1/hackathons', () => {
    return HttpResponse.json({
      ok: true,
      data: [{ id: '1', slug: 'test-hack', title: 'Test Hackathon', status: 'active' }],
      meta: { total: 1, limit: 20, offset: 0, has_more: false },
    });
  }),
];
```

### Test Utilities

```typescript
// src/__tests__/utils.tsx
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/auth-context';

export function renderWithProviders(ui: React.ReactElement, { route = '/' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
```

## Example Test

```typescript
// src/__tests__/auth.test.tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './utils';
import { LoginPage } from '../pages/login';

describe('Login', () => {
  it('shows error on invalid credentials', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'wrong@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('redirects to dashboard on successful login', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
    });
  });
});
```

## CI Integration

Add to GitHub Actions workflow:
```yaml
- name: Frontend Tests
  run: |
    pnpm --filter @devsage/app test
    pnpm --filter @devsage/platform test
    pnpm --filter @devsage/judge test
    pnpm --filter @devsage/admin test
    pnpm --filter @devsage/web test
```

## Target Coverage

Start pragmatic — not aiming for 100%:

| App | Target | Focus |
|-----|--------|-------|
| app | 65% | Auth, hackathon browse, registration, team, submissions |
| platform | 60% | Auth flows, hackathon CRUD, judging |
| judge | 70% | Scoring flow (smaller app, higher coverage easier) |
| admin | 50% | Request approval, user management |
| web | 30% | Static page rendering (no API to test) |
| status | 50% | Health check display, incident timeline |

## Dependencies to Add

```bash
pnpm --filter @devsage/app add -D msw @testing-library/user-event
pnpm --filter @devsage/platform add -D msw @testing-library/user-event
pnpm --filter @devsage/judge add -D msw @testing-library/user-event
pnpm --filter @devsage/admin add -D msw @testing-library/user-event
pnpm --filter @devsage/web add -D msw @testing-library/user-event
```
