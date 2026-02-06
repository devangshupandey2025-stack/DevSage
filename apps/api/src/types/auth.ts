import type { JWTPayload } from '../lib/jwt.js';
import type { Env } from './env.js';

export type AuthenticatedUser = JWTPayload;

export interface AuthAppEnv {
  Bindings: Env;
  Variables: {
    user: AuthenticatedUser;
  };
}
