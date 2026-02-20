import type { JWTPayload } from '../types/auth.js';

const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes

function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getKey(secret: string): Promise<CryptoKey> {
  if (!secret || secret.length === 0) {
    throw new Error('JWT_SECRET is not set. Set process env JWT_SECRET for development or configure your Worker secret.');
  }
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    ALGORITHM,
    false,
    ['sign', 'verify']
  );
}

export async function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRY,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encoder = new TextEncoder();

  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(fullPayload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  try {
    const key = await getKey(secret);
    const signature = await crypto.subtle.sign(ALGORITHM, key, encoder.encode(signingInput));
    return `${signingInput}.${base64UrlEncode(signature)}`;
  } catch (err) {
    throw new Error(`signJWT failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;

  try {
    const key = await getKey(secret);
    const encoder = new TextEncoder();
    const signature = base64UrlDecode(signatureB64);

    const valid = await crypto.subtle.verify(ALGORITHM, key, signature.buffer as ArrayBuffer, encoder.encode(signingInput));
    if (!valid) return null;
  } catch (err) {
    throw new Error(`verifyJWT failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const decoder = new TextDecoder();
    const payload: JWTPayload = JSON.parse(decoder.decode(base64UrlDecode(payloadB64)));

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return null;

    return payload;
  } catch {
    return null;
  }
}
