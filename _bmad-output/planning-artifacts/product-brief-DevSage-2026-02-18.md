---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
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
date: 2026-02-18
author: Srijan
---

# Product Brief: DevSage

## Executive Summary

DevSage is a full-stack hackathon management platform purpose-built for universities, coding bootcamps, and corporate innovation teams. It replaces the fragmented toolchain of spreadsheets, Google Forms, paper-based judging, and manual score tallying with a single, branded, end-to-end system that covers the entire hackathon lifecycle — from workspace creation and team formation through Git-native submissions, multi-round elimination judging with weighted rubrics, and tamper-proof results publication.

The platform's core conviction is that hackathons are not events to be listed on a marketplace — they are **institutional workflows** that deserve the same rigor, accountability, and automation as any other academic or corporate process. This opinion shapes every architectural decision: submissions happen through Git tags in the developer's natural workflow, not through upload forms; each hackathon gets its own branded deployment on a unique subdomain, not a page on someone else's directory; and every action is recorded in a hash-chained, tamper-proof audit trail designed for institutional accountability.

DevSage is offered as a semester-based SaaS subscription priced in INR (₹3,999–₹9,999/semester), targeting the massive and underserved Indian university hackathon market — thousands of colleges running events every semester with no dedicated tooling. The platform is built edge-native on Cloudflare Workers for global performance, zero ops overhead, and cost-efficient scaling.

---

## Core Vision

### Problem Statement

Running a hackathon today is an exercise in duct-taping disconnected tools. Organizers juggle Google Forms for registration, spreadsheets for team tracking, WhatsApp for communication, and manual data entry for scorekeeping. Judges score on paper and pen. Participants fill out generic forms that do nothing to convey professionalism or build excitement. Organizers then spend hours transcribing paper scores into Excel, cross-referencing timestamps, and chasing judges who haven't finished scoring.

The result is a universally bad experience for everyone involved:

- **Organizers** spend more time on logistics than on decision-making — the part that actually matters
- **Judges** struggle with unstructured scoring processes, broken spreadsheet formulas, and no visibility into what they've scored versus what's pending
- **Participants** encounter generic, unbranded interfaces that undermine the credibility and excitement of the event
- **Institutions** have no auditable record of results, making it impossible to defend scoring decisions when disputes arise

### Problem Impact

For Indian universities and coding bootcamps — where hackathons often carry academic credit, offer substantial prizes, or serve as recruitment funnels — the lack of dedicated tooling creates real institutional risk. Disputed results with no audit trail, lost submissions due to manual processes, inconsistent scoring across judges, and the reputational cost of running an event that looks cobbled together on Google products.

The problem scales with frequency: organizations that run multiple hackathons per semester (student coding clubs, innovation labs) feel this pain repeatedly and have no way to carry forward learnings, templates, or configurations from one event to the next.

### Why Existing Solutions Fall Short

Existing platforms like Devpost, HackerEarth, and MLH tools are fundamentally **glorified Google Forms** — they handle registration and project showcasing, but they don't address the full hackathon lifecycle. Specifically:

- **Submissions are upload-based**, disconnected from the actual development workflow. Participants paste GitHub links into text fields or upload zip files. There's no cryptographic proof of what was submitted and when, no commit history tracking, and no force-push detection.
- **No multi-round elimination support.** Most platforms treat a hackathon as a single-submission, single-score event. They can't handle the round-by-round elimination flow with different rubrics, different deadlines, and progressive team filtering that serious academic hackathons require.
- **No per-event branding.** Hackathons are listed on the platform's marketplace alongside unrelated events. There's no dedicated subdomain, no custom domain support, no workspace-level branding. The platform's brand competes with the organizer's brand.
- **No institutional accountability.** No hash-chained audit trails, no tamper-proof scoring records, no role-based access controls designed for academic integrity.
- **No localized pricing.** International SaaS pricing is prohibitive for Indian student organizations and department budgets.

### Proposed Solution

