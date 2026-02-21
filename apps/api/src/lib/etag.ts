export async function generateETag(data: unknown): Promise<string> {
  const encoder = new TextEncoder();
  const content = JSON.stringify(data);
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(content));
  const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `"${hex.slice(0, 32)}"`;
}

export function checkConditionalRequest(
  ifNoneMatch: string | undefined,
  etag: string
): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch === etag || ifNoneMatch === `W/${etag}`;
}
