# Judge — Scoring & Evaluation User Flow

> Role: Judge | Scope: Per-hackathon | App: `judge.devsage.org` | Count: Multiple per hackathon

---

## Who

Industry professionals, faculty, or domain experts invited to evaluate hackathon submissions. Judges are scoped to specific hackathons and only interact through the dedicated judging interface — never through `platform.devsage.org` or the branded participant site.

---

## Entry Points

| Method | How It Works |
|--------|-------------|
| **Email Invite** | Event Lead sends invite via Platform → judge receives email with link to `judge.devsage.org` → signs up with their own password |
| **Credentials Provided** | Event Lead creates judge account on Platform → judge receives email + temporary password → logs into `judge.devsage.org` → must reset password on first login |

> Both methods land the judge on `judge.devsage.org`. Judges authenticate with **email/password only** — no OAuth.

---

## Flow

### 1. Onboarding

1. Receive invite email or credentials from Event Lead
2. Navigate to `judge.devsage.org`
3. **If email invite:** Click invite link → create password → account active
4. **If credentials provided:** Log in with temporary password → forced password reset → account active
5. Judge now sees their assigned hackathon(s)

### 2. Pre-Judging (Waiting)

Before the judging window opens:

1. View assigned hackathon(s) on the judge dashboard
2. Review the **rubric** — scoring criteria with weights (e.g., Innovation ×2.0, Execution ×1.5)
3. Review any judging guidelines or instructions set by the Event Lead
4. **Cannot score yet** — judging window hasn't started

### 3. Conflict of Interest Declaration

Judges can declare conflicts at any point before they score a given submission — either during pre-judging or after the scoring window opens.

1. Judge reviews the list of submissions assigned to them
2. **Declare conflicts** — flag any team where the judge has a personal/professional connection
3. Conflicted submissions are reassigned by the Event Lead
4. Judge cannot score submissions they've flagged
5. Once a submission has been scored by this judge, they can no longer flag it as conflicted

### 4. Scoring (During Judging Window)

The judging window is a tight **1–2 hour period**. It opens when the Event Lead transitions the hackathon to `judging` state (manually or via deadline alarm) and closes when the Event Lead transitions out or the configured duration elapses.

1. Judging window opens → judge receives notification
2. View assigned submissions:
   - Team name
   - Repo link — read-only access to the submission commit/tag, served through the judge dashboard via the DevSage GitHub App (judges are **not** added as GitHub collaborators)
   - Submission metadata (tag, SHA, timestamp, late flag)
3. For each assigned submission:
   - Review the code/project via repo link
   - Score against each rubric criterion
   - Optionally add written feedback/notes per criterion
   - Submit scores for that submission
4. Scores are **per-criterion, per-submission** — weighted totals calculated automatically
5. Can revise scores for any submission until the judging window closes
6. Progress tracker shows: scored / total assigned

### 5. Multi-Round Judging

For hackathons with multiple rounds:

1. Each round has its own judging window
2. Judge may be assigned different submissions per round — in elimination rounds the pool narrows as teams are cut; in scoring-only rounds all teams remain
3. Repeat: review assignments → declare conflicts → score → submit
4. Previous round scores are **locked** once results are published
5. Judge's scoring process is identical regardless of round type — the distinction only affects which teams are in the pool

### 6. Post-Judging

1. Judging window closes → scores locked (no further edits)
2. Judge can view their own submitted scores (read-only)
3. Final results published by Event Lead — judge can see the leaderboard
4. Judge's involvement ends after the final round

---

## Judge Dashboard (`judge.devsage.org`)

| Section | What It Shows |
|---------|---------------|
| **My Hackathons** | List of hackathons the judge is assigned to, with status |
| **Rubric** | Scoring criteria, weights, and guidelines for the current round |
| **Assignments** | Submissions assigned to this judge for the current round |
| **Scoring** | Per-submission scoring interface with rubric criteria |
| **Conflicts** | Declared conflicts and their resolution status |
| **My Scores** | Read-only view of submitted scores after window closes |
| **Leaderboard** | Published results (visible after Event Lead publishes) |

---

## Permissions

| Action | Access |
|--------|--------|
| View assigned submissions | ✅ Primary responsibility |
| Score against rubric | ✅ Primary responsibility |
| Declare conflicts of interest | ✅ Primary responsibility |
| Revise scores (during window) | ✅ |
| View rubric & guidelines | ✅ |
| View leaderboard (after publish) | ✅ |
| View own scores (read-only) | ✅ |
| Assign submissions to judges | ❌ (Event Lead only) |
| Publish results | ❌ (Event Lead only) |
| Configure rubric | ❌ (Event Lead only) |
| Transition hackathon state | ❌ |
| Access participant data beyond assigned submissions | ❌ |
| Access workspace or platform settings | ❌ |

---

## Key Constraints

- Scoped to specific hackathon(s) they're invited to — no workspace or platform access
- Can only score submissions explicitly assigned to them
- Cannot score submissions where they've declared a conflict (can declare before scoring, not after)
- Scores are editable only while the judging window is open
- Cannot see other judges' scores (blind judging)
- Repo access is read-only through the judge dashboard (via DevSage GitHub App), not direct GitHub access
- Cannot access the Platform app or Admin Dashboard
- No GitHub OAuth — email/password auth only
