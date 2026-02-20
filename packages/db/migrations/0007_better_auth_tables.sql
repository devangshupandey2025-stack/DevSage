-- Better Auth tables (user, session, account, verification)
-- These tables are managed by Better Auth's Drizzle adapter.

CREATE TABLE IF NOT EXISTS `user` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `email` text NOT NULL,
  `emailVerified` integer NOT NULL,
  `image` text,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `user_email_unique` ON `user` (`email`);

CREATE TABLE IF NOT EXISTS `session` (
  `id` text PRIMARY KEY NOT NULL,
  `expiresAt` integer NOT NULL,
  `token` text NOT NULL,
  `ipAddress` text,
  `userAgent` text,
  `userId` text NOT NULL REFERENCES `user`(`id`),
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `session_token_unique` ON `session` (`token`);

CREATE TABLE IF NOT EXISTS `account` (
  `id` text PRIMARY KEY NOT NULL,
  `accountId` text NOT NULL,
  `providerId` text NOT NULL,
  `userId` text NOT NULL REFERENCES `user`(`id`),
  `accessToken` text,
  `refreshToken` text,
  `idToken` text,
  `accessTokenExpiresAt` integer,
  `refreshTokenExpiresAt` integer,
  `scope` text,
  `password` text,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `verification` (
  `id` text PRIMARY KEY NOT NULL,
  `identifier` text NOT NULL,
  `value` text NOT NULL,
  `expiresAt` integer NOT NULL,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);
