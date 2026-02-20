---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
classification:
  projectType: saas_b2b
  domain: edtech
  complexity: medium
  projectContext: brownfield
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-DevSage-2026-02-18.md
  - _bmad-output/project-context.md
  - docs/index.md
  - docs/project-overview.md
  - docs/architecture-api.md
  - docs/architecture-frontends.md
  - docs/api-contracts.md
  - docs/backend-frontend-integration.md
  - docs/data-models.md
  - docs/development-guide.md
  - docs/integration-architecture.md
  - docs/source-tree-analysis.md
workflowType: 'prd'
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 9
---

# Product Requirements Document - DevSage

**Author:** Srijan
**Date:** 2026-02-18

## Executive Summary

DevSage is a full-stack hackathon management platform that replaces the fragmented toolchain of spreadsheets, Google Forms, paper-based judging, and manual score tallying with a single, branded, end-to-end system covering the entire hackathon lifecycle. The platform targets Indian universities, coding bootcamps, and corporate innovation teams — organizations that run hackathons as institutional workflows, not one-off events.

The platform manages everything from workspace creation and team formation through Git-native submissions, multi-round elimination judging with weighted rubrics, and tamper-proof results publication. Each hackathon gets its own branded deployment on a unique subdomain, backed by an institutional-grade audit trail where every action is hash-chained with SHA-256 for tamper detection.

DevSage serves five user personas: participants (the growth engine — 200:1 ratio vs organizers), organizers (the buyer-user who configures and runs events), judges (reluctant users who want a task list that shrinks to zero), platform admins (SHIKDD team managing hackathon approvals), and spectators (passive distribution channel via branded public sites). The platform is offered as a semester-based SaaS subscription priced in INR (₹3,999–₹9,999/semester), targeting the massive and underserved Indian university hackathon market.

This is a brownfield project with a substantial existing codebase — a Turborepo monorepo with a Cloudflare Workers API (Hono + D1 + Durable Objects + Queues), three React SPA frontends (Admin, Platform, Web), and shared packages covering 36 database tables and 90+ API endpoints. This PRD covers the complete product build; existing code should be audited and salvaged where sound.

### What Makes This Special

The core differentiator is **Git-native submissions via GitHub webhooks**. When a participant pushes a Git tag from their terminal, a timestamped, SHA-linked, auditable submission appears on the organizer's dashboard within seconds — no forms, no browser context-switching, no deadline disputes. This is the moment that kills the spreadsheet permanently and proves the platform is fundamentally different infrastructure, not a prettier interface layered on top of the same broken workflow.

This submission pipeline is also the existential risk: if a tag push fails to create a submission during a live hackathon at 11:58 PM before a deadline, the trust proposition collapses irreversibly with that institution. The webhook pipeline's reliability — idempotent processing, zero data loss, correct timestamps — is the foundation everything else sits on.

The platform's core conviction — that hackathons are institutional workflows deserving the same rigor as any other academic or corporate process — shapes every architectural decision. Submissions happen through Git, not upload forms. Each hackathon gets its own branded deployment, not a page on someone else's directory. Every action is recorded in a tamper-proof audit trail designed for institutional accountability. A competitor would need to simultaneously integrate deeply with GitHub's event system, operate per-event deployment infrastructure, build institutional-grade access controls, and price for the Indian education market.

## Project Classification

- **Project Type:** SaaS B2B — multi-tenant platform with workspace-based organization, role-based access control (6-tier per-hackathon hierarchy), and semester-based subscription tiers
- **Domain:** EdTech — hackathon management for universities, coding bootcamps, and corporate innovation labs, with institutional accountability requirements
- **Complexity:** Medium — domain-specific concerns (institutional audit trails, multi-round elimination logic, webhook pipeline reliability) but not heavily regulated like healthcare or fintech
- **Project Context:** Brownfield — substantial existing codebase across all features (36 DB tables, 90+ API endpoints, 3 frontend apps, shared packages). Nothing should be assumed working; audit and salvage existing code where sound.

## Success Criteria

### User Success

| Persona | Success Metric | Target |
|---|---|---|
| **Participant (Priya)** | Time from "got the link" to "on a team with linked repo" | <3 minutes, zero support messages |
| **Participant (Priya)** | Submission via git tag without asking anyone how | 100% of submissions via tag push, not manual entry |
| **Organizer (Arjun)** | Hackathon configured and published | <30 minutes from start to branded site live |
| **Organizer (Arjun)** | Support messages from participants during event | Trending → 0 |
| **Organizer (Arjun)** | Real-time judge progress visibility | Per-round dashboard showing who hasn't started scoring |
| **Judge (Nikhil)** | Total active scoring time per round | <90 minutes per round |
| **Judge (Nikhil)** | Scoring completion rate per round | >95% without organizer intervention |
| **Platform Admin (Srijan)** | Hackathon request → handover time | <48 hours |
| **Spectator (Meera)** | Public site engagement | Views leaderboard, shares link — no login required |

### Business Success

