import { PASSWORD } from './constants.js';

const HASH_ALGORITHM = 'SHA-256';

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PASSWORD.PBKDF2_ITERATIONS,
      hash: HASH_ALGORITHM,
    },
    keyMaterial,
    PASSWORD.KEY_BYTES * 8,
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(PASSWORD.SALT_BYTES);
  crypto.getRandomValues(salt);
  const hash = await deriveKey(password, salt);
  return `${toBase64(salt.buffer as ArrayBuffer)}:${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;

  const salt = fromBase64(parts[0]);
  const expectedHash = fromBase64(parts[1]);
  const actualHash = new Uint8Array(await deriveKey(password, salt));
  if (actualHash.length !== expectedHash.length) return false;

  const expectedKey = await crypto.subtle.importKey(
    'raw',
    expectedHash.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const actualKey = await crypto.subtle.importKey(
    'raw',
    actualHash.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
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
  for (let i = 0; i < a.length; i += 1) result |= a[i] ^ b[i];
  return result === 0;
}
