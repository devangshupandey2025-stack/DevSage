export interface JWTPayload {
  sub: string;       // user ID
  fam: string;       // refresh token family ID
  iat: number;       // issued at (seconds)
  exp: number;       // expires at (seconds)
}