**3-Month Milestone (Prove, Don't Scale):**
- 5–8 pilot colleges running real hackathons
- At least 3 hackathons run end-to-end without manual intervention
- At least 1 organizer returns for a second hackathon unprompted
- At least 1 participant-turned-organizer signs up a new workspace

**12-Month Milestone (Semester Proof — two full cycles):**
- 30–50 paying workspaces across colleges
- 100+ hackathons completed on the platform
- ₹2–3 lakh ARR
- Semester-over-semester renewal rate >70% (>80% = strong PMF)
- Organic workspace creation rate >30% by month 12

### Technical Success

| Criteria | Target | Rationale |
|---|---|---|
| **Webhook pipeline: zero silent loss** | No submission ever disappears without trace | Existential — one vanished submission kills trust with that institution permanently |
| **End-to-end submission latency** | <30 seconds (tag push → dashboard), <2 seconds for platform-controlled processing | Participant must see confirmation quickly; organizer dashboard must update in near-real-time |
| **Dead-letter queue with alerting** | Failed webhooks after retry exhaustion → DLQ with ops alerting | Ensures no event is silently dropped; ops team can investigate and replay |
| **Manual submission reconciliation** | "Reconcile submissions" button comparing repo tags against existing submissions | Safety net for live hackathons — sleep better during the first event |
| **State machine enforcement** | Durable Object enforces forward-only transitions with submission locking | No accidental backward transitions; submissions lock during judging phase |
| **Audit trail integrity** | Every mutation hash-chained with SHA-256, append-only | Institutional accountability — defensible results when disputes arise |
| **Judge real-time progress** | Per-round visibility into scoring progress during judging window | Organizers can nudge judges before the window closes, not after |

### Measurable Outcomes

- **North Star:** Organizer support requests during an active hackathon → trending to zero
- **Retention signal:** Semester-over-semester workspace renewal rate >80%
- **Growth signal:** Organic workspace creation (participant→organizer pipeline) >30% by month 12
- **Reliability signal:** Zero submissions lost across all platform hackathons

## Product Scope

> **Note:** Detailed MVP feature set, phased roadmap, and risk mitigation strategy are documented in the **Project Scoping & Phased Development** section below. This section provides the high-level scope summary.

The MVP is a Platform MVP — the complete platform with all subscription tiers functional, rough edges acceptable. Ship when a college club can run a real multi-round hackathon end-to-end on any tier.

**Core systems:** Authentication (3 methods), workspace management, hackathon lifecycle (5-state machine), team formation, git-native submissions, multi-round elimination judging, leaderboard, participant site generation, subscription tier enforcement, admin panel, platform app, main website, email notifications, and hash-chained audit trail.

**Validation gates:**
- Stage A: Internal dogfood (5–10 people, real repos, real judging)
- Stage B: One friendly college (30–50 participants, zero intervention required)

## User Journeys

### Journey 1: Priya — The Participant

**Opening Scene:** Priya is a second-year CS student at a mid-tier Indian engineering college. She sees a WhatsApp message from her senior: a link to `codecraft-spring-hack.devsage.org`. She taps it on her phone during a break between classes. A polished, branded hackathon site loads — CodeCraft's logo, their colors, clear timeline, tracks, and prizes. No "Powered by Some Platform" footer. She thinks this looks legit.

**Rising Action:** She hits "Register" and signs in with GitHub in one tap — no forms, no passwords, no email verification. She's in. (Alternatively, participants without GitHub accounts can register via email and password with OTP verification, though GitHub OAuth is the primary path.) Her friend Rohit already created team "NeuralNinjas" and sends her the invite code over text. She pastes it, joins instantly. Two more teammates join the same way. Rohit, as team lead, links their private GitHub repo in three clicks — the DevSage GitHub App asks for read-only permissions, he approves. The team dashboard shows "Repo linked ✓, Bot active ✓." Total time from WhatsApp link to "on a team with linked repo": under 3 minutes. She never asked anyone "how do I register?"

**Climax:** It's 11:45 PM, 15 minutes before the Round 1 deadline. The team has been coding for 18 hours. Priya types `git tag r1_submission_v1 && git push origin --tags` in her terminal. Within seconds, the hackathon site updates: "Submission received ✓ — Tag: r1_submission_v1, SHA: a3f8c2d, Received: 23:45:32 IST." No form. No upload. No copy-pasting GitHub links. Something she did in her natural workflow — a git command — appeared on a website instantly. That's the moment.

**Resolution:** Two days later, she checks the leaderboard. NeuralNinjas made it to Round 2. She receives a notification: "Congratulations! Your team advanced to Round 2." She pushes `r2_submission_v1` for Round 2 just as naturally. After final results, she can see judge feedback on her submission (the organizer enabled it). She screenshots the leaderboard showing NeuralNinjas at #3 and posts it on LinkedIn. She doesn't remember the name "DevSage" — she remembers the experience. Six months later, when she's on the organizing committee, she says "remember that hackathon site CodeCraft had?"

### Journey 2: Arjun — The Organizer

**Opening Scene:** Arjun is the Technical Secretary of CodeCraft, his college coding club. Last semester's hackathon was a disaster — 40 hours of logistics, broken Google Sheets, public corrections to results, WhatsApp messages at 2 AM asking "how do I submit?" He got DevSage's link from another club president who ran a hackathon without a single WhatsApp fire.

**Rising Action:** Arjun creates a workspace for CodeCraft on `platform.devsage.org` using Google OAuth. His faculty advisor Prof. Sharma approves ₹3,999 from the club budget for a Tier 1 semester subscription. Arjun clicks "Request New Hackathon," fills in the details — title, dates, expected 50 participants, 2 rounds with elimination, tracks for AI/ML and Web — and submits. On his dashboard, he watches the tracking roadmap: Submitted → Seen → Approved. Within 48 hours, the request is approved. A draft hackathon auto-creates in his workspace with the details he submitted.

He configures: team size 2-4, Round 1 tag pattern `r1_submission_v%`, Round 2 tag pattern `r2_submission_v%`, separate rubrics per round (Idea + Feasibility for R1, Implementation + Demo + Code Quality for R2), eliminate bottom 5 teams after R1. He invites 3 judges and 2 co-organizers. He sets the registration mode to "open" and publishes. The branded site goes live at `codecraft-spring-hack.devsage.org` — his club's logo, his colors, zero design work. Total setup: 25 minutes.

**Climax:** During the hackathon, Arjun's dashboard is his command center. 15 teams registered, repos linked, submissions flowing in automatically via git tags. He didn't touch a spreadsheet. When Round 1 judging opens, he watches the real-time judge progress panel — 2 judges are done, 1 hasn't started. He sends a nudge with one click. The lagging judge finishes within the hour. After Round 1, he clicks "Finalize Round 1" — bottom 5 teams are automatically eliminated, notifications sent, Round 2 opens. Zero WhatsApp messages from participants asking "how do I submit?"

**Resolution:** After Round 2 judging, leaderboard math checks out automatically. Arjun exports a branded PDF for Prof. Sharma. No disputes — the audit trail shows exactly when every submission arrived, every score was recorded, every state transition happened. Prof. Sharma doesn't log in; he judges DevSage by the PDF export and zero complaints. Next semester, Arjun clones this hackathon's config in 5 minutes. He tells two other club presidents about the platform.

### Journey 3: Nikhil — The Judge

**Opening Scene:** Nikhil is a 28-year-old software engineer at a Bangalore startup. A student club president cold-emailed him on LinkedIn promising "judging will take about 90 minutes." Last time he judged, it took 4 hours across 2 days — broken Google Sheets, GitHub links requiring access requests, no progress tracking, accidental score overwrites. He tells himself he's never doing this again. (He says this every time.)

**Rising Action:** He receives an email from DevSage on behalf of CodeCraft: "You're invited to judge Spring Hack 2026." One click to accept — no registration, no forms. He lands on `platform.devsage.org` and sees his judging dashboard: 8 assignments for Round 1, each with a verified GitHub repo link that actually works (read-only access via the DevSage GitHub App), a clear rubric (Idea: max 10, weight 50%; Feasibility: max 10, weight 50%), and a progress bar showing "0/8 completed."

**Climax:** He opens the first assignment. The repo is there — no broken links, no access requests. He reviews the code, then slides scores for each criterion and adds a brief comment. Submit. "1/8 completed." He does 4 more in his first session (45 minutes), then closes the tab. Next day, he picks up exactly where he left off — "4/8 completed." He finishes the remaining 4 in 35 minutes. Total: 80 minutes across two sessions. The organizer never had to message him.

Round 2 happens. Nikhil is assigned to different teams this round, with a different rubric (Implementation, Demo, Code Quality). Same flow — different criteria, same smooth experience. Another 60 minutes. Done.

**Resolution:** When the next hackathon invitation arrives, Nikhil's objection drops from "ugh, last time was a nightmare" to "sure, if it's on that same platform." He becomes a low-resistance repeat judge — solving one of organizers' biggest problems. He never thinks about the tool — he thinks about the code he's evaluating. That's the best judge experience: invisible infrastructure.

### Journey 4: Srijan — The Platform Admin

**Opening Scene:** Srijan is the founder of DevSage, wearing an admin hat. It's the start of the August semester — predictably, three clubs from different colleges submit hackathon creation requests in the same week. His goal: process all three without becoming the bottleneck.

**Rising Action:** On `shikdd.devsage.org` (protected by Cloudflare Zero Trust), Srijan sees the request queue. Three new requests in "Submitted" status. He opens the first — CodeCraft's request from Arjun. Everything looks good: clear dates, reasonable team size, 2 rounds. He clicks "Approve." A draft hackathon auto-creates in CodeCraft's workspace. The second request from RoboTech club is missing details about their judging criteria. He clicks "Request More Info" with a note: "Please specify how many judges you'll need and your rubric criteria." The request goes back to the club for clarification. The third request from DataSci Club looks good — approved.

For the approved requests, Srijan assigns himself to build CodeCraft's hackathon and assigns his teammate to build DataSci's. Each hackathon's per-event frontend is cloned from the template repository — placeholder variables replaced with hackathon name, slug, API endpoint, and workspace branding. The cloned repo is pushed to SHIKDD-org, deployed to `codecraft-spring-hack.devsage.org`. Srijan fine-tunes settings, marks "Ready," then "Handed Over." The requesting body sees each status transition on their tracking roadmap with timestamps.

**Climax:** During peak week, Srijan processes all three requests in under 48 hours each. No club is left waiting. He monitors active hackathons from the admin panel — workspace counts, active hackathons, request queue depth. When RoboTech resubmits with the missing info, he approves and builds in one sitting. His throughput metric holds: zero clubs waiting more than 3 days.

**Resolution:** By semester end, Srijan has processed 8 hackathon requests across 5 colleges. His hackathons-per-admin-hour ratio is improving. He starts thinking about whether trusted workspaces (those that have successfully run 2+ hackathons) could eventually self-serve — but that's a year-two problem. For now, the manual approval flow ensures quality control and gives him direct relationships with every organizer.

### Journey 5: Meera — The Spectator

**Opening Scene:** Meera is a first-year at Arjun's college. She's not participating in the hackathon — she's not even sure what a hackathon is. She sees a senior's Instagram story: a screenshot of a leaderboard with teams ranked by score, on a sleek branded site with CodeCraft's logo.

**Rising Action:** She taps the link. It takes her to `codecraft-spring-hack.devsage.org`. No login required. She sees the hackathon landing page — rules, timeline, tracks (AI/ML, Web), prizes. She scrolls to the live leaderboard. Team "NeuralNinjas" is at #3. She recognizes a name — that's Priya from her wing.

**Climax:** She screenshots the leaderboard and sends it to her friend group: "look Priya's team is winning 😱". A friend replies: "we should do this next semester." The entire interaction takes 30 seconds. She doesn't create an account. She doesn't register. She sees one polished page and it plants a seed.

**Resolution:** Six months later, Meera is on the organizing committee for the next semester's hackathon. When someone says "let's use Google Forms for registration," she says "wait, remember that hackathon site CodeCraft had?" She doesn't remember the name DevSage. She remembers the experience. The branded subdomain was a billboard she didn't know she was looking at.

### Journey 6: Ravi — The Co-Organizer

**Opening Scene:** Ravi is one of Arjun's 8 volunteers at CodeCraft. Last semester, he was added to a shared Google Sheet and told to "help manage judging." He accidentally overwrote two rows of scores. This semester, Arjun invites him as a co-organizer on DevSage.

**Rising Action:** Ravi receives an email invitation. He accepts and logs into `platform.devsage.org`. He can see the full hackathon dashboard — teams, submissions, judges, rounds, audit log. But he notices he can't delete the hackathon or add/remove other organizers. That's fine — those are Arjun's calls.

**Climax:** During the live hackathon, Ravi's job is managing the judging logistics. He monitors judge progress in real-time — who's scoring, who hasn't started. When one judge is lagging, Ravi sends a nudge notification. When another judge drops out entirely, Ravi reassigns their unscored submissions to a backup judge. He manages all of this from the dashboard without ever opening a spreadsheet. When a team reports an issue with their submission not appearing, Ravi checks the audit log — he can see the webhook was received but the tag didn't match the pattern (typo: `r1_submisson_v1` instead of `r1_submission_v1`). He tells the team, they push the correct tag, submission appears instantly.

**Resolution:** Ravi managed the judging logistics for a 15-team hackathon without accidentally breaking anything. He couldn't overwrite scores (read-only for him), couldn't delete the hackathon, and every action he took was logged in the audit trail. Arjun could delegate safely. Next semester, Ravi takes over as Technical Secretary — and he already knows the platform.

### Journey 7: Rohit — The Team Lead

**Opening Scene:** Rohit is Priya's teammate and the one who creates team "NeuralNinjas." He heard about the hackathon from a WhatsApp group and signed up with GitHub OAuth before most of his friends.

**Rising Action:** Rohit creates the team on the hackathon site — picks a name ("NeuralNinjas"), gets an auto-generated invite code. He shares the code with Priya and two other friends over text. They join in seconds. Now Rohit needs to link the team's GitHub repo. He navigates to team settings, enters the repo owner and name, and the DevSage GitHub App requests installation on the repo with read-only permissions (contents + metadata). He approves. The dashboard shows "Repo linked ✓, Bot active ✓." His teammates can see the repo status too but can't unlink it — only he, as team lead, has that permission.

**Climax:** The repo is linked and the bot is watching. When Rohit pushes `r1_submission_v1`, the submission appears. But he notices a bug after submitting. He pushes `r1_submission_v2` — the new submission replaces the previous one as the final submission (`is_final` flag flips). The old submission is still recorded for audit purposes. He can't leave the team during the active hackathon (the platform prevents it) — he's committed.

In Round 2, after NeuralNinjas advances, one teammate becomes unresponsive. Rohit can't kick them mid-hackathon, but the team continues with 3 active members. He pushes `r2_submission_v1` before the Round 2 deadline. The team's submission history is clean and auditable — two submissions per round, correct SHAs, correct timestamps.

**Resolution:** After the hackathon, Rohit checks the leaderboard — #3 overall. He views the judge feedback (the organizer enabled it). The specific, per-criterion comments help him understand what to improve for next time. When the next hackathon comes around, he creates a new team in 30 seconds — he already has an account, knows the flow, and tells his friends to just "push a tag when you're ready to submit."

### Journey Requirements Summary

| Journey | Capabilities Revealed |
|---|---|
| **Priya (Participant)** | GitHub OAuth, team join via invite code, git-tag submission pipeline, leaderboard viewing, judge feedback visibility, notification system |
| **Arjun (Organizer)** | Google OAuth, workspace creation, hackathon request workflow, multi-round configuration, rubric management, judge invitation, real-time progress monitoring, elimination automation, CSV/PDF export, hackathon cloning |
| **Nikhil (Judge)** | Email invite → one-click accept, judging dashboard with verified repo links, per-criterion scoring with comments, multi-session progress persistence, round-specific rubrics, assignment tracking |
| **Srijan (Admin)** | Request queue with filtering, approve/defer/request-info workflow, per-hackathon frontend cloning pipeline, status tracking roadmap, assignment delegation, active hackathon monitoring |
| **Meera (Spectator)** | Public-facing branded site, no-login leaderboard access, social sharing surface |
| **Ravi (Co-organizer)** | Scoped permissions (no delete/organizer management), judge progress monitoring, submission troubleshooting via audit log, judge reassignment, nudge notifications |
| **Rohit (Team Lead)** | Team creation, invite code generation, repo linking with GitHub App, multiple submission versioning, team member management constraints, submission history auditing |

## Domain-Specific Requirements

### Institutional Accountability & Audit

Every hackathon action must produce a defensible audit trail suitable for institutional scrutiny. This is not a "nice to have" — it's the foundation of trust with universities and corporations.

- All mutations logged via `insertAuditEvent()` with SHA-256 hash chaining (append-only, tamper-detectable)
- Actor types: user, bot, system, cron — every action attributable
- Audit log queryable per hackathon by organizers; platform-wide by admins
- Score disputes resolved by pointing to timestamped, hash-verified records
- Audit data preserved permanently, even after account deletion (anonymized references)

### Data Privacy (DPDPA — India)

India's Digital Personal Data Protection Act (2023) applies to all user data processed by DevSage. Key requirements:

- **Consent:** Clear, informed consent at registration for data collection and processing
- **Purpose limitation:** Data used only for hackathon management; no secondary sale or sharing
- **Data minimization:** Collect only what's needed — GitHub username, email, name, avatar
- **Right to erasure:** GDPR-style account deletion flow (30-day grace period, anonymization of PII, preservation of audit records with anonymized references)
- **Data export:** Users can download all personal data in JSON format before deletion
- **Cross-border:** GitHub API calls send data to GitHub's servers (US) — requires appropriate disclosure
- **Breach notification:** Incident response plan for data breaches (notification within 72 hours to Data Protection Board)

### GitHub API Reliability & Rate Limits

The submission pipeline depends entirely on GitHub's webhook delivery and API availability:

- **Webhook delivery:** GitHub does not guarantee exactly-once delivery; handlers must be idempotent
- **API rate limits:** 5,000 requests/hour for authenticated GitHub App installations; submission SHA resolution counts against this
- **Retry policy:** GitHub retries failed webhook deliveries for up to 3 days
- **Dead-letter queue:** Webhooks that exhaust retries must land in a DLQ with ops alerting
- **Manual reconciliation:** "Reconcile submissions" button that calls GitHub API to compare repo tags against existing submissions — safety net when webhook delivery fails
- **GitHub outages:** Platform must gracefully degrade when GitHub API is unavailable (queue messages for later processing, show "submission pending verification" status)
- **Rate limit monitoring:** Track API usage per installation; alert when approaching limits during peak submission periods

### Academic Integrity

Hackathons in academic contexts require mechanisms to detect and flag integrity violations:

- **Force-push detection:** All force pushes logged in `force_push_events` table with before/after SHAs and pusher identity
- **Tag deletion flagging:** If a submission tag is deleted post-submission, the submission is flagged for organizer review (audit event logged)
- **Repo visibility warnings:** Public repos during hackathons are flagged to organizers (plagiarism risk)
- **Repo transfer detection:** Ownership changes mid-hackathon flagged for review
- **Timestamp integrity:** Submission timestamps derived from server-side receipt time (not git tag timestamp), preventing timestamp manipulation
- **Late submission handling:** Always accepted, marked with `is_late` flag, organizer discretion on penalty — never silently rejected

### Semester-Cycle Operations

DevSage's workload is seasonal, with predictable peaks:

- **Peak periods:** August (fall semester start) and January (spring semester start) — multiple workspace creation requests in the same week
- **Hackathon clustering:** Multiple hackathons running simultaneously across different workspaces during mid-semester
- **Admin throughput:** Must handle 3+ simultaneous hackathon creation requests without >48-hour delays
- **Hackathon cloning:** Previous semester's configuration must be clonable for rapid repeat setup
- **Workspace continuity:** When club leadership turns over annually, workspace-level (not person-level) configuration ensures continuity
- **Infrastructure scaling:** Cloudflare Workers auto-scale for burst submission traffic (deadline-adjacent tag pushes)

### Fair Judging & Conflict of Interest

Judging fairness is the #1 source of post-hackathon complaints in university contexts:

- **Judge-participant exclusion:** A judge cannot also be a participant in the same hackathon (enforced at invitation)
- **Conflict disclosure:** Judges should be able to self-declare conflicts of interest (e.g., mentored a team, affiliated with a sponsoring company) — flagged to organizer
- **Recusal workflow:** Organizer can reassign submissions if a judge discloses a conflict or is identified as biased
- **Score anomaly detection:** Flag statistically significant outliers — e.g., one judge consistently scoring a team 2+ standard deviations above the mean compared to peer judges
- **Judge assignment transparency:** Round-robin auto-assignment ensures balanced distribution; organizer can override but assignment changes are audited
- **Track-scoped judging:** Judges can be assigned to specific tracks to prevent cross-track bias

### Prize & Financial Compliance (Indian Context)

When hackathons award monetary prizes, Indian tax and institutional accounting rules apply:

- **TDS (Tax Deducted at Source):** Prizes above ₹10,000 require TDS under Indian tax law; platform should support capturing winner PAN details
- **Prize certificates:** Generate downloadable prize certificates with hackathon branding for winners
- **Institutional receipts:** Export-ready data for organizers' institutional accounting (department budgets, sponsor funds)
- **GST on subscriptions:** Semester-based SaaS subscription may attract GST — pricing should be GST-inclusive or clearly stated
- **Note:** DevSage does not handle prize disbursement directly; it provides the data and documentation organizers need for their institutional processes

### Multi-Tenant Data Isolation

Multiple competing institutions on the same platform creates data leakage risk:

- **Workspace isolation:** No cross-workspace data visibility — organizers of Workspace A cannot see teams, submissions, or scores from Workspace B
- **Judge isolation:** A judge assigned to Hackathon A cannot see submissions from Hackathon B, even if both hackathons are on the same platform
- **Participant privacy:** A participant's GitHub repo details from one hackathon are not visible to organizers of another hackathon in a different workspace
- **Analytics isolation:** Workspace analytics are strictly scoped; no cross-workspace metrics leakage
- **Role resolution per-hackathon:** Roles are resolved per-request per-hackathon, not globally — being an organizer in one hackathon grants zero privileges in another
- **Audit log scoping:** Audit logs are hackathon-scoped; platform admin can see cross-workspace logs but organizers cannot

### Timezone-Sensitive Deadline Enforcement

Deadline handling must be unambiguous and trustworthy:

- **All deadlines stored as UTC ISO-8601** — no ambiguity in database
- **Display in IST** by default (India's single timezone) with clear timezone indicator on all deadline displays
- **Git tag timestamps are UTC** — comparison against deadlines uses server-side receipt time, not tag creation time
- **Late detection:** `is_late` flag computed by comparing server receipt timestamp against the hackathon's submission deadline (both in UTC)
- **Deadline change notifications:** When an organizer extends or shortens a deadline, all participants are notified with the old and new deadline in their local timezone
- **Cron-based reminders:** Hourly cron checks for approaching deadlines and sends reminders at configurable intervals (e.g., 24h, 6h, 1h before deadline)

## Innovation & Novel Patterns

### Detected Innovation Areas

**Primary Innovation: Observed-Workflow Submissions**

DevSage introduces a model-level shift in how hackathon submissions work. Rather than treating submission as an action the participant performs (upload a file, fill a form, paste a link), DevSage treats submission as something the platform *observes* from the participant's existing development workflow. A `git tag` push — already a natural developer action — becomes the submission event. The platform watches, timestamps, and records it without requiring the participant to context-switch out of their IDE.

This is not a UX improvement on existing submission mechanisms. It is a different category: passive data capture vs. active form submission. The closest analogy is continuous deployment pipelines observing git events rather than requiring manual deploy buttons — applied to the hackathon domain.

**Secondary Innovation: Pipeline Coherence**

The real defensibility is not any single component but the end-to-end integrity chain:

`Git tag push → GitHub webhook → cryptographically-verified receipt → hash-chained audit entry → round-scoped rubric evaluation → scored submission → elimination gate → next round's tag pattern activates`

Each link in this pipeline reinforces the integrity of every other link. Timestamps are server-derived (not manipulable). Audit entries are hash-chained (not editable). Rubrics are round-specific (not retroactively changed). Elimination is score-driven (not discretionary). This integration is what's genuinely hard to replicate — it's not a feature list, it's a system property.

### Market Context & Competitive Landscape

No existing hackathon platform (Devpost, Devfolio, HackerEarth, MLH) uses git-native submissions. All rely on form-based submission — participants paste a link, upload a file, or fill metadata fields. This means:

- Submission timestamps are self-reported or form-submit-time, not workflow-derived
- Audit trails are database logs, not hash-chained integrity records
- Late submission detection is honor-system or manual, not automated
- Multi-round submissions require re-submission, not tag-pattern activation

The per-hackathon deployment model (standalone apps, own repos, subdomains) is architecturally differentiated but not paradigm-shifting. Competitors offer branded pages; DevSage deploys standalone applications. The moat is operational complexity, not conceptual novelty — organizers notice the difference, participants may not.

### Validation Approach

The core innovation bet — observed-workflow submissions — can be validated through:

1. **Submission completion rate:** >95% of registered teams should successfully submit via git tag without support intervention (validates that the workflow is intuitive enough)
2. **Support ticket volume:** Submission-related support requests should be <5% of participants (validates that removing forms doesn't create confusion)
3. **Organizer trust signal:** Post-hackathon organizer surveys should show >90% confidence in submission integrity (validates that the audit chain delivers on its promise)
4. **Pipeline reliability:** Zero silent submission losses across all hackathons (validates the existential risk is mitigated)

### Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Participants unfamiliar with git tags | Submissions fail silently | Pre-hackathon onboarding guide + participant site documentation + "test submission" workflow before hackathon goes active |
| GitHub webhook delivery failure | Submissions lost | DLQ with ops alerting + manual reconciliation button + staleness detection |
| Git-native model limits non-code hackathons | Platform can't expand beyond code-centric events | Design decision: DevSage explicitly targets code-centric hackathons. Non-code events are out of scope |
| Participants game timestamps via tag manipulation | Integrity compromised | Server-side receipt time is authoritative, not git tag timestamp. Force-push detection flags suspicious activity |
| Pipeline coherence creates tight coupling | One failure cascades | Each stage is independently auditable. DLQ catches pipeline breaks. Manual reconciliation provides escape hatch |

## SaaS B2B Specific Requirements

### Project-Type Overview

DevSage is a multi-tenant SaaS B2B platform sold to institutional workspaces (college clubs, developer communities) on a semester-based subscription model. The billing entity is the workspace, not the individual. The platform serves a niche vertical (hackathon management) with deep domain-specific workflows rather than horizontal productivity tooling.

### Tenant Model

- **Billing entity:** Workspace (one subscription per workspace per semester)
- **Workspace isolation:** See **Domain-Specific Requirements > Multi-Tenant Data Isolation** for complete isolation rules
- **Role resolution:** Per-hackathon, per-request — not global. Being an organizer in Workspace A's Hackathon 1 grants zero privileges in Workspace B or even Hackathon 2 within Workspace A
- **Workspace continuity:** Configuration persists at the workspace level, not the person level. When club leadership turns over, the workspace and its history remain intact
- **Individual organizers:** Non-workspace accounts (individuals running one-off hackathons) are a future pricing model (per-event fee, TBD). Not in MVP scope

### RBAC Matrix

| Role | Scope | Key Permissions | Restrictions |
|------|-------|-----------------|-------------|
| **Platform Admin** | Platform-wide | Approve/defer creation requests, monitor all hackathons, manage platform settings | Cannot see hackathon-internal data (scores, submissions) unless explicitly granted |
| **Organizer** | Per-hackathon | Full hackathon lifecycle control — create, configure, manage rounds, invite judges, view all data, export results | One organizer per hackathon (creator). Can transfer ownership |
| **Co-organizer** | Per-hackathon | Everything organizer can do except destructive/structural actions | Cannot delete hackathon, transfer ownership, or modify subscription-level settings |
| **Judge** | Per-hackathon | View assigned submissions, score against rubric, save drafts, submit final scores | Cannot see other judges' scores until organizer reveals. Cannot self-assign submissions |
| **Team Lead** | Per-hackathon | Create team, generate invite codes, link repo, manage team members, submit (via git tag) | Cannot exceed team size limits. Cannot join multiple teams in same hackathon |
| **Team Member** | Per-hackathon | Join team via invite code, view team details, submit (via git tag) | Cannot create teams or invite others. Cannot leave team after submission deadline |
| **Anonymous** | Per-hackathon (public) | View public leaderboard, view hackathon info on participant site | No authenticated actions. No data access beyond public endpoints |

**Design decision:** Co-organizer is a fixed permission set, not a configurable permission matrix. Granular capability delegation (e.g., "can manage judges but not deadlines") is intentionally deferred. If needed later, it's easier to split into named sub-roles than to ship an unused permission configurator.

### Subscription Tiers

| Feature | Starter (₹3,999/sem) | Pro (₹6,999/sem) | Max (₹9,999/sem) | Enterprise (Future) |
|---------|----------------------|-------------------|-------------------|---------------------|
| Active hackathons | Up to 2 | Up to 10 | Unlimited | Unlimited |
| Analytics | Basic dashboard | Full analytics + regional maps | Full analytics | Custom analytics |
| Judging | Standard | Advanced workflows + custom rubric builder | Multi-round system | Custom AI judging models |
| GitHub webhooks | ✓ | ✓ | ✓ | ✓ |
| Co-organizer roles | — | ✓ | ✓ | ✓ |
| Custom domain per event | — | — | ✓ | ✓ |
| Auto-generated participant sites | — | — | ✓ | White-label |
| Audit trail & compliance logs | — | — | ✓ | Advanced |
| Cron-based deadline reminders | — | — | ✓ | ✓ |
| Support | Community | Priority email | Dedicated onboarding + SLA | 24/7 enterprise support |
| SSO/SAML | — | — | — | ✓ |
| API access | — | — | — | ✓ |

**No free tier.** Starter at ₹3,999/semester is the entry point. Time-limited free pilots may be offered to specific colleges during validation phase as a sales tactic, not a product tier.

**Enterprise is a future placeholder** — not in MVP scope. Requires proven traction with college clubs before designing enterprise packaging.

### Integration List

| Integration | Type | Purpose | MVP Scope |
|-------------|------|---------|-----------|
| **GitHub OAuth** | Authentication | User login via GitHub identity | ✓ |
| **Google OAuth** | Authentication | User login via Google identity | ✓ |
| **GitHub App** | Platform | Webhook delivery for tag-based submissions, repo access verification | ✓ |
| **Email/SMTP** | Notification | Judge invitations, OTP for email/password auth, deadline reminders, submission confirmations | ✓ |

**Explicitly out of scope for MVP:** Discord, Slack, calendar integrations, LMS (Moodle/Canvas), payment gateway (Razorpay). Subscription billing mechanics (payment collection, invoice generation) are handled outside the platform for MVP.

### Implementation Considerations

- **Subscription enforcement:** Middleware checks workspace subscription tier before allowing tier-gated actions (e.g., creating a 3rd hackathon on Starter plan returns 403 with upgrade prompt)
- **Feature flags by tier:** Tier-gated features (custom domains, audit logs, co-organizer roles) controlled via workspace subscription status, not compile-time flags
- **Upgrade path:** Upgrading mid-semester takes effect immediately. Downgrading takes effect at semester renewal. No prorating in MVP
- **Workspace provisioning:** Admin approves hackathon creation request → workspace gets created (if new) or hackathon gets added to existing workspace. Subscription must be active

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Platform MVP — full platform with all subscription tiers functional, rough edges acceptable. Ship when a college club can run a real multi-round hackathon end-to-end on any tier.

**Resource Requirements:** Team of 5 engineers. Three frontend apps (admin, platform, web) + Cloudflare Workers API + participant site template built in parallel.

**Guiding Principle:** Reliability over polish. The webhook submission pipeline must be bulletproof; UI can have rough edges. A failed submission at 11:58 PM destroys trust irreversibly. A slightly ugly dashboard does not.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:** All 7 personas (Participant, Organizer, Judge, Admin, Spectator, Co-organizer, Team Lead) have complete journeys in MVP.

**Deal-Breaker Capabilities (without these, no hackathon can run):**

| Category | Capabilities |
|----------|-------------|
| **Authentication** | GitHub OAuth, Google OAuth, email/password with OTP 2FA |
| **Workspaces** | Creation, subscription binding, member management |
| **Hackathon Lifecycle** | Creation request → admin approval → draft → active → judging → completed → archived |
| **Teams** | Creation, invite codes, repo linking via GitHub App, member management |
| **Submissions** | Git-tag webhook pipeline (cryptographically verified, idempotent, DLQ-backed), `is_final` flag, late detection |
| **Multi-Round** | Round configuration, per-round deadlines, per-round tag patterns, per-round rubrics, elimination gates |
| **Judging** | Rubric creation, judge invitation via email, round-robin assignment, per-criterion scoring, draft/final states, 95% completion tracking |
| **Leaderboard** | Real-time scoring, visibility controls, track-specific and round-specific views, freeze before announcement |
| **Participant Sites** | Template-based generation per hackathon, subdomain deployment, hackathon info + leaderboard + team listing |
| **Subscription Tiers** | Starter/Pro/Max enforcement, tier-gated features, workspace-level billing |
| **Admin Panel** | Creation request queue, approve/defer/request-info workflow, active hackathon monitoring |
| **Platform App** | Organizer dashboard, hackathon configuration, judge management, submission monitoring, co-organizer management |
| **Main Website** | Landing page, auth flows, workspace creation entry point |
| **Notifications** | Email-based: judge invitations, submission confirmations, deadline reminders, round transitions |
| **Audit Trail** | Hash-chained event logging, per-hackathon queryable audit log |

**Should-Have (included in MVP but won't block launch if incomplete):**

- Hackathon cloning from previous configurations
- Analytics dashboards (basic and advanced)
- CSV/PDF export of results
- Score anomaly detection
- Custom domains per event (Max tier)
- Cron-based deadline reminders
- Account deletion with 30-day grace period and anonymization
- Force-push detection and flagging

### Post-MVP Features

**Phase 2 (Growth) — Remove friction from paying customers:**

- Razorpay Subscriptions API integration (recurring semester billing, auto-renewals, revenue dashboards)
- Advanced analytics (organizer dashboards: completion rates, judge performance, participant engagement metrics)
- Hackathon cloning/templates (re-run last semester's event in 5 minutes) — if not completed in MVP
- API access for third-party integrations

**Phase 3 (Expansion) — Open new customer segments:**

- Enterprise tier with SSO/SAML, SLAs, dedicated onboarding
- Multi-workspace management for university systems
- Public API with developer documentation
- LMS integrations (Moodle, Canvas)
- Mobile judge experience (responsive web first — not a native app unless demand proves it)
- Opt-in hackathon discovery directory (private by default, contradicts marketplace positioning)

**Never (or validate demand first):**

- AI-assisted judging models (judges want faster UX, not automation of their judgment)
- Native mobile app (expensive for team of 5; responsive web covers 90% of mobile judge use case)
- Hackathon marketplace/discovery as a core feature (contradicts "institutional workflows, not marketplace listings" positioning)

### Risk Mitigation Strategy

| Risk Type | Risk | Mitigation |
|-----------|------|------------|
| **Technical** | Webhook pipeline unreliability during pilot hackathon | Build reliability into the pipeline itself: idempotent handlers, DLQ, cryptographic double-verification, staleness rejection. Manual reconciliation as safety net |
| **Technical** | Three frontend apps + API = massive surface area for team of 5 | Shared component library (shadcn/ui), shared schema package (@devsage/shared), Turborepo for unified builds. Prioritize platform app (organizer-facing) over admin and web |
| **Market** | College clubs don't see ₹3,999/semester as worth it | Offer time-limited free pilots to 3-5 target colleges. Demonstrate git-native submission as the differentiator in live demos. Convert after first successful hackathon |
| **Market** | Organizers resist git-tag submissions (unfamiliar workflow) | Pre-hackathon onboarding documentation. "Test submission" workflow before hackathon goes active. Participant site includes tag push instructions |
| **Resource** | Team of 5 can't deliver Platform MVP in target timeline | Hackathon cloning, analytics, CSV/PDF export, and custom domains are explicitly "should have, won't block launch." Drop to Phase 2 if timeline pressure builds |

## Functional Requirements

> **Capability Contract:** Every feature in DevSage must trace to a functional requirement below. Capabilities not listed here will not exist in the final product. UX designers will design for these capabilities, architects will support them, and epic breakdowns will implement them.

### Identity & Access

- **FR1:** User can sign up and log in via GitHub OAuth
- **FR2:** User can sign up and log in via Google OAuth
- **FR3:** User can sign up and log in via email and password with OTP-based two-factor authentication
- **FR4:** System maintains user sessions using dual-token authentication (short-lived access token + rotating refresh token stored in secure, non-JavaScript-accessible browser cookies)
- **FR5:** User can log out, invalidating their current session
- **FR6:** User can initiate account deletion with a 30-day grace period before permanent removal
- **FR7:** System anonymizes deleted user data while preserving audit trail integrity with anonymized references
- **FR8:** User can export all personal data in downloadable format before account deletion
- **FR9:** Organizer can add co-organizers to a hackathon (Pro and Max tiers only)
- **FR10:** Co-organizer has all organizer capabilities except destructive actions (delete hackathon, transfer ownership, modify subscription settings)

### Workspace & Subscription

- **FR11:** User can create a workspace representing their organization
- **FR12:** Workspace owner can add and remove workspace members
- **FR13:** Workspace owner can subscribe to a tier (Starter, Pro, Max) for a semester period
- **FR14:** System enforces tier-specific limits on features (active hackathon count, co-organizer access, custom domains, audit logs, deadline reminders, participant site generation)
- **FR15:** System returns upgrade prompts when a tier-gated action is attempted on an insufficient plan
- **FR16:** Workspace configuration persists independently of individual member accounts for leadership continuity
- **FR17:** System isolates all workspace data with no cross-workspace visibility of teams, submissions, scores, or analytics

### Hackathon Lifecycle

- **FR18:** Organizer can submit a hackathon creation request with event details to the platform admin queue
- **FR19:** Platform admin can approve, defer, or request additional information on a creation request
- **FR20:** Organizer can configure hackathon settings including name, description, tracks, team size limits, and registration type (open or invite-only)
- **FR21:** Hackathon progresses through defined lifecycle states: draft → active → judging → completed → archived
- **FR22:** System enforces forward-only state transitions with the single exception of un-archiving (archived → completed) for score corrections
- **FR23:** Organizer can configure multiple rounds with per-round deadlines, tag patterns, and rubrics
- **FR24:** Organizer can extend or shorten deadlines with automatic notification to all participants showing old and new deadlines
- **FR25:** Organizer can clone a previous hackathon's configuration to create a new event
- **FR26:** Organizer can configure elimination thresholds between rounds

### Team & Participation

- **FR27:** Participant can create a team within a hackathon
- **FR28:** Team lead can generate invite codes for team membership
- **FR29:** Participant can join a team using an invite code
- **FR30:** Team lead can link a GitHub repository to the team via GitHub App installation
- **FR31:** System enforces team size limits configured by the organizer
- **FR32:** System prevents a participant from joining multiple teams within the same hackathon
- **FR33:** System restricts team membership changes after the submission deadline

### Submission Pipeline

- **FR34:** System receives and processes GitHub webhook events triggered by git tag pushes matching configured tag patterns
- **FR35:** System verifies webhook authenticity via cryptographic signature verification and rejects payloads older than 5 minutes
- **FR36:** System creates timestamped submission records from verified tag events using server-side receipt time (not git tag timestamp)
- **FR37:** System detects and flags late submissions received after the round or hackathon deadline
- **FR38:** Team lead can mark a submission as the final submission for a round
- **FR39:** System processes submissions idempotently — duplicate webhook deliveries produce no duplicate records
- **FR40:** System queues unprocessable webhooks in a dead-letter queue with alerting
- **FR41:** Organizer can trigger manual submission reconciliation by comparing GitHub repository tags against existing submission records
- **FR42:** System detects and logs force pushes with before/after SHAs and pusher identity
- **FR43:** System flags tag deletions on previously submitted tags for organizer review

### Judging & Scoring

- **FR44:** Organizer can create scoring rubrics with weighted criteria, configurable per round
- **FR45:** Organizer can invite judges via email to a specific hackathon and round
- **FR46:** Judge can accept a judging invitation via one-click email link
- **FR47:** System auto-assigns submissions to judges using balanced distribution ensuring no judge receives more than ±1 submission compared to any other judge
- **FR48:** Organizer can manually reassign submissions between judges
- **FR49:** Judge can score submissions against all rubric criteria with per-criterion comments
- **FR50:** Judge can save scoring progress as a draft and return across multiple sessions to complete
- **FR51:** System enforces all-criteria-required scoring — partial scoring remains in draft state, not finalized
- **FR52:** Organizer can monitor real-time judge completion progress per round with percentage tracking
- **FR53:** System eliminates teams below configurable score thresholds between rounds
- **FR54:** System generates leaderboard rankings from finalized scores
- **FR55:** Organizer can control leaderboard visibility (public, participants-only, hidden)
- **FR56:** Organizer can freeze the leaderboard before official result announcement
- **FR57:** System supports track-specific, round-specific, and cumulative leaderboard views
- **FR58:** Judge can self-declare conflict of interest with an assigned submission, triggering organizer review
- **FR59:** System flags scoring patterns where a judge's average score deviates more than 2 standard deviations from the mean of all judges, or where a judge gives identical scores to ≥80% of submissions, for organizer review

### Platform Administration

- **FR60:** Platform admin can view and manage the hackathon creation request queue with filtering and sorting
- **FR61:** Platform admin can monitor all active hackathons across the platform
- **FR62:** Platform admin can delegate request processing to other platform admins
- **FR63:** System enforces platform admin access as a separate privilege layer independent of per-hackathon roles
- **FR64:** Platform admin can view platform-wide audit logs

### Notifications

- **FR65:** System sends email notifications for judge invitations with one-click accept links
- **FR66:** System sends email confirmations when a submission is received
- **FR67:** System sends email reminders before approaching deadlines at configurable intervals
- **FR68:** System sends email notifications for round transitions and elimination results
- **FR69:** System sends email notifications when organizers change deadlines, showing old and new values
- **FR70:** Organizer can post announcements visible to all hackathon participants
- **FR71:** System sends OTP verification codes via email for email/password authentication

### Participant Sites

- **FR72:** System generates a standalone participant-facing website for each hackathon from a template
- **FR73:** Participant site displays hackathon information, schedule, rules, and submission instructions
- **FR74:** Participant site displays the public leaderboard when visibility settings allow
- **FR75:** Participant site displays team listings and registration status
- **FR76:** Participant site is deployed on a hackathon-specific subdomain
- **FR77:** Max-tier workspaces can configure custom domains for participant sites
- **FR78:** Spectators can view participant site content without authentication

### Audit & Compliance

- **FR79:** System logs all state-changing operations as audit events with cryptographic hash-chain integrity ensuring tamper detection
- **FR80:** Organizer can query audit logs scoped to their hackathon
- **FR81:** Platform admin can query audit logs across all hackathons
- **FR82:** Every audit event attributes the action to a specific actor type (user, bot, system, cron)
- **FR83:** System preserves audit records permanently, even after account deletion, using anonymized actor references
- **FR84:** System displays clear data collection consent notices at registration (DPDPA compliance)
- **FR85:** System stores all deadlines in UTC and displays them with timezone indicators
- **FR86:** Organizer can view analytics dashboards showing registration count, team formation rate, submission rate per round, judge completion progress, and final score distribution
- **FR87:** Organizer can export hackathon results in CSV and PDF formats
- **FR88:** Participant can view judge feedback and per-criterion scores on their submission when the organizer enables feedback visibility for that round

## Non-Functional Requirements

### Performance

| Metric | Target | Context |
|--------|--------|---------|
| Webhook processing pipeline (tag push → submission record visible) | p95 < 30 seconds | The SLA participants *feel*. Push a tag, switch to hackathon site, see the submission |
| Standard API reads (list teams, view scores, get hackathon) | p95 < 200ms | Edge-optimized single-query reads |
| API writes (create team, submit score, audit logging) | p95 < 500ms | Higher due to audit trail insertion + queue dispatch |
| Leaderboard refresh after score finalization | < 5 seconds | KV-cached, invalidated on score submission. Recalculation runs async via queue |
| Participant site first contentful paint | < 2 seconds | Static build + single API call for hackathon config |
| Platform app (organizer dashboard) page load | < 3 seconds | Multiple data fetches on load; client-side caching handles subsequent requests |
| Admin panel page load | < 5 seconds | Internal tool behind Zero Trust, used by team of 5 |

### Security

- **Authentication:** Dual-token system — 15-minute signed access token + 30-day rotating refresh token, both in secure non-JavaScript-accessible cookies with per-subdomain scoping
- **Webhook verification:** Cryptographic signature double-verification + 5-minute staleness rejection on all GitHub webhook payloads
- **Encryption at rest:** Infrastructure-level encryption (sufficient for threat model — no PCI or HIPAA data). Field-level encryption deferred to Enterprise tier
- **Encryption in transit:** TLS on all connections
- **Rate limiting:**

| Endpoint Category | Limit | Notes |
|-------------------|-------|-------|
| Authenticated API calls | 120 req/min per user | Sliding window |
| Anonymous API calls | 30 req/min per IP | |
| Auth endpoints (login, register, OTP) | 10 req/min per IP | Strictest — abuse targets |
| Webhook ingestion (verified GitHub IPs) | No rate limit | Cryptographic signature verification instead |
| Webhook ingestion (unknown sources) | 60 req/min | |
| Leaderboard reads (live events) | 300 req/min | Generous ceiling for judging window spikes |

- **429 responses:** Include `Retry-After` header. Limits tuned based on pilot usage
- **Secret rotation:** Manual rotation between semesters (natural break when no hackathons are live). Immediate rotation on suspected compromise. Automated rotation deferred to Phase 3 / Enterprise
- **Session concurrency:** Participants unlimited. Organizers limited to 2 concurrent sessions
- **Pre-commit secret scanning:** `secretlint` blocks commits with secrets. `gitleaks` in CI on every PR

### Reliability

- **Submission pipeline:** Zero silent loss guarantee. Every tag push that reaches the webhook endpoint must produce either a submission record OR a dead-letter queue entry with alerting. No event may be silently dropped
- **Idempotent processing:** Duplicate webhook deliveries must not create duplicate submissions. Enforced via `delivery_id` uniqueness
- **Dead-letter queue:** Unprocessable webhooks land in DLQ with alerting to operations team
- **Manual reconciliation:** Organizer-triggered comparison of GitHub repo tags vs. existing submissions as a safety net
- **Graceful degradation:** When GitHub API is unavailable, queue messages for later processing and show "submission pending verification" status
- **Audit trail integrity:** Hash-chained events are append-only and tamper-detectable

### Scalability

| Scenario | Year 1 Target | Year 2 Target |
|----------|---------------|---------------|
| Concurrent active hackathons | 10-15 | 50 |
| Concurrent deadline windows | 2-3 | 5-10 |
| Peak webhook burst (single hackathon, final 15 min) | ~120 events (~8/sec) | ~120 events |
| Peak webhook burst (multi-hackathon overlap) | ~250 events/15min | ~750 events/15min (~50/sec) |

- **Auto-scaling:** Entirely reliant on platform built-in auto-scaling. No manual capacity planning required for Year 1-2 volumes
- **Potential bottleneck:** Database write serialization. Mitigated by read-heavy access pattern
- **Future sharding:** Data model scoped by `hackathon_id`, enabling per-hackathon database sharding if needed
- **Durable Objects:** Single-threaded per hackathon. Non-issue because state transitions are organizer-initiated (handful per lifecycle)

### Integration

- **GitHub API rate limits:** 5,000 requests/hour per authenticated GitHub App installation. Monitor usage; alert when approaching limits during peak submission periods
- **GitHub webhook retry:** GitHub retries failed deliveries for up to 3 days. Handlers must be idempotent
- **GitHub API degradation:** Platform queues messages for later processing. Submission status shows "pending verification" rather than failing silently
- **Email/SMTP reliability:** Failed email sends retried with exponential backoff and logged for investigation
- **OAuth provider availability:** If Google or GitHub OAuth is temporarily unavailable, users with email/password credentials can still authenticate. OAuth-only users see clear error with retry guidance

### Accessibility

- **WCAG Level A:** All three frontend applications (admin, platform, web) must meet WCAG 2.1 Level A success criteria including keyboard navigation, alt text for images, proper heading hierarchy, and sufficient color contrast (4.5:1 minimum)
- **Screen reader compatibility:** All interactive elements must have accessible names and ARIA labels where semantic HTML is insufficient
- **Focus management:** Modal dialogs, page transitions, and dynamic content updates must manage focus appropriately for keyboard and assistive technology users
