const ITERATIONS = 100_000;
const HASH_ALGORITHM = 'SHA-256';
const KEY_LENGTH_BYTES = 32;
const SALT_LENGTH_BYTES = 16;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: ITERATIONS,
      hash: HASH_ALGORITHM,
    },
    keyMaterial,
    KEY_LENGTH_BYTES * 8
  );
}

/**
 * Hash a password using PBKDF2 with a random salt.
 * Storage format: `base64salt:base64hash`
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(SALT_LENGTH_BYTES);
  crypto.getRandomValues(salt);

  const hash = await deriveKey(password, salt);

  return `${toBase64(salt.buffer as ArrayBuffer)}:${toBase64(hash)}`;
}

/**
 * Verify a password against a stored `base64salt:base64hash` string.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;

  const salt = fromBase64(parts[0]);
  const expectedHash = fromBase64(parts[1]);

  const actualHash = new Uint8Array(await deriveKey(password, salt));

  if (actualHash.length !== expectedHash.length) return false;

  // Timing-safe: compare HMAC signatures derived from both hashes
  const expectedKey = await crypto.subtle.importKey(
    'raw',
    expectedHash.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const actualKey = await crypto.subtle.importKey(
    'raw',
    actualHash.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const message = new TextEncoder().encode('verify');
  const [sig1, sig2] = await Promise.all([
    crypto.subtle.sign('HMAC', expectedKey, message),
    crypto.subtle.sign('HMAC', actualKey, message),
  ]);

  const a = new Uint8Array(sig1);
  const b = new Uint8Array(sig2);
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}