DevSage provides end-to-end hackathon lifecycle management where the organizer's job becomes purely **decision-making** — who to invite, what criteria to score on, who to disqualify — while the platform handles every piece of **logistics** automatically:

1. **Git-Native Submissions:** Teams push Git tags to their repositories; submissions are created automatically via GitHub webhooks, tied to exact commit SHAs. No upload forms. No browser context-switching. The platform watches the developer's natural workflow and turns it into structured, auditable, scored data.

2. **Branded Per-Hackathon Sites:** Each hackathon gets a deployed application on its own subdomain (or custom domain) — the organizer's logo, their colors, their sponsors, zero design work needed. No "Powered by [Platform]" footer. No competing brand presence.

3. **Full Lifecycle State Machine:** A Durable Object-enforced state machine (draft → active → judging → completed → archived) ensures hackathons progress through valid states with submission locking, deadline enforcement, and automated notifications at every transition.

4. **Multi-Round Elimination Judging:** Configurable rounds with round-specific tag patterns, rubrics, and deadlines. Weighted scoring with automatic leaderboard computation. Judge assignment, progress tracking, and deadline nudging — all automated.

5. **Institutional-Grade Audit Trail:** Every action hash-chained with SHA-256 for tamper detection. Cryptographic proof of submissions, scores, disqualifications, and state transitions. Designed for institutions that need to defend results.

6. **Workspace-Based Organization:** Workspaces for departments/clubs with role hierarchies, member management, branding defaults, and hackathon cloning — so running the next semester's hackathon takes 5 minutes, not 5 hours.

### Key Differentiators

| Differentiator | Why It Matters | Why It's Hard to Copy |
|---|---|---|
| **Git-native submissions via webhooks** | Submissions are tied to real commits, not pasted links. Force-push detection, commit tracking, and cryptographic proof of submission timing come free. | Requires rebuilding the submission model from the ground up — can't be bolted onto an upload-based system. |
| **Per-hackathon branded deployments** | Each event is a standalone application on its own subdomain/custom domain. No marketplace. No competing branding. | Requires template cloning pipeline, per-event deployment infrastructure, SSL provisioning — operational complexity most platforms won't take on. |
| **Institutional accountability (audit trail)** | Hash-chained, tamper-proof records of every action. Critical when hackathons carry academic credit or prizes are disputed. | Not just a feature — it's an architectural pattern (append-only with hash chaining) that must be designed in from the start. |
| **Full lifecycle ownership with elimination rounds** | Covers workspace → hackathon → rounds → teams → submissions → scoring → results. Multi-round elimination with round-specific rubrics. | Competitors handle parts of this well but not the entire pipeline, especially not the rounds-with-elimination flow. |
| **Indian market first (INR pricing, semester-based)** | ₹3,999–₹9,999/semester is accessible for student clubs and department budgets. First mover in a massive, underserved market. | First-mover advantage in a market where relationships and trust with institutions matter as much as features. |

**The core unfair advantage:** DevSage's *opinion* — that hackathons are institutional workflows, not marketplace listings — shapes every decision. A competitor would need to simultaneously integrate deeply with GitHub's event system, operate per-event deployment infrastructure, build institutional-grade access controls, and price for the Indian education market. That's a lot of simultaneous bets no one in the space is currently positioned to make.

---

## Target Users

### Primary Users

**1. Participants (Volume User — "The Growth Engine")**

> **Persona: Priya, 20, second-year CS at a mid-tier Indian engineering college.**
> Three-person team, codes in Python, has used Git for coursework (clone/push/pull) but never tagged. Heard about the hackathon through a WhatsApp group, signed in with GitHub in one tap, joined her team via invite code in 10 seconds.

- **Motivation:** Proving herself, building portfolio projects, not feeling lost in the process
- **Current pain:** Clunky forms, confusing submission processes, no visibility into scoring — platforms that make her feel stupid
- **Success vision:** Push a git tag from terminal → submission confirmation appears instantly on the hackathon site. No forms, no uploads, no copy-pasting links. The platform watches her natural workflow and turns it into structured, scored data.
- **Conversion moment:** When she pushes `git tag submission_v1 && git push origin --tags` and sees confirmation appear within seconds. Something she did in her terminal showed up on a website instantly.
- **Strategic importance:** 200:1 ratio vs organizers. The word-of-mouth engine. Today's participant is tomorrow's organizer — the participant-to-organizer pipeline is the growth engine.

