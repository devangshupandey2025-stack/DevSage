# 04 — Data Models

46 tables in Cloudflare D1 (SQLite) via Drizzle ORM. Schema lives in `packages/db/src/schema/`.

---

## Identity & Auth

### `users`
Primary user table. One record per human.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | TEXT | PK, UUID | `crypto.randomUUID()` |
| email | TEXT | UNIQUE, NOT NULL | Lowercase |
| name | TEXT | NOT NULL | Display name |
| password_hash | TEXT | NULLABLE | Null for OAuth-only users |
| github_id | TEXT | NULLABLE | GitHub numeric ID |
| github_username | TEXT | NULLABLE | GitHub login |
| google_id | TEXT | NULLABLE | Google subject ID |
| avatar_url | TEXT | NULLABLE | Profile image URL |
| password_must_change | INTEGER | DEFAULT 0 | 1 = forced reset (judge temp pw) |
| email_verified | INTEGER | DEFAULT 0 | 1 = verified |
| email_bounced | INTEGER | DEFAULT 0 | |
| suspended | INTEGER | DEFAULT 0 | |
| suspended_at | TEXT | NULLABLE | ISO-8601 |
| suspended_reason | TEXT | NULLABLE | |
| last_login_at | TEXT | NULLABLE | ISO-8601 |
| created_at | TEXT | DEFAULT now | ISO-8601 |
| updated_at | TEXT | DEFAULT now | ISO-8601 |

### `refreshTokens`
Refresh token storage with family-based replay detection.

| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK, UUID |
| userId | TEXT | FK → users.id |
| tokenHash | TEXT | UNIQUE (SHA-256 of token) |
| familyId | TEXT | NOT NULL (groups related tokens) |
| expiresAt | TEXT | NOT NULL (30 days) |
| revoked | INTEGER | DEFAULT 0 |
| revokedAt | TEXT | NULLABLE |
| replacedBy | TEXT | NULLABLE (next token in chain) |
| ipAddress | TEXT | NULLABLE |
| userAgent | TEXT | NULLABLE |
| createdAt | TEXT | DEFAULT now |

### `otpSessions`
Email OTP verification tracking.

| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| userId | TEXT | FK → users |
| otpHash | TEXT | NOT NULL |
| ipAddress | TEXT | NULLABLE |
| userAgent | TEXT | NULLABLE |
| attempts | INTEGER | DEFAULT 0 |
| maxAttempts | INTEGER | DEFAULT 5 |
| createdAt | TEXT | DEFAULT now |
| expiresAt | TEXT | NOT NULL |
| verifiedAt | TEXT | NULLABLE |

### `emailVerificationTokens` / `passwordResetTokens`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| userId | TEXT | FK → users |
| tokenHash | TEXT | UNIQUE |
| createdAt / expiresAt / usedAt | TEXT | |

### `deletionRequests`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| userId | TEXT | FK → users |
| confirmationToken | TEXT | UNIQUE |
| status | TEXT | pending / confirmed |
| createdAt / confirmedAt | TEXT | |

### `platformAdmins`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| userId | TEXT | FK → users, UNIQUE |
| addedBy | TEXT | FK → users |
| createdAt | TEXT | |

### `platformInvites`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| email | TEXT | NOT NULL |
| inviteCode | TEXT | UNIQUE |
| status | TEXT | pending / accepted / revoked |
| createdBy | TEXT | FK → users |
| createdAt / expiresAt | TEXT | |

---

## Workspaces

### `workspaces`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK, UUID |
| name | TEXT | NOT NULL |
| slug | TEXT | UNIQUE |
| description | TEXT | NULLABLE |
| type | TEXT | 'club' \| 'individual' |
| logo_url | TEXT | NULLABLE |
| website | TEXT | NULLABLE |
| settings | TEXT | JSON |
| createdBy | TEXT | FK → users |
| createdAt / updatedAt | TEXT | |

### `workspaceMembers`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| workspaceId | TEXT | FK → workspaces |
| userId | TEXT | FK → users |
| role | TEXT | 'owner' \| 'admin' \| 'member' |
| invitedBy | TEXT | FK → users |
| createdAt | TEXT | |
| — | — | UNIQUE(workspaceId, userId) |

### `workspaceInvites`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| workspaceId | TEXT | FK → workspaces |
| email | TEXT | NOT NULL |
| role | TEXT | workspace role |
| inviteToken | TEXT | UNIQUE |
| invitedBy | TEXT | FK → users |
| status | TEXT | pending / accepted / declined / expired |
| createdAt / expiresAt | TEXT | |

---

## Hackathons

