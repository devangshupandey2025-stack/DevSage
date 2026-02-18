# Data Models — DevSage

**Generated:** 2026-02-18  
**ORM:** Drizzle ORM (SQLite mode)  
**Database:** Cloudflare D1  
**Total Tables:** 36

---

## Entity Relationship Overview

```
users ─┬─> workspaces (created_by)
       ├─> workspace_members (user_id)
       ├─> organizer_roles (user_id)
       ├─> team_members (user_id)
       ├─> judges (user_id)
       ├─> refresh_tokens (user_id)
       ├─> platform_admins (user_id)
       ├─> in_app_notifications (user_id)
       ├─> audit_events (actor_id)
       └─> deletion_requests (user_id)

workspaces ─┬─> workspace_members
            ├─> workspace_invites
            ├─> hackathons (workspace_id)
            └─> hackathon_templates

hackathons ─┬─> organizer_roles
            ├─> hackathon_tracks
            ├─> hackathon_rounds
            ├─> custom_phases
            ├─> hackathon_sponsors
            ├─> teams
            ├─> submissions
            ├─> judges
            ├─> rubric_criteria
            ├─> scores
            ├─> announcements
            ├─> audit_events
            ├─> in_app_notifications
            └─> hackathon_notification_config

teams ──┬─> team_members
        ├─> team_invites
        ├─> team_repos
        ├─> team_messages
        ├─> submissions
        └─> round_results

submissions ─┬─> scores
             └─> judge_assignments
```

---

## Table Reference

### Core Identity

#### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| email | text | UNIQUE, NOT NULL |
| name | text | NOT NULL |
| password_hash | text | NOT NULL |
| avatar_url | text | — |
| created_at | text | DEFAULT NOW |
| last_login_at | text | — |

#### refresh_tokens
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| user_id | text | FK→users (CASCADE) |
| family_id | text | NOT NULL |
| token_hash | text | UNIQUE, NOT NULL |
| revoked_at | text | — |
| expires_at | text | NOT NULL |
| created_at | text | DEFAULT NOW |

**Indexes:** idx_refresh_tokens_user, idx_refresh_tokens_family

#### platform_admins
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| user_id | text | UNIQUE, FK→users (CASCADE) |
| added_by | text | FK→users (SET NULL) |
| created_at | text | DEFAULT NOW |

#### deletion_requests
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| user_id | text | FK→users (CASCADE) |
| confirmation_token | text | UNIQUE, NOT NULL |
| status | text | DEFAULT 'pending' |
| created_at | text | DEFAULT NOW |
| confirmed_at | text | — |

---

### Workspaces

#### workspaces
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| name | text | NOT NULL |
| slug | text | UNIQUE |
| description | text | — |
| type | text | NOT NULL |
| created_by | text | FK→users (SET NULL) |
| created_at | text | DEFAULT NOW |
| updated_at | text | — |

#### workspace_members
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| workspace_id | text | FK→workspaces (CASCADE) |
| user_id | text | FK→users (CASCADE) |
| role | text | NOT NULL |
| invited_by | text | FK→users (SET NULL) |
| created_at | text | DEFAULT NOW |

**Unique:** uq_workspace_members_workspace_user

#### workspace_invites
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| workspace_id | text | FK→workspaces (CASCADE), NOT NULL |
| email | text | NOT NULL |
| role | text | NOT NULL |
| invite_token | text | UNIQUE, NOT NULL |
| invited_by | text | FK→users (SET NULL) |
| status | text | DEFAULT 'pending' |
| created_at | text | DEFAULT NOW |
| expires_at | text | — |

---

### Hackathons

#### hackathons
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| workspace_id | text | FK→workspaces (CASCADE), NOT NULL |
| name | text | NOT NULL |
| slug | text | UNIQUE, NOT NULL |
| description | text | — |
| status | text | DEFAULT 'draft' |
| start_date | text | — |
| end_date | text | — |
| submission_deadline | text | — |
| max_team_size | integer | DEFAULT 5 |
| min_team_size | integer | DEFAULT 1 |
| max_teams | integer | — |
| settings | text | — |
| created_by | text | FK→users (SET NULL) |
| created_at | text | DEFAULT NOW |
| updated_at | text | — |

**Status values:** draft → active → judging → completed → archived

#### organizer_roles
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| hackathon_id | text | FK→hackathons (CASCADE), NOT NULL |
| user_id | text | FK→users (CASCADE), NOT NULL |
| role | text | NOT NULL |
| invited_by | text | FK→users (SET NULL) |
| created_at | text | DEFAULT NOW |

**Unique:** uq_organizer_roles_hackathon_user

#### hackathon_tracks
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| hackathon_id | text | FK→hackathons (CASCADE), NOT NULL |
| name | text | NOT NULL |
| description | text | — |
| max_teams | integer | — |
| sort_order | integer | DEFAULT 0 |
| created_at | text | DEFAULT NOW |

