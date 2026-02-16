# Phase 2 Features

> Features explicitly deferred from Phase 1. Each file describes the feature, its dependencies on Phase 1, and implementation approach.

## Feature List

| Feature | Depends On | Complexity |
|---------|-----------|------------|
| [Real-time WebSocket](real-time-websocket.md) | Hackathon lifecycle, teams | High |
| [AI Code Reviews](ai-reviews.md) | Submissions, webhooks | Medium |
| [Analytics Dashboards](analytics-dashboards.md) | All Phase 1 data | Medium |
| [Sponsor Management](sponsor-management.md) | Hackathons, data model | Low |
| [Team Chat](team-chat.md) | Teams, real-time | Medium |
| [Audience Voting](audience-voting.md) | Submissions, judging | Medium |
| [GDPR Anonymization](gdpr-anonymization.md) | All user data tables | Medium |
| [Advanced Notifications](advanced-notifications.md) | Notifications | Low |

## Implementation Order

Recommended build sequence:

1. **Sponsor Management** — standalone, simple CRUD
2. **Advanced Notifications** — extends existing notification system
3. **Analytics Dashboards** — read-only, uses Analytics Engine
4. **AI Code Reviews** — extends submission pipeline
5. **Real-time WebSocket** — new DO, infrastructure change
6. **Team Chat** — depends on real-time infrastructure
7. **Audience Voting** — depends on submissions + auth
8. **GDPR Anonymization** — touches all tables, do last

## Notes

- Phase 2 features should not break Phase 1 functionality
- Each feature is designed to be independently deployable
- Some schema tables already exist (e.g., `hackathon_sponsors`, `team_messages`)
