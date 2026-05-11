import { defineConfig } from 'drizzle-kit';

// Drizzle Kit config — used for `drizzle-kit pull` (introspect), `drizzle-kit
// generate` (diff schema.ts → migration SQL), and `drizzle-kit migrate` (apply
// pending migrations).
//
// Current scope: schema-as-code + tooling only. The runtime install path
// (src/app/api/install/database/route.ts, /migrate-schema/route.ts) still uses
// the hand-rolled SQL files; a follow-up PR will switch the runtime over to
// `drizzle-kit migrate` with a backfill for existing installs.
export default defineConfig({
  dialect: 'postgresql',
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://nextlog:password@localhost:5432/nextlog',
  },
  // Don't include drizzle's own tracking table in introspection output
  schemaFilter: ['public'],
  verbose: true,
  strict: true,
});
