# Auth API

Base path: `/auth`

All auth endpoints are rate-limited (`auth` tier). Authentication uses dual-token cookies: a 15-minute access JWT and a 30-day rotating refresh token, both set as `HttpOnly; Secure; SameSite=None`.

## Password Hashing

Passwords are hashed with **PBKDF2** using `crypto.subtle`:

- **Algorithm:** SHA-256
- **Iterations:** 100,000
- **Key length:** 32 bytes
- **Salt:** 16 random bytes per password
- **Storage format:** `base64salt:base64hash`
- **Verification:** Timing-safe comparison via HMAC signature check

## Cookies

| Cookie | Path | Max Age | Notes |
|---|---|---|---|
| `access_token` | `/` | 15 minutes | JWT with `{ sub, fam, iat, exp }` |
| `refresh_token` | `/auth/refresh` | 30 days | Opaque token, family-based rotation |

Both cookies: `HttpOnly`, `Secure`, `SameSite=None`.

---

## POST /auth/register

Create a new user account.

**Auth:** None

**Request Body:**

```json
{
  "email": "user@example.com",
  "name": "Jane Doe",
  "password": "securepass123"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `email` | string | Yes | Must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, trimmed and lowercased |
| `name` | string | Yes | Non-empty after trim |
| `password` | string | Yes | Minimum 8 characters |

**Success Response (201):**

```json
{
  "ok": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "Jane Doe"
  }
}
```

Sets `access_token` and `refresh_token` cookies.

**Errors:**

| Status | Code | Message |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Valid email is required |
| 400 | `VALIDATION_ERROR` | Name is required |
| 400 | `VALIDATION_ERROR` | Password must be at least 8 characters |
| 409 | `CONFLICT` | Email already registered |

---

## POST /auth/login

Authenticate with email and password.

**Auth:** None

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securepass123"
}
```

| Field | Type | Required |
|---|---|---|
| `email` | string | Yes |
| `password` | string | Yes |

**Success Response (200):**

```json
{
  "ok": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "Jane Doe"
  }
}
```

Sets `access_token` and `refresh_token` cookies. Updates `last_login_at` on the user record.

**Errors:**

| Status | Code | Message |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Email and password are required |
| 401 | `INVALID_CREDENTIALS` | Invalid email or password |

---

## POST /auth/refresh

Rotate the refresh token and issue a new access token. Reads tokens from cookies automatically.

**Auth:** None (uses `refresh_token` cookie)

**Request Body:** None

**Success Response (200):**

```json
{
  "ok": true,
  "data": {
    "refreshed": true
  }
}
```

Sets new `access_token` and `refresh_token` cookies. The old refresh token is invalidated (family-based rotation with replay detection).

**Errors:**

| Status | Code | Message |
|---|---|---|
| 401 | `AUTH_REQUIRED` | No refresh token |
| 401 | `AUTH_REQUIRED` | Invalid refresh token |
| 401 | `TOKEN_EXPIRED` | Refresh token expired or revoked |
| 401 | `AUTH_REQUIRED` | User not found |

---

## POST /auth/logout

Log out the current session by revoking the token family and clearing cookies.

**Auth:** Required (`access_token` cookie)

**Request Body:** None

**Success Response (200):**

```json
{
  "ok": true,
  "data": {
    "logged_out": true
  }
}
```

Clears `access_token` and `refresh_token` cookies. Revokes the current token family.

**Errors:**

| Status | Code | Message |
|---|---|---|
| 401 | `AUTH_REQUIRED` | Not authenticated |

---

## GET /auth/me

Get the current user's profile and platform roles.

**Auth:** Required

**Success Response (200):**

```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "Jane Doe",
      "avatar_url": "https://example.com/avatar.jpg",
      "created_at": "2025-01-15T10:30:00.000Z"
    },
    "roles": [],
    "isPlatformAdmin": false,
    "isOrganizer": false
  }
}
```

| Field | Type | Description |
|---|---|---|
| `user` | object | User profile fields |
| `roles` | array | Reserved for future per-hackathon roles |
| `isPlatformAdmin` | boolean | `true` if user is in the `platform_admins` table |
| `isOrganizer` | boolean | `true` if user has any entry in `organizer_roles` |

**Errors:**

| Status | Code | Message |
|---|---|---|
| 401 | `AUTH_REQUIRED` | Not authenticated |

---

## GET /auth/sessions

List all active sessions (token families) for the current user.

**Auth:** Required

**Success Response (200):**

```json
{
  "ok": true,
  "data": [
    {
      "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "created_at": "2025-01-15T10:30:00.000Z",
      "expires_at": "2025-02-14T10:30:00.000Z"
    }
  ]
}
```

Returns only non-revoked sessions that have not expired.

**Errors:**

| Status | Code | Message |
|---|---|---|
| 401 | `AUTH_REQUIRED` | Not authenticated |

---

## DELETE /auth/sessions/:familyId

Revoke a specific session by its token family ID.

**Auth:** Required

**Path Parameters:**

| Param | Type | Description |
|---|---|---|
| `familyId` | string (UUID) | The `family_id` of the session to revoke |

**Success Response (200):**

```json
{
  "ok": true,
  "data": {
    "revoked": true
  }
}
```

**Errors:**

| Status | Code | Message |
|---|---|---|
| 401 | `AUTH_REQUIRED` | Not authenticated |
| 404 | `NOT_FOUND` | Session not found |

The session must belong to the authenticated user.

---

## DELETE /auth/sessions

Revoke all sessions for the current user and clear cookies. Effectively logs out everywhere.

**Auth:** Required

**Success Response (200):**

```json
{
  "ok": true,
  "data": {
    "revoked_all": true
  }
}
```

Clears `access_token` and `refresh_token` cookies.

**Errors:**

| Status | Code | Message |
|---|---|---|
| 401 | `AUTH_REQUIRED` | Not authenticated |

---

## POST /auth/delete-account

Request account deletion. Creates a pending deletion request and returns a confirmation token.

**Auth:** Required

**Request Body:** None

**Success Response (201):**

```json
{
  "ok": true,
  "data": {
    "confirmation_token": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
  }
}
```

In production, the confirmation token would be sent via email. The token must be passed to the confirm endpoint to complete deletion.

**Errors:**

| Status | Code | Message |
|---|---|---|
| 401 | `AUTH_REQUIRED` | Not authenticated |

---

## POST /auth/delete-account/confirm

Confirm and execute account deletion. Revokes all tokens, clears cookies, and deletes the user record (cascading to related data).

**Auth:** Required

**Request Body:**

```json
{
  "confirmation_token": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `confirmation_token` | string | Yes | Token received from `POST /auth/delete-account` |

**Success Response (200):**

```json
{
  "ok": true,
  "data": {
    "deleted": true
  }
}
```

Clears all auth cookies. The deletion request must be in `pending` status.

**Errors:**

| Status | Code | Message |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Confirmation token required |
| 401 | `AUTH_REQUIRED` | Not authenticated |
| 404 | `NOT_FOUND` | Invalid or expired confirmation |