**2. Organizers (The Buyer-User — "From Spreadsheet Janitor to Hackathon Director")**

> **Persona: Arjun, 21, third-year CS, Technical Secretary of CodeCraft (college coding club).** Club has ~60 members, runs 2 hackathons per semester. Faculty advisor approves budget, but Arjun does everything — coordinates through WhatsApp with 8 volunteers.

- **Motivation:** Looking competent in front of faculty, building resume credentials, not getting publicly embarrassed by broken results
- **Current pain:** ~40 hours of logistics across a 3-day hackathon. Google Forms for registration (manual dedup, timestamp disputes), broken GitHub links in submission forms, shared Google Sheets for judging (accidental overwrites, broken formulas, missing scores discovered morning-of-results), public corrections to results. He doesn't want to build infrastructure — he wants to *use* infrastructure that makes his club look professional.
- **Success vision:** Configure hackathon in 15 minutes → branded site goes live at `codecraft-spring-hack.devsage.org` → teams form, repos link, submissions roll in automatically — zero spreadsheets. After judging, exports branded PDF leaderboard for faculty. "I didn't build this — I configured it in 15 minutes."
- **Conversion moment:** When the first 20 teams register without him touching anything. No WhatsApp messages asking "how do I register?" — the dashboard shows teams forming, repos linking, invite codes working, all autonomously.

**3. Judges (The Reluctant User — "A Task List That Shrinks to Zero")**

> **Persona: Nikhil, 28, software engineer at a Bangalore startup.** Judges because a student club president cold-emailed him on LinkedIn promising "it'll only take an hour." Doing this as a favor, mildly resents how long it actually takes.

- **Motivation:** Genuine desire to give back to student community, but zero tolerance for wasted time. His goodwill has a hard limit.
- **Current pain:** Google Sheet with 25 tabs, broken GitHub links requiring access requests, no progress tracking, accidental score overwrites, 4 hours spread across 2 days for what should be 90 minutes. Tells himself he's never doing this again. (Says this every time.)
- **Success vision:** Email invitation → one click to accept → 12 assignments with verified repos → score slider + optional comment per criterion → progress bar showing "4/12 completed" → pick up where he left off next session. Total: 70 minutes across two sessions. No WhatsApp. No broken links. He'd actually do this again.
- **Conversion moment:** No traditional adoption — he's transactional. But when he finishes in 70 minutes instead of 4 hours, his objection drops from "ugh, last time was a nightmare" to "sure, if it's on that same platform." Becomes a **low-resistance repeat judge** — solving one of organizers' biggest problems.
- **Design principle:** Nikhil doesn't care about DevSage. He wants a task list that shrinks to zero. The best judge experience is one where he never thinks about the tool — he thinks about the code he's evaluating.

### Secondary Users

**4. Platform Admins (SHIKDD Team — "The Throughput Bottleneck")**

> **Persona: Srijan and 1-2 trusted team members.** The founding team wearing an admin hat, not a large ops team.

- **Day-to-day:** Review hackathon creation requests on shikdd.devsage.org → approve → draft auto-creates → fine-tune settings → mark "Ready" → hand over. Also maintains per-hackathon frontend templates.
- **Primary risk:** Becoming a bottleneck in the hackathon approval pipeline. Semester starts are predictable (August/January) — three clubs requesting in the same week means delays breed frustration.
- **Obsession metric:** Throughput — how many hackathons can you spin up per week without quality dropping.
- **Future consideration:** Whether manual approval stays or becomes partially self-service for trusted workspaces (TBD business logic).

**5. Spectators (The Distribution Channel — "30-Second Billboards")**

> **Persona: Meera, 19, first-year at Arjun's college.** Not participating — just curious. Tapped a leaderboard link from a senior's Instagram story.

