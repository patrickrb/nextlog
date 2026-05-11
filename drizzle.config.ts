import { defineConfig } from 'drizzle-kit';

// Drizzle Kit config — used for `drizzle-kit pull` (introspect), `drizzle-kit
// generate` (diff schema.ts → migration SQL), and `drizzle-kit migrate` (apply
// pending migrations).
//
// At runtime, install + admin migration both go through src/lib/migrator.ts
// (called by /api/install/migrate and /api/admin/migrate respectively).
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
