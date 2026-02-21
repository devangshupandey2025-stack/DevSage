const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const GRACE_PERIOD_MS = 2000;

export function generateFamilyId(): string {
  return crypto.randomUUID();
}

function generateRefreshToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashToken(token: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getRefreshTokenExpiry(): string {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return expiry.toISOString();
}

export async function createRefreshToken(db: D1Database, userId: string, familyId: string): Promise<string> {
  const token = generateRefreshToken();
  const tokenHash = await hashToken(token);
  await db.prepare(
    `INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    userId,
    familyId,
    tokenHash,
    getRefreshTokenExpiry(),
    new Date().toISOString(),
  ).run();
  return token;
}

export async function rotateRefreshToken(
  db: D1Database,
  oldToken: string,
  userId: string,
): Promise<{ token: string; familyId: string } | null> {
  const oldHash = await hashToken(oldToken);
  const existing = await db.prepare(
    `SELECT id, user_id, family_id, revoked_at, expires_at
     FROM refresh_tokens
     WHERE token_hash = ?`,
  ).bind(oldHash).first<{
    id: string;
    user_id: string;
    family_id: string;
    revoked_at: string | null;
    expires_at: string;
  }>();

  if (!existing || existing.user_id !== userId) return null;
  if (new Date(existing.expires_at) < new Date()) return null;

  if (existing.revoked_at) {
    const revokedAt = new Date(existing.revoked_at).getTime();
    if (Date.now() - revokedAt > GRACE_PERIOD_MS) {
      await db.prepare(
        `UPDATE refresh_tokens
         SET revoked_at = ?
         WHERE family_id = ? AND revoked_at IS NULL`,
      ).bind(new Date().toISOString(), existing.family_id).run();
      return null;
    }
  }

  await db.prepare(
    `UPDATE refresh_tokens
     SET revoked_at = ?
     WHERE id = ?`,
  ).bind(new Date().toISOString(), existing.id).run();

  const nextToken = await createRefreshToken(db, userId, existing.family_id);
  return { token: nextToken, familyId: existing.family_id };
}

export async function revokeTokenFamily(db: D1Database, familyId: string): Promise<void> {
  await db.prepare(
    `UPDATE refresh_tokens
     SET revoked_at = ?
     WHERE family_id = ? AND revoked_at IS NULL`,
  ).bind(new Date().toISOString(), familyId).run();
}

export async function revokeAllUserTokens(db: D1Database, userId: string): Promise<void> {
  await db.prepare(
    `UPDATE refresh_tokens
     SET revoked_at = ?
     WHERE user_id = ? AND revoked_at IS NULL`,
  ).bind(new Date().toISOString(), userId).run();
}
