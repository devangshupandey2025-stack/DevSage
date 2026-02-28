# Judge App (judge.devsage.org)

Judge scoring portal. Focused workflow: view assignments, score submissions, see leaderboard.

## Current Pages (8)

| Route | Status | Gaps |
|-------|--------|------|
| `/login` | Complete | — |
| `/invite/judge/:token` | Complete | — |
| `/change-password` | Complete | — |
| `/dashboard` | Complete | — |
| `/profile` | Complete | — |
| `/hackathons/:slug/score` | Complete | Time window enforcement in UI |
| `/hackathons/:slug/assignments` | Complete | Conflict declaration missing |
| `/hackathons/:slug/leaderboard` | Complete | — |

## Features to Build

### 1. Scoring Time Window UI

**Source**: `role-judge.md` (1-2 hour scoring window)

**Backend dependency**: Time window enforcement in `backend/05-judging-system.md`

On `/hackathons/:slug/score`:
- **Before window opens**: Show countdown timer, disable scoring form
- **During window**: Show remaining time, enable scoring
- **After window closes**: Show "Scoring closed" message, make scores read-only
- **No window configured**: Allow scoring anytime (current behavior)

Implementation:
```typescript
function ScoringWindow({ round }: { round: Round }) {
  const now = new Date();
  const opens = round.scoring_opens_at ? new Date(round.scoring_opens_at) : null;
  const closes = round.scoring_closes_at ? new Date(round.scoring_closes_at) : null;

  if (opens && now < opens) return <CountdownTimer target={opens} label="Scoring opens in" />;
  if (closes && now > closes) return <ClosedBanner />;
  if (closes) return <CountdownTimer target={closes} label="Scoring closes in" />;
  return null; // No window, always open
}
```

### 2. Conflict of Interest Declaration

**Source**: `role-judge.md` (declare conflicts before scoring)

**Backend dependency**: Conflict endpoints in `backend/05-judging-system.md`

New page or section: `/hackathons/:slug/conflicts`
- List of assigned teams with "Declare Conflict" button
- Conflict form: select team, provide reason
- After declaring: team removed from assignments, marked as "Conflicted"
- Show declared conflicts in sidebar/header as a badge count

On `/hackathons/:slug/assignments`:
- Conflicted teams shown with strikethrough / "Conflict Declared" badge
- Not counted in pending assignments

### 3. Judge Guidelines Acknowledgment

**Source**: `role-judge.md` (review guidelines before scoring)

**Backend dependency**: Guidelines acknowledgment in `backend/05-judging-system.md`

Flow:
1. On first visit to a hackathon's scoring page, show guidelines modal
2. Judge must scroll through and click "I acknowledge these guidelines"
3. API call: `POST /api/v1/hackathons/:slug/judging/acknowledge-guidelines`
4. After acknowledgment: modal doesn't appear again, scoring enabled

Implementation:
```typescript
function GuidelinesModal({ hackathon, onAcknowledge }) {
  return (
    <Dialog open={!hackathon.guidelinesAcknowledged}>
      <DialogContent>
        <DialogHeader>Judge Guidelines</DialogHeader>
        <ScrollArea className="h-96">
          <Markdown>{hackathon.judgeGuidelines}</Markdown>
        </ScrollArea>
        <DialogFooter>
          <Button onClick={onAcknowledge}>I have read and understand these guidelines</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 4. Multi-Round Scoring Navigation

**Source**: `role-judge.md` (multi-round judging)

On `/hackathons/:slug/assignments`:
- Round selector tabs or dropdown
- Show assignments for selected round
- Progress indicator per round: "3 of 8 scored"
- Clear visual distinction between active round and completed rounds

On `/hackathons/:slug/score`:
- Round context in header: "Round 2 — Submissions"
- Different rubric criteria per round (fetched from API per round)
- After scoring all assignments in a round: show completion message

### 5. Score Review & Editing

**Source**: `role-judge.md` (view my scores)

On `/hackathons/:slug/assignments`:
- After scoring a submission: show "Review Score" link
- Score review page: read-only view of all criteria scores + comments
- If scoring window is still open: "Edit Score" button to re-enter scoring

New section or page: `/hackathons/:slug/my-scores`
- Table: team name, round, total score, date scored
- Click to expand: per-criterion breakdown

### 6. Improved Scoring UX

On `/hackathons/:slug/score`:
- Rubric criteria displayed as cards, not just a form
- Slider or number input for each criterion (0 to `max_score`)
- Weight indicator: "Weight: 2x" shown next to criteria name
- Comment field per criterion (optional)
- Running total displayed as judge scores
- Keyboard shortcuts: Tab between criteria, Enter to submit
- Auto-save draft scores (localStorage) to prevent data loss

## Components to Build

| Component | Page | Purpose |
|-----------|------|---------|
| `ScoringWindow` | Score | Time window countdown/status |
| `CountdownTimer` | Score/Assignments | Countdown to window open/close |
| `ConflictDeclaration` | Assignments | Declare conflict form |
| `GuidelinesModal` | Score | Guidelines acknowledgment modal |
| `RoundSelector` | Assignments | Round navigation tabs |
| `ScoreReview` | My Scores | Read-only score display |
| `RubricCard` | Score | Individual criterion scoring card |
| `ScoreProgress` | Assignments | Per-round completion indicator |