#### hackathon_rounds
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| hackathon_id | text | FK→hackathons (CASCADE), NOT NULL |
| round_number | integer | NOT NULL |
| name | text | NOT NULL |
| type | text | DEFAULT 'standard' |
| status | text | DEFAULT 'pending' |
| submission_deadline | text | — |
| started_at | text | — |
| completed_at | text | — |
| is_initialized | integer | DEFAULT 0 |
| created_at | text | DEFAULT NOW |
| updated_at | text | — |

**Unique:** hackathon_rounds_number_idx (hackathon_id + round_number)

#### custom_phases
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| hackathon_id | text | FK→hackathons (CASCADE), NOT NULL |
| parent_status | text | NOT NULL |
| name | text | NOT NULL |
| description | text | — |
| sort_order | integer | DEFAULT 0 |
| start_date | text | — |
| end_date | text | — |
| created_at | text | DEFAULT NOW |

#### hackathon_templates
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| workspace_id | text | FK→workspaces (CASCADE) |
| name | text | NOT NULL |
| description | text | — |
| settings | text | DEFAULT '{}' |
| tracks | text | DEFAULT '[]' |
| rounds | text | DEFAULT '[]' |
| rubric | text | DEFAULT '[]' |
| is_platform_default | integer | DEFAULT 0 |
| created_by | text | FK→users (SET NULL) |
| created_at | text | DEFAULT NOW |
| updated_at | text | — |

#### hackathon_sponsors
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| hackathon_id | text | FK→hackathons (CASCADE), NOT NULL |
| name | text | NOT NULL |
| tier | text | NOT NULL |
| logo_url | text | — |
| website_url | text | — |
| description | text | — |
| sort_order | integer | DEFAULT 0 |
| created_at | text | DEFAULT NOW |

---

### Teams

#### teams
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| hackathon_id | text | FK→hackathons (CASCADE), NOT NULL |
| name | text | NOT NULL |
| invite_code | text | UNIQUE, NOT NULL |
| track_id | text | FK→hackathon_tracks (SET NULL) |
| status | text | DEFAULT 'forming' |
| created_at | text | DEFAULT NOW |
| updated_at | text | — |

#### team_members
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| team_id | text | FK→teams (CASCADE), NOT NULL |
| user_id | text | FK→users (CASCADE), NOT NULL |
| role | text | NOT NULL |
| joined_at | text | — |

**Unique:** uq_team_members_team_user

#### team_invites
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| team_id | text | FK→teams (CASCADE), NOT NULL |
| email | text | NOT NULL |
| invite_token | text | UNIQUE, NOT NULL |
| status | text | DEFAULT 'pending' |
| invited_by | text | FK→users (SET NULL) |
| created_at | text | DEFAULT NOW |
| expires_at | text | — |

#### team_repos
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| team_id | text | UNIQUE, FK→teams (CASCADE), NOT NULL |
| github_repo_url | text | NOT NULL |
| github_owner | text | NOT NULL |
| github_repo | text | NOT NULL |
| github_installation_id | integer | — |
| bot_active | integer | DEFAULT 0 |
| linked_by | text | FK→users (SET NULL) |
| created_at | text | DEFAULT NOW |

#### team_messages
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| team_id | text | FK→teams (CASCADE), NOT NULL |
| user_id | text | FK→users (CASCADE), NOT NULL |
| content | text | NOT NULL |
| created_at | text | DEFAULT NOW |

---

### Submissions & Scoring

#### submissions
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| hackathon_id | text | FK→hackathons (CASCADE), NOT NULL |
| team_id | text | FK→teams (CASCADE), NOT NULL |
| round_id | text | FK→hackathon_rounds (SET NULL) |
| tag_name | text | NOT NULL |
| commit_sha | text | NOT NULL |
| submitted_at | text | NOT NULL |
| status | text | DEFAULT 'pending_validation' |
| validated_at | text | — |
| validation_results | text | — |
| delivery_id | text | UNIQUE |
| is_current | integer | DEFAULT 1 |
| created_at | text | DEFAULT NOW |

#### judges
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| hackathon_id | text | FK→hackathons (CASCADE), NOT NULL |
| user_id | text | FK→users (SET NULL) |
| email | text | NOT NULL |
| invite_status | text | DEFAULT 'pending' |
| invite_token | text | UNIQUE, NOT NULL |
| invited_by | text | FK→users (SET NULL) |
| created_at | text | DEFAULT NOW |
| accepted_at | text | — |

#### judge_assignments
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| judge_id | text | FK→judges (CASCADE), NOT NULL |
| submission_id | text | FK→submissions (CASCADE), NOT NULL |
| hackathon_id | text | FK→hackathons (CASCADE), NOT NULL |
| status | text | DEFAULT 'pending' |
| created_at | text | DEFAULT NOW |

