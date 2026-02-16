# Audit Event Catalog

> Complete list of auditable actions, organized by domain.

## Authentication

| Event Type | Entity Type | When |
|-----------|------------|------|
| `auth.login` | user | User logs in |
| `auth.logout` | user | User logs out |
| `auth.logout_all` | user | All sessions revoked |
| `auth.token_refreshed` | user | Refresh token rotated |
| `auth.replay_detected` | user | Refresh token replay → family revoked |
| `auth.account_linked` | user | Second provider linked |
| `auth.account_deleted` | user | Account deletion completed |

## Hackathon Lifecycle

| Event Type | Entity Type | When |
|-----------|------------|------|
| `hackathon.created` | hackathon | New hackathon created |
| `hackathon.updated` | hackathon | Settings changed |
| `hackathon.transitioned` | hackathon | State changed (changes: old→new status) |
| `hackathon.deleted` | hackathon | Hackathon deleted |

## Teams

| Event Type | Entity Type | When |
|-----------|------------|------|
| `team.created` | team | New team created |
| `team.member_joined` | team | Member joined via invite code |
| `team.member_removed` | team | Member removed by lead/organizer |
| `team.member_left` | team | Member voluntarily left |
| `team.leadership_transferred` | team | Team lead changed |
| `team.dissolved` | team | Team deleted |
| `team.repo_linked` | team_repo | GitHub repo linked |
| `team.repo_unlinked` | team_repo | GitHub repo unlinked |

## Submissions

| Event Type | Entity Type | When |
|-----------|------------|------|
| `submission.captured` | submission | New submission from tag |
| `submission.validated` | submission | Validation checks passed |
| `submission.failed_validation` | submission | Validation checks failed |
| `submission.tag_deleted` | submission | Tag was deleted on GitHub |
| `submission.overridden` | submission | Organizer override (accept/reject) |

## Judging

| Event Type | Entity Type | When |
|-----------|------------|------|
| `judge.invited` | judge | Judge invitation sent |
| `judge.accepted` | judge | Judge accepted invitation |
| `judge.removed` | judge | Judge removed |
| `score.submitted` | score | Judge submitted scores |
| `score.updated` | score | Judge updated scores |
| `results.published` | hackathon | Results made public |
| `results.unpublished` | hackathon | Results hidden |

## Roles & Permissions

| Event Type | Entity Type | When |
|-----------|------------|------|
| `role.assigned` | organizer_role | Organizer/co-organizer assigned |
| `role.removed` | organizer_role | Role removed |

## Workspace

| Event Type | Entity Type | When |
|-----------|------------|------|
| `workspace.created` | workspace | New workspace created |
| `workspace.member_added` | workspace | Member invited/added |
| `workspace.member_removed` | workspace | Member removed |

## System

| Event Type | Entity Type | When |
|-----------|------------|------|
| `queue.dead_letter` | queue_message | Message exceeded max retries |
| `cron.deadline_transition` | hackathon | Auto-transition by deadline |
| `bot.activated` | team_repo | GitHub App installed on repo |
| `bot.deactivated` | team_repo | GitHub App uninstalled |
| `force_push.detected` | team_repo | Force push on linked repo |
