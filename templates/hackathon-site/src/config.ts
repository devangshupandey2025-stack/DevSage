import siteConfig from '../site.config.json';

export interface SiteConfig {
  slug: string;
  title: string;
  description: string;
  accentColor: string;
  registrationStart: string;
  hackingStart: string;
  submissionDeadline: string;
  maxTeamSize: number;
  prizePool: string;
  apiOrigin: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  rules: string | null;
}

export const config: SiteConfig = siteConfig as SiteConfig;
