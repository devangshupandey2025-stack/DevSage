# Web App

> `apps/web/` — `devsage.org` — Main public website.

## Purpose

Public-facing marketing and info site. Participants interact with hackathon-specific sites (`{slug}.devsage.org`) from separate repos — this app is the landing page and auth entry point.

## Key Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Landing page, featured hackathons |
| `/auth/login` | Login | GitHub/Google OAuth start |
| `/auth/callback/:provider` | Callback | OAuth redirect handler |
| `/profile` | Profile | User profile (authenticated) |
| `/hackathons` | Browse | List public hackathons |
| `/hackathons/:slug` | Detail | Public hackathon info |
| `/invite/:token` | Accept Invite | Team invite acceptance |

## Auth

Uses the same OAuth flow as other apps. Login redirects to GitHub/Google, callback exchanges code for tokens. After login, redirects to profile or the originating page.

## Public vs Authenticated

Most pages are public. Only profile and invite acceptance require auth:

```tsx
<Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
```

## API Integration

Uses `apiRequest<T>()` from `src/lib/api.ts`:

```ts
import { apiRequest } from '@/lib/api';

const hackathons = await apiRequest<Hackathon[]>('/api/v1/hackathons');
```

The function handles:
- Setting `credentials: 'include'` for cookies
- Auto-refresh on 401 (silent token rotation)
- Retrying the original request after refresh

## Implementation Notes

- Lightest of the three apps — mostly static/marketing content
- `VITE_API_ORIGIN` env var points to `https://api.devsage.org` in production
- No shadcn/ui — custom Tailwind styling
- Participant sites (`{slug}.devsage.org`) are separate repos generated from `templates/hackathon-site/`
- No organizer/management features here — those belong in `apps/platform`