#### judge_tracks
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| judge_id | text | FK→judges (CASCADE), NOT NULL |
| track_id | text | FK→hackathon_tracks (CASCADE), NOT NULL |

#### rubric_criteria
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| hackathon_id | text | FK→hackathons (CASCADE), NOT NULL |
| name | text | NOT NULL |
| description | text | — |
| max_score | integer | DEFAULT 10 |
| weight | real | DEFAULT 1.0 |
| track_id | text | FK→hackathon_tracks (CASCADE) |
| sort_order | integer | DEFAULT 0 |
| created_at | text | DEFAULT NOW |

#### scores
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| hackathon_id | text | FK→hackathons (CASCADE), NOT NULL |
| submission_id | text | FK→submissions (CASCADE), NOT NULL |
| judge_id | text | FK→judges (CASCADE), NOT NULL |
| criterion_id | text | FK→rubric_criteria (CASCADE), NOT NULL |
| score | real | NOT NULL |
| notes | text | — |
| created_at | text | DEFAULT NOW |
| updated_at | text | — |

**Unique:** uq_scores_judge_submission_criterion

#### round_results
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| round_id | text | FK→hackathon_rounds (CASCADE), NOT NULL |
| team_id | text | FK→teams (CASCADE), NOT NULL |
| rank | integer | NOT NULL |
| total_score | real | NOT NULL |
| advanced | integer | DEFAULT 0 |
| created_at | text | DEFAULT NOW |

---

### GitHub Integration

#### commit_log
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| team_repo_id | text | FK→team_repos (CASCADE), NOT NULL |
| commit_sha | text | NOT NULL |
| commit_message | text | NOT NULL |
| author_login | text | — |
| author_email | text | — |
| committed_at | text | NOT NULL |
| pushed_at | text | NOT NULL |
| created_at | text | DEFAULT NOW |

#### force_push_events
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| team_repo_id | text | FK→team_repos (CASCADE), NOT NULL |
| before_sha | text | NOT NULL |
| after_sha | text | NOT NULL |
| ref | text | NOT NULL |
| pusher_login | text | NOT NULL |
| detected_at | text | NOT NULL |
| created_at | text | DEFAULT NOW |

#### webhook_deliveries
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| github_delivery_id | text | UNIQUE, NOT NULL |
| event_type | text | NOT NULL |
| status | text | DEFAULT 'queued' |
| error_message | text | — |
| received_at | text | NOT NULL |
| processed_at | text | — |

#### pending_installations
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| team_id | text | FK→teams (CASCADE), NOT NULL |
| github_owner | text | NOT NULL |
| github_repo | text | NOT NULL |
| created_at | text | DEFAULT NOW |

---

### Notifications

#### in_app_notifications
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| user_id | text | FK→users (CASCADE), NOT NULL |
| hackathon_id | text | FK→hackathons (CASCADE) |
| type | text | NOT NULL |
| title | text | NOT NULL |
| body | text | — |
| link | text | — |
| read_at | text | — |
| created_at | text | DEFAULT NOW |

#### notification_deliveries
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| notification_type | text | NOT NULL |
| channel | text | NOT NULL |
| recipient_id | text | FK→users (SET NULL) |
| recipient_email | text | — |
| status | text | DEFAULT 'sent' |
| error_message | text | — |
| created_at | text | DEFAULT NOW |

#### notification_idempotency
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| idempotency_key | text | UNIQUE, NOT NULL |
| created_at | text | DEFAULT NOW |

#### hackathon_notification_config
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| hackathon_id | text | FK→hackathons (CASCADE), NOT NULL |
| user_id | text | FK→users (CASCADE), NOT NULL |
| email_enabled | integer | DEFAULT 1 |
| in_app_enabled | integer | DEFAULT 1 |
| created_at | text | DEFAULT NOW |

---

### Audit

#### audit_events
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| hackathon_id | text | FK→hackathons (SET NULL) |
| actor_id | text | FK→users (SET NULL) |
| actor_type | text | NOT NULL |
| event_type | text | NOT NULL |
| entity_type | text | NOT NULL |
| entity_id | text | NOT NULL |
| metadata | text | — |
| changes | text | — |
| hash | text | — |
| prev_hash | text | — |
| created_at | text | DEFAULT NOW |

**Indexes:** idx_audit_entity, idx_audit_event_type, idx_audit_actor  
**Integrity:** SHA-256 hash chain per hackathon

---

### Announcements

#### announcements
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK |
| hackathon_id | text | FK→hackathons (CASCADE) |
| author_id | text | FK→users |
| title | text | NOT NULL |
| content | text | NOT NULL |
| pinned | integer | DEFAULT 0 |
| created_at | text | DEFAULT NOW |
| updated_at | text | — |
