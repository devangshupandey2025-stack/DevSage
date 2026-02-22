# DevSage — User Flows

> Complete user journeys for all 4 roles: Platform Admin, Organizer, Judge, and Participant.

---

## 1. Platform Admin (`shikdd.devsage.org`)

### Login & Dashboard
1. Login via Google OAuth (or email/password) → verified as platform admin
2. Dashboard shows system-wide stats: total users, hackathons, workspaces, submissions, pending requests count

### Hackathon Creation Requests
3. Navigate to **"Creation Requests"** → sees a queue sorted by newest first
4. Each request card shows: requesting workspace, proposed title, dates, timestamp, status
5. Click into a request → full detail view with everything the organizer submitted
6. **Review & Decide:**
   - **Approve** → status moves to `approved`, organizer notified
   - **Reject** → admin provides reason, status moves to `rejected`, organizer notified
   - **Request Changes** → status moves to `changes_requested`, organizer can resubmit
7. **Post-Approval Build Pipeline** — admin updates the request status through:
   - `submitted` → Request received, in queue
   - `under_review` → Admin is reviewing
   - `approved` → Cleared to proceed
   - `rejected` → Denied (with reason)
   - `changes_requested` → Modifications needed
   - `building` → Setting up hackathon resources
   - `ready` → Hackathon auto-created in `draft` state, organizer notified

### Other Admin Functions
8. Manage workspaces → browse all workspaces, drill into any
9. Manage users → paginated list of all users
10. Manage platform admins → add/remove admins
11. Manage invites → send organizer invites to onboard new clubs
12. Hackathon oversight → read-only view of any hackathon

---

## 2. Club / Individual Organizer (`platform.devsage.org`)

### Onboarding
1. Receives platform invite → signs up via Google OAuth → lands on dashboard
2. Creates workspace (club's home base, e.g., `ieee-vit`) or joins existing one
3. Invites co-organizers to the workspace

### Requesting a New Hackathon
4. Clicks **"Request New Hackathon"** on dashboard
5. Fills out form: title, description, dates, expected participants, rounds, team limits, notes
6. Submits → request enters `submitted` state

### Tracking the Request (Amazon-style)
7. **"My Requests"** section shows all creation requests with a visual status tracker:
   ```
   Submitted → Under Review → Approved → Building → Ready
   ```
   - Completed steps highlighted in green
   - Current step has active pulse indicator
   - Rejected/changes_requested shown as branch alerts
8. Click into request for: full details, status timeline, admin notes, activity log
9. If `changes_requested` → organizer can edit and resubmit

### Configuring the Hackathon (after `ready`)
10. Hackathon appears on dashboard in `draft` state
11. Configure rounds → define round structure (Round 1, Finals, etc.)
12. Define rubric → scoring criteria with names, weights, max scores
13. Invite judges → send judge invites via email
14. Activate → `draft → active` → registration opens, branded frontend goes live
15. Monitor → watch teams forming, repos linked, push activity, submissions
16. Post announcements → broadcast updates to participants
17. Transition to judging → `active → judging` → submissions lock
18. Assign judges to submissions
19. Publish results → leaderboard computed → `judging → completed`
20. Archive → `completed → archived`

---

## 3. Judge (`judge.devsage.org`)

1. Receives invite email with unique judge invite token
2. Clicks link → accepts invite → signs up/logs in via Google OAuth
3. Dashboard → sees assigned hackathons and judging window
4. Views assignments → list of teams/submissions to score
5. Scores submissions → per-criterion scoring (e.g., Innovation: 8/10) — weights auto-applied
6. Confirms and submits scores → audit event logged
7. Views published leaderboard

---

## 4. Participant (`devsage.org` + branded frontends)

1. Discovers hackathon on branded frontend:
   - Club: `{slug}.{workspace}.devsage.org` (e.g., `code-sprint.ieee-vit.devsage.org`)
   - Individual: `{slug}.hackathon.devsage.org`
2. Registers via GitHub OAuth
3. Creates team (becomes leader) or joins via invite code
4. Team leader links GitHub repo
5. Codes and pushes → webhooks log commits, detect force-pushes
6. Submits via git tag → `git tag submission_v1 && git push --tags` → exactly-once lock
7. Resubmits → push another tag → previous becomes non-final
8. Receives notifications → submission confirmations, deadline reminders, announcements
9. Views leaderboard → final rankings with scores
10. Done → audit trail proves submission integrity

---

## Creation Request Status Lifecycle

```
                          ┌──── rejected (with reason)
                          │
submitted → under_review ─┤
                          │
                          ├──── changes_requested ──→ (organizer edits) ──→ submitted
                          │
                          └──── approved → building → ready
                                                       │
                                                       ▼
                                              Hackathon created
                                              in draft state
```

## Hackathon State Machine

```
draft → active → judging → completed → archived
```

Each transition is enforced by a Durable Object (`HackathonStateMachine`) with exactly-once guarantees.

| Transition | Trigger | Effect |
|------------|---------|--------|
| `draft → active` | Organizer activates | Registration opens, frontend live |
| `active → judging` | Organizer transitions | Submissions lock |
| `judging → completed` | Results published | Leaderboard finalized |
| `completed → archived` | Organizer archives | Read-only, audit sealed |

## Notification Events

| Transition | Notified | Channel |
|------------|----------|---------|
| Request → `submitted` | All platform admins | In-app + email |
| Request → `under_review` | Requesting organizer | In-app |
| Request → `approved` | Organizer + workspace | In-app + email |
| Request → `rejected` | Requesting organizer | In-app + email |
| Request → `changes_requested` | Requesting organizer | In-app + email |
| Request → `building` | Requesting organizer | In-app |
| Request → `ready` | Organizer + workspace | In-app + email |
| Submission confirmed | Team members | In-app |
| Deadline reminder | All participants | In-app + email |
| Results published | All participants | In-app + email |
