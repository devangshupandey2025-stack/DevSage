import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse } from '../lib/response.js';
import { authMiddleware } from '../middleware/auth.js';
import { insertAuditEvent } from '../lib/audit.js';
import { validateBody } from '../lib/validate.js';

const twoFactor = new Hono<AppEnv>();
twoFactor.use('/*', authMiddleware);

// ── Base32 Codec (RFC 4648) ────────────────────────────────────────

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      output += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return output;
}

function base32Decode(encoded: string): Uint8Array {
  const cleaned = encoded.replace(/=+$/, '').toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

// ── TOTP Implementation (RFC 6238 / RFC 4226) ─────────────────────

/**
 * Generate a TOTP code for the given secret and time counter.
 * Uses HMAC-SHA1 with dynamic truncation per RFC 4226.
 */
async function generateTOTP(secret: Uint8Array, counter: number): Promise<string> {
  // Encode counter as 8-byte big-endian
  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  // HMAC-SHA1
  const key = await crypto.subtle.importKey(
    'raw',
    secret.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, counterBytes.buffer as ArrayBuffer);
  const hmac = new Uint8Array(signature);

  // Dynamic truncation (RFC 4226 section 5.4)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1_000_000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verify a TOTP code against the secret with +/- 1 time-step drift.
 * Returns true if the code matches any of the 3 windows.
 */
async function verifyTOTP(secret: Uint8Array, code: string): Promise<boolean> {
  const counter = Math.floor(Date.now() / 30_000);

  for (const offset of [-1, 0, 1]) {
    const expected = await generateTOTP(secret, counter + offset);
    if (timingSafeEqual(expected, code)) {
      return true;
    }
  }

  return false;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ── Backup Code Helpers ────────────────────────────────────────────

const BACKUP_CODE_LENGTH = 8;
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const bytes = new Uint8Array(BACKUP_CODE_LENGTH);
    crypto.getRandomValues(bytes);
    let code = '';
    for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
      // Rejection sampling to avoid modulo bias
      let val = bytes[j];
      while (val >= 252) {
        // 252 is the largest multiple of 36 that fits in a byte (36*7=252)
        const fresh = new Uint8Array(1);
        crypto.getRandomValues(fresh);
        val = fresh[0];
      }
      code += BACKUP_CODE_CHARS[val % BACKUP_CODE_CHARS.length];
    }
    codes.push(code);
  }
  return codes;
}

async function hashBackupCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(code));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Zod Schemas ────────────────────────────────────────────────────

const totpCodeSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/, 'Must be a 6-digit code'),
});

const backupCodeSchema = z.object({
  code: z.string().min(1),
});

// ── Routes ─────────────────────────────────────────────────────────

/**
 * POST /enroll
 * Generate TOTP secret and backup codes. Does not activate 2FA until /verify.
 */
twoFactor.post('/enroll', async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;

  // Check if user already has TOTP enabled
  const existing = await db
    .prepare('SELECT id, enabled FROM user_totp_secrets WHERE user_id = ? LIMIT 1')
    .bind(user.id)
    .first<{ id: string; enabled: number }>();

  if (existing?.enabled) {
    return errorResponse(c, 409, 'TOTP_ALREADY_ENABLED', '2FA is already enabled. Disable it first to re-enroll.');
  }

  // If there is a pending (not yet enabled) enrollment, delete it to allow re-enrollment
  if (existing && !existing.enabled) {
    await db.batch([
      db.prepare('DELETE FROM backup_codes WHERE user_id = ?').bind(user.id),
      db.prepare('DELETE FROM user_totp_secrets WHERE user_id = ?').bind(user.id),
    ]);
  }

  // Generate 20-byte secret (160 bits, standard for TOTP)
  const secretBytes = new Uint8Array(20);
  crypto.getRandomValues(secretBytes);
  const secret = base32Encode(secretBytes);

  // Store secret (not yet enabled)
  const secretId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO user_totp_secrets (id, user_id, secret, enabled, created_at)
       VALUES (?, ?, ?, 0, ?)`,
    )
    .bind(secretId, user.id, secret, now)
    .run();

  // Generate and hash backup codes
  const plaintextCodes = generateBackupCodes();
  const insertStatements = [];
  for (const code of plaintextCodes) {
    const codeHash = await hashBackupCode(code);
    const codeId = crypto.randomUUID();
    insertStatements.push(
      db
        .prepare(
          `INSERT INTO backup_codes (id, user_id, code_hash, created_at)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(codeId, user.id, codeHash, now),
    );
  }
  await db.batch(insertStatements);

  // Build otpauth URI
  const otpauthUri = `otpauth://totp/DevSage:${encodeURIComponent(user.email)}?secret=${secret}&issuer=DevSage`;

  c.executionCtx.waitUntil(
    insertAuditEvent(db, {
      actor_id: user.id,
      actor_type: 'user',
      action: 'auth.totp_enrolled',
      entity_type: 'user',
      entity_id: user.id,
    }),
  );

  return successResponse(
    c,
    {
      secret,
      otpauth_uri: otpauthUri,
      backup_codes: plaintextCodes,
    },
    { status: 201 },
  );
});

/**
 * POST /verify
 * Verify a TOTP code to activate 2FA after enrollment.
 */
