# DevSage Team — Platform Admin User Flow

> Role: Platform Admin (`platform_admins` table) | Scope: Platform-wide | App: `shikdd.devsage.org`

---

## Who

DevSage's own team. Unrestricted access across the entire platform — can do everything any other role can do, plus platform-level operations.

---

## Responsibilities

### 1. Workspace Provisioning

1. College/club reaches out (or DevSage does outreach)
2. Log into Admin Dashboard (`shikdd.devsage.org`)
3. Create a new workspace (name, slug, type)
4. Invite club president(s) as **Workspace Owner** via email
5. Monitor invite acceptance

### 2. Hackathon Request Review

When a Workspace Owner or Admin submits a hackathon creation request:

1. Request appears on the Admin Dashboard
2. Review basics (title, slug, dates, team sizes)
3. **Approve** or **reject with reason**
4. On approval (backend auto-creates):
   - Hackathon record in `draft` state under the workspace
   - Durable Object state machine initialized
   - Hackathon slug and IDs generated
   - Audit event logged
   - Hackathon page available at `devsage.org/hackathons/:slug`

### 3. Hackathon Theming (Initial Setup)

After approval, Platform Admin sets the initial branding via the admin panel:

1. Upload logo and set brand colors
2. Configure sponsor content
3. Review & QA — verify hackathon page renders correctly with dynamic theming
4. Custom domain setup (optional — CNAME-based)
5. CORS origin update (if custom domain is needed)
6. Notify Event Leads that the hackathon is ready for configuration

> After handoff, Event Leads can adjust theming (logo, colors, copy) through the Platform app. Platform Admin retains ownership of custom domain and CORS config.

### 4. Handoff to Event Leads

Once theming is finalized:

- Event is ready for configuration
- Event Leads configure rounds, rubric, judges, settings on Platform
- Event Leads can change deadlines while in draft/active, postpone events

### 5. Ongoing Platform Management

Admin Dashboard provides:

- **Dashboard** — system-wide stats (users, hackathons, teams, submissions)
- **Users** — view/manage all users
- **Workspaces** — view all workspaces, drill into details, view members
- **Hackathons** — view all hackathons, admin-level detail, round management
- **Admins** — manage platform admin list (add/remove DevSage team members)
- **Invites** — manage pending invites
- **Requests** — hackathon request review pipeline
- **Audit** — trigger hash backfill for audit chain integrity. Backfill is needed when audit events were inserted without hash chaining (e.g., during bulk imports or after a bug). It retroactively computes SHA-256 hashes to restore the chain. If the chain is broken (gap or tampered record), the backfill flags affected events

### 6. Intervention

Can step into any workspace or hackathon at any time to:

- Fix issues
- Override state transitions
- Manage invites or roles
- Debug webhook/submission pipeline problems — includes viewing and replaying dead-letter queue messages
- Force-advance or rollback hackathon state (exceptional cases only — e.g., reverting a premature state transition)

---

## Admin Dashboard Routes

| Route | Purpose |
|-------|---------|
| `/` | System stats dashboard |
| `/users` | All users management |
| `/workspaces` | All workspaces |
| `/workspaces/:id` | Workspace detail |
| `/hackathons` | All hackathons |
| `/hackathons/:id` | Hackathon admin detail |
| `/hackathon-requests` | Hackathon request review pipeline |
| `/admins` | Platform admin management |
| `/invites` | Invite management |
| `/profile` | Admin profile |

---

## Permissions

Has **unrestricted access** to everything. All actions available to Owners, Admins, and Event Leads are also available to Platform Admins.

Additionally:

- **Account deletion requests** — process user data deletion requests. Personal data is purged; audit trail entries and anonymized hackathon records (submissions, scores) are retained for integrity
- **Data export** — can export workspace or hackathon data on request (for institutional compliance)