- **Interaction:** 30 seconds. Lands on `codecraft-spring-hack.devsage.org`, sees polished branded site with live rankings. Screenshots leaderboard to her friend group: "we should do this next semester." No login. No registration.
- **Value:** Purely distribution. Every public-facing page on a per-hackathon frontend is a marketing surface you don't pay for. She doesn't remember the name DevSage — she remembers the *experience*. That's enough.
- **Conversion path:** Doesn't convert now — she *seeds*. Six months later on the organizing committee, when someone says "let's use Google Forms," she says "wait, remember that hackathon site CodeCraft had?"

**6. The Buyer (Distinct from Organizer)**

Three archetypes depending on context:

| Buyer | Context | Cares About | Decision Input |
|---|---|---|---|
| **Prof. Sharma** (faculty advisor) | Most common. Controls club's departmental budget. | Professional appearance, exportable results for department records, defensible audit trail if students complain. Never logs into the platform — judges DevSage by the PDF export and zero complaints. | Arjun's pitch + post-hackathon results |
| **Dean/HoD** | Larger institutional subscriptions, multiple clubs sharing one workspace. | Cost justification across multiple events per semester. "Unlimited hackathons" model. | ROI across department |
| **Arjun himself** | Smaller clubs with independent budgets (sponsor money, student fees). | ₹3,999 from club treasury — easy sell pointing to last semester's Google Forms disaster. | His own pain |

**Key insight:** The *messaging* targets Arjun (pain of logistics, "never use spreadsheets again"). The *justification materials* target Prof. Sharma (audit trails, branded exports, institutional credibility). Same product, two pitches.

### User Journey

**The Self-Reinforcing Flywheel:**

```
Spectator sees branded site → becomes Participant → has great experience
→ becomes Organizer → picks DevSage → creates new Spectators
```

Every branded subdomain is a billboard. The product markets itself through the hackathons it powers.

**Discovery Channels by User:**

