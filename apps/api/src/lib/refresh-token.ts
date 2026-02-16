const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const GRACE_PERIOD_MS = 2000; // 2s grace for concurrent requests

export function generateRefreshToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateFamilyId(): string {
  return crypto.randomUUID();
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getRefreshTokenExpiry(): string {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return expiry.toISOString();
}

export async function createRefreshToken(
  db: D1Database,
  userId: string,
  familyId: string
): Promise<string> {
  const token = generateRefreshToken();
  const tokenHash = await hashToken(token);
  const id = crypto.randomUUID();
  const expiresAt = getRefreshTokenExpiry();

  await db.prepare(
    `INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, userId, familyId, tokenHash, expiresAt, new Date().toISOString()).run();

  return token;
}

export async function rotateRefreshToken(
  db: D1Database,
  oldToken: string,
  userId: string
): Promise<{ token: string; familyId: string } | null> {
  const oldHash = await hashToken(oldToken);

  // Find the existing token
  const existing = await db.prepare(
    `SELECT id, user_id, family_id, revoked_at, expires_at, created_at FROM refresh_tokens WHERE token_hash = ?`
  ).bind(oldHash).first<{
    id: string;
    user_id: string;
    family_id: string;
    revoked_at: string | null;
    expires_at: string;
    created_at: string;
  }>();

  if (!existing) return null;
  if (existing.user_id !== userId) return null;

  // Check if expired
  if (new Date(existing.expires_at) < new Date()) return null;

  // Replay detection: if already revoked, revoke entire family
  if (existing.revoked_at) {
    // Check grace period
    const revokedAt = new Date(existing.revoked_at).getTime();
    const now = Date.now();
    if (now - revokedAt > GRACE_PERIOD_MS) {
      // Revoke entire family — replay attack
      await db.prepare(
        `UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL`
      ).bind(new Date().toISOString(), existing.family_id).run();
      return null;
    }
    // Within grace period — allow (concurrent request)
  }

  // Revoke old token
  await db.prepare(
    `UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?`
  ).bind(new Date().toISOString(), existing.id).run();

  // Issue new token in same family
  const newToken = await createRefreshToken(db, userId, existing.family_id);

  return { token: newToken, familyId: existing.family_id };
}

export async function revokeTokenFamily(db: D1Database, familyId: string): Promise<void> {
  await db.prepare(
    `UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL`
  ).bind(new Date().toISOString(), familyId).run();
}

export async function revokeAllUserTokens(db: D1Database, userId: string): Promise<void> {
  await db.prepare(
    `UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`
  ).bind(new Date().toISOString(), userId).run();
}
