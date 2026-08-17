/**
 * Session store — local demo identity.
 *
 * WARNING: this is UI state only, NOT authentication. It provides no real
 * security; it exists so the four frontends keep working without a backend.
 */

import { db } from "../db/database.js";
import type { SessionRecord, UserRecord } from "../db/schema.js";
import { META_KEYS } from "../seed/demo-data.js";
import { now, sha256Hex, uuid } from "../lib/utils.js";
import { usersRepository } from "../repositories/users.js";

export interface LocalSession {
  user_id: string;
  active_role?: "platform_admin" | "organizer" | "judge" | "participant";
  created_at: string;
  updated_at: string;
}

export type ActiveRole = NonNullable<LocalSession["active_role"]>;

export interface MeResult {
  user: UserRecord;
  isPlatformAdmin: boolean;
  isOrganizer: boolean;
  isJudge: boolean;
  /** hackathon_id → roles */
  hackathonRoles: Record<string, string[]>;
  /** workspace_id → roles */
  workspaceRoles: Record<string, string[]>;
  password_must_change: boolean;
}

const ACTIVE_SESSION_KEY = "devsage.active_session_id";

function readMirror(): string | null {
  try {
    return localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

function writeMirror(sessionId: string | null): void {
  try {
    if (sessionId) localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    else localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // localStorage unavailable — IndexedDB is the source of truth.
  }
}

async function clearCurrentFlag(): Promise<void> {
  const current = await db.sessions.where("current").equals(1).toArray();
  for (const session of current) {
    await db.sessions.update(session.id, { current: 0 });
  }
}

/** Derive a UX role from the user's stored roles (best-effort branching). */
export function deriveActiveRole(user: UserRecord, roles: { scope: string; role: string }[]): ActiveRole {
  if (user.is_platform_admin) return "platform_admin";
  const organizerScopes = roles.filter(
    (r) => r.scope === "hackathon" && (r.role === "organizer" || r.role === "co_organizer"),
  );
  if (organizerScopes.length > 0) return "organizer";
  const judgeScopes = roles.filter((r) => r.scope === "hackathon" && r.role === "judge");
  if (judgeScopes.length > 0) return "judge";
  return "participant";
}

export const sessionStore = {
  /** Log in with demo email + password. */
  async login(email: string, password: string): Promise<LocalSession> {
    const user = await usersRepository.getByEmail(email);
    if (!user?.password_hash) throw new Error("INVALID_CREDENTIALS");
    const hash = await sha256Hex(password);
    if (hash !== user.password_hash) throw new Error("INVALID_CREDENTIALS");

    const roles = await usersRepository.rolesForUser(user.id);
    const activeRole = deriveActiveRole(user, roles);

    await clearCurrentFlag();
    const record: SessionRecord = {
      id: uuid(),
      user_id: user.id,
      active_role: activeRole,
      current: 1,
      created_at: now(),
      updated_at: now(),
    };
    await db.sessions.add(record);
    writeMirror(record.id);
    await db.meta.put({ key: META_KEYS.activeSessionId, value: record.id, updated_at: now() });
    return toLocalSession(record);
  },

  /** Demo quick-select: log in as a known demo identity without a password. */
  async loginAs(userId: string, activeRole?: ActiveRole): Promise<LocalSession> {
    const user = await usersRepository.getById(userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    const roles = await usersRepository.rolesForUser(userId);
    const derived = deriveActiveRole(user, roles);

    await clearCurrentFlag();
    const record: SessionRecord = {
      id: uuid(),
      user_id: userId,
      active_role: activeRole ?? derived,
      current: 1,
      created_at: now(),
      updated_at: now(),
    };
    await db.sessions.add(record);
    writeMirror(record.id);
    await db.meta.put({ key: META_KEYS.activeSessionId, value: record.id, updated_at: now() });
    return toLocalSession(record);
  },

  async logout(): Promise<void> {
    const current = await this.getCurrent();
    if (current) {
      const sessions = await db.sessions.where("user_id").equals(current.user_id).toArray();
      for (const session of sessions) {
        await db.sessions.delete(session.id);
      }
    }
    writeMirror(null);
    await db.meta.put({ key: META_KEYS.activeSessionId, value: null, updated_at: now() });
  },

  async getCurrent(): Promise<LocalSession | null> {
    const mirrorId = readMirror();
    if (mirrorId) {
      const session = await db.sessions.get(mirrorId);
      if (session) return toLocalSession(session);
    }
    const current = await db.sessions.where("current").equals(1).first();
    return current ? toLocalSession(current) : null;
  },

  async getCurrentSessionRecord(): Promise<SessionRecord | null> {
    const mirrorId = readMirror();
    if (mirrorId) {
      const session = await db.sessions.get(mirrorId);
      if (session) return session;
    }
    return (await db.sessions.where("current").equals(1).first()) ?? null;
  },

  async getCurrentUser(): Promise<UserRecord | null> {
    const session = await this.getCurrent();
    if (!session) return null;
    return (await usersRepository.getById(session.user_id)) ?? null;
  },

  async setActiveRole(role: ActiveRole): Promise<void> {
    const session = await this.getCurrentSessionRecord();
    if (!session) return;
    await db.sessions.update(session.id, { active_role: role, updated_at: now() });
  },

  /** Full identity + role resolution (adapter maps this to /auth/me responses). */
  async me(): Promise<MeResult | null> {
    const user = await this.getCurrentUser();
    if (!user) return null;
    const roles = await usersRepository.rolesForUser(user.id);

    const hackathonRoles: Record<string, string[]> = {};
    const workspaceRoles: Record<string, string[]> = {};
    for (const role of roles) {
      if (role.scope === "hackathon") {
        hackathonRoles[role.scope_id] = [...(hackathonRoles[role.scope_id] ?? []), role.role];
      } else if (role.scope === "workspace") {
        workspaceRoles[role.scope_id] = [...(workspaceRoles[role.scope_id] ?? []), role.role];
      }
    }

    return {
      user,
      isPlatformAdmin: user.is_platform_admin === true,
      isOrganizer:
        Object.values(hackathonRoles).some(
          (roles) => roles.includes("organizer") || roles.includes("co_organizer"),
        ) ||
        Object.values(workspaceRoles).some(
          (roles) => roles.includes("owner") || roles.includes("admin"),
        ),
      isJudge: Object.values(hackathonRoles).some((roles) => roles.includes("judge")),
      hackathonRoles,
      workspaceRoles,
      password_must_change: user.password_must_change === true,
    };
  },

  /** Simulated forced password change (judge demo flow). */
  async changePassword(currentPassword: string, nextPassword: string): Promise<boolean> {
    const user = await this.getCurrentUser();
    if (!user) return false;
    return usersRepository.changePassword(user.id, currentPassword, nextPassword);
  },
};

function toLocalSession(record: SessionRecord): LocalSession {
  return {
    user_id: record.user_id,
    ...(record.active_role ? { active_role: record.active_role as ActiveRole } : {}),
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}