| User | Primary Discovery | Secondary | Tertiary |
|---|---|---|---|
| Organizer (Arjun) | Word of mouth between club presidents — "what platform is this?" | Google search (though most don't know the category exists) | Direct outreach to clubs (Instagram, LinkedIn, tech fests) |
| Participant (Priya) | WhatsApp/Instagram link from organizer — zero awareness of "DevSage" as a product | — | — |
| Judge (Nikhil) | Email invitation from DevSage on behalf of organizer — 100% inbound | — | — |
| Buyer (Prof. Sharma) | Through Arjun's pitch + devsage.org legitimacy check | — | — |
| Spectator (Meera) | Instagram story, leaderboard link, friend's share | — | — |

---

## Success Metrics

### North Star Metric

**Organizer support requests during an active hackathon → trending to zero.**

If that number is zero, it means participants figured it out, judges are progressing, submissions are flowing, and the platform is invisible. That's the entire product thesis validated in a single number.

### User Success Metrics

| Persona | Leading Indicator | Core Indicator | Lagging Indicator |
|---|---|---|---|
| **Priya** (Participant) | Registered → team → repo linked in <3 min, zero support messages | Submitted via git tag without asking anyone how | Participated in a second hackathon on DevSage |
| **Arjun** (Organizer) | Hackathon configured and published in <30 min | Zero WhatsApp messages from participants asking "how do I submit" | Renewed next semester without being asked; recommended to another club |
| **Nikhil** (Judge) | Accepted invite within 24 hours | Scored all assignments in one calendar day, <90 min active time | Said yes to judging the next hackathon |
| **Prof. Sharma** (Buyer) | Approved subscription after one pitch | No student complaints escalated to him during hackathon | Proactively asks "are we using that platform again?" |
| **Srijan** (Platform Admin) | Request → handed over in <48 hours | Zero clubs waiting >3 days during peak weeks | Hackathons-per-admin-hour ratio improving |
| **Meera** (Spectator) | Visited hackathon site, viewed leaderboard | — | Showed up as participant or organizer in a future hackathon |

### Business Objectives

**3-Month Milestone: Prove, Don't Scale**

- 5–8 pilot colleges running real hackathons (mix of tier-2 private + 1–2 reach targets at NIT/IIIT level)
- At least 3 hackathons run end-to-end without manual intervention
- At least 1 organizer returns for a second hackathon unprompted
- At least 1 participant-turned-organizer signs up a new workspace
- Revenue is almost irrelevant at this stage — validation is the goal

**The 3-month proof question:** Can 5 hackathons run end-to-end without you being in the WhatsApp group firefighting? If yes, everything else follows. If not, no amount of growth strategy matters.

**12-Month Milestone: The Semester Proof**

Two full semester cycles (Aug–Dec, Jan–May):

- 30–50 paying workspaces across colleges
- 100+ hackathons completed on the platform
- ₹2–3 lakh ARR (modest but proving willingness to pay)
- At least 5 workspaces renewed for second semester without discounts or hand-holding
- Renewal rate above 70% = product-market fit. Below 50% = fundamental problem.

### Key Performance Indicators

**Growth KPIs:**

| KPI | Target | Why It Matters |
|---|---|---|
| Organic workspace creation rate | >30% of new signups by month 12 | Proves the flywheel: participant → organizer pipeline. If above 30%, product is self-distributing and CAC drops toward zero. |
| Hackathons per workspace per semester | >1.5 | Validates "unlimited hackathons" pricing model — clubs running multiple events |
| Cross-college exposure | Growing quarter-over-quarter | Measures network spread — how many unique colleges had participants at *other* colleges' hackathons |
| Semester-over-semester renewal rate | >80% | The ultimate retention signal. Acquisition can be forced; renewal means real value delivered. |

**Operational KPIs:**

| KPI | Target | Why It Matters |
|---|---|---|
| Participant support requests per hackathon | Trending → 0 | Product is self-explanatory; platform is invisible |
| Time from "got the link" to "on a team with linked repo" | <3 minutes | Onboarding friction is the first conversion gate |
| Judge scoring completion rate | >95% without organizer intervention | Judges are the bottleneck — high completion = no stalled hackathons |
| Hackathon request → handover time | <48 hours | Admin throughput — prevents bottleneck at scale |

**Unit Economics (Real but Premature):**

- Infrastructure cost per hackathon: single-digit rupees (Cloudflare free tiers / near-zero marginal cost)
- LTV of a workspace (4-semester retention, Tier 2): ~₹28,000
- LTV risk: Not product quality — **institutional memory**. Annual club leadership turnover means the champion (Arjun) graduates. The workspace must be embedded at the *club* level, not the individual level. Mitigation: multiple admins, hackathon templates from previous semesters, workspace-level (not person-level) onboarding.

---

## MVP Scope

### Core Features (Pilot-Ready)

**Arjun's Critical Path — must work flawlessly:**

1. **Auth:** Google OAuth (organizer/platform), GitHub OAuth (participant/web)
2. **Workspace + Hackathon CRUD:** Create workspace → create hackathon with basic config (team size, deadline, tag pattern) → publish (draft → active)
3. **Team Formation:** Participants create/join teams via invite codes, link GitHub repos
4. **Webhook Pipeline (the hard one):** Git tag push → GitHub webhook → queue → submission created automatically with correct timestamp, commit SHA, and late detection
5. **Single-Round Judging:** Organizer invites judges → judges accept in one click → score all assigned submissions against weighted rubric criteria → leaderboard computes correctly (per-judge weighted sum → cross-judge average)
6. **State Machine:** Durable Object enforces transitions (draft → active → judging → completed), locks submissions during judging phase transition
7. **CSV Export:** Organizer exports correct results for Prof. Sharma

**Can have rough edges in pilot:**

- Dashboard analytics (raw numbers fine, charts can wait)
- Notification emails (in-app sufficient, email can be flaky)
- Per-hackathon frontend design polish (functional > beautiful)
- Audit trail UI (data logged, pretty activity feed is post-MVP)
- Announcement targeting (broadcast-to-all is fine, per-track/per-team targeting is post-MVP)

### Out of Scope for MVP

| Feature | Why It's Deferred |
|---|---|
| Multi-round elimination judging | Massive complexity to judging flow; pilot hackathons are single-round |
| Custom domains | Subdomain works fine; SSL provisioning is ops overhead for zero pilot value |
| Hackathon cloning/templates | Need to run one hackathon before cloning matters |
| Invite-only registration with Excel upload | Open registration is simpler for pilot |
| Hackathon creation request workflow | For pilot, Srijan creates hackathons directly; the full Submitted → Approved → Building pipeline is for scale |
| Subscription tier enforcement | Everyone gets full features during pilot; tier gating is monetization, not validation |
| GDPR account deletion flow | Important but not blocking a pilot |
| ETag concurrent edit protection | One organizer per pilot hackathon — conflicts won't happen |
| Email/password auth with OTP 2FA | OAuth only for pilot; email/password fallback adds complexity |

### MVP Success Criteria

**Two-stage validation gate:**

**Stage A — Internal Dogfood (1–2 weeks):**
SHIKDD team runs a fake hackathon end-to-end. 5–10 people, real GitHub repos, real tag pushes, real judging. The checklist:

- [ ] Someone goes from "got the link" to "on a team with linked repo" without asking how
- [ ] 10 tag pushes across 5 teams all create correct submissions with correct timestamps
- [ ] One late submission gets flagged correctly
- [ ] Two judges score everything and leaderboard math checks out
- [ ] Organizer exports a CSV that's actually correct

If any fail → fix → run again. **Do not proceed to Stage B.**

**Stage B — One Friendly College (2–4 weeks):**
One club president you personally know. Small hackathon — 30–50 participants, 10–15 teams. You sit in their WhatsApp group (read-only) during the event.

**The success gate: you didn't have to intervene.** Not "you helped a little" — you literally didn't need to message anyone to fix anything. If Arjun had to DM you to unbreak something mid-hackathon, that's a fail. Go back, fix, try with a second college.

Only after Stage B passes → open to 5–8 pilot colleges. Skipping Stage A is how you embarrass yourself. Skipping Stage B is how you embarrass someone else.

### Future Vision

**Year 1–2: Deepen Hackathons**
- Multi-round elimination with round-specific rubrics and deadlines
- Custom domains for per-hackathon sites
- Hackathon templates and cloning (run next semester's event in 5 minutes)
- Tier-differentiated features and pricing enforcement
- Self-service hackathon creation for trusted workspaces (remove admin bottleneck)

**Year 2–3: Adjacent Event Types**
- **Coding contests:** Individual-based, timed submissions, automated test-case evaluation. Git submission model still works — push tag, tests run automatically.
- **Project showcases / capstone evaluations:** Semester-long projects with milestone submissions (Round 1 = proposal, Round 2 = mid-review, Round 3 = final demo). Multi-round hackathons stretched over months — architecture already supports this.
- **Placement-linked events:** Companies sponsor hackathons and access the leaderboard as a recruitment pipeline. Top 10 teams get interview invites. This is where serious revenue lives — B2B sponsorship pricing is 10–50x what a college club pays.

**Year 3+: The Ambitious Play — DevSage as the Technical Skills Transcript**
- DevSage becomes the **verifiable credential layer for technical skills**. Priya participated in 6 hackathons, placed top 10 in 3, her submission history shows consistent Git activity and judge-validated code quality. That's a verifiable technical portfolio — more meaningful than a resume bullet point.
- If DevSage can issue verifiable credentials ("Priya scored in the 90th percentile across 3 judged hackathons"), it becomes a placement platform companies actually trust because the data is auditable and tamper-proof.

**Excited-about features (long-term):**
- Automated code evaluation alongside rubric judging (run test suites against submissions)
- Cross-college leaderboards — anonymous aggregate rankings across all DevSage hackathons (opt-in)
- Sponsor dashboard — companies pay to access anonymized talent data from hackathons they sponsor

**But right now:** The only thing that matters is whether Arjun can run one hackathon without DMing you at midnight.