### `hackathons`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK, UUID |
| workspaceId | TEXT | FK → workspaces |
| slug | TEXT | UNIQUE |
| title | TEXT | NOT NULL |
| tagline | TEXT | NULLABLE |
| description | TEXT | NULLABLE |
| rulesmd | TEXT | NULLABLE (markdown) |
| status | TEXT | draft \| active \| judging \| completed \| archived |
| startsAt | TEXT | NULLABLE |
| judgingStarts | TEXT | NULLABLE |
| judgingEnds | TEXT | NULLABLE |
| minTeamSize | INTEGER | DEFAULT 1 |
| maxTeamSize | INTEGER | DEFAULT 5 |
| maxTeams | INTEGER | NULLABLE |
| submissionTagPattern | TEXT | NULLABLE (e.g., `v*`) |
| allowResubmission | INTEGER | DEFAULT 1 |
| registrationMode | TEXT | NULLABLE |
| allowedEmailDomains | TEXT | NULLABLE (JSON array) |
| requireRepo | INTEGER | DEFAULT 0 |
| timezone | TEXT | NULLABLE |
| templateId | TEXT | NULLABLE |
| tracks | TEXT | JSON array |
| prizes | TEXT | JSON |
| settings | TEXT | JSON |
| createdBy | TEXT | FK → users |
| createdAt / updatedAt | TEXT | |

### `hackathonRequests`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| workspaceId | TEXT | FK → workspaces |
| requestedBy | TEXT | FK → users |
| title / description | TEXT | |
| startsAt / endsAt | TEXT | |
| numEvents / expectedParticipants | INTEGER | |
| teamMinSize / teamMaxSize | INTEGER | |
| additionalDetails | TEXT | NULLABLE |
| hackathonId | TEXT | NULLABLE (set when approved → "ready") |
| status | TEXT | submitted \| under_review \| approved \| rejected \| changes_requested \| building \| ready |
| adminNotes | TEXT | NULLABLE |
| statusHistory | TEXT | JSON array of `{status, timestamp, notes}` |
| createdAt / updatedAt | TEXT | |

### `hackathonRounds`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| hackathonId | TEXT | FK → hackathons |
| roundNumber | INTEGER | NOT NULL |
| name | TEXT | NOT NULL |
| type | TEXT | 'elimination' \| 'scoring_only' |
| status | TEXT | upcoming \| active \| judging \| completed |
| submissionDeadline | TEXT | NULLABLE |
| startedAt / completedAt | TEXT | NULLABLE |
| isInitialized | INTEGER | DEFAULT 0 |
| createdAt / updatedAt | TEXT | |
| — | — | UNIQUE(hackathonId, roundNumber) |

### `hackathonTracks` / `customPhases` / `hackathonTemplates` / `hackathonSponsors` / `hackathonNotificationConfig`
Supporting tables for hackathon configuration. See `packages/db/src/schema/` for full definitions.

### `organizerRoles`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| hackathonId | TEXT | FK → hackathons |
| userId | TEXT | FK → users |
| role | TEXT | 'organizer' \| 'co_organizer' |
| invitedBy | TEXT | FK → users |
| createdAt | TEXT | |
| — | — | UNIQUE(hackathonId, userId) |

---

## Teams

### `teams`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK, UUID |
| hackathonId | TEXT | FK → hackathons |
| name | TEXT | NOT NULL |
| inviteCode | TEXT | UNIQUE (8-char) |
| trackId | TEXT | NULLABLE FK → hackathonTracks |
| status | TEXT | forming \| ready \| submitted \| dissolved |
| createdAt / updatedAt | TEXT | |

### `teamMembers`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| teamId | TEXT | FK → teams |
| userId | TEXT | FK → users |
| role | TEXT | 'team_lead' \| 'team_member' |
| joinedAt | TEXT | |
| — | — | UNIQUE(teamId, userId) |

### `teamInvites`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| teamId | TEXT | FK → teams |
| email | TEXT | NOT NULL |
| inviteToken | TEXT | UNIQUE |
| status | TEXT | pending \| accepted \| declined \| expired |
| invitedBy | TEXT | FK → users |
| createdAt / expiresAt | TEXT | |
| — | — | UNIQUE(teamId, email) |

### `teamRepos`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| teamId | TEXT | FK → teams |
| hackathonId | TEXT | FK → hackathons |
| provider | TEXT | 'github' |
| repoFullName | TEXT | `owner/repo` |
| repoUrl | TEXT | |
| installationId | TEXT | NULLABLE |
| botActive | INTEGER | DEFAULT 0 |
| isPrimary | INTEGER | DEFAULT 1 |
| accessTokenEncrypted | TEXT | NULLABLE |
| createdAt | TEXT | |

### `teamMessages`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| teamId | TEXT | FK → teams |
| userId | TEXT | FK → users |
| content | TEXT | NOT NULL |
| createdAt | TEXT | |

