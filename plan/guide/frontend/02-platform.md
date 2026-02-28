# Platform App (platform.devsage.org)

Organizer dashboard for managing hackathons, teams, judging, and workspaces.

## Current Pages (21)

| Route | Status | Gaps |
|-------|--------|------|
| `/login` | Complete | — |
| `/invite/:code` | Complete | — |
| `/invite/workspace/:token` | Complete | — |
| `/dashboard` | Complete | — |
| `/profile` | Complete | 2FA settings missing |
| `/workspaces` | Complete | — |
| `/workspaces/:slug` | Complete | Deletion, ownership transfer missing |
| `/hackathons/:slug` | Complete | — |
| `/hackathons/:slug/teams` | Complete | Elimination UI missing |
| `/hackathons/:slug/teams/:id` | Complete | — |
| `/hackathons/:slug/submissions` | Complete | Missing title/description/demo fields |
| `/hackathons/:slug/judging` | Partial | Scoring window config, conflicts, progress missing |
| `/hackathons/:slug/leaderboard` | Complete | Outlier highlighting missing |
| `/hackathons/:slug/rounds` | Partial | Scoring window config missing |
| `/hackathons/:slug/announcements` | Complete | — |
| `/hackathons/:slug/activity` | Complete | — |
| `/hackathons/:slug/analytics` | Mock data | Backend API needed |
| `/hackathons/:slug/settings` | Complete | Theming config missing |

## Features to Build

### 1. Judging Management Improvements

**Source**: `role-event-lead.md` (judge assignment, scoring windows, incomplete judging)

#### Scoring Window Configuration
On `/hackathons/:slug/rounds`:
- Add date-time pickers for `scoring_opens_at` and `scoring_closes_at` per round
- Show countdown to window open/close
- Visual indicator: "Scoring open" / "Scoring closed" / "Not configured"

#### Judge Conflict Management
On `/hackathons/:slug/judging`:
- Tab or section showing declared conflicts per judge
- Ability to view and manage conflict declarations
- Auto-excluded teams highlighted in assignment view

#### Scoring Progress Dashboard
On `/hackathons/:slug/judging`:
- Progress table: judge name, assigned count, completed count, pending count
- Per-judge status: "Complete", "In Progress", "Not Started"
- Action buttons: "Reassign" (move pending assignments to another judge)
- Alert banner when scoring window is about to close with incomplete scoring

#### Outlier Detection
On `/hackathons/:slug/leaderboard`:
- Highlight scores flagged as outliers (>30% deviation from **median**)
- Tooltip showing: judge name, score given, median score
- Ability to exclude outlier scores from final calculation

### 2. Team Elimination UI

**Source**: `role-event-lead.md` (elimination as post-judging action)

On `/hackathons/:slug/teams`:
- Filter tabs: All | Active | Eliminated | Disqualified
- Bulk elimination: checkbox select → "Eliminate Selected" button
- Confirmation dialog with team list
- Disqualification: per-team action with reason field
- Reinstatement: "Reverse Elimination" action

On `/hackathons/:slug/rounds`:
- After round completion: show "Advance Teams" section
- Split view: teams advancing (left) vs eliminated (right)
- Drag or checkbox to move teams between lists

### 3. Workspace Management

**Source**: `role-workspace-managers.md`

On `/workspaces/:slug`:
- "Delete Workspace" button (owner only) with confirmation
  - Blocked if active hackathons exist — show list of active hackathons
- "Transfer Ownership" button (owner only)
  - Dropdown of current admins → select new owner → confirm

### 4. Analytics Dashboard (Real Data)

**Source**: `role-event-lead.md` (hackathon analytics)

On `/hackathons/:slug/analytics`:
Replace mock data with real API calls:
- Participation funnel chart (invited → registered → submitted → scored)
- Submission timeline (bar chart of submissions per day)
- Commit activity per team (sparklines)
- Scoring completion progress (donut chart)
- Judge workload distribution (bar chart)

Charts library: Recharts (already in most React + shadcn stacks) or Chart.js.

### 5. Hackathon Settings: Theming

On `/hackathons/:slug/settings`:
- Add "Theming" tab
- Logo upload (or URL input)
- Primary/secondary color pickers
- Banner image upload
- Preview of how the public hackathon page will look

### 6. Profile: 2FA Settings

On `/profile`:
- "Two-Factor Authentication" section
- Enable: show QR code, verify TOTP code, save backup codes
- Disable: require current TOTP code or backup code
- Regenerate backup codes

### 7. Template Management

On `/workspaces/:slug` or `/dashboard`:
- Templates section: list, create, edit, delete
- Template editor: settings, tracks, rounds, rubric configuration
- "Create Hackathon from Template" flow

## Components to Build

| Component | Page | Purpose |
|-----------|------|---------|
| `ScoringWindowConfig` | Rounds | Date-time picker for scoring window |
| `JudgeProgress` | Judging | Scoring completion table |
| `ConflictList` | Judging | Judge conflict declarations |
| `OutlierBadge` | Leaderboard | Highlight outlier scores |
| `EliminationPanel` | Teams/Rounds | Bulk team elimination UI |
| `OwnershipTransfer` | Workspace | Transfer dialog |
| `AnalyticsChart` | Analytics | Chart components (funnel, timeline, donut) |
| `ThemingEditor` | Settings | Color picker, logo upload |
| `TwoFactorSetup` | Profile | QR code, verification, backup codes |
| `TemplateEditor` | Dashboard | Template CRUD form |
