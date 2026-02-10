import type { JWTPayload } from '../lib/jwt.js';
import type { Env } from './env.js';

export type AuthenticatedUser = Pick<JWTPayload, 'sub' | 'ghid' | 'ghu'>;

export interface AuthAppEnv {
  Bindings: Env;
  Variables: {
    user: AuthenticatedUser;
  };
}