---

## Submissions & Judging

### `submissions`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK, UUID |
| hackathonId | TEXT | FK → hackathons |
| teamId | TEXT | FK → teams |
| roundId | TEXT | NULLABLE FK → hackathonRounds |
| tagName | TEXT | NOT NULL |
| commitSha | TEXT | NOT NULL |
| submittedAt | TEXT | NOT NULL |
| status | TEXT | pending_validation \| validated \| failed_validation \| tag_deleted |
| validatedAt | TEXT | NULLABLE |
| validationResults | TEXT | JSON |
| deliveryId | TEXT | UNIQUE (GitHub webhook delivery ID) |
| isCurrent | INTEGER | DEFAULT 1 |
| createdAt | TEXT | |

### `judges`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| hackathonId | TEXT | FK → hackathons |
| userId | TEXT | NULLABLE FK → users |
| email | TEXT | NOT NULL |
| inviteStatus | TEXT | pending \| accepted \| declined |
| inviteToken | TEXT | UNIQUE |
| invitedBy | TEXT | FK → users |
| createdAt / acceptedAt | TEXT | |
| — | — | UNIQUE(hackathonId, userId) |

### `judgeAssignments`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| hackathonId | TEXT | FK → hackathons |
| judgeId | TEXT | FK → judges |
| teamId | TEXT | FK → teams |
| submissionId | TEXT | NULLABLE FK → submissions |
| round | INTEGER | DEFAULT 1 |
| status | TEXT | assigned \| completed \| conflict |
| assignedAt / completedAt | TEXT | |
| — | — | UNIQUE(judgeId, teamId, round) |

### `rubricCriteria`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| hackathonId | TEXT | FK → hackathons |
| trackId | TEXT | NULLABLE |
| round | INTEGER | NULLABLE |
| name | TEXT | NOT NULL |
| description | TEXT | NULLABLE |
| maxScore | INTEGER | DEFAULT 10 |
| weight | REAL | NOT NULL |
| sortOrder | INTEGER | DEFAULT 0 |
| createdAt | TEXT | |
| — | — | UNIQUE(hackathonId, name, trackId, round) |

### `scores`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| submissionId | TEXT | FK → submissions |
| judgeId | TEXT | FK → judges |
| criteriaId | TEXT | FK → rubricCriteria |
| assignmentId | TEXT | FK → judgeAssignments |
| score | REAL | NOT NULL |
| comment | TEXT | NULLABLE |
| round | INTEGER | |
| scoredAt | TEXT | |
| — | — | UNIQUE(submissionId, judgeId, criteriaId, round) |

### `roundResults`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| hackathonId | TEXT | FK → hackathons |
| roundId | TEXT | FK → hackathonRounds |
| teamId | TEXT | FK → teams |
| status | TEXT | advanced \| eliminated |
| rank | INTEGER | |
| totalScore | REAL | |
| decidedBy | TEXT | FK → users |
| createdAt | TEXT | |
| — | — | UNIQUE(roundId, teamId) |

---

## GitHub Integration

### `commitLog`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| teamRepoId | TEXT | FK → teamRepos |
| commitSha / commitMessage | TEXT | |
| authorLogin / authorEmail | TEXT | NULLABLE |
| committedAt / pushedAt / createdAt | TEXT | |

### `forcePushEvents`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| teamRepoId | TEXT | FK → teamRepos |
| beforeSha / afterSha / ref / pusherLogin | TEXT | |
| detectedAt / createdAt | TEXT | |

### `webhookDeliveries`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| githubDeliveryId | TEXT | UNIQUE |
| eventType / status / errorMessage | TEXT | |
| receivedAt / processedAt | TEXT | |

### `pendingInstallations`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| provider / repoFullName / installationId / installedBy | TEXT | |
| createdAt | TEXT | |

---

## Notifications & Audit

### `inAppNotifications`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| userId | TEXT | FK → users |
| hackathonId | TEXT | NULLABLE FK → hackathons |
| type / title / body / link | TEXT | |
| readAt | TEXT | NULLABLE |
| createdAt | TEXT | |

### `auditEvents`
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT | PK |
| hackathonId | TEXT | NULLABLE FK → hackathons |
| actorId | TEXT | NULLABLE FK → users |
| actorType | TEXT | user \| system \| bot \| cron |
| eventType / entityType / entityId | TEXT | |
| metadata / changes | TEXT | JSON |
| hash | TEXT | SHA-256 |
| prevHash | TEXT | Previous event's hash (chain) |
| createdAt | TEXT | |

### `notificationDeliveries` / `notificationIdempotency`
Delivery tracking and idempotency for the notification queue.
