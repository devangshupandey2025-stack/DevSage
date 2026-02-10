export interface JWTPayload {
  sub: string;   // user UUID
  ghid: number;  // GitHub user ID
  ghu: string;   // GitHub username
  iat: number;   // issued at
  exp: number;   // expiration
}

interface JWTHeader {
  alg: 'HS256';
  typ: 'JWT';
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signJWT(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  secret: string,
  expiresInSeconds = 7 * 24 * 60 * 60
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header: JWTHeader = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = toBase64Url(encoder.encode(JSON.stringify(header)));
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(fullPayload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
  const encodedSignature = toBase64Url(new Uint8Array(signature));

  return `${signingInput}.${encodedSignature}`;
}

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  try {
    const headerBytes = fromBase64Url(encodedHeader);
    const header = JSON.parse(decoder.decode(headerBytes)) as Partial<JWTHeader>;
    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      return null;
    }

    const key = await importSigningKey(secret);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(encodedSignature) as BufferSource,
      encoder.encode(`${encodedHeader}.${encodedPayload}`) as BufferSource
    );

    if (!isValid) {
      return null;
    }

    const payload = JSON.parse(decoder.decode(fromBase64Url(encodedPayload))) as Partial<JWTPayload>;
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.ghid !== 'number' ||
      typeof payload.ghu !== 'string' ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      return null;
    }

    return payload as JWTPayload;
  } catch {
    return null;
  }
}
