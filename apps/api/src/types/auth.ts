import type { InferSelectModel } from 'drizzle-orm';
import type { hackathons } from '@devsage/db';
import type { JWTPayload } from '../lib/jwt.js';
import type { Env } from './env.js';
import type { Role } from '../middleware/role.js';

export type AuthenticatedUser = Pick<JWTPayload, 'sub' | 'ghid' | 'ghu' | 'fam'>;

export type HackathonRecord = InferSelectModel<typeof hackathons>;

export interface AuthAppEnv {
  Bindings: Env;
  Variables: {
    user: AuthenticatedUser;
    role: Role;
    hackathon: HackathonRecord;
  };
}
