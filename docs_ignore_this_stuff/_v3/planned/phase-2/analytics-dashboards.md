# Analytics Dashboards

> Analytics Engine integration for hackathon metrics and organizer dashboards.

## Overview

Track engagement metrics (commits, submissions, page views) using Cloudflare Analytics Engine. Display dashboards in the platform app for organizers.

## Data Points

| Metric | Source | Granularity |
|--------|--------|-------------|
| Commits per team | Webhook push events | Per-hour |
| Submissions per round | Submission captures | Per-event |
| Active participants | Auth/API requests | Per-day |
| Page views | Frontend analytics | Per-page |
| Judging progress | Score submissions | Per-judge |

## Analytics Engine Integration

```ts
// Write a data point
await env.ANALYTICS.writeDataPoint({
  blobs: [hackathonId, teamId, 'commit'],
  doubles: [1],  // count
  indexes: [hackathonId],
});
```

No queue needed — Analytics Engine accepts writes directly from the Worker.

## Query API

```ts
// apps/api/src/routes/analytics.ts
app.get('/hackathons/:slug/analytics', authMiddleware, requireRole('co_organizer'), async (c) => {
  const query = `
    SELECT blob1 as hackathon_id, blob3 as event_type,
           sum(double1) as total, toStartOfDay(timestamp) as day
    FROM devsage_analytics
    WHERE blob1 = '${hackathonId}'
    AND timestamp > now() - interval '30' day
    GROUP BY blob1, blob3, day
    ORDER BY day DESC
  `;

  const result = await env.ANALYTICS.query(query);
  return successResponse(c, result);
});
```

## Dashboard Pages (Platform App)

| Page | Metrics |
|------|---------|
| Hackathon Overview | Total teams, submissions, commits |
| Team Activity | Commit timeline per team |
| Judging Progress | Scores submitted / total assignments |
| Engagement | Daily active participants |

## Prerequisites

- All Phase 1 systems operational (data to analyze)
- New binding: `ANALYTICS` (Analytics Engine)
- Frontend charting library (e.g., Recharts)

## Notes

- Analytics Engine is append-only — no updates or deletes
- Free tier: 100K writes/day, 10M reads/day
- Data retention: 90 days (free), configurable on paid
- No PII in analytics data — use anonymized IDs
