# DevSage Team — Platform Admin User Flow

> Role: Platform Admin | Scope: Platform-wide | App: `shikdd.devsage.org` + CLI

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

When a Workspace Manager submits a hackathon creation request:

1. Request appears on the Admin Dashboard
2. Review basics (title, slug, dates, team sizes)
3. **Approve** or **reject with reason**
4. On approval (backend auto-creates):
   - Hackathon record in `draft` state under the workspace
   - Durable Object state machine initialized
   - Hackathon slug and IDs generated
   - Audit event logged
   - All backend connections ready (API routes, DO, queues, webhooks)
5. Dashboard shows a **CLI command** for frontend setup

### 3. Hackathon Frontend Deployment

After approving, copy the generated CLI command from the dashboard and run it locally.

**CLI Automated Steps** (`devsage-cli deploy-hackathon --hackathon-slug <slug> --workspace-slug <slug>`):

1. Clone hackathon frontend template repo
2. Rename folder to `{hackathon-slug}-{workspace-slug}`
3. Text-based edit across repo — replace placeholders (slugs, IDs, config, API origin)
4. Push to `SHIKDD-org` on GitHub
5. Deploy to Cloudflare Workers (Static Assets)
6. Set up subdomain: `{hackathon-slug}.{workspace-slug}.devsage.org`

**Manual Steps:**

1. Frontend design customization (branding, logos, colors, copy)
2. Sponsor content — add directly OR give Event Lead repo access (case-by-case)
3. Review & QA — verify frontend works end-to-end with backend
4. CORS origin update (if new subdomain/domain)
5. Custom domain setup (if applicable — CNAME-based)
6. Final deploy — push changes, redeploy
7. Notify Event Leads that frontend is live

### 4. Handoff to Event Leads

Once frontend is finalized:

- Event is ready for configuration
- Event Leads configure rounds, rubric, judges, settings on Platform
- Event Leads can change deadlines while in draft/active, postpone events
- Event Leads **cannot** modify the frontend — that stays with DevSage team

### 5. Ongoing Platform Management

Admin Dashboard provides:

- **Dashboard** — system-wide stats (users, hackathons, teams, submissions)
- **Users** — view/manage all users
- **Workspaces** — view all workspaces, drill into details, view members
- **Hackathons** — view all hackathons, admin-level detail, round management
- **Admins** — manage platform admin list (add/remove DevSage team members)
- **Invites** — manage pending invites
- **Audit** — trigger hash backfill for audit chain integrity

### 6. Intervention

Can step into any workspace or hackathon at any time to:

- Fix issues
- Override state transitions
- Manage invites or roles
- Debug webhook/submission pipeline problems
- Force-advance or rollback hackathon state

---

## CLI Summary

| Step | Automated | Manual |
|------|-----------|--------|
| Clone template repo | ✅ | — |
| Rename folder | ✅ | — |
| Replace placeholders | ✅ | — |
| Push to GitHub | ✅ | — |
| Deploy to Cloudflare Workers | ✅ | — |
| Set up subdomain | ✅ | — |
| Frontend design customization | — | ✅ |
| Sponsor content | — | ✅ |
| Review & QA | — | ✅ |
| CORS origin update | — | ✅ |
| Custom domain setup | — | ✅ |
| Final deploy | — | ✅ |
| Notify event leads | — | ✅ |

---

## Admin Dashboard Routes

| Route | Purpose |
|-------|---------|
| `/` | System stats dashboard |
| `/users` | All users management |
| `/workspaces` | All workspaces |
| `/workspaces/:id` | Workspace detail |
| `/hackathons` | All hackathons + request review |
| `/hackathons/:id` | Hackathon admin detail |
| `/admins` | Platform admin management |
| `/invites` | Invite management |
| `/profile` | Admin profile |

---

## Permissions

Has **unrestricted access** to everything. All actions available to Owners, Managers, and Event Leads are also available to Platform Admins.
