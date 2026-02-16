# Admin App

> `apps/admin/` — `shikdd.devsage.org` — Platform admin panel.

## Purpose

Internal admin panel for DevSage platform administrators. Manages workspaces, platform-wide settings, and admin users. Minimal UI — only accessible to users in `platform_admins` table.

## Key Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Platform stats overview |
| `/login` | Login | GitHub/Google OAuth |
| `/admins` | Admin List | Manage platform admins |
| `/admins/invite` | Invite Admin | Add new platform admin |
| `/workspaces` | Workspaces | List all workspaces |
| `/workspaces/:id` | Workspace Detail | Members, hackathons |
| `/profile` | Profile | Current admin profile |

## Auth

Same OAuth flow as other apps, but after login, the API checks `platform_admins` table:
- If user is not a platform admin → 403 Forbidden
- All API routes under `/api/v1/admin/` require `requirePlatformAdmin` middleware

## Layout

Simpler than platform app:
```
├── RootLayout
│   ├── Sidebar (minimal navigation)
│   ├── Header (admin badge, logout)
│   └── Main content area
```

## Implementation Notes

- Smallest of the three apps — only a few pages
- No hackathon-specific pages (those are in platform app)
- No shadcn/ui needed — basic Tailwind styling sufficient
- Platform admin is a separate concept from hackathon organizer roles
- The first admin must be seeded directly in D1 (bootstrap problem)
