import type { Context } from 'hono';

export async function generateETag(data: unknown): Promise<string> {
  const encoder = new TextEncoder();
  const content = JSON.stringify(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(content));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `W/"${hashHex.slice(0, 16)}"`;
}

export function checkConditionalRequest(c: Context, etag: string): Response | null {
  const ifNoneMatch = c.req.header('If-None-Match');
  if (ifNoneMatch && ifNoneMatch === etag) {
    return c.body(null, 304);
  }
  return null;
}
