# Backend ↔ Frontend Integration (DevSage)

This document describes how the DevSage backend (Cloudflare Workers / Hono) connects to the hackathon frontend (React + Vite), how authentication and CORS are handled, deployment notes, and common troubleshooting steps.

## Overview
- Backend: Hono app running on Cloudflare Workers at `https://api.devsage.org` (source: `apps/api/`). Uses D1 for relational storage, KV, Durable Objects, and Queues for background tasks.
- Frontend: React + Vite templates in `hackthon-templates/` and `seed-hack001/`, deployed to Cloudflare Pages (e.g. `*.pages.dev`).

## High-level Architecture
- Client (browser) ⇄ Cloudflare Pages frontend ⇄ Cloudflare Workers API ⇄ D1 / KV / Durable Objects / Queues
- Requests from the frontend use fetch with `credentials: 'include'` so auth uses HTTP-only cookies (refresh/access token strategy).

## Authentication Flow
1. User posts credentials to `POST /api/v1/auth/login` (API). Backend sets HTTP-only cookies (`refresh_token`, `access_token` or similar) scoped to the API domain.
2. Frontend stores no tokens in localStorage; subsequent fetch calls include cookies using `credentials: 'include'` and the `optionalAuth`/`requireAuth` middleware validates tokens.
3. Refresh tokens are rotated by endpoints on expiry; logout clears cookies server-side.

Relevant files:
- `apps/api/src/routes/*` — route handlers for auth, hackathons, teams, submissions, announcements.
- `hackthon-templates/src/contexts/AuthContext.tsx` — frontend auth glue.

## CORS and Allowed Origins
- CORS is enforced by middleware (`apps/api/src/middleware/cors.ts`) using a function matcher built from `apps/api/src/lib/allowed-origin.ts`.
- Allowed origin patterns are provided via environment variables in `apps/api/wrangler.jsonc` (`HACKATHON_ORIGIN_PATTERN`, `PAGES_ORIGIN_PATTERN`) and converted to regex to match incoming `Origin` headers.
- Because credentials are used, the API returns `Access-Control-Allow-Credentials: true` and mirrors the specific origin (not `*`).

How to test CORS (preflight) from your machine:
```
curl -i -X OPTIONS "https://api.devsage.org/api/v1/hackathons/seed-hack001" \
  -H "Origin: https://your-site.pages.dev" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type"
```
Look for `Access-Control-Allow-Origin: https://your-site.pages.dev` and `Access-Control-Allow-Credentials: true` in the response.

## Important Env Vars / Config
- `API_URL` / `FRONTEND_URL` / `PLATFORM_URL` — canonical origins used by code and emails.
- `HACKATHON_ORIGIN_PATTERN` — e.g. `https://*.hackathon.devsage.org` (glob supported).
- `PAGES_ORIGIN_PATTERN` — e.g. `https://*.pages.dev` (for deployed Pages sites).

Files to inspect:
- `apps/api/src/lib/allowed-origin.ts` — logic that converts glob to regex.
- `apps/api/src/middleware/cors.ts` — Hono cors middleware configuration.

## Key API endpoints (examples)
- `GET /api/v1/hackathons/:slug` — hackathon metadata
- `GET /api/v1/teams/me` — current user's team (requires auth)
- `POST /api/v1/submissions` — create submission (requires auth)
- `POST /api/v1/auth/login`, `POST /api/v1/auth/register`, `POST /api/v1/auth/logout`

Frontend usage notes
- All API calls should use the central client helper (see `hackthon-templates/src/lib/api.ts`) which sets `credentials: 'include'` and JSON headers.
- Site config (`site.config.json`) contains `apiOrigin` — frontend uses this to set base URL.

## Deployment
- Deploy API (from `apps/api/`):
```
cd DEVSAGE/apps/api
npx wrangler deploy
```
- Deploy frontend (example for `seed-hack001`):
```
cd seed-hack001
pnpm install
pnpm build
npx wrangler pages deploy ./dist --project-name=seed-hack001
```

Note: After changing CORS origin patterns or `allowed-origin.ts`, redeploy the API and then refresh the Pages site.

## Troubleshooting
- No `Access-Control-Allow-Origin` header in preflight: origin matcher rejected the origin. Check `HACKATHON_ORIGIN_PATTERN` / `PAGES_ORIGIN_PATTERN` and `allowed-origin.ts` conversion logic.
- Browser SSL errors but curl works: try clearing the browser cache, check local proxy/antivirus, or test in incognito.
- Auth cookie not sent: verify frontend calls use `credentials: 'include'` and same-site / domain attributes on cookies are correct for your environment.

## Where to look in code
- Backend entry: `apps/api/src/index.ts`
- Allowed origins: `apps/api/src/lib/allowed-origin.ts`
- CORS middleware: `apps/api/src/middleware/cors.ts`
- Routes: `apps/api/src/routes/*.ts`
- Frontend API client: `hackthon-templates/src/lib/api.ts` and `seed-hack001/src/lib/api.ts`

## Next steps / Notes
- After any origin or auth changes, redeploy the API first, then rebuild/deploy frontend.
- Keep `HACKATHON_ORIGIN_PATTERN` and `PAGES_ORIGIN_PATTERN` updated for new hosting domains.

If you want, I can generate a mermaid sequence diagram or expand this doc with step-by-step debugging checklists and example payloads.
