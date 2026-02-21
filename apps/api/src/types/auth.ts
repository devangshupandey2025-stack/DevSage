export interface JWTPayload {
  sub: string;
  ghid?: number | null;
  ghu?: string | null;
  email?: string;
  name?: string;
  image?: string | null;
  platformAdmin?: boolean;
  workspaceRoles?: Record<string, string>;
  hackathonRoles?: Record<string, string[]>;
  fam: string;
  iat: number;
  exp: number;
}
