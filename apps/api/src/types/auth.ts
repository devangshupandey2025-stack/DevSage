export interface JWTPayload {
  sub: string;       // user ID
  ghid: number | null;  // GitHub user ID
  ghu: string | null;   // GitHub username
  fam: string;       // refresh token family ID
  iat: number;       // issued at (seconds)
  exp: number;       // expires at (seconds)
}

export interface OAuthUserInfo {
  email: string;
  name: string;
  avatar_url: string | null;
  github_id?: number;
  github_username?: string;
  google_id?: string;
  auth_provider: 'github' | 'google';
}
