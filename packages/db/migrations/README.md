Run these migrations against your D1 database. They are ordered by timestamp prefixed filenames.

Recommended (drizzle-kit):

1. Build the package: `pnpm --filter @devsage/db run build`
2. Run drizzle-kit migrate or your D1 migration runner pointing at `packages/db/migrations`.

Alternatively, in dev you can apply the SQL via a one-off Worker that runs `env.DB.prepare(sql).run()`.
