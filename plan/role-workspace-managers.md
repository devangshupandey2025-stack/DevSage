# Workspace Managers — Owner & Admin User Flows

> Roles: Workspace Owner (`owner`), Workspace Admin (`admin`) | Scope: Workspace | App: `platform.devsage.org`

---

## Who

| Role | Person | Primary Responsibility | Max Count |
|------|--------|----------------------|-----------|
| **Workspace Owner** | Club President | Billing, plan selection, invite admins | 2 per workspace |
| **Workspace Admin** | Club VP | Submit hackathon requests, invite event leads | Unlimited |

Both roles have full access to all hackathons in the workspace but delegate day-to-day operations downward.

> **DB roles:** `owner` and `admin` in the workspace membership table. These are workspace-scoped — separate from per-hackathon roles (`organizer`, `judge`, `leader`, `member`).

---

## Onboarding

### Owner

1. Receive invite email from DevSage Platform Admin
2. Click invite link → land on `platform.devsage.org`
3. Sign up or log in (Google OAuth or email/password)
4. Accept workspace invite → now has Owner access

### Admin

1. Receive invite email from Workspace Owner
2. Click invite link → land on `platform.devsage.org`
3. Sign up or log in (Google OAuth or email/password)
4. Accept workspace invite → now has Admin access

---

## Owner Flow

### 1. Workspace Setup

1. Log into Platform
2. Select billing plan for the workspace
3. Invite club VPs as **Workspace Admins**
4. Admins accept invite
5. Primary job is done — admins take over operations

### 2. Ongoing

- Billing management
- Oversight across all hackathons
- Can submit hackathon requests, invite event leads, and perform any Admin action — but delegates day-to-day

---

## Admin Flow

### 1. Hackathon Request

1. Navigate to workspace on Platform
2. Submit a **Hackathon Creation Request**:
   - Title, slug, description, rules
   - Dates (start, judging start/end)
   - Team size limits
3. Request enters review pipeline:
   - `submitted → under_review → approved / rejected`
4. Track request status on the Platform
5. Platform Admin reviews and approves/rejects

### 2. On Approval

- Hackathon is created in **`draft`** state
- Durable Object state machine is initialized
- Audit event logged
- Hackathon page available at `devsage.org/hackathons/:slug` with dynamic theming

### 3. Hackathon Staffing

1. Invite **Event Leads** onto the approved hackathon
2. Event Leads receive invite, accept
3. Admin's primary operational job is done — Event Leads take over day-to-day

### 4. Ongoing Access

Full access to all hackathons in the workspace:

- View hackathon analytics
- Configure hackathons (can, but delegates to Event Leads)
- Monitor teams, submissions, scoring
- Transition states, publish results (can, but delegates)

---

## Permissions

| Action | Owner | Admin |
|--------|-------|-------|
| Billing & plan | ✅ Primary | ❌ |
| Invite admins | ✅ Primary | ❌ |
| Submit hackathon request | ✅ | ✅ Primary |
| Invite event leads | ✅ | ✅ Primary |
| View hackathon analytics | ✅ | ✅ |
| Configure hackathon | ✅* | ✅* |
| Manage rounds & rubric | ✅* | ✅* |
| Invite judges | ✅* | ✅* |
| Transition hackathon state | ✅* | ✅* |
| Monitor teams & submissions | ✅* | ✅* |
| Assign judges to submissions | ✅* | ✅* |
| Publish results | ✅* | ✅* |
| Eliminate teams | ✅* | ✅* |
| Create workspaces | ❌ | ❌ |
| Approve hackathon requests | ❌ | ❌ |

> **✅*** = Has full access but delegates to Event Leads day-to-day.

---

## Key Constraints

- Cannot create workspaces (only Platform Admin can)
- Cannot approve/reject hackathon requests (only Platform Admin can)
- Owner: max 2 per workspace
- Admin: cannot manage billing or invite other admins
- Account deletion: users can request account deletion from their profile. Their personal data is removed but audit trail entries and anonymized submission/scoring records are retained for hackathon integrity
