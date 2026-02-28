# Web App (devsage.org)

Pure marketing site. No login, no auth, no backend API calls. Static content + SEO.

## Role

The web app is the public face of DevSage. Its job is to:
- Explain what DevSage is
- Show pricing and features
- Provide legal/policy pages
- Link visitors to the correct app (app.devsage.org for participants, platform.devsage.org for organizers, etc.)

It does NOT handle hackathon browsing, registration, or any authenticated flows. Those belong in `apps/app/` (see `05-app.md`).

## Current Pages (9)

| Route | Status |
|-------|--------|
| `/` | Complete — hero, features, pricing, team photos |
| `/about` | Complete |
| `/hackathons` | **Move to `app`** — this fetches from API, doesn't belong here |
| `/hackathons/:slug` | **Move to `app`** — dynamic theming, API-dependent |
| `/privacy` | Complete |
| `/terms` | Complete |
| `/faq` | Complete |
| `/about-us` | Complete |

## Migration: Move API-Connected Pages to `app`

The `/hackathons` and `/hackathons/:slug` routes currently fetch from the API. These should move to `apps/app/` since `web` is a pure static marketing site.

**After migration, `web` has 7 pages** — all static content, no API calls.

If we want a hackathon preview on the marketing site (e.g., "Featured Hackathons"), render it statically at build time or link out to `app.devsage.org/hackathons`.

## Features to Add

### 1. Navigation Links to Other Apps

Add clear CTAs directing visitors to the right place:
- "Browse Hackathons" → `app.devsage.org/hackathons`
- "Organize a Hackathon" → `platform.devsage.org`
- "Sign In" → `app.devsage.org/login`
- "Admin" → (footer link) `shikdd.devsage.org`

### 2. SEO & Performance

- Add `<meta>` tags per page (title, description, og:image)
- Pre-render all pages at build time (Vite SSG plugin or static export)
- Structured data (JSON-LD) for the organization
- Sitemap generation
- Canonical URLs

### 3. Marketing Content

- **Use cases section**: University clubs, corporate hackathons, community events
- **Testimonials / social proof**: Quotes, logos, stats
- **Comparison table**: DevSage vs Devpost vs manual spreadsheets
- **Blog/changelog**: Optional, link to external if not building in-app

### 4. Responsive Polish

- Mobile-first layout audit
- Touch targets ≥ 44px
- Reduce GSAP/Framer Motion bundle for mobile (conditional loading)

## Technical Simplification

Since `web` has no API calls, it can be simplified:
- Remove `lib/api.ts` (no longer needed)
- Remove any `@devsage/shared` import (no Zod validation needed)
- Remove React Query if present
- Consider converting to Astro or static HTML if React overhead isn't justified (optional, low priority)

## Components

| Component | Purpose |
|-----------|---------|
| `Hero` | Landing page hero section |
| `FeatureGrid` | Platform feature showcase |
| `PricingTable` | Plan comparison |
| `TeamSection` | Team member photos |
| `CTABanner` | Call-to-action banners linking to app/platform |
| `Footer` | Links to all apps, legal pages |
