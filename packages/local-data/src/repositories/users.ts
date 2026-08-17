/**
 * Users repository — demo user CRUD, role lookup, password simulation.
 */

import { db } from "../db/database.js";
import type { RoleRecord, UserRecord } from "../db/schema.js";
import { now, sha256Hex, uuid } from "../lib/utils.js";

export interface CreateUserInput {
  email: string;
  name: string;
  password?: string;
  avatar_url?: string | null;
  github_username?: string | null;
  is_platform_admin?: boolean;
  password_must_change?: boolean;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  avatar_url?: string | null;
  github_username?: string | null;
  is_platform_admin?: boolean;
  password_must_change?: boolean;
}

export interface UserListResult {
  items: UserRecord[];
  total: number;
  has_more: boolean;
}

export const usersRepository = {
  async getById(id: string): Promise<UserRecord | undefined> {
    return db.users.get(id);
  },

  async getByEmail(email: string): Promise<UserRecord | undefined> {
    return db.users.where("email").equals(email.toLowerCase()).first();
  },

  async list(limit = 20, offset = 0, search?: string): Promise<UserListResult> {
    let rows = await db.users.orderBy("created_at").reverse().toArray();
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      );
    }
    const total = rows.length;
    const page = rows.slice(offset, offset + limit);
    return { items: page, total, has_more: offset + page.length < total };
  },

  async count(): Promise<number> {
    return db.users.count();
  },

  async create(input: CreateUserInput): Promise<UserRecord> {
    if (await this.getByEmail(input.email)) {
      throw new Error("EMAIL_TAKEN");
    }
    const record: UserRecord = {
      id: uuid(),
      email: input.email.toLowerCase(),
      name: input.name,
      avatar_url: input.avatar_url ?? null,
      github_username: input.github_username ?? null,
      password_hash: input.password ? await sha256Hex(input.password) : null,
      password_must_change: input.password_must_change ?? false,
      is_platform_admin: input.is_platform_admin ?? false,
      created_at: now(),
      updated_at: now(),
    };
    await db.users.add(record);
    return record;
  },

  async update(id: string, input: UpdateUserInput): Promise<UserRecord | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;
    if (input.email && input.email.toLowerCase() !== existing.email) {
      const other = await this.getByEmail(input.email);
      if (other && other.id !== id) throw new Error("EMAIL_TAKEN");
    }
    const updated: UserRecord = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
      ...(input.avatar_url !== undefined ? { avatar_url: input.avatar_url } : {}),
      ...(input.github_username !== undefined ? { github_username: input.github_username } : {}),
      ...(input.is_platform_admin !== undefined
        ? { is_platform_admin: input.is_platform_admin }
        : {}),
      ...(input.password_must_change !== undefined
        ? { password_must_change: input.password_must_change }
        : {}),
      updated_at: now(),
    };
    await db.users.put(updated);
    return updated;
  },

  async remove(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;
    await db.users.delete(id);
    return true;
  },

  async listPlatformAdmins(): Promise<UserRecord[]> {
    const rows = await db.users.where("is_platform_admin").equals(1).toArray();
    return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  async setPlatformAdmin(id: string, isAdmin: boolean): Promise<void> {
    await db.users.update(id, { is_platform_admin: isAdmin, updated_at: now() });
  },

  async rolesForUser(userId: string): Promise<RoleRecord[]> {
    return db.roles.where("user_id").equals(userId).toArray();
  },

  /** Verify + replace the demo password; clears the forced-change flag on success. */
  async changePassword(userId: string, currentPassword: string, nextPassword: string): Promise<boolean> {
    const user = await this.getById(userId);
    if (!user?.password_hash) return false;
    const currentHash = await sha256Hex(currentPassword);
    if (currentHash !== user.password_hash) return false;
    await db.users.update(userId, {
      password_hash: await sha256Hex(nextPassword),
      password_must_change: false,
      updated_at: now(),
    });
    return true;
  },

  async forcePasswordChange(userId: string, must: boolean): Promise<void> {
    await db.users.update(userId, { password_must_change: must, updated_at: now() });
  },
};