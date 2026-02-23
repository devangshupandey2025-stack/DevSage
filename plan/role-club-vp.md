# Club VPs — Workspace Manager User Flow

> Role: Workspace Manager | Scope: Workspace | App: `platform.devsage.org` | Count: Many per workspace

---

## Who

Club Vice Presidents. Responsible for requesting hackathons and staffing them with Event Leads. Has full hackathon access but delegates day-to-day operations to Event Leads.

---

## Flow

### 1. Onboarding

1. Receive invite email from Workspace Owner (club president)
2. Click invite link → land on `platform.devsage.org`
3. Sign up or log in (Google OAuth or email/password with OTP 2FA)
4. Accept workspace invite → now has access to the workspace

### 2. Hackathon Request

1. Log into Platform, navigate to workspace
2. Submit a **Hackathon Creation Request** with basics:
   - Title, slug, description, rules
   - Dates (start, judging start/end)
   - Team size limits
3. Request enters a review pipeline with **Amazon-style package tracking**:
   - `submitted → under_review → approved / rejected`
4. Track request status on the Platform
5. Platform Admin reviews and approves/rejects from Admin Dashboard

### 3. On Approval

When the hackathon request is approved:

- Hackathon is created in **`draft`** state
- Durable Object state machine is initialized
- Audit event logged
- DevSage team handles frontend deployment (CLI + manual design)

### 4. Hackathon Staffing

1. Invite **Event Leads** (typically 2 student coordinators) onto the approved hackathon
2. Event Leads receive invite, accept
3. Both Event Leads have **equal, identical permissions** on the hackathon
4. Manager's primary operational job is done — Event Leads take over day-to-day

### 5. Ongoing Access

Manager retains **full access** to all hackathons in the workspace:

- View hackathon analytics
- Configure hackathons (can, but delegates to Event Leads)
- Monitor teams, submissions, scoring
- Transition states, publish results (can, but delegates)

---

## Permissions

| Action | Access |
|--------|--------|
| Submit hackathon request | ✅ Primary responsibility |
| Invite event leads | ✅ Primary responsibility |
| View hackathon analytics | ✅ |
| Configure hackathon | ✅* |
| Manage rounds & rubric | ✅* |
| Invite judges (invite link or create account) | ✅* |
| Transition hackathon state | ✅* |
| Monitor teams & submissions | ✅* |
| Assign judges to submissions | ✅* |
| Publish results | ✅* |
| Select advancing teams (elimination rounds) | ✅* |
| Billing & plan | ❌ (Owner only) |
| Invite managers | ❌ (Owner only) |

> **✅*** = Has full access but is not expected to perform these day-to-day. Delegates to Event Leads.

---

## Key Constraints

- Cannot manage billing or plans
- Cannot invite other Managers (only Owners can)
- Cannot approve/reject hackathon requests (only Platform Admin can)
- Cannot create workspaces