twoFactor.post('/verify', async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;

  const body = await validateBody(c, totpCodeSchema);
  if (body instanceof Response) return body;

  // Load pending (not yet enabled) TOTP secret
  const record = await db
    .prepare('SELECT id, secret, enabled FROM user_totp_secrets WHERE user_id = ? LIMIT 1')
    .bind(user.id)
    .first<{ id: string; secret: string; enabled: number }>();

  if (!record) {
    return errorResponse(c, 404, 'TOTP_NOT_ENROLLED', 'No pending 2FA enrollment found. Call /enroll first.');
  }

  if (record.enabled) {
    return errorResponse(c, 409, 'TOTP_ALREADY_ENABLED', '2FA is already enabled.');
  }

  // Verify the TOTP code
  const secretBytes = base32Decode(record.secret);
  const valid = await verifyTOTP(secretBytes, body.code);

  if (!valid) {
    return errorResponse(c, 400, 'INVALID_TOTP_CODE', 'Invalid verification code. Please try again.');
  }

  // Activate 2FA
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare('UPDATE user_totp_secrets SET enabled = 1, enabled_at = ? WHERE id = ?')
      .bind(now, record.id),
    db
      .prepare('UPDATE users SET totp_enabled = 1, updated_at = ? WHERE id = ?')
      .bind(now, user.id),
  ]);

  c.executionCtx.waitUntil(
    insertAuditEvent(db, {
      actor_id: user.id,
      actor_type: 'user',
      action: 'auth.totp_enabled',
      entity_type: 'user',
      entity_id: user.id,
    }),
  );

  return successResponse(c, { enabled: true });
});

/**
 * POST /validate
 * Validate a TOTP code during login (called after password verification).
 */
twoFactor.post('/validate', async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;

  const body = await validateBody(c, totpCodeSchema);
  if (body instanceof Response) return body;

  // Load enabled TOTP secret
  const record = await db
    .prepare('SELECT secret FROM user_totp_secrets WHERE user_id = ? AND enabled = 1 LIMIT 1')
    .bind(user.id)
    .first<{ secret: string }>();

  if (!record) {
    return errorResponse(c, 404, 'TOTP_NOT_ENABLED', '2FA is not enabled for this account.');
  }

  const secretBytes = base32Decode(record.secret);
  const valid = await verifyTOTP(secretBytes, body.code);

  return successResponse(c, { valid });
});

/**
 * POST /recover
 * Use a backup code when TOTP device is unavailable.
 */
twoFactor.post('/recover', async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;

  const body = await validateBody(c, backupCodeSchema);
  if (body instanceof Response) return body;

  // Verify 2FA is enabled
  const totpRecord = await db
    .prepare('SELECT id FROM user_totp_secrets WHERE user_id = ? AND enabled = 1 LIMIT 1')
    .bind(user.id)
    .first<{ id: string }>();

  if (!totpRecord) {
    return errorResponse(c, 404, 'TOTP_NOT_ENABLED', '2FA is not enabled for this account.');
  }

  // Hash the provided code and look for an unused match
  const codeHash = await hashBackupCode(body.code.trim().toLowerCase());

  const match = await db
    .prepare(
      'SELECT id FROM backup_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL LIMIT 1',
    )
    .bind(user.id, codeHash)
    .first<{ id: string }>();

  if (!match) {
    return errorResponse(c, 400, 'INVALID_BACKUP_CODE', 'Invalid or already used backup code.');
  }

  // Mark as used
  const now = new Date().toISOString();
  await db
    .prepare('UPDATE backup_codes SET used_at = ? WHERE id = ?')
    .bind(now, match.id)
    .run();

  // Count remaining unused codes
  const remaining = await db
    .prepare(
      'SELECT COUNT(*) as count FROM backup_codes WHERE user_id = ? AND used_at IS NULL',
    )
    .bind(user.id)
    .first<{ count: number }>();

  c.executionCtx.waitUntil(
    insertAuditEvent(db, {
      actor_id: user.id,
      actor_type: 'user',
      action: 'auth.backup_code_used',
      entity_type: 'user',
      entity_id: user.id,
      details: { remaining: remaining?.count ?? 0 },
    }),
  );

  return successResponse(c, { valid: true, remaining: remaining?.count ?? 0 });
});

/**
 * DELETE /
 * Disable 2FA. Requires a valid TOTP code for confirmation.
 */
twoFactor.delete('/', async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;

  const body = await validateBody(c, totpCodeSchema);
  if (body instanceof Response) return body;

  // Load enabled TOTP secret
  const record = await db
    .prepare('SELECT secret FROM user_totp_secrets WHERE user_id = ? AND enabled = 1 LIMIT 1')
    .bind(user.id)
    .first<{ secret: string }>();

  if (!record) {
    return errorResponse(c, 404, 'TOTP_NOT_ENABLED', '2FA is not enabled for this account.');
  }

  // Verify the TOTP code before allowing disable
  const secretBytes = base32Decode(record.secret);
  const valid = await verifyTOTP(secretBytes, body.code);

  if (!valid) {
    return errorResponse(c, 400, 'INVALID_TOTP_CODE', 'Invalid verification code. Cannot disable 2FA.');
  }

  // Remove all TOTP data and backup codes
  const now = new Date().toISOString();
  await db.batch([
    db.prepare('DELETE FROM backup_codes WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM user_totp_secrets WHERE user_id = ?').bind(user.id),
    db
      .prepare('UPDATE users SET totp_enabled = 0, updated_at = ? WHERE id = ?')
      .bind(now, user.id),
  ]);

  c.executionCtx.waitUntil(
    insertAuditEvent(db, {
      actor_id: user.id,
      actor_type: 'user',
      action: 'auth.totp_disabled',
      entity_type: 'user',
      entity_id: user.id,
    }),
  );

  return successResponse(c, { disabled: true });
});

export default twoFactor;
