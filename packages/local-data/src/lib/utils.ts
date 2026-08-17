/**
 * Small shared helpers for the local data layer.
 */

import { db } from "../db/database.js";
import type { MetaRecord } from "../db/schema.js";

/** UTC ISO-8601 timestamp. */
export function now(): string {
  return new Date().toISOString();
}

/** Stable-ish uuid for locally created records (crypto.randomUUID where available). */
export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Deterministic fallback for environments without crypto.randomUUID.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** SHA-256 hex digest via Web Crypto (Node 20+ and browsers). */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Meta helpers
// ---------------------------------------------------------------------------

export async function getMeta(key: string): Promise<unknown | undefined> {
  const record = await db.meta.get(key);
  return record?.value;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const record: MetaRecord = { key, value, updated_at: now() };
  await db.meta.put(record);
}

export async function getMetaString(key: string): Promise<string | null> {
  const value = await getMeta(key);
  return typeof value === "string" ? value : null;
}

export async function getMetaNumber(key: string): Promise<number | null> {
  const value = await getMeta(key);
  return typeof value === "number" ? value : null;
}

// ---------------------------------------------------------------------------
// Collection helpers
// ---------------------------------------------------------------------------

export function paginate<T>(items: T[], limit = 20, offset = 0): { items: T[]; has_more: boolean } {
  const safeLimit = Math.max(1, Math.min(100, limit));
  const safeOffset = Math.max(0, offset);
  const page = items.slice(safeOffset, safeOffset + safeLimit);
  return { items: page, has_more: safeOffset + page.length < items.length };
}

export function sortByCreatedAtDesc<T extends { created_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
}