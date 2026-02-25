# Plan vs Implementation Gaps

Features documented in `plan/` role specifications that are **missing or incomplete** in the codebase.

---

## 🔴 CRITICAL — Core features from plan that don't exist

### GAP-1: Billing & Subscription System
- **Plan reference:** `role-club-president.md` — "Select billing plan (₹3,999–₹9,999 semester-based)"
- **Status:** Completely absent. No database tables, no API endpoints, no UI, no payment gateway integration.
- **Impact:** Club Presidents cannot select plans. Monetization blocked.
- **Scope:** New DB tables (plans, subscriptions, invoices), payment gateway (Razorpay/Stripe), API routes, Platform UI page, webhook handlers for payment events.

### GAP-2: TOTP-based Two-Factor Authentication
- **Plan reference:** `role-club-president.md` — "Sign up via Google OAuth or email/password with OTP 2FA"
- **Status:** DB schema exists (`twoFactor` table with `secret` and `backupCodes` columns, `otpSessions` table). Email OTP verification works. But **TOTP enrollment, verification, and backup code flows are NOT implemented** — no API endpoints for 2FA setup/verify in `auth.ts`.
- **Impact:** Security requirement for workspace owners not met.
- **Scope:** API endpoints (enable-2fa, verify-2fa, disable-2fa, backup-codes), Platform UI settings page.

### GAP-3: Hackathon Registration on Branded Sites
- **Plan reference:** `role-participant.md` — Full registration flow on `{hack}.{ws}.devsage.org`
- **Status:** TODO.md confirms this shows a "coming soon" placeholder. Participants cannot self-register on branded hackathon sites.
- **Impact:** Core participant flow broken for public hackathons.
- **Scope:** Registration page in hackathon site template (separate repo), API endpoints for public hackathon registration.

---

## 🟡 MEDIUM — Features partially implemented or degraded

### GAP-4: Judging Window Time Enforcement
- **Plan reference:** `role-judge.md` — "Scoring (1–2 hour tight window)" with open/close automation
- **Status:** TODO.md confirms no `scoring_opens_at`/`scoring_closes_at` fields exist. Judges can score at any time once assigned.
- **Impact:** No time-boxed scoring windows. Judges could score before judging officially starts.
- **Scope:** DB columns on `hackathonRounds`, API validation in scoring endpoint, DO alarm for window open/close, judge UI countdown.

### GAP-5: Judge Guidelines & Instructions
- **Plan reference:** `role-judge.md` — "Review rubric & guidelines" pre-judging
- **Status:** Rubric criteria exist. But there's no field/endpoint for Event Leads to post freeform judging guidelines/instructions.
- **Impact:** Judges only see rubric criteria names, not detailed scoring guidance.
- **Scope:** DB column on `hackathons` or `hackathonRounds` (e.g., `judging_guidelines` TEXT), API PATCH, judge UI display.

### GAP-6: Analytics Backend API
- **Plan reference:** `role-club-president.md` — "View analytics across all hackathons"; `role-club-vp.md` — "View hackathon analytics"
- **Status:** Platform app has an `analytics.tsx` page, but it uses **mock/hardcoded data**. No backend API endpoints for analytics queries exist.
- **Impact:** Analytics dashboard is non-functional with real data.
- **Scope:** New `analytics.ts` route file with endpoints for team stats, submission metrics, scoring distributions, participation trends.

---

## 🟢 LOW — Nice-to-haves from plan that are deferred

### GAP-7: Eliminated Team Notifications & Disbanding
- **Plan reference:** `role-participant.md` — "Eliminated teams get read-only access"
- **Status:** `roundResults` table tracks `status` (advanced/eliminated), but:
  - No notification sent to eliminated teams (notification type missing)
  - No automatic team status change to read-only
  - No UI indication of elimination beyond leaderboard
- **Impact:** Eliminated teams don't know they're eliminated until checking leaderboard.

### GAP-8: Per-Round Submission Tag Patterns
- **Plan reference:** `role-event-lead.md` — Each round can have its own tag pattern
- **Status:** `submissionTagPattern` exists on `hackathons` table (global). Rounds don't have individual tag patterns.
- **Impact:** All rounds share one tag pattern. Can't have `round1-*` / `round2-*` per round.
- **Scope:** Add `submissionTagPattern` column to `hackathonRounds`, update tag validation logic.
