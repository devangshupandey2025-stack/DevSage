# Workspaces API

Base path: `/api/v1/workspaces`

All endpoints require authentication (`access_token` cookie).

## Roles

Workspace members have one of three roles:

| Role | Permissions |
|---|---|
| `owner` | Full access. Can update workspace, invite members, remove members. Cannot remove self. |
| `admin` | Can update workspace and invite members. Cannot remove members. |
| `member` | Read-only access to workspace and member list. |

The user who creates a workspace is automatically assigned the `owner` role.

---

## POST /api/v1/workspaces

Create a new workspace. The authenticated user becomes the owner.

**Auth:** Required

**Request Body:**

```json
{
  "name": "My Organization",
  "slug": "my-org",
  "type": "organization",
  "description": "Optional description"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Display name |
| `slug` | string | Yes | URL-safe unique identifier |
| `type` | string | Yes | Workspace type (e.g. `organization`) |
| `description` | string | No | Optional description |

**Success Response (201):**

```json
{
  "ok": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Organization",
    "slug": "my-org",
    "description": "Optional description",
    "type": "organization",
    "created_by": "user-uuid",
    "created_at": "2025-01-15T10:30:00.000Z",
    "updated_at": "2025-01-15T10:30:00.000Z"
  }
}
```

**Errors:**

| Status | Code | Message |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Name, slug, and type are required |
| 401 | `AUTH_REQUIRED` | Not authenticated |
| 409 | `SLUG_TAKEN` | Slug already in use |

---

## GET /api/v1/workspaces

List all workspaces the authenticated user is a member of.

**Auth:** Required

**Query Parameters:** None

**Success Response (200):**

```json
{
  "ok": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "My Organization",
      "slug": "my-org",
      "description": "Optional description",
      "type": "organization",
      "created_by": "user-uuid",
      "created_at": "2025-01-15T10:30:00.000Z",
      "updated_at": "2025-01-15T10:30:00.000Z",
      "member_role": "owner"
    }
  ]
}
```

Each workspace object includes a `member_role` field indicating the user's role. Results are ordered by `created_at` descending.

**Errors:**

| Status | Code | Message |
|---|---|---|
| 401 | `AUTH_REQUIRED` | Not authenticated |

---

## GET /api/v1/workspaces/:workspaceId

Get a single workspace by ID.

**Auth:** Required

**Path Parameters:**

| Param | Type | Description |
|---|---|---|
| `workspaceId` | string (UUID) | Workspace ID |

**Success Response (200):**

```json
{
  "ok": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Organization",
    "slug": "my-org",
    "description": "Optional description",
    "type": "organization",
    "created_by": "user-uuid",
    "created_at": "2025-01-15T10:30:00.000Z",
    "updated_at": "2025-01-15T10:30:00.000Z"
  }
}
```

**Errors:**

| Status | Code | Message |
|---|---|---|
| 401 | `AUTH_REQUIRED` | Not authenticated |
| 404 | `NOT_FOUND` | Workspace not found |

---

## PATCH /api/v1/workspaces/:workspaceId

Update a workspace. Only `owner` and `admin` roles may update.

**Auth:** Required (owner or admin)

**Path Parameters:**

| Param | Type | Description |
|---|---|---|
| `workspaceId` | string (UUID) | Workspace ID |

**Request Body:**

```json
{
  "name": "Updated Name",
  "description": "New description"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | No | Updated display name |
| `description` | string | No | Updated description |

Only `name` and `description` are updatable. At least one field must be provided. The `slug` and `type` cannot be changed after creation.

**Success Response (200):**

```json
{
  "ok": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Updated Name",
    "slug": "my-org",
    "description": "New description",
    "type": "organization",
    "created_by": "user-uuid",
    "created_at": "2025-01-15T10:30:00.000Z",
    "updated_at": "2025-01-15T12:00:00.000Z"
  }
}
```

**Errors:**

| Status | Code | Message |
|---|---|---|
| 400 | `VALIDATION_ERROR` | No fields to update |
| 401 | `AUTH_REQUIRED` | Not authenticated |
| 403 | `FORBIDDEN` | Must be owner or admin |

---

## GET /api/v1/workspaces/:workspaceId/members

List all members of a workspace.

**Auth:** Required

**Path Parameters:**

| Param | Type | Description |
|---|---|---|
| `workspaceId` | string (UUID) | Workspace ID |

**Success Response (200):**

```json
{
  "ok": true,
  "data": [
    {
      "id": "member-uuid",
      "user_id": "user-uuid",
      "role": "owner",
      "created_at": "2025-01-15T10:30:00.000Z",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "avatar_url": "https://example.com/avatar.jpg"
    }
  ]
}
```

Results are ordered by `created_at` ascending (earliest members first).

**Errors:**

| Status | Code | Message |
|---|---|---|
| 401 | `AUTH_REQUIRED` | Not authenticated |

---

## POST /api/v1/workspaces/:workspaceId/invites

Invite a user to the workspace by email. Only `owner` and `admin` roles may invite.

**Auth:** Required (owner or admin)

**Path Parameters:**

| Param | Type | Description |
|---|---|---|
| `workspaceId` | string (UUID) | Workspace ID |

**Request Body:**

```json
{
  "email": "newmember@example.com",
  "role": "member"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | Yes | Email of the user to invite |
| `role` | string | Yes | Role to assign (`owner`, `admin`, or `member`) |

Invites expire after **7 days**.

**Success Response (201):**

```json
{
  "ok": true,
  "data": {
    "id": "invite-uuid",
    "invite_token": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
  }
}
```

**Errors:**

| Status | Code | Message |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Email and role required |
| 401 | `AUTH_REQUIRED` | Not authenticated |
| 403 | `FORBIDDEN` | Must be owner or admin |

---

## DELETE /api/v1/workspaces/:workspaceId/members/:userId

Remove a member from the workspace. Only the `owner` can remove members. Owners cannot remove themselves.

**Auth:** Required (owner only)

**Path Parameters:**

| Param | Type | Description |
|---|---|---|
| `workspaceId` | string (UUID) | Workspace ID |
| `userId` | string (UUID) | User ID of the member to remove |

**Success Response (200):**

```json
{
  "ok": true,
  "data": {
    "removed": true
  }
}
```

**Errors:**

| Status | Code | Message |
|---|---|---|
| 401 | `AUTH_REQUIRED` | Not authenticated |
| 403 | `FORBIDDEN` | Only owner can remove members |
| 409 | `CANNOT_REMOVE_SELF` | Cannot remove yourself |